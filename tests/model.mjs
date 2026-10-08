import assert from 'node:assert/strict';
import { PRESETS, field, intensity, raster } from '../public/model.mjs';
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
assert.deepEqual(PRESETS.pair,[{x:-.5,y:0},{x:.5,y:0}]);
assert.deepEqual(PRESETS.triangle,[{x:-.5,y:-.3},{x:.5,y:-.3},{x:0,y:.6}]);
assert.equal(PRESETS.ring.length,6);
for(const p of PRESETS.ring) near(Math.hypot(p.x,p.y),.6);
near(intensity([],1,2),0);
for(const [u,v] of [[0,0],[.5,0],[1,0],[2.23,-3.18]]) {
 near(intensity([{x:.23,y:-.41}],u,v),1);
 near(intensity(PRESETS.pair,u,v),Math.cos(Math.PI*u)**2);
}
const shifted=PRESETS.triangle.map(p=>({x:p.x+.17,y:p.y-.12}));
for(const [u,v] of [[0,0],[.5,0],[1.1,-.9],[5.2,4.3]]) {
 const f=field(PRESETS.triangle,u,v),g=field(shifted,u,v);
 assert.equal(f.waves.length,3);
 const a=-2*Math.PI*(u*.17-v*.12);
 near(g.re,f.re*Math.cos(a)-f.im*Math.sin(a));
 near(g.im,f.re*Math.sin(a)+f.im*Math.cos(a));
 near(f.intensity,g.intensity);
 near(f.re,f.waves.reduce((s,w)=>s+w.re,0));
 near(f.im,f.waves.reduce((s,w)=>s+w.im,0));
 for(const w of f.waves) near(Math.hypot(w.re,w.im),1);
 near(f.intensity,intensity(PRESETS.triangle,u,v));
 near(f.intensity,intensity(PRESETS.triangle,-u,-v));
}
const image=raster(PRESETS.pair,25);
assert.ok(image instanceof Uint8ClampedArray);
assert.equal(image.length,25*25*4);
// u=0 and u=.5 at center row; constructive vs destructive.
assert.deepEqual(Array.from(image.slice((12*25+12)*4,(12*25+12)*4+4)),[185,221,255,255]);
assert.deepEqual(Array.from(image.slice((12*25+13)*4,(12*25+13)*4+4)),[8,14,25,255]);
const one=raster([{x:.2,y:.3}],4);
for(let i=0;i<one.length;i+=4)assert.deepEqual(Array.from(one.slice(i,i+4)),[185,221,255,255]);
console.log('model pass');
