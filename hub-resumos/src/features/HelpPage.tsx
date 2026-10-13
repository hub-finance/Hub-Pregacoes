import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageHeader } from '../components/ui';
import { useToast } from '../components/Toast';
import { createExampleMaterial } from '../core/example';

/** Cada aba do material: o que mostra, como usar e o que dá para baixar. */
export const TAB_HELP: Array<{ id: string; title: string; what: string; how: string[]; files?: string }> = [
  {
    id: 'painel',
    title: 'Painel',
    what: 'A visão geral do material: andamento, números, ideia central e atalhos para as outras visões.',
    how: ['Use os atalhos para ir direto ao que precisa.', 'Os números mostram partes, versículos, cartões para hoje e ações abertas.'],
  },
  {
    id: 'passos',
    title: 'Passo a passo',
    what: 'O material dividido em partes, uma por vez, com anotação sua em cada passo.',
    how: ['Toque em “Começar” ou “Continuar”.', 'Escreva a sua anotação e marque “Concluir” ao terminar a parte.', 'O app lembra onde você parou.'],
  },
  {
    id: 'dna',
    title: 'DNA',
    what: 'O que o texto tem de essencial: ideia central (escrita por você), destaques, definições, perguntas, versículos e palavras-chave.',
    how: ['Escreva a ideia central com as suas palavras.', 'O resto é lido do texto: “> ” marca destaque; “Termo: definição” entra no glossário; frases com “?” viram perguntas.'],
  },
  {
    id: 'mapa',
    title: 'Mapa mental',
    what: 'No centro, o material; em volta, os assuntos (cada parte do texto); ao tocar num assunto, abrem os desdobramentos dele, numerados.',
    how: [
      'Toque num assunto (ou no nome dele, acima do mapa) para abrir só ele; os outros ficam apagados.',
      'Toque num círculo para ler o trecho inteiro. Toque de novo no assunto, ou no centro, para voltar ao mapa completo.',
      '“Expandir tudo” abre todos de uma vez. Arraste para mover; use a roda do mouse, os dedos ou os botões ＋ e － para o zoom.',
      'As cores dizem o tipo: conceito, prática, base bíblica, pergunta ou desenvolvimento (veja a legenda).',
    ],
    files: 'Mapa interativo (.html, abre em qualquer navegador, sem internet) e imagem (PNG) com tudo aberto.',
  },
  {
    id: 'quadros',
    title: 'Quadros',
    what: 'O material em seis formatos de quadro, como imagem: DNA do livro, folha de consulta, mapa de conceitos, painel completo, fluxograma e cartões.',
    how: [
      'Escolha o modelo e as cores (papel ou azul e dourado).',
      'Tudo vem do próprio texto: cada parte vira um bloco, e frases longas aparecem encurtadas no quadro.',
      'Escrever a ideia central (aba DNA) e marcar destaques e definições deixa os quadros mais ricos.',
    ],
    files: 'Imagem PNG de cada quadro, compartilhamento, ou os seis num arquivo .zip.',
  },
  {
    id: 'cartoes',
    title: 'Cartões',
    what: 'Perguntas e respostas para memorizar, com revisão espaçada: o que você erra volta logo, o que acerta volta depois.',
    how: ['Toque em “Sugerir cartões do texto”, escolha os que quer e guarde.', 'Revise um pouco por dia em “Revisar agora” ou no menu Revisar.'],
  },
  {
    id: 'consulta',
    title: 'Consulta rápida',
    what: 'Uma folha única com estrutura, glossário, versículos, perguntas e ações abertas — para ter à mão.',
    how: ['Use “Imprimir / salvar em PDF” para guardar em PDF.', '“Copiar como texto” para colar em mensagem ou documento.'],
    files: 'PDF (pelo “Imprimir”) e texto.',
  },
  {
    id: 'acoes',
    title: 'Plano de ação',
    what: 'O que fazer com o que foi estudado: ação, responsável, prazo e situação.',
    how: ['“Sugerir ações” lê partes com título como “Aplicação” ou “Desafio” e as linhas “- [ ] …”.', 'Mude a situação conforme avança.'],
  },
  {
    id: 'resumo',
    title: 'Resumo',
    what: 'As frases mais importantes do próprio texto, em três tamanhos. Nada é reescrito.',
    how: ['Escolha curto, médio ou longo.', '“Salvar como novo resumo” cria um material do tipo resumo para você completar.'],
    files: 'Texto (.md) e cópia.',
  },
  {
    id: 'infografico',
    title: 'Infográfico',
    what: 'Uma imagem com título, ideia central, números e os pontos de cada parte, para compartilhar.',
    how: ['Escolha o formato (retrato ou quadrado) e as cores.'],
    files: 'Imagem PNG e compartilhamento.',
  },
  {
    id: 'editar',
    title: 'Editar',
    what: 'O texto do material, parte por parte, e as informações dele.',
    how: ['Um título por parte; as marcações (“> ”, “- ”, “Termo: definição”) alimentam as outras visões.', 'Aqui também ficam Duplicar, Excluir e “Enviar para o Hub Bible”.'],
    files: 'Arquivo para o Hub Bible (estudo do Rhema).',
  },
];

