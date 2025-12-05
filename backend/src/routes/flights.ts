/**
 * Flights API routes
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { calculateWeightBalance, calculateMultiLegWB } from '../services/weightBalance.js';
import type { AircraftConfig, RouteLeg, LegWBResult } from '../types/index.js';

const router = Router();

// Apply auth to all routes
router.use(authenticateToken);

/**
 * GET /api/flights - List flights with optional date filter
 * Requires operatorId query param for filtering by operator
 */
router.get(
  '/',
  query('date').optional().isISO8601(),
  query('status').optional().isIn(['DRAFT', 'SCHEDULED', 'DEPARTED', 'CANCELLED']),
  query('operatorId').optional().isInt(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const whereClause: any = {};

      // Filter by operator - use query param or fall back to user's operator
      if (req.query.operatorId) {
        const requestedOperatorId = parseInt(req.query.operatorId as string);
        // Super admin can access any operator, others must match their operatorId
        if (user.operatorId && user.operatorId !== requestedOperatorId) {
          res.status(403).json({ success: false, error: 'Access denied to this operator' });
          return;
        }
        whereClause.operatorId = requestedOperatorId;
      } else if (user.operatorId) {
        // Non-super admin defaults to their own operator
        whereClause.operatorId = user.operatorId;
      }
      // Super admin with no operatorId param sees all flights

      if (req.query.date) {
        const date = new Date(req.query.date as string);
        whereClause.flightDate = date;
      }

      if (req.query.status) {
        whereClause.status = req.query.status;
      }

      const flights = await prisma.flight.findMany({
        where: whereClause,
        include: {
          aircraft: true,
          passengers: true,
          freight: true,
          mail: true,
        },
        orderBy: [{ flightDate: 'asc' }, { departureTime: 'asc' }],
      });

      // Calculate W&B summary for each flight
      const flightsWithWB = flights.map(flight => {
        const aircraftConfig: AircraftConfig = {
          id: flight.aircraft.id,
          tail: flight.aircraft.tail,
          type: flight.aircraft.type,
          maxTakeoffKg: Number(flight.aircraft.maxTakeoffKg),
          emptyWeightKg: Number(flight.aircraft.emptyWeightKg),
          emptyWeightArm: Number(flight.aircraft.emptyWeightArm),
          pilotStandardWeightKg: Number(flight.aircraft.pilotStandardWeightKg),
          pilotArm: Number(flight.aircraft.pilotArm),
          cgLimits: flight.aircraft.cgLimits as any,
          seatConfiguration: flight.aircraft.seatConfiguration as any,
          baggageCompartments: flight.aircraft.baggageCompartments as any,
          fuelTankArm: Number(flight.aircraft.fuelTankArm),
          seats: flight.aircraft.seats,
        };

        const wb = calculateWeightBalance({
          aircraft: aircraftConfig,
          pilotWeightKg: Number(flight.pilotWeightKg) || Number(flight.aircraft.pilotStandardWeightKg),
          fuelWeightKg: Number(flight.fuelWeightKg) || 0,
          passengers: flight.passengers.map(p => ({
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
          })),
          freight: flight.freight.map(f => ({
            id: f.id,
            waybill: f.waybill,
            description: f.description,
            weightKg: Number(f.weightKg),
            destination: f.destination,
            volumeM3: f.volumeM3 ? Number(f.volumeM3) : null,
            priority: f.priority as any,
            compartment: f.compartment,
            assignedFlightId: f.assignedFlightId,
            notes: f.notes,
          })),
          mail: flight.mail.map(m => ({
            id: m.id,
            village: m.village,
            pounds: Number(m.pounds),
            weightKg: Number(m.weightKg),
            priority: m.priority as any,
            assignedFlightId: m.assignedFlightId,
            notes: m.notes,
          })),
        });

        // Determine status indicator
        let wbStatus: 'ok' | 'warning' | 'error' = 'ok';
        if (!wb.isValid) {
          wbStatus = 'error';
        } else if (wb.warnings.some(w => w.type === 'warning')) {
          wbStatus = 'warning';
        }

        return {
          id: flight.id,
          flightDate: flight.flightDate,
          flightNumber: flight.flightNumber,
          origin: flight.origin,
          departureTime: flight.departureTime,
          route: flight.route,
          tail: flight.aircraft.tail,
          aircraftType: flight.aircraft.type,
          pilotName: flight.pilotName,
          status: flight.status,
          passengerCount: flight.passengers.length,
          freightCount: flight.freight.length,
          mailCount: flight.mail.length,
          totalWeightKg: wb.totalWeightKg,
          cg: wb.cg,
          wbStatus,
          wbWarnings: wb.warnings,
        };
      });

      res.json({ success: true, data: flightsWithWB });
    } catch (error) {
      console.error('Error fetching flights:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch flights' });
    }
  }
);

