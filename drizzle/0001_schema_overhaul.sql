ALTER TABLE "machines" ALTER COLUMN "base_price" SET DATA TYPE numeric(10, 2) USING "base_price"::numeric(10, 2);--> statement-breakpoint
ALTER TABLE "options" ALTER COLUMN "price" SET DATA TYPE numeric(10, 2) USING "price"::numeric(10, 2);--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "base_price" SET DATA TYPE numeric(10, 2) USING "base_price"::numeric(10, 2);--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "options_total" SET DATA TYPE numeric(10, 2) USING "options_total"::numeric(10, 2);--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "total_price" SET DATA TYPE numeric(10, 2) USING "total_price"::numeric(10, 2);--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamptz;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "option_categories" ADD CONSTRAINT "option_categories_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_category_id_option_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."option_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_option_categories_machine_id" ON "option_categories" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "idx_options_category_id" ON "options" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_options_machine_id" ON "options" USING btree ("machine_id");
