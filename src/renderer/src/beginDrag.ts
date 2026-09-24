import type React from 'react';

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Tracks a mouse drag from `e` and reports the offset from the start point until mouseup. */
export function beginDrag(e: React.MouseEvent, cursor: string, onMove: (dx: number, dy: number) => void) {
  e.preventDefault();
  const x0 = e.clientX;
  const y0 = e.clientY;
  const body = document.body.style;
  body.cursor = cursor;
  body.userSelect = 'none';
  const move = (ev: MouseEvent) => onMove(ev.clientX - x0, ev.clientY - y0);
  const up = () => {
    body.cursor = '';
    body.userSelect = '';
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}
