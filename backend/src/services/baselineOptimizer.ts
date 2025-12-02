/**
 * Baseline Greedy Assignment Optimizer
 *
 * Fast, deterministic assignment algorithm that runs before Claude.
 * Produces a feasible baseline solution when possible.
 *
 * Strategy:
 * 1. Process items by priority (medical > bypass mail > first-class > standard)
 * 2. Assign to earliest flight with matching destination
 * 3. Validate W&B after each assignment
 * 4. Track unassigned items for Claude optimization
 */

import {
  calculateWeightBalance,
  validateAssignment,
  calculateMultiLegWB,
} from './weightBalance.js';
import type {
  AircraftConfig,
  FlightData,
  PassengerData,
  FreightData,
  MailData,
  OptimizationResult,
  FlightAssignment,
  Diagnostic,
  AssignmentPlan,
  RouteLeg,
  WBResult,
} from '../types/index.js';

interface OptimizationInput {
  flights: (FlightData & { aircraft: AircraftConfig })[];
  passengers: PassengerData[];
  freight: FreightData[];
  mail: MailData[];
}

interface FlightState {
  flight: FlightData & { aircraft: AircraftConfig };
  assignedPassengers: PassengerData[];
  assignedFreight: FreightData[];
  assignedMail: MailData[];
  lastWB: WBResult | null;
}

const STANDARD_PASSENGER_WEIGHT_KG = parseFloat(process.env.STANDARD_ADULT_WEIGHT_KG || '88');

/**
 * Priority order for assignment (lower = higher priority)
 */
const PASSENGER_PRIORITY_ORDER: Record<string, number> = {
  'EVAC': 0,
  'MEDICAL': 1,
  'FIRST_CLASS': 2,
  'NORMAL': 3,
};

const FREIGHT_PRIORITY_ORDER: Record<string, number> = {
  'BYPASS': 0,
  'PRIORITY': 1,
  'STANDARD': 2,
};

/**
 * Run baseline greedy optimization
 */
export function runBaselineOptimization(input: OptimizationInput): OptimizationResult {
  const startTime = Date.now();
  const diagnostics: Diagnostic[] = [];

  // Initialize flight states WITH already-assigned items
  const flightStates: Map<number, FlightState> = new Map();
  for (const flight of input.flights) {
    // Find items already assigned to this flight
    const assignedPassengers = input.passengers.filter(p => p.flightId === flight.id);
    const assignedFreight = input.freight.filter(f => f.assignedFlightId === flight.id);
    const assignedMail = input.mail.filter(m => m.assignedFlightId === flight.id);

    flightStates.set(flight.id, {
      flight,
      assignedPassengers,
      assignedFreight,
      assignedMail,
      lastWB: null,
    });
  }

  // Track unassigned items
  const unassignedPassengers: PassengerData[] = [];
  const unassignedFreight: FreightData[] = [];
  const unassignedMail: MailData[] = [];

  // Get only items that need to be assigned (no current flight)
  const passengersToAssign = input.passengers.filter(p => !p.flightId);
  const freightToAssign = input.freight.filter(f => !f.assignedFlightId);
  const mailToAssign = input.mail.filter(m => !m.assignedFlightId);

  // Step 1: Assign passengers (sorted by priority, then by destination)
  const sortedPassengers = sortPassengersByPriority(passengersToAssign);
  for (const passenger of sortedPassengers) {
    const assigned = assignPassengerToFlight(passenger, flightStates, diagnostics);
    if (!assigned) {
      unassignedPassengers.push(passenger);
    }
  }

  // Step 2: Assign mail (bypass mail is highest priority for cargo)
  const sortedMail = sortMailByPriority(mailToAssign);
  for (const mailItem of sortedMail) {
    const assigned = assignMailToFlight(mailItem, flightStates, diagnostics);
    if (!assigned) {
      unassignedMail.push(mailItem);
    }
  }

  // Step 3: Assign freight (sorted by priority, then by weight descending)
  const sortedFreight = sortFreightByPriority(freightToAssign);
  for (const freightItem of sortedFreight) {
    const assigned = assignFreightToFlight(freightItem, flightStates, diagnostics);
    if (!assigned) {
      unassignedFreight.push(freightItem);
    }
  }

  // Build result
  const flightAssignments: FlightAssignment[] = [];
  for (const [flightId, state] of flightStates) {
    const wb = calculateFlightWB(state);
    flightAssignments.push({
      flightId,
      passengerIds: state.assignedPassengers.map(p => p.id),
      freightIds: state.assignedFreight.map(f => f.id),
      mailIds: state.assignedMail.map(m => m.id),
      totalWeightKg: wb?.totalWeightKg || 0,
      cg: wb?.cg || 0,
    });

    // Add warnings from W&B calculation
    if (wb) {
      for (const warning of wb.warnings) {
        diagnostics.push({
          type: warning.type,
          code: warning.code,
          message: warning.message,
          flightId,
        });
      }
    }
  }

  // Determine overall status
  // Status is 'ok' if there are no critical errors (W&B violations on assigned items)
  // Unassigned items result in 'infeasible' only if they COULD have been assigned but weren't
  const hasErrors = diagnostics.some(d => d.type === 'error');

  // Check if any unassigned items actually have a matching flight route
  // If no flights serve their destination, they're "impossible" not "failed"
  const hasAssignableUnassigned =
    unassignedPassengers.some(p =>
      input.flights.some(f => flightServesDestination(f, p.destination))
    ) ||
    unassignedFreight.some(fr =>
      input.flights.some(f => flightServesDestination(f, fr.destination))
    ) ||
    unassignedMail.some(m =>
      input.flights.some(f => flightServesDestination(f, m.village))
    );

  // Status is infeasible only if we have errors OR items that could be assigned but weren't
  const status = hasErrors || hasAssignableUnassigned ? 'infeasible' : 'ok';

  // Build explanation
  const explanation = buildExplanation(
    input.flights,
    flightAssignments,
    unassignedPassengers,
    unassignedFreight,
    unassignedMail,
    Date.now() - startTime
  );

  return {
    status,
    assignmentPlan: {
      flightAssignments,
      unassignedItems: {
        passengers: unassignedPassengers.map(p => p.id),
        freight: unassignedFreight.map(f => f.id),
        mail: unassignedMail.map(m => m.id),
      },
    },
    diagnostics,
    explanations: explanation,
  };
}

