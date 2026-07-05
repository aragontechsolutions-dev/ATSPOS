import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, HelperText, List, Portal, Snackbar, Text, TextInput } from 'react-native-paper';

import { autotestBackup, exportarBackup, guardarBackupEnCarpeta, restaurarBackup } from '@/lib/backup';
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
  const [detalle, setDetalle] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);

  function abrir(modo: Modo) {
    setPassword('');
    setPassword2('');
    setError(null);
    setDetalle(null);
    setDialogo(modo);
  }

  async function onDiagnostico() {
    setProcesando(true);
    setDiagnostico('Ejecutando…');
    try {
      const res = await autotestBackup();
      setDiagnostico(
        res.ok
          ? `✅ OK — ${res.detalle}`
          : `❌ Falló en la etapa "${res.etapa}":\n${res.detalle}`,
      );
    } catch (e) {
      setDiagnostico(`❌ Error inesperado: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcesando(false);
    }
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

  async function onGuardarEnTelefono() {
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
      const res = await guardarBackupEnCarpeta(password);
      if (res.ok) {
        auditar('Backup guardado en el teléfono');
        setDialogo(null);
        setSnackbar('Backup guardado en la carpeta elegida');
      } else if (res.motivo === 'cancelado') {
        // el usuario cerró el selector de carpeta
      } else {
        setError('No se pudo guardar en esa carpeta. Probá con "Descargas".');
      }
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
    setDetalle(null);
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
      if (res.motivo === 'cancelado' && !res.detalle) {
        setDialogo(null);
        return;
      }
      setError(
        res.motivo === 'password'
          ? 'Contraseña incorrecta o archivo dañado'
          : res.motivo === 'formato'
            ? 'El archivo no es un backup válido de ATSPOS'
            : res.motivo === 'cancelado'
              ? 'No se pudo leer el archivo'
              : 'No se pudo restaurar el backup',
      );
      setDetalle(res.detalle ?? null);
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
          description="Genera un .atsbak: compartilo o guardalo en una carpeta del teléfono"
          left={(props) => <List.Icon {...props} icon="cloud-upload" />}
          onPress={() => abrir('exportar')}
        />
      </Card>

      <Card style={styles.card}>
        <List.Item
          title="Restaurar backup"
          description="Elegí un archivo .atsbak y reemplazá los datos actuales"
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

      <Card style={styles.card}>
        <List.Item
          title="Probar cifrado (diagnóstico)"
          description="Verifica el cifrado/descifrado en memoria, sin archivos"
          left={(props) => <List.Icon {...props} icon="bug-check" />}
          onPress={onDiagnostico}
        />
      </Card>

      {diagnostico && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.diagTitulo}>
              Resultado del diagnóstico
            </Text>
            <Text variant="bodySmall" style={styles.diagTexto} selectable>
              {diagnostico}
            </Text>
            <Button compact onPress={() => setDiagnostico(null)}>
              Cerrar
            </Button>
          </Card.Content>
        </Card>
      )}

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
            <Text variant="bodySmall" style={styles.tip}>
              Consejo: para poder restaurarlo después en este teléfono, usá "Guardar en el teléfono" y elegí
              la carpeta "Descargas".
            </Text>
            {error && <HelperText type="error">{error}</HelperText>}
          </Dialog.Content>
          <Dialog.Actions style={styles.exportActions}>
            <Button icon="content-save" onPress={onGuardarEnTelefono} loading={procesando} disabled={procesando}>
              Guardar en el teléfono
            </Button>
            <Button icon="share-variant" mode="contained" onPress={onExportar} loading={procesando} disabled={procesando}>
              Compartir
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={dialogo === 'restaurar'} onDismiss={() => !procesando && setDialogo(null)}>
          <Dialog.Title>Restaurar backup</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.warn}>
              Esto reemplaza todos los datos actuales por los del backup. Al tocar "Elegir archivo" buscá el
              .atsbak donde lo guardaste (Descargas, Drive, o el documento recibido por WhatsApp).
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
            {detalle && (
              <Text variant="bodySmall" style={styles.diagTexto} selectable>
                Detalle técnico: {detalle}
              </Text>
            )}
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
  tip: { opacity: 0.7, marginBottom: 8 },
  exportActions: { flexWrap: 'wrap' },
  diagTitulo: { marginBottom: 4 },
  diagTexto: { marginTop: 6, opacity: 0.85, fontFamily: 'monospace' },
});
