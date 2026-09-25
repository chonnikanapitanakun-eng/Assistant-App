ALTER TABLE `transactions` ADD `payee` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `slip_ref` text;--> statement-breakpoint
CREATE INDEX `transactions_slip_ref_idx` ON `transactions` (`slip_ref`);--> statement-breakpoint
ALTER TABLE `wallets` ADD `bank_code` text;--> statement-breakpoint
ALTER TABLE `wallets` ADD `account_digits` text;