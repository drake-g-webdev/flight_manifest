/**
 * Operators API routes
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Apply auth to all routes
router.use(authenticateToken);

/**
 * GET /api/operators - List all operators
 * Super admin sees all, regular users see only their operator
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // If user has an operatorId, they can only see their own operator
    // Super admin (operatorId = null) can see all
    const whereClause = user.operatorId
      ? { id: user.operatorId, isActive: true }
      : { isActive: true };

    const operators = await prisma.operator.findMany({
      where: whereClause,
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        primaryColor: true,
        logoUrl: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: operators });
  } catch (error) {
    console.error('Error fetching operators:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch operators' });
  }
});

/**
 * GET /api/operators/:id - Get single operator details
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid operator ID' });
    return;
  }

  try {
    const user = (req as any).user;
    const operatorId = parseInt(req.params.id);

    // Check if user has access to this operator
    if (user.operatorId && user.operatorId !== operatorId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
      include: {
        stations: {
          select: { id: true, code: true, name: true, isMainBase: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            aircraft: true,
            users: true,
            flights: true,
          },
        },
      },
    });

    if (!operator) {
      res.status(404).json({ success: false, error: 'Operator not found' });
      return;
    }

    res.json({ success: true, data: operator });
  } catch (error) {
    console.error('Error fetching operator:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch operator' });
  }
});

/**
 * POST /api/operators - Create new operator (super admin only)
 */
router.post(
  '/',
  requireRole('ADMIN'),
  [
    body('code').isString().notEmpty().isLength({ min: 2, max: 5 }),
    body('name').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const user = (req as any).user;

      // Only super admin (operatorId = null) can create operators
      if (user.operatorId !== null) {
        res.status(403).json({ success: false, error: 'Only super admin can create operators' });
        return;
      }

      const operator = await prisma.operator.create({
        data: {
          code: req.body.code.toUpperCase(),
          name: req.body.name,
          shortName: req.body.shortName,
          dotNumber: req.body.dotNumber,
          airCarrier: req.body.airCarrier,
          logoUrl: req.body.logoUrl,
          primaryColor: req.body.primaryColor,
          address: req.body.address,
          phone: req.body.phone,
          email: req.body.email,
          notes: req.body.notes,
        },
      });

      res.status(201).json({ success: true, data: operator });
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ success: false, error: 'Operator code already exists' });
        return;
      }
      console.error('Error creating operator:', error);
      res.status(500).json({ success: false, error: 'Failed to create operator' });
    }
  }
);

/**
 * PUT /api/operators/:id - Update operator
 */
router.put(
  '/:id',
  requireRole('ADMIN'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid operator ID' });
      return;
    }

    try {
      const user = (req as any).user;
      const operatorId = parseInt(req.params.id);

      // Check if user has access to this operator
      if (user.operatorId && user.operatorId !== operatorId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const updateData: any = {};

      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.shortName !== undefined) updateData.shortName = req.body.shortName;
      if (req.body.dotNumber !== undefined) updateData.dotNumber = req.body.dotNumber;
      if (req.body.airCarrier !== undefined) updateData.airCarrier = req.body.airCarrier;
      if (req.body.logoUrl !== undefined) updateData.logoUrl = req.body.logoUrl;
      if (req.body.primaryColor !== undefined) updateData.primaryColor = req.body.primaryColor;
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.phone !== undefined) updateData.phone = req.body.phone;
      if (req.body.email !== undefined) updateData.email = req.body.email;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

      const operator = await prisma.operator.update({
        where: { id: operatorId },
        data: updateData,
      });

      res.json({ success: true, data: operator });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Operator not found' });
        return;
      }
      console.error('Error updating operator:', error);
      res.status(500).json({ success: false, error: 'Failed to update operator' });
    }
  }
);

export default router;
