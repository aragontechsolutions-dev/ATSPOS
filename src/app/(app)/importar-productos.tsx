import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, List, Snackbar, Text } from 'react-native-paper';

import { importarProductos } from '@/db/repositories/import';
import { auditar } from '@/lib/audit';
import { descargarPlantilla, leerArchivoProductos, type ResultadoLectura } from '@/lib/import-productos';
import { useSessionStore } from '@/store/session';

export default function ImportarProductosScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number } | null>(null);

  async function onPlantilla() {
    setOcupado(true);
    try {
      const ok = await descargarPlantilla();
      if (!ok) setSnackbar('Compartir no está disponible en este dispositivo');
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo generar la plantilla');
    } finally {
      setOcupado(false);
    }
  }

  async function onElegirArchivo() {
    setOcupado(true);
    setResultado(null);
    try {
      const res = await leerArchivoProductos();
      if (res) setLectura(res);
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    } finally {
      setOcupado(false);
    }
  }

  async function onImportar() {
    if (!usuario || !lectura || lectura.filas.length === 0) return;
    setOcupado(true);
    try {
      const r = await importarProductos(lectura.filas, usuario.id);
      auditar('Importación de productos', `Creados: ${r.creados} · Actualizados: ${r.actualizados}`);
      setResultado(r);
      setLectura(null);
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo importar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Card.Content>
          <Text variant="titleMedium" style={styles.h}>
            Cargar productos desde Excel
          </Text>
          <Text variant="bodyMedium">
            Seguí estos 3 pasos. No necesitás saber de computación: solo llenar una planilla y subirla.
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <List.Item
          title="Paso 1 — Descargar la planilla"
          description="Se guarda un archivo de ejemplo con las columnas ya puestas"
          left={(props) => <List.Icon {...props} icon="numeric-1-circle" />}
        />
        <View style={styles.pad}>
          <Button icon="file-download" mode="contained-tonal" onPress={onPlantilla} disabled={ocupado}>
            Descargar planilla
          </Button>
        </View>
      </Card>

      <Card style={styles.card}>
        <List.Item
          title="Paso 2 — Completá la planilla"
          description="Abrila en Excel o Google Sheets y cargá tus productos (una fila por producto). Guardala."
          left={(props) => <List.Icon {...props} icon="numeric-2-circle" />}
        />
        <View style={styles.pad}>
          <Text variant="bodySmall" style={styles.ayuda}>
            Obligatorio: nombre y precio de venta. Lo demás es opcional. En "unidad" poné{' '}
            <Text style={styles.bold}>unidad</Text> o <Text style={styles.bold}>kg</Text>. Usá punto para los
            decimales (ej. 1250.50).
          </Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <List.Item
          title="Paso 3 — Subir la planilla"
          description="Elegí el archivo completado (.csv o Excel)"
          left={(props) => <List.Icon {...props} icon="numeric-3-circle" />}
        />
        <View style={styles.pad}>
          <Button icon="upload" mode="contained" onPress={onElegirArchivo} disabled={ocupado} loading={ocupado && !resultado}>
            Elegir archivo
          </Button>
        </View>
      </Card>

      {lectura && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.h}>
              Revisión
            </Text>
            <Text variant="bodyLarge">
              {lectura.filas.length} producto(s) listos para importar.
            </Text>
            {lectura.errores.length > 0 && (
              <>
                <Text variant="bodyMedium" style={styles.errorTitle}>
                  {lectura.errores.length} fila(s) con problemas (se omiten):
                </Text>
                {lectura.errores.slice(0, 8).map((e, i) => (
                  <Text key={i} variant="bodySmall" style={styles.errorItem}>
                    • {e}
                  </Text>
                ))}
                {lectura.errores.length > 8 && (
                  <Text variant="bodySmall" style={styles.errorItem}>
                    …y {lectura.errores.length - 8} más
                  </Text>
                )}
              </>
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => setLectura(null)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              icon="check"
              onPress={onImportar}
              loading={ocupado}
              disabled={ocupado || lectura.filas.length === 0}
            >
              Importar {lectura.filas.length}
            </Button>
          </Card.Actions>
        </Card>
      )}

      {resultado && (
        <Card style={[styles.card, styles.okCard]}>
          <Card.Content>
            <Text variant="titleMedium">¡Listo!</Text>
            <Text variant="bodyMedium">Productos nuevos creados: {resultado.creados}</Text>
            <Text variant="bodyMedium">Productos actualizados: {resultado.actualizados}</Text>
          </Card.Content>
        </Card>
      )}

      <Divider style={styles.card} />
      <Text variant="bodySmall" style={styles.nota}>
        Si un producto de la planilla ya existe (mismo nombre o código), se actualizan sus precios y datos. El stock
        inicial solo se aplica a los productos nuevos.
      </Text>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
        {snackbar ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, gap: 8 },
  card: { marginTop: 2 },
  h: { marginBottom: 6 },
  pad: { paddingHorizontal: 16, paddingBottom: 16 },
  ayuda: { opacity: 0.8 },
  bold: { fontWeight: 'bold' },
  errorTitle: { color: '#B3261E', marginTop: 12, marginBottom: 4 },
  errorItem: { color: '#B3261E' },
  okCard: { backgroundColor: '#DCF4E9' },
  nota: { opacity: 0.6, paddingHorizontal: 4 },
});
