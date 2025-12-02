import axios from 'axios';
import type {
  User,
  Operator,
  Aircraft,
  AircraftWithMaintenance,
  MaintenanceLog,
  MaintenanceStatus,
  MaintenanceType,
  FlightSummary,
  FlightDetail,
  Passenger,
  Freight,
  Mail,
  Manifest,
  OptimizationResult,
  ApiResponse,
  Station,
  StationWithCounts,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { email, password });
    return res.data;
  },
  register: async (email: string, password: string, name: string, role?: string) => {
    const res = await api.post<ApiResponse<User>>('/auth/register', { email, password, name, role });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await api.put<ApiResponse<void>>('/auth/password', { currentPassword, newPassword });
    return res.data;
  },
};

// Operators
export const operatorsApi = {
  list: async () => {
    const res = await api.get<ApiResponse<Operator[]>>('/operators');
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<Operator>>(`/operators/${id}`);
    return res.data;
  },
  create: async (data: {
    code: string;
    name: string;
    shortName?: string;
    dotNumber?: string;
    airCarrier?: string;
    logoUrl?: string;
    primaryColor?: string;
    address?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) => {
    const res = await api.post<ApiResponse<Operator>>('/operators', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Operator>) => {
    const res = await api.put<ApiResponse<Operator>>(`/operators/${id}`, data);
    return res.data;
  },
};

// Stations
export const stationsApi = {
  list: async (includeInactive?: boolean) => {
    const res = await api.get<ApiResponse<StationWithCounts[]>>('/stations', {
      params: { includeInactive },
    });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<Station & { aircraft: AircraftWithMaintenance[] }>>(`/stations/${id}`);
    return res.data;
  },
  create: async (data: {
    code: string;
    name: string;
    icao?: string;
    timezone?: string;
    isMainBase?: boolean;
    address?: string;
    phone?: string;
    notes?: string;
  }) => {
    const res = await api.post<ApiResponse<Station>>('/stations', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Station>) => {
    const res = await api.put<ApiResponse<Station>>(`/stations/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/stations/${id}`);
    return res.data;
  },
  getAircraft: async (id: number) => {
    const res = await api.get<ApiResponse<AircraftWithMaintenance[]>>(`/stations/${id}/aircraft`);
    return res.data;
  },
  transferAircraft: async (stationId: number, aircraftId: number) => {
    const res = await api.post<ApiResponse<AircraftWithMaintenance>>(`/stations/${stationId}/transfer-aircraft`, {
      aircraftId,
    });
    return res.data;
  },
};

// Aircraft
export const aircraftApi = {
  list: async (params?: { includeInactive?: boolean; stationId?: number }) => {
    const res = await api.get<ApiResponse<AircraftWithMaintenance[]>>('/aircraft', {
      params,
    });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<AircraftWithMaintenance>>(`/aircraft/${id}`);
    return res.data;
  },
  create: async (data: Partial<Aircraft>) => {
    const res = await api.post<ApiResponse<AircraftWithMaintenance>>('/aircraft', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Aircraft> & { isActive?: boolean }) => {
    const res = await api.put<ApiResponse<AircraftWithMaintenance>>(`/aircraft/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/aircraft/${id}`);
    return res.data;
  },
  updateMaintenanceStatus: async (id: number, status: MaintenanceStatus, notes?: string) => {
    const res = await api.put<ApiResponse<AircraftWithMaintenance>>(`/aircraft/${id}/maintenance-status`, {
      status,
      notes,
    });
    return res.data;
  },
  addMaintenance: async (
    id: number,
    data: {
      type: MaintenanceType;
      description: string;
      performedBy: string;
      performedAt: string;
      hoursAtService?: number;
      cost?: number;
      nextDueHours?: number;
      nextDueDate?: string;
      workOrderNumber?: string;
      notes?: string;
    }
  ) => {
    const res = await api.post<ApiResponse<MaintenanceLog>>(`/aircraft/${id}/maintenance`, data);
    return res.data;
  },
  getMaintenanceLogs: async (id: number) => {
    const res = await api.get<ApiResponse<MaintenanceLog[]>>(`/aircraft/${id}/maintenance`);
    return res.data;
  },
};

// Flights
export const flightsApi = {
  list: async (params?: { date?: string; status?: string; operatorId?: number }) => {
    const res = await api.get<ApiResponse<FlightSummary[]>>('/flights', { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<FlightDetail>>(`/flights/${id}`);
    return res.data;
  },
  create: async (data: {
    flightNumber?: string;
    flightDate: string;
    origin: string;
    departureTime?: string;
    route: { leg: number; to: string; eta: string }[];
    tail: string;
    pilotName?: string;
    pilotWeightKg?: number;
    fuelWeightKg?: number;
    notes?: string;
    operatorId: number;
  }) => {
    const res = await api.post<ApiResponse<FlightDetail>>('/flights', data);
    return res.data;
  },
  update: async (id: number, data: Partial<FlightDetail>) => {
    const res = await api.put<ApiResponse<FlightDetail>>(`/flights/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/flights/${id}`);
    return res.data;
  },
};

// Passengers
export const passengersApi = {
  list: async (params?: { flightId?: number; unassigned?: boolean; destination?: string; operatorId?: number }) => {
    const res = await api.get<ApiResponse<Passenger[]>>('/passengers', { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<Passenger>>(`/passengers/${id}`);
    return res.data;
  },
  create: async (data: {
    name: string;
    destination: string;
    bookingRef?: string;
    phone?: string;
    weightKg?: number;
    bagsKg?: number;
    priority?: string;
    flightId?: number;
    notes?: string;
  }) => {
    const res = await api.post<ApiResponse<Passenger>>('/passengers', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Passenger>) => {
    const res = await api.put<ApiResponse<Passenger>>(`/passengers/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/passengers/${id}`);
    return res.data;
  },
  assign: async (id: number, flightId: number, reason?: string) => {
    const res = await api.post<ApiResponse<Passenger>>(`/passengers/${id}/assign`, { flightId, reason });
    return res.data;
  },
  checkIn: async (id: number, weightKg: number, bagsKg?: number) => {
    const res = await api.post<ApiResponse<Passenger>>(`/passengers/${id}/check-in`, { weightKg, bagsKg });
    return res.data;
  },
  uploadWeightTicket: async (id: number, file: File, weightKg?: number, bagsKg?: number) => {
    const formData = new FormData();
    formData.append('weightTicket', file);
    if (weightKg !== undefined) formData.append('weightKg', weightKg.toString());
    if (bagsKg !== undefined) formData.append('bagsKg', bagsKg.toString());

    const res = await api.post<ApiResponse<Passenger & { weightTicketUrl: string }>>(`/passengers/${id}/weight-ticket`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getWeightTicketUrl: (id: number) => `/api/passengers/${id}/weight-ticket`,
  deleteWeightTicket: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/passengers/${id}/weight-ticket`);
    return res.data;
  },
};

// Freight
export const freightApi = {
  list: async (params?: { flightId?: number; unassigned?: boolean; destination?: string; priority?: string; operatorId?: number }) => {
    const res = await api.get<ApiResponse<Freight[]>>('/freight', { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<Freight>>(`/freight/${id}`);
    return res.data;
  },
  create: async (data: {
    weightKg: number;
    destination: string;
    waybill?: string;
    description?: string;
    volumeM3?: number;
    priority?: string;
    assignedFlightId?: number;
    notes?: string;
  }) => {
    const res = await api.post<ApiResponse<Freight>>('/freight', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Freight>) => {
    const res = await api.put<ApiResponse<Freight>>(`/freight/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/freight/${id}`);
    return res.data;
  },
};

// Mail
export const mailApi = {
  list: async (params?: { flightId?: number; unassigned?: boolean; village?: string; operatorId?: number }) => {
    const res = await api.get<ApiResponse<Mail[]>>('/mail', { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<Mail>>(`/mail/${id}`);
    return res.data;
  },
  create: async (data: {
    village: string;
    pounds: number;
    priority?: string;
    assignedFlightId?: number;
    notes?: string;
  }) => {
    const res = await api.post<ApiResponse<Mail>>('/mail', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Mail>) => {
    const res = await api.put<ApiResponse<Mail>>(`/mail/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/mail/${id}`);
    return res.data;
  },
};

// Optimization
export const optimizeApi = {
  run: async (flightDate: string, useClaudeOptimization?: boolean, flightIds?: number[]) => {
    const res = await api.post<ApiResponse<OptimizationResult>>('/optimize', {
      flightDate,
      useClaudeOptimization,
      flightIds,
    });
    return res.data;
  },
  apply: async (assignmentPlan: OptimizationResult['assignmentPlan']) => {
    const res = await api.post<ApiResponse<void>>('/optimize/apply', { assignmentPlan });
    return res.data;
  },
  getLogs: async (limit?: number) => {
    const res = await api.get<ApiResponse<unknown[]>>('/optimize/logs', { params: { limit } });
    return res.data;
  },
};

// Manifests
export const manifestsApi = {
  list: async (params?: { flightId?: number; date?: string }) => {
    const res = await api.get<ApiResponse<Manifest[]>>('/manifests', { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<ApiResponse<Manifest>>(`/manifests/${id}`);
    return res.data;
  },
  generate: async (flightId: number) => {
    const res = await api.post<ApiResponse<Manifest>>('/manifests/generate', { flightId });
    return res.data;
  },
  generateBatch: async (flightDate: string) => {
    const res = await api.post<ApiResponse<{ totalFlights: number; successful: number; failed: number }>>('/manifests/generate-batch', {
      flightDate,
    });
    return res.data;
  },
  sign: async (id: number) => {
    const res = await api.post<ApiResponse<Manifest>>(`/manifests/${id}/sign`);
    return res.data;
  },
  getPdfUrl: (id: number) => `/api/manifests/${id}/pdf`,
};

export default api;
