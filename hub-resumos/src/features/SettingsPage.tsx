import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { PageHeader, TextInput } from '../components/ui';
import { applyTheme, currentTheme, THEME_LABEL, THEME_ORDER, type Theme } from '../app/theme';
import { createBackup, downloadJson, markBackupDone, readJsonFile, restoreBackup } from '../core/backup';
import { db, getSetting, setSetting } from '../core/db';
import { AiSettings } from './AiSettings';

/** Dados e ajustes: cópia de segurança, IA (opcional), ligação com o Hub Bible e tema. */
export default function SettingsPage() {
  const { notify } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>(currentTheme());
  const [hubUrl, setHubUrl] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');

  const info = useLiveQuery(async () => ({
    materials: await db.materials.count(),
    cards: await db.cards.count(),
    actions: await db.actions.count(),
    lastBackupAt: await getSetting<number>('lastBackupAt', 0),
    hubUrl: await getSetting('hubUrl', ''),
  }));

  useEffect(() => {
    if (info) setHubUrl(info.hubUrl);
  }, [info?.hubUrl]);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB usados neste aparelho`);
    });
  }, []);

  const location = useLocation();
  // "Ligar a IA" (aba Resumo) chega aqui com #ia: rola até a seção
  useEffect(() => {
    if (location.hash === '#ia') document.getElementById('ia')?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  const daysSince = info?.lastBackupAt ? Math.floor((Date.now() - info.lastBackupAt) / 864e5) : null;

  return (
    <div className="page">
      <PageHeader title="Dados e ajustes" lead="O Hub Resumos guarda tudo no próprio aparelho e funciona sem internet." />

      <section className="card stack" style={{ marginBottom: 'var(--sp-4)' }}>
        <strong>Banco de dados no aparelho</strong>
        <span className="small muted">
          {info ? `${info.materials} material(is), ${info.cards} cartão(ões), ${info.actions} ação(ões).` : '…'} {usage}
        </span>
        <span className="small muted">
          {persisted === true
            ? 'O navegador confirmou que estes dados não serão apagados sozinhos.'
            : 'O navegador pode limpar dados de sites pouco usados. Instale o app na tela inicial e faça cópias de segurança.'}
        </span>
        <span className={`small ${daysSince === null || daysSince > 7 ? 'xr-warn' : 'muted'}`}>
          {daysSince === null ? 'Nenhuma cópia de segurança feita ainda.' : daysSince === 0 ? 'Última cópia: hoje.' : `Última cópia: há ${daysSince} dia(s).`}
        </span>
        <div className="row row-wrap">
          <button
            className="btn btn-primary"
            onClick={async () => {
              const backup = await createBackup();
              downloadJson(backup, `hub-resumos-copia-${new Date().toISOString().slice(0, 10)}.json`);
              await markBackupDone();
              notify('Cópia de segurança gerada. Guarde o arquivo no Drive ou no computador.');
            }}
          >
            Fazer cópia de segurança
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Restaurar uma cópia
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const restored = await restoreBackup(await readJsonFile(file));
                notify(`Restaurado: ${restored.materials ?? 0} material(is), ${restored.cards ?? 0} cartão(ões).`);
              } catch (err) {
                notify((err as Error).message, 'error');
              }
            }}
          />
        </div>
        <span className="small dim">Restaurar junta a cópia ao que já existe; nada é apagado.</span>
      </section>

      <AiSettings />

      <section className="card stack" style={{ marginBottom: 'var(--sp-4)' }}>
        <strong>Ligação com o Hub Bible</strong>
        <span className="small muted">
          Opcional. Com o endereço do Hub Bible, as referências bíblicas viram links que abrem o versículo nele. Sem
          endereço, tudo continua funcionando.
        </span>
        <TextInput label="Endereço do Hub Bible" value={hubUrl} onChange={setHubUrl} placeholder="https://seu-hub-bible.vercel.app" />
        <div>
          <button
            className="btn"
            onClick={async () => {
              const v = hubUrl.trim();
              if (v && !/^https?:\/\//i.test(v)) {
                notify('O endereço precisa começar com https://', 'error');
                return;
              }
              await setSetting('hubUrl', v);
              notify(v ? 'Endereço salvo.' : 'Ligação com o Hub Bible desligada.');
            }}
          >
            Salvar endereço
          </button>
        </div>
        <span className="small dim">
          Para trazer conteúdo do Hub Bible: no Hub, “Exportar meus dados”; aqui, Novo material › Do Hub Bible. Para levar
          um material ao Hub: aba Editar › “Enviar para o Hub Bible”.
        </span>
      </section>

      <section className="card stack">
        <strong>Tema</strong>
        <span className="small dim">Os oito temas do Hub Bible e o Verde do Hub Resumos. O botão do sol, no topo, troca rápido.</span>
        <div className="xr-themes" role="radiogroup" aria-label="Tema">
          {(['system', ...THEME_ORDER] as Theme[]).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              className={`xr-theme${theme === t ? ' active' : ''}`}
              data-theme-preview={t === 'system' ? undefined : t}
              onClick={() => {
                setTheme(t);
                applyTheme(t);
              }}
            >
              <span className="xr-theme-swatch" aria-hidden="true" />
              {THEME_LABEL[t]}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
