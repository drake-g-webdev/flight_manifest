/**
 * OpenAI Integration Service
 *
 * Handles communication with OpenAI API for advanced optimization
 * when baseline algorithm fails or produces suboptimal results.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import type {
  OptimizationResult,
  ClaudeOptimizationInput,
  ClaudeFlightInput,
  ClaudePassengerInput,
  ClaudeFreightInput,
  ClaudeMailInput,
  FlightAssignment,
  Diagnostic,
} from '../types/index.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.1; // Low temperature for deterministic outputs

// Response validation schema
const OpenAIResponseSchema = z.object({
  status: z.enum(['ok', 'infeasible']),
  assignment_plan: z.object({
    flight_assignments: z.array(z.object({
      flight_id: z.number(),
      passenger_ids: z.array(z.number()),
      freight_ids: z.array(z.number()),
      mail_ids: z.array(z.number()),
      total_weight_kg: z.number(),
      cg: z.number(),
      seat_assignments: z.record(z.string(), z.number()).optional(),
      compartment_assignments: z.record(z.string(), z.string()).optional(),
    })),
    unassigned_items: z.object({
      passengers: z.array(z.number()),
      freight: z.array(z.number()),
      mail: z.array(z.number()),
    }),
  }),
  diagnostics: z.array(z.object({
    type: z.enum(['error', 'warning', 'info']),
    code: z.string(),
    message: z.string(),
    flight_id: z.number().optional(),
    item_id: z.number().optional(),
  })),
  explanations: z.string(),
  suggested_actions: z.array(z.object({
    priority: z.number(),
    action: z.string(),
    item_type: z.enum(['PASSENGER', 'FREIGHT', 'MAIL']),
    item_id: z.number(),
    from_flight_id: z.number().optional(),
    to_flight_id: z.number().optional(),
    reason: z.string(),
  })).optional(),
});

type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;

/**
 * System prompt for OpenAI optimizer
 */
const SYSTEM_PROMPT = `You are an operations optimizer for a small bush airline in Alaska. Your job is to assign passengers, freight, and mail to flights while respecting aircraft weight limits and center of gravity (CG) constraints.

CRITICAL RULES:
1. NEVER exceed Maximum Takeoff Weight (MTOW) for any flight
2. NEVER allow CG outside the aircraft's envelope (cg_min to cg_max)
3. Priority order for assignment: medical/evac passengers > bypass mail > first-class passengers > priority freight > normal passengers > standard freight/mail
4. Passengers MUST be assigned to flights that serve their destination
5. For multi-leg flights, items stay onboard until they reach their destination - weight affects ALL prior legs

OUTPUT FORMAT:
You MUST output valid JSON matching this exact schema:
{
  "status": "ok" | "infeasible",
  "assignment_plan": {
    "flight_assignments": [
      {
        "flight_id": <number>,
        "passenger_ids": [<number>],
        "freight_ids": [<number>],
        "mail_ids": [<number>],
        "total_weight_kg": <number>,
        "cg": <number>,
        "seat_assignments": { "<passenger_id>": <seat_number> },
        "compartment_assignments": { "<freight_id>": "<compartment_name>" }
      }
    ],
    "unassigned_items": {
      "passengers": [<number>],
      "freight": [<number>],
      "mail": [<number>]
    }
  },
  "diagnostics": [
    { "type": "error"|"warning"|"info", "code": "<CODE>", "message": "<description>", "flight_id": <number>, "item_id": <number> }
  ],
  "explanations": "<Brief explanation of your assignment decisions>",
  "suggested_actions": [
    { "priority": 1, "action": "move|offload|add_flight", "item_type": "PASSENGER|FREIGHT|MAIL", "item_id": <number>, "from_flight_id": <number>, "to_flight_id": <number>, "reason": "<why>" }
  ]
}

If you cannot create a feasible assignment:
- Set status to "infeasible"
- List unassigned items
- Provide suggested_actions with specific recommendations (in priority order)

CALCULATION NOTES:
- Total Weight = empty_weight + pilot_weight + fuel_weight + sum(passenger_weights) + sum(baggage) + sum(freight) + sum(mail)
- CG = total_moment / total_weight, where moment = weight * arm
- Each seat has an arm (distance from datum). Heavy passengers should be positioned to keep CG within limits.
- Baggage compartments have capacity limits - don't exceed them.`;

/**
 * Few-shot examples for OpenAI
 */
const FEW_SHOT_EXAMPLES = `
EXAMPLE 1 - Simple feasible case:
Input: 1 flight, 2 passengers, 1 freight item, all fit within limits
Output:
{
  "status": "ok",
  "assignment_plan": {
    "flight_assignments": [
      {
        "flight_id": 12,
        "passenger_ids": [101, 102],
        "freight_ids": [501],
        "mail_ids": [],
        "total_weight_kg": 1750,
        "cg": 25.1
      }
    ],
    "unassigned_items": { "passengers": [], "freight": [], "mail": [] }
  },
  "diagnostics": [{ "type": "info", "code": "OK", "message": "All items assigned within constraints" }],
  "explanations": "Assigned both passengers and freight to flight 12. Heavy passenger placed in seat 2 (arm 1.8) to maintain CG."
}

EXAMPLE 2 - Overweight scenario:
Input: 1 flight, 3 passengers + 200kg freight, would exceed MTOW by 50kg
Output:
{
  "status": "infeasible",
  "assignment_plan": {
    "flight_assignments": [
      {
        "flight_id": 12,
        "passenger_ids": [101, 102, 103],
        "freight_ids": [],
        "mail_ids": [],
        "total_weight_kg": 1950,
        "cg": 24.8
      }
    ],
    "unassigned_items": { "passengers": [], "freight": [501], "mail": [] }
  },
  "diagnostics": [
    { "type": "warning", "code": "FREIGHT_OFFLOADED", "message": "Removed freight 501 to stay within MTOW", "item_id": 501 }
  ],
  "explanations": "All passengers assigned as priority. Freight offloaded due to weight constraints.",
  "suggested_actions": [
    { "priority": 1, "action": "add_flight", "item_type": "FREIGHT", "item_id": 501, "reason": "Add another flight to carry offloaded freight" }
  ]
}
`;

