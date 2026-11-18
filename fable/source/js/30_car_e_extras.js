// Carros extras (tecla Y troca): cada um redefine o perfil, a planta, as janelas e as luzes da mesma pele paramétrica do Uno
// (30_car_a_shape.js consulta CK) e monta carroceria e peças com os construtores genéricos daqui.
// CARDEFS[0] é o Uno, com os números originais; para acrescentar um carro basta outra definição nesta lista
// (mais a física em VCARS, 40_vehicle.js, e a cor em mat_car.wgsl).
const CARDEFS = [{
  id: 'uno', nome: 'Fiat Uno Mille EP 1996', tracao: 'tração dianteira', ck: null, cs: Object.assign({}, CS),
  hubs: [[1.181, 0.281, -0.67], [1.181, 0.281, 0.67], [-1.181, 0.281, -0.65], [-1.181, 0.281, 0.65]],
  paint: [0.168, 0.275, 0.425], dx: 0, dy: 0, rs: 0, ao: [1.72, 0.07, 1.181], rearCam: -2.0,
}];

// ---------- genéricos de forma (usados quando CK != null) ----------
// janelas laterais: q = 0 porta, 1 vidro traseiro lateral
function carWinG(P, q) {
  const W = CK.win, x = P[0], y = P[1];
  const bottom = (carBeltN(x) + 0.014) - y, top = y - (carRoofEdgeY(x) - 0.04);
  let front, rear;
  if (!q) { front = W.ao - ((x - CW.apx) * CW.anx + (y - CW.apy) * CW.any); rear = (W.dr - 0.04 * (y - 0.95)) - x; }
  else { front = x - (W.qf - 0.04 * (y - 0.95)); rear = Math.max(W.co - ((x - CW.cpx) * CW.cnx + (y - CW.cpy) * CW.cny), (W.qr + W.qs * (y - 0.95)) - x); }
  return csmax(csmax(bottom, top, 0.03), csmax(front, rear, 0.03), 0.035);
}
// para-brisa (r = 0) e vidro traseiro (r = 1)
function carGlassG(P, r) {
  const G = CK.glass, st = carStation(P[0]);
  if (!r) { const xe = carXe(P); return P[0] < G.wsMin ? 1 : csmax(csmax(xe - G.ws1, G.ws0 - xe, 0.03), P[2] - (st.zE - 0.047), 0.06); }
  return P[0] > G.rwMax ? 1 : csmax(csmax(G.ry0 - P[1], P[1] - G.ry1, 0.03), P[2] - (st.zE - 0.072), 0.06);
}
function carSeamDoorG() {
  const S = CK.seam, p = [[S.xf, 0.215], [S.xf, S.yb], [S.xf - 0.018, S.yb + 0.03]];
  for (let x = S.xf - 0.08; x >= S.xr + 0.008; x -= 0.045) p.push([x, carStation(x).yE - (x > S.xa ? 0.03 : 0.024)]);
  p.push([S.xr, carStation(S.xr).yE - 0.024]); p.push([S.xr, 0.215]); p.push([S.xf, 0.215]);
  return p;
}
// capô e tampa do porta-malas (distância assinada, negativa dentro)
function carSeamTopG(P) {
  const S = CK.seam, x = P[0], z = P[2], st = carStation(x);
  if (x > 0.3) { const xe = carXe(P); return Math.max(z - (st.zE - 0.058), S.h0 - xe, xe - S.h1); }
  if (x < S.t0 + 0.2) return Math.max(z - (st.zE - 0.07), x - S.t0, S.t1 - x);
  return 1;
}

