import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  XMarkIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { flightsApi, aircraftApi } from '../services/api';
import type { FlightSummary, Aircraft, RouteLeg } from '../types';

interface FlightFormData {
  flightNumber: string;
  flightDate: string;
  origin: string;
  departureTime: string;
  tail: string;
  pilotName: string;
  pilotWeightKg: string;
  fuelWeightKg: string;
  route: { to: string; eta: string }[];
  notes: string;
}

const emptyFormData: FlightFormData = {
  flightNumber: '',
  flightDate: format(new Date(), 'yyyy-MM-dd'),
  origin: 'Fairbanks',
  departureTime: '08:00',
  tail: '',
  pilotName: '',
  pilotWeightKg: '',
  fuelWeightKg: '',
  route: [{ to: '', eta: '' }],
  notes: '',
};

export default function Flights() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('new') === 'true';

  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FlightFormData>(emptyFormData);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [flightsRes, aircraftRes] = await Promise.all([
        flightsApi.list(),
        aircraftApi.list(),
      ]);

      if (flightsRes.success) setFlights(flightsRes.data || []);
      if (aircraftRes.success) setAircraft(aircraftRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FlightFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRouteChange = (index: number, field: 'to' | 'eta', value: string) => {
    setFormData(prev => ({
      ...prev,
      route: prev.route.map((leg, i) =>
        i === index ? { ...leg, [field]: value } : leg
      ),
    }));
  };

  const addRouteLeg = () => {
    setFormData(prev => ({
      ...prev,
      route: [...prev.route, { to: '', eta: '' }],
    }));
  };

  const removeRouteLeg = (index: number) => {
    if (formData.route.length > 1) {
      setFormData(prev => ({
        ...prev,
        route: prev.route.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tail) {
      toast.error('Please select an aircraft');
      return;
    }

    if (!formData.route[0].to) {
      toast.error('Please add at least one destination');
      return;
    }

    setSaving(true);
    try {
      const routeData: RouteLeg[] = formData.route
        .filter(leg => leg.to)
        .map((leg, index) => ({
          leg: index + 1,
          to: leg.to,
          eta: leg.eta || '',
        }));

      const payload = {
        flightNumber: formData.flightNumber || undefined,
        flightDate: formData.flightDate,
        origin: formData.origin,
        departureTime: formData.departureTime
          ? `${formData.flightDate}T${formData.departureTime}:00`
          : undefined,
        tail: formData.tail,
        pilotName: formData.pilotName || undefined,
        pilotWeightKg: formData.pilotWeightKg ? parseFloat(formData.pilotWeightKg) : undefined,
        fuelWeightKg: formData.fuelWeightKg ? parseFloat(formData.fuelWeightKg) : undefined,
        route: routeData,
        notes: formData.notes || undefined,
      };

      const res = await flightsApi.create(payload);
      if (res.success) {
        toast.success('Flight created successfully');
        setShowModal(false);
        setFormData(emptyFormData);
        loadData();
        navigate('/');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to create flight';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openModal = () => {
    setFormData({
      ...emptyFormData,
      flightDate: format(new Date(), 'yyyy-MM-dd'),
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flights</h1>
          <p className="text-gray-600">Manage all scheduled flights</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Add Flight
        </button>
      </div>

      {/* Flights List */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : flights.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No flights found. Create your first flight to get started.
          </div>
        ) : (
          <div className="divide-y">
            {flights.map(flight => (
              <div
                key={flight.id}
                onClick={() => navigate(`/flights/${flight.id}`)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <PaperAirplaneIcon className="h-5 w-5 text-gray-400" />
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
                        {format(new Date(flight.flightDate), 'MMM d, yyyy')} • {flight.tail} ({flight.aircraftType})
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{flight.passengerCount}</p>
                      <p className="text-gray-500">Pax</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{flight.totalWeightKg.toFixed(0)} kg</p>
                      <p className="text-gray-500">Weight</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">{flight.origin}</span>
                  {flight.route.map((leg, idx) => (
                    <span key={idx}> → {leg.to}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Flight Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Create New Flight</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Flight Number (optional)</label>
                  <input
                    type="text"
                    value={formData.flightNumber}
                    onChange={e => handleInputChange('flightNumber', e.target.value)}
                    className="input"
                    placeholder="e.g., SKK-101"
                  />
                </div>
                <div>
                  <label className="label">Flight Date *</label>
                  <input
                    type="date"
                    value={formData.flightDate}
                    onChange={e => handleInputChange('flightDate', e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Origin *</label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={e => handleInputChange('origin', e.target.value)}
                    className="input"
                    placeholder="e.g., Fairbanks"
                    required
                  />
                </div>
                <div>
                  <label className="label">Departure Time</label>
                  <input
                    type="time"
                    value={formData.departureTime}
                    onChange={e => handleInputChange('departureTime', e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Aircraft *</label>
                <select
                  value={formData.tail}
                  onChange={e => handleInputChange('tail', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select aircraft...</option>
                  {aircraft.map(a => (
                    <option key={a.id} value={a.tail}>
                      {a.tail} - {a.type} ({a.seats} seats)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Pilot Name</label>
                  <input
                    type="text"
                    value={formData.pilotName}
                    onChange={e => handleInputChange('pilotName', e.target.value)}
                    className="input"
                    placeholder="Pilot name"
                  />
                </div>
                <div>
                  <label className="label">Pilot Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.pilotWeightKg}
                    onChange={e => handleInputChange('pilotWeightKg', e.target.value)}
                    className="input"
                    placeholder="90"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="label">Fuel Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.fuelWeightKg}
                    onChange={e => handleInputChange('fuelWeightKg', e.target.value)}
                    className="input"
                    placeholder="200"
                    step="0.1"
                  />
                </div>
              </div>

              {/* Route */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Route *</label>
                  <button
                    type="button"
                    onClick={addRouteLeg}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + Add leg
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.route.map((leg, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-8">→</span>
                      <input
                        type="text"
                        value={leg.to}
                        onChange={e => handleRouteChange(index, 'to', e.target.value)}
                        className="input flex-1"
                        placeholder={`Destination ${index + 1}`}
                      />
                      <input
                        type="time"
                        value={leg.eta}
                        onChange={e => handleRouteChange(index, 'eta', e.target.value)}
                        className="input w-32"
                        placeholder="ETA"
                      />
                      {formData.route.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRouteLeg(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => handleInputChange('notes', e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Creating...' : 'Create Flight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
