# Evolução da Agenda do Beauty Core

## O que será entregue

- Bloqueios em cinza, com identificação “BLOQUEIO”, horário e motivo, sem herdar a cor do profissional.
- Ao tocar em um horário livre, escolha entre **Agendar serviço** e **Bloquear horário**. A data, hora e profissional selecionado serão preenchidos no fluxo existente.
- Ao abrir um agendamento, ver cliente, serviço, profissional, período, observações, valor negociado, sinal, restante e situação do faturamento. Comanda aberta levará ao faturamento existente; comanda faturada não oferecerá novo pagamento.
- Antes de salvar um agendamento, mostrar conflitos com agendamentos e bloqueios do mesmo profissional, considerando toda a duração. Horários adjacentes não gerarão alerta; a opção **Agendar mesmo assim** só aparecerá onde a regra de acesso permitir.
- Permissões verificadas no banco, além da interface, mantendo o isolamento entre salões e o acesso limitado dos funcionários aos próprios atendimentos.

## Detalhes técnicos

- Reutilizar `appointments`, `appointment_professionals`, `appointment_blocks`, `comandas`, `sales`, snapshots `service_amount` e a tela de pagamento atual; não criar tabelas financeiras paralelas.
- Consultar comandas e vendas vinculadas ao agendamento antes de oferecer faturamento; revisar também a proteção contra duplicidade no fechamento de venda e a autorização para ações de funcionário no banco.
- Centralizar cálculo de sobreposição (`novo.início < existente.fim` e `novo.fim > existente.início`) por profissional, incluindo agendamentos multiprofissionais e duração gravada. Revalidar no momento da confirmação para evitar informações desatualizadas.
- Manter bloqueios absolutos quando impostos pelas regras existentes; apenas conflitos permitidos pela política atual terão confirmação explícita.
- Testar duração variável, sobreposição, adjacência, bloqueios, profissionais distintos, sinal, comanda já faturada e perfis diferentes. Verificar agenda em telas maiores e menores sem alterar o PDV ou a agenda pública além do necessário.