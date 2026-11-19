import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { VisiblePreview } from './VisiblePreview.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('offscreen previews do not mount; leaving viewport stops the animation and disconnects on cleanup', () => {
  let intersect; const disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', vi.fn(function Observer(callback) { intersect = callback; this.observe = vi.fn(); this.disconnect = disconnect; }));
  const mounted = vi.fn(), stopped = vi.fn();
  function Demo() { React.useEffect(() => { mounted(); return stopped; }, []); return <span>Animation</span>; }
  const view = render(<VisiblePreview><Demo/></VisiblePreview>);
  expect(mounted).not.toHaveBeenCalled();
  act(() => intersect([{ isIntersecting: true }])); expect(screen.getByText('Animation')).toBeInTheDocument(); expect(mounted).toHaveBeenCalledTimes(1);
  act(() => intersect([{ isIntersecting: false }])); expect(screen.queryByText('Animation')).not.toBeInTheDocument(); expect(stopped).toHaveBeenCalledTimes(1);
  view.unmount(); expect(disconnect).toHaveBeenCalledTimes(1);
});

test('switching away from the browser tab unmounts visible previews until the page is visible again', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  render(<VisiblePreview><span>Preview</span></VisiblePreview>);
  expect(screen.getByText('Preview')).toBeInTheDocument();
  visibility.mockReturnValue('hidden'); act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.queryByText('Preview')).not.toBeInTheDocument();
  visibility.mockReturnValue('visible'); act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.getByText('Preview')).toBeInTheDocument();
});
