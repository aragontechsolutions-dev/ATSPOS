import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, Modal, Portal, RadioButton, Text, TextInput } from 'react-native-paper';

import {
  abrirTurno,
  cerrarTurno,
  movimientosDelTurno,
  previsualizarCierre,
  registrarMovimientoCaja,
  turnoAbiertoDe,
  type Turno,
} from '@/db/repositories/caja';
import { ventasDelTurno } from '@/db/repositories/ventas';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { useSessionStore } from '@/store/session';

type MovimientoCaja = Awaited<ReturnType<typeof movimientosDelTurno>>[number];
type VentaResumen = Awaited<ReturnType<typeof ventasDelTurno>>[number];

export default function CajaScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [movimientoModalVisible, setMovimientoModalVisible] = useState(false);
  const [cierreModalVisible, setCierreModalVisible] = useState(false);

  const cargar = useCallback(() => {
    if (!usuario) return;
    turnoAbiertoDe(usuario.id).then((t) => {
      setTurno(t);
      if (t) {
        movimientosDelTurno(t.id).then(setMovimientos);
        ventasDelTurno(t.id).then(setVentas);
      }
    });
  }, [usuario]);

  useFocusEffect(cargar);

  if (!usuario) return null;

  if (!turno) {
    return <AbrirTurnoForm usuarioId={usuario.id} onAbierto={cargar} />;
  }

  const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);

  return (
    <View style={styles.container}>
      <View style={styles.resumen}>
        <Text variant="titleMedium">Turno abierto</Text>
        <Text variant="bodyMedium">Base inicial: {formatMoney(turno.baseInicial)}</Text>
        <Text variant="bodyMedium">Ventas del turno: {formatMoney(totalVentas)} ({ventas.length})</Text>
      </View>

      <Divider />

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => setMovimientoModalVisible(true)} style={styles.actionButton}>
          Ingreso / egreso
        </Button>
        <Button mode="contained" onPress={() => setCierreModalVisible(true)} style={styles.actionButton}>
          Cerrar turno
        </Button>
      </View>

      <Text variant="titleSmall" style={styles.sectionTitle}>
        Movimientos de caja
      </Text>
      <FlatList
        data={movimientos}
        keyExtractor={(m) => m.id}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => (
          <View style={styles.movRow}>
            <Text>{item.motivo || item.tipo}</Text>
            <Text style={item.tipo === 'egreso' ? styles.egreso : styles.ingreso}>
              {item.tipo === 'egreso' ? '-' : '+'}
              {formatMoney(item.monto)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            Sin ingresos o egresos registrados.
          </Text>
        }
      />

      <Portal>
        <Modal
          visible={movimientoModalVisible}
          onDismiss={() => setMovimientoModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <MovimientoCajaForm
            turnoId={turno.id}
            onDone={() => {
              setMovimientoModalVisible(false);
              cargar();
            }}
            onCancel={() => setMovimientoModalVisible(false)}
          />
        </Modal>

        <Modal
          visible={cierreModalVisible}
          onDismiss={() => setCierreModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <CierreTurnoForm
            turnoId={turno.id}
            onDone={() => {
              setCierreModalVisible(false);
              cargar();
            }}
            onCancel={() => setCierreModalVisible(false)}
          />
        </Modal>
      </Portal>
    </View>
  );
}

function AbrirTurnoForm({ usuarioId, onAbierto }: { usuarioId: string; onAbierto: () => void }) {
  const [baseInicial, setBaseInicial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await abrirTurno(usuarioId, parseMoneyInput(baseInicial || '0'));
      onAbierto();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el turno');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.center}>
      <Text variant="titleMedium" style={styles.centerTitle}>
        Abrir turno de caja
      </Text>
      <TextInput
        label="Fondo inicial (efectivo en caja)"
        value={baseInicial}
        onChangeText={setBaseInicial}
        mode="outlined"
        keyboardType="decimal-pad"
        style={styles.input}
      />
      {error && (
        <Text style={styles.error} variant="bodyMedium">
          {error}
        </Text>
      )}
      <Button mode="contained" onPress={onSubmit} loading={loading} disabled={loading}>
        Abrir turno
      </Button>
    </View>
  );
}

function MovimientoCajaForm({
  turnoId,
  onDone,
  onCancel,
}: {
  turnoId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    const centavos = parseMoneyInput(monto);
    if (centavos <= 0) {
      setError('Ingresá un monto válido');
      return;
    }
    setError(null);
    await registrarMovimientoCaja({ turnoId, tipo, monto: centavos, motivo: motivo.trim() || undefined });
    onDone();
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.modalTitle}>
        Ingreso / egreso de caja
      </Text>
      <RadioButton.Group onValueChange={(v) => setTipo(v as 'ingreso' | 'egreso')} value={tipo}>
        <RadioButton.Item label="Egreso (retiro, pago a proveedor)" value="egreso" />
        <RadioButton.Item label="Ingreso" value="ingreso" />
      </RadioButton.Group>
      <TextInput
        label="Monto"
        value={monto}
        onChangeText={setMonto}
        mode="outlined"
        keyboardType="decimal-pad"
        style={styles.input}
      />
      <TextInput label="Motivo" value={motivo} onChangeText={setMotivo} mode="outlined" style={styles.input} />
      {error && (
        <Text style={styles.error} variant="bodyMedium">
          {error}
        </Text>
      )}
      <View style={styles.formActions}>
        <Button onPress={onCancel}>Cancelar</Button>
        <Button mode="contained" onPress={onSubmit}>
          Guardar
        </Button>
      </View>
    </View>
  );
}

