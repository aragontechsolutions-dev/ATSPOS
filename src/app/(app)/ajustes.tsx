import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, List, Text, TextInput } from 'react-native-paper';

import { crearUsuario, listarUsuarios, type UsuarioConRol } from '@/db/repositories/usuarios';
import { ROLES, tienePermiso } from '@/lib/roles';
import { useSessionStore } from '@/store/session';

export default function AjustesScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const logout = useSessionStore((s) => s.logout);
  const esAdmin = usuario ? tienePermiso(usuario.rol, 'gestionarUsuarios') : false;

  const [usuarios, setUsuarios] = useState<UsuarioConRol[]>([]);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<typeof ROLES[keyof typeof ROLES]>(ROLES.CAJERO);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (esAdmin) listarUsuarios().then(setUsuarios);
  }, [esAdmin]);

  useFocusEffect(cargar);

  async function onCrearUsuario() {
    if (!nombre.trim() || !username.trim() || password.length < 6) {
      setError('Completá nombre, usuario y una contraseña de al menos 6 caracteres');
      return;
    }
    setError(null);
    try {
      await crearUsuario({ nombre, username, password, rolNombre: rol });
      setNombre('');
      setUsername('');
      setPassword('');
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el usuario');
    }
  }

  return (
    <View style={styles.container}>
      <List.Section>
        <List.Subheader>Mi cuenta</List.Subheader>
        <List.Item title={usuario?.nombre} description={`@${usuario?.username} · ${usuario?.rol}`} />
        <Button onPress={() => logout()} style={styles.logoutButton}>
          Cerrar sesión
        </Button>
      </List.Section>

      {esAdmin && (
        <>
          <Divider />
          <List.Section>
            <List.Subheader>Usuarios</List.Subheader>
            <FlatList
              data={usuarios}
              keyExtractor={(u) => u.id}
              renderItem={({ item }) => (
                <List.Item title={item.nombre} description={`@${item.username} · ${item.rol}`} />
              )}
              style={styles.list}
            />

            <View style={styles.form}>
              <TextInput label="Nombre" value={nombre} onChangeText={setNombre} mode="outlined" style={styles.input} />
              <TextInput
                label="Usuario"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Contraseña inicial"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                style={styles.input}
              />
              <View style={styles.rolRow}>
                {Object.values(ROLES).map((r) => (
                  <Button
                    key={r}
                    mode={rol === r ? 'contained' : 'outlined'}
                    onPress={() => setRol(r)}
                    style={styles.rolButton}
                    compact
                  >
                    {r}
                  </Button>
                ))}
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Button mode="contained" onPress={onCrearUsuario}>
                Crear usuario
              </Button>
            </View>
          </List.Section>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logoutButton: { marginHorizontal: 16, marginTop: 8 },
  list: { maxHeight: 200 },
  form: { padding: 16, gap: 4 },
  input: { marginBottom: 8 },
  rolRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rolButton: { flex: 1 },
  error: { color: '#B00020', marginBottom: 8, textAlign: 'center' },
});
