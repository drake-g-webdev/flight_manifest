import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  XMarkIcon,
  ScaleIcon,
  CameraIcon,
  CheckCircleIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { passengersApi, flightsApi } from '../services/api';
import type { Passenger, FlightSummary } from '../types';

export default function Passengers() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInPassenger, setCheckInPassenger] = useState<Passenger | null>(null);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [filter, setFilter] = useState<'all' | 'unassigned'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    destination: '',
    bookingRef: '',
    phone: '',
    weightKg: '',
    bagsKg: '0',
    priority: 'NORMAL',
    flightId: '',
    notes: '',
  });

  // Check-in form state
  const [checkInForm, setCheckInForm] = useState({
    weightKg: '',
    bagsKg: '',
    weightTicketFile: null as File | null,
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [passengersRes, flightsRes] = await Promise.all([
        passengersApi.list({ unassigned: filter === 'unassigned' }),
        flightsApi.list(),
      ]);
      if (passengersRes.success) setPassengers(passengersRes.data || []);
      if (flightsRes.success) setFlights(flightsRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: form.name,
        destination: form.destination,
        bookingRef: form.bookingRef || undefined,
        phone: form.phone || undefined,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : undefined,
        bagsKg: parseFloat(form.bagsKg) || 0,
        priority: form.priority as 'NORMAL' | 'MEDICAL' | 'EVAC' | 'FIRST_CLASS',
        flightId: form.flightId ? parseInt(form.flightId) : undefined,
        notes: form.notes || undefined,
      };

      if (editingPassenger) {
        await passengersApi.update(editingPassenger.id, data);
        toast.success('Passenger updated');
      } else {
        await passengersApi.create(data);
        toast.success('Passenger created');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch {
      toast.error('Failed to save passenger');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this passenger?')) return;
    try {
      await passengersApi.delete(id);
      toast.success('Passenger deleted');
      loadData();
    } catch {
      toast.error('Failed to delete passenger');
    }
  };

  const handleEdit = (passenger: Passenger) => {
    setEditingPassenger(passenger);
    setForm({
      name: passenger.name,
      destination: passenger.destination,
      bookingRef: passenger.bookingRef || '',
      phone: passenger.phone || '',
      weightKg: passenger.weightKg?.toString() || '',
      bagsKg: passenger.bagsKg.toString(),
      priority: passenger.priority,
      flightId: passenger.flightId?.toString() || '',
      notes: passenger.notes || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPassenger(null);
    setForm({
      name: '',
      destination: '',
      bookingRef: '',
      phone: '',
      weightKg: '',
      bagsKg: '0',
      priority: 'NORMAL',
      flightId: '',
      notes: '',
    });
  };

  const openCheckInModal = (passenger: Passenger) => {
    setCheckInPassenger(passenger);
    setCheckInForm({
      weightKg: passenger.weightKg?.toString() || '',
      bagsKg: passenger.bagsKg.toString(),
      weightTicketFile: null,
    });
    setShowCheckInModal(true);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInPassenger) return;

    try {
      const weightKg = parseFloat(checkInForm.weightKg);
      const bagsKg = checkInForm.bagsKg ? parseFloat(checkInForm.bagsKg) : undefined;

      if (checkInForm.weightTicketFile) {
        // Upload weight ticket with weight data
        await passengersApi.uploadWeightTicket(
          checkInPassenger.id,
          checkInForm.weightTicketFile,
          weightKg,
          bagsKg
        );
        toast.success('Passenger checked in with weight ticket');
      } else {
        // Just check in with weight
        await passengersApi.checkIn(checkInPassenger.id, weightKg, bagsKg);
        toast.success('Passenger checked in');
      }

      setShowCheckInModal(false);
      setCheckInPassenger(null);
      loadData();
    } catch {
      toast.error('Failed to check in passenger');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCheckInForm({ ...checkInForm, weightTicketFile: file });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Passengers</h1>
          <p className="text-gray-600">Manage passenger bookings</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'unassigned')}
            className="input w-40"
          >
            <option value="all">All Passengers</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Add Passenger
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading...</p>
        ) : passengers.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No passengers found</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Weight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Bags</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Flight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {passengers.map(pax => (
                <tr key={pax.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{pax.name}</div>
                    {pax.bookingRef && <div className="text-xs text-gray-500">{pax.bookingRef}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm">{pax.destination}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      {pax.weightKg || 88} kg
                      {pax.standardWeightUsed && <span className="text-xs text-gray-400">(std)</span>}
                      {pax.weightTicketPath && (
                        <a
                          href={passengersApi.getWeightTicketUrl(pax.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                          title="View weight ticket"
                        >
                          <DocumentIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{pax.bagsKg} kg</td>
                  <td className="px-4 py-3 text-sm">
                    {pax.checkedInAt ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span className="text-xs">
                          {format(new Date(pax.checkedInAt), 'HH:mm')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Not checked in</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={clsx({
                      'priority-medical': pax.priority === 'MEDICAL',
                      'priority-evac': pax.priority === 'EVAC',
                      'priority-first_class': pax.priority === 'FIRST_CLASS',
                    })}>
                      {pax.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {pax.flight ? (
                      <span className="text-primary-600">{pax.flight.flightNumber || `Flight ${pax.flight.id}`}</span>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCheckInModal(pax)}
                        className="flex items-center gap-1 text-green-600 hover:text-green-700"
                        title="Check in with weight"
                      >
                        <ScaleIcon className="h-4 w-4" />
                        <span className="text-xs">Weigh</span>
                      </button>
                      <button onClick={() => handleEdit(pax)} className="text-primary-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(pax.id)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingPassenger ? 'Edit Passenger' : 'Add Passenger'}</h2>
              <button onClick={() => setShowModal(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Destination *</label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={e => setForm({ ...form, destination: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Booking Ref</label>
                  <input
                    type="text"
                    value={form.bookingRef}
                    onChange={e => setForm({ ...form, bookingRef: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Weight (kg)</label>
                  <input
                    type="number"
                    value={form.weightKg}
                    onChange={e => setForm({ ...form, weightKg: e.target.value })}
                    className="input"
                    placeholder="Standard: 88"
                  />
                </div>
                <div>
                  <label className="label">Bags (kg)</label>
                  <input
                    type="number"
                    value={form.bagsKg}
                    onChange={e => setForm({ ...form, bagsKg: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="input"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="MEDICAL">Medical</option>
                    <option value="EVAC">Evacuation</option>
                    <option value="FIRST_CLASS">First Class</option>
                  </select>
                </div>
                <div>
                  <label className="label">Assign to Flight</label>
                  <select
                    value={form.flightId}
                    onChange={e => setForm({ ...form, flightId: e.target.value })}
                    className="input"
                  >
                    <option value="">Unassigned</option>
                    {flights.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.flightNumber || `Flight ${f.id}`} - {f.tail}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingPassenger ? 'Save Changes' : 'Add Passenger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-In Modal */}
      {showCheckInModal && checkInPassenger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Check In Passenger</h2>
                <p className="text-sm text-gray-600">{checkInPassenger.name}</p>
              </div>
              <button onClick={() => setShowCheckInModal(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <ScaleIcon className="h-5 w-5" />
                  <span className="font-medium">Weight Entry</span>
                </div>
                <p className="text-xs text-blue-600">
                  Enter the actual weight from the scale. You can also upload a photo of the weight ticket.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Passenger Weight (kg) *</label>
                  <input
                    type="number"
                    value={checkInForm.weightKg}
                    onChange={e => setCheckInForm({ ...checkInForm, weightKg: e.target.value })}
                    className="input"
                    step="0.1"
                    min="20"
                    max="250"
                    required
                    placeholder="e.g., 82.5"
                  />
                </div>
                <div>
                  <label className="label">Bags Weight (kg)</label>
                  <input
                    type="number"
                    value={checkInForm.bagsKg}
                    onChange={e => setCheckInForm({ ...checkInForm, bagsKg: e.target.value })}
                    className="input"
                    step="0.1"
                    min="0"
                    placeholder="e.g., 15"
                  />
                </div>
              </div>

              <div>
                <label className="label">Weight Ticket (optional)</label>
                <div className="mt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-gray-50 transition-colors"
                  >
                    <CameraIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {checkInForm.weightTicketFile
                        ? checkInForm.weightTicketFile.name
                        : 'Upload weight ticket photo'}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Supported: JPEG, PNG, PDF (max 10MB)
                </p>
              </div>

              {checkInPassenger.checkedInAt && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>
                      Already checked in at {format(new Date(checkInPassenger.checkedInAt), 'MMM d, HH:mm')}
                      {checkInPassenger.checkedInBy && ` by ${checkInPassenger.checkedInBy}`}
                    </span>
                  </div>
                  {checkInPassenger.weightTicketPath && (
                    <a
                      href={passengersApi.getWeightTicketUrl(checkInPassenger.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 mt-2 text-green-600 hover:text-green-700"
                    >
                      <DocumentIcon className="h-4 w-4" />
                      View existing weight ticket
                    </a>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCheckInModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-success flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5" />
                  Check In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
