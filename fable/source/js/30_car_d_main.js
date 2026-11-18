// Montagem do carro, contrato com o jogo (CAR) e visualizador isolado (?scene=car).
const CAR = {
  wheelbase: 2.362, trackF: 1.34, trackR: 1.30, wheelR: 0.281,
  hubs: [[1.181, 0.281, -0.67], [1.181, 0.281, 0.67], [-1.181, 0.281, -0.65], [-1.181, 0.281, 0.65]],
  slotBody: 0, slotWheel: [0, 0, 0, 0], slotSteer: 0,
  steerMat: m4(), tris: 0, _t: m4(), _t2: m4(), _t3: m4(), set: null, glass: null, atlasBG: null, fam: null,
  build() {
    carShapeInit(); carWindowsInit(); carSeamInit();
    const fam = CAR.fam = mkFamily('car', { src: 'mat_car', noCube: true });
    CAR.slotBody = objSlot(); for (let i = 0; i < 4; i++) CAR.slotWheel[i] = objSlot(); CAR.slotSteer = objSlot();
    const set = CAR.set = new MeshSet(fam), glass = CAR.glass = new GlassSet();
    const sb = new MeshBuilder(1 << 12); carBuildSteer(sb); const steer = sb.upload();
    // uma malha por carro (CARDEFS); todos usam os mesmos slots, e CAR.select troca as listas de desenho
    for (let c = 0; c < CARDEFS.length; c++) {
      const D = CARDEFS[c], mb = new MeshBuilder(1 << 17), gl = new MeshBuilder(1 << 14), w = new MeshBuilder(1 << 15), wb = new MeshBuilder(1 << 11);
      carBuildCar(c, mb, gl, w, wb);
      if (!c) CAR.tris = mb.ni / 3 + gl.ni / 3 + 4 * (w.ni + wb.ni) / 3 + sb.ni / 3;
      set.items = []; glass.items = [];
      set.add(mb.upload(), CAR.slotBody, 3); glass.add_(gl.upload(), CAR.slotBody);
      const wm = w.upload(), wbm = wb.ni ? wb.upload() : null;
      for (let i = 0; i < 4; i++) { set.add(wm, CAR.slotWheel[i], 3); if (wbm) set.add(wbm, CAR.slotWheel[i], 1); }   // disco de borrão: só no passe principal
      set.add(steer, CAR.slotSteer, 3);
      D.items = set.items; D.glassItems = glass.items; D.steerMat = m4mul(m4(), m4translate(m4(), D.dx, D.dy, 0), CAR.steerMat);
    }
    CAR.select(0);
    const tex = typeof carAtlas === 'function' ? carAtlas() : mkTex(4, 4, 'rgba8unorm-srgb');
    // desenhável: liga o atlas (grupo 3) e não entra no mapa de sombras estático do mundo
    R.drawables.push({ draw(pass, ctx) {
      if (ctx.kind === KIND.SHADOW && ctx.cascade === 3) return;
      if (!CAR.atlasBG) { if (!fam.bgl3) return; CAR.atlasBG = G.dev.createBindGroup({ layout: fam.bgl3, entries: [{ binding: 0, resource: tex.createView() }] }); }
      pass.setBindGroup(3, CAR.atlasBG); set.draw(pass, ctx);
    } });
    R.transparents.push(glass);
    m4ident(CAR._t); CAR.place(CAR._t, CAR._z4, CAR._z4); CAR.place(CAR._t, CAR._z4, CAR._z4);
  },
  _z4: new Float32Array(4),
  // carro em uso (índice em CARDEFS): troca as malhas desenhadas, os cubos das rodas e a posição do volante
  cur: 0,
  select(i) { const D = CARDEFS[i]; CAR.cur = i; CAR.set.items = D.items; CAR.glass.items = D.glassItems; CAR.hubs = D.hubs; CAR.steerMat = D.steerMat; },
  // escreve as matrizes de todos os slots (e guarda as anteriores para os vetores de movimento). Sem alocação.
  // steer (ângulo das rodas dianteiras, + = direita) e ângulo do volante vêm de CAR.inp[0..1]: nenhum número passa por
  // argumento (o V8 poria cada um em caixa na heap a cada chamada).
  inp: new Float64Array(2),
  place(body, spin, susp) {
    const steer = CAR.inp[0], steerWheelAngle = CAR.inp[1];
    const t = CAR._t2, t2 = CAR._t3;
    objPrev(CAR.slotBody).set(objModel(CAR.slotBody)); objModel(CAR.slotBody).set(body);
    for (let i = 0; i < 4; i++) {
      const s = CAR.slotWheel[i], h = CAR.hubs[i], left = (i & 1) === 0;
      objPrev(s).set(objModel(s));
      // roda: T(cubo + suspensão) · Ry(esterço [+π à esquerda]) · Rz(giro)
      const a = -(i < 2 ? steer : 0) + (left ? PI : 0), c = Math.cos(a), sn = Math.sin(a);
      const g = left ? spin[i] : -spin[i], cg = Math.cos(g), sg = Math.sin(g);
      // Ry(a) * Rz(g)
      t[0] = c * cg; t[1] = sg; t[2] = -sn * cg; t[3] = 0;
      t[4] = -c * sg; t[5] = cg; t[6] = sn * sg; t[7] = 0;
      t[8] = sn; t[9] = 0; t[10] = c; t[11] = 0;
      t[12] = h[0]; t[13] = h[1] + susp[i]; t[14] = h[2]; t[15] = 1;
      m4mul(objModel(s), body, t);
    }
    objPrev(CAR.slotSteer).set(objModel(CAR.slotSteer));
    const ca = Math.cos(-steerWheelAngle), sa = Math.sin(-steerWheelAngle); t2.fill(0); t2[0] = 1; t2[5] = ca; t2[6] = sa; t2[9] = -sa; t2[10] = ca; t2[15] = 1;
    m4mul(t, CAR.steerMat, t2); m4mul(objModel(CAR.slotSteer), body, t);
  },
};
BUILD.push(async () => {
  CAR.build();
  if (GAME.mode === 'car') {
    buildTestGround();
    const c = Math.min(CARDEFS.length - 1, +(Q.get('car') || 0)), D = CARDEFS[c]; CAR.select(c); CAR.place(CAR._t, CAR._z4, CAR._z4);
    GAME.init = () => { setCamera(3.3, 1.25, -3.6, 0.1, 0.62, 0, 0.5); R.cube.pos.set([0, 0.9, 0]); FR.data[FO.car + 3] = c; FR.data.set(D.ao, FO.car2 + 1); };
    window.__car = CAR;
  }
});