const FAQ: Array<[string, string]> = [
  ['Como excluo um material?', 'Na biblioteca, no cartão do material, toque no ícone de lixeira. Só aquele material sai (com o andamento, os cartões e as ações dele); a biblioteca e os outros materiais continuam. Também dá para excluir na aba Editar.'],
  ['Posso baixar o que criei e usar de novo?', 'Sim. No cartão do material, o ícone de baixar gera um arquivo .json com o material, o andamento, os cartões e as ações. Para usar de novo (neste ou em outro aparelho), vá em Novo material › Importar arquivo e escolha esse arquivo. Cada visão também tem o seu arquivo: mapa (.html e PNG), quadros (PNG ou .zip), infográfico (PNG), consulta rápida (PDF), resumo (.md).'],
  ['Onde ficam os meus dados?', 'Só neste aparelho, no próprio navegador. Não há conta nem servidor. Para não perder nada, faça a cópia de segurança em Dados e ajustes.'],
  ['Funciona sem internet?', 'Sim, depois de aberto uma vez. Instale pelo menu do navegador (“Instalar app” ou “Adicionar à tela inicial”).'],
  ['O app inventa conteúdo?', 'Não. Tudo o que aparece nas visões sai do texto que você trouxe. O que não está no texto (como a ideia central) é você quem escreve.'],
  ['Como uso com o Hub Bible?', 'Para trazer: no Hub Bible, exporte os dados; aqui, Novo material › Do Hub Bible. Para levar: na aba Editar, “Enviar para o Hub Bible” gera um arquivo que o Hub Bible restaura como estudo do Rhema. Os versículos abrem no Hub Bible se o endereço estiver em Dados e ajustes.'],
];

export default function HelpPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const topic = params.get('t');

  useEffect(() => {
    if (!topic) return;
    const el = document.getElementById(`ajuda-${topic}`);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      if (el instanceof HTMLDetailsElement) el.open = true;
    }
  }, [topic]);

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Biblioteca', to: '/' }, { label: 'Ajuda' }]} />
      <PageHeader title="Ajuda" lead="Como o Hub Resumos organiza um livro, estudo ou resumo — e como tirar proveito de cada visão." />

      <section className="card stack" id="ajuda-comecar">
        <h2 className="xr-h2">Comece em 3 passos</h2>
        <ol className="xr-help-ol">
          <li>
            <strong>Traga um material.</strong> Em “Novo material”, cole o texto, importe PDF, Word, .txt ou .md, ou traga do Hub Bible.
          </li>
          <li>
            <strong>Estude no passo a passo.</strong> Uma parte por vez, com a sua anotação. O app guarda onde você parou.
          </li>
          <li>
            <strong>Fixe e pratique.</strong> Crie cartões e revise um pouco por dia; monte o plano de ação; use o mapa mental e a consulta rápida para rever.
          </li>
        </ol>
        <div className="row row-wrap">
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              const m = await createExampleMaterial();
              notify('Exemplo criado. Percorra as abas para ver cada visão.');
              navigate(`/m/${m.id}`);
            }}
          >
            Ver um exemplo pronto
          </button>
          <button className="btn btn-sm" onClick={() => navigate('/')}>
            Ir para a biblioteca
          </button>
        </div>
      </section>

      <section className="card stack" id="ajuda-marcacoes">
        <h2 className="xr-h2">Como escrever o texto para o app entender</h2>
        <dl className="xr-glossary">
          <dt># Título</dt>
          <dd>Começa uma nova parte (também valem “CAPÍTULO 1”, “Lição 2”).</dd>
          <dt>&gt; frase</dt>
          <dd>Destaque: a ideia que não pode ser esquecida.</dd>
          <dt>Termo: definição</dt>
          <dd>Entra no glossário e vira cartão.</dd>
          <dt>- item</dt>
          <dd>Lista. Numa parte chamada “Aplicação”, vira sugestão de ação.</dd>
          <dt>- [ ] tarefa</dt>
          <dd>Ação para o plano de ação.</dd>
          <dt>Frase com “?”</dt>
          <dd>Pergunta para reflexão.</dd>
          <dt>João 3:16, Ef 2.8-9</dt>
          <dd>Referências bíblicas são reconhecidas sozinhas.</dd>
        </dl>
      </section>

      <h2 className="xr-h2" style={{ marginTop: 'var(--sp-5)' }}>
        As visões do material
      </h2>
      <div className="stack" style={{ gap: 'var(--sp-2)' }}>
        {TAB_HELP.map((t) => (
          <details key={t.id} id={`ajuda-${t.id}`} className="card xr-help-item" open={topic === t.id}>
            <summary>{t.title}</summary>
            <p>{t.what}</p>
            <ul>
              {t.how.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            {t.files && (
              <p className="small">
                <strong>Para baixar:</strong> {t.files}
              </p>
            )}
          </details>
        ))}
      </div>

      <h2 className="xr-h2" style={{ marginTop: 'var(--sp-5)' }}>
        Perguntas frequentes
      </h2>
      <div className="stack" style={{ gap: 'var(--sp-2)' }}>
        {FAQ.map(([q, a]) => (
          <details key={q} className="card xr-help-item">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
