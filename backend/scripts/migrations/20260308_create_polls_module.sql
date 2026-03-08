-- Módulo 🗨️ Enquetes

CREATE TABLE IF NOT EXISTS polls (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('YES_NO', 'MULTIPLE_CHOICE')),
  allow_multiple_answers BOOLEAN NOT NULL DEFAULT FALSE,
  allow_other_option BOOLEAN NOT NULL DEFAULT FALSE,
  deadline_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
  created_by BIGINT NOT NULL REFERENCES filiados(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id BIGSERIAL PRIMARY KEY,
  poll_id BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_other BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  UNIQUE (poll_id, sort_order),
  UNIQUE (poll_id, label)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id BIGSERIAL PRIMARY KEY,
  poll_id BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES filiados(id),
  option_id BIGINT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  other_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_polls_status_deadline ON polls(status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_user ON poll_votes(poll_id, user_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
