import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, IconButton, List, Portal, Text, TextInput } from 'react-native-paper';

import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
  type Categoria,
} from '@/db/repositories/categorias';

export default function CategoriasScreen() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState('');
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = useCallback(() => {
    listarCategorias().then(setCategorias);
  }, []);

  useFocusEffect(cargar);

  async function onCrear() {
    if (!nombre.trim()) return;
    await crearCategoria(nombre);
    setNombre('');
    cargar();
  }

  async function onGuardarEdicion() {
    if (!editando || !editNombre.trim()) return;
    await actualizarCategoria(editando.id, editNombre);
    setEditando(null);
    cargar();
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          label="Nueva categoría"
          value={nombre}
          onChangeText={setNombre}
          mode="outlined"
          style={styles.input}
          onSubmitEditing={onCrear}
        />
        <Button icon="plus" mode="contained" onPress={onCrear}>
          Agregar
        </Button>
      </View>

      <Divider />

      <FlatList
        data={categorias}
        keyExtractor={(c) => c.id}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => (
          <List.Item
            title={item.nombre}
            left={(props) => <List.Icon {...props} icon="tag" />}
            right={(props) => (
              <View style={styles.actions}>
                <IconButton
                  {...props}
                  icon="pencil"
                  onPress={() => {
                    setEditando(item);
                    setEditNombre(item.nombre);
                  }}
                />
                <IconButton
                  {...props}
                  icon="delete"
                  iconColor="#B3261E"
                  onPress={async () => {
                    await eliminarCategoria(item.id);
                    cargar();
                  }}
                />
              </View>
            )}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            No hay categorías. Agregá la primera arriba.
          </Text>
        }
      />

      <Portal>
        <Dialog visible={!!editando} onDismiss={() => setEditando(null)}>
          <Dialog.Title>Editar categoría</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Nombre" value={editNombre} onChangeText={setEditNombre} mode="outlined" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)}>Cancelar</Button>
            <Button mode="contained" onPress={onGuardarEdicion}>
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 16, gap: 8 },
  input: {},
  actions: { flexDirection: 'row' },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
});
