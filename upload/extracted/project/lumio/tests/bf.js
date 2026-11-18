const ENG=[["Chem-S",3000,310,3],["Hydro-X",1800,420,3.5],["Ion-Z",5,3000,1]];
const MIS=[["LEO from ground",9.4,1.2],["Lunar transfer",3.2,0.005]];
for(const [mi,m] of MIS.entries()){let wins=[],best={};
 for(const [ei,e] of ENG.entries())for(let fuel=5;fuel<=400;fuel++)for(let hull=2;hull<=20;hull++)for(let pay=1;pay<=20;pay++){
  const dry=hull+e[3]+pay+0.08*fuel,m0=dry+fuel,dv=e[2]*9.81*Math.log(m0/dry)/1000,twr=e[1]/(m0*9.81);
  if(dv>=m[1]&&twr>=m[2])wins.push([e[0],fuel,hull,pay,dv.toFixed(2),twr.toFixed(2)]);
  const k=e[0];if(!best[k]||dv*(twr>=m[2]?1:0)>best[k].s)best[k]={s:dv*(twr>=m[2]?1:0),dv:dv.toFixed(2),twr:twr.toFixed(2),f:fuel,h:hull,p:pay}}
 console.log(m[0],'-> winning designs:',wins.length,wins.slice(0,2).map(w=>w.join('/')),'| best valid per engine:',JSON.stringify(Object.fromEntries(Object.entries(best).map(([k,v])=>[k,v.dv+' km/s @TWR '+v.twr]))))}
