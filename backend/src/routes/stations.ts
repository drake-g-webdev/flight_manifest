/**
 * Stations API routes
 *
 * Manages base station/location data
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Apply auth to all routes
router.use(authenticateToken);

/**
 * GET /api/stations - List all stations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const whereClause: any = {};
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const stations = await prisma.station.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            aircraft: true,
            users: true,
            flightsFrom: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: stations.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        icao: s.icao,
        timezone: s.timezone,
        isActive: s.isActive,
        isMainBase: s.isMainBase,
        address: s.address,
        phone: s.phone,
        notes: s.notes,
        aircraftCount: s._count.aircraft,
        userCount: s._count.users,
        flightCount: s._count.flightsFrom,
      })),
    });
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stations' });
  }
});

/**
 * GET /api/stations/:id - Get station details
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid station ID' });
    return;
  }

  try {
    const station = await prisma.station.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        aircraft: {
          where: { isActive: true },
          select: {
            id: true,
            tail: true,
            type: true,
            maintenanceStatus: true,
          },
        },
        users: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!station) {
      res.status(404).json({ success: false, error: 'Station not found' });
      return;
    }

    res.json({ success: true, data: station });
  } catch (error) {
    console.error('Error fetching station:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch station' });
  }
});

/**
 * POST /api/stations - Create a new station
 */
router.post(
  '/',
  requireRole('ADMIN'),
  [
    body('code').isString().isLength({ min: 2, max: 10 }).trim(),
    body('name').isString().notEmpty().trim(),
    body('icao').optional().isString().trim(),
    body('timezone').optional().isString(),
    body('isMainBase').optional().isBoolean(),
    body('address').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('notes').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const station = await prisma.station.create({
        data: {
          code: req.body.code.toUpperCase(),
          name: req.body.name,
          icao: req.body.icao?.toUpperCase(),
          timezone: req.body.timezone || 'America/Anchorage',
          isMainBase: req.body.isMainBase || false,
          address: req.body.address,
          phone: req.body.phone,
          notes: req.body.notes,
        },
      });

      res.status(201).json({ success: true, data: station });
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(409).json({ success: false, error: 'Station code already exists' });
        return;
      }
      console.error('Error creating station:', error);
      res.status(500).json({ success: false, error: 'Failed to create station' });
    }
  }
);

/**
 * PUT /api/stations/:id - Update a station
 */
router.put(
  '/:id',
  requireRole('ADMIN'),
  param('id').isInt(),
  [
    body('code').optional().isString().isLength({ min: 2, max: 10 }).trim(),
    body('name').optional().isString().notEmpty().trim(),
    body('icao').optional().isString().trim(),
    body('timezone').optional().isString(),
    body('isMainBase').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
    body('address').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('notes').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const updateData: any = {};
      if (req.body.code !== undefined) updateData.code = req.body.code.toUpperCase();
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.icao !== undefined) updateData.icao = req.body.icao?.toUpperCase();
      if (req.body.timezone !== undefined) updateData.timezone = req.body.timezone;
      if (req.body.isMainBase !== undefined) updateData.isMainBase = req.body.isMainBase;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.phone !== undefined) updateData.phone = req.body.phone;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      const station = await prisma.station.update({
        where: { id: parseInt(req.params.id) },
        data: updateData,
      });

      res.json({ success: true, data: station });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Station not found' });
        return;
      }
      if (error.code === 'P2002') {
        res.status(409).json({ success: false, error: 'Station code already exists' });
        return;
      }
      console.error('Error updating station:', error);
      res.status(500).json({ success: false, error: 'Failed to update station' });
    }
  }
);

/**
 * DELETE /api/stations/:id - Deactivate a station
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid station ID' });
      return;
    }

    try {
      // Check if any aircraft are at this station
      const aircraftCount = await prisma.aircraft.count({
        where: { currentStationId: parseInt(req.params.id), isActive: true },
      });

      if (aircraftCount > 0) {
        res.status(400).json({
          success: false,
          error: `Cannot deactivate station with ${aircraftCount} active aircraft. Move aircraft first.`,
        });
        return;
      }

      await prisma.station.update({
        where: { id: parseInt(req.params.id) },
        data: { isActive: false },
      });

      res.json({ success: true, message: 'Station deactivated' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Station not found' });
        return;
      }
      console.error('Error deactivating station:', error);
      res.status(500).json({ success: false, error: 'Failed to deactivate station' });
    }
  }
);

/**
 * GET /api/stations/:id/aircraft - Get aircraft at a station
 */
router.get('/:id/aircraft', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid station ID' });
    return;
  }

  try {
    const aircraft = await prisma.aircraft.findMany({
      where: {
        currentStationId: parseInt(req.params.id),
        isActive: true,
      },
      orderBy: { tail: 'asc' },
    });

    res.json({
      success: true,
      data: aircraft.map(a => ({
        id: a.id,
        tail: a.tail,
        type: a.type,
        seats: a.seats,
        maxTakeoffKg: Number(a.maxTakeoffKg),
        maintenanceStatus: a.maintenanceStatus,
        totalFlightHours: Number(a.totalFlightHours),
        nextInspectionDue: a.nextInspectionDue,
      })),
    });
  } catch (error) {
    console.error('Error fetching station aircraft:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch aircraft' });
  }
});

/**
 * POST /api/stations/:id/transfer-aircraft - Transfer an aircraft to this station
 */
router.post(
  '/:id/transfer-aircraft',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  body('aircraftId').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const stationId = parseInt(req.params.id);
      const aircraftId = req.body.aircraftId;

      // Verify station exists
      const station = await prisma.station.findUnique({ where: { id: stationId } });
      if (!station) {
        res.status(404).json({ success: false, error: 'Station not found' });
        return;
      }

      // Update aircraft location
      const aircraft = await prisma.aircraft.update({
        where: { id: aircraftId },
        data: { currentStationId: stationId },
      });

      res.json({
        success: true,
        message: `Aircraft ${aircraft.tail} transferred to ${station.name}`,
        data: aircraft,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Aircraft not found' });
        return;
      }
      console.error('Error transferring aircraft:', error);
      res.status(500).json({ success: false, error: 'Failed to transfer aircraft' });
    }
  }
);

export default router;
