import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from './auth.store';
import { getMobileRedirect } from './mobile-access';

/** Shared role-aware redirect policy; protected stacks prevent unauthorized mounting. */
export function useAuthGuard() {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    const destination = getMobileRedirect(user, segments);
    if (destination) router.replace(destination);
  }, [user, hasHydrated, segments, router]);
}
