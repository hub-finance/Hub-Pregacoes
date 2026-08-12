# Arquitetura

## Visão geral

```
src/
├── app/            shell, navegação, atualização do PWA
├── components/     primitivas de interface (Sheet, Toast, campos, botões)
├── core/           regras de negócio — nenhuma dependência de React onde possível
│   ├── ai/         contrato da IA bíblica (desligada por padrão)
│   ├── bible/      cânon, referências, repositório de texto, busca
│   ├── data/       CRUD por domínio (favoritos, anotações, documentos, planos…)
│   ├── db/         schema Dexie/IndexedDB e tipos
│   ├── plans/      geração dos planos de leitura
│   ├── settings/   preferências do usuário (contexto React)
│   ├── share/      Web Share API e geração da imagem de versículo
│   ├── sync/       contrato de sincronização (sem backend ainda)
│   └── backup.ts   exportação/restauração e exportação de documentos
├── features/       uma pasta por módulo de tela
├── hooks/          utilitários de React (async, debounce, media query, rede)
└── styles/         tokens, base, layout e leitor
```

A regra de dependência é de mão única: `features → core`, nunca o contrário.
Nenhum arquivo em `core/` importa de `features/`.

## Camadas do texto bíblico

```
memória (sessão)  →  IndexedDB (offline)  →  arquivo estático /bible/<id>/<LIVRO>.json
```

- O texto **não** entra no bundle JS nem no precache do service worker (≈8 MB).
- Cada livro é um arquivo. Ao abrir um capítulo, apenas aquele livro é buscado.
- O livro baixado é gravado no IndexedDB — a segunda leitura é instantânea e offline.
- "Baixar para uso offline" (Configurações) traz os 66 livros com barra de progresso.
- A busca roda sobre o IndexedDB; se a tradução ainda não estiver completa,
  `ensureSearchable()` a completa mostrando progresso.

Formato de um livro:

```json
{ "translation": "pt_almeida", "book": "JHN", "name": "João", "chapters": [["v1", "v2"]] }
```

Capítulos e versículos são posicionais (índice + 1), o que mantém os arquivos pequenos.

## Banco de dados (IndexedDB via Dexie)

| Tabela | Conteúdo |
|---|---|
| `settings` | pares chave/valor (metadados de traduções importadas) |
| `users` | perfil local |
| `favorites` | versículos favoritados, com categoria e observação |
| `highlights` | marcações por versículo e categoria |
| `notes` | anotações (versículo, capítulo, livro, sermão, estudo, devocional, livre) |
| `sermons` / `studies` / `devotionals` / `libraryDocs` | documentos ministeriais |
| `plans` | planos de leitura e progresso |
| `readingEvents` | histórico de leitura (sequência de dias, painel) |
| `books` | texto bíblico em cache (pode ser limpo sem afetar dados pessoais) |

Todo registro do usuário carrega `id`, `userId` e `updatedAt` — o mínimo necessário
para sincronização incremental futura com resolução "last write wins".

## PWA

- `vite-plugin-pwa` (Workbox), `registerType: 'prompt'`: o service worker novo só
  assume quando o usuário aceita — nunca no meio de uma leitura ou de um sermão.
- Precache: apenas o app (JS/CSS/HTML/ícones). O texto bíblico usa `CacheFirst` em runtime.
- `base: './'` e `HashRouter`: o build funciona em subdiretório, em servidor estático
  e dentro de um WebView Android sem reescrita de rotas.

## Caminho para o APK Android

Nada no projeto depende de APIs exclusivas de servidor. Para empacotar:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "Hub Bible" com.hubbible.app --web-dir=dist
npm run build && npx cap add android && npx cap sync android
```

Pontos já preparados: rotas por hash, caminhos relativos, armazenamento local,
compartilhamento via Web Share API (mapeado para o *share sheet* nativo) e
`wakeLock` no Modo Pregação.

## Extensões previstas

- **IA bíblica** (`core/ai/provider.ts`): registre um `AiProvider`. O contrato obriga
  que todo texto bíblico venha do repositório local e que a saída do modelo seja
  marcada como `ai-comment`; `validateReferences()` descarta citações inexistentes.
- **Sincronização** (`core/sync/syncAdapter.ts`): registre um `SyncAdapter`.
  `collectLocalChanges()` / `applyRemoteChanges()` já implementam o diff por `updatedAt`.
