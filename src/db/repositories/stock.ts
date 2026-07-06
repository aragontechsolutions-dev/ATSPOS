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

/**
 * Sets the physical count of a product: inserts an `ajuste` movement for the
 * delta between the counted amount and the current stock, keeping the ledger
 * as the single source of truth.
 */
export async function corregirStockPorConteo(input: {
  productoId: string;
  cantidadContada: number;
  motivo?: string;
  usuarioId: string;
}): Promise<void> {
  db.transaction((tx) => {
    const producto = tx.select().from(productos).where(eq(productos.id, input.productoId)).get();
    if (!producto) throw new Error('Producto no encontrado');
    const delta = input.cantidadContada - producto.stockActual;
    if (delta === 0) return;
    insertarMovimientoSync(tx, {
      productoId: input.productoId,
      tipo: 'ajuste',
      cantidad: delta,
      motivo: input.motivo ?? 'corrección de conteo',
      usuarioId: input.usuarioId,
    });
    recomputeStockActualSync(tx, input.productoId);
  });
}

export interface ConteoItem {
  productoId: string;
  cantidadContada: number;
}

export interface ResultadoConteoLinea {
  productoId: string;
  nombre: string;
  unidadMedida: string;
  stockSistema: number;
  cantidadContada: number;
  delta: number; // contado - sistema (positivo = sobrante, negativo = faltante)
  valorDelta: number; // delta * precioCosto, en centavos
}

/**
 * Applies a whole physical inventory count (recuento de cierre) in one
 * transaction. For each counted product it records an `ajuste` movement with
 * the delta against the system stock, tagged with a shared `referenciaId` so
 * the whole count session can be traced. Products with no difference are
 * skipped. Returns one line per counted product (with its delta) for the report.
 */
export async function aplicarConteoInventario(input: {
  items: ConteoItem[];
  usuarioId: string;
}): Promise<{ referenciaId: string; lineas: ResultadoConteoLinea[] }> {
  const referenciaId = newId();
  const lineas: ResultadoConteoLinea[] = [];

  db.transaction((tx) => {
    for (const item of input.items) {
      const producto = tx.select().from(productos).where(eq(productos.id, item.productoId)).get();
      if (!producto) continue;
      const delta = item.cantidadContada - producto.stockActual;
      lineas.push({
        productoId: producto.id,
        nombre: producto.nombre,
        unidadMedida: producto.unidadMedida,
        stockSistema: producto.stockActual,
        cantidadContada: item.cantidadContada,
        delta,
        valorDelta: Math.round(delta * producto.precioCosto),
      });
      if (delta === 0) continue;
      insertarMovimientoSync(tx, {
        productoId: producto.id,
        tipo: 'ajuste',
        cantidad: delta,
        motivo: 'conteo de inventario',
        referenciaId,
        usuarioId: input.usuarioId,
      });
      recomputeStockActualSync(tx, producto.id);
    }
  });

  return { referenciaId, lineas };
}

/**
 * Moves units between the back-room (`stock_deposito`) and the sales floor
 * (`stock_actual`). Floor stock stays ledger-backed via a `traspaso` movement;
 * `stock_deposito` is adjusted directly.
 */
export async function traspasarDepositoATienda(input: {
  productoId: string;
  cantidad: number;
  hacia: 'tienda' | 'deposito';
  usuarioId: string;
}): Promise<void> {
  if (input.cantidad <= 0) throw new Error('La cantidad debe ser mayor a cero');
  db.transaction((tx) => {
    const producto = tx.select().from(productos).where(eq(productos.id, input.productoId)).get();
    if (!producto) throw new Error('Producto no encontrado');

    if (input.hacia === 'tienda') {
      if (producto.stockDeposito < input.cantidad) throw new Error('Stock de depósito insuficiente');
      tx.update(productos)
        .set({ stockDeposito: producto.stockDeposito - input.cantidad, updatedAt: new Date() })
        .where(eq(productos.id, input.productoId))
        .run();
      insertarMovimientoSync(tx, {
        productoId: input.productoId,
        tipo: 'traspaso',
        cantidad: input.cantidad,
        motivo: 'traspaso depósito → tienda',
        usuarioId: input.usuarioId,
      });
    } else {
      if (producto.stockActual < input.cantidad) throw new Error('Stock de tienda insuficiente');
      tx.update(productos)
        .set({ stockDeposito: producto.stockDeposito + input.cantidad, updatedAt: new Date() })
        .where(eq(productos.id, input.productoId))
        .run();
      insertarMovimientoSync(tx, {
        productoId: input.productoId,
        tipo: 'traspaso',
        cantidad: -input.cantidad,
        motivo: 'traspaso tienda → depósito',
        usuarioId: input.usuarioId,
      });
    }
    recomputeStockActualSync(tx, input.productoId);
  });
}

export async function historialMovimientos(productoId: string) {
  return db.query.movimientosStock.findMany({
    where: eq(movimientosStock.productoId, productoId),
    orderBy: (m, { desc }) => [desc(m.fecha)],
  });
}
