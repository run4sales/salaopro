# Integração Agendor

A integração usa o secret `AGENDOR_API_KEY` configurado no Supabase para criar empresas e negócios no Agendor.

## Novos cadastros

A função `agendor-submit-signup-lead` recebe os dados enviados no signup e cria/reutiliza a empresa no Agendor antes de criar um negócio vinculado.

## Empresas já cadastradas

Para sincronizar empresas antigas, acesse **Super Admin > Controle** e clique em **Sincronizar Agendor**. A função `agendor-sync-all-companies` valida a role `super_admin`, sincroniza apenas empresas sem `agendor_deal_id` e grava em `profiles`:

- `agendor_organization_id`
- `agendor_deal_id`
- `agendor_synced_at`
- `agendor_sync_error`

Secrets opcionais aceitos pelas funções:

- `AGENDOR_OWNER_USER`
- `AGENDOR_LEAD_ORIGIN`
- `AGENDOR_CATEGORY`
- `AGENDOR_DEAL_STAGE`
- `AGENDOR_FUNNEL`
