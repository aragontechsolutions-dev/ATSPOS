import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const sqliteDb = openDatabaseSync('atspos.db', { enableChangeListener: true });

export const db = drizzle(sqliteDb, { schema });

export type Database = typeof db;
