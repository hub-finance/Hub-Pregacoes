import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { BoardsTab } from './BoardsTab';
import { InfographicTab } from './InfographicTab';

/**
 * Imagens para compartilhar (PNG): os quadros e o infográfico num lugar só.
 * Antes eram duas abas separadas que faziam quase a mesma coisa.
 */
export function ImagesTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  return (
    <div className="stack">
      <section className="stack">
        <h2 className="xr-section-title">Quadros</h2>
        <BoardsTab material={material} reading={reading} />
      </section>
      <section className="stack">
        <h2 className="xr-section-title">Infográfico</h2>
        <InfographicTab material={material} reading={reading} />
      </section>
    </div>
  );
}
