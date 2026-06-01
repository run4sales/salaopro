-- Speeds up agenda filtering by professional when appointments use the
-- appointment_professionals join table for multi-professional bookings.
CREATE INDEX IF NOT EXISTS idx_appointment_professionals_prof_est
ON public.appointment_professionals (professional_id, establishment_id);
