import test from 'node:test';import assert from 'node:assert/strict';import {nearbyStops,findRoutes,OVERPASS_ENDPOINTS} from '../dist/data.js';
const target={name:'Test',lat:48.85,lon:2.35};
async function mocked(responses,run){const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});const response=responses.shift();if(response instanceof Error)throw response;return response};try{await run(calls)}finally{globalThis.fetch=original}}
const good={ok:true,status:200,json:async()=>({elements:[]})};
test('Overpass server failure uses one alternate endpoint',()=>mocked([{ok:false,status:503},good],async calls=>{assert.deepEqual(await nearbyStops(target),[]);assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.url),OVERPASS_ENDPOINTS)}));
test('an explicit rate limit is respected without endpoint hopping',()=>mocked([{ok:false,status:429},good],async calls=>{await assert.rejects(nearbyStops(target),/ne répond pas/);assert.equal(calls.length,1)}));
test('a rejected query is not retried',()=>mocked([{ok:false,status:400}],async calls=>{await assert.rejects(findRoutes(target));assert.equal(calls.length,1)}));
test('an already canceled query sends no network request',()=>mocked([],async calls=>{const ac=new AbortController();ac.abort();await assert.rejects(findRoutes(target,ac.signal),{name:'AbortError'});assert.equal(calls.length,0)}));
test('both servers unavailable produces a useful manual-mode error',()=>mocked([new TypeError('offline'),new TypeError('offline')],async calls=>{await assert.rejects(findRoutes(target),/mode par distance/);assert.equal(calls.length,2)}));
test('partial or malformed Overpass results are not silently accepted',()=>mocked([{ok:true,status:200,json:async()=>({elements:[],remark:'runtime error'})},good],async calls=>{assert.deepEqual(await findRoutes(target),[]);assert.equal(calls.length,2)}));
test('successful primary service never causes a second request',()=>mocked([good],async calls=>{assert.deepEqual(await nearbyStops(target),[]);assert.equal(calls.length,1)}));
