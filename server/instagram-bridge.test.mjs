import test from 'node:test';
import assert from 'node:assert/strict';
import {instagramBridgeHandler,startInstagramBridge} from './instagram-bridge.mjs';

function call(url,{method='GET',targetPort=5432}={}){
  const res={
    statusCode:200,headers:{},body:null,
    setHeader(key,value){this.headers[key.toLowerCase()]=value;},
    end(body){this.body=body;}
  };
  instagramBridgeHandler({url,method},res,{targetPort});
  return res;
}
test('Instagram bridge accepts only OAuth callback and local-loopback target',()=>{
  const res=call('/api/social/oauth/instagram/callback?state=safe-state&code=short-code&extra=secret');
  assert.equal(res.statusCode,307);
  const loc=new URL(res.headers.location);
  assert.equal(loc.origin,'http://127.0.0.1:5432');
  assert.equal(loc.pathname,'/api/social/oauth/instagram/callback');
  assert.equal(loc.searchParams.get('state'),'safe-state');
  assert.equal(loc.searchParams.get('code'),'short-code');
  assert.equal(loc.searchParams.has('extra'),false,'Third-party query data must not be forwarded');
  assert.equal(res.headers['cache-control'],'no-store');
  assert.equal(res.headers['referrer-policy'],'no-referrer');
});
test('Instagram bridge refuses unrelated routes and malformed OAuth state',()=>{
  assert.equal(call('/api/social/status?state=s&code=123').statusCode,404);
  assert.equal(call('/api/social/oauth/instagram/callback?code=abc').statusCode,400);
  assert.equal(call('/api/social/oauth/instagram/callback?state=s').statusCode,400);
  assert.equal(call('/api/social/oauth/instagram/callback?state=s&error=access_denied').statusCode,307);
  assert.equal(call('/api/social/oauth/instagram/callback?state=s&code=a',{method:'POST'}).statusCode,404);
});
test('Bridge rejects out-of-range local listener ports',()=>{
  assert.throws(()=>startInstagramBridge({port:0}),/Porta/);
  assert.throws(()=>startInstagramBridge({port:5151,targetPort:70000}),/Porta/);
});
