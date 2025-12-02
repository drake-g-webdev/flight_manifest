import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { aircraftApi, stationsApi } from '../services/api';
import type { AircraftWithMaintenance, MaintenanceLog, MaintenanceStatus, MaintenanceType, StationWithCounts } from '../types';

interface AircraftFormData {
  tail: string;
  type: string;
  maxTakeoffKg: string;
  emptyWeightKg: string;
  emptyWeightArm: string;
  pilotStandardWeightKg: string;
  pilotArm: string;
  fuelTankArm: string;
  seats: string;
  cgMin: string;
  cgMax: string;
}

interface MaintenanceFormData {
  type: MaintenanceType;
  description: string;
  performedBy: string;
  performedAt: string;
  hoursAtService: string;
  cost: string;
  nextDueHours: string;
  nextDueDate: string;
  workOrderNumber: string;
  notes: string;
}

const emptyAircraftForm: AircraftFormData = {
  tail: '',
  type: 'Cessna 206',
  maxTakeoffKg: '1633',
  emptyWeightKg: '900',
  emptyWeightArm: '2.0',
  pilotStandardWeightKg: '88',
  pilotArm: '2.1',
  fuelTankArm: '1.8',
  seats: '5',
  cgMin: '1.8',
  cgMax: '2.5',
};

const emptyMaintenanceForm: MaintenanceFormData = {
  type: 'HUNDRED_HOUR',
  description: '',
  performedBy: '',
  performedAt: format(new Date(), 'yyyy-MM-dd'),
  hoursAtService: '',
  cost: '',
  nextDueHours: '',
  nextDueDate: '',
  workOrderNumber: '',
  notes: '',
};

const maintenanceTypes: { value: MaintenanceType; label: string }[] = [
  { value: 'ANNUAL_INSPECTION', label: 'Annual Inspection' },
  { value: 'HUNDRED_HOUR', label: '100-Hour Inspection' },
  { value: 'PHASE_CHECK', label: 'Phase Check' },
  { value: 'UNSCHEDULED', label: 'Unscheduled Maintenance' },
  { value: 'AD_COMPLIANCE', label: 'AD Compliance' },
  { value: 'SB_COMPLIANCE', label: 'Service Bulletin' },
  { value: 'COMPONENT_REPLACEMENT', label: 'Component Replacement' },
  { value: 'OIL_CHANGE', label: 'Oil Change' },
  { value: 'TIRE_CHANGE', label: 'Tire Change' },
  { value: 'OTHER', label: 'Other' },
];

