import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import type { UnidadMedida } from '@/db/repositories/productos';
import { parseMoneyInput } from '@/lib/money';

export interface FilaImport {
  nombre: string;
  precioVenta: number; // centavos
  precioCosto: number;
  categoria: string | null;
  unidadMedida: UnidadMedida;
  stockInicial: number;
  stockMinimo: number;
  codigoExterno: string | null;
}

export interface ResultadoLectura {
  filas: FilaImport[];
  errores: string[];
  filasLeidas: number;
  columnas: string[];
}

const PLANTILLA_HEADERS = [
  'nombre',
  'precio_venta',
  'precio_costo',
  'categoria',
  'unidad',
  'stock_inicial',
  'stock_minimo',
  'codigo_externo',
];

const PLANTILLA_EJEMPLOS = [
  ['Coca Cola 500ml', 800, 500, 'Bebidas', 'unidad', 24, 6, '7790895000123'],
  ['Queso cremoso', 3500, 2500, 'Fiambres', 'kg', 5, 1, ''],
  ['Fideos 500g', 900, 650, 'Almacén', 'unidad', 30, 10, ''],
];

/**
 * Genera una plantilla Excel (.xlsx) de ejemplo y abre el menú para
 * guardarla/compartirla. Se usa .xlsx en vez de CSV porque Excel/Sheets lo
 * abren con columnas correctas sin importar la configuración regional
 * (evita el problema del separador coma/punto y coma).
 */
export async function descargarPlantilla(): Promise<boolean> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([PLANTILLA_HEADERS, ...PLANTILLA_EJEMPLOS]);
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  const file = new File(Paths.document, 'plantilla-productos-atspos.xlsx');
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Plantilla de productos',
  });
  return true;
}

function stripAccents(s: string): string {
  return s
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n');
}

const collapse = (s: string) => stripAccents(String(s).toLowerCase()).replace(/[^a-z0-9]/g, '');

const ALIAS: Record<keyof FilaImport, string[]> = {
  nombre: ['nombre', 'producto', 'descripcion', 'detalle'],
  precioVenta: ['precioventa', 'precio', 'preciodeventa', 'venta', 'pventa', 'preciounitario'],
  precioCosto: ['preciocosto', 'costo', 'preciodecosto', 'pcosto'],
  categoria: ['categoria', 'rubro'],
  unidadMedida: ['unidad', 'unidaddemedida', 'medida', 'um'],
  stockInicial: ['stockinicial', 'stock', 'cantidad', 'existencia', 'inicial'],
  stockMinimo: ['stockminimo', 'minimo', 'stockmin'],
  codigoExterno: ['codigoexterno', 'codigo', 'barcode', 'codigodebarras', 'ean', 'codigobarras'],
};

function buscarValor(fila: Record<string, unknown>, claves: string[]): string {
  for (const key of Object.keys(fila)) {
    if (claves.includes(collapse(key))) {
      const v = fila[key];
      return v == null ? '' : String(v).trim();
    }
  }
  return '';
}

function parseNumero(v: string): number {
  if (!v) return 0;
  const n = Number.parseFloat(v.replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

function parsePrecio(v: string): number {
  return v ? parseMoneyInput(v) : 0;
}

/** Lee un archivo .xlsx o .csv elegido por el usuario y lo convierte en filas validadas. */
export async function leerArchivoProductos(): Promise<ResultadoLectura | null> {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;
  const archivo = picked.result;

  // La lectura por base64 sirve para xlsx (binario) y csv (texto); SheetJS
  // detecta el formato y el separador. Si no da filas, probamos como texto.
  let rows: Record<string, unknown>[] = [];
  try {
    const base64 = await archivo.base64();
    if (base64) {
      const wb = XLSX.read(base64, { type: 'base64' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (sheet) rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    }
  } catch {
    // se intenta el fallback de texto abajo
  }

  if (rows.length === 0) {
    try {
      const texto = await archivo.text();
      if (texto) {
        const wb = XLSX.read(texto, { type: 'string' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (sheet) rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      }
    } catch {
      // queda rows vacío
    }
  }

  const columnas = rows.length > 0 ? Object.keys(rows[0]).map((k) => k.replace(/^﻿/, '')) : [];
  const filas: FilaImport[] = [];
  const errores: string[] = [];

  rows.forEach((row, i) => {
    const numeroFila = i + 2;
    const nombre = buscarValor(row, ALIAS.nombre);
    const precioVentaRaw = buscarValor(row, ALIAS.precioVenta);
    if (!nombre && !precioVentaRaw) return; // fila vacía

    if (!nombre) {
      errores.push(`Fila ${numeroFila}: falta el nombre.`);
      return;
    }
    const precioVenta = parsePrecio(precioVentaRaw);
    if (precioVenta <= 0) {
      errores.push(`Fila ${numeroFila} (${nombre}): precio de venta inválido.`);
      return;
    }

    const unidadRaw = collapse(buscarValor(row, ALIAS.unidadMedida));
    filas.push({
      nombre,
      precioVenta,
      precioCosto: parsePrecio(buscarValor(row, ALIAS.precioCosto)),
      categoria: buscarValor(row, ALIAS.categoria) || null,
      unidadMedida: unidadRaw.startsWith('k') ? 'kg' : 'unidad',
      stockInicial: parseNumero(buscarValor(row, ALIAS.stockInicial)),
      stockMinimo: Math.round(parseNumero(buscarValor(row, ALIAS.stockMinimo))),
      codigoExterno: buscarValor(row, ALIAS.codigoExterno) || null,
    });
  });

  return { filas, errores, filasLeidas: rows.length, columnas };
}
