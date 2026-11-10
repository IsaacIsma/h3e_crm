/*
# Ambassador stats view

1. New Views
- `ambassador_stats`: one row per ambassador with computed click count, lead count and registered count.

2. Security
- The view inherits RLS from the underlying tables (ambassadors, leads, clicks).
- No new policies needed; the view runs as the caller, so existing row-level policies apply.

3. Important notes
- Uses LEFT JOINs so ambassadors with zero leads or clicks still appear.
- Registered count only counts leads with status = 'registered'.
- Clicks count includes all rows in the clicks table for that ambassador.
*/

CREATE OR REPLACE VIEW public.ambassador_stats AS
SELECT
  a.id,
  a.name,
  a.email,
  a.phone,
  a.code,
  a.status,
  a.created_at,
  COALESCE(lc.lead_count, 0) AS lead_count,
  COALESCE(lc.registered_count, 0) AS registered_count,
  COALESCE(c.click_count, 0) AS click_count
FROM public.ambassadors a
LEFT JOIN (
  SELECT
    first_touch_ambassador_id AS ambassador_id,
    COUNT(*) AS lead_count,
    COUNT(*) FILTER (WHERE status = 'registered') AS registered_count
  FROM public.leads
  WHERE first_touch_ambassador_id IS NOT NULL
  GROUP BY first_touch_ambassador_id
) lc ON lc.ambassador_id = a.id
LEFT JOIN (
  SELECT ambassador_id, COUNT(*) AS click_count
  FROM public.clicks
  WHERE ambassador_id IS NOT NULL
  GROUP BY ambassador_id
) c ON c.ambassador_id = a.id;
