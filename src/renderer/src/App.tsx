import React from 'react';

function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex h-12 items-center border-b border-gray-700 bg-gray-800 px-4">
        <h1 className="text-lg font-bold">Phaser Forge</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Hierarchy */}
        <div className="w-64 border-r border-gray-700 bg-gray-800 p-4">
          <h2 className="mb-2 font-semibold text-gray-400 text-sm uppercase">Hierarchy</h2>
          <div className="text-sm">Scene</div>
        </div>

        {/* Viewport */}
        <div className="flex-1 bg-gray-950 flex flex-col relative">
          {/* WebView will go here */}
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Viewport (Phaser 4)
          </div>
        </div>

        {/* Inspector */}
        <div className="w-72 border-l border-gray-700 bg-gray-800 p-4">
          <h2 className="mb-4 font-semibold text-gray-400 text-sm uppercase">Inspector</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Transform</label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-4">X</span>
                  <input type="number" className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-4">Y</span>
                  <input type="number" className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Assets Browser */}
      <div className="h-48 border-t border-gray-700 bg-gray-800 p-4">
        <h2 className="mb-2 font-semibold text-gray-400 text-sm uppercase">Assets</h2>
      </div>
    </div>
  );
}

export default App;
