UPDATE public.appointment_services aps
SET unit_price = 0,
    price_source = 'negotiated'
FROM public.appointments a
WHERE a.id = aps.appointment_id
  AND a.service_amount = 0
  AND (aps.unit_price IS DISTINCT FROM 0 OR aps.price_source IS DISTINCT FROM 'negotiated');

COMMENT ON COLUMN public.appointment_services.unit_price IS
  'Historical service price snapshot. Zero is valid for complimentary or fully discounted appointments and must never be treated as missing.';