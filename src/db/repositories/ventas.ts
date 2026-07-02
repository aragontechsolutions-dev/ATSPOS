import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { detalleVenta, productos, ventas } from '@/db/schema';
import { newId } from '@/lib/id';

import { insertarMovimientoSync, recomputeStockActualSync } from './stock';

export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia';

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
  const vuelto = input.montoRecibido != null ? input.montoRecibido - total : null;

  const ventaId = newId();

  db.transaction((tx) => {
    tx.insert(ventas)
      .values({
        id: ventaId,
        fecha: new Date(),
        usuarioId: input.usuarioId,
        turnoId: input.turnoId,
        metodoPago: input.metodoPago,
        subtotal,
        descuento,
        total,
        montoRecibido: input.montoRecibido ?? null,
        vuelto,
      })
      .run();

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
    where: eq(ventas.turnoId, turnoId),
    orderBy: (v, { desc }) => [desc(v.fecha)],
  });
}
