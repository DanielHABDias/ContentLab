import { useEffect, useRef, useState } from 'react';

/** Offscreen and hidden-page demos do not mount a Remotion clock or render frames. */
export function VisiblePreview({ children, vertical = false }) {
  const element = useRef(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const changed = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  return <div ref={element} className="docs-preview-viewport" style={{ width: '100%', aspectRatio: vertical ? '9 / 16' : '16 / 9', maxHeight: vertical ? 560 : undefined }}>
    {visible && pageVisible ? children : <span className="hint">Prévia pausada fora da tela</span>}
  </div>;
}
