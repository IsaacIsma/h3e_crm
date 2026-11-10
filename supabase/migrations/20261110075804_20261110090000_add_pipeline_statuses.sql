/*
# Add the expanded CRM pipeline statuses

1. Changes
- Expands `public.leads.status` to support the ordered pipeline stages used by the CRM:
  `new`, `contacted`, `relance_1`, `relance_2`, `not_interested`, `interested`,
  `registration_pending`, `registered`, `next_cohort`, and `other_formation`.
- Keeps existing status values valid so no existing prospect data is lost.

2. Data safety
- No rows are deleted or rewritten.
- The existing status column remains text and keeps its current default of `new`.

3. Security
- No RLS policies, grants, tables, or user permissions are changed.
*/

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new',
    'contacted',
    'relance_1',
    'relance_2',
    'not_interested',
    'interested',
    'registration_pending',
    'registered',
    'next_cohort',
    'other_formation',
    'to_contact',
    'follow_up',
    'unreachable',
    'lost'
  ));