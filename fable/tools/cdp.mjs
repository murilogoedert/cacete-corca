// node --experimental-websocket cdp.mjs <url> <script.js> [saida]
// Abre o Chrome sem janela com WebGPU, espera __cap.ready() e roda o script (função async que recebe ev e save).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const [url, scriptFile, outDir = '.'] = process.argv.slice(2);
const port = 9333 + Math.floor(Math.random() * 500), prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--enable-unsafe-webgpu', '--enable-features=WebGPU', '--ignore-gpu-blocklist', '--window-size=1280,720', '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(), logs = [];
try {
  let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch (e) { await sleep(200); } }
  const tab = tabs.find(t => t.type === 'page');
  ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ')); else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  const save = (name, dataUrl) => fs.writeFileSync(path.join(outDir, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url });
  let ok = false;
  for (let i = 0; i < 240; i++) { await sleep(500); const s = await ev(`typeof __cap !== 'undefined' ? (__cap.error() ? 'ERR ' + __cap.error() : __cap.ready() ? 'ok' : (document.getElementById('msg') || {}).textContent) : 'sem __cap'`); if (s === 'ok') { ok = true; break; } if (String(s).startsWith('ERR') || String(s).startsWith('erro')) { console.log(s); break; } }
  console.log('pronto:', ok);
  if (ok) { const fn = (await import('file:///' + path.resolve(scriptFile).replace(/\\/g, '/'))).default; await fn(ev, save, sleep); }
} catch (e) { console.log('FALHA', e.message); }
finally { if (logs.length) console.log(logs.slice(0, 30).join('\n')); try { ws && ws.close(); } catch (e) { } chrome.kill(); }
process.exit(0);
