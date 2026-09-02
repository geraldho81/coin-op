CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initials TEXT NOT NULL,
  score INT NOT NULL,
  wave INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
