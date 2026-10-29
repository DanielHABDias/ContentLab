import {preparePublicationSession,readPublicationSession} from './social-publication-session.mjs';
import multer from 'multer';
import os from 'node:os';
import {readSocialBrowser,socialBrowserReady} from './social-browser.mjs';
import {listSocialDrafts,createSocialDraft,updateSocialDraft,deleteSocialDraft,socialDraftMedia,cleanupUploaded} from './social-drafts.mjs';

const upload=multer({dest:os.tmpdir(),limits:{fileSize:1024*1024*1024,files:3}});
const form=upload.fields([{name:'video',maxCount:1},{name:'coverA',maxCount:1},{name:'coverB',maxCount:1}]);
const sameOrigin=req=>{
  const origin=req.get('origin'),host=req.get('host'),site=req.get('sec-fetch-site');
  return /^127\.0\.0\.1(?::\d+)?$/.test(host||'')&&
    (!origin||origin==='http://'+host)&&(!site||['same-origin','none'].includes(site));
};
export function mountSocialDraftRoutes(app,api){
  app.get('/api/social-browser/drafts',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).end();
    res.set('Cache-Control','no-store').json({items:listSocialDrafts()});
  }));
  app.post('/api/social-browser/drafts',form,api(async(req,res)=>{
    try{
      if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
      const settings=readSocialBrowser();
      if(!socialBrowserReady(settings))return res.status(409).json({error:'Confirme primeiro ao menos uma rede social.'});
      const item=createSocialDraft({body:req.body,files:req.files,confirmed:settings.confirmed});
      res.status(201).set('Cache-Control','no-store').json({item});
    }catch(error){res.status(422).json({error:error.message});}
    finally{cleanupUploaded(req.files);}
  }));
  app.put('/api/social-browser/drafts/:id',form,api(async(req,res)=>{
    try{
      if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
      const settings=readSocialBrowser();
      if(!socialBrowserReady(settings))return res.status(409).json({error:'Confirme uma rede social em Configurações.'});
      const item=updateSocialDraft(req.params.id,{body:req.body,files:req.files,confirmed:settings.confirmed});
      res.set('Cache-Control','no-store').json({item});
    }catch(error){res.status(422).json({error:error.message});}
    finally{cleanupUploaded(req.files);}
  }));
  app.get('/api/social-browser/session',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).end();
    res.set('Cache-Control','no-store').json({session:readPublicationSession()});
  }));
  app.post('/api/social-browser/prepare',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
    try{
      const session=await preparePublicationSession(req.body?.draftIds);
      res.set('Cache-Control','no-store').json({session});
    }catch(error){res.status(422).json({error:error.message});}
  }));
  app.delete('/api/social-browser/drafts/:id',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
    try{deleteSocialDraft(req.params.id);res.set('Cache-Control','no-store').json({ok:true});}
    catch(error){res.status(404).json({error:error.message});}
  }));
  app.get('/api/social-browser/drafts/:id/media/:kind',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).end();
    try{
      const file=socialDraftMedia(req.params.id,req.params.kind);
      res.set('Cache-Control','private, no-store').set('X-Content-Type-Options','nosniff').sendFile(file);
    }catch(error){res.status(404).end();}
  }));
}
