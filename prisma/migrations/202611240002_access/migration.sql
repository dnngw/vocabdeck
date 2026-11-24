-- Prisma uses an explicit server authorization boundary. These policies permit
-- only the private runtime role; they do NOT implement per-user JWT filtering.
REVOKE ALL ON SCHEMA vocabdeck FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vocabdeck_app') THEN
    CREATE ROLE vocabdeck_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA vocabdeck TO vocabdeck_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA vocabdeck TO vocabdeck_app;
REVOKE INSERT, UPDATE, DELETE ON vocabdeck.profiles FROM vocabdeck_app;
GRANT UPDATE (status, updated_at) ON vocabdeck.profiles TO vocabdeck_app;
REVOKE UPDATE, DELETE ON vocabdeck.review_logs, vocabdeck.audit_logs FROM vocabdeck_app;

DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','decks','vocabulary_entries','word_senses','examples','cards','card_progress','review_logs','user_settings','ai_usage','app_settings','audit_logs'] LOOP
    EXECUTE format('ALTER TABLE vocabdeck.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY runtime_access ON vocabdeck.%I TO vocabdeck_app USING (true) WITH CHECK (true)', tbl);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA vocabdeck FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA vocabdeck FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA vocabdeck FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA vocabdeck FROM authenticated;
  END IF;
END $$;

ALTER TABLE vocabdeck.card_progress ADD CONSTRAINT valid_card_state CHECK (state BETWEEN 0 AND 3);
ALTER TABLE vocabdeck.review_logs ADD CONSTRAINT valid_rating CHECK (rating BETWEEN 1 AND 4);
ALTER TABLE vocabdeck.user_settings ADD CONSTRAINT valid_daily_limit CHECK (daily_new_limit BETWEEN 0 AND 100);
ALTER TABLE vocabdeck.user_settings ADD CONSTRAINT valid_retention CHECK (desired_retention BETWEEN 0.7 AND 0.97);

CREATE FUNCTION vocabdeck.sync_invited_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO vocabdeck.profiles (id, display_name, invited_at, accepted_at, status, updated_at)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'display_name', ''), 100), NEW.invited_at,
    CASE WHEN NEW.invited_at IS NOT NULL THEN NEW.email_confirmed_at ELSE NULL END,
    CASE WHEN NEW.invited_at IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN 'active'::vocabdeck."AccountStatus" ELSE 'pending'::vocabdeck."AccountStatus" END, now())
  ON CONFLICT (id) DO UPDATE SET
    invited_at = EXCLUDED.invited_at,
    accepted_at = EXCLUDED.accepted_at,
    status = CASE WHEN vocabdeck.profiles.status = 'pending' AND EXCLUDED.status = 'active' THEN 'active'::vocabdeck."AccountStatus" ELSE vocabdeck.profiles.status END,
    updated_at = now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vocabdeck.sync_invited_profile() FROM PUBLIC;

-- Supabase owns auth.users. Never create or drop it in application migrations.
-- Plain PostgreSQL is supported for integration tests without Supabase Auth.
DO $$ BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE vocabdeck.profiles ADD CONSTRAINT profiles_auth_user_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE TRIGGER vocabdeck_sync_profile AFTER INSERT OR UPDATE OF invited_at, email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION vocabdeck.sync_invited_profile();
    INSERT INTO vocabdeck.profiles (id, display_name, invited_at, accepted_at, status, updated_at)
    SELECT id, left(coalesce(raw_user_meta_data->>'display_name',''),100), invited_at,
      CASE WHEN invited_at IS NOT NULL THEN email_confirmed_at ELSE NULL END,
      CASE WHEN invited_at IS NOT NULL AND email_confirmed_at IS NOT NULL THEN 'active'::vocabdeck."AccountStatus" ELSE 'pending'::vocabdeck."AccountStatus" END, now()
    FROM auth.users ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
