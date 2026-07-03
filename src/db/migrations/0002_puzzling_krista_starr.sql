CREATE TABLE `auditoria` (
	`id` text PRIMARY KEY NOT NULL,
	`fecha` integer NOT NULL,
	`usuario_id` text,
	`usuario_nombre` text,
	`accion` text NOT NULL,
	`detalle` text,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer
);
