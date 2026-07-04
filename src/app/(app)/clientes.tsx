import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, FAB, List, Modal, Portal, Text, TextInput } from 'react-native-paper';

import { crearCliente, listarClientes, type Cliente } from '@/db/repositories/clientes';
import { formatMoney } from '@/lib/money';

export default function ClientesScreen() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);

  const cargar = useCallback(() => {
    listarClientes(busqueda).then(setClientes);
  }, [busqueda]);

  useFocusEffect(cargar);

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar cliente"
        value={busqueda}
        onChangeText={setBusqueda}
        mode="outlined"
        dense
        style={styles.search}
        right={<TextInput.Icon icon="magnify" />}
      />

      <FlatList
        data={clientes}
        keyExtractor={(c) => c.id}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => (
          <List.Item
            title={item.nombre}
            description={item.telefono ?? undefined}
            left={(props) => <List.Icon {...props} icon="account" />}
            right={() => (
              <Text style={[styles.saldo, item.saldo > 0 ? styles.debe : styles.aldia]}>
                {item.saldo > 0 ? `Debe ${formatMoney(item.saldo)}` : 'Al día'}
              </Text>
            )}
            onPress={() => router.push(`/cliente-detalle?id=${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            No hay clientes cargados.
          </Text>
        }
      />

      <FAB icon="account-plus" style={styles.fab} onPress={() => setModal(true)} />

      <Portal>
        <Modal visible={modal} onDismiss={() => setModal(false)} contentContainerStyle={styles.modal}>
          <NuevoClienteForm
            onCreado={() => {
              setModal(false);
              cargar();
            }}
            onCancel={() => setModal(false)}
          />
        </Modal>
      </Portal>
    </View>
  );
}

function NuevoClienteForm({ onCreado, onCancel }: { onCreado: () => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!nombre.trim()) {
      setError('Ingresá el nombre del cliente');
      return;
    }
    setError(null);
    await crearCliente({ nombre, telefono: telefono.trim() || null });
    onCreado();
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.modalTitle}>
        Nuevo cliente
      </Text>
      <TextInput label="Nombre" value={nombre} onChangeText={setNombre} mode="outlined" style={styles.input} />
      <TextInput
        label="Teléfono (opcional)"
        value={telefono}
        onChangeText={setTelefono}
        mode="outlined"
        keyboardType="phone-pad"
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
  container: { flex: 1, padding: 12 },
  search: { marginBottom: 8 },
  saldo: { alignSelf: 'center' },
  debe: { color: '#B3261E' },
  aldia: { color: '#0B6E4F' },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12 },
  modalTitle: { marginBottom: 12 },
  input: { marginBottom: 10 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  error: { color: '#B00020', marginBottom: 8, textAlign: 'center' },
});
