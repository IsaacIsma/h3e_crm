/*
# Lock CRM role changes and add first-admin bootstrap

1. Security changes
- Authenticated users may create their own profile with the normal commercial role default.
- Authenticated users may update only their own name, avatar and email-facing profile fields.
- The protected `role` column can no longer be written directly from the browser.
- A one-time bootstrap function lets the requested administrator account become admin only when there is no admin yet and the authenticated email is exactly the bootstrap email.

2. Important notes
- This prevents a new account from promoting itself through a crafted database request.
- The bootstrap function is callable only by authenticated users and stops working once an admin exists.
- No existing profile or lead data is deleted or changed by this migration.
*/

REVOKE INSERT ON TABLE public.profiles FROM authenticated;
GRANT INSERT (id, full_name, email, avatar_url) ON TABLE public.profiles TO authenticated;
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, email, avatar_url, updated_at) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(auth.email(), '')) <> 'admin@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'An admin already exists';
  END IF;

  UPDATE public.profiles
  SET role = 'admin', updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;
