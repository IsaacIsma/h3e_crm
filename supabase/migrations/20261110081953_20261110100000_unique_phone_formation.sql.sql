/*
# Prevent duplicate prospect registration per formation

1. Purpose
- A prospect must not be registered twice in the same formation with the same
  phone number. This applies to both entry points:
  a) Internal CRM form → stores `formation_id` (UUID FK to formations).
  b) Public referral page → stores `formation` (free-text).

2. Changes
- Add a partial unique index on `leads(phone, formation_id)` where
  `formation_id IS NOT NULL`. NULL values are intentionally excluded so that
  leads without a linked formation remain unconstrained.
- Add a partial unique index on `leads(phone, formation)` where
  `formation <> ''`. Empty-string formations are unconstrained so legacy rows
  and leads with no formation text remain unaffected.

3. Data safety
- No columns are added, dropped, or renamed.
- No existing rows are modified.
- The indexes are created `IF NOT EXISTS` so the migration is re-runnable.
- Existing duplicate rows (if any) would cause index creation to fail; in that
  case the migration is not applied and the duplicates must be resolved first.
*/

CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_formation_id_uniq
  ON public.leads (phone, formation_id)
  WHERE formation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_formation_text_uniq
  ON public.leads (phone, formation)
  WHERE formation <> '';
