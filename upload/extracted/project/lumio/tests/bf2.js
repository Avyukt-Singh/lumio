const ENG=[["Chem-S",3000,310,3],["Hydro-X",1800,420,3.5],["Ion-Z",5,3000,1]];
for(const target of [9.4,9.0,8.5]){let w=0,ex=[];
 for(const [ei,e] of ENG.entries())for(let n=1;n<=9;n++)for(let fuel=5;fuel<=400;fuel+=5)for(let hull=2;hull<=20;hull+=2)for(let pay=1;pay<=20;pay+=3){
  const dry=hull+e[3]*n+pay+0.08*fuel,m0=dry+fuel,dv=e[2]*9.81*Math.log(m0/dry)/1000,twr=e[1]*n/(m0*9.81);
  if(dv>=target&&twr>=1.2){w++;if(ex.length<3)ex.push(e[0]+' x'+n+' fuel'+fuel+' hull'+hull+' pay'+pay+' dv'+dv.toFixed(2)+' twr'+twr.toFixed(2))}}
 console.log('LEO target',target,'-> winning designs (sampled grid):',w,ex)}
// lunar mission still has a sensible range?
