REVOKE ALL ON FUNCTION public.get_my_employee_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_employee_context() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_employee_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_context() TO service_role;

REVOKE ALL ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_agenda(timestamptz, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.get_my_employee_attendances() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_employee_attendances() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_employee_attendances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_employee_attendances() TO service_role;