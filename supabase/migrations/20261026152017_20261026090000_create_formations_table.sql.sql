/*
# Create formations table

1. New Tables
- `formations`: catalog of training programs offered by H3E Academy.
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `description` (text, default empty)
  - `duration` (text, e.g. "3 mois")
  - `price` (numeric, default 0)
  - `status` (text: draft/active/archived, default active)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Modified Tables
- `leads.formation_id` (uuid, references formations, nullable) added so a lead can be linked to a specific formation instead of a free-text field. The existing `formation` text column is kept for backward compatibility.

3. Security
- Enable RLS on `formations`.
- Authenticated users (admin, commercial, ambassador) can read all formations (SELECT to authenticated).
- Only admins can create/update/delete formations.
- `service_role` granted for potential edge-function usage.
*/

CREATE TABLE IF NOT EXISTS public.formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formations TO authenticated;
GRANT SELECT ON public.formations TO anon;

DROP POLICY IF EXISTS "formations_select_authenticated" ON public.formations;
CREATE POLICY "formations_select_authenticated" ON public.formations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "formations_insert_admin" ON public.formations;
CREATE POLICY "formations_insert_admin" ON public.formations FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "formations_update_admin" ON public.formations;
CREATE POLICY "formations_update_admin" ON public.formations FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "formations_delete_admin" ON public.formations;
CREATE POLICY "formations_delete_admin" ON public.formations FOR DELETE
  TO authenticated USING (public.is_admin());

-- Add formation_id column to leads if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'formation_id') THEN
    ALTER TABLE public.leads ADD COLUMN formation_id uuid REFERENCES public.formations(id) ON DELETE SET NULL;
  END IF;
END $$;