// ---------- Chevrolet Chevette SL 1987 (sedã 2 portas, três volumes, tração traseira) ----------
const CHV = {
  yt(x) {
    const hood = 0.905 - 0.10 * (x - 0.62) + 0.008 * (1 - csq((x - 1.25) / 0.63));
    const wind = 0.905 - 0.80 * (x - 0.62);
    const a = x + 0.22, roof = 1.318 - (a > 0 ? 0.20 * a * a : 0.07 * a * a) + (x > 0.1 ? 6 * csq(x - 0.1) : 0);
    const back = 0.915 + 0.74 * (x + 1.42), deck = 0.915 + 0.04 * (x + 1.42);
    const tail = 0.89 + 9 * (x + 2.01), fascia = 0.775 - 9 * (x - 1.875);
    let y = csmax(hood, wind, 0.02);
    y = csmin(y, roof, 0.035); y = csmin(y, csmax(back, deck, 0.05), 0.06); y = csmin(y, tail, 0.04); y = csmin(y, fascia, 0.04);
    return y;
  },
  // frente e traseira retas em planta: a face desce inteira até a saia
  bulge(x) { return 0.045 * smooth(-0.2, 0.2, x) * smooth(1.75, 1.35, x) - 0.03 * smooth(-0.45, -0.75, x) * smooth(-1.95, -1.6, x); },
  crown(x) { return 0.03 * smooth(0.6, 0.9, x) * smooth(1.86, 1.76, x) + 0.035 * smooth(0.15, -0.1, x) * smooth(-0.95, -0.7, x) + 0.015 * smooth(-1.42, -1.55, x) * smooth(-2.0, -1.9, x); },
  wplan(x) { const t = sat((x - 0.6) / 1.3), t2 = sat((-0.9 - x) / 1.15); return 0.785 - 0.07 * t * t - 0.06 * t2 * t2; },
  zl(x, y) {
    let z = CHV.wplan(x);
    const d = y - 0.60; z -= d < 0 ? 0.042 * csq(d / 0.40) : 0.03 * csq(d / 0.30);
    if (y < 0.25) z -= 0.03 * csq((0.25 - y) / 0.06);
    const da = Math.min(Math.hypot(x - CS.AXF, y - CS.ARCH_Y), Math.hypot(x - CS.AXR, y - CS.ARCH_Y)) - CS.ARCH_R;
    if (da < 0.3) z += 0.004 * Math.exp(-csq((da - 0.01) / 0.1));   // lábio das caixas de roda
    return z;
  },
  belt(x) { return 0.875 + 0.006 * (0.6 - x); },
  r2(x) {
    let r = 0.04;
    r = lerp(r, 0.024, smooth(-0.1, 0.15, x));       // coluna A
    r = lerp(r, 0.03, smooth(0.55, 0.75, x));        // ombro do para-lama
    r = lerp(r, 0.045, smooth(1.72, 1.82, x));       // canto dianteiro
    r = lerp(r, 0.03, smooth(-0.85, -1.0, x));       // coluna C
    r = lerp(r, 0.035, smooth(-1.38, -1.5, x));      // ombro do porta-malas
    r = lerp(r, 0.05, smooth(-1.9, -1.98, x));       // canto traseiro
    return r;
  },
  // coluna C larga: o vidro lateral termina numa borda mais em pé (qr, qs) e sobra espaço para a grade de ventilação preta
  win: { a0: 0.50, a1: 0.22, c0: -1.02, c1: -1.28, re0: -0.86, re1: 0.08, ao: 0.062, dr: -0.42, qf: -0.50, co: 0.1, qr: -0.99, qs: 0.7 },
  glass: { wsMin: 0, ws0: 0.21, ws1: 0.598, rwMax: -0.75, ry0: 0.955, ry1: 1.235 },
  seam: { xf: 0.68, xr: -0.44, xa: 0.1, yb: 0.873, h0: 0.69, h1: 1.80, t0: -1.48, t1: -1.97 },
  hl: [0.40, 0.625, 0.665, 0.052],                               // farol retangular: z0, z1, y do centro, meia altura
  headlight(P) { return carRRect(P[2] - 0.5125, P[1] - 0.665, 0.1125, 0.052, 0.012); },
  clZ: 0.632,                                                    // pisca âmbar ao lado do farol, dobrando a quina
  grille(P) { return carRRect(P[2], P[1] - 0.665, 0.385, 0.045, 0.008); },
  tl: [0.47, 0.69, 0.60, 0.84],                                  // lanterna alta de três faixas: z0, z1, y0, y1
  tail(P) { return Math.max(carRRect(P[2] - 0.58, P[1] - 0.72, 0.11, 0.12, 0.012), P[0] - (CS.XR + 0.2)); },
  // trechos da pele (x da frente para trás) onde ficam os recortes
  rg: { door: [0.70, -0.46], quarter: [-0.46, -1.5], ws: [0.72, 0.05], rw: [-0.82, -1.5], inner: [0.75, -1.5] },
  cowl: 0.62, wheel: 1,
};
CARDEFS.push({
  id: 'chevette', nome: 'Chevrolet Chevette SL 1987', tracao: 'tração traseira', ck: CHV,
  cs: { XF: 1.933, XR: -2.08, YS: 0.19, AXF: 1.1975, AXR: -1.1975, WR: 0.281, TH_S: Math.sin(24 * PI / 180), TH_C: Math.cos(24 * PI / 180), VF: CS.VF, ARCH_R: 0.318, ARCH_Y: 0.295 },
  hubs: [[1.1975, 0.281, -0.665], [1.1975, 0.281, 0.665], [-1.1975, 0.281, -0.66], [-1.1975, 0.281, 0.66]],
  paint: [0.46, 0.028, 0.022], dx: -0.052, dy: -0.07, rs: 0.04, ao: [2.06, -0.07, 1.1975], rearCam: -2.4,
});

