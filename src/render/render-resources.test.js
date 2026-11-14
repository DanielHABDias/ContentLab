import { expect, test } from 'vitest';
import { renderResources } from './motion-renderer.js';
const gib = 1024 ** 3;
test('render reserves desktop capacity and caps caches on large machines', () => {
  expect(renderResources({ cpus: 16, freeMemory: 32 * gib })).toEqual({ concurrency: 4, offthreadVideoThreads: 2, offthreadVideoCacheSizeInBytes: gib, mediaCacheSizeInBytes: gib / 4 });
  expect(renderResources({ cpus: 4, freeMemory: 5 * gib }).concurrency).toBe(2);
});
test('low memory and one CPU still yield a usable bounded render', () => {
  const result = renderResources({ cpus: 1, freeMemory: gib });
  expect(result.concurrency).toBe(1);
  expect(result.offthreadVideoCacheSizeInBytes).toBeLessThan(gib / 4);
  expect(result.mediaCacheSizeInBytes).toBeGreaterThan(0);
});
