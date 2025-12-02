import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { mailApi, flightsApi } from '../services/api';
import type { Mail, FlightSummary } from '../types';

export default function MailPage() {
  const [mail, setMail] = useState<Mail[]>([]);
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Mail | null>(null);
  const [filter, setFilter] = useState<'all' | 'unassigned'>('all');

  const [form, setForm] = useState({
    village: '',
    pounds: '',
    priority: 'BYPASS',
    assignedFlightId: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mailRes, flightsRes] = await Promise.all([
        mailApi.list({ unassigned: filter === 'unassigned' }),
        flightsApi.list(),
      ]);
      if (mailRes.success) setMail(mailRes.data || []);
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
        village: form.village,
        pounds: parseFloat(form.pounds),
        priority: form.priority as 'BYPASS' | 'PRIORITY' | 'STANDARD',
        assignedFlightId: form.assignedFlightId ? parseInt(form.assignedFlightId) : undefined,
        notes: form.notes || undefined,
      };

      if (editingItem) {
        await mailApi.update(editingItem.id, data);
        toast.success('Mail updated');
      } else {
        await mailApi.create(data);
        toast.success('Mail created');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch {
      toast.error('Failed to save mail');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this mail item?')) return;
    try {
      await mailApi.delete(id);
      toast.success('Mail deleted');
      loadData();
    } catch {
      toast.error('Failed to delete mail');
    }
  };

  const handleEdit = (item: Mail) => {
    setEditingItem(item);
    setForm({
      village: item.village,
      pounds: item.pounds.toString(),
      priority: item.priority,
      assignedFlightId: item.assignedFlightId?.toString() || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setForm({
      village: '',
      pounds: '',
      priority: 'BYPASS',
      assignedFlightId: '',
      notes: '',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mail</h1>
          <p className="text-gray-600">Manage USPS mail deliveries</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'unassigned')}
            className="input w-40"
          >
            <option value="all">All Mail</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Add Mail
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading...</p>
        ) : mail.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No mail found</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Village</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Pounds</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Weight (kg)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Flight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mail.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.village}</td>
                  <td className="px-4 py-3 text-sm">{item.pounds} lbs</td>
                  <td className="px-4 py-3 text-sm">{item.weightKg.toFixed(1)} kg</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="priority-bypass">{item.priority}</span>
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
              <h2 className="text-lg font-semibold">{editingItem ? 'Edit Mail' : 'Add Mail'}</h2>
              <button onClick={() => setShowModal(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Village *</label>
                <input
                  type="text"
                  value={form.village}
                  onChange={e => setForm({ ...form, village: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Pounds *</label>
                <input
                  type="number"
                  value={form.pounds}
                  onChange={e => setForm({ ...form, pounds: e.target.value })}
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
                    <option value="BYPASS">Bypass</option>
                    <option value="PRIORITY">Priority</option>
                    <option value="STANDARD">Standard</option>
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
                  {editingItem ? 'Save Changes' : 'Add Mail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
