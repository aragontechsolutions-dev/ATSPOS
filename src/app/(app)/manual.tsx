import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List, SegmentedButtons, Text } from 'react-native-paper';

import { MANUALES } from '@/lib/manual';
import { ROLES, tienePermiso, type RolNombre } from '@/lib/roles';
import { useSessionStore } from '@/store/session';

export default function ManualScreen() {
  const usuario = useSessionStore((s) => s.usuario);
  const esAdmin = usuario ? tienePermiso(usuario.rol, 'gestionarUsuarios') : false;
  const [rol, setRol] = useState<RolNombre>(usuario?.rol ?? ROLES.CAJERO);

  // El usuario ve el manual de su rol; solo el admin puede ver los de todos.
  const rolMostrado = esAdmin ? rol : (usuario?.rol ?? ROLES.CAJERO);
  const manual = MANUALES[rolMostrado];

  if (!usuario) return null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {esAdmin && (
        <SegmentedButtons
          value={rol}
          onValueChange={(v) => setRol(v as RolNombre)}
          buttons={Object.values(ROLES).map((r) => ({ value: r, label: r }))}
          style={styles.selector}
        />
      )}

      <Text variant="titleLarge" style={styles.titulo}>
        {manual.titulo}
      </Text>
      <Text variant="bodyMedium" style={styles.intro}>
        {manual.intro}
      </Text>

      {manual.secciones.map((seccion) => (
        <List.Accordion
          key={seccion.titulo}
          title={seccion.titulo}
          titleNumberOfLines={2}
          left={(props) => <List.Icon {...props} icon={seccion.icono} />}
          style={styles.accordion}
        >
          {seccion.pasos.map((paso, i) => (
            <List.Item
              key={i}
              title={`${i + 1}. ${paso}`}
              titleNumberOfLines={6}
              titleStyle={styles.paso}
              style={styles.pasoItem}
            />
          ))}
        </List.Accordion>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 40 },
  selector: { marginBottom: 12 },
  titulo: { marginBottom: 4 },
  intro: { opacity: 0.75, marginBottom: 12 },
  accordion: { backgroundColor: '#F2F4F5', borderRadius: 8, marginBottom: 6 },
  pasoItem: { paddingVertical: 0 },
  paso: { fontSize: 14, lineHeight: 20 },
});
