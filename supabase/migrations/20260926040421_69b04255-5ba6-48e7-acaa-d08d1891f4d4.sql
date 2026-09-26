REVOKE ALL ON FUNCTION public.staff_owns_appointment(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_owns_comanda(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_agenda_employee_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_comanda_billing() FROM PUBLIC, anon, authenticated;