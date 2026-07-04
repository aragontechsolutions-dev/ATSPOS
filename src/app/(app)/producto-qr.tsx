import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

import {
  actualizarProducto,
  eliminarProducto,
  getProductoById,
  type Producto,
} from '@/db/repositories/productos';
import { auditar } from '@/lib/audit';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { contenidoQrProducto } from '@/lib/qr';

export default function ProductoQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [editar, setEditar] = useState(false);
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  const cargar = useCallback(() => {
    if (id) getProductoById(id).then(setProducto);
  }, [id]);

  useFocusEffect(cargar);

  async function onEliminar() {
    if (!producto) return;
    await eliminarProducto(producto.id);
    auditar('Baja de producto', producto.nombre);
    setConfirmarBaja(false);
    router.back();
  }

  function getQrPngBase64(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!qrRef.current) return reject(new Error('El QR todavía no está listo'));
      qrRef.current.toDataURL((data) => resolve(data));
    });
  }

  async function compartirImagen() {
    try {
      const base64 = await getQrPngBase64();
      const nombreArchivo = `qr-${(producto?.nombre ?? 'producto').replace(/[^a-zA-Z0-9]+/g, '-')}.png`;
      const file = new File(Paths.cache, nombreArchivo);
      if (file.exists) file.delete();
      file.create();
      file.write(base64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Compartir QR' });
      } else {
        setSnackbar('Compartir no está disponible en este dispositivo');
      }
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo exportar la imagen');
    }
  }

  async function imprimir() {
    try {
      const base64 = await getQrPngBase64();
      const html = `
        <html>
          <body style="margin:0;font-family:sans-serif;text-align:center;">
            <div style="display:inline-block;border:1px solid #000;border-radius:8px;padding:24px;margin:24px;">
              <img src="data:image/png;base64,${base64}" style="width:240px;height:240px;" />
              <div style="font-size:22px;font-weight:bold;margin-top:12px;">${producto?.nombre ?? ''}</div>
              <div style="font-size:26px;margin-top:4px;">${producto ? formatMoney(producto.precioVenta) : ''}</div>
            </div>
          </body>
        </html>`;
      await Print.printAsync({ html });
    } catch (e) {
      // El usuario puede cancelar el diálogo de impresión; solo avisamos errores reales.
      if (e instanceof Error && !/cancel/i.test(e.message)) setSnackbar(e.message);
    }
  }

  if (!producto) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleLarge" style={styles.nombre}>
            {producto.nombre}
          </Text>
          <Text variant="headlineSmall">{formatMoney(producto.precioVenta)}</Text>
          <View style={styles.qrBox}>
            <QRCode
              value={contenidoQrProducto(producto.id)}
              size={240}
              getRef={(c) => {
                qrRef.current = c;
              }}
            />
          </View>
          <Text variant="bodySmall" style={styles.hint}>
            Imprimí esta etiqueta y pegala en el producto. Escaneala desde la pantalla de Venta.
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.datosCard}>
        <Card.Content>
          <Text variant="bodyMedium">Stock tienda: {producto.stockActual}</Text>
          <Text variant="bodyMedium">Stock depósito: {producto.stockDeposito}</Text>
          <Text variant="bodyMedium">Precio costo: {formatMoney(producto.precioCosto)}</Text>
          <Text variant="bodyMedium">Stock mínimo: {producto.stockMinimo}</Text>
        </Card.Content>
      </Card>

      <Button icon="printer" mode="contained" onPress={imprimir} style={styles.btn}>
        Imprimir etiqueta
      </Button>
      <Button icon="image" mode="outlined" onPress={compartirImagen} style={styles.btn}>
        Compartir imagen (PNG)
      </Button>
      <Button icon="pencil" mode="outlined" onPress={() => setEditar(true)} style={styles.btn}>
        Editar producto
      </Button>
      <Button icon="delete" mode="outlined" textColor="#B3261E" onPress={() => setConfirmarBaja(true)} style={styles.btn}>
        Eliminar producto
      </Button>

      <Portal>
        <Modal visible={editar} onDismiss={() => setEditar(false)} contentContainerStyle={styles.modal}>
          <EditarProductoForm
            producto={producto}
            onGuardado={() => {
              setEditar(false);
              cargar();
              setSnackbar('Producto actualizado');
            }}
            onCancel={() => setEditar(false)}
          />
        </Modal>

        <Dialog visible={confirmarBaja} onDismiss={() => setConfirmarBaja(false)}>
          <Dialog.Title>Eliminar producto</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              ¿Seguro que querés dar de baja "{producto.nombre}"? No aparecerá más en el catálogo ni en la venta.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmarBaja(false)}>Cancelar</Button>
            <Button mode="contained" buttonColor="#B3261E" onPress={onEliminar}>
              Eliminar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

function EditarProductoForm({
  producto,
  onGuardado,
  onCancel,
}: {
  producto: Producto;
  onGuardado: () => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(producto.nombre);
  const [precioCosto, setPrecioCosto] = useState((producto.precioCosto / 100).toFixed(2));
  const [precioVenta, setPrecioVenta] = useState((producto.precioVenta / 100).toFixed(2));
  const [stockMinimo, setStockMinimo] = useState(String(producto.stockMinimo));
  const [codigoBarras, setCodigoBarras] = useState(producto.codigoBarras ?? '');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!nombre.trim() || !precioVenta) {
      setError('Completá el nombre y el precio de venta');
      return;
    }
    setError(null);
    await actualizarProducto(producto.id, {
      nombre: nombre.trim(),
      precioCosto: parseMoneyInput(precioCosto),
      precioVenta: parseMoneyInput(precioVenta),
      stockMinimo: Number.parseInt(stockMinimo, 10) || 0,
      codigoBarras: codigoBarras.trim() || null,
    });
    auditar('Edición de producto', nombre.trim());
    onGuardado();
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.modalTitle}>
        Editar producto
      </Text>
      <TextInput label="Nombre" value={nombre} onChangeText={setNombre} mode="outlined" style={styles.input} />
      <View style={styles.priceRow}>
        <TextInput
          label="Precio costo"
          value={precioCosto}
          onChangeText={setPrecioCosto}
          mode="outlined"
          keyboardType="decimal-pad"
          style={[styles.input, styles.priceInput]}
        />
        <TextInput
          label="Precio venta"
          value={precioVenta}
          onChangeText={setPrecioVenta}
          mode="outlined"
          keyboardType="decimal-pad"
          style={[styles.input, styles.priceInput]}
        />
      </View>
      <TextInput
        label="Stock mínimo"
        value={stockMinimo}
        onChangeText={setStockMinimo}
        mode="outlined"
        keyboardType="number-pad"
        style={styles.input}
      />
      <TextInput
        label="Código externo (opcional)"
        value={codigoBarras}
        onChangeText={setCodigoBarras}
        mode="outlined"
        style={styles.input}
      />
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

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  cardContent: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  nombre: { textAlign: 'center' },
  qrBox: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginVertical: 8 },
  hint: { textAlign: 'center', opacity: 0.7, marginTop: 4 },
  datosCard: { marginTop: 4 },
  btn: { marginTop: 4 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, maxHeight: '90%' },
  modalTitle: { marginBottom: 12 },
  input: { marginBottom: 10 },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceInput: { flex: 1 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  error: { color: '#B00020', marginBottom: 8, textAlign: 'center' },
});
