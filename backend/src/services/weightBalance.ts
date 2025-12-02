/**
 * Weight & Balance Calculator
 *
 * Deterministic W&B calculations for flight manifest validation.
 * All Claude-proposed assignments must pass validation through this module.
 */

import type {
  AircraftConfig,
  PassengerData,
  FreightData,
  MailData,
  WBResult,
  WBWarning,
  WeightItem,
  SeatConfig,
  BaggageCompartment,
} from '../types/index.js';

const STANDARD_PASSENGER_WEIGHT_KG = parseFloat(process.env.STANDARD_ADULT_WEIGHT_KG || '88');

interface WBCalculationInput {
  aircraft: AircraftConfig;
  pilotWeightKg: number;
  fuelWeightKg: number;
  passengers: PassengerData[];
  freight: FreightData[];
  mail: MailData[];
  // Optional: specific seat assignments (passengerId -> seatNumber)
  seatAssignments?: Map<number, number>;
  // Optional: specific compartment assignments (freightId -> compartmentName)
  compartmentAssignments?: Map<number, string>;
}

/**
 * Calculate Weight & Balance for a flight configuration
 */
export function calculateWeightBalance(input: WBCalculationInput): WBResult {
  const { aircraft, pilotWeightKg, fuelWeightKg, passengers, freight, mail } = input;

  const items: WeightItem[] = [];
  const warnings: WBWarning[] = [];
  const compartmentWeights: Record<string, { weight: number; capacity: number; arm: number }> = {};

  // Initialize compartment tracking
  for (const comp of aircraft.baggageCompartments) {
    compartmentWeights[comp.name] = {
      weight: 0,
      capacity: comp.capacityKg,
      arm: comp.arm,
    };
  }

  // 1. Aircraft empty weight
  const emptyWeightItem: WeightItem = {
    id: 'empty',
    type: 'empty',
    name: `Aircraft ${aircraft.tail} Empty`,
    weightKg: aircraft.emptyWeightKg,
    arm: aircraft.emptyWeightArm,
    moment: aircraft.emptyWeightKg * aircraft.emptyWeightArm,
  };
  items.push(emptyWeightItem);

  // 2. Pilot
  const pilotWeight = pilotWeightKg || aircraft.pilotStandardWeightKg;
  const pilotItem: WeightItem = {
    id: 'pilot',
    type: 'pilot',
    name: 'Pilot',
    weightKg: pilotWeight,
    arm: aircraft.pilotArm,
    moment: pilotWeight * aircraft.pilotArm,
  };
  items.push(pilotItem);

  // 3. Fuel
  const fuelItem: WeightItem = {
    id: 'fuel',
    type: 'fuel',
    name: 'Fuel',
    weightKg: fuelWeightKg,
    arm: aircraft.fuelTankArm,
    moment: fuelWeightKg * aircraft.fuelTankArm,
  };
  items.push(fuelItem);

  // 4. Passengers
  const seatAssignments = input.seatAssignments || autoAssignSeats(passengers, aircraft.seatConfiguration);

  for (const pax of passengers) {
    const paxWeight = getPassengerWeight(pax);
    const seatNum = seatAssignments.get(pax.id);
    const seatConfig = seatNum
      ? aircraft.seatConfiguration.find(s => s.seat === seatNum)
      : aircraft.seatConfiguration[0]; // Default to first seat if not assigned

    if (!seatConfig) {
      warnings.push({
        type: 'error',
        code: 'SEAT_NOT_FOUND',
        message: `No seat configuration found for passenger ${pax.name} (ID: ${pax.id})`,
      });
      continue;
    }

    const paxItem: WeightItem = {
      id: `pax-${pax.id}`,
      type: 'passenger',
      name: pax.name,
      weightKg: paxWeight,
      arm: seatConfig.arm,
      moment: paxWeight * seatConfig.arm,
      destination: pax.destination,
    };
    items.push(paxItem);

    // Check seat weight limit
    if (paxWeight > seatConfig.maxWeightKg) {
      warnings.push({
        type: 'warning',
        code: 'SEAT_OVERWEIGHT',
        message: `Passenger ${pax.name} (${paxWeight}kg) exceeds seat ${seatNum} limit (${seatConfig.maxWeightKg}kg)`,
      });
    }

    // Passenger baggage - goes to baggage compartment
    if (pax.bagsKg > 0) {
      const bagCompartment = findBestCompartment(pax.bagsKg, compartmentWeights, aircraft.baggageCompartments);
      if (bagCompartment) {
        const bagItem: WeightItem = {
          id: `bag-${pax.id}`,
          type: 'baggage',
          name: `${pax.name} Baggage`,
          weightKg: pax.bagsKg,
          arm: bagCompartment.arm,
          moment: pax.bagsKg * bagCompartment.arm,
          compartment: bagCompartment.name,
          destination: pax.destination,
        };
        items.push(bagItem);
        compartmentWeights[bagCompartment.name].weight += pax.bagsKg;
      } else {
        warnings.push({
          type: 'warning',
          code: 'BAGGAGE_OVERFLOW',
          message: `No compartment available for ${pax.name}'s baggage (${pax.bagsKg}kg)`,
        });
      }
    }
  }

  // 5. Freight
  const compartmentAssignments = input.compartmentAssignments || autoAssignCompartments(freight, compartmentWeights, aircraft.baggageCompartments);

  for (const item of freight) {
    const compartmentName = compartmentAssignments.get(item.id);
    const compartment = compartmentName
      ? aircraft.baggageCompartments.find(c => c.name === compartmentName)
      : findBestCompartment(item.weightKg, compartmentWeights, aircraft.baggageCompartments);

    if (!compartment) {
      warnings.push({
        type: 'error',
        code: 'NO_COMPARTMENT',
        message: `No compartment available for freight ${item.waybill || item.id} (${item.weightKg}kg)`,
      });
      continue;
    }

    const freightItem: WeightItem = {
      id: `freight-${item.id}`,
      type: 'freight',
      name: item.description || `Freight ${item.waybill || item.id}`,
      weightKg: item.weightKg,
      arm: compartment.arm,
      moment: item.weightKg * compartment.arm,
      compartment: compartment.name,
      destination: item.destination,
    };
    items.push(freightItem);
    compartmentWeights[compartment.name].weight += item.weightKg;
  }

  // 6. Mail
  for (const mailItem of mail) {
    const compartment = findBestCompartment(mailItem.weightKg, compartmentWeights, aircraft.baggageCompartments);

    if (!compartment) {
      warnings.push({
        type: 'error',
        code: 'NO_COMPARTMENT',
        message: `No compartment available for mail to ${mailItem.village} (${mailItem.weightKg}kg)`,
      });
      continue;
    }

    const mailWeightItem: WeightItem = {
      id: `mail-${mailItem.id}`,
      type: 'mail',
      name: `Mail - ${mailItem.village}`,
      weightKg: mailItem.weightKg,
      arm: compartment.arm,
      moment: mailItem.weightKg * compartment.arm,
      compartment: compartment.name,
      destination: mailItem.village,
    };
    items.push(mailWeightItem);
    compartmentWeights[compartment.name].weight += mailItem.weightKg;
  }

  // Calculate totals
  const totalWeightKg = items.reduce((sum, item) => sum + item.weightKg, 0);
  const totalMoment = items.reduce((sum, item) => sum + item.moment, 0);
  const cg = totalMoment / totalWeightKg;

  // Check constraints
  const isWithinMTOW = totalWeightKg <= aircraft.maxTakeoffKg;
  const isWithinCGEnvelope = cg >= aircraft.cgLimits.cgMin && cg <= aircraft.cgLimits.cgMax;

  // Add weight/CG warnings
  const weightMarginKg = aircraft.maxTakeoffKg - totalWeightKg;
  const weightPercentage = (totalWeightKg / aircraft.maxTakeoffKg) * 100;

  if (!isWithinMTOW) {
    warnings.push({
      type: 'error',
      code: 'OVERWEIGHT',
      message: `Aircraft is ${Math.abs(weightMarginKg).toFixed(1)}kg over MTOW (${totalWeightKg.toFixed(1)}kg / ${aircraft.maxTakeoffKg}kg)`,
    });
  } else if (weightPercentage > 95) {
    warnings.push({
      type: 'warning',
      code: 'NEAR_MAX_WEIGHT',
      message: `Aircraft at ${weightPercentage.toFixed(1)}% of MTOW (${totalWeightKg.toFixed(1)}kg / ${aircraft.maxTakeoffKg}kg)`,
    });
  }

  if (!isWithinCGEnvelope) {
    const direction = cg < aircraft.cgLimits.cgMin ? 'forward' : 'aft';
    warnings.push({
      type: 'error',
      code: 'CG_OUT_OF_ENVELOPE',
      message: `CG is out of envelope (${cg.toFixed(2)}) - too ${direction}. Limits: ${aircraft.cgLimits.cgMin} - ${aircraft.cgLimits.cgMax}`,
    });
  }

  // Check compartment overflows
  for (const [name, data] of Object.entries(compartmentWeights)) {
    if (data.weight > data.capacity) {
      warnings.push({
        type: 'error',
        code: 'COMPARTMENT_OVERFLOW',
        message: `Compartment ${name} is ${(data.weight - data.capacity).toFixed(1)}kg over capacity (${data.weight.toFixed(1)}kg / ${data.capacity}kg)`,
      });
    } else if (data.weight > data.capacity * 0.9) {
      warnings.push({
        type: 'warning',
        code: 'COMPARTMENT_NEAR_FULL',
        message: `Compartment ${name} is at ${((data.weight / data.capacity) * 100).toFixed(0)}% capacity`,
      });
    }
  }

  return {
    totalWeightKg,
    totalMoment,
    cg,
    isWithinMTOW,
    isWithinCGEnvelope,
    isValid: isWithinMTOW && isWithinCGEnvelope && !warnings.some(w => w.type === 'error'),
    mtow: aircraft.maxTakeoffKg,
    cgMin: aircraft.cgLimits.cgMin,
    cgMax: aircraft.cgLimits.cgMax,
    weightMarginKg,
    cgMarginForward: cg - aircraft.cgLimits.cgMin,
    cgMarginAft: aircraft.cgLimits.cgMax - cg,
    items,
    compartmentWeights,
    warnings,
  };
}

