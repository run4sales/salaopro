-- This migration fixes a bug where the profile slug was not updating
-- when the business_name was changed.

-- The new function prioritizes the business_name as the source for the slug
-- if the business_name has been updated. Otherwise, it allows for manual
-- slug updates as was likely the original intent.

CREATE OR REPLACE FUNCTION public.ensure_profile_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  candidate_slug TEXT;
  i INT := 2;
BEGIN
  -- This trigger runs on INSERT or UPDATE of business_name or slug.

  -- Determine the base for the new slug.
  -- Priority 1: A new record is being inserted.
  -- Priority 2: The business_name was updated.
  -- Priority 3: The business_name is unchanged, so the slug must have been updated manually.
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.business_name IS DISTINCT FROM OLD.business_name)) THEN
      base_slug := public.slugify(COALESCE(NEW.business_name, ''));
  ELSE
      base_slug := public.slugify(COALESCE(NEW.slug, ''));
  END IF;

  -- If slugify results in an empty string (e.g., name was just symbols), use a default.
  IF base_slug = '' THEN
    base_slug := 'salao';
  END IF;

  candidate_slug := base_slug;

  -- Find a unique slug by appending a number if the candidate already exists for another profile.
  WHILE EXISTS(SELECT 1 FROM public.profiles p WHERE p.slug = candidate_slug AND p.id <> NEW.id) LOOP
    candidate_slug := base_slug || '-' || i::text;
    i := i + 1;
  END LOOP;

  -- Set the final, unique slug.
  NEW.slug := candidate_slug;

  RETURN NEW;
END;
$$;
