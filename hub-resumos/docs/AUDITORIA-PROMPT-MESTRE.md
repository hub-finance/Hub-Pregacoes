# Auditoria — "Prompt Mestre: evolução do Hub Resumos"

Pedido do usuário: fazer as implementações que faltam do Prompt Mestre. O próprio
prompt manda auditar antes. Este arquivo compara cada módulo com o que existe
hoje (código lido nesta data) e propõe a ordem de execução. Regra combinada com
o usuário: **uma etapa por dia**, testada e publicada.

## 1. Arquitetura atual (diagnóstico)

- PWA local (React 18 + TS + Vite + Dexie/IndexedDB), sem servidor e sem contas:
  os materiais ficam só no aparelho; cópia de segurança em arquivo .json.
- IA opcional: Google Gemini chamado direto do navegador com a chave que o
  usuário salva no aparelho (`core/ai.ts`); modelo Flash detectado sozinho.
- Uma **estrutura única do estudo** (`core/brief.ts`) alimenta Captar,
  Compreender, Aprofundar, Aplicar, DNA, Word e mapa; sem IA, regras escolhem
  frases do livro inteiro, sem repetir ideias (`sameIdea`).
- Testes: 26 automáticos (`npm test`) + verificação no navegador (Playwright)
  em celular e computador; livro de 160 mil palavras abre as abas em < 0,1 s.

## 2. Matriz: o que existe × o que falta

| Módulo do prompt | Já existe | Falta |
|---|---|---|
| 1. Biblioteca | Importa PDF, DOCX, TXT, MD e .json; capítulos automáticos (marcadores, sumário, títulos, IA); pesquisa por título/autor/etiqueta; etiquetas; salvar automático; duplicar; excluir; baixar; reorganizar capítulos | PPTX; pesquisa **no conteúdo**; pastas (hoje etiquetas); arquivar |
| 2. Motor de resumos | Resumo da IA (livro ou capítulo: resumo, ideias, aplicações, perguntas, conceitos); resumo do texto curto/médio/longo; Captar ≈ executivo | As 5 modalidades com estrutura própria (executivo, essencial, aprofundado, analítico, por capítulo) e seletor de profundidade |
| 4. Estudos aprofundados | Estrutura do estudo (tese, progressão, verdades, DNA, ponto de inflexão) | Estudo completo em 11 partes e **tipo de estudo** (acadêmico, bíblico-teológico, didático…) |
| 5. Mapas | Mapa mental por capítulo, tipos, filtros, .html interativo, impressão | Edição direta no mapa, imagem/PDF próprio, mapa conceitual (relações entre ideias), zoom |
| 6. Aprendizagem | Cartões com revisão espaçada, sugestão pelo texto, edição | **Questionários e simulados** (objetivas, V/F, discursivas, correção, explicação, pontos fracos) |
| 7. Chat com documentos (RAG) | — | **Tudo**: perguntar ao livro, com trechos recuperados e capítulo citado |
| 8. Produção de documentos | Word (.doc) e PDF do estudo; .md do resumo; envio ao Hub Bible | Tipos (apostila, fichamento, roteiro de aula, estudo bíblico, devocional…), sumário, cabeçalho/rodapé, DOCX real, PPTX |
| 9. Motor de IA | Gemini, escolha automática do modelo, erros tratados | Biblioteca de prompts, modelo por tarefa, registro de uso/erros; outros provedores (OpenAI) |
| 10. Fluxo de processamento | Extração (PDF/DOCX), capítulos, estrutura, validação parcial (versículos, sem reticências, sem repetição) | OCR para PDF digitalizado; nº de página guardado; validação com nota de qualidade |
| 12. UX/UI | Abas simplificadas (etapa 1), biblioteca com números e "continue de onde parou" | Visual novo (etapa 3 do plano anterior), painel com atividades recentes |
| 13. Segurança | Dados só no aparelho (bom para LGPD), sem chaves no servidor | Backend, contas, chave protegida no servidor — **decisão do usuário** (muda o produto) |
| 14. Qualidade | Testes automáticos e no navegador | Nota de qualidade por material; comparação antes/depois |

## 3. Riscos

- **Servidor e contas** (itens 9 e 13): proteger a chave exige um servidor; isso
  traz custo, obrigações de LGPD sobre dados de terceiros e muda o "funciona
  sem internet, tudo no aparelho". Hoje a chave é do próprio usuário e fica no
  aparelho dele — risco baixo para uso pessoal, alto se for distribuído a outras
  pessoas com uma chave só.
- **OCR** (PDF digitalizado): pesado no celular; melhor por último e opcional.
- **Escopo**: o prompt equivale a vários meses de produto; por isso, etapas
  diárias, cada uma funcionando e testada antes da próxima.

## 4. Plano proposto (uma etapa por dia)

1. **Chat com o livro** (RAG no próprio aparelho: o texto dividido em trechos,
   busca dos trechos certos, resposta da IA citando o capítulo, "não encontrei"
   quando não está no livro).
2. **Modalidades de resumo** (executivo, essencial, aprofundado, analítico, por
   capítulo) com profundidade, e **tipo de estudo** (bíblico-teológico,
   didático, acadêmico…).
3. **Questionários e simulados** com correção, explicação e revisão do que errou.
4. **Gerador de documentos**: apostila, fichamento, roteiro de aula, estudo
   bíblico, devocional — com sumário, cabeçalho/rodapé, DOCX e PPTX.
5. **Motor de IA**: biblioteca de prompts editável, modelo por tarefa, registro
   de uso e erros (e outro provedor, se o usuário quiser).
6. **Visual novo + painel** (era a etapa 3).
7. **Biblioteca**: PPTX, pesquisa no conteúdo, pastas, arquivar.
8. **Qualidade e homologação** (era a etapa 4): nota por material, testes com
   livros de tamanhos e formatos diferentes.
9. Opcional, por decisão: servidor para a chave, contas e OCR.
