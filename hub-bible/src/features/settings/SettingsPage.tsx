import { useRef, useState } from 'react';
import { TranslationManager } from './TranslationManager';
import { Sheet } from '../../components/Sheet';
import {
  ConfirmDialog,
  PageHeader,
  RangeInput,
  SelectInput,
  TextInput,
  Toggle,
} from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { DEFAULT_SETTINGS, useSettings, type ThemeChoice } from '../../core/settings/SettingsContext';
import { downloadBackup, readJsonFile, restoreBackup } from '../../core/backup';
import { clearScriptureCache, clearUserData } from '../../core/db/db';
import { loadAvailableTranslations } from '../../core/bible/repository';
import { isAiEnabled } from '../../core/ai/provider';
import { isSyncEnabled } from '../../core/sync/syncAdapter';
import { slugify } from '../../core/categories';

const APP_VERSION = '1.0.0';

/** Configurações — aparência, traduções, backup, privacidade e sobre. */
export default function SettingsPage() {
  const { settings, update, reset, categories } = useSettings();
  const { notify } = useToast();
  const translations = useAsync(() => loadAvailableTranslations(), []);
  const restoreInput = useRef<HTMLInputElement>(null);

  const [confirmWipe, setConfirmWipe] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newColor, setNewColor] = useState('#8a6a2f');

  const options = (translations.data ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.abbrev})` }));

  return (
    <div className="page">
      <PageHeader title="Configurações" lead="Ajuste o aplicativo ao seu jeito de ler e ministrar." />

      {/* ------------------------------ perfil ------------------------------ */}
      <section className="section" style={{ marginTop: 0 }}>
        <div className="section-head">
          <h2 className="section-title">Perfil</h2>
        </div>
        <div className="card stack">
          <TextInput
            label="Como devemos chamar você?"
            value={settings.userName}
            onChange={(userName) => update({ userName })}
            placeholder="Pr. João"
          />
          <p className="small dim">
            Usado apenas na saudação da tela inicial. Nada é enviado para fora do dispositivo.
          </p>
        </div>
      </section>

      {/* ---------------------------- aparência ---------------------------- */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Aparência e leitura</h2>
        </div>
        <div className="card stack">
          <SelectInput
            label="Tema"
            value={settings.theme}
            onChange={(theme) => update({ theme: theme as ThemeChoice })}
            options={[
              { value: 'system', label: 'Seguir o sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
              { value: 'sepia', label: 'Sépia' },
            ]}
          />
          <Toggle
            label="Alto contraste"
            description="Aumenta o contraste do texto e das bordas."
            checked={settings.contrast === 'high'}
            onChange={(on) => update({ contrast: on ? 'high' : 'normal' })}
          />
          <RangeInput
            label="Tamanho da fonte"
            value={Math.round(settings.fontScale * 100)}
            min={80}
            max={190}
            step={5}
            suffix="%"
            onChange={(v) => update({ fontScale: v / 100 })}
          />
          <RangeInput
            label="Espaçamento entre linhas"
            value={settings.leading}
            min={1.4}
            max={2.4}
            step={0.05}
            onChange={(leading) => update({ leading })}
          />
          <RangeInput
            label="Largura do texto"
            value={settings.measure}
            min={28}
            max={62}
            step={1}
            suffix="rem"
            onChange={(measure) => update({ measure })}
          />
          <SelectInput
            label="Tipo de letra na leitura"
            value={settings.readerFont}
            onChange={(v) => update({ readerFont: v as 'serif' | 'sans' })}
            options={[
              { value: 'serif', label: 'Serifada' },
              { value: 'sans', label: 'Sem serifa' },
            ]}
          />
          <SelectInput
            label="Disposição dos versículos"
            value={settings.verseLayout}
            onChange={(v) => update({ verseLayout: v as 'paragraph' | 'lines' })}
            options={[
              { value: 'paragraph', label: 'Texto corrido' },
              { value: 'lines', label: 'Um por linha' },
            ]}
          />
          <SelectInput
            label="Alinhamento do texto"
            value={settings.textAlign}
            onChange={(v) => update({ textAlign: v as 'left' | 'justify' })}
            options={[
              { value: 'left', label: 'À esquerda' },
              { value: 'justify', label: 'Justificado' },
            ]}
          />
          <SelectInput
            label="Capitular do capítulo"
            value={settings.dropCap ? 'on' : 'off'}
            onChange={(v) => update({ dropCap: v === 'on' })}
            options={[
              { value: 'on', label: 'Ativada' },
              { value: 'off', label: 'Desativada' },
            ]}
          />
          <div className="reader" style={{ padding: 0, margin: 0 }}>
            <p style={{ margin: 0 }}>
              <span className="verse-num">5</span>
              Eu sou a videira; vós sois as varas. Quem permanece em mim e eu nele, esse dá muito fruto.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------- traduções ---------------------------- */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Traduções</h2>
        </div>
        <div className="card stack">
          <SelectInput
            label="Tradução padrão"
            value={settings.defaultTranslation}
            onChange={(defaultTranslation) => update({ defaultTranslation })}
            options={options.length ? options : [{ value: settings.defaultTranslation, label: 'Carregando…' }]}
          />
          <SelectInput
            label="Comparação lado a lado"
            value={settings.compareTranslation ?? ''}
            onChange={(v) => update({ compareTranslation: v || null })}
            options={[{ value: '', label: 'Desligada' }, ...options]}
          />
        </div>
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <TranslationManager />
        </div>
      </section>

      {/* --------------------------- categorias ---------------------------- */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Categorias de marcação</h2>
          <button className="btn btn-sm" onClick={() => setCategorySheet(true)}>
            ＋ Nova
          </button>
        </div>
        <div className="card">
          <div className="row row-wrap">
            {categories.map((c) => (
              <span key={c.id} className="chip">
                <span className="chip-dot" style={{ background: c.color }} aria-hidden="true" />
                {c.label}
                {settings.customCategories.some((x) => x.id === c.id) && (
                  <button
                    aria-label={`Remover ${c.label}`}
                    onClick={() =>
                      update({ customCategories: settings.customCategories.filter((x) => x.id !== c.id) })
                    }
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------- backup e privacidade ----------------------- */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Backup e privacidade</h2>
        </div>
        <div className="card stack">
          <p className="small muted">
            Suas anotações, sermões e estudos ficam somente neste dispositivo, em banco local. Nada é
            enviado para servidores.
          </p>
          <div className="row row-wrap">
            <button
              className="btn"
              onClick={async () => {
                await downloadBackup(settings);
                notify('Backup exportado.');
              }}
            >
              ⬇️ Exportar meus dados
            </button>
            <button className="btn" onClick={() => restoreInput.current?.click()}>
              ⬆️ Restaurar backup
            </button>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                await clearScriptureCache();
                notify('Texto bíblico local removido. Ele será baixado novamente quando necessário.');
              }}
            >
              🧹 Limpar texto bíblico baixado
            </button>
            <button className="btn btn-danger" onClick={() => setConfirmWipe(true)}>
              🗑️ Excluir todos os meus dados
            </button>
          </div>
          <input
            ref={restoreInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = await readJsonFile(file);
                const result = await restoreBackup(data, 'merge');
                notify(
                  `Backup restaurado: ${Object.values(result.restored).reduce((a, b) => a + b, 0)} registro(s).`,
                );
              } catch (err) {
                notify((err as Error).message, 'error');
              } finally {
                e.target.value = '';
              }
            }}
          />
        </div>
      </section>

      {/* ------------------------ recursos futuros ------------------------- */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Sincronização e IA</h2>
        </div>
        <div className="card stack">
          <div className="row">
            <span style={{ flex: 1 }}>Sincronização entre dispositivos</span>
            <span className="badge">{isSyncEnabled() ? 'Ativa' : 'Não configurada'}</span>
          </div>
          <div className="row">
            <span style={{ flex: 1 }}>IA bíblica</span>
            <span className="badge">{isAiEnabled() ? 'Ativa' : 'Não configurada'}</span>
          </div>
          <p className="small dim">
            A arquitetura já está pronta para os dois recursos. Quando a IA for ativada, todo comentário
            gerado será identificado como tal e separado do texto bíblico, que sempre vem do banco local.
          </p>
        </div>
      </section>

      {/* ------------------------------ sobre ------------------------------ */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Sobre</h2>
        </div>
        <div className="card stack">
          <div className="row">
            <span style={{ flex: 1 }}>Hub Bible</span>
            <span className="badge">v{APP_VERSION}</span>
          </div>
          <p className="small muted">
            Bíblia, estudo, devocional, sermões e biblioteca ministerial em um só lugar. Funciona offline
            e pode ser instalado na tela inicial do seu tablet ou celular.
          </p>
          <div>
            <p className="section-title" style={{ marginBottom: 'var(--sp-2)' }}>
              Direitos do texto bíblico
            </p>
            <ul className="stack small muted" style={{ gap: 6 }}>
              {(translations.data ?? []).map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong> — {t.license}
                  {t.publisher ? ` · ${t.publisher}` : ''}
                </li>
              ))}
            </ul>
            <p className="small dim" style={{ marginTop: 'var(--sp-2)' }}>
              Traduções protegidas por direitos autorais não são distribuídas com o aplicativo.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            reset();
            notify('Configurações restauradas para o padrão.');
          }}>
            Restaurar configurações padrão
          </button>
        </div>
      </section>

      <Sheet
        open={categorySheet}
        title="Nova categoria de marcação"
        onClose={() => setCategorySheet(false)}
        footer={
          <>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCategorySheet(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                const label = newCategory.trim();
                if (!label) return;
                const id = slugify(label);
                if (categories.some((c) => c.id === id)) {
                  notify('Já existe uma categoria com esse nome.', 'error');
                  return;
                }
                update({
                  customCategories: [...settings.customCategories, { id, label, color: newColor }],
                });
                setNewCategory('');
                setCategorySheet(false);
                notify('Categoria criada.');
              }}
            >
              Criar
            </button>
          </>
        }
      >
        <TextInput label="Nome" value={newCategory} onChange={setNewCategory} placeholder="Missões" />
        <label className="field">
          <span>Cor</span>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{ width: 72, height: 44, border: 'none', background: 'none' }}
          />
        </label>
      </Sheet>

      <ConfirmDialog
        open={confirmWipe}
        title="Excluir todos os dados"
        message="Favoritos, anotações, marcações, sermões, estudos, devocionais, materiais e planos serão apagados deste dispositivo. Esta ação não pode ser desfeita."
        confirmLabel="Excluir tudo"
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          await clearUserData();
          update({ lastPosition: DEFAULT_SETTINGS.lastPosition });
          setConfirmWipe(false);
          notify('Todos os dados pessoais foram excluídos.');
        }}
      />
    </div>
  );
}
