// Passe de iluminação diferida: sol + sombras + ambiente (SH + cubemap) + reflexo em espaço de tela + céu + névoa.
#include fsq
#include util
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var gA: texture_2d<f32>;
@group(0) @binding(2) var gB: texture_2d<f32>;
@group(0) @binding(3) var gC: texture_2d<f32>;
@group(0) @binding(4) var gD: texture_depth_2d;
@group(0) @binding(5) var tShadow: texture_depth_2d_array;
@group(0) @binding(6) var tShadowS: texture_depth_2d;
@group(0) @binding(7) var sCmp: sampler_comparison;
@group(0) @binding(8) var tHalf: texture_2d<f32>;
@group(0) @binding(9) var tEnv: texture_cube<f32>;
@group(0) @binding(10) var tSky: texture_2d<f32>;
@group(0) @binding(11) var sClamp: sampler;
@group(0) @binding(12) var sSky: sampler;
@group(0) @binding(13) var tHist: texture_2d<f32>;
#include brdf
#include shadow
#include fog
#include skyfn

fn worldAt(uv: vec2f, d: f32) -> vec3f { let p = F.invViewProjJ * vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0); return p.xyz / p.w; }
// oclusão analítica do carro sobre o chão: caixa arredondada da carroceria + contato de cada pneu.
// Escurece a luz ambiente debaixo e em volta do carro (e um pouco a direta, junto aos pneus).
// F.car2.yzw = meio comprimento, centro e meio entre-eixos do carro em uso.
fn carAO(wp: vec3f, n: vec3f) -> f32 {
  let lp = (F.carInv * vec4f(wp, 1.0)).xyz;
  let ln = (F.carInv * vec4f(n, 0.0)).xyz;
  if (ln.y < 0.3 || lp.y > 0.2 || lp.y < -0.6 || abs(lp.x) > 4.5 || abs(lp.z) > 3.5) { return 1.0; }
  let q = vec2f(abs(lp.x - F.car2.z) - F.car2.y, abs(lp.z) - 0.72);
  let dOut = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);   // distância assinada ao retângulo
  let h = max(0.26 - lp.y, 0.03);                                     // altura do assoalho sobre o ponto (com piso: sem divisão por ~0)
  let occ = sat(1.0 - (dOut + 0.03) / (h * 3.0 + 0.3));
  // pneus: mancha curta e forte em volta de cada área de contato
  let dw = length(vec2f((abs(lp.x) - F.car2.w) * 0.8, abs(lp.z) - 0.66));
  let wo = sat(1.0 - dw / 0.5);
  return 1.0 - max(occ * occ * 0.94, wo * wo * 0.9) * sat(1.5 - h * 1.2);
}
// amostra o alvo de meia resolução (ao, vol, z linear) com pesos de profundidade (sem vazar em silhuetas)
fn halfSample(uv: vec2f, z: f32) -> vec2f {
  let hs = F.screen.xy * 0.5; let p = uv * hs - 0.5; let b = floor(p); let f = p - b;
  var acc = vec2f(0.0); var wsum = 0.0;
  for (var i = 0; i < 4; i++) {
    let o = vec2f(f32(i & 1), f32(i >> 1));
    let t = textureLoad(tHalf, clamp(vec2i(b + o), vec2i(0), vec2i(hs) - 1), 0);
    let wb = mix(1.0 - f.x, f.x, o.x) * mix(1.0 - f.y, f.y, o.y);
    let w = wb / (1e-3 + abs(t.b - z) / (0.02 * z + 0.02)) + 1e-5;
    acc += t.rg * w; wsum += w;
  }
  return acc / wsum;
}
#ifdef SSR
// reflexo em espaço de tela para superfícies molhadas: marcha no mundo, testa contra a profundidade, lê o quadro anterior
fn ssr(wp: vec3f, R: vec3f, px: vec2f, dist: f32) -> vec4f {
  let noise = ign(px, F.misc.y + 3.0);
  var stepLen = 0.03 + dist * 0.008; var t = stepLen * (0.4 + noise); var tPrev = 0.0;
  var hit = false; var hp = wp;
  for (var i = 0; i < 48; i++) {
    let p = wp + R * t; let c = F.viewProjJ * vec4f(p, 1.0);
    if (c.w <= 0.01) { break; }
    let uv = c.xy / c.w * vec2f(0.5, -0.5) + 0.5;
    if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) { break; }
    let zs = F.camFwd.w / max(textureLoad(gD, vec2i(uv * F.screen.xy), 0), 1e-6);
    if (c.w > zs + 0.03) {
      if (c.w < zs + 0.6 + stepLen * 2.5) {
        // refino por bisseção
        var a = tPrev; var b = t;
        for (var k = 0; k < 5; k++) {
          let m = (a + b) * 0.5; let q = wp + R * m; let cq = F.viewProjJ * vec4f(q, 1.0); let uq = cq.xy / cq.w * vec2f(0.5, -0.5) + 0.5;
          let zq = F.camFwd.w / max(textureLoad(gD, vec2i(uq * F.screen.xy), 0), 1e-6);
          if (cq.w > zq + 0.03) { b = m; } else { a = m; }
        }
        hp = wp + R * b; hit = true;
      }
      break;
    }
    tPrev = t; stepLen *= 1.1; t += stepLen;
  }
  if (!hit) { return vec4f(0.0); }
  let pc = F.prevViewProj * vec4f(hp, 1.0); let huv = pc.xy / pc.w * vec2f(0.5, -0.5) + 0.5;
  let e = min(min(huv.x, huv.y), min(1.0 - huv.x, 1.0 - huv.y));
  let fade = smoothstep(0.0, 0.06, e);
  let c = textureSampleLevel(tHist, sClamp, huv, 0.0).rgb;
  return vec4f(min(c, vec3f(40.0)), fade);
}
#endif
struct LOut { @location(0) col: vec4f }
@fragment fn fs(in: FsV) -> LOut {
  let px = vec2i(in.pos.xy);
  let d = textureLoad(gD, px, 0);
  let wpFar = worldAt(in.uv, max(d, 1e-6));
  let V = normalize(F.camPos.xyz - wpFar);
  var o: LOut;
  if (d <= 0.0) {
    var c = skyColor(-V);
    // raios de luz na névoa também sobre o céu
    let hs = textureSampleLevel(tHalf, sClamp, in.uv, 0.0);
    let Tn = exp(-fogOD(F.camPos.xyz, -V, VOL_DIST));
    c = c * mix(1.0, Tn, 0.0) - fogSunCol(-V) * (1.0 - Tn) * (1.0 - hs.g) * 0.85;
    o.col = vec4f(max(c, vec3f(0.0)), 1.0); return o;
  }
  let a = textureLoad(gA, px, 0); let b = textureLoad(gB, px, 0); let m = textureLoad(gC, px, 0);
  let wp = wpFar; let N = octDec(b.xy);
  let albedo = a.rgb; let rough = max(b.z, 0.035); let metal = b.w; let coat = m.x; let sss = m.y; let wet = m.w;
  let L = F.sunDir.xyz; let H = normalize(L + V);
  let nl = dot(N, L); let nv = max(dot(N, V), 1e-3); let nh = sat(dot(N, H)); let vh = sat(dot(V, H));
  let dist = distance(F.camPos.xyz, wp);
  var sh = 0.0;
  if (nl > -0.3 || sss > 0.0) { sh = sunShadowK(wp, N * select(1.0, 0.25, sss > 0.0), in.pos.xy, nl, select(1.0, 0.0, coat > 0.5)); }
  let cao = carAO(wp, N);
  let sun = F.sunCol.rgb * sh * mix(1.0, cao, 0.7);
  let f0 = mix(vec3f(0.04), albedo, metal); let diffC = albedo * (1.0 - metal);
  let al = rough * rough;
  var col = vec3f(0.0);
  // direto
  let nlc = sat(nl);
  var spec = fSchlick(f0, vh) * (dGGX(nh, al) * vSmith(nv, nlc, al));
  // superfícies ásperas não metálicas (asfalto, tinta fosca da zebra, grama): o lóbulo largo do GGX sob sol rasante lavava a cor
  // em bege/rosa; atenua o especular direto delas (com as cavidades do material)
  spec *= mix(1.0, 0.3 * a.a, smoothstep(0.78, 0.92, rough) * (1.0 - metal));
  var dif = diffC / PI;
  var coatAtt = 1.0;
  if (coat > 0.0) {
    let fc = fSchlick1(0.045, vh) * coat; coatAtt = 1.0 - fc;
    let ac = 0.0028;   // verniz liso
    col += sun * nlc * fc * min(dGGX(nh, ac) * vSmith(nv, nlc, ac), 90.0);
  }
  col += sun * nlc * (dif + spec) * coatAtt;
  if (sss > 0.0) {
    // folhagem: luz que atravessa a folha + envolvimento
    let back = sat(dot(-N, L)) * 0.6 + sat(dot(V, -L)) * sat(-nl + 0.3) * 0.5;
    col += sun * diffC * sss * (back * 0.75 + sat(nl * 0.5 + 0.5) * 0.12) / PI * 2.0;
  }
  // ambiente
  var hv = halfSample(in.uv, dist * dot(-V, F.camFwd.xyz)); hv.g = mix(1.0, hv.g, 0.7);
  let aoS = hv.r;
  let ao = min(a.a, aoS) * cao;
  // luz do céu nas sombras: um pouco dessaturada e reforçada (rebote difuso do cenário que o SH não capta)
  var irr = shIrr(N); irr = mix(vec3f(lum(irr)), irr, 0.15) * 1.75 * pow(F.sunCol.rgb / lum(F.sunCol.rgb), vec3f(0.42));   // quase neutra e levemente quente: a sombra não fica azul-marinho depois do balanço de branco
  col += diffC * irr * ao * coatAtt;
  let R = reflect(-V, N);
  let specOcc = sat(pow(nv + ao, exp2(-16.0 * rough - 1.0)) - 1.0 + ao);
  // horizonte: reflexo abaixo do chão perde energia
  var env = textureSampleLevel(tEnv, sClamp, R, envMip(rough)).rgb;
  env = mix(env, vec3f(lum(env)), sat(rough * 1.2 - 0.25) * 0.7);   // superfícies ásperas não devolvem o azul saturado do céu
  var envC = textureSampleLevel(tEnv, sClamp, R, 0.9).rgb;
#ifdef SSR
  if (wet > 0.03 && dist < 160.0) {
    let r = ssr(wp, R, in.pos.xy, dist);
    env = mix(env, r.rgb, r.a * sat(wet * 1.15)); envC = env;
  }
#endif
  col += env * envBRDF(f0, rough, nv) * specOcc * coatAtt * mix(1.0, cao, 0.7);
  // verniz: reflexo do ambiente levemente borrado (verniz real tem casca de laranja)
  // (reflexo um pouco dessaturado e Fresnel limitado em ângulo rasante: zebras não viram faixas rosa na lataria nem o capô vira espelho)
  if (coat > 0.0) { envC = mix(vec3f(lum(envC)), envC, 0.6); col += envC * min(fSchlick1(0.08, nv), 0.26) * coat * mix(specOcc, 1.0, 0.5) * 1.4; }
  // emissivo
  col += albedo * (m.z * m.z) * 16.0;
  // névoa
  let dir = -V; let od = fogOD(F.camPos.xyz, dir, dist); let T = exp(-od);
  let nearD = min(dist, VOL_DIST); let Tn = exp(-fogOD(F.camPos.xyz, dir, nearD));
  let sunIn = fogSunCol(dir) * max(0.0, (1.0 - T) - (1.0 - Tn) * (1.0 - hv.g));
  col = col * T + fogAmbCol(dir) * (1.0 - T) + sunIn;
  o.col = vec4f(col, 1.0);
  return o;
}
