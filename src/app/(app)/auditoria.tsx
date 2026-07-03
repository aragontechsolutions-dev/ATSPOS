import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

import { listarAuditoria, type RegistroAuditoria } from '@/db/repositories/auditoria';

function fechaLegible(ms: Date): string {
  return ms.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditoriaScreen() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);

  useFocusEffect(
    useCallback(() => {
      listarAuditoria().then(setRegistros);
    }, []),
  );

  return (
    <FlatList
      data={registros}
      keyExtractor={(r) => r.id}
      ItemSeparatorComponent={Divider}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <List.Item
          title={item.accion}
          description={`${item.detalle ? item.detalle + '\n' : ''}${item.usuarioNombre ?? 'Sistema'} · ${fechaLegible(item.fecha)}`}
          descriptionNumberOfLines={3}
        />
      )}
      ListEmptyComponent={
        <Text style={styles.empty} variant="bodyMedium">
          No hay acciones registradas todavía.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
});
