import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

const DB_KEY_STORE = 'atspos_db_key';

// The SQLCipher key never lives in the code. On first launch we generate a
// random 256-bit key and keep it in the Android Keystore-backed SecureStore;
// afterwards we read it back. SecureStore's synchronous API lets us obtain the
// key before opening the database, so `db` stays a normal module-level export.
function getOrCreateDbKey(): string {
  let key = SecureStore.getItem(DB_KEY_STORE);
  if (!key) {
    const bytes = Crypto.getRandomBytes(32);
    key = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    SecureStore.setItem(DB_KEY_STORE, key);
  }
  return key;
}

export const sqliteDb = openDatabaseSync('atspos.db', { enableChangeListener: true });

// `PRAGMA key` with a raw hex blob (`x'...'`) uses the key directly, without
// SQLCipher's own KDF. It must run before any other statement touches the DB.
sqliteDb.execSync(`PRAGMA key = "x'${getOrCreateDbKey()}'"`);

export const db = drizzle(sqliteDb, { schema });

export type Database = typeof db;
