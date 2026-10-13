# Prompt de ajustes dos resumos (auditoria do usuário, 13/10)

O usuário enviou um relatório e 5 slides que formam **um único prompt** de
ajustes para os resumos visuais do Hub Resumos. Este arquivo transcreve os dois
e registra o plano combinado. Princípio que guia tudo: **qualidade e ganho de
tempo, não quantidade nem repetir o livro.**

---

## 1. Relatório — "Enxergando sob a Ótica de Deus"

**Objetivo:** corrigir falhas de UX/UI e de processamento cognitivo nos materiais
visuais (Fluxograma, Cartões, Mapa Mental e DNA), garantindo objetividade e
progressão lógica.

### Diagnóstico
1. **Quebra de progressividade lógica:** fluxograma e mapa agem como índice
   (tópicos de 1 a 10) e ignoram a cadeia de transformação do texto.
2. **Truncamento:** frases cortadas com reticências por falta de espaço.
   Resumo deve sintetizar a ideia, não cortá-la.
3. **Redundância e poluição visual:** rótulos repetidos ("Referências",
   "Verdade-chave") em blocos separados, isolando o versículo da aplicação.

### Melhorias por formato (exemplo do estudo)
- Base: o "algoritmo de transformação" do próprio estudo —
  `FONTE → VISÃO → CONVICÇÃO → INTERPRETAÇÃO → POSICIONAMENTO → AÇÃO`.
  (Exemplo deste estudo; o sistema deve descobrir a progressão de cada material.)
- **Fluxograma (causa e efeito):** esteira de mudança de perspectiva —
  [INPUT] Fonte ➡ alimenta [1] Visão ➡ gera [2] Convicção ➡ permite
  [saída] Interpretação ➡ resulta em [OUTPUT] Ação.
- **Cartões:** Gatilho (frente) e Solução (verso), memorização ativa. Ex.:
  "A realidade natural dita o resultado final?" → "Não. Ela não pode ser a única
  referência para nossas conclusões (2 Co 4:18)."
- **Mapa mental:** hierarquia direcional (esquerda→direita ou centro→soluções);
  nós só com palavras-chave curtas; texto explicativo no toque/hover. Ramos do
  exemplo: O Conflito · O Ajuste · A Resposta.
- **DNA em matriz de 3 colunas:** Princípio (o quê) · Base bíblica (onde) ·
  Aplicação prática (como).
- **Nota ao desenvolvedor:** evitar reticências; extração semântica baseada nas
  "verdades-chave" do documento, não só nos títulos H1/H2.

## 2. Slides

**Slide 1 — Quatro tipos de cartão** (em vez de vários cartões com o mesmo texto):
1. **Bíblico** (texto e fundamento): referência, verdade central, relação com a mensagem.
2. **Princípio** (verdade e significado): princípio claro, explicação breve, implicação.
3. **Conexão** (relação entre textos e ideias): origem, relacionado, explicação da conexão.
4. **Revisão** (recordação ativa): pergunta objetiva, resposta ao interagir, referência.

**Slide 2 — Como os resumos deveriam funcionar:** síntese central (título,
texto-base, 2–3 frases) + **progressão lógica** em etapas, cada uma
respondendo a uma pergunta e preparando a seguinte ("1. A fonte da visão — O que
está influenciando minha maneira de enxergar?" → "2. A Palavra como referência"
→ "3. A convicção interior" → "4. A resposta de fé"). O resultado é uma linha
de raciocínio que o usuário consegue explicar com as próprias palavras.

**Slide 3 — Função exclusiva de cada visual:**

| Visual | Função |
|---|---|
| Resumo executivo | Compreender a mensagem em 30–60 segundos |
| Fluxograma | Entender a progressão do argumento |
| Mapa mental | Enxergar o conjunto de ideias e suas relações |
| Cartões | Revisar, testar a compreensão e recordar |
| DNA da mensagem | Reter a essência, a convicção e a direção central |

O mapa mental em HTML deve ser interativo de verdade: selecionar ramos, abrir
detalhes e navegar pelas relações sem perder a visão geral.

**Slide 4 — Quatro camadas de aprendizagem** (+ um recurso complementar):
1. **Captar** — o que preciso entender rapidamente? (síntese, tese, texto-base, objetivo, principais verdades)
2. **Compreender** — como as ideias se relacionam? (fluxograma, mapa mental, estrutura lógica)
3. **Aprofundar** — o que fundamenta cada afirmação? (cartões temáticos, referências cruzadas, princípios, texto bíblico × interpretação)
4. **Aplicar e recordar** — como vou usar o que compreendi? (cartões de revisão, aplicações, perguntas, roteiro de recuperação)
- **Complementar — DNA da mensagem:** tese, convicções, fundamentos, conexões e resultado esperado.

