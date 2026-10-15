import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {classifyVideoLink,externalToolPath,getExternalVideoInfo,downloadExternalAsset} from './video-external.mjs';

test('YouTube is routed to the original downloader while public video platforms use yt-dlp',()=>{
  for(const url of ['https://www.youtube.com/watch?v=BaW_jenozKc',
    'https://youtu.be/BaW_jenozKc','https://music.youtube.com/watch?v=BaW_jenozKc'])
    assert.equal(classifyVideoLink(url).provider,'youtube');
  for(const url of ['https://www.tiktok.com/@creator/video/1234567890',
    'https://www.instagram.com/reel/xyz/', 'https://vimeo.com/1234',
    'https://br.pinterest.com/pin/123456789012345/', 'https://www.reddit.com/r/test/comments/123',
    'https://x.com/creator/status/123', 'https://www.facebook.com/watch/?v=123'])
    assert.equal(classifyVideoLink(url).provider,'external',url);
});
test('Potentially dangerous links are rejected before yt-dlp runs',()=>{
  for(const url of [
    'http://www.tiktok.com/video/123','https://localhost/video',
    'https://127.0.0.1/admin','https://192.168.1.1/movie',
    'https://tiktok.com.evil.example/watch', 'file:///etc/passwd',
    'https://tiktok.com:8080/post','https://username:password@vimeo.com/12',
    'https://169.254.169.254/latest/meta-data/',
    'https://example.com/video.mp4','not a url'])
    assert.throws(()=>classifyVideoLink(url),Error,url);
});
test('YouTube metadata is not sent to yt-dlp',async()=>{
  await assert.rejects(getExternalVideoInfo('https://www.youtube.com/watch?v=BaW_jenozKc',
    {runner:async()=>{throw Error('should not run');}}),/carregador original/);
});
test('yt-dlp metadata parses one public video and never invokes a shell',async()=>{
  let invocation;
  const info=await getExternalVideoInfo('https://vimeo.com/1234',{
    env:{CONTENTLAB_YT_DLP:'/custom/bin/yt-dlp'},
    runner:async(bin,args,opts)=>{
      invocation={bin,args,opts};
      return {stdout:JSON.stringify({title:'My movie',duration:122.3,id:'1234',
        thumbnail:'https://i.vimeocdn.com/video/123.jpg'})};
    }
  });
  assert.equal(info.title,'My movie');
  assert.equal(info.duration,122.3);
  assert.equal(info.thumbnail,'https://i.vimeocdn.com/video/123.jpg');
  assert.equal(invocation.bin,'/custom/bin/yt-dlp');
  assert.equal(invocation.args.includes('--dump-single-json'),true);
  assert.equal(invocation.args.includes('--no-playlist'),true);
  assert.equal(invocation.args.includes('--ignore-config'),true);
  assert.deepEqual(invocation.args.slice(-1),['https://vimeo.com/1234']);
});
test('Missing optional downloader shows installation instructions instead of generic ENOENT',async()=>{
  await assert.rejects(getExternalVideoInfo('https://vimeo.com/1234',{
    runner:async()=>{throw Object.assign(Error('spawn yt-dlp ENOENT'),{code:'ENOENT'});}
  }),/yt-dlp não está instalado/);
});
test('Non-public videos give a useful error instead of pretending they are supported',async()=>{
  await assert.rejects(getExternalVideoInfo('https://www.tiktok.com/@a/video/1234',{
    runner:async()=>{throw Error('ERROR: Login required, use cookies');}
  }),/exige autenticação/);
});
test('Downloader writes one MP4 with a size limit, ffmpeg and no generic extractor',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-yt-dlp-test-'));
  try{
    let args;
    const file=await downloadExternalAsset('https://vimeo.com/1234',directory,{
      runner:async(bin,cliArgs)=>{
        args=cliArgs;
        fs.writeFileSync(path.join(directory,'video.mp4'),Buffer.from('mock'));
        return {stdout:'',stderr:''};
      }
    });
    assert.equal(file,path.join(directory,'video.mp4'));
    assert.ok(args.includes('--max-filesize'));
    assert.ok(args.includes('1G'));
    assert.ok(args.includes('--no-playlist'));
    assert.ok(args.includes('default,-generic'));
    assert.ok(args.includes('--recode-video'));
    assert.equal(args.at(-1),'https://vimeo.com/1234');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('The yt-dlp executable can be configured for different operating systems',()=>{
  assert.equal(externalToolPath({env:{},platform:'win32'}),'yt-dlp.exe');
  assert.equal(externalToolPath({env:{},platform:'linux'}),'yt-dlp');
  assert.equal(externalToolPath({env:{CONTENTLAB_YT_DLP:'D:\\bin\\yt-dlp.exe'},platform:'win32'}),
    'D:\\bin\\yt-dlp.exe');
});
