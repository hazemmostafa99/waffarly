'use client';

import { useEffect, useRef } from 'react';

export function useStorefrontCartFeedback() {
  const context = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      const audio = context.current;
      // Let the success chime finish when a dialog closes after adding.
      if (audio) window.setTimeout(() => void audio.close().catch(() => {}), 700);
    },
    [],
  );

  function prepare() {
    try {
      if (!('AudioContext' in window)) return;
      context.current ??= new AudioContext();
      if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
    } catch {
      /* Feedback must never interrupt the cart. */
    }
  }

  function play() {
    try {
      navigator.vibrate?.([65, 45, 85]);
    } catch {
      /* Optional hardware. */
    }
    const audio = context.current;
    if (!audio || audio.state !== 'running') return;
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
      /* Keep the visible confirmation even when audio is unavailable. */
    }
  }

  return { prepare, play };
}
