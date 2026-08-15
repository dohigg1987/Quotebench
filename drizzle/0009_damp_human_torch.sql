CREATE TABLE `workspace_members` (
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`invited_by` text,
	`invited_at` text,
	`expires_at` text,
	`joined_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_tenant_email_unique` ON `workspace_members` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `workspace_members_tenant_status_idx` ON `workspace_members` (`tenant_id`,`status`);