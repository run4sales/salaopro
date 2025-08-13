-- Gerar dados fictícios para o usuário 2d7b8c54-6980-4474-8ed5-d695729e5f9e
-- Establishment ID: e54814e5-2761-4a78-9c69-f608ca2b7905

-- Inserir profissionais
INSERT INTO public.professionals (establishment_id, name, active) VALUES
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Ana Silva', true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Bruno Costa', true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Carla Santos', true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Daniel Oliveira', true);

-- Inserir serviços
INSERT INTO public.services (establishment_id, name, description, price, duration_minutes, active) VALUES
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Corte Feminino', 'Corte e finalização para cabelos femininos', 45.00, 60, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Corte Masculino', 'Corte tradicional e moderno para homens', 25.00, 30, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Escova Progressiva', 'Tratamento alisante progressivo', 120.00, 180, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Coloração', 'Tintura e coloração completa', 80.00, 120, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Reflexo/Luzes', 'Mechas e reflexos', 95.00, 150, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Manicure', 'Cuidados e esmaltação das unhas', 20.00, 45, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Pedicure', 'Cuidados com os pés e esmaltação', 25.00, 60, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Sobrancelha', 'Design e modelagem de sobrancelhas', 15.00, 30, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Hidratação Capilar', 'Tratamento hidratante intensivo', 35.00, 90, true),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Barba Completa', 'Corte e modelagem de barba', 20.00, 45, true);

-- Relacionar serviços com profissionais
INSERT INTO public.service_professionals (establishment_id, service_id, professional_id)
SELECT 
    'e54814e5-2761-4a78-9c69-f608ca2b7905',
    s.id,
    p.id
FROM public.services s
CROSS JOIN public.professionals p
WHERE s.establishment_id = 'e54814e5-2761-4a78-9c69-f608ca2b7905'
AND p.establishment_id = 'e54814e5-2761-4a78-9c69-f608ca2b7905'
AND (
    (s.name IN ('Corte Feminino', 'Coloração', 'Reflexo/Luzes', 'Hidratação Capilar') AND p.name IN ('Ana Silva', 'Carla Santos')) OR
    (s.name IN ('Corte Masculino', 'Barba Completa') AND p.name IN ('Bruno Costa', 'Daniel Oliveira')) OR
    (s.name IN ('Escova Progressiva') AND p.name = 'Ana Silva') OR
    (s.name IN ('Manicure', 'Pedicure', 'Sobrancelha') AND p.name = 'Carla Santos')
);

-- Inserir clientes com frequência variada
INSERT INTO public.clients (establishment_id, name, phone, email, birth_date, gender, notes) VALUES
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Maria dos Santos', '(11) 99999-1001', 'maria.santos@email.com', '1985-03-15', 'F', 'Cliente VIP, sempre pontual'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'João Silva', '(11) 99999-1002', 'joao.silva@email.com', '1978-07-22', 'M', 'Prefere atendimento matinal'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Ana Carolina Oliveira', '(11) 99999-1003', 'ana.oliveira@email.com', '1992-11-08', 'F', 'Gosta de novidades em cortes'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Pedro Henrique Costa', '(11) 99999-1004', 'pedro.costa@email.com', '1988-05-30', 'M', 'Cliente desde 2020'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Fernanda Lima', '(11) 99999-1005', 'fernanda.lima@email.com', '1995-09-12', 'F', 'Faz progressiva a cada 6 meses'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Carlos Eduardo Santos', '(11) 99999-1006', 'carlos.santos@email.com', '1983-01-18', 'M', 'Sempre agenda com antecedência'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Juliana Pereira', '(11) 99999-1007', 'juliana.pereira@email.com', '1990-04-25', 'F', 'Adora colorir o cabelo'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Roberto Ferreira', '(11) 99999-1008', 'roberto.ferreira@email.com', '1975-12-03', 'M', 'Cliente esporádico'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Beatriz Almeida', '(11) 99999-1009', 'beatriz.almeida@email.com', '1987-08-17', 'F', 'Vem mensalmente'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Lucas Martins', '(11) 99999-1010', 'lucas.martins@email.com', '1993-06-14', 'M', 'Gosta de cortes modernos'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Camila Rodrigues', '(11) 99999-1011', 'camila.rodrigues@email.com', '1989-10-29', 'F', 'Cliente nova, muito simpática'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Ricardo Souza', '(11) 99999-1012', 'ricardo.souza@email.com', '1982-02-07', 'M', 'Prefere tarde/noite'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Larissa Nascimento', '(11) 99999-1013', 'larissa.nascimento@email.com', '1996-07-11', 'F', 'Influencer local'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Thiago Barbosa', '(11) 99999-1014', 'thiago.barbosa@email.com', '1991-12-26', 'M', 'Executivo, agenda apertada'),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 'Priscila Gomes', '(11) 99999-1015', 'priscila.gomes@email.com', '1984-05-03', 'F', 'Fiel ao salão há anos');

