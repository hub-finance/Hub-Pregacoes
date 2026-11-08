/**
 * Lora e Source Sans 3 para a leitura — os mesmos arquivos que os PDFs usam
 * (public/fonts, licença OFL). O @font-face entra por aqui, e não num .css,
 * porque o endereço precisa partir da página: o app roda na raiz do site, no
 * APK e, se for o caso, numa subpasta (base './' no Vite).
 */
const FACES: Array<[family: string, file: string, weight: number, style: 'normal' | 'italic']> = [
  ['Lora', 'Lora-Regular.ttf', 400, 'normal'],
  ['Lora', 'Lora-Italic.ttf', 400, 'italic'],
  ['Lora', 'Lora-Bold.ttf', 700, 'normal'],
  ['Lora', 'Lora-BoldItalic.ttf', 700, 'italic'],
  ['Source Sans 3', 'SourceSans3-Regular.ttf', 400, 'normal'],
  ['Source Sans 3', 'SourceSans3-Italic.ttf', 400, 'italic'],
  ['Source Sans 3', 'SourceSans3-Bold.ttf', 700, 'normal'],
  ['Source Sans 3', 'SourceSans3-BoldItalic.ttf', 700, 'italic'],
];

export function registerReaderFonts(): void {
  if (typeof document === 'undefined' || document.getElementById('hub-reader-fonts')) return;
  const base = import.meta.env.BASE_URL;
  const style = document.createElement('style');
  style.id = 'hub-reader-fonts';
  // font-display: swap — o texto aparece na hora e troca de letra quando ela chega
  style.textContent = FACES.map(([family, file, weight, fontStyle]) =>
    `@font-face{font-family:'${family}';src:url('${base}fonts/${file}') format('truetype');font-weight:${weight};font-style:${fontStyle};font-display:swap;}`,
  ).join('\n');
  document.head.appendChild(style);
}
