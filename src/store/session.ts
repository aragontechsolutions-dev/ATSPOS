import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { getUsuarioById, login as loginRepo, type UsuarioConRol } from '@/db/repositories/usuarios';

const SESSION_KEY = 'atspos_session_user_id';

interface SessionState {
  usuario: UsuarioConRol | null;
  bootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  usuario: null,
  bootstrapped: false,

  bootstrap: async () => {
    const userId = await SecureStore.getItemAsync(SESSION_KEY);
    if (userId) {
      const usuario = await getUsuarioById(userId);
      set({ usuario, bootstrapped: true });
      if (!usuario) await SecureStore.deleteItemAsync(SESSION_KEY);
      return;
    }
    set({ bootstrapped: true });
  },

  login: async (username, password) => {
    const usuario = await loginRepo(username, password);
    if (!usuario) return false;
    await SecureStore.setItemAsync(SESSION_KEY, usuario.id);
    set({ usuario });
    return true;
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ usuario: null });
  },

  refresh: async () => {
    const current = get().usuario;
    if (!current) return;
    const usuario = await getUsuarioById(current.id);
    set({ usuario });
  },
}));
