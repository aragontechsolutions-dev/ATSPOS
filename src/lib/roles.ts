export const ROLES = {
  ADMIN: 'admin',
  CAJERO: 'cajero',
  SUPERVISOR: 'supervisor',
} as const;

export type RolNombre = (typeof ROLES)[keyof typeof ROLES];

// Coarse-grained permission matrix. Roles are fixed (admin/cajero/supervisor)
// rather than a dynamic roles/permisos table — the store doesn't need
// custom roles, so a fixed matrix avoids building admin UI nobody asked for.
export const PERMISOS = {
  vender: [ROLES.ADMIN, ROLES.CAJERO, ROLES.SUPERVISOR],
  gestionarProductos: [ROLES.ADMIN, ROLES.SUPERVISOR],
  ajustarStock: [ROLES.ADMIN, ROLES.SUPERVISOR],
  abrirCerrarCaja: [ROLES.ADMIN, ROLES.CAJERO, ROLES.SUPERVISOR],
  arquearCajaAjena: [ROLES.ADMIN, ROLES.SUPERVISOR],
  gestionarUsuarios: [ROLES.ADMIN],
  verReportes: [ROLES.ADMIN, ROLES.SUPERVISOR],
} as const;

export type Permiso = keyof typeof PERMISOS;

export function tienePermiso(rol: RolNombre, permiso: Permiso): boolean {
  return (PERMISOS[permiso] as readonly RolNombre[]).includes(rol);
}
