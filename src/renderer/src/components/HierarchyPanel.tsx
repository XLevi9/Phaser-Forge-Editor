import React, { useState, useRef, useEffect } from 'react';

export interface HierarchyItem {
  id: string;
  name: string;
  type: string;
}

interface ContextMenu {
  x: number;
  y: number;
  item: HierarchyItem;
}

interface Props {
  items: HierarchyItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export default function HierarchyPanel({ items, selectedId, onSelect, onDelete, onDuplicate, onRename }: Props) {
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Focus rename input
  useEffect(() => {
    if (renamingId) inputRef.current?.select();
  }, [renamingId]);

  const openMenu = (e: React.MouseEvent, item: HierarchyItem) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, item });
  };

  const startRename = (item: HierarchyItem) => {
    setMenu(null);
    setRenamingId(item.id);
    setRenameVal(item.name);
  };

  const commitRename = () => {
    if (renamingId && renameVal.trim()) {
      onRename(renamingId, renameVal.trim());
    }
    setRenamingId(null);
  };

  const typeIcon = (type: string) => {
    if (type === 'Sprite') return '🖼';
    if (type === 'Image') return '🌄';
    if (type === 'Text') return '✏️';
    return '◻';
  };

  return (
    <aside className="w-52 flex flex-col border-r border-gray-700 bg-gray-800 relative">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hierarchy</span>
        <span className="text-xs text-gray-600">{items.length}</span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Scene root */}
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-300">
          <span>📁</span><span className="font-semibold">Scene</span>
        </div>

        {items.map(item => (
          <div key={item.id} className="pl-3">
            {renamingId === item.id ? (
              // ── Inline rename ──────────────────────────────────────────
              <input
                ref={inputRef}
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="w-full bg-gray-900 border border-blue-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
              />
            ) : (
              // ── Normal row ─────────────────────────────────────────────
              <button
                onClick={() => onSelect(item.id)}
                onContextMenu={e => openMenu(e, item)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors group ${
                  selectedId === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="opacity-60 text-sm">{typeIcon(item.type)}</span>
                <span className="truncate flex-1">{item.name}</span>
                {/* Show delete X on hover */}
                <span
                  onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                  className={`opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400 transition-opacity ml-auto px-1 text-gray-400 ${
                    selectedId === item.id ? 'text-blue-200' : ''
                  }`}
                  title="Delete"
                >✕</span>
              </button>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6 px-2">
            No objects in scene.<br/>Drag an asset to add one.
          </p>
        )}
      </div>

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          style={{ top: menu.y - 40, left: menu.x - 20, position: 'fixed', zIndex: 9999 }}
          className="bg-gray-800 border border-gray-600 rounded shadow-2xl py-1 min-w-36 text-xs"
        >
          <div className="px-3 py-1.5 text-gray-500 border-b border-gray-700 truncate">
            {menu.item.name}
          </div>
          <button onClick={() => { onSelect(menu.item.id); setMenu(null); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-700 text-gray-200 transition-colors">
            🎯 Select
          </button>
          <button onClick={() => startRename(menu.item)}
            className="w-full text-left px-3 py-2 hover:bg-gray-700 text-gray-200 transition-colors">
            ✏️ Rename
          </button>
          <button onClick={() => { onDuplicate(menu.item.id); setMenu(null); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-700 text-gray-200 transition-colors">
            ⎘ Duplicate
          </button>
          <div className="border-t border-gray-700 mt-1 pt-1" />
          <button onClick={() => { onDelete(menu.item.id); setMenu(null); }}
            className="w-full text-left px-3 py-2 hover:bg-red-900 text-red-400 transition-colors">
            🗑 Delete
          </button>
        </div>
      )}
    </aside>
  );
}