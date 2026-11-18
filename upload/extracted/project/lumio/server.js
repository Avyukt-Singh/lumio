// Lumio optional leaderboard server. No dependencies. Run: node server.js  then open http://localhost:3000
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const DB=path.join(__dirname,"leaderboard.json"),PORT=process.env.PORT||3000;
let rows={};try{rows=JSON.parse(fs.readFileSync(DB,"utf8"))}catch(e){}
const save=()=>fs.writeFile(DB,JSON.stringify(rows),()=>{});
const clean=s=>String(s||"").replace(/[<>&"'`]/g,"").trim().slice(0,24);
const BANDS=["young","middle","sec","senior","dropper","above"];
// ---- Social API (checklist E). Identities are UNVERIFIED: the id is a private token kept in the browser. No accounts yet.
const SOC=process.env.SOCDB||path.join(__dirname,"social.json");
let D={users:{},feed:[],rooms:{}};try{D=Object.assign(D,JSON.parse(fs.readFileSync(SOC,"utf8")))}catch(e){}
let stm=0;const saveS=()=>{clearTimeout(stm);stm=setTimeout(()=>fs.writeFile(SOC,JSON.stringify(D),()=>{}),300)};
const DAYRE=/^\d{4}-\d{2}-\d{2}$/,dstr=t=>new Date(t).toISOString().slice(0,10);
const weekId=t=>{const d=new Date(t);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)};
const rcode=()=>{const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<6;i++)s+=A[crypto.randomInt(A.length)];return s};
const byCode=c=>Object.values(D.users).find(u=>u.code===String(c||"").toUpperCase().trim());
const wxp=u=>Math.max(0,u.xp-u.wkBase),pubU=u=>({name:u.name,code:u.code,streak:u.streak,weekXp:wxp(u),last:(u.days||[]).slice(-1)[0]||null});
function sharedStreak(a,b){const s=new Set(b.days||[]),both=(a.days||[]).filter(x=>s.has(x)).sort();if(!both.length)return 0;const set=new Set(both);let t=Date.parse(both[both.length-1]+"T00:00:00Z"),n=0;if(Date.now()-t>3*864e5)return 0;while(set.has(dstr(t))){n++;t-=864e5}return n}
function socState(u){const wk=weekId(Date.now()),fr=(u.friends||[]).map(i=>D.users[i]).filter(Boolean),all=Object.values(D.users);
const ids=new Set([u.id,...(u.friends||[])]),band=all.filter(x=>x.band===u.band&&x.wk===wk).sort((a,b)=>a.joined-b.joined),ix=band.findIndex(x=>x.id===u.id),g0=Math.floor(ix/10)*10;
return{me:pubU(u),week:wk,friends:fr.map(f=>({...pubU(f),shared:sharedStreak(u,f)})),
incoming:(u.req||[]).map(i=>D.users[i]).filter(Boolean).map(f=>({name:f.name,code:f.code})),outgoing:all.filter(x=>(x.req||[]).includes(u.id)).map(x=>({name:x.name,code:x.code})),
feed:D.feed.filter(e=>ids.has(e.uid)).slice(-20).reverse().map(e=>({name:e.name,text:e.text,ts:e.ts})),
quests:fr.map(f=>({friend:f.name,xp:wxp(u)+wxp(f),xpGoal:300,days:(u.days||[]).filter(x=>x>=wk&&(f.days||[]).includes(x)).length,dayGoal:4})),
league:ix<0?[]:band.slice(g0,g0+10).sort((a,b)=>wxp(b)-wxp(a)).map(x=>({name:x.name,weekXp:wxp(x),you:x.id===u.id}))}}
function socHandle(ep,id,d){const now=Date.now();for(const c in D.rooms)if(now-D.rooms[c].created>6*36e5)delete D.rooms[c];
if(ep==="sync"){const name=clean(d.name);if(!name)return[400,{error:"display name required"}];const week=weekId(now);let u=D.users[id];const xp=Math.max(0,Math.min(1e6,Math.floor(+d.xp)||0));
if(!u){let code;do{code=rcode()}while(byCode(code));u=D.users[id]={id,code,joined:now,xp,wkBase:xp,wk:week,streak:Math.max(0,Math.min(10000,Math.floor(+d.streak)||0)),days:[],ach:[],friends:[],req:[]}}
if(u.wk!==week){u.wk=week;u.wkBase=u.xp}
const st=Math.max(0,Math.min(10000,Math.floor(+d.streak)||0)),days=(Array.isArray(d.days)?d.days:[]).filter(x=>DAYRE.test(String(x))).slice(-60),ach=(Array.isArray(d.ach)?d.ach:[]).map(x=>clean(x)).filter(Boolean).slice(0,60);
const ev=[];for(const m of[3,7,14,30,60,100])if(st>=m&&(u.streak||0)<m)ev.push("reached a "+m+"-day streak");ach.filter(x=>!(u.ach||[]).includes(x)).slice(0,3).forEach(x=>{if((u.ach||[]).length||u.seen)ev.push("unlocked “"+x+"”")});
ev.slice(0,5).forEach(t=>D.feed.push({uid:id,name,text:t,ts:now}));D.feed=D.feed.slice(-500);
Object.assign(u,{name,band:BANDS.includes(d.band)?d.band:"sec",xp,streak:st,days,ach,seen:1});saveS();return[200,{ok:true,code:u.code}]}
const u=D.users[id];if(!u)return[404,{error:"Sync first."}];
if(ep==="state")return[200,socState(u)];
if(ep==="add"){const t=byCode(d.code);if(!t)return[404,{error:"No learner has that code."}];if(t.id===id)return[400,{error:"That is your own code."}];if((u.friends||[]).includes(t.id))return[400,{error:"You are already friends."}];if((t.req||[]).includes(id))return[400,{error:"Request already sent."}];
if((u.friends||[]).length>=30||(t.req||[]).length>=30)return[400,{error:"Friend limit reached."}];
if((u.req||[]).includes(t.id)){u.req=u.req.filter(x=>x!==t.id);u.friends.push(t.id);t.friends.push(id);saveS();return[200,{ok:true,msg:"You are now friends with "+t.name+"."}]}
t.req.push(id);saveS();return[200,{ok:true,msg:"Request sent to "+t.name+"."}]}
if(ep==="accept"||ep==="decline"){const f=byCode(d.code);if(!f||!(u.req||[]).includes(f.id))return[404,{error:"No such request."}];u.req=u.req.filter(x=>x!==f.id);if(ep==="accept"){u.friends.push(f.id);f.friends.push(id)}saveS();return[200,{ok:true}]}
if(ep==="remove"){const f=byCode(d.code);if(f){u.friends=u.friends.filter(x=>x!==f.id);f.friends=f.friends.filter(x=>x!==id)}saveS();return[200,{ok:true}]}
if(ep==="room/create"){let c;do{c=rcode()}while(D.rooms[c]);const m=Math.max(5,Math.min(120,Math.floor(+d.minutes)||25));D.rooms[c]={code:c,host:id,minutes:m,start:null,end:null,created:now,members:{}};return[200,roomState(D.rooms[c],u)]}
const r=D.rooms[String(d.code||"").toUpperCase().trim()];
if(ep==="room/join"){if(!r)return[404,{error:"No focus room has that code."}];if(Object.keys(r.members).length>=10&&!r.members[id])return[400,{error:"Room is full."}];return[200,roomState(r,u)]}
if(!r)return[404,{error:"Room closed."}];
if(ep==="room/state")return[200,roomState(r,u)];
if(ep==="room/start"){if(r.host!==id)return[403,{error:"Only the host can start."}];if(r.start&&now<r.end)return[400,{error:"Already running."}];r.start=now;r.end=now+r.minutes*60000;return[200,roomState(r,u)]}
if(ep==="room/leave"){delete r.members[id];if(r.host===id&&!Object.keys(r.members).length)delete D.rooms[r.code];return[200,{ok:true}]}
return[404,{error:"unknown"}]}
function roomState(r,u){const now=Date.now();r.members[u.id]={name:u.name,hb:now};return{code:r.code,host:(D.users[r.host]||{}).name||"",hostYou:r.host===u.id,minutes:r.minutes,start:r.start,end:r.end,now,members:Object.values(r.members).map(m=>({name:m.name,focusing:now-m.hb<12000}))}}
// ---- Accounts (checklist F). Passwords: scrypt + salt. Sessions: random tokens, stored hashed. Data: JSON file (swap for a real database when hosting).
// Phone OTP: if SMS_WEBHOOK_URL is set the server POSTs {to,text} there; otherwise it runs in DEV mode and only prints the code to this console. No SMS is ever sent by this file itself.
const ACC=process.env.ACCDB||path.join(__dirname,"accounts.json"),OTPGAP=+process.env.OTP_GAP_MS||60000,XPCAP=+process.env.XP_DAY_CAP||800;
let AC={users:{},tokens:{},otps:{},inv:{},msgs:[]};try{AC=Object.assign(AC,JSON.parse(fs.readFileSync(ACC,"utf8")))}catch(e){}
let atm=0;const saveA=()=>{clearTimeout(atm);atm=setTimeout(()=>fs.writeFile(ACC+".tmp",JSON.stringify(AC),e=>{if(!e)fs.rename(ACC+".tmp",ACC,()=>{})}),300)};
const sha=x=>crypto.createHash("sha256").update(String(x)).digest("hex"),scr=(pw,salt)=>crypto.scryptSync(pw,salt,32).toString("hex");
const setPw=(u,pw)=>{u.salt=crypto.randomBytes(16).toString("hex");u.h=scr(pw,u.salt)};
const okPw=(u,pw)=>{const a=Buffer.from(scr(pw,u.salt),"hex"),b=Buffer.from(u.h,"hex");return crypto.timingSafeEqual(a,b)};
const newTok=u=>{const t=crypto.randomBytes(24).toString("hex");AC.tokens[sha(t)]={u:u.name,exp:Date.now()+30*864e5};return t};
const authU=h=>{const m=/^Bearer ([a-f0-9]{48})$/.exec(h||"");if(!m)return null;const t=AC.tokens[sha(m[1])];if(!t||t.exp<Date.now())return null;return AC.users[t.u]||null};
const LK={};const lockKey=(n,ip)=>n+"|"+ip;
const isLocked=k=>LK[k]&&LK[k].until>Date.now(),fail=k=>{const e=LK[k]||(LK[k]={n:0,until:0});if(++e.n>=5){e.until=Date.now()+5*6e4;e.n=0}};
const cl60=x=>String(x||"").replace(/[<>&"'`]/g,"").trim().slice(0,60);
const mask=p=>p?p.slice(0,3)+"•••"+p.slice(-2):null;
function sendSms(to,text){if(process.env.SMS_WEBHOOK_URL){try{const u=new URL(process.env.SMS_WEBHOOK_URL),rq=(u.protocol==="https:"?require("https"):http).request(u,{method:"POST",headers:{"Content-Type":"application/json"}});rq.on("error",()=>{});rq.end(JSON.stringify({to,text}))}catch(e){}return{dev:false}}console.log("[DEV OTP, no SMS sent] to "+to+": "+text);return{dev:true}}
function otpSend(key,phone,why){const now=Date.now(),o=AC.otps[key]||{n:0,hr:now,last:0};if(now-o.hr>36e5){o.n=0;o.hr=now}if(now-o.last<OTPGAP||o.n>=5)return null;const code=String(crypto.randomInt(0,1e6)).padStart(6,"0");AC.otps[key]={h:sha(code+key),exp:now+6e5,tries:0,n:o.n+1,hr:o.hr,last:now};return sendSms(phone,"Lumio code "+code+" ("+why+"). Valid 10 minutes. Do not share it.")}
function otpOk(key,code){const o=AC.otps[key];if(!o||o.exp<Date.now()||o.tries>=5)return false;o.tries++;if(sha(String(code)+key)===o.h){delete AC.otps[key];return true}return false}
const PHONE=/^\+?[0-9]{10,14}$/,UNAME=/^[a-z0-9_]{3,20}$/;
const rcodes=()=>Array.from({length:8},()=>{const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let a="";for(let i=0;i<8;i++){a+=A[crypto.randomInt(A.length)];if(i===3)a+="-"}return a});
const meOf=u=>({name:u.name,role:u.role,lid:u.lid,rev:u.rev,phone:mask(u.phone),phoneOk:!!u.phoneOk,nick:u.nick||"",vis:u.vis||"private",parents:u.parents||[],children:u.children||[],unread:AC.msgs.filter(m=>m.to===u.name&&!m.read).length,flags:u.flags||0});
function acct(ep,d,hdr,ip){const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
if(ep==="register"){const n=String(d.username||"").toLowerCase(),pw=String(d.password||"");if(!UNAME.test(n))return[400,{error:"Username: 3 to 20 letters, digits or underscores."}];if(pw.length<8||pw.length>72)return[400,{error:"Password must be 8 to 72 characters."}];if(AC.users[n])return[409,{error:"That username is taken."}];
const role=d.role==="parent"?"parent":"learner",u=AC.users[n]={name:n,role,lid:Array.from(crypto.randomBytes(12),b=>(b%36).toString(36)).join(""),created:now,rev:0,blob:null,summary:null,consent:false,vx:0,vxDay:"",vxToday:0,lastXp:0,flags:0,vis:"private",nick:"",parents:[],children:[]};setPw(u,pw);const rec=rcodes();u.rec=rec.map(sha);saveA();return[200,{token:newTok(u),recovery:rec,me:meOf(u)}]}
if(ep==="login"){const n=String(d.username||"").toLowerCase(),k=lockKey(n,ip);if(isLocked(k))return[429,{error:"Too many attempts. Try again in a few minutes."}];const u=AC.users[n];if(!u||!okPw(u,String(d.password||""))){fail(k);return[401,{error:"Wrong username or password."}]}delete LK[k];const t=newTok(u);saveA();return[200,{token:t,me:meOf(u)}]}
if(ep==="recover/code"){const n=String(d.username||"").toLowerCase(),k=lockKey("rc"+n,ip);if(isLocked(k))return[429,{error:"Too many attempts. Try again in a few minutes."}];const u=AC.users[n],pw=String(d.newPassword||"");if(pw.length<8||pw.length>72)return[400,{error:"New password must be 8 to 72 characters."}];const h=sha(String(d.code||"").toUpperCase().trim());if(!u||!(u.rec||[]).includes(h)){fail(k);return[401,{error:"Invalid recovery code."}]}u.rec=u.rec.filter(x=>x!==h);setPw(u,pw);for(const t in AC.tokens)if(AC.tokens[t].u===n)delete AC.tokens[t];for(const k in LK)if(k.indexOf(n+"|")===0)delete LK[k];saveA();return[200,{ok:true,left:u.rec.length}]}
if(ep==="recover/otp/request"){const u=AC.users[String(d.username||"").toLowerCase()];if(u&&u.phoneOk)otpSend("rec:"+u.name,u.phone,"password reset");saveA();return[200,{ok:true,msg:"If that account has a verified phone, a code was sent."}]}
if(ep==="recover/otp/confirm"){const n=String(d.username||"").toLowerCase(),u=AC.users[n],pw=String(d.newPassword||"");if(pw.length<8||pw.length>72)return[400,{error:"New password must be 8 to 72 characters."}];if(!u||!otpOk("rec:"+n,d.code))return[401,{error:"Invalid or expired code."}];setPw(u,pw);for(const t in AC.tokens)if(AC.tokens[t].u===n)delete AC.tokens[t];for(const k in LK)if(k.indexOf(n+"|")===0)delete LK[k];saveA();return[200,{ok:true}]}
if(ep==="login/otp/request"){const p=String(d.phone||"");if(PHONE.test(p)){const u=Object.values(AC.users).find(x=>x.phoneOk&&x.phone===p);if(u)otpSend("lg:"+p,p,"sign in")}saveA();return[200,{ok:true,msg:"If that number is verified on an account, a code was sent."}]}
if(ep==="login/otp/verify"){const p=String(d.phone||""),k=lockKey("lo"+p,ip);if(isLocked(k))return[429,{error:"Too many attempts. Try again in a few minutes."}];const u=Object.values(AC.users).find(x=>x.phoneOk&&x.phone===p);if(!u||!otpOk("lg:"+p,d.code)){fail(k);return[401,{error:"Invalid or expired code."}]}const t=newTok(u);saveA();return[200,{token:t,me:meOf(u)}]}
if(ep==="lb"){const rows=Object.values(AC.users).filter(u=>u.role==="learner"&&u.vis==="public"&&u.nick).sort((a,b)=>b.vx-a.vx).slice(0,50).map(u=>({name:u.nick,xp:u.vx}));return[200,{rows,cap:XPCAP}]}
const u=authU(hdr);if(!u)return[401,{error:"Please sign in."}];
if(ep==="me")return[200,meOf(u)];
if(ep==="logout"){const m=/Bearer (.+)/.exec(hdr);delete AC.tokens[sha(m[1])];saveA();return[200,{ok:true}]}
if(ep==="delete"){if(!okPw(u,String(d.password||"")))return[401,{error:"Wrong password."}];for(const t in AC.tokens)if(AC.tokens[t].u===u.name)delete AC.tokens[t];for(const x of Object.values(AC.users)){x.parents=(x.parents||[]).filter(n=>n!==u.name);x.children=(x.children||[]).filter(n=>n!==u.name)}AC.msgs=AC.msgs.filter(m=>m.to!==u.name&&m.from!==u.name);delete AC.users[u.name];saveA();return[200,{ok:true}]}
if(ep==="sync/pull")return[200,{rev:u.rev,blob:u.blob}];
if(ep==="sync/push"){if(d.rev!==u.rev)return[409,{rev:u.rev,blob:u.blob}];if(typeof d.blob!=="string"||d.blob.length>2.5e6)return[400,{error:"State too large."}];u.blob=d.blob;u.rev++;
const sm=d.summary||{};if(u.role==="learner"){const xp=Math.max(0,Math.min(1e6,Math.floor(+sm.xp)||0));if(u.vxDay!==day){u.vxDay=day;u.vxToday=0}const gain=Math.max(0,xp-u.lastXp),allow=Math.max(0,Math.min(gain,XPCAP-u.vxToday));if(gain>allow)u.flags=(u.flags||0)+1;u.vx+=allow;u.vxToday+=allow;u.lastXp=Math.max(u.lastXp,xp);
u.consent=!!d.consent;const cs=(Array.isArray(sm.chapters)?sm.chapters:[]).slice(0,40).map(c=>({n:cl60(c.n),best:c.best===null?null:Math.max(0,Math.min(9,Math.floor(+c.best)||0)),state:clean(c.state)}));u.summary={xp,streak:Math.max(0,Math.min(1e4,Math.floor(+sm.streak)||0)),week:Math.max(0,Math.min(7,Math.floor(+sm.week)||0)),cls:cl60(sm.cls),exam:cl60(sm.exam),weak:(Array.isArray(sm.weak)?sm.weak:[]).slice(0,10).map(cl60),chapters:cs,at:now}}
saveA();return[200,{rev:u.rev}]}
if(ep==="profile/set"){u.nick=clean(d.nick);u.vis=d.vis==="public"?"public":"private";saveA();return[200,meOf(u)]}
if(ep==="phone/request"){const p=String(d.phone||"").replace(/[\s-]/g,"");if(!PHONE.test(p))return[400,{error:"Enter a phone number with country code, digits only."}];if(Object.values(AC.users).some(x=>x.phoneOk&&x.phone===p&&x.name!==u.name))return[409,{error:"That number is already verified on another account."}];u.phoneTry=p;const r=otpSend("vf:"+u.name,p,"verify phone");if(!r)return[429,{error:"Please wait a minute before asking for another code."}];saveA();return[200,{ok:true,dev:r.dev}]}
if(ep==="phone/verify"){if(!u.phoneTry||!otpOk("vf:"+u.name,d.code))return[401,{error:"Invalid or expired code."}];u.phone=u.phoneTry;u.phoneOk=true;delete u.phoneTry;saveA();return[200,meOf(u)]}
if(ep==="parent/invite"){if(u.role!=="learner")return[403,{error:"Only learners can invite a parent."}];const c=rcodes()[0].replace("-","");AC.inv[sha(c)]={l:u.name,exp:Date.now()+864e5};saveA();return[200,{code:c}]}
if(ep==="parent/link"){if(u.role!=="parent")return[403,{error:"Only parent accounts can use an invite."}];const i=AC.inv[sha(String(d.code||"").toUpperCase().replace(/[^A-Z0-9]/g,""))];if(!i||i.exp<Date.now())return[404,{error:"Invalid or expired invite."}];const l=AC.users[i.l];if(!l)return[404,{error:"Learner not found."}];delete AC.inv[sha(String(d.code||"").toUpperCase().replace(/[^A-Z0-9]/g,""))];if(!(u.children||[]).includes(l.name)){u.children.push(l.name);l.parents.push(u.name)}saveA();return[200,{ok:true,child:l.name}]}
if(ep==="parent/children"){if(u.role!=="parent")return[403,{error:"Parent accounts only."}];return[200,{children:(u.children||[]).map(n=>AC.users[n]).filter(Boolean).map(l=>({name:l.name,consent:!!l.consent,summary:l.consent?l.summary:null}))}]}
if(ep==="parent/unlink"){const n=String(d.name||"");u.children=(u.children||[]).filter(x=>x!==n);u.parents=(u.parents||[]).filter(x=>x!==n);const o=AC.users[n];if(o){o.children=(o.children||[]).filter(x=>x!==u.name);o.parents=(o.parents||[]).filter(x=>x!==u.name)}saveA();return[200,{ok:true}]}
if(ep==="msg/send"){const to=String(d.to||""),text=String(d.text||"").replace(/[<>]/g,"").trim().slice(0,280);if(!text)return[400,{error:"Write a message first."}];if(!(u.children||[]).includes(to)&&!(u.parents||[]).includes(to))return[403,{error:"You can only message a linked parent or child."}];AC.msgs.push({id:crypto.randomBytes(6).toString("hex"),from:u.name,to,text,ts:now,read:false});AC.msgs=AC.msgs.slice(-2000);saveA();return[200,{ok:true}]}
if(ep==="msg/inbox")return[200,{msgs:AC.msgs.filter(m=>m.to===u.name).slice(-30).reverse()}];
if(ep==="msg/read"){AC.msgs.forEach(m=>{if(m.to===u.name)m.read=true});saveA();return[200,{ok:true}]}
return[404,{error:"unknown"}]}
// ---- Hardening (checklist G): client IP, rate limits, security headers, backups ----
const TRUST=!!process.env.TRUST_PROXY,RPM=+process.env.RATE_PER_MIN||120,REGPH=+process.env.REGISTER_PER_HOUR||10;
const clientIp=q=>{if(TRUST){const x=String(q.headers["x-forwarded-for"]||"").split(",")[0].trim();if(x)return x}return q.socket.remoteAddress||"?"};
const RL={};const hit=(k,max,win)=>{const n=Date.now();let e=RL[k];if(!e||n-e.s>=win)e=RL[k]={s:n,c:0};e.c++;return e.c>max?Math.ceil((e.s+win-n)/1000):0};
setInterval(()=>{const n=Date.now();for(const k in RL)if(n-RL[k].s>36e5)delete RL[k]},6e4).unref();
const SEC={"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"strict-origin-when-cross-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()"};
const sec=q=>{const h=Object.assign({},SEC);if(TRUST&&q.headers["x-forwarded-proto"]==="https")h["Strict-Transport-Security"]="max-age=31536000";return h};
const BK=process.env.BACKUP_DIR||path.join(__dirname,"backups"),BKEEP=+process.env.BACKUP_KEEP||14,BEVERY=+process.env.BACKUP_EVERY_MS||6*36e5;
function backup(){try{const fl=[DB,SOC,ACC].filter(f=>fs.existsSync(f));if(!fl.length)return null;fs.mkdirSync(BK,{recursive:true,mode:0o700});const d=path.join(BK,new Date().toISOString().replace(/[:.]/g,"-"));fs.mkdirSync(d,{mode:0o700});fl.forEach(f=>fs.copyFileSync(f,path.join(d,path.basename(f))));const all=fs.readdirSync(BK).filter(x=>/^\d{4}-/.test(x)).sort();while(all.length>BKEEP)fs.rmSync(path.join(BK,all.shift()),{recursive:true,force:true});return d}catch(e){console.error("backup failed:",e.message);return null}}
setTimeout(backup,5000).unref();setInterval(backup,BEVERY).unref();
http.createServer((q,r)=>{
 const ip=clientIp(q),send=(c,o,h)=>{r.writeHead(c,Object.assign({"Content-Type":"application/json"},sec(q),h||{}));r.end(JSON.stringify(o))};
 if(q.url==="/healthz"&&q.method==="GET")return send(200,{ok:true});
 if(q.url.startsWith("/api/")){const w=hit("g|"+ip,RPM,6e4);if(w)return send(429,{error:"Too many requests. Please slow down."},{"Retry-After":String(w)})}
 if(q.url.startsWith("/api/acct/")){if(q.method!=="POST")return send(405,{error:"method"});const ep=q.url.slice(10).split("?")[0],lim=ep==="sync/push"?3e6:12000;let b="";q.on("data",d=>{b+=d;if(b.length>lim)q.destroy()});
  return q.on("end",()=>{let d={};try{d=b?JSON.parse(b):{}}catch(e){return send(400,{error:"bad json"})}try{if(ep==="register"){const w=hit("reg|"+ip,REGPH,36e5);if(w)return send(429,{error:"Too many new accounts from this network. Try again later."},{"Retry-After":String(w)})}if(ep==="sync/push"){const w=hit("sp|"+ip,30,6e4);if(w)return send(429,{error:"Syncing too often. Try again shortly."},{"Retry-After":String(w)})}const[c,o]=acct(ep,d,q.headers.authorization,ip);send(c,o)}catch(e){send(500,{error:"server error"})}})}
 if(q.url.startsWith("/api/soc/")){if(q.method!=="POST")return send(405,{error:"method"});let b="";q.on("data",d=>{b+=d;if(b.length>8000)q.destroy()});
  return q.on("end",()=>{let d;try{d=JSON.parse(b)}catch(e){return send(400,{error:"bad json"})}const id=String(d.id||"");if(!/^[a-z0-9]{12,40}$/.test(id))return send(400,{error:"bad id"});const[c,o]=socHandle(q.url.slice(9).split("?")[0],id,d);send(c,o)})}
 if(q.url.startsWith("/api/lb")){
  if(q.method==="GET"){const u=new URL(q.url,"http://x"),b=u.searchParams.get("band");
   return send(200,Object.values(rows).filter(x=>!b||x.band===b).sort((a,c)=>c.xp-a.xp).slice(0,50).map(x=>({id:crypto.createHash("sha1").update(x.id).digest("hex").slice(0,8),name:x.name,xp:x.xp,band:x.band})))}
  if(q.method==="POST"||q.method==="DELETE"){let b="";q.on("data",d=>{b+=d;if(b.length>2000)q.destroy()});
   return q.on("end",()=>{let d;try{d=JSON.parse(b)}catch(e){return send(400,{error:"bad json"})}
    const id=String(d.id||"");if(!/^[a-z0-9]{12,40}$/.test(id))return send(400,{error:"bad id"});
    if(q.method==="DELETE"){delete rows[id];save();return send(200,{ok:true})}
    const name=clean(d.name),xp=Math.max(0,Math.min(1e6,Math.floor(+d.xp)||0));
    if(!name)return send(400,{error:"display name required"});
    rows[id]={id,name,xp,band:BANDS.includes(d.band)?d.band:"sec"};save();send(200,{ok:true})})}
  return send(405,{error:"method"})}
 if(q.url==="/"||q.url==="/lumio.html"){return fs.readFile(path.join(__dirname,"lumio.html"),(e,d)=>{if(e){r.writeHead(500);return r.end("lumio.html missing")}r.writeHead(200,Object.assign({"Content-Type":"text/html; charset=utf-8"},sec(q)));r.end(d)})}
 r.writeHead(404,sec(q));r.end("Not found")
}).listen(PORT,()=>console.log("Lumio on http://localhost:"+PORT));
