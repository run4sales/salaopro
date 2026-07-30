# Auditoria de Segurança — SalaoPro

**Data:** 30/07/2026  
**Escopo:** somente análise estática e comandos locais seguros no repositório.  
**Branch:** `security/hardening-audit`  
**Conclusão:** risco geral **alto antes das correções** e **médio após as correções locais**. Esta avaliação não significa que o sistema esteja “100% seguro”.

## 1. Resumo executivo

Foram identificados **12 achados**: **1 crítico, 2 altos, 5 médios, 2 baixos e 2 informativos**. O achado crítico, os dois altos e um baixo foram corrigidos no código; dois médios e um baixo receberam mitigação parcial. Os demais dependem de produto, plataforma ou validação dinâmica.

O caminho de maior impacto era o webhook Asaas público operar em modo *fail-open*: se `ASAAS_WEBHOOK_TOKEN` não estivesse configurado, qualquer origem poderia enviar um evento com identificadores conhecidos e alterar pagamento, assinatura, plano e bloqueio de um estabelecimento usando `service_role`. O segundo caminho era o navegador disparar até três escritas no Agendor durante um cadastro, incluindo uma função explicitamente sem JWT, permitindo spam, custo externo e inserção de PII não confiável.

Dados potencialmente afetados: nomes, telefones, e-mails, documentos, endereços, agenda, observações, histórico de serviços, vendas, pagamentos, assinaturas, despesas e dados operacionais de estabelecimentos. As medidas urgentes são implantar as correções, configurar/rotacionar o token Asaas, cadastrar o mesmo token no provedor, revisar logs recebidos antes da correção e decidir um fluxo confiável de CRM no servidor.

### Contagem e estado

| Severidade | Total | Corrigido | Aberto/parcial |
|---|---:|---:|---:|
| Crítica | 1 | 1 | 0 |
| Alta | 2 | 2 | 0 |
| Média | 5 | 0 | 5 |
| Baixa | 2 | 1 | 1 |
| Informativa | 2 | 0 | 2 |

### Limitações

Não houve acesso ao Supabase hospedado, banco de produção, Asaas, Agendor, Lovable, DNS, TLS, IAM, secrets, backups, logs/alertas ou configurações de deploy. Não foram enviados webhooks externos, não houve carga/DoS, não foram usados dados reais e não houve deploy. Assim, RLS e migrations foram revisadas estaticamente, mas não executadas contra uma instância limpa ou o schema efetivamente publicado. O `npm audit` foi tentado, mas o endpoint retornou HTTP 403; não é possível concluir ausência de CVEs.

## 2. Arquitetura e modelo de ameaças

### Componentes e fluxos

- SPA React/TypeScript/Vite, com React Router, TanStack Query, shadcn/Radix e Tailwind.
- Supabase Auth mantém sessão no `localStorage`; PostgREST/RPC e RLS implementam acesso aos dados.
- PostgreSQL multi-tenant: `profiles.id` representa o estabelecimento; `establishment_users` liga funcionários e papéis `owner/admin/employee`; `user_roles` contém `super_admin`.
- Edge Functions Deno usam JWT do usuário ou `service_role` para criação de funcionários, administração, sincronização, cobrança e webhooks.
- Asaas controla assinatura/cobrança; Agendor recebe leads e empresas; MCP expõe leitura de agenda, clientes e serviços sob token Supabase.
- Agendamento público usa RPCs `SECURITY DEFINER` para catálogo, disponibilidade e criação de cliente/agendamento.
- Não foram encontrados Docker, Kubernetes, Terraform ou workflows CI/CD rastreados.

### Ativos, perfis e dados críticos

- **Ativos:** sessão/JWT, service role, token de webhook, chave Asaas, chave Agendor, papéis administrativos, vínculo tenant, assinaturas, vendas e agenda.
- **Perfis:** anônimo, cliente de agendamento, funcionário, administrador do estabelecimento, proprietário, superadmin, scheduler e terceiros Asaas/Agendor.
- **PII:** nome, e-mail, telefone, documento, endereço, data de nascimento e observações. Dados financeiros incluem valores, faturas, forma de pagamento, despesas, comissões e status de assinatura.
- **Operações críticas:** criação/alteração de usuário, mudança de papel/senha/e-mail, acesso cross-tenant, baixa/exclusão financeira, mudança de plano, desbloqueio e processamento de evento de pagamento.

### Pontos de entrada e limites de confiança

