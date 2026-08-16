CREATE TABLE `catalogue_items` (
	`tenant_id` text NOT NULL,
	`id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`unit_label` text NOT NULL,
	`pricing_basis` text NOT NULL,
	`base_price_minor` integer,
	`cost_minor` integer,
	`target_margin_bp` integer,
	`recurrence` text NOT NULL,
	`min_quantity` integer,
	`max_quantity` integer,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalogue_items_tenant_id_unique` ON `catalogue_items` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `catalogue_items_tenant_name_idx` ON `catalogue_items` (`tenant_id`,`name`);