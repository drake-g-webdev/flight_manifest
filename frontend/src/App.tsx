import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Flights from './pages/Flights';
import FlightDetail from './pages/FlightDetail';
import Passengers from './pages/Passengers';
import Freight from './pages/Freight';
import Mail from './pages/Mail';
import Optimize from './pages/Optimize';
import Manifests from './pages/Manifests';
import Fleet from './pages/Fleet';
import Stations from './pages/Stations';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="flights" element={<Flights />} />
        <Route path="flights/:id" element={<FlightDetail />} />
        <Route path="passengers" element={<Passengers />} />
        <Route path="freight" element={<Freight />} />
        <Route path="mail" element={<Mail />} />
        <Route path="optimize" element={<Optimize />} />
        <Route path="manifests" element={<Manifests />} />
        <Route path="fleet" element={<Fleet />} />
        <Route path="stations" element={<Stations />} />
      </Route>
    </Routes>
  );
}

export default App;
