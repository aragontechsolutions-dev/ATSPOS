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

  return { id, nombre: input.nombre, username: input.username, rol: input.rolNombre, debeCambiarPassword: true };
}

export async function listarUsuarios(): Promise<UsuarioConRol[]> {
  const filas = await db.query.usuarios.findMany();
  return Promise.all(filas.filter((u) => u.activo).map(toUsuarioConRol));
}
