import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {normalizeCommons,normalizeArchive,normalizeYouTube,searchMedia,selectedMedia,
  safeDownloadHost,importMedia} from './media-library.mjs';

const openLicense='https://creativecommons.org/licenses/by/4.0/';
const commons={
  1:{title:'File:Sunset.jpg',imageinfo:[{
    url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Sunset.jpg',
    thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Sunset.jpg/400px-Sunset.jpg',
    descriptionurl:'https://commons.wikimedia.org/wiki/File:Sunset.jpg',size:1234,
    extmetadata:{LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:openLicense},
      Artist:{value:'<a href="/wiki/Ada">Ada</a>'}}
  }]},
  2:{title:'File:Protected.jpg',imageinfo:[{
    url:'https://upload.wikimedia.org/wikipedia/commons/f/f0/Protected.jpg',
    extmetadata:{LicenseShortName:{value:'All rights reserved'}}
  }]}
};
test('Wikimedia search normalizes only supported media with reusable licenses',()=>{
  const items=normalizeCommons(commons,'image');
  assert.equal(items.length,1);
  assert.equal(items[0].title,'Sunset.jpg');
  assert.equal(items[0].credit,'Ada');
  assert.equal(items[0].provider,'commons');
  assert.equal(normalizeCommons(commons,'video').length,0);
});
test('Internet Archive excludes records without a confirmed open license',()=>{
  const docs=[
    {identifier:'old_movie',title:'Movie',licenseurl:openLicense},
    {identifier:'new_movie',title:'Restricted',licenseurl:'All rights reserved'},
    {identifier:'missing',title:'No license'},
    {identifier:'../injection',title:'Bad',licenseurl:openLicense}
  ];
  assert.deepEqual(normalizeArchive(docs).map(x=>x.archiveId),['old_movie']);
});
test('YouTube discovery rejects malformed IDs and only emits valid links',()=>{
  const items=normalizeYouTube([
    {id:'abcdefghijk',title:{text:'Example clip'},author:{name:'Creator'}},
    {id:'oops',title:'Bad'}
  ]);
  assert.equal(items.length,1);
  assert.equal(items[0].pageUrl,'https://www.youtube.com/watch?v=abcdefghijk');
});
test('Media search keeps separate source errors, makes opaque download keys',async()=>{
  const results=await searchMedia('old film',{source:'all',kind:'all',
    fetcher:async(url)=>{
      if(String(url).includes('commons.wikimedia'))return new Response(JSON.stringify({
        query:{pages:commons}
      }),{status:200,headers:{'Content-Type':'application/json'}});
      if(String(url).includes('advancedsearch.php'))return new Response(JSON.stringify({
        response:{docs:[{identifier:'old_movie',title:'Old Movie',licenseurl:openLicense}]}
      }),{status:200,headers:{'Content-Type':'application/json'}});
      throw Error('Unsupported');
    },
    youtubeSearch:async()=>{throw Error('YouTube temporary failure');}
  });
  assert.equal(results.items.length,2);
  assert.equal(results.warnings.length,1);
  assert.equal(results.warnings[0].startsWith('youtube:'),true);
  const item=results.items[0];
  assert.ok(item.key.length>16);
  assert.equal('assetUrl' in item,false,'Result must not expose direct untrusted download URLs');
  assert.equal(selectedMedia(item.key).provider,'commons');
  assert.throws(()=>selectedMedia('not-a-valid-key'),/expirado/);
});
test('Downloader host allowlist refuses private services and untrusted domains',()=>{
  for(const url of ['http://127.0.0.1/private','https://localhost/secret',
    'https://upload.wikimedia.org.evil.tld/a.jpg','file:///etc/passwd']){
    assert.equal(safeDownloadHost(new URL(url)),false,url);
  }
  assert.equal(safeDownloadHost(new URL('https://archive.org/download/id/file.mp4')),true);
  assert.equal(safeDownloadHost(new URL('https://ia801234.us.archive.org/file.mp4')),true);
});
test('Authorized Commons photo is downloaded and accompanied by attribution metadata',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-test-media-'));
  try{
    const search=await searchMedia('sunset',{source:'commons',kind:'image',fetcher:async()=>new Response(JSON.stringify({
      query:{pages:commons}
    }),{status:200})});
    const result=await importMedia(search.items[0].key,{
      destination:temp,fetcher:async()=>new Response(new Uint8Array([255,216,255,217]),{
        headers:{'Content-Type':'image/jpeg','Content-Length':'4'}
      })
    });
    assert.equal(result.kind,'image');
    assert.equal(fs.existsSync(result.filePath),true);
    assert.equal(fs.existsSync(result.filePath.replace(/\.jpg$/,'.license.txt')),true);
    assert.match(fs.readFileSync(result.filePath.replace(/\.jpg$/,'.license.txt'),'utf8'),/CC BY 4.0/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('YouTube import reuses the existing Content Lab video cache instead of a second downloader',async()=>{
  const data=await searchMedia('short movie',{source:'youtube',kind:'video',
    youtubeSearch:async()=>({videos:[{id:'abcdefghijk',title:{text:'Clip'},author:{name:'Channel'}}]})});
  let originalUrl=null;
  const result=await importMedia(data.items[0].key,{downloader:async url=>{
    originalUrl=url;
    return {key:'yt-example',title:'Clip',path:'/tmp/example.mp4'};
  }});
  assert.equal(originalUrl,'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(result.cachedKey,'yt-example');
});