/**
 * Get effective passenger weight (actual or standard)
 */
function getPassengerWeight(passenger: PassengerData): number {
  if (passenger.weightKg !== null && !passenger.standardWeightUsed) {
    return passenger.weightKg;
  }
  return STANDARD_PASSENGER_WEIGHT_KG;
}

/**
 * Auto-assign passengers to seats for optimal CG
 * Strategy: Assign heavier passengers to seats closer to CG center,
 * and lighter passengers toward extremes if needed
 */
function autoAssignSeats(passengers: PassengerData[], seats: SeatConfig[]): Map<number, number> {
  const assignments = new Map<number, number>();

  // Sort passengers by weight (heaviest first)
  const sortedPassengers = [...passengers].sort((a, b) => {
    const weightA = getPassengerWeight(a);
    const weightB = getPassengerWeight(b);
    return weightB - weightA;
  });

  // Sort seats by arm (front to back typically)
  const sortedSeats = [...seats].sort((a, b) => a.arm - b.arm);
  const availableSeats = new Set(sortedSeats.map(s => s.seat));

  // Assign passengers from heaviest to lightest
  // Alternate front/back to help balance CG
  let frontIndex = 0;
  let backIndex = sortedSeats.length - 1;
  let useFront = true;

  for (const pax of sortedPassengers) {
    if (availableSeats.size === 0) break;

    let seatNum: number | undefined;

    if (useFront && frontIndex <= backIndex) {
      seatNum = sortedSeats[frontIndex].seat;
      frontIndex++;
    } else if (backIndex >= frontIndex) {
      seatNum = sortedSeats[backIndex].seat;
      backIndex--;
    }

    if (seatNum !== undefined && availableSeats.has(seatNum)) {
      assignments.set(pax.id, seatNum);
      availableSeats.delete(seatNum);
    }

    useFront = !useFront;
  }

  return assignments;
}

