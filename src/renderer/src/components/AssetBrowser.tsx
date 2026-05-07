import React, { useState, useCallback } from 'react';

type AssetFile = { name: string; type: 'file'; path: string; fullPath: string; ext: string; };
type AssetFolder = { name: string; type: 'folder'; path: string; children: AssetEntry[]; };
type AssetEntry = AssetFile | AssetFolder;
type ViewMode = 'list' | 'grid-sm' | 'grid-lg';

interface Props {
  projectFolder: string | null;
  onOpenProject: () => void;
  onDragAsset:   (file: AssetFile) => void;
}

// File thumbnail
function FileThumb({
  file, onDragAsset, viewMode,
}: { file: AssetFile; onDragAsset: (f: AssetFile) => void; viewMode: ViewMode }) {
  const [src, setSrc] = useState<string | null>(null);

  React.useEffect(() => {
    (window as any).electronAPI?.fileToDataUrl(file.fullPath).then((url: string | null) => {
      if (url) setSrc(url);
    });
  }, [file.fullPath]);

  const handleDragStart = (e: React.DragEvent) => {
    // Include dataUrl so phaser-main can load the texture
    e.dataTransfer.setData('application/phaser-asset', JSON.stringify({ ...file, dataUrl: src ?? '' }));
    onDragAsset(file);
  };

  if (viewMode === 'list') {
    return (
      <div draggable onDragStart={handleDragStart} title={file.name}
        className="flex items-center gap-2 px-2 py-1 rounded cursor-grab hover:bg-gray-700 transition-colors group">
        <div className="w-6 h-6 flex-shrink-0 rounded overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center">
          {src ? <img src={src} alt="" className="w-full h-full object-contain" />
               : <span className="text-gray-600 text-[8px]">{file.ext.replace('.','')}</span>}
        </div>
        <span className="text-xs text-gray-300 truncate group-hover:text-white flex-1">{file.name}</span>
      </div>
    );
  }

  const isLarge = viewMode === 'grid-lg';
  const sz = isLarge ? 'w-20 h-20' : 'w-12 h-12';
  const textSz = isLarge ? 'text-[10px]' : 'text-[9px]';

  return (
    <div draggable onDragStart={handleDragStart} title={file.name}
      className="flex flex-col items-center gap-1 p-1.5 rounded cursor-grab hover:bg-gray-700 transition-colors group">
      <div className={`${sz} flex-shrink-0 rounded overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center`}>
        {src ? <img src={src} alt="" className="w-full h-full object-contain" />
             : <span className="text-gray-600 text-[10px]">{file.ext.replace('.','')}</span>}
      </div>
      <span className={`${textSz} text-gray-400 group-hover:text-white text-center leading-tight max-w-full`}
        style={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {file.name}
      </span>
    </div>
  );
}

// Folder row
function FolderRow({ folder, onDragAsset, viewMode }: {
  folder: AssetFolder; onDragAsset: (f: AssetFile) => void; viewMode: ViewMode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
        <span className="opacity-70">{open ? '▾' : '▸'}</span>
        <span>📂</span>
        <span className="truncate">{folder.name}</span>
      </button>
      {open && (
        <div className={`pl-3 ${viewMode !== 'list' ? 'flex flex-wrap gap-1 py-1' : ''}`}>
          {folder.children.map(child =>
            child.type === 'folder'
              ? <FolderRow key={child.path} folder={child} onDragAsset={onDragAsset} viewMode={viewMode} />
              : <FileThumb key={child.path} file={child} onDragAsset={onDragAsset} viewMode={viewMode} />
          )}
        </div>
      )}
    </div>
  );
}

// AssetBrowser
export default function AssetBrowser({ projectFolder, onOpenProject, onDragAsset }: Props) {
  const [assets,   setAssets]   = useState<AssetEntry[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const loadAssets = useCallback(async (folder: string) => {
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.readAssets(folder);
      setAssets(result);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (projectFolder) loadAssets(projectFolder);
    else setAssets([]);
  }, [projectFolder]);

  const flatFiles = useCallback((entries: AssetEntry[]): AssetFile[] => {
    const result: AssetFile[] = [];
    for (const e of entries) {
      if (e.type === 'file') result.push(e);
      else result.push(...flatFiles(e.children));
    }
    return result;
  }, []);

  const searchResults = search.trim()
    ? flatFiles(assets).filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  if (!projectFolder) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
      <div className="text-3xl opacity-20">📁</div>
      <p className="text-xs text-gray-500 text-center">No project open.<br />Open a Phaser project folder to browse assets.</p>
      <button onClick={onOpenProject}
        className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">
        Open Project Folder
      </button>
    </div>
  );

  const ViewBtn = ({ mode, icon, title }: { mode: ViewMode; icon: string; title: string }) => (
    <button onClick={() => setViewMode(mode)} title={title}
      className={`px-1.5 py-1 rounded text-xs transition-colors ${
        viewMode === mode ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-white'}`}>
      {icon}
    </button>
  );

  const isGrid = viewMode !== 'list';

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Toolbar: search + view mode toggle */}
      <div className="px-2 py-1.5 border-b border-gray-700 flex items-center gap-2 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-600" />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <ViewBtn mode="list"    icon="☰" title="List view" />
          <ViewBtn mode="grid-sm" icon="⊞" title="Small icons" />
          <ViewBtn mode="grid-lg" icon="⬛" title="Large icons" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {loading && <p className="text-xs text-gray-600 text-center py-4">Scanning…</p>}
        {!loading && assets.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">No images found in project.</p>
        )}

        {searchResults ? (
          <div className={isGrid ? 'flex flex-wrap gap-1' : ''}>
            {searchResults.map(f =>
              <FileThumb key={f.path} file={f} onDragAsset={onDragAsset} viewMode={viewMode} />
            )}
          </div>
        ) : (
          <div className={isGrid ? 'flex flex-wrap gap-1' : ''}>
            {assets.map(e =>
              e.type === 'folder'
                ? <FolderRow key={e.path} folder={e} onDragAsset={onDragAsset} viewMode={viewMode} />
                : <FileThumb key={e.path} file={e as AssetFile} onDragAsset={onDragAsset} viewMode={viewMode} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}