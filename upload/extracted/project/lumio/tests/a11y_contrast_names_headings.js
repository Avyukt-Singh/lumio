const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const contrast=()=>{const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(/[ ,\/]+/).map(Number);return{r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1}};
const lum=c=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
const blend=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
const bgOf=e=>{let stack=[],n=e;while(n&&n!==document.documentElement){const cs=getComputedStyle(n);if(cs.backgroundImage&&cs.backgroundImage!=='none')return null;const c=parse(cs.backgroundColor);if(c&&c.a>0){stack.push(c);if(c.a>=0.99)break}n=n.parentElement}
 let base=parse(getComputedStyle(document.body).backgroundColor);if(!base||base.a<0.99)base={r:255,g:255,b:255,a:1};if(getComputedStyle(document.body).backgroundImage!=='none'&&!stack.some(c=>c.a>=.99))return null;
 let out=stack.length&&stack[stack.length-1].a>=.99?stack.pop():base;while(stack.length)out=blend(stack.pop(),out);return out};
const bad=[],seen=new Set();let checked=0,skipped=0;
document.querySelectorAll('body *').forEach(e=>{if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')return;const t=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');if(!t)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||+cs.opacity<.5)return;
 if(e.closest('details:not([open])')&&e.tagName!=='SUMMARY'&&e.parentElement.tagName!=='DETAILS')return;
 const fg=parse(cs.color),bg=bgOf(e);if(!fg||!bg){skipped++;return}const f=blend(fg,bg),l1=lum(f),l2=lum(bg),r=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);const sz=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700,large=sz>=24||(sz>=18.66&&bold);checked++;
 if(r<(large?3:4.5)){const k=t.slice(0,24)+'|'+r.toFixed(1);if(!seen.has(k)){seen.add(k);bad.push(r.toFixed(2)+' '+e.tagName+'.'+(e.className||'').toString().slice(0,12)+' "'+t.slice(0,26)+'" fg='+cs.color+' bg=rgb('+Math.round(bg.r)+','+Math.round(bg.g)+','+Math.round(bg.b)+')')}}});
return{checked,skipped,bad:bad.slice(0,6),nbad:bad.length}};

const gradCheck=()=>{const parse=c=>{const v=c.match(/\d+(\.\d+)?/g).map(Number);return{r:v[0],g:v[1],b:v[2]}};const lum=c=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};const bad=[];let n=0;
document.querySelectorAll('body *').forEach(e=>{const cs=getComputedStyle(e);if(!cs.backgroundImage||!cs.backgroundImage.includes('gradient'))return;if(!e.offsetParent)return;const t=[...e.childNodes].some(x=>x.nodeType===3&&x.textContent.trim());if(!t)return;const stops=(cs.backgroundImage.match(/rgba?\([^)]*\)/g)||[]).map(parse);if(!stops.length)return;const fg=parse(cs.color);n++;const worst=Math.min(...stops.map(s=>{const a=lum(fg),b=lum(s);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}));const sz=parseFloat(cs.fontSize),large=sz>=24||(sz>=18.66&&+cs.fontWeight>=700);if(worst<(large?3:4.5))bad.push(worst.toFixed(2)+' '+e.tagName+' "'+e.textContent.trim().slice(0,20)+'"')});return{n,bad:[...new Set(bad)].slice(0,4)}};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=6;S.plan.len=10;save();render()");
const views=['home','study','games','progress','ach','board','settings','focus','ship','code','chem','parent'];
await p.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
const cdp=await p.context().newCDPSession(p);await cdp.send('Accessibility.enable');
for(const th of ['morning','evening','night']){await p.evaluate(`S.mode='${th}';save();applyTheme()`);let tot={c:0,s:0,n:0},ex=[];
 for(const v of views){await p.evaluate("V='"+v+"';render()");await p.waitForTimeout(40);const r=await p.evaluate("("+contrast.toString()+")()");tot.c+=r.checked;tot.s+=r.skipped;tot.n+=r.nbad;if(r.bad.length&&ex.length<5)ex.push(v+': '+r.bad.slice(0,2).join(' || '))}
 let gc={n:0,bad:[]};for(const v of views){await p.evaluate("V='"+v+"';render()");const r=await p.evaluate("("+gradCheck.toString()+")()");gc.n+=r.n;gc.bad.push(...r.bad)}console.log('   gradient-background text checked',gc.n,'| below AA:',[...new Set(gc.bad)].slice(0,4));console.log('THEME',th.padEnd(8),'text nodes checked',tot.c,'(skipped gradient bg',tot.s+')','| below WCAG AA:',tot.n);ex.forEach(x=>console.log('   ',x.slice(0,230)))}
// accessible names
await p.evaluate("S.mode='morning';save();applyTheme()");let unnamed=[];
for(const v of views){await p.evaluate("V='"+v+"';render()");await p.waitForTimeout(40);const {nodes}=await cdp.send('Accessibility.getFullAXTree');for(const n of nodes){const role=n.role&&n.role.value;if(!['button','link','textbox','combobox','checkbox','slider','spinbutton','searchbox','radio'].includes(role))continue;if(n.ignored)continue;const name=(n.name&&n.name.value||'').trim();if(!name)unnamed.push(v+':'+role)}}
console.log('controls without an accessible name:',unnamed.length,unnamed.slice(0,8));
// headings order per view
const hs=[];for(const v of views){await p.evaluate("V='"+v+"';render()");const l=await p.evaluate("[...document.querySelectorAll('#root h1,#root h2,#root h3')].map(h=>+h.tagName[1])");let skip=false;for(let i=1;i<l.length;i++)if(l[i]-l[i-1]>1)skip=true;if(l.filter(x=>x===1).length!==1||skip)hs.push(v+': h1 count '+l.filter(x=>x===1).length+(skip?' level skip':''))}
console.log('heading issues:',hs.length?hs:'none');
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n').slice(0,3).join(' / ')));
