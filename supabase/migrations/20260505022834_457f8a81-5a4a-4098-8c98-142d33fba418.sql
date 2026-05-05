
-- 1. Add commission_percentage to professionals
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;

-- 2. Add professional_id to sales (nullable first, backfill, then enforce)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS professional_id UUID;

-- Backfill: try to derive from related appointment when possible
UPDATE public.sales s
SET professional_id = a.professional_id
FROM public.appointments a
WHERE s.appointment_id = a.id
  AND s.professional_id IS NULL
  AND a.professional_id IS NOT NULL;

-- For remaining sales without professional, assign first active professional of establishment
UPDATE public.sales s
SET professional_id = p.id
FROM (
  SELECT DISTINCT ON (establishment_id) id, establishment_id
  FROM public.professionals
  WHERE active = true
  ORDER BY establishment_id, created_at ASC
) p
WHERE s.establishment_id = p.establishment_id
  AND s.professional_id IS NULL;

-- 3. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT,
  expense_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can manage their expenses"
ON public.expenses
FOR ALL
USING (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all expenses"
ON public.expenses
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_expenses_establishment_date ON public.expenses (establishment_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_professional ON public.sales (professional_id);
