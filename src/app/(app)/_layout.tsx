import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { tienePermiso } from '@/lib/roles';
import { useSessionStore } from '@/store/session';

export default function AppTabsLayout() {
  const usuario = useSessionStore((s) => s.usuario);
  const puedeGestionarProductos = usuario ? tienePermiso(usuario.rol, 'gestionarProductos') : false;

  return (
    <Tabs screenOptions={{ headerShown: true }}>
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
        name="caja"
        options={{
          title: 'Caja',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cash" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
