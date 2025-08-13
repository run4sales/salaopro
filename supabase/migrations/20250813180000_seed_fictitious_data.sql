-- Gerar dados fictícios para o usuário 2d7b8c54-6980-4474-8ed5-d695729e5f9e
DO $$
DECLARE
    target_user_id UUID := '2d7b8c54-6980-4474-8ed5-d695729e5f9e';
    v_establishment_id UUID;
BEGIN
    -- Obter o establishment_id com base no user_id
    SELECT id INTO v_establishment_id
    FROM public.profiles
    WHERE user_id = target_user_id;

    -- Se não encontrar o perfil, encerra a execução para evitar erros
    IF v_establishment_id IS NULL THEN
        RAISE NOTICE 'Establishment not found for user %', target_user_id;
        RETURN;
    END IF;

    -- Limpar dados antigos para idempotência (opcional, mas recomendado)
    DELETE FROM public.sales WHERE establishment_id = v_establishment_id;
    DELETE FROM public.appointments WHERE establishment_id = v_establishment_id;
    DELETE FROM public.service_professionals WHERE establishment_id = v_establishment_id;
    DELETE FROM public.clients WHERE establishment_id = v_establishment_id;
    DELETE FROM public.services WHERE establishment_id = v_establishment_id;
    DELETE FROM public.professionals WHERE establishment_id = v_establishment_id;
    DELETE FROM public.goals WHERE establishment_id = v_establishment_id;
    DELETE FROM public.settings WHERE establishment_id = v_establishment_id;

    -- Inserir profissionais
    INSERT INTO public.professionals (establishment_id, name, active) VALUES
    (v_establishment_id, 'Ana Silva', true),
    (v_establishment_id, 'Bruno Costa', true),
    (v_establishment_id, 'Carla Santos', true),
    (v_establishment_id, 'Daniel Oliveira', true);

    -- Inserir serviços
    INSERT INTO public.services (establishment_id, name, description, price, duration_minutes, active) VALUES
    (v_establishment_id, 'Corte Feminino', 'Corte e finalização para cabelos femininos', 45.00, 60, true),
    (v_establishment_id, 'Corte Masculino', 'Corte tradicional e moderno para homens', 25.00, 30, true),
    (v_establishment_id, 'Escova Progressiva', 'Tratamento alisante progressivo', 120.00, 180, true),
    (v_establishment_id, 'Coloração', 'Tintura e coloração completa', 80.00, 120, true),
    (v_establishment_id, 'Reflexo/Luzes', 'Mechas e reflexos', 95.00, 150, true),
    (v_establishment_id, 'Manicure', 'Cuidados e esmaltação das unhas', 20.00, 45, true),
    (v_establishment_id, 'Pedicure', 'Cuidados com os pés e esmaltação', 25.00, 60, true),
    (v_establishment_id, 'Sobrancelha', 'Design e modelagem de sobrancelhas', 15.00, 30, true),
    (v_establishment_id, 'Hidratação Capilar', 'Tratamento hidratante intensivo', 35.00, 90, true),
    (v_establishment_id, 'Barba Completa', 'Corte e modelagem de barba', 20.00, 45, true);

    -- Relacionar serviços com profissionais
    INSERT INTO public.service_professionals (establishment_id, service_id, professional_id)
    SELECT
        v_establishment_id,
        s.id,
        p.id
    FROM public.services s
    CROSS JOIN public.professionals p
    WHERE s.establishment_id = v_establishment_id
    AND p.establishment_id = v_establishment_id
    AND (
        (s.name IN ('Corte Feminino', 'Coloração', 'Reflexo/Luzes', 'Hidratação Capilar') AND p.name IN ('Ana Silva', 'Carla Santos')) OR
        (s.name IN ('Corte Masculino', 'Barba Completa') AND p.name IN ('Bruno Costa', 'Daniel Oliveira')) OR
        (s.name IN ('Escova Progressiva') AND p.name = 'Ana Silva') OR
        (s.name IN ('Manicure', 'Pedicure', 'Sobrancelha') AND p.name = 'Carla Santos')
    );

    -- Inserir clientes com frequência variada
    INSERT INTO public.clients (establishment_id, name, phone, email, birth_date, gender, notes) VALUES
    (v_establishment_id, 'Maria dos Santos', '(11) 99999-1001', 'maria.santos@email.com', '1985-03-15', 'feminino', 'Cliente VIP, sempre pontual'),
    (v_establishment_id, 'João Silva', '(11) 99999-1002', 'joao.silva@email.com', '1978-07-22', 'masculino', 'Prefere atendimento matinal'),
    (v_establishment_id, 'Ana Carolina Oliveira', '(11) 99999-1003', 'ana.oliveira@email.com', '1992-11-08', 'feminino', 'Gosta de novidades em cortes'),
    (v_establishment_id, 'Pedro Henrique Costa', '(11) 99999-1004', 'pedro.costa@email.com', '1988-05-30', 'masculino', 'Cliente desde 2020'),
    (v_establishment_id, 'Fernanda Lima', '(11) 99999-1005', 'fernanda.lima@email.com', '1995-09-12', 'feminino', 'Faz progressiva a cada 6 meses'),
    (v_establishment_id, 'Carlos Eduardo Santos', '(11) 99999-1006', 'carlos.santos@email.com', '1983-01-18', 'masculino', 'Sempre agenda com antecedência'),
    (v_establishment_id, 'Juliana Pereira', '(11) 99999-1007', 'juliana.pereira@email.com', '1990-04-25', 'feminino', 'Adora colorir o cabelo'),
    (v_establishment_id, 'Roberto Ferreira', '(11) 99999-1008', 'roberto.ferreira@email.com', '1975-12-03', 'masculino', 'Cliente esporádico'),
    (v_establishment_id, 'Beatriz Almeida', '(11) 99999-1009', 'beatriz.almeida@email.com', '1987-08-17', 'feminino', 'Vem mensalmente'),
    (v_establishment_id, 'Lucas Martins', '(11) 99999-1010', 'lucas.martins@email.com', '1993-06-14', 'masculino', 'Gosta de cortes modernos'),
    (v_establishment_id, 'Camila Rodrigues', '(11) 99999-1011', 'camila.rodrigues@email.com', '1989-10-29', 'feminino', 'Cliente nova, muito simpática'),
    (v_establishment_id, 'Ricardo Souza', '(11) 99999-1012', 'ricardo.souza@email.com', '1982-02-07', 'masculino', 'Prefere tarde/noite'),
    (v_establishment_id, 'Larissa Nascimento', '(11) 99999-1013', 'larissa.nascimento@email.com', '1996-07-11', 'feminino', 'Influencer local'),
    (v_establishment_id, 'Thiago Barbosa', '(11) 99999-1014', 'thiago.barbosa@email.com', '1991-12-26', 'masculino', 'Executivo, agenda apertada'),
    (v_establishment_id, 'Priscila Gomes', '(11) 99999-1015', 'priscila.gomes@email.com', '1984-05-03', 'feminino', 'Fiel ao salão há anos');

    -- Inserir configurações
    INSERT INTO public.settings (establishment_id, inactive_days_threshold) VALUES
    (v_establishment_id, 30);

    -- Inserir metas mensais (últimos 6 meses) - NOTE: current_amount will be recalculated by trigger
    INSERT INTO public.goals (establishment_id, month, year, target_amount, current_amount) VALUES
    (v_establishment_id, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int, 8000.00, 0),
    (v_establishment_id, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::int, EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')::int, 7500.00, 0),
    (v_establishment_id, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 months')::int, EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '2 months')::int, 7000.00, 0),
    (v_establishment_id, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '3 months')::int, EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '3 months')::int, 6500.00, 0),
    (v_establishment_id, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '4 months')::int, EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '4 months')::int, 6000.00, 0),
    (v_establishment_id, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '5 months')::int, EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '5 months')::int, 5500.00, 0);

    -- Inserir vendas distribuídas ao longo dos últimos meses com frequência variada por cliente
    -- The trigger `update_client_stats_after_sale` will auto-update client stats and goals.
    WITH sales_data AS (
      SELECT
        v_establishment_id as establishment_id,
        c.id as client_id,
        s.id as service_id,
        s.price as amount,
        (CURRENT_DATE - INTERVAL '1 day' * (random() * 180)::int) as sale_date,
        CASE
          WHEN random() < 0.3 THEN 'Dinheiro'
          WHEN random() < 0.6 THEN 'Cartão de Débito'
          WHEN random() < 0.8 THEN 'Cartão de Crédito'
          ELSE 'PIX'
        END as payment_method
      FROM public.clients c
      CROSS JOIN public.services s
      WHERE c.establishment_id = v_establishment_id AND s.establishment_id = v_establishment_id
      AND (
        (c.name = 'Maria dos Santos' AND random() < 0.15) OR
        (c.name = 'Ana Carolina Oliveira' AND random() < 0.12) OR
        (c.name = 'Fernanda Lima' AND random() < 0.10) OR
        (c.name = 'Juliana Pereira' AND random() < 0.10) OR
        (c.name = 'Beatriz Almeida' AND random() < 0.08) OR
        (c.name = 'Priscila Gomes' AND random() < 0.08) OR
        (c.name = 'João Silva' AND random() < 0.06) OR
        (c.name = 'Pedro Henrique Costa' AND random() < 0.06) OR
        (c.name = 'Carlos Eduardo Santos' AND random() < 0.05) OR
        (c.name = 'Lucas Martins' AND random() < 0.05) OR
        (c.name = 'Larissa Nascimento' AND random() < 0.04) OR
        (c.name = 'Thiago Barbosa' AND random() < 0.04) OR
        (c.name = 'Camila Rodrigues' AND random() < 0.03) OR
        (c.name = 'Ricardo Souza' AND random() < 0.02) OR
        (c.name = 'Roberto Ferreira' AND random() < 0.02)
      )
    )
    INSERT INTO public.sales (establishment_id, client_id, service_id, amount, sale_date, payment_method)
    SELECT establishment_id, client_id, service_id, amount, sale_date::timestamp with time zone, payment_method
    FROM sales_data
    ORDER BY sale_date;

    -- Inserir agendamentos (alguns passados e alguns futuros)
    INSERT INTO public.appointments (establishment_id, client_id, service_id, professional_id, appointment_date, status, notes)
    SELECT
      v_establishment_id,
      (SELECT id FROM public.clients WHERE establishment_id = v_establishment_id ORDER BY random() LIMIT 1),
      (SELECT id FROM public.services WHERE establishment_id = v_establishment_id ORDER BY random() LIMIT 1),
      (SELECT id FROM public.professionals WHERE establishment_id = v_establishment_id ORDER BY random() LIMIT 1),
      (CURRENT_DATE + INTERVAL '1 day' * (random() * 30 - 15)::int + INTERVAL '1 hour' * (9 + random() * 9)::int)::timestamp with time zone,
      CASE
        WHEN random() < 0.8 THEN 'scheduled'
        WHEN random() < 0.9 THEN 'completed'
        WHEN random() < 0.95 THEN 'canceled'
        ELSE 'no_show'
      END,
      CASE
        WHEN random() < 0.3 THEN 'Cliente solicitou horário específico'
        WHEN random() < 0.4 THEN 'Primeira vez no salão'
        ELSE NULL
      END
    FROM generate_series(1, 50); -- Generate 50 appointments

END $$;
