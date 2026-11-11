import {detectBrowsers,readSocialBrowser,saveSocialBrowser,openSocialBrowser,confirmSocialBrowser,socialBrowserReady,SOCIAL_PLATFORMS} from './social-browser.mjs';

// Sem OAuth, tokens ou publicação automática. Somente abrir sites oficiais no navegador local.
const sameOrigin=req=>{
  const origin=req.get('origin'),host=req.get('host'),site=req.get('sec-fetch-site');
  return /^127\.0\.0\.1(?::\d+)?$/.test(host||'')&&
    (!origin||origin==='http://'+host)&&
    (!site||['same-origin','none'].includes(site));
};
export function mountSocialBrowserRoutes(app,api){
  app.get('/api/social-browser/setup',api(async(req,res)=>{
    const settings=readSocialBrowser();
    res.set('Cache-Control','no-store').json({browsers:detectBrowsers(),platforms:SOCIAL_PLATFORMS,settings,ready:socialBrowserReady(settings)});
  }));
  app.post('/api/social-browser/settings',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
    const settings=saveSocialBrowser(req.body);
    res.set('Cache-Control','no-store').json({settings,ready:socialBrowserReady(settings)});
  }));
  app.post('/api/social-browser/open/:platform',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
    res.set('Cache-Control','no-store').json(await openSocialBrowser(req.params.platform));
  }));
  app.post('/api/social-browser/confirm/:platform',api(async(req,res)=>{
    if(!sameOrigin(req))return res.status(403).json({error:'Origem não autorizada.'});
    const settings=confirmSocialBrowser(req.params.platform);
    res.set('Cache-Control','no-store').json({settings,ready:socialBrowserReady(settings)});
  }));
}
