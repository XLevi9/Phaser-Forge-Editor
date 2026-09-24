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

export interface HistoryEntry {
  id: string;
  before: ObjectProps;
  after: ObjectProps;
}

interface EditorState extends ObjectProps {
  selectedId: string | null;
  snapEnabled: boolean;
  texW: number;
  texH: number;
  /** Last props recorded in history for the selected object — the `before` of the next entry. */
  committed: ObjectProps;
  past: HistoryEntry[];
  future: HistoryEntry[];
  setSelectedObject: (id: string | null, props?: Partial<ObjectProps>, texW?: number, texH?: number) => void;
  updateProperties: (props: Partial<ObjectProps>) => void;
  toggleSnap: () => void;
  commit: () => void;
  undo: () => { id: string; props: ObjectProps } | null;
  redo: () => { id: string; props: ObjectProps } | null;
}

const MAX_HISTORY = 100;

const DEFAULTS: ObjectProps = {
  x: 0, y: 0, rotation: 0,
  scaleX: 1, scaleY: 1,
  alpha: 1, tint: '#ffffff', visible: true,
  depth: 0,
  originX: 0.5, originY: 0.5,
  flipX: false, flipY: false,
  scrollFactorX: 1, scrollFactorY: 1,
};
const PROP_KEYS = Object.keys(DEFAULTS) as (keyof ObjectProps)[];

const pickProps = (s: ObjectProps): ObjectProps =>
  Object.fromEntries(PROP_KEYS.map(k => [k, s[k]])) as unknown as ObjectProps;

// Only overwrite the inspector when the history entry belongs to the selected object.
const applyEntry = (s: EditorState, id: string, props: ObjectProps) =>
  s.selectedId === id ? { ...props, committed: props } : {};

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedId: null,
  snapEnabled: false,
  texW: 0,
  texH: 0,
  committed: DEFAULTS,
  past: [],
  future: [],
  ...DEFAULTS,

  setSelectedObject: (id, props, texW = 0, texH = 0) => {
    const next = { ...DEFAULTS, ...props };
    set({ selectedId: id, ...next, committed: next, texW, texH });
  },

  updateProperties: (props) => set(props),

  toggleSnap: () => set(s => ({ snapEnabled: !s.snapEnabled })),

  commit: () => {
    const s = get();
    if (!s.selectedId) return;
    const after = pickProps(s);
    if (PROP_KEYS.every(k => after[k] === s.committed[k])) return;
    set({
      past: [...s.past, { id: s.selectedId, before: s.committed, after }].slice(-MAX_HISTORY),
      future: [],
      committed: after,
    });
  },

  undo: () => {
    const s = get();
    const entry = s.past[s.past.length - 1];
    if (!entry) return null;
    set({ past: s.past.slice(0, -1), future: [entry, ...s.future], ...applyEntry(s, entry.id, entry.before) });
    return { id: entry.id, props: entry.before };
  },

  redo: () => {
    const s = get();
    const entry = s.future[0];
    if (!entry) return null;
    set({ past: [...s.past, entry], future: s.future.slice(1), ...applyEntry(s, entry.id, entry.after) });
    return { id: entry.id, props: entry.after };
  },
}));
