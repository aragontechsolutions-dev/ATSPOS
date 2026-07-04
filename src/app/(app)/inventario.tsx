import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Banner, Card, Divider, List, Text } from 'react-native-paper';

import { listarBajoStock, type Producto } from '@/db/repositories/productos';
import { formatMoney } from '@/lib/money';

export default function InventarioScreen() {
  const router = useRouter();
  const [bajoStock, setBajoStock] = useState<Producto[]>([]);

  useFocusEffect(
    useCallback(() => {
      listarBajoStock().then(setBajoStock);
    }, []),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {bajoStock.length > 0 && (
        <Banner visible icon="alert" style={styles.banner}>
          {`${bajoStock.length} producto(s) por debajo del stock mínimo.`}
        </Banner>
      )}

      <Card style={styles.card}>
        <List.Item
          title="Nueva compra a proveedor"
          description="Cargar mercadería y actualizar costos"
          left={(props) => <List.Icon {...props} icon="truck-delivery" />}
          onPress={() => router.push('/compras')}
        />
        <Divider />
        <List.Item
          title="Ajuste de stock"
          description="Merma, rotura, corrección de conteo, traspaso"
          left={(props) => <List.Icon {...props} icon="tune-variant" />}
          onPress={() => router.push('/ajuste-stock')}
        />
        <Divider />
        <List.Item
          title="Proveedores"
          description="Gestionar proveedores"
          left={(props) => <List.Icon {...props} icon="account-tie" />}
          onPress={() => router.push('/proveedores')}
        />
        <Divider />
        <List.Item
          title="Importar productos desde Excel"
          description="Cargá muchos productos de una con una planilla"
          left={(props) => <List.Icon {...props} icon="file-import" />}
          onPress={() => router.push('/importar-productos')}
        />
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Bajo stock
      </Text>
      {bajoStock.length === 0 ? (
        <Text style={styles.empty} variant="bodyMedium">
          Todos los productos tienen stock por encima del mínimo.
        </Text>
      ) : (
        <Card style={styles.card}>
          {bajoStock.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <List.Item
                title={p.nombre}
                description={`Stock: ${p.stockActual} · Mínimo: ${p.stockMinimo} · ${formatMoney(p.precioVenta)}`}
                left={(props) => <List.Icon {...props} icon="alert-circle" color="#B00020" />}
              />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, gap: 8 },
  banner: { marginBottom: 8 },
  card: { marginBottom: 8 },
  sectionTitle: { marginTop: 8, marginLeft: 4 },
  empty: { textAlign: 'center', marginTop: 16, opacity: 0.6 },
});
