import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, HelperText, List, Portal, Snackbar, Text, TextInput } from 'react-native-paper';

import { exportarBackup, restaurarBackup } from '@/lib/backup';
import { auditar } from '@/lib/audit';
import { useSessionStore } from '@/store/session';

type Modo = 'exportar' | 'restaurar';

export default function SeguridadScreen() {
  const router = useRouter();
  const logout = useSessionStore((s) => s.logout);
  const [dialogo, setDialogo] = useState<Modo | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  function abrir(modo: Modo) {
    setPassword('');
    setPassword2('');
    setError(null);
    setDialogo(modo);
  }

  async function onExportar() {
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError(null);
    setProcesando(true);
    try {
      const compartido = await exportarBackup(password);
      auditar('Backup exportado');
      setDialogo(null);
      setSnackbar(compartido ? 'Backup generado' : 'Backup guardado (compartir no disponible)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el backup');
    } finally {
      setProcesando(false);
    }
  }

  async function onRestaurar() {
    if (!password) {
      setError('Ingresá la contraseña del backup');
      return;
    }
    setError(null);
    setProcesando(true);
    try {
      const res = await restaurarBackup(password);
      if (res.ok) {
        auditar('Backup restaurado');
        setDialogo(null);
        setSnackbar('Backup restaurado. Volvé a iniciar sesión.');
        setTimeout(() => logout(), 1500);
        return;
      }
      if (res.motivo === 'cancelado') {
        setDialogo(null);
        return;
      }
      setError(
        res.motivo === 'password'
          ? 'Contraseña incorrecta o archivo dañado'
          : res.motivo === 'formato'
            ? 'El archivo no es un backup válido de ATSPOS'
            : 'No se pudo restaurar el backup',
      );
    } finally {
      setProcesando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Card.Content>
          <Text variant="bodyMedium">
            La base de datos está cifrada en el dispositivo. Los backups se exportan cifrados con una contraseña que
            elegís; guardala en un lugar seguro, sin ella no se pueden restaurar.
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <List.Item
          title="Exportar backup cifrado"
          description="Genera un archivo .atsbak y lo comparte"
          left={(props) => <List.Icon {...props} icon="cloud-upload" />}
          onPress={() => abrir('exportar')}
        />
      </Card>

      <Card style={styles.card}>
        <List.Item
          title="Restaurar backup"
          description="Reemplaza todos los datos actuales"
          left={(props) => <List.Icon {...props} icon="cloud-download" />}
          onPress={() => abrir('restaurar')}
        />
      </Card>

      <Card style={styles.card}>
        <List.Item
          title="Ver log de auditoría"
          description="Historial de acciones sensibles"
          left={(props) => <List.Icon {...props} icon="history" />}
          onPress={() => router.push('/auditoria')}
        />
      </Card>

      <Portal>
        <Dialog visible={dialogo === 'exportar'} onDismiss={() => !procesando && setDialogo(null)}>
          <Dialog.Title>Exportar backup</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Contraseña del backup"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Repetir contraseña"
              secureTextEntry
              value={password2}
              onChangeText={setPassword2}
              mode="outlined"
              style={styles.input}
            />
            {error && <HelperText type="error">{error}</HelperText>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogo(null)} disabled={procesando}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={onExportar} loading={procesando} disabled={procesando}>
              Exportar
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={dialogo === 'restaurar'} onDismiss={() => !procesando && setDialogo(null)}>
          <Dialog.Title>Restaurar backup</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.warn}>
              Esto reemplaza todos los datos actuales por los del backup. Elegí el archivo .atsbak y su contraseña.
            </Text>
            <TextInput
              label="Contraseña del backup"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={styles.input}
            />
            {error && <HelperText type="error">{error}</HelperText>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogo(null)} disabled={procesando}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={onRestaurar} loading={procesando} disabled={procesando}>
              Elegir archivo y restaurar
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, gap: 8 },
  card: { marginTop: 2 },
  input: { marginBottom: 8 },
  warn: { marginBottom: 12 },
});
