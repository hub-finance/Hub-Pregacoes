# Hub Resumos

**Resumos e interpretações de livros, estudos e resumos** — um programa
independente, irmão do Hub Bible. Funciona sozinho: instala na tela inicial,
guarda tudo no próprio aparelho e abre sem internet. Com o Hub Bible ele
conversa quando você quiser, por arquivo e por link.

## O que faz

Cada material (livro, estudo ou resumo) ganha onze visões:

| Aba | O que mostra |
|---|---|
| **Painel** | Andamento, partes, tempo de leitura, versículos, cartões do dia, ações abertas e o próximo passo |
| **Passo a passo** | O material conduzido parte por parte, com anotação pessoal em cada passo; volta de onde parou |
| **DNA** | Ideia central (escrita por você), identidade, texto-chave, estrutura, palavras-chave, versículos, destaques, glossário e perguntas |
| **Mapa mental** | Mapa interativo (canvas, azul-noite e dourado): o material no centro, cada parte como assunto e, ao tocar, os **pontos principais** dela (até 6, do mais importante: destaque, definição, versículo com a frase, item, pergunta, frase principal do parágrafo), numerados e coloridos por tipo. Um assunto por vez, “Expandir tudo”, zoom, arrastar, tela cheia e a frase inteira de cada ponto. Baixa como **.html interativo** (abre sozinho, sem internet) e **PNG** |
| **Quadros** | O material em seis formatos de quadro, como imagem (1080 px de largura): **DNA do livro**, **folha de consulta**, **mapa de conceitos**, **painel completo**, **fluxograma** e **cartões**. Papel claro ou azul e dourado; PNG, compartilhar ou os seis num .zip. Só trechos do texto |
| **Cartões** | Frente e verso sugeridos do texto (definições, destaques com lacuna, perguntas, listas, referências) ou escritos à mão, com revisão espaçada |
| **Consulta rápida** | Uma folha com o essencial, pronta para imprimir ou salvar em PDF, ou copiar como texto |
| **Plano de ação** | Ações com responsável, prazo e situação; sugestões das partes de aplicação do texto |
| **Resumo** | **Com IA (opcional, Gemini):** livro inteiro ou capítulo por capítulo — resumo, ideias, aplicações, perguntas e conceitos, marcado como “feito pela IA”, separado do texto; aplicações vão ao plano de ação; aparece também no Passo a passo. **Sem IA:**  Frases do próprio texto (curto, médio, longo); pode virar um novo material para você completar |
| **Infográfico** | Imagem PNG (retrato ou quadrado, 4 paletas) para baixar ou compartilhar |
| **Editar** | Título, tipo, autor, etiquetas, ideia central e as partes; enviar ao Hub Bible |

**Temas:** os oito do Hub Bible (Claro, Sépia, Azul e branco, Azul safira,
Verde e branco, Escuro, Noite azul, Ministerial) e o Verde do Hub Resumos. O
botão do sol, no topo, troca rápido; Dados e ajustes mostra todos.

Além disso: **Revisar cartões** (todos os cartões vencidos de todos os
materiais numa sessão), **Dados e ajustes** (cópia de segurança, restauração,
endereço do Hub Bible, tema) e **Ajuda** (primeiros passos, marcações do texto,
cada aba explicada e perguntas frequentes; cada aba tem o seu “Como usar”).

Na **biblioteca**: números gerais, “Continue de onde parou”, guia de primeiros
passos, **material de exemplo** e, em cada material, **baixar** (.json com
andamento, cartões e ações — volta pelo “Novo material › Importar arquivo”, como
material novo), **duplicar** e **excluir só aquele material**, com confirmação.

**Tudo o que é criado sai em arquivo:** material (.json), mapa mental (.html e
PNG), quadros (PNG ou .zip), infográfico (PNG), consulta rápida (PDF pela impressão), resumo (.md),
envio ao Hub Bible (.json) e a cópia de segurança de tudo (.json).

### Princípio de autoria

Sem a IA, o app **não inventa conteúdo**: tudo o que ele aponta — destaque,
termo, pergunta, referência, frase do resumo, sugestão de cartão ou de ação —
está literalmente no texto. A interpretação (a ideia central) é escrita por
você. As sugestões só entram quando você as escolhe.

**IA opcional (Gemini, do Google).** Com uma chave cadastrada em Dados e ajustes
(guardada só no aparelho; o padrão é o Gemini 3.8 Flash; se a chave não tiver acesso a ele, o app escolhe o Flash mais novo disponível), a aba Resumo resume o livro inteiro ou cada capítulo
com as próprias palavras da IA. O pedido manda não inventar fatos nem
referências; o resultado fica **separado do texto** (`material.ai`), sempre
marcado como “feito pela IA” e pode ser apagado. O texto vai do aparelho direto
para o Google (`core/ai.ts`), sem servidor do Hub. A IA também faz a **leitura inteligente do sumário**: ao importar um livro (ou em
Editar › “Ler o sumário com IA”), ela lê o começo do livro e devolve os títulos
dos capítulos, seções ou lições; o app divide o texto procurando cada título.
Sem chave, nada muda.

### Como escrever o texto para o app entender melhor

