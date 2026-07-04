import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, Modal, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { auditar } from '@/lib/audit';
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
        <Button
          icon="swap-vertical"
          mode="outlined"
          onPress={() => setMovimientoModalVisible(true)}
          style={styles.actionButton}
        >
          Ingreso / egreso
        </Button>
        <Button
          icon="lock-check"
          mode="contained"
          onPress={() => setCierreModalVisible(true)}
          style={styles.actionButton}
        >
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
      const base = parseMoneyInput(baseInicial || '0');
      await abrirTurno(usuarioId, base);
      auditar('Apertura de caja', `Base inicial: ${formatMoney(base)}`);
      onAbierto();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el turno');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.abrirContainer}>
      <View style={styles.abrirInner}>
        <Text variant="titleLarge" style={styles.centerTitle}>
          Abrir turno de caja
        </Text>
        <TextInput
          label="Fondo inicial (efectivo en caja)"
          value={baseInicial}
          onChangeText={setBaseInicial}
          mode="outlined"
          keyboardType="decimal-pad"
          dense
          style={styles.abrirInput}
        />
        {error && (
          <Text style={styles.error} variant="bodyMedium">
            {error}
          </Text>
        )}
        <Button
          icon="lock-open-variant"
          mode="contained"
          onPress={onSubmit}
          loading={loading}
          disabled={loading}
          style={styles.abrirBoton}
        >
          Abrir turno
        </Button>
      </View>
    </SafeAreaView>
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
    auditar(
      tipo === 'ingreso' ? 'Ingreso de caja' : 'Egreso de caja',
      `${formatMoney(centavos)}${motivo.trim() ? ` · ${motivo.trim()}` : ''}`,
    );
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
        <Button icon="close" onPress={onCancel}>
          Cancelar
        </Button>
        <Button icon="content-save" mode="contained" onPress={onSubmit}>
          Guardar
        </Button>
      </View>
    </View>
  );
}

function CierreTurnoForm({ turnoId, onDone, onCancel }: { turnoId: string; onDone: () => void; onCancel: () => void }) {
  const [efectivoEsperado, setEfectivoEsperado] = useState<number | null>(null);
  const [contado, setContado] = useState('');
  const [reconciliando, setReconciliando] = useState(false);
  const [resultado, setResultado] = useState<{ diferencia: number } | null>(null);

  const recargarEsperado = useCallback(() => {
    previsualizarCierre(turnoId).then(setEfectivoEsperado);
  }, [turnoId]);

  useFocusEffect(recargarEsperado);

  const contadoNum = parseMoneyInput(contado || '0');
  const contadoIngresado = contado.trim().length > 0;
  const diferencia = efectivoEsperado != null ? contadoNum - efectivoEsperado : 0;
  const hayDescuadre = contadoIngresado && diferencia !== 0;

  async function reconciliar() {
    if (!contadoIngresado || diferencia === 0) return;
    setReconciliando(true);
    try {
      // Documenta el descuadre como movimiento de caja para que el esperado
      // pase a coincidir con lo contado y se pueda cerrar cuadrado.
      await registrarMovimientoCaja({
        turnoId,
        tipo: diferencia > 0 ? 'ingreso' : 'egreso',
        monto: Math.abs(diferencia),
        motivo: diferencia > 0 ? 'Ajuste de cierre (sobrante)' : 'Ajuste de cierre (faltante)',
      });
      auditar(
        'Ajuste de descuadre',
        `${diferencia > 0 ? 'Sobrante' : 'Faltante'}: ${formatMoney(Math.abs(diferencia))}`,
      );
      recargarEsperado();
    } finally {
      setReconciliando(false);
    }
  }

  async function onSubmit() {
    if (hayDescuadre) return;
    const turno = await cerrarTurno(turnoId, contadoNum);
    auditar(
      'Cierre de caja',
      `Esperado: ${formatMoney(turno.efectivoEsperado ?? 0)} · Contado: ${formatMoney(turno.efectivoContado ?? 0)}`,
    );
    setResultado({ diferencia: turno.diferencia ?? 0 });
  }

  if (resultado) {
    return (
      <View>
        <Text variant="titleMedium" style={styles.modalTitle}>
          Turno cerrado
        </Text>
        <Text variant="bodyLarge" style={styles.centerTitle}>
          Caja cuadrada ✓
        </Text>
        <Button icon="check" mode="contained" onPress={onDone}>
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

      {hayDescuadre && (
        <View style={styles.descuadreBox}>
          <Text variant="titleMedium" style={styles.egreso}>
            {diferencia > 0
              ? `Sobrante: ${formatMoney(diferencia)}`
              : `Faltante: ${formatMoney(Math.abs(diferencia))}`}
          </Text>
          <Text variant="bodySmall" style={styles.centerTitle}>
            No se puede cerrar con descuadre. Recontá el efectivo o registrá el ajuste para dejar la caja cuadrada.
          </Text>
          <Button
            icon="scale-balance"
            mode="contained-tonal"
            onPress={reconciliar}
            loading={reconciliando}
            disabled={reconciliando}
          >
            Registrar ajuste de {diferencia > 0 ? 'sobrante' : 'faltante'}
          </Button>
        </View>
      )}

      <View style={styles.formActions}>
        <Button icon="close" onPress={onCancel}>
          Cancelar
        </Button>
        <Button icon="lock-check" mode="contained" onPress={onSubmit} disabled={!contadoIngresado || hayDescuadre}>
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
  abrirContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 32 },
  abrirInner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  abrirInput: { marginBottom: 16 },
  abrirBoton: { paddingVertical: 4 },
  resumen: { paddingVertical: 8, gap: 4 },
  actions: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  actionButton: { flex: 1 },
  sectionTitle: { marginTop: 8, marginBottom: 4 },
  movRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  ingreso: { color: '#2E7D32' },
  egreso: { color: '#B00020', textAlign: 'center' },
  descuadreBox: { gap: 8, marginBottom: 12, alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.6 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, maxHeight: '90%' },
  modalTitle: { marginBottom: 12, textAlign: 'center' },
  input: { marginBottom: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  error: { color: '#B00020', marginBottom: 8, textAlign: 'center' },
});
