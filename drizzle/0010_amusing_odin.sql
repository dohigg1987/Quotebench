CREATE TABLE `brand_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`logo_file_id` text,
	`primary_color` text DEFAULT '#205b63' NOT NULL,
	`typeface` text DEFAULT 'Inter' NOT NULL,
	`sending_name` text NOT NULL,
	`reply_to` text NOT NULL,
	`sending_domain` text,
	`domain_verified` integer DEFAULT false NOT NULL,
	`white_label` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_profiles_tenant_name_unique` ON `brand_profiles` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`industry` text,
	`blocks_json` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_templates_tenant_name_unique` ON `document_templates` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `pdf_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`quote_reference` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`file_id` text,
	`error` text,
	`requested_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pdf_jobs_tenant_quote_idx` ON `pdf_jobs` (`tenant_id`,`quote_reference`);--> statement-breakpoint
CREATE TABLE `stored_files` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`quote_reference` text,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`r2_key` text NOT NULL,
	`public` integer DEFAULT false NOT NULL,
	`expires_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stored_files_tenant_quote_idx` ON `stored_files` (`tenant_id`,`quote_reference`);