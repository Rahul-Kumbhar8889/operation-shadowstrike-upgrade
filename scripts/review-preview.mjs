import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {mkdir} from 'node:fs/promises';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});let browser;
try{
 const base=await new Promise(resolve=>server.stdout.on('data',d=>{const m=d.toString().match(/running on port (\d+)/);if(m)resolve(`http://127.0.0.1:${m[1]}`);}));
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('artifacts',{recursive:true});
 for(const index of [0,2]){await page.goto(base);await page.selectOption('#missionSelect',String(index));await page.click('#campaign');await page.locator('.operation-plan summary').click();await page.waitForTimeout(1500);await page.screenshot({path:`artifacts/mission-review-${index+1}.png`});}
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: reviewed day/night operation screenshots and briefing checklist without browser errors.');
}finally{await browser?.close();server.kill();}
