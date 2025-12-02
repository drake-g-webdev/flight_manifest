// Shared types for frontend

export type FlightStatus = 'DRAFT' | 'SCHEDULED' | 'DEPARTED' | 'CANCELLED';
export type PassengerPriority = 'NORMAL' | 'MEDICAL' | 'EVAC' | 'FIRST_CLASS';
export type FreightPriority = 'BYPASS' | 'PRIORITY' | 'STANDARD';
export type UserRole = 'ADMIN' | 'OPS' | 'PILOT';

export interface Station {
  id: number;
  code: string;
  name: string;
  icao?: string;
  timezone: string;
  isActive: boolean;
  isMainBase: boolean;
  address?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StationWithCounts extends Station {
  _count?: {
    aircraft: number;
    users: number;
    flightsFrom: number;
  };
}

export interface Operator {
  id: number;
  code: string;
  name: string;
  shortName: string | null;
  primaryColor: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  operatorId: number | null;
  operator: Operator | null;
}

export interface RouteLeg {
  leg: number;
  to: string;
  eta: string;
}

export interface CGLimits {
  cgMin: number;
  cgMax: number;
}

export interface SeatConfig {
  seat: number;
  arm: number;
  maxWeightKg: number;
}

export interface BaggageCompartment {
  name: string;
  capacityKg: number;
  arm: number;
}

export type MaintenanceStatus =
  | 'OPERATIONAL'
  | 'SCHEDULED_MAINTENANCE'
  | 'IN_MAINTENANCE'
  | 'AOG'
  | 'INSPECTION_DUE';

export type MaintenanceType =
  | 'ANNUAL_INSPECTION'
  | 'HUNDRED_HOUR'
  | 'PHASE_CHECK'
  | 'UNSCHEDULED'
  | 'AD_COMPLIANCE'
  | 'SB_COMPLIANCE'
  | 'COMPONENT_REPLACEMENT'
  | 'OIL_CHANGE'
  | 'TIRE_CHANGE'
  | 'OTHER';

export interface Aircraft {
  id: number;
  tail: string;
  type: string;
  maxTakeoffKg: number;
  emptyWeightKg: number;
  seats: number;
  cgLimits: CGLimits;
  seatConfiguration: SeatConfig[];
  baggageCompartments: BaggageCompartment[];
}

export interface AircraftWithMaintenance extends Aircraft {
  emptyWeightArm?: number;
  pilotStandardWeightKg?: number;
  pilotArm?: number;
  fuelTankArm?: number;
  maintenanceStatus: MaintenanceStatus;
  lastInspectionDate?: string;
  nextInspectionDue?: string;
  totalFlightHours?: number;
  hoursToNextService?: number;
  maintenanceNotes?: string;
  isActive: boolean;
  currentStationId?: number;
  homeStationId?: number;
  currentStation?: {
    id: number;
    code: string;
    name: string;
  };
}

export interface MaintenanceLog {
  id: number;
  aircraftId: number;
  type: MaintenanceType;
  description: string;
  performedBy: string;
  performedAt: string;
  hoursAtService?: number;
  cost?: number;
  nextDueHours?: number;
  nextDueDate?: string;
  workOrderNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface FlightSummary {
  id: number;
  flightDate: string;
  flightNumber: string | null;
  origin: string;
  departureTime: string | null;
  route: RouteLeg[];
  tail: string;
  aircraftType: string;
  pilotName: string | null;
  status: FlightStatus;
  passengerCount: number;
  freightCount: number;
  mailCount: number;
  totalWeightKg: number;
  cg: number;
  wbStatus: 'ok' | 'warning' | 'error';
  wbWarnings: WBWarning[];
}

export interface WBWarning {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface WeightBalance {
  totalWeightKg: number;
  totalMoment: number;
  cg: number;
  isWithinMTOW: boolean;
  isWithinCGEnvelope: boolean;
  isValid: boolean;
  mtow: number;
  cgMin: number;
  cgMax: number;
  weightMarginKg: number;
  warnings: WBWarning[];
}

export interface FlightDetail {
  id: number;
  flightDate: string;
  flightNumber: string | null;
  origin: string;
  departureTime: string | null;
  route: RouteLeg[];
  status: FlightStatus;
  pilotName: string | null;
  pilotWeightKg: number | null;
  fuelWeightKg: number | null;
  notes: string | null;
  aircraft: Aircraft;
  passengers: Passenger[];
  freight: Freight[];
  mail: Mail[];
  weightBalance: WeightBalance;
  latestManifest: Manifest | null;
}

export interface Passenger {
  id: number;
  bookingRef: string | null;
  name: string;
  phone: string | null;
  weightKg: number | null;
  standardWeightUsed: boolean;
  bagsKg: number;
  destination: string;
  priority: PassengerPriority;
  seatNumber: number | null;
  flightId: number | null;
  notes: string | null;
  weightTicketPath: string | null;
  weightTicketDate: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  flight?: {
    id: number;
    flightNumber: string | null;
    flightDate: string;
  };
}

export interface Freight {
  id: number;
  waybill: string | null;
  description: string | null;
  weightKg: number;
  destination: string;
  volumeM3: number | null;
  priority: FreightPriority;
  compartment: string | null;
  assignedFlightId: number | null;
  notes: string | null;
  assignedFlight?: {
    id: number;
    flightNumber: string | null;
    flightDate: string;
  };
}

export interface Mail {
  id: number;
  village: string;
  pounds: number;
  weightKg: number;
  priority: FreightPriority;
  assignedFlightId: number | null;
  notes: string | null;
  assignedFlight?: {
    id: number;
    flightNumber: string | null;
    flightDate: string;
  };
}

export interface Manifest {
  id: number;
  flightId: number;
  manifestJson: ManifestJSON;
  pdfPath: string | null;
  generatedBy: string;
  version: number;
  isActive: boolean;
  signedBy: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface ManifestJSON {
  manifestId: string;
  flightId: number;
  flightNumber: string;
  flightDate: string;
  tail: string;
  aircraftType: string;
  pilot: string;
  origin: string;
  route: RouteLeg[];
  passengers: ManifestPassenger[];
  freight: ManifestFreight[];
  mail: ManifestMail[];
  totals: {
    passengerCount: number;
    passengerWeightKg: number;
    baggageWeightKg: number;
    freightWeightKg: number;
    mailWeightKg: number;
    fuelWeightKg: number;
    totalPayloadKg: number;
  };
  wAndB: {
    totalWeightKg: number;
    cg: number;
    mtow: number;
    withinEnvelope: boolean;
    cgMin: number;
    cgMax: number;
  };
  warnings: string[];
  generatedAt: string;
  generatedBy: string;
  version: number;
}

export interface ManifestPassenger {
  seat: number;
  name: string;
  weightKg: number;
  bagsKg: number;
  destination: string;
  priority: PassengerPriority;
}

export interface ManifestFreight {
  waybill: string;
  description: string;
  weightKg: number;
  destination: string;
  compartment: string;
}

export interface ManifestMail {
  village: string;
  pounds: number;
  weightKg: number;
}

export interface FlightAssignment {
  flightId: number;
  passengerIds: number[];
  freightIds: number[];
  mailIds: number[];
  totalWeightKg: number;
  cg: number;
}

export interface OptimizationResult {
  status: 'ok' | 'infeasible' | 'error';
  assignmentPlan: {
    flightAssignments: FlightAssignment[];
    unassignedItems: {
      passengers: number[];
      freight: number[];
      mail: number[];
    };
  };
  diagnostics: {
    type: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    flightId?: number;
    itemId?: number;
  }[];
  explanations: string;
  meta?: {
    flightCount: number;
    passengerCount: number;
    freightCount: number;
    mailCount: number;
    durationMs: number;
    usedClaude: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}
