import { eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { categorias } from '@/db/schema';
import { newId } from '@/lib/id';

export type Categoria = typeof categorias.$inferSelect;

export async function listarCategorias(): Promise<Categoria[]> {
  return db.query.categorias.findMany({
    where: isNull(categorias.deletedAt),
    orderBy: (c, { asc }) => [asc(c.nombre)],
  });
}

export async function crearCategoria(nombre: string): Promise<Categoria> {
  const id = newId();
  await db.insert(categorias).values({ id, nombre });
  const creada = await db.query.categorias.findFirst({ where: eq(categorias.id, id) });
  if (!creada) throw new Error('No se pudo crear la categoría');
  return creada;
}
