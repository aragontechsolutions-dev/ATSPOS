import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, List, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import {
  crearUsuario,
  editarUsuario,
  listarUsuarios,
  resetearPassword,
  setUsuarioActivo,
  type UsuarioConRol,
} from '@/db/repositories/usuarios';
import { auditar } from '@/lib/audit';
import { APP_NAME, CREDITO } from '@/lib/brand';
import { ROLES, tienePermiso, type RolNombre } from '@/lib/roles';
import { useSessionStore } from '@/store/session';

export default function AjustesScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const logout = useSessionStore((s) => s.logout);
  const router = useRouter();
  const esAdmin = usuario ? tienePermiso(usuario.rol, 'gestionarUsuarios') : false;

  const [usuarios, setUsuarios] = useState<UsuarioConRol[]>([]);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<typeof ROLES[keyof typeof ROLES]>(ROLES.CAJERO);
  const [error, setError] = useState<string | null>(null);
  const [gestion, setGestion] = useState<UsuarioConRol | null>(null);
  const [gestionError, setGestionError] = useState<string | null>(null);
  const [nuevaPass, setNuevaPass] = useState('');

  const cargar = useCallback(() => {
    if (esAdmin) listarUsuarios(true).then(setUsuarios);
  }, [esAdmin]);

  async function accion(fn: () => Promise<void>, detalle: string) {
    setGestionError(null);
    try {
      await fn();
      auditar('Gestión de usuario', detalle);
      setGestion(null);
      setNuevaPass('');
      cargar();
    } catch (e) {
      setGestionError(e instanceof Error ? e.message : 'No se pudo completar la acción');
    }
  }

  useFocusEffect(cargar);

  async function onCrearUsuario() {
    if (!nombre.trim() || !username.trim() || password.length < 6) {
      setError('Completá nombre, usuario y una contraseña de al menos 6 caracteres');
      return;
    }
    setError(null);
    try {
      await crearUsuario({ nombre, username, password, rolNombre: rol });
      auditar('Alta de usuario', `${username} (${rol})`);
      setNombre('');
      setUsername('');
      setPassword('');
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el usuario');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <List.Section>
        <List.Subheader>Mi cuenta</List.Subheader>
        <List.Item title={usuario?.nombre} description={`@${usuario?.username} · ${usuario?.rol}`} />
        <Button icon="logout" onPress={() => logout()} style={styles.logoutButton}>
          Cerrar sesión
        </Button>
      </List.Section>

      {esAdmin && (
        <>
          <Divider />
          <List.Section>
            <List.Subheader>Seguridad</List.Subheader>
            <List.Item
              title="Backups y auditoría"
              description="Exportar/restaurar backup cifrado, ver auditoría"
              left={(props) => <List.Icon {...props} icon="shield-lock" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/seguridad')}
            />
          </List.Section>
          <Divider />
          <List.Section>
            <List.Subheader>Usuarios</List.Subheader>
            {usuarios.map((item) => (
              <List.Item
                key={item.id}
                title={item.nombre}
                titleStyle={!item.activo ? styles.inactivo : undefined}
                description={`@${item.username} · ${item.rol}${item.activo ? '' : ' · inactivo'}`}
                left={(props) => <List.Icon {...props} icon="account" />}
                right={(props) => <List.Icon {...props} icon="dots-vertical" />}
                onPress={() => {
                  setGestion(item);
                  setGestionError(null);
                  setNuevaPass('');
                }}
              />
            ))}

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
              <Button icon="account-plus" mode="contained" onPress={onCrearUsuario}>
                Crear usuario
              </Button>
            </View>
          </List.Section>
        </>
      )}

      <Divider />
      <View style={styles.acerca}>
        <Text variant="titleMedium">{APP_NAME}</Text>
        <Text variant="bodySmall" style={styles.acercaText}>
          {CREDITO}
        </Text>
      </View>

      <Portal>
        <Dialog visible={!!gestion} onDismiss={() => setGestion(null)}>
          <Dialog.Title>{gestion?.nombre}</Dialog.Title>
          <Dialog.Content>
            <Text variant="labelLarge" style={styles.gestionLabel}>
              Rol
            </Text>
            <SegmentedButtons
              value={gestion?.rol ?? ''}
              onValueChange={(v) =>
                gestion && accion(() => editarUsuario(gestion.id, { rolNombre: v as RolNombre }), `Rol de @${gestion.username} → ${v}`)
              }
              buttons={Object.values(ROLES).map((r) => ({ value: r, label: r }))}
            />

            <Text variant="labelLarge" style={styles.gestionLabel}>
              Resetear contraseña
            </Text>
            <TextInput
              label="Nueva contraseña"
              secureTextEntry
              value={nuevaPass}
              onChangeText={setNuevaPass}
              mode="outlined"
              dense
            />
            <Button
              onPress={() =>
                gestion &&
                (nuevaPass.length >= 6
                  ? accion(() => resetearPassword(gestion.id, nuevaPass), `Reset contraseña de @${gestion.username}`)
                  : setGestionError('La contraseña debe tener al menos 6 caracteres'))
              }
              style={styles.gestionBtn}
            >
              Aplicar nueva contraseña
            </Button>

            {gestionError && <Text style={styles.error}>{gestionError}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            {gestion && gestion.id !== usuario?.id && (
              <Button
                textColor={gestion.activo ? '#B3261E' : undefined}
                onPress={() =>
                  accion(
                    () => setUsuarioActivo(gestion.id, !gestion.activo),
                    `${gestion.activo ? 'Desactivar' : 'Activar'} @${gestion.username}`,
                  )
                }
              >
                {gestion.activo ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            <Button onPress={() => setGestion(null)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  logoutButton: { marginHorizontal: 16, marginTop: 8 },
  form: { padding: 16, gap: 4 },
  input: { marginBottom: 8 },
  rolRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rolButton: { flex: 1 },
  error: { color: '#B00020', marginBottom: 8, textAlign: 'center' },
  inactivo: { textDecorationLine: 'line-through', opacity: 0.6 },
  gestionLabel: { marginTop: 12, marginBottom: 6, opacity: 0.8 },
  gestionBtn: { marginTop: 4 },
  acerca: { alignItems: 'center', padding: 24, gap: 4 },
  acercaText: { textAlign: 'center', opacity: 0.6 },
});