As camadas se alimentam de **uma única estrutura de conteúdo**; não pedir à IA
que reescreva o estudo separadamente para cada quadro (gera repetições,
omissões e contradições).

**Slide 5 — Especificação técnica:** "Gerador de Resumos Visuais Inteligentes"
com três motores — **conteúdo** (interpreta e organiza), **visualização**
(cartões, fluxogramas, mapas) e **exportação** (PDF e Word legíveis). Conteúdo
gerado uma vez numa estrutura intermediária (JSON validado). Regras:
1. Usar o estudo integral como fonte primária.
2. Preservar tese, argumentos, versículos e conexões bíblicas.
3. Diferenciar o que está explícito no estudo das inferências da IA.
4. Evitar repetições entre cartões e quadros.
5. Não reduzir tanto que a lógica da mensagem desapareça.
6. Permitir abrir cada resumo e consultar sua relação com a seção de origem.
7. Visualização interativa em HTML e exportação em PDF e Word.
8. Adaptar o layout à quantidade de conteúdo, sem diminuir demais a fonte.
9. Validar as referências bíblicas e não inventar citações.
10. Permitir editar os resumos antes de exportar.

---

## 3. Plano combinado (feedback do assistente)

Tudo no **Hub Resumos** (o slide 5 cita o Hub Bible; o usuário pediu que o Hub
Resumos funcione sozinho e que o Hub Bible não seja mexido — **confirmar**).

1. **Estrutura do estudo (JSON único)** gerada pela IA (Gemini) e validada:
   tese, texto-base, síntese de 30–60 s, progressão em etapas (cada uma com sua
   pergunta), princípios com base bíblica e aplicação, os 4 tipos de cartão,
   matriz DNA; cada item com a seção de origem e a marca "do texto" ou
   "inferência da IA"; versículos conferidos contra o texto; tela para editar.
   Sem chave da IA, os visuais seguem por regras, mais simples, mas sem cortar
   frases e sem repetir pontos.
2. **Telas em 4 camadas + DNA**, no lugar das 11 abas.
3. **Visuais refeitos a partir da estrutura:** resumo executivo, fluxograma
   progressivo, mapa mental com palavras-chave, cartões em 4 tipos, DNA em
   matriz; sem reticências (o quadro cresce).
4. **Exportar em PDF e Word.**

Antes, primeira tarefa já anotada: corrigir os pontos repetidos ("Origens") no
mapa mental.

**Perguntas em aberto ao usuário:** (1) mapa radial (modelo dele), direcional
(relatório) ou os dois? (2) confirma tudo no Hub Resumos? (3) ordem: correção do
mapa e depois a etapa 1?

## 4. Situação (o que já foi feito)

Respostas do usuário: visual no estilo dos slides; mapa direcional (esquerda
para a direita); tudo no Hub Resumos, sem integrar ao Hub Bible.

Feito:
- Estrutura única do estudo (`src/core/brief.ts`), pela IA ou por regras,
  com origem de cada item ("do texto" / "inferência da IA"), seção de origem,
  "ver no texto" e conferência dos versículos.
- Abas Captar, Compreender (progressão + mapa direcional + .html interativo),
  Aprofundar (cartões bíblico, princípio, conexão), Aplicar (revisão,
  aplicações, perguntas) e DNA (matriz de 3 colunas). As abas antigas ficaram
  em "Mais ferramentas".
- Editar a estrutura antes de exportar; Imprimir/PDF; Word (.doc).
- Textos enxutos (pedido do usuário: "resumos fora dos cards muito extensos"):
  uma frase curta por item, síntese de até ~45 palavras, sem reticências,
  sem repetir a pergunta da etapa nem a mesma frase em dois lugares; a IA
  recebe limites de palavras. O resumo da IA (aba Resumo e Passo a passo)
  também ficou mais curto (até 160 palavras no material inteiro).

Falta:
- Testar a montagem pela IA com a chave real do Gemini.
- Avaliar se as abas antigas de "Mais ferramentas" ainda são necessárias.

## 5. Ponto de inflexão (pedido do usuário)

"A virada da mensagem, o insight supremo." Um geral e um por capítulo:
- Geral (`brief.inflection`): Antes → A virada → Depois, com o versículo; em
  Captar, no DNA, marcado com ★ na progressão de Compreender e no Word.
- Por capítulo (`brief.chapterTurns`): uma frase; em Compreender ("As viradas
  do livro"), no topo de cada parte do Passo a passo e como ★ no mapa em
  círculos.
- Com a IA: pedidos no mesmo JSON da estrutura. Sem a IA: as regras sugerem a
  frase com marca de virada ("mas", "porém", "até que", "então"…) ou o
  destaque do autor, marcada como "sugestão"; ao reescrever em Editar, deixa
  de ser sugestão.
