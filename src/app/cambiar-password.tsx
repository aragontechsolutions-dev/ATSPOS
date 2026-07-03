import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { cambiarPassword } from '@/db/repositories/usuarios';
import { useSessionStore } from '@/store/session';

export default function CambiarPasswordScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const refresh = useSessionStore((s) => s.refresh);
  const logout = useSessionStore((s) => s.logout);
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (!usuario) return;
    setError(null);
    setLoading(true);
    try {
      await cambiarPassword(usuario.id, nueva);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Cambiá tu contraseña
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Es tu primer ingreso como {usuario?.username}. Elegí una contraseña nueva antes de continuar.
      </Text>

      <TextInput
        label="Nueva contraseña"
        secureTextEntry
        value={nueva}
        onChangeText={setNueva}
        mode="outlined"
        style={styles.input}
      />
      <TextInput
        label="Confirmar contraseña"
        secureTextEntry
        value={confirmar}
        onChangeText={setConfirmar}
        mode="outlined"
        style={styles.input}
        onSubmitEditing={onSubmit}
      />

      {error && (
        <Text style={styles.error} variant="bodyMedium">
          {error}
        </Text>
      )}

      <Button icon="content-save" mode="contained" onPress={onSubmit} loading={loading} disabled={loading} style={styles.button}>
        Guardar
      </Button>
      <Button icon="logout" onPress={() => logout()} style={styles.button}>
        Cancelar y cerrar sesión
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  input: {
    marginBottom: 12,
  },
  error: {
    color: '#B00020',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
  },
});
