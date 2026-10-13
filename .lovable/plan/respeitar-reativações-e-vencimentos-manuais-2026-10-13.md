# Respeitar reativações e vencimentos manuais

## Problema confirmado
O painel salva o novo status e vencimento, mas o controle de acesso continua priorizando uma fatura antiga vencida no Asaas. Nos registros conferidos, há alterações para ativo com vencimento em 31/03/2027 que continuam bloqueadas pela fatura de 15/08/2026. A sincronização também pode substituir o status e o vencimento editados.

## Correção proposta
- Separar o vencimento autorizado pelo administrador do vencimento das faturas Asaas, mantendo os dois registros verdadeiros.
- Fazer reativação e renovação manual valerem até a data informada, com os mesmos avisos e bloqueio no terceiro dia de atraso. Exigir uma data explícita, sem liberação ilimitada.
- Ao marcar pago manualmente, registrar valor e data efetiva do pagamento nas informações financeiras oficiais; prorrogar acesso sem pagamento não gera receita.
- Preservar a autorização manual durante notificações e conferências automáticas do Asaas, inclusive quando uma conferência estiver em andamento no momento da edição.
- Continuar exibindo faturas Asaas pendentes: uma liberação local não significa que a cobrança foi quitada no Asaas. Não alterar cobranças remotas automaticamente.
- Disponibilizar retorno explícito ao controle automático e respeitar imediatamente um novo bloqueio ou cancelamento administrativo.
- Atualizar empresas, assinatura, avisos e indicadores após salvar, deixando claro qual vencimento governa o acesso.
- Conferir as alterações antigas no histórico, sem reaplicar automaticamente pagamentos ou autorizações passadas.

## Detalhes técnicos
- Operação única autorizada exclusivamente para superadministradores no banco, com validação, trava da assinatura e auditoria na mesma transação.
- Campos próprios para autorização manual; a regra canônica de acesso considera essa autorização sem sobrescrever snapshots do provedor.
- Proteção no banco para impedir que escritas concorrentes ou reconciliações substituam a decisão administrativa. Aplicar o mesmo comportamento aos caminhos de reativação, edição de cobrança e renovação associados à alteração de plano.
- Pagamentos manuais identificados como locais em `subscription_payments`, sem fabricar identificadores ou confirmação do Asaas; proteger repetição de envio.

## Validação
- Testar fatura antiga vencida com nova autorização, vencimento e terceiro dia de atraso, pagamento manual, teste sem pagamento, bloqueio administrativo e retorno ao automático.
- Testar concorrência e sincronização sem perder a autorização nem duplicar recebimentos.
- Conferir salvamento e leitura nos painéis e acesso da loja com uma conta autorizada; não mudar permissões para testar.