1. Browser não confiável → Auth/PostgREST/RPC/Edge Functions.
2. Usuário autenticado → RLS, funções `SECURITY DEFINER` e checagens de papel.
3. Edge Function privilegiada → banco via `service_role`.
4. Asaas → webhook sem JWT, cuja confiança depende do token compartilhado.
5. Signup público → Auth e CRM externo.
6. MCP/OAuth → token emitido pelo Supabase e consultas sujeitas a RLS.
7. Arquivos XLSX/CSV → parser no browser e posterior escrita no banco.

### Cenários prioritários

- Forjar evento financeiro; atravessar tenant alterando UUID; chamar função administrativa com JWT comum; abusar de cadastro/agendamento/importação; explorar XSS para roubar sessão persistente; reenviar eventos; inserir campos excessivos em JSONB/RPC; vazar PII por logs/exportações; comprometer dependência/build.

## 3. Achados

### SEC-001 — Webhook financeiro aceitava eventos sem segredo configurado

- **Severidade/status/confiança:** crítica; confirmado e corrigido; alta.
- **Categoria:** CWE-306, CWE-345; OWASP API2/API5.
- **Local/componente:** `supabase/functions/asaas-webhook/index.ts`, autenticação e atualização de assinatura.
- **Descrição/evidência:** a condição anterior era `if (expected && received !== expected)`. Portanto, ausência do secret desabilitava autenticação. A função usa `service_role`, procura assinatura por IDs fornecidos e atualiza pagamentos, plano e estado.
- **Pré-requisito/cenário:** endpoint conhecido e um identificador de assinatura/cliente obtido por vazamento, log ou enumeração indireta; envio de payload sem token quando o secret não estivesse configurado.
- **Impacto técnico/negócio/dados:** alteração não autorizada de estado financeiro, ativação/cancelamento indevido, fraude, indisponibilidade e quebra de integridade de assinaturas/pagamentos.
- **Probabilidade:** média/alta, condicionada à configuração externa que não pôde ser verificada.
- **Correção aplicada:** falha fechada com 503 se o secret faltar; comparação por digest; somente POST; limite de 256 KiB; allowlist de eventos; campos mínimos; erro genérico ao cliente.
- **Validação:** `npm run test:security`; teste local confirma ausência do padrão fail-open e presença dos controles. Antes de produção, testar eventos válidos/inválidos em homologação com dados sintéticos.
- **Risco residual:** Asaas usa token compartilhado, sem timestamp assinado; replay continua possível. O upsert reduz duplicação de pagamento, mas a ordem de eventos ainda pode regredir o status. Rotacionar/configurar `ASAAS_WEBHOOK_TOKEN`, reconciliar com a API Asaas e adicionar chave única de evento/estado monotônico.

### SEC-002 — Cadastro disparava escritas CRM públicas e duplicadas

- **Severidade/status/confiança:** alta; confirmado e corrigido; alta.
- **Categoria:** CWE-306, CWE-400; OWASP API4/API5.
- **Local/componente:** antigo fluxo em `src/hooks/useAuth.tsx`, `src/pages/Auth.tsx`, `src/integrations/supabase/client.ts`; `supabase/config.toml`.
- **Descrição/evidência:** um cadastro podia chamar três funções Agendor. `agendor-create-signup-lead` tinha `verify_jwt=false` e aceitava nome/e-mail fornecidos pelo chamador antes de escrever via chave Agendor. Não havia rate limit, CAPTCHA ou vínculo verificável entre payload e conta.
- **Pré-requisito/cenário:** acesso anônimo ao endpoint ou automação do signup para gerar empresas/deals e PII arbitrária no CRM.
- **Impacto:** spam/custo/cota externa, corrupção do CRM, incidente de privacidade e trabalho operacional.
- **Probabilidade:** alta.
- **Correção aplicada:** removidas as invocações CRM do browser e exigido JWT no endpoint legado. Isso altera o fluxo: novos leads não serão enviados automaticamente até existir um mecanismo confiável no servidor.
- **Validação:** teste garante que os três pontos de signup não invocam endpoints CRM e que a função legada exige JWT.
- **Risco residual:** outras funções Agendor devem permanecer restritas; implementar fila/outbox acionada após usuário confirmado, com idempotency key, retry limitado e rate limit. Não reabilitar chamada anônima.

### SEC-003 — Ausência de proteção de abuso em autenticação e agendamento público