-- Inserir configurações
INSERT INTO public.settings (establishment_id, inactive_days_threshold) VALUES
('e54814e5-2761-4a78-9c69-f608ca2b7905', 30);

-- Inserir metas mensais (últimos 6 meses)
INSERT INTO public.goals (establishment_id, month, year, target_amount, current_amount) VALUES
('e54814e5-2761-4a78-9c69-f608ca2b7905', 8, 2025, 8000.00, 8750.50),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 7, 2025, 7500.00, 7230.00),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 6, 2025, 7000.00, 7580.00),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 5, 2025, 6500.00, 6890.50),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 4, 2025, 6000.00, 6120.00),
('e54814e5-2761-4a78-9c69-f608ca2b7905', 3, 2025, 5500.00, 5780.00);

-- Inserir vendas distribuídas ao longo dos últimos meses com frequência variada por cliente
WITH service_data AS (
  SELECT id, price FROM public.services WHERE establishment_id = 'e54814e5-2761-4a78-9c69-f608ca2b7905'
),
client_data AS (
  SELECT id, name FROM public.clients WHERE establishment_id = 'e54814e5-2761-4a78-9c69-f608ca2b7905'
),
sales_data AS (
  SELECT
    'e54814e5-2761-4a78-9c69-f608ca2b7905' as establishment_id,
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
  FROM client_data c
  CROSS JOIN service_data s
  WHERE 
    -- Maria dos Santos (cliente VIP) - 15 serviços
    (c.name = 'Maria dos Santos' AND random() < 0.15) OR
    -- Ana Carolina (frequente) - 12 serviços
    (c.name = 'Ana Carolina Oliveira' AND random() < 0.12) OR
    -- Fernanda (progressiva + outros) - 10 serviços
    (c.name = 'Fernanda Lima' AND random() < 0.10) OR
    -- Juliana (colore muito) - 10 serviços
    (c.name = 'Juliana Pereira' AND random() < 0.10) OR
    -- Beatriz (mensal) - 8 serviços
    (c.name = 'Beatriz Almeida' AND random() < 0.08) OR
    -- Priscila (fiel) - 8 serviços
    (c.name = 'Priscila Gomes' AND random() < 0.08) OR
    -- João Silva - 6 serviços
    (c.name = 'João Silva' AND random() < 0.06) OR
    -- Pedro - 6 serviços
    (c.name = 'Pedro Henrique Costa' AND random() < 0.06) OR
    -- Carlos - 5 serviços
    (c.name = 'Carlos Eduardo Santos' AND random() < 0.05) OR
    -- Lucas - 5 serviços
    (c.name = 'Lucas Martins' AND random() < 0.05) OR
    -- Larissa - 4 serviços
    (c.name = 'Larissa Nascimento' AND random() < 0.04) OR
    -- Thiago - 4 serviços
    (c.name = 'Thiago Barbosa' AND random() < 0.04) OR
    -- Camila - 3 serviços
    (c.name = 'Camila Rodrigues' AND random() < 0.03) OR
    -- Ricardo - 2 serviços (esporádico)
    (c.name = 'Ricardo Souza' AND random() < 0.02) OR
    -- Roberto - 2 serviços (esporádico)
    (c.name = 'Roberto Ferreira' AND random() < 0.02)
)
INSERT INTO public.sales (establishment_id, client_id, service_id, amount, sale_date, payment_method)
SELECT establishment_id, client_id, service_id, amount, sale_date::timestamp with time zone, payment_method
FROM sales_data
ORDER BY sale_date;

-- Inserir agendamentos (alguns passados e alguns futuros)
WITH service_data AS (
  SELECT id, duration_minutes FROM public.services WHERE establishment_id = 'e54814e5-2761-4a78-9c69-f608ca2b7905'
),
client_data AS (
  SELECT id FROM public.clients WHERE establishment_id = 'e54814e5-2761-4a78-9c69-f608ca2b7905'
),
professional_data AS (
  SELECT id FROM public.professionals WHERE establishment_id = 'e54814e5-2761-4a78-9c69-f608ca2b7905'
)
INSERT INTO public.appointments (establishment_id, client_id, service_id, professional_id, appointment_date, status, notes)
SELECT
  'e54814e5-2761-4a78-9c69-f608ca2b7905',
  (SELECT id FROM client_data ORDER BY random() LIMIT 1),
  s.id,
  (SELECT id FROM professional_data ORDER BY random() LIMIT 1),
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
FROM service_data s
WHERE random() < 0.3
LIMIT 50;