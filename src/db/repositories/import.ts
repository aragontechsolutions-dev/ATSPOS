import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { categorias, productos } from '@/db/schema';
import { newId } from '@/lib/id';
import type { FilaImport } from '@/lib/import-productos';

import { insertarMovimientoSync, recomputeStockActualSync } from './stock';

export interface ResultadoImport {
  creados: number;
  actualizados: number;
}

/**
 * Bulk-imports products from a parsed spreadsheet. Matches by external code (if
 * present) then by name (case-insensitive); existing products are updated,
 * new ones are created with their initial stock as an "entrada" movement.
 * Categories are created on the fly. All-or-nothing (single transaction).
 */
export async function importarProductos(filas: FilaImport[], usuarioId: string): Promise<ResultadoImport> {
  let creados = 0;
  let actualizados = 0;
  const cacheCategorias = new Map<string, string>();

  db.transaction((tx) => {
    for (const fila of filas) {
      let categoriaId: string | null = null;
      if (fila.categoria) {
        const clave = fila.categoria.toLowerCase();
        const cacheada = cacheCategorias.get(clave);
        if (cacheada) {
          categoriaId = cacheada;
        } else {
          const existente = tx
            .select()
            .from(categorias)
            .where(and(sql`lower(${categorias.nombre}) = ${clave}`, isNull(categorias.deletedAt)))
            .get();
          if (existente) {
            categoriaId = existente.id;
          } else {
            categoriaId = newId();
            tx.insert(categorias).values({ id: categoriaId, nombre: fila.categoria }).run();
          }
          cacheCategorias.set(clave, categoriaId);
        }
      }

      let existente = fila.codigoExterno
        ? tx
            .select()
            .from(productos)
            .where(and(eq(productos.codigoBarras, fila.codigoExterno), isNull(productos.deletedAt)))
            .get()
        : undefined;
      if (!existente) {
        existente = tx
          .select()
          .from(productos)
          .where(and(sql`lower(${productos.nombre}) = ${fila.nombre.toLowerCase()}`, isNull(productos.deletedAt)))
          .get();
      }

      if (existente) {
        tx.update(productos)
          .set({
            precioVenta: fila.precioVenta,
            precioCosto: fila.precioCosto,
            stockMinimo: fila.stockMinimo,
            unidadMedida: fila.unidadMedida,
            categoriaId: categoriaId ?? existente.categoriaId,
            codigoBarras: fila.codigoExterno ?? existente.codigoBarras,
            updatedAt: new Date(),
          })
          .where(eq(productos.id, existente.id))
          .run();
        actualizados++;
      } else {
        const id = newId();
        tx.insert(productos)
          .values({
            id,
            nombre: fila.nombre,
            categoriaId,
            codigoBarras: fila.codigoExterno,
            precioCosto: fila.precioCosto,
            precioVenta: fila.precioVenta,
            stockMinimo: fila.stockMinimo,
            unidadMedida: fila.unidadMedida,
          })
          .run();
        if (fila.stockInicial > 0) {
          insertarMovimientoSync(tx, {
            productoId: id,
            tipo: 'entrada',
            cantidad: fila.stockInicial,
            motivo: 'carga inicial (importación)',
            usuarioId,
          });
          recomputeStockActualSync(tx, id);
        }
        creados++;
      }
    }
  });

  return { creados, actualizados };
}
