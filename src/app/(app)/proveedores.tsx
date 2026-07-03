import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, List, Text, TextInput } from 'react-native-paper';

import {
  crearProveedor,
  eliminarProveedor,
  listarProveedores,
  type Proveedor,
} from '@/db/repositories/proveedores';

export default function ProveedoresScreen() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    listarProveedores().then(setProveedores);
  }, []);

  useFocusEffect(cargar);

  async function onCrear() {
    if (!nombre.trim()) {
      setError('Ingresá el nombre del proveedor');
      return;
    }
    setError(null);
    await crearProveedor({ nombre, contacto: contacto.trim() || null });
    setNombre('');
    setContacto('');
    cargar();
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput label="Nombre" value={nombre} onChangeText={setNombre} mode="outlined" style={styles.input} />
        <TextInput
          label="Contacto (teléfono/email)"
          value={contacto}
          onChangeText={setContacto}
          mode="outlined"
          style={styles.input}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button icon="account-plus" mode="contained" onPress={onCrear}>
          Agregar proveedor
        </Button>
      </View>

      <Divider />

      <FlatList
        data={proveedores}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => (
          <List.Item
            title={item.nombre}
            description={item.contacto ?? undefined}
            left={(props) => <List.Icon {...props} icon="account-tie" />}
            right={(props) => (
              <Button
                {...props}
                icon="delete"
                textColor="#B3261E"
                onPress={async () => {
                  await eliminarProveedor(item.id);
                  cargar();
                }}
              >
                Quitar
              </Button>
            )}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            No hay proveedores cargados.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 16, gap: 4 },
  input: { marginBottom: 8 },
  error: { color: '#B00020', marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.6 },
});
