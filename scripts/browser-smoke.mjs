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
  assert.match(await host.locator('#stats').innerText(), /HP: 100/);
  await mkdir('artifacts', {recursive:true});
  await host.screenshot({path:'artifacts/mission-start.png'});
  await host.click('#missionPanel .exit');
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