/**
 * Sort passengers by priority
 */
function sortPassengersByPriority(passengers: PassengerData[]): PassengerData[] {
  return [...passengers].sort((a, b) => {
    const prioA = PASSENGER_PRIORITY_ORDER[a.priority] ?? 3;
    const prioB = PASSENGER_PRIORITY_ORDER[b.priority] ?? 3;
    if (prioA !== prioB) return prioA - prioB;
    // Secondary sort: destination alphabetically for grouping
    return a.destination.localeCompare(b.destination);
  });
}

/**
 * Sort mail by priority
 */
function sortMailByPriority(mail: MailData[]): MailData[] {
  return [...mail].sort((a, b) => {
    const prioA = FREIGHT_PRIORITY_ORDER[a.priority] ?? 2;
    const prioB = FREIGHT_PRIORITY_ORDER[b.priority] ?? 2;
    if (prioA !== prioB) return prioA - prioB;
    // Secondary sort: heavier items first (fill efficiently)
    return b.weightKg - a.weightKg;
  });
}

/**
 * Sort freight by priority
 */
function sortFreightByPriority(freight: FreightData[]): FreightData[] {
  return [...freight].sort((a, b) => {
    const prioA = FREIGHT_PRIORITY_ORDER[a.priority] ?? 2;
    const prioB = FREIGHT_PRIORITY_ORDER[b.priority] ?? 2;
    if (prioA !== prioB) return prioA - prioB;
    // Secondary sort: heavier items first
    return b.weightKg - a.weightKg;
  });
}

/**
 * Try to assign a passenger to a suitable flight
 */
function assignPassengerToFlight(
  passenger: PassengerData,
  flightStates: Map<number, FlightState>,
  diagnostics: Diagnostic[]
): boolean {
  // Find flights that serve passenger's destination
  const candidateFlights = Array.from(flightStates.values())
    .filter(state => flightServesDestination(state.flight, passenger.destination))
    .sort((a, b) => {
      // Sort by departure time (earliest first)
      const timeA = a.flight.departureTime?.getTime() || 0;
      const timeB = b.flight.departureTime?.getTime() || 0;
      return timeA - timeB;
    });

  for (const state of candidateFlights) {
    // Check if we have seat capacity
    if (state.assignedPassengers.length >= state.flight.aircraft.seats) {
      continue;
    }

    // Try adding passenger and check W&B
    const testState = {
      ...state,
      assignedPassengers: [...state.assignedPassengers, passenger],
    };

    const wb = calculateFlightWB(testState);
    if (wb && wb.isValid) {
      // Assignment is valid
      state.assignedPassengers.push(passenger);
      state.lastWB = wb;
      return true;
    } else if (wb) {
      // Record why it failed
      diagnostics.push({
        type: 'info',
        code: 'ASSIGNMENT_REJECTED',
        message: `Could not assign ${passenger.name} to flight ${state.flight.flightNumber}: ${wb.warnings.filter(w => w.type === 'error').map(w => w.message).join('; ')}`,
        flightId: state.flight.id,
        itemId: passenger.id,
        itemType: 'PASSENGER',
      });
    }
  }

  // No suitable flight found
  diagnostics.push({
    type: 'warning',
    code: 'UNASSIGNED_PASSENGER',
    message: `Could not assign passenger ${passenger.name} to any flight going to ${passenger.destination}`,
    itemId: passenger.id,
    itemType: 'PASSENGER',
  });

  return false;
}

