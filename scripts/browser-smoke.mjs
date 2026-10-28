import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run after npm run build. BROWSER_EXECUTABLE optionally selects a local Chromium.
const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    server.once('exit', code => { clearTimeout(timeout); reject(Error(`Server exited: ${code}`)); });
    server.stdout.on('data', data => {
      const match = data.toString().match(/running on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const a = await browser.newContext({ viewport: {width:1440,height:900} });
  const b = await browser.newContext({ viewport: {width:1440,height:900} });
  const host = await a.newPage(), guest = await b.newPage();
  const errors = [];
  for (const page of [host,guest]) page.on('pageerror', error => errors.push(error.message));
  await host.goto(base);
  await host.click('#campaign');
  await host.waitForSelector('#missionPanel:not([hidden])');
  assert.match(await host.locator('#missionPanel h2').innerText(), /SILENT ENTRY/);
  await host.click('#missionPanel .retry');
  assert.match(await host.locator('#stats').innerText(), /HP: 1000\b/);
  await mkdir('artifacts', {recursive:true});
  await host.screenshot({path:'artifacts/mission-start.png'});
  if (process.argv.includes('--death')) {
    await host.evaluate(() => {
      window.healthChanges=[1000];
      new MutationObserver(records => {
        // Multiple guards can hit in one frame; retain each intermediate text node.
        for(const record of records)for(const node of record.addedNodes){
          const value=Number(node.textContent.match(/HP: (\d+)/)?.[1]);
          if(Number.isFinite(value) && value!==window.healthChanges.at(-1))window.healthChanges.push(value);
        }
      }).observe(document.querySelector('#stats'),{childList:true,characterData:true,subtree:true});
    });
    await host.locator('#game canvas').click({position:{x:720,y:500}});
    await host.waitForSelector('#missionFailure:not([hidden])',{timeout:90000});
    assert.deepEqual(await host.evaluate(()=>window.healthChanges),[1000,930,860,790,720,650,580,510,440,370,300,230,160,90,20,0]);
    assert.equal(await host.locator('#mouseHint').isVisible(),false);
    assert.equal(await host.evaluate(()=>document.pointerLockElement===null),true);
    await host.waitForTimeout(600);
    await host.screenshot({path:'artifacts/mission-death.png'});
    await host.click('#missionFailure .restart');
    assert.match(await host.locator('#stats').innerText(),/HP: 1000\b/);
    assert.equal(await host.locator('#missionFailure').isVisible(),false);
    await host.locator('#game canvas').click({position:{x:720,y:500}});
    await host.waitForSelector('#missionFailure:not([hidden])',{timeout:90000});
    await host.click('#missionFailure .menu');
    await host.waitForSelector('#lobby:not(.hidden)');
    assert.equal(await host.locator('#missionFailure').isVisible(),false);
    console.log('PASS: exactly 15 guard hits to death, hidden camera hint, failure dialog, restart to 1000 HP, back to menu.');
  } else await host.click('#missionPanel .exit');
  await host.click('#training');
  assert.match(await host.locator('#networkStatus').innerText(), /OFFLINE TRAINING/);
  await host.keyboard.press('KeyM');
  await host.click('#createRoom');
  await host.waitForSelector('#roomPanel:not(.hidden)');
  const code = (await host.locator('#roomLabel').innerText()).split(': ')[1];
  assert.match(code,/^[A-Z0-9]{6}$/);
  await guest.goto(base);
  await guest.fill('#roomCode',code);
  await guest.click('#joinRoom');
  await guest.waitForSelector('#roomPanel:not(.hidden)');
  await host.waitForFunction(() => document.querySelector('#playerCount').textContent.includes('2/2'));
  assert.match(await host.locator('#roundStatus').innerText(), /FIRST TO 5/);
  await guest.click('#leaveRoom');
  await host.waitForFunction(() => document.querySelector('#playerCount').textContent.includes('1/2'));
  await host.click('#leaveRoom');
  assert.deepEqual(errors,[]);
  console.log('PASS: campaign start/retry/exit, training, two browser contexts create/join/leave, no JavaScript errors.');
} finally {
  await browser?.close();
  if(server.exitCode===null){server.kill();await once(server,'exit');}
}
