// Reproducible generated journeys; all units in metres, seconds and degrees.
export const NOW=1700000000000;
export function move(p,metres,bearing){const r=Math.PI/180,delta=metres/6371000,b=bearing*r,a=p.lat*r,l=p.lon*r;const lat=Math.asin(Math.sin(a)*Math.cos(delta)+Math.cos(a)*Math.sin(delta)*Math.cos(b));const lon=l+Math.atan2(Math.sin(b)*Math.sin(delta)*Math.cos(a),Math.cos(delta)-Math.sin(a)*Math.sin(lat));return {lat:lat/r,lon:((lon/r+540)%360)-180};}
export function trajectories(){
 const scenarios=[];
 for(const target of [{lat:48.85,lon:2.35},{lat:-33.87,lon:151.21},{lat:0,lon:0},{lat:78,lon:15},{lat:0,lon:179.999}])for(const speed of [8,20,44])for(const bearing of [0,90,180,270])for(const condition of ['clear','noise','dropouts','moderate']){
  const config={target:{...target,name:'Destination'},radius:800,arrivalRadius:130};const points=[];let i=0;
  for(let remaining=2200;remaining>=0;remaining=Math.max(0,remaining-speed*3)){
   const noise=condition==='noise'?Math.sin(i*7.3)*9:0,accuracy=condition==='moderate'?60:condition==='dropouts'&&i%7===2?800:20;
   const timestamp=NOW+i*3000;points.push({p:{...move(target,Math.max(0,remaining+noise),bearing),accuracy,timestamp},now:timestamp});i++;if(remaining===0)break;
  }
  for(let j=0;j<3;j++){let timestamp=NOW+(i+j)*3000;points.push({p:{...target,accuracy:20,timestamp},now:timestamp})}
  scenarios.push({name:`${target.lat},${target.lon} ${speed}m/s ${bearing}° ${condition}`,config,points,expectArrival:true});
 }
 let seed=0xBADCAFE;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<100;i++){
  const target={lat:-80+random()*160,lon:-180+random()*360,name:'Far destination'},config={target,radius:800},points=[];
  const base=350+random()*2000,bearing=random()*360;
  for(let j=0;j<50;j++){const t=NOW+j*3000;points.push({p:{...move(target,base+(random()-.5)*150,bearing),accuracy:20+random()*130,timestamp:t},now:t})}
  scenarios.push({name:'Far noisy stationary '+i,config,points,expectArrival:false});
 }
 return scenarios;
}
