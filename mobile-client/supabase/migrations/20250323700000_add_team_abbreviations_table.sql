CREATE TABLE IF NOT EXISTS public.team_abbreviations (
  variant text PRIMARY KEY,
  canonical text NOT NULL
);

ALTER TABLE public.team_abbreviations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON public.team_abbreviations FOR SELECT USING (true);

INSERT INTO public.team_abbreviations (variant, canonical) VALUES
  ('NY', 'NYK'), ('NYK', 'NYK'),
  ('GS', 'GSW'), ('GSW', 'GSW'),
  ('SA', 'SAS'), ('SAS', 'SAS'),
  ('NO', 'NOP'), ('NOP', 'NOP'),
  ('UTAH', 'UTA'), ('UTA', 'UTA'),
  ('BKN', 'BKN'), ('BRK', 'BKN'),
  ('ATL', 'ATL'), ('BOS', 'BOS'), ('CHI', 'CHI'), ('CHA', 'CHA'),
  ('CLE', 'CLE'), ('DAL', 'DAL'), ('DEN', 'DEN'), ('DET', 'DET'),
  ('HOU', 'HOU'), ('IND', 'IND'), ('LAC', 'LAC'), ('LAL', 'LAL'),
  ('MEM', 'MEM'), ('MIA', 'MIA'), ('MIL', 'MIL'), ('MIN', 'MIN'),
  ('OKC', 'OKC'), ('ORL', 'ORL'), ('PHI', 'PHI'), ('PHX', 'PHX'),
  ('POR', 'POR'), ('SAC', 'SAC'), ('TOR', 'TOR'), ('WSH', 'WSH')
ON CONFLICT (variant) DO UPDATE SET canonical = EXCLUDED.canonical;
