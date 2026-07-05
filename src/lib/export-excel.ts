import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Money is stored in integer cents; export as a plain decimal number. */
const toDecimal = (cents: number) => Math.round(cents) / 100;

function fechaLegible(d: Date): string {
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Writes a SheetJS workbook to the cache dir and opens the OS share sheet so
 * the user can send it via WhatsApp/email/Drive. Returns false if sharing is
 * not available on the device.
 */
export async function compartirWorkbook(wb: XLSX.WorkBook, filename: string): Promise<boolean> {
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  // documentDirectory se comparte de forma más confiable con algunas apps
  // (WhatsApp) que la cache.
  const file = new File(Paths.document, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  if (file.size <= 0) {
    throw new Error('El archivo quedó vacío al generarse');
  }

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    dialogTitle: 'Compartir reporte',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return true;
}

export interface DatosReporteVentas {
  periodoLabel: string;
  resumen: {
    totalVentas: number;
    cantidadTickets: number;
    ticketPromedio: number;
    costoMercaderia: number;
    margenBruto: number;
    margenPorcentaje: number;
  };
  ventas: { fecha: Date; metodoPago: string; subtotal: number; descuento: number; total: number }[];
  topProductos: { nombre: string; cantidad: number; totalVendido: number }[];
  porMetodo: { clave: string; total: number; cantidad: number }[];
  porCategoria: { clave: string; total: number; cantidad: number }[];
}

export async function exportarReporteVentas(datos: DatosReporteVentas): Promise<boolean> {
  const wb = XLSX.utils.book_new();

  const resumenRows = [
    ['Reporte de ventas', datos.periodoLabel],
    [],
    ['Ventas totales', toDecimal(datos.resumen.totalVentas)],
    ['Cantidad de tickets', datos.resumen.cantidadTickets],
    ['Ticket promedio', toDecimal(datos.resumen.ticketPromedio)],
    ['Costo de mercadería vendida', toDecimal(datos.resumen.costoMercaderia)],
    ['Margen bruto', toDecimal(datos.resumen.margenBruto)],
    ['Margen %', Number(datos.resumen.margenPorcentaje.toFixed(1))],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), 'Resumen');

  const ventasSheet = XLSX.utils.json_to_sheet(
    datos.ventas.map((v) => ({
      Fecha: fechaLegible(v.fecha),
      'Método de pago': v.metodoPago,
      Subtotal: toDecimal(v.subtotal),
      Descuento: toDecimal(v.descuento),
      Total: toDecimal(v.total),
    })),
  );
  XLSX.utils.book_append_sheet(wb, ventasSheet, 'Ventas');

  const topSheet = XLSX.utils.json_to_sheet(
    datos.topProductos.map((p) => ({
      Producto: p.nombre,
      'Unidades vendidas': p.cantidad,
      'Total vendido': toDecimal(p.totalVendido),
    })),
  );
  XLSX.utils.book_append_sheet(wb, topSheet, 'Más vendidos');

  const metodoSheet = XLSX.utils.json_to_sheet(
    datos.porMetodo.map((m) => ({
      'Método de pago': m.clave,
      Tickets: m.cantidad,
      Total: toDecimal(m.total),
    })),
  );
  XLSX.utils.book_append_sheet(wb, metodoSheet, 'Por método');

  const categoriaSheet = XLSX.utils.json_to_sheet(
    datos.porCategoria.map((c) => ({
      Categoría: c.clave,
      Unidades: c.cantidad,
      Total: toDecimal(c.total),
    })),
  );
  XLSX.utils.book_append_sheet(wb, categoriaSheet, 'Por categoría');

  const fecha = new Date().toISOString().slice(0, 10);
  return compartirWorkbook(wb, `ventas-${fecha}.xlsx`);
}

export interface FilaInventario {
  nombre: string;
  stockActual: number;
  stockDeposito: number;
  stockMinimo: number;
  precioCosto: number;
  precioVenta: number;
  valorInventario: number;
}

export async function exportarInventario(filas: FilaInventario[]): Promise<boolean> {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(
    filas.map((f) => ({
      Producto: f.nombre,
      'Stock tienda': f.stockActual,
      'Stock depósito': f.stockDeposito,
      'Stock mínimo': f.stockMinimo,
      'Precio costo': toDecimal(f.precioCosto),
      'Precio venta': toDecimal(f.precioVenta),
      'Valor inventario': toDecimal(f.valorInventario),
      'Bajo stock': f.stockActual <= f.stockMinimo ? 'SÍ' : '',
    })),
  );
  XLSX.utils.book_append_sheet(wb, sheet, 'Inventario');

  const fecha = new Date().toISOString().slice(0, 10);
  return compartirWorkbook(wb, `inventario-${fecha}.xlsx`);
}
