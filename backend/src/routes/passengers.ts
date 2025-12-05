/**
 * Passengers API routes
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for weight ticket uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../storage/weight-tickets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `weight-ticket-${req.params.id}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif, webp) and PDFs are allowed'));
    }
  },
});

// Apply auth to all routes
router.use(authenticateToken);

/**
 * GET /api/passengers - List passengers with optional filters
 */
router.get(
  '/',
  query('flightId').optional().isInt(),
  query('unassigned').optional().isBoolean(),
  query('destination').optional().isString(),
  query('operatorId').optional().isInt(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const whereClause: any = {};

      // Filter by operator - passengers are linked via their flights
      let operatorFilter: number | undefined;
      if (req.query.operatorId) {
        const requestedOperatorId = parseInt(req.query.operatorId as string);
        // Check access
        if (user.operatorId && user.operatorId !== requestedOperatorId) {
          res.status(403).json({ success: false, error: 'Access denied to this operator' });
          return;
        }
        operatorFilter = requestedOperatorId;
      } else if (user.operatorId) {
        operatorFilter = user.operatorId;
      }

      if (req.query.flightId) {
        whereClause.flightId = parseInt(req.query.flightId as string);
      }

      if (req.query.unassigned === 'true') {
        whereClause.flightId = null;
        // For unassigned passengers, filter by operatorId directly
        if (operatorFilter) {
          whereClause.operatorId = operatorFilter;
        }
      } else if (operatorFilter) {
        // For assigned passengers, filter via flight.operatorId
        whereClause.flight = { operatorId: operatorFilter };
      }

      if (req.query.destination) {
        whereClause.destination = {
          contains: req.query.destination as string,
          mode: 'insensitive',
        };
      }

      const passengers = await prisma.passenger.findMany({
        where: whereClause,
        include: {
          flight: {
            select: {
              id: true,
              flightNumber: true,
              flightDate: true,
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      });

      res.json({
        success: true,
        data: passengers.map(p => ({
          ...p,
          weightKg: p.weightKg ? Number(p.weightKg) : null,
          bagsKg: Number(p.bagsKg),
        })),
      });
    } catch (error) {
      console.error('Error fetching passengers:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch passengers' });
    }
  }
);

/**
 * GET /api/passengers/:id - Get single passenger
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid passenger ID' });
    return;
  }

  try {
    const passenger = await prisma.passenger.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        flight: {
          include: { aircraft: true },
        },
      },
    });

    if (!passenger) {
      res.status(404).json({ success: false, error: 'Passenger not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...passenger,
        weightKg: passenger.weightKg ? Number(passenger.weightKg) : null,
        bagsKg: Number(passenger.bagsKg),
      },
    });
  } catch (error) {
    console.error('Error fetching passenger:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch passenger' });
  }
});

/**
 * POST /api/passengers - Create new passenger
 */
router.post(
  '/',
  requireRole('ADMIN', 'OPS'),
  [
    body('name').isString().notEmpty().trim(),
    body('destination').isString().notEmpty(),
    body('weightKg').optional().isNumeric(),
    body('bagsKg').optional().isNumeric(),
    body('priority').optional().isIn(['NORMAL', 'MEDICAL', 'EVAC', 'FIRST_CLASS']),
    body('flightId').optional().isInt(),
    body('legNumber').optional({ nullable: true }).isInt(),
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

      // Verify flight exists if provided
      if (req.body.flightId) {
        const flight = await prisma.flight.findUnique({
          where: { id: req.body.flightId },
        });
        if (!flight) {
          res.status(404).json({ success: false, error: 'Flight not found' });
          return;
        }
      }

      const hasActualWeight = req.body.weightKg !== undefined && req.body.weightKg !== null;

      const passenger = await prisma.passenger.create({
        data: {
          bookingRef: req.body.bookingRef,
          name: req.body.name,
          phone: req.body.phone,
          weightKg: req.body.weightKg,
          standardWeightUsed: !hasActualWeight,
          bagsKg: req.body.bagsKg || 0,
          destination: req.body.destination,
          legNumber: req.body.legNumber !== undefined ? req.body.legNumber : null,
          priority: req.body.priority || 'NORMAL',
          seatNumber: req.body.seatNumber,
          flightId: req.body.flightId,
          notes: req.body.notes,
          operatorId,
        },
      });

      // Create assignment record if assigned to flight
      if (req.body.flightId) {
        await prisma.assignment.create({
          data: {
            flightId: req.body.flightId,
            resourceType: 'PASSENGER',
            resourceId: passenger.id,
            createdBy: req.user?.email || 'system',
            reason: 'Initial assignment on creation',
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          ...passenger,
          weightKg: passenger.weightKg ? Number(passenger.weightKg) : null,
          bagsKg: Number(passenger.bagsKg),
        },
      });
    } catch (error) {
      console.error('Error creating passenger:', error);
      res.status(500).json({ success: false, error: 'Failed to create passenger' });
    }
  }
);

/**
 * PUT /api/passengers/:id - Update passenger
 */
router.put(
  '/:id',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid passenger ID' });
      return;
    }

    try {
      const passengerId = parseInt(req.params.id);
      const existingPassenger = await prisma.passenger.findUnique({
        where: { id: passengerId },
      });

      if (!existingPassenger) {
        res.status(404).json({ success: false, error: 'Passenger not found' });
        return;
      }

      const updateData: any = {};

      if (req.body.bookingRef !== undefined) updateData.bookingRef = req.body.bookingRef;
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.phone !== undefined) updateData.phone = req.body.phone;
      if (req.body.weightKg !== undefined) {
        updateData.weightKg = req.body.weightKg;
        updateData.standardWeightUsed = req.body.weightKg === null;
      }
      if (req.body.bagsKg !== undefined) updateData.bagsKg = req.body.bagsKg;
      if (req.body.destination) updateData.destination = req.body.destination;
      if (req.body.legNumber !== undefined) updateData.legNumber = req.body.legNumber;
      if (req.body.priority) updateData.priority = req.body.priority;
      if (req.body.seatNumber !== undefined) updateData.seatNumber = req.body.seatNumber;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      // Handle flight assignment change
      if (req.body.flightId !== undefined) {
        const newFlightId = req.body.flightId;

        if (newFlightId !== null) {
          const flight = await prisma.flight.findUnique({
            where: { id: newFlightId },
          });
          if (!flight) {
            res.status(404).json({ success: false, error: 'Flight not found' });
            return;
          }
        }

        updateData.flightId = newFlightId;

        // Create assignment record if flight changed
        if (newFlightId !== existingPassenger.flightId && newFlightId !== null) {
          await prisma.assignment.create({
            data: {
              flightId: newFlightId,
              resourceType: 'PASSENGER',
              resourceId: passengerId,
              createdBy: req.user?.email || 'system',
              reason: req.body.assignmentReason || 'Manual reassignment',
            },
          });
        }
      }

      const passenger = await prisma.passenger.update({
        where: { id: passengerId },
        data: updateData,
      });

      res.json({
        success: true,
        data: {
          ...passenger,
          weightKg: passenger.weightKg ? Number(passenger.weightKg) : null,
          bagsKg: Number(passenger.bagsKg),
        },
      });
    } catch (error) {
      console.error('Error updating passenger:', error);
      res.status(500).json({ success: false, error: 'Failed to update passenger' });
    }
  }
);

