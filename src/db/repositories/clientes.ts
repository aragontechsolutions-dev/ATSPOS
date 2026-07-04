import { and, eq, isNull, like, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { clientes, movimientosCaja, movimientosCliente } from '@/db/schema';
import { newId } from '@/lib/id';

export type Cliente = typeof clientes.$inferSelect;
export type MovimientoCliente = typeof movimientosCliente.$inferSelect;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function listarClientes(busqueda?: string): Promise<Cliente[]> {
  const activo = and(eq(clientes.activo, true), isNull(clientes.deletedAt));
  const filtro = busqueda?.trim() ? and(activo, like(clientes.nombre, `%${busqueda.trim()}%`)) : activo;
  return db.query.clientes.findMany({ where: filtro, orderBy: (c, { asc }) => [asc(c.nombre)] });
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  const cliente = await db.query.clientes.findFirst({ where: eq(clientes.id, id) });
  return cliente ?? null;
}

export async function crearCliente(input: {
  nombre: string;
  telefono?: string | null;
  limiteCredito?: number;
}): Promise<Cliente> {
  const id = newId();
  await db.insert(clientes).values({
    id,
    nombre: input.nombre.trim(),
    telefono: input.telefono ?? null,
    limiteCredito: input.limiteCredito ?? 0,
  });
  const creado = await db.query.clientes.findFirst({ where: eq(clientes.id, id) });
  if (!creado) throw new Error('No se pudo crear el cliente');
  return creado;
}

// `saldo` (deuda) = suma de cargos - suma de pagos. Recomputado desde el ledger.
export function recomputeSaldoSync(tx: Tx, clienteId: string): void {
  const row = tx
    .select({
      total: sql<number>`coalesce(sum(case when ${movimientosCliente.tipo} = 'cargo' then ${movimientosCliente.monto} else -${movimientosCliente.monto} end), 0)`,
    })
    .from(movimientosCliente)
    .where(eq(movimientosCliente.clienteId, clienteId))
    .get();
  tx.update(clientes)
    .set({ saldo: row?.total ?? 0, updatedAt: new Date() })
    .where(eq(clientes.id, clienteId))
    .run();
}

/** Adds a "fiado" charge to a customer's account (called inside a sale tx). */
export function cargarFiadoSync(
  tx: Tx,
  input: { clienteId: string; monto: number; ventaId: string; usuarioId: string },
): void {
  tx.insert(movimientosCliente)
    .values({
      id: newId(),
      clienteId: input.clienteId,
      tipo: 'cargo',
      monto: input.monto,
      referenciaId: input.ventaId,
      fecha: new Date(),
      usuarioId: input.usuarioId,
    })
    .run();
  recomputeSaldoSync(tx, input.clienteId);
}

/** Reverses the fiado charge of a voided sale (called inside the void tx). */
export function reversarFiadoSync(tx: Tx, input: { clienteId: string; monto: number; ventaId: string; usuarioId: string }): void {
  tx.insert(movimientosCliente)
    .values({
      id: newId(),
      clienteId: input.clienteId,
      tipo: 'pago',
      monto: input.monto,
      referenciaId: input.ventaId,
      fecha: new Date(),
      usuarioId: input.usuarioId,
    })
    .run();
  recomputeSaldoSync(tx, input.clienteId);
}

/**
 * Registers a payment against a customer's account. If a shift is open, the
 * cash also enters the drawer as an "ingreso" so expected cash stays correct.
 */
export async function registrarPago(input: {
  clienteId: string;
  monto: number;
  usuarioId: string;
  turnoId?: string | null;
  clienteNombre?: string;
}): Promise<void> {
  if (input.monto <= 0) throw new Error('El monto debe ser mayor a cero');
  db.transaction((tx) => {
    tx.insert(movimientosCliente)
      .values({
        id: newId(),
        clienteId: input.clienteId,
        tipo: 'pago',
        monto: input.monto,
        fecha: new Date(),
        usuarioId: input.usuarioId,
      })
      .run();
    recomputeSaldoSync(tx, input.clienteId);

    if (input.turnoId) {
      tx.insert(movimientosCaja)
        .values({
          id: newId(),
          turnoId: input.turnoId,
          tipo: 'ingreso',
          monto: input.monto,
          motivo: `Pago de fiado${input.clienteNombre ? ` · ${input.clienteNombre}` : ''}`,
          fecha: new Date(),
        })
        .run();
    }
  });
}

export async function movimientosDeCliente(clienteId: string): Promise<MovimientoCliente[]> {
  return db.query.movimientosCliente.findMany({
    where: eq(movimientosCliente.clienteId, clienteId),
    orderBy: (m, { desc }) => [desc(m.fecha)],
  });
}
