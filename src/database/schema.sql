-- Guild settings
CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  ticket_log_channel TEXT,
  ticket_transcript_channel TEXT,
  ticket_category TEXT,
  ticket_counter INTEGER DEFAULT 0,
  ticket_limit INTEGER DEFAULT 3,
  auto_close_hours INTEGER DEFAULT 0,
  support_roles TEXT,
  auto_roles TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add auto_roles column if it doesn't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guilds' AND column_name = 'auto_roles') THEN
    ALTER TABLE guilds ADD COLUMN auto_roles TEXT;
  END IF;
END $$;

-- Ticket panels
CREATE TABLE IF NOT EXISTS panels (
  id SERIAL PRIMARY KEY,
  guild_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  panel_type TEXT,
  title TEXT,
  description TEXT,
  button_label TEXT,
  button_color TEXT,
  category_id TEXT,
  style TEXT DEFAULT 'buttons',
  ticket_types TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  guild_id TEXT,
  channel_id TEXT UNIQUE,
  user_id TEXT,
  panel_type TEXT,
  ticket_number INTEGER,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  claimed_by TEXT,
  close_reason TEXT,
  transcript_url TEXT,
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

-- Ticket blacklist
CREATE TABLE IF NOT EXISTS ticket_blacklist (
  guild_id TEXT,
  user_id TEXT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id)
);

-- Application types
CREATE TABLE IF NOT EXISTS application_types (
  id SERIAL PRIMARY KEY,
  guild_id TEXT,
  name TEXT,
  description TEXT,
  channel_id TEXT,
  message_id TEXT,
  review_roles TEXT,
  log_channel TEXT,
  cooldown_hours INTEGER DEFAULT 24,
  create_ticket BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  pending_role TEXT,
  accepted_role TEXT,
  denied_role TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add role columns if they don't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_types' AND column_name = 'pending_role') THEN
    ALTER TABLE application_types ADD COLUMN pending_role TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_types' AND column_name = 'accepted_role') THEN
    ALTER TABLE application_types ADD COLUMN accepted_role TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'application_types' AND column_name = 'denied_role') THEN
    ALTER TABLE application_types ADD COLUMN denied_role TEXT;
  END IF;
END $$;

-- Application questions
CREATE TABLE IF NOT EXISTS application_questions (
  id SERIAL PRIMARY KEY,
  application_type_id INTEGER REFERENCES application_types(id) ON DELETE CASCADE,
  question TEXT,
  question_type TEXT,
  choices TEXT,
  required BOOLEAN DEFAULT true,
  order_num INTEGER
);

-- Applications (submissions)
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  guild_id TEXT,
  application_type_id INTEGER REFERENCES application_types(id),
  user_id TEXT,
  answers TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  review_reason TEXT,
  ticket_channel_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_panels_guild ON panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_applications_guild ON applications(guild_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_application_questions_type ON application_questions(application_type_id);
