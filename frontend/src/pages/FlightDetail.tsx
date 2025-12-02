import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ArrowLeftIcon,
  UserGroupIcon,
  TruckIcon,
  EnvelopeIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';
import { flightsApi, manifestsApi } from '../services/api';
import type { FlightDetail as FlightDetailType } from '../types';

export default function FlightDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [flight, setFlight] = useState<FlightDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (id) {
      loadFlight(parseInt(id));
    }
  }, [id]);

  const loadFlight = async (flightId: number) => {
    setLoading(true);
    try {
      const res = await flightsApi.get(flightId);
      if (res.success && res.data) {
        setFlight(res.data);
      } else {
        toast.error('Flight not found');
        navigate('/');
      }
    } catch (error) {
      toast.error('Failed to load flight');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateManifest = async () => {
    if (!flight) return;
    setGenerating(true);
    try {
      const res = await manifestsApi.generate(flight.id);
      if (res.success) {
        toast.success('Manifest generated successfully');
        loadFlight(flight.id);
      }
    } catch (error) {
      toast.error('Failed to generate manifest');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (flight?.latestManifest) {
      window.open(manifestsApi.getPdfUrl(flight.latestManifest.id), '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading flight details...</p>
      </div>
    );
  }

  if (!flight) {
    return null;
  }

  const wb = flight.weightBalance;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {flight.flightNumber || `Flight ${flight.id}`}
            </h1>
            <p className="text-gray-600">
              {flight.aircraft.tail} ({flight.aircraft.type}) • {flight.pilotName || 'No pilot assigned'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleGenerateManifest} disabled={generating} className="btn-primary flex items-center gap-2">
            <DocumentArrowDownIcon className="h-5 w-5" />
            {generating ? 'Generating...' : 'Generate Manifest'}
          </button>
          {flight.latestManifest && (
            <button onClick={handleDownloadPdf} className="btn-secondary flex items-center gap-2">
              Download PDF
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Flight Info */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Flight Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Origin</label>
                <p className="font-medium">{flight.origin}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Date</label>
                <p className="font-medium">{flight.flightDate.split('T')[0]}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Departure Time</label>
                <p className="font-medium">{flight.departureTime?.split('T')[1]?.substring(0, 5) || 'TBD'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p className={clsx('font-medium', {
                  'text-gray-600': flight.status === 'DRAFT',
                  'text-green-600': flight.status === 'SCHEDULED',
                  'text-blue-600': flight.status === 'DEPARTED',
                  'text-red-600': flight.status === 'CANCELLED',
                })}>{flight.status}</p>
              </div>
            </div>

            {/* Route */}
            <div className="mt-4">
              <label className="text-sm text-gray-500">Route</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{flight.origin}</span>
                {flight.route.map((leg, idx) => (
                  <span key={idx} className="flex items-center gap-2">
                    <span className="text-gray-400">→</span>
                    <span className="font-medium">{leg.to}</span>
                    <span className="text-sm text-gray-500">({leg.eta})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Passengers */}
          <div className="card">
            <div className="flex items-center gap-2 p-4 border-b">
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold">Passengers</h2>
              <span className="ml-auto text-sm text-gray-500">{flight.passengers.length} / {flight.aircraft.seats}</span>
            </div>
            {flight.passengers.length === 0 ? (
              <p className="p-4 text-gray-500">No passengers assigned</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Seat</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Weight</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Bags</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Destination</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {flight.passengers.map(pax => (
                    <tr key={pax.id}>
                      <td className="px-4 py-2 text-sm">{pax.seatNumber || '-'}</td>
                      <td className="px-4 py-2 text-sm font-medium">{pax.name}</td>
                      <td className="px-4 py-2 text-sm">
                        {pax.weightKg || 88} kg
                        {pax.standardWeightUsed && <span className="text-xs text-gray-400 ml-1">(std)</span>}
                      </td>
                      <td className="px-4 py-2 text-sm">{pax.bagsKg} kg</td>
                      <td className="px-4 py-2 text-sm">{pax.destination}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={clsx({
                          'priority-medical': pax.priority === 'MEDICAL',
                          'priority-evac': pax.priority === 'EVAC',
                          'priority-first_class': pax.priority === 'FIRST_CLASS',
                        })}>
                          {pax.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Freight */}
          <div className="card">
            <div className="flex items-center gap-2 p-4 border-b">
              <TruckIcon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold">Freight</h2>
              <span className="ml-auto text-sm text-gray-500">{flight.freight.length} items</span>
            </div>
            {flight.freight.length === 0 ? (
              <p className="p-4 text-gray-500">No freight assigned</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Waybill</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Weight</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Destination</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Compartment</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {flight.freight.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm font-medium">{item.waybill || '-'}</td>
                      <td className="px-4 py-2 text-sm">{item.description || '-'}</td>
                      <td className="px-4 py-2 text-sm">{item.weightKg} kg</td>
                      <td className="px-4 py-2 text-sm">{item.destination}</td>
                      <td className="px-4 py-2 text-sm">{item.compartment || '-'}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={clsx({ 'priority-bypass': item.priority === 'BYPASS' })}>
                          {item.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Mail */}
          <div className="card">
            <div className="flex items-center gap-2 p-4 border-b">
              <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold">Mail</h2>
              <span className="ml-auto text-sm text-gray-500">{flight.mail.length} bags</span>
            </div>
            {flight.mail.length === 0 ? (
              <p className="p-4 text-gray-500">No mail assigned</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Village</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Pounds</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Weight (kg)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {flight.mail.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm font-medium">{item.village}</td>
                      <td className="px-4 py-2 text-sm">{item.pounds} lbs</td>
                      <td className="px-4 py-2 text-sm">{item.weightKg.toFixed(1)} kg</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={clsx({ 'priority-bypass': item.priority === 'BYPASS' })}>
                          {item.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar - Weight & Balance */}
        <div className="space-y-6">
          {/* W&B Summary */}
          <div className={clsx('card p-6', {
            'border-green-300 bg-green-50': wb.isValid,
            'border-red-300 bg-red-50': !wb.isValid,
          })}>
            <div className="flex items-center gap-2 mb-4">
              <ScaleIcon className="h-5 w-5" />
              <h2 className="font-semibold">Weight & Balance</h2>
              {wb.isValid ? (
                <CheckCircleIcon className="ml-auto h-5 w-5 text-green-600" />
              ) : (
                <XCircleIcon className="ml-auto h-5 w-5 text-red-600" />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Weight</span>
                <span className="font-medium">{wb.totalWeightKg.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">MTOW</span>
                <span className="font-medium">{wb.mtow} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Weight Margin</span>
                <span className={clsx('font-medium', {
                  'text-green-600': wb.weightMarginKg >= 0,
                  'text-red-600': wb.weightMarginKg < 0,
                })}>
                  {wb.weightMarginKg >= 0 ? '+' : ''}{wb.weightMarginKg.toFixed(1)} kg
                </span>
              </div>

              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full', {
                    'bg-green-500': wb.isWithinMTOW,
                    'bg-red-500': !wb.isWithinMTOW,
                  })}
                  style={{ width: `${Math.min(100, (wb.totalWeightKg / wb.mtow) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                {((wb.totalWeightKg / wb.mtow) * 100).toFixed(1)}% of MTOW
              </p>

              <hr className="my-3" />

              <div className="flex justify-between">
                <span className="text-sm text-gray-600">CG</span>
                <span className="font-medium">{wb.cg.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">CG Limits</span>
                <span className="font-medium">{wb.cgMin} - {wb.cgMax}</span>
              </div>

              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-green-200"
                  style={{
                    left: '0%',
                    right: '0%',
                  }}
                />
                <div
                  className={clsx('absolute w-2 h-full rounded-full', {
                    'bg-green-600': wb.isWithinCGEnvelope,
                    'bg-red-600': !wb.isWithinCGEnvelope,
                  })}
                  style={{
                    left: `${Math.max(0, Math.min(100, ((wb.cg - wb.cgMin) / (wb.cgMax - wb.cgMin)) * 100))}%`,
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Warnings */}
          {wb.warnings.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold mb-3">Warnings</h3>
              <div className="space-y-2">
                {wb.warnings.map((warning, idx) => (
                  <div key={idx} className={clsx('flex items-start gap-2 text-sm', {
                    'text-red-600': warning.type === 'error',
                    'text-yellow-600': warning.type === 'warning',
                    'text-gray-600': warning.type === 'info',
                  })}>
                    {warning.type === 'error' && <XCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                    {warning.type === 'warning' && <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                    {warning.type === 'info' && <CheckCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest Manifest */}
          {flight.latestManifest && (
            <div className="card p-4">
              <h3 className="font-semibold mb-3">Latest Manifest</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Version</span>
                  <span className="font-medium">v{flight.latestManifest.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Generated</span>
                  <span className="font-medium">
                    {new Date(flight.latestManifest.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">By</span>
                  <span className="font-medium">{flight.latestManifest.generatedBy}</span>
                </div>
                {flight.latestManifest.signedBy && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Signed by</span>
                    <span className="font-medium">{flight.latestManifest.signedBy}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
