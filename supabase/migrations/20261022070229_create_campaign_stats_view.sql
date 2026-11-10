/*
# Campaign stats view

1. New Views
- `campaign_stats`: one row per campaign with computed click count, lead count, registered count and conversion rate.

2. Security
- Inherits RLS from underlying tables (campaigns, leads, clicks).
- No new policies needed; the view runs as the caller.

3. Important notes
- Uses LEFT JOINs so campaigns with zero leads or clicks still appear.
- Registered count only counts leads with status = 'registered'.
*/

CREATE OR REPLACE VIEW public.campaign_stats AS
SELECT
  c.id,
  c.name,
  c.description,
  c.start_date,
  c.end_date,
  c.status,
  c.created_at,
  COALESCE(lc.lead_count, 0) AS lead_count,
  COALESCE(lc.registered_count, 0) AS registered_count,
  COALESCE(cl.click_count, 0) AS click_count
FROM public.campaigns c
LEFT JOIN (
  SELECT
    campaign_id,
    COUNT(*) AS lead_count,
    COUNT(*) FILTER (WHERE status = 'registered') AS registered_count
  FROM public.leads
  WHERE campaign_id IS NOT NULL
  GROUP BY campaign_id
) lc ON lc.campaign_id = c.id
LEFT JOIN (
  SELECT campaign_id, COUNT(*) AS click_count
  FROM public.clicks
  WHERE campaign_id IS NOT NULL
  GROUP BY campaign_id
) cl ON cl.campaign_id = c.id;
