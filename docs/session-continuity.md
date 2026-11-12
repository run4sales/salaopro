# Sessão persistente e continuidade — 12/11/2026

## Causa raiz

O serviço de autenticação já persistia a sessão e renovava tokens. Porém, `useAuth` tratava todos os eventos, inclusive `SIGNED_IN` repetido ao retornar à aba e `TOKEN_REFRESHED`, como novo login: ativava o carregamento e buscava o perfil novamente. `AppLayout` substituía a página durante esse carregamento, desmontando a agenda, fichas e formulários. As seleções locais eram reinicializadas. Além disso, a tela de login ignorava o destino `from` e voltava ao dashboard, a raiz pública não restaurava navegação e o filtro de profissional era compartilhado entre contas.

## Estratégia de sessão

- Mantido o cliente gerado como único armazenamento de sessão, com persistência e renovação já habilitadas; nenhum token adicional é gravado.
- Identidade restaurada/nova validada com `getUser` antes de carregar dados protegidos.
- Eventos da mesma identidade atualizam a sessão sem desmontar a página nem reiniciar consultas de perfil.
- Falhas temporárias na verificação inicial mostram nova tentativa, sem apagar a sessão. Retorno da conexão pode repetir essa verificação.
- Logout explícito usa saída local pelo próprio serviço e limpa contexto, consultas em memória e navegação da conta. Eventos reais de saída também limpam o contexto.
- Nenhum timer de inatividade, prazo infinito ou alteração nas regras do provedor, de assinatura ou nas permissões.

## Restauração de navegação

Armazenamento versionado por usuário e salão contendo somente rotas reconhecidas, parâmetros permitidos, datas, abas, enums e identificadores. Não são persistidos clientes completos, contatos, buscas livres, valores financeiros, carrinhos, senhas, formulários ou respostas de relatórios. A ficha é reconstruída por consulta autorizada do salão atual. Valores inválidos são ignorados e armazenamento indisponível não deve impedir a utilização.

Ao abrir a raiz sem parâmetros de callback/indicação, restaura-se a última página. O login considera destino protegido anterior e última rota permitida. Links diretos continuam prevalecendo. As páginas passam pelos controles existentes de autenticação, perfil, assinatura e Super Admin. Funcionários só restauram rotas já permitidas pela aplicação.

Seleções cobertas: data/período/visualização/profissional da agenda, ficha e aba de cliente, aniversário, datas/abas dos relatórios e métricas, filtros por profissional/serviço/comissão/cancelamento/recorrência, período/status/categoria de despesas, período do histórico de vendas, abas de configurações e Super Admin e categoria Serviços/Produtos do PDV.

## Arquivos modificados

- Autenticação e entrada: `src/hooks/useAuth.tsx`, `src/App.tsx`, `src/components/AppLayout.tsx`, `src/pages/Auth.tsx`, `src/pages/Index.tsx`.
- Persistência: `src/lib/authContinuity.ts`, `src/lib/navigationPersistence.ts`, `src/hooks/useNavigationState.ts`, `src/components/NavigationContinuity.tsx`.
- Telas: `src/components/agenda/StableAgendaContent.tsx`, `src/pages/Clients.tsx`, `src/components/clients/ClientProfileDialog.tsx`, `src/pages/Reports.tsx`, `src/pages/AccountsPayablePage.tsx`, `src/pages/Metrics.tsx`, `src/pages/SalesHistory.tsx`, `src/pages/Settings.tsx`, `src/pages/SuperAdmin.tsx`, `src/pages/Sales.tsx`.
- Filtros: `CommissionsReport.tsx`, `ProfessionalServicesReport.tsx`, `CashFlowReport.tsx`, `CanceledAppointmentsReport.tsx` em `src/components/reports/`.
- Registro/testes: `tests/navigation-continuity.test.mjs`, `AGENTS.md`, `roadmap.md` e este relatório.

## Verificação

45 testes passaram: dez novos testes de continuidade/isolamento e regressões de agenda, CRM, faturamento, cobrança, cancelamento e PDV. O registro mais recente da prévia indicou compilação sem erros.

Navegador autenticado na conta disponibilizada, sem inserir ou modificar dados comerciais:

- Data da agenda preservada após troca de aba e atualização.
- Evento `TOKEN_REFRESHED` do serviço exercitado: agenda preservada.
- Mesma ficha de cliente e aba Financeiro restauradas após atualização.
- Aba Comissões e seleção de sete dias preservadas.
- Novo processo de navegador, em largura mobile, restaurou sessão válida e `/reports` a partir da raiz.
- Retorno temporariamente offline não redirecionou.
- Falha de rede na verificação da identidade durante recarga mostrou nova tentativa; removida a falha, a sessão e a página foram restauradas.
- Datas do filtro de Contas a Pagar preservadas após recarga.
- Logout local removeu a navegação anterior; nenhum erro de execução capturado.

## Limitações

- A sessão fornecida para teste não permitiu testar renovação real do refresh token: a tentativa foi recusada. O evento de renovação foi exercitado separadamente; a renovação automática permanece a do serviço existente.
- Testes de reabertura/mobile foram realizados em Chromium com sessão persistida, não em aparelho físico com suspensão pelo sistema operacional.
- Colaborador e login de segunda conta não foram exercitados no navegador por falta dessas contas autorizadas. Isolamento entre contas/salões, limpeza e rotas de colaborador foram testados nas regras de persistência.
- Formulários e carrinho não salvos não são restaurados após encerrar o processo do navegador; permanecem em memória ao alternar abas, sem gravar dados sensíveis localmente.
- Não foi adicionada PWA nem funcionamento offline. Não havia manifesto ou registro de service worker no projeto inspecionado.
- A aplicação precisa ser publicada para levar a correção ao site público.