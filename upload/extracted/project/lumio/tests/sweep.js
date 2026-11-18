const {chromium}=require(process.argv[2]+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/lumio.html');
const views=['home','study','games','progress','ach','board','settings','focus','social','account','parent','srs','drill','err','ship','code','chem','ai','web','bio','math','biz','aif','proj','circ','geo','time','eco','eng'];
const bands=[["Class 3"],["Class 8"],["Class 11"]];const sizes=[[390,800],[768,1000],[1280,800]];const out=[];
for(const [cls] of bands){await p.evaluate(c=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf(c);S.band=bandOf(S.cls);S.name="T";save()},cls);
for(const v of views){for(const [w,h] of sizes){await p.setViewportSize({width:w,height:h});
const r=await p.evaluate(v=>{try{V=v;render()}catch(e){return{err:String(e)}}const root=document.querySelector('#root');const issues=[];
if(document.documentElement.scrollWidth>innerWidth)issues.push('sideways');
if(!root.innerText.trim())issues.push('blank');
root.querySelectorAll('button,[role=button],a[href]').forEach(x=>{if(!(x.textContent||x.getAttribute('aria-label')||x.title||'').trim())issues.push('unnamed-button:'+x.outerHTML.slice(0,60))});
root.querySelectorAll('img').forEach(x=>{if(!x.hasAttribute('alt'))issues.push('img-no-alt:'+(x.src||'').slice(0,30))});
root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea').forEach(x=>{const has=x.getAttribute('aria-label')||x.getAttribute('aria-labelledby')||x.closest('label')||(x.id&&document.querySelector('label[for="'+x.id+'"]'));if(!has)issues.push('unlabelled-field:'+(x.id||x.tagName))});
const h1=root.querySelectorAll('h1').length;if(h1!==1)issues.push('h1-count:'+h1);
return{issues}},v);
if(r.err)out.push([cls,v,w,'ERR '+r.err]);else r.issues.forEach(i=>out.push([cls,v,w,i]))}}}
const uniq={};out.forEach(([c,v,w,i])=>{const k=v+'|'+i.split(':')[0]+(i.includes(':')?':'+i.split(':').slice(1).join(':'):'');(uniq[k]=uniq[k]||new Set()).add(c+'@'+w)});
Object.entries(uniq).forEach(([k,s])=>console.log(k,'->',[...s].join(',')));
console.log('page errors:',errs.length?errs.slice(0,3):'none','| total issue lines',out.length);await b.close()})();
