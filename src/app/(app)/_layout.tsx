import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { IconButton, useTheme } from 'react-native-paper';

import { tienePermiso } from '@/lib/roles';
import { useSessionStore } from '@/store/session';

export default function AppTabsLayout() {
  const usuario = useSessionStore((s) => s.usuario);
  const router = useRouter();
  const theme = useTheme();
  const puedeGestionarProductos = usuario ? tienePermiso(usuario.rol, 'gestionarProductos') : false;
  const puedeAjustarStock = usuario ? tienePermiso(usuario.rol, 'ajustarStock') : false;
  const puedeVerReportes = usuario ? tienePermiso(usuario.rol, 'verReportes') : false;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.onPrimary,
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        sceneStyle: { backgroundColor: theme.colors.background },
        headerRight: () => (
          <IconButton
            icon="cog"
            iconColor={theme.colors.onPrimary}
            onPress={() => router.push('/ajustes')}
            accessibilityLabel="Ajustes"
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Venta',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cash-register" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="productos"
        options={{
          title: 'Productos',
          href: puedeGestionarProductos ? undefined : null,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="package-variant" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inventario"
        options={{
          title: 'Inventario',
          href: puedeGestionarProductos || puedeAjustarStock ? undefined : null,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="warehouse" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="caja"
        options={{
          title: 'Caja',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cash" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          href: puedeVerReportes ? undefined : null,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-box" color={color} size={size} />,
        }}
      />

      {/* Rutas navegables por push, ocultas de la barra de tabs. */}
      <Tabs.Screen name="ajustes" options={{ href: null, title: 'Ajustes' }} />
      <Tabs.Screen name="proveedores" options={{ href: null, title: 'Proveedores' }} />
      <Tabs.Screen name="compras" options={{ href: null, title: 'Nueva compra' }} />
      <Tabs.Screen name="ajuste-stock" options={{ href: null, title: 'Ajuste de stock' }} />
      <Tabs.Screen name="producto-qr" options={{ href: null, title: 'Código QR' }} />
      <Tabs.Screen name="seguridad" options={{ href: null, title: 'Seguridad' }} />
      <Tabs.Screen name="auditoria" options={{ href: null, title: 'Auditoría' }} />
    </Tabs>
  );
}
