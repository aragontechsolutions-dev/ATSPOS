import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';

// QR is the primary format used for product labels; the common linear barcodes
// stay enabled so externally-labelled products can still be scanned.
const BARCODE_TYPES: BarcodeType[] = ['qr', 'ean13', 'ean8', 'code128', 'upc_a'];

interface Props {
  visible: boolean;
  onScanned: (data: string) => void;
  onClose: () => void;
}

export function BarcodeScannerModal({ visible, onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [torch, setTorch] = useState(false);
  // Some Samsung/Xiaomi devices show a black preview if CameraView mounts
  // right as the modal animation starts; a short delay avoids it.
  const [readyToMount, setReadyToMount] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReadyToMount(false);
      setLocked(false);
      setTorch(false);
      return;
    }
    const timeout = setTimeout(() => setReadyToMount(true), 200);
    return () => clearTimeout(timeout);
  }, [visible]);

  if (!visible) return null;

  function handleScan(data: string) {
    if (locked) return;
    setLocked(true);
    onScanned(data);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.message}>Necesitamos permiso de cámara para escanear códigos QR.</Text>
            <Button mode="contained" onPress={requestPermission} style={styles.button}>
              Dar permiso
            </Button>
            <Button onPress={onClose} style={styles.button}>
              Cancelar
            </Button>
          </View>
        ) : (
          <>
            {readyToMount && (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                onBarcodeScanned={(result) => handleScan(result.data)}
              />
            )}
            <View style={styles.overlay}>
              <IconButton
                icon={torch ? 'flashlight' : 'flashlight-off'}
                mode="contained"
                size={32}
                onPress={() => setTorch((t) => !t)}
                accessibilityLabel={torch ? 'Apagar linterna' : 'Encender linterna'}
                style={styles.torchButton}
              />
              <Button mode="contained" onPress={onClose} style={styles.button}>
                Cancelar
              </Button>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlay: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  message: { color: 'white', textAlign: 'center', marginBottom: 16 },
  button: { marginTop: 8 },
  torchButton: { marginBottom: 4 },
});
