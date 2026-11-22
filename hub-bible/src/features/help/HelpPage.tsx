import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { isNativeApp } from '../../core/platform';
import { deliverFile } from '../../core/export/deliver';
import { useToast } from '../../components/Toast';
import { HAS_RHEMA } from '../../core/edition';
import { TOPICS } from './topics';


export default function HelpPage() {
  const { notify } = useToast();
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const downloadPdf = async (file: string, name: string) => {
    setPdfBusy(file);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!res.ok) throw new Error('O manual não está disponível agora. Tente com internet.');
      notify(await deliverFile(await res.blob(), name));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Não foi possível baixar o manual.');
    } finally {
      setPdfBusy(null);
    }
  };
  return (
    <div className="page">
      <PageHeader
        title="Ajuda"
        lead="Como usar o Farol da Palavra no dia a dia e na hora de pregar."
      />

      {/* O mesmo conteúdo em uma página só, para imprimir ou enviar a quem vai
          usar o aplicativo junto. Vive em `public/manual.html`.

          Dentro do aplicativo esse cartão não traz botão nenhum, de propósito.
          Ali não há aba nem barra de endereço: qualquer coisa que substitua a
          tela é um lugar de onde se pode não conseguir voltar, e não vale o
          risco — o conteúdo do manual é o mesmo que está logo abaixo, nos
          tópicos. Imprimir só faz sentido no computador, de qualquer forma. */}
      <div className="card row" style={{ marginBottom: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
        <Icon name="download" size={22} style={{ flex: 'none', color: 'var(--accent-strong)' }} />
        <span className="list-body" style={{ flex: 1, minWidth: 0 }}>
          <span className="list-title">Manual completo</span>
          <span className="list-meta">
            {isNativeApp()
              ? 'Para imprimir ou enviar a alguém, abra o Farol da Palavra no navegador e use a Ajuda de lá. Aqui, tudo está nos tópicos abaixo.'
              : 'Tudo em uma página só — para imprimir, salvar em PDF ou enviar a quem for usar com você.'}
          </span>
        </span>
        {!isNativeApp() && (
          <a
            className="btn btn-sm"
            href={`${import.meta.env.BASE_URL}manual.html`}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 'none' }}
          >
            Abrir
          </a>
        )}
      </div>

      {/* O PDF de instalação no iPhone e no iPad, para enviar a quem vai
          instalar. Sai pelo mesmo caminho dos PDFs gerados: no APK vai para a
          pasta Documentos, sem trocar de tela. */}
      <div className="card row" style={{ marginBottom: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
        <Icon name="download" size={22} style={{ flex: 'none', color: 'var(--accent-strong)' }} />
        <span className="list-body" style={{ flex: 1, minWidth: 0 }}>
          <span className="list-title">Manual de instalação — iPhone e iPad (PDF)</span>
          <span className="list-meta">Passo a passo com QR Code, para enviar a quem vai instalar no iPhone ou no iPad.</span>
        </span>
        <button
          className="btn btn-sm"
          style={{ flex: 'none' }}
          disabled={pdfBusy !== null}
          onClick={() => downloadPdf('manual-iphone-ipad.pdf', 'Farol da Palavra - instalar no iPhone e iPad.pdf')}
        >
          {pdfBusy === 'manual-iphone-ipad.pdf' ? 'Baixando…' : 'Baixar PDF'}
        </button>
      </div>

      {/* Como atualizar sem perder nada: backup antes e instalar por cima.
          Fonte em docs/manual-atualizar/. */}
      <div className="card row" style={{ marginBottom: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
        <Icon name="warning" size={22} style={{ flex: 'none', color: 'var(--accent-strong)' }} />
        <span className="list-body" style={{ flex: 1, minWidth: 0 }}>
          <span className="list-title">Como atualizar sem perder nada (PDF)</span>
          <span className="list-meta">Backup antes, instalar por cima e qual edição baixar — no Android, iPhone e iPad.</span>
        </span>
        <button
          className="btn btn-sm"
          style={{ flex: 'none' }}
          disabled={pdfBusy !== null}
          onClick={() => downloadPdf('como-atualizar.pdf', 'Farol da Palavra - como atualizar.pdf')}
        >
          {pdfBusy === 'como-atualizar.pdf' ? 'Baixando…' : 'Baixar PDF'}
        </button>
      </div>

      <div className="stack">
        {TOPICS.filter((t) => HAS_RHEMA || !/^(Rhema|Escola de Ministros)/.test(t.title)).map((topic) => (
          <details key={topic.title} className="card help-topic">
            <summary>
              <span className="help-topic-icon">
                <Icon name={topic.icon} size={20} />
              </span>
              <span className="card-title">{topic.title}</span>
              <Icon name="chevron-down" size={18} className="dim help-topic-caret" />
            </summary>
            <ol className="help-steps">
              {topic.steps.map((step, i) => (
                <li key={i}>
                  {typeof step === 'string' ? (
                    step
                  ) : (
                    <>
                      {step.text}{' '}
                      <Link to={step.to} style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>
                        {step.label}
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>

      <div className="notice notice-accent" style={{ marginTop: 'var(--sp-5)' }}>
        <Icon name="info" size={20} style={{ flex: 'none' }} />
        <span>
          Não encontrou o que precisava? Tudo o que o aplicativo faz está descrito aqui e em{' '}
          <Link to="/config" style={{ fontWeight: 600 }}>
            Configurações
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
