import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { SermonTimer } from './SermonTimer';
import { ScripturePane } from './ScripturePane';
import { DocumentViewer } from '../common/DocumentViewer';
import { getAttachment } from '../../core/data/attachments';
import { EmptyState, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { bookName } from '../../core/bible/canon';
import { parseReference } from '../../core/bible/reference';
import { getChapter } from '../../core/bible/repository';
import { getDoc, listDocs } from '../../core/data/documents';
import { groupBlocks, htmlToPlain } from '../../core/data/sermonContent';
import { sanitizeHtml } from '../../core/sanitizeHtml';
import type { Sermon, SermonBlock } from '../../core/db/types';

interface Step {
  label: string;
  title?: string;
  scripture?: { text: string; reference: string };
  paragraphs: string[];
  /** Sermão montado em blocos: prega-se com a formatação com que foi escrito. */
  blocks?: SermonBlock[];
}

/**
 * Um bloco do sermão na tela de pregação, com a formatação com que foi escrito.
 * O HTML já foi limpo ao ser gravado; passa pelo `sanitizeHtml` de novo aqui
 * porque exibir conteúdo guardado sem conferir é como não ter conferido nunca.
 */
function PreachBlock({ block }: { block: SermonBlock }) {
  const html = { __html: sanitizeHtml(block.html) };
  if (block.type === 'scripture') {
    return (
      <blockquote className="pb-scripture">
        <span dangerouslySetInnerHTML={html} />
        {block.reference && <cite>{block.reference}</cite>}
      </blockquote>
    );
  }
  if (block.type === 'highlight') return <div className="pb-highlight" dangerouslySetInnerHTML={html} />;
  if (block.type === 'list') return <div className="pb-list" dangerouslySetInnerHTML={html} />;
  return <p dangerouslySetInnerHTML={html} />;
}

/** Rótulo curto para a barra de passos — o subtítulo inteiro não cabe. */
const shortLabel = (value: string, fallback: string) => {
  const text = value.trim();
  if (!text) return fallback;
  return text.length > 22 ? `${text.slice(0, 21)}…` : text;
};

/**
 * MODO PREGAÇÃO — tela cheia, poucos elementos, texto grande.
 * Serve tanto para acompanhar um sermão preparado quanto para projetar a
 * leitura de um capítulo durante a mensagem.
 */
export default function PreachingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const [index, setIndex] = useState(0);
  const [split, setSplit] = useState(false);

  const refParam = params.get('ref');
  const parsed = refParam ? parseReference(refParam) : null;

  const sermon = useAsync(
    () => (id ? getDoc<Sermon>('sermon', id) : Promise.resolve(undefined)),
    [id],
  );
  const chapter = useAsync(
    () =>
      parsed
        ? getChapter(settings.defaultTranslation, parsed.book, parsed.chapter)
        : Promise.resolve<string[]>([]),
    [parsed?.book, parsed?.chapter, settings.defaultTranslation],
  );
  const sermons = useLiveQuery(() => listDocs<Sermon>('sermon'), [], [] as Sermon[]);
  // sermão que chegou pronto em arquivo: prega-se a partir dele, como está
  const attachment = useAsync(
    () =>
      sermon.data?.attachmentId
        ? getAttachment(sermon.data.attachmentId)
        : Promise.resolve(undefined),
    [sermon.data?.attachmentId],
  );

  /* --------------------------- montagem dos passos ------------------------ */

  const steps = useMemo<Step[]>(() => {
    if (sermon.data) {
      const doc = sermon.data;
      const list: Step[] = [];
      list.push({
        label: 'Título',
        title: doc.title || 'Sermão',
        paragraphs: [doc.theme, doc.mainText].filter(Boolean) as string[],
        scripture: doc.mainTextContent
          ? { text: doc.mainTextContent, reference: doc.mainText }
          : undefined,
      });
      // sermão montado em blocos: cada seção é um passo, com o que vem sob ela
      groupBlocks(doc.content ?? []).forEach((part, i) => {
        const scripture = part.blocks.find((b) => b.type === 'scripture' && b.reference);
        list.push({
          label: shortLabel(part.title, `Parte ${i + 1}`),
          title: part.title || undefined,
          paragraphs: [],
          blocks: part.blocks,
          scripture: scripture
            ? { text: htmlToPlain(scripture.html), reference: scripture.reference ?? '' }
            : undefined,
        });
      });

      if (doc.introduction) list.push({ label: 'Introdução', title: 'Introdução', paragraphs: [doc.introduction] });

      // o desenvolvimento é um texto só: quebra em parágrafos vira um passo cada,
      // para o pregador avançar no ritmo da fala
      doc.development
        ?.split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part, i, all) => {
          list.push({
            label: all.length > 1 ? `Desenv. ${i + 1}` : 'Desenvolvimento',
            title: i === 0 ? 'Desenvolvimento' : undefined,
            paragraphs: [part],
          });
        });

      // sermões do formato antigo continuam pregáveis
      (doc.blocks ?? []).forEach((block, i) => {
        if (!block.title && !block.comment && !block.scripture) return;
        list.push({
          label: `${i + 1}. ${block.title || 'Ponto'}`,
          title: `${i + 1}. ${block.title || 'Ponto'}`,
          scripture: block.scriptureText
            ? { text: block.scriptureText, reference: block.scripture }
            : undefined,
          paragraphs: [block.comment, block.application].filter(Boolean),
        });
      });

      if (doc.conclusion) list.push({ label: 'Conclusão', title: 'Conclusão', paragraphs: [doc.conclusion] });
      if (doc.application) list.push({ label: 'Aplicação', title: 'Aplicação', paragraphs: [doc.application] });
      if (doc.appeal) list.push({ label: 'Apelo', title: 'Apelo', paragraphs: [doc.appeal] });
      return list;
    }

    if (parsed && chapter.data?.length) {
      const verses = chapter.data;
      const perStep = 4;
      const list: Step[] = [];
      for (let start = 0; start < verses.length; start += perStep) {
        const slice = verses.slice(start, start + perStep);
        const from = start + 1;
        const to = start + slice.length;
        list.push({
          label: `${from}-${to}`,
          scripture: {
            text: slice.map((t, i) => `${from + i} ${t}`).join(' '),
            reference: `${bookName(parsed.book)} ${parsed.chapter}:${from}${to > from ? `-${to}` : ''}`,
          },
          paragraphs: [],
        });
      }
      return list;
    }
    return [];
  }, [sermon.data, parsed, chapter.data]);

  const step = steps[Math.min(index, steps.length - 1)];

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(steps.length - 1, Math.max(0, i + delta))),
    [steps.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, navigate]);

  // mantém a tela ligada durante a pregação, quando o dispositivo permite
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<never> } };
    nav.wakeLock?.request('screen').then((lock) => (sentinel = lock)).catch(() => undefined);
    return () => {
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  /* -------------------------------- seleção ------------------------------- */

  if (!id && !refParam) {
    return (
      <div className="preach">
        <div className="preach-stage" style={{ justifyContent: 'flex-start' }}>
          <div className="page" style={{ maxWidth: 760 }}>
            <h1 className="page-title">Modo Pregação</h1>
            <p className="page-lead">Escolha um sermão preparado ou abra uma passagem para projetar.</p>

            <div className="stack" style={{ marginTop: 'var(--sp-5)' }}>
              {(sermons ?? []).length === 0 && (
                <EmptyState
                  icon="sermon"
                  title="Nenhum sermão preparado"
                  description="Crie um sermão e ele aparecerá aqui pronto para pregar."
                  action={
                    <Link className="btn btn-primary btn-sm" to="/sermoes">
                      Ir para sermões
                    </Link>
                  }
                />
              )}
              {(sermons ?? []).map((s) => (
                <Link key={s.id} className="list-item" to={`/pregacao/${s.id}`}>
                  <span className="list-body">
                    <span className="list-title">{s.title || 'Sermão sem título'}</span>
                    <span className="list-meta">{[s.theme, s.mainText].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Icon name="chevron-right" size={18} className="dim" />
                </Link>
              ))}
            </div>

            <div className="row" style={{ marginTop: 'var(--sp-5)' }}>
              <Link className="btn btn-ghost" to="/biblia">
                ← Voltar à Bíblia
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sermon.loading || chapter.loading || attachment.loading) {
    return <Spinner label="Preparando…" />;
  }

  // documento importado ocupa o palco inteiro, com o cronômetro por cima
  if (attachment.data) {
    return (
      <div
        className="preach"
        style={{ '--preach-scale': settings.preachingScale } as React.CSSProperties}
      >
        <SermonTimer />
        <div className="preach-split">
          {split && <ScripturePane />}
          <div className="preach-stage split" style={{ justifyContent: 'flex-start' }}>
            <DocumentViewer attachment={attachment.data} />
          </div>
        </div>
        <div className="preach-bar">
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Sair do modo pregação">
            <Icon name="close" />
          </button>
          <span className="small dim truncate" style={{ flex: 1, padding: '0 var(--sp-2)' }}>
            {sermon.data?.title || attachment.data.name}
          </span>
          <button
            className={`icon-btn preach-split-toggle${split ? ' active' : ''}`}
            onClick={() => setSplit((v) => !v)}
            aria-label={split ? 'Fechar a Bíblia ao lado' : 'Abrir a Bíblia ao lado'}
            aria-pressed={split}
          >
            <Icon name="split" />
          </button>
        </div>
      </div>
    );
  }

  if (!steps.length) {
    return (
      <div className="preach">
        <div className="preach-stage">
          <EmptyState
            icon="preach"
            title="Nada para exibir"
            description="Este sermão ainda não tem conteúdo, ou a passagem não foi encontrada."
            action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate(-1)}>
                Voltar
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="preach"
      style={{ '--preach-scale': settings.preachingScale } as React.CSSProperties}
    >
      <SermonTimer />
      <div className={`preach-split${split && sermon.data ? ' divided' : ''}`}>
        {split && sermon.data && <ScripturePane reference={step.scripture?.reference} />}
        <div
          className={`preach-stage${split ? ' split' : ''}`}
          onClick={(e) => (e.detail === 2 ? go(1) : undefined)}
        >
        {step.blocks ? (
          <div className="preach-topic preach-blocks">
            {step.title && <h2>{step.title}</h2>}
            {step.blocks.map((block) => (
              <PreachBlock key={block.id} block={block} />
            ))}
          </div>
        ) : step.scripture ? (
          <>
            <p className="preach-text">{step.scripture.text}</p>
            <p className="preach-ref">{step.scripture.reference}</p>
            {step.paragraphs.length > 0 && (
              <div className="preach-topic" style={{ marginTop: 'var(--sp-6)' }}>
                {step.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="preach-topic">
            {step.title && <h2>{step.title}</h2>}
            {step.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        </div>
      </div>

      <div className="preach-bar">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Sair do modo pregação">
          <Icon name="close" />
        </button>
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Anterior" disabled={index === 0}>
          <Icon name="chevron-left" />
        </button>
        <div className="preach-steps" role="tablist">
          {steps.map((s, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === index}
              className={`preach-step${i === index ? ' active' : ''}`}
              onClick={() => setIndex(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          className="icon-btn"
          onClick={() => go(1)}
          aria-label="Próximo"
          disabled={index >= steps.length - 1}
        >
          <Icon name="chevron-right" />
        </button>
        {sermon.data && (
        <button
          className={`icon-btn preach-split-toggle${split ? ' active' : ''}`}
          onClick={() => setSplit((v) => !v)}
          aria-label={split ? 'Fechar a Bíblia ao lado' : 'Abrir a Bíblia ao lado'}
          aria-pressed={split}
        >
          <Icon name="split" />
        </button>
        )}
        <button
          className="icon-btn"
          onClick={() => update({ preachingScale: Math.max(0.6, settings.preachingScale - 0.1) })}
          aria-label="Diminuir fonte"
        >
          A-
        </button>
        <button
          className="icon-btn"
          onClick={() => update({ preachingScale: Math.min(2, settings.preachingScale + 0.1) })}
          aria-label="Aumentar fonte"
        >
          A+
        </button>
      </div>
    </div>
  );
}
