CREATE TABLE `onboarding_state` (
	`tenant_id` text NOT NULL,
	`user_email` text NOT NULL,
	`selected_template` text,
	`status` text NOT NULL,
	`walkthrough_step` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_state_tenant_user_unique` ON `onboarding_state` (`tenant_id`,`user_email`);--> statement-breakpoint
CREATE TABLE `personal_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personal_templates_tenant_name_unique` ON `personal_templates` (`tenant_id`,`name`);