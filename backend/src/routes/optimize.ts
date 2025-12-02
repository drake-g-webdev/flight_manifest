/**
 * Optimization API routes
 *
 * Handles running baseline and OpenAI-powered optimization
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { runBaselineOptimization, improveSolution } from '../services/baselineOptimizer.js';
import { runOpenAIOptimization, prepareOpenAIInput } from '../services/openaiOptimizer.js';
import { validateAssignment, calculateWeightBalance } from '../services/weightBalance.js';
import type {
  AircraftConfig,
  FlightData,
  PassengerData,
  FreightData,
  MailData,
  OptimizationResult,
  RouteLeg,
} from '../types/index.js';

const router = Router();

router.use(authenticateToken);

/**
 * POST /api/optimize - Run optimization for a date
 */
router.post(
  '/',
  requireRole('ADMIN', 'OPS'),
  [
    body('flightDate').isISO8601(),
    body('useClaudeOptimization').optional().isBoolean(),
    body('flightIds').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    const startTime = Date.now();

    try {
      const flightDate = new Date(req.body.flightDate);
      const useAIOptimization = req.body.useClaudeOptimization === true; // Keep param name for backwards compatibility
      const specificFlightIds = req.body.flightIds as number[] | undefined;

      // Fetch flights for the date
      const flightWhereClause: any = {
        flightDate,
        status: { in: ['DRAFT', 'SCHEDULED'] },
      };

      if (specificFlightIds && specificFlightIds.length > 0) {
        flightWhereClause.id = { in: specificFlightIds };
      }

      const flights = await prisma.flight.findMany({
        where: flightWhereClause,
        include: {
          aircraft: true,
          passengers: true,
          freight: true,
          mail: true,
        },
      });

      if (flights.length === 0) {
        res.status(404).json({ success: false, error: 'No flights found for the specified date' });
        return;
      }

      // Fetch unassigned items
      const [unassignedPassengers, unassignedFreight, unassignedMail] = await Promise.all([
        prisma.passenger.findMany({ where: { flightId: null } }),
        prisma.freight.findMany({ where: { assignedFlightId: null } }),
        prisma.mailManifest.findMany({ where: { assignedFlightId: null } }),
      ]);

      // Convert to internal types
      const flightData = flights.map(f => ({
        ...f,
        pilotWeightKg: f.pilotWeightKg ? Number(f.pilotWeightKg) : null,
        fuelWeightKg: f.fuelWeightKg ? Number(f.fuelWeightKg) : null,
        aircraft: {
          id: f.aircraft.id,
          tail: f.aircraft.tail,
          type: f.aircraft.type,
          maxTakeoffKg: Number(f.aircraft.maxTakeoffKg),
          emptyWeightKg: Number(f.aircraft.emptyWeightKg),
          emptyWeightArm: Number(f.aircraft.emptyWeightArm),
          pilotStandardWeightKg: Number(f.aircraft.pilotStandardWeightKg),
          pilotArm: Number(f.aircraft.pilotArm),
          cgLimits: f.aircraft.cgLimits as any,
          seatConfiguration: f.aircraft.seatConfiguration as any,
          baggageCompartments: f.aircraft.baggageCompartments as any,
          fuelTankArm: Number(f.aircraft.fuelTankArm),
          seats: f.aircraft.seats,
        } as AircraftConfig,
      }));

      // Combine assigned and unassigned items
      const allPassengers: PassengerData[] = [
        ...flights.flatMap(f =>
          f.passengers.map(p => ({
            id: p.id,
            bookingRef: p.bookingRef,
            name: p.name,
            phone: p.phone,
            weightKg: p.weightKg ? Number(p.weightKg) : null,
            standardWeightUsed: p.standardWeightUsed,
            bagsKg: Number(p.bagsKg),
            destination: p.destination,
            priority: p.priority as any,
            seatNumber: p.seatNumber,
            flightId: p.flightId,
            notes: p.notes,
          }))
        ),
        ...unassignedPassengers.map(p => ({
          id: p.id,
          bookingRef: p.bookingRef,
          name: p.name,
          phone: p.phone,
          weightKg: p.weightKg ? Number(p.weightKg) : null,
          standardWeightUsed: p.standardWeightUsed,
          bagsKg: Number(p.bagsKg),
          destination: p.destination,
          priority: p.priority as any,
          seatNumber: p.seatNumber,
          flightId: null,
          notes: p.notes,
        })),
      ];

      const allFreight: FreightData[] = [
        ...flights.flatMap(f =>
          f.freight.map(fr => ({
            id: fr.id,
            waybill: fr.waybill,
            description: fr.description,
            weightKg: Number(fr.weightKg),
            destination: fr.destination,
            volumeM3: fr.volumeM3 ? Number(fr.volumeM3) : null,
            priority: fr.priority as any,
            compartment: fr.compartment,
            assignedFlightId: fr.assignedFlightId,
            notes: fr.notes,
          }))
        ),
        ...unassignedFreight.map(fr => ({
          id: fr.id,
          waybill: fr.waybill,
          description: fr.description,
          weightKg: Number(fr.weightKg),
          destination: fr.destination,
          volumeM3: fr.volumeM3 ? Number(fr.volumeM3) : null,
          priority: fr.priority as any,
          compartment: fr.compartment,
          assignedFlightId: null,
          notes: fr.notes,
        })),
      ];

      const allMail: MailData[] = [
        ...flights.flatMap(f =>
          f.mail.map(m => ({
            id: m.id,
            village: m.village,
            pounds: Number(m.pounds),
            weightKg: Number(m.weightKg),
            priority: m.priority as any,
            assignedFlightId: m.assignedFlightId,
            notes: m.notes,
          }))
        ),
        ...unassignedMail.map(m => ({
          id: m.id,
          village: m.village,
          pounds: Number(m.pounds),
          weightKg: Number(m.weightKg),
          priority: m.priority as any,
          assignedFlightId: null,
          notes: m.notes,
        })),
      ];

      // Step 1: Run baseline optimization
      let result = runBaselineOptimization({
        flights: flightData as any,
        passengers: allPassengers,
        freight: allFreight,
        mail: allMail,
      });

      // Step 2: Try to improve baseline
      result = improveSolution(result, {
        flights: flightData as any,
        passengers: allPassengers,
        freight: allFreight,
        mail: allMail,
      });

      // Step 3: If baseline fails and AI optimization is requested, try OpenAI
      if (result.status !== 'ok' && useAIOptimization) {
        try {
          const aiInput = prepareOpenAIInput(
            flightData.map(f => ({
              flightId: f.id,
              tail: f.aircraft.tail,
              mtow: f.aircraft.maxTakeoffKg,
              emptyWeight: f.aircraft.emptyWeightKg,
              emptyWeightArm: f.aircraft.emptyWeightArm,
              pilotWeight: f.pilotWeightKg || f.aircraft.pilotStandardWeightKg,
              pilotArm: f.aircraft.pilotArm,
              fuelWeight: f.fuelWeightKg || 0,
              fuelArm: f.aircraft.fuelTankArm,
              cgMin: f.aircraft.cgLimits.cgMin,
              cgMax: f.aircraft.cgLimits.cgMax,
              seats: f.aircraft.seats,
              seatArms: f.aircraft.seatConfiguration.map((s: any) => ({ seat: s.seat, arm: s.arm })),
              compartments: f.aircraft.baggageCompartments,
              route: f.route as RouteLeg[],
              currentPassengerIds: f.passengers.map((p: any) => p.id),
              currentFreightIds: f.freight.map((fr: any) => fr.id),
              currentMailIds: f.mail.map((m: any) => m.id),
            })),
            allPassengers.map(p => ({
              id: p.id,
              name: p.name,
              weightKg: p.weightKg || 88,
              bagsKg: p.bagsKg,
              destination: p.destination,
              priority: p.priority,
              currentFlightId: p.flightId,
            })),
            allFreight.map(f => ({
              id: f.id,
              waybill: f.waybill || '',
              weightKg: f.weightKg,
              destination: f.destination,
              priority: f.priority,
              currentFlightId: f.assignedFlightId,
            })),
            allMail.map(m => ({
              id: m.id,
              village: m.village,
              weightKg: m.weightKg,
              priority: m.priority,
              currentFlightId: m.assignedFlightId,
            }))
          );

          const aiResult = await runOpenAIOptimization(aiInput);

          // Validate OpenAI's result
          let aiValid = true;
          for (const assignment of aiResult.assignmentPlan.flightAssignments) {
            const flight = flightData.find(f => f.id === assignment.flightId);
            if (!flight) continue;

            const assignedPassengers = allPassengers.filter(p =>
              assignment.passengerIds.includes(p.id)
            );
            const assignedFreight = allFreight.filter(f =>
              assignment.freightIds.includes(f.id)
            );
            const assignedMail = allMail.filter(m =>
              assignment.mailIds.includes(m.id)
            );

            const validation = validateAssignment({
              aircraft: flight.aircraft,
              pilotWeightKg: flight.pilotWeightKg || flight.aircraft.pilotStandardWeightKg,
              fuelWeightKg: flight.fuelWeightKg || 0,
              passengers: assignedPassengers,
              freight: assignedFreight,
              mail: assignedMail,
            });

            if (!validation.isValid) {
              aiValid = false;
              aiResult.diagnostics.push({
                type: 'error',
                code: 'VALIDATION_FAILED',
                message: `Flight ${flight.flightNumber}: ${validation.errors.join('; ')}`,
                flightId: flight.id,
              });
            }
          }

          // Use OpenAI result if valid, otherwise keep baseline
          if (aiValid && aiResult.status === 'ok') {
            result = aiResult;
            result.explanations = `[OpenAI] ${result.explanations}`;
          } else {
            result.diagnostics.push({
              type: 'info',
              code: 'AI_REJECTED',
              message: 'OpenAI optimization result failed validation, using baseline instead',
            });
          }
        } catch (aiError: any) {
          console.error('OpenAI optimization error:', aiError);
          // Extract error message
          let errorMessage = 'Unknown error';
          if (aiError?.message) {
            errorMessage = aiError.message;
          }
          result.diagnostics.push({
            type: 'warning',
            code: 'OPENAI_ERROR',
            message: `OpenAI optimization failed: ${errorMessage}`,
          });
        }
      }

      // Log optimization run
      await prisma.optimizationLog.create({
        data: {
          runDate: flightDate,
          inputPayload: {
            flightCount: flights.length,
            passengerCount: allPassengers.length,
            freightCount: allFreight.length,
            mailCount: allMail.length,
          },
          baselineResult: result as any,
          finalResult: result as any,
          status: result.status,
          durationMs: Date.now() - startTime,
        },
      });

      res.json({
        success: true,
        data: {
          ...result,
          meta: {
            flightCount: flights.length,
            passengerCount: allPassengers.length,
            freightCount: allFreight.length,
            mailCount: allMail.length,
            durationMs: Date.now() - startTime,
            usedAI: useAIOptimization && result.explanations.startsWith('[OpenAI]'),
          },
        },
      });
    } catch (error) {
      console.error('Optimization error:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
      res.status(500).json({
        success: false,
        error: 'Optimization failed',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      });
    }
  }
);

/**
 * POST /api/optimize/apply - Apply an optimization result
 */
router.post(
  '/apply',
  requireRole('ADMIN', 'OPS'),
  [body('assignmentPlan').isObject()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const { assignmentPlan } = req.body;
      const userId = req.user?.email || 'system';

      // Apply assignments in a transaction
      await prisma.$transaction(async tx => {
        for (const flightAssignment of assignmentPlan.flightAssignments) {
          const { flightId, passengerIds, freightIds, mailIds } = flightAssignment;

          // Update passengers
          for (const passengerId of passengerIds) {
            await tx.passenger.update({
              where: { id: passengerId },
              data: { flightId },
            });

            await tx.assignment.create({
              data: {
                flightId,
                resourceType: 'PASSENGER',
                resourceId: passengerId,
                createdBy: userId,
                reason: 'Applied from optimization',
              },
            });
          }

          // Update freight
          for (const freightId of freightIds) {
            await tx.freight.update({
              where: { id: freightId },
              data: { assignedFlightId: flightId },
            });

            await tx.assignment.create({
              data: {
                flightId,
                resourceType: 'FREIGHT',
                resourceId: freightId,
                createdBy: userId,
                reason: 'Applied from optimization',
              },
            });
          }

          // Update mail
          for (const mailId of mailIds) {
            await tx.mailManifest.update({
              where: { id: mailId },
              data: { assignedFlightId: flightId },
            });

            await tx.assignment.create({
              data: {
                flightId,
                resourceType: 'MAIL',
                resourceId: mailId,
                createdBy: userId,
                reason: 'Applied from optimization',
              },
            });
          }
        }
      });

      res.json({ success: true, message: 'Assignments applied successfully' });
    } catch (error) {
      console.error('Error applying assignments:', error);
      res.status(500).json({ success: false, error: 'Failed to apply assignments' });
    }
  }
);

/**
 * GET /api/optimize/logs - Get optimization history
 */
router.get(
  '/logs',
  requireRole('ADMIN', 'OPS'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const logs = await prisma.optimizationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({ success: true, data: logs });
    } catch (error) {
      console.error('Error fetching optimization logs:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch logs' });
    }
  }
);

export default router;
