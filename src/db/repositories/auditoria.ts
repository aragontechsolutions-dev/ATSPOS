import { db } from '@/db/client';
import { auditoria } from '@/db/schema';
import { newId } from '@/lib/id';

export type RegistroAuditoria = typeof auditoria.$inferSelect;

export interface ActorAuditoria {
  id: string;
  nombre: string;
}

export async function registrarAuditoria(
  actor: ActorAuditoria | null,
  accion: string,
  detalle?: string,
): Promise<void> {
  await db.insert(auditoria).values({
    id: newId(),
    fecha: new Date(),
    usuarioId: actor?.id ?? null,
    usuarioNombre: actor?.nombre ?? null,
    accion,
    detalle: detalle ?? null,
  });
}

export async function listarAuditoria(limite = 200): Promise<RegistroAuditoria[]> {
  return db.query.auditoria.findMany({
    orderBy: (a, { desc }) => [desc(a.fecha)],
    limit: limite,
  });
}
