-- Garante idempotência no registro de comissões por venda/profissional.
-- Uma venda pode ter múltiplas comissões, mas apenas uma por profissional e papel.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_professionals_sale_professional_role_unique
ON public.sale_professionals (sale_id, professional_id, role);
