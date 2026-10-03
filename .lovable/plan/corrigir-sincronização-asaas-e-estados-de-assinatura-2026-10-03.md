# Corrigir sincronização Asaas e estados de assinatura

## Objetivo
Fazer webhook, auditoria periódica, bloqueios administrativos e telas exibirem o mesmo estado real da assinatura, sem reativar inadimplentes nem bloquear clientes em carência válida.

## Implementação
1. **Webhook confiável**
   - Deduplicar cada entrega usando o identificador do evento ou impressão segura do corpo.
   - Registrar a data real do pagamento, não a hora de processamento.
   - Preservar bloqueio manual ao receber pagamento, mantendo o histórico financeiro atualizado.

2. **Reconciliação correta**
   - Usar a cobrança cronologicamente mais recente para definir o estado atual.
   - Não deixar um pagamento antigo esconder uma cobrança atual vencida ou cancelada.
   - Preservar bloqueios manuais e registrar essa decisão na trilha de auditoria.

3. **Carência e bloqueio**
   - Corrigir o estado `past_due` para respeitar a liberação temporária de 48 horas.
   - Fazer o bloqueio pelo diálogo administrativo gravar e limpar os marcadores manuais corretamente.

4. **Estado único nas telas administrativas**
   - Alinhar a regra exibida no painel com a regra oficial do banco, incluindo trial, pendência, carência e bloqueio manual.
   - Remover o cálculo divergente de sete dias usado apenas na interface.

5. **Evitar assinatura duplicada**
   - Antes de cancelar e recriar uma assinatura, reutilizar uma cobrança pendente compatível quando ela existir.
   - Manter a recriação somente quando realmente houver troca necessária.

6. **Validação e entrega**
   - Adicionar testes de regressão para evento repetido, cobrança antiga paga + atual vencida, bloqueio manual e carência.
   - Aplicar a alteração de banco, publicar as funções afetadas e conferir logs, testes e estado do app.
   - Não disparar cobrança real nem alterar manualmente o estado financeiro de clientes durante a validação.

## Nota operacional
A auditoria não encontrou logs recentes das funções do Asaas. Também será verificado se o agendamento horário e seu segredo estão ativos; caso faltem, isso será reportado como bloqueio operacional sem expor credenciais.
