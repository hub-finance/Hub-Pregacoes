# Hub Resumos

**Resumos e interpretações de livros, estudos e resumos** — um programa
independente, irmão do Hub Bible. Funciona sozinho: instala na tela inicial,
guarda tudo no próprio aparelho e abre sem internet. Com o Hub Bible ele
conversa quando você quiser, por arquivo e por link.

## O que faz

Cada material (livro, estudo ou resumo) se estuda em camadas, todas tiradas de
uma **estrutura única do estudo** (com a IA ou só com o texto), e tem poucas
ferramentas, cada uma com função própria (auditoria da etapa 1:
`docs/AUDITORIA-ETAPA1.md`).

| Aba | O que mostra |
|---|---|
| **Captar** | Síntese, tese, objetivo (da introdução), texto-base, o **ponto de inflexão** e as principais verdades |
| **Compreender** | A progressão (a introdução e cada capítulo; com a IA, a linha de raciocínio), as viradas de cada parte e o **mapa mental**: o livro no centro, um ramo por parte com a frase principal e, em cada ramo, virada, ideias, versículos, conceito e pergunta; filtros por tipo e a explicação abrindo no próprio item. Baixa como **.html** (abre sem internet; sem scripts, mostra tudo em texto) |
| **Aprofundar** | Cartões bíblicos, de princípio e de conexão |
| **Aplicar** | Cartões de revisão, aplicações (vão ao plano de ação) e perguntas |
| **DNA** | Tese, convicções, ponto de inflexão e a matriz Princípio · Base bíblica · Aplicação |
| **Passo a passo** | O material parte por parte, com a virada de cada parte, anotação pessoal e “Revisar N cartões” |
| **Editar** | Título, tipo, autor, etiquetas, **ideia central** e as partes; enviar ao Hub Bible |

Em **Ferramentas**: **Cartões de revisão** (revisão espaçada), **Plano de ação**
(responsável, prazo e situação), **Resumo completo** (com IA ou com as frases do
texto, curto/médio/longo) e **Imagens** (os seis quadros e o infográfico, em PNG).

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

**Tudo o que é criado sai em arquivo:** material (.json), estudo em Word (.doc)
e PDF (pela impressão), mapa mental (.html), quadros (PNG ou .zip), infográfico (PNG), resumo (.md),
envio ao Hub Bible (.json) e a cópia de segurança de tudo (.json).

### Princípio do sistema: qualidade e ganho de tempo

O Hub Resumos existe para o leitor **entender e aplicar o livro em menos
tempo**, não para repetir o livro. Cada visão (mapa, quadros, resumos, cartões,
IA) escolhe e condensa o que importa: poucos pontos, bem escolhidos, em vez de
listas longas. Na dúvida entre mostrar mais ou mostrar melhor, mostrar melhor.

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
npm test          # testes do núcleo (texto, estrutura do estudo, mapa mental, cartões, resumo, importação, banco, material em arquivo, exemplo)
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
    layers/    as camadas do estudo (Captar … DNA) e o mapa mental
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

**Prompt de ajustes dos resumos (relatório + slides do usuário):** ver
`docs/AJUSTES-RESUMOS.md` — estrutura única do estudo, 4 camadas, progressão
lógica, 4 tipos de cartão, DNA em matriz, sem reticências, PDF e Word.
Já feito (ver a seção 4 do arquivo); falta testar a montagem com a IA real.

**Prompt de aprimoramento (PDF do usuário, 4 etapas):** a etapa 1 (auditoria e
simplificação) está feita — `docs/AUDITORIA-ETAPA1.md`. Faltam: 2) redundância
semântica, seleção do recurso por conteúdo e cartões no padrão; 3) visual novo
(azul-marinho, menos caixas); 4) validação automática e comparação antes/depois.
Decisões pendentes do usuário: chave da IA no servidor (deixaria de ser 100%
local) e limites que se ajustam ao tamanho do livro.

Tudo o que falta fica nesta lista e em `hub-bible/docs/PENDENCIAS.md`, para
continuar depois — sempre com o princípio acima: qualidade e ganho de tempo.

- **Cores para escolher nas ferramentas** (pedido para depois, não agora): mais
  opções de cor nos quadros e no infográfico, para o usuário
  escolher a que preferir. Hoje os quadros têm “Papel” e “Azul e dourado”.
- Slides de treinamento.
- Testar a IA com a chave real do Gemini (3.8 Flash) no aparelho do usuário.
- Aviso “Nova versão disponível — toque para atualizar”, para não precisar
  fechar e abrir o app depois de cada publicação.
- Entender qual aba o usuário chamou de “artesanal” e por que não gerou nada.
- Hub Bible: o que falta do prompt do Gerar e Exportar está listado em
  `hub-bible/docs/PENDENCIAS.md` (“Retomar daqui — Gerar e Exportar”).

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
