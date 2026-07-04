import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Dialog, Divider, HelperText, Portal, Text, TextInput } from 'react-native-paper';

import { turnoAbiertoDe } from '@/db/repositories/caja';
import {
  getClienteById,
  movimientosDeCliente,
  registrarPago,
  type Cliente,
  type MovimientoCliente,
} from '@/db/repositories/clientes';
import { auditar } from '@/lib/audit';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { useSessionStore } from '@/store/session';

function fechaLegible(d: Date): string {
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ClienteDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const usuario = useSessionStore((s) => s.usuario);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCliente[]>([]);
  const [dialogo, setDialogo] = useState(false);
  const [montoInput, setMontoInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    getClienteById(id).then(setCliente);
    movimientosDeCliente(id).then(setMovimientos);
  }, [id]);

  useFocusEffect(cargar);

  async function onRegistrarPago() {
    if (!usuario || !cliente) return;
    const monto = parseMoneyInput(montoInput);
    if (monto <= 0) {
      setError('Ingresá un monto válido');
      return;
    }
    setError(null);
    setProcesando(true);
    try {
      const turno = await turnoAbiertoDe(usuario.id);
      await registrarPago({
        clienteId: cliente.id,
        monto,
        usuarioId: usuario.id,
        turnoId: turno?.id ?? null,
        clienteNombre: cliente.nombre,
      });
      auditar('Pago de fiado', `${cliente.nombre}: ${formatMoney(monto)}`);
      setDialogo(false);
      setMontoInput('');
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago');
    } finally {
      setProcesando(false);
    }
  }

  if (!cliente) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Card.Content style={styles.header}>
          <Text variant="titleLarge">{cliente.nombre}</Text>
          {cliente.telefono && <Text variant="bodyMedium">{cliente.telefono}</Text>}
          <Text variant="headlineSmall" style={cliente.saldo > 0 ? styles.debe : styles.aldia}>
            {cliente.saldo > 0 ? `Debe ${formatMoney(cliente.saldo)}` : 'Al día'}
          </Text>
        </Card.Content>
      </Card>

      {cliente.saldo > 0 && (
        <Button icon="cash" mode="contained" onPress={() => setDialogo(true)} style={styles.btn}>
          Registrar pago
        </Button>
      )}

      <Text variant="titleSmall" style={styles.sectionTitle}>
        Movimientos
      </Text>
      <Card>
        <Card.Content>
          {movimientos.length === 0 ? (
            <Text style={styles.empty} variant="bodyMedium">
              Sin movimientos.
            </Text>
          ) : (
            movimientos.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <Divider />}
                <View style={styles.movRow}>
                  <Text variant="bodyMedium">
                    {m.tipo === 'cargo' ? 'Compra fiada' : 'Pago'}
                    {'  '}
                    <Text variant="bodySmall">{fechaLegible(m.fecha)}</Text>
                  </Text>
                  <Text style={m.tipo === 'cargo' ? styles.debe : styles.aldia}>
                    {m.tipo === 'cargo' ? '+' : '-'}
                    {formatMoney(m.monto)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Portal>
        <Dialog visible={dialogo} onDismiss={() => !procesando && setDialogo(false)}>
          <Dialog.Title>Registrar pago</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogInfo}>
              Deuda actual: {formatMoney(cliente.saldo)}
            </Text>
            <TextInput
              label="Monto del pago"
              value={montoInput}
              onChangeText={setMontoInput}
              mode="outlined"
              keyboardType="decimal-pad"
            />
            {error && <HelperText type="error">{error}</HelperText>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogo(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={onRegistrarPago} loading={procesando} disabled={procesando}>
              Registrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 12, gap: 10 },
  header: { alignItems: 'center', gap: 4 },
  debe: { color: '#B3261E' },
  aldia: { color: '#0B6E4F' },
  btn: { marginTop: 4 },
  sectionTitle: { marginTop: 8, marginLeft: 4 },
  movRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  empty: { textAlign: 'center', opacity: 0.6, paddingVertical: 8 },
  dialogInfo: { marginBottom: 12 },
});
