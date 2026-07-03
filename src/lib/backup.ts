import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { sqliteDb } from '@/db/client';

// Tables in FK-safe insert order (parents before children). Deletes run in
// reverse. `auditoria` is included so the trail survives a restore.
const TABLAS_ORDEN = [
  'roles',
  'categorias',
  'proveedores',
  'usuarios',
  'productos',
  'turnos',
  'ventas',
  'detalle_venta',
  'compras',
  'detalle_compra',
  'movimientos_stock',
  'movimientos_caja',
  'auditoria',
];

const FORMATO = 1;
const KDF_ITERACIONES = 4096;

type Fila = Record<string, string | number | null>;
type Dump = Record<string, Fila[]>;

interface Envelope {
  app: 'ATSPOS';
  formato: number;
  fecha: string;
  salt: string;
  iteraciones: number;
  ivLength: number;
  tagLength: number;
  contenido: string; // base64 de iv+ciphertext+tag
}

function randomHex(bytes: number): string {
  return Array.from(Crypto.getRandomBytes(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Explicit UTF-8 codecs so backups round-trip accents/ñ correctly without
// depending on TextEncoder/TextDecoder being present in the JS engine.
function utf8ToBytes(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(++i);
      c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

function bytesToUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b < 0xf0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    } else {
      const cp =
        ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const c = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    }
  }
  return out;
}

// Salted, stretched SHA-256 used to turn the admin password into a 256-bit AES
// key. Not textbook PBKDF2 (no HMAC), but with a random salt and several
// thousand iterations it's adequate for protecting a local backup file, and it
// only relies on expo-crypto (no extra native deps).
async function deriveKey(password: string, saltHex: string, iteraciones: number): Promise<Crypto.AESEncryptionKey> {
  let h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${saltHex}:${password}`);
  for (let i = 1; i < iteraciones; i++) {
    h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h);
  }
  return Crypto.AESEncryptionKey.import(h, 'hex');
}

function dumpTablas(): Dump {
  const dump: Dump = {};
  for (const tabla of TABLAS_ORDEN) {
    dump[tabla] = sqliteDb.getAllSync<Fila>(`SELECT * FROM "${tabla}"`);
  }
  return dump;
}

/** Exports an encrypted backup of the whole database and opens the share sheet. */
export async function exportarBackup(password: string): Promise<boolean> {
  const dump = dumpTablas();
  const salt = randomHex(16);
  const key = await deriveKey(password, salt, KDF_ITERACIONES);

  const plaintext = utf8ToBytes(JSON.stringify(dump));
  const sealed = await Crypto.aesEncryptAsync(plaintext, key);
  const contenido = (await sealed.combined('base64')) as string;

  const envelope: Envelope = {
    app: 'ATSPOS',
    formato: FORMATO,
    fecha: new Date().toISOString(),
    salt,
    iteraciones: KDF_ITERACIONES,
    ivLength: sealed.ivSize,
    tagLength: sealed.tagSize,
    contenido,
  };

  const nombre = `atspos-backup-${new Date().toISOString().slice(0, 10)}.atsbak`;
  const file = new File(Paths.cache, nombre);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(envelope));

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Guardar backup de ATSPOS' });
  return true;
}

function reemplazarDatos(dump: Dump): void {
  // FK enforcement must be toggled outside a transaction.
  sqliteDb.execSync('PRAGMA foreign_keys=OFF');
  try {
    sqliteDb.withTransactionSync(() => {
      for (const tabla of [...TABLAS_ORDEN].reverse()) {
        sqliteDb.runSync(`DELETE FROM "${tabla}"`);
      }
      for (const tabla of TABLAS_ORDEN) {
        for (const fila of dump[tabla] ?? []) {
          const cols = Object.keys(fila);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const columnas = cols.map((c) => `"${c}"`).join(', ');
          sqliteDb.runSync(
            `INSERT INTO "${tabla}" (${columnas}) VALUES (${placeholders})`,
            cols.map((c) => fila[c]),
          );
        }
      }
    });
  } finally {
    sqliteDb.execSync('PRAGMA foreign_keys=ON');
  }
}

export interface ResultadoRestore {
  ok: boolean;
  motivo?: 'cancelado' | 'password' | 'formato' | 'error';
}

/** Lets the user pick a .atsbak file, decrypts it and replaces all data. */
export async function restaurarBackup(password: string): Promise<ResultadoRestore> {
  let texto: string;
  try {
    const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
    if (picked.canceled) return { ok: false, motivo: 'cancelado' };
    texto = await picked.result.text();
  } catch {
    return { ok: false, motivo: 'cancelado' };
  }

  let envelope: Envelope;
  try {
    envelope = JSON.parse(texto);
    if (envelope.app !== 'ATSPOS' || !envelope.contenido || !envelope.salt) {
      return { ok: false, motivo: 'formato' };
    }
  } catch {
    return { ok: false, motivo: 'formato' };
  }

  let dump: Dump;
  try {
    const key = await deriveKey(password, envelope.salt, envelope.iteraciones);
    const sealed = Crypto.AESSealedData.fromCombined(envelope.contenido, {
      ivLength: envelope.ivLength ?? 12,
      tagLength: (envelope.tagLength ?? 16) as Crypto.GCMTagByteLength,
    });
    const bytes = (await Crypto.aesDecryptAsync(sealed, key)) as Uint8Array;
    dump = JSON.parse(bytesToUtf8(bytes));
  } catch {
    // GCM tag mismatch → wrong password (or corrupted file).
    return { ok: false, motivo: 'password' };
  }

  try {
    reemplazarDatos(dump);
  } catch {
    return { ok: false, motivo: 'error' };
  }
  return { ok: true };
}
