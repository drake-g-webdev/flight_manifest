import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  BuildingOffice2Icon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { stationsApi } from '../services/api';
import type { StationWithCounts } from '../types';
import { useAuthStore } from '../store/authStore';

const TIMEZONES = [
  'America/Anchorage',
  'America/Nome',
  'America/Adak',
  'America/Juneau',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
];

export default function Stations() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [stations, setStations] = useState<StationWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState<StationWithCounts | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    icao: '',
    timezone: 'America/Anchorage',
    isMainBase: false,
    address: '',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    loadStations();
  }, [showInactive]);

  const loadStations = async () => {
    setLoading(true);
    try {
      const res = await stationsApi.list(showInactive);
      if (res.success) {
        setStations(res.data || []);
      }
    } catch (error) {
      toast.error('Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStation) {
        const res = await stationsApi.update(editingStation.id, {
          ...form,
          icao: form.icao || undefined,
          address: form.address || undefined,
          phone: form.phone || undefined,
          notes: form.notes || undefined,
        });
        if (res.success) {
          toast.success('Station updated');
          loadStations();
          closeModal();
        }
      } else {
        const res = await stationsApi.create({
          ...form,
          icao: form.icao || undefined,
          address: form.address || undefined,
          phone: form.phone || undefined,
          notes: form.notes || undefined,
        });
        if (res.success) {
          toast.success('Station created');
          loadStations();
          closeModal();
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save station');
    }
  };

  const handleDelete = async (station: StationWithCounts) => {
    if (!confirm(`Are you sure you want to deactivate ${station.name}?`)) return;

    try {
      const res = await stationsApi.delete(station.id);
      if (res.success) {
        toast.success('Station deactivated');
        loadStations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to deactivate station');
    }
  };

  const openEditModal = (station: StationWithCounts) => {
    setEditingStation(station);
    setForm({
      code: station.code,
      name: station.name,
      icao: station.icao || '',
      timezone: station.timezone,
      isMainBase: station.isMainBase,
      address: station.address || '',
      phone: station.phone || '',
      notes: station.notes || '',
    });
    setShowModal(true);
  };

  const openNewModal = () => {
    setEditingStation(null);
    setForm({
      code: '',
      name: '',
      icao: '',
      timezone: 'America/Anchorage',
      isMainBase: false,
      address: '',
      phone: '',
      notes: '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStation(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stations</h1>
          <p className="text-gray-600">Manage base locations</p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show inactive
          </label>

          {isAdmin && (
            <button onClick={openNewModal} className="btn-primary flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              Add Station
            </button>
          )}
        </div>
      </div>

      {/* Stations Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading stations...</div>
      ) : stations.length === 0 ? (
        <div className="text-center py-12">
          <BuildingOffice2Icon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No stations yet</h3>
          <p className="text-gray-600 mb-4">Add your first base location to get started.</p>
          {isAdmin && (
            <button onClick={openNewModal} className="btn-primary">
              Add Station
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map(station => (
            <div
              key={station.id}
              className={clsx('card p-5', {
                'opacity-60': !station.isActive,
              })}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={clsx('p-2 rounded-lg', station.isMainBase ? 'bg-yellow-100' : 'bg-blue-100')}>
                    {station.isMainBase ? (
                      <StarIcon className="h-6 w-6 text-yellow-600" />
                    ) : (
                      <BuildingOffice2Icon className="h-6 w-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{station.code}</h3>
                    <p className="text-gray-600">{station.name}</p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(station)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    {station.isActive && (
                      <button
                        onClick={() => handleDelete(station)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Deactivate"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {station.icao && (
                <p className="text-sm text-gray-500 mb-2">ICAO: {station.icao}</p>
              )}

              {station.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
                  <MapPinIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{station.address}</span>
                </div>
              )}

              {station.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <PhoneIcon className="h-4 w-4" />
                  <span>{station.phone}</span>
                </div>
              )}

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <PaperAirplaneIcon className="h-4 w-4" />
                    <span>{station._count?.aircraft || 0} aircraft</span>
                  </div>
                  <span className="text-gray-500">{station.timezone.split('/')[1]}</span>
                </div>
              </div>

              {station.isMainBase && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                    Main Base
                  </span>
                </div>
              )}

              {!station.isActive && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingStation ? 'Edit Station' : 'New Station'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="input"
                    placeholder="FAI"
                    maxLength={5}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ICAO Code
                  </label>
                  <input
                    type="text"
                    value={form.icao}
                    onChange={e => setForm({ ...form, icao: e.target.value.toUpperCase() })}
                    className="input"
                    placeholder="PAFA"
                    maxLength={4}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="Fairbanks"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={form.timezone}
                  onChange={e => setForm({ ...form, timezone: e.target.value })}
                  className="input"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="input"
                  placeholder="Airport address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="input"
                  placeholder="(907) 555-1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isMainBase"
                  checked={form.isMainBase}
                  onChange={e => setForm({ ...form, isMainBase: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isMainBase" className="text-sm text-gray-700">
                  This is a main base (primary maintenance facility)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingStation ? 'Save Changes' : 'Create Station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
