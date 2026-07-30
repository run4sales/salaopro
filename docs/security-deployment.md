# Checklist de implantação do hardening de segurança

Estas alterações **não fazem deploy** nem modificam secrets externos. Execute primeiro em homologação com dados sintéticos.

## Edge Functions

Configure secrets somente no gerenciador de secrets do Supabase:

- `ASAAS_WEBHOOK_TOKEN`: valor aleatório compartilhado exclusivamente com o webhook Asaas.
- `ALLOWED_ORIGINS`: origens exatas do frontend, separadas por vírgula, sem wildcard (por exemplo, `https://app.example.com,https://staging.example.com`).

Não use variáveis `VITE_*` para secrets: elas fazem parte do bundle público. O frontend prefere os valores fornecidos pelo Netlify e usa fallback versionado apenas para URL e publishable key públicas, evitando tela branca se a configuração externa faltar. Nunca inclua `service_role` nesse fallback.

## Ordem segura

1. Aplicar a migration `20260730090000_harden_asaas_webhook_idempotency.sql`.
2. Configurar `ASAAS_WEBHOOK_TOKEN` e `ALLOWED_ORIGINS` em homologação.
3. Publicar as Edge Functions alteradas em homologação.
4. Validar token ausente/incorreto/correto, origem permitida/bloqueada, payload grande, replay e retry após falha.
5. Reconciliar assinaturas de homologação com o Asaas.
6. Repetir em produção durante janela monitorada, com rollback preparado.

## Validações obrigatórias

- O mesmo evento entregue duas vezes deve produzir apenas uma alteração financeira.
- Uma tentativa que falha deve liberar a chave de idempotência para o retry.
- Payloads persistidos não devem conter cliente, documento, e-mail, telefone, endereço ou token.
- `create-staff-user` e `update-staff-user` devem rejeitar origem desconhecida, método diferente de POST, payload acima de 16 KiB, senha menor que 12 caracteres e papel diferente de `admin`/`employee`.

## Pendências externas

Ainda devem ser configurados/testados fora deste repositório: CAPTCHA e rate limits do Auth, MFA de superadmin, headers HTTP/CSP/HSTS, expurgo e retenção de logs históricos, alertas, backups/restauração e testes RLS contra o banco efetivamente publicado.
