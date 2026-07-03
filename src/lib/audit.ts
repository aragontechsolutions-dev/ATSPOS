import { registrarAuditoria } from '@/db/repositories/auditoria';
import { useSessionStore } from '@/store/session';

/**
 * Records a sensitive action in the audit trail, attributing it to the
 * currently logged-in user. Reads the session outside React via the store's
 * getState so it can be called from anywhere. Failures are swallowed — auditing
 * must never block the underlying operation.
 */
export function auditar(accion: string, detalle?: string): void {
  const usuario = useSessionStore.getState().usuario;
  registrarAuditoria(usuario ? { id: usuario.id, nombre: usuario.nombre } : null, accion, detalle).catch(
    () => {},
  );
}
