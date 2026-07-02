CREATE TABLE `categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `compras` (
	`id` text PRIMARY KEY NOT NULL,
	`proveedor_id` text,
	`fecha` integer NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`usuario_id` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `detalle_compra` (
	`id` text PRIMARY KEY NOT NULL,
	`compra_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`cantidad` integer NOT NULL,
	`costo_unitario` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`compra_id`) REFERENCES `compras`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `detalle_venta` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`cantidad` integer NOT NULL,
	`precio_unitario` integer NOT NULL,
	`costo_unitario` integer NOT NULL,
	`descuento_linea` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `movimientos_caja` (
	`id` text PRIMARY KEY NOT NULL,
	`turno_id` text NOT NULL,
	`tipo` text NOT NULL,
	`monto` integer NOT NULL,
	`motivo` text,
	`fecha` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `movimientos_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`producto_id` text NOT NULL,
	`tipo` text NOT NULL,
	`cantidad` integer NOT NULL,
	`motivo` text,
	`referencia_id` text,
	`fecha` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `productos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`categoria_id` text,
	`codigo_barras` text,
	`precio_costo` integer DEFAULT 0 NOT NULL,
	`precio_venta` integer DEFAULT 0 NOT NULL,
	`stock_actual` integer DEFAULT 0 NOT NULL,
	`stock_deposito` integer DEFAULT 0 NOT NULL,
	`stock_minimo` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proveedores` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`contacto` text,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_nombre_unique` ON `roles` (`nombre`);--> statement-breakpoint
CREATE TABLE `turnos` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`apertura_fecha` integer NOT NULL,
	`base_inicial` integer DEFAULT 0 NOT NULL,
	`cierre_fecha` integer,
	`efectivo_esperado` integer,
	`efectivo_contado` integer,
	`diferencia` integer,
	`estado` text DEFAULT 'abierto' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`rol_id` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_username_unique` ON `usuarios` (`username`);--> statement-breakpoint
CREATE TABLE `ventas` (
	`id` text PRIMARY KEY NOT NULL,
	`fecha` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`turno_id` text NOT NULL,
	`metodo_pago` text NOT NULL,
	`subtotal` integer NOT NULL,
	`descuento` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`monto_recibido` integer,
	`vuelto` integer,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON UPDATE no action ON DELETE no action
);
