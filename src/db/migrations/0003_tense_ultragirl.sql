CREATE TABLE `assistant_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`role` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`payload` text
);
--> statement-breakpoint
CREATE INDEX `assistant_messages_created_idx` ON `assistant_messages` (`created_at`);