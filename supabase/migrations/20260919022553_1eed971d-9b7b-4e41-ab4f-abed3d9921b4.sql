ALTER TABLE public.professionals
ADD COLUMN calendar_color text;

ALTER TABLE public.professionals
ADD CONSTRAINT professionals_calendar_color_allowed
CHECK (calendar_color IS NULL OR calendar_color = ANY (ARRAY[
  '#2563EB', '#16A34A', '#7C3AED', '#EA580C', '#DB2777',
  '#DC2626', '#CA8A04', '#0D9488', '#1E3A8A', '#166534'
]));

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY establishment_id ORDER BY created_at, id) AS color_position
  FROM public.professionals
  WHERE calendar_color IS NULL
)
UPDATE public.professionals p
SET calendar_color = (ARRAY[
  '#2563EB', '#16A34A', '#7C3AED', '#EA580C', '#DB2777',
  '#DC2626', '#CA8A04', '#0D9488', '#1E3A8A', '#166534'
])[(ranked.color_position - 1) % 10 + 1]
FROM ranked
WHERE p.id = ranked.id;

CREATE OR REPLACE FUNCTION public.assign_professional_calendar_color()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  palette constant text[] := ARRAY[
    '#2563EB', '#16A34A', '#7C3AED', '#EA580C', '#DB2777',
    '#DC2626', '#CA8A04', '#0D9488', '#1E3A8A', '#166534'
  ];
BEGIN
  IF NEW.calendar_color IS NULL OR btrim(NEW.calendar_color) = '' THEN
    SELECT candidate.color
      INTO NEW.calendar_color
    FROM unnest(palette) WITH ORDINALITY AS candidate(color, position)
    LEFT JOIN public.professionals existing
      ON existing.establishment_id = NEW.establishment_id
     AND existing.active = true
     AND existing.calendar_color = candidate.color
    GROUP BY candidate.color, candidate.position
    ORDER BY count(existing.id), candidate.position
    LIMIT 1;
  ELSE
    NEW.calendar_color := upper(btrim(NEW.calendar_color));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_professional_calendar_color_before_write
BEFORE INSERT OR UPDATE OF calendar_color, establishment_id
ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.assign_professional_calendar_color();

ALTER TABLE public.professionals
ALTER COLUMN calendar_color SET DEFAULT '#2563EB',
ALTER COLUMN calendar_color SET NOT NULL;