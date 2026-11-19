/** Content Lab — conector pessoal. Instale na SUA conta e mantenha o projeto privado. */
const CANAL = {
  nome: 'Seu canal',
  urlImplantacao: 'COLE_A_URL_QUE_TERMINA_EM_EXEC',
  pastaExistente: '', // opcional: ID da pasta do canal que você já usa
  planilhaExistente: '' // opcional: ID da planilha dentro dessa pasta
};

/** Execute depois de implantar como aplicativo da Web, executando como você. */
function gerarConexao() {
  const name = String(CANAL.nome || '').trim();
  if (!name || name === 'Seu canal') throw new Error('Preencha CANAL.nome.');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(CANAL.urlImplantacao)) throw new Error('Preencha a URL /exec da implantação.');
  const p = PropertiesService.getScriptProperties();
  const folders = DriveApp.getFoldersByName(name), matches = [];
  while (folders.hasNext()) matches.push(folders.next());
  if (!CANAL.pastaExistente && matches.length > 1) throw new Error('Há pastas com o mesmo nome; informe pastaExistente.');
  const root = CANAL.pastaExistente ? DriveApp.getFolderById(CANAL.pastaExistente) : matches[0] || DriveApp.createFolder(name);
  if (CANAL.planilhaExistente && !dentroDaRaiz(CANAL.planilhaExistente, root.getId())) throw new Error('A planilha deve estar dentro da pasta do canal.');
  let spreadsheetId=CANAL.planilhaExistente || '';
  if(!spreadsheetId){const files=root.getFilesByType(MimeType.GOOGLE_SHEETS),found=[];while(files.hasNext()){const f=files.next();if(f.getName()==='Canal do YT — V1.0 ('+name+')')found.push(f.getId());}if(found.length>1)throw new Error('Planilhas com nome duplicado; informe planilhaExistente.');spreadsheetId=found[0]||'';}
  let knownInstallation='';
  if(spreadsheetId){const tab=SpreadsheetApp.openById(spreadsheetId).getSheetByName('Config');if(tab){const rows=tab.getDataRange().getDisplayValues();const bindings=rows.filter(r=>r[0]==='CONTENTLAB_INSTALLATION_ID');if(bindings.length>1)throw new Error('Config possui vínculos duplicados.');knownInstallation=bindings[0]&&bindings[0][1]||'';}}
  const secret = p.getProperty('SECRET') || Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  const installation = knownInstallation || p.getProperty('INSTALLATION') || Utilities.getUuid();
  p.setProperties({ SECRET: secret, ROOT_ID: root.getId(), INSTALLATION: installation });
  const bundle = { schema:'contentlab-google-connection-v1', channel:{name:name}, installation:installation, rootId:root.getId(), spreadsheetId:spreadsheetId, bridge:{url:CANAL.urlImplantacao,secret:secret} };
  // Arquivo privado na raiz do Meu Drive, FORA da pasta do canal que pode ser compartilhada.
  const file = DriveApp.createFile('Conexão Content Lab — '+name+'.json',JSON.stringify(bundle,null,2),MimeType.PLAIN_TEXT);
  console.log('Baixe seu JSON privado em: '+file.getUrl());
  return file.getUrl();
}
function dentroDaRaiz(id, root) {
  if (id === root) return true;
  let pending = [id], seen = {};
  for (let depth=0; pending.length && depth<40; depth++) {
    const next=[];
    for (const current of pending) {
      if (seen[current]) continue; seen[current]=true;
      const f=Drive.Files.get(current,{fields:'id,parents,trashed',supportsAllDrives:true});
      if (f.trashed) continue;
      if ((f.parents||[]).indexOf(root)>=0) return true;
      next.push.apply(next,f.parents||[]);
    }
    pending=next;
  }
  return false;
}
function responder(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function assinatura(payload, secret) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload,secret)).replace(/=+$/,''); }
function igualSeguro(a,b) { if(typeof a!=='string'||typeof b!=='string')return false;let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0; }
function doGet() { return responder({ok:false,error:'Importe o JSON privado no Content Lab. Este conector não possui uma página pública de dados.'}); }
function doPost(e) {
  const lock=LockService.getScriptLock();
  try {
    const envelope=JSON.parse(e.postData.contents), props=PropertiesService.getScriptProperties(), secret=props.getProperty('SECRET');
    if(!secret||typeof envelope.payload!=='string'||envelope.payload.length>12000000||!igualSeguro(assinatura(envelope.payload,secret),envelope.signature)) return responder({ok:false,status:401,error:'Conexão não autorizada.'});
    const packet=JSON.parse(envelope.payload);
    if(!Number.isFinite(packet.timestamp)||Math.abs(Date.now()-packet.timestamp)>90000||!/^[a-f0-9]{32}$/.test(packet.nonce||''))return responder({ok:false,status:401,error:'Solicitação expirada.'});
    lock.waitLock(30000);
    const cache=CacheService.getScriptCache(), nonce='nonce:'+packet.nonce;
    if(cache.get(nonce))return responder({ok:false,status:409,error:'Solicitação já utilizada. Gere uma nova solicitação.'});
    cache.put(nonce,'1',300);
    const root=props.getProperty('ROOT_ID');
    if(packet.action==='ping')return responder({ok:true,value:{rootId:root,installation:props.getProperty('INSTALLATION')}});
    if(packet.action==='reserve')return responder({ok:true,value:reservarId(packet,root)});
    if(packet.action==='sheetBatch') {
      if(!dentroDaRaiz(packet.spreadsheetId,root))throw new Error('Planilha fora da pasta autorizada.');
      const names=Object.keys(packet.expected), ranges=names.map(n=>"'"+n+"'!A:AZ");
      const live=Sheets.Spreadsheets.Values.batchGet(packet.spreadsheetId,{ranges:ranges,valueRenderOption:'FORMULA'}).valueRanges||[];
      for(let i=0;i<names.length;i++)if(JSON.stringify(live[i].values||[])!==JSON.stringify(packet.expected[names[i]]))return responder({ok:false,status:409,error:'A planilha mudou. Releia antes de gravar.'});
      return responder({ok:true,value:Sheets.Spreadsheets.batchUpdate({requests:packet.requests},packet.spreadsheetId)});
    }
    if(packet.action!=='request')throw new Error('Operação desconhecida.');
    return responder({ok:true,value:requisicao(packet,root)});
  } catch(err) { return responder({ok:false,status:400,error:String(err.message||err)}); }
  finally { if(lock.hasLock())lock.releaseLock(); }
}
function requisicao(packet,root) {
  const url=String(packet.url||''), method=packet.method||'GET';
  if(!['GET','POST','PATCH'].includes(method))throw new Error('Método não permitido.');
  const drive=url.match(/^https:\/\/www\.googleapis\.com\/(?:upload\/)?drive\/v3\/files(?:\/([\w-]+))?(?:\?|$)/);
  const sheets=url.match(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/([\w-]+)(?:[\/:?]|$)/);
  const docs=url.match(/^https:\/\/docs\.googleapis\.com\/v1\/documents\/([\w-]+)(?:[\/:?]|$)/);
  if(!drive&&!sheets&&!docs)throw new Error('Destino não permitido.');
  if(sheets||docs||drive&&drive[1]) { const id=(sheets||docs||drive)[1];if(!dentroDaRaiz(id,root))throw new Error('Arquivo fora da pasta autorizada.'); }
  if(drive&&!drive[1]&&method!=='GET') {
    const parents=packet.body&&packet.body.parents;
    if(!parents||parents.length!==1||!dentroDaRaiz(parents[0],root))throw new Error('Novos arquivos precisam ficar na pasta do canal.');
  }
  const options={method:method.toLowerCase(),headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true,followRedirects:false};
  if(packet.upload) {
    const mime=packet.upload.mime;
    if(!/^image\/(png|jpeg|webp)$/.test(mime))throw new Error('Formato de thumbnail inválido.');
    const boundary='contentlab_'+Utilities.getUuid().replace(/-/g,'');
    const head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(packet.body)+'\r\n--'+boundary+'\r\nContent-Type: '+mime+'\r\n\r\n';
    options.contentType='multipart/related; boundary='+boundary;
    options.payload=Utilities.newBlob(head).getBytes().concat(Utilities.base64Decode(packet.upload.base64),Utilities.newBlob('\r\n--'+boundary+'--').getBytes());
  } else if(packet.body!==undefined) {options.contentType='application/json';options.payload=JSON.stringify(packet.body);}
  const response=UrlFetchApp.fetch(url,options), status=response.getResponseCode();
  if(status<200||status>=300)throw new Error('Google API '+status+': confira APIs, permissões e estrutura.');
  const value=JSON.parse(response.getContentText()||'{}');
  if(drive&&!drive[1]&&method==='GET'&&value.files)value.files=value.files.filter(f=>dentroDaRaiz(f.id,root));
  return value;
}
function reservarId(packet,root) {
  if(!['VD','SH'].includes(packet.prefix)||!/^[a-f0-9]{64}$/.test(packet.operationId))throw new Error('Reserva inválida.');
  if(!dentroDaRaiz(packet.spreadsheetId,root))throw new Error('Planilha fora da pasta autorizada.');
  const book=SpreadsheetApp.openById(packet.spreadsheetId), config=book.getSheetByName('Config'), productions=book.getSheetByName('Produções');
  if(!config||!productions)throw new Error('Prepare as abas antes de reservar IDs.');
  const rows=config.getDataRange().getDisplayValues(), operation='OP_CONTENTLAB_'+packet.operationId;
  const binding=rows.filter(r=>r[0]==='CURRENT_SPREADSHEET_ID');if(binding.length!==1||binding[0][1]!==packet.spreadsheetId)throw new Error('Vínculo da planilha inválido.');
  const previous=rows.filter(r=>r[0]===operation);if(previous.length>1)throw new Error('Operação duplicada.');if(previous.length)return {id:previous[0][1]};
  const counts=rows.filter(r=>r[0]==='LAST_ID_'+packet.prefix);
  if(counts.length>1)throw new Error('Contador duplicado.');
  let last=counts.length?Number(counts[0][1]):0;
  if(!Number.isSafeInteger(last)||last<0)throw new Error('Contador inválido.');
  for(const tab of ['Produções','Ideias','Config']) {const s=book.getSheetByName(tab);if(!s)continue;for(const row of s.getDataRange().getDisplayValues())for(const value of row){const matches=String(value).match(new RegExp('\\b'+packet.prefix+'_\\d+\\b','g'))||[];for(const id of matches)last=Math.max(last,Number(id.split('_')[1]));}}
  if(!Number.isSafeInteger(last)||last>=999999999)throw new Error('Contador inválido.');
  const id=packet.prefix+'_'+String(last+1).padStart(4,'0'), updates=[];
  let i=rows.findIndex(r=>r[0]==='LAST_ID_'+packet.prefix);if(i<0)i=rows.length;
  updates.push({range:"'Config'!A"+(i+1)+':C'+(i+1),values:[['LAST_ID_'+packet.prefix,String(last+1),'Último ID emitido']]});
  const target=i===rows.length?i+1:rows.length;
  updates.push({range:"'Config'!A"+(target+1)+':C'+(target+1),values:[[operation,id,'Reserva Content Lab']]});
  if(target+1>config.getMaxRows())config.insertRowsAfter(config.getMaxRows(),target+1-config.getMaxRows());
  Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:updates},packet.spreadsheetId);
  const check=config.getRange(target+1,1,1,2).getDisplayValues()[0];if(check[0]!==operation||check[1]!==id)throw new Error('Reserva não confirmada.');
  return {id:id};
}