- `# Título`, `CAPÍTULO 1`, `Lição 2`, `Módulo 3` ou linha curta em MAIÚSCULAS dividem em partes;
- `> frase` marca um **destaque** (ideia-chave);
- `- item` faz lista; `- [ ] tarefa` vira sugestão de ação;
- `Termo: definição` entra no **glossário** e vira cartão;
- perguntas terminadas em `?` e referências bíblicas (João 3:16, Rm 8.28, 1 Co 13) são achadas sozinhas.

## Com o Hub Bible

- **Trazer do Hub:** no Hub Bible, Configurações › “Exportar meus dados”; aqui,
  Novo material › “Do Hub Bible”, escolha o arquivo e marque o que trazer
  (mensagens, estudos do Rhema, cursos/devocionais). Nada no Hub é alterado.
- **Levar ao Hub:** aba Editar › “Enviar para o Hub Bible (Rhema)” gera um
  arquivo; no Hub Bible, Configurações › Restaurar → ele vira um estudo do
  Rhema, junto do que já existe.
- **Abrir versículos no Hub:** em Dados e ajustes, informe o endereço do Hub
  Bible; as referências viram links que abrem o versículo nele.

## Banco de dados

IndexedDB (Dexie), banco `hub-resumos`, separado do Hub Bible. Tabelas:
`materials`, `progress`, `cards`, `actions`, `settings` (`src/core/db.ts`). O
app pede ao navegador armazenamento persistente. A cópia de segurança
(Dados e ajustes) gera um JSON com tudo; restaurar **junta** ao que existe.
Mudou o schema? Acrescente uma `version()` nova em `db.ts`.

## Comandos

```bash
npm ci
npm run dev       # desenvolvimento
npm run build     # gera dist/ (PWA)
npm run preview   # serve o build
npm test          # testes do núcleo (texto, cartões, resumo, mapa mental, importação, banco, material em arquivo, exemplo)
node scripts/icons.mjs <caminho-do-playwright>   # regenera os PNG do ícone
```

Para conferir tipos: `npx tsc --noEmit -p .`

## Publicar

É um projeto separado do Hub Bible, na pasta `hub-resumos/` do mesmo
repositório. Na Vercel: **Add New › Project**, escolha o repositório
`Hub-Pregacoes` e, em **Root Directory**, `hub-resumos`. O `vercel.json` desta
pasta já define instalação, build e cabeçalhos. Depois, no celular, abra o
endereço no Chrome e use **Instalar aplicativo**.

### Ou na Netlify

O site `hub-resumos` já existe na Netlify do usuário (https://hub-resumos.netlify.app,
ainda sem publicação). No painel da Netlify: **Project configuration › Build &
deploy › Link repository** → `Hub-Pregacoes`, **Base directory** `hub-resumos`.
O `netlify.toml` desta pasta define build, pasta publicada e cabeçalhos.

## Estrutura

```
src/
  core/        regras, sem tela: banco, leitura do texto, referências bíblicas,
               cartões, plano de ação, resumo, mapa, importação, cópia de segurança
  features/    telas: biblioteca, material (abas), revisão, ajustes, ajuda
    mindmap/   motor do mapa mental (engine.js, JS puro: o mesmo código vai
               dentro do .html baixado) e a tela dele
  components/  primitivas visuais (as mesmas do Hub Bible)
  styles/      tokens e estilos do Hub Bible + resumos.css (cor verde própria)
scripts/       testes e geração de ícones
```

## Acessibilidade

Verificado com o axe (WCAG 2.1/2.2 AA) em todas as telas e nos nove temas:
contraste dos textos secundários, rótulos dos campos, alvos de toque de 44 px,
foco visível. Cada tela de material tem a trilha “Biblioteca › Material › Aba”;
os editores mostram “Salvando…” / “Salvo às hh:mm”.

## Próximos passos (anotados com o usuário)

- **Cores para escolher nas ferramentas** (pedido para depois, não agora): mais
  opções de cor nos quadros, no mapa mental e no infográfico, para o usuário
  escolher a que preferir. Hoje os quadros têm “Papel” e “Azul e dourado”.
- Slides de treinamento.
- Testar a IA com a chave real do Gemini (3.8 Flash) no aparelho do usuário.
- Aviso “Nova versão disponível — toque para atualizar”, para não precisar
  fechar e abrir o app depois de cada publicação.
- Entender qual aba o usuário chamou de “artesanal” e por que não gerou nada.
- Fase 4 do Hub Bible (sugestões da IA) e conferência no APK.

## Limitações

- Sem IA: o resumo é **extrativo** (frases do texto), e as sugestões de cartões e
  ações dependem das marcações e das frases do texto. A IA precisa de internet
  e da chave do Gemini; o uso pode ter limite ou custo, conforme a conta Google.
- PDF digitalizado (só imagem) não tem texto para importar.
- O texto do versículo não vem junto (o app não inclui a Bíblia); a referência
  abre no Hub Bible quando o endereço está configurado.
- “Imprimir / salvar em PDF” usa a impressão do sistema; no app instalado em
  alguns Android a opção pode não aparecer — use “Copiar como texto”.
- Livros de outros autores importados ficam para uso pessoal, no aparelho.
