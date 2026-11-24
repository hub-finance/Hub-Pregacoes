import { HAS_RHEMA } from './edition';

/**
 * Novidades — o que mudou em cada atualização, em palavras do usuário.
 *
 * Depois de atualizar, a tela de Novidades abre uma vez com as entradas que
 * ainda não foram vistas. Para acrescentar uma: ponha a nova NO TOPO, com um
 * `id` novo (nunca reaproveite), e escreva o que a pessoa vê e onde tocar.
 * `full: true` marca o que só existe na edição completa (Rhema, Escola).
 */

export interface WhatsNewItem {
  title: string;
  text: string;
  full?: boolean;
}

export interface WhatsNewEntry {
  id: string;
  title: string;
  /** Título na edição 2.0, quando o normal cita algo que só existe na completa. */
  reducedTitle?: string;
  items: WhatsNewItem[];
}

const ENTRIES: WhatsNewEntry[] = [
  {
    id: '2026-11-25-temas',
    title: 'Dois temas novos',
    items: [
      {
        title: 'Marinho e ouro e Preto e amarelo',
        text: 'Em "Aa" ou em Configurações › Aparência e leitura. Saíram o Escuro, o Azul e branco e o Verde e branco; quem usava um deles passou para o mais parecido (Preto, Azul safira e Esmeralda).',
      },
    ],
  },
  {
    id: '2026-11-24-leitor',
    title: 'Leitura melhor de livros e apostilas',
    items: [
      {
        title: 'O assistente segue a sua base doutrinária',
        text: 'Agora a sua base entra também nos pedidos por tema, sem versículo ("Estude a unção", "a autoridade do crente"), e em todas as passagens do pedido. Sem IA aparece "Na sua linha doutrinária"; com IA, ela orienta a interpretação.',
      },
      {
        title: 'A base doutrinária soma, não substitui',
        text: 'Em Guias Doutrinários, "Acrescentar" junta os guias de um arquivo novo aos que você já tem; um guia repetido é atualizado. Para tirar um só, abra o guia e toque em "Remover este guia".',
      },
      {
        title: 'Word antigo (.doc)',
        text: 'No assistente, "Importar PDF ou Word" agora aceita também o .doc, o formato antigo do Word em que circulam muitos e-books.',
      },
      {
        title: 'Livros mais bem divididos e mais versículos reconhecidos',
        text: 'Os cabeçalhos repetidos das páginas saem, os capítulos são achados mesmo com o título quebrado, e referências como "Romanos 5. 17", "I Coríntios" e "SI 23" (livro escaneado) passam a ser reconhecidas.',
      },
    ],
  },
  {
    id: '2026-11-22-novidades',
    title: 'Tela de Novidades',
    items: [
      {
        title: 'Novidades depois de cada atualização',
        text: 'Esta tela aparece uma vez sempre que o aplicativo for atualizado, com o que mudou. Para ver de novo: Configurações › Sobre › Novidades.',
      },
    ],
  },
  {
    id: '2026-11-22',
    title: 'Salmos, Estudo guiado e atualização segura',
    items: [
      {
        title: 'Títulos dos Salmos',
        text: 'O título ("Salmo de Davi, quando fugia de Absalão…") aparece acima do salmo, em itálico, separado do versículo 1. Vale também para as Bíblias que você importou.',
      },
      {
        title: 'Aprofundar no assistente',
        text: 'Toque no versículo › Análise: as análises continuam no alto, e no rodapé "Aprofundar no assistente" abre o assistente com a passagem e o pedido preenchidos. Sem chave de IA, as opções continuam à vista e as análises salvas abrem.',
      },
      {
        title: 'Aviso de Atenção antes de atualizar (aplicativo Android)',
        text: 'Quando sair versão nova, o app avisa no alto. Ao tocar em Atualizar, a tela de Atenção lembra o backup e pede para instalar por cima, sem desinstalar.',
      },
      {
        title: 'Guia "Como atualizar sem perder nada"',
        text: 'Em PDF, na Ajuda, para guardar ou enviar.',
      },
      {
        title: 'Ajuda em dia',
        text: 'A Ajuda explica tudo isso, e o Manual completo agora acompanha a Ajuda.',
      },
    ],
  },
  {
    id: '2026-11-21',
    title: 'Tema Preto e Escola de Ministros',
    reducedTitle: 'Tema Preto e backup por item',
    items: [
      {
        title: 'Tema Preto',
        text: 'Para ler à noite: quase preto, com as letras e os botões em relevo leve. Em "Aa" ou em Configurações › Aparência e leitura.',
      },
      {
        title: 'Escola de Ministros',
        text: 'Uma aba igual ao Rhema, com as apostilas da Escola guardadas à parte e o Modo Aula.',
        full: true,
      },
      {
        title: 'Backup escolhido item por item',
        text: 'Em Configurações › Backup e privacidade › "O que levar na cópia". Backups grandes não fecham mais o aplicativo.',
      },
      {
        title: 'Manual do iPhone e do iPad',
        text: 'Passo a passo em PDF, com QR Code, na Ajuda.',
      },
    ],
  },
];

const SEEN_KEY = 'hub-bible:novidades:visto';
/** As configurações já gravadas indicam alguém que usava o app antes desta versão. */
const SETTINGS_KEY = 'hub-bible:appearance';

function visible(entry: WhatsNewEntry): WhatsNewEntry {
  if (HAS_RHEMA) return entry;
  return { ...entry, title: entry.reducedTitle ?? entry.title, items: entry.items.filter((i) => !i.full) };
}

/** Todas as novidades, da mais nova para a mais antiga (para a página). */
export function allWhatsNew(): WhatsNewEntry[] {
  return ENTRIES.map(visible).filter((e) => e.items.length > 0);
}

/**
 * O que mostrar ao abrir: as entradas ainda não vistas. Quem nunca viu
 * nenhuma recebe só as duas mais recentes; quem acabou de instalar não recebe
 * nada (para quem chega agora, tudo é novo — a Ajuda é o lugar dele).
 */
export function unseenWhatsNew(): WhatsNewEntry[] {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    const entries = allWhatsNew();
    if (!seen) {
      if (!localStorage.getItem(SETTINGS_KEY)) {
        markWhatsNewSeen();
        return [];
      }
      return entries.slice(0, 2);
    }
    const index = entries.findIndex((e) => e.id === seen);
    return index === -1 ? entries.slice(0, 2) : entries.slice(0, index);
  } catch {
    return [];
  }
}

export function markWhatsNewSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, ENTRIES[0].id);
  } catch {
    /* armazenamento indisponível: a tela volta na próxima abertura, sem prejuízo */
  }
}
