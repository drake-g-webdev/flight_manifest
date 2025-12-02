/**
 * Aircraft API routes
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Apply auth to all routes
router.use(authenticateToken);

/**
 * GET /api/aircraft - List all aircraft
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const stationId = req.query.stationId ? parseInt(req.query.stationId as string) : undefined;

    const whereClause: any = {};
    if (!includeInactive) {
      whereClause.isActive = true;
    }
    if (stationId) {
      whereClause.currentStationId = stationId;
    }

    const aircraft = await prisma.aircraft.findMany({
      where: whereClause,
      orderBy: { tail: 'asc' },
      include: {
        currentStation: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: aircraft.map(a => ({
        id: a.id,
        tail: a.tail,
        type: a.type,
        maxTakeoffKg: Number(a.maxTakeoffKg),
        emptyWeightKg: Number(a.emptyWeightKg),
        emptyWeightArm: Number(a.emptyWeightArm),
        pilotStandardWeightKg: Number(a.pilotStandardWeightKg),
        pilotArm: Number(a.pilotArm),
        cgLimits: a.cgLimits,
        seatConfiguration: a.seatConfiguration,
        baggageCompartments: a.baggageCompartments,
        fuelTankArm: Number(a.fuelTankArm),
        seats: a.seats,
        isActive: a.isActive,
        notes: a.notes,
        maintenanceStatus: a.maintenanceStatus || 'OPERATIONAL',
        lastInspectionDate: a.lastInspectionDate,
        nextInspectionDue: a.nextInspectionDue,
        totalFlightHours: Number(a.totalFlightHours || 0),
        hoursToNextService: a.hoursToNextService ? Number(a.hoursToNextService) : null,
        maintenanceNotes: a.maintenanceNotes,
        currentStationId: a.currentStationId,
        homeStationId: a.homeStationId,
        currentStation: a.currentStation,
      })),
    });
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch aircraft' });
  }
});

/**
 * GET /api/aircraft/:id - Get single aircraft
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid aircraft ID' });
    return;
  }

  try {
    const aircraft = await prisma.aircraft.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!aircraft) {
      res.status(404).json({ success: false, error: 'Aircraft not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: aircraft.id,
        tail: aircraft.tail,
        type: aircraft.type,
        maxTakeoffKg: Number(aircraft.maxTakeoffKg),
        emptyWeightKg: Number(aircraft.emptyWeightKg),
        emptyWeightArm: Number(aircraft.emptyWeightArm),
        pilotStandardWeightKg: Number(aircraft.pilotStandardWeightKg),
        pilotArm: Number(aircraft.pilotArm),
        cgLimits: aircraft.cgLimits,
        seatConfiguration: aircraft.seatConfiguration,
        baggageCompartments: aircraft.baggageCompartments,
        fuelTankArm: Number(aircraft.fuelTankArm),
        seats: aircraft.seats,
        notes: aircraft.notes,
      },
    });
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch aircraft' });
  }
});

/**
 * POST /api/aircraft - Create new aircraft (Admin only)
 */
router.post(
  '/',
  requireRole('ADMIN'),
  [
    body('tail').isString().notEmpty(),
    body('type').isString().notEmpty(),
    body('maxTakeoffKg').isNumeric(),
    body('emptyWeightKg').isNumeric(),
    body('emptyWeightArm').isNumeric(),
    body('pilotArm').isNumeric(),
    body('cgLimits').isObject(),
    body('seatConfiguration').isArray(),
    body('baggageCompartments').isArray(),
    body('seats').isInt({ min: 1 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const aircraft = await prisma.aircraft.create({
        data: {
          tail: req.body.tail,
          type: req.body.type,
          maxTakeoffKg: req.body.maxTakeoffKg,
          emptyWeightKg: req.body.emptyWeightKg,
          emptyWeightArm: req.body.emptyWeightArm,
          pilotStandardWeightKg: req.body.pilotStandardWeightKg || 90,
          pilotArm: req.body.pilotArm,
          cgLimits: req.body.cgLimits,
          seatConfiguration: req.body.seatConfiguration,
          baggageCompartments: req.body.baggageCompartments,
          fuelTankArm: req.body.fuelTankArm || 1.8,
          seats: req.body.seats,
          notes: req.body.notes,
        },
      });

      res.status(201).json({ success: true, data: aircraft });
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(409).json({ success: false, error: 'Aircraft with this tail number already exists' });
        return;
      }
      console.error('Error creating aircraft:', error);
      res.status(500).json({ success: false, error: 'Failed to create aircraft' });
    }
  }
);

/**
 * PUT /api/aircraft/:id - Update aircraft (Admin only)
 */