/**
 * Auto-assign freight to compartments
 * Strategy: Fill compartments evenly, prioritizing bypass/priority items
 */
function autoAssignCompartments(
  freight: FreightData[],
  currentWeights: Record<string, { weight: number; capacity: number; arm: number }>,
  compartments: BaggageCompartment[]
): Map<number, string> {
  const assignments = new Map<number, string>();

  // Sort freight by priority (bypass first) then by weight (heaviest first)
  const priorityOrder: Record<string, number> = { 'BYPASS': 0, 'PRIORITY': 1, 'STANDARD': 2 };
  const sortedFreight = [...freight].sort((a, b) => {
    const prioA = priorityOrder[a.priority] ?? 2;
    const prioB = priorityOrder[b.priority] ?? 2;
    if (prioA !== prioB) return prioA - prioB;
    return b.weightKg - a.weightKg;
  });

  // Clone weights for calculation
  const tempWeights = { ...currentWeights };

  for (const item of sortedFreight) {
    const bestCompartment = findBestCompartment(item.weightKg, tempWeights, compartments);
    if (bestCompartment) {
      assignments.set(item.id, bestCompartment.name);
      tempWeights[bestCompartment.name].weight += item.weightKg;
    }
  }

  return assignments;
}

/**
 * Find the best compartment for an item
 * Strategy: Find compartment with most remaining capacity that can fit the item
 */
