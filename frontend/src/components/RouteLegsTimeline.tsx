import clsx from 'clsx';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  UserGroupIcon,
  TruckIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import type { RouteLeg, LegWBResult, Passenger, Freight, Mail } from '../types';

interface RouteLegsTimelineProps {
  origin: string;
  legs: RouteLeg[];
  legWeightBalance?: LegWBResult[];
  passengers: Passenger[];
  freight: Freight[];
  mail: Mail[];
  selectedLeg: number | null;
  onSelectLeg: (leg: number | null) => void;
}

/**
 * Helper to determine which leg an item exits
 */
function getItemExitLeg(
  destination: string,
  legNumber: number | null,
  legs: RouteLeg[]
): number {
  if (legNumber !== null) {
    return legNumber;
  }
  const matchingLeg = legs.find(
    (leg) => leg.to.toLowerCase() === destination.toLowerCase()
  );
  return matchingLeg?.leg || legs.length;
}

/**
 * RouteLegsTimeline - Visual timeline showing flight legs with W&B status
 */
export default function RouteLegsTimeline({
  origin,
  legs,
  legWeightBalance,
  passengers,
  freight,
  mail,
  selectedLeg,
  onSelectLeg,
}: RouteLegsTimelineProps) {
  // Calculate items per leg
  const getItemsForLeg = (legNum: number) => {
    const pax = passengers.filter(
      (p) => getItemExitLeg(p.destination, p.legNumber, legs) === legNum
    );
    const frt = freight.filter(
      (f) => getItemExitLeg(f.destination, f.legNumber, legs) === legNum
    );
    const ml = mail.filter(
      (m) => getItemExitLeg(m.village, m.legNumber, legs) === legNum
    );
    return { passengers: pax, freight: frt, mail: ml };
  };

  const getLegWB = (legNum: number) => {
    return legWeightBalance?.find((l) => l.leg === legNum);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Route Legs</h3>
        {selectedLeg !== null && (
          <button
            onClick={() => onSelectLeg(null)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Show all
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="flex items-start">
          {/* Origin */}
          <div className="flex flex-col items-center min-w-[80px]">
            <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium">
              O
            </div>
            <p className="mt-1 text-xs font-medium text-gray-700 text-center">
              {origin}
            </p>
          </div>

          {/* Legs */}
          {legs.map((leg, index) => {
            const legItems = getItemsForLeg(leg.leg);
            const legWB = getLegWB(leg.leg);
            const isSelected = selectedLeg === leg.leg;

            // Determine status based on W&B
            let status: 'ok' | 'warning' | 'error' = 'ok';
            if (legWB?.takeoffWB) {
              if (!legWB.takeoffWB.isValid) {
                status = 'error';
              } else if (legWB.takeoffWB.warnings?.some((w) => w.type === 'warning')) {
                status = 'warning';
              }
            }

            const totalItems =
              legItems.passengers.length +
              legItems.freight.length +
              legItems.mail.length;

            return (
              <div key={leg.leg} className="flex items-start flex-1">
                {/* Connecting line */}
                <div className="flex-1 flex items-center h-8">
                  <div
                    className={clsx('h-0.5 w-full', {
                      'bg-green-400': status === 'ok',
                      'bg-yellow-400': status === 'warning',
                      'bg-red-400': status === 'error',
                    })}
                  />
                </div>

                {/* Leg stop */}
                <button
                  onClick={() => onSelectLeg(isSelected ? null : leg.leg)}
                  className={clsx(
                    'flex flex-col items-center min-w-[100px] transition-all',
                    {
                      'scale-110': isSelected,
                    }
                  )}
                >
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                      {
                        'bg-green-100 border-green-500 text-green-700':
                          status === 'ok',
                        'bg-yellow-100 border-yellow-500 text-yellow-700':
                          status === 'warning',
                        'bg-red-100 border-red-500 text-red-700':
                          status === 'error',
                        'ring-2 ring-primary-500 ring-offset-2': isSelected,
                      }
                    )}
                  >
                    {status === 'ok' && (
                      <CheckCircleIcon className="h-5 w-5" />
                    )}
                    {status === 'warning' && (
                      <ExclamationTriangleIcon className="h-5 w-5" />
                    )}
                    {status === 'error' && <XCircleIcon className="h-5 w-5" />}
                  </div>

                  <p className="mt-1 text-xs font-medium text-gray-700 text-center">
                    {leg.to}
                  </p>
                  {leg.eta && (
                    <p className="text-xs text-gray-500">ETA: {leg.eta}</p>
                  )}

                  {/* Item counts */}
                  {totalItems > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      {legItems.passengers.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <UserGroupIcon className="h-3 w-3" />
                          {legItems.passengers.length}
                        </span>
                      )}
                      {legItems.freight.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <TruckIcon className="h-3 w-3" />
                          {legItems.freight.length}
                        </span>
                      )}
                      {legItems.mail.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <EnvelopeIcon className="h-3 w-3" />
                          {legItems.mail.length}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected leg details */}
      {selectedLeg !== null && legWeightBalance && (
        <div className="mt-4 pt-4 border-t">
          {(() => {
            const legWB = getLegWB(selectedLeg);
            const leg = legs.find((l) => l.leg === selectedLeg);
            if (!legWB || !leg) return null;

            return (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Leg {selectedLeg}: {origin} → {leg.to}
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Weight at takeoff:</span>
                    <p className="font-medium">
                      {legWB.takeoffWB.totalWeightKg.toFixed(0)} kg
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">CG:</span>
                    <p className="font-medium">
                      {legWB.takeoffWB.cg.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Margin:</span>
                    <p
                      className={clsx('font-medium', {
                        'text-green-600': legWB.takeoffWB.weightMarginKg >= 0,
                        'text-red-600': legWB.takeoffWB.weightMarginKg < 0,
                      })}
                    >
                      {legWB.takeoffWB.weightMarginKg >= 0 ? '+' : ''}
                      {legWB.takeoffWB.weightMarginKg.toFixed(0)} kg
                    </p>
                  </div>
                </div>

                {legWB.takeoffWB.warnings.length > 0 && (
                  <div className="mt-2">
                    {legWB.takeoffWB.warnings.map((warning, idx) => (
                      <p
                        key={idx}
                        className={clsx('text-xs', {
                          'text-red-600': warning.type === 'error',
                          'text-yellow-600': warning.type === 'warning',
                          'text-gray-600': warning.type === 'info',
                        })}
                      >
                        {warning.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
