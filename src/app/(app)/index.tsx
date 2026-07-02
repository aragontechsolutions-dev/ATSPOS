import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, IconButton, Modal, Portal, RadioButton, Text, TextInput } from 'react-native-paper';

import { BarcodeScannerModal } from '@/components/barcode-scanner';
import { turnoAbiertoDe, type Turno } from '@/db/repositories/caja';
import { buscarPorCodigoBarras, listarProductos, type Producto } from '@/db/repositories/productos';
import { registrarVenta, type MetodoPago } from '@/db/repositories/ventas';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { useCartStore } from '@/store/cart';
import { useSessionStore } from '@/store/session';

export default function VentaScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const router = useRouter();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const { items, descuento, incrementar, decrementar, addProducto, subtotal, total } = useCartStore();

  const cargarTurno = useCallback(() => {
    if (usuario) turnoAbiertoDe(usuario.id).then(setTurno);
  }, [usuario]);

  useFocusEffect(cargarTurno);

  async function buscar(texto: string) {
    setBusqueda(texto);
    if (!texto.trim()) {
      setResultados([]);
      return;
    }
    setResultados(await listarProductos(texto));
  }

  async function onScanned(codigo: string) {
    setScannerVisible(false);
    const producto = await buscarPorCodigoBarras(codigo);
    if (producto) {
      addProducto(producto);
      setBusqueda('');
      setResultados([]);
    }
  }

  if (!usuario) return null;

  if (!turno) {
    return (
      <View style={styles.center}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          No tenés un turno de caja abierto.
        </Text>
        <Button mode="contained" onPress={() => router.push('/caja')}>
          Ir a abrir caja
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar producto por nombre o código"
          value={busqueda}
          onChangeText={buscar}
          mode="outlined"
          style={styles.search}
        />
        <IconButton icon="barcode-scan" mode="contained" onPress={() => setScannerVisible(true)} />
      </View>

      {resultados.length > 0 && (
        <FlatList
          data={resultados}
          keyExtractor={(p) => p.id}
          style={styles.resultsList}
          renderItem={({ item }) => (
            <Button
              onPress={() => {
                addProducto(item);
                setBusqueda('');
                setResultados([]);
              }}
              style={styles.resultButton}
              contentStyle={styles.resultButtonContent}
            >
              {`${item.nombre} · ${formatMoney(item.precioVenta)} (stock: ${item.stockActual})`}
            </Button>
          )}
        />
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => i.productoId}
        ItemSeparatorComponent={Divider}
        style={styles.cartList}
        renderItem={({ item }) => (
          <View style={styles.cartRow}>
            <View style={styles.cartInfo}>
              <Text variant="bodyLarge">{item.nombre}</Text>
              <Text variant="bodySmall" style={styles.cartSub}>
                {formatMoney(item.precioUnitario)} c/u
              </Text>
            </View>
            <View style={styles.qtyControls}>
              <IconButton icon="minus" size={18} onPress={() => decrementar(item.productoId)} />
              <Text variant="bodyLarge">{item.cantidad}</Text>
              <IconButton icon="plus" size={18} onPress={() => incrementar(item.productoId)} />
            </View>
            <Text variant="bodyLarge" style={styles.cartLineTotal}>
              {formatMoney(item.precioUnitario * item.cantidad)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            Buscá o escaneá un producto para agregarlo a la venta.
          </Text>
        }
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text variant="titleMedium">Total</Text>
          <Text variant="titleLarge">{formatMoney(total())}</Text>
        </View>
        <Button mode="contained" disabled={items.length === 0} onPress={() => setCheckoutVisible(true)}>
          Cobrar
        </Button>
      </View>

      <BarcodeScannerModal visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={onScanned} />

      <Portal>
        <Modal
          visible={checkoutVisible}
          onDismiss={() => setCheckoutVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <CheckoutForm
            turnoId={turno.id}
            usuarioId={usuario.id}
            subtotal={subtotal()}
            descuento={descuento}
            total={total()}
            onClose={() => setCheckoutVisible(false)}
          />
        </Modal>
      </Portal>
    </View>
  );
}

interface CheckoutProps {
  turnoId: string;
  usuarioId: string;
  subtotal: number;
  descuento: number;
  total: number;
  onClose: () => void;
}

function CheckoutForm({ turnoId, usuarioId, subtotal, descuento, total, onClose }: CheckoutProps) {
  const { items, clear } = useCartStore();
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [montoRecibidoInput, setMontoRecibidoInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [confirmada, setConfirmada] = useState<{ vuelto: number | null } | null>(null);

  const montoRecibido = metodoPago === 'efectivo' ? parseMoneyInput(montoRecibidoInput) : total;
  const vuelto = metodoPago === 'efectivo' ? montoRecibido - total : 0;

  async function confirmar() {
    if (metodoPago === 'efectivo' && montoRecibido < total) {
      setError('El monto recibido es menor al total');
      return;
    }
    setError(null);
    setProcesando(true);
    try {
      const resultado = await registrarVenta({
        turnoId,
        usuarioId,
        metodoPago,
        descuento,
        montoRecibido: metodoPago === 'efectivo' ? montoRecibido : undefined,
        items: items.map((i) => ({
          productoId: i.productoId,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          costoUnitario: i.costoUnitario,
        })),
      });
      setConfirmada({ vuelto: resultado.vuelto });
      clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la venta');
    } finally {
      setProcesando(false);
    }
  }

  if (confirmada) {
    return (
      <View>
        <Text variant="titleLarge" style={styles.confirmTitle}>
          Venta registrada
        </Text>
        {confirmada.vuelto != null && confirmada.vuelto > 0 && (
          <Text variant="titleMedium" style={styles.confirmVuelto}>
            Vuelto: {formatMoney(confirmada.vuelto)}
          </Text>
        )}
        <Button mode="contained" onPress={onClose}>
          Listo
        </Button>
      </View>
    );
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.modalTitle}>
        Cobrar {formatMoney(total)}
      </Text>

      <RadioButton.Group onValueChange={(v) => setMetodoPago(v as MetodoPago)} value={metodoPago}>
        {(['efectivo', 'debito', 'credito', 'transferencia'] as MetodoPago[]).map((m) => (
          <RadioButton.Item key={m} label={m} value={m} />
        ))}
      </RadioButton.Group>

      {metodoPago === 'efectivo' && (
        <>
          <TextInput
            label="Monto recibido"
            value={montoRecibidoInput}
            onChangeText={setMontoRecibidoInput}
            mode="outlined"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          {montoRecibidoInput.length > 0 && (
            <Text variant="bodyMedium" style={styles.vuelto}>
              Vuelto: {formatMoney(Math.max(vuelto, 0))}
            </Text>
          )}
        </>
      )}

      {error && (
        <Text style={styles.error} variant="bodyMedium">
          {error}
        </Text>
      )}

      <View style={styles.formActions}>
        <Button onPress={onClose} disabled={procesando}>
          Cancelar
        </Button>
        <Button mode="contained" onPress={confirmar} loading={procesando} disabled={procesando}>
          Confirmar
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyText: { textAlign: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  search: { flex: 1 },
  resultsList: { maxHeight: 160, marginTop: 4 },
  resultButton: { justifyContent: 'flex-start' },
  resultButtonContent: { justifyContent: 'flex-start' },
  cartList: { flex: 1, marginTop: 8 },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  cartInfo: { flex: 1 },
  cartSub: { opacity: 0.7 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  cartLineTotal: { width: 90, textAlign: 'right' },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ccc', paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, maxHeight: '90%' },
  modalTitle: { marginBottom: 8, textAlign: 'center' },
  input: { marginTop: 8 },
  vuelto: { textAlign: 'center', marginTop: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  error: { color: '#B00020', marginTop: 8, textAlign: 'center' },
  confirmTitle: { textAlign: 'center', marginBottom: 12 },
  confirmVuelto: { textAlign: 'center', marginBottom: 16 },
});
