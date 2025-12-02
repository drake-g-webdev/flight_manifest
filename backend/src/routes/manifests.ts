/**
 * Manifest generation and retrieval API routes
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { calculateWeightBalance } from '../services/weightBalance.js';
import { generateManifestPDF } from '../services/pdfGenerator.js';
import type { AircraftConfig, ManifestJSON, RouteLeg } from '../types/index.js';

const router = Router();

// PDF endpoint is public (handled separately below), all other routes require auth

/**
 * GET /api/manifests/:id/pdf - Get manifest PDF (PUBLIC - no auth required for direct browser access)
 */
router.get('/:id/pdf', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid manifest ID' });
    return;
  }

  try {
    const manifest = await prisma.manifest.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!manifest) {
      res.status(404).json({ success: false, error: 'Manifest not found' });
      return;
    }

    if (!manifest.pdfPath) {
      // Generate PDF on demand if not exists
      const pdfPath = await generateManifestPDF(manifest.manifestJson as unknown as ManifestJSON, manifest.id);
      res.redirect(`/storage/manifests/${pdfPath}`);
      return;
    }

    res.redirect(manifest.pdfPath);
  } catch (error) {
    console.error('Error fetching manifest PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch manifest PDF' });
  }
});

// All routes below require authentication
router.use(authenticateToken);

/**
 * GET /api/manifests - List manifests
 */
router.get(
  '/',
  query('flightId').optional().isInt(),
  query('date').optional().isISO8601(),
  async (req: Request, res: Response) => {
    try {
      const whereClause: any = {};

      if (req.query.flightId) {
        whereClause.flightId = parseInt(req.query.flightId as string);
      }

      if (req.query.date) {
        const date = new Date(req.query.date as string);
        whereClause.flight = {
          flightDate: date,
        };
      }

      const manifests = await prisma.manifest.findMany({
        where: whereClause,
        include: {
          flight: {
            select: {
              id: true,
              flightNumber: true,
              flightDate: true,
              origin: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: manifests });
    } catch (error) {
      console.error('Error fetching manifests:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch manifests' });
    }
  }
);

/**
 * GET /api/manifests/:id - Get single manifest
 */
router.get('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Invalid manifest ID' });
    return;
  }

  try {
    const manifest = await prisma.manifest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        flight: {
          include: { aircraft: true },
        },
      },
    });

    if (!manifest) {
      res.status(404).json({ success: false, error: 'Manifest not found' });
      return;
    }

    res.json({ success: true, data: manifest });
  } catch (error) {
    console.error('Error fetching manifest:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch manifest' });
  }
});

/**
 * POST /api/manifests/generate - Generate manifest for a flight
 */