- **Severidade/status/confiança:** média; melhoria preventiva aberta; média.
- **Categoria:** CWE-307, CWE-799; OWASP API4.
- **Local/componente:** `src/hooks/useAuth.tsx`; RPC `create_public_booking` nas migrations.
- **Descrição/evidência:** não há controle versionado de CAPTCHA, limites por IP/conta/tenant ou cooldown para login, recuperação, cadastro e agendamento. Controles eventualmente existentes no painel Supabase não puderam ser vistos.
- **Cenário/impacto:** força bruta, enumeração por diferenças de erro, spam de agenda/clientes, envio de e-mail e custo de banco.
- **Dados/probabilidade:** contas e agenda; média.
- **Recomendação/correção proposta:** habilitar proteção Supabase Auth, CAPTCHA no signup/reset, gateway rate limit e quota transacional por estabelecimento/telefone/janela. Respostas uniformes no reset.
- **Teste:** em homologação sintética, confirmar 429/cooldown sem carga destrutiva.
- **Risco residual:** IP compartilhado e evasão distribuída exigem limites combinados.

### SEC-004 — Sessão persistente acessível a JavaScript

- **Severidade/status/confiança:** média; confirmado, aberto por decisão arquitetural; alta.
- **Categoria:** CWE-922; OWASP A07.
- **Local/componente:** `src/integrations/supabase/client.ts` (`storage: localStorage`, `persistSession: true`).
- **Descrição:** qualquer XSS na origem pode ler tokens persistidos. Não foi confirmado XSS explorável; React escapa conteúdo e o `dangerouslySetInnerHTML` encontrado gera CSS interno de gráfico.
- **Impacto:** sequestro de sessão e acesso dentro do escopo da vítima; superadmin teria impacto máximo.
- **Probabilidade:** baixa/média, dependente de XSS ou extensão maliciosa.
- **Recomendação:** avaliar BFF com cookie `HttpOnly; Secure; SameSite`, CSP estrita e sessões curtas/rotativas; exigir MFA/reautenticação para superadmin e mudanças de credencial.
- **Teste:** teste E2E de flags do cookie na arquitetura futura e CSP contra script injetado.
- **Risco residual:** cookies reduzem roubo de token, mas exigem CSRF correto.

### SEC-005 — Headers HTTP de segurança não estão representados

