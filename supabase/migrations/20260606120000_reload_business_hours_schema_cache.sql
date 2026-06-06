-- Force a PostgREST schema-cache refresh for deployments that already applied the
-- business-hours migrations before the explicit reload notification existed.
SELECT pg_notify('pgrst', 'reload schema');
