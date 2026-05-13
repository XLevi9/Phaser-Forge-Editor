// phaser-forge-bridge.js - Phaser Forge Editor Bridge v0.2
// Add to your game entry point. If this file is in the project root and
// your entry is src/main.js, use: import '../phaser-forge-bridge.js'

if (window.parent !== window) {
  let _idCounter = 0;
  const _objMap = new Map();

  function ensureId(obj) {
    if (!obj.__forgeId) {
      obj.__forgeId = 'forge_' + (_idCounter++);
      _objMap.set(obj.__forgeId, obj);
    }
    return obj.__forgeId;
  }

  function getProps(obj) {
    const p = {
      id: ensureId(obj),
      name: obj.name || '',
      type: obj.type || obj.constructor?.name || 'Unknown',
      x: obj.x ?? 0,
      y: obj.y ?? 0,
      rotation: obj.rotation ?? 0,
      scaleX: obj.scaleX ?? 1,
      scaleY: obj.scaleY ?? 1,
      alpha: obj.alpha ?? 1,
      visible: obj.visible ?? true,
      depth: obj.depth ?? 0,
      originX: obj.originX ?? 0.5,
      originY: obj.originY ?? 0.5,
    };
    if (obj.texture?.key && obj.texture.key !== '__DEFAULT' && obj.texture.key !== '__MISSING') {
      p.textureKey = obj.texture.key;
    }
    if (typeof obj.text === 'string') p.text = obj.text;
    if (obj.displayWidth) p.displayWidth = Math.round(obj.displayWidth);
    if (obj.displayHeight) p.displayHeight = Math.round(obj.displayHeight);
    return p;
  }

  function getGame() {
    return window.game || window.__phaserGame ||
      Object.values(window).find(v => v?.constructor?.name === 'Game');
  }

  function getBounds(obj) {
    const dw = obj.displayWidth ?? obj.width ?? 32;
    const dh = obj.displayHeight ?? obj.height ?? 32;
    const ox = obj.originX ?? 0.5;
    const oy = obj.originY ?? 0.5;
    let bounds = { x: (obj.x ?? 0) - dw * ox, y: (obj.y ?? 0) - dh * oy, width: dw, height: dh };
    try {
      const b = obj.getBounds?.();
      if (b && b.width > 0) bounds = b;
    } catch (_) {}
    return bounds;
  }

  function getScreenBounds(scene, bounds) {
    const canvas = scene?.game?.canvas;
    const cam = scene?.cameras?.main;
    if (!canvas || !cam) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const x = (bounds.x - cam.scrollX) * cam.zoom;
    const y = (bounds.y - cam.scrollY) * cam.zoom;
    const width = bounds.width * cam.zoom;
    const height = bounds.height * cam.zoom;
    return {
      x: rect.left + x * scaleX,
      y: rect.top + y * scaleY,
      width: width * scaleX,
      height: height * scaleY,
    };
  }

  function sendSelected(scene, obj, reason) {
    const bounds = getBounds(obj);
    window.parent.postMessage({
      forge: true,
      type: 'FORGE_SELECTED',
      id: ensureId(obj),
      sceneKey: scene?.sys?.settings?.key,
      reason,
      props: getProps(obj),
      bounds,
      screenBounds: getScreenBounds(scene, bounds),
    }, '*');
  }

  function pickObject(scene, gameX, gameY) {
    const cam = scene.cameras?.main;
    const point = cam?.getWorldPoint ? cam.getWorldPoint(gameX, gameY) : { x: gameX, y: gameY };
    const list = scene.children?.list ?? [];
    const objects = list
      .filter(obj => !obj.__forgeInternal && obj.active !== false && obj.visible !== false)
      .slice()
      .sort((a, b) => ((b.depth ?? 0) - (a.depth ?? 0)) || (list.indexOf(b) - list.indexOf(a)));
    return objects.find(obj => {
      const b = getBounds(obj);
      return point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height;
    });
  }

  window.addEventListener('message', (ev) => {
    if (!ev.data?.forge) return;
    const m = ev.data;
    const game = getGame();

    if (m.type === 'FORGE_PING') {
      window.parent.postMessage({ forge: true, type: 'FORGE_PONG', version: '0.2' }, '*');
    }

    if (m.type === 'FORGE_GET_SCENES') {
      if (!game) return;
      const scenes = game.scene.scenes
        .filter(s => s.sys.settings.status > 0)
        .map(s => ({
          key: s.sys.settings.key,
          active: s.sys.isActive(),
          visible: s.sys.isVisible(),
        }));
      window.parent.postMessage({ forge: true, type: 'FORGE_SCENES', scenes }, '*');
    }

    if (m.type === 'FORGE_GET_OBJECTS') {
      if (!game) return;
      const scene = game.scene.getScene(m.sceneKey);
      if (!scene) return;
      const objects = scene.children.list
        .filter(obj => !obj.__forgeInternal && obj.active !== false)
        .map(getProps);
      window.parent.postMessage({ forge: true, type: 'FORGE_OBJECTS', sceneKey: m.sceneKey, objects }, '*');
    }

    if (m.type === 'FORGE_SET_PROP') {
      const obj = _objMap.get(m.id);
      if (!obj) return;
      const v = m.value;
      const prop = m.prop;
      if (prop === 'x') obj.x = v;
      else if (prop === 'y') obj.y = v;
      else if (prop === 'rotation') obj.rotation = v;
      else if (prop === 'scaleX') obj.scaleX = v;
      else if (prop === 'scaleY') obj.scaleY = v;
      else if (prop === 'alpha') obj.alpha = v;
      else if (prop === 'visible') obj.visible = v;
      else if (prop === 'depth') obj.setDepth?.(v);
      const bounds = getBounds(obj);
      window.parent.postMessage({
        forge: true,
        type: 'FORGE_PROP_SET',
        id: m.id,
        sceneKey: obj.scene?.sys?.settings?.key,
        prop,
        value: v,
        props: getProps(obj),
        screenBounds: getScreenBounds(obj.scene, bounds),
      }, '*');
    }

    if (m.type === 'FORGE_SELECT') {
      const obj = _objMap.get(m.id);
      if (!obj) return;
      sendSelected(obj.scene, obj, m.reason);
    }

    if (m.type === 'FORGE_MOVE_OBJECT') {
      const obj = _objMap.get(m.id);
      if (!obj) return;
      const canvas = obj.scene?.game?.canvas;
      const cam = obj.scene?.cameras?.main;
      if (!canvas || !cam) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (m.dx * (canvas.width / rect.width)) / cam.zoom;
      const dy = (m.dy * (canvas.height / rect.height)) / cam.zoom;
      obj.x = m.startX + dx;
      obj.y = m.startY + dy;
      sendSelected(obj.scene, obj, 'move');
    }

    if (m.type === 'FORGE_PICK_OBJECT') {
      if (!game) return;
      const canvas = game.canvas;
      const rect = canvas.getBoundingClientRect();
      const gameX = (m.viewportX - rect.left) * (canvas.width / rect.width);
      const gameY = (m.viewportY - rect.top) * (canvas.height / rect.height);
      const preferred = m.sceneKey ? game.scene.getScene(m.sceneKey) : null;
      const scenes = [
        preferred,
        ...game.scene.scenes.filter(s => s !== preferred && s.sys?.isActive?.() && s.sys?.isVisible?.()),
      ].filter(Boolean);
      const picked = scenes
        .map(scene => ({ scene, hit: pickObject(scene, gameX, gameY) }))
        .find(r => r.hit);
      if (picked) sendSelected(picked.scene, picked.hit);
      else {
        window.parent.postMessage({
          forge: true,
          type: 'FORGE_PICK_DEBUG',
          x: Math.round(gameX),
          y: Math.round(gameY),
          scenes: scenes.map(s => ({ key: s.sys?.settings?.key, objects: s.children?.list?.length ?? 0 })),
        }, '*');
        window.parent.postMessage({ forge: true, type: 'FORGE_DESELECTED' }, '*');
      }
    }
  });

  const announce = () => window.parent.postMessage({ forge: true, type: 'FORGE_READY' }, '*');
  if (document.readyState === 'complete') setTimeout(announce, 800);
  else window.addEventListener('load', () => setTimeout(announce, 800));
}
