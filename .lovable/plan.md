# Cores individuais por profissional na agenda

## Objetivo
Cada profissional terá uma cor persistente e configurável. A Agenda Principal usará essa cor em dia, semana, mês e lista, mantendo status, cancelamentos, filtros e histórico legíveis.

## Implementação

### 1. Persistência e atribuição automática
- Adicionar `calendar_color` à tabela de profissionais, com validação para aceitar apenas as cores aprovadas.
- Preencher os profissionais existentes com cores distribuídas por salão.
- Criar atribuição automática no banco para novos profissionais sem cor, priorizando uma cor ainda não usada por profissionais ativos do mesmo salão.
- Manter a coluna no próprio profissional, sem duplicar a cor nos agendamentos.
- Preservar o isolamento atual por salão e as permissões administrativas já aplicadas aos profissionais.

### 2. Seletor no cadastro e edição
- Criar uma paleta central com dez cores de contraste adequado: azul, verde, roxo, laranja, rosa, vermelho, amarelo, turquesa, azul-escuro e verde-escuro.
- Adicionar “Cor na agenda” no cadastro de profissional e no cadastro de funcionário com acesso.
- Adicionar a mesma opção na edição do profissional e na edição do usuário vinculado.
- Mostrar a cor atual ao lado de cada profissional na lista.
- Enviar a cor escolhida pelas funções seguras de criação/edição de usuários, mantendo a validação de administrador e de salão.

### 3. Regra visual centralizada
- Criar uma única função de estilo que derive fundo suave, borda forte e texto com contraste a partir da cor persistida.
- Usar a cor do profissional principal do agendamento; ao trocar o profissional, a agenda muda automaticamente sem alterar o registro do agendamento.
- Manter bloqueios com a aparência neutra atual.
- Manter cancelados identificáveis com texto riscado e indicação de cancelamento, sem remover a identidade de cor do profissional.

### 4. Agenda Principal e histórico
- Carregar nome e cor de profissionais ativos e inativos para compor agendamentos históricos.
- Continuar exibindo apenas profissionais ativos nos seletores de novos agendamentos e filtros.
- Aplicar a mesma regra nas visualizações dia, semana, mês, agenda interna da biblioteca e lista própria.
- Exibir o nome do profissional dentro do evento e um indicador colorido na lista.
- Preservar filtros por profissional, múltiplos profissionais e edição/cancelamento existentes.

### 5. Validação
- Testar atribuição automática, escolha e edição de cor.
- Testar criação, edição de profissional, cancelamento, filtros e vários profissionais simultâneos.
- Confirmar persistência após recarregar e em períodos passados/futuros.
- Verificar desktop e mobile, além de criação/edição normal de agendamentos.
- Conferir que funcionários não administrativos não conseguem alterar cores de outros profissionais.

## Detalhes técnicos
- Fonte da verdade: `professionals.calendar_color`.
- Relação atual preservada: `appointments.professional_id` é o profissional principal; `appointment_professionals` mantém vínculos adicionais.
- A agenda usada pela rota principal é `StableAgendaContent`, compartilhando a renderização com `AgendaCalendar`.
- Não será gravada uma cópia da cor em cada agendamento; profissionais inativos continuarão consultáveis para manter o histórico consistente.
