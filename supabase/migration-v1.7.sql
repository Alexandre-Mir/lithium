-- Meta diária de leitura (preferência global do app pessoal).
CREATE TABLE IF NOT EXISTS app_settings (
  id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_goal_minutes INTEGER NOT NULL DEFAULT 60
                     CHECK (daily_goal_minutes BETWEEN 1 AND 1440),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id, daily_goal_minutes)
VALUES (1, 60)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

NOTIFY pgrst, 'reload schema';
