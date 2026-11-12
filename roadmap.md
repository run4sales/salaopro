# Roadmap

## Contas a Receber
- [ ] Persistência, permissões administrativas, auditoria e recebimentos parciais atômicos
- [ ] Listagem, indicadores, filtros, cadastro, edição e cancelamento
- [ ] Integração com comanda, PDV, CRM, caixa e faturamento sem duplicidade
- [ ] Testes de regras e fluxo autenticado desktop/mobile

## Sessão e continuidade de navegação
- [x] Corrigir reinicialização do contexto em eventos de renovação/foco e validar sessão restaurada
- [x] Restaurar rotas e contexto não sensível por conta/salão sem contornar permissões
- [x] Preservar agenda, ficha do cliente e seleções financeiras após recarga
- [x] 45 testes e navegador autenticado: agenda, ficha/aba, relatórios, despesas, reabertura mobile, erro de conexão com retry e limpeza no logout
- [x] Entregar resultados e limitações em docs/session-continuity.md
- [ ] Conferência em aparelho físico e com login de colaborador (requer aparelho e conta autorizada)
- [ ] Publicação desta correção (requer autorização)

## Beauty IA — copiloto de gestão (concluído nesta rodada)
- [x] Mapear arquitetura: financeiro, planos/assinatura, super admin, isolamento multi-tenant
- [x] Migration: controle de acesso por estabelecimento + conversa única + consumo atômico + RPCs
- [x] Consultas determinísticas somente leitura (faturamento, despesas, comissões, clientes, serviços, profissionais, previsão)
- [x] Edge function beauty-ai-chat (autorização, consumo, gateway de IA, persistência, estorno em falha)
- [x] Frontend: página Beauty IA + rota /beauty-ia + menu Crescimento
- [x] Super Admin: aba Beauty IA (ativar/desativar, limite, consumo, último uso)
- [x] 13 testes de aceitação em banco isolado + validação E2E no navegador (pergunta real respondida, consumo contabilizado)
- [ ] Publicação do frontend (pendente de autorização)

## Pendente de outras frentes
- [ ] Publicar frontend (programa de embaixadores e demais mudanças anteriores)
- [ ] Validação de pagamento real do programa de embaixadores (requer autorização)
