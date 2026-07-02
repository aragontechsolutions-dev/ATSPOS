import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import React, { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { db } from './client';
import migrations from './migrations/migrations';
import { seedDatabase } from './seed';

export function DatabaseProvider({ children }: PropsWithChildren) {
  const { success: migrationsReady, error: migrationError } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!migrationsReady) return;
    seedDatabase(db)
      .then(() => setSeeded(true))
      .catch((error: Error) => setSeedError(error));
  }, [migrationsReady]);

  if (migrationError || seedError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Error al iniciar la base de datos: {(migrationError ?? seedError)?.message}
        </Text>
      </View>
    );
  }

  if (!migrationsReady || !seeded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#B00020',
    textAlign: 'center',
  },
});
