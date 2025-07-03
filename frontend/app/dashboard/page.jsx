'use client';

import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  Server, 
  Users, 
  CreditCard, 
  Activity,
  Plus,
  Settings,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';
import { ProtectedFeature, useSubscriptionFeatures } from './components/ProtectedFeature';

export default function DashboardPage() {
  const { user } = useUser();
  const { has, getSubscriptionStatus } = useSubscriptionFeatures();
  const searchParams = useSearchParams();
  const welcome = searchParams?.get('welcome');
  
  const [userProfile, setUserProfile] = useState(null);
  const [containers, setContainers] = useState([]);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (welcome === 'true') {
      toast.success('Welcome to Media Platform! Let\'s set up your first media server.');
    }
  }, [welcome]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile, containers, and billing info
      const [profileRes, containersRes, billingRes] = await Promise.all([
        fetch('/api/users/profile'),
        fetch('/api/containers'),
        fetch('/api/billing')
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUserProfile(profile);
      }

      if (containersRes.ok) {
        const containerData = await containersRes.json();
        setContainers(containerData);
      }

      if (billingRes.ok) {
        const billingData = await billingRes.json();
        setBilling(billingData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Use Clerk-based subscription status instead of backend data
  const subscriptionStatus = getSubscriptionStatus();
  const hasActiveSubscription = has(); // Uses the has() method as mentioned in the issue
  const isTrialActive = subscriptionStatus === 'trial';
  const hasContainer = containers.length > 0;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Server className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-5 flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.firstName || 'there'}!
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your personal media server and storage
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Subscription Status */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CreditCard className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Subscription
                  </dt>
                  <dd className="flex items-center text-lg font-medium text-gray-900">
                    {hasActiveSubscription ? (
                      <span className="text-green-600">Active</span>
                    ) : isTrialActive ? (
                      <span className="text-blue-600">Trial</span>
                    ) : (
                      <span className="text-red-600">Inactive</span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Server Status */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Server className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Media Server
                  </dt>
                  <dd className="flex items-center text-lg font-medium text-gray-900">
                    {hasContainer ? (
                      <span className="text-green-600">Running</span>
                    ) : (
                      <span className="text-gray-600">Not Created</span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Storage Used
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {(userProfile?.storageUsedGB || 0).toFixed(1)} GB
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Quota */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Settings className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Storage Quota
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {userProfile?.storageQuotaGB || 2048} GB
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          
          {!hasContainer ? (
            <div className="rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Plus className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Create Your First Media Server
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Get started by creating your personal Jellyfin, Plex, or Emby server.</p>
                  </div>
                  <div className="mt-4">
                    <div className="-mx-2 -my-1.5 flex">
                      <Link
                        href="/dashboard/server"
                        className="bg-blue-50 px-2 py-1.5 rounded-md text-sm font-medium text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-50 focus:ring-blue-600"
                      >
                        Create Server
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/dashboard/server"
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 ring-4 ring-white">
                    <Server className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Manage Server
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    View logs, restart, or configure your media server
                  </p>
                </div>
              </Link>

              <Link
                href="/dashboard/billing"
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                    <CreditCard className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Billing & Usage
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    View invoices, update payment method, or change plan
                  </p>
                </div>
              </Link>

              <Link
                href="/dashboard/settings"
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                    <Settings className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-8">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Settings
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Update your profile and server preferences
                  </p>
                </div>
              </Link>

              {/* Protected Feature Example - Advanced Analytics */}
              <ProtectedFeature 
                feature="advanced_analytics"
                fallback={
                  <div className="relative group bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <div>
                      <span className="rounded-lg inline-flex p-3 bg-gray-100 text-gray-400 ring-4 ring-white">
                        <Activity className="h-6 w-6" />
                      </span>
                    </div>
                    <div className="mt-8">
                      <h3 className="text-lg font-medium text-gray-500">
                        Advanced Analytics
                      </h3>
                      <p className="mt-2 text-sm text-gray-400">
                        Detailed server metrics and usage analytics
                      </p>
                      <div className="mt-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pro Feature
                        </span>
                      </div>
                    </div>
                  </div>
                }
              >
                <Link
                  href="/dashboard/analytics"
                  className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 hover:border-gray-400"
                >
                  <div>
                    <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                      <Activity className="h-6 w-6" />
                    </span>
                  </div>
                  <div className="mt-8">
                    <h3 className="text-lg font-medium">
                      <span className="absolute inset-0" aria-hidden="true" />
                      Advanced Analytics
                    </h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Detailed server metrics and usage analytics
                    </p>
                  </div>
                </Link>
              </ProtectedFeature>
            </div>
          )}
        </div>
      </div>

      {/* Trial/Subscription Notice */}
      {isTrialActive && (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Trial Period Active
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Your trial expires on {new Date(userProfile.trialEndsAt).toLocaleDateString()}.
                  <Link href="/dashboard/billing" className="font-medium underline ml-1">
                    Upgrade now to continue using your media server.
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}