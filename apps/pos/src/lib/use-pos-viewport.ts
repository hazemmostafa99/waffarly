import { useEffect, useState, type CSSProperties } from 'react';

/** Use the visible area above the on-screen keyboard; ignore pinch-zoom geometry. */
export function usePosViewport() {
  const read = () => {
    const viewport = window.visualViewport;
    const editable =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches('input, textarea, [contenteditable="true"]');
    const narrow = window.innerWidth < 1024;
    const height = viewport && viewport.scale === 1 ? viewport.height : window.innerHeight;
    return {
      height,
      top: viewport && viewport.scale === 1 ? viewport.offsetTop : 0,
      compact: narrow && height < 600,
      editing: narrow && editable && height < 600,
    };
  };
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(read()));
    };
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  return {
    ...viewport,
    dialogStyle: {
      '--pos-visible-height': `${viewport.height}px`,
      '--pos-visible-top': `${viewport.top}px`,
    } as CSSProperties,
  };
}
