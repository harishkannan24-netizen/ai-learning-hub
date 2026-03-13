-- Table to store shared quizzes for QR code access
CREATE TABLE public.shared_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  quiz_title text NOT NULL DEFAULT 'Quiz',
  questions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.shared_quizzes ENABLE ROW LEVEL SECURITY;

-- Anyone can view shared quizzes (for QR code access without login)
CREATE POLICY "Anyone can view shared quizzes"
  ON public.shared_quizzes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can create shared quizzes
CREATE POLICY "Users can create shared quizzes"
  ON public.shared_quizzes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can delete their own shared quizzes
CREATE POLICY "Users can delete own shared quizzes"
  ON public.shared_quizzes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);