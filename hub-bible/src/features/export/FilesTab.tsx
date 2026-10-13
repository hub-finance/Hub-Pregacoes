import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ui';
import { formatBytes } from '../../core/data/attachments';
import { approveVersion, listFiles, listVersions, removeFile, restoreVersion } from '../../core/data/exportDocs';
import type { ExportDoc, ExportEdition, ExportFile, ExportFormat, ExportVersion } from '../../core/db/types';
import { hasEditions } from '../../core/export/model';
import { deliverFile, shareExportFile } from '../../core/export/deliver';
import { FORMAT_LABEL, FORMAT_SHORT } from '../../core/export/files';
import { generateFiles, type GeneratedFile } from '../../core/export/generate';
import { STATUS_LABEL } from './status';

interface Props {
  doc: ExportDoc;
  /** Grava o rascunho pendente antes de aprovar. */
  flush: () => Promise<ExportDoc | null>;
  replace: (doc: ExportDoc) => void;
}

const FORMATS: ExportFormat[] = ['docx', 'pdf', 'md'];
const when = (t: number) =>
  new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Aprovar, gerar, baixar — e o histórico de arquivos e versões do documento. */
export function FilesTab({ doc, flush, replace }: Props) {
  const { notify } = useToast();
  const [formats, setFormats] = useState<ExportFormat[]>(['docx', 'pdf']);
  const [editions, setEditions] = useState<ExportEdition[]>(['instrutor', 'participante']);
  const [step, setStep] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedFile[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [restoring, setRestoring] = useState<ExportVersion | null>(null);
  const [removing, setRemoving] = useState<ExportFile | null>(null);

  const files = useLiveQuery(() => listFiles(doc.id), [doc.id, doc.formats.join(), doc.lastExportAt], [] as ExportFile[]);
  const versions = useLiveQuery(() => listVersions(doc.id), [doc.id, doc.versionCount], [] as ExportVersion[]);

  const busy = step !== null;
  /** A divisão vale pela versão aprovada, que é de onde os arquivos saem. */
  const approvedVersion = versions?.find((v) => v.version === doc.approvedVersion);
  const split = approvedVersion ? hasEditions(approvedVersion.structure) : hasEditions(doc.structure);
  const toggleEdition = (e: ExportEdition) => setEditions((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  const unapprovedChanges = doc.status === 'rascunho';

  const approve = async () => {
    setApproving(true);
    try {
      await flush();
      const { doc: next, version } = await approveVersion(doc.id);
      replace(next);
      notify(`Versão ${version.version} aprovada. Os arquivos sairão dela.`);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setApproving(false);
    }
  };

  const generate = async (only?: ExportFormat[]) => {
    const chosen = only ?? formats;
    if (!chosen.length) {
      notify('Escolha pelo menos um formato.', 'error');
      return;
    }
    if (split && !editions.length) {
      notify('Escolha a versão do instrutor, a do participante ou as duas.', 'error');
      return;
    }
    setResults(null);
    setFatal(null);
    setStep('Preparando…');
    try {
      const result = await generateFiles(doc.id, chosen, setStep, editions);
      replace(result.doc);
      // um novo pedido só para os que falharam substitui o resultado deles
      // ao tentar de novo, o que já tinha dado certo fica; o resto é substituído
      setResults((prev) => {
        if (!only || !prev) return result.files;
        const kept = prev.filter((r) => r.ok);
        return [...kept, ...result.files.filter((r) => !kept.some((k) => k.filename === r.filename))];
      });
    } catch (err) {
      setFatal((err as Error).message);
    } finally {
      setStep(null);
    }
  };

  const download = async (blob: Blob, filename: string) => {
    try {
      notify(await deliverFile(blob, filename));
    } catch (err) {
      notify(`Não foi possível salvar o arquivo: ${(err as Error).message}`, 'error');
    }
  };

  const share = async (blob: Blob, filename: string) => {
    try {
      notify(await shareExportFile(blob, filename));
    } catch (err) {
      notify(`Não foi possível compartilhar: ${(err as Error).message}`, 'error');
    }
  };

  const toggleFormat = (f: ExportFormat) => setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const failed = [...new Set(results?.filter((r) => !r.ok).map((r) => r.format) ?? [])];

  return (
    <div className="stack">
      {/* ------------------------------ aprovação ------------------------------ */}
      <section className="card stack" aria-labelledby="xp-approve">
        <div className="row row-wrap">
          <h2 id="xp-approve" className="card-title" style={{ margin: 0 }}>
            1. Aprovar a versão
          </h2>
          <span className="spacer" />
          <span className={`xp-status ${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
        </div>
        {!doc.approvedVersion ? (
          <p className="small muted" style={{ margin: 0 }}>
            Revise o conteúdo e a formatação. Ao aprovar, esta revisão vira a versão 1 — é dela que o Word e o PDF
            saem, com o mesmo conteúdo.
          </p>
        ) : unapprovedChanges ? (
          <p className="small muted" style={{ margin: 0 }}>
            Há alterações depois da versão {doc.approvedVersion}. Aprove de novo para que elas entrem nos arquivos; até
            lá, os arquivos continuam saindo da versão {doc.approvedVersion}.
          </p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            A versão {doc.approvedVersion} é exatamente o que está na revisão.
          </p>
        )}
        <div>
          <button className="btn btn-primary" onClick={approve} disabled={approving || busy || (!!doc.approvedVersion && !unapprovedChanges)}>
            {approving ? 'Aprovando…' : doc.approvedVersion ? `Aprovar como versão ${doc.versionCount + 1}` : 'Aprovar e finalizar a revisão'}
          </button>
        </div>
      </section>

      {/* ------------------------------- geração ------------------------------- */}
      <section className="card stack" aria-labelledby="xp-generate">
        <h2 id="xp-generate" className="card-title" style={{ margin: 0 }}>
          2. Gerar os arquivos {doc.approvedVersion ? `da versão ${doc.approvedVersion}` : ''}
        </h2>
        <div className="row row-wrap" role="group" aria-label="Formatos">
          {FORMATS.map((f) => (
            <label key={f} className="xp-check">
              <input type="checkbox" checked={formats.includes(f)} onChange={() => toggleFormat(f)} />
              {FORMAT_LABEL[f]}
            </label>
          ))}
        </div>
        {split && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="row row-wrap" role="group" aria-label="Versões">
              <label className="xp-check">
                <input type="checkbox" checked={editions.includes('instrutor')} onChange={() => toggleEdition('instrutor')} />
                Material do instrutor (completo)
              </label>
              <label className="xp-check">
                <input type="checkbox" checked={editions.includes('participante')} onChange={() => toggleEdition('participante')} />
                Material do participante
              </label>
            </div>
            <span className="small dim">O do participante sai sem as partes marcadas como “Só instrutor”.</span>
          </div>
        )}
        <div className="row row-wrap">
          <button className="btn btn-primary" onClick={() => generate()} disabled={busy || !doc.approvedVersion || !formats.length}>
            {busy ? 'Gerando…' : 'Gerar arquivos'}
          </button>
          <button className="btn btn-sm" onClick={() => setFormats(['docx', 'pdf'])} disabled={busy}>
            Word + PDF
          </button>
          {!doc.approvedVersion && <span className="small dim">Aprove uma versão primeiro.</span>}
        </div>
        {doc.layout.toc && formats.includes('docx') && (
          <p className="small dim" style={{ margin: 0 }}>
            No Word, o sumário é preenchido ao abrir o arquivo: confirme “Atualizar campos” quando o Word perguntar.
          </p>
        )}

        <div aria-live="polite">
          {step && (
            <p className="small muted" style={{ margin: 0 }}>
              <span className="spin" aria-hidden="true" style={{ display: 'inline-block' }}>
                ◌
              </span>{' '}
              {step}
            </p>
          )}
          {fatal && (
            <p className="small xp-error" role="alert" style={{ margin: 0 }}>
              {fatal}
            </p>
          )}
        </div>

        {results && (
          <div className="stack" style={{ gap: 'var(--sp-2)' }}>
            {results.map((r) => (
              <div key={r.filename} className="xp-file">
                <Icon name={r.ok ? 'check' : 'warning'} size={18} />
                <span className="xp-file-name">
                  {r.ok ? `${FORMAT_SHORT[r.format]}${r.edition ? ` (${r.edition})` : ''} gerado e conferido` : `${FORMAT_SHORT[r.format]}${r.edition ? ` (${r.edition})` : ''} não foi gerado`}
                  <span className="small dim" style={{ display: 'block', fontWeight: 400 }}>
                    {r.ok
                      ? [r.filename, r.blob ? formatBytes(r.blob.size) : '', r.pages ? `${r.pages} página${r.pages > 1 ? 's' : ''}` : '']
                          .filter(Boolean)
                          .join(' · ')
                      : r.error}
                  </span>
                  {r.storeError && (
                    <span className="small xp-error" style={{ display: 'block', fontWeight: 400 }}>
                      {r.storeError} O arquivo está pronto para baixar agora.
                    </span>
                  )}
                </span>
                {r.ok && r.blob && (
                  <>
                    <button className="btn btn-sm btn-primary" onClick={() => download(r.blob!, r.filename)}>
                      Baixar
                    </button>
                    <button className="btn btn-sm" onClick={() => share(r.blob!, r.filename)}>
                      Compartilhar
                    </button>
                  </>
                )}
              </div>
            ))}
            {failed.length > 0 && (
              <div>
                <button className="btn btn-sm" onClick={() => generate(failed)} disabled={busy}>
                  Tentar novamente ({failed.map((f) => FORMAT_SHORT[f]).join(', ')})
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------- arquivos ------------------------------ */}
      <section className="card stack" aria-labelledby="xp-files">
        <h2 id="xp-files" className="card-title" style={{ margin: 0 }}>
          Arquivos gerados
        </h2>
        {!files?.length ? (
          <p className="small dim" style={{ margin: 0 }}>
            Nenhum arquivo guardado ainda.
          </p>
        ) : (
          files.map((f) => (
            <div key={f.id} className="xp-file">
              <span className="xp-file-name">
                {f.filename}
                <span className="small dim" style={{ display: 'block', fontWeight: 400 }}>
                  {FORMAT_SHORT[f.format]}
                  {f.edition ? ` · ${f.edition}` : ''} · versão {f.version} · {formatBytes(f.size)}
                  {f.pages ? ` · ${f.pages} pág.` : ''} · {when(f.createdAt)}
                </span>
              </span>
              <button className="btn btn-sm" onClick={() => download(f.blob, f.filename)}>
                Baixar
              </button>
              <button className="btn btn-sm" onClick={() => share(f.blob, f.filename)}>
                Compartilhar
              </button>
              <button className="icon-btn" onClick={() => setRemoving(f)} aria-label={`Excluir o arquivo ${f.filename}`}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      {/* ------------------------------- versões ------------------------------- */}
      <section className="card stack" aria-labelledby="xp-versions">
        <h2 id="xp-versions" className="card-title" style={{ margin: 0 }}>
          Versões aprovadas
        </h2>
        {!versions?.length ? (
          <p className="small dim" style={{ margin: 0 }}>
            Nenhuma versão aprovada ainda.
          </p>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="xp-file">
              <span className="xp-file-name">
                Versão {v.version}
                {v.version === doc.approvedVersion ? ' (atual)' : ''}
                <span className="small dim" style={{ display: 'block', fontWeight: 400 }}>
                  {v.title} · aprovada em {when(v.createdAt)} · {files?.filter((f) => f.versionId === v.id).length ?? 0} arquivo(s)
                </span>
              </span>
              <button className="btn btn-sm" onClick={() => setRestoring(v)}>
                Restaurar na revisão
              </button>
            </div>
          ))
        )}
      </section>

      <ConfirmDialog
        open={!!restoring}
        title={`Restaurar a versão ${restoring?.version ?? ''}`}
        message="O título, o conteúdo e a formatação da revisão voltam a ser os desta versão. As versões e os arquivos guardados não mudam; para gerar arquivos dela de novo, aprove em seguida."
        confirmLabel="Restaurar"
        onCancel={() => setRestoring(null)}
        onConfirm={async () => {
          if (!restoring) return;
          const v = restoring;
          setRestoring(null);
          try {
            await flush();
            replace(await restoreVersion(doc.id, v.id));
            notify(`Versão ${v.version} trazida para a revisão.`);
          } catch (err) {
            notify((err as Error).message, 'error');
          }
        }}
      />

      <ConfirmDialog
        open={!!removing}
        title="Excluir arquivo"
        message={`"${removing?.filename}" será removido deste aparelho. A versão aprovada continua guardada e pode gerar o arquivo de novo.`}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await removeFile(removing.id);
          setRemoving(null);
          notify('Arquivo excluído.');
        }}
      />
    </div>
  );
}
