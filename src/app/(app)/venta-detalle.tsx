import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Dialog, Divider, HelperText, Portal, Text, TextInput } from 'react-native-paper';

import { anularVenta, getVentaConDetalle, type VentaConDetalle } from '@/db/repositories/ventas';
import { auditar } from '@/lib/audit';
import { formatMoney } from '@/lib/money';
import { tienePermiso } from '@/lib/roles';
import { imprimirTicket } from '@/lib/ticket';
import { useSessionStore } from '@/store/session';

function fechaLegible(d: Date): string {
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VentaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const usuario = useSessionStore((s) => s.usuario);
  const puedeAnular = usuario ? tienePermiso(usuario.rol, 'anularVentas') : false;

  const [data, setData] = useState<VentaConDetalle | null>(null);
  const [dialogo, setDialogo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(() => {
    if (id) getVentaConDetalle(id).then(setData);
  }, [id]);

  useFocusEffect(cargar);

  async function onAnular() {
    if (!usuario || !data) return;
    if (!motivo.trim()) {
      setError('Ingresá el motivo de la anulación');
      return;
    }
    setError(null);
    setProcesando(true);
    try {
      await anularVenta(data.venta.id, usuario.id, motivo.trim());
      auditar('Anulación de venta', `${formatMoney(data.venta.total)} · ${motivo.trim()}`);
      setDialogo(false);
      setMotivo('');
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular la venta');
    } finally {
      setProcesando(false);
    }
  }

  function reimprimir() {
    if (!data) return;
    imprimirTicket({
      fecha: data.venta.fecha,
      items: data.lineas.map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      subtotal: data.venta.subtotal,
      descuento: data.venta.descuento,
      total: data.venta.total,
      metodoPago: data.venta.metodoPago,
      montoRecibido: data.venta.montoRecibido,
      vuelto: data.venta.vuelto,
      anulada: data.venta.anulada,
    });
  }

  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const { venta, lineas } = data;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {venta.anulada && (
        <Card style={styles.anuladaCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.anuladaText}>
              Venta ANULADA
            </Text>
            {venta.anuladaMotivo && <Text variant="bodyMedium">Motivo: {venta.anuladaMotivo}</Text>}
          </Card.Content>
        </Card>
      )}

      <Card>
        <Card.Content>
          <Text variant="bodyMedium">{fechaLegible(venta.fecha)}</Text>
          <Text variant="bodyMedium">Pago: {venta.metodoPago}</Text>
          <Divider style={styles.divider} />
          {lineas.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text variant="bodyMedium" style={styles.rowName}>
                {l.nombre}
                {'\n'}
                <Text variant="bodySmall">
                  {l.cantidad} x {formatMoney(l.precioUnitario)}
                </Text>
              </Text>
              <Text variant="bodyMedium">{formatMoney(l.precioUnitario * l.cantidad)}</Text>
            </View>
          ))}
          <Divider style={styles.divider} />
          <View style={styles.row}>
            <Text variant="bodyMedium">Subtotal</Text>
            <Text variant="bodyMedium">{formatMoney(venta.subtotal)}</Text>
          </View>
          {venta.descuento > 0 && (
            <View style={styles.row}>
              <Text variant="bodyMedium">Descuento</Text>
              <Text variant="bodyMedium">-{formatMoney(venta.descuento)}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text variant="titleMedium">Total</Text>
            <Text variant="titleMedium">{formatMoney(venta.total)}</Text>
          </View>
        </Card.Content>
      </Card>

      <Button icon="printer" mode="outlined" onPress={reimprimir} style={styles.btn}>
        Imprimir ticket
      </Button>
      {puedeAnular && !venta.anulada && (
        <Button icon="cancel" mode="contained" buttonColor="#B3261E" onPress={() => setDialogo(true)} style={styles.btn}>
          Anular venta
        </Button>
      )}

      <Portal>
        <Dialog visible={dialogo} onDismiss={() => !procesando && setDialogo(false)}>
          <Dialog.Title>Anular venta</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.warn}>
              Se repondrá el stock de los productos y la venta dejará de contar en los reportes.
            </Text>
            <TextInput label="Motivo" value={motivo} onChangeText={setMotivo} mode="outlined" />
            {error && <HelperText type="error">{error}</HelperText>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogo(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={onAnular} loading={procesando} disabled={procesando}>
              Anular
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
  anuladaCard: { backgroundColor: '#FADAD7' },
  anuladaText: { color: '#B3261E' },
  divider: { marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowName: { flex: 1, paddingRight: 8 },
  btn: { marginTop: 4 },
  warn: { marginBottom: 12 },
});
