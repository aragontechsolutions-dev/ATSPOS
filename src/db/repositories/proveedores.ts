import { eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { proveedores } from '@/db/schema';
import { newId } from '@/lib/id';

export type Proveedor = typeof proveedores.$inferSelect;

export async function listarProveedores(): Promise<Proveedor[]> {
  return db.query.proveedores.findMany({
    where: isNull(proveedores.deletedAt),
    orderBy: (p, { asc }) => [asc(p.nombre)],
  });
}

export async function crearProveedor(input: { nombre: string; contacto?: string | null }): Promise<Proveedor> {
  const id = newId();
  await db.insert(proveedores).values({ id, nombre: input.nombre.trim(), contacto: input.contacto ?? null });
  const creado = await db.query.proveedores.findFirst({ where: eq(proveedores.id, id) });
  if (!creado) throw new Error('No se pudo crear el proveedor');
  return creado;
}

export async function actualizarProveedor(
  id: string,
  cambios: { nombre?: string; contacto?: string | null },
): Promise<void> {
  await db
    .update(proveedores)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(proveedores.id, id));
}

export async function eliminarProveedor(id: string): Promise<void> {
  await db.update(proveedores).set({ deletedAt: new Date() }).where(eq(proveedores.id, id));
}
