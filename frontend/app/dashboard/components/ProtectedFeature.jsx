'use client';

import { useUser } from '@clerk/nextjs';

/**
 * ProtectedFeature component that uses Clerk's user metadata to gate features
 * This demonstrates how to use Clerk for feature gating based on subscription status
 */
export function ProtectedFeature({ 
  children, 
  feature, 
  fallback,
  requireSubscription = true 
}) {
  const { user, isLoaded } = useUser();

  // Loading state
  if (!isLoaded) {
    return <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>;
  }

  // Check user subscription status and features
  const hasFeature = () => {
    if (!user) return false;

    // Get subscription info from user's public metadata
    const subscriptionStatus = user.publicMetadata?.subscriptionStatus;
    const features = user.publicMetadata?.features || [];

    // If subscription is required, check status
    if (requireSubscription) {
      const activeStatuses = ['active', 'trial'];
      if (!activeStatuses.includes(subscriptionStatus)) {
        return false;
      }
    }

    // Check specific feature access
    if (feature) {
      return features.includes(feature);
    }

    return true;
  };

  // If user doesn't have access, show fallback
  if (!hasFeature()) {
    return fallback || (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <p className="text-gray-600 text-sm">
          This feature requires an active subscription.
        </p>
        <a 
          href="/dashboard/billing" 
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Upgrade now →
        </a>
      </div>
    );
  }

  return children;
}

/**
 * Hook that mimics Clerk's has() method for checking subscription features
 */
export function useSubscriptionFeatures() {
  const { user, isLoaded } = useUser();

  const has = (feature) => {
    if (!isLoaded || !user) return false;

    const subscriptionStatus = user.publicMetadata?.subscriptionStatus;
    const features = user.publicMetadata?.features || [];

    // Check if subscription is active
    const activeStatuses = ['active', 'trial'];
    const hasActiveSubscription = activeStatuses.includes(subscriptionStatus);

    // For specific features
    if (feature) {
      return hasActiveSubscription && features.includes(feature);
    }

    return hasActiveSubscription;
  };

  const getSubscriptionStatus = () => {
    if (!isLoaded || !user) return 'unknown';
    return user.publicMetadata?.subscriptionStatus || 'trial';
  };

  const getFeatures = () => {
    if (!isLoaded || !user) return [];
    return user.publicMetadata?.features || [];
  };

  return {
    has,
    getSubscriptionStatus,
    getFeatures,
    isLoaded
  };
}