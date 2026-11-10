# Roadmap

## Beauty IA — copiloto de gestão (em andamento)
- [ ] Mapear arquitetura: financeiro, planos/assinatura, super admin, isolamento multi-tenant
- [ ] Migration: controle de acesso Beauty IA por estabelecimento (enabled, limite mensal, consumo, período) + mensagens da conversa única + RPCs (super admin, consumo atômico)
- [ ] Camada de consultas determinísticas (somente leitura, tenant-scoped): faturamento, despesas, comissões, clientes inativos, serviços, profissionais
- [ ] Edge function beauty-ai-chat: autorização (plano Profissional/Empresa + liberação super admin + assinatura regular + limite), consumo backend, chamada ao Lovable AI Gateway, persistência
- [ ] Frontend: página Beauty IA (chat, sugestões, indicador de processamento, uso/limite), rota e menu
- [ ] Super Admin: aba/controle de acesso Beauty IA (ativar/desativar, limite, consumo, histórico)
- [ ] Testes de aceitação (plano não autorizado, limite, isolamento, perguntas financeiras) + build
- [ ] Publicação (pendente de autorização)

## Pendente de outras frentes
- [ ] Publicar frontend (programa de embaixadores e demais mudanças anteriores)
- [ ] Validação de pagamento real do programa de embaixadores (requer autorização)
