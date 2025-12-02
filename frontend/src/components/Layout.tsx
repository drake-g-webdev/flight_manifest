import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useOperatorStore } from '../store/operatorStore';
import OperatorSwitcher from './OperatorSwitcher';
import {
  HomeIcon,
  UserGroupIcon,
  TruckIcon,
  EnvelopeIcon,
  CogIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  PaperAirplaneIcon,
  WrenchScrewdriverIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Flights', href: '/flights', icon: PaperAirplaneIcon },
  { name: 'Passengers', href: '/passengers', icon: UserGroupIcon },
  { name: 'Freight', href: '/freight', icon: TruckIcon },
  { name: 'Mail', href: '/mail', icon: EnvelopeIcon },
  { name: 'Fleet', href: '/fleet', icon: WrenchScrewdriverIcon },
  { name: 'Stations', href: '/stations', icon: BuildingOffice2Icon },
  { name: 'Optimize', href: '/optimize', icon: CogIcon },
  { name: 'Manifests', href: '/manifests', icon: DocumentTextIcon },
];

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { selectedOperator, clear: clearOperator } = useOperatorStore();

  const handleLogout = () => {
    logout();
    clearOperator();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900">
        <div className="flex h-16 items-center gap-2 px-6">
          <PaperAirplaneIcon className="h-8 w-8 text-primary-400" />
          <span className="text-xl font-bold text-white">Sukakpak</span>
        </div>

        {/* Operator Switcher */}
        <div className="px-3 mb-4">
          <OperatorSwitcher />
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {navigation.map(item => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="border-t border-gray-700 pt-4">
            <div className="px-3 mb-3">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
              <span className="inline-flex mt-1 px-2 py-0.5 rounded text-xs bg-primary-600 text-white">
                {user?.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
