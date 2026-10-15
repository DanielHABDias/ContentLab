import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createOAuthAuthorizeUrl} from './social-oauth-url.mjs';

const data={clientId:'local-client',redirectUri:'http://127.0.0.1:5000/api/social/oauth/youtube/callback',
  state:'strong-test-state',verifier:'safe-test-code-verifier-with-entropy-that-is-at-least-43-chars-long'};

test('YouTube login opens official Google chooser with consent and S256 PKCE',()=>{
  const url=new URL(createOAuthAuthorizeUrl('youtube',data));
  assert.equal(url.hostname,'accounts.google.com');
  assert.equal(url.searchParams.get('prompt'),'select_account consent');
  assert.equal(url.searchParams.get('access_type'),'offline');
  assert.match(url.searchParams.get('scope'),/youtube\.readonly/);
  assert.match(url.searchParams.get('scope'),/youtube\.upload/);
  assert.match(url.searchParams.get('scope'),/yt-analytics\.readonly/);
  assert.equal(url.searchParams.get('redirect_uri'),data.redirectUri);
  assert.equal(url.searchParams.get('state'),data.state);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('code_challenge'),
    crypto.createHash('sha256').update(data.verifier).digest('base64url'));
  assert.equal(url.searchParams.has('client_secret'),false);
  assert.equal(url.searchParams.has('access_token'),false);
});
test('Instagram login is official and requests professional account scopes',()=>{
  const u=new URL(createOAuthAuthorizeUrl('instagram',{
    ...data,redirectUri:'https://example.org/api/social/oauth/instagram/callback'
  }));
  assert.equal(u.hostname,'www.instagram.com');
  assert.equal(u.searchParams.get('response_type'),'code');
  assert.equal(u.searchParams.get('scope'),'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights');
  assert.equal(u.searchParams.get('state'),data.state);
  assert.equal(u.searchParams.has('access_token'),false);
});
test('TikTok desktop opens official authorize page with hex PKCE and read+publish scopes',()=>{
  const u=new URL(createOAuthAuthorizeUrl('tiktok',{
    ...data,redirectUri:'http://127.0.0.1:5000/api/social/oauth/tiktok/callback'
  }));
  assert.equal(u.hostname,'www.tiktok.com');
  assert.equal(u.searchParams.get('client_key'),data.clientId);
  assert.equal(u.searchParams.get('code_challenge'),
    crypto.createHash('sha256').update(data.verifier).digest('hex'));
  assert.equal(u.searchParams.get('code_challenge_method'),'S256');
  assert.equal(u.searchParams.get('scope'),'user.info.basic,video.publish,video.list,user.info.profile,user.info.stats');
  assert.equal(u.searchParams.has('client_secret'),false);
});
test('unsupported providers and missing arguments never produce login URLs',()=>{
  assert.throws(()=>createOAuthAuthorizeUrl('unknown',data),/inválida/);
  assert.throws(()=>createOAuthAuthorizeUrl('youtube',{}),/incompletos/);
});