/**
 * GET /api/flights/:id - Get single flight with full details
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid flight ID' });
    return;
  }

  try {
    const flight = await prisma.flight.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        aircraft: true,
        passengers: { orderBy: { seatNumber: 'asc' } },
        freight: { orderBy: { priority: 'asc' } },
        mail: { orderBy: { priority: 'asc' } },
        manifests: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!flight) {
      res.status(404).json({ success: false, error: 'Flight not found' });
      return;
    }

    // Build aircraft config
    const aircraftConfig: AircraftConfig = {
      id: flight.aircraft.id,
      tail: flight.aircraft.tail,
      type: flight.aircraft.type,
      maxTakeoffKg: Number(flight.aircraft.maxTakeoffKg),
      emptyWeightKg: Number(flight.aircraft.emptyWeightKg),
      emptyWeightArm: Number(flight.aircraft.emptyWeightArm),
      pilotStandardWeightKg: Number(flight.aircraft.pilotStandardWeightKg),
      pilotArm: Number(flight.aircraft.pilotArm),
      cgLimits: flight.aircraft.cgLimits as any,
      seatConfiguration: flight.aircraft.seatConfiguration as any,
      baggageCompartments: flight.aircraft.baggageCompartments as any,
      fuelTankArm: Number(flight.aircraft.fuelTankArm),
      seats: flight.aircraft.seats,
    };

    // Build passenger data with legNumber
    const passengerData = flight.passengers.map(p => ({
      id: p.id,
      bookingRef: p.bookingRef,
      name: p.name,
      phone: p.phone,
      weightKg: p.weightKg ? Number(p.weightKg) : null,
      standardWeightUsed: p.standardWeightUsed,
      bagsKg: Number(p.bagsKg),
      destination: p.destination,
      legNumber: (p as any).legNumber || null,
      priority: p.priority as any,
      seatNumber: p.seatNumber,
      flightId: p.flightId,
      notes: p.notes,
    }));

    // Build freight data with legNumber
    const freightData = flight.freight.map(f => ({
      id: f.id,
      waybill: f.waybill,
      description: f.description,
      weightKg: Number(f.weightKg),
      destination: f.destination,
      legNumber: (f as any).legNumber || null,
      volumeM3: f.volumeM3 ? Number(f.volumeM3) : null,
      priority: f.priority as any,
      compartment: f.compartment,
      assignedFlightId: f.assignedFlightId,
      notes: f.notes,
    }));

    // Build mail data with legNumber
    const mailData = flight.mail.map(m => ({
      id: m.id,
      village: m.village,
      legNumber: (m as any).legNumber || null,
      pounds: Number(m.pounds),
      weightKg: Number(m.weightKg),
      priority: m.priority as any,
      assignedFlightId: m.assignedFlightId,
      notes: m.notes,
    }));

    // Calculate full W&B
    const wb = calculateWeightBalance({
      aircraft: aircraftConfig,
      pilotWeightKg: Number(flight.pilotWeightKg) || Number(flight.aircraft.pilotStandardWeightKg),
      fuelWeightKg: Number(flight.fuelWeightKg) || 0,
      passengers: passengerData,
      freight: freightData,
      mail: mailData,
    });

    // Calculate per-leg W&B for multi-leg flights
    const routeLegs = flight.route as RouteLeg[];
    let legWB: LegWBResult[] = [];
    if (routeLegs && routeLegs.length > 1) {
      legWB = calculateMultiLegWB(
        {
          aircraft: aircraftConfig,
          pilotWeightKg: Number(flight.pilotWeightKg) || Number(flight.aircraft.pilotStandardWeightKg),
          fuelWeightKg: Number(flight.fuelWeightKg) || 0,
          passengers: passengerData,
          freight: freightData,
          mail: mailData,
        },
        routeLegs
      );
    }

    res.json({
      success: true,
      data: {
        id: flight.id,
        flightDate: flight.flightDate,
        flightNumber: flight.flightNumber,
        origin: flight.origin,
        departureTime: flight.departureTime,
        route: flight.route,
        status: flight.status,
        pilotName: flight.pilotName,
        pilotWeightKg: flight.pilotWeightKg ? Number(flight.pilotWeightKg) : null,
        fuelWeightKg: flight.fuelWeightKg ? Number(flight.fuelWeightKg) : null,
        notes: flight.notes,
        aircraft: aircraftConfig,
        passengers: flight.passengers.map(p => ({
          ...p,
          weightKg: p.weightKg ? Number(p.weightKg) : null,
          bagsKg: Number(p.bagsKg),
          legNumber: (p as any).legNumber || null,
        })),
        freight: flight.freight.map(f => ({
          ...f,
          weightKg: Number(f.weightKg),
          volumeM3: f.volumeM3 ? Number(f.volumeM3) : null,
          legNumber: (f as any).legNumber || null,
        })),
        mail: flight.mail.map(m => ({
          ...m,
          pounds: Number(m.pounds),
          weightKg: Number(m.weightKg),
          legNumber: (m as any).legNumber || null,
        })),
        weightBalance: wb,
        legWeightBalance: legWB, // Per-leg W&B for multi-leg flights
        latestManifest: flight.manifests[0] || null,
      },
    });
  } catch (error) {
    console.error('Error fetching flight:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flight' });
  }
});

/**
 * POST /api/flights - Create new flight
 */
