/*
# Public ambassador resolution by referral code

1. New Functions
- `resolve_ambassador_by_code`: SECURITY DEFINER function that looks up an ambassador by their unique code.
  Returns id, name, and code. Accessible by anon (public visitors using referral links).

2. Security
- SECURITY DEFINER so unauthenticated visitors can resolve a referral code to an ambassador identity.
- Returns only non-sensitive columns (id, name, code).
- No writes — read-only lookup.

3. Important notes
- The function is called from the frontend when a visitor lands on a referral link (e.g. ?ref=AWA2026).
- It returns at most one row since `code` is UNIQUE on the ambassadors table.
*/

CREATE OR REPLACE FUNCTION public.resolve_ambassador_by_code(p_code text)
RETURNS TABLE (id uuid, name text, code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.name, a.code
  FROM public.ambassadors a
  WHERE a.code = p_code
    AND a.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_ambassador_by_code(text) TO anon, authenticated;
