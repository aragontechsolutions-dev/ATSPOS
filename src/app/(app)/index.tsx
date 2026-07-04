import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  Divider,
  IconButton,
  List,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { BarcodeScannerModal } from '@/components/barcode-scanner';
import { turnoAbiertoDe, type Turno } from '@/db/repositories/caja';
import {
  buscarPorCodigoBarras,
  getProductoById,
  listarProductos,
  type Producto,
} from '@/db/repositories/productos';
import { registrarVenta, type MetodoPago } from '@/db/repositories/ventas';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { parseContenidoQr } from '@/lib/qr';
import { imprimirTicket, type TicketData } from '@/lib/ticket';
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [editarCantidad, setEditarCantidad] = useState<{ productoId: string; nombre: string; valor: string } | null>(
    null,
  );

  const { items, incrementar, decrementar, setCantidad, quitar, addProducto } = useCartStore();
  // Total derivado de items para que se recalcule en cada cambio del carrito.
  const totalCarrito = items.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0);

  const cargar = useCallback(() => {
    if (!usuario) return;
    turnoAbiertoDe(usuario.id).then(setTurno);
    listarProductos(busqueda).then(setResultados);
  }, [usuario, busqueda]);

  useFocusEffect(cargar);

  async function buscar(texto: string) {
    setBusqueda(texto);
    setResultados(await listarProductos(texto));
  }

  function agregarAlCarrito(producto: Producto) {
    if (producto.stockActual <= 0) {
      setAviso(`"${producto.nombre}" no tiene stock disponible`);
      return;
    }
    const yaEnCarrito = items.find((i) => i.productoId === producto.id);
    if (yaEnCarrito && yaEnCarrito.cantidad >= producto.stockActual) {
      setAviso(`No hay más stock de "${producto.nombre}"`);
      return;
    }
    addProducto(producto);
    setAviso(`Agregado: ${producto.nombre}`);
  }

  async function onScanned(codigo: string) {
    setScannerVisible(false);
    const productId = parseContenidoQr(codigo);
    const producto = productId ? await getProductoById(productId) : await buscarPorCodigoBarras(codigo);
    if (producto) {
      agregarAlCarrito(producto);
    } else {
      setAviso('No se encontró un producto con ese código');
    }
  }

  if (!usuario) return null;

  if (!turno) {
    return (
      <View style={styles.center}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          No tenés un turno de caja abierto.
        </Text>
        <Button icon="cash-register" mode="contained" onPress={() => router.push('/caja')}>
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
          dense
          style={styles.search}
        />
        <IconButton icon="qrcode-scan" mode="contained" onPress={() => setScannerVisible(true)} />
      </View>

      <Text variant="labelLarge" style={styles.sectionLabel}>
        Tocá un producto para agregarlo
      </Text>
      <FlatList
        data={resultados}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={Divider}
        style={styles.pickerList}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const sinStock = item.stockActual <= 0;
          return (
            <List.Item
              title={item.nombre}
              titleStyle={sinStock ? styles.sinStockText : undefined}
              description={`${formatMoney(item.precioVenta)} · Stock: ${item.stockActual}`}
              onPress={() => agregarAlCarrito(item)}
              left={(props) => (
                <List.Icon {...props} icon={sinStock ? 'package-variant-closed' : 'package-variant'} />
              )}
              right={(props) => (
                <List.Icon
                  {...props}
                  icon={sinStock ? 'cancel' : 'plus-circle'}
                  color={sinStock ? '#B3261E' : '#0B6E4F'}
                />
              )}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            No hay productos. Cargá productos desde la pestaña Productos.
          </Text>
        }
      />

      <Divider />
      <Text variant="labelLarge" style={styles.sectionLabel}>
        Carrito ({items.length})
      </Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.productoId}
        ItemSeparatorComponent={Divider}
        style={styles.cartList}
        renderItem={({ item }) => (
          <View style={styles.cartRow}>
            <IconButton icon="delete-outline" size={20} iconColor="#B3261E" onPress={() => quitar(item.productoId)} />
            <View style={styles.cartInfo}>
              <Text variant="bodyLarge">{item.nombre}</Text>
              <Text variant="bodySmall" style={styles.cartSub}>
                {formatMoney(item.precioUnitario)} c/u · {formatMoney(item.precioUnitario * item.cantidad)}
              </Text>
            </View>
            <View style={styles.qtyControls}>
              <IconButton icon="minus" size={18} mode="outlined" onPress={() => decrementar(item.productoId)} />
              <Text
                variant="titleMedium"
                style={styles.qtyValue}
                onPress={() =>
                  setEditarCantidad({ productoId: item.productoId, nombre: item.nombre, valor: String(item.cantidad) })
                }
              >
                {item.cantidad}
              </Text>
              <IconButton icon="plus" size={18} mode="outlined" onPress={() => incrementar(item.productoId)} />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            El carrito está vacío. Tocá un producto de arriba para agregarlo.
          </Text>
        }
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text variant="titleMedium">Total</Text>
          <Text variant="headlineSmall">{formatMoney(totalCarrito)}</Text>
        </View>
        <Button
          icon="cash-multiple"
          mode="contained"
          disabled={items.length === 0}
          onPress={() => setCheckoutVisible(true)}
        >
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
            subtotal={totalCarrito}
            onClose={() => setCheckoutVisible(false)}
          />
        </Modal>

        <Dialog visible={!!editarCantidad} onDismiss={() => setEditarCantidad(null)}>
          <Dialog.Title>Cantidad</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogNombre}>
              {editarCantidad?.nombre}
            </Text>
            <TextInput
              label="Unidades"
              value={editarCantidad?.valor ?? ''}
              onChangeText={(t) =>
                setEditarCantidad((prev) => (prev ? { ...prev, valor: t.replace(/[^0-9]/g, '') } : prev))
              }
              mode="outlined"
              keyboardType="number-pad"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditarCantidad(null)}>Cancelar</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (editarCantidad) {
                  const n = Number.parseInt(editarCantidad.valor, 10);
                  if (n > 0) setCantidad(editarCantidad.productoId, n);
                }
                setEditarCantidad(null);
              }}
            >
              Aceptar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!aviso} onDismiss={() => setAviso(null)} duration={1800}>
        {aviso ?? ''}
      </Snackbar>
    </View>
  );
}

