ALTER TABLE `ventas` ADD `anulada` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ventas` ADD `anulada_fecha` integer;--> statement-breakpoint
ALTER TABLE `ventas` ADD `anulada_motivo` text;