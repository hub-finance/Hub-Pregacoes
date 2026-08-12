# Hub Bible

**Bíblia + Estudo + Devocional + Biblioteca Ministerial + Organizador de Sermões**, em um único
aplicativo. PWA instalável, responsivo e com funcionamento offline — pensado para tablets Android,
mas igualmente confortável no celular e no computador.

---

## Começar

```bash
cd hub-bible
npm install
npm run dev          # desenvolvimento em http://localhost:5173
npm run build        # gera dist/ (PWA pronto para publicar)
npm run preview      # serve o build para testar instalação e offline
```

Scripts auxiliares:

```bash
npm run bible:build  # reconstrói o texto bíblico a partir das fontes livres
node scripts/generate-icons.mjs   # regenera os ícones do PWA
```

---

## O que já funciona

### Bíblia e leitura
- Fluxo tradução → livro → capítulo → versículo, com seletor de livro filtrável e grade de capítulos.
- Navegação por capítulo (botões e setas do teclado), com passagem automática entre livros.
- Leitor com fonte ajustável (80–190%), espaçamento, largura de coluna, tipo de letra,
  texto corrido ou um versículo por linha.
- Temas claro, escuro e sépia + modo de alto contraste.
- Comparação lado a lado com uma segunda tradução.
- Seleção de um ou vários versículos → destacar, favoritar, anotar, compartilhar, copiar,
  criar estudo ou criar sermão a partir do texto.

### Busca
- Por palavra, por várias palavras (todas presentes), por frase exata (entre aspas ou pelo filtro),
  por palavra inteira, por referência (`João 3:16`, `1co 13`, `Sl 23:1-6`) e por livro.
- Filtros por Antigo/Novo Testamento ou livro específico; resultados agrupados por livro com o
  termo destacado. Roda offline sobre o banco local (≈600 ms para toda a Bíblia).

### Ministério
- **Favoritos** com categoria, observação, filtro e busca.
- **Marcações** em 11 categorias (Promessas, Fé, Cura, Santidade, Espírito Santo, Liderança,
  Família, Salvação, Graça, Amor, Ministério) + categorias personalizadas com cor própria.
- **Anotações** vinculadas a versículo, capítulo, livro, sermão, estudo ou devocional.
- **Sermões** montados em blocos — Seção, Parágrafo, Destaque, Citação bíblica e Lista —
  com negrito, itálico, sublinhado e cor dentro de cada bloco, na mesma liberdade de um
  documento do Word. Blocos se inserem, movem, trocam de tipo e são excluídos; a citação
  bíblica traz o texto do próprio aplicativo. Sermão já pronto pode ser **importado em PDF
  ou .docx** e é exibido com a formatação original.
- **Estudos** com introdução, desenvolvimento, versículos relacionados, comentários,
  aplicações e conclusão.
- **Devocionais** com texto bíblico, reflexão, aplicação e oração.
- **Biblioteca Ministerial** unificando tudo, com busca e as categorias da especificação
  (Liderança, GC, Discipulado, Escola de Líderes, Ministério, Evangelismo, Família, Vida cristã).
- **Planos de leitura**: Bíblia em 1 ano, NT em 90 dias, Evangelhos em 30 dias, Salmos e
  Provérbios, AT em 180 dias e plano personalizado (livros + duração), com progresso por dia.
- **Modo Pregação**: tela cheia, texto grande, navegação por passos, tela sempre ligada.
- **Painel “Minha vida ministerial”**: sermões, estudos, devocionais, capítulos lidos,
  dias consecutivos, favoritos, anotações e marcações por categoria.

### Compartilhamento e dados
- Compartilhamento pelo sistema nativo (Web Share API) e geração de **imagem** do versículo
  em canvas, com referência e assinatura do app.
- Exportação de sermões, estudos, devocionais e materiais em **Markdown**, **TXT** e **PDF**
  (via impressão do sistema).
- Backup completo dos dados em JSON, restauração, limpeza do texto baixado e exclusão total
  dos dados pessoais.

### PWA e offline
- Instalável na tela inicial, `display: standalone`, ícones normais e maskable.
- Service worker com atualização controlada pelo usuário.
- Aviso claro quando o dispositivo está offline; o que já foi baixado continua acessível.

---

## Texto bíblico e direitos autorais

O aplicativo acompanha **cinco traduções livres — quatro em português**:

| Sigla | Tradução | Idioma | Observação |
|---|---|---|---|
| **AL** | Almeida (domínio público) | Português | padrão do app |
| **BL** | Bíblia Livre (2018) | Português | grafia atual, texto dedicado ao domínio público |
| **TB** | Tradução Brasileira (1917) | Português | usa "Jeová" para o Nome divino |
| **1911** | Almeida 1911 | Português | grafia da época ("fructo", "n'elle") |
| **KJV** | King James Version (1611/1769) | Inglês | referência para estudo |

Cada uma traz os 66 livros, 1.189 capítulos e cerca de 31.100 versículos.

**ARA, NVI, NTLH, KJA, NAA e ACF são protegidas por direitos autorais e não são distribuídas
com o aplicativo.** Elas aparecem no catálogo como espaço reservado e podem ser instaladas
pelo próprio usuário, a partir de uma cópia licenciada, em *Configurações › Traduções ›
Importar*. O texto importado fica apenas no dispositivo.

Passo a passo da importação e modelos de carta às editoras:
[`docs/IMPORTAR-TRADUCOES.md`](docs/IMPORTAR-TRADUCOES.md).
Procedência de cada texto e regras para incluir novas traduções:
[`docs/LICENCAS-BIBLIA.md`](docs/LICENCAS-BIBLIA.md).

---

## Privacidade

Anotações, sermões, estudos e devocionais são dados privados. Ficam somente no dispositivo,
em IndexedDB. O aplicativo não envia nada para servidores — não há telemetria, contas nem
chamadas de rede além do download do texto bíblico. O usuário pode exportar e excluir tudo
a qualquer momento.

---

## Publicar

O repositório traz `vercel.json` na raiz, já configurado para construir o app a partir de
`hub-bible/`. Basta importar o repositório em [vercel.com/new](https://vercel.com/new) e clicar
em *Deploy* — nenhuma opção precisa ser alterada no painel. Cada `git push` gera um novo deploy.

Com a URL HTTPS em mãos, abra no Chrome do tablet e use **Instalar aplicativo**.
Passo a passo completo: [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md).

## Documentação técnica

- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — camadas, banco de dados, PWA e caminho para o APK.
- [`docs/LICENCAS-BIBLIA.md`](docs/LICENCAS-BIBLIA.md) — regras de licenciamento do texto bíblico.
- [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md) — publicação, atualizações e domínio próprio.
- [`docs/IMPORTAR-TRADUCOES.md`](docs/IMPORTAR-TRADUCOES.md) — instalar ARA, NVI, NTLH, KJA, NAA ou ACF a partir de cópia licenciada.
- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md) — o que falta, o que já foi investigado e por onde retomar.

## Stack

React 18 · TypeScript · Vite 5 · Dexie (IndexedDB) · React Router · vite-plugin-pwa (Workbox).
CSS próprio com tokens de design — sem framework de UI, para manter o controle visual e o
bundle enxuto (≈110 kB gzip no carregamento inicial, com os módulos ministeriais sob demanda).