/**
 * DELETE /api/passengers/:id - Delete passenger
 */
router.delete(
  '/:id',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid passenger ID' });
      return;
    }

    try {
      // Delete associated assignments first
      await prisma.assignment.deleteMany({
        where: {
          resourceType: 'PASSENGER',
          resourceId: parseInt(req.params.id),
        },
      });

      await prisma.passenger.delete({
        where: { id: parseInt(req.params.id) },
      });

      res.json({ success: true, message: 'Passenger deleted' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Passenger not found' });
        return;
      }
      console.error('Error deleting passenger:', error);
      res.status(500).json({ success: false, error: 'Failed to delete passenger' });
    }
  }
);

/**
 * POST /api/passengers/:id/assign - Assign passenger to flight
 */
router.post(
  '/:id/assign',
  requireRole('ADMIN', 'OPS'),
  [param('id').isInt(), body('flightId').isInt()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed' });
      return;
    }

    try {
      const passengerId = parseInt(req.params.id);
      const flightId = req.body.flightId;

      // Verify both exist
      const [passenger, flight] = await Promise.all([
        prisma.passenger.findUnique({ where: { id: passengerId } }),
        prisma.flight.findUnique({ where: { id: flightId }, include: { aircraft: true } }),
      ]);

      if (!passenger) {
        res.status(404).json({ success: false, error: 'Passenger not found' });
        return;
      }

      if (!flight) {
        res.status(404).json({ success: false, error: 'Flight not found' });
        return;
      }

      // Check seat capacity
      const currentPassengerCount = await prisma.passenger.count({
        where: { flightId },
      });

      if (currentPassengerCount >= flight.aircraft.seats) {
        res.status(400).json({ success: false, error: 'Flight is at seat capacity' });
        return;
      }

      // Update passenger and create assignment
      const [updated] = await prisma.$transaction([
        prisma.passenger.update({
          where: { id: passengerId },
          data: { flightId },
        }),
        prisma.assignment.create({
          data: {
            flightId,
            resourceType: 'PASSENGER',
            resourceId: passengerId,
            createdBy: req.user?.email || 'system',
            reason: req.body.reason || 'Manual assignment',
          },
        }),
      ]);

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error assigning passenger:', error);
      res.status(500).json({ success: false, error: 'Failed to assign passenger' });
    }
  }
);

/**
 * POST /api/passengers/:id/check-in - Check in passenger with weight
 */
