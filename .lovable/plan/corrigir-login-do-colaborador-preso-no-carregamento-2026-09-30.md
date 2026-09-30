# Corrigir login do colaborador preso no carregamento

## Objetivo
Garantir que o colaborador autenticado sempre conclua a identificação do vínculo e abra a área permitida, com estados claros de sucesso, ausência de vínculo ou falha, sem alterar o fluxo do administrador.

## Implementação
- Tornar a inicialização da sessão e do vínculo resiliente a falhas, concorrência e demora, encerrando o carregamento em todos os caminhos.
- Diferenciar explicitamente colaborador, administrador, vínculo ausente e erro de carregamento; nunca tratar perfil indefinido como administrador.
- Adicionar mensagem acionável e opção de tentar novamente quando o vínculo não puder ser carregado.
- Aplicar limite de espera e erro visível às consultas da agenda e atendimentos do colaborador.
- Preservar o isolamento por salão e profissional nas funções seguras existentes.
- Adicionar testes de contrato cobrindo sucesso, vínculo ausente, consulta com erro e fim do loading.

## Validação
- Testar login e agenda com colaborador real, incluindo estado vazio.
- Confirmar que o administrador continua carregando normalmente.
- Verificar erros de rede/console, testes automatizados e compilação.
- Confirmar no banco que vínculos ativos possuem salão, profissional e usuário válidos.