/**
 * Try to assign mail to a suitable flight
 */
function assignMailToFlight(
  mailItem: MailData,
  flightStates: Map<number, FlightState>,
  diagnostics: Diagnostic[]
): boolean {
  // Find flights that serve mail's village
  const candidateFlights = Array.from(flightStates.values())
    .filter(state => flightServesDestination(state.flight, mailItem.village))
    .sort((a, b) => {
      // Sort by departure time
      const timeA = a.flight.departureTime?.getTime() || 0;
      const timeB = b.flight.departureTime?.getTime() || 0;
      return timeA - timeB;
    });

  for (const state of candidateFlights) {
    // Try adding mail and check W&B
    const testState = {
      ...state,
      assignedMail: [...state.assignedMail, mailItem],
    };

    const wb = calculateFlightWB(testState);
    if (wb && wb.isValid) {
      state.assignedMail.push(mailItem);
      state.lastWB = wb;
      return true;
    }
  }

  diagnostics.push({
    type: 'warning',
    code: 'UNASSIGNED_MAIL',
    message: `Could not assign mail to ${mailItem.village} (${mailItem.weightKg}kg) to any flight`,
    itemId: mailItem.id,
    itemType: 'MAIL',
  });

  return false;
}

/**
 * Try to assign freight to a suitable flight
 */
function assignFreightToFlight(
  freightItem: FreightData,
  flightStates: Map<number, FlightState>,
  diagnostics: Diagnostic[]
): boolean {
  // Find flights that serve freight's destination
  const candidateFlights = Array.from(flightStates.values())
    .filter(state => flightServesDestination(state.flight, freightItem.destination))
    .sort((a, b) => {
      // Sort by remaining capacity (most capacity first)
      const wbA = calculateFlightWB(a);
      const wbB = calculateFlightWB(b);
      const remainingA = wbA ? wbA.weightMarginKg : 0;
      const remainingB = wbB ? wbB.weightMarginKg : 0;
      return remainingB - remainingA;
    });

  for (const state of candidateFlights) {
    // Try adding freight and check W&B
    const testState = {
      ...state,
      assignedFreight: [...state.assignedFreight, freightItem],
    };

    const wb = calculateFlightWB(testState);
    if (wb && wb.isValid) {
      state.assignedFreight.push(freightItem);
      state.lastWB = wb;
      return true;
    }
  }

  diagnostics.push({
    type: 'warning',
    code: 'UNASSIGNED_FREIGHT',
    message: `Could not assign freight ${freightItem.waybill || freightItem.id} (${freightItem.weightKg}kg) to ${freightItem.destination}`,
    itemId: freightItem.id,
    itemType: 'FREIGHT',
  });

  return false;
}

/**
 * Check if a flight serves a particular destination
 */
function flightServesDestination(flight: FlightData & { aircraft: AircraftConfig }, destination: string): boolean {
  const route = flight.route as RouteLeg[];
  return route.some(leg => leg.to.toLowerCase() === destination.toLowerCase());
}

/**
 * Calculate W&B for a flight state
 */
function calculateFlightWB(state: FlightState): WBResult | null {
  try {
    return calculateWeightBalance({
      aircraft: state.flight.aircraft,
      pilotWeightKg: Number(state.flight.pilotWeightKg) || Number(state.flight.aircraft.pilotStandardWeightKg),
      fuelWeightKg: Number(state.flight.fuelWeightKg) || 0,
      passengers: state.assignedPassengers,
      freight: state.assignedFreight,
      mail: state.assignedMail,
    });
  } catch (error) {
    console.error('Error calculating W&B:', error);
    return null;
  }
}

/**
 * Build human-readable explanation of results
 */
