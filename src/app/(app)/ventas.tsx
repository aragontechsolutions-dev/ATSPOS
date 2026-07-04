import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

import { listarVentas, type Venta } from '@/db/repositories/ventas';
import { formatMoney } from '@/lib/money';

function fechaLegible(d: Date): string {
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VentasScreen() {
  const router = useRouter();
  const [ventas, setVentas] = useState<Venta[]>([]);

  useFocusEffect(
    useCallback(() => {
      listarVentas().then(setVentas);
    }, []),
  );

  return (
    <FlatList
      data={ventas}
      keyExtractor={(v) => v.id}
      ItemSeparatorComponent={Divider}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <List.Item
          title={`${formatMoney(item.total)} · ${item.metodoPago}`}
          titleStyle={item.anulada ? styles.anulada : undefined}
          description={`${fechaLegible(item.fecha)}${item.anulada ? ' · ANULADA' : ''}`}
          left={(props) => <List.Icon {...props} icon={item.anulada ? 'cancel' : 'receipt'} color={item.anulada ? '#B3261E' : undefined} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push(`/venta-detalle?id=${item.id}`)}
        />
      )}
      ListEmptyComponent={
        <Text style={styles.empty} variant="bodyMedium">
          No hay ventas registradas todavía.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  anulada: { textDecorationLine: 'line-through', opacity: 0.6 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
});
