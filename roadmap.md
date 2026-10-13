# Roadmap

- [ ] Corrigir avisos de atraso após liberação manual válida, conferir Black Storm e preservar faturas reais sem mudar autorização ou cobrança.

- [x] Corrigir reativação, prorrogação e pagamento manual com autorização datada, operação administrativa atômica, auditoria e proteção no banco contra sincronizações concorrentes; faturas reais preservadas, funções Asaas publicadas, 25 testes aprovados e salvamento/leitura real na própria loja verificados sem alterar o vencimento existente.
- [ ] Conferir recebimento manual válido e concorrência com Asaas em conta de teste isolada: não criar pagamentos fictícios ou alterar cobranças de clientes reais; testes transacionais locais não têm permissão de execução/assunção de papel.
- [ ] Reaplicar autorizações antigas somente após confirmação do administrador: histórico conferido contém prorrogações que não valiam antes; não migrar silenciosamente nem inventar pagamentos.

- [x] Corrigir exclusão de contratos pagos próximos ao vencimento ou em liberação temporária no MRR, ARR, ARPU, ativos e planos dos dois painéis; regra compartilhada exige contrato ativo e estado canônico permitido, sem incluir teste ou pendência não paga; 13 testes passaram e compilação automática aprovada.
- [ ] Conferir visualmente os indicadores corrigidos com conta superadministradora: sessão disponível é de funcionário e redireciona de /admin para /agenda; não alterar permissões para testar.

- [x] Classificar no painel administrativo como cancelados os bloqueados ou expirados há mais de dez dias nas empresas, filtro, assinaturas e indicador; acesso e cobranças Asaas intactos; dez testes passaram e compilação automática aprovada. Registros sem data comprovada não recebem prazo inventado.

- [x] Redesenhar a página pública com comunicação verificada, demonstrações ilustrativas, perguntas, suporte real e teste de dez dias; sem alterar assinatura ou cadastro.
- [x] Validar em computador e celular: menu, módulos, perguntas, destinos de links e cadastro com os três planos; quatro testes passaram, sem erros de execução ou rolagem horizontal.
- [ ] Automatizar preços públicos sem snapshot: consulta anônima dos planos é bloqueada pelas permissões existentes; nesta tarefa visual, preservar permissões e exibir valores oficiais conferidos em 10/10/2026 com aviso explícito.

- [x] Corrigir indicadores SaaS usando faturas reais, estados efetivos e histórico de recebimentos; remover histórico reconstruído, churn e conversão sem evidência; testes de datas passaram.
- [ ] Conciliar diferença de setembro: registros disponíveis têm 19 pagamentos recebidos de R$ 1.008,10 e seis faturas vencidas de R$ 459,40; usuário informou 22/R$ 1.097,80 e oito/R$ 439,20; depende de relatório Asaas ou confirmação dos vínculos ausentes, sem inventar ajustes.

- [x] Conferir Asaas agora e adicionar dias para vencimento e data real do último pagamento ao painel de empresas e assinaturas; conferência retornou HTTP 200, 13 ciclos pagos e 11 vencidos, com quatro vínculos ausentes; 11 testes passaram e compilação automática aprovada.
- [ ] Validar visualmente as novas colunas com acesso de superadministrador: a sessão disponível é de funcionário e redireciona para Agenda; alterações das listas aguardam publicação.

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
