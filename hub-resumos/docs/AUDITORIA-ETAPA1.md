# Auditoria — etapa 1 (prompt de aprimoramento do usuário)

Pedido: "Faça hoje só a etapa um, e tire o mapa mental em círculos, aprofunde
e melhore o outro mapa mental." O sistema estava confuso: 5 abas novas e mais
9 ferramentas antigas, várias mostrando a mesma coisa.

## O que repetia (mapa de redundâncias)

| Aba antiga | Repetia | Função própria? | Decisão |
|---|---|---|---|
| Painel | Passo a passo (andamento, Continuar), números do texto | Só o atalho "Revisar N cartões" | **Saiu**; o atalho foi para o Passo a passo |
| Consulta rápida | Captar + Análise do texto; impressão já existe em todas as camadas | Não | **Saiu** |
| Análise do texto (DnaTab) | DNA e Consulta; três coisas chamadas "DNA" | Só editar a ideia central, que já existe em Editar | **Saiu** |
| Mapa em círculos | O mapa de Compreender (dois mapas, motores diferentes) | Não | **Saiu** (pedido do usuário), com o código e o CSS |
| Quadros + Infográfico | Um ao outro (imagens para compartilhar) | Sim: PNG, .zip | **Juntas** em "Imagens" |
| Cartões | Os cartões estáticos de Aprofundar/Aplicar | Sim: revisão espaçada | Fica, como "Cartões de revisão" |
| Plano de ação | Aplicações de Aplicar | Sim: situação, responsável, prazo | Fica |
| Resumo | Síntese de Captar | Sim: "Resumir com IA", resumo por tamanho, .md | Fica, como "Resumo completo" |

## Como ficou a navegação

- Abas: Captar · Compreender · Aprofundar · Aplicar · DNA · Passo a passo · Editar.
- Ferramentas: Cartões de revisão · Plano de ação · Resumo completo · Imagens.
- Links antigos continuam funcionando: `?aba=quadros`/`infografico` abrem
  Imagens; as abas que saíram abrem Captar.

## Mapa mental (Compreender), aprofundado

- Sai da estrutura única (`core/studyMap.ts`): o livro no centro (com a tese e
  a virada geral), **um ramo por parte** (introdução e cada capítulo), e em
  cada ramo a **frase principal visível** — o mapa se lê fechado.
- Cada item tem um tipo (virada ★, ideia, versículo, conceito, pergunta), com
  cor própria e **filtros** ("só os versículos", "só as viradas"…).
- Sem IA, cada ramo traz os versículos mais citados da parte, as ideias mais
  fortes, um conceito e uma pergunta; os rótulos são o sujeito ou o começo da
  frase ("O samaritano teve compaixão"), não começos cortados.
- A explicação abre **no próprio item** (antes ia para o fim da tela), com o
  versículo, a origem e "ver no texto".
- Celular: uma coluna; computador: livro → ramos → itens, da esquerda para a direita.
- O .html baixado tem o mesmo mapa (filtros, abrir/fechar); sem scripts
  (WhatsApp, Drive), mostra tudo aberto em texto.

## Verificado

`npx tsc`, `npm test` (24), `npm run build`; Playwright em 390 px (Pixel 7) e
1280 px: abas e ferramentas, links antigos, mapa (item, filtro, abrir todos),
.html com e sem scripts — sem erros e sem rolagem horizontal.
