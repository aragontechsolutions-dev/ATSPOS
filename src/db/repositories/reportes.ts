import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { categorias, detalleVenta, productos, ventas } from '@/db/schema';
import type { RangoFechas } from '@/lib/periodo';

export interface ResumenVentas {
  totalVentas: number; // en centavos
  cantidadTickets: number;
  ticketPromedio: number; // en centavos
  costoMercaderia: number; // COGS del período, en centavos
  margenBruto: number; // ventas - COGS, en centavos
  margenPorcentaje: number; // 0..100
}

export interface TopProducto {
  productoId: string;
  nombre: string;
  cantidad: number;
  totalVendido: number; // en centavos
}

export interface VentasPorClave {
  clave: string;
  total: number; // en centavos
  cantidad: number;
}

export interface InventarioResumen {
  valorInventario: number; // SUM(stock_actual * precio_costo), en centavos
  productosActivos: number;
  productosBajoStock: number;
  rotacion: number | null; // COGS del período / valor de inventario
}

const rango = (r: RangoFechas) => and(gte(ventas.fecha, r.desde), lt(ventas.fecha, r.hasta));

export async function resumenVentas(r: RangoFechas): Promise<ResumenVentas> {
  const cab = db
    .select({
      total: sql<number>`coalesce(sum(${ventas.total}), 0)`,
      tickets: sql<number>`count(*)`,
    })
    .from(ventas)
    .where(rango(r))
    .get();

  // COGS: costo congelado por línea × cantidad, sobre las ventas del período.
  const costo = db
    .select({ cogs: sql<number>`coalesce(sum(${detalleVenta.costoUnitario} * ${detalleVenta.cantidad}), 0)` })
    .from(detalleVenta)
    .innerJoin(ventas, eq(detalleVenta.ventaId, ventas.id))
    .where(rango(r))
    .get();

  const totalVentas = cab?.total ?? 0;
  const cantidadTickets = cab?.tickets ?? 0;
  const costoMercaderia = costo?.cogs ?? 0;
  const margenBruto = totalVentas - costoMercaderia;

  return {
    totalVentas,
    cantidadTickets,
    ticketPromedio: cantidadTickets > 0 ? Math.round(totalVentas / cantidadTickets) : 0,
    costoMercaderia,
    margenBruto,
    margenPorcentaje: totalVentas > 0 ? (margenBruto / totalVentas) * 100 : 0,
  };
}

export async function topProductos(r: RangoFechas, limite = 10): Promise<TopProducto[]> {
  return db
    .select({
      productoId: detalleVenta.productoId,
      nombre: productos.nombre,
      cantidad: sql<number>`sum(${detalleVenta.cantidad})`,
      totalVendido: sql<number>`sum(${detalleVenta.precioUnitario} * ${detalleVenta.cantidad} - ${detalleVenta.descuentoLinea})`,
    })
    .from(detalleVenta)
    .innerJoin(ventas, eq(detalleVenta.ventaId, ventas.id))
    .innerJoin(productos, eq(detalleVenta.productoId, productos.id))
    .where(rango(r))
    .groupBy(detalleVenta.productoId)
    .orderBy(desc(sql`sum(${detalleVenta.cantidad})`))
    .limit(limite)
    .all();
}

export async function ventasPorMetodoPago(r: RangoFechas): Promise<VentasPorClave[]> {
  return db
    .select({
      clave: ventas.metodoPago,
      total: sql<number>`coalesce(sum(${ventas.total}), 0)`,
      cantidad: sql<number>`count(*)`,
    })
    .from(ventas)
    .where(rango(r))
    .groupBy(ventas.metodoPago)
    .orderBy(desc(sql`sum(${ventas.total})`))
    .all();
}

export async function ventasPorCategoria(r: RangoFechas): Promise<VentasPorClave[]> {
  return db
    .select({
      clave: sql<string>`coalesce(${categorias.nombre}, 'Sin categoría')`,
      total: sql<number>`coalesce(sum(${detalleVenta.precioUnitario} * ${detalleVenta.cantidad} - ${detalleVenta.descuentoLinea}), 0)`,
      cantidad: sql<number>`sum(${detalleVenta.cantidad})`,
    })
    .from(detalleVenta)
    .innerJoin(ventas, eq(detalleVenta.ventaId, ventas.id))
    .innerJoin(productos, eq(detalleVenta.productoId, productos.id))
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(rango(r))
    .groupBy(sql`coalesce(${categorias.nombre}, 'Sin categoría')`)
    .orderBy(desc(sql`sum(${detalleVenta.precioUnitario} * ${detalleVenta.cantidad} - ${detalleVenta.descuentoLinea})`))
    .all();
}

export interface FilaVentaExport {
  fecha: Date;
  metodoPago: string;
  subtotal: number;
  descuento: number;
  total: number;
}

export async function ventasParaExport(r: RangoFechas): Promise<FilaVentaExport[]> {
  return db
    .select({
      fecha: ventas.fecha,
      metodoPago: ventas.metodoPago,
      subtotal: ventas.subtotal,
      descuento: ventas.descuento,
      total: ventas.total,
    })
    .from(ventas)
    .where(rango(r))
    .orderBy(desc(ventas.fecha))
    .all();
}

export interface FilaInventarioExport {
  nombre: string;
  stockActual: number;
  stockDeposito: number;
  stockMinimo: number;
  precioCosto: number;
  precioVenta: number;
  valorInventario: number;
}

export async function inventarioParaExport(): Promise<FilaInventarioExport[]> {
  const filas = await db
    .select({
      nombre: productos.nombre,
      stockActual: productos.stockActual,
      stockDeposito: productos.stockDeposito,
      stockMinimo: productos.stockMinimo,
      precioCosto: productos.precioCosto,
      precioVenta: productos.precioVenta,
    })
    .from(productos)
    .where(isNull(productos.deletedAt))
    .orderBy(productos.nombre)
    .all();

  return filas.map((f) => ({ ...f, valorInventario: f.stockActual * f.precioCosto }));
}

export async function resumenInventario(cogsPeriodo: number): Promise<InventarioResumen> {
  const valor = db
    .select({
      valorInventario: sql<number>`coalesce(sum(${productos.stockActual} * ${productos.precioCosto}), 0)`,
      activos: sql<number>`count(*)`,
    })
    .from(productos)
    .where(isNull(productos.deletedAt))
    .get();

  const bajoStock = db
    .select({ n: sql<number>`count(*)` })
    .from(productos)
    .where(and(isNull(productos.deletedAt), sql`${productos.stockActual} <= ${productos.stockMinimo}`))
    .get();

  const valorInventario = valor?.valorInventario ?? 0;

  return {
    valorInventario,
    productosActivos: valor?.activos ?? 0,
    productosBajoStock: bajoStock?.n ?? 0,
    rotacion: valorInventario > 0 ? cogsPeriodo / valorInventario : null,
  };
}
