CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_tenant_email_unique` ON `clients` (`tenant_id`,`contact_email`);--> statement-breakpoint
CREATE INDEX `clients_tenant_name_idx` ON `clients` (`tenant_id`,`name`);--> statement-breakpoint
ALTER TABLE `quotes` ADD `client_id` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `superseded_by` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `declined_at` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `decline_reason` text;