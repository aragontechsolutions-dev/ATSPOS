import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';

import { eq } from 'drizzle-orm';

import { ProductSearch } from '@/components/product-search';
import { db } from '@/db/client';
import { type Producto } from '@/db/repositories/productos';
import { ajustarStock, traspasarDepositoATienda } from '@/db/repositories/stock';
import { productos as productosTable } from '@/db/schema';
import { auditar } from '@/lib/audit';
import { useSessionStore } from '@/store/session';

type Modo = 'ajuste' | 'traspaso';

export default function AjusteStockScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [modo, setModo] = useState<Modo>('ajuste');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('merma');
  const [direccion, setDireccion] = useState<'restar' | 'sumar'>('restar');
  const [hacia, setHacia] = useState<'tienda' | 'deposito'>('tienda');
  const [snackbar, setSnackbar] = useState<string | null>(null);

  async function recargarProducto(id: string) {
    const fresco = await db.query.productos.findFirst({ where: eq(productosTable.id, id) });
    setProducto(fresco ?? null);
  }

  async function aplicar() {
    if (!usuario || !producto) return;
    const cant = Number.parseInt(cantidad, 10);
    if (!cant || cant <= 0) {
      setSnackbar('Ingresá una cantidad válida');
      return;
    }
    try {
      if (modo === 'ajuste') {
        const signo = direccion === 'restar' ? -cant : cant;
        await ajustarStock({
          productoId: producto.id,
          tipo: 'ajuste',
          cantidad: signo,
          motivo,
          usuarioId: usuario.id,
        });
        auditar('Ajuste de stock', `${producto.nombre}: ${signo > 0 ? '+' : ''}${signo} (${motivo})`);
      } else {
        await traspasarDepositoATienda({ productoId: producto.id, cantidad: cant, hacia, usuarioId: usuario.id });
        auditar(
          'Traspaso de stock',
          `${producto.nombre}: ${cant} u ${hacia === 'tienda' ? 'depósito → tienda' : 'tienda → depósito'}`,
        );
      }
      setCantidad('');
      await recargarProducto(producto.id);
      setSnackbar('Ajuste registrado');
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo aplicar el ajuste');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ProductSearch placeholder="Buscar producto a ajustar" onSelect={setProducto} />

      {producto && (
        <Card style={styles.card}>
          <Card.Title title={producto.nombre} subtitle={`Tienda: ${producto.stockActual} · Depósito: ${producto.stockDeposito}`} />
          <Card.Content style={styles.cardContent}>
            <SegmentedButtons
              value={modo}
              onValueChange={(v) => setModo(v as Modo)}
              buttons={[
                { value: 'ajuste', label: 'Ajuste' },
                { value: 'traspaso', label: 'Traspaso' },
              ]}
            />

            {modo === 'ajuste' ? (
              <>
                <SegmentedButtons
                  value={direccion}
                  onValueChange={(v) => setDireccion(v as 'restar' | 'sumar')}
                  buttons={[
                    { value: 'restar', label: 'Restar' },
                    { value: 'sumar', label: 'Sumar' },
                  ]}
                  style={styles.segmented}
                />
                <SegmentedButtons
                  value={motivo}
                  onValueChange={setMotivo}
                  buttons={[
                    { value: 'merma', label: 'Merma' },
                    { value: 'rotura', label: 'Rotura' },
                    { value: 'corrección', label: 'Corrección' },
                  ]}
                  style={styles.segmented}
                />
              </>
            ) : (
              <SegmentedButtons
                value={hacia}
                onValueChange={(v) => setHacia(v as 'tienda' | 'deposito')}
                buttons={[
                  { value: 'tienda', label: 'Depósito → Tienda' },
                  { value: 'deposito', label: 'Tienda → Depósito' },
                ]}
                style={styles.segmented}
              />
            )}

            <TextInput
              label="Cantidad (unidades)"
              value={cantidad}
              onChangeText={setCantidad}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Button icon="check" mode="contained" onPress={aplicar}>
              Aplicar
            </Button>
          </Card.Content>
        </Card>
      )}

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={2500}>
        {snackbar ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, gap: 8 },
  card: { marginTop: 8 },
  cardContent: { gap: 8 },
  segmented: { marginTop: 4 },
  input: { marginTop: 4 },
});
