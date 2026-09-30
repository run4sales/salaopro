# Corrigir cadastro de funcionário com senha recusada

## Implementação
- Reconhecer na função de criação quando o serviço de autenticação rejeitar uma senha fraca ou conhecida.
- Retornar erro de validação claro, em vez do erro genérico 502, sem expor detalhes internos.
- Orientar nos formulários de usuário que senhas comuns podem ser recusadas, mantendo o mínimo atual de seis caracteres.
- Cobrir a tradução do erro com teste de contrato e publicar a função corrigida.

## Validação
- Executar os testes de cadastro de funcionários.
- Testar a função com uma senha fraca e confirmar a resposta clara; depois conferir o estado final da aplicação.
