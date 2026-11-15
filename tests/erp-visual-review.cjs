/* Read-only UI review against a local preview. API fixtures never enter application code. */
const fs = require('fs');
const path = require('path');
const fixtures=require('./fixtures/erp-ui.json');
const base = process.env.ERP_REVIEW_BASE || 'http://127.0.0.1:3301';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('UI fixtures are restricted to a local preview');
const width = Number(process.env.ERP_REVIEW_WIDTH || 1440), height = width < 640 ? 844 : 1000;
const out = process.env.ERP_REVIEW_OUT || 'docs/staff-ui-review/erp-mobile';
const routes = (process.env.ERP_REVIEW_ROUTES || 'erp/fees/collect,erp/fees/dues,erp/staff,erp/settings,erp/exams/marks,erp/students,erp/students/id-cards,erp/transport,erp/timetable,erp/report').split(',');
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
function connection(url) {
  return new Promise((resolve,reject) => {
    const socket = new WebSocket(url); let id=0; const pending=new Map(); const listeners=new Map();
    socket.onopen=()=>resolve({call:(method,params={})=>new Promise((done,fail)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);fail(Error('CDP timeout: '+method));},60000);pending.set(n,m=>{clearTimeout(timer);m.error?fail(Error(m.error.message)):done(m.result)});socket.send(JSON.stringify({id:n,method,params}));}),on:(event,handler)=>listeners.set(event,handler),close:()=>socket.close()});
    socket.onerror=reject;
    socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else listeners.get(m.method)?.(m.params);};
  });
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const version=await(await fetch('http://127.0.0.1:9223/json/version')).json();
  const browser=await connection(version.webSocketDebuggerUrl);
  const context=await browser.call('Target.createBrowserContext');
  const target=await browser.call('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId});
  const tabs=await(await fetch('http://127.0.0.1:9223/json')).json();
  const page=await connection(tabs.find(tab=>tab.id===target.targetId).webSocketDebuggerUrl);
  const call=page.call;
  const errors=[], missing=new Set();
  page.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  page.on('Fetch.requestPaused',async event=>{
    const url=new URL(event.request.url), method=event.request.method;
    let payload=fixtures[url.pathname+url.search] ?? fixtures[url.pathname];
    let status=method==='GET' && payload!==undefined ? 200 : 503;
    if(method==='OPTIONS'){status=200;payload={};}
    else if(method!=='GET'){status=403;payload={error:'Read-only visual review: writes are blocked.'};}
    else if(payload===undefined){missing.add(url.pathname);payload={error:'No review fixture for this endpoint.'};}
    try { await call('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:base},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Headers',value:'Content-Type'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,PUT,DELETE,OPTIONS'}],body:Buffer.from(JSON.stringify(payload)).toString('base64')}); } catch { /* Target may close during cleanup. */ }
  });
  await call('Page.enable');await call('Runtime.enable');
  await call('Network.setCookie',{name:'schooldesk_session',value:'isolated-ui-fixture',url:base,path:'/'});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();localStorage.setItem("sa:erp","1");localStorage.setItem("sa:signed-in","1");localStorage.setItem("sa:lang","en");'});
  await call('Fetch.enable',{patterns:[{urlPattern:'*://*/api/*',requestStage:'Request'}]});
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
  const rows=[]; const interactions=[];
  try {
    for(const route of routes){
      const beforeErrors=errors.length, beforeMissing=new Set(missing);
      await call('Page.navigate',{url:base+'/'+route});
      for(let n=0;n<90;n++){await sleep(350);if(await evaluate('document.readyState==="complete" && document.body.innerText.length>60'))break;}
      for(let n=0;n<35;n++){await sleep(200);if(await evaluate('!document.body.innerText.includes("Loading account") && !document.querySelector(".skeleton")'))break;}
      await sleep(1200);
      if(process.env.ERP_REVIEW_INTERACTIONS==='1') {
        const result=await evaluate('('+function(route){if(route==='erp/students/id-cards'){const button=[...document.querySelectorAll('button[role="tab"]')].find(b=>b.textContent==='Back');if(!button)throw Error('ID-card Back tab missing');button.click();return 'back';}if(route==='erp/settings'){const details=document.querySelector('details');if(!details||details.open)throw Error('Print preview should start collapsed');details.querySelector('summary').click();if(!details.open)throw Error('Print preview did not open');details.querySelector('summary').click();return 'Print preview disclosure opens and closes';}return 'No interaction for this route';}.toString()+')('+JSON.stringify(route)+')');
        await sleep(250);
        if(result==='back'){const selected=await evaluate('('+function(){return [...document.querySelectorAll('button[role="tab"]')].some(b=>b.textContent==='Back'&&b.getAttribute('aria-selected')==='true');}.toString()+')()');if(!selected)throw Error('ID-card side selection failed');interactions.push({route,result:'ID-card Back tab selects the back document'});}else interactions.push({route,result});
      }
      if(await evaluate('document.body.innerText.trim().length<60')){await call('Page.reload');for(let n=0;n<120;n++){await sleep(500);if(await evaluate('document.readyState==="complete" && document.body.innerText.trim().length>60'))break;}await sleep(1000);}
      const state=JSON.parse(await evaluate('JSON.stringify({url:location.href,title:document.title,text:document.body.innerText,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:Array.from(document.querySelectorAll("h1,h2")).map(el=>el.innerText),loading:!!document.querySelector(".skeleton")})'));
      if(state.text.trim().length<60)throw Error('Blank capture rejected: '+route);
      if(new URL(state.url).pathname.replace(/\/+$/,'')!==('/'+route).replace(/\/+$/,''))throw Error('Wrong route capture rejected: '+state.url);
      const shot=await call('Page.captureScreenshot',{format:'png'});
      const file=(route||'public-home').replaceAll('/','-')+'.png';fs.writeFileSync(path.join(out,file),Buffer.from(shot.data,'base64'));
      rows.push({route,file,...state,errors:errors.slice(beforeErrors),missingFixtures:[...missing].filter(item=>!beforeMissing.has(item))});
      fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(rows,null,2));
      console.log((route||'public home')+' captured'+(state.scrollWidth>width?' [OVERFLOW]':'')+(errors.length>beforeErrors?' [ERROR]':''));
    }
  } finally {await browser.call('Target.closeTarget',{targetId:target.targetId});await browser.call('Target.disposeBrowserContext',{browserContextId:context.browserContextId});page.close();browser.close();}
  console.log(JSON.stringify({routes:rows.length,overflow:rows.filter(row=>row.scrollWidth>width).map(row=>row.route),exceptions:errors.length,interactions,missingFixtures:[...missing]}));
})().catch(error=>{console.error(error);process.exitCode=1;});