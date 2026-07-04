import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Snackbar, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

import { getProductoById, type Producto } from '@/db/repositories/productos';
import { formatMoney } from '@/lib/money';
import { contenidoQrProducto } from '@/lib/qr';

export default function ProductoQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  useEffect(() => {
    if (id) getProductoById(id).then(setProducto);
  }, [id]);

  function getQrPngBase64(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!qrRef.current) return reject(new Error('El QR todavía no está listo'));
      qrRef.current.toDataURL((data) => resolve(data));
    });
  }

  async function compartirImagen() {
    try {
      const base64 = await getQrPngBase64();
      const nombreArchivo = `qr-${(producto?.nombre ?? 'producto').replace(/[^a-zA-Z0-9]+/g, '-')}.png`;
      const file = new File(Paths.cache, nombreArchivo);
      if (file.exists) file.delete();
      file.create();
      file.write(base64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Compartir QR' });
      } else {
        setSnackbar('Compartir no está disponible en este dispositivo');
      }
    } catch (e) {
      setSnackbar(e instanceof Error ? e.message : 'No se pudo exportar la imagen');
    }
  }

  async function imprimir() {
    try {
      const base64 = await getQrPngBase64();
      const html = `
        <html>
          <body style="margin:0;font-family:sans-serif;text-align:center;">
            <div style="display:inline-block;border:1px solid #000;border-radius:8px;padding:24px;margin:24px;">
              <img src="data:image/png;base64,${base64}" style="width:240px;height:240px;" />
              <div style="font-size:22px;font-weight:bold;margin-top:12px;">${producto?.nombre ?? ''}</div>
              <div style="font-size:26px;margin-top:4px;">${producto ? formatMoney(producto.precioVenta) : ''}</div>
            </div>
          </body>
        </html>`;
      await Print.printAsync({ html });
    } catch (e) {
      // El usuario puede cancelar el diálogo de impresión; solo avisamos errores reales.
      if (e instanceof Error && !/cancel/i.test(e.message)) setSnackbar(e.message);
    }
  }

  if (!producto) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleLarge" style={styles.nombre}>
            {producto.nombre}
          </Text>
          <Text variant="headlineSmall">{formatMoney(producto.precioVenta)}</Text>
          <View style={styles.qrBox}>
            <QRCode
              value={contenidoQrProducto(producto.id)}
              size={240}
              getRef={(c) => {
                qrRef.current = c;
              }}
            />
          </View>
          <Text variant="bodySmall" style={styles.hint}>
            Imprimí esta etiqueta y pegala en el producto. Escaneala desde la pantalla de Venta.
          </Text>
        </Card.Content>
      </Card>

      <Button icon="printer" mode="contained" onPress={imprimir} style={styles.btn}>
        Imprimir etiqueta
      </Button>
      <Button icon="image" mode="outlined" onPress={compartirImagen} style={styles.btn}>
        Compartir imagen (PNG)
      </Button>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  cardContent: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  nombre: { textAlign: 'center' },
  qrBox: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginVertical: 8 },
  hint: { textAlign: 'center', opacity: 0.7, marginTop: 4 },
  btn: { marginTop: 4 },
});
