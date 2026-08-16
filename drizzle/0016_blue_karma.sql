CREATE TABLE `catalogue_item_proposal_types` (
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`proposal_type_id` text NOT NULL,
	`default_included` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalogue_item_proposal_types_unique` ON `catalogue_item_proposal_types` (`tenant_id`,`item_id`,`proposal_type_id`);--> statement-breakpoint
CREATE INDEX `catalogue_item_proposal_types_type_idx` ON `catalogue_item_proposal_types` (`tenant_id`,`proposal_type_id`);--> statement-breakpoint
CREATE TABLE `proposal_types` (
	`tenant_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposal_types_tenant_id_unique` ON `proposal_types` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `proposal_types_tenant_name_idx` ON `proposal_types` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `service_categories` (
	`tenant_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_categories_tenant_id_unique` ON `service_categories` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `service_categories_tenant_parent_idx` ON `service_categories` (`tenant_id`,`parent_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `catalogue_items` ADD `subcategory_id` text;--> statement-breakpoint
ALTER TABLE `catalogue_items` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalogue_items` ADD `service_schedule` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalogue_items` ADD `service_terms` text DEFAULT '' NOT NULL;