export default function Fleet() {
  const [aircraft, setAircraft] = useState<AircraftWithMaintenance[]>([]);
  const [stations, setStations] = useState<StationWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAircraftModal, setShowAircraftModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftWithMaintenance | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState<AircraftWithMaintenance | null>(null);
  const [aircraftForm, setAircraftForm] = useState<AircraftFormData>(emptyAircraftForm);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceFormData>(emptyMaintenanceForm);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedStation, setSelectedStation] = useState<number | ''>('');

  useEffect(() => {
    loadStations();
  }, []);

  useEffect(() => {
    loadAircraft();
  }, [showInactive, selectedStation]);

  const loadStations = async () => {
    try {
      const res = await stationsApi.list();
      if (res.success) {
        setStations(res.data || []);
      }
    } catch (error) {
      // Stations may not exist yet, that's ok
    }
  };

  const loadAircraft = async () => {
    setLoading(true);
    try {
      const params: { includeInactive?: boolean; stationId?: number } = {};
      if (showInactive) params.includeInactive = true;
      if (selectedStation) params.stationId = selectedStation;

      const res = await aircraftApi.list(params);
      if (res.success) {
        setAircraft(res.data || []);
      }
    } catch (error) {
      toast.error('Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferAircraft = async (ac: AircraftWithMaintenance, newStationId: number) => {
    try {
      const res = await stationsApi.transferAircraft(newStationId, ac.id);
      if (res.success) {
        toast.success(`${ac.tail} transferred to ${stations.find(s => s.id === newStationId)?.code}`);
        loadAircraft();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to transfer aircraft');
    }
  };

  const handleAircraftInputChange = (field: keyof AircraftFormData, value: string) => {
    setAircraftForm(prev => ({ ...prev, [field]: value }));
  };

  const handleMaintenanceInputChange = (field: keyof MaintenanceFormData, value: string) => {
    setMaintenanceForm(prev => ({ ...prev, [field]: value }));
  };

  const openAddAircraftModal = () => {
    setEditingAircraft(null);
    setAircraftForm(emptyAircraftForm);
    setShowAircraftModal(true);
  };

  const openEditAircraftModal = (ac: AircraftWithMaintenance) => {
    setEditingAircraft(ac);
    setAircraftForm({
      tail: ac.tail,
      type: ac.type,
      maxTakeoffKg: ac.maxTakeoffKg.toString(),
      emptyWeightKg: ac.emptyWeightKg.toString(),
      emptyWeightArm: ac.emptyWeightArm?.toString() || '2.0',
      pilotStandardWeightKg: ac.pilotStandardWeightKg?.toString() || '88',
      pilotArm: ac.pilotArm?.toString() || '2.1',
      fuelTankArm: ac.fuelTankArm?.toString() || '1.8',
      seats: ac.seats.toString(),
      cgMin: ac.cgLimits.cgMin.toString(),
      cgMax: ac.cgLimits.cgMax.toString(),
    });
    setShowAircraftModal(true);
  };

  const openMaintenanceModal = (ac: AircraftWithMaintenance) => {
    setSelectedAircraft(ac);
    setMaintenanceForm({
      ...emptyMaintenanceForm,
      hoursAtService: ac.totalFlightHours?.toString() || '',
    });
    setShowMaintenanceModal(true);
  };

  const openLogsModal = async (ac: AircraftWithMaintenance) => {
    setSelectedAircraft(ac);
    setShowLogsModal(true);
    try {
      const res = await aircraftApi.getMaintenanceLogs(ac.id);
      if (res.success) {
        setMaintenanceLogs(res.data || []);
      }
    } catch (error) {
      toast.error('Failed to load maintenance logs');
    }
  };

  const handleAircraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        tail: aircraftForm.tail,
        type: aircraftForm.type,
        maxTakeoffKg: parseFloat(aircraftForm.maxTakeoffKg),
        emptyWeightKg: parseFloat(aircraftForm.emptyWeightKg),
        emptyWeightArm: parseFloat(aircraftForm.emptyWeightArm),
        pilotStandardWeightKg: parseFloat(aircraftForm.pilotStandardWeightKg),
        pilotArm: parseFloat(aircraftForm.pilotArm),
        fuelTankArm: parseFloat(aircraftForm.fuelTankArm),
        seats: parseInt(aircraftForm.seats),
        cgLimits: {
          cgMin: parseFloat(aircraftForm.cgMin),
          cgMax: parseFloat(aircraftForm.cgMax),
        },
      };

      let res;
      if (editingAircraft) {
        res = await aircraftApi.update(editingAircraft.id, data);
      } else {
        res = await aircraftApi.create(data);
      }

      if (res.success) {
        toast.success(editingAircraft ? 'Aircraft updated' : 'Aircraft added');
        setShowAircraftModal(false);
        loadAircraft();
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to save aircraft';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAircraft) return;
    setSaving(true);

    try {
      const data = {
        type: maintenanceForm.type,
        description: maintenanceForm.description,
        performedBy: maintenanceForm.performedBy,
        performedAt: maintenanceForm.performedAt,
        hoursAtService: maintenanceForm.hoursAtService ? parseFloat(maintenanceForm.hoursAtService) : undefined,
        cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : undefined,
        nextDueHours: maintenanceForm.nextDueHours ? parseFloat(maintenanceForm.nextDueHours) : undefined,
        nextDueDate: maintenanceForm.nextDueDate || undefined,
        workOrderNumber: maintenanceForm.workOrderNumber || undefined,
        notes: maintenanceForm.notes || undefined,
      };

      const res = await aircraftApi.addMaintenance(selectedAircraft.id, data);
      if (res.success) {
        toast.success('Maintenance logged');
        setShowMaintenanceModal(false);
        loadAircraft();
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to log maintenance';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (ac: AircraftWithMaintenance, newStatus: MaintenanceStatus) => {
    try {
      const res = await aircraftApi.updateMaintenanceStatus(ac.id, newStatus);
      if (res.success) {
        toast.success('Status updated');
        loadAircraft();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeactivate = async (ac: AircraftWithMaintenance) => {
    if (!confirm(`Are you sure you want to ${ac.isActive ? 'deactivate' : 'reactivate'} ${ac.tail}?`)) return;

    try {
      if (ac.isActive) {
        const res = await aircraftApi.delete(ac.id);
        if (res.success) {
          toast.success('Aircraft deactivated');
          loadAircraft();
        }
      } else {
        const res = await aircraftApi.update(ac.id, { isActive: true });
        if (res.success) {
          toast.success('Aircraft reactivated');
          loadAircraft();
        }
      }
    } catch (error) {
      toast.error('Failed to update aircraft');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-gray-600">Manage aircraft and maintenance status</p>
        </div>
        <div className="flex items-center gap-4">
          {stations.length > 0 && (
            <select
              value={selectedStation}
              onChange={e => setSelectedStation(e.target.value ? parseInt(e.target.value) : '')}
              className="input py-2"
            >
              <option value="">All Stations</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded"
            />
            Show inactive
          </label>
          <button onClick={openAddAircraftModal} className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Add Aircraft
          </button>
        </div>
      </div>

      {/* Fleet Overview Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Fleet</p>
          <p className="text-2xl font-bold">{aircraft.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Operational</p>
          <p className="text-2xl font-bold text-green-600">
            {aircraft.filter(a => a.maintenanceStatus === 'OPERATIONAL').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">In Maintenance</p>
          <p className="text-2xl font-bold text-yellow-600">
            {aircraft.filter(a => ['IN_MAINTENANCE', 'SCHEDULED_MAINTENANCE'].includes(a.maintenanceStatus)).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">AOG / Due</p>
          <p className="text-2xl font-bold text-red-600">
            {aircraft.filter(a => ['AOG', 'INSPECTION_DUE'].includes(a.maintenanceStatus)).length}
          </p>
        </div>
      </div>

      {/* Aircraft List */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : aircraft.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No aircraft found. Add your first aircraft to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tail #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Station</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MTOW</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seats</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flight Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Inspection</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {aircraft.map(ac => (
                  <tr key={ac.id} className={clsx(!ac.isActive && 'bg-gray-100 opacity-60')}>
                    <td className="px-4 py-3 font-medium">
                      {ac.tail}
                      {!ac.isActive && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ac.type}</td>
                    <td className="px-4 py-3">
                      {stations.length > 0 ? (
                        <select
                          value={ac.currentStationId || ''}
                          onChange={e => {
                            const newStationId = parseInt(e.target.value);
                            if (newStationId) handleTransferAircraft(ac, newStationId);
                          }}
                          className="text-sm border rounded px-2 py-1"
                          disabled={!ac.isActive}
                        >
                          <option value="">—</option>
                          {stations.map(s => (
                            <option key={s.id} value={s.id}>{s.code}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={ac.maintenanceStatus}
                        onChange={e => handleStatusChange(ac, e.target.value as MaintenanceStatus)}
                        className="text-sm border rounded px-2 py-1"
                        disabled={!ac.isActive}
                      >
                        <option value="OPERATIONAL">Operational</option>
                        <option value="SCHEDULED_MAINTENANCE">Scheduled Maintenance</option>
                        <option value="IN_MAINTENANCE">In Maintenance</option>
                        <option value="AOG">AOG</option>
                        <option value="INSPECTION_DUE">Inspection Due</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ac.maxTakeoffKg.toFixed(0)} kg</td>
                    <td className="px-4 py-3 text-gray-600">{ac.seats}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {ac.totalFlightHours?.toFixed(1) || '0.0'}
                      {ac.hoursToNextService && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({ac.hoursToNextService.toFixed(0)} to service)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ac.nextInspectionDue
                        ? format(new Date(ac.nextInspectionDue), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditAircraftModal(ac)}
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openMaintenanceModal(ac)}
                          className="text-sm text-green-600 hover:text-green-700"
                          disabled={!ac.isActive}
                        >
                          Log Maint.
                        </button>
                        <button
                          onClick={() => openLogsModal(ac)}
                          className="text-sm text-gray-600 hover:text-gray-700"
                        >
                          History
                        </button>
                        <button
                          onClick={() => handleDeactivate(ac)}
                          className={clsx(
                            'text-sm',
                            ac.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                          )}
                        >
                          {ac.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Aircraft Modal */}
      {showAircraftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingAircraft ? 'Edit Aircraft' : 'Add New Aircraft'}
              </h2>
              <button onClick={() => setShowAircraftModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAircraftSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tail Number *</label>
                  <input
                    type="text"
                    value={aircraftForm.tail}
                    onChange={e => handleAircraftInputChange('tail', e.target.value)}
                    className="input"
                    placeholder="N12345"
                    required
                  />
                </div>
                <div>
                  <label className="label">Aircraft Type *</label>
                  <input
                    type="text"
                    value={aircraftForm.type}
                    onChange={e => handleAircraftInputChange('type', e.target.value)}
                    className="input"
                    placeholder="Cessna 206"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">MTOW (kg) *</label>
                  <input
                    type="number"
                    value={aircraftForm.maxTakeoffKg}
                    onChange={e => handleAircraftInputChange('maxTakeoffKg', e.target.value)}
                    className="input"
                    step="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="label">Empty Weight (kg) *</label>
                  <input
                    type="number"
                    value={aircraftForm.emptyWeightKg}
                    onChange={e => handleAircraftInputChange('emptyWeightKg', e.target.value)}
                    className="input"
                    step="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="label">Empty Weight Arm (m) *</label>
                  <input
                    type="number"
                    value={aircraftForm.emptyWeightArm}
                    onChange={e => handleAircraftInputChange('emptyWeightArm', e.target.value)}
                    className="input"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Seats *</label>
                  <input
                    type="number"
                    value={aircraftForm.seats}
                    onChange={e => handleAircraftInputChange('seats', e.target.value)}
                    className="input"
                    min="1"
                    max="20"
                    required
                  />
                </div>
                <div>
                  <label className="label">CG Min (m) *</label>
                  <input
                    type="number"
                    value={aircraftForm.cgMin}
                    onChange={e => handleAircraftInputChange('cgMin', e.target.value)}
                    className="input"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="label">CG Max (m) *</label>
                  <input
                    type="number"
                    value={aircraftForm.cgMax}
                    onChange={e => handleAircraftInputChange('cgMax', e.target.value)}
                    className="input"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Pilot Std Weight (kg)</label>
                  <input
                    type="number"
                    value={aircraftForm.pilotStandardWeightKg}
                    onChange={e => handleAircraftInputChange('pilotStandardWeightKg', e.target.value)}
                    className="input"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="label">Pilot Arm (m)</label>
                  <input
                    type="number"
                    value={aircraftForm.pilotArm}
                    onChange={e => handleAircraftInputChange('pilotArm', e.target.value)}
                    className="input"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">Fuel Tank Arm (m)</label>
                  <input
                    type="number"
                    value={aircraftForm.fuelTankArm}
                    onChange={e => handleAircraftInputChange('fuelTankArm', e.target.value)}
                    className="input"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowAircraftModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : editingAircraft ? 'Update Aircraft' : 'Add Aircraft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Maintenance Modal */}
      {showMaintenanceModal && selectedAircraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Log Maintenance - {selectedAircraft.tail}</h2>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleMaintenanceSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Maintenance Type *</label>
                  <select
                    value={maintenanceForm.type}
                    onChange={e => handleMaintenanceInputChange('type', e.target.value)}
                    className="input"
                    required
                  >
                    {maintenanceTypes.map(mt => (
                      <option key={mt.value} value={mt.value}>{mt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Date Performed *</label>
                  <input
                    type="date"
                    value={maintenanceForm.performedAt}
                    onChange={e => handleMaintenanceInputChange('performedAt', e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Description *</label>
                <textarea
                  value={maintenanceForm.description}
                  onChange={e => handleMaintenanceInputChange('description', e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Describe the maintenance performed..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Performed By *</label>
                  <input
                    type="text"
                    value={maintenanceForm.performedBy}
                    onChange={e => handleMaintenanceInputChange('performedBy', e.target.value)}
                    className="input"
                    placeholder="Mechanic name or A&P number"
                    required
                  />
                </div>
                <div>
                  <label className="label">Work Order #</label>
                  <input
                    type="text"
                    value={maintenanceForm.workOrderNumber}
                    onChange={e => handleMaintenanceInputChange('workOrderNumber', e.target.value)}
                    className="input"
                    placeholder="WO-12345"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Hours at Service</label>
                  <input
                    type="number"
                    value={maintenanceForm.hoursAtService}
                    onChange={e => handleMaintenanceInputChange('hoursAtService', e.target.value)}
                    className="input"
                    step="0.1"
                    placeholder="1234.5"
                  />
                </div>
                <div>
                  <label className="label">Cost ($)</label>
                  <input
                    type="number"
                    value={maintenanceForm.cost}
                    onChange={e => handleMaintenanceInputChange('cost', e.target.value)}
                    className="input"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label">Next Due (Hours)</label>
                  <input
                    type="number"
                    value={maintenanceForm.nextDueHours}
                    onChange={e => handleMaintenanceInputChange('nextDueHours', e.target.value)}
                    className="input"
                    step="0.1"
                    placeholder="1334.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Next Due Date</label>
                  <input
                    type="date"
                    value={maintenanceForm.nextDueDate}
                    onChange={e => handleMaintenanceInputChange('nextDueDate', e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  value={maintenanceForm.notes}
                  onChange={e => handleMaintenanceInputChange('notes', e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowMaintenanceModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Log Maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance History Modal */}
      {showLogsModal && selectedAircraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Maintenance History - {selectedAircraft.tail}</h2>
              <button onClick={() => setShowLogsModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {maintenanceLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No maintenance records found.</p>
              ) : (
                <div className="space-y-4">
                  {maintenanceLogs.map(log => (
                    <div key={log.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {maintenanceTypes.find(mt => mt.value === log.type)?.label || log.type}
                          </span>
                          <h4 className="font-medium mt-1">{log.description}</h4>
                        </div>
                        <span className="text-sm text-gray-500">
                          {format(new Date(log.performedAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Performed by:</span>
                          <p className="font-medium">{log.performedBy}</p>
                        </div>
                        {log.hoursAtService && (
                          <div>
                            <span className="text-gray-500">Hours:</span>
                            <p className="font-medium">{log.hoursAtService.toFixed(1)}</p>
                          </div>
                        )}
                        {log.cost && (
                          <div>
                            <span className="text-gray-500">Cost:</span>
                            <p className="font-medium">${log.cost.toFixed(2)}</p>
                          </div>
                        )}
                        {log.workOrderNumber && (
                          <div>
                            <span className="text-gray-500">Work Order:</span>
                            <p className="font-medium">{log.workOrderNumber}</p>
                          </div>
                        )}
                      </div>
                      {log.notes && (
                        <p className="mt-2 text-sm text-gray-600">{log.notes}</p>
                      )}
                      {(log.nextDueHours || log.nextDueDate) && (
                        <div className="mt-2 pt-2 border-t text-sm text-orange-600">
                          Next due: {log.nextDueHours && `${log.nextDueHours.toFixed(1)} hours`}
                          {log.nextDueHours && log.nextDueDate && ' or '}
                          {log.nextDueDate && format(new Date(log.nextDueDate), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
