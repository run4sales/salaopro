# Correção de agendamentos cancelados

## Resultado
- Cancelar altera o status para `canceled`, preserva o registro e o remove imediatamente das agendas do salão e do profissional.
- Horários cancelados deixam de gerar conflito e voltam à disponibilidade pública e interna.
- Indicadores operacionais e financeiros ignoram cancelamentos.
- Relatórios passam a ter uma visão própria de cancelamentos, isolada por salão.

## Implementação
1. Centralizar a regra de cancelamento/visibilidade para reconhecer os estados legados `canceled` e `cancelled` sem apagar registros.
2. Aplicar essa regra em todas as consultas ativas da agenda, atendimentos, disponibilidade, conflitos e integrações de listagem.
3. Revisar previsões e métricas para excluir cancelados antes de contar horários, atendimentos, clientes ou valores.
4. Criar a aba “Cancelamentos” em Relatórios com período global e filtros por cliente, profissional e serviço; exibir data do agendamento, cliente, profissional, serviço, valor original salvo no agendamento, status, total de cancelamentos e valor total.
5. Manter o isolamento existente por estabelecimento e não criar tabela paralela de histórico.
6. Adicionar testes das regras de visibilidade, disponibilidade, métricas e cálculo do relatório.

## Detalhes técnicos
- O estado canônico existente é `canceled`; `cancelled` será aceito apenas por compatibilidade histórica.
- O valor virá do snapshot financeiro do agendamento (`service_amount` e, para múltiplos serviços, seus snapshots), nunca do preço atual do catálogo.
- A agenda ativa usada no produto já filtra cancelados; a correção será estendida aos caminhos auxiliares e ao relatório.
- Não será feito `DELETE` de agendamento.
