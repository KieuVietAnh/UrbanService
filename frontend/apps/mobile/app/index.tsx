import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth';
import { getMobileEntry } from '@/features/auth/mobile-access';

/**
 * Main Entry Navigation Router
 * Evaluates session state and dispatches the initial route.
 */
export default function Index() {
  const user = useAuthStore((s) => s.user);

  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  if (!hasHydrated) return null;
  return <Redirect href={getMobileEntry(user)} />;
}
