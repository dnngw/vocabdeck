-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "vocabdeck";

-- CreateEnum
CREATE TYPE "vocabdeck"."Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "vocabdeck"."AccountStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateTable
CREATE TABLE "vocabdeck"."profiles" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(100) NOT NULL DEFAULT '',
    "role" "vocabdeck"."Role" NOT NULL DEFAULT 'user',
    "status" "vocabdeck"."AccountStatus" NOT NULL DEFAULT 'pending',
    "invited_at" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."decks" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."vocabulary_entries" (
    "id" UUID NOT NULL,
    "deck_id" UUID NOT NULL,
    "word" VARCHAR(120) NOT NULL,
    "normalized" VARCHAR(120) NOT NULL,
    "part_of_speech" VARCHAR(40) NOT NULL DEFAULT '',
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vocabulary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."word_senses" (
    "id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,
    "meaning_indonesian" VARCHAR(500) NOT NULL,
    "definition_en" VARCHAR(1000) NOT NULL DEFAULT '',
    "normalized" VARCHAR(500) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "word_senses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."examples" (
    "id" UUID NOT NULL,
    "sense_id" UUID NOT NULL,
    "sentence_en" VARCHAR(2000) NOT NULL,
    "translation_indonesian" VARCHAR(2000) NOT NULL DEFAULT '',
    "context_explanation_indonesian" VARCHAR(2000) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."cards" (
    "id" UUID NOT NULL,
    "sense_id" UUID NOT NULL,
    "default_example_id" UUID NOT NULL,
    "card_type" TEXT NOT NULL DEFAULT 'context_to_meaning',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."card_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fsrs_data" JSONB NOT NULL,
    "last_review_at" TIMESTAMPTZ(3),
    "first_review_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "card_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."review_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "progress_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,

    CONSTRAINT "review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."user_settings" (
    "user_id" UUID NOT NULL,
    "daily_new_limit" INTEGER NOT NULL DEFAULT 10,
    "desired_retention" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta',

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."ai_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "operation" VARCHAR(30) NOT NULL DEFAULT 'generate',
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "duration_ms" INTEGER,
    "error_code" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabdeck"."app_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "vocabdeck"."audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decks_owner_id_idx" ON "vocabdeck"."decks"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_entries_deck_id_normalized_part_of_speech_key" ON "vocabdeck"."vocabulary_entries"("deck_id", "normalized", "part_of_speech");

-- CreateIndex
CREATE UNIQUE INDEX "word_senses_vocabulary_id_normalized_key" ON "vocabdeck"."word_senses"("vocabulary_id", "normalized");

-- CreateIndex
CREATE INDEX "examples_sense_id_idx" ON "vocabdeck"."examples"("sense_id");

-- CreateIndex
CREATE INDEX "cards_default_example_id_idx" ON "vocabdeck"."cards"("default_example_id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_sense_id_card_type_key" ON "vocabdeck"."cards"("sense_id", "card_type");

-- CreateIndex
CREATE INDEX "card_progress_user_id_state_due_at_idx" ON "vocabdeck"."card_progress"("user_id", "state", "due_at");

-- CreateIndex
CREATE INDEX "card_progress_user_id_first_review_at_idx" ON "vocabdeck"."card_progress"("user_id", "first_review_at");

-- CreateIndex
CREATE UNIQUE INDEX "card_progress_user_id_card_id_key" ON "vocabdeck"."card_progress"("user_id", "card_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_logs_request_id_key" ON "vocabdeck"."review_logs"("request_id");

-- CreateIndex
CREATE INDEX "review_logs_user_id_reviewed_at_idx" ON "vocabdeck"."review_logs"("user_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "review_logs_progress_id_idx" ON "vocabdeck"."review_logs"("progress_id");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_created_at_idx" ON "vocabdeck"."ai_usage"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_status_idx" ON "vocabdeck"."ai_usage"("created_at", "status");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "vocabdeck"."audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "vocabdeck"."decks" ADD CONSTRAINT "decks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "vocabdeck"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."vocabulary_entries" ADD CONSTRAINT "vocabulary_entries_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "vocabdeck"."decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."word_senses" ADD CONSTRAINT "word_senses_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabdeck"."vocabulary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."examples" ADD CONSTRAINT "examples_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "vocabdeck"."word_senses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."cards" ADD CONSTRAINT "cards_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "vocabdeck"."word_senses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."cards" ADD CONSTRAINT "cards_default_example_id_fkey" FOREIGN KEY ("default_example_id") REFERENCES "vocabdeck"."examples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."card_progress" ADD CONSTRAINT "card_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vocabdeck"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."card_progress" ADD CONSTRAINT "card_progress_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "vocabdeck"."cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."review_logs" ADD CONSTRAINT "review_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vocabdeck"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."review_logs" ADD CONSTRAINT "review_logs_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "vocabdeck"."card_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vocabdeck"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabdeck"."ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vocabdeck"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