function findBestCompartment(
  weightKg: number,
  currentWeights: Record<string, { weight: number; capacity: number; arm: number }>,
  compartments: BaggageCompartment[]
): BaggageCompartment | null {
  let bestCompartment: BaggageCompartment | null = null;
  let bestRemainingCapacity = -1;

  for (const comp of compartments) {
    const current = currentWeights[comp.name];
    if (!current) continue;

    const remaining = current.capacity - current.weight;
    if (remaining >= weightKg && remaining > bestRemainingCapacity) {
      bestCompartment = comp;
      bestRemainingCapacity = remaining;
    }
  }

  return bestCompartment;
}

/**
 * Calculate W&B for multiple legs (multi-stop flights)
 * Returns W&B at each leg's takeoff point
 */
export function calculateMultiLegWB(
  input: WBCalculationInput,
  legs: { leg: number; to: string }[]
): { leg: number; destination: string; wb: WBResult }[] {
  const results: { leg: number; destination: string; wb: WBResult }[] = [];

  let remainingPassengers = [...input.passengers];
  let remainingFreight = [...input.freight];
  let remainingMail = [...input.mail];

  for (const leg of legs) {
    // Calculate W&B with current load
    const legWB = calculateWeightBalance({
      ...input,
      passengers: remainingPassengers,
      freight: remainingFreight,
      mail: remainingMail,
    });

    results.push({
      leg: leg.leg,
      destination: leg.to,
      wb: legWB,
    });

    // Remove items destined for this leg
    remainingPassengers = remainingPassengers.filter(p => p.destination !== leg.to);
    remainingFreight = remainingFreight.filter(f => f.destination !== leg.to);
    remainingMail = remainingMail.filter(m => m.village !== leg.to);
  }

  return results;
}

/**
 * Validate a proposed assignment against W&B constraints
 */
export function validateAssignment(input: WBCalculationInput): {
  isValid: boolean;
  result: WBResult;
  errors: string[];
} {
  const result = calculateWeightBalance(input);
  const errors: string[] = [];

  if (!result.isWithinMTOW) {
    errors.push(`Overweight by ${Math.abs(result.weightMarginKg).toFixed(1)}kg`);
  }

  if (!result.isWithinCGEnvelope) {
    errors.push(`CG out of envelope: ${result.cg.toFixed(2)} (limits: ${result.cgMin}-${result.cgMax})`);
  }

  for (const warning of result.warnings) {
    if (warning.type === 'error') {
      errors.push(warning.message);
    }
  }

  return {
    isValid: errors.length === 0,
    result,
    errors,
  };
}

/**
 * Suggest weight reduction needed to become valid
 */
export function suggestWeightReduction(result: WBResult): {
  weightToRemove: number;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let weightToRemove = 0;

  if (!result.isWithinMTOW) {
    weightToRemove = Math.abs(result.weightMarginKg);

    // Find removable items (freight/mail, not passengers unless emergency)
    const removableItems = result.items
      .filter(i => i.type === 'freight' || i.type === 'mail')
      .sort((a, b) => b.weightKg - a.weightKg);

    let removed = 0;
    for (const item of removableItems) {
      if (removed >= weightToRemove) break;
      suggestions.push(`Consider removing ${item.name} (${item.weightKg}kg)`);
      removed += item.weightKg;
    }
  }

  return { weightToRemove, suggestions };
}

export default {
  calculateWeightBalance,
  calculateMultiLegWB,
  validateAssignment,
  suggestWeightReduction,
};
