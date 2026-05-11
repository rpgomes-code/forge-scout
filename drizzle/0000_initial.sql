CREATE TYPE "public"."forge_source" AS ENUM('scrape', 'api');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "forge_components" (
	"id" integer PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text,
	"author" text,
	"rating" real,
	"downloads" integer DEFAULT 0 NOT NULL,
	"platform" text[] DEFAULT '{}'::text[] NOT NULL,
	"license" text,
	"badges" text[] DEFAULT '{}'::text[] NOT NULL,
	"github_url" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_updated" timestamp with time zone,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "forge_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_health" (
	"repo_url" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"default_branch" text,
	"spdx_license" text,
	"last_push_at" timestamp with time zone,
	"last_commit_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "forge_source" NOT NULL,
	"status" "scrape_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"components_processed" integer DEFAULT 0 NOT NULL,
	"components_inserted" integer DEFAULT 0 NOT NULL,
	"components_updated" integer DEFAULT 0 NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "forge_components_slug_idx" ON "forge_components" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "forge_components_category_idx" ON "forge_components" USING btree ("category");--> statement-breakpoint
CREATE INDEX "forge_components_license_idx" ON "forge_components" USING btree ("license");--> statement-breakpoint
CREATE INDEX "forge_components_rating_idx" ON "forge_components" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "forge_components_downloads_idx" ON "forge_components" USING btree ("downloads");--> statement-breakpoint
CREATE INDEX "forge_components_last_updated_idx" ON "forge_components" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "github_health_expires_at_idx" ON "github_health" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "scrape_runs_started_at_idx" ON "scrape_runs" USING btree ("started_at");