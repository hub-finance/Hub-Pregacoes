import type { MindMapData } from '../../core/mindmap';

export type MindHitType = 'center' | 'module' | 'child';

/** Nó como o motor o entrega: o centro, um assunto ou um desdobramento. */
export interface MindNode {
  label: string;
  tip: { title: string; body: string; source: string };
  id?: number;
  color?: string;
}

export interface MindMapOptions {
  onSelect?: (node: MindNode, type: MindHitType) => void;
  onHover?: (node: MindNode | null, clientX: number, clientY: number) => void;
  background?: string;
  gold?: string;
  goldLight?: string;
  childText?: string;
  /** Margens livres da tela (título, botões, painel), para enquadrar sem nada por cima. */
  insets?: (focused: boolean, width: number, height: number) => { t: number; r: number; b: number; l: number };
}

export interface MindMapHandle {
  redraw(): void;
  resize(): void;
  reset(): void;
  open(id: number): void;
  zoom(factor: number): void;
  toggleAll(): boolean;
  toPNG(maxSide?: number): string;
  destroy(): void;
}

export function createMindMap(canvas: HTMLCanvasElement, data: MindMapData, opts?: MindMapOptions): MindMapHandle;
