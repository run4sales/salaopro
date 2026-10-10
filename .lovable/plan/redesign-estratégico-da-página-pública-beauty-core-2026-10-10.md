# Redesign estratégico da página pública Beauty Core

## Fase 1 — Diagnóstico

### Aprendizados das referências
- **Trinks:** o screenshot enviado torna a categoria do produto explícita, agrupa recursos por necessidade, apresenta a agenda visualmente e identifica salões, barbearias e estética. Adaptar a clareza e a navegação por módulos, não os textos, fotos ou identidade.
- **Avec:** o screenshot enviado combina mensagem curta, acesso direto ao contato, demonstrações e dúvidas frequentes. Adaptar a hierarquia e as respostas às objeções, sem replicar formulário comercial, alegações de IA ou números de clientes.
- Essas observações são das imagens fornecidas, não uma comprovação das funcionalidades, preços ou desempenho atuais dos concorrentes. Alguns textos pequenos da Avec não permitem leitura confiável.

### Página atual
**Preservar:** marca Beauty Core, presença do roxo e dourado, organização por módulos e links diretos para cadastro com plano escolhido.

**Corrigir prioritariamente:**
- Promessas de lucro e reativação automática de WhatsApp sem comprovação no produto.
- Depoimentos e números de demonstração apresentados sem identificação de sua origem.
- Prazo de “14 dias” em conflito com o teste vigente de **10 dias corridos**.
- Botão “Ver como funciona” sem ação e nove links de rodapé apontando apenas para `#`.
- Navegação oculta em celulares, ausência de perguntas frequentes e pouca demonstração da interface real.
- Preços e limites fixos que podem divergir dos planos disponíveis.
- Excesso de efeitos luminosos, blocos repetitivos e foco em crescimento financeiro em vez da rotina real do negócio.

## Posicionamento proposto
**Beauty Core — gestão para salões e barbearias.**

Mensagem de apoio: “Organize os agendamentos, acompanhe seus clientes e conecte vendas e comissões em um só lugar.”

Ação principal: **Começar 10 dias grátis**. Ação secundária: **Conhecer o sistema**, levando à demonstração na própria página.

## Fase 2 — O que implementar
1. **Primeira tela:** nome e categoria do produto em destaque, benefício concreto, condições verificadas do teste e dois caminhos claros; sem promessas de resultado.
2. **Demonstração e funcionalidades:** navegação acessível por Agenda, Clientes e Vendas/Comissões, com visual do produto e explicações curtas ligadas aos problemas reais da rotina. Capturas somente sem dados pessoais; se não houver sessão apropriada, demonstrar a interface com dados explicitamente ilustrativos, sem fingir uma captura autêntica.
3. **Gestão integrada:** explicar a sequência agendamento → atendimento → venda → comissão e acompanhamento financeiro, sem repetir a lista de recursos.
4. **Público:** salões, barbearias e profissionais de beleza, sem alegar funcionalidades específicas de clínicas não verificadas.
5. **Planos:** consultar os planos públicos ativos, apresentando preços e limites oficiais; estados de carregamento e falha, sem inventar preços substitutos. Preservar seleção compatível com o cadastro existente.
6. **Perguntas frequentes:** teste de dez dias, contratação, uso pelo navegador e acesso da equipe, apenas com informações verificadas. Contato somente se houver destino real confirmado.
7. **Chamada final e rodapé:** convite direto ao teste, login e links úteis reais; retirar links fictícios e prova social sem origem verificável.

## Direção visual
Preservar roxo e dourado com aplicações sólidas e discretas, superfícies neutras, tipografia sem serifa e hierarquia legível. Usar menos cartões, sem brilhos decorativos ou gradientes dominantes. Conteúdo conciso, demonstração em destaque, menu funcional no celular e controles existentes do projeto. Manter contraste e foco visível para navegação por teclado.

## Detalhes técnicos e limites
- Alterações restritas à página pública, componentes de apresentação e estilos necessários; não modificar banco, autenticação, pagamentos ou permissões.
- Atualizar título e descrição estáticos para refletir gestão de beleza, com metadados sociais consistentes; não substituir imagem social por imagem de concorrente.
- Reutilizar a consulta pública de planos e o fluxo `/auth?tab=signup&plan=…`; confirmar os identificadores aceitos antes de exibir cada ação.
- Imagens otimizadas, dimensões estáveis e carregamento adiado abaixo da primeira tela.
- Verificar mecanismos de medição existentes; não instalar serviços externos nem anunciar acompanhamento de conversões sem evidência. Caso não exista medição adequada, registrar a limitação.
- Não criar contas, enviar contatos ou realizar cobranças durante a validação.

## Validação e entrega
Verificar computador e celular, menu, demonstração, perguntas frequentes, rolagem, links e abertura correta do cadastro com plano selecionado; conferir erros de carregamento e de layout e os testes relevantes. Resumir as alterações e eventuais limitações de acesso às capturas reais ou contato confirmado.

O ganho esperado é maior clareza e menor atrito para iniciar o teste; aumento de conversão depende de medição após publicação e não será tratado como resultado garantido.