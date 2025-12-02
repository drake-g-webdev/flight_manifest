/**
 * Database seed script
 *
 * Creates sample data for development and testing.
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // Clear existing data (in reverse order of dependencies)
  console.log('Clearing existing data...');
  await prisma.assignment.deleteMany();
  await prisma.manifest.deleteMany();
  await prisma.mailManifest.deleteMany();
  await prisma.freight.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.aircraft.deleteMany();
  await prisma.user.deleteMany();
  await prisma.station.deleteMany();
  await prisma.optimizationLog.deleteMany();
  await prisma.operator.deleteMany();
  console.log('  Data cleared');

  // Create operators
  console.log('\nCreating operators...');

  const wrightAir = await prisma.operator.create({
    data: {
      code: 'WAI',
      name: 'Wright Air',
      shortName: 'Wright',
      dotNumber: 'DOT-123456',
      airCarrier: 'W8IA123C',
      primaryColor: '#1e40af', // Blue
      address: '6450 Airport Way, Fairbanks, AK 99709',
      phone: '907-555-0100',
      email: 'ops@wrightair.com',
      notes: 'Interior Alaska and North Slope operations',
    },
  });

  const warbelows = await prisma.operator.create({
    data: {
      code: 'WRB',
      name: "Warbelow's Air Ventures",
      shortName: "Warbelow's",
      dotNumber: 'DOT-789012',
      airCarrier: 'WBLA456D',
      primaryColor: '#dc2626', // Red
      address: '3758 University Ave S, Fairbanks, AK 99709',
      phone: '907-555-0200',
      email: 'ops@warbelows.com',
      notes: 'Flightseeing and charter operations',
    },
  });

  console.log(`  Created operators: ${wrightAir.name}, ${warbelows.name}`);

  // Create stations for Wright Air
  console.log('\nCreating stations...');

  const fairbanksWai = await prisma.station.create({
    data: {
      code: 'FAI',
      name: 'Fairbanks',
      icao: 'PAFA',
      timezone: 'America/Anchorage',
      isMainBase: true,
      address: '6450 Airport Way, Fairbanks, AK 99709',
      phone: '907-555-0100',
      notes: 'Main hub - maintenance base',
      operatorId: wrightAir.id,
    },
  });

  const barrowWai = await prisma.station.create({
    data: {
      code: 'BRW',
      name: 'Barrow (Utqiagvik)',
      icao: 'PABR',
      timezone: 'America/Anchorage',
      isMainBase: false,
      address: 'Wiley Post-Will Rogers Memorial Airport',
      phone: '907-555-0200',
      notes: 'North Slope hub',
      operatorId: wrightAir.id,
    },
  });

  const bethelWai = await prisma.station.create({
    data: {
      code: 'BET',
      name: 'Bethel',
      icao: 'PABE',
      timezone: 'America/Anchorage',
      isMainBase: false,
      address: 'Bethel Airport',
      phone: '907-555-0300',
      notes: 'YK Delta hub',
      operatorId: wrightAir.id,
    },
  });

  const kotzebueWai = await prisma.station.create({
    data: {
      code: 'OTZ',
      name: 'Kotzebue',
      icao: 'PAOT',
      timezone: 'America/Anchorage',
      isMainBase: false,
      address: 'Ralph Wien Memorial Airport',
      phone: '907-555-0400',
      notes: 'Northwest Arctic hub',
      operatorId: wrightAir.id,
    },
  });

  // Create stations for Warbelow's
  const fairbanksWrb = await prisma.station.create({
    data: {
      code: 'FAI',
      name: 'Fairbanks',
      icao: 'PAFA',
      timezone: 'America/Anchorage',
      isMainBase: true,
      address: '3758 University Ave S, Fairbanks, AK 99709',
      phone: '907-555-0200',
      notes: "Warbelow's main base",
      operatorId: warbelows.id,
    },
  });

  const deadhorseWrb = await prisma.station.create({
    data: {
      code: 'SCC',
      name: 'Deadhorse/Prudhoe Bay',
      icao: 'PASC',
      timezone: 'America/Anchorage',
      isMainBase: false,
      address: 'Deadhorse Airport',
      phone: '907-555-0500',
      notes: 'Oil field charters',
      operatorId: warbelows.id,
    },
  });

  console.log(`  Created Wright Air stations: ${fairbanksWai.code}, ${barrowWai.code}, ${bethelWai.code}, ${kotzebueWai.code}`);
  console.log(`  Created Warbelow's stations: ${fairbanksWrb.code}, ${deadhorseWrb.code}`);

  // Create users
  console.log('\nCreating users...');
  const passwordHash = await bcrypt.hash('password123', 12);

  // Super Admin (no operator - can access all)
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@sukakpak.com',
      passwordHash,
      name: 'Super Admin',
      role: 'ADMIN',
      operatorId: null, // null = super admin
    },
  });

  // Wright Air users
  const adminWai = await prisma.user.create({
    data: {
      email: 'admin@wrightair.com',
      passwordHash,
      name: 'Wright Air Admin',
      role: 'ADMIN',
      stationId: fairbanksWai.id,
      operatorId: wrightAir.id,
    },
  });

  const opsWai = await prisma.user.create({
    data: {
      email: 'ops@wrightair.com',
      passwordHash,
      name: 'Operations - Wright Air',
      role: 'OPS',
      stationId: fairbanksWai.id,
      operatorId: wrightAir.id,
    },
  });

  const pilotWai1 = await prisma.user.create({
    data: {
      email: 'john@wrightair.com',
      passwordHash,
      name: 'John Pilot',
      role: 'PILOT',
      stationId: fairbanksWai.id,
      operatorId: wrightAir.id,
    },
  });

  const pilotWai2 = await prisma.user.create({
    data: {
      email: 'steve@wrightair.com',
      passwordHash,
      name: 'Steve Smith',
      role: 'PILOT',
      stationId: fairbanksWai.id,
      operatorId: wrightAir.id,
    },
  });

  // Warbelow's users
  const adminWrb = await prisma.user.create({
    data: {
      email: 'admin@warbelows.com',
      passwordHash,
      name: "Warbelow's Admin",
      role: 'ADMIN',
      stationId: fairbanksWrb.id,
      operatorId: warbelows.id,
    },
  });

  const opsWrb = await prisma.user.create({
    data: {
      email: 'ops@warbelows.com',
      passwordHash,
      name: "Operations - Warbelow's",
      role: 'OPS',
      stationId: fairbanksWrb.id,
      operatorId: warbelows.id,
    },
  });

  const pilotWrb = await prisma.user.create({
    data: {
      email: 'mike@warbelows.com',
      passwordHash,
      name: 'Mike Johnson',
      role: 'PILOT',
      stationId: fairbanksWrb.id,
      operatorId: warbelows.id,
    },
  });

  console.log(`  Created super admin: ${superAdmin.email}`);
  console.log(`  Created Wright Air users: ${adminWai.email}, ${opsWai.email}, ${pilotWai1.email}, ${pilotWai2.email}`);
  console.log(`  Created Warbelow's users: ${adminWrb.email}, ${opsWrb.email}, ${pilotWrb.email}`);

  // Create aircraft for Wright Air
  console.log('\nCreating aircraft...');

  const caravan1Wai = await prisma.aircraft.create({
    data: {
      tail: 'N208SK',
      type: 'C208B',
      maxTakeoffKg: 3629,
      emptyWeightKg: 2145,
      emptyWeightArm: 2.5,
      pilotStandardWeightKg: 90,
      pilotArm: 1.2,
      cgLimits: { cgMin: 2.3, cgMax: 2.9 },
      seatConfiguration: [
        { seat: 1, arm: 1.5, maxWeightKg: 136 },
        { seat: 2, arm: 1.5, maxWeightKg: 136 },
        { seat: 3, arm: 2.0, maxWeightKg: 136 },
        { seat: 4, arm: 2.0, maxWeightKg: 136 },
        { seat: 5, arm: 2.5, maxWeightKg: 136 },
        { seat: 6, arm: 2.5, maxWeightKg: 136 },
        { seat: 7, arm: 3.0, maxWeightKg: 136 },
        { seat: 8, arm: 3.0, maxWeightKg: 136 },
        { seat: 9, arm: 3.5, maxWeightKg: 136 },
      ],
      baggageCompartments: [
        { name: 'Forward', capacityKg: 136, arm: 1.0 },
        { name: 'Aft', capacityKg: 272, arm: 4.0 },
        { name: 'Belly', capacityKg: 340, arm: 2.5 },
      ],
      fuelTankArm: 2.4,
      seats: 9,
      maintenanceStatus: 'OPERATIONAL',
      totalFlightHours: 4520,
      hoursToNextService: 80,
      currentStationId: fairbanksWai.id,
      homeStationId: fairbanksWai.id,
      operatorId: wrightAir.id,
      notes: 'Primary bush plane - amphibious floats',
    },
  });

  const caravan2Wai = await prisma.aircraft.create({
    data: {
      tail: 'N208AK',
      type: 'C208B',
      maxTakeoffKg: 3629,
      emptyWeightKg: 2145,
      emptyWeightArm: 2.5,
      pilotStandardWeightKg: 90,
      pilotArm: 1.2,
      cgLimits: { cgMin: 2.3, cgMax: 2.9 },
      seatConfiguration: [
        { seat: 1, arm: 1.5, maxWeightKg: 136 },
        { seat: 2, arm: 1.5, maxWeightKg: 136 },
        { seat: 3, arm: 2.0, maxWeightKg: 136 },
        { seat: 4, arm: 2.0, maxWeightKg: 136 },
        { seat: 5, arm: 2.5, maxWeightKg: 136 },
        { seat: 6, arm: 2.5, maxWeightKg: 136 },
        { seat: 7, arm: 3.0, maxWeightKg: 136 },
        { seat: 8, arm: 3.0, maxWeightKg: 136 },
        { seat: 9, arm: 3.5, maxWeightKg: 136 },
      ],
      baggageCompartments: [
        { name: 'Forward', capacityKg: 136, arm: 1.0 },
        { name: 'Aft', capacityKg: 272, arm: 4.0 },
        { name: 'Belly', capacityKg: 340, arm: 2.5 },
      ],
      fuelTankArm: 2.4,
      seats: 9,
      maintenanceStatus: 'OPERATIONAL',
      totalFlightHours: 3210,
      hoursToNextService: 190,
      currentStationId: fairbanksWai.id,
      homeStationId: fairbanksWai.id,
      operatorId: wrightAir.id,
      notes: 'Secondary Caravan - wheel/ski configuration',
    },
  });

  const pc12Wai = await prisma.aircraft.create({
    data: {
      tail: 'N12PC',
      type: 'PC-12',
      maxTakeoffKg: 4740,
      emptyWeightKg: 2800,
      emptyWeightArm: 4.2,
      pilotStandardWeightKg: 90,
      pilotArm: 2.5,
      cgLimits: { cgMin: 4.0, cgMax: 4.6 },
      seatConfiguration: [
        { seat: 1, arm: 3.0, maxWeightKg: 136 },
        { seat: 2, arm: 3.0, maxWeightKg: 136 },
        { seat: 3, arm: 3.8, maxWeightKg: 136 },
        { seat: 4, arm: 3.8, maxWeightKg: 136 },
        { seat: 5, arm: 4.5, maxWeightKg: 136 },
        { seat: 6, arm: 4.5, maxWeightKg: 136 },
        { seat: 7, arm: 5.2, maxWeightKg: 136 },
        { seat: 8, arm: 5.2, maxWeightKg: 136 },
      ],
      baggageCompartments: [
        { name: 'Forward', capacityKg: 180, arm: 2.0 },
        { name: 'Rear', capacityKg: 450, arm: 6.5 },
      ],
      fuelTankArm: 4.3,
      seats: 8,
      maintenanceStatus: 'OPERATIONAL',
      totalFlightHours: 2150,
      hoursToNextService: 350,
      currentStationId: fairbanksWai.id,
      homeStationId: fairbanksWai.id,
      operatorId: wrightAir.id,
      notes: 'Long-range aircraft - pressurized',
    },
  });

  const caravan3Wai = await prisma.aircraft.create({
    data: {
      tail: 'N208NS',
      type: 'C208B',
      maxTakeoffKg: 3629,
      emptyWeightKg: 2145,
      emptyWeightArm: 2.5,
      pilotStandardWeightKg: 90,
      pilotArm: 1.2,
      cgLimits: { cgMin: 2.3, cgMax: 2.9 },
      seatConfiguration: [
        { seat: 1, arm: 1.5, maxWeightKg: 136 },
        { seat: 2, arm: 1.5, maxWeightKg: 136 },
        { seat: 3, arm: 2.0, maxWeightKg: 136 },
        { seat: 4, arm: 2.0, maxWeightKg: 136 },
        { seat: 5, arm: 2.5, maxWeightKg: 136 },
        { seat: 6, arm: 2.5, maxWeightKg: 136 },
        { seat: 7, arm: 3.0, maxWeightKg: 136 },
        { seat: 8, arm: 3.0, maxWeightKg: 136 },
        { seat: 9, arm: 3.5, maxWeightKg: 136 },
      ],
      baggageCompartments: [
        { name: 'Forward', capacityKg: 136, arm: 1.0 },
        { name: 'Aft', capacityKg: 272, arm: 4.0 },
        { name: 'Belly', capacityKg: 340, arm: 2.5 },
      ],
      fuelTankArm: 2.4,
      seats: 9,
      maintenanceStatus: 'OPERATIONAL',
      totalFlightHours: 5890,
      hoursToNextService: 10,
      currentStationId: barrowWai.id,
      homeStationId: barrowWai.id,
      operatorId: wrightAir.id,
      notes: 'North Slope operations - ski equipped',
    },
  });

  // Create aircraft for Warbelow's
  const kingairWrb = await prisma.aircraft.create({
    data: {
      tail: 'N90KA',
      type: 'BE90',
      maxTakeoffKg: 4581,
      emptyWeightKg: 3035,
      emptyWeightArm: 4.5,
      pilotStandardWeightKg: 90,
      pilotArm: 2.8,
      cgLimits: { cgMin: 4.2, cgMax: 4.9 },
      seatConfiguration: [
        { seat: 1, arm: 3.5, maxWeightKg: 136 },
        { seat: 2, arm: 3.5, maxWeightKg: 136 },
        { seat: 3, arm: 4.2, maxWeightKg: 136 },
        { seat: 4, arm: 4.2, maxWeightKg: 136 },
        { seat: 5, arm: 4.9, maxWeightKg: 136 },
        { seat: 6, arm: 4.9, maxWeightKg: 136 },
      ],
      baggageCompartments: [
        { name: 'Nose', capacityKg: 150, arm: 1.5 },
        { name: 'Rear', capacityKg: 300, arm: 6.0 },
      ],
      fuelTankArm: 4.5,
      seats: 6,
      maintenanceStatus: 'OPERATIONAL',
      totalFlightHours: 6200,
      hoursToNextService: 150,
      currentStationId: fairbanksWrb.id,
      homeStationId: fairbanksWrb.id,
      operatorId: warbelows.id,
      notes: 'Charter/flightseeing twin',
    },
  });

  const cessna185Wrb = await prisma.aircraft.create({
    data: {
      tail: 'N185WB',
      type: 'C185',
      maxTakeoffKg: 1520,
      emptyWeightKg: 850,
      emptyWeightArm: 2.1,
      pilotStandardWeightKg: 90,
      pilotArm: 0.9,
      cgLimits: { cgMin: 1.9, cgMax: 2.4 },
      seatConfiguration: [
        { seat: 1, arm: 1.0, maxWeightKg: 136 },
        { seat: 2, arm: 1.5, maxWeightKg: 136 },
        { seat: 3, arm: 1.5, maxWeightKg: 136 },
        { seat: 4, arm: 2.2, maxWeightKg: 136 },
      ],
      baggageCompartments: [
        { name: 'Rear', capacityKg: 100, arm: 2.8 },
      ],
      fuelTankArm: 1.8,
      seats: 4,
      maintenanceStatus: 'OPERATIONAL',
      totalFlightHours: 8900,
      hoursToNextService: 45,
      currentStationId: fairbanksWrb.id,
      homeStationId: fairbanksWrb.id,
      operatorId: warbelows.id,
      notes: 'Bush plane - floats/wheels',
    },
  });

  console.log(`  Created Wright Air aircraft: ${caravan1Wai.tail}, ${caravan2Wai.tail}, ${pc12Wai.tail}, ${caravan3Wai.tail}`);
  console.log(`  Created Warbelow's aircraft: ${kingairWrb.tail}, ${cessna185Wrb.tail}`);

  // Create flights for Wright Air
  console.log('\nCreating flights...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Wright Air flights
  const flight1Wai = await prisma.flight.create({
    data: {
      flightDate: today,
      flightNumber: 'WA101',
      origin: 'FAI',
      originStationId: fairbanksWai.id,
      departureTime: new Date(today.getTime() + 8 * 60 * 60 * 1000),
      route: [
        { leg: 1, to: 'Allakaket', eta: '09:15' },
        { leg: 2, to: 'Alatna', eta: '09:45' },
        { leg: 3, to: 'Hughes', eta: '10:30' },
      ],
      tailId: caravan1Wai.id,
      pilotName: 'John Pilot',
      pilotWeightKg: 85,
      fuelWeightKg: 400,
      status: 'SCHEDULED',
      operatorId: wrightAir.id,
      notes: 'Morning Koyukuk River villages',
    },
  });

  const flight2Wai = await prisma.flight.create({
    data: {
      flightDate: today,
      flightNumber: 'WA102',
      origin: 'FAI',
      originStationId: fairbanksWai.id,
      departureTime: new Date(today.getTime() + 10 * 60 * 60 * 1000),
      route: [
        { leg: 1, to: 'Tanana', eta: '11:00' },
        { leg: 2, to: 'Ruby', eta: '11:45' },
        { leg: 3, to: 'Galena', eta: '12:30' },
      ],
      tailId: caravan2Wai.id,
      pilotName: 'Steve Smith',
      pilotWeightKg: 95,
      fuelWeightKg: 450,
      status: 'SCHEDULED',
      operatorId: wrightAir.id,
      notes: 'Yukon River villages',
    },
  });

  const flight3Wai = await prisma.flight.create({
    data: {
      flightDate: today,
      flightNumber: 'WA201',
      origin: 'FAI',
      originStationId: fairbanksWai.id,
      departureTime: new Date(today.getTime() + 13 * 60 * 60 * 1000),
      route: [{ leg: 1, to: 'Bethel', eta: '15:30' }],
      tailId: pc12Wai.id,
      pilotName: 'Mike Johnson',
      pilotWeightKg: 88,
      fuelWeightKg: 600,
      status: 'DRAFT',
      operatorId: wrightAir.id,
      notes: 'Long-haul Bethel run - YK Delta mail',
    },
  });

  const flight4Wai = await prisma.flight.create({
    data: {
      flightDate: tomorrow,
      flightNumber: 'WA103',
      origin: 'FAI',
      originStationId: fairbanksWai.id,
      departureTime: new Date(tomorrow.getTime() + 7 * 60 * 60 * 1000),
      route: [
        { leg: 1, to: 'Fort Yukon', eta: '08:00' },
        { leg: 2, to: 'Arctic Village', eta: '09:00' },
        { leg: 3, to: 'Venetie', eta: '09:45' },
      ],
      tailId: caravan1Wai.id,
      pilotName: 'John Pilot',
      pilotWeightKg: 85,
      fuelWeightKg: 420,
      status: 'DRAFT',
      operatorId: wrightAir.id,
      notes: 'Arctic Circle villages',
    },
  });

  const flight5Wai = await prisma.flight.create({
    data: {
      flightDate: tomorrow,
      flightNumber: 'WA104',
      origin: 'FAI',
      originStationId: fairbanksWai.id,
      departureTime: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000),
      route: [
        { leg: 1, to: 'Huslia', eta: '10:30' },
        { leg: 2, to: 'Koyukuk', eta: '11:15' },
        { leg: 3, to: 'Nulato', eta: '12:00' },
      ],
      tailId: caravan2Wai.id,
      pilotName: 'Steve Smith',
      pilotWeightKg: 95,
      fuelWeightKg: 430,
      status: 'DRAFT',
      operatorId: wrightAir.id,
      notes: 'Lower Koyukuk villages',
    },
  });

  // Warbelow's flights
  const flight1Wrb = await prisma.flight.create({
    data: {
      flightDate: today,
      flightNumber: 'WB50',
      origin: 'FAI',
      originStationId: fairbanksWrb.id,
      departureTime: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      route: [{ leg: 1, to: 'Deadhorse', eta: '11:30' }],
      tailId: kingairWrb.id,
      pilotName: 'Mike Johnson',
      pilotWeightKg: 88,
      fuelWeightKg: 500,
      status: 'SCHEDULED',
      operatorId: warbelows.id,
      notes: 'Prudhoe Bay charter - oil field crew',
    },
  });

  const flight2Wrb = await prisma.flight.create({
    data: {
      flightDate: today,
      flightNumber: 'WB51',
      origin: 'FAI',
      originStationId: fairbanksWrb.id,
      departureTime: new Date(today.getTime() + 14 * 60 * 60 * 1000),
      route: [
        { leg: 1, to: 'Denali Park', eta: '14:45' },
        { leg: 2, to: 'FAI', eta: '16:00' },
      ],
      tailId: cessna185Wrb.id,
      pilotName: 'Mike Johnson',
      pilotWeightKg: 88,
      fuelWeightKg: 150,
      status: 'DRAFT',
      operatorId: warbelows.id,
      notes: 'Flightseeing tour',
    },
  });

  console.log(`  Created Wright Air flights: ${flight1Wai.flightNumber}, ${flight2Wai.flightNumber}, ${flight3Wai.flightNumber}, ${flight4Wai.flightNumber}, ${flight5Wai.flightNumber}`);
  console.log(`  Created Warbelow's flights: ${flight1Wrb.flightNumber}, ${flight2Wrb.flightNumber}`);

  // Create passengers for Wright Air
  console.log('\nCreating passengers...');

  const passengersWai = await Promise.all([
    // Flight 1 passengers (today - Koyukuk villages)
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-001',
        name: 'Mary Stevens',
        phone: '907-555-1001',
        weightKg: 72,
        standardWeightUsed: false,
        bagsKg: 12,
        destination: 'Allakaket',
        priority: 'NORMAL',
        flightId: flight1Wai.id,
        seatNumber: 1,
        operatorId: wrightAir.id,
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-002',
        name: 'Robert Williams',
        phone: '907-555-1002',
        weightKg: 95,
        standardWeightUsed: false,
        bagsKg: 18,
        destination: 'Allakaket',
        priority: 'NORMAL',
        flightId: flight1Wai.id,
        seatNumber: 2,
        operatorId: wrightAir.id,
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-003',
        name: 'Elder Agnes Nictune',
        phone: '907-555-1003',
        weightKg: 65,
        standardWeightUsed: false,
        bagsKg: 5,
        destination: 'Alatna',
        priority: 'FIRST_CLASS',
        flightId: flight1Wai.id,
        seatNumber: 3,
        operatorId: wrightAir.id,
        notes: 'Tribal elder - returning from medical',
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-004',
        name: 'Thomas Bergman',
        weightKg: 110,
        standardWeightUsed: false,
        bagsKg: 25,
        destination: 'Hughes',
        priority: 'NORMAL',
        flightId: flight1Wai.id,
        seatNumber: 4,
        operatorId: wrightAir.id,
        notes: 'Construction worker - tools in bags',
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-005',
        name: 'Jennifer Moses',
        bagsKg: 8,
        destination: 'Hughes',
        priority: 'NORMAL',
        flightId: flight1Wai.id,
        seatNumber: 5,
        operatorId: wrightAir.id,
      },
    }),
    // Flight 2 passengers (today - Yukon villages)
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-006',
        name: 'Sarah Pilot',
        bagsKg: 15,
        destination: 'Tanana',
        priority: 'NORMAL',
        flightId: flight2Wai.id,
        seatNumber: 1,
        operatorId: wrightAir.id,
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-007',
        name: 'Chief Walter Carlo',
        weightKg: 82,
        standardWeightUsed: false,
        bagsKg: 10,
        destination: 'Tanana',
        priority: 'FIRST_CLASS',
        flightId: flight2Wai.id,
        seatNumber: 2,
        operatorId: wrightAir.id,
        notes: 'Tribal chief - priority boarding',
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-008',
        name: 'David Alexie',
        bagsKg: 20,
        destination: 'Ruby',
        priority: 'NORMAL',
        flightId: flight2Wai.id,
        seatNumber: 3,
        operatorId: wrightAir.id,
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-009',
        name: 'Patricia Frank',
        weightKg: 68,
        standardWeightUsed: false,
        bagsKg: 12,
        destination: 'Galena',
        priority: 'NORMAL',
        flightId: flight2Wai.id,
        seatNumber: 4,
        operatorId: wrightAir.id,
      },
    }),
    // Unassigned passengers
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-010',
        name: 'Michael Peters',
        weightKg: 90,
        standardWeightUsed: false,
        bagsKg: 22,
        destination: 'Allakaket',
        priority: 'NORMAL',
        operatorId: wrightAir.id,
        notes: 'Standby - next available flight',
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-011',
        name: 'Emergency Patient Jones',
        weightKg: 75,
        standardWeightUsed: false,
        bagsKg: 3,
        destination: 'Hughes',
        priority: 'EVAC',
        operatorId: wrightAir.id,
        notes: 'URGENT: Medical evacuation - appendicitis symptoms',
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WA-012',
        name: 'Dr. Lisa Chen',
        weightKg: 58,
        standardWeightUsed: false,
        bagsKg: 15,
        destination: 'Bethel',
        priority: 'MEDICAL',
        operatorId: wrightAir.id,
        notes: 'Traveling nurse - medical equipment in bags',
      },
    }),
  ]);

  // Create passengers for Warbelow's
  const passengersWrb = await Promise.all([
    prisma.passenger.create({
      data: {
        bookingRef: 'WB-001',
        name: 'James Wilson',
        weightKg: 88,
        standardWeightUsed: false,
        bagsKg: 20,
        destination: 'Deadhorse',
        priority: 'NORMAL',
        flightId: flight1Wrb.id,
        seatNumber: 1,
        operatorId: warbelows.id,
        notes: 'Oil field contractor',
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WB-002',
        name: 'Robert Baker',
        weightKg: 92,
        standardWeightUsed: false,
        bagsKg: 25,
        destination: 'Deadhorse',
        priority: 'NORMAL',
        flightId: flight1Wrb.id,
        seatNumber: 2,
        operatorId: warbelows.id,
        notes: 'BP rotation',
      },
    }),
    prisma.passenger.create({
      data: {
        bookingRef: 'WB-003',
        name: 'Tourist Group A',
        bagsKg: 10,
        destination: 'Denali Park',
        priority: 'NORMAL',
        flightId: flight2Wrb.id,
        seatNumber: 1,
        operatorId: warbelows.id,
        notes: 'Flightseeing tour',
      },
    }),
  ]);

  console.log(`  Created ${passengersWai.length} Wright Air passengers`);
  console.log(`  Created ${passengersWrb.length} Warbelow's passengers`);

  // Create freight for Wright Air
  console.log('\nCreating freight items...');

  const freightWai = await Promise.all([
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-001',
        description: 'Fresh groceries - perishable',
        weightKg: 85,
        destination: 'Allakaket',
        priority: 'PRIORITY',
        assignedFlightId: flight1Wai.id,
        compartment: 'Belly',
        operatorId: wrightAir.id,
      },
    }),
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-002',
        description: 'Hardware supplies (lumber brackets)',
        weightKg: 65,
        destination: 'Alatna',
        priority: 'STANDARD',
        assignedFlightId: flight1Wai.id,
        compartment: 'Aft',
        operatorId: wrightAir.id,
      },
    }),
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-003',
        description: 'Prescription medications',
        weightKg: 12,
        destination: 'Hughes',
        priority: 'BYPASS',
        assignedFlightId: flight1Wai.id,
        compartment: 'Forward',
        operatorId: wrightAir.id,
        notes: 'Temperature sensitive - keep warm',
      },
    }),
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-004',
        description: 'Empty fuel drums (6 units)',
        weightKg: 45,
        destination: 'Tanana',
        priority: 'STANDARD',
        assignedFlightId: flight2Wai.id,
        compartment: 'Aft',
        operatorId: wrightAir.id,
      },
    }),
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-005',
        description: 'Frozen fish boxes (commercial)',
        weightKg: 120,
        destination: 'Ruby',
        volumeM3: 0.4,
        priority: 'STANDARD',
        assignedFlightId: flight2Wai.id,
        compartment: 'Belly',
        operatorId: wrightAir.id,
      },
    }),
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-006',
        description: 'School textbooks',
        weightKg: 55,
        destination: 'Galena',
        priority: 'STANDARD',
        assignedFlightId: flight2Wai.id,
        compartment: 'Aft',
        operatorId: wrightAir.id,
      },
    }),
    // Unassigned freight
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-007',
        description: 'Generator parts (heavy)',
        weightKg: 180,
        destination: 'Allakaket',
        priority: 'PRIORITY',
        operatorId: wrightAir.id,
        notes: 'Village generator repair - urgent',
      },
    }),
    prisma.freight.create({
      data: {
        waybill: 'WA-2024-008',
        description: 'Fresh produce crates',
        weightKg: 95,
        destination: 'Hughes',
        priority: 'PRIORITY',
        operatorId: wrightAir.id,
        notes: 'Perishable - needs quick delivery',
      },
    }),
  ]);

  // Create freight for Warbelow's
  const freightWrb = await Promise.all([
    prisma.freight.create({
      data: {
        waybill: 'WB-2024-001',
        description: 'Oil field equipment',
        weightKg: 150,
        destination: 'Deadhorse',
        priority: 'PRIORITY',
        assignedFlightId: flight1Wrb.id,
        compartment: 'Rear',
        operatorId: warbelows.id,
      },
    }),
  ]);

  console.log(`  Created ${freightWai.length} Wright Air freight items`);
  console.log(`  Created ${freightWrb.length} Warbelow's freight items`);

  // Create mail for Wright Air
  console.log('\nCreating mail items...');

  const mailWai = await Promise.all([
    prisma.mailManifest.create({
      data: {
        village: 'Allakaket',
        pounds: 45,
        weightKg: 45 * 0.453592,
        priority: 'BYPASS',
        assignedFlightId: flight1Wai.id,
        operatorId: wrightAir.id,
      },
    }),
    prisma.mailManifest.create({
      data: {
        village: 'Alatna',
        pounds: 28,
        weightKg: 28 * 0.453592,
        priority: 'BYPASS',
        assignedFlightId: flight1Wai.id,
        operatorId: wrightAir.id,
      },
    }),
    prisma.mailManifest.create({
      data: {
        village: 'Hughes',
        pounds: 35,
        weightKg: 35 * 0.453592,
        priority: 'BYPASS',
        assignedFlightId: flight1Wai.id,
        operatorId: wrightAir.id,
      },
    }),
    prisma.mailManifest.create({
      data: {
        village: 'Tanana',
        pounds: 62,
        weightKg: 62 * 0.453592,
        priority: 'BYPASS',
        assignedFlightId: flight2Wai.id,
        operatorId: wrightAir.id,
      },
    }),
    prisma.mailManifest.create({
      data: {
        village: 'Ruby',
        pounds: 40,
        weightKg: 40 * 0.453592,
        priority: 'BYPASS',
        assignedFlightId: flight2Wai.id,
        operatorId: wrightAir.id,
      },
    }),
    prisma.mailManifest.create({
      data: {
        village: 'Galena',
        pounds: 55,
        weightKg: 55 * 0.453592,
        priority: 'BYPASS',
        assignedFlightId: flight2Wai.id,
        operatorId: wrightAir.id,
      },
    }),
    // Unassigned mail
    prisma.mailManifest.create({
      data: {
        village: 'Bethel',
        pounds: 180,
        weightKg: 180 * 0.453592,
        priority: 'BYPASS',
        operatorId: wrightAir.id,
        notes: 'Large mail run - YK Delta hub',
      },
    }),
    prisma.mailManifest.create({
      data: {
        village: 'Fort Yukon',
        pounds: 85,
        weightKg: 85 * 0.453592,
        priority: 'BYPASS',
        operatorId: wrightAir.id,
        notes: 'Tomorrow delivery',
      },
    }),
  ]);

  console.log(`  Created ${mailWai.length} Wright Air mail items`);

  // Create assignment audit records
  console.log('\nCreating assignment audit records...');

  const assignmentData = [];

  // Flight 1 assignments (Wright Air)
  for (let i = 0; i < 5; i++) {
    assignmentData.push({
      flightId: flight1Wai.id,
      resourceType: 'PASSENGER' as const,
      resourceId: passengersWai[i].id,
      createdBy: 'seed',
    });
  }
  for (let i = 0; i < 3; i++) {
    assignmentData.push({
      flightId: flight1Wai.id,
      resourceType: 'FREIGHT' as const,
      resourceId: freightWai[i].id,
      createdBy: 'seed',
    });
  }
  for (let i = 0; i < 3; i++) {
    assignmentData.push({
      flightId: flight1Wai.id,
      resourceType: 'MAIL' as const,
      resourceId: mailWai[i].id,
      createdBy: 'seed',
    });
  }

  // Flight 2 assignments (Wright Air)
  for (let i = 5; i < 9; i++) {
    assignmentData.push({
      flightId: flight2Wai.id,
      resourceType: 'PASSENGER' as const,
      resourceId: passengersWai[i].id,
      createdBy: 'seed',
    });
  }
  for (let i = 3; i < 6; i++) {
    assignmentData.push({
      flightId: flight2Wai.id,
      resourceType: 'FREIGHT' as const,
      resourceId: freightWai[i].id,
      createdBy: 'seed',
    });
  }
  for (let i = 3; i < 6; i++) {
    assignmentData.push({
      flightId: flight2Wai.id,
      resourceType: 'MAIL' as const,
      resourceId: mailWai[i].id,
      createdBy: 'seed',
    });
  }

  // Warbelow's flight assignments
  for (let i = 0; i < 2; i++) {
    assignmentData.push({
      flightId: flight1Wrb.id,
      resourceType: 'PASSENGER' as const,
      resourceId: passengersWrb[i].id,
      createdBy: 'seed',
    });
  }
  assignmentData.push({
    flightId: flight1Wrb.id,
    resourceType: 'FREIGHT' as const,
    resourceId: freightWrb[0].id,
    createdBy: 'seed',
  });
  assignmentData.push({
    flightId: flight2Wrb.id,
    resourceType: 'PASSENGER' as const,
    resourceId: passengersWrb[2].id,
    createdBy: 'seed',
  });

  await prisma.assignment.createMany({ data: assignmentData });

  console.log(`  Created ${assignmentData.length} assignment records`);

  console.log('\n' + '='.repeat(60));
  console.log('Database seeding completed!');
  console.log('='.repeat(60));
  console.log('\n=== OPERATORS ===');
  console.log(`  ${wrightAir.name} (${wrightAir.code})`);
  console.log(`  ${warbelows.name} (${warbelows.code})`);
  console.log('\n=== TEST ACCOUNTS === (all use password: password123)');
  console.log('  Super Admin (all operators): admin@sukakpak.com');
  console.log('\n  Wright Air:');
  console.log('    Admin:  admin@wrightair.com');
  console.log('    Ops:    ops@wrightair.com');
  console.log('    Pilots: john@wrightair.com, steve@wrightair.com');
  console.log("\n  Warbelow's:");
  console.log('    Admin:  admin@warbelows.com');
  console.log('    Ops:    ops@warbelows.com');
  console.log('    Pilot:  mike@warbelows.com');
  console.log('\n=== SUMMARY ===');
  console.log(`  Wright Air: 4 aircraft, 5 flights, 12 passengers, 8 freight, 8 mail`);
  console.log(`  Warbelow's: 2 aircraft, 2 flights, 3 passengers, 1 freight`);
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
