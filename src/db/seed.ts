import { eq } from 'drizzle-orm';

import { newId } from '@/lib/id';
import { hashPassword } from '@/lib/password';
import { ROLES } from '@/lib/roles';

import type { Database } from './client';
import { roles, usuarios } from './schema';

export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Creates the fixed role rows and a default admin account on first launch.
 * The admin is forced to change the seeded password on first login
 * (`debeCambiarPassword`).
 */
export async function seedDatabase(db: Database): Promise<void> {
  const existingAdmin = await db.query.usuarios.findFirst({
    where: eq(usuarios.username, DEFAULT_ADMIN_USERNAME),
  });
  if (existingAdmin) return;

  const roleIds: Record<string, string> = {};
  for (const nombre of Object.values(ROLES)) {
    const existente = await db.query.roles.findFirst({ where: eq(roles.nombre, nombre) });
    if (existente) {
      roleIds[nombre] = existente.id;
      continue;
    }
    const id = newId();
    await db.insert(roles).values({ id, nombre });
    roleIds[nombre] = id;
  }

  await db.insert(usuarios).values({
    id: newId(),
    nombre: 'Administrador',
    username: DEFAULT_ADMIN_USERNAME,
    passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD),
    rolId: roleIds[ROLES.ADMIN],
    activo: true,
    debeCambiarPassword: true,
  });
}
