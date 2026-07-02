import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { compras, detalleCompra, productos } from '@/db/schema';
import { newId } from '@/lib/id';

import { insertarMovimientoSync, recomputeStockActualSync } from './stock';

export interface LineaCompra {
  productoId: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
}

export interface NuevaCompra {
  proveedorId: string | null;
  usuarioId: string;
  lineas: LineaCompra[];
}

/**
 * Registers a supplier purchase: writes the compra + detalle rows, adds one
 * stock-in movement per line (so stock is recomputed from the ledger), and
 * updates each product's cost using a weighted moving average
 * (`(stockPrevio*costoViejo + cantidad*costoCompra) / (stockPrevio+cantidad)`).
 */
export async function registrarCompra(input: NuevaCompra): Promise<{ id: string; total: number }> {
  if (input.lineas.length === 0) throw new Error('La compra no tiene productos');

  const total = input.lineas.reduce((sum, l) => sum + l.costoUnitario * l.cantidad, 0);
  const compraId = newId();

  db.transaction((tx) => {
    tx.insert(compras)
      .values({
        id: compraId,
        proveedorId: input.proveedorId,
        fecha: new Date(),
        total,
        usuarioId: input.usuarioId,
      })
      .run();

    for (const linea of input.lineas) {
      tx.insert(detalleCompra)
        .values({
          id: newId(),
          compraId,
          productoId: linea.productoId,
          cantidad: linea.cantidad,
          costoUnitario: linea.costoUnitario,
        })
        .run();

      // Weighted average cost, computed from the stock BEFORE this entry.
      const producto = tx.select().from(productos).where(eq(productos.id, linea.productoId)).get();
      if (producto) {
        const stockPrevio = producto.stockActual;
        const nuevoCosto =
          stockPrevio + linea.cantidad > 0
            ? Math.round(
                (stockPrevio * producto.precioCosto + linea.cantidad * linea.costoUnitario) /
                  (stockPrevio + linea.cantidad),
              )
            : linea.costoUnitario;
        tx.update(productos)
          .set({ precioCosto: nuevoCosto, updatedAt: new Date() })
          .where(eq(productos.id, linea.productoId))
          .run();
      }

      insertarMovimientoSync(tx, {
        productoId: linea.productoId,
        tipo: 'entrada',
        cantidad: linea.cantidad,
        motivo: 'compra',
        referenciaId: compraId,
        usuarioId: input.usuarioId,
      });
      recomputeStockActualSync(tx, linea.productoId);
    }
  });

  return { id: compraId, total };
}

export async function historialCompras() {
  return db.query.compras.findMany({ orderBy: (c, { desc }) => [desc(c.fecha)] });
}
