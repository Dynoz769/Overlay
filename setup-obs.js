// Setup OBS automatik melalui obs-websocket (terbina dalam OBS 28+).
//   1. Cari source phone / game (capture card, AirPlay window, game capture…)
//   2. Tambah Browser Source "SISTEM LIVE Overlay" ke scene semasa, saiz ikut kanvas, letak paling atas
//   3. Buka Windowed Projector source phone → pilih tetingkap tu dalam Auto Detect
//
// Dalam OBS: Tools → WebSocket Server Settings → tanda "Enable WebSocket server".
// Jalankan: node setup-obs.js   (atau double-click SETUP-OBS.bat)
//   Pilihan: --password=xxx  --port=4455  --source="Nama Source"  --host=127.0.0.1
const crypto = require('crypto');
const readline = require('readline');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2]] : [a, true]; }));
const HOST = args.host || '127.0.0.1', PORT = Number(args.port || 4455);
const OVERLAY = 'SISTEM LIVE Overlay';
const VIDEO_KINDS = ['dshow_input', 'av_capture_input', 'v4l2_input', 'window_capture', 'game_capture', 'macos_screen_capture', 'screen_capture', 'xcomposite_input', 'monitor_capture'];

const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a.trim()); }); });
const sha = (s) => crypto.createHash('sha256').update(s).digest('base64');

function connect(password) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') return reject(new Error('Node.js terlalu lama — pasang Node.js LTS terbaru (22+) dari nodejs.org'));
    const ws = new WebSocket(`ws://${HOST}:${PORT}`);
    const pending = new Map();
    let id = 0;
    const call = (requestType, requestData = {}) => new Promise((res, rej) => {
      const requestId = String(++id);
      pending.set(requestId, { res, rej, requestType });
      ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
    ws.onerror = () => reject(new Error(`Tak dapat sambung ke OBS di ws://${HOST}:${PORT}. Pastikan OBS terbuka & Tools → WebSocket Server Settings → "Enable WebSocket server" ditanda.`));
    ws.onclose = (e) => { if (e.code === 4009) reject(new Error('Password WebSocket salah.')); };
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.op === 0) { // Hello
        const d = { rpcVersion: 1 };
        const a = msg.d.authentication;
        if (a) {
          if (!password) { ws.close(); return reject(new Error('NEED_PASSWORD')); }
          d.authentication = sha(sha(password + a.salt) + a.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (msg.op === 2) { // Identified
        resolve({ call, close: () => ws.close() });
      } else if (msg.op === 7) { // RequestResponse
        const p = pending.get(msg.d.requestId); if (!p) return;
        pending.delete(msg.d.requestId);
        if (msg.d.requestStatus.result) p.res(msg.d.responseData || {});
        else p.rej(new Error(`${p.requestType}: ${msg.d.requestStatus.comment || msg.d.requestStatus.code}`));
      }
    };
  });
}

