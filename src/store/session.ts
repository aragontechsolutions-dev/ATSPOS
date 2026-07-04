import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { getUsuarioById, login as loginRepo, type UsuarioConRol } from '@/db/repositories/usuarios';

const SESSION_KEY = 'atspos_session_user_id';
const ACTIVITY_KEY = 'atspos_last_activity';

export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

// Kept outside React state so recording activity on every touch does not cause
// re-renders. Persisted to SecureStore (throttled) so the timeout also applies
// while the app is backgrounded or fully closed.
let lastActivity = Date.now();
let lastPersist = 0;

function persistActivity(ms: number): void {
  SecureStore.setItem(ACTIVITY_KEY, String(ms));
}

function readPersistedActivity(): number {
  const v = SecureStore.getItem(ACTIVITY_KEY);
  return v ? Number(v) : 0;
}

interface SessionState {
  usuario: UsuarioConRol | null;
  bootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Records user activity (call on any interaction). Throttled persistence. */
  touch: () => void;
  /** Flush the current activity timestamp to storage (e.g. on backgrounding). */
  flushActivity: () => void;
  /** Logs out if the inactivity window has elapsed. */
  checkExpiry: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  usuario: null,
  bootstrapped: false,

  bootstrap: async () => {
    const userId = await SecureStore.getItemAsync(SESSION_KEY);
    if (!userId) {
      set({ bootstrapped: true });
      return;
    }

    // If the app was closed longer than the timeout, the session is expired.
    const persisted = readPersistedActivity();
    if (persisted && Date.now() - persisted > INACTIVITY_TIMEOUT_MS) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(ACTIVITY_KEY);
      set({ usuario: null, bootstrapped: true });
      return;
    }

    const usuario = await getUsuarioById(userId);
    if (usuario) {
      lastActivity = Date.now();
      persistActivity(lastActivity);
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    set({ usuario, bootstrapped: true });
  },

  login: async (username, password) => {
    const usuario = await loginRepo(username, password);
    if (!usuario) return false;
    await SecureStore.setItemAsync(SESSION_KEY, usuario.id);
    lastActivity = Date.now();
    lastPersist = lastActivity;
    persistActivity(lastActivity);
    set({ usuario });
    return true;
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(ACTIVITY_KEY);
    set({ usuario: null });
  },

  refresh: async () => {
    const current = get().usuario;
    if (!current) return;
    const usuario = await getUsuarioById(current.id);
    set({ usuario });
  },

  touch: () => {
    if (!get().usuario) return;
    const now = Date.now();
    lastActivity = now;
    if (now - lastPersist > 10000) {
      lastPersist = now;
      persistActivity(now);
    }
  },

  flushActivity: () => {
    if (get().usuario) persistActivity(lastActivity);
  },

  checkExpiry: () => {
    if (!get().usuario) return;
    const ref = Math.max(lastActivity, readPersistedActivity());
    if (Date.now() - ref > INACTIVITY_TIMEOUT_MS) {
      get().logout();
    }
  },
}));
