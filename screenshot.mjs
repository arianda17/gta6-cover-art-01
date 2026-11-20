import { writeFileSync } from 'node:fs';

const CDP_PORT = 18316;
const PAGE = 'ws://127.0.0.1:18316/devtools/page/EB15B108D06EAAFA830D7E53AAB3A4A8';

function wsRecv(ws, id, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const r = JSON.parse(e.data);
      if (r.id === id) { ws.removeEventListener('message', onMsg); resolve(r); }
    };
    ws.addEventListener('message', onMsg);
    setTimeout(() => { ws.removeEventListener('message', onMsg); reject(new Error('timeout id=' + id)); }, timeout);
  });
}

async function main() {
  const url = process.argv[2];
  const outPath = process.argv[3];
  const w = Number(process.argv[4] || 1080);
  const h = Number(process.argv[5] || 1080);
  const waitMs = Number(process.argv[6] || 3000);

  const ws = new WebSocket(PAGE);
  await new Promise(r => ws.addEventListener('open', r));

  const errors = [];
  ws.addEventListener('message', (e) => {
    const r = JSON.parse(e.data);
    if (r.method === 'Runtime.exceptionThrown') {
      errors.push(JSON.stringify(r.params.exceptionDetails).slice(0, 400));
    }
    if (r.method === 'Runtime.consoleAPICalled' && r.params.type === 'error') {
      errors.push(r.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
    }
  });

  let nextId = 1;
  const send = (method, params) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return id; };

  await wsRecv(ws, send('Page.enable', {}));
  await wsRecv(ws, send('Runtime.enable', {}));
  await wsRecv(ws, send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 1, mobile: false,
  }));

  await wsRecv(ws, send('Page.navigate', { url }));
  await new Promise(r => setTimeout(r, waitMs));

  const r = await wsRecv(ws, send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.getElementById('cover');
      return JSON.stringify({
        ready: !!window.__shotReady,
        cw: c ? c.width : null,
        ch: c ? c.height : null,
        fonts: document.fonts.status,
        fontCheck: document.fonts.check('900 64px "Anton"'),
        body: document.body.className,
      });
    })()`,
    returnByValue: true,
  }));
  console.log('state:', r.result?.result?.value);
  if (errors.length) console.log('ERRORS:', errors.slice(0, 5).join('\n'));

  const shot = await wsRecv(ws, send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }));
  writeFileSync(outPath, Buffer.from(shot.result.data, 'base64'));
  console.log('wrote', outPath, Math.round(shot.result.data.length * 3 / 4), 'bytes', w + 'x' + h);

  ws.close();
}

main().catch(e => { console.error(e); process.exit(1); });