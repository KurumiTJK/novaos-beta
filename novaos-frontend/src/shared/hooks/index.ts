// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef } from 'react';
import { haptic } from '../utils';

/**
 * Haptic feedback hook
 */
export function useHaptic() {
  return useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    haptic(style);
  }, []);
}

/**
 * Auto-resize textarea hook
 */
export function useAutoResize(maxHeight = 120) {
  const resize = useCallback((element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  return resize;
}

/**
 * Click outside hook
 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [callback]);

  return ref;
}

/**
 * Keyboard shortcut hook
 */
export function useKeyboard(key: string, callback: () => void, modifier?: 'ctrl' | 'shift' | 'alt') {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = modifier
        ? (modifier === 'ctrl' && event.ctrlKey) ||
          (modifier === 'shift' && event.shiftKey) ||
          (modifier === 'alt' && event.altKey)
        : true;

      if (event.key === key && modifierPressed) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, modifier]);
}
