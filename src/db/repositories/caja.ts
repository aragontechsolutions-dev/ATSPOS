import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { movimientosCaja, turnos, ventas } from '@/db/schema';
import { newId } from '@/lib/id';

export type Turno = typeof turnos.$inferSelect;
export type TipoMovimientoCaja = 'ingreso' | 'egreso';

export async function turnoAbiertoDe(usuarioId: string): Promise<Turno | null> {
  const turno = await db.query.turnos.findFirst({
    where: and(eq(turnos.usuarioId, usuarioId), eq(turnos.estado, 'abierto')),
  });
  return turno ?? null;
}

export async function abrirTurno(usuarioId: string, baseInicial: number): Promise<Turno> {
  const abierto = await turnoAbiertoDe(usuarioId);
  if (abierto) throw new Error('Ya tenés un turno abierto. Cerralo antes de abrir uno nuevo.');

  const id = newId();
  await db.insert(turnos).values({
    id,
    usuarioId,
    aperturaFecha: new Date(),
    baseInicial,
    estado: 'abierto',
  });
  const turno = await db.query.turnos.findFirst({ where: eq(turnos.id, id) });
  if (!turno) throw new Error('No se pudo abrir el turno');
  return turno;
}

export async function registrarMovimientoCaja(input: {
  turnoId: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  motivo?: string;
}): Promise<void> {
  await db.insert(movimientosCaja).values({
    id: newId(),
    turnoId: input.turnoId,
    tipo: input.tipo,
    monto: input.monto,
    motivo: input.motivo ?? null,
    fecha: new Date(),
  });
}

export async function movimientosDelTurno(turnoId: string) {
  return db.query.movimientosCaja.findMany({
    where: eq(movimientosCaja.turnoId, turnoId),
    orderBy: (m, { desc }) => [desc(m.fecha)],
  });
}

async function calcularEfectivoEsperado(turno: Turno): Promise<number> {
  const ventasEfectivo = await db
    .select({ total: sql<number>`coalesce(sum(${ventas.total}), 0)` })
    .from(ventas)
    .where(and(eq(ventas.turnoId, turno.id), eq(ventas.metodoPago, 'efectivo'), eq(ventas.anulada, false)))
    .get();

  const ingresos = await db
    .select({ total: sql<number>`coalesce(sum(${movimientosCaja.monto}), 0)` })
    .from(movimientosCaja)
    .where(and(eq(movimientosCaja.turnoId, turno.id), eq(movimientosCaja.tipo, 'ingreso')))
    .get();

  const egresos = await db
    .select({ total: sql<number>`coalesce(sum(${movimientosCaja.monto}), 0)` })
    .from(movimientosCaja)
    .where(and(eq(movimientosCaja.turnoId, turno.id), eq(movimientosCaja.tipo, 'egreso')))
    .get();

  return turno.baseInicial + (ventasEfectivo?.total ?? 0) + (ingresos?.total ?? 0) - (egresos?.total ?? 0);
}

export async function previsualizarCierre(turnoId: string): Promise<number> {
  const turno = await db.query.turnos.findFirst({ where: eq(turnos.id, turnoId) });
  if (!turno) throw new Error('Turno no encontrado');
  return calcularEfectivoEsperado(turno);
}

export async function cerrarTurno(turnoId: string, efectivoContado: number): Promise<Turno> {
  const turno = await db.query.turnos.findFirst({ where: eq(turnos.id, turnoId) });
  if (!turno) throw new Error('Turno no encontrado');
  if (turno.estado === 'cerrado') throw new Error('El turno ya está cerrado');

  const efectivoEsperado = await calcularEfectivoEsperado(turno);
  const diferencia = efectivoContado - efectivoEsperado;

  await db
    .update(turnos)
    .set({
      cierreFecha: new Date(),
      efectivoEsperado,
      efectivoContado,
      diferencia,
      estado: 'cerrado',
      updatedAt: new Date(),
    })
    .where(eq(turnos.id, turnoId));

  const actualizado = await db.query.turnos.findFirst({ where: eq(turnos.id, turnoId) });
  if (!actualizado) throw new Error('No se pudo cerrar el turno');
  return actualizado;
}
