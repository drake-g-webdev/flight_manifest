// ============================================
// Core Types for Flight Manifest Builder
// ============================================

// ---------- Aircraft Types ----------

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

export interface AircraftConfig {
  id: number;
  tail: string;
  type: string;
  maxTakeoffKg: number;
  emptyWeightKg: number;
  emptyWeightArm: number;
  pilotStandardWeightKg: number;
  pilotArm: number;
  cgLimits: CGLimits;
  seatConfiguration: SeatConfig[];
  baggageCompartments: BaggageCompartment[];
  fuelTankArm: number;
  seats: number;
}

// ---------- Flight Types ----------

export interface RouteLeg {
  leg: number;
  to: string;
  eta: string;
}

export type FlightStatus = 'DRAFT' | 'SCHEDULED' | 'DEPARTED' | 'CANCELLED';

export interface FlightData {
  id: number;
  flightDate: Date;
  flightNumber: string | null;
  origin: string;
  departureTime: Date | null;
  route: RouteLeg[];
  tailId: number;
  pilotName: string | null;
  pilotWeightKg: number | null;
  fuelWeightKg: number | null;
  status: FlightStatus;
  notes: string | null;
}

// ---------- Passenger Types ----------

export type PassengerPriority = 'NORMAL' | 'MEDICAL' | 'EVAC' | 'FIRST_CLASS';

export interface PassengerData {
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
}

// ---------- Freight Types ----------

export type FreightPriority = 'BYPASS' | 'PRIORITY' | 'STANDARD';

export interface FreightData {
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
}

// ---------- Mail Types ----------

export interface MailData {
  id: number;
  village: string;
  pounds: number;
  weightKg: number;
  priority: FreightPriority;
  assignedFlightId: number | null;
  notes: string | null;
}

// ---------- Weight & Balance Types ----------

export interface WeightItem {
  id: string;
  type: 'pilot' | 'passenger' | 'baggage' | 'freight' | 'mail' | 'fuel' | 'empty';
  name: string;
  weightKg: number;
  arm: number;
  moment: number;
  compartment?: string;
  destination?: string;
}

export interface WBResult {
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
  cgMarginForward: number;
  cgMarginAft: number;
  items: WeightItem[];
  compartmentWeights: Record<string, { weight: number; capacity: number; arm: number }>;
  warnings: WBWarning[];
}

export interface WBWarning {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

// ---------- Assignment & Optimization Types ----------

export type ResourceType = 'PASSENGER' | 'FREIGHT' | 'MAIL';

export interface FlightAssignment {
  flightId: number;
  passengerIds: number[];
  freightIds: number[];
  mailIds: number[];
  totalWeightKg: number;
  cg: number;
  seatAssignments?: Record<number, number>; // passengerId -> seatNumber
  compartmentAssignments?: Record<number, string>; // freightId -> compartmentName
}

export interface UnassignedItems {
  passengers: number[];
  freight: number[];
  mail: number[];
}

export interface Diagnostic {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  flightId?: number;
  itemId?: number;
  itemType?: ResourceType;
}

export interface AssignmentPlan {
  flightAssignments: FlightAssignment[];
  unassignedItems: UnassignedItems;
}

export interface OptimizationResult {
  status: 'ok' | 'infeasible' | 'error';
  assignmentPlan: AssignmentPlan;
  diagnostics: Diagnostic[];
  explanations: string;
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  priority: number;
  action: string;
  itemType: ResourceType;
  itemId: number;
  fromFlightId?: number;
  toFlightId?: number;
  reason: string;
}

// ---------- Manifest Types ----------

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

export interface ManifestWB {
  totalWeightKg: number;
  cg: number;
  mtow: number;
  withinEnvelope: boolean;
  cgMin: number;
  cgMax: number;
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
  wAndB: ManifestWB;
  warnings: string[];
  generatedAt: string;
  generatedBy: string;
  version: number;
}

// ---------- Claude Integration Types ----------

export interface ClaudeOptimizationInput {
  flights: ClaudeFlightInput[];
  passengers: ClaudePassengerInput[];
  freight: ClaudeFreightInput[];
  mail: ClaudeMailInput[];
  constraints: ClaudeConstraints;
}

export interface ClaudeFlightInput {
  flightId: number;
  tail: string;
  mtow: number;
  emptyWeight: number;
  emptyWeightArm: number;
  pilotWeight: number;
  pilotArm: number;
  fuelWeight: number;
  fuelArm: number;
  cgMin: number;
  cgMax: number;
  seats: number;
  seatArms: { seat: number; arm: number }[];
  compartments: { name: string; capacityKg: number; arm: number }[];
  route: RouteLeg[];
  currentPassengerIds: number[];
  currentFreightIds: number[];
  currentMailIds: number[];
}

export interface ClaudePassengerInput {
  id: number;
  name: string;
  weightKg: number;
  bagsKg: number;
  destination: string;
  priority: PassengerPriority;
  currentFlightId: number | null;
}

export interface ClaudeFreightInput {
  id: number;
  waybill: string;
  weightKg: number;
  destination: string;
  priority: FreightPriority;
  currentFlightId: number | null;
}

export interface ClaudeMailInput {
  id: number;
  village: string;
  weightKg: number;
  priority: FreightPriority;
  currentFlightId: number | null;
}

export interface ClaudeConstraints {
  standardPassengerWeightKg: number;
  priorityOrder: string[];
  bufferPercentage: number;
}

// ---------- API Request/Response Types ----------

export interface CreateFlightRequest {
  flightNumber?: string;
  flightDate: string;
  origin: string;
  departureTime?: string;
  route: RouteLeg[];
  tail: string;
  pilotName?: string;
  pilotWeightKg?: number;
  fuelWeightKg?: number;
  notes?: string;
}

export interface CreatePassengerRequest {
  bookingRef?: string;
  name: string;
  phone?: string;
  weightKg?: number;
  bagsKg?: number;
  destination: string;
  priority?: PassengerPriority;
  flightId?: number;
  notes?: string;
}

export interface CreateFreightRequest {
  waybill?: string;
  description?: string;
  weightKg: number;
  destination: string;
  volumeM3?: number;
  priority?: FreightPriority;
  assignedFlightId?: number;
  notes?: string;
}

export interface CreateMailRequest {
  village: string;
  pounds: number;
  priority?: FreightPriority;
  assignedFlightId?: number;
  notes?: string;
}

export interface OptimizeRequest {
  flightDate: string;
  flightIds?: number[];
  useClaudeOptimization?: boolean;
}

export interface GenerateManifestRequest {
  flightId: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

// ---------- User & Auth Types ----------

export type UserRole = 'ADMIN' | 'OPS' | 'PILOT';

export interface UserData {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserData;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  operatorId: number | null; // null = super admin (can access all operators)
  iat: number;
  exp: number;
}
