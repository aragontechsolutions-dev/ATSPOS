import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useSessionStore } from '@/store/session';

/**
 * Enforces the inactivity timeout while a user is logged in:
 * - a periodic check logs out after the idle window even with the app open,
 * - returning from background re-checks (covers time spent backgrounded),
 * - going to background flushes the last-activity timestamp so a cold start
 *   (app killed) can also detect expiry on next launch.
 */
export function InactivityGuard() {
  const usuario = useSessionStore((s) => s.usuario);
  const checkExpiry = useSessionStore((s) => s.checkExpiry);
  const flushActivity = useSessionStore((s) => s.flushActivity);

  useEffect(() => {
    if (!usuario) return;

    checkExpiry();
    const interval = setInterval(checkExpiry, 20000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkExpiry();
      } else {
        flushActivity();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [usuario, checkExpiry, flushActivity]);

  return null;
}
