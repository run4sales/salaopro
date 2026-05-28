
-- Security definer function to check membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_establishment_member(_establishment_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_users
    WHERE establishment_id = _establishment_id
      AND user_id = _user_id
      AND active = true
  );
$$;

-- Allow staff members to read the establishment's profile
DROP POLICY IF EXISTS "Staff can view their establishment profile" ON public.profiles;
CREATE POLICY "Staff can view their establishment profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_establishment_member(id, auth.uid()));
