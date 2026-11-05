import { findInlineReferences } from './reference';

/**
 * Marca as referências bíblicas de um HTML já saneado (texto de comentário)
 * como botões `.ref-link`, com o endereço em `data-*`.
 *
 * Os módulos trazem a referência só como texto ("Jo 3.16"): o link interno do
 * MyBible é removido na importação. Os botões são montados por DOM, nunca por
 * concatenação de string, então o texto do módulo não vira marcação.
 */
export function linkifyReferences(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(n.parentElement?.closest('a, button'))) nodes.push(n as Text);
  }

  for (const node of nodes) {
    const text = node.data;
    const matches = findInlineReferences(text);
    if (!matches.length) continue;
    const frag = document.createDocumentFragment();
    let at = 0;
    for (const m of matches) {
      if (m.index < at) continue;
      frag.append(text.slice(at, m.index));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ref-link';
      btn.dataset.book = m.ref.book;
      btn.dataset.chapter = String(m.ref.chapter);
      btn.dataset.verse = String(m.ref.verse);
      if (m.ref.verseEnd) btn.dataset.verseEnd = String(m.ref.verseEnd);
      btn.textContent = m.text;
      frag.append(btn);
      at = m.index + m.length;
    }
    frag.append(text.slice(at));
    node.replaceWith(frag);
  }
  return template.innerHTML;
}
