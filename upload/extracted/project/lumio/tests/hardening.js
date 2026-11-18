// Hardening test. Starts its own throwaway server.  Run: node tests/hardening.js
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lumio-h-')),PORT=3177,U='http://127.0.0.1:'+PORT;let fails=0;
const ok=(n,c,x='')=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''))};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const env=Object.assign({},process.env,{PORT,ACCDB:tmp+'/acc.json',SOCDB:tmp+'/soc.json',BACKUP_DIR:tmp+'/bk',BACKUP_EVERY_MS:'400',BACKUP_KEEP:'3',RATE_PER_MIN:'20',REGISTER_PER_HOUR:'3',TRUST_PROXY:'1'});
const srv=spawn('node',['server.js'],{env,cwd:process.cwd()});
const post=(ep,b,h)=>fetch(U+'/api/acct/'+ep,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},h||{}),body:JSON.stringify(b||{})});
(async()=>{await wait(800);
let r=await fetch(U+'/healthz');ok('health check',r.status===200&&(await r.json()).ok===true);
ok('nosniff header',r.headers.get('x-content-type-options')==='nosniff');
ok('clickjacking and referrer headers',r.headers.get('x-frame-options')==='DENY'&&!!r.headers.get('referrer-policy')&&!!r.headers.get('permissions-policy'));
ok('no HSTS over plain HTTP',!r.headers.get('strict-transport-security'));
r=await fetch(U+'/healthz',{headers:{'X-Forwarded-Proto':'https'}});
ok('HSTS only when proxy says HTTPS',!!r.headers.get('strict-transport-security'));
r=await fetch(U+'/');ok('app page also gets security headers',r.status===200&&r.headers.get('x-frame-options')==='DENY');
// registration limit per client IP (3/hour), different IPs separate
const reg=(n,ip)=>post('register',{username:n,password:'correct horse 1'},{'X-Forwarded-For':ip});
const s=[];for(let i=0;i<4;i++)s.push((await reg('user'+i,'10.0.0.1')).status);
ok('4th signup from one IP is blocked with 429',s.slice(0,3).every(x=>x===200)&&s[3]===429,JSON.stringify(s));
r=await reg('other','10.0.0.2');ok('a different IP is not affected',r.status===200);
r=await reg('blocked','10.0.0.1');ok('Retry-After header present',r.status===429&&+r.headers.get('retry-after')>0);
// general limit 20/min
let last=0,n429=0;for(let i=0;i<30;i++){const x=await fetch(U+'/api/lb',{headers:{'X-Forwarded-For':'10.0.0.9'}});if(x.status===429)n429++;last=x.status}
ok('general API limit returns 429 after 20 requests/min',n429>=9&&last===429,'429s: '+n429);
r=await fetch(U+'/api/lb',{headers:{'X-Forwarded-For':'10.0.0.10'}});ok('other clients still served',r.status===200);
// backups
await wait(1800);
const dirs=fs.existsSync(tmp+'/bk')?fs.readdirSync(tmp+'/bk').filter(x=>/^\d{4}-/.test(x)):[];
ok('automatic backups are created',dirs.length>=1,'count '+dirs.length);
ok('old backups are pruned to BACKUP_KEEP=3',dirs.length<=3);
ok('backup contains accounts data',dirs.length&&fs.existsSync(path.join(tmp,'bk',dirs[dirs.length-1],'acc.json'))&&JSON.parse(fs.readFileSync(path.join(tmp,'bk',dirs[dirs.length-1],'acc.json'),'utf8')).users.user0);
ok('backup folder is private (0700)',(fs.statSync(tmp+'/bk').mode&0o077)===0);
srv.kill();fs.rmSync(tmp,{recursive:true,force:true});console.log(fails?'FAILED '+fails:'ALL PASSED');process.exit(fails?1:0)})();
