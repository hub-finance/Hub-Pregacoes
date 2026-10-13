/**
 * Do HTML guardado nos blocos para trechos de texto com formatação.
 *
 * O conteúdo dos blocos já passou pelo `sanitizeHtml`: só chegam aqui ênfase,
 * sublinhado, cor, link, parágrafos, listas e quebras de linha. Esta leitura
 * é feita sem o DOM de propósito — os geradores de Word e PDF rodam também
 * fora da tela (nos testes), e o resultado precisa ser o mesmo nos dois lados.
 *
 * Qualquer marcação que não esteja na lista é ignorada e o texto de dentro
 * permanece: nada do que o autor escreveu se perde na conversão.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Cor em hexadecimal, sem o `#` (o formato que o Word espera). */
  color?: string;
  link?: string;
}

/** Um parágrafo: trechos em sequência. `\n` dentro de um trecho é quebra de linha. */
export type Para = Run[];

export type Segment =
  | { kind: 'para'; runs: Para }
  | { kind: 'list'; ordered: boolean; items: Para[] };

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

const NAMED_COLORS: Record<string, string> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  gray: '808080',
  grey: '808080',
  navy: '000080',
  maroon: '800000',
  purple: '800080',
  teal: '008080',
  olive: '808000',
  orange: 'FFA500',
  brown: 'A52A2A',
};

/** Normaliza uma cor de CSS para `RRGGBB`. Devolve `undefined` se não reconhecer. */
export function toHexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return m[1].split('').map((c) => c + c).join('').toUpperCase();
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) return m[1].toUpperCase();
  m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(v);
  if (m) {
    return [m[1], m[2], m[3]]
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return NAMED_COLORS[v];
}

interface Frame {
  tag: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  link?: string;
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : undefined;
}

function frameFor(tag: string, attrs: string): Frame {
  const frame: Frame = { tag };
  if (tag === 'b' || tag === 'strong') frame.bold = true;
  if (tag === 'i' || tag === 'em') frame.italic = true;
  if (tag === 'u') frame.underline = true;
  if (tag === 'a') {
    const href = attr(attrs, 'href');
    if (href && /^https?:/i.test(href)) frame.link = href;
  }
  const style = attr(attrs, 'style');
  if (style) {
    for (const decl of style.split(';')) {
      const [prop, ...rest] = decl.split(':');
      const value = rest.join(':').trim();
      switch (prop?.trim().toLowerCase()) {
        case 'color':
          frame.color = toHexColor(value);
          break;
        case 'font-weight':
          if (/^(bold|bolder|[5-9]00)$/i.test(value)) frame.bold = true;
          break;
        case 'font-style':
          if (/italic/i.test(value)) frame.italic = true;
          break;
        case 'text-decoration':
        case 'text-decoration-line':
          if (/underline/i.test(value)) frame.underline = true;
          break;
      }
    }
  }
  return frame;
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);

/**
 * Lê o HTML de um bloco e devolve parágrafos e listas, na ordem em que vêm.
 */
