import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  Divider,
  HelperText,
  Portal,
  Searchbar,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { listarProductos, type Producto } from '@/db/repositories/productos';
import { aplicarConteoInventario, type ResultadoConteoLinea } from '@/db/repositories/stock';
import { auditar } from '@/lib/audit';
import { formatCantidad, formatMoney } from '@/lib/money';
import { useSessionStore } from '@/store/session';

export default function ConteoInventarioScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  // Texto crudo tipeado por producto (vacío = no contado, se omite).
  const [contados, setContados] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConteoLinea[] | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const recargar = useCallback(() => {
    listarProductos().then(setProductos);
  }, []);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  function parseCantidad(texto: string, unidad: string): number | null {
    const t = texto.trim().replace(',', '.');
    if (t === '') return null;
    const v = Number.parseFloat(t);
    if (Number.isNaN(v) || v < 0) return null;
    return unidad === 'kg' ? v : Math.round(v);
  }

  // Líneas contadas (con valor tipeado válido) y sus diferencias.
  const lineas = useMemo(() => {
    const res: { producto: Producto; contada: number; delta: number }[] = [];
    for (const p of productos) {
      const texto = contados[p.id];
      if (texto === undefined) continue;
      const contada = parseCantidad(texto, p.unidadMedida);
      if (contada === null) continue;
      res.push({ producto: p, contada, delta: contada - p.stockActual });
    }
    return res;
  }, [productos, contados]);

  const conDiferencia = lineas.filter((l) => l.delta !== 0);
  const valorNeto = conDiferencia.reduce((acc, l) => acc + Math.round(l.delta * l.producto.precioCosto), 0);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [productos, busqueda]);

  async function aplicar() {
    if (!usuario) return;
    setProcesando(true);
    try {
      const items = lineas.map((l) => ({ productoId: l.producto.id, cantidadContada: l.contada }));
      const { lineas: res } = await aplicarConteoInventario({ items, usuarioId: usuario.id });
      const ajustados = res.filter((l) => l.delta !== 0);
      auditar(
        'Conteo de inventario',
        `${res.length} producto(s) contados, ${ajustados.length} con diferencia`,
      );
      setResultado(ajustados);
      setContados({});
      setBusqueda('');
      recargar();
      setConfirmar(false);
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo aplicar el conteo');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Card.Content>
          <Text variant="bodyMedium">
            Recuento físico de cierre. Recorré los productos y anotá cuántas unidades tenés realmente. Dejá en blanco
            los que no cuentes: solo se ajustan los que escribas. Al confirmar, el stock del sistema se corrige a lo
            contado y queda registrado.
          </Text>
        </Card.Content>
      </Card>

      <Searchbar
        placeholder="Buscar producto"
        value={busqueda}
        onChangeText={setBusqueda}
        style={styles.search}
      />

      {lineas.length > 0 && (
        <Text variant="bodySmall" style={styles.contador}>
          {lineas.length} contado(s) · {conDiferencia.length} con diferencia
        </Text>
      )}

      <Card style={styles.card}>
        {filtrados.length === 0 ? (
          <Card.Content>
            <Text style={styles.empty}>No hay productos que coincidan.</Text>
          </Card.Content>
        ) : (
          filtrados.map((p, i) => {
            const texto = contados[p.id] ?? '';
            const contada = parseCantidad(texto, p.unidadMedida);
            const delta = contada === null ? null : contada - p.stockActual;
            return (
              <View key={p.id}>
                {i > 0 && <Divider />}
                <View style={styles.fila}>
                  <View style={styles.filaInfo}>
                    <Text variant="titleSmall">{p.nombre}</Text>
                    <Text variant="bodySmall" style={styles.sistema}>
                      Sistema: {formatCantidad(p.stockActual, p.unidadMedida)}
                      {delta !== null && delta !== 0 && (
                        <Text style={delta > 0 ? styles.sobrante : styles.faltante}>
                          {'  '}
                          {delta > 0 ? '+' : ''}
                          {formatCantidad(delta, p.unidadMedida)}
                        </Text>
                      )}
                    </Text>
                  </View>
                  <TextInput
                    label="Contado"
                    value={texto}
                    onChangeText={(t) => setContados((prev) => ({ ...prev, [p.id]: t }))}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    dense
                    style={styles.filaInput}
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Button
        icon="clipboard-check"
        mode="contained"
        onPress={() => setConfirmar(true)}
        disabled={lineas.length === 0}
        style={styles.aplicar}
      >
        {lineas.length === 0 ? 'Aplicar conteo' : `Aplicar conteo (${lineas.length})`}
      </Button>

      <Portal>
        <Dialog visible={confirmar} onDismiss={() => !procesando && setConfirmar(false)}>
          <Dialog.Title>Confirmar conteo</Dialog.Title>
          <Dialog.Content>
            {conDiferencia.length === 0 ? (
              <Text variant="bodyMedium">
                Contaste {lineas.length} producto(s) y ninguno tiene diferencia con el sistema. No se hará ningún
                ajuste.
              </Text>
            ) : (
              <>
                <Text variant="bodyMedium" style={styles.dialogIntro}>
                  {conDiferencia.length} producto(s) con diferencia se van a ajustar:
                </Text>
                <ScrollView style={styles.dialogLista}>
                  {conDiferencia.map((l) => (
                    <View key={l.producto.id} style={styles.dialogFila}>
                      <Text variant="bodySmall" style={styles.dialogNombre} numberOfLines={1}>
                        {l.producto.nombre}
                      </Text>
                      <Text variant="bodySmall" style={l.delta > 0 ? styles.sobrante : styles.faltante}>
                        {l.delta > 0 ? '+' : ''}
                        {formatCantidad(l.delta, l.producto.unidadMedida)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <HelperText type={valorNeto < 0 ? 'error' : 'info'} style={styles.dialogValor}>
                  Impacto en valor de inventario: {valorNeto > 0 ? '+' : ''}
                  {formatMoney(valorNeto)}
                </HelperText>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmar(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={aplicar} loading={procesando} disabled={procesando}>
              Confirmar
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!resultado} onDismiss={() => setResultado(null)}>
          <Dialog.Icon icon="check-circle" />
          <Dialog.Title style={styles.centrado}>Conteo aplicado</Dialog.Title>
          <Dialog.Content>
            {resultado && resultado.length === 0 ? (
              <Text variant="bodyMedium" style={styles.centrado}>
                No hubo diferencias: el stock ya coincidía con lo contado.
              </Text>
            ) : (
              <>
                <Text variant="bodyMedium" style={styles.dialogIntro}>
                  Se ajustaron {resultado?.length} producto(s):
                </Text>
                <ScrollView style={styles.dialogLista}>
                  {resultado?.map((l) => (
                    <View key={l.productoId} style={styles.dialogFila}>
                      <Text variant="bodySmall" style={styles.dialogNombre} numberOfLines={1}>
                        {l.nombre}
                      </Text>
                      <Text variant="bodySmall" style={l.delta > 0 ? styles.sobrante : styles.faltante}>
                        {formatCantidad(l.stockSistema, l.unidadMedida)} → {formatCantidad(l.cantidadContada, l.unidadMedida)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResultado(null)}>Cerrar</Button>
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
  search: { marginTop: 4 },
  contador: { marginLeft: 4, opacity: 0.7 },
  card: { marginBottom: 8 },
  empty: { textAlign: 'center', opacity: 0.6, paddingVertical: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, gap: 12 },
  filaInfo: { flex: 1 },
  sistema: { opacity: 0.7, marginTop: 2 },
  filaInput: { width: 110 },
  sobrante: { color: '#0B6E4F', fontWeight: 'bold' },
  faltante: { color: '#B00020', fontWeight: 'bold' },
  aplicar: { marginTop: 4, marginBottom: 24 },
  dialogIntro: { marginBottom: 8 },
  dialogLista: { maxHeight: 240 },
  dialogFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, gap: 8 },
  dialogNombre: { flex: 1 },
  dialogValor: { paddingHorizontal: 0 },
  centrado: { textAlign: 'center' },
});