router.post(
  '/:id/check-in',
  requireRole('ADMIN', 'OPS', 'PILOT'),
  param('id').isInt(),
  [
    body('weightKg').isNumeric(),
    body('bagsKg').optional().isNumeric(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const passengerId = parseInt(req.params.id);
      const passenger = await prisma.passenger.findUnique({
        where: { id: passengerId },
      });

      if (!passenger) {
        res.status(404).json({ success: false, error: 'Passenger not found' });
        return;
      }

      const updated = await prisma.passenger.update({
        where: { id: passengerId },
        data: {
          weightKg: req.body.weightKg,
          bagsKg: req.body.bagsKg !== undefined ? req.body.bagsKg : passenger.bagsKg,
          standardWeightUsed: false,
          checkedInAt: new Date(),
          checkedInBy: req.user?.email || 'system',
          weightTicketDate: new Date(),
        },
      });

      res.json({
        success: true,
        data: {
          ...updated,
          weightKg: updated.weightKg ? Number(updated.weightKg) : null,
          bagsKg: Number(updated.bagsKg),
        },
      });
    } catch (error) {
      console.error('Error checking in passenger:', error);
      res.status(500).json({ success: false, error: 'Failed to check in passenger' });
    }
  }
);

/**
 * POST /api/passengers/:id/weight-ticket - Upload weight ticket image
 */
router.post(
  '/:id/weight-ticket',
  requireRole('ADMIN', 'OPS', 'PILOT'),
  param('id').isInt(),
  upload.single('weightTicket'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid passenger ID' });
      return;
    }

    try {
      const passengerId = parseInt(req.params.id);
      const passenger = await prisma.passenger.findUnique({
        where: { id: passengerId },
      });

      if (!passenger) {
        // Clean up uploaded file if passenger not found
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(404).json({ success: false, error: 'Passenger not found' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      // Delete old weight ticket if exists
      if (passenger.weightTicketPath) {
        const oldPath = path.join(__dirname, '../../storage', passenger.weightTicketPath);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const relativePath = `weight-tickets/${req.file.filename}`;

      const updateData: any = {
        weightTicketPath: relativePath,
        weightTicketDate: new Date(),
      };

      // If weight is provided in body, update that too
      if (req.body.weightKg) {
        updateData.weightKg = parseFloat(req.body.weightKg);
        updateData.standardWeightUsed = false;
        updateData.checkedInAt = new Date();
        updateData.checkedInBy = req.user?.email || 'system';
      }

      if (req.body.bagsKg) {
        updateData.bagsKg = parseFloat(req.body.bagsKg);
      }

      const updated = await prisma.passenger.update({
        where: { id: passengerId },
        data: updateData,
      });

      res.json({
        success: true,
        data: {
          ...updated,
          weightKg: updated.weightKg ? Number(updated.weightKg) : null,
          bagsKg: Number(updated.bagsKg),
          weightTicketUrl: `/storage/${relativePath}`,
        },
      });
    } catch (error) {
      console.error('Error uploading weight ticket:', error);
      res.status(500).json({ success: false, error: 'Failed to upload weight ticket' });
    }
  }
);

/**
 * GET /api/passengers/:id/weight-ticket - Get weight ticket image
 */
router.get(
  '/:id/weight-ticket',
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid passenger ID' });
      return;
    }

    try {
      const passenger = await prisma.passenger.findUnique({
        where: { id: parseInt(req.params.id) },
        select: { weightTicketPath: true },
      });

      if (!passenger) {
        res.status(404).json({ success: false, error: 'Passenger not found' });
        return;
      }

      if (!passenger.weightTicketPath) {
        res.status(404).json({ success: false, error: 'No weight ticket on file' });
        return;
      }

      const filePath = path.join(__dirname, '../../storage', passenger.weightTicketPath);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: 'Weight ticket file not found' });
        return;
      }

      res.sendFile(filePath);
    } catch (error) {
      console.error('Error fetching weight ticket:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch weight ticket' });
    }
  }
);

/**
 * DELETE /api/passengers/:id/weight-ticket - Remove weight ticket
 */
router.delete(
  '/:id/weight-ticket',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid passenger ID' });
      return;
    }

    try {
      const passenger = await prisma.passenger.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!passenger) {
        res.status(404).json({ success: false, error: 'Passenger not found' });
        return;
      }

      if (passenger.weightTicketPath) {
        const filePath = path.join(__dirname, '../../storage', passenger.weightTicketPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await prisma.passenger.update({
        where: { id: parseInt(req.params.id) },
        data: {
          weightTicketPath: null,
          weightTicketDate: null,
        },
      });

      res.json({ success: true, message: 'Weight ticket removed' });
    } catch (error) {
      console.error('Error deleting weight ticket:', error);
      res.status(500).json({ success: false, error: 'Failed to delete weight ticket' });
    }
  }
);

export default router;
