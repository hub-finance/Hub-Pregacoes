/**
 * Leitor de arquivos SQLite, somente leitura, direto no navegador.
 *
 * Por que não uma biblioteca: o app precisa disso para abrir módulos do MyBible
 * (`.SQLite3`) que o usuário já tem no aparelho — uma varredura de tabela e
 * nada mais. As bibliotecas prontas são WebAssembly de ~1,2 MB, que teria de
 * entrar no cache do PWA para a importação também funcionar offline; é mais
 * peso permanente do que o recurso vale. Aqui só o formato do arquivo é lido:
 * cabeçalho, árvore-B de tabela, registros e páginas de transbordo.
 *
 * O que **não** está implementado, de propósito: SQL, índices, WAL não
 * consolidado e escrita. Nada disso é necessário para ler um módulo.
 *
 * Referência do formato: https://www.sqlite.org/fileformat2.html
 */

export type SqlValue = string | number | Uint8Array | null;

const MAGIC = 'SQLite format 3\0';

/* Tipos de página da árvore-B. */
const INTERIOR_TABLE = 5;
const LEAF_TABLE = 13;

export class SQLiteFile {
  private readonly data: Uint8Array;
  private readonly view: DataView;
  /** Tamanho da página, incluindo a área reservada do fim. */
  private readonly pageSize: number;
  /** Bytes de fato utilizáveis por página (`pageSize` menos a reserva). */
  private readonly usable: number;
  private readonly utf16: false | 'le' | 'be';
  private readonly schema = new Map<string, { rootPage: number; columns: string[] }>();

  private constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const raw = this.view.getUint16(16);
    this.pageSize = raw === 1 ? 65536 : raw;
    this.usable = this.pageSize - this.data[20];

    const encoding = this.view.getUint32(56);
    this.utf16 = encoding === 2 ? 'le' : encoding === 3 ? 'be' : false;