router.post(
  '/',
  requireRole('ADMIN', 'OPS'),
  [
    body('flightDate').isISO8601(),
    body('origin').isString().notEmpty(),
    body('route').isArray(),
    body('tail').isString().notEmpty(),
    body('operatorId').isInt(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const user = (req as any).user;
      const operatorId = req.body.operatorId;

      // Verify user has access to this operator
      if (user.operatorId && user.operatorId !== operatorId) {
        res.status(403).json({ success: false, error: 'Access denied to this operator' });
        return;
      }

      // Find aircraft by tail number and verify it belongs to the operator
      const aircraft = await prisma.aircraft.findFirst({
        where: { tail: req.body.tail, operatorId },
      });

      if (!aircraft) {
        res.status(404).json({ success: false, error: 'Aircraft not found for this operator' });
        return;
      }

      const flight = await prisma.flight.create({
        data: {
          flightDate: new Date(req.body.flightDate),
          flightNumber: req.body.flightNumber,
          origin: req.body.origin,
          departureTime: req.body.departureTime ? new Date(req.body.departureTime) : null,
          route: req.body.route,
          tailId: aircraft.id,
          pilotName: req.body.pilotName,
          pilotWeightKg: req.body.pilotWeightKg,
          fuelWeightKg: req.body.fuelWeightKg,
          notes: req.body.notes,
          operatorId,
        },
        include: { aircraft: true },
      });

      res.status(201).json({ success: true, data: flight });
    } catch (error) {
      console.error('Error creating flight:', error);
      res.status(500).json({ success: false, error: 'Failed to create flight' });
    }
  }
);

/**
 * PUT /api/flights/:id - Update flight
 */
router.put(
  '/:id',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid flight ID' });
      return;
    }

    try {
      const updateData: any = {};

      if (req.body.flightDate) updateData.flightDate = new Date(req.body.flightDate);
      if (req.body.flightNumber !== undefined) updateData.flightNumber = req.body.flightNumber;
      if (req.body.origin) updateData.origin = req.body.origin;
      if (req.body.departureTime !== undefined) {
        updateData.departureTime = req.body.departureTime ? new Date(req.body.departureTime) : null;
      }
      if (req.body.route) updateData.route = req.body.route;
      if (req.body.pilotName !== undefined) updateData.pilotName = req.body.pilotName;
      if (req.body.pilotWeightKg !== undefined) updateData.pilotWeightKg = req.body.pilotWeightKg;
      if (req.body.fuelWeightKg !== undefined) updateData.fuelWeightKg = req.body.fuelWeightKg;
      if (req.body.status) updateData.status = req.body.status;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      // Handle aircraft change
      if (req.body.tail) {
        const aircraft = await prisma.aircraft.findUnique({
          where: { tail: req.body.tail },
        });
        if (!aircraft) {
          res.status(404).json({ success: false, error: 'Aircraft not found' });
          return;
        }
        updateData.tailId = aircraft.id;
      }

      const flight = await prisma.flight.update({
        where: { id: parseInt(req.params.id) },
        data: updateData,
        include: { aircraft: true },
      });

      res.json({ success: true, data: flight });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Flight not found' });
        return;
      }
      console.error('Error updating flight:', error);
      res.status(500).json({ success: false, error: 'Failed to update flight' });
    }
  }
);

/**
 * DELETE /api/flights/:id - Delete flight (soft delete by cancelling)
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid flight ID' });
      return;
    }

    try {
      await prisma.flight.update({
        where: { id: parseInt(req.params.id) },
        data: { status: 'CANCELLED' },
      });

      res.json({ success: true, message: 'Flight cancelled' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Flight not found' });
        return;
      }
      console.error('Error deleting flight:', error);
      res.status(500).json({ success: false, error: 'Failed to delete flight' });
    }
  }
);

export default router;
