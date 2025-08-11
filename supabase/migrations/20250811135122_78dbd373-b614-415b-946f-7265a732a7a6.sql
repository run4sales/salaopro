-- Harden function search_path for new functions added earlier
create or replace function public.slugify(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(regexp_replace(lower(unaccent(coalesce($1, ''))), '[^a-z0-9]+' , '-', 'g'), '-+', '-', 'g'))
$$;

create or replace function public.ensure_profile_slug()
returns trigger
language plpgsql
security definer
set search_path = public
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