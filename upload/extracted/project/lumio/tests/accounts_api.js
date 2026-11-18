// API test for accounts. Start the server first (throwaway data, short OTP gap):
//   ACCDB=/tmp/acc_test.json SOCDB=/tmp/soc_t.json OTP_GAP_MS=300 PORT=3124 node server.js > /tmp/acc.log 2>&1 &
// then: node tests/accounts_api.js
const fs=require('fs');const U='http://localhost:3124/api/acct/';let fails=0;
const call=async(ep,body,tok)=>{const r=await fetch(U+ep,{method:'POST',headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},body:JSON.stringify(body||{})});return{s:r.status,j:await r.json()}};
const ok=(name,cond,extra='')=>{if(!cond)fails++;console.log((cond?'PASS ':'FAIL ')+name+(extra?'  '+extra:''))};
const lastOtp=()=>{const m=[...fs.readFileSync('/tmp/acc.log','utf8').matchAll(/Lumio code (\d{6})/g)];return m.length?m[m.length-1][1]:null};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
let r=await call('register',{username:'asha',password:'short'});ok('short password rejected',r.s===400);
r=await call('register',{username:'Bad Name!',password:'longenough1'});ok('bad username rejected',r.s===400);
r=await call('register',{username:'asha',password:'correct horse 1'});ok('register learner',r.s===200&&r.j.recovery.length===8,'recovery codes: '+r.j.recovery.length);const tokA=r.j.token,rec=r.j.recovery;
r=await call('register',{username:'asha',password:'another pass 1'});ok('duplicate username 409',r.s===409);
await wait(600);const raw=fs.readFileSync('/tmp/acc_test.json','utf8');ok('password and token not stored in plain text',!raw.includes('correct horse 1')&&!raw.includes(tokA)&&!raw.includes(rec[0]));
r=await call('me',{});ok('me without token 401',r.s===401);r=await call('me',{},tokA);ok('me with token',r.s===200&&r.j.name==='asha'&&r.j.role==='learner');
for(let i=0;i<5;i++)r=await call('login',{username:'asha',password:'wrong'+i});r=await call('login',{username:'asha',password:'correct horse 1'});ok('lockout after 5 failures (even correct password)',r.s===429);
// sync + conflict + xp cap
r=await call('sync/push',{rev:0,blob:'{"xp":10}',summary:{xp:2000,streak:3,week:2,cls:'Class 7',exam:'',weak:['Fractions'],chapters:[{n:'Fractions',best:1,state:'done'}]},consent:false},tokA);ok('push rev 0',r.s===200&&r.j.rev===1);
r=await call('sync/push',{rev:0,blob:'{"xp":99}'},tokA);ok('stale push gets 409 with server copy',r.s===409&&r.j.blob==='{"xp":10}'&&r.j.rev===1);
r=await call('sync/pull',{},tokA);ok('pull returns stored blob',r.j.blob==='{"xp":10}');
r=await call('sync/push',{rev:1,blob:'{"xp":11}',summary:{xp:2600,streak:3,week:2,chapters:[]},consent:false},tokA);
r=await call('profile/set',{nick:'Asha',vis:'public'},tokA);ok('profile public',r.j.vis==='public'&&r.j.nick==='Asha');
r=await call('lb',{});const row=r.j.rows.find(x=>x.name==='Asha');ok('server-limited XP: 2600 reported, 800 counted per day',row&&row.xp===800,'counted '+(row&&row.xp));ok('flags raised for capped gains',(await call('me',{},tokA)).j.flags>=1);
// recovery codes
r=await call('recover/code',{username:'asha',code:rec[0],newPassword:'brand new pass 2'});ok('recovery code resets password',r.s===200&&r.j.left===7);
r=await call('recover/code',{username:'asha',code:rec[0],newPassword:'brand new pass 3'});ok('recovery code is one-time',r.s===401);
r=await call('me',{},tokA);ok('old session invalidated after recovery',r.s===401);
r=await call('login',{username:'asha',password:'brand new pass 2'});ok('login with new password',r.s===200);const tok=r.j.token;
// phone OTP (dev mode: read code from server log)
r=await call('phone/request',{phone:'abc'},tok);ok('bad phone rejected',r.s===400);
r=await call('phone/request',{phone:'+919876543210'},tok);ok('OTP requested (dev mode flag)',r.s===200&&r.j.dev===true);
r=await call('phone/verify',{code:'000000'},tok);ok('wrong OTP rejected',r.s===401);
r=await call('phone/request',{phone:'+919876543210'},tok);ok('OTP resend within gap is limited',r.s===429);await wait(400);
r=await call('phone/request',{phone:'+919876543210'},tok);const code=lastOtp();r=await call('phone/verify',{code},tok);ok('correct OTP verifies phone',r.s===200&&r.j.phoneOk===true&&r.j.phone.includes('•••'),'masked '+r.j.phone);
r=await call('phone/verify',{code},tok);ok('OTP cannot be reused',r.s===401);
await wait(400);await call('login/otp/request',{phone:'+919876543210'});const c2=lastOtp();r=await call('login/otp/verify',{phone:'+919876543210',code:c2});ok('phone OTP login',r.s===200&&r.j.me.name==='asha');
r=await call('login/otp/request',{phone:'+910000000000'});ok('unknown phone gives same neutral reply (no account enumeration)',r.s===200&&/If that number/.test(r.j.msg));
await wait(400);await call('recover/otp/request',{username:'asha'});const c3=lastOtp();r=await call('recover/otp/confirm',{username:'asha',code:c3,newPassword:'otp reset pass 4'});ok('password reset by phone OTP',r.s===200);
r=await call('login',{username:'asha',password:'otp reset pass 4'});ok('login after OTP reset',r.s===200);const tokL=r.j.token;
// parent link, consent, messages
r=await call('register',{username:'papa',password:'parent pass 12',role:'parent'});const tokP=r.j.token;
r=await call('register',{username:'stranger',password:'stranger pass 1'});const tokS=r.j.token;
r=await call('parent/invite',{},tokP);ok('parent cannot create invite',r.s===403);
r=await call('parent/invite',{},tokL);const inv=r.j.code;ok('learner gets invite code',/^[A-Z0-9]{8}$/.test(inv));
r=await call('parent/link',{code:'WRONG123'},tokP);ok('bad invite rejected',r.s===404);
r=await call('parent/link',{code:inv},tokP);ok('parent links with invite',r.s===200&&r.j.child==='asha');
r=await call('parent/link',{code:inv},tokP);ok('invite is single use',r.s===404);
r=await call('parent/children',{},tokP);ok('summary hidden without consent',r.j.children[0].consent===false&&r.j.children[0].summary===null);
r=await call('sync/pull',{},tokL);const rev=r.j.rev;await call('sync/push',{rev,blob:'{}',summary:{xp:100,streak:4,week:3,cls:'Class 7',exam:'',weak:['Fractions'],chapters:[{n:'Fractions',best:1,state:'done'}]},consent:true},tokL);
r=await call('parent/children',{},tokP);ok('summary visible after learner consent',r.j.children[0].summary&&r.j.children[0].summary.streak===4&&r.j.children[0].summary.chapters.length===1);
r=await call('msg/send',{to:'asha',text:'Proud of your streak!'},tokP);ok('parent messages learner',r.s===200);
r=await call('msg/send',{to:'asha',text:'hi'},tokS);ok('stranger cannot message learner',r.s===403);
r=await call('me',{},tokL);ok('learner sees 1 unread',r.j.unread===1);r=await call('msg/inbox',{},tokL);ok('inbox has the message',r.j.msgs[0].text==='Proud of your streak!'&&r.j.msgs[0].from==='papa');
await call('msg/read',{},tokL);r=await call('me',{},tokL);ok('mark read clears unread',r.j.unread===0);
r=await call('msg/send',{to:'papa',text:'Thanks!'},tokL);ok('learner replies to parent',r.s===200);
r=await call('parent/unlink',{name:'papa'},tokL);r=await call('parent/children',{},tokP);ok('learner can unlink parent',r.j.children.length===0);
r=await call('delete',{password:'wrong'},tokL);ok('delete needs correct password',r.s===401);r=await call('delete',{password:'otp reset pass 4'},tokL);ok('account deleted',r.s===200);r=await call('login',{username:'asha',password:'otp reset pass 4'});ok('deleted account cannot log in',r.s===401);
console.log(fails?('FAILURES: '+fails):'ALL PASSED');process.exit(fails?1:0)})();
