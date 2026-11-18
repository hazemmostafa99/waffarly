'use client';

import { useEffect, useRef, useState } from 'react';
import { useCartStore } from './use-cart-store';

export function useCartAdditionSound() {
  const additionId = useCartStore((state) => state.cartAddition?.id);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const context = useRef<AudioContext | null>(null);
  const playedId = useRef<string | undefined>(undefined);

  useEffect(() => {
    function unlock(event: Event) {
      if (!soundEnabled || !('AudioContext' in window)) return;
      if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
      try {
        context.current ??= new AudioContext();
        if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
      } catch {
        /* Audio is optional; cart feedback remains visible. */
      }
    }
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      const previous = context.current;
      context.current = null;
      if (previous && previous.state !== 'closed') void previous.close().catch(() => {});
    };
  }, [soundEnabled]);

  useEffect(() => {
    if (!additionId || additionId === playedId.current) return;
    playedId.current = additionId;
    if (soundEnabled && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([65, 45, 85]);
      } catch {
        /* Unsupported hardware or browser policy. */
      }
    }
    const audio = context.current;
    if (!soundEnabled || !audio || audio.state !== 'running') return;
    try {
      const start = audio.currentTime;
      [660, 830, 990].forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const at = start + index * 0.13;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.09, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.29);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.31);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    } catch {
      /* Audio must never interrupt an add-to-cart operation. */
    }
  }, [additionId, soundEnabled]);

  return { soundEnabled, toggleSound: () => setSoundEnabled((value) => !value) };
}
