import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  CalendarIcon,
  UserGroupIcon,
  TruckIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  PlayIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import { flightsApi, passengersApi, freightApi, mailApi, optimizeApi, manifestsApi } from '../services/api';
import { useOperatorStore } from '../store/operatorStore';
import type { FlightSummary, Passenger, Freight, Mail } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedOperator } = useOperatorStore();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [unassignedPassengers, setUnassignedPassengers] = useState<Passenger[]>([]);
  const [unassignedFreight, setUnassignedFreight] = useState<Freight[]>([]);
  const [unassignedMail, setUnassignedMail] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [generatingManifests, setGeneratingManifests] = useState(false);

  useEffect(() => {
    if (selectedOperator) {
      loadData();
    }
  }, [selectedDate, selectedOperator?.id]);

  const loadData = async () => {
    if (!selectedOperator) return;

    setLoading(true);
    try {
      const [flightsRes, passengersRes, freightRes, mailRes] = await Promise.all([
        flightsApi.list({ date: selectedDate, operatorId: selectedOperator.id }),
        passengersApi.list({ unassigned: true, operatorId: selectedOperator.id }),
        freightApi.list({ unassigned: true, operatorId: selectedOperator.id }),
        mailApi.list({ unassigned: true, operatorId: selectedOperator.id }),
      ]);

      if (flightsRes.success) setFlights(flightsRes.data || []);
      if (passengersRes.success) setUnassignedPassengers(passengersRes.data || []);
      if (freightRes.success) setUnassignedFreight(freightRes.data || []);
      if (mailRes.success) setUnassignedMail(mailRes.data || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousDay = () => {
    const date = new Date(selectedDate);
    setSelectedDate(format(addDays(date, -1), 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    setSelectedDate(format(addDays(date, 1), 'yyyy-MM-dd'));
  };

  const handleRunOptimization = async () => {
    setOptimizing(true);
    try {
      const res = await optimizeApi.run(selectedDate, true);
      if (res.success && res.data) {
        if (res.data.status === 'ok') {
          toast.success('Optimization completed successfully!');
        } else {
          toast.error(`Optimization: ${res.data.status}`);
        }
        loadData();
      }
    } catch (error) {
      toast.error('Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const handleGenerateManifests = async () => {
    setGeneratingManifests(true);
    try {
      const res = await manifestsApi.generateBatch(selectedDate);
      if (res.success && res.data) {
        toast.success(`Generated ${res.data.successful} of ${res.data.totalFlights} manifests`);
        loadData();
        // Navigate to manifests page to view/download with the selected date
        if (res.data.successful > 0) {
          navigate(`/manifests?date=${selectedDate}`);
        }
      }
    } catch (error) {
      toast.error('Failed to generate manifests');
    } finally {
      setGeneratingManifests(false);
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
    }
  };

  const totalUnassigned = unassignedPassengers.length + unassignedFreight.length + unassignedMail.length;
  const flightsWithIssues = flights.filter(f => f.wbStatus !== 'ok').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedOperator?.shortName || selectedOperator?.name || 'Dashboard'}
          </h1>
          <p className="text-gray-600">
            {selectedOperator ? `Manage flights and manifests for ${selectedOperator.name}` : 'Select an operator'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={handlePreviousDay} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="border-none focus:ring-0 text-sm font-medium"
              />
            </div>
            <button onClick={handleNextDay} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          <button onClick={handleRunOptimization} disabled={optimizing} className="btn-primary flex items-center gap-2">
            <PlayIcon className="h-5 w-5" />
            {optimizing ? 'Optimizing...' : 'Run Optimizer'}
          </button>

          <button onClick={handleGenerateManifests} disabled={generatingManifests} className="btn-success flex items-center gap-2">
            <DocumentArrowDownIcon className="h-5 w-5" />
            {generatingManifests ? 'Generating...' : 'Generate Manifests'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{flights.length}</p>
              <p className="text-sm text-gray-600">Flights</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{flightsWithIssues}</p>
              <p className="text-sm text-gray-600">With Issues</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalUnassigned}</p>
              <p className="text-sm text-gray-600">Unassigned Items</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{flights.filter(f => f.wbStatus === 'ok').length}</p>
              <p className="text-sm text-gray-600">Ready Flights</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Flights List */}
        <div className="col-span-2">
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Flights for {format(new Date(selectedDate), 'MMMM d, yyyy')}</h2>
              <Link to="/flights?new=true" className="btn-secondary text-sm flex items-center gap-1">
                <PlusIcon className="h-4 w-4" />
                Add Flight
              </Link>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : flights.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No flights scheduled for this date</div>
            ) : (
              <div className="divide-y">
                {flights.map(flight => (
                  <Link
                    key={flight.id}
                    to={`/flights/${flight.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(flight.wbStatus)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {flight.flightNumber || `Flight ${flight.id}`}
                            </span>
                            <span className={clsx('status-badge', {
                              'status-draft': flight.status === 'DRAFT',
                              'status-ok': flight.status === 'SCHEDULED',
                              'status-warning': flight.status === 'DEPARTED',
                              'status-error': flight.status === 'CANCELLED',
                            })}>
                              {flight.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {flight.tail} ({flight.aircraftType}) • {flight.pilotName || 'No pilot'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-medium">{flight.passengerCount}</p>
                          <p className="text-gray-500">Pax</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium">{flight.freightCount}</p>
                          <p className="text-gray-500">Freight</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium">{flight.mailCount}</p>
                          <p className="text-gray-500">Mail</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium">{flight.totalWeightKg.toFixed(0)} kg</p>
                          <p className="text-gray-500">Weight</p>
                        </div>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">{flight.origin}</span>
                      {flight.route.map((leg, idx) => (
                        <span key={idx}> → {leg.to}</span>
                      ))}
                    </div>

                    {/* Warnings */}
                    {flight.wbWarnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {flight.wbWarnings.slice(0, 2).map((warning, idx) => (
                          <p key={idx} className={clsx('text-xs', {
                            'text-red-600': warning.type === 'error',
                            'text-yellow-600': warning.type === 'warning',
                            'text-gray-600': warning.type === 'info',
                          })}>
                            {warning.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Unassigned Items */}
        <div className="space-y-4">
          {/* Unassigned Passengers */}
          <div className="card">
            <div className="flex items-center gap-2 p-4 border-b">
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold">Unassigned Passengers</h3>
              <span className="ml-auto text-sm text-gray-500">{unassignedPassengers.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {unassignedPassengers.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No unassigned passengers</p>
              ) : (
                <div className="divide-y">
                  {unassignedPassengers.map(pax => (
                    <div key={pax.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className={clsx('font-medium', {
                          'priority-medical': pax.priority === 'MEDICAL',
                          'priority-evac': pax.priority === 'EVAC',
                        })}>
                          {pax.name}
                        </span>
                        <span className="text-gray-500">{pax.destination}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unassigned Freight */}
          <div className="card">
            <div className="flex items-center gap-2 p-4 border-b">
              <TruckIcon className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold">Unassigned Freight</h3>
              <span className="ml-auto text-sm text-gray-500">{unassignedFreight.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {unassignedFreight.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No unassigned freight</p>
              ) : (
                <div className="divide-y">
                  {unassignedFreight.map(item => (
                    <div key={item.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className={clsx('font-medium', {
                          'priority-bypass': item.priority === 'BYPASS',
                        })}>
                          {item.waybill || `Freight ${item.id}`}
                        </span>
                        <span className="text-gray-500">{item.weightKg} kg</span>
                      </div>
                      <p className="text-gray-500">{item.destination}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unassigned Mail */}
          <div className="card">
            <div className="flex items-center gap-2 p-4 border-b">
              <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold">Unassigned Mail</h3>
              <span className="ml-auto text-sm text-gray-500">{unassignedMail.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {unassignedMail.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No unassigned mail</p>
              ) : (
                <div className="divide-y">
                  {unassignedMail.map(item => (
                    <div key={item.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.village}</span>
                        <span className="text-gray-500">{item.pounds} lbs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
