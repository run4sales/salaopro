-- Multi-access layers for establishments (owner/admin/employee)
DO $$ BEGIN
  CREATE TYPE public.establishment_access_role AS ENUM ('admin', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.establishment_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.establishment_access_role NOT NULL DEFAULT 'employee',
  professional_id UUID NULL REFERENCES public.professionals(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, user_id)
);

ALTER TABLE public.establishment_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_establishment_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  UNION
  SELECT eu.establishment_id FROM public.establishment_users eu WHERE eu.user_id = auth.uid() AND eu.active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_establishment_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'owner'::text FROM public.profiles p WHERE p.user_id = auth.uid()
  UNION
  SELECT eu.role::text FROM public.establishment_users eu WHERE eu.user_id = auth.uid() AND eu.active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_professional_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT eu.professional_id FROM public.establishment_users eu WHERE eu.user_id = auth.uid() AND eu.active = true LIMIT 1
$$;

CREATE POLICY "Owners/admins manage establishment users"
ON public.establishment_users FOR ALL TO authenticated
USING (
  establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.establishment_users me
    WHERE me.establishment_id = establishment_users.establishment_id
      AND me.user_id = auth.uid()
      AND me.role = 'admin'
      AND me.active = true
  )
)
WITH CHECK (
  establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.establishment_users me
    WHERE me.establishment_id = establishment_users.establishment_id
      AND me.user_id = auth.uid()
      AND me.role = 'admin'
      AND me.active = true
  )
);

CREATE POLICY "Users can view own membership"
ON public.establishment_users FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Policies for employee access
CREATE POLICY "Staff can view linked establishment profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = public.current_establishment_id());

CREATE POLICY "Staff can view base catalog"
ON public.clients FOR SELECT TO authenticated
USING (establishment_id = public.current_establishment_id());
CREATE POLICY "Staff can view services"
ON public.services FOR SELECT TO authenticated
USING (establishment_id = public.current_establishment_id());
CREATE POLICY "Staff can view professionals"
ON public.professionals FOR SELECT TO authenticated
USING (establishment_id = public.current_establishment_id());

CREATE POLICY "Staff can manage own appointments"
ON public.appointments FOR ALL TO authenticated
USING (
  establishment_id = public.current_establishment_id()
  AND (
    public.current_establishment_role() IN ('owner', 'admin')
    OR professional_id = public.current_professional_id()
  )
)
WITH CHECK (
  establishment_id = public.current_establishment_id()
  AND (
    public.current_establishment_role() IN ('owner', 'admin')
    OR professional_id = public.current_professional_id()
  )
);

CREATE POLICY "Staff can manage own sales"
ON public.sales FOR ALL TO authenticated
USING (
  establishment_id = public.current_establishment_id()
  AND (
    public.current_establishment_role() IN ('owner', 'admin')
    OR professional_id = public.current_professional_id()
  )
)
WITH CHECK (
  establishment_id = public.current_establishment_id()
  AND (
    public.current_establishment_role() IN ('owner', 'admin')
    OR professional_id = public.current_professional_id()
  )
);

CREATE POLICY "Staff can manage own comandas"
ON public.comandas FOR ALL TO authenticated
USING (establishment_id = public.current_establishment_id())
WITH CHECK (establishment_id = public.current_establishment_id());

CREATE POLICY "Staff can manage own comanda_items"
ON public.comanda_items FOR ALL TO authenticated
USING (establishment_id = public.current_establishment_id())
WITH CHECK (establishment_id = public.current_establishment_id());
