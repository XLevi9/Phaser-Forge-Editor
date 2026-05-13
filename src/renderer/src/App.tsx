import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore, ObjectProps } from './store';
import HierarchyPanel, { HierarchyItem } from './components/HierarchyPanel';
import AssetBrowser from './components/AssetBrowser';

type ToolMode = 'select' | 'move' | 'rotate' | 'scale';
const round2 = (n: number) => Math.round(n * 100) / 100;
const MIN_PANEL_H = 72;
const MAX_PANEL_H = 480;
const DEFAULT_PANEL_H = 180;

// InspectorField
interface FieldProps {
  label: string; value: number | string | boolean;
  type?: 'number' | 'color' | 'checkbox'; min?: number; max?: number; step?: number;
  onChange: (v: any) => void;
}
function InspectorField({ label, value, type = 'number', min, max, step = 0.01, onChange }: FieldProps) {
  if (type === 'checkbox') return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-400 w-28">{label}</span>
      <input type="checkbox" checked={value as boolean} onChange={e => onChange(e.target.checked)}
        className="accent-blue-500 w-4 h-4" />
    </div>
  );
  if (type === 'color') return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-400 w-28">{label}</span>
      <input type="color" value={value as string} onChange={e => onChange(e.target.value)}
        className="w-10 h-7 rounded border border-gray-600 bg-transparent cursor-pointer" />
    </div>
  );
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-400 w-28">{label}</span>
      <input type="number" value={value as number} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:border-blue-500" />
    </div>
  );
}

