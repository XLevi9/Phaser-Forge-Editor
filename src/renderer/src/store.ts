import { create } from 'zustand';

export interface ObjectProps {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  tint: string;
  visible: boolean;
  depth: number;
  originX: number;
  originY: number;
  flipX: boolean;
  flipY: boolean;
  scrollFactorX: number;
  scrollFactorY: number;
}

interface HistoryEntry {
  id: string;
  props: ObjectProps;
}

interface EditorState extends ObjectProps {
  selectedId: string | null;
  snapEnabled: boolean;
  texW: number;
  texH: number;
  past: HistoryEntry[][];
  future: HistoryEntry[][];
  setSelectedObject: (id: string | null, props?: Partial<ObjectProps>, texW?: number, texH?: number) => void;
  updateProperties: (props: Partial<ObjectProps>) => void;
  toggleSnap: () => void;
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
}

const DEFAULTS: ObjectProps = {
  x: 0, y: 0, rotation: 0,
  scaleX: 1, scaleY: 1,
  alpha: 1, tint: '#ffffff', visible: true,
  depth: 0,
  originX: 0.5, originY: 0.5,
  flipX: false, flipY: false,
  scrollFactorX: 1, scrollFactorY: 1,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedId: null,
  snapEnabled: false,
  texW: 0,
  texH: 0,
  past: [], future: [],
  ...DEFAULTS,

  setSelectedObject: (id, props, texW = 0, texH = 0) =>
    set({ selectedId: id, ...DEFAULTS, ...props, texW, texH }),

  updateProperties: (props) =>
    set((s) => ({ ...s, ...props })),

  toggleSnap: () =>
    set((s) => ({ snapEnabled: !s.snapEnabled })),

  pushHistory: (entry) =>
    set((s) => ({
      past: [...s.past, [entry]],
      future: [],
    })),

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    const entry = prev[0];
    set({
      past: past.slice(0, -1),
      future: [prev, ...future],
      ...entry.props,
    });
    return entry;
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    const entry = next[0];
    set({
      past: [...past, next],
      future: future.slice(1),
      ...entry.props,
    });
    return entry;
  },
}));