async function main() {
  console.log('\n  SISTEM LIVE — setup OBS automatik\n');
  let obs;
  try { obs = await connect(args.password); }
  catch (e) {
    if (e.message !== 'NEED_PASSWORD') throw e;
    console.log('OBS minta password WebSocket (Tools → WebSocket Server Settings → Show Connect Info).');
    obs = await connect(await ask('Password: '));
  }
  console.log('✔ Tersambung ke OBS');

  const { currentProgramSceneName: scene } = await obs.call('GetCurrentProgramScene');
  const { baseWidth, baseHeight } = await obs.call('GetVideoSettings');
  const portrait = baseHeight > baseWidth;
  console.log(`✔ Scene: "${scene}" · kanvas ${baseWidth}×${baseHeight} (${portrait ? 'portrait' : 'landscape'})`);

  // ---- cari source phone / game ----
  const { inputs } = await obs.call('GetInputList');
  let phone = null;
  if (args.source) phone = inputs.find((i) => i.inputName === args.source);
  if (!phone) {
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: scene });
    const inScene = new Set(sceneItems.map((s) => s.sourceName));
    const cands = inputs
      .map((i) => ({ ...i, kind: i.unversionedInputKind || i.inputKind }))
      .filter((i) => VIDEO_KINDS.includes(i.kind) && i.inputName !== OVERLAY)
      .sort((a, b) => (inScene.has(b.inputName) - inScene.has(a.inputName)) || (VIDEO_KINDS.indexOf(a.kind) - VIDEO_KINDS.indexOf(b.kind)));
    if (cands.length === 1) phone = cands[0];
    else if (cands.length > 1) {
      console.log('\nSource video yang dijumpai:');
      cands.forEach((c, i) => console.log(`  ${i + 1}. ${c.inputName}  (${c.kind})${inScene.has(c.inputName) ? '  ← dalam scene ni' : ''}`));
      const n = Number(await ask(`Yang mana skrin phone / game? [1-${cands.length}] (Enter = 1): `) || 1);
      phone = cands[n - 1] || cands[0];
    }
  }
  if (phone) console.log(`✔ Source phone: "${phone.inputName}"`);
  else console.log('! Tiada source video dijumpai — tambah dulu source phone (Video Capture Device / Window Capture) dalam OBS, kemudian jalankan semula.');

  // ---- Browser Source overlay ----
  const w = portrait ? 1080 : 1920, h = portrait ? 1920 : 1080;
  const url = `http://127.0.0.1:8799/overlay.html${portrait ? '' : '?w=1920&h=1080'}`;
  const settings = { url, width: w, height: h, reroute_audio: true, shutdown: false, restart_when_active: false };
  const exists = inputs.some((i) => i.inputName === OVERLAY);
  let itemId;
  if (exists) {
    await obs.call('SetInputSettings', { inputName: OVERLAY, inputSettings: settings });
    try { ({ sceneItemId: itemId } = await obs.call('GetSceneItemId', { sceneName: scene, sourceName: OVERLAY })); }
    catch { ({ sceneItemId: itemId } = await obs.call('CreateSceneItem', { sceneName: scene, sourceName: OVERLAY })); }
    console.log('✔ Browser Source overlay dikemas kini');
  } else {
    ({ sceneItemId: itemId } = await obs.call('CreateInput', { sceneName: scene, inputName: OVERLAY, inputKind: 'browser_source', inputSettings: settings, sceneItemEnabled: true }));
    console.log('✔ Browser Source overlay ditambah');
  }
  // penuhkan kanvas & letak paling atas
  await obs.call('SetSceneItemTransform', { sceneName: scene, sceneItemId: itemId, sceneItemTransform: {
    positionX: 0, positionY: 0, rotation: 0, alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0, boundsWidth: baseWidth, boundsHeight: baseHeight,
  } });
  const { sceneItems: items } = await obs.call('GetSceneItemList', { sceneName: scene });
  await obs.call('SetSceneItemIndex', { sceneName: scene, sceneItemId: itemId, sceneItemIndex: items.length - 1 });
  await obs.call('SetSceneItemEnabled', { sceneName: scene, sceneItemId: itemId, sceneItemEnabled: true });
  console.log(`✔ Overlay ${w}×${h}, penuh kanvas, paling atas`);

  // ---- Windowed Projector untuk Auto Detect ----
  if (phone) {
    try {
      await obs.call('OpenSourceProjector', { sourceName: phone.inputName, monitorIndex: -1 });
      console.log(`✔ Windowed Projector dibuka: "${phone.inputName}"`);
    } catch (e) {
      console.log(`! Tak dapat buka projector automatik (${e.message}). Buat manual: klik kanan "${phone.inputName}" → Windowed Projector (Source).`);
    }
  }
  obs.close();

  console.log(`
  SIAP! Langkah terakhir (sekali sahaja):
   1. Dalam tab Auto Detect (http://127.0.0.1:8799/auto.html) tekan "Tangkap tetingkap / skrin"
   2. Pilih tab "Window" → "Windowed Projector (Source) - ${phone ? phone.inputName : '<source phone>'}"
   3. Isi IGN & hero utama. Jangan minimize tetingkap projector (boleh letak di belakang).
`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n✖ ' + e.message + '\n'); process.exit(1); });
