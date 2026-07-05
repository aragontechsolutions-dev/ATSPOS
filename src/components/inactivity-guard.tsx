import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { AVISO_CIERRE_MS, useSessionStore } from '@/store/session';

/**
 * Enforces the inactivity timeout while a user is logged in and warns the user
 * 30 s before the session is closed, with a live countdown and a "stay
 * connected" button. Any interaction (captured at the root) resets the timer,
 * so tapping anywhere also dismisses the warning.
 */
export function InactivityGuard() {
  const usuario = useSessionStore((s) => s.usuario);
  const logout = useSessionStore((s) => s.logout);
  const touch = useSessionStore((s) => s.touch);
  const checkExpiry = useSessionStore((s) => s.checkExpiry);
  const flushActivity = useSessionStore((s) => s.flushActivity);
  const msHastaCierre = useSessionStore((s) => s.msHastaCierre);

  const [aviso, setAviso] = useState(false);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (!usuario) {
      setAviso(false);
      return;
    }

    const tick = () => {
      const ms = msHastaCierre();
      if (ms <= 0) {
        setAviso(false);
        logout();
        return;
      }
      const enVentana = ms <= AVISO_CIERRE_MS;
      setAviso(enVentana);
      if (enVentana) setSegundos(Math.ceil(ms / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkExpiry();
        tick();
      } else {
        flushActivity();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [usuario, logout, checkExpiry, flushActivity, msHastaCierre]);

  function seguirConectado() {
    touch();
    setAviso(false);
  }

  return (
    <Portal>
      <Dialog visible={aviso} dismissable={false}>
        <Dialog.Icon icon="clock-alert-outline" />
        <Dialog.Title style={{ textAlign: 'center' }}>Sesión por cerrarse</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
            Por inactividad, tu sesión se cerrará en {segundos} segundo{segundos === 1 ? '' : 's'}.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button mode="contained" onPress={seguirConectado}>
            Seguir conectado
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