// prepara a pele para o carro D (constantes, tabela de comprimento de arco, linhas das colunas, junções)
function carUse(D) { CK = D.ck; Object.assign(CS, D.cs); carShapeInit(); carWindowsInit(); carSeamInit(); }
// constrói as malhas do carro i: carroceria (mb), vidros (gl), roda (w) e disco de borrão da roda (wb; só o Uno usa)
function carBuildCar(i, mb, gl, w, wb) {
  const D = CARDEFS[i]; carUse(D);
  if (!D.ck) { carBuildBody(mb, gl); carBuildParts(mb, gl); carBuildWheel(w, wb); }
  else { carBuildBodyG(mb, gl, D); carBuildPartsG(mb, gl, D); carBuildWheel(w, null, D.ck.wheel); }
  carUse(CARDEFS[0]);
}

// ---------- carroceria genérica ----------
function carBuildBodyG(mb, gl, D) {
  const K = D.ck, rg = K.rg, xf = CS.XF, xr = CS.XR, hl = K.hl;
  const seamUV = (u, v, P) => { _cuv[0] = carSeam(P, v); _cuv[1] = v; return _cuv; };
  const plainUV = (u, v, P) => { _cuv[0] = 1; _cuv[1] = v; return _cuv; };
  const v0 = mb.nv, i0 = mb.ni, gv0 = gl.nv, gi0 = gl.ni;
  // pintura: a pele inteira (a saia sob os para-choques é pintada), com os recortes de rodas, vidros, faróis e grade
  const paintField = (u, v, P) => {
    let f = 1;
    if (v < 0.42) f = carArchF(P);
    else if (v < 0.66) f = Math.min(carWinDoor(P), carWinQuarter(P));
    if (v > 0.6) { f = Math.min(f, carWindshield(P), carHatchGlass(P)); if (P[0] > xf - 0.28) f = Math.min(f, carHeadlight(P), carGrille(P)); }
    return -f;
  };
  const VS = 64 / 152;
  mb.mat(CM.PAINT).color(1, 1, 1);
  mb.patch(carSkinFn(0), 0, 1, 0, VS, { nu: 400, nv: 64, flip: true, uv: seamUV, rim: 0.016, rimMat: m => m.mat(CM.PAINT, 255), field: paintField });
  mb.mat(CM.PAINT).color(1, 1, 1);
  mb.patch(carSkinFn(0), 0, 1, VS, 1, { nu: 400, nv: 100, flip: true, uv: seamUV, rim: 0.016, rimMat: m => m.mat(CM.RUBBER).color(0.018, 0.018, 0.02), field: paintField });
  const band = (fn, a, b) => (u, v, P) => { const f = fn(P, v); return Math.max(f - b, a - f); };
  // frisos cromados em volta das janelas laterais
  mb.mat(CM.CHROME, 1).color(0.82, 0.83, 0.85);
  carSub(mb, 0.002, rg.door[0], rg.door[1], 0.40, 0.64, 0.012, { field: band(carWinDoor, -0.007, 0.003), uv: plainUV });
  carSub(mb, 0.002, rg.quarter[0], rg.quarter[1], 0.40, 0.64, 0.012, { field: band(carWinQuarter, -0.007, 0.003), uv: plainUV });
  // borrachas do para-brisa, do vidro traseiro e dos faróis
  mb.mat(CM.RUBBER).color(0.02, 0.02, 0.02);
  carSub(mb, 0.0015, rg.ws[0], rg.ws[1], 0.60, 1, 0.012, { field: band(carWindshield, -0.014, 0.004), uv: plainUV });
  carSub(mb, 0.0015, rg.rw[0], rg.rw[1], 0.60, 1, 0.012, { field: band(carHatchGlass, -0.014, 0.004), uv: plainUV });
  carSub(mb, 0.0012, xf - 0.004, xf - 0.2, 0.62, 1, 0.006, { field: band(carHeadlight, -0.0035, 0.003), uv: plainUV });
  // grade de ventilação preta na coluna C (faixa inclinada, paralela à borda traseira do vidro lateral)
  mb.mat(CM.GRILLE).color(0.03, 0.03, 0.032);
  carSub(mb, 0.003, -0.7, -1.45, 0.40, 0.64, 0.008, { field: (u, v, P) => { const W = K.win, dc = (W.qr + W.qs * (P[1] - 0.95)) - P[0]; return Math.max(carRRect(dc - 0.1, 0, 0.055, 1, 0.01), carBeltN(P[0]) + 0.075 - P[1], P[1] - 1.14); }, uv: plainUV, rim: 0.003 });
  // pisca âmbar ao lado do farol, dobrando a quina
  mb.mat(CM.LENS, 2).color(0.62, 0.3, 0.05);
  const clX = carTopX(K.clZ, hl[2], false) - 0.04;
  carSub(mb, 0.002, xf - 0.004, xf - 0.2, 0.25, 0.86, 0.006, { field: (u, v, P) => Math.max(Math.abs(P[1] - hl[2]) - hl[3], v > 0.64 ? K.clZ - P[2] : clX - P[0]), uv: (u, v, P) => { _cuv[0] = P[0] + P[2]; _cuv[1] = P[1]; return _cuv; }, rim: 0.004 });
  // lanternas traseiras (lente rente à carroceria)
  const tl = K.tl;
  mb.mat(CM.LENS, 1).color(0.75, 0.03, 0.02);
  carSub(mb, 0.0025, xr + 0.2, xr + 0.004, 0.60, 1, 0.007, { field: (u, v, P) => carTailLamp(P, v) - 0.003, uv: (u, v, P) => { _cuv[0] = (P[2] - tl[0]) / (tl[1] - tl[0]); _cuv[1] = (P[1] - tl[2]) / (tl[3] - tl[2]); return _cuv; }, rim: 0.0025 });
  // maçaneta preta
  mb.mat(CM.PLASTIC).color(0.03, 0.03, 0.03);
  carSub(mb, 0.008, K.seam.xr + 0.2, K.seam.xr + 0.02, 0.2, 0.40, 0.005, { field: (u, v, P) => carRRect(P[0] - (K.seam.xr + 0.1), P[1] - (K.seam.yb - 0.075), 0.055, 0.016, 0.006), uv: plainUV, rim: 0.007 });
  // fundo da grade (palhetas pretas)
  mb.mat(CM.GRILLE).color(0.012, 0.012, 0.013);
  carSub(mb, -0.024, xf - 0.004, xf - 0.2, 0.62, 1, 0.012, { field: (u, v, P) => carGrille(P) - 0.016, uv: plainUV });
  // forro interno (visto pelos vidros): laterais escuras, teto claro
  const inner = (u, v, P) => -(Math.min(carWinDoor(P), carWinQuarter(P), v > 0.55 ? Math.min(carWindshield(P), carHatchGlass(P)) : 1) - 0.014);
  mb.mat(CM.INTERIOR).color(0.075, 0.078, 0.085);
  carSub(mb, -0.03, rg.inner[0], rg.inner[1], 0.03, 0.60, 0.026, { field: inner, uv: plainUV, flip: false });
  mb.mat(CM.INTERIOR, 1).color(0.2, 0.2, 0.195);
  carSub(mb, -0.03, rg.inner[0], rg.inner[1], 0.60, 1, 0.026, { field: inner, uv: plainUV, flip: false });
  // vidros
  gl.mat(0).color(0.83, 0.915, 0.88);
  const glz = fn => (u, v, P) => fn(P, v) + 0.008;
  carSub(gl, -0.005, rg.door[0], rg.door[1], 0.40, 0.64, 0.02, { field: glz(carWinDoor), uv: plainUV });
  carSub(gl, -0.005, rg.quarter[0], rg.quarter[1], 0.40, 0.64, 0.02, { field: glz(carWinQuarter), uv: plainUV });
  carSub(gl, -0.005, rg.ws[0], rg.ws[1], 0.60, 1, 0.02, { field: glz(carWindshield), uv: plainUV });
  carSub(gl, -0.005, rg.rw[0], rg.rw[1], 0.60, 1, 0.02, { field: glz(carHatchGlass), uv: plainUV });
  gl.mat(1).color(0.93, 0.95, 0.95);
  carSub(gl, -0.003, xf - 0.004, xf - 0.2, 0.62, 1, 0.01, { field: (u, v, P) => carHeadlight(P) + 0.002, uv: (u, v, P) => { _cuv[0] = P[2]; _cuv[1] = P[1]; return _cuv; } });
  mb.mirror(v0, i0, 2); gl.mirror(gv0, gi0, 2);
}

