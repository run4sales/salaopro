-- Grant super_admin role to specified user
INSERT INTO public.user_roles (user_id, role)
VALUES ('501b5585-7f65-4c36-9d20-e8846cab1b7c', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;