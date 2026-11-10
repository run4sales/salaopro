# Roadmap

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
