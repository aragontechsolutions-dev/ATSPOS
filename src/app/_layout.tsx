import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { InactivityGuard } from '@/components/inactivity-guard';
import { DatabaseProvider } from '@/db/provider';
import { useSessionStore } from '@/store/session';
import { appTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const touch = useSessionStore((s) => s.touch);
  return (
    <PaperProvider theme={appTheme} settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}>
      <StatusBar style="dark" />
      {/* Capture-phase responder records activity on every touch without
          interfering with the actual gesture (always returns false). */}
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          touch();
          return false;
        }}
      >
        <DatabaseProvider>
          <SessionGate />
        </DatabaseProvider>
      </View>
    </PaperProvider>
  );
}

function SessionGate() {
  const { usuario, bootstrapped, bootstrap } = useSessionStore();

  useEffect(() => {
    bootstrap().finally(() => SplashScreen.hideAsync());
  }, [bootstrap]);

  if (!bootstrapped) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <InactivityGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!usuario}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={!!usuario?.debeCambiarPassword}>
          <Stack.Screen name="cambiar-password" />
        </Stack.Protected>
        <Stack.Protected guard={!!usuario && !usuario.debeCambiarPassword}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
