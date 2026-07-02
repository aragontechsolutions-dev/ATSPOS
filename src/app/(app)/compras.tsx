import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { ProductSearch } from '@/components/product-search';
import { registrarCompra, type LineaCompra } from '@/db/repositories/compras';
import { listarProveedores, type Proveedor } from '@/db/repositories/proveedores';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { useSessionStore } from '@/store/session';

interface LineaEditable extends LineaCompra {
  costoInput: string;
}

export default function ComprasScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const router = useRouter();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaEditable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listarProveedores().then(setProveedores);
    }, []),
  );

  const total = lineas.reduce((sum, l) => sum + l.costoUnitario * l.cantidad, 0);

  function actualizarLinea(productoId: string, cambios: Partial<LineaEditable>) {
    setLineas((prev) => prev.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l)));
  }

  async function confirmar() {
    if (!usuario) return;
    if (lineas.length === 0) {
      setError('Agregá al menos un producto');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await registrarCompra({
        proveedorId,
        usuarioId: usuario.id,
        lineas: lineas.map(({ costoInput, ...l }) => l),
      });
      setLineas([]);
      setProveedorId(null);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la compra');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {proveedores.length > 0 && (
        <>
          <Text variant="labelLarge" style={styles.label}>
            Proveedor
          </Text>
          <SegmentedButtons
            value={proveedorId ?? ''}
            onValueChange={(v) => setProveedorId(v || null)}
            buttons={proveedores.slice(0, 3).map((p) => ({ value: p.id, label: p.nombre }))}
            style={styles.segmented}
          />
        </>
      )}

      <ProductSearch placeholder="Buscar producto para agregar" onSelect={(p) => {
        setLineas((prev) => {
          if (prev.some((l) => l.productoId === p.id)) return prev;
          return [
            ...prev,
            {
              productoId: p.id,
              nombre: p.nombre,
              cantidad: 1,
              costoUnitario: p.precioCosto,
              costoInput: (p.precioCosto / 100).toFixed(2),
            },
          ];
        });
      }} />

      {lineas.map((l) => (
        <Card key={l.productoId} style={styles.lineCard}>
          <Card.Title
            title={l.nombre}
            right={(props) => (
              <IconButton
                {...props}
                icon="delete"
                onPress={() => setLineas((prev) => prev.filter((x) => x.productoId !== l.productoId))}
              />
            )}
          />
          <Card.Content style={styles.lineContent}>
            <View style={styles.qtyControls}>
              <IconButton
                icon="minus"
                size={18}
                onPress={() => actualizarLinea(l.productoId, { cantidad: Math.max(1, l.cantidad - 1) })}
              />
              <Text variant="bodyLarge">{l.cantidad}</Text>
              <IconButton icon="plus" size={18} onPress={() => actualizarLinea(l.productoId, { cantidad: l.cantidad + 1 })} />
            </View>
            <TextInput
              label="Costo unitario"
              value={l.costoInput}
              onChangeText={(t) => actualizarLinea(l.productoId, { costoInput: t, costoUnitario: parseMoneyInput(t) })}
              mode="outlined"
              keyboardType="decimal-pad"
              dense
              style={styles.costoInput}
            />
            <Text variant="bodyMedium" style={styles.lineTotal}>
              {formatMoney(l.costoUnitario * l.cantidad)}
            </Text>
          </Card.Content>
        </Card>
      ))}

      {error && (
        <Text style={styles.error} variant="bodyMedium">
          {error}
        </Text>
      )}

      <Divider style={styles.divider} />
      <View style={styles.totalRow}>
        <Text variant="titleMedium">Total compra</Text>
        <Text variant="titleLarge">{formatMoney(total)}</Text>
      </View>
      <Button mode="contained" onPress={confirmar} loading={guardando} disabled={guardando || lineas.length === 0}>
        Confirmar compra
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, gap: 8 },
  label: { marginLeft: 4 },
  segmented: { marginBottom: 8 },
  lineCard: { marginTop: 8 },
  lineContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  costoInput: { flex: 1 },
  lineTotal: { width: 80, textAlign: 'right' },
  divider: { marginTop: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  error: { color: '#B00020', textAlign: 'center' },
});
