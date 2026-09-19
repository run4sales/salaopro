# Validação centralizada de e-mail e telefone

## Objetivo
Impedir novos cadastros e alterações com e-mails ou telefones claramente inválidos, tanto nas telas quanto em chamadas diretas ao backend, sem modificar automaticamente os dados antigos.

## Escopo mapeado
- Cadastro da conta/estabelecimento e edição do perfil.
- Cadastro e edição de clientes.
- Importação de clientes por XLSX/CSV.
- Agendamento público, que pode criar um cliente pelo telefone.
- Cadastro e edição de funcionários/usuários.
- Checkout da assinatura, que envia e-mail e telefone ao Asaas.
- Gravações diretas nas tabelas `clients`, `profiles`, `establishment_users` e `subscriptions`, além das funções de criação/edição de funcionários e agendamento público.
- Login e recuperação de senha serão mantidos compatíveis com contas antigas; a validação restritiva será aplicada somente a novos cadastros e alterações.

## Implementação

### 1. Validadores compartilhados no app
- Criar um utilitário único com `validateEmail`, `validatePhone`, `isSuspiciousEmail`, `isSuspiciousPhone`, normalização e mensagens padronizadas.
- E-mail: validar estrutura, espaços, limites, domínio, partes locais inválidas e uma lista curta de marcadores artificiais conhecidos.
- Detectar repetição extrema e padrões periódicos curtos, exigindo tamanho suficiente para não bloquear nomes reais/comerciais incomuns.
- Telefone: rejeitar letras antes da normalização, aceitar máscara, código `55` opcional, DDD brasileiro válido, fixo com 10 dígitos e celular com 11 dígitos, além de sequências repetitivas ou claramente ascendentes/descendentes.
- Manter e-mail opcional onde ele já é opcional; quando preenchido, ele deverá ser válido.

### 2. Mensagens nas telas
- Aplicar o utilitário no cadastro da conta, perfil do estabelecimento, clientes, funcionários, agendamento público e checkout.
- Exibir a mensagem junto ao campo, marcar o campo inválido e impedir o envio sem limpar os demais valores.
- Remover o erro assim que o usuário corrigir o valor.
- Normalizar e-mail para minúsculas e telefone para dígitos brasileiros antes de salvar.
- Aplicar as mesmas regras na prévia da importação, registrando a linha e o motivo no relatório de erros.

### 3. Proteção no backend
- Criar funções SQL centrais para classificar e-mail e telefone e gatilhos `BEFORE INSERT OR UPDATE` nas tabelas públicas que armazenam esses dados.
- Os gatilhos validarão apenas campos novos ou realmente alterados, preservando registros antigos inválidos enquanto não forem editados nesses campos.
- Atualizar a função de criação de perfil da nova conta e a função de vínculo alternativo de funcionário para usar as regras centrais e retornar mensagens claras.
- Criar um módulo compartilhado para as Edge Functions e aplicá-lo na criação/edição de funcionários e na criação de assinatura do Asaas.
- A função de agendamento público será protegida pela validação explícita e pela proteção da tabela de clientes.
- Não alterar políticas de acesso nem o isolamento entre estabelecimentos.

### 4. Verificação de domínio
- Criar uma Edge Function leve para consultar DNS/MX do domínio sem enviar mensagens.
- Diferenciar domínio inexistente de falha temporária ou resultado inconclusivo.
- Bloquear somente domínio comprovadamente inexistente; indisponibilidade da consulta não bloqueará o usuário.
- A interface deixará claro que MX indica capacidade do domínio receber e-mail, não confirma a existência da caixa individual.

### 5. Dados antigos
- Produzir somente uma auditoria agregada dos registros atuais por motivo de invalidade.
- Não corrigir, apagar ou bloquear registros antigos automaticamente.
- Telefones antigos com código de país `55` continuarão aceitos e serão avaliados como números brasileiros válidos quando aplicável.

### 6. Testes e verificação final
- Criar testes unitários para todos os exemplos obrigatórios rejeitados e para formatos brasileiros válidos com/sem máscara e código do país.
- Adicionar casos legítimos incomuns para proteger contra falsos positivos.
- Criar testes de contrato para confirmar que todas as telas e funções de gravação usam os validadores centrais.
- Testar os gatilhos com inserção/alteração válida e inválida, incluindo a preservação de linhas antigas não relacionadas à edição.
- Executar os testes existentes relevantes, validar os fluxos principais no navegador e fazer uma última busca por campos de e-mail/telefone sem proteção.

## Resultado esperado
Novos dados falsos ou malformados serão recusados com mensagens claras no campo e também pelo backend; dados legítimos e registros antigos permanecerão utilizáveis.
