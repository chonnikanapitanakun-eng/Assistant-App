ALTER TABLE `routines` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_routine_date_uniq` ON `tasks` (`routine_id`,`date`);