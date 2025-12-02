import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { freightApi, flightsApi } from '../services/api';
import type { Freight, FlightSummary } from '../types';

export default function FreightPage() {
  const [freight, setFreight] = useState<Freight[]>([]);
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Freight | null>(null);
  const [filter, setFilter] = useState<'all' | 'unassigned'>('all');

  const [form, setForm] = useState({
    waybill: '',
    description: '',
    weightKg: '',
    destination: '',
    volumeM3: '',
    priority: 'STANDARD',
    assignedFlightId: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [freightRes, flightsRes] = await Promise.all([
        freightApi.list({ unassigned: filter === 'unassigned' }),
        flightsApi.list(),
      ]);
      if (freightRes.success) setFreight(freightRes.data || []);
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
        waybill: form.waybill || undefined,
        description: form.description || undefined,
        weightKg: parseFloat(form.weightKg),
        destination: form.destination,
        volumeM3: form.volumeM3 ? parseFloat(form.volumeM3) : undefined,
        priority: form.priority as 'BYPASS' | 'PRIORITY' | 'STANDARD',
        assignedFlightId: form.assignedFlightId ? parseInt(form.assignedFlightId) : undefined,
        notes: form.notes || undefined,
      };

      if (editingItem) {
        await freightApi.update(editingItem.id, data);
        toast.success('Freight updated');
      } else {
        await freightApi.create(data);
        toast.success('Freight created');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch {
      toast.error('Failed to save freight');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this freight item?')) return;
    try {
      await freightApi.delete(id);
      toast.success('Freight deleted');
      loadData();
    } catch {
      toast.error('Failed to delete freight');
    }
  };

  const handleEdit = (item: Freight) => {
    setEditingItem(item);
    setForm({
      waybill: item.waybill || '',
      description: item.description || '',
      weightKg: item.weightKg.toString(),
      destination: item.destination,
      volumeM3: item.volumeM3?.toString() || '',
      priority: item.priority,
      assignedFlightId: item.assignedFlightId?.toString() || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setForm({
      waybill: '',
      description: '',
      weightKg: '',
      destination: '',
      volumeM3: '',
      priority: 'STANDARD',
      assignedFlightId: '',
      notes: '',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Freight</h1>
          <p className="text-gray-600">Manage cargo shipments</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'unassigned')}
            className="input w-40"
          >
            <option value="all">All Freight</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Add Freight
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading...</p>
        ) : freight.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No freight found</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Waybill</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Weight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Flight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {freight.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.waybill || '-'}</td>
                  <td className="px-4 py-3 text-sm">{item.description || '-'}</td>
                  <td className="px-4 py-3 text-sm">{item.weightKg} kg</td>
                  <td className="px-4 py-3 text-sm">{item.destination}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={clsx({ 'priority-bypass': item.priority === 'BYPASS' })}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.assignedFlight ? (
                      <span className="text-primary-600">
                        {item.assignedFlight.flightNumber || `Flight ${item.assignedFlight.id}`}
                      </span>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => handleEdit(item)} className="text-primary-600 hover:underline mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingItem ? 'Edit Freight' : 'Add Freight'}</h2>
              <button onClick={() => setShowModal(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Waybill</label>
                  <input
                    type="text"
                    value={form.waybill}
                    onChange={e => setForm({ ...form, waybill: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Weight (kg) *</label>
                  <input
                    type="number"
                    value={form.weightKg}
                    onChange={e => setForm({ ...form, weightKg: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="input"
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
                  <label className="label">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="input"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="PRIORITY">Priority</option>
                    <option value="BYPASS">Bypass</option>
                  </select>
                </div>
                <div>
                  <label className="label">Assign to Flight</label>
                  <select
                    value={form.assignedFlightId}
                    onChange={e => setForm({ ...form, assignedFlightId: e.target.value })}
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
                  {editingItem ? 'Save Changes' : 'Add Freight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
