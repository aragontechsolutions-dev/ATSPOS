import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
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

const FORMATO = 3;
const KDF_ITERACIONES = 4096;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

type Fila = Record<string, string | number | null>;
type Dump = Record<string, Fila[]>;

interface Envelope {
  app: 'ATSPOS';
  formato: number;
  fecha: string;
  salt: string;
  iteraciones: number;
  // Formato 3: IV+ciphertext+tag en un solo string base64 (combined). Es el
  // único método de expo-crypto que devuelve string de forma fiable en Android.
  combined?: string; // base64
  ivLength?: number; // bytes del IV dentro de combined
  tagLength?: number; // bytes del tag dentro de combined
  // Formato 2 (compat): partes por separado. NOTA: ciphertext() a veces
  // devolvía bytes en vez de base64, por eso se dejó de usar.
  iv?: string;
  ciphertext?: string;
  tag?: string;
  // Formato 1 (compat): campo `contenido` combinado.
  contenido?: string;
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

const B64_ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Decodifica base64 a bytes. Necesario porque fromCombined/fromParts de
// expo-crypto en Android sólo aceptan Uint8Array (aunque el tipo diga string).
function base64ToBytes(b64: string): Uint8Array {
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64_ALFABETO.length; i++) lookup[B64_ALFABETO.charCodeAt(i)] = i;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let bits = 0;
  let acc = 0;
  let oi = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = lookup[clean.charCodeAt(i)];
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[oi++] = (acc >> bits) & 0xff;
    }
  }
  return out;
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

const nombreBackup = () => `atspos-backup-${new Date().toISOString().slice(0, 10)}.atsbak`;

/**
 * Cifra un objeto arbitrario en un Envelope (formato 2, partes separadas).
 * Reutilizado por el backup real y por el autotest de diagnóstico.
 */
async function cifrarObjeto(obj: unknown, password: string): Promise<Envelope> {
  const salt = randomHex(16);
  const key = await deriveKey(password, salt, KDF_ITERACIONES);

  const plaintext = utf8ToBytes(JSON.stringify(obj));
  const sealed = await Crypto.aesEncryptAsync(plaintext, key);

  // combined('base64') usa la misma forma posicional que iv()/tag(), que sí
  // devuelven base64 de forma fiable en Android (ciphertext(options) devolvía
  // bytes pese a pedir base64, rompiendo el round-trip por JSON).
  return {
    app: 'ATSPOS',
    formato: FORMATO,
    fecha: new Date().toISOString(),
    salt,
    iteraciones: KDF_ITERACIONES,
    combined: (await sealed.combined('base64')) as string,
    ivLength: IV_LENGTH,
    tagLength: TAG_LENGTH,
  };
}

/** Descifra un Envelope (formato 1, 2 o 3) devolviendo el objeto original. */
async function descifrarEnvelope(envelope: Envelope, password: string): Promise<unknown> {
  const key = await deriveKey(password, envelope.salt, envelope.iteraciones);
  let sealed: Crypto.AESSealedData;
  if (envelope.combined || envelope.contenido) {
    // Formatos 3 y 1: string combinado base64 → bytes (native espera Uint8Array).
    sealed = Crypto.AESSealedData.fromCombined(base64ToBytes((envelope.combined ?? envelope.contenido) as string), {
      ivLength: envelope.ivLength ?? IV_LENGTH,
      tagLength: (envelope.tagLength ?? TAG_LENGTH) as Crypto.GCMTagByteLength,
    });
  } else {
    // Formato 2: partes por separado (compat con backups viejos que funcionaran).
    sealed = Crypto.AESSealedData.fromParts(
      base64ToBytes(envelope.iv as string),
      base64ToBytes(envelope.ciphertext as string),
      base64ToBytes(envelope.tag as string),
    );
  }
  const bytes = (await Crypto.aesDecryptAsync(sealed, key)) as Uint8Array;
  return JSON.parse(bytesToUtf8(bytes));
}

async function construirBackupJson(password: string): Promise<string> {
  const dump = dumpTablas();
  const envelope = await cifrarObjeto(dump, password);
  return JSON.stringify(envelope);
}

/** Exports an encrypted backup and opens the share sheet (WhatsApp/Drive/mail). */
export async function exportarBackup(password: string): Promise<boolean> {
  const json = await construirBackupJson(password);
  const file = new File(Paths.document, nombreBackup());
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (file.size <= 0) throw new Error('El backup quedó vacío al generarse');

  if (!(await Sharing.isAvailableAsync())) return false;
  // octet-stream: WhatsApp/apps lo adjuntan como archivo genérico sin intentar
  // previsualizarlo como texto (lo que rompía la pantalla de comentario).
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Guardar backup de ATSPOS',
  });
  return true;
}

export interface ResultadoGuardado {
  ok: boolean;
  motivo?: 'cancelado' | 'error';
}

/**
 * Saves the backup into a folder the user picks (e.g. Downloads). Unlike the
 * app's private dir, this location is browsable later from the restore picker.
 */
