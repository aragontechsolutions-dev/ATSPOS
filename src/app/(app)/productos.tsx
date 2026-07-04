import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  FAB,
  IconButton,
  List,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import { BarcodeScannerModal } from '@/components/barcode-scanner';
import { listarCategorias, type Categoria } from '@/db/repositories/categorias';
import { crearProducto, listarProductos, type Producto, type UnidadMedida } from '@/db/repositories/productos';
import { formatMoney, parseMoneyInput } from '@/lib/money';

export default function ProductosScreen() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [codigoEscaneado, setCodigoEscaneado] = useState('');

  const cargar = useCallback(() => {
    listarProductos(busqueda).then(setProductos);
    listarCategorias().then(setCategorias);
  }, [busqueda]);

  useFocusEffect(cargar);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar por nombre o código"
          value={busqueda}
          onChangeText={setBusqueda}
          mode="outlined"
          dense
          style={styles.searchInput}
          right={<TextInput.Icon icon="magnify" />}
        />
        <IconButton icon="tag-multiple" mode="contained-tonal" onPress={() => router.push('/categorias')} />
      </View>

      <FlatList
        data={productos}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => {
          const bajoStock = item.stockActual <= item.stockMinimo;
          return (
            <List.Item
              title={item.nombre}
              description={`${formatMoney(item.precioVenta)} · Stock: ${item.stockActual}${bajoStock ? ' · bajo stock' : ''}`}
              onPress={() => router.push(`/producto-qr?id=${item.id}`)}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={bajoStock ? 'alert-circle' : 'package-variant'}
                  color={bajoStock ? '#B3261E' : undefined}
                />
              )}
              right={(props) => <List.Icon {...props} icon="qrcode" />}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            No hay productos cargados todavía.
          </Text>
        }
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setModalVisible(true)} />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <NuevoProductoForm
            categorias={categorias}
            codigoBarras={codigoEscaneado}
            onCodigoBarrasChange={setCodigoEscaneado}
            onScan={() => setScannerVisible(true)}
            onCreated={() => {
              setModalVisible(false);
              setCodigoEscaneado('');
              cargar();
            }}
            onCancel={() => {
              setModalVisible(false);
              setCodigoEscaneado('');
            }}
          />
        </Modal>
      </Portal>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(data) => {
          setScannerVisible(false);
          setCodigoEscaneado(data);
        }}
      />
    </View>
  );
}

interface FormProps {
  categorias: Categoria[];
  codigoBarras: string;
  onCodigoBarrasChange: (value: string) => void;
  onScan: () => void;
  onCreated: () => void;
  onCancel: () => void;
}

function NuevoProductoForm({
  categorias,
  codigoBarras,
  onCodigoBarrasChange,
  onScan,
  onCreated,
  onCancel,
}: FormProps) {
  const [nombre, setNombre] = useState('');
  const [precioCosto, setPrecioCosto] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stockMinimo, setStockMinimo] = useState('0');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida>('unidad');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!nombre.trim() || !precioVenta) {
      setError('Completá al menos el nombre y el precio de venta');
      return;
    }
    setError(null);
    try {
      await crearProducto({
        nombre: nombre.trim(),
        codigoBarras: codigoBarras.trim() || null,
        categoriaId,
        precioCosto: parseMoneyInput(precioCosto),
        precioVenta: parseMoneyInput(precioVenta),
        stockMinimo: Number.parseInt(stockMinimo, 10) || 0,
        unidadMedida,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el producto');
    }
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.modalTitle}>
        Nuevo producto
      </Text>
      <TextInput label="Nombre" value={nombre} onChangeText={setNombre} mode="outlined" style={styles.input} />
      <TextInput
        label="Código externo (opcional)"
        value={codigoBarras}
        onChangeText={onCodigoBarrasChange}
        mode="outlined"
        style={styles.input}
        right={<TextInput.Icon icon="qrcode-scan" onPress={onScan} />}
      />
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
          label={unidadMedida === 'kg' ? 'Precio por kg' : 'Precio venta'}
          value={precioVenta}
          onChangeText={setPrecioVenta}
          mode="outlined"
          keyboardType="decimal-pad"
          style={[styles.input, styles.priceInput]}
        />
      </View>
      <SegmentedButtons
        value={unidadMedida}
        onValueChange={(v) => setUnidadMedida(v as UnidadMedida)}
        buttons={[
          { value: 'unidad', label: 'Por unidad', icon: 'numeric' },
          { value: 'kg', label: 'Por peso (kg)', icon: 'scale' },
        ]}
        style={styles.input}
      />
      <TextInput
        label="Stock mínimo"
        value={stockMinimo}
        onChangeText={setStockMinimo}
        mode="outlined"
        keyboardType="number-pad"
        style={styles.input}
      />
      {categorias.length > 0 && (
        <View style={styles.categoriaRow}>
          {categorias.map((c) => (
            <Button
              key={c.id}
              compact
              mode={categoriaId === c.id ? 'contained' : 'outlined'}
              onPress={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
              style={styles.categoriaButton}
            >
              {c.nombre}
            </Button>
          ))}
        </View>
      )}
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
  container: { flex: 1, padding: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  searchInput: { flex: 1 },
  row: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center' },
  rowInfo: { flex: 1 },
  rowSub: { opacity: 0.7, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, maxHeight: '90%' },
  modalTitle: { marginBottom: 12 },
  input: { marginBottom: 10 },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceInput: { flex: 1 },
  categoriaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  categoriaButton: {},
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  error: { color: '#B00020', marginBottom: 8, textAlign: 'center' },
});