// ToolBtn
function ToolBtn({ icon, label, active, onClick, disabled, extra = '' }:
  { icon: string; label: string; active?: boolean; onClick: () => void; disabled?: boolean; extra?: string }) {
  return (
    <button title={label} onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      } ${extra}`}>
      <span>{icon}</span><span className="hidden xl:inline">{label}</span>
    </button>
  );
}

// SetupDialog
function SetupDialog({ onConfirm, onCancel }: {
  onConfirm: (w: number, h: number) => void; onCancel: () => void;
}) {
  const [w, setW] = useState(1280);
  const [h, setH] = useState(720);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-6 w-80">
        <h2 className="text-sm font-semibold text-white mb-1">Project Canvas Size</h2>
        <p className="text-xs text-gray-400 mb-5 leading-relaxed">
          Match the size to your Phaser game config.<br />
          Check <span className="text-gray-300 font-mono">GAME_WIDTH</span> / <span className="text-gray-300 font-mono">GAME_HEIGHT</span> in your constants.
        </p>
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Width (px)</span>
            <input type="number" value={w} onChange={e => setW(parseInt(e.target.value) || 1280)} min={100} max={7680}
              className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Height (px)</span>
            <input type="number" value={h} onChange={e => setH(parseInt(e.target.value) || 720)} min={100} max={4320}
              className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-2 flex-wrap pt-1">
            {[{ l: '1280×720', w: 1280, h: 720 }, { l: '960×540', w: 960, h: 540 }, { l: '800×600', w: 800, h: 600 }].map(p => (
              <button key={p.l} onClick={() => { setW(p.w); setH(p.h); }}
                className="px-2 py-0.5 rounded text-[10px] border border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-300 transition-colors">
                {p.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={() => onConfirm(w, h)} className="px-4 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">Open Project</button>
        </div>
      </div>
    </div>
  );
}

// App
export default function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const store = useEditorStore();

  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [toolMode, setToolModeState] = useState<ToolMode>('select');
  const [projectFolder, setProjectFolder] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 1280, h: 720 });
  const [setupDialog, setSetupDialog] = useState<{ show: boolean; pending: string | null }>({ show: false, pending: null });

  // Asset panel resize
  const [panelH, setPanelH] = useState(DEFAULT_PANEL_H);
  const [panelOpen, setPanelOpen] = useState(true);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ y: 0, h: 0 });

  // Hierarchy + Inspector panel widths
  const [hierarchyW, setHierarchyW] = useState(208);
  const [inspectorW, setInspectorW] = useState(256);
  const makeHResizer = (setter: (w: number) => void, dir: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = dir === 'left' ? hierarchyW : inspectorW;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const delta = dir === 'left' ? ev.clientX - startX : startX - ev.clientX;
      setter(Math.max(140, Math.min(400, startW + delta)));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Lock state
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    toPhaser({ type: 'SET_LOCKED_IDS', ids: [...lockedIds] });
  }, [lockedIds]);


  const toggleLocked = useCallback((id: string) => {
    setLockedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setHierarchy(prev => prev.map(i => i.id === id ? { ...i, locked: !i.locked } : i));
  }, []);

  // Bridge (live mode)
  type BridgeStatus = 'disconnected' | 'connecting' | 'connected';
  interface BridgeObject { id: string; name: string; type: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number; alpha: number; visible: boolean; depth: number; originX: number; originY: number; textureKey?: string; text?: string; displayWidth?: number; displayHeight?: number; }
  interface BridgeScreenBounds { x: number; y: number; width: number; height: number; }
  interface BridgeScene { key: string; active: boolean; visible: boolean; }
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('disconnected');
  const [bridgeScenes, setBridgeScenes] = useState<BridgeScene[]>([]);
  const [activeBridgeScene, setActiveBridgeScene] = useState<string | null>(null);
  const [bridgeObjects, setBridgeObjects] = useState<BridgeObject[]>([]);
  const [bridgeSelectedId, setBridgeSelectedId] = useState<string | null>(null);
  const [bridgeSelected, setBridgeSelected] = useState<BridgeObject | null>(null);
  const [bridgeScreenBounds, setBridgeScreenBounds] = useState<BridgeScreenBounds | null>(null);
  const [liveEditMode, setLiveEditMode] = useState(false); // false = play, true = select objects
  const overlayRef = useRef<HTMLDivElement>(null);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toGame = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const requestBridgeObjects = useCallback((sceneKey: string) => {
    toGame({ forge: true, type: 'FORGE_GET_OBJECTS', sceneKey });
  }, [toGame]);

  // Dev server
  type DevStatus = 'idle' | 'starting' | 'running' | 'error';
  const [devStatus, setDevStatus] = useState<DevStatus>('idle');
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [devLogs, setDevLogs] = useState('');
  const [activeTab, setActiveTab] = useState<'assets' | 'console'>('assets');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.onDevServerOutput((text: string) => {
      setDevLogs(prev => prev + text);
      setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    api?.onDevServerStopped(() => {
      setDevStatus('idle');
      setDevUrl(null);
    });
    return () => api?.removeDevServerListeners();
  }, []);

  // When game URL changes, reset bridge and start pinging
  useEffect(() => {
    setBridgeStatus('disconnected');
    setBridgeScenes([]);
    setBridgeObjects([]);
    setBridgeSelectedId(null);
    setBridgeSelected(null);
    setBridgeScreenBounds(null);
    if (!devUrl) return;
    setBridgeStatus('connecting');
    pingTimerRef.current = setTimeout(() => {
      toGame({ forge: true, type: 'FORGE_PING' });
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        toGame({ forge: true, type: 'FORGE_PING' });
        if (attempts >= 15) {
          clearInterval(interval);
          setBridgeStatus(prev => prev === 'connecting' ? 'disconnected' : prev);
        }
      }, 2000);
      pingTimerRef.current = interval as any;
    }, 1500);
    return () => { if (pingTimerRef.current) clearInterval(pingTimerRef.current as any); };
  }, [devUrl]);

  const handleRunStop = async () => {
    const api = (window as any).electronAPI;
    if (devStatus === 'running' || devStatus === 'starting') {
      await api?.stopDevServer();
      setDevStatus('idle');
      setDevUrl(null);
    } else {
      if (!projectFolder) return;
      setDevStatus('starting');
      setDevLogs('');
      setActiveTab('console');
      const result = await api?.startDevServer(projectFolder);
      if (result?.ok && result.url) {
        setDevStatus('running');
        setDevUrl(result.url);
      } else {
        setDevStatus('error');
        setDevLogs(prev => prev + `\n[Error: ${result?.error ?? 'Unknown error'}]\n`);
      }
    }
  };

  const handleInstallBridge = async () => {
    if (!projectFolder) return;
    const r = await (window as any).electronAPI?.installBridge(projectFolder);
    if (r?.ok) {
      setBridgeStatus('disconnected');
      setDevLogs(prev => prev + "\n[Bridge installed: phaser-forge-bridge.js]\n[Import it from your game entry, e.g. src/main.js: import '../phaser-forge-bridge.js']\n");
      setActiveTab('console');
      if (!panelOpen) setPanelOpen(true);
    } else {
      setDevLogs(prev => prev + `\n[Bridge install failed: ${r?.error ?? 'Unknown error'}]\n`);
      setActiveTab('console');
      if (!panelOpen) setPanelOpen(true);
    }
  };

  // Drag overlay
  const [isDraggingAsset, setIsDraggingAsset] = useState(false);

  // Save state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const pendingSaveRef = useRef(false);
  const pendingLoadFolderRef = useRef<string | null>(null);
  const hierarchyRef = useRef<HierarchyItem[]>([]);
  const projectFolderRef = useRef<string | null>(null);
  useEffect(() => { projectFolderRef.current = projectFolder; }, [projectFolder]);
  useEffect(() => {
    hierarchyRef.current = hierarchy;
    if (hierarchy.length > 0) setSaveStatus('unsaved');
  }, [hierarchy]);

  const designSrc = `./phaser.html?w=${canvasSize.w}&h=${canvasSize.h}`;
  const iframeSrc = devUrl ?? designSrc;

  const toPhaser = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const setTool = useCallback((mode: ToolMode) => {
    setToolModeState(mode);
    toPhaser({ type: 'SET_TOOL_MODE', mode });
  }, [toPhaser]);

  // Messages from Phaser
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const m = ev.data;

      // Bridge messages from live game
      if (m?.forge) {
        if (m.type === 'FORGE_READY' || m.type === 'FORGE_PONG') {
          setBridgeStatus('connected');
          if (pingTimerRef.current) { clearTimeout(pingTimerRef.current); pingTimerRef.current = null; }
          toGame({ forge: true, type: 'FORGE_GET_SCENES' });
        }
        if (m.type === 'FORGE_SCENES') {
          setBridgeScenes(m.scenes ?? []);
          const active = (m.scenes as BridgeScene[]).find(s => s.active)?.key ?? m.scenes?.[0]?.key ?? null;
          setActiveBridgeScene(active);
          if (active) requestBridgeObjects(active);
        }
        if (m.type === 'FORGE_OBJECTS') {
          setBridgeObjects(m.objects ?? []);
          setActiveBridgeScene(m.sceneKey);
        }
        if (m.type === 'FORGE_SELECTED') {
          setBridgeSelected(m.props ?? null);
          setBridgeSelectedId(m.id ?? null);
          if (m.screenBounds) {
            setBridgeScreenBounds({
              x: m.screenBounds.x,
              y: m.screenBounds.y,
              width: m.screenBounds.width,
              height: m.screenBounds.height,
            });
          } else {
            setBridgeScreenBounds(null);
          }
        }
        if (m.type === 'FORGE_DESELECTED') {
          setBridgeSelected(null);
          setBridgeSelectedId(null);
          setBridgeScreenBounds(null);
        }
        if (m.type === 'FORGE_PROP_SET' && bridgeSelected?.id === m.id) {
          setBridgeSelected(prev => prev ? { ...prev, [m.prop]: m.value } : null);
        }
        return;
      }

      if (!m?.type) return;
      switch (m.type) {
        case 'SCENE_READY':
          setHierarchy((m.hierarchy ?? []).map((i: any) => ({ ...i, visible: true, locked: false })));
          if (pendingLoadFolderRef.current) {
            const f = pendingLoadFolderRef.current;
            pendingLoadFolderRef.current = null;
            loadSceneFromFile(f);
          }
          break;
        case 'OBJECT_SELECTED':
          store.setSelectedObject(m.id, {
            x: round2(m.x ?? 0), y: round2(m.y ?? 0),
            rotation: round2(m.rotation ?? 0),
            scaleX: round2(m.scaleX ?? 1), scaleY: round2(m.scaleY ?? 1),
            alpha: round2(m.alpha ?? 1), tint: m.tint ?? '#ffffff',
            visible: m.visible ?? true, depth: m.depth ?? 0,
            originX: round2(m.originX ?? 0.5), originY: round2(m.originY ?? 0.5),
            flipX: m.flipX ?? false, flipY: m.flipY ?? false,
            scrollFactorX: m.scrollFactorX ?? 1, scrollFactorY: m.scrollFactorY ?? 1,
          }, m.texW ?? 0, m.texH ?? 0); break;
        case 'OBJECT_DESELECTED': store.setSelectedObject(null); break;
        case 'OBJECT_TRANSFORMED': {
          const cur = useEditorStore.getState();
          if (m.id !== cur.selectedId) break;
          store.updateProperties({
            x: m.x !== undefined ? round2(m.x) : cur.x,
            y: m.y !== undefined ? round2(m.y) : cur.y,
            rotation: m.rotation !== undefined ? round2(m.rotation) : cur.rotation,
            scaleX: m.scaleX !== undefined ? round2(m.scaleX) : cur.scaleX,
            scaleY: m.scaleY !== undefined ? round2(m.scaleY) : cur.scaleY,
          }); break;
        }
        case 'PUSH_HISTORY': {
          const s = useEditorStore.getState();
          if (!s.selectedId) break;
          store.pushHistory({
            id: s.selectedId,
            props: { x: s.x, y: s.y, rotation: s.rotation, scaleX: s.scaleX,
                     scaleY: s.scaleY, alpha: s.alpha, tint: s.tint, visible: s.visible,
                     depth: s.depth, originX: s.originX, originY: s.originY,
                     flipX: s.flipX, flipY: s.flipY,
                     scrollFactorX: s.scrollFactorX, scrollFactorY: s.scrollFactorY },
          }); break;
        }
        case 'OBJECT_ADDED':
          setHierarchy(prev => [...prev, { id: m.id, name: m.name, type: m.objType, visible: true, locked: false }]); break;
        case 'OBJECT_REMOVED':
          setHierarchy(prev => prev.filter(i => i.id !== m.id));
          if (useEditorStore.getState().selectedId === m.id) store.setSelectedObject(null); break;
        case 'OBJECT_RENAMED':
          setHierarchy(prev => prev.map(i => i.id === m.id ? { ...i, name: m.name } : i)); break;
        case 'SCENE_STATE': {
          if (!pendingSaveRef.current) break;
          pendingSaveRef.current = false;
          setSaveStatus('saving');
          const folder = projectFolderRef.current;
          if (!folder) { setSaveStatus('unsaved'); break; }
          (async () => {
            const hier = hierarchyRef.current;
            const objects = (m.objects as any[]).map(obj => ({
              ...obj,
              name: hier.find(h => h.id === obj.id)?.name ?? obj.name,
            }));
            const saved = await (window as any).electronAPI?.saveScene(folder, objects);
            setSaveStatus(saved ? 'saved' : 'unsaved');
          })();
          break;
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (projectFolderRef.current) {
          pendingSaveRef.current = true;
          toPhaser({ type: 'GET_SCENE_STATE' });
        }
        return;
      }
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const entry = useEditorStore.getState().undo();
        if (entry) toPhaser({ type: 'SET_PROPERTIES', id: entry.id, ...entry.props }); return;
      }
      if ((e.ctrlKey && e.key.toLowerCase() === 'y') ||
          (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        const entry = useEditorStore.getState().redo();
        if (entry) toPhaser({ type: 'SET_PROPERTIES', id: entry.id, ...entry.props }); return;
      }
      switch (e.key.toLowerCase()) {
        case 'q': setTool('select'); break;
        case 'w': setTool('move'); break;
        case 'e': setTool('rotate'); break;
        case 'r': setTool('scale'); break;
        case 'f': toPhaser({ type: 'RESET_CAMERA' }); break;
        case 'delete': { const id = useEditorStore.getState().selectedId; if (id) handleDeleteObject(id); break; }
        case 'escape': store.setSelectedObject(null); toPhaser({ type: 'DESELECT_ALL' }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Clear drag state on global dragend
  useEffect(() => {
    const onDragEnd = () => setIsDraggingAsset(false);
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  }, []);

  // Panel resize (mouse drag on handle)
  const startPanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    resizeStartRef.current = { y: e.clientY, h: panelH };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = resizeStartRef.current.y - ev.clientY;
      setPanelH(Math.max(MIN_PANEL_H, Math.min(MAX_PANEL_H, resizeStartRef.current.h + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Save
  const handleSave = () => {
    if (!projectFolder) return;
    pendingSaveRef.current = true;
    toPhaser({ type: 'GET_SCENE_STATE' });
  };

  // Load scene from file into phaser
  const loadSceneFromFile = async (folder: string) => {
    const data = await (window as any).electronAPI?.loadScene(folder);
    if (!data?.objects?.length) return;
    const objects = await Promise.all(data.objects.map(async (obj: any) => {
      if (obj.kind !== 'sprite' || !obj.assetFullPath) return obj;
      const dataUrl = await (window as any).electronAPI?.fileToDataUrl(obj.assetFullPath);
      return { ...obj, dataUrl: dataUrl ?? '' };
    }));
    toPhaser({ type: 'LOAD_SCENE', objects });
    setSaveStatus('saved');
  };

  // Open project
  const handleOpenProject = async () => {
    const folder = await (window as any).electronAPI?.openFolder();
    if (!folder) return;
    const config = await (window as any).electronAPI?.readProjectConfig(folder);
    if (config?.canvasWidth && config?.canvasHeight) {
      const sizeChanged = config.canvasWidth !== canvasSize.w || config.canvasHeight !== canvasSize.h;
      setProjectFolder(folder);
      setCanvasSize({ w: config.canvasWidth, h: config.canvasHeight });
      setHierarchy([]);
      store.setSelectedObject(null);
      pendingLoadFolderRef.current = folder;
      if (!sizeChanged) toPhaser({ type: 'RESET_SCENE' });
      // if sizeChanged: iframe reloads → SCENE_READY fires → load triggered there
    } else {
      setSetupDialog({ show: true, pending: folder });
    }
  };

  const handleSetupConfirm = async (w: number, h: number) => {
    const folder = setupDialog.pending!;
    await (window as any).electronAPI?.writeProjectConfig(folder, { canvasWidth: w, canvasHeight: h });
    setProjectFolder(folder);
    setCanvasSize({ w, h });
    setHierarchy([]);
    store.setSelectedObject(null);
    setSetupDialog({ show: false, pending: null });
    pendingLoadFolderRef.current = folder;
  };

  // Hierarchy actions
  const handleSelectObject = (id: string) => toPhaser({ type: 'SELECT_OBJECT', id });
  const handleDeleteObject = (id: string) => {
    toPhaser({ type: 'DELETE_OBJECT', id });
    setHierarchy(prev => prev.filter(i => i.id !== id));
    if (store.selectedId === id) store.setSelectedObject(null);
  };
  const handleDuplicateObject = (id: string) =>
    toPhaser({ type: 'DUPLICATE_OBJECT', id, newId: `${id}_copy_${Date.now()}` });
  const handleRenameObject = (id: string, name: string) => {
    toPhaser({ type: 'RENAME_OBJECT', id, name });
    setHierarchy(prev => prev.map(i => i.id === id ? { ...i, name } : i));
  };

  // Drop asset on viewport (via overlay div)
  const handleDropAsset = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAsset(false);
    const raw = e.dataTransfer.getData('application/phaser-asset');
    if (!raw) return;
    const file = JSON.parse(raw);

    // Letterbox-aware coordinate conversion
    const iframe = iframeRef.current;
    if (!iframe) return;
    const ir = iframe.getBoundingClientRect();
    const gameAspect = canvasSize.w / canvasSize.h;
    const iframeAspect = ir.width / ir.height;
    let displayW: number, displayH: number, offsetX: number, offsetY: number;
    if (iframeAspect > gameAspect) {
      displayH = ir.height; displayW = displayH * gameAspect;
      offsetX = (ir.width - displayW) / 2; offsetY = 0;
    } else {
      displayW = ir.width; displayH = displayW / gameAspect;
      offsetX = 0; offsetY = (ir.height - displayH) / 2;
    }
    const scale = displayW / canvasSize.w;
    const canvasX = Math.round((e.clientX - ir.left - offsetX) / scale);
    const canvasY = Math.round((e.clientY - ir.top - offsetY) / scale);

    toPhaser({ type: 'ADD_SPRITE_FROM_ASSET', file, x: canvasX, y: canvasY });
  };

  // Drop asset on hierarchy = add at canvas center
  const handleDropOnHierarchy = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAsset(false);
    const raw = e.dataTransfer.getData('application/phaser-asset');
    if (!raw) return;
    const file = JSON.parse(raw);
    toPhaser({ type: 'ADD_SPRITE_FROM_ASSET', file, x: canvasSize.w / 2, y: canvasSize.h / 2 });
  };

  const handleLiveViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeBridgeScene || bridgeStatus !== 'connected') return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const rect = iframe.getBoundingClientRect();
    toGame({
      forge: true,
      type: 'FORGE_PICK_OBJECT',
      sceneKey: activeBridgeScene,
      viewportX: e.clientX - rect.left,
      viewportY: e.clientY - rect.top,
    });
  };

  // Inspector field
  const updateField = (key: keyof ObjectProps, value: any) => {
    store.updateProperties({ [key]: value });
    if (store.selectedId) toPhaser({ type: 'SET_PROPERTIES', id: store.selectedId, [key]: value });
  };

  const handleSnap = () => {
    store.toggleSnap();
    toPhaser({ type: 'SET_SNAP', enabled: !store.snapEnabled });
  };

  const handleIframeLoad = () => {
    toPhaser({ type: 'SET_TOOL_MODE', mode: toolMode });
    toPhaser({ type: 'SET_SNAP', enabled: store.snapEnabled });
    toPhaser({ type: 'SET_LOCKED_IDS', ids: [...lockedIds] });
  };

  const { selectedId, x, y, rotation, scaleX, scaleY, alpha, tint, visible, depth, originX, originY, flipX, flipY, scrollFactorX, scrollFactorY, texW, texH, snapEnabled, past, future } = store;

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-900 text-white select-none overflow-hidden">

      {setupDialog.show && (
        <SetupDialog
          onConfirm={handleSetupConfirm}
          onCancel={() => setSetupDialog({ show: false, pending: null })}
        />
      )}

      {/* ── Toolbar ── */}
      <header className="toolbar flex h-11 items-center gap-1 px-3 flex-shrink-0">
        <span className="font-bold text-sm text-white mr-3 tracking-wide whitespace-nowrap">⚡ Phaser Forge</span>

        <button onClick={handleOpenProject} title={projectFolder ?? 'Open Project Folder'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700 transition-all max-w-40 mr-1">
          📁 <span className="truncate hidden lg:inline">{projectFolder ? projectFolder.split(/[\\/]/).pop() : 'Open Project'}</span>
        </button>

        {projectFolder && (
          <span className="text-[10px] text-gray-600 border border-gray-700 rounded px-1.5 py-0.5 mr-2 hidden xl:block">
            {canvasSize.w}×{canvasSize.h}
          </span>
        )}

        <div className="w-px h-5 bg-gray-700 mr-1" />

        <div className="flex items-center gap-0.5">
          <ToolBtn icon="↖" label="Select (Q)" active={toolMode === 'select'} onClick={() => setTool('select')} />
          <ToolBtn icon="✥" label="Move (W)" active={toolMode === 'move'} onClick={() => setTool('move')} />
          <ToolBtn icon="↻" label="Rotate (E)" active={toolMode === 'rotate'} onClick={() => setTool('rotate')} />
          <ToolBtn icon="⤢" label="Scale (R)" active={toolMode === 'scale'} onClick={() => setTool('scale')} />
        </div>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <button onClick={handleSnap} title="Snap to Grid"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border transition-all ${
            snapEnabled ? 'border-blue-500 bg-blue-900/40 text-blue-300' : 'border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
          ⊞ <span className="hidden xl:inline">Snap</span>
        </button>

        <button onClick={() => toPhaser({ type: 'RESET_CAMERA' })} title="Reset Camera View (F)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border border-gray-700 text-gray-400 hover:bg-gray-700 transition-all ml-0.5">
          ⌂ <span className="hidden xl:inline">Reset View</span>
        </button>

        <div className="flex items-center gap-0.5 ml-1">
          <ToolBtn icon="↩" label="Undo" disabled={past.length === 0}
            onClick={() => { const e = store.undo(); if (e) toPhaser({ type: 'SET_PROPERTIES', id: e.id, ...e.props }); }} />
          <ToolBtn icon="↪" label="Redo" disabled={future.length === 0}
            onClick={() => { const e = store.redo(); if (e) toPhaser({ type: 'SET_PROPERTIES', id: e.id, ...e.props }); }} />
        </div>

        <div className="flex-1" />
        {past.length > 0 && <span className="text-xs text-gray-700 hidden xl:block mr-2">{past.length} action{past.length !== 1 ? 's' : ''}</span>}
        {saveStatus === 'unsaved' && <span className="text-[10px] text-yellow-600 hidden xl:block">unsaved</span>}
        {saveStatus === 'saving'  && <span className="text-[10px] text-gray-500 hidden xl:block">saving…</span>}
        {saveStatus === 'saved'   && <span className="text-[10px] text-gray-700 hidden xl:block">saved</span>}
        {devStatus === 'running' && (
          <span className="text-[10px] font-mono text-green-600 border border-green-900 rounded px-1.5 py-0.5 hidden xl:flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            {devUrl}
          </span>
        )}
        <ToolBtn
          icon={devStatus === 'running' ? '⏹' : devStatus === 'starting' ? '⏳' : '▶'}
          label={devStatus === 'running' ? 'Stop' : devStatus === 'starting' ? 'Starting…' : 'Run Game'}
          onClick={handleRunStop}
          disabled={!projectFolder || devStatus === 'starting'}
          extra={devStatus === 'running' ? 'text-red-400' : devStatus === 'error' ? 'text-orange-400' : 'text-green-400'}
        />
        {bridgeStatus === 'connected' && (
          <button
            title={liveEditMode ? 'Edit mode — click to select objects' : 'Play mode — interacting with game normally'}
            onClick={() => { setLiveEditMode(m => !m); setBridgeScreenBounds(null); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-all ${
              liveEditMode
                ? 'border-yellow-500 bg-yellow-900/40 text-yellow-300'
                : 'border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
            {liveEditMode ? '🎯 Edit' : '🎮 Play'}
          </button>
        )}
        <ToolBtn icon="⌨" label="VS Code" onClick={() => {
          if (projectFolder) (window as any).electronAPI?.openVSCode(projectFolder);
        }} disabled={!projectFolder} />
        <ToolBtn icon="💾" label="Save (Ctrl+S)" onClick={handleSave} disabled={!projectFolder} />
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Hierarchy ── */}
        <div style={{ width: hierarchyW }}
          className={`flex-shrink-0 relative ${isDraggingAsset ? 'ring-1 ring-inset ring-blue-600/40' : ''}`}
          onDragOver={isDraggingAsset ? e => e.preventDefault() : undefined}
          onDrop={isDraggingAsset ? handleDropOnHierarchy : undefined}
        >
          {devUrl ? (
            /* LIVE MODE — bridge objects */
            <aside className="flex flex-col border-r border-gray-700 bg-gray-800 h-full overflow-hidden">
              {/* Bridge status bar */}
              <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1">Hierarchy</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                  bridgeStatus === 'connected' ? 'bg-green-900/50 text-green-400' :
                  bridgeStatus === 'connecting' ? 'bg-yellow-900/50 text-yellow-400' :
                  'bg-gray-700 text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    bridgeStatus === 'connected' ? 'bg-green-400' :
                    bridgeStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'}`} />
                  {bridgeStatus}
                </span>
              </div>
              {/* Scene selector */}
              {bridgeScenes.length > 0 && (
                <div className="px-2 py-1.5 border-b border-gray-700 flex-shrink-0">
                  <select value={activeBridgeScene ?? ''} onChange={e => {
                    setActiveBridgeScene(e.target.value);
                    requestBridgeObjects(e.target.value);
                  }} className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
                    {bridgeScenes.map(s => (
                      <option key={s.key} value={s.key}>{s.key}{s.active ? ' ●' : ''}</option>
                    ))}
                  </select>
                  <button onClick={() => activeBridgeScene && requestBridgeObjects(activeBridgeScene)}
                    className="mt-1 w-full text-[10px] text-gray-600 hover:text-gray-300 transition-colors">↺ Refresh</button>
                </div>
              )}
              {/* Objects list */}
              <div className="flex-1 overflow-y-auto py-1">
                {bridgeStatus !== 'connected' ? (
                  <div className="p-4 text-center">
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                      {bridgeStatus === 'connecting' ? 'Connecting to game bridge…' : 'Bridge not detected in game.'}
                    </p>
                    {(bridgeStatus === 'connecting' || bridgeStatus === 'disconnected') && (
                      <button onClick={handleInstallBridge}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">
                        Install Bridge
                      </button>
                    )}
                  </div>
                ) : bridgeObjects.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-6">No objects in scene.</p>
                ) : (
                  bridgeObjects.map(obj => (
                    <div key={obj.id}
                      onClick={() => {
                        setBridgeSelectedId(obj.id);
                        setBridgeSelected(obj);
                        toGame({ forge: true, type: 'FORGE_SELECT', id: obj.id });
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded text-xs cursor-pointer transition-colors ${
                        bridgeSelectedId === obj.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'}`}>
                      <span className="opacity-50 truncate max-w-16">{obj.type}</span>
                      <span className="truncate flex-1">{obj.name || obj.id}</span>
                      <span className="text-[9px] text-gray-600 font-mono">{Math.round(obj.x)},{Math.round(obj.y)}</span>
                    </div>
                  ))
                )}
              </div>
            </aside>
          ) : (
            /* DESIGN MODE — our scene objects */
            <HierarchyPanel
              items={hierarchy} selectedId={selectedId}
              onSelect={handleSelectObject} onDelete={handleDeleteObject}
              onDuplicate={handleDuplicateObject} onRename={handleRenameObject}
              onAddPrimitive={shape => toPhaser({ type: 'ADD_PRIMITIVE', shape })}
              onToggleVisible={id => {
                const item = hierarchy.find(i => i.id === id);
                if (!item) return;
                const next = !item.visible;
                setHierarchy(prev => prev.map(i => i.id === id ? { ...i, visible: next } : i));
                toPhaser({ type: 'SET_PROPERTIES', id, visible: next });
                if (selectedId === id) store.updateProperties({ visible: next });
              }}
              onToggleLocked={id => toggleLocked(id)}
            />
          )}
          {isDraggingAsset && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[10px] text-blue-400 bg-gray-900/80 px-2 py-1 rounded">Drop to add at center</span>
            </div>
          )}
        </div>
        {/* Hierarchy resize handle */}
        <div onMouseDown={makeHResizer(setHierarchyW, 'left')}
          className={`w-1 flex-shrink-0 cursor-ew-resize hover:bg-blue-500 transition-colors bg-transparent `} />

        {/* ── Viewport ── */}
        <main className="flex-1 bg-[#0a0f1a] relative overflow-hidden">
          <iframe ref={iframeRef} src={iframeSrc} onLoad={handleIframeLoad}
            className="w-full h-full border-none" title="Phaser Viewport" />

          {/* Transparent drag-drop overlay — sits over iframe while dragging asset */}
          {isDraggingAsset && (
            <div
              className="absolute inset-0 z-10 cursor-copy"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropAsset}
            >
              <div className="absolute inset-0 border-2 border-dashed border-blue-500/40 pointer-events-none" />
            </div>
          )}

          {devUrl && bridgeStatus === 'connected' && liveEditMode && !isDraggingAsset && (
            <div
              ref={overlayRef}
              className="absolute inset-0 z-10 cursor-crosshair"
              onClick={handleLiveViewportClick}
            >
              {bridgeScreenBounds && bridgeScreenBounds.width > 0 && bridgeScreenBounds.height > 0 && (
                <div
                  className="absolute border border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.25)] pointer-events-none"
                  style={{
                    left: bridgeScreenBounds.x,
                    top: bridgeScreenBounds.y,
                    width: bridgeScreenBounds.width,
                    height: bridgeScreenBounds.height,
                  }}
                >
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-blue-500" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-blue-500" />
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-blue-500" />
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-blue-500" />
                </div>
              )}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
            {devUrl ? (
              <span className="bg-green-900/90 backdrop-blur text-green-300 text-xs px-2 py-1 rounded uppercase tracking-wider border border-green-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="bg-gray-900/80 backdrop-blur text-gray-300 text-xs px-2 py-1 rounded uppercase tracking-wider border border-gray-700">{toolMode}</span>
            )}
            {!devUrl && snapEnabled && <span className="bg-blue-900/80 backdrop-blur text-blue-300 text-xs px-2 py-1 rounded border border-blue-700">SNAP 32px</span>}
          </div>
          <div className="absolute bottom-3 left-3 text-gray-700 text-[10px] pointer-events-none">
            Q·W·E·R = tools &nbsp;·&nbsp; Scroll = zoom &nbsp;·&nbsp; Middle mouse = pan &nbsp;·&nbsp; F = reset view &nbsp;·&nbsp; Del = delete
          </div>
        </main>

        {/* Inspector resize handle */}
        <div onMouseDown={makeHResizer(setInspectorW, 'right')}
          className={`w-1 flex-shrink-0 cursor-ew-resize hover:bg-blue-500 transition-colors bg-transparent `} />
        {/* ── Inspector ── */}
        <aside style={{ width: inspectorW }} className="flex-shrink-0 flex flex-col border-l border-gray-700 bg-gray-800 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inspector</span>
            {devUrl && <span className="text-[10px] text-green-600 font-medium">LIVE</span>}
          </div>

          {/* LIVE MODE inspector — bridge selected object */}
          {devUrl && bridgeSelected && (
            <div className="p-3 space-y-4 text-sm">
              <div className="bg-gray-900 rounded px-3 py-2">
                <div className="text-[10px] text-gray-500 mb-0.5">Type / Name</div>
                <div className="text-xs text-white font-mono truncate">{bridgeSelected.type} — {bridgeSelected.name || bridgeSelected.id}</div>
                {bridgeSelected.textureKey && <div className="text-[10px] text-gray-500 mt-0.5">Texture: {bridgeSelected.textureKey}</div>}
              </div>
              <section>
                <div className="section-label mb-2">Position</div>
                <InspectorField label="X" value={Math.round(bridgeSelected.x)} step={1} onChange={v => { setBridgeSelected(p => p ? { ...p, x: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'x', value: v }); }} />
                <InspectorField label="Y" value={Math.round(bridgeSelected.y)} step={1} onChange={v => { setBridgeSelected(p => p ? { ...p, y: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'y', value: v }); }} />
                {bridgeSelected.displayWidth !== undefined && <div className="text-[10px] text-gray-600 text-right">display: {bridgeSelected.displayWidth}×{bridgeSelected.displayHeight}px</div>}
              </section>
              <section>
                <div className="section-label mb-2">Rotation</div>
                <InspectorField label="Angle (rad)" value={round2(bridgeSelected.rotation)} step={0.01} onChange={v => { setBridgeSelected(p => p ? { ...p, rotation: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'rotation', value: v }); }} />
                <div className="text-[10px] text-gray-600 text-right -mt-1">{Math.round((bridgeSelected.rotation * 180) / Math.PI)}°</div>
              </section>
              <section>
                <div className="section-label mb-2">Scale</div>
                <InspectorField label="Scale X" value={round2(bridgeSelected.scaleX)} step={0.01} min={0} onChange={v => { setBridgeSelected(p => p ? { ...p, scaleX: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'scaleX', value: v }); }} />
                <InspectorField label="Scale Y" value={round2(bridgeSelected.scaleY)} step={0.01} min={0} onChange={v => { setBridgeSelected(p => p ? { ...p, scaleY: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'scaleY', value: v }); }} />
              </section>
              <section>
                <div className="section-label mb-2">Appearance</div>
                <InspectorField label="Alpha" value={round2(bridgeSelected.alpha)} step={0.01} min={0} max={1} onChange={v => { setBridgeSelected(p => p ? { ...p, alpha: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'alpha', value: v }); }} />
                <InspectorField label="Depth" value={bridgeSelected.depth} step={1} onChange={v => { setBridgeSelected(p => p ? { ...p, depth: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'depth', value: v }); }} />
                <InspectorField label="Visible" value={bridgeSelected.visible} type="checkbox" onChange={v => { setBridgeSelected(p => p ? { ...p, visible: v } : null); toGame({ forge: true, type: 'FORGE_SET_PROP', id: bridgeSelected.id, prop: 'visible', value: v }); }} />
              </section>
            </div>
          )}

          {devUrl && !bridgeSelected && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="text-4xl mb-3 opacity-20">🎮</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {bridgeStatus === 'connected' ? 'Click an object in the hierarchy.' : 'Waiting for bridge connection…'}
              </p>
            </div>
          )}

          {/* DESIGN MODE inspector */}
          {!devUrl && selectedId ? (
            <div className="p-3 space-y-4 text-sm">
              <div className="bg-gray-900 rounded px-3 py-2">
                <div className="text-[10px] text-gray-500 mb-0.5">ID</div>
                <div className="text-xs text-white font-mono truncate">{selectedId}</div>
              </div>
              <section>
                <div className="section-label mb-2">Position</div>
                <InspectorField label="X" value={x} step={1} onChange={v => updateField('x', v)} />
                <InspectorField label="Y" value={y} step={1} onChange={v => updateField('y', v)} />
              </section>
              <section>
                <div className="section-label mb-2">Rotation</div>
                <InspectorField label="Angle (rad)" value={rotation} step={0.01} onChange={v => updateField('rotation', v)} />
                <div className="text-[10px] text-gray-600 text-right -mt-1">{Math.round((rotation * 180) / Math.PI)}°</div>
              </section>
              <section>
                <div className="section-label mb-2">Scale</div>
                <InspectorField label="Scale X" value={scaleX} step={0.01} min={0} onChange={v => updateField('scaleX', v)} />
                <InspectorField label="Scale Y" value={scaleY} step={0.01} min={0} onChange={v => updateField('scaleY', v)} />
              </section>
              <section>
                <div className="section-label mb-2">Appearance</div>
                <InspectorField label="Alpha" value={alpha} step={0.01} min={0} max={1} onChange={v => updateField('alpha', Math.min(1, Math.max(0, v)))} />
                <InspectorField label="Tint" value={tint} type="color" onChange={v => updateField('tint', v)} />
                <InspectorField label="Visible" value={visible} type="checkbox" onChange={v => updateField('visible', v)} />
              </section>
              <section>
                <div className="section-label mb-2">Depth (Z-order)</div>
                <InspectorField label="Depth" value={depth} step={1} onChange={v => updateField('depth', Math.round(v))} />
                <div className="text-[10px] text-gray-600 -mt-1">Higher = rendered on top</div>
              </section>
              <section>
                <div className="section-label mb-2">Origin (Pivot)</div>
                <InspectorField label="Origin X" value={originX} step={0.01} min={0} max={1} onChange={v => updateField('originX', Math.min(1, Math.max(0, v)))} />
                <InspectorField label="Origin Y" value={originY} step={0.01} min={0} max={1} onChange={v => updateField('originY', Math.min(1, Math.max(0, v)))} />
                {/* Quick presets */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {([
                    { l: 'TL', x: 0, y: 0 },
                    { l: 'TC', x: 0.5, y: 0 },
                    { l: 'TR', x: 1, y: 0 },
                    { l: 'CL', x: 0, y: 0.5 },
                    { l: 'C', x: 0.5, y: 0.5 },
                    { l: 'CR', x: 1, y: 0.5 },
                    { l: 'BL', x: 0, y: 1 },
                    { l: 'BC', x: 0.5, y: 1 },
                    { l: 'BR', x: 1, y: 1 },
                  ] as const).map(p => (
                    <button key={p.l}
                      onClick={() => { updateField('originX', p.x); updateField('originY', p.y); }}
                      className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                        originX === p.x && originY === p.y
                          ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                          : 'border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300'
                      }`}>
                      {p.l}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-gray-600 mt-1">Affects where x/y anchors on the sprite</div>
              </section>
              <section>
                <div className="section-label mb-2">Flip</div>
                <div className="flex gap-2">
                  {(['X', 'Y'] as const).map(axis => {
                    const val = axis === 'X' ? flipX : flipY;
                    const key = axis === 'X' ? 'flipX' : 'flipY';
                    return (
                      <button key={axis} onClick={() => updateField(key, !val)}
                        className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                          val ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                              : 'border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300'}`}>
                        Flip {axis}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section>
                <div className="section-label mb-2">Scroll Factor</div>
                <InspectorField label="Factor X" value={scrollFactorX} step={0.1} min={0} max={1} onChange={v => updateField('scrollFactorX', v)} />
                <InspectorField label="Factor Y" value={scrollFactorY} step={0.1} min={0} max={1} onChange={v => updateField('scrollFactorY', v)} />
                <div className="flex gap-2 mt-1.5">
                  {[{ l: 'UI (0)', v: 0 }, { l: 'World (1)', v: 1 }].map(p => (
                    <button key={p.l}
                      onClick={() => { updateField('scrollFactorX', p.v); updateField('scrollFactorY', p.v); }}
                      className={`flex-1 py-1 rounded text-[10px] border transition-colors ${
                        scrollFactorX === p.v && scrollFactorY === p.v
                          ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                          : 'border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300'}`}>
                      {p.l}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-gray-600 mt-1">0 = fixed to camera (UI), 1 = moves with world</div>
              </section>
              {texW > 0 && (
                <section>
                  <div className="section-label mb-2">Display Size</div>
                  <InspectorField label="Width (px)" value={round2(scaleX * texW)} step={1} min={1}
                    onChange={v => updateField('scaleX', round2(v / texW))} />
                  <InspectorField label="Height (px)" value={round2(scaleY * texH)} step={1} min={1}
                    onChange={v => updateField('scaleY', round2(v / texH))} />
                  <div className="text-[10px] text-gray-600 mt-1">Native: {texW}×{texH}px — edits scale</div>
                </section>
              )}
              <button onClick={() => handleDeleteObject(selectedId)}
                className="w-full py-2 rounded text-xs text-red-400 border border-red-900 hover:bg-red-900/30 transition-colors">
                🗑 Delete Object
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="text-5xl mb-4 opacity-20">🎯</div>
              <p className="text-xs text-gray-500 leading-relaxed">Click an object in the viewport or hierarchy to inspect.</p>
            </div>
          )}
        </aside>
      </div>

      {/* ── Asset Browser (resizable) ── */}
      <footer className="border-t border-gray-700 bg-gray-800 flex-shrink-0"
        style={{ height: panelOpen ? panelH + 36 : 36 }}>

        {panelOpen && (
          <div
            onMouseDown={startPanelResize}
            className="h-2 w-full cursor-ns-resize flex items-center justify-center group flex-shrink-0"
            style={{ background: 'transparent' }}
          >
            <div className="w-16 h-0.5 rounded-full bg-gray-600 group-hover:bg-blue-500 transition-colors" />
          </div>
        )}

        {/* Panel header with tabs */}
        <div className="px-3 flex items-center gap-1 h-9 border-b border-gray-700">
          <button onClick={() => setPanelOpen(o => !o)} className="text-gray-500 hover:text-white transition-colors mr-1">
            {panelOpen ? '▾' : '▸'}
          </button>
          {/* Tabs */}
          {(['assets', 'console'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (!panelOpen) setPanelOpen(true); }}
              className={`px-3 py-1 text-xs rounded-t font-medium transition-colors ${
                activeTab === tab && panelOpen
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}>
              {tab === 'assets' ? 'Assets' : (
                <span className="flex items-center gap-1">
                  Console
                  {devStatus === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                  {devStatus === 'error'   && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          {activeTab === 'assets' && (
            <button onClick={handleOpenProject} className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-gray-700">
              📁 {projectFolder ? 'Change' : 'Open Folder'}
            </button>
          )}
          {activeTab === 'console' && devLogs && (
            <button onClick={() => setDevLogs('')} className="text-xs text-gray-600 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-gray-700">
              Clear
            </button>
          )}
        </div>

        {/* Panel content */}
        {panelOpen && activeTab === 'assets' && (
          <div style={{ height: panelH - 4 }} className="flex overflow-hidden">
            <AssetBrowser
              projectFolder={projectFolder}
              onOpenProject={handleOpenProject}
              onDragAsset={() => setIsDraggingAsset(true)}
            />
          </div>
        )}

        {panelOpen && activeTab === 'console' && (
          <div style={{ height: panelH - 4 }} className="bg-gray-950 overflow-y-auto font-mono text-[11px] p-2">
            {devLogs ? (
              <>
                <pre className="text-gray-300 whitespace-pre-wrap leading-relaxed">{devLogs}</pre>
                <div ref={consoleEndRef} />
              </>
            ) : (
              <p className="text-gray-700 text-center py-6">
                {devStatus === 'idle' ? 'Press ▶ Run Game to start the dev server.' : 'Waiting for output…'}
              </p>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
