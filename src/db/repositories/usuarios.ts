import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { roles, usuarios } from '@/db/schema';
import { newId } from '@/lib/id';
import { hashPassword, verifyPassword } from '@/lib/password';
import type { RolNombre } from '@/lib/roles';

export interface UsuarioConRol {
  id: string;
  nombre: string;
  username: string;
  rol: RolNombre;
  debeCambiarPassword: boolean;
  activo: boolean;
}

async function toUsuarioConRol(usuario: typeof usuarios.$inferSelect): Promise<UsuarioConRol> {
  const rol = await db.query.roles.findFirst({ where: eq(roles.id, usuario.rolId) });
  if (!rol) throw new Error(`El usuario ${usuario.username} no tiene un rol válido`);
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    rol: rol.nombre as RolNombre,
    debeCambiarPassword: usuario.debeCambiarPassword,
    activo: usuario.activo,
  };
}

export async function login(username: string, password: string): Promise<UsuarioConRol | null> {
  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.username, username.trim().toLowerCase()),
  });
  if (!usuario || !usuario.activo) return null;

  const passwordOk = await verifyPassword(password, usuario.passwordHash);
  if (!passwordOk) return null;

  return toUsuarioConRol(usuario);
}

export async function getUsuarioById(id: string): Promise<UsuarioConRol | null> {
  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
  if (!usuario || !usuario.activo) return null;
  return toUsuarioConRol(usuario);
}

export async function cambiarPassword(usuarioId: string, nuevaPassword: string): Promise<void> {
  await db
    .update(usuarios)
    .set({
      passwordHash: await hashPassword(nuevaPassword),
      debeCambiarPassword: false,
      updatedAt: new Date(),
    })
    .where(eq(usuarios.id, usuarioId));
}

export async function crearUsuario(input: {
  nombre: string;
  username: string;
  password: string;
  rolNombre: RolNombre;
}): Promise<UsuarioConRol> {
  const rol = await db.query.roles.findFirst({ where: eq(roles.nombre, input.rolNombre) });
  if (!rol) throw new Error(`Rol desconocido: ${input.rolNombre}`);

  const id = newId();
  await db.insert(usuarios).values({
    id,
    nombre: input.nombre,
    username: input.username.trim().toLowerCase(),
    passwordHash: await hashPassword(input.password),
    rolId: rol.id,
    debeCambiarPassword: true,
  });

  return {
    id,
    nombre: input.nombre,
    username: input.username,
    rol: input.rolNombre,
    debeCambiarPassword: true,
    activo: true,
  };
}

export async function listarUsuarios(incluirInactivos = false): Promise<UsuarioConRol[]> {
  const filas = await db.query.usuarios.findMany({ orderBy: (u, { asc }) => [asc(u.nombre)] });
  return Promise.all(filas.filter((u) => incluirInactivos || u.activo).map(toUsuarioConRol));
}

export async function editarUsuario(id: string, cambios: { nombre?: string; rolNombre?: RolNombre }): Promise<void> {
  const set: Partial<typeof usuarios.$inferInsert> = { updatedAt: new Date() };
  if (cambios.nombre !== undefined) set.nombre = cambios.nombre.trim();
  if (cambios.rolNombre) {
    const rol = await db.query.roles.findFirst({ where: eq(roles.nombre, cambios.rolNombre) });
    if (!rol) throw new Error(`Rol desconocido: ${cambios.rolNombre}`);
    set.rolId = rol.id;
  }
  await db.update(usuarios).set(set).where(eq(usuarios.id, id));
}

export async function resetearPassword(id: string, nuevaPassword: string): Promise<void> {
  await db
    .update(usuarios)
    .set({ passwordHash: await hashPassword(nuevaPassword), debeCambiarPassword: true, updatedAt: new Date() })
    .where(eq(usuarios.id, id));
}

async function contarAdminsActivos(): Promise<number> {
  const rolAdmin = await db.query.roles.findFirst({ where: eq(roles.nombre, 'admin') });
  if (!rolAdmin) return 0;
  const filas = await db.query.usuarios.findMany({ where: eq(usuarios.rolId, rolAdmin.id) });
  return filas.filter((u) => u.activo).length;
}

export async function setUsuarioActivo(id: string, activo: boolean): Promise<void> {
  if (!activo) {
    const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
    if (usuario) {
      const rol = await db.query.roles.findFirst({ where: eq(roles.id, usuario.rolId) });
      if (rol?.nombre === 'admin' && (await contarAdminsActivos()) <= 1) {
        throw new Error('No podés desactivar al último administrador');
      }
    }
  }
  await db.update(usuarios).set({ activo, updatedAt: new Date() }).where(eq(usuarios.id, id));
}