- **Severidade/status/confiança:** média; provável, aberto; média.
- **Categoria:** CWE-693; OWASP A05.
- **Local/componente:** `public/_redirects`, `index.html`, plataforma Lovable.
- **Descrição:** não há configuração versionada de CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors` e cache de respostas sensíveis.
- **Impacto:** maior impacto de XSS/clickjacking, vazamento por referrer e configuração inconsistente.
- **Probabilidade:** desconhecida porque a plataforma pode injetar headers.
- **Recomendação:** medir em homologação e configurar na camada de hospedagem, iniciando CSP em report-only sem `unsafe-eval`; `frame-ancestors 'none'`, HSTS após confirmar HTTPS total e `no-store` para dados privados.
- **Teste:** `curl -I` somente contra homologação autorizada.
- **Risco residual:** CSP precisa contemplar Supabase e integrações estritamente necessárias.

### SEC-006 — Payload completo de webhook e erros/PII em logs

- **Severidade/status/confiança:** média; confirmado, parcialmente corrigido; alta.
- **Categoria:** CWE-532; LGPD, minimização.
- **Local/componente:** `asaas_webhook_logs.payload`, `subscription_payments.raw`, consoles em `src/pages/Clients.tsx` e logs de sync.
- **Descrição:** antes da correção, payload financeiro bruto era persistido e dados de cliente eram impressos no console do browser. Retenção, migração dos registros históricos, criptografia e acesso operacional ainda não estão definidos no repositório.
- **Impacto:** exposição secundária de PII/financeiro e aumento de escopo de incidente.
- **Probabilidade:** média.
- **Correção aplicada:** o webhook e `subscription_payments.raw` passaram a persistir somente campos financeiros em allowlist, e os `console.log` de clientes/configurações foram removidos. **Pendente:** migrar/expurgar payloads históricos, definir retenção e revisar os demais logs de sincronização.
- **Recomendação:** definir retenção e acesso, migrar dados históricos, registrar apenas IDs/códigos/correlation ID e concluir a revisão dos demais componentes.
- **Teste:** testes verificando ausência de e-mail, telefone, documento, token e payload bruto nos logs.
- **Risco residual:** dados indispensáveis precisam de retenção e base/finalidade avaliadas juridicamente.

### SEC-007 — Funções públicas não possuem proteção forte contra replay/ordem

- **Severidade/status/confiança:** média; confirmado, parcialmente mitigado; alta.
- **Categoria:** CWE-294, CWE-367.
- **Local/componente:** webhook Asaas e sincronizações assíncronas.
- **Descrição:** a correção adicionou chave única de evento (ID Asaas ou SHA-256 determinístico do corpo) e inserção concorrente `ignoreDuplicates`, impedindo o reprocessamento do mesmo evento. Ainda não há timestamp assinado nem máquina de estados que impeça um evento diferente, porém antigo, de sobrescrever estado novo.
- **Impacto:** regressão de assinatura/plano e inconsistência financeira.
- **Probabilidade:** média após comprometimento/captura do token ou retry legítimo fora de ordem.
- **Correção aplicada:** migration cria índice único parcial em `provider_event_id`; retries byte-idênticos retornam sucesso sem novo processamento e sem armazenar o corpo integral.
- **Recomendação:** comparar timestamps/versões, tornar a máquina de estados monotônica e reconciliar periodicamente com Asaas.
- **Teste:** enviar localmente o mesmo evento sintético duas vezes e eventos fora de ordem; estado e auditoria devem permanecer determinísticos.
- **Risco residual:** provedor pode não fornecer todos os metadados; reconciliação é necessária.

### SEC-008 — Política de senha de funcionário e alteração sensível sem reautenticação

- **Severidade/status/confiança:** baixa; confirmado, parcialmente corrigido; alta.
- **Categoria:** CWE-521, CWE-620.
- **Local/componente:** `create-staff-user` e `update-staff-user`.
- **Descrição:** o mínimo local foi elevado de seis para doze caracteres e os papéis passaram a aceitar estritamente `admin` ou `employee`. Owner/admin ainda pode definir diretamente senha/e-mail do subordinado sem convite, confirmação do e-mail, MFA ou reautenticação recente.
- **Impacto:** conta fraca e tomada de conta se a sessão administrativa for roubada.
- **Probabilidade:** média.
- **Recomendação:** convite com token curto e uso único, política central do Auth, confirmação de e-mail, MFA/reautenticação e revogação de sessões após mudanças.
- **Teste:** senha fraca rejeitada e sessão anterior revogada após troca.
- **Risco residual:** política de tamanho não substitui bloqueio de credenciais vazadas e MFA.

### SEC-009 — CORS curinga em funções privilegiadas

- **Severidade/status/confiança:** baixa; confirmado e corrigido no código; alta.
- **Categoria:** CWE-942.
- **Local/componente:** headers de Edge Functions, inclusive criação/alteração de funcionário.
- **Descrição:** as funções privilegiadas usavam `Access-Control-Allow-Origin: *`. Agora usam allowlist exata via `ALLOWED_ORIGINS`, `Vary: Origin`, somente `POST/OPTIONS`, e rejeitam origens de browser não configuradas.
- **Impacto:** amplia superfícies de phishing/exfiltração caso token seja fornecido a uma origem maliciosa.
- **Probabilidade:** baixa.
- **Ação operacional obrigatória:** configurar `ALLOWED_ORIGINS` nas Edge Functions com as origens exatas de cada ambiente antes do deploy; manter autenticação independente de CORS.
- **Teste:** origens não permitidas não recebem ACAO.
- **Risco residual:** clientes não-browser ignoram CORS.

### SEC-010 — Configuração pública de build sem garantia no deploy

- **Severidade/status/confiança:** alta; regressão de disponibilidade confirmada e corrigida; alta.
- **Categoria:** CWE-200.
- **Local/componente:** `.env`, histórico Git e `.gitignore`.
- **Descrição:** a remoção do `.env` ocorreu sem comprovar que o Netlify fornecia as três variáveis `VITE_SUPABASE_*`. O build foi publicado sem configuração do Supabase e a SPA falhou antes de renderizar. Os valores restaurados são URL, project ID e chave **publicável**, destinados ao bundle; nenhum `service_role` foi incluído.
- **Impacto:** indisponibilidade total do frontend (tela branca).
- **Correção:** o cliente agora prefere as variáveis do ambiente, mas possui fallback versionado somente para URL e publishable key públicas. O frontend deixa de falhar antes da renderização quando o Netlify não injeta `VITE_*`.
- **Operação:** manter os valores do Netlify sincronizados; o fallback existe exclusivamente para disponibilidade e nunca deve receber `service_role` ou outro segredo.
- **Teste:** regressão isolada executa o build sem `.env` e confirma a presença do fallback público.
- **Risco residual:** nunca adicionar secrets privilegiados a variáveis `VITE_*`, pois elas são públicas no bundle.

### SEC-011 — `SECURITY DEFINER` legado sem `search_path` explícito

- **Severidade/status/confiança:** informativa; provável, aberto; média.
- **Categoria:** CWE-426.
- **Local/componente:** definição histórica de `public.has_role`.
- **Descrição:** uma definição inicial não fixa `search_path`; várias migrations posteriores o fazem corretamente. Não foi possível reconstruir o schema final para confirmar qual definição está ativa.
- **Impacto/probabilidade:** resolução indevida de objetos se atacante puder criar objetos em schema pesquisado; baixa no modelo Supabase usual.
- **Recomendação:** migration final idempotente que redefine toda função definer com `SET search_path = pg_catalog, public`, qualifica objetos, revoga `PUBLIC` e concede somente papéis necessários.
- **Teste:** aplicar migrations do zero e consultar `pg_proc.proconfig`/ACL.
- **Risco residual:** extensions e ownership precisam ser revisados no banco real.

### SEC-012 — Lacunas de CI/CD, inventário, retenção e resposta a incidentes

- **Severidade/status/confiança:** informativa; melhoria preventiva aberta; alta.
- **Categoria:** OWASP A09/A06; LGPD.
- **Local/componente:** repositório como um todo.
- **Descrição:** não há workflows visíveis para testes, SAST, secret scanning, audit de lockfile, migrations/RLS, SBOM ou pinning de actions; nem política técnica de retenção, exportação/exclusão, backup/restauração, auditoria administrativa e resposta a incidente.
- **Impacto:** vulnerabilidades/regressões chegam ao deploy, detecção lenta e atendimento LGPD incompleto.
- **Recomendação:** pipeline mínimo com lockfile, lint/build/testes, scanner de secrets, SAST, audit/SBOM, banco efêmero para RLS e revisão de migrations. Definir runbooks, alertas e retenção; registrar negações, mudanças de papel, exportações e ações admin sem PII excessiva.
- **Teste:** PR inseguro sintético deve falhar no CI; exercício de restauração e tabletop de incidente.
- **Risco residual:** controles externos podem existir, mas devem ser evidenciados e testados.

## 4. Cobertura por área

- **Autenticação:** signup/login/logout/reset/update de senha e persistência; configuração externa de confirmação, MFA, rate limit e revogação não validada.
- **Autorização/tenancy:** rotas, papéis, Edge Functions, RLS e RPCs revisados estaticamente. Policies principais usam `auth.uid()`, proprietário/vínculo e `WITH CHECK`; não foi confirmado BOLA cross-tenant no código final. Proteção visual não foi considerada suficiente.
- **Banco:** schemas, FKs/cascades, RLS, grants, funções/trigger e JSONB; sem instância local não houve teste transacional de policies.
- **API/entrada:** métodos, autenticação, JSON, IDs, limites, erros, SSRF/command/SQL injection. As queries usam cliente Supabase/SQL estático; não foi encontrada concatenação SQL/command execution confirmada.
- **Frontend:** XSS sinks, redirects, links, storage, logs e variáveis Vite. Sem segredo privilegiado no bundle identificado.
- **Uploads:** importações XLSX/CSV no browser; limites e proteção contra arquivo complexo/zip bomb não foram dinamicamente validados. Não foi encontrado bucket/storage upload versionado.
- **Integrações:** Asaas, Agendor e MCP; webhook e CRM foram prioritários.
- **Infra/HTTP:** somente Lovable/Vite/Supabase representados; cloud/IAM/TLS/headers externos permanecem lacuna.
- **Privacidade:** inventário técnico de PII, logs, exportações e exclusões; avaliação jurídica e fluxos de titulares não foram confirmados.
- **Supply chain:** manifests e dois lockfiles revisados; pacotes vêm de npm/esm.sh. Auditoria CVE bloqueada por 403. Manter um único gerenciador/lockfile reduz divergência.

## 5. Priorização

### Próximas 24 horas

1. Publicar em homologação, testar e então implantar SEC-001/SEC-002 sem deploy automático desta auditoria.
2. Configurar e rotacionar `ASAAS_WEBHOOK_TOKEN` em Supabase e Asaas; verificar que ausência causa 503.
3. Revisar `asaas_webhook_logs` desde a exposição e reconciliar assinaturas/pagamentos com Asaas sem confiar apenas no log local.
4. Confirmar que nenhuma função Agendor de signup está publicada com `verify_jwt=false`.

### Próximos 7 dias

1. Concluir ordenação monotônica do webhook; rate limit/CAPTCHA em auth, booking e integrações.
2. Migrar/expurgar logs históricos com PII, revisar logs remanescentes e estabelecer retenção.
3. Testes reais de RLS em banco efêmero para dois tenants, employee/admin/superadmin/anon.
4. Confirmar headers, CORS e cache em homologação; rever sessão de superadmin e MFA.

### Próximos 30 dias

1. Implementar outbox/fila autenticada e idempotente para Agendor.
2. CI com testes, lint, build, SAST, secret scanning, audit/SBOM e migrations do zero.
3. Padronizar `SECURITY DEFINER`, grants e `search_path`; inventariar buckets e policies externas.
4. Programa LGPD técnico: minimização, retenção, exportação/exclusão e terceiros.

### Contínuo

Threat modeling por mudança, rotação de secrets, patching dirigido por CVE, revisão trimestral de acessos, restauração testada, alertas e exercícios de incidente.

## 6. Comandos executados

| Comando | Objetivo | Resultado/limitação | Arquivos alterados |
|---|---|---|---|
| `find .. -name AGENTS.md -print` e `find / -maxdepth 2 -name AGENTS.md` | instruções aplicáveis | nenhum AGENTS no escopo do código | nenhum |
| `rg --files ...`, `find src -maxdepth 2 -type f` | inventário | frontend, functions, migrations e docs mapeados | nenhum |
| `sed`, `cat`, `rg -n` sobre README/config/auth/functions/migrations | arquitetura e revisão estática | achados acima; saída longa truncada no terminal em uma consulta, complementada por consultas focadas | nenhum |
| `git log -12`, `git log --all -G ...`, `git ls-files` | histórico e secrets | `.env` no histórico; nenhum padrão privado confirmado; valores mascarados | nenhum |
| script Python local para `SECURITY DEFINER` sem `search_path` | hardening SQL | uma definição histórica sinalizada; schema final não executado | nenhum |
| `npm audit --json` | CVEs | **não conclusivo:** registry retornou HTTP 403 | nenhum |
| `git switch -c security/hardening-audit` | isolar correções | concluído | branch |
| `npm run test:security` | regressão AppSec | passou: 5/5 testes | nenhum |
| `npm run lint` | lint | falhou no baseline: 526 erros e 24 avisos preexistentes, principalmente `no-explicit-any` e hooks | nenhum |
| `npx tsc -p tsconfig.app.json --noEmit` | typecheck | falhou no baseline: tipo duplicado `available_online` e erro preexistente em `Services.tsx` | nenhum |
| `npm run build` | build produção | passou; avisos de Browserslist desatualizado e bundle >500 KiB | `dist/` ignorado |
| `npx eslint` nos arquivos alterados | lint focado | falhou por 43 erros preexistentes de tipagem/hooks nos componentes; nenhuma ocorrência nova de CORS curinga ou log de cliente | nenhum |
| `deno check ...` | typecheck das Edge Functions | não executado: Deno não está instalado no ambiente | nenhum |

## 7. Plano de validação e riscos residuais

A correção só deve ser promovida após testes sintéticos em homologação: token ausente/incorreto/correto, corpo excessivo, evento desconhecido, replay, fora de ordem, assinatura inexistente e reconciliação. Testar dois tenants e todos os papéis para SELECT/INSERT/UPDATE/DELETE em cada tabela exposta e para cada RPC/Edge Function. Confirmar no painel Supabase JWT, CAPTCHA, políticas de senha, e-mail, duração/revogação de sessão, CORS, secrets, network restrictions, storage e logs.

Permanecem não validados: infraestrutura fora do repositório, produção, permissões cloud/IAM, banco e policies efetivamente publicados, secrets externos, TLS/headers, branch protection, backups/restauração, monitoramento, provedores terceiros, retenção e atendimento a titulares. Não foram feitos pentest dinâmico, DAST, fuzzing, testes destrutivos, carga, ataque externo ou análise jurídica. Dependências continuam sem parecer conclusivo até o audit funcionar.
