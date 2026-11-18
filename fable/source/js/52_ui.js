// Interface do jogo aberto por uma pessoa (GAME.ui): tela de início, pausa, benchmark, volta roteirizada para assistir,
// poses, teclas de ferramenta e leitura do controle. Nas ferramentas de trabalho/ (captura, poses, teste, medição) nada
// disto é ligado: sem menu, sem painel, sem som.
const ST = { INICIO: 0, JOGO: 1, PAUSA: 2, BENCH: 3, FITA: 4, RESULT: 5, POSE: 6 };
const UI = { st: ST.INICIO, back: ST.JOGO, el: null, tag: null, res: null, b0: null, b1: null, bench: null, benchN: 0, padPrev: 0, padN: 0, pose: -1, stats: false, warm: false, car: 0, sub: null, tagT: 0 };
const $ = id => document.getElementById(id);
function uiInit() {
  UI.el = $('ui'); UI.tag = $('tag'); UI.res = $('res'); UI.b0 = $('b0'); UI.b1 = $('b1');
  hudInit(); mmInit(); uiWarmup();
  UI.sub = document.querySelector('#ui .sub'); UI.car = GS.car; uiUse(GS.car);
  UI.b0.onclick = () => { if (UI.st === ST.INICIO) { sndStart(); uiSet(ST.JOGO); } else uiResume(); };
  UI.b1.onclick = () => benchStart(); if (TRK.map) UI.b1.style.visibility = 'hidden';
  addEventListener('keydown', uiKey);
  addEventListener('keyup', e => { if ((e.code === 'ArrowDown' && FLYIN[0] > 0) || (e.code === 'ArrowUp' && FLYIN[0] < 0)) FLYIN[0] = 0; });
  addEventListener('blur', () => { FLYIN[0] = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (UI.st === ST.JOGO || UI.st === ST.FITA || UI.st === ST.BENCH)) uiPause(); });
  addEventListener('gamepadconnected', padCount); addEventListener('gamepaddisconnected', padCount);
  const h = $('hint'); if (h) h.style.display = 'none';
  uiSet(ST.INICIO);
}
// troca de estado: mostra/esconde menu, painel e etiqueta, pausa/retoma o som
function uiSet(st) {
  const menu = st === ST.INICIO || st === ST.PAUSA || st === ST.RESULT;
  UI.st = st; UI.el.style.display = menu ? 'flex' : 'none'; UI.el.className = st === ST.INICIO ? 'ini' : '';
  UI.b0.textContent = st === ST.INICIO ? 'Começar' : st === ST.RESULT ? 'Voltar a dirigir' : 'Continuar';
  UI.b1.style.display = st === ST.INICIO ? 'none' : ''; UI.b1.textContent = st === ST.RESULT ? 'Repetir benchmark' : 'Benchmark';
  UI.res.style.display = st === ST.RESULT ? 'block' : 'none';
  UI.tag.textContent = st === ST.BENCH ? 'Benchmark: volta roteirizada de 60 s · Esc cancela' : st === ST.FITA ? 'Volta roteirizada · R assume o volante · Esc menu' : st === ST.POSE ? 'Pose ' + (UI.pose + 1) + ' · ' + POSES[UI.pose].nome + ' · 1 a 6 trocam · Esc volta a dirigir' : '';
  UI.tag.style.display = UI.tag.textContent ? 'block' : 'none';
  hudShow(st === ST.JOGO || st === ST.FITA || (st === ST.PAUSA && UI.back !== ST.BENCH)); MM.el.style.display = HUD.vis ? 'block' : 'none';
  sndRun(st === ST.JOGO || st === ST.FITA || st === ST.BENCH);
  if (menu) UI.b0.focus(); else UI.b0.blur();
  _lastT = 0;
}
// melhor volta guardada por carro (a do Uno fica na chave antiga)
function uiBestKey(i) { return (i ? 'uno-melhor-' + CARDEFS[i].id : 'uno-melhor') + (TRK.map ? '-mapa' + TRK.map : ''); }
// tecla P: troca de mapa. O cenário inteiro é gerado na carga, então a página recarrega com o outro mapa e o mesmo carro.
function uiMapNext() { setMsg('carregando ' + MAPS[(TRK.map + 1) % MAPS.length] + '…'); location.search = '?mapa=' + (TRK.map + 1) % MAPS.length + (UI.car ? '&car=' + UI.car : ''); }
// põe o carro i em uso, com a melhor volta dele (sem armazenamento local, ela vale só enquanto o carro não é trocado)
function uiUse(i) {
  if (GS.replayOn || UI.st === ST.INICIO) { VEH.fly = 0; FLYIN[0] = 0; }
  gameSetCar(i); LAP[2] = 0;
  try { const b = +localStorage.getItem(uiBestKey(i)); if (b > 20 && b < 600) LAP[2] = b; } catch (e) { /* sem armazenamento local */ }
  if (UI.sub) UI.sub.textContent = CARDEFS[i].nome + ' · ' + MAPS[TRK.map];
}
// tecla Y / LB: passa para o carro seguinte, no lugar e na velocidade em que o atual está; a volta em andamento não conta
function uiCarNext() {
  UI.car = (GS.car + 1) % CARDEFS.length; uiUse(UI.car); LAP[1] = 0; LAP[3] = 0;
  const D = CARDEFS[UI.car]; UI.tag.textContent = D.nome + ' · ' + D.tracao; UI.tag.style.display = 'block';
  clearTimeout(UI.tagT); UI.tagT = setTimeout(() => { if (UI.st === ST.JOGO) { UI.tag.textContent = ''; UI.tag.style.display = 'none'; } }, 2800);
}
// ↑ ↓: ajuste da física em tempo real, só nos carros extras (o Uno fica como foi gravado na volta roteirizada).
// Ajusta a tração em curva (VP.tc, fração da aderência traseira que o motor pode usar em curva; 1 = sem limite).
// Vale na hora e fica até recarregar a página. O freio não tem ajuste: a distribuição segue a carga de cada roda.
function uiTune(d) {
  const i = GS.car, P = VCARS[i]; let t;
  if (!i) t = 'Ajuste de física só no Chevette · Y troca de carro';
  else {
    P.tc = VP.tc = Math.round(Math.min(1, Math.max(0.3, P.tc + d * 0.02)) * 100) / 100;
    t = 'Tração em curva ' + P.tc.toFixed(2).replace('.', ',') + (P.tc >= 1 ? ' (sem limite)' : '') + '  ·  ↑ ↓ ajustam';
  }
  UI.tag.textContent = t; UI.tag.style.display = 'block';
  clearTimeout(UI.tagT); UI.tagT = setTimeout(() => { if (UI.st === ST.JOGO) { UI.tag.textContent = ''; UI.tag.style.display = 'none'; } }, 3500);
}
// Backspace: modo voador. A volta em andamento deixa de contar; no ar as setas ↑ ↓ são o manche (e não ajustam a tração).
function uiFly(on) {
  VEH.fly = on ? 1 : 0; FLYIN[0] = 0; if (on) LAP[3] = 0;
  uiTag(on ? 'Carro voador ligado · acelere e segure ↓ para subir · ↑ desce · Backspace desliga' : 'Carro voador desligado', 4500);
}
function uiTag(t, ms) {
  UI.tag.textContent = t; UI.tag.style.display = 'block';
  clearTimeout(UI.tagT); UI.tagT = setTimeout(() => { if (UI.st === ST.JOGO) { UI.tag.textContent = ''; UI.tag.style.display = 'none'; } }, ms);
}
// Minimapa (canto inferior esquerdo): o traçado desenhado uma vez num canvas e um ponto, movido por CSS, na posição do carro.
const MM = { el: null, dot: null, sc: 1, ox: 0, oz: 0, px: -1, py: -1 };
function mmInit() {
  const c = $('mmc'), S = Math.round(Math.min(innerHeight * 0.27, 280)), dpr = 2, pad = 12; MM.el = $('mm'); MM.dot = $('mmd');
  const w = TRK.bx1 - TRK.bx0, h = TRK.bz1 - TRK.bz0, sc = MM.sc = (S - 2 * pad) / Math.max(w, h), W = Math.ceil(w * sc + 2 * pad), H = Math.ceil(h * sc + 2 * pad);
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; MM.ox = pad - TRK.bx0 * sc; MM.oz = pad - TRK.bz0 * sc;
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineJoin = g.lineCap = 'round';
  const path = () => { g.beginPath(); for (let i = 0; i < TRK.N; i += 3) { const x = TRK.x[i] * sc + MM.ox, y = TRK.z[i] * sc + MM.oz; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); };
  path(); g.strokeStyle = 'rgba(9,11,14,.72)'; g.lineWidth = 7; g.stroke(); path(); g.strokeStyle = '#fff'; g.lineWidth = 2.4; g.stroke();
  const x0 = TRK.x[0] * sc + MM.ox, y0 = TRK.z[0] * sc + MM.oz, nx = -TRK.tz[0] * 6, ny = TRK.tx[0] * 6;   // linha de largada
  g.beginPath(); g.moveTo(x0 - nx, y0 - ny); g.lineTo(x0 + nx, y0 + ny); g.strokeStyle = '#ff5a36'; g.lineWidth = 3; g.stroke();
}
function mmFrame() {
  const x = Math.round(VEH.x * MM.sc + MM.ox), y = Math.round(VEH.z * MM.sc + MM.oz);
  if (x !== MM.px || y !== MM.py) { MM.px = x; MM.py = y; MM.dot.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
}
function uiPause() { if (UI.st === ST.BENCH) benchStop(); UI.back = UI.st === ST.FITA ? ST.FITA : ST.JOGO; uiSet(ST.PAUSA); }
function uiResume() {
  if (UI.st === ST.RESULT || UI.st === ST.POSE) uiDrive(); else if (UI.st === ST.PAUSA) uiSet(UI.back);
}
// volta ao volante: carro no grid, câmeras e simulação soltas
function uiDrive() { GS.frozen = false; GS.freeCam = false; GS.replayOn = false; uiUse(UI.car); gameRestart(); uiSet(ST.JOGO); }
function uiReplay() { if (!GS.replay) return; GS.frozen = false; GS.freeCam = false; GS.replayOn = true; uiUse(0); gameRestart(); uiSet(ST.FITA); }
function uiPose(i) { if (UI.st === ST.BENCH) benchStop(); UI.pose = i; VEH.fly = 0; FLYIN[0] = 0; uiUse(POSES[i].tipo === 'volta' ? 0 : UI.car); poseApply(i); GS.replayOn = false; uiSet(ST.POSE); }
function uiKey(e) {
  if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && UI.st === ST.JOGO && VEH.fly) { FLYIN[0] = e.code === 'ArrowDown' ? 1 : -1; e.preventDefault(); return; }   // voando: ↓ sobe, ↑ desce
  if (e.code === 'Backspace' && UI.st === ST.JOGO && !e.repeat) { uiFly(!VEH.fly); e.preventDefault(); return; }
  if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && UI.st === ST.JOGO && !e.ctrlKey && !e.metaKey && !e.altKey) { uiTune(e.code === 'ArrowUp' ? 1 : -1); e.preventDefault(); return; }
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const c = e.code, st = UI.st;
  if (c === 'KeyM') { sndMute(!SND.mute); return; }
  if (c === 'KeyH') { UI.stats = !UI.stats; hudStats(UI.stats); if (st !== ST.BENCH) perfAttach(UI.stats, 12); return; }
  if (st === ST.INICIO) return;                                   // na tela de início só o botão começa o jogo (e o som)
  if (c === 'KeyP') { uiMapNext(); return; }
  if (TRK.map && (c === 'KeyB' || c === 'KeyF' || c.startsWith('Digit'))) { if (st === ST.JOGO) uiTag('Benchmark, volta roteirizada e poses só no circuito Serra da Mata · P troca de mapa', 3500); return; }
  if (c === 'Escape') { if (st === ST.JOGO || st === ST.FITA || st === ST.BENCH) uiPause(); else uiResume(); e.preventDefault(); }
  else if (c === 'KeyB') benchStart();
  else if (c === 'KeyF') uiReplay();
  else if (c === 'KeyR' && st === ST.FITA) uiDrive();
  else if (c === 'KeyY' && st === ST.JOGO) uiCarNext();
  else if (c.length === 6 && c.startsWith('Digit') && c[5] >= '1' && c[5] <= '6') uiPose(+c[5] - 1);
}
// ---- benchmark: a volta roteirizada de 60 s em tempo real, sem painel, medindo tempo de quadro e (se houver) tempo de GPU
function benchStart() {
  if (!GS.replay || UI.st === ST.INICIO) return;
  GS.frozen = false; GS.freeCam = false; GS.replayOn = true; uiUse(0); gameRestart(); UI.bench = null; UI.benchN++; UI.res.innerHTML = '<h2>Benchmark · calculando…</h2>';
  perfAttach(true, 1); perfStart(); uiSet(ST.BENCH);
}
function benchStop() { PERF.rec = false; perfAttach(UI.stats, 12); GS.replayOn = false; }
function benchEnd() {
  const id = UI.benchN; PERF.rec = false; uiSet(ST.RESULT);
  setTimeout(() => {   // espera as últimas leituras de tempo de GPU chegarem
    if (id !== UI.benchN || UI.st !== ST.RESULT) return;
    const r = perfReport(), stat = a => { a = a.slice(5).filter(x => x > 0).sort((p, q) => p - q); const n = a.length; return n ? { n, media: a.reduce((p, q) => p + q, 0) / n, p99: a[Math.min(n - 1, Math.round(0.99 * (n - 1)))], max: a[n - 1], acima: a.filter(x => Math.round(x * 10) > 167).length } : null; };   // acima: quadros que passaram de 16,7 ms (na resolução de 0,1 ms do relógio)
    const q = stat(r.raf), g = PERF.qs ? stat(r.gpu) : null, f = x => x.toFixed(2).replace('.', ',');
    benchStop(); gameRestart();
    UI.bench = { quadros: r.n, quadro_ms: q, gpu_ms: g, fps: q ? 1000 / q.media : 0, acima_16_7: q ? q.acima : 0, gpu_acima_16_7: g ? g.acima : null, tick: 3600, resolucao: G.W + '×' + G.H };
    const row = (n, s) => '<tr><th>' + n + '</th>' + (s ? '<td>' + f(s.media) + '</td><td>' + f(s.p99) + '</td><td>' + f(s.max) + '</td>' : '<td colspan=3>indisponível neste navegador</td>') + '</tr>';
    UI.res.innerHTML = '<h2>Benchmark · volta roteirizada de 60 s · ' + G.W + '×' + G.H + '</h2><table><tr><th></th><th>média (ms)</th><th>percentil 99 (ms)</th><th>máximo (ms)</th></tr>' + row('Tempo de quadro', q) + row('Tempo de GPU', g) + '</table>' +
      '<p>' + (q ? q.acima + ' de ' + q.n + ' quadros passaram de 16,7 ms de intervalo' + (g ? ' · ' + g.acima + ' passaram de 16,7 ms de GPU' : '') + ' · ' + f(1000 / q.media) + ' quadros por segundo' : '') + '</p>';
  }, 400);
}
// ---- controle (Gamepad API, layout padrão). Só é consultado enquanto houver um controle ligado.
function padCount() { let n = 0; const l = navigator.getGamepads ? navigator.getGamepads() : []; for (let i = 0; i < l.length; i++) if (l[i] && l[i].connected) n++; UI.padN = n; if (!n) { GS.padKeys = 0; UI.padPrev = 0; } }
// A API devolve um retrato novo dos controles a cada consulta (vetor e números criados pelo navegador): fica isolado aqui.
const PADR = new Float64Array(3), PADB = new Int32Array(1);
function apiGamepad() {
  const l = navigator.getGamepads(); let p = null;
  for (let i = 0; i < l.length; i++) { const g = l[i]; if (g && g.connected && (!p || (g.mapping === 'standard' && p.mapping !== 'standard'))) p = g; }
  if (!p) { PADB[0] = -1; return; }
  const b = p.buttons, n = b.length; let m = 0; for (let i = 0; i < n && i < 16; i++) if (b[i].pressed) m |= 1 << i;
  PADB[0] = m; PADR[0] = n > 7 ? b[7].value : 0; PADR[1] = n > 6 ? b[6].value : 0; PADR[2] = p.axes.length ? p.axes[0] : 0;
}
// traduz a leitura do controle (PADB, PADR) para as mesmas teclas do jogo + valores analógicos (PADV)
function padPoll() { apiGamepad(); padApply(); }
function padApply() {
  const m = PADB[0]; if (m < 0) { GS.padKeys = 0; return; }
  let k = K_PAD | K_PADS, x = PADR[2]; const rt = PADR[0], lt = PADR[1], ax = x < 0 ? -x : x;
  PADV[0] = rt < 0.04 ? 0 : rt; PADV[1] = lt < 0.04 ? 0 : lt;
  if (ax < 0.12) x = 0; else { const u = (ax - 0.12) / 0.88; x = (x < 0 ? -1 : 1) * u * (0.45 + 0.55 * u); }   // zona morta + curva suave no centro
  PADV[2] = x;
  if (rt > 0.06) k |= K_W; if (lt > 0.06) k |= K_S;
  if (m & 1) k |= K_SPACE; if (m & 8) k |= K_C; if (m & 4) k |= K_R; if (m & 32) k |= K_V;
  GS.padKeys = k;
  const edge = m & ~UI.padPrev; UI.padPrev = m;
  if (edge & 532) padMenu(edge);
}
// botões de menu do controle, na borda: Start abre/fecha o menu; X assume o volante durante a volta roteirizada; LB troca de carro
function padMenu(edge) {
  if (UI.warm) return;
  if (edge & 16) { if (UI.st === ST.JOGO) uiCarNext(); return; }
  if (edge & 512) { if (UI.st === ST.JOGO || UI.st === ST.FITA || UI.st === ST.BENCH) uiPause(); else if (UI.st !== ST.INICIO) uiResume(); }
  else if (UI.st === ST.FITA) uiDrive();
}
// Aquece o JIT das funções novas que rodam uma vez por quadro (controle, painel, estatísticas): são baratas, e sem isto o V8
// levaria dezenas de segundos de jogo para otimizá-las — rodando até lá no interpretador, que aloca a cada conta.
// (A parte do som que lê a simulação, sndControl, é aquecida junto com a física em gameWarmup.)
function uiWarmup() {
  const H = HUD, g = H.g, t = H.t, s = H.s, sc = document.createElement('canvas'); sc.width = sc.height = 4; const x = sc.getContext('2d'), V = H.V, rt3 = RT[3];
  const po = PERF.on; UI.warm = true; H.g = H.t = H.s = x; PERF.on = true;
  for (let i = 0; i < 6000; i++) {
    PADB[0] = i % 97 === 0 ? -1 : (i * 7919) & 0xffff; PADR[0] = (i % 50) / 49; PADR[1] = (i % 31) / 60; PADR[2] = Math.sin(i * 0.7); padApply();
    if (i % 2) continue;
    V[0] = (i * 7) % 2100; V[1] = (i * 13) % 7400; V[2] = i % 6; V[3] = (i * 331) % 70000; V[4] = i % 5 ? (i * 17) % 9000 : -1; V[5] = i % 3 ? (i * 19) % 9000 : -1; hudDraw(); hudRead();
    RT[3] = 300 + i % 300; PERF.live[0] = i % 4 ? i % 40 : 0; hudStatsFrame();
  }
  H.g = g; H.t = t; H.s = s; H.K.fill(-9); H.acc.fill(0); RT[3] = rt3; PERF.live[0] = 0; GS.padKeys = 0; UI.padPrev = 0; PADB[0] = -1; PERF.on = po; UI.warm = false;
}
// chamado no começo de cada quadro; devolve true quando o jogo está parado num menu (não simula nem renderiza)
function uiFrame() {
  if (UI.padN) padPoll();
  const st = UI.st;
  return st === ST.INICIO || st === ST.PAUSA || st === ST.RESULT || st === ST.POSE;
}
// chamado depois de simular e renderizar o quadro
function uiAfter() {
  const st = UI.st;
  if (st === ST.BENCH) { if (GS.tick60 >= 3600) benchEnd(); }
  else {
    if (st === ST.FITA && GS.tick60 >= GS.replay.length) { GS.replayOn = false; uiUse(UI.car); uiSet(ST.JOGO); }
    if (HUD.vis) { hudFrame(); mmFrame(); }
    if (GS.lapNew) { GS.lapNew = false; try { localStorage.setItem(uiBestKey(GS.car), LAP[2].toFixed(3)); } catch (e) { /* idem */ } }
  }
  if (HUD.stats) hudStatsFrame();
  sndFrame();
}
