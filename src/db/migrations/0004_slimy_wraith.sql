CREATE TABLE `clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`telefono` text,
	`limite_credito` integer DEFAULT 0 NOT NULL,
	`saldo` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `movimientos_cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`tipo` text NOT NULL,
	`monto` integer NOT NULL,
	`referencia_id` text,
	`fecha` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `productos` ADD `unidad_medida` text DEFAULT 'unidad' NOT NULL;--> statement-breakpoint
ALTER TABLE `ventas` ADD `cliente_id` text REFERENCES clientes(id);