    this.readSchema();
  }

  static open(buffer: ArrayBuffer | Uint8Array): SQLiteFile {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (data.byteLength < 512) throw new Error('Arquivo pequeno demais para ser um banco SQLite.');
    const header = new TextDecoder('latin1').decode(data.subarray(0, 16));
    if (header !== MAGIC) throw new Error('O arquivo não é um banco SQLite.');
    return new SQLiteFile(data);
  }

  /** Nomes das tabelas do arquivo. */
  tables(): string[] {
    return [...this.schema.keys()];
  }

  columns(table: string): string[] {
    return this.schema.get(table.toLowerCase())?.columns ?? [];
  }

  has(table: string): boolean {
    return this.schema.has(table.toLowerCase());
  }

  /**
   * Percorre a tabela inteira, na ordem de rowid. Devolve uma linha por vez —
   * um módulo com 31 mil versículos nunca precisa existir todo em memória
   * como objetos JavaScript.
   */
  *rows(table: string): Generator<Record<string, SqlValue>> {
    const entry = this.schema.get(table.toLowerCase());
    if (!entry) throw new Error(`Tabela "${table}" não existe no arquivo.`);
    for (const record of this.scan(entry.rootPage)) {
      const row: Record<string, SqlValue> = {};
      entry.columns.forEach((name, i) => {
        row[name] = i < record.length ? record[i] : null;
      });
      yield row;
    }
  }

  /* ------------------------------- esquema ------------------------------- */

  private readSchema() {
    // sqlite_master: type, name, tbl_name, rootpage, sql
    for (const record of this.scan(1)) {
      const [type, name, , rootPage, sql] = record;
      if (type !== 'table' || typeof name !== 'string' || typeof rootPage !== 'number') continue;
      if (name.startsWith('sqlite_')) continue;
      this.schema.set(name.toLowerCase(), {
        rootPage,
        columns: columnsFromCreate(typeof sql === 'string' ? sql : ''),
      });
    }
  }

  /* ----------------------------- árvore-B -------------------------------- */

  /** Folhas da árvore de uma tabela, em ordem. */
  private *scan(rootPage: number): Generator<SqlValue[]> {
    /* Pilha explícita em vez de recursão: uma Bíblia com números Strong passa
       de 16 MB, e a profundidade da árvore não é conhecida de antemão. */
    const stack: number[] = [rootPage];
    const seen = new Set<number>();

    while (stack.length) {
      const page = stack.pop()!;
      if (page < 1 || seen.has(page)) continue; // um ponteiro em ciclo travaria o app
      seen.add(page);

      const base = (page - 1) * this.pageSize;
      // a página 1 começa com os 100 bytes do cabeçalho do arquivo
      const headerAt = page === 1 ? base + 100 : base;
      if (headerAt + 12 > this.data.length) continue;

      const type = this.data[headerAt];
      const cells = this.view.getUint16(headerAt + 3);
      const pointerArray = headerAt + (type === INTERIOR_TABLE ? 12 : 8);

      if (type === INTERIOR_TABLE) {
        // empilha da direita para a esquerda para sair na ordem de rowid
        stack.push(this.view.getUint32(headerAt + 8));
        for (let i = cells - 1; i >= 0; i--) {
          const at = base + this.view.getUint16(pointerArray + i * 2);
          stack.push(this.view.getUint32(at));
        }
        continue;
      }

      if (type !== LEAF_TABLE) continue; // índices não interessam aqui

      const records: SqlValue[][] = [];
      for (let i = 0; i < cells; i++) {
        const at = base + this.view.getUint16(pointerArray + i * 2);
        records.push(this.readLeafCell(at));
      }
      for (const record of records) yield record;
    }
  }

  private readLeafCell(at: number): SqlValue[] {
    let p = at;
    const [payloadSize, n1] = this.varint(p);
    p += n1;
    const [, n2] = this.varint(p); // rowid — não é usado
    p += n2;

    const payload = this.readPayload(p, payloadSize);
    return this.decodeRecord(payload);
  }

  /**
   * Junta a parte da carga que ficou na página com as páginas de transbordo.
   * As contas de `maxLocal`/`minLocal` são as do próprio formato — mudá-las
   * desalinha o registro inteiro.
   */
  private readPayload(at: number, size: number): Uint8Array {
    const maxLocal = this.usable - 35;
    if (size <= maxLocal) return this.data.subarray(at, at + size);

    const minLocal = Math.floor(((this.usable - 12) * 32) / 255) - 23;
    let local = minLocal + ((size - minLocal) % (this.usable - 4));
    if (local > maxLocal) local = minLocal;

    const out = new Uint8Array(size);
    out.set(this.data.subarray(at, at + local), 0);
    let filled = local;
    let next = this.view.getUint32(at + local);

    const guard = new Set<number>();
    while (next && filled < size && !guard.has(next)) {
      guard.add(next);
      const base = (next - 1) * this.pageSize;
      if (base + 4 > this.data.length) break;
      const chunk = Math.min(this.usable - 4, size - filled);
      out.set(this.data.subarray(base + 4, base + 4 + chunk), filled);
      filled += chunk;
      next = this.view.getUint32(base);
    }
    return out;
  }

  /* ------------------------------ registro ------------------------------- */

  private decodeRecord(payload: Uint8Array): SqlValue[] {
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const [headerSize, n] = varintAt(payload, 0);
    const serials: number[] = [];
    let p = n;
    while (p < headerSize) {
      const [serial, used] = varintAt(payload, p);
      serials.push(serial);
      p += used;
    }

    const values: SqlValue[] = [];
    let at = headerSize;
    for (const serial of serials) {
      const [value, size] = this.readValue(payload, view, at, serial);
      values.push(value);
      at += size;
    }
    return values;
  }

  private readValue(
    payload: Uint8Array,
    view: DataView,
    at: number,
    serial: number,
  ): [SqlValue, number] {
    switch (serial) {
      case 0:
        return [null, 0];
      case 1:
        return [view.getInt8(at), 1];
      case 2:
        return [view.getInt16(at), 2];
      case 3:
        return [(view.getInt8(at) << 16) | view.getUint16(at + 1), 3];
      case 4:
        return [view.getInt32(at), 4];
      case 5:
        return [view.getInt16(at) * 2 ** 32 + view.getUint32(at + 2), 6];
      case 6:
        return [Number(view.getBigInt64(at)), 8];
      case 7:
        return [view.getFloat64(at), 8];
      case 8:
        return [0, 0];
      case 9:
        return [1, 0];
      default: {
        if (serial < 12) return [null, 0]; // 10 e 11 são reservados
        const size = (serial - (serial % 2 === 0 ? 12 : 13)) / 2;
        const bytes = payload.subarray(at, at + size);
        if (serial % 2 === 0) return [bytes, size];
        return [this.decodeText(bytes), size];
      }
    }
  }

  private decodeText(bytes: Uint8Array): string {
    if (!this.utf16) return UTF8.decode(bytes);
    return (this.utf16 === 'le' ? UTF16LE : UTF16BE).decode(bytes);
  }

  private varint(at: number): [number, number] {
    return varintAt(this.data, at);
  }
}

const UTF8 = new TextDecoder('utf-8');
const UTF16LE = new TextDecoder('utf-16le');
const UTF16BE = new TextDecoder('utf-16be');

/**
 * Inteiro de tamanho variável: até nove bytes, sete bits úteis em cada um,
 * o bit alto dizendo se há continuação. O nono byte entrega os oito bits.
 */
function varintAt(data: Uint8Array, at: number): [value: number, size: number] {
  let value = 0;
  for (let i = 0; i < 8; i++) {
    const byte = data[at + i];
    if (byte === undefined) return [value, i];
    if (i === 7) return [value * 256 + byte, 9];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return [value, i + 1];
  }
  return [value, 9];
}

/**
 * Nomes das colunas a partir do `CREATE TABLE` guardado no esquema.
 *
 * Não é um analisador de SQL: separa a lista entre os parênteses externos nas
 * vírgulas de primeiro nível e fica com o primeiro identificador de cada parte,
 * ignorando as linhas que são restrição e não coluna. Dá conta das definições
 * simples dos módulos do MyBible, que é o caso de uso.
 */
export function columnsFromCreate(sql: string): string[] {
  const open = sql.indexOf('(');
  const close = sql.lastIndexOf(')');
  if (open < 0 || close < open) return [];

  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let quote: string | null = null;

  for (const ch of sql.slice(open + 1, close)) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  const CONSTRAINTS = /^(constraint|primary|unique|check|foreign|key)$/i;
  const columns: string[] = [];
  for (const part of parts) {
    const name = part.trim().match(/^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/);
    if (!name) continue;
    const found = name[1] ?? name[2] ?? name[3] ?? name[4];
    if (CONSTRAINTS.test(found)) continue;
    columns.push(found);
  }
  return columns;
}
