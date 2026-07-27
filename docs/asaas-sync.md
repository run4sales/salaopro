# Sincronização de assinaturas com o Asaas

## Identificadores

| Beauty Core | Asaas | Regra |
|---|---|---|
| `auth.users.id` (`USER_UID`) | — | Identifica o login; resolve `profiles.user_id` somente no checkout. |
| `profiles.id` (`Establishment_ID`) | `customer.externalReference` e `subscription.externalReference` | Identificador canônico da empresa no billing. |
| `subscriptions.asaas_customer_id` | `customer.id` | Associação persistida e validada contra o `externalReference`. |
| `subscriptions.asaas_subscription_id` | `subscription.id` | Associação da cobrança recorrente. |
| `subscription_payments.asaas_payment_id` | `payment.id` | Chave idempotente do histórico de cobranças. |

`USER_UID` nunca deve ser enviado como `externalReference`: uma empresa é o
`Establishment_ID`. No caso reportado, o valor canônico é
`0816144f-e23d-422d-ae55-b63528a87e16`; o usuário
`25462833-e536-404b-a4be-2a0eeda05569` serve apenas para autenticação.

## Fluxo

1. O checkout resolve o perfil pelo `USER_UID` autenticado.
2. O customer é reutilizado somente se pertencer ao `Establishment_ID`; caso
   contrário, é buscado por `externalReference` ou criado.
3. A subscription é criada com o mesmo `externalReference`; customer,
   subscription, plano e vencimento são persistidos com validação de erro.
4. O webhook grava a cobrança idempotentemente e trata tanto o nome do evento
   quanto os status `CONFIRMED`, `RECEIVED` e `RECEIVED_IN_CASH` como pagos.
5. Um pagamento encerra o trial, ativa a assinatura, limpa flags automáticas de
   carência/inadimplência e atualiza datas. Bloqueio manual de administrador não
   é removido por uma cobrança.
6. A reconciliação consulta customer, todas as páginas de subscriptions e todas
   as páginas de payments diretamente no Asaas. Divergências são corrigidas e
   registradas em `asaas_sync_logs`.
7. O Super Admin pode executar a mesma reconciliação sob demanda. Um job de
   `pg_cron` também executa a auditoria a cada hora, no minuto 17.

## Causa raiz do estado “Teste”

Antes desta correção, a transição de `trial` para `active` dependia exclusivamente
da entrega bem-sucedida do webhook. Não existia reconciliação periódica nem ação
manual. Além disso, o webhook ignorava erros de escrita, podia marcar o evento
como processado sem encontrar a assinatura e não encerrava `trial_ends_at`.
Assim, um webhook perdido ou uma associação ausente mantinha indefinidamente um
cliente pago como “Teste”.

## Operação

Configure os secrets da Edge Function:

- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `ASAAS_SYNC_SECRET`

Crie no Supabase Vault o secret `asaas_sync_secret` com o mesmo valor de
`ASAAS_SYNC_SECRET`. Para uma auditoria externa, execute:

```bash
SUPABASE_URL=https://<project>.supabase.co \
ASAAS_SYNC_SECRET=<secret> npm run audit:asaas
```

O relatório inclui estabelecimento, status local anterior, status corrigido,
status Asaas, IDs associados, plano, duração, divergência e erro. Os mesmos dados
ficam disponíveis em `asaas_sync_logs` para auditoria posterior.
