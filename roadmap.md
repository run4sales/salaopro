# Roadmap

- [x] Alinhar pagamento confirmado, faturas pendentes, barras amarela/laranja/vermelha, bloqueio no terceiro dia e teste gratuito de dez dias; 13 testes passaram e limites de acesso foram verificados no banco; funções publicadas e reconciliação real encontrou 13 ciclos pagos e 11 vencidos.
- [ ] Confirmar visualmente as barras após publicação: a prévia autenticada permaneceu em “Carregando permissões”; alterações de interface dependem de publicação.

- [x] Corrigir conexão Asaas e controle de faturas; conferência real de 28 vínculos, 24 sincronizados, notificações verificadas, job horário ativo, reenvios recuperáveis e testes aprovados; nenhuma cobrança criada.
- [ ] Resolver quatro vínculos cuja assinatura não é encontrada no Asaas: requer confirmar com o responsável quais foram canceladas/excluídas e qual assinatura válida deve substituir cada vínculo; não recriar cobranças automaticamente.

- [x] Confirmar dez pares duplicados; proteger inserções no banco, recuperar salvamento por ID estável, impedir reset durante atualização da agenda e proteger importações contra cliques simultâneos; doze testes e verificações reais com rollback passaram, compilação aprovada.

- [x] Corrigir acesso sem pagamento no checkout e na reconciliação; regra canônica aplicada e funções Asaas publicadas.
- [x] Corrigir busca de clientes e filtros administrativos; sete testes passaram e compilação aprovada.
- [ ] Ativar busca corrigida do assistente e filtros no site publicado: depende da próxima publicação; plataforma reteve a função MCP até essa etapa.

- [x] Corrigir bloqueio próprio do funcionário; verificar autorização real, negar outro profissional/loja/anônimo e preservar gestores; nove testes passaram.

- [x] Padronizar e validar telefones brasileiros em todos os cadastros.
- [x] Garantir normalização no banco, buscas e prevenção de duplicidades.
- [x] Cobrir formatos válidos e inválidos com testes.
- [x] Investigar duplicação e impedir envios simultâneos e novas inserções após falhas parciais, preservando registros históricos.
- [x] Validar regressões de cancelamento e gravação: oito testes passaram; agenda abriu sem erros e compilação aprovada.
