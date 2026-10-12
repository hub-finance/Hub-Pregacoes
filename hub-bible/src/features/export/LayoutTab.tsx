import { useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { RangeInput, SelectInput, TextInput, Toggle } from '../../components/ui';
import { getPreferredLayout, savePreferredLayout } from '../../core/data/exportDocs';
import type { ExportCategory, ExportDoc, ExportLayout, ExportLogo } from '../../core/db/types';
import { categoryById, EXPORT_CATEGORIES, layoutFor, modelById } from '../../core/export/templates';
import { ACCENT_CHOICES, EXPORT_THEMES, PAGE_MM } from '../../core/export/themes';

interface Props {
  doc: ExportDoc;
  set: (patch: Partial<Pick<ExportDoc, 'layout' | 'category' | 'model'>>) => void;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_SIDE = 600;

/**
 * Lê o logotipo escolhido: só PNG ou JPEG, até 2 MB, reduzido a no máximo
 * 600 px no lado maior. Redesenhar a imagem num canvas também descarta
 * qualquer coisa que não seja a imagem em si (metadados, conteúdo embutido).
 */
async function readLogo(file: File): Promise<ExportLogo> {
  if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Use uma imagem PNG ou JPEG.');
  if (file.size > MAX_LOGO_BYTES) throw new Error('A imagem passa de 2 MB. Use uma versão menor do logotipo.');
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, LOGO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível ler a imagem.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { dataUrl: canvas.toDataURL(mime, 0.9), mime, width, height };
}

/** Aparência do arquivo: modelo, modelo visual, folha, capa, sumário, cabeçalho e rodapé. */
export function LayoutTab({ doc, set }: Props) {
  const { notify } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [savingPref, setSavingPref] = useState(false);
  const layout = doc.layout;
  const cat = categoryById(doc.category);

  const update = (patch: Partial<ExportLayout>) => set({ layout: { ...layout, ...patch } });

  /** Aplica os padrões do modelo sem apagar os textos que o autor já preencheu. */
  const applyModelDefaults = async (category: ExportCategory, model: string) => {
    const base = layoutFor(category, model, await getPreferredLayout());
    set({
      category,
      model,
      layout: {
        ...base,
        subtitle: layout.subtitle,
        author: layout.author || base.author,
        institution: layout.institution || base.institution,
        dateLabel: layout.dateLabel,
        logo: layout.logo ?? base.logo,
        header: layout.header || base.header,
        footer: layout.footer || base.footer,
      },
    });
    notify(`Padrões de “${modelById(category, model).label}” aplicados.`);
  };

  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="card-title" style={{ margin: 0 }}>
          Modelo documental
        </h2>
        <div className="grid grid-2">
          <SelectInput
            label="Categoria"
            value={doc.category}
            onChange={(category) => {
              const c = categoryById(category);
              set({ category: c.id, model: c.models[0].id });
            }}
            options={EXPORT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
          />
          <SelectInput
            label="Modelo"
            value={doc.model}
            onChange={(model) => set({ model })}
            options={cat.models.map((m) => ({ value: m.id, label: m.label }))}
            hint={modelById(doc.category, doc.model).hint}
          />
        </div>
        <div className="row row-wrap">
          <button className="btn btn-sm" onClick={() => applyModelDefaults(doc.category, doc.model)}>
            Aplicar padrões deste modelo
          </button>
          <span className="small dim">Capa, sumário, numeração e modelo visual sugeridos para este tipo de documento.</span>
        </div>
      </section>

      <section className="card stack">
        <h2 className="card-title" style={{ margin: 0 }}>
          Modelo visual
        </h2>
        <div className="xp-themes" role="radiogroup" aria-label="Modelo visual">
          {EXPORT_THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={layout.theme === t.id}
              className={`xp-theme${layout.theme === t.id ? ' active' : ''}`}
              onClick={() => update({ theme: t.id })}
            >
              <span className="xp-swatch" aria-hidden="true">
                <i style={{ background: `#${t.colors.heading}` }} />
                <i style={{ background: `#${t.colors.accent}` }} />
                <i style={{ background: `#${t.colors.highlightBg}` }} />
              </span>
              <strong style={{ display: 'block' }}>{t.label}</strong>
              <span className="small dim">{t.description}</span>
            </button>
          ))}
        </div>
        <SelectInput
          label="Cor institucional"
          value={layout.accentColor}
          onChange={(accentColor) => update({ accentColor })}
          options={ACCENT_CHOICES}
          hint="Títulos e detalhes passam a esta cor; o texto continua escuro."
        />
      </section>

      <section className="card stack">
        <h2 className="card-title" style={{ margin: 0 }}>
          Folha e texto
        </h2>
        <div className="grid grid-2">
          <SelectInput
            label="Tamanho da folha"
            value={layout.pageSize}
            onChange={(pageSize) => update({ pageSize: pageSize as ExportLayout['pageSize'] })}
            options={Object.entries(PAGE_MM).map(([value, p]) => ({ value, label: p.label }))}
          />
          <SelectInput
            label="Margens"
            value={layout.margins}
            onChange={(margins) => update({ margins: margins as ExportLayout['margins'] })}
            options={[
              { value: 'estreita', label: 'Estreitas (1,5 cm)' },
              { value: 'normal', label: 'Normais (2,2 cm)' },
              { value: 'larga', label: 'Largas (2,8 cm)' },
            ]}
          />
          <SelectInput
            label="Espaçamento entre linhas"
            value={String(layout.lineSpacing)}
            onChange={(v) => update({ lineSpacing: Number(v) })}
            options={[
              { value: '1.15', label: 'Compacto' },
              { value: '1.35', label: 'Normal' },
              { value: '1.6', label: 'Amplo' },
              { value: '2', label: 'Duplo' },
            ]}
          />
        </div>
        <RangeInput label="Tamanho da letra" value={layout.fontSize} min={9} max={16} step={0.5} suffix=" pt" onChange={(fontSize) => update({ fontSize })} />
      </section>

      <section className="card stack">
        <h2 className="card-title" style={{ margin: 0 }}>
          Capa e identificação
        </h2>
        <Toggle label="Incluir capa" description="Página de abertura com título, subtítulo e identificação." checked={layout.cover} onChange={(cover) => update({ cover })} />
        <TextInput label="Subtítulo" value={layout.subtitle} onChange={(subtitle) => update({ subtitle })} />
        <div className="grid grid-2">
          <TextInput label="Autor" value={layout.author} onChange={(author) => update({ author })} placeholder="Como deve aparecer no documento" />
          <TextInput label="Instituição ou ministério" value={layout.institution} onChange={(institution) => update({ institution })} />
          <TextInput label="Data" value={layout.dateLabel} onChange={(dateLabel) => update({ dateLabel })} placeholder="12 de outubro de 2026" />
        </div>
        <div className="row row-wrap">
          {layout.logo ? (
            <>
              <img src={layout.logo.dataUrl} alt="Logotipo escolhido" style={{ height: 48, width: 'auto', borderRadius: 4, background: '#fff' }} />
              <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
                Trocar logotipo
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => update({ logo: undefined })}>
                Remover
              </button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
              Inserir logotipo (PNG ou JPEG)
            </button>
          )}
          <span className="small dim">Use somente um logotipo que você tem autorização para usar.</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                update({ logo: await readLogo(file) });
              } catch (err) {
                notify((err as Error).message, 'error');
              }
            }}
          />
        </div>
      </section>

      <section className="card stack">
        <h2 className="card-title" style={{ margin: 0 }}>
          Sumário, páginas e quebras
        </h2>
        <Toggle label="Sumário" description="Montado a partir dos títulos e subtítulos." checked={layout.toc} onChange={(toc) => update({ toc })} />
        <Toggle label="Numerar páginas" description="A capa nunca recebe número." checked={layout.pageNumbers} onChange={(pageNumbers) => update({ pageNumbers })} />
        {layout.pageNumbers && (
          <SelectInput
            label="Posição do número"
            value={layout.pageNumberAlign}
            onChange={(v) => update({ pageNumberAlign: v === 'right' ? 'right' : 'center' })}
            options={[
              { value: 'center', label: 'Centro do rodapé' },
              { value: 'right', label: 'Direita do rodapé' },
            ]}
          />
        )}
        <div className="grid grid-2">
          <TextInput label="Cabeçalho" value={layout.header} onChange={(header) => update({ header })} placeholder="Vazio: sem cabeçalho" />
          <TextInput label="Rodapé" value={layout.footer} onChange={(footer) => update({ footer })} placeholder="Vazio: só o número" />
        </div>
        <Toggle
          label="Cada título em página nova"
          description="Bom para apostilas e manuais. Para escolher seção por seção, use a Estrutura no Conteúdo."
          checked={layout.breakBeforeSections}
          onChange={(breakBeforeSections) => update({ breakBeforeSections })}
        />
        <Toggle
          label="Espaço para anotações"
          description="Linhas em branco no fim do documento."
          checked={layout.notesSpace}
          onChange={(notesSpace) => update({ notesSpace })}
        />
      </section>

      <div className="row row-wrap">
        <button
          className="btn btn-sm"
          disabled={savingPref}
          onClick={async () => {
            setSavingPref(true);
            try {
              await savePreferredLayout(layout);
              notify('Aparência guardada como seu padrão para os próximos documentos.');
            } finally {
              setSavingPref(false);
            }
          }}
        >
          Usar esta aparência como meu padrão
        </button>
        <span className="small dim">Guarda modelo visual, folha, letra, autor, instituição, logotipo, cabeçalho e rodapé.</span>
      </div>
    </div>
  );
}
