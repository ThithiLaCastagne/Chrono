import test from 'node:test';
import assert from 'node:assert/strict';
import {TripEngine,validTrip,distance} from '../dist/engine.js';
import {TRANSPORTS,transportProfile,profileForRoute} from '../dist/profiles.js';
import {move,NOW,multimodalTrajectories} from './trajectories.mjs';
const target={name:'Terminus',lat:48.85,lon:2.35};
const point=(metres,seconds,accuracy=20)=>({...move(target,metres,0),accuracy,timestamp:NOW+seconds*1000});
const config=(extras={})=>({target,radius:800,...extras});
function feed(e,m,s,a=20){return e.ingest(point(m,s,a),NOW+s*1000);}

test('all eight transport presets are immutable and form valid trip configurations',()=>{
 assert.equal(TRANSPORTS.length,8);assert.equal(new Set(TRANSPORTS.map(p=>p.id)).size,8);
 for(const p of TRANSPORTS){assert.ok(Object.isFrozen(p));assert.ok(validTrip({...p,target}));assert.ok(p.radius>p.arrivalRadius);}
 assert.equal(transportProfile('unknown').id,'bus');
});
test('route modes cover road, rail, water and cable without inventing a high-speed service',()=>{
 for(const [mode,id]of [['trolleybus','bus'],['share_taxi','bus'],['tram','tram'],['subway','metro'],['monorail','metro'],['train','train'],['ferry','ferry'],['funicular','cable'],['gondola','cable'],['unknown','other']])assert.equal(profileForRoute(mode).id,id);
});
test('long journeys and enlarged station zones accept only bounded explicit values',()=>{
 assert.ok(validTrip(config({radius:30000,arrivalRadius:1000,backup:4320,maxDurationHours:72,leadSeconds:300})));
 for(const extra of [{radius:30001},{arrivalRadius:800},{arrivalRadius:1001},{maxDurationHours:0},{maxDurationHours:73},{maxDurationHours:1.5},{maxDurationHours:'24'},{backup:4321},{backup:1.5},{leadSeconds:-1},{leadSeconds:301},{leadSeconds:'60'}])assert.equal(validTrip(config(extra)),false,JSON.stringify(extra));
});
test('500 km/h rail fixes are accepted while a GPS teleport is still rejected',()=>{
 const e=new TripEngine(config({...transportProfile('highspeed')}));
 for(let i=0;i<8;i++){feed(e,6000-i*694.44,i*5);assert.equal(e.status,'good');}
 const t=new TripEngine(config());feed(t,10000,0);assert.deepEqual(feed(t,0,1),[]);assert.equal(t.status,'jump');
});
test('train and ferry profiles can detect a real stop 180 m from the named point',()=>{
 for(const id of ['train','ferry']){const e=new TripEngine(config({...transportProfile(id)}));feed(e,1000,0);assert.deepEqual(feed(e,180,20),['arrived']);}
});
test('high-speed preset warns well before the small urban default would fire',()=>{
 const e=new TripEngine(config({...transportProfile('highspeed')}));feed(e,10000,0);assert.deepEqual(feed(e,7800,25),['approach']);assert.equal(e.arrived,false);
});
test('two consistent conservative closing-speed samples expand the approach zone',()=>{
 const e=new TripEngine(config({leadSeconds:60}));feed(e,3000,0);feed(e,2500,10);assert.equal(e.approachRadius,800);
 assert.deepEqual(feed(e,2000,20),['approach']);assert.ok(e.approachRadius>2700&&e.approachRadius<2800);assert.equal(e.arrived,false);
});
test('legacy configurations keep the configured approach distance',()=>{
 const e=new TripEngine(config());feed(e,3000,0);feed(e,2500,10);assert.deepEqual(feed(e,2000,20),[]);assert.equal(e.approachRadius,800);
});
test('provider reports a fraction of a second apart cannot invent a closing speed',()=>{
 const e=new TripEngine(config({leadSeconds:60}));feed(e,3000,0);feed(e,2970,.1);feed(e,2950,.2);assert.equal(e.approachRadius,800);
 feed(e,2500,10);feed(e,2499,10.1);assert.deepEqual(feed(e,2000,20),['approach']);assert.ok(e.approachRadius>2700);
});
test('receding, inaccurate and inconsistent samples do not expand the approach zone',()=>{
 for(const seq of [[[3000,0],[3500,10],[4000,20]],[[5000,0,100],[4500,10,100],[4000,20,100]],[[6000,0],[5000,10],[4900,20]]]){
  const e=new TripEngine(config({leadSeconds:60}));for(const row of seq)feed(e,...row);assert.equal(e.approachRadius,800);
 }
});
test('a tunnel gap discards the previous speed trend without extrapolating progress',()=>{
 const e=new TripEngine(config({leadSeconds:60}));feed(e,5000,0);feed(e,4500,10);feed(e,4000,20);assert.ok(e.approachRadius>800);assert.equal(e.health(NOW+60000),'stale');
 feed(e,3000,80);assert.equal(e.approachRadius,800);assert.equal(e.arrived,false);
});
test('fresh valid GPS remains healthy when another provider submits unusable data',()=>{
 const e=new TripEngine(config());feed(e,2000,0);feed(e,2000,1,1000);assert.equal(e.status,'weak');assert.equal(e.health(NOW+1000),'good');assert.equal(e.health(NOW+31000),'stale');assert.equal(e.arrived,false);
});
test('larger station zones still require the whole uncertainty radius to fit',()=>{
 const e=new TripEngine(config({...transportProfile('train')}));feed(e,230,0,60);feed(e,230,3,60);assert.equal(e.arrived,false);feed(e,150,6,60);assert.deepEqual(feed(e,150,9,60),['arrived']);
});
test('stationary cable and ferry movements cannot manufacture an arrival from time alone',()=>{
 for(const id of ['cable','ferry']){const e=new TripEngine(config({...transportProfile(id)}));for(let i=0;i<20;i++)feed(e,500,i*5,30);assert.equal(e.arrived,false);}
});
test('destination position skipped in a tunnel stays unconfirmed after emergence',()=>{
 const e=new TripEngine(config({...transportProfile('metro')}));feed(e,2000,0);feed(e,600,20);feed(e,-600,100);assert.equal(e.arrived,false);assert.equal(e.health(NOW+100000),'good');
});
test('112 multi-mode journeys span seven world regions, date line and GPS noise',()=>{
 const scenarios=multimodalTrajectories();assert.equal(scenarios.length,112);
 for(const scenario of scenarios){const e=new TripEngine(scenario.config),events=[];
  for(const {p,now}of scenario.points){const next=e.ingest(p,now);if(next.includes('arrived'))assert.ok(distance(p,scenario.config.target)+p.accuracy<=scenario.config.arrivalRadius+.00001,scenario.name);events.push(...next);}
  assert.deepEqual(events,['approach','arrived'],scenario.name);
 }
});