interface CheckoutProps {
  turnoId: string;
  usuarioId: string;
  subtotal: number;
  onClose: () => void;
}

interface VentaConfirmadaUI {
  vuelto: number | null;
  ticket: TicketData;
}

function CheckoutForm({ turnoId, usuarioId, subtotal, onClose }: CheckoutProps) {
  const { items, clear } = useCartStore();
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [descuentoInput, setDescuentoInput] = useState('');
  const [montoRecibidoInput, setMontoRecibidoInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [confirmada, setConfirmada] = useState<VentaConfirmadaUI | null>(null);

  const descuento = Math.min(parseMoneyInput(descuentoInput), subtotal);
  const total = subtotal - descuento;
  const montoRecibido = metodoPago === 'efectivo' ? parseMoneyInput(montoRecibidoInput) : total;
  const vuelto = metodoPago === 'efectivo' ? montoRecibido - total : 0;
  const faltaEfectivo = metodoPago === 'efectivo' && montoRecibido < total;

  async function confirmar() {
    if (metodoPago === 'efectivo' && montoRecibido < total) {
      setError('El monto recibido es menor al total');
      return;
    }
    setError(null);
    setProcesando(true);
    try {
      const itemsVenta = items.map((i) => ({
        productoId: i.productoId,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        costoUnitario: i.costoUnitario,
      }));
      const resultado = await registrarVenta({
        turnoId,
        usuarioId,
        metodoPago,
        descuento,
        montoRecibido: metodoPago === 'efectivo' ? montoRecibido : undefined,
        items: itemsVenta,
      });
      setConfirmada({
        vuelto: resultado.vuelto,
        ticket: {
          fecha: new Date(),
          items: itemsVenta.map((i) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
          })),
          subtotal: resultado.subtotal,
          descuento: resultado.descuento,
          total: resultado.total,
          metodoPago,
          montoRecibido: metodoPago === 'efectivo' ? montoRecibido : null,
          vuelto: resultado.vuelto,
        },
      });
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
        <Button icon="printer" mode="outlined" onPress={() => imprimirTicket(confirmada.ticket)} style={styles.ticketBtn}>
          Imprimir ticket
        </Button>
        <Button icon="check" mode="contained" onPress={onClose}>
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

      <TextInput
        label="Descuento (opcional)"
        value={descuentoInput}
        onChangeText={setDescuentoInput}
        mode="outlined"
        keyboardType="decimal-pad"
        style={styles.input}
      />

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
          {montoRecibidoInput.length > 0 &&
            (faltaEfectivo ? (
              <Text variant="bodyMedium" style={styles.falta}>
                Falta: {formatMoney(total - montoRecibido)}
              </Text>
            ) : (
              <Text variant="titleMedium" style={styles.vuelto}>
                Vuelto: {formatMoney(vuelto)}
              </Text>
            ))}
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
        <Button
          icon="check"
          mode="contained"
          onPress={confirmar}
          loading={procesando}
          disabled={procesando || faltaEfectivo}
        >
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
  sectionLabel: { marginTop: 6, marginBottom: 2, opacity: 0.8 },
  pickerList: { flexGrow: 0, maxHeight: '38%' },
  sinStockText: { opacity: 0.5 },
  cartList: { flex: 1, marginTop: 4 },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  cartInfo: { flex: 1 },
  cartSub: { opacity: 0.7 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyValue: { minWidth: 44, textAlign: 'center', textDecorationLine: 'underline' },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ccc', paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, maxHeight: '90%' },
  modalTitle: { marginBottom: 8, textAlign: 'center' },
  input: { marginTop: 8 },
  vuelto: { textAlign: 'center', marginTop: 8, color: '#0B6E4F' },
  falta: { textAlign: 'center', marginTop: 8, color: '#B3261E' },
  dialogNombre: { marginBottom: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  error: { color: '#B00020', marginTop: 8, textAlign: 'center' },
  confirmTitle: { textAlign: 'center', marginBottom: 12 },
  confirmVuelto: { textAlign: 'center', marginBottom: 16 },
  ticketBtn: { marginBottom: 8 },
});
