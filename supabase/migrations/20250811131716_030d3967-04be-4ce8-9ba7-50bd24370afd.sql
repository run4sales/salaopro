-- Add slug support for pretty public booking URLs
create extension if not exists unaccent;

alter table public.profiles
  add column if not exists slug text;

-- Unique index allowing NULLs
create unique index if not exists profiles_slug_unique on public.profiles (slug) where slug is not null;

-- Helper to create URL-friendly slugs
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(regexp_replace(lower(unaccent(coalesce($1, ''))), '[^a-z0-9]+' , '-', 'g'), '-+', '-', 'g'))
$$;

-- Trigger to ensure slug exists and is unique (based on business_name when available)
create or replace function public.ensure_profile_slug()
returns trigger
language plpgsql
as $$
declare
  base text;
  candidate text;
  i int := 2;
begin
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    if new.slug is null or length(trim(new.slug)) = 0 then
      base := public.slugify(coalesce(new.business_name, ''));
      if base = '' then
        base := 'salao';
      end if;
    else
      base := public.slugify(new.slug);
    end if;

    candidate := base;

    while exists(select 1 from public.profiles p where p.slug = candidate and p.id <> new.id) loop
      candidate := base || '-' || i::text;
      i := i + 1;
    end loop;

    new.slug := candidate;
  end if;
  return new;
end;
$$;

-- Ensure trigger is attached
drop trigger if exists trg_profiles_ensure_slug on public.profiles;
create trigger trg_profiles_ensure_slug
before insert or update of slug, business_name on public.profiles
for each row execute function public.ensure_profile_slug();

-- Backfill slugs for existing rows by forcing an update to trigger slug generation
update public.profiles
set business_name = business_name
where slug is null;