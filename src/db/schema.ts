import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Shared columns present on every syncable table. `updatedAt`/`deletedAt`
// (soft delete) exist from day one even though multi-device sync is a later
// phase — retrofitting them onto an already-populated store is painful.
const syncColumns = {
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull().unique(), // admin | cajero | supervisor
  ...syncColumns,
});

export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  rolId: text('rol_id')
    .notNull()
    .references(() => roles.id),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  debeCambiarPassword: integer('debe_cambiar_password', { mode: 'boolean' })
    .notNull()
    .default(false),
  ...syncColumns,
});

export const categorias = sqliteTable('categorias', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  ...syncColumns,
});

export const productos = sqliteTable('productos', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  categoriaId: text('categoria_id').references(() => categorias.id),
  codigoBarras: text('codigo_barras'),
  // Money is stored in cents (integer) to avoid floating point rounding errors.
  precioCosto: integer('precio_costo').notNull().default(0),
  precioVenta: integer('precio_venta').notNull().default(0),
  stockActual: integer('stock_actual').notNull().default(0),
  stockDeposito: integer('stock_deposito').notNull().default(0),
  stockMinimo: integer('stock_minimo').notNull().default(0),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  ...syncColumns,
});

export const proveedores = sqliteTable('proveedores', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  contacto: text('contacto'),
  ...syncColumns,
});

export const compras = sqliteTable('compras', {
  id: text('id').primaryKey(),
  proveedorId: text('proveedor_id').references(() => proveedores.id),
  fecha: integer('fecha', { mode: 'timestamp_ms' }).notNull(),
  total: integer('total').notNull().default(0),
  usuarioId: text('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  ...syncColumns,
});

export const detalleCompra = sqliteTable('detalle_compra', {
  id: text('id').primaryKey(),
  compraId: text('compra_id')
    .notNull()
    .references(() => compras.id),
  productoId: text('producto_id')
    .notNull()
    .references(() => productos.id),
  cantidad: integer('cantidad').notNull(),
  costoUnitario: integer('costo_unitario').notNull(),
  ...syncColumns,
});

export const turnos = sqliteTable('turnos', {
  id: text('id').primaryKey(),
  usuarioId: text('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  aperturaFecha: integer('apertura_fecha', { mode: 'timestamp_ms' }).notNull(),
  baseInicial: integer('base_inicial').notNull().default(0),
  cierreFecha: integer('cierre_fecha', { mode: 'timestamp_ms' }),
  efectivoEsperado: integer('efectivo_esperado'),
  efectivoContado: integer('efectivo_contado'),
  diferencia: integer('diferencia'),
  estado: text('estado').notNull().default('abierto'), // abierto | cerrado
  ...syncColumns,
});

export const ventas = sqliteTable('ventas', {
  id: text('id').primaryKey(),
  fecha: integer('fecha', { mode: 'timestamp_ms' }).notNull(),
  usuarioId: text('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  turnoId: text('turno_id')
    .notNull()
    .references(() => turnos.id),
  metodoPago: text('metodo_pago').notNull(), // efectivo | debito | credito | transferencia
  subtotal: integer('subtotal').notNull(),
  descuento: integer('descuento').notNull().default(0),
  total: integer('total').notNull(),
  montoRecibido: integer('monto_recibido'),
  vuelto: integer('vuelto'),
  ...syncColumns,
});

export const detalleVenta = sqliteTable('detalle_venta', {
  id: text('id').primaryKey(),
  ventaId: text('venta_id')
    .notNull()
    .references(() => ventas.id),
  productoId: text('producto_id')
    .notNull()
    .references(() => productos.id),
  cantidad: integer('cantidad').notNull(),
  precioUnitario: integer('precio_unitario').notNull(),
  costoUnitario: integer('costo_unitario').notNull(),
  descuentoLinea: integer('descuento_linea').notNull().default(0),
  ...syncColumns,
});

// The source of truth for stock is this ledger, not `productos.stock_actual`
// directly — `stock_actual` is a cached rollup recomputed from movements, so
// concurrent sales across future multi-device sync never overwrite each other.
export const movimientosStock = sqliteTable('movimientos_stock', {
  id: text('id').primaryKey(),
  productoId: text('producto_id')
    .notNull()
    .references(() => productos.id),
  tipo: text('tipo').notNull(), // entrada | salida | ajuste | traspaso
  cantidad: integer('cantidad').notNull(),
  motivo: text('motivo'),
  referenciaId: text('referencia_id'),
  fecha: integer('fecha', { mode: 'timestamp_ms' }).notNull(),
  usuarioId: text('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  ...syncColumns,
});

export const movimientosCaja = sqliteTable('movimientos_caja', {
  id: text('id').primaryKey(),
  turnoId: text('turno_id')
    .notNull()
    .references(() => turnos.id),
  tipo: text('tipo').notNull(), // ingreso | egreso
  monto: integer('monto').notNull(),
  motivo: text('motivo'),
  fecha: integer('fecha', { mode: 'timestamp_ms' }).notNull(),
  ...syncColumns,
});
