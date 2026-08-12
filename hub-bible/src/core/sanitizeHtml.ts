/**
 * Limpeza do HTML escrito no editor.
 *
 * O conteúdo vem de um campo editável do navegador, que ao colar de outro
 * aplicativo traz junto folhas de estilo inteiras, scripts e marcação que não
 * queremos guardar. Aqui só passa o que o editor oferece: ênfase, sublinhado,
 * cor de texto, listas e quebra de linha.
 *
 * A regra é de lista branca: o que não está nela some, e o texto de dentro
 * permanece. Nenhum atributo sobrevive, salvo o `href` de um link para
 * `http(s)` e as quatro propriedades de estilo listadas abaixo.
 */

const ALLOWED_TAGS = new Set([
  // ênfase
  'B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'BR', 'A',
  // estrutura mínima: parágrafos e listas, que o campo editável cria sozinho
  'P', 'DIV', 'UL', 'OL', 'LI',
]);

/** Cores permitidas em `style` — só a propriedade `color`, e nada mais. */
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\)|rgba\([\d\s,.%]+\)|[a-z-]+)$/i;

/**
 * Propriedades de estilo que sobrevivem.
 *
 * Só as quatro que dizem respeito à ênfase do texto. Texto colado do Word vem
 * com a ênfase em CSS (`font-weight: 700`) e não em `<b>`; sem isto, o negrito
 * do documento original se perderia na colagem.
 */
const STYLE_PROPS: Array<[prop: string, test: RegExp]> = [
  ['color', COLOR_RE],
  ['font-weight', /^(bold|bolder|[5-9]00)$/i],
  ['font-style', /^italic$/i],
  ['text-decoration-line', /^underline$/i],
];

function keptStyle(el: HTMLElement): string {
  const declarations: string[] = [];
  for (const [prop, test] of STYLE_PROPS) {
    const value = el.style.getPropertyValue(prop).trim();
    if (value && test.test(value)) declarations.push(`${prop}:${value}`);
  }
  return declarations.join(';');
}

export function sanitizeHtml(input: string): string {
  const template = document.createElement('template');
  template.innerHTML = input;
  clean(template.content);
  return template.innerHTML;
}

function clean(node: ParentNode): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;

    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }

    const el = child as HTMLElement;

    // `<font color>` é o que alguns navegadores ainda produzem ao pintar o
    // texto; vira o `<span style="color:…">` que sabemos guardar.
    if (el.tagName === 'FONT') {
      const color = el.getAttribute('color') || '';
      const span = document.createElement('span');
      if (COLOR_RE.test(color)) span.setAttribute('style', `color:${color}`);
      span.append(...el.childNodes);
      el.replaceWith(span);
      clean(span);
      continue;
    }

    if (!ALLOWED_TAGS.has(el.tagName)) {
      // mantém o texto, descarta a marcação
      el.replaceWith(...el.childNodes);
      continue;
    }

    const style = keptStyle(el);
    for (const attr of [...el.attributes]) {
      if (el.tagName === 'A' && attr.name === 'href' && /^https?:/i.test(attr.value)) continue;
      el.removeAttribute(attr.name);
    }
    if (style) el.setAttribute('style', style);

    if (el.tagName === 'A') {
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }

    clean(el);
  }
}

/** Versão em texto puro — usada em busca, compartilhamento e Modo Pregação. */
export function htmlToText(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? '').replace(/ /g, ' ').trim();
}
