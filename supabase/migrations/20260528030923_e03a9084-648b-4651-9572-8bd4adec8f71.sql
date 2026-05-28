CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o usuário foi criado como staff de um salão existente, NÃO criar novo salão/role de establishment.
  IF coalesce((new.raw_user_meta_data ->> 'is_staff')::boolean, false) = true THEN
    RETURN new;
  END IF;

  INSERT INTO public.profiles (
    user_id, business_name, document, owner_name, phone, email,
    cep, street, neighborhood, city, business_type
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'Meu Salão'),
    coalesce(nullif(new.raw_user_meta_data ->> 'document', ''), 'PENDENTE'),
    coalesce(new.raw_user_meta_data ->> 'owner_name', new.raw_user_meta_data ->> 'full_name', 'Proprietário'),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'cep', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'street', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'neighborhood', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'city', ''), 'PENDENTE'),
    coalesce(nullif(new.raw_user_meta_data ->> 'business_type', ''), 'Salao de beleza')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'establishment')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$function$;

-- Limpeza: remover profiles "fantasma" criados indevidamente para usuários que já são staff
DELETE FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.establishment_users eu
  WHERE eu.user_id = p.user_id
)
AND NOT EXISTS (
  SELECT 1 FROM public.appointments a WHERE a.establishment_id = p.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.clients c WHERE c.establishment_id = p.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.sales s WHERE s.establishment_id = p.id
);

-- Remover role 'establishment' de usuários que são apenas staff
DELETE FROM public.user_roles ur
WHERE ur.role = 'establishment'
  AND EXISTS (SELECT 1 FROM public.establishment_users eu WHERE eu.user_id = ur.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id);