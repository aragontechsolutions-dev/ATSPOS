import { and, eq, isNull, like, or } from 'drizzle-orm';

import { db } from '@/db/client';
import { productos } from '@/db/schema';
import { newId } from '@/lib/id';

export type Producto = typeof productos.$inferSelect;

export interface NuevoProducto {
  nombre: string;
  categoriaId?: string | null;
  codigoBarras?: string | null;
  precioCosto: number;
  precioVenta: number;
  stockMinimo?: number;
}

export async function listarProductos(busqueda?: string): Promise<Producto[]> {
  const activo = isNull(productos.deletedAt);
  const filtro = busqueda?.trim()
    ? and(
        activo,
        or(like(productos.nombre, `%${busqueda.trim()}%`), like(productos.codigoBarras, `%${busqueda.trim()}%`)),
      )
    : activo;
  return db.query.productos.findMany({ where: filtro, orderBy: (p, { asc }) => [asc(p.nombre)] });
}

export async function buscarPorCodigoBarras(codigo: string): Promise<Producto | null> {
  const producto = await db.query.productos.findFirst({
    where: and(eq(productos.codigoBarras, codigo), isNull(productos.deletedAt)),
  });
  return producto ?? null;
}

export async function listarBajoStock(): Promise<Producto[]> {
  const todos = await db.query.productos.findMany({ where: isNull(productos.deletedAt) });
  return todos.filter((p) => p.stockActual <= p.stockMinimo);
}

export async function crearProducto(input: NuevoProducto): Promise<Producto> {
  const id = newId();
  db.insert(productos)
    .values({
      id,
      nombre: input.nombre,
      categoriaId: input.categoriaId ?? null,
      codigoBarras: input.codigoBarras ?? null,
      precioCosto: input.precioCosto,
      precioVenta: input.precioVenta,
      stockMinimo: input.stockMinimo ?? 0,
    })
    .run();
  const creado = await db.query.productos.findFirst({ where: eq(productos.id, id) });
  if (!creado) throw new Error('No se pudo crear el producto');
  return creado;
}

export async function actualizarProducto(
  id: string,
  cambios: Partial<NuevoProducto> & { activo?: boolean },
): Promise<void> {
  await db
    .update(productos)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(productos.id, id));
}

export async function eliminarProducto(id: string): Promise<void> {
  await db.update(productos).set({ deletedAt: new Date() }).where(eq(productos.id, id));
}
