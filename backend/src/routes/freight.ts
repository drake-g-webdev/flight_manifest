/**
 * Freight API routes
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/freight - List freight items
 */
router.get(
  '/',
  query('flightId').optional().isInt(),
  query('unassigned').optional().isBoolean(),
  query('destination').optional().isString(),
  query('priority').optional().isIn(['BYPASS', 'PRIORITY', 'STANDARD']),
  query('operatorId').optional().isInt(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const whereClause: any = {};

      // Filter by operator
      let operatorFilter: number | undefined;
      if (req.query.operatorId) {
        const requestedOperatorId = parseInt(req.query.operatorId as string);
        if (user.operatorId && user.operatorId !== requestedOperatorId) {
          res.status(403).json({ success: false, error: 'Access denied to this operator' });
          return;
        }
        operatorFilter = requestedOperatorId;
      } else if (user.operatorId) {
        operatorFilter = user.operatorId;
      }

      if (operatorFilter) {
        whereClause.operatorId = operatorFilter;
      }

      if (req.query.flightId) {
        whereClause.assignedFlightId = parseInt(req.query.flightId as string);
      }

      if (req.query.unassigned === 'true') {
        whereClause.assignedFlightId = null;
      }

      if (req.query.destination) {
        whereClause.destination = {
          contains: req.query.destination as string,
          mode: 'insensitive',
        };
      }

      if (req.query.priority) {
        whereClause.priority = req.query.priority;
      }

      const freight = await prisma.freight.findMany({
        where: whereClause,
        include: {
          assignedFlight: {
            select: {
              id: true,
              flightNumber: true,
              flightDate: true,
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });

      res.json({
        success: true,
        data: freight.map(f => ({
          ...f,
          weightKg: Number(f.weightKg),
          volumeM3: f.volumeM3 ? Number(f.volumeM3) : null,
        })),
      });
    } catch (error) {
      console.error('Error fetching freight:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch freight' });
    }
  }
);

/**
 * GET /api/freight/:id - Get single freight item
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid freight ID' });
    return;
  }

  try {
    const freight = await prisma.freight.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        assignedFlight: {
          include: { aircraft: true },
        },
      },
    });

    if (!freight) {
      res.status(404).json({ success: false, error: 'Freight not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...freight,
        weightKg: Number(freight.weightKg),
        volumeM3: freight.volumeM3 ? Number(freight.volumeM3) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching freight:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch freight' });
  }
});

/**
 * POST /api/freight - Create new freight item
 */
router.post(
  '/',
  requireRole('ADMIN', 'OPS'),
  [
    body('weightKg').isNumeric(),
    body('destination').isString().notEmpty(),
    body('priority').optional().isIn(['BYPASS', 'PRIORITY', 'STANDARD']),
    body('assignedFlightId').optional().isInt(),
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
      if (req.body.assignedFlightId) {
        const flight = await prisma.flight.findUnique({
          where: { id: req.body.assignedFlightId },
        });
        if (!flight) {
          res.status(404).json({ success: false, error: 'Flight not found' });
          return;
        }
      }

      const freight = await prisma.freight.create({
        data: {
          waybill: req.body.waybill,
          description: req.body.description,
          weightKg: req.body.weightKg,
          destination: req.body.destination,
          legNumber: req.body.legNumber !== undefined ? req.body.legNumber : null,
          volumeM3: req.body.volumeM3,
          priority: req.body.priority || 'STANDARD',
          compartment: req.body.compartment,
          assignedFlightId: req.body.assignedFlightId,
          notes: req.body.notes,
          operatorId,
        },
      });

      // Create assignment record if assigned
      if (req.body.assignedFlightId) {
        await prisma.assignment.create({
          data: {
            flightId: req.body.assignedFlightId,
            resourceType: 'FREIGHT',
            resourceId: freight.id,
            createdBy: req.user?.email || 'system',
            reason: 'Initial assignment on creation',
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          ...freight,
          weightKg: Number(freight.weightKg),
          volumeM3: freight.volumeM3 ? Number(freight.volumeM3) : null,
        },
      });
    } catch (error) {
      console.error('Error creating freight:', error);
      res.status(500).json({ success: false, error: 'Failed to create freight' });
    }
  }
);

/**
 * PUT /api/freight/:id - Update freight item
 */
router.put(
  '/:id',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid freight ID' });
      return;
    }

    try {
      const freightId = parseInt(req.params.id);
      const existingFreight = await prisma.freight.findUnique({
        where: { id: freightId },
      });

      if (!existingFreight) {
        res.status(404).json({ success: false, error: 'Freight not found' });
        return;
      }

      const updateData: any = {};

      if (req.body.waybill !== undefined) updateData.waybill = req.body.waybill;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.weightKg !== undefined) updateData.weightKg = req.body.weightKg;
      if (req.body.destination) updateData.destination = req.body.destination;
      if (req.body.legNumber !== undefined) updateData.legNumber = req.body.legNumber;
      if (req.body.volumeM3 !== undefined) updateData.volumeM3 = req.body.volumeM3;
      if (req.body.priority) updateData.priority = req.body.priority;
      if (req.body.compartment !== undefined) updateData.compartment = req.body.compartment;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      // Handle flight assignment change
      if (req.body.assignedFlightId !== undefined) {
        const newFlightId = req.body.assignedFlightId;

        if (newFlightId !== null) {
          const flight = await prisma.flight.findUnique({
            where: { id: newFlightId },
          });
          if (!flight) {
            res.status(404).json({ success: false, error: 'Flight not found' });
            return;
          }
        }

        updateData.assignedFlightId = newFlightId;

        // Create assignment record if flight changed
        if (newFlightId !== existingFreight.assignedFlightId && newFlightId !== null) {
          await prisma.assignment.create({
            data: {
              flightId: newFlightId,
              resourceType: 'FREIGHT',
              resourceId: freightId,
              createdBy: req.user?.email || 'system',
              reason: req.body.assignmentReason || 'Manual reassignment',
            },
          });
        }
      }

      const freight = await prisma.freight.update({
        where: { id: freightId },
        data: updateData,
      });

      res.json({
        success: true,
        data: {
          ...freight,
          weightKg: Number(freight.weightKg),
          volumeM3: freight.volumeM3 ? Number(freight.volumeM3) : null,
        },
      });
    } catch (error) {
      console.error('Error updating freight:', error);
      res.status(500).json({ success: false, error: 'Failed to update freight' });
    }
  }
);

/**
 * DELETE /api/freight/:id - Delete freight item
 */
router.delete(
  '/:id',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid freight ID' });
      return;
    }

    try {
      // Delete associated assignments first
      await prisma.assignment.deleteMany({
        where: {
          resourceType: 'FREIGHT',
          resourceId: parseInt(req.params.id),
        },
      });

      await prisma.freight.delete({
        where: { id: parseInt(req.params.id) },
      });

      res.json({ success: true, message: 'Freight deleted' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Freight not found' });
        return;
      }
      console.error('Error deleting freight:', error);
      res.status(500).json({ success: false, error: 'Failed to delete freight' });
    }
  }
);

export default router;