export async function guardarBackupEnCarpeta(password: string): Promise<ResultadoGuardado> {
  const json = await construirBackupJson(password);

  let carpeta: Directory;
  try {
    carpeta = await Directory.pickDirectoryAsync();
  } catch {
    return { ok: false, motivo: 'cancelado' };
  }

  try {
    const file = carpeta.createFile(nombreBackup(), 'application/octet-stream');
    file.write(json);
    return { ok: true };
  } catch {
    return { ok: false, motivo: 'error' };
  }
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
  /** Mensaje técnico real de la etapa que falló (para diagnóstico en pantalla). */
  detalle?: string;
}

function mensajeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  try {
    return String(e);
  } catch {
    return 'error desconocido';
  }
}

/** Lets the user pick a .atsbak file, decrypts it and replaces all data. */
export async function restaurarBackup(password: string): Promise<ResultadoRestore> {
  let texto: string;
  try {
    // Sin filtro de tipo: el .atsbak suele reportarse como octet-stream/desconocido.
    const picked = await File.pickFileAsync();
    if (picked.canceled) return { ok: false, motivo: 'cancelado' };
    texto = await picked.result.text();
  } catch (e) {
    return { ok: false, motivo: 'cancelado', detalle: `lectura archivo: ${mensajeError(e)}` };
  }

  let envelope: Envelope;
  try {
    envelope = JSON.parse(texto);
    const tienePartes = envelope.iv && envelope.ciphertext && envelope.tag;
    const tieneCarga = envelope.combined || envelope.contenido || tienePartes;
    if (envelope.app !== 'ATSPOS' || !envelope.salt || !tieneCarga) {
      return {
        ok: false,
        motivo: 'formato',
        detalle: `app=${String(envelope.app)} salt=${envelope.salt ? 'sí' : 'no'} combined=${
          envelope.combined ? 'sí' : 'no'
        } partes=${tienePartes ? 'sí' : 'no'} contenido=${envelope.contenido ? 'sí' : 'no'} len=${texto.length}`,
      };
    }
  } catch (e) {
    return { ok: false, motivo: 'formato', detalle: `JSON inválido (len=${texto.length}): ${mensajeError(e)}` };
  }

  let dump: Dump;
  try {
    dump = (await descifrarEnvelope(envelope, password)) as Dump;
  } catch (e) {
    // GCM tag mismatch → wrong password (or corrupted file).
    return { ok: false, motivo: 'password', detalle: `descifrado: ${mensajeError(e)}` };
  }

  try {
    reemplazarDatos(dump);
  } catch (e) {
    return { ok: false, motivo: 'error', detalle: `reemplazo datos: ${mensajeError(e)}` };
  }
  return { ok: true };
}

export interface ResultadoAutotest {
  ok: boolean;
  /** Etapa donde se detuvo si falló. */
  etapa?: 'cifrar' | 'serializar' | 'descifrar' | 'comparar';
  detalle: string;
}

/**
 * Diagnóstico en memoria (sin archivos): cifra un objeto conocido con caracteres
 * acentuados/ñ, lo serializa a JSON como el backup real, lo vuelve a parsear y
 * descifrar, y compara. Aísla si el problema es la criptografía/serialización o
 * la lectura del archivo en disco.
 */
export async function autotestBackup(): Promise<ResultadoAutotest> {
  const password = 'diagnostico-1234';
  const muestra = {
    texto: 'Ñoño acentúa: café, piña, ¿€ 1.234,50? — José',
    numero: 123456,
    decimal: 12.5,
    nulo: null,
    lista: [1, 'dos', { tres: '3' }],
  };

  let envelope: Envelope;
  try {
    envelope = await cifrarObjeto(muestra, password);
  } catch (e) {
    return { ok: false, etapa: 'cifrar', detalle: mensajeError(e) };
  }

  let texto: string;
  let reparsed: Envelope;
  try {
    // Igual que el backup real: serializar el envelope y volver a parsearlo.
    texto = JSON.stringify(envelope);
    reparsed = JSON.parse(texto);
  } catch (e) {
    return { ok: false, etapa: 'serializar', detalle: mensajeError(e) };
  }

  let salida: unknown;
  try {
    salida = await descifrarEnvelope(reparsed, password);
  } catch (e) {
    return {
      ok: false,
      etapa: 'descifrar',
      detalle: `${mensajeError(e)} · combined(${typeof reparsed.combined})=${
        typeof reparsed.combined === 'string' ? reparsed.combined.length : JSON.stringify(reparsed.combined)?.slice(0, 40)
      }`,
    };
  }

  const esperado = JSON.stringify(muestra);
  const obtenido = JSON.stringify(salida);
  if (esperado !== obtenido) {
    return { ok: false, etapa: 'comparar', detalle: `esperado≠obtenido\nesp=${esperado}\nobt=${obtenido}` };
  }

  return { ok: true, detalle: `Cifrado y descifrado correctos (formato ${envelope.formato}, ${envelope.iteraciones} iter).` };
}
