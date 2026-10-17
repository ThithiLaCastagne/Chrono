import test from 'node:test';import assert from 'node:assert/strict';
import {TripEngine,distance} from '../dist/engine.js';import {trajectories,move,NOW} from './trajectories.mjs';
import {parseRoutes,normalizeFeatures} from '../dist/data.js';
const scenarios=trajectories();
test('240 generated bus, metro and train journeys: varying latitude, direction, noise and outages',()=>{
 for(const s of scenarios.filter(s=>s.expectArrival)){const e=new TripEngine(s.config),events=[];for(const {p,now}of s.points){const next=e.ingest(p,now);if(next.includes('arrived'))assert.ok(distance(p,s.config.target)+p.accuracy<=130,s.name);if(p.accuracy>150)assert.deepEqual(next,[],s.name);events.push(...next)}assert.equal(events.filter(x=>x==='arrived').length,1,s.name);assert.equal(events.filter(x=>x==='approach').length,1,s.name);assert.deepEqual(events,['approach','arrived'],s.name)}
});
test('100 noisy stationary trajectories away from the station never announce arrival',()=>{
 for(const s of scenarios.filter(s=>!s.expectArrival)){const e=new TripEngine(s.config),events=[];for(const {p,now}of s.points)events.push(...e.ingest(p,now));assert.equal(e.arrived,false,s.name);assert.ok(events.length<=1,s.name)}
});
test('the exact arrival boundary respects uncertainty on either side',()=>{const target={name:'Edge',lat:48.85,lon:2.35};for(const m of [109.9,110.1]){const e=new TripEngine({target,radius:800});const events=e.ingest({...move(target,m,70),accuracy:20,timestamp:NOW},NOW);assert.equal(events.includes('arrived'),m<110)}});
test('near the geographic pole remains numerically stable',()=>{const p={lat:89.99999,lon:0},q={lat:89.99999,lon:180};assert.ok(distance(p,q)<3);assert.ok(Number.isFinite(distance(p,q)))});
test('going away then returning sends no duplicate approach',()=>{const target={name:'Turn',lat:48.85,lon:2.35},e=new TripEngine({target,radius:800});const events=[];[1200,600,1000,500,0].forEach((d,i)=>events.push(...e.ingest({...move(target,d,0),accuracy:20,timestamp:NOW+i*15000},NOW+i*15000)));assert.deepEqual(events,['approach','arrived'])});
test('Unicode stop names cannot collapse into a false match',()=>{const els=[{type:'node',id:1,lat:35.67,lon:139.7,tags:{name:'前駅'}},{type:'node',id:2,lat:35.68,lon:139.7,tags:{name:'東京'}},{type:'relation',id:3,tags:{type:'route',route:'bus','public_transport:version':'2'},members:[{type:'node',ref:1,role:'stop'},{type:'node',ref:2,role:'stop'}]}];assert.equal(parseRoutes(els,{name:'東京',lat:35.68,lon:139.7}).length,1);assert.equal(parseRoutes(els,{name:'新宿',lat:35.68,lon:139.7}).length,0)});
test('invalid remote route containers are handled as unavailable data',()=>{for(const els of [null,{},[null,{},false,{type:'relation',members:{}}]])assert.deepEqual(parseRoutes(els,{name:'X',lat:0,lon:0}),[])});
test('numeric-string coordinates are rejected rather than coerced',()=>{assert.deepEqual(normalizeFeatures([{geometry:{coordinates:['2.35','48.85']},properties:{name:'Bad'}}]),[])});
