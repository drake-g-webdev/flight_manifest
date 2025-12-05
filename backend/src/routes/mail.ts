/**
 * Mail Manifest API routes
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
const LBS_TO_KG = 0.453592;

router.use(authenticateToken);

/**
 * GET /api/mail - List mail items
 */
router.get(
  '/',
  query('flightId').optional().isInt(),
  query('unassigned').optional().isBoolean(),
  query('village').optional().isString(),
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

      if (req.query.village) {
        whereClause.village = {
          contains: req.query.village as string,
          mode: 'insensitive',
        };
      }

      const mail = await prisma.mailManifest.findMany({
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
        data: mail.map(m => ({
          ...m,
          pounds: Number(m.pounds),
          weightKg: Number(m.weightKg),
        })),
      });
    } catch (error) {
      console.error('Error fetching mail:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch mail' });
    }
  }
);

/**
 * GET /api/mail/:id - Get single mail item
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid mail ID' });
    return;
  }

  try {
    const mail = await prisma.mailManifest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        assignedFlight: {
          include: { aircraft: true },
        },
      },
    });

    if (!mail) {
      res.status(404).json({ success: false, error: 'Mail item not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...mail,
        pounds: Number(mail.pounds),
        weightKg: Number(mail.weightKg),
      },
    });
  } catch (error) {
    console.error('Error fetching mail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch mail' });
  }
});

/**
 * POST /api/mail - Create new mail item
 */
router.post(
  '/',
  requireRole('ADMIN', 'OPS'),
  [
    body('village').isString().notEmpty(),
    body('pounds').isNumeric(),
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

      // Convert pounds to kg
      const pounds = parseFloat(req.body.pounds);
      const weightKg = pounds * LBS_TO_KG;

      const mail = await prisma.mailManifest.create({
        data: {
          village: req.body.village,
          legNumber: req.body.legNumber !== undefined ? req.body.legNumber : null,
          pounds: pounds,
          weightKg: weightKg,
          priority: req.body.priority || 'BYPASS', // Mail is bypass priority by default
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
            resourceType: 'MAIL',
            resourceId: mail.id,
            createdBy: req.user?.email || 'system',
            reason: 'Initial assignment on creation',
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          ...mail,
          pounds: Number(mail.pounds),
          weightKg: Number(mail.weightKg),
        },
      });
    } catch (error) {
      console.error('Error creating mail:', error);
      res.status(500).json({ success: false, error: 'Failed to create mail item' });
    }
  }
);

/**
 * PUT /api/mail/:id - Update mail item
 */
router.put(
  '/:id',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid mail ID' });
      return;
    }

    try {
      const mailId = parseInt(req.params.id);
      const existingMail = await prisma.mailManifest.findUnique({
        where: { id: mailId },
      });

      if (!existingMail) {
        res.status(404).json({ success: false, error: 'Mail item not found' });
        return;
      }

      const updateData: any = {};

      if (req.body.village) updateData.village = req.body.village;
      if (req.body.legNumber !== undefined) updateData.legNumber = req.body.legNumber;
      if (req.body.pounds !== undefined) {
        const pounds = parseFloat(req.body.pounds);
        updateData.pounds = pounds;
        updateData.weightKg = pounds * LBS_TO_KG;
      }
      if (req.body.priority) updateData.priority = req.body.priority;
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
        if (newFlightId !== existingMail.assignedFlightId && newFlightId !== null) {
          await prisma.assignment.create({
            data: {
              flightId: newFlightId,
              resourceType: 'MAIL',
              resourceId: mailId,
              createdBy: req.user?.email || 'system',
              reason: req.body.assignmentReason || 'Manual reassignment',
            },
          });
        }
      }

      const mail = await prisma.mailManifest.update({
        where: { id: mailId },
        data: updateData,
      });

      res.json({
        success: true,
        data: {
          ...mail,
          pounds: Number(mail.pounds),
          weightKg: Number(mail.weightKg),
        },
      });
    } catch (error) {
      console.error('Error updating mail:', error);
      res.status(500).json({ success: false, error: 'Failed to update mail item' });
    }
  }
);

/**
 * DELETE /api/mail/:id - Delete mail item
 */
router.delete(
  '/:id',
  requireRole('ADMIN', 'OPS'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid mail ID' });
      return;
    }

    try {
      // Delete associated assignments first
      await prisma.assignment.deleteMany({
        where: {
          resourceType: 'MAIL',
          resourceId: parseInt(req.params.id),
        },
      });

      await prisma.mailManifest.delete({
        where: { id: parseInt(req.params.id) },
      });

      res.json({ success: true, message: 'Mail item deleted' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Mail item not found' });
        return;
      }
      console.error('Error deleting mail:', error);
      res.status(500).json({ success: false, error: 'Failed to delete mail item' });
    }
  }
);

export default router;