router.post(
  '/generate',
  requireRole('ADMIN', 'OPS'),
  [body('flightId').isInt()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const flightId = req.body.flightId;

      // Fetch flight with all related data
      const flight = await prisma.flight.findUnique({
        where: { id: flightId },
        include: {
          aircraft: true,
          passengers: { orderBy: { seatNumber: 'asc' } },
          freight: { orderBy: { priority: 'asc' } },
          mail: { orderBy: { priority: 'asc' } },
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

      // Calculate W&B
      const wb = calculateWeightBalance({
        aircraft: aircraftConfig,
        pilotWeightKg: Number(flight.pilotWeightKg) || aircraftConfig.pilotStandardWeightKg,
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

      // Calculate totals
      const passengerWeight = flight.passengers.reduce((sum, p) => {
        const weight = p.weightKg ? Number(p.weightKg) : 88; // standard weight
        return sum + weight;
      }, 0);

      const baggageWeight = flight.passengers.reduce((sum, p) => sum + Number(p.bagsKg), 0);
      const freightWeight = flight.freight.reduce((sum, f) => sum + Number(f.weightKg), 0);
      const mailWeight = flight.mail.reduce((sum, m) => sum + Number(m.weightKg), 0);

      // Get version number for this flight's manifests
      const latestManifest = await prisma.manifest.findFirst({
        where: { flightId },
        orderBy: { version: 'desc' },
      });
      const version = (latestManifest?.version || 0) + 1;

      // Build manifest JSON
      const manifestJson: ManifestJSON = {
        manifestId: `MANF-${flight.flightDate.toISOString().split('T')[0]}-${flight.flightNumber || flight.id}-${flight.aircraft.tail}`,
        flightId: flight.id,
        flightNumber: flight.flightNumber || `FL${flight.id}`,
        flightDate: flight.flightDate.toISOString().split('T')[0],
        tail: flight.aircraft.tail,
        aircraftType: flight.aircraft.type,
        pilot: flight.pilotName || 'TBD',
        origin: flight.origin,
        route: flight.route as RouteLeg[],
        passengers: flight.passengers.map((p, idx) => ({
          seat: p.seatNumber || idx + 1,
          name: p.name,
          weightKg: p.weightKg ? Number(p.weightKg) : 88,
          bagsKg: Number(p.bagsKg),
          destination: p.destination,
          priority: p.priority as any,
        })),
        freight: flight.freight.map(f => ({
          waybill: f.waybill || `WB-${f.id}`,
          description: f.description || 'Freight',
          weightKg: Number(f.weightKg),
          destination: f.destination,
          compartment: f.compartment || 'A',
        })),
        mail: flight.mail.map(m => ({
          village: m.village,
          pounds: Number(m.pounds),
          weightKg: Number(m.weightKg),
        })),
        totals: {
          passengerCount: flight.passengers.length,
          passengerWeightKg: passengerWeight,
          baggageWeightKg: baggageWeight,
          freightWeightKg: freightWeight,
          mailWeightKg: mailWeight,
          fuelWeightKg: Number(flight.fuelWeightKg) || 0,
          totalPayloadKg: passengerWeight + baggageWeight + freightWeight + mailWeight,
        },
        wAndB: {
          totalWeightKg: wb.totalWeightKg,
          cg: wb.cg,
          mtow: wb.mtow,
          withinEnvelope: wb.isValid,
          cgMin: wb.cgMin,
          cgMax: wb.cgMax,
        },
        warnings: wb.warnings.map(w => w.message),
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.email || 'system',
        version,
      };

      // Mark previous manifests as inactive
      await prisma.manifest.updateMany({
        where: { flightId, isActive: true },
        data: { isActive: false },
      });

      // Create manifest record
      const manifest = await prisma.manifest.create({
        data: {
          flightId,
          manifestJson: manifestJson as any,
          generatedBy: req.user?.email || 'auto',
          version,
          isActive: true,
        },
      });

      // Generate PDF (async, don't wait)
      generateManifestPDF(manifestJson, manifest.id).catch(err => {
        console.error('PDF generation error:', err);
      });

      res.status(201).json({
        success: true,
        data: {
          ...manifest,
          manifestJson,
        },
        warnings: wb.warnings.length > 0 ? wb.warnings : undefined,
      });
    } catch (error) {
      console.error('Error generating manifest:', error);
      res.status(500).json({ success: false, error: 'Failed to generate manifest' });
    }
  }
);

/**
 * POST /api/manifests/generate-batch - Generate manifests for multiple flights
 */
router.post(
  '/generate-batch',
  requireRole('ADMIN', 'OPS'),
  [body('flightDate').isISO8601()],
  async (req: Request, res: Response) => {
    try {
      const flightDate = new Date(req.body.flightDate);

      // Get all flights for the date
      const flights = await prisma.flight.findMany({
        where: {
          flightDate,
          status: { in: ['DRAFT', 'SCHEDULED'] },
        },
        select: { id: true },
      });

      if (flights.length === 0) {
        res.status(404).json({ success: false, error: 'No flights found for the specified date' });
        return;
      }

      // Generate manifests for each flight
      const results: { flightId: number; manifestId: number; success: boolean; error?: string }[] = [];

      for (const flight of flights) {
        try {
          // Use internal generate logic
          const flight_full = await prisma.flight.findUnique({
            where: { id: flight.id },
            include: {
              aircraft: true,
              passengers: { orderBy: { seatNumber: 'asc' } },
              freight: { orderBy: { priority: 'asc' } },
              mail: { orderBy: { priority: 'asc' } },
            },
          });

          if (!flight_full) continue;

          const aircraftConfig: AircraftConfig = {
            id: flight_full.aircraft.id,
            tail: flight_full.aircraft.tail,
            type: flight_full.aircraft.type,
            maxTakeoffKg: Number(flight_full.aircraft.maxTakeoffKg),
            emptyWeightKg: Number(flight_full.aircraft.emptyWeightKg),
            emptyWeightArm: Number(flight_full.aircraft.emptyWeightArm),
            pilotStandardWeightKg: Number(flight_full.aircraft.pilotStandardWeightKg),
            pilotArm: Number(flight_full.aircraft.pilotArm),
            cgLimits: flight_full.aircraft.cgLimits as any,
            seatConfiguration: flight_full.aircraft.seatConfiguration as any,
            baggageCompartments: flight_full.aircraft.baggageCompartments as any,
            fuelTankArm: Number(flight_full.aircraft.fuelTankArm),
            seats: flight_full.aircraft.seats,
          };

          const wb = calculateWeightBalance({
            aircraft: aircraftConfig,
            pilotWeightKg: Number(flight_full.pilotWeightKg) || aircraftConfig.pilotStandardWeightKg,
            fuelWeightKg: Number(flight_full.fuelWeightKg) || 0,
            passengers: flight_full.passengers.map(p => ({
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
            freight: flight_full.freight.map(f => ({
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
            mail: flight_full.mail.map(m => ({
              id: m.id,
              village: m.village,
              pounds: Number(m.pounds),
              weightKg: Number(m.weightKg),
              priority: m.priority as any,
              assignedFlightId: m.assignedFlightId,
              notes: m.notes,
            })),
          });

          const latestManifest = await prisma.manifest.findFirst({
            where: { flightId: flight.id },
            orderBy: { version: 'desc' },
          });
          const version = (latestManifest?.version || 0) + 1;

          const passengerWeight = flight_full.passengers.reduce((sum, p) => {
            const weight = p.weightKg ? Number(p.weightKg) : 88;
            return sum + weight;
          }, 0);
          const baggageWeight = flight_full.passengers.reduce((sum, p) => sum + Number(p.bagsKg), 0);
          const freightWeight = flight_full.freight.reduce((sum, f) => sum + Number(f.weightKg), 0);
          const mailWeight = flight_full.mail.reduce((sum, m) => sum + Number(m.weightKg), 0);

          const manifestJson: ManifestJSON = {
            manifestId: `MANF-${flight_full.flightDate.toISOString().split('T')[0]}-${flight_full.flightNumber || flight_full.id}-${flight_full.aircraft.tail}`,
            flightId: flight_full.id,
            flightNumber: flight_full.flightNumber || `FL${flight_full.id}`,
            flightDate: flight_full.flightDate.toISOString().split('T')[0],
            tail: flight_full.aircraft.tail,
            aircraftType: flight_full.aircraft.type,
            pilot: flight_full.pilotName || 'TBD',
            origin: flight_full.origin,
            route: flight_full.route as RouteLeg[],
            passengers: flight_full.passengers.map((p, idx) => ({
              seat: p.seatNumber || idx + 1,
              name: p.name,
              weightKg: p.weightKg ? Number(p.weightKg) : 88,
              bagsKg: Number(p.bagsKg),
              destination: p.destination,
              priority: p.priority as any,
            })),
            freight: flight_full.freight.map(f => ({
              waybill: f.waybill || `WB-${f.id}`,
              description: f.description || 'Freight',
              weightKg: Number(f.weightKg),
              destination: f.destination,
              compartment: f.compartment || 'A',
            })),
            mail: flight_full.mail.map(m => ({
              village: m.village,
              pounds: Number(m.pounds),
              weightKg: Number(m.weightKg),
            })),
            totals: {
              passengerCount: flight_full.passengers.length,
              passengerWeightKg: passengerWeight,
              baggageWeightKg: baggageWeight,
              freightWeightKg: freightWeight,
              mailWeightKg: mailWeight,
              fuelWeightKg: Number(flight_full.fuelWeightKg) || 0,
              totalPayloadKg: passengerWeight + baggageWeight + freightWeight + mailWeight,
            },
            wAndB: {
              totalWeightKg: wb.totalWeightKg,
              cg: wb.cg,
              mtow: wb.mtow,
              withinEnvelope: wb.isValid,
              cgMin: wb.cgMin,
              cgMax: wb.cgMax,
            },
            warnings: wb.warnings.map(w => w.message),
            generatedAt: new Date().toISOString(),
            generatedBy: req.user?.email || 'batch',
            version,
          };

          await prisma.manifest.updateMany({
            where: { flightId: flight.id, isActive: true },
            data: { isActive: false },
          });

          const manifest = await prisma.manifest.create({
            data: {
              flightId: flight.id,
              manifestJson: manifestJson as any,
              generatedBy: req.user?.email || 'batch',
              version,
              isActive: true,
            },
          });

          results.push({ flightId: flight.id, manifestId: manifest.id, success: true });

          generateManifestPDF(manifestJson, manifest.id).catch(err => {
            console.error(`PDF generation error for flight ${flight.id}:`, err);
          });
        } catch (err) {
          results.push({
            flightId: flight.id,
            manifestId: 0,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      res.json({
        success: true,
        data: {
          totalFlights: flights.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        },
      });
    } catch (error) {
      console.error('Error generating batch manifests:', error);
      res.status(500).json({ success: false, error: 'Failed to generate batch manifests' });
    }
  }
);

/**
 * POST /api/manifests/:id/sign - Sign a manifest
 */
router.post(
  '/:id/sign',
  requireRole('ADMIN', 'OPS', 'PILOT'),
  param('id').isInt(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid manifest ID' });
      return;
    }

    try {
      const manifest = await prisma.manifest.update({
        where: { id: parseInt(req.params.id) },
        data: {
          signedBy: req.user?.email || 'unknown',
          signedAt: new Date(),
        },
      });

      res.json({ success: true, data: manifest });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Manifest not found' });
        return;
      }
      console.error('Error signing manifest:', error);
      res.status(500).json({ success: false, error: 'Failed to sign manifest' });
    }
  }
);

export default router;