export function parseBlockHtml(html: string): Segment[] {
  const segments: Segment[] = [];
  const stack: Frame[] = [];
  let para: Run[] = [];
  /** Listas abertas; listas dentro de listas são achatadas no item de fora. */
  const lists: Array<{ ordered: boolean; items: Para[]; item: Run[] | null }> = [];

  const current = (): Run[] => {
    const list = lists[lists.length - 1];
    if (list) {
      if (!list.item) list.item = [];
      return list.item;
    }
    return para;
  };

  const style = () => {
    const out: Omit<Run, 'text'> = {};
    for (const f of stack) {
      if (f.bold) out.bold = true;
      if (f.italic) out.italic = true;
      if (f.underline) out.underline = true;
      if (f.color) out.color = f.color;
      if (f.link) out.link = f.link;
    }
    return out;
  };

  const pushText = (text: string) => {
    if (!text) return;
    const target = current();
    const s = style();
    const last = target[target.length - 1];
    if (
      last &&
      last.text !== '\n' &&
      last.bold === s.bold &&
      last.italic === s.italic &&
      last.underline === s.underline &&
      last.color === s.color &&
      last.link === s.link
    ) {
      last.text += text;
    } else {
      target.push({ text, ...s });
    }
  };

  const flushPara = () => {
    const runs = tidy(para);
    if (runs.length) segments.push({ kind: 'para', runs });
    para = [];
  };

  const closeItem = () => {
    const list = lists[lists.length - 1];
    if (!list?.item) return;
    const runs = tidy(list.item);
    if (runs.length) list.items.push(runs);
    list.item = null;
  };

  const re = /<!--[\s\S]*?-->|<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      // espaços do código-fonte do HTML valem um espaço só, como no navegador
      pushText(decodeEntities(m[4].replace(/[\r\n\t ]+/g, ' ')));
      continue;
    }
    if (!m[2]) continue;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';

    if (tag === 'br') {
      current().push({ text: '\n' });
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (closing) {
        closeItem();
        const list = lists.pop();
        if (list && lists.length) {
          // lista dentro de lista: os itens viram linhas do item de fora
          const outer = lists[lists.length - 1];
          if (!outer.item) outer.item = [];
          for (const item of list.items) {
            if (outer.item.length) outer.item.push({ text: '\n' });
            outer.item.push({ text: '– ' }, ...item);
          }
        } else if (list?.items.length) {
          segments.push({ kind: 'list', ordered: list.ordered, items: list.items });
        }
      } else {
        if (!lists.length) flushPara();
        lists.push({ ordered: tag === 'ol', items: [], item: null });
      }
      continue;
    }
    if (tag === 'li') {
      if (closing) closeItem();
      else {
        closeItem();
        const list = lists[lists.length - 1];
        if (list) list.item = [];
      }
      continue;
    }
    if (BLOCK_TAGS.has(tag)) {
      if (lists.length) {
        // parágrafo dentro de item de lista: vira quebra de linha no item
        const item = current();
        if (item.length && closing === false) item.push({ text: '\n' });
      } else {
        flushPara();
      }
      continue;
    }
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
    } else if (!/\/\s*$/.test(attrs)) {
      stack.push(frameFor(tag, attrs));
    }
  }

  while (lists.length) {
    closeItem();
    const list = lists.pop();
    if (list?.items.length && !lists.length) {
      segments.push({ kind: 'list', ordered: list.ordered, items: list.items });
    }
  }
  flushPara();
  return segments;
}

/**
 * Tira espaços e quebras sobrando nas pontas do parágrafo e funde quebras
 * repetidas — o campo editável deixa `<br>` no fim de quase toda linha.
 */
export function tidy(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    if (run.text === '\n') {
      // no máximo uma linha em branco seguida
      const breaks = out.length - 1 - findLastIndex(out, (r) => r.text !== '\n');
      if (breaks < 2) out.push({ text: '\n' });
      continue;
    }
    out.push({ ...run });
  }
  while (out.length && (out[0].text === '\n' || !out[0].text.trim())) out.shift();
  while (out.length && (out[out.length - 1].text === '\n' || !out[out.length - 1].text.trim())) out.pop();
  if (out.length) {
    out[0].text = out[0].text.replace(/^\s+/, '');
    const last = out[out.length - 1];
    last.text = last.text.replace(/\s+$/, '');
  }
  // espaço logo depois de uma quebra de linha não tem função nenhuma
  for (let i = 1; i < out.length; i++) {
    if (out[i - 1].text === '\n') out[i].text = out[i].text.replace(/^ +/, '');
  }
  return out.filter((r) => r.text.length > 0);
}

function findLastIndex<T>(list: T[], test: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (test(list[i])) return i;
  return -1;
}

export const plainOf =(runs: Run[]): string => runs.map((r) => r.text).join('');

/** Divide os trechos de um parágrafo em linhas, nas quebras. */
export function splitLines(runs: Run[]): Run[][] {
  const lines: Run[][] = [[]];
  for (const run of runs) {
    if (run.text === '\n') lines.push([]);
    else lines[lines.length - 1].push(run);
  }
  return lines;
}

/** Trecho simples, sem formatação. */
export const textRuns = (text: string): Para => {
  const out: Run[] = [];
  text.split('\n').forEach((line, i) => {
    if (i) out.push({ text: '\n' });
    if (line) out.push({ text: line });
  });
  return out;
};
