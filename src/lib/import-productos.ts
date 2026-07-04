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
  totalFilas: number;
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
  ['Coca Cola 500ml', '800', '500', 'Bebidas', 'unidad', '24', '6', '7790895000123'],
  ['Queso cremoso', '3500', '2500', 'Fiambres', 'kg', '5', '1', ''],
  ['Fideos 500g', '900', '650', 'Almacén', 'unidad', '30', '10', ''],
];

/** Genera una plantilla CSV de ejemplo y abre el menú para guardarla/compartirla. */
export async function descargarPlantilla(): Promise<boolean> {
  const csv = [PLANTILLA_HEADERS.join(','), ...PLANTILLA_EJEMPLOS.map((f) => f.join(','))].join('\n');
  const file = new File(Paths.cache, 'plantilla-productos-atspos.csv');
  if (file.exists) file.delete();
  file.create();
  file.write(`﻿${csv}`); // BOM para que Excel abra los acentos bien

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Plantilla de productos' });
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

const ALIAS: Record<keyof Omit<FilaImport, never>, string[]> = {
  nombre: ['nombre', 'producto', 'descripcion', 'detalle'],
  precioVenta: ['precioventa', 'precio', 'preciodeventa', 'venta', 'pventa'],
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

/** Lee un archivo .csv o .xlsx elegido por el usuario y lo convierte en filas validadas. */
export async function leerArchivoProductos(): Promise<ResultadoLectura | null> {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;
  const archivo = picked.result;

  const esCsv = (archivo.name ?? '').toLowerCase().endsWith('.csv');
  const wb = esCsv
    ? XLSX.read(await archivo.text(), { type: 'string' })
    : XLSX.read(await archivo.base64(), { type: 'base64' });

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const filas: FilaImport[] = [];
  const errores: string[] = [];

  rows.forEach((row, i) => {
    const numeroFila = i + 2; // +1 header, +1 base-1
    const nombre = buscarValor(row, ALIAS.nombre);
    const precioVentaRaw = buscarValor(row, ALIAS.precioVenta);

    if (!nombre && !precioVentaRaw) return; // fila vacía, se ignora

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

  return { filas, errores, totalFilas: rows.length };
}
