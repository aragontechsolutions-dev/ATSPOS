import { eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { movimientosStock, productos } from '@/db/schema';
import { newId } from '@/lib/id';

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste' | 'traspaso';

// `cantidad` is signed: positive adds to stock, negative removes from it.
// `stock_actual` is never written directly outside this module — it is
// always the recomputed sum of this ledger, so it stays correct even if
// movements come from multiple sources later (sales, purchases, sync).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface NuevoMovimiento {
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo?: string | null;
  referenciaId?: string | null;
  usuarioId: string;
}

export function insertarMovimientoSync(tx: Tx, input: NuevoMovimiento): void {
  tx.insert(movimientosStock)
    .values({
      id: newId(),
      productoId: input.productoId,
      tipo: input.tipo,
      cantidad: input.cantidad,
      motivo: input.motivo ?? null,
      referenciaId: input.referenciaId ?? null,
      fecha: new Date(),
      usuarioId: input.usuarioId,
    })
    .run();
}

export function recomputeStockActualSync(tx: Tx, productoId: string): void {
  const row = tx
    .select({ total: sql<number>`coalesce(sum(${movimientosStock.cantidad}), 0)` })
    .from(movimientosStock)
    .where(eq(movimientosStock.productoId, productoId))
    .get();
  tx.update(productos)
    .set({ stockActual: row?.total ?? 0, updatedAt: new Date() })
    .where(eq(productos.id, productoId))
    .run();
}

export async function ajustarStock(input: NuevoMovimiento): Promise<void> {
  db.transaction((tx) => {
    insertarMovimientoSync(tx, input);
    recomputeStockActualSync(tx, input.productoId);
  });
}

export async function historialMovimientos(productoId: string) {
  return db.query.movimientosStock.findMany({
    where: eq(movimientosStock.productoId, productoId),
    orderBy: (m, { desc }) => [desc(m.fecha)],
  });
}
