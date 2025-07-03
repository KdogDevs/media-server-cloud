'use client';

import { useUser } from '@clerk/nextjs';
import { CreditCard, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function BillingPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get subscription status from user metadata (this would come from Clerk billing)
  const subscriptionStatus = user?.publicMetadata?.subscriptionStatus || 'trial';
  const trialEndsAt = user?.publicMetadata?.trialEndsAt;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-600 mt-2">
          Manage your subscription and billing preferences
        </p>
      </div>

      {/* Subscription Status Card */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CreditCard className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
              <div className="flex items-center mt-1">
                {subscriptionStatus === 'active' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-green-600 font-medium">Pro Plan - Active</span>
                  </>
                )}
                {subscriptionStatus === 'trial' && (
                  <>
                    <Clock className="h-4 w-4 text-blue-500 mr-1" />
                    <span className="text-blue-600 font-medium">Trial Period</span>
                  </>
                )}
                {subscriptionStatus === 'past_due' && (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="text-yellow-600 font-medium">Payment Past Due</span>
                  </>
                )}
                {subscriptionStatus === 'cancelled' && (
                  <>
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                    <span className="text-red-600 font-medium">Cancelled</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {subscriptionStatus === 'trial' && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Trial expires</p>
              <p className="font-medium text-gray-900">
                {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : 'Soon'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Clerk Billing Integration Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <CheckCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Billing Powered by Clerk
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Your subscription and billing are now managed through Clerk's secure billing system.
                Use the Clerk billing components below to manage your subscription.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder for Clerk Billing Components */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Management</h3>
        
        {/* This is where Clerk billing components would be integrated */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            Clerk Billing Components
          </h4>
          <p className="text-gray-600 mb-4">
            Integrate Clerk's billing components here to allow users to:
          </p>
          <ul className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-1">
            <li>• Subscribe to plans</li>
            <li>• Update payment methods</li>
            <li>• View billing history</li>
            <li>• Cancel subscriptions</li>
            <li>• Download invoices</li>
          </ul>
          <div className="mt-6">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium">
              Setup Clerk Billing
            </button>
          </div>
        </div>
      </div>

      {/* Plan Features */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Included with Pro Plan:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ 2TB Storage</li>
              <li>✓ Jellyfin, Plex, or Emby</li>
              <li>✓ Custom Subdomain</li>
              <li>✓ SSL Certificate</li>
              <li>✓ Automatic Backups</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Support & Monitoring:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ 24/7 Uptime Monitoring</li>
              <li>✓ Email Support</li>
              <li>✓ Server Health Metrics</li>
              <li>✓ Performance Analytics</li>
              <li>✓ Activity Logs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}