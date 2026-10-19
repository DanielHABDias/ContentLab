import test from 'node:test';
import assert from 'node:assert/strict';
import {thumbnailBackground} from './thumbnail-background.mjs';

test('thumbnails use the installed HQ TSX source at a fixed frame in both formats', () => {
  for (const [width,height] of [[1280,720],[1080,1920]]) {
    for (const style of ['paper','film','grid','stars']) {
      const svg=thumbnailBackground({style,width,height});
      assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      assert.ok(!svg.includes('<div'));
      assert.ok(!/<\/defs><rect\b[^>]*fill="#(?:10100F|252936|EEE9DD|080B13|10101A)"/.test(svg), 'base não fica incorporada à textura');
      assert.ok(svg.includes(style==='paper'?'<polygon':style==='stars'?'<circle':'<path'));
    }
  }
  assert.notEqual(thumbnailBackground({style:'paper',tone:'dark'}),thumbnailBackground({style:'paper',tone:'light'}));
});
test('background endpoint contract never accepts paths or arbitrary code', () => {
  for (const style of ['../../evil.tsx','<script>','unknown']) assert.throws(()=>thumbnailBackground({style}));
  assert.throws(()=>thumbnailBackground({style:'paper',width:99999}));
  assert.throws(()=>thumbnailBackground({style:'paper',tone:'bad'}));
});