function CierreTurnoForm({ turnoId, onDone, onCancel }: { turnoId: string; onDone: () => void; onCancel: () => void }) {
  const [efectivoEsperado, setEfectivoEsperado] = useState<number | null>(null);
  const [contado, setContado] = useState('');
  const [resultado, setResultado] = useState<{ diferencia: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      previsualizarCierre(turnoId).then(setEfectivoEsperado);
    }, [turnoId]),
  );

  async function onSubmit() {
    const turno = await cerrarTurno(turnoId, parseMoneyInput(contado || '0'));
    setResultado({ diferencia: turno.diferencia ?? 0 });
  }

  if (resultado) {
    return (
      <View>
        <Text variant="titleMedium" style={styles.modalTitle}>
          Turno cerrado
        </Text>
        <Text variant="bodyLarge" style={styles.centerTitle}>
          {resultado.diferencia === 0
            ? 'Caja exacta'
            : resultado.diferencia > 0
              ? `Sobrante: ${formatMoney(resultado.diferencia)}`
              : `Faltante: ${formatMoney(Math.abs(resultado.diferencia))}`}
        </Text>
        <Button mode="contained" onPress={onDone}>
          Listo
        </Button>
      </View>
    );
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.modalTitle}>
        Cierre de turno (arqueo)
      </Text>
      <Text variant="bodyMedium" style={styles.centerTitle}>
        Efectivo esperado: {efectivoEsperado != null ? formatMoney(efectivoEsperado) : '...'}
      </Text>
      <TextInput
        label="Efectivo contado"
        value={contado}
        onChangeText={setContado}
        mode="outlined"
        keyboardType="decimal-pad"
        style={styles.input}
      />
      <View style={styles.formActions}>
        <Button onPress={onCancel}>Cancelar</Button>
        <Button mode="contained" onPress={onSubmit}>
          Confirmar cierre
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerTitle: { textAlign: 'center', marginBottom: 12 },
  resumen: { paddingVertical: 8, gap: 4 },
  actions: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  actionButton: { flex: 1 },
  sectionTitle: { marginTop: 8, marginBottom: 4 },
  movRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  ingreso: { color: '#2E7D32' },
  egreso: { color: '#B00020' },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.6 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, maxHeight: '90%' },
  modalTitle: { marginBottom: 12, textAlign: 'center' },
  input: { marginBottom: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  error: { color: '#B00020', marginBottom: 8, textAlign: 'center' },
});
