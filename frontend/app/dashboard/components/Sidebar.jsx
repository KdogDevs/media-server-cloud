'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Server, 
  CreditCard, 
  Settings, 
  HelpCircle, 
  Activity,
  Users,
  Shield
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'My Server', href: '/dashboard/server', icon: Server },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Support', href: '/dashboard/support', icon: HelpCircle },
];

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/dashboard/admin', icon: Shield },
  { name: 'All Users', href: '/dashboard/admin/users', icon: Users },
  { name: 'All Servers', href: '/dashboard/admin/servers', icon: Server },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  
  const isAdmin = user?.publicMetadata?.role === 'admin' || user?.publicMetadata?.role === 'ADMIN';

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
      <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Server className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Media Platform</p>
            </div>
          </div>
        </div>
        
        <nav className="mt-8 flex-grow px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon
                  className={clsx(
                    'mr-3 flex-shrink-0 h-5 w-5',
                    isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  )}
                />
                {item.name}
              </Link>
            );
          })}
          
          {isAdmin && (
            <>
              <div className="pt-6">
                <div className="px-2 py-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Administration
                  </h3>
                </div>
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={clsx(
                        'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-red-100 text-red-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon
                        className={clsx(
                          'mr-3 flex-shrink-0 h-5 w-5',
                          isActive ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-500'
                        )}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </nav>
        
        <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <p>v1.0.0</p>
            <p className="mt-1">© 2024 Media Platform</p>
          </div>
        </div>
      </div>
    </div>
  );
}