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

// Explicit mode profiles across unrelated hemispheres. These are simulations,
// not evidence that any operator supplies complete stop/line data.
export function multimodalTrajectories(){
 const scenarios=[];
 const places=[{lat:48.85,lon:2.35},{lat:-33.87,lon:151.21},{lat:35.68,lon:139.76},{lat:-1.29,lon:36.82},{lat:34.05,lon:-118.24},{lat:59.91,lon:10.75},{lat:-18,lon:179.999}];
 const profiles=[['bus',800,130,60,6,15],['tram',800,130,60,6,12],['metro',1000,150,60,6,20],['train',3000,250,60,24,45],['highspeed',8000,300,120,24,138.89],['ferry',1500,250,60,48,15],['cable',500,130,60,2,6],['other',1000,150,60,12,20]];
 for(const [id,radius,arrivalRadius,leadSeconds,maxDurationHours,speed]of profiles)for(const place of places)for(const noisy of [false,true]){
  const target={...place,name:'Destination '+id};const config={target,radius,arrivalRadius,leadSeconds,maxDurationHours,transport:id};const points=[];let i=0;
  const stopDistance=arrivalRadius*.5;
  for(let remaining=radius+2000;remaining>stopDistance;remaining-=speed*5){const timestamp=NOW+i*5000;points.push({p:{...move(target,remaining+(noisy?Math.sin(i*3.7)*9:0),90),accuracy:noisy?45:20,timestamp},now:timestamp});i++;}
  for(let j=0;j<3;j++){const timestamp=NOW+(i+j)*5000;points.push({p:{...move(target,stopDistance,90),accuracy:noisy?45:20,timestamp},now:timestamp});}
  scenarios.push({name:`${id} ${place.lat},${place.lon} ${noisy?'GPS noise':'clear'}`,config,points,expectArrival:true});
 }
 return scenarios;
}
