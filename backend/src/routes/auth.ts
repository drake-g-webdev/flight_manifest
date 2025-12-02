/**
 * Authentication API routes
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login - User login
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid email or password format' });
      return;
    }

    try {
      const { email, password } = req.body;

      // Find user with operator info
      const user = await prisma.user.findUnique({
        where: { email },
        include: { operator: true },
      });

      if (!user || !user.isActive) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      // Generate token with operatorId for authorization checks
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        operatorId: user.operatorId,
      });

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            operatorId: user.operatorId,
            operator: user.operator ? {
              id: user.operator.id,
              code: user.operator.code,
              name: user.operator.name,
              shortName: user.operator.shortName,
              primaryColor: user.operator.primaryColor,
            } : null,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  }
);

/**
 * POST /api/auth/register - Create new user (Admin only in production)
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }),
    body('name').isString().notEmpty().trim(),
    body('role').optional().isIn(['ADMIN', 'OPS', 'PILOT']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const { email, password, name, role } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(409).json({ success: false, error: 'Email already registered' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: role || 'OPS',
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ success: false, error: 'Registration failed' });
    }
  }
);

/**
 * GET /api/auth/me - Get current user
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { operator: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        operatorId: user.operatorId,
        operator: user.operator ? {
          id: user.operator.id,
          code: user.operator.code,
          name: user.operator.name,
          shortName: user.operator.shortName,
          primaryColor: user.operator.primaryColor,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

/**
 * PUT /api/auth/password - Change password
 */
router.put(
  '/password',
  authenticateToken,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 8 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed' });
      return;
    }

    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({ success: false, error: 'Current password is incorrect' });
        return;
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(req.body.newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ success: false, error: 'Failed to change password' });
    }
  }
);

export default router;
