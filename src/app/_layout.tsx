import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';

import { DatabaseProvider } from '@/db/provider';
import { useSessionStore } from '@/store/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

  return (
    <PaperProvider theme={theme} settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}>
      <DatabaseProvider>
        <SessionGate />
      </DatabaseProvider>
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
  );
}