router.put(
  '/:id',
  requireRole('ADMIN'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid aircraft ID' });
      return;
    }

    try {
      const aircraft = await prisma.aircraft.update({
        where: { id: parseInt(req.params.id) },
        data: {
          ...(req.body.tail && { tail: req.body.tail }),
          ...(req.body.type && { type: req.body.type }),
          ...(req.body.maxTakeoffKg && { maxTakeoffKg: req.body.maxTakeoffKg }),
          ...(req.body.emptyWeightKg && { emptyWeightKg: req.body.emptyWeightKg }),
          ...(req.body.emptyWeightArm && { emptyWeightArm: req.body.emptyWeightArm }),
          ...(req.body.pilotStandardWeightKg && { pilotStandardWeightKg: req.body.pilotStandardWeightKg }),
          ...(req.body.pilotArm && { pilotArm: req.body.pilotArm }),
          ...(req.body.cgLimits && { cgLimits: req.body.cgLimits }),
          ...(req.body.seatConfiguration && { seatConfiguration: req.body.seatConfiguration }),
          ...(req.body.baggageCompartments && { baggageCompartments: req.body.baggageCompartments }),
          ...(req.body.fuelTankArm && { fuelTankArm: req.body.fuelTankArm }),
          ...(req.body.seats && { seats: req.body.seats }),
          ...(req.body.notes !== undefined && { notes: req.body.notes }),
          ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
        },
      });

      res.json({ success: true, data: aircraft });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Aircraft not found' });
        return;
      }
      console.error('Error updating aircraft:', error);
      res.status(500).json({ success: false, error: 'Failed to update aircraft' });
    }
  }
);

/**
 * PUT /api/aircraft/:id/maintenance-status - Update maintenance status
 */
router.put(
  '/:id/maintenance-status',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  body('maintenanceStatus').isString(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const updateData: any = {
        maintenanceStatus: req.body.maintenanceStatus,
      };

      if (req.body.maintenanceNotes !== undefined) {
        updateData.maintenanceNotes = req.body.maintenanceNotes;
      }
      if (req.body.nextInspectionDue) {
        updateData.nextInspectionDue = new Date(req.body.nextInspectionDue);
      }
      if (req.body.hoursToNextService !== undefined) {
        updateData.hoursToNextService = req.body.hoursToNextService;
      }

      const aircraft = await prisma.aircraft.update({
        where: { id: parseInt(req.params.id) },
        data: updateData,
      });

      res.json({ success: true, data: aircraft });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Aircraft not found' });
        return;
      }
      console.error('Error updating maintenance status:', error);
      res.status(500).json({ success: false, error: 'Failed to update maintenance status' });
    }
  }
);

/**
 * POST /api/aircraft/:id/maintenance - Add maintenance log entry
 */
router.post(
  '/:id/maintenance',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  [
    body('type').isString().notEmpty(),
    body('description').isString().notEmpty(),
    body('performedAt').isISO8601(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const aircraftId = parseInt(req.params.id);

      // Create maintenance log
      const maintenanceLog = await (prisma as any).maintenanceLog.create({
        data: {
          aircraftId,
          type: req.body.type,
          description: req.body.description,
          performedBy: req.body.performedBy || req.user?.email,
          performedAt: new Date(req.body.performedAt),
          hoursAtService: req.body.hoursAtService,
          cost: req.body.cost,
          nextDueHours: req.body.nextDueHours,
          nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate) : null,
          workOrderNumber: req.body.workOrderNumber,
          notes: req.body.notes,
        },
      });

      // Update aircraft maintenance info if provided
      const updateData: any = {};
      if (req.body.hoursAtService) {
        updateData.totalFlightHours = req.body.hoursAtService;
      }
      if (req.body.nextDueHours && req.body.hoursAtService) {
        updateData.hoursToNextService = req.body.nextDueHours - req.body.hoursAtService;
      }
      if (req.body.nextDueDate) {
        updateData.nextInspectionDue = new Date(req.body.nextDueDate);
      }
      if (req.body.type === 'ANNUAL_INSPECTION' || req.body.type === 'HUNDRED_HOUR') {
        updateData.lastInspectionDate = new Date(req.body.performedAt);
      }
      if (req.body.newStatus) {
        updateData.maintenanceStatus = req.body.newStatus;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.aircraft.update({
          where: { id: aircraftId },
          data: updateData,
        });
      }

      res.status(201).json({ success: true, data: maintenanceLog });
    } catch (error) {
      console.error('Error adding maintenance log:', error);
      res.status(500).json({ success: false, error: 'Failed to add maintenance log' });
    }
  }
);

/**
 * GET /api/aircraft/:id/maintenance - Get maintenance history
 */
router.get(
  '/:id/maintenance',
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid aircraft ID' });
      return;
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const logs = await (prisma as any).maintenanceLog.findMany({
        where: { aircraftId: parseInt(req.params.id) },
        orderBy: { performedAt: 'desc' },
        take: limit,
      });

      res.json({ success: true, data: logs });
    } catch (error) {
      console.error('Error fetching maintenance logs:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch maintenance logs' });
    }
  }
);

/**
 * DELETE /api/aircraft/:id - Deactivate aircraft (soft delete)
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid aircraft ID' });
      return;
    }

    try {
      await prisma.aircraft.update({
        where: { id: parseInt(req.params.id) },
        data: { isActive: false },
      });

      res.json({ success: true, message: 'Aircraft deactivated' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Aircraft not found' });
        return;
      }
      console.error('Error deactivating aircraft:', error);
      res.status(500).json({ success: false, error: 'Failed to deactivate aircraft' });
    }
  }
);

export default router;
