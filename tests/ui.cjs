const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const stage=Number(process.env.STAGE||2);
const url=process.env.TEST_URL||'http://holes-and-stars-preview:3000';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(url);assert.equal(response.status(),200);
   await page.getByRole('heading',{name:'Holes & Stars',exact:true}).waitFor();
   await page.waitForFunction(()=>document.querySelector('#sky')?.width>0&&document.querySelectorAll('[data-hole-index]').length===2);
   const pixels=()=>page.locator('#sky').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
   const points=()=>page.locator('[data-hole-index]').evaluateAll(es=>es.map(e=>({x:Number(e.dataset.x),y:Number(e.dataset.y)})));
   const setRange=async(id,value)=>{await page.locator(id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);await page.waitForTimeout(120);};
   const initial=await pixels();assert.ok(new Set(initial.filter((_,i)=>i%4===0)).size>12,'sky needs actual fringes');
   await page.getByRole('button',{name:'Hole 1',exact:true}).click();
   await setRange('#hole-x',-.8);
   assert.ok(Math.abs((await points())[0].x+.8)<1e-8);
   assert.notDeepEqual(await pixels(),initial,'hole move must redraw intensity');
   // Real pointer drag, not synthetic events: drag the second SVG point.
   const hole=page.locator('[data-hole-index="1"]');await hole.scrollIntoViewIfNeeded();
   const hb=await hole.boundingBox();const mask=await page.locator('#mask').boundingBox();
   const beforeDrag=await points();
   await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();
   await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2-mask.height*.08,{steps:5});await page.mouse.up();
   await page.waitForTimeout(150);assert.notDeepEqual(await points(),beforeDrag,'real drag must move hole');
   await page.getByRole('button',{name:'Ring',exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-hole-index]').length===6);
   await page.getByRole('button',{name:'Hole 6',exact:true}).click();await page.locator('#remove-hole').click();
   assert.equal((await points()).length,5);
   await page.getByRole('button',{name:'Pair',exact:true}).click();
   // Tap at source (0,.5), empty in Pair; source SVG is a square, y positive upward.
   await page.locator('#mask').scrollIntoViewIfNeeded();const mb=await page.locator('#mask').boundingBox();
   await page.mouse.click(mb.x+mb.width*.5,mb.y+mb.height*.25);
   await page.waitForTimeout(100);assert.equal((await points()).length,3,'empty-mask click adds');
   // keyboard path uses native slider, not dispatch.
   await page.getByRole('button',{name:'Hole 3',exact:true}).click();
   const keyboardBefore=(await points())[2].x;await page.locator('#hole-x').focus();await page.keyboard.press('ArrowRight');
   await page.waitForTimeout(120);assert.ok((await points())[2].x>keyboardBefore);
   await page.getByRole('button',{name:'Pair',exact:true}).click();await page.waitForTimeout(120);
   if(stage>=3){
    await setRange('#probe-u',.5);await setRange('#probe-v',0);
    assert.match(await page.locator('#brightness').innerText(),/^Brightness: 0%$/);
    assert.equal(await page.locator('#wave-diagram [data-wave]').count(),2);
    assert.equal(await page.locator('#wave-diagram [data-resultant]').count(),1);
    await setRange('#probe-u',0);
    assert.match(await page.locator('#brightness').innerText(),/^Brightness: 100%$/);
    await page.locator('#sky').scrollIntoViewIfNeeded();const sb=await page.locator('#sky').boundingBox();
    await page.mouse.click(sb.x+sb.width*.7,sb.y+sb.height*.3);await page.waitForTimeout(120);
    assert.ok(Math.abs(Number(await page.locator('#probe-u').inputValue()))>1,'sky pointer inspects');
   }
   if(stage>=4){
    await page.getByRole('button',{name:'Ring',exact:true}).click();await page.waitForTimeout(150);
    const priorPoints=await points(), priorPixels=await pixels();const pu=await page.locator('#probe-u').inputValue();
    await page.locator('#move-right').click();await page.waitForTimeout(150);
    const moved=await points();for(let i=0;i<moved.length;i++){assert.ok(Math.abs(moved[i].x-priorPoints[i].x-.1)<1e-8);assert.equal(moved[i].y,priorPoints[i].y);}
    const nextPixels=await pixels();assert.equal(nextPixels.length,priorPixels.length);
    assert.ok(nextPixels.every((v,i)=>Math.abs(v-priorPixels[i])<=1),'translation must preserve the sky');
    assert.equal(await page.locator('#probe-u').inputValue(),pu);
    // One more legal move then boundary checks, whether controls disable or report rejection.
    for(let i=0;i<8;i++){if(await page.locator('#move-right').isEnabled())await page.locator('#move-right').click();}
    const edge=await points();assert.ok(edge.every(p=>p.x<=1+1e-9&&p.x>=-1-1e-9));
    if(await page.locator('#move-right').isEnabled())await page.locator('#move-right').click();
    assert.deepEqual(await points(),edge);
    const details=page.locator('details').filter({has:page.locator('summary',{hasText:'What kind of light is this?'})});
    await details.locator('summary').click();assert.match(await details.innerText(),/square-root display curve/);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
   assert.deepEqual(errors,[]);
   await page.screenshot({path:`/repo/tests/artifacts/stage-${stage}-${viewport.width}.png`,fullPage:true});
   await page.close();
  }
  console.log(`ui ${stage} pass`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