/**
 * Build the user prompt with current state
 */
function buildUserPrompt(input: ClaudeOptimizationInput): string {
  return `
CURRENT STATE:
${JSON.stringify(input, null, 2)}

TASK:
1. Assign all passengers, freight, and mail to appropriate flights
2. Respect all weight and CG constraints
3. Prioritize high-priority items (medical, bypass mail)
4. Calculate accurate total_weight_kg and cg for each flight
5. If any items cannot be assigned feasibly, list them as unassigned and explain why

Respond with JSON only. No additional text.
`;
}

/**
 * Parse and validate OpenAI's response
 */
function parseOpenAIResponse(content: string): OpenAIResponse | null {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    const validated = OpenAIResponseSchema.parse(parsed);
    return validated;
  } catch (error) {
    console.error('Failed to parse OpenAI response:', error);
    console.error('Raw content:', content);
    return null;
  }
}

/**
 * Convert OpenAI response to internal format
 */
function convertToOptimizationResult(response: OpenAIResponse): OptimizationResult {
  const flightAssignments: FlightAssignment[] = response.assignment_plan.flight_assignments.map(fa => ({
    flightId: fa.flight_id,
    passengerIds: fa.passenger_ids,
    freightIds: fa.freight_ids,
    mailIds: fa.mail_ids,
    totalWeightKg: fa.total_weight_kg,
    cg: fa.cg,
    seatAssignments: fa.seat_assignments
      ? Object.fromEntries(
          Object.entries(fa.seat_assignments).map(([k, v]) => [parseInt(k), v])
        )
      : undefined,
    compartmentAssignments: fa.compartment_assignments
      ? Object.fromEntries(
          Object.entries(fa.compartment_assignments).map(([k, v]) => [parseInt(k), v])
        )
      : undefined,
  }));

  const diagnostics: Diagnostic[] = response.diagnostics.map(d => ({
    type: d.type,
    code: d.code,
    message: d.message,
    flightId: d.flight_id,
    itemId: d.item_id,
  }));

  return {
    status: response.status,
    assignmentPlan: {
      flightAssignments,
      unassignedItems: response.assignment_plan.unassigned_items,
    },
    diagnostics,
    explanations: response.explanations,
    suggestedActions: response.suggested_actions?.map(sa => ({
      priority: sa.priority,
      action: sa.action,
      itemType: sa.item_type,
      itemId: sa.item_id,
      fromFlightId: sa.from_flight_id,
      toFlightId: sa.to_flight_id,
      reason: sa.reason,
    })),
  };
}

/**
 * Run OpenAI-powered optimization
 */
export async function runOpenAIOptimization(
  input: ClaudeOptimizationInput
): Promise<OptimizationResult> {
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT + '\n\n' + FEW_SHOT_EXAMPLES,
        },
        {
          role: 'user',
          content: buildUserPrompt(input),
        },
      ],
    });

    // Extract text content
    const textContent = response.choices[0]?.message?.content;
    if (!textContent) {
      throw new Error('No text content in OpenAI response');
    }

    // Parse response
    const parsed = parseOpenAIResponse(textContent);
    if (!parsed) {
      throw new Error('Failed to parse OpenAI response as valid JSON');
    }

    const result = convertToOptimizationResult(parsed);

    // Add timing diagnostic
    result.diagnostics.push({
      type: 'info',
      code: 'OPENAI_TIMING',
      message: `OpenAI optimization completed in ${Date.now() - startTime}ms`,
    });

    return result;
  } catch (error) {
    console.error('OpenAI optimization error:', error);

    // Return error result
    return {
      status: 'error',
      assignmentPlan: {
        flightAssignments: [],
        unassignedItems: {
          passengers: input.passengers.map(p => p.id),
          freight: input.freight.map(f => f.id),
          mail: input.mail.map(m => m.id),
        },
      },
      diagnostics: [
        {
          type: 'error',
          code: 'OPENAI_ERROR',
          message: `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      explanations: 'OpenAI optimization failed. Please use baseline algorithm or manual assignment.',
    };
  }
}

/**
 * Prepare input for OpenAI from database models
 */
export function prepareOpenAIInput(
  flights: ClaudeFlightInput[],
  passengers: ClaudePassengerInput[],
  freight: ClaudeFreightInput[],
  mail: ClaudeMailInput[]
): ClaudeOptimizationInput {
  return {
    flights,
    passengers,
    freight,
    mail,
    constraints: {
      standardPassengerWeightKg: parseFloat(process.env.STANDARD_ADULT_WEIGHT_KG || '88'),
      priorityOrder: ['EVAC', 'MEDICAL', 'BYPASS', 'FIRST_CLASS', 'PRIORITY', 'NORMAL', 'STANDARD'],
      bufferPercentage: 5, // 5% safety buffer
    },
  };
}

/**
 * Request OpenAI to explain a specific decision
 */
export async function explainDecision(
  context: string,
  question: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are an airline operations expert. Explain decisions about passenger and cargo assignments clearly and concisely.',
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    });

    const textContent = response.choices[0]?.message?.content;
    return textContent || 'Unable to generate explanation.';
  } catch (error) {
    console.error('OpenAI explanation error:', error);
    return 'Unable to generate explanation due to an error.';
  }
}

export default {
  runOpenAIOptimization,
  prepareOpenAIInput,
  explainDecision,
};
