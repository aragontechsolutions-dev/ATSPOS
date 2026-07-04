import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, List, SegmentedButtons, Snackbar, Text } from 'react-native-paper';

import {
  inventarioParaExport,
  resumenInventario,
  resumenVentas,
  topProductos,
  ventasParaExport,
  ventasPorCategoria,
  ventasPorMetodoPago,
  type InventarioResumen,
  type ResumenVentas,
  type TopProducto,
  type VentasPorClave,
} from '@/db/repositories/reportes';
import { exportarInventario, exportarReporteVentas } from '@/lib/export-excel';
import { formatMoney } from '@/lib/money';
import { PERIODOS, rangoDePeriodo, type Periodo } from '@/lib/periodo';

export default function ReportesScreen() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [ventas, setVentas] = useState<ResumenVentas | null>(null);
  const [inventario, setInventario] = useState<InventarioResumen | null>(null);
  const [top, setTop] = useState<TopProducto[]>([]);
  const [porMetodo, setPorMetodo] = useState<VentasPorClave[]>([]);
  const [porCategoria, setPorCategoria] = useState<VentasPorClave[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(() => {
    const rango = rangoDePeriodo(periodo);
    resumenVentas(rango).then(async (rv) => {
      setVentas(rv);
      setInventario(await resumenInventario(rv.costoMercaderia));
    });
    topProductos(rango, 5).then(setTop);
    ventasPorMetodoPago(rango).then(setPorMetodo);
    ventasPorCategoria(rango).then(setPorCategoria);
  }, [periodo]);

  useFocusEffect(cargar);

  const periodoLabel = PERIODOS.find((p) => p.value === periodo)?.label ?? '';

  async function onExportarVentas() {
    setExportando(true);
    try {
      const rango = rangoDePeriodo(periodo);
      const [rv, filas, tp, pm, pc] = await Promise.all([
        resumenVentas(rango),
        ventasParaExport(rango),
        topProductos(rango, 20),
        ventasPorMetodoPago(rango),
        ventasPorCategoria(rango),
      ]);
      const compartido = await exportarReporteVentas({
        periodoLabel,
        resumen: rv,
        ventas: filas,
        topProductos: tp,
        porMetodo: pm,
        porCategoria: pc,
      });
      if (!compartido) setSnackbar('Compartir no está disponible en este dispositivo');
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportando(false);
    }
  }

  async function onExportarInventario() {
    setExportando(true);
    try {
      const filas = await inventarioParaExport();
      const compartido = await exportarInventario(filas);
      if (!compartido) setSnackbar('Compartir no está disponible en este dispositivo');
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SegmentedButtons
        value={periodo}
        onValueChange={(v) => setPeriodo(v as Periodo)}
        buttons={PERIODOS.map((p) => ({ value: p.value, label: p.label }))}
      />

      <Card>
        <List.Item
          title="Historial de ventas"
          description="Ver, reimprimir o anular ventas"
          left={(props) => <List.Icon {...props} icon="receipt-text" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/ventas')}
        />
      </Card>

      <View style={styles.kpiGrid}>
        <KpiCard label="Ventas" value={formatMoney(ventas?.totalVentas ?? 0)} />
        <KpiCard label="Tickets" value={String(ventas?.cantidadTickets ?? 0)} />
        <KpiCard label="Ticket promedio" value={formatMoney(ventas?.ticketPromedio ?? 0)} />
        <KpiCard label="Margen bruto" value={formatMoney(ventas?.margenBruto ?? 0)} />
        <KpiCard
          label="Margen %"
          value={`${(ventas?.margenPorcentaje ?? 0).toFixed(1)}%`}
        />
        <KpiCard label="Valor inventario" value={formatMoney(inventario?.valorInventario ?? 0)} />
        <KpiCard label="Bajo stock" value={String(inventario?.productosBajoStock ?? 0)} />
        <KpiCard
          label="Rotación"
          value={inventario?.rotacion != null ? inventario.rotacion.toFixed(2) : '—'}
        />
      </View>

      <SeccionLista titulo="Productos más vendidos" vacio="Sin ventas en el período">
        {top.map((p) => (
          <Row key={p.productoId} left={p.nombre} right={`${p.cantidad} u · ${formatMoney(p.totalVendido)}`} />
        ))}
      </SeccionLista>

      <SeccionLista titulo="Ventas por método de pago" vacio="Sin ventas en el período">
        {porMetodo.map((m) => (
          <Row key={m.clave} left={m.clave} right={`${formatMoney(m.total)} (${m.cantidad})`} />
        ))}
      </SeccionLista>

      <SeccionLista titulo="Ventas por categoría" vacio="Sin ventas en el período">
        {porCategoria.map((c) => (
          <Row key={c.clave} left={c.clave} right={formatMoney(c.total)} />
        ))}
      </SeccionLista>

      <Card style={styles.card}>
        <Card.Title title="Exportar a Excel" />
        <Card.Content style={styles.exportActions}>
          <Button mode="contained" icon="file-excel" onPress={onExportarVentas} loading={exportando} disabled={exportando}>
            Ventas ({periodoLabel})
          </Button>
          <Button mode="outlined" icon="file-excel" onPress={onExportarInventario} loading={exportando} disabled={exportando}>
            Inventario
          </Button>
        </Card.Content>
      </Card>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.kpiCard}>
      <Card.Content>
        <Text variant="labelMedium" style={styles.kpiLabel}>
          {label}
        </Text>
        <Text variant="titleMedium">{value}</Text>
      </Card.Content>
    </Card>
  );
}

function SeccionLista({
  titulo,
  vacio,
  children,
}: {
  titulo: string;
  vacio: string;
  children: React.ReactNode[];
}) {
  return (
    <Card style={styles.card}>
      <Card.Title title={titulo} />
      <Card.Content>
        {children.length === 0 ? (
          <Text style={styles.empty} variant="bodyMedium">
            {vacio}
          </Text>
        ) : (
          children
        )}
      </Card.Content>
    </Card>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <View>
      <View style={styles.row}>
        <Text variant="bodyMedium" style={styles.rowLeft}>
          {left}
        </Text>
        <Text variant="bodyMedium">{right}</Text>
      </View>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, gap: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { flexGrow: 1, flexBasis: '46%' },
  kpiLabel: { opacity: 0.7 },
  card: { marginTop: 2 },
  empty: { opacity: 0.6, textAlign: 'center', paddingVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLeft: { flex: 1, paddingRight: 8 },
  exportActions: { gap: 8 },
});
