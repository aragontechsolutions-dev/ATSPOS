import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { detalleVenta, productos, ventas } from '@/db/schema';
import { newId } from '@/lib/id';

import { cargarFiadoSync, reversarFiadoSync } from './clientes';
import { insertarMovimientoSync, recomputeStockActualSync } from './stock';

export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'fiado';

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  descuentoLinea?: number;
}

export interface NuevaVenta {
  turnoId: string;
  usuarioId: string;
  metodoPago: MetodoPago;
  items: ItemCarrito[];
  descuento?: number;
  montoRecibido?: number;
  clienteId?: string | null;
}

export interface VentaConfirmada {
  id: string;
  subtotal: number;
  descuento: number;
  total: number;
  vuelto: number | null;
}

export async function registrarVenta(input: NuevaVenta): Promise<VentaConfirmada> {
  if (input.items.length === 0) throw new Error('El carrito está vacío');

  for (const item of input.items) {
    const producto = await db.query.productos.findFirst({ where: eq(productos.id, item.productoId) });
    if (!producto) throw new Error(`Producto ${item.nombre} no existe`);
    if (producto.stockActual < item.cantidad) {
      throw new Error(`Stock insuficiente de "${item.nombre}" (disponible: ${producto.stockActual})`);
    }
  }

  const subtotal = input.items.reduce(
    (sum, item) => sum + item.precioUnitario * item.cantidad - (item.descuentoLinea ?? 0),
    0,
  );
  const descuento = input.descuento ?? 0;
  const total = subtotal - descuento;
  const esFiado = input.metodoPago === 'fiado';
  if (esFiado && !input.clienteId) throw new Error('Elegí un cliente para la venta fiada');
  const vuelto = input.montoRecibido != null ? input.montoRecibido - total : null;

  const ventaId = newId();

  db.transaction((tx) => {
    tx.insert(ventas)
      .values({
        id: ventaId,
        fecha: new Date(),
        usuarioId: input.usuarioId,
        turnoId: input.turnoId,
        clienteId: input.clienteId ?? null,
        metodoPago: input.metodoPago,
        subtotal,
        descuento,
        total,
        montoRecibido: input.montoRecibido ?? null,
        vuelto,
      })
      .run();

    if (esFiado && input.clienteId) {
      cargarFiadoSync(tx, { clienteId: input.clienteId, monto: total, ventaId, usuarioId: input.usuarioId });
    }

    for (const item of input.items) {
      tx.insert(detalleVenta)
        .values({
          id: newId(),
          ventaId,
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          costoUnitario: item.costoUnitario,
          descuentoLinea: item.descuentoLinea ?? 0,
        })
        .run();

      insertarMovimientoSync(tx, {
        productoId: item.productoId,
        tipo: 'salida',
        cantidad: -item.cantidad,
        motivo: 'venta',
        referenciaId: ventaId,
        usuarioId: input.usuarioId,
      });
      recomputeStockActualSync(tx, item.productoId);
    }
  });

  return { id: ventaId, subtotal, descuento, total, vuelto };
}

export async function ventasDelTurno(turnoId: string) {
  return db.query.ventas.findMany({
    where: and(eq(ventas.turnoId, turnoId), eq(ventas.anulada, false)),
    orderBy: (v, { desc }) => [desc(v.fecha)],
  });
}

export type Venta = typeof ventas.$inferSelect;

export async function listarVentas(limite = 100): Promise<Venta[]> {
  return db.query.ventas.findMany({
    orderBy: (v, { desc }) => [desc(v.fecha)],
    limit: limite,
  });
}

export interface VentaConDetalle {
  venta: Venta;
  lineas: {
    id: string;
    productoId: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    descuentoLinea: number;
  }[];
}

export async function getVentaConDetalle(ventaId: string): Promise<VentaConDetalle | null> {
  const venta = await db.query.ventas.findFirst({ where: eq(ventas.id, ventaId) });
  if (!venta) return null;

  const lineas = await db
    .select({
      id: detalleVenta.id,
      productoId: detalleVenta.productoId,
      nombre: productos.nombre,
      cantidad: detalleVenta.cantidad,
      precioUnitario: detalleVenta.precioUnitario,
      descuentoLinea: detalleVenta.descuentoLinea,
    })
    .from(detalleVenta)
    .innerJoin(productos, eq(detalleVenta.productoId, productos.id))
    .where(eq(detalleVenta.ventaId, ventaId))
    .all();

  return { venta, lineas };
}

/**
 * Voids a sale: restocks every line via `entrada` movements and flags the sale
 * as `anulada`. Voided sales are excluded from KPIs and expected cash. Idempotent
 * guard prevents double-voiding.
 */
export async function anularVenta(ventaId: string, usuarioId: string, motivo: string): Promise<void> {
  db.transaction((tx) => {
    const venta = tx.select().from(ventas).where(eq(ventas.id, ventaId)).get();
    if (!venta) throw new Error('Venta no encontrada');
    if (venta.anulada) throw new Error('La venta ya está anulada');

    const lineas = tx.select().from(detalleVenta).where(eq(detalleVenta.ventaId, ventaId)).all();
    for (const linea of lineas) {
      insertarMovimientoSync(tx, {
        productoId: linea.productoId,
        tipo: 'entrada',
        cantidad: linea.cantidad,
        motivo: 'anulación de venta',
        referenciaId: ventaId,
        usuarioId,
      });
      recomputeStockActualSync(tx, linea.productoId);
    }

    // Si fue fiado, revertir el cargo en la cuenta del cliente.
    if (venta.clienteId && venta.metodoPago === 'fiado') {
      reversarFiadoSync(tx, { clienteId: venta.clienteId, monto: venta.total, ventaId, usuarioId });
    }

    tx.update(ventas)
      .set({ anulada: true, anuladaFecha: new Date(), anuladaMotivo: motivo, updatedAt: new Date() })
      .where(eq(ventas.id, ventaId))
      .run();
  });
}