function buildExplanation(
  flights: (FlightData & { aircraft: AircraftConfig })[],
  flightAssignments: FlightAssignment[],
  unassignedPassengers: PassengerData[],
  unassignedFreight: FreightData[],
  unassignedMail: MailData[],
  durationMs: number
): string {
  const lines: string[] = [];

  lines.push(`Baseline optimization completed in ${durationMs}ms.`);

  const totalAssigned = flightAssignments.reduce(
    (sum, fa) => sum + fa.passengerIds.length + fa.freightIds.length + fa.mailIds.length,
    0
  );

  lines.push(`Assigned ${totalAssigned} items across ${flightAssignments.length} flights.`);

  if (unassignedPassengers.length > 0) {
    // Categorize by reason
    const noRoute = unassignedPassengers.filter(p =>
      !flights.some(f => flightServesDestination(f, p.destination))
    );
    const failedAssignment = unassignedPassengers.filter(p =>
      flights.some(f => flightServesDestination(f, p.destination))
    );

    if (noRoute.length > 0) {
      lines.push(`${noRoute.length} passengers have no available flight to their destination.`);
    }
    if (failedAssignment.length > 0) {
      lines.push(`${failedAssignment.length} passengers could not fit on available flights (capacity/weight limits).`);
    }
  }

  if (unassignedFreight.length > 0) {
    const noRoute = unassignedFreight.filter(fr =>
      !flights.some(f => flightServesDestination(f, fr.destination))
    );
    const failedAssignment = unassignedFreight.filter(fr =>
      flights.some(f => flightServesDestination(f, fr.destination))
    );

    if (noRoute.length > 0) {
      lines.push(`${noRoute.length} freight items have no available flight route.`);
    }
    if (failedAssignment.length > 0) {
      const totalWeight = failedAssignment.reduce((sum, f) => sum + f.weightKg, 0);
      lines.push(`${failedAssignment.length} freight items (${totalWeight}kg) could not fit on available flights.`);
    }
  }

  if (unassignedMail.length > 0) {
    const noRoute = unassignedMail.filter(m =>
      !flights.some(f => flightServesDestination(f, m.village))
    );
    const failedAssignment = unassignedMail.filter(m =>
      flights.some(f => flightServesDestination(f, m.village))
    );

    if (noRoute.length > 0) {
      lines.push(`${noRoute.length} mail bags have no available flight route.`);
    }
    if (failedAssignment.length > 0) {
      const totalWeight = failedAssignment.reduce((sum, m) => sum + m.weightKg, 0);
      lines.push(`${failedAssignment.length} mail bags (${totalWeight}kg) could not fit on available flights.`);
    }
  }

  if (unassignedPassengers.length === 0 && unassignedFreight.length === 0 && unassignedMail.length === 0) {
    lines.push('All items successfully assigned.');
  }

  return lines.join(' ');
}

/**
 * Attempt to improve a baseline solution by moving items between flights
 */
export function improveSolution(
  currentResult: OptimizationResult,
  input: OptimizationInput
): OptimizationResult {
  // If baseline is already optimal, return as-is
  if (currentResult.status === 'ok' && currentResult.assignmentPlan.unassignedItems.passengers.length === 0) {
    return currentResult;
  }

  // Try moving items from overweight flights to underweight flights
  // This is a simple improvement heuristic

  const diagnostics = [...currentResult.diagnostics];
  const flightAssignments = [...currentResult.assignmentPlan.flightAssignments];

  // Find overweight flights
  const overweightFlights = flightAssignments.filter(fa => {
    const flight = input.flights.find(f => f.id === fa.flightId);
    if (!flight) return false;
    return fa.totalWeightKg > flight.aircraft.maxTakeoffKg;
  });

  // Find flights with spare capacity
  const underweightFlights = flightAssignments.filter(fa => {
    const flight = input.flights.find(f => f.id === fa.flightId);
    if (!flight) return false;
    const margin = flight.aircraft.maxTakeoffKg - fa.totalWeightKg;
    return margin > 50; // At least 50kg spare
  });

  // Try moving freight from overweight to underweight flights with same destination
  for (const overweight of overweightFlights) {
    const srcFlight = input.flights.find(f => f.id === overweight.flightId);
    if (!srcFlight) continue;

    for (const freightId of overweight.freightIds) {
      const freightItem = input.freight.find(f => f.id === freightId);
      if (!freightItem) continue;

      // Find underweight flight serving same destination
      for (const underweight of underweightFlights) {
        const destFlight = input.flights.find(f => f.id === underweight.flightId);
        if (!destFlight) continue;

        if (!flightServesDestination(destFlight, freightItem.destination)) continue;

        const margin = destFlight.aircraft.maxTakeoffKg - underweight.totalWeightKg;
        if (margin >= freightItem.weightKg) {
          // Move the freight
          overweight.freightIds = overweight.freightIds.filter(id => id !== freightId);
          underweight.freightIds.push(freightId);

          diagnostics.push({
            type: 'info',
            code: 'MOVED_FREIGHT',
            message: `Moved freight ${freightItem.waybill || freightId} from flight ${srcFlight.flightNumber} to ${destFlight.flightNumber} for better balance`,
            flightId: underweight.flightId,
            itemId: freightId,
            itemType: 'FREIGHT',
          });

          break;
        }
      }
    }
  }

  return {
    ...currentResult,
    assignmentPlan: {
      ...currentResult.assignmentPlan,
      flightAssignments,
    },
    diagnostics,
  };
}

export default {
  runBaselineOptimization,
  improveSolution,
};