// caminho do para-choque em planta, tirado do contorno da própria carroceria na altura yb: do centro, pela quina, até xEnd na lateral
function carBumperPath(yb, rear, xEnd, g) {
  const s = rear ? -1 : 1, zc = carZL(rear ? CS.XR + 0.14 : CS.XF - 0.14, yb), X = z => carTopX(z, yb, rear) + s * g;
  const xk = X(zc * 0.97), pts = [[X(0), 0], [X(zc * 0.45), zc * 0.45, 0.15], [X(zc * 0.8), zc * 0.8, 0.12], [xk, zc + g, 0.07]];
  for (const t of [0.4, 1]) { const x = xk + (xEnd - xk) * t; pts.push([x, carZL(x, yb) + g, t < 1 ? 0.06 : 0]); }
  let sC = 0; for (let i = 0; i < 3; i++) sC += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return { path: carPath(pts), sC, x0: pts[0][0] };
}
function carDecalQuad(mb, reg, zc, y0, w, h, rear, lift) {
  const P = (z, y) => [rear ? carTopX(z, y, true) - lift : lift, y, z];
  const s = rear ? 1 : -1, a = P(zc - s * w / 2, y0), b = P(zc + s * w / 2, y0), c = P(zc + s * w / 2, y0 + h), d = P(zc - s * w / 2, y0 + h);
  mb.quad(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], reg[0], reg[3], reg[2], reg[1]);
}
// ---------- peças genéricas: para-choques pretos com filete, caixas de roda, faróis, retrovisores, interior, limpadores, placas ----------
function carBuildPartsG(mb, gl, D) {
  const K = D.ck, xf = CS.XF, xr = CS.XR, hl = K.hl, v0 = mb.nv, i0 = mb.ni, gv0 = gl.nv, gi0 = gl.ni;
  // para-choques de plástico preto que dão a volta até a caixa de roda, com um filete prateado junto à borda de cima
  const prof = (yT, yB) => carPath([[-0.03, yT], [0.04, yT - 0.003, 0.006], [0.056, yT - 0.02, 0.012], [0.056, yB + 0.03, 0.014], [0.03, yB + 0.004, 0.008], [-0.03, yB]]);
  const fil = yT => carPath([[0.04, yT - 0.022], [0.0595, yT - 0.024, 0.002], [0.0595, yT - 0.036, 0.002], [0.04, yT - 0.038]]);
  const arch = (u, v, P) => -(carArchF(P) - 0.004);
  const fB = carBumperPath(0.5, false, CS.AXF + 0.3, 0.004), rB = carBumperPath(0.49, true, CS.AXR - 0.3, 0.004);
  mb.mat(CM.PLASTIC).color(0.02, 0.02, 0.021);
  carBumper(mb, fB.path, prof(0.565, 0.43), 1, arch, 150, 20, fB.sC, 0.6, 0.565, 0);
  carBumper(mb, rB.path, prof(0.56, 0.42), -1, arch, 150, 20, rB.sC, 0.6, 0.56, 0);
  mb.mat(CM.CHROME, 1).color(0.8, 0.81, 0.83);
  carBumper(mb, fB.path, fil(0.565), 1, arch, 150, 4, fB.sC, 0.6, 0.565, 0);
  carBumper(mb, rB.path, fil(0.56), -1, arch, 150, 4, rB.sC, 0.6, 0.56, 0);
  // caixas de roda e fundo
  mb.mat(CM.UNDER).color(0.006, 0.006, 0.007);
  for (const ax of [CS.AXF, CS.AXR]) {
    const R0 = CS.ARCH_R + 0.006, N = 28, zo = carZL(ax, 0.55) - 0.012, zi = 0.33;
    for (let i = 0; i < N; i++) {
      const a0 = (-8 + 196 * i / N) * PI / 180, a1 = (-8 + 196 * (i + 1) / N) * PI / 180;
      const x0 = ax + Math.cos(a0) * R0, y0 = CS.ARCH_Y + Math.sin(a0) * R0, x1 = ax + Math.cos(a1) * R0, y1 = CS.ARCH_Y + Math.sin(a1) * R0;
      const a = mb.v(x0, y0, zo, -Math.cos(a0), -Math.sin(a0), 0, 0, 0), b = mb.v(x0, y0, zi, -Math.cos(a0), -Math.sin(a0), 0, 0, 1), c = mb.v(x1, y1, zi, -Math.cos(a1), -Math.sin(a1), 0, 1, 1), d = mb.v(x1, y1, zo, -Math.cos(a1), -Math.sin(a1), 0, 1, 0);
      mb.quadI(a, d, c, b);
    }
    mb.quad(ax - 0.33, 0.25, zi, ax + 0.33, 0.25, zi, ax + 0.33, 0.66, zi, ax - 0.33, 0.66, zi);
  }
  const xa = CS.AXF - 0.34, xb = CS.AXF + 0.34, xc = CS.AXR + 0.34, xd = CS.AXR - 0.34;
  mb.quad(xc, 0.2, 0, xa, 0.2, 0, xa, 0.2, 0.705, xc, 0.2, 0.705);
  mb.quad(xa, 0.2, 0, xb, 0.2, 0, xb, 0.2, 0.5, xa, 0.2, 0.5); mb.quad(xd, 0.2, 0, xc, 0.2, 0, xc, 0.2, 0.5, xd, 0.2, 0.5);
  mb.quad(xb, 0.27, 0, xf - 0.02, 0.27, 0, xf - 0.02, 0.27, 0.68, xb, 0.27, 0.68); mb.quad(xr + 0.02, 0.27, 0, xd, 0.27, 0, xd, 0.27, 0.68, xr + 0.02, 0.27, 0.68);
  mb.quad(xb, 0.2, 0.68, xb, 0.2, 0, xb, 0.6, 0, xb, 0.6, 0.68); mb.quad(xd, 0.2, 0, xd, 0.2, 0.68, xd, 0.6, 0.68, xd, 0.6, 0);
  // farol: cuba prateada atrás da lente + bulbo
  {
    const z0 = hl[0] + 0.003, z1 = hl[1] - 0.003, y0 = hl[2] - hl[3] + 0.003, y1 = hl[2] + hl[3] - 0.003, Dp = 0.06;
    const zc = (z0 + z1) / 2, yc = (y0 + y1) / 2, hz = (z1 - z0) / 2, hy = (y1 - y0) / 2;
    const dep = (a, b) => 0.006 + Dp * Math.pow(Math.max(0, (1 - a * a * a * a) * (1 - b * b * b * b)), 0.6);
    mb.mat(CM.REFLECTOR).color(0.9, 0.9, 0.92);
    mb.patch((u, v, o) => { const z = zc + u * hz, y = yc + v * hy, d = dep(u, v), x = carTopX(z, y, false); o[0] = x - d * 0.97; o[1] = y - d * 0.1; o[2] = z; }, -1, 1, -1, 1, { nu: 22, nv: 12, flip: true, uv: (u, v, P) => { _cuv[0] = u; _cuv[1] = v; return _cuv; } });
    const xb2 = carTopX(zc, yc, false) - (dep(0, 0) - 0.012) * 0.97, yb2 = yc - (dep(0, 0) - 0.012) * 0.1;
    mb.push(m4translate(m4(), xb2, yb2, zc)); mb.push(m4rotZ(m4(), -PI / 2 + 0.1));
    mb.mat(CM.REFLECTOR, 1).color(1, 0.95, 0.8); mb.cyl(0, -0.012, 0, 0.0105, 0.024, 0.0095, 12, false, true);
    mb.mat(CM.REFLECTOR, 2).color(0.85, 0.85, 0.86); mb.cyl(0, -0.012, 0, 0.016, -0.007, 0.014, 14, false, true);
    mb.pop(); mb.pop();
  }
  // retrovisores externos pretos: carcaça retangular num pé curto, na base da coluna A
  {
    const x = K.cowl - 0.14, y = K.belt(x) + 0.075, z = carZL(x, K.belt(x)) + 0.1;
    mb.mat(CM.PLASTIC).color(0.013, 0.013, 0.014);
    mb.rbox(x + 0.02, y - 0.02, z - 0.07, 0.07, 0.05, 0.1, 0.015, 3);
    mb.rbox(x, y, z, 0.07, 0.1, 0.16, 0.022, 4);
    mb.mat(CM.MIRROR).color(0.62, 0.64, 0.67);
    mb.quad(x - 0.0355, y - 0.038, z - 0.066, x - 0.0355, y - 0.038, z + 0.066, x - 0.0355, y + 0.038, z + 0.066, x - 0.0355, y + 0.038, z - 0.066);
  }
  // interior do Uno, deslocado para a cabine deste carro
  mb.push(m4translate(m4(), D.dx, D.dy, 0)); carInteriorHalf(mb, D.rs); mb.pop();
  mb.mirror(v0, i0, 2); gl.mirror(gv0, gi0, 2);
  // ======================= peças não simétricas =======================
  carWipers(mb, D.dx, true);
  mb.push(m4translate(m4(), xr + 1.692, 0, 0)); carExhaust(mb); mb.pop();
  mb.push(m4translate(m4(), D.dx, D.dy, 0)); carInteriorFull(mb); mb.pop();
  // emblema dourado no centro da grade
  { const y = hl[2], x = carTopX(0, y, false); mb.mat(CM.CHROME, 2).color(0.86, 0.66, 0.2); mb.rbox(x + 0.003, y, 0, 0.01, 0.026, 0.07, 0.004, 2); mb.rbox(x + 0.003, y, 0, 0.012, 0.014, 0.12, 0.004, 2); }
  // placas amarelas (padrão da época) e emblema na traseira
  mb.mat(CM.DECAL).color(1, 1, 1);
  carDecalQuad(mb, CATX.chvPlate, 0, 0.655, 0.40, 0.13, true, 0.006);
  carDecalQuad(mb, CATX.chvPlate, 0, 0.432, 0.40, 0.13, false, fB.x0 + 0.062);
  mb.mat(CM.DECAL, 1).color(1, 1, 1);
  carDecalQuad(mb, CATX.chvName, 0.3, 0.812, 0.2, 0.036, true, 0.003);
}
// ---------- roda de aço prateada com furos redondos e calotinha central (dentro das transformações de carBuildWheel) ----------
function carWheelFace(mb, style) {
  mb.mat(CM.STEEL).color(0.5, 0.51, 0.53);
  mb.lathe([[0.058, 0.168], [0.046, 0.158], [0.05, 0.135], [0.06, 0.1], [0.064, 0.062]], 48);
  mb.mat(CM.UNDER).color(0.004, 0.004, 0.005);
  for (let k = 0; k < 12; k++) { mb.push(m4rotX(m4(), k * TAU / 12)); mb.rbox(0.047, 0.127, 0, 0.012, 0.026, 0.026, 0.0059, 3); mb.pop(); }
  mb.mat(CM.STEEL).color(0.42, 0.43, 0.45);
  for (let k = 0; k < 4; k++) { mb.push(m4rotX(m4(), (k + 0.5) * TAU / 4)); mb.rbox(0.066, 0.05, 0, 0.012, 0.016, 0.016, 0.005, 2); mb.pop(); }   // parafusos
  mb.mat(CM.CHROME, 2).color(0.75, 0.76, 0.78);
  mb.lathe([[0.064, 0.036], [0.074, 0.03], [0.079, 0.015], [0.08, 0]], 24);                                                    // calotinha
}
// ---------- atlas: placa amarela e emblema (metade de baixo do atlas do Uno) ----------
const CATX = { chvPlate: [0, 0.5, 0.5, 0.832], chvName: [0, 0.871, 0.293, 0.988] };
function carAtlasExtras(g) {
  g.fillStyle = '#d7a312'; g.fillRect(0, 256, 512, 170); g.strokeStyle = '#1a1a1a'; g.lineWidth = 6; g.strokeRect(5, 261, 502, 160);
  g.strokeStyle = '#141414'; carText(g, 'CH-1987', 60, 402, 82, 11, 0);
  g.fillStyle = '#6b5a1a'; g.beginPath(); g.arc(28, 280, 6, 0, TAU); g.arc(484, 280, 6, 0, TAU); g.fill();
  g.strokeStyle = '#e4e8ec'; carText(g, 'CHEVETTE', 12, 498, 40, 7, 0.12);
}
