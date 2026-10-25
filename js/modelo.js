/* Modelo BIM ilustrativo da página: sobrado com arquitetura, estrutura,
   instalações hidrossanitárias e elétricas, separados por disciplina. */
(function () {
  var host = document.getElementById("stage");
  if (!host) return;
  var fallback = document.getElementById("fallback");
  var clashTag = document.getElementById("clashTag");
  var legend = document.getElementById("legend");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!window.THREE) { fallback.hidden = false; return; }
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { fallback.hidden = false; return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.insertBefore(renderer.domElement, host.firstChild);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xF3F1EA, 0x22201B, 0.7));
  var sun = new THREE.DirectionalLight(0xFFF4E0, 0.9); sun.position.set(14, 22, 10); scene.add(sun);
  var rim = new THREE.DirectionalLight(0xC9D6E0, 0.35); rim.position.set(-12, 8, -14); scene.add(rim);

  var model = new THREE.Group(); scene.add(model);
  var NAMES = ["arq", "est", "fix", "mob", "hid", "ele", "terr", "clash"];
  var G = {};
  NAMES.forEach(function (k) { G[k] = new THREE.Group(); model.add(G[k]); });

  /* ---------- materiais ---------- */
  function mat(color, opacity, extra) {
    var m = new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: .85, metalness: .05, transparent: true, opacity: opacity, depthWrite: opacity > .9 }, extra || {}));
    m.userData.base = opacity; return m;
  }
  function edgeMat(color, opacity) { var m = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity }); m.userData.base = opacity; return m; }

  var M = {
    concrete: mat(0x9C988E, 1), slab: mat(0xB9B5AA, 1), footing: mat(0x7E7A72, 1),
    wall: mat(0xE9E5DA, .93), glass: mat(0x8FB3C9, .35, { roughness: .1, metalness: .3 }), frame: mat(0x2B2A27, 1),
    ceramic: mat(0xF6F5F0, 1, { roughness: .25 }), granite: mat(0x2E2D2B, 1, { roughness: .3 }), steel: mat(0xB8BCC0, 1, { roughness: .3, metalness: .7 }),
    cabinet: mat(0x6B5844, 1), fridge: mat(0xD9DBDD, 1, { roughness: .3, metalness: .2 }), boxGlass: mat(0xBFD6E2, .28, { roughness: .1 }),
    af: mat(0x4C9BE8, 1, { roughness: .45 }), esg: mat(0xA0693F, 1, { roughness: .5 }), vent: mat(0x9A9A94, 1, { roughness: .5 }), pluv: mat(0x9C86D6, 1, { roughness: .45 }),
    tank: mat(0x2F6FB0, 1, { roughness: .5 }), tankLid: mat(0x23548A, 1, { roughness: .5 }), precast: mat(0x8A877F, 1), lid: mat(0x6E6B64, 1),
    eleWall: mat(0xE3B341, 1, { roughness: .5 }), eleSlab: mat(0xE07B2E, 1, { roughness: .5 }), eleUnder: mat(0x3A3A3A, 1),
    plate: mat(0xF4F3EE, 1, { roughness: .3 }), panel: mat(0x8E8E8A, 1, { roughness: .4, metalness: .4 }), breaker: mat(0x1E1E1E, 1), meter: mat(0xA9ADB0, 1, { metalness: .4, roughness: .4 }),
    lamp: mat(0xFFE8B0, 1, { emissive: 0xFFD98A, emissiveIntensity: .8 }), pole: mat(0x8C8A84, 1),
    ground: mat(0x060605, .94), clash: mat(0xD2604A, .95, { emissive: 0xD2604A, emissiveIntensity: .9, depthTest: false })
  };
  var E = { est: edgeMat(0x4A4740, .7), arq: edgeMat(0x8A867C, .55), fix: edgeMat(0x9A968C, .6) };

  /* ---------- auxiliares de geometria ---------- */
  function box(g, w, h, d, x, y, z, m, edge) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh);
    if (edge) { var l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge); l.position.copy(mesh.position); g.add(l); }
    return mesh;
  }
  function cyl(g, r, h, x, y, z, m, seg) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 28), m);
    mesh.position.set(x, y, z); g.add(mesh); return mesh;
  }
  function seg(g, a, b, r, m) {
    var va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    var len = va.distanceTo(vb); if (len < 1e-4) return;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m);
    mesh.position.copy(va.clone().add(vb).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    g.add(mesh);
  }
  /* tubulação com joelhos: lista de pontos */
  function run(g, pts, r, m) {
    for (var i = 0; i < pts.length - 1; i++) seg(g, pts[i], pts[i + 1], r, m);
    for (var j = 1; j < pts.length - 1; j++) { var s = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 12, 10), m); s.position.set(pts[j][0], pts[j][1], pts[j][2]); g.add(s); }
  }

  /* ---------- dimensões ---------- */
  var LX = 12, LZ = 8, H = 3.1, FLOORS = 2, T = .16;
  var FL = [0, H + .07];              // cota do piso acabado de cada pavimento
  function ceil(f) { return (f + 1) * H - .1; } // cota do forro, logo abaixo da laje

  /* ---------- estrutura ---------- */
  var xs = [0, 4, 8, 12], zs = [0, 4, 8];
  xs.forEach(function (x) { zs.forEach(function (z) {
    box(G.est, 1.1, .45, 1.1, x, -.62, z, M.footing, E.est);
    box(G.est, .22, H * FLOORS + .2, .4, x, (H * FLOORS + .2) / 2 - .4, z, M.concrete, E.est);
  }); });
  for (var f = 1; f <= FLOORS; f++) {
    var yl = f * H;
    box(G.est, LX + .5, .14, LZ + .5, LX / 2, yl, LZ / 2, M.slab, E.est);
    zs.forEach(function (z) { box(G.est, LX, .45, .2, LX / 2, yl - .29, z, M.concrete, E.est); });
    xs.forEach(function (x) { box(G.est, .2, .45, LZ, x, yl - .29, LZ / 2, M.concrete, E.est); });
  }
  box(G.est, LX + .5, .14, LZ + .5, LX / 2, -.07, LZ / 2, M.slab, E.est);
  // base da caixa d'água
  box(G.est, 2.0, .12, 2.0, 10.4, 2 * H + .13, 2.2, M.slab, E.est);

  /* ---------- arquitetura ---------- */
  function wallX(x, z0, z1, y0, h, m) { box(G.arq, T, h, z1 - z0, x, y0 + h / 2, (z0 + z1) / 2, m || M.wall, E.arq); }
  function wallZ(z, x0, x1, y0, h, m) { box(G.arq, x1 - x0, h, T, (x0 + x1) / 2, y0 + h / 2, z, m || M.wall, E.arq); }
  for (var fl = 0; fl < FLOORS; fl++) {
    var y0 = FL[fl], wh = H - .55;
    for (var i = 0; i < 3; i++) {
      var cx = 2 + i * 4;
      wallZ(LZ, cx - 1.8, cx + 1.8, y0, 1.0);
      wallZ(LZ, cx - 1.8, cx + 1.8, y0 + wh - .45, .45);
      box(G.arq, 3.4, wh - 1.45, .05, cx, y0 + 1.0 + (wh - 1.45) / 2, LZ, M.glass);
      box(G.arq, .06, wh - 1.45, .1, cx, y0 + 1.0 + (wh - 1.45) / 2, LZ, M.frame);
      wallZ(0, cx - 1.8, cx + 1.8, y0, wh);
    }
    for (var j = 0; j < 2; j++) {
      var cz = 2 + j * 4;
      wallX(0, cz - 1.8, cz + 1.8, y0, wh);
      wallX(LX, cz - 1.8, cz + 1.8, y0, 1.0);
      wallX(LX, cz - 1.8, cz + 1.8, y0 + wh - .45, .45);
      box(G.arq, .05, wh - 1.45, 3.4, LX, y0 + 1.0 + (wh - 1.45) / 2, cz, M.glass);
    }
    // áreas molhadas: cozinha/banheiro (x 8–12, z 0–4) e lavabo/banheiro (x 0–2.6, z 0–2.4)
    wallX(8, .1, 2.5, y0, wh); wallX(8, 3.4, 4, y0, wh); wallX(8, 2.5, 3.4, y0 + 2.1, wh - 2.1);
    wallZ(4, 9.7, 11.9, y0, wh); wallZ(4, 8.1, 8.8, y0, wh); wallZ(4, 8.8, 9.7, y0 + 2.1, wh - 2.1);
    wallX(8, 4.1, 7.9, y0, wh);
    wallX(2.6, .1, 1.4, y0, wh); wallX(2.6, 2.2, 2.4, y0, wh); wallX(2.6, 1.4, 2.2, y0 + 2.1, wh - 2.1);
    wallZ(2.4, .1, 2.6, y0, wh);
    if (fl === 1) { // quartos do pavimento superior
      wallZ(4, .1, 2.8, y0, wh); wallZ(4, 3.6, 6.8, y0, wh); wallZ(4, 7.6, 7.9, y0, wh);
      wallZ(4, 2.8, 3.6, y0 + 2.1, wh - 2.1); wallZ(4, 6.8, 7.6, y0 + 2.1, wh - 2.1);
      wallX(4, 4.1, 7.9, y0, wh);
    }
  }
  // platibanda
  box(G.arq, LX + .5, .9, T, LX / 2, H * FLOORS + .5, LZ + .25, M.wall, E.arq);
  box(G.arq, LX + .5, .9, T, LX / 2, H * FLOORS + .5, -.25, M.wall, E.arq);
  box(G.arq, T, .9, LZ + .5, -.25, H * FLOORS + .5, LZ / 2, M.wall, E.arq);
  box(G.arq, T, .9, LZ + .5, LX + .25, H * FLOORS + .5, LZ / 2, M.wall, E.arq);

  /* ---------- louças e bancadas ---------- */
  function vaso(x, y, z) {
    box(G.fix, .36, .4, .52, x, y + .2, z + .3, M.ceramic, E.fix);
    box(G.fix, .4, .38, .16, x, y + .55, z + .1, M.ceramic, E.fix);
  }
  function lavatorio(x, y, z) {
    box(G.fix, .12, .78, .12, x, y + .39, z + .22, M.ceramic, E.fix);
    box(G.fix, .52, .14, .42, x, y + .84, z + .23, M.ceramic, E.fix);
    cyl(G.fix, .015, .2, x, y + 1.0, z + .08, M.steel, 8);
  }
  function chuveiro(x0, x1, z0, z1, y) {
    box(G.fix, x1 - x0, .04, z1 - z0, (x0 + x1) / 2, y + .02, (z0 + z1) / 2, M.ceramic, E.fix);
    box(G.fix, .02, 1.9, z1 - z0, x1, y + .95, (z0 + z1) / 2, M.boxGlass);
    var hx = (x0 + x1) / 2;
    cyl(G.fix, .11, .03, hx, y + 2.1, z0 + .3, M.steel, 20);
    seg(G.fix, [hx, y + 2.1, z0 + .08], [hx, y + 2.1, z0 + .3], .015, M.steel);
  }
  // pavimento superior: banheiro 1 e banheiro 2
  vaso(10.2, FL[1], .08); lavatorio(11.3, FL[1], .08); chuveiro(8.1, 9.4, .08, 1.3, FL[1]);
  vaso(.9, FL[1], .08); lavatorio(1.9, FL[1], .08); chuveiro(.08, 1.3, 1.2, 2.32, FL[1]);
  // térreo: cozinha e lavabo
  box(G.fix, 2.8, .04, .62, 10.55, .84, .39, M.granite);
  box(G.fix, .5, .06, .36, 10.4, .86, .4, M.steel);
  cyl(G.fix, .015, .26, 10.4, 1.0, .15, M.steel, 8);
  vaso(.9, FL[0], .08); lavatorio(1.9, FL[0], .08);


  /* ---------- mobiliário e marcenaria ---------- */
  var W = {
    wood: mat(0xB08559, 1, { roughness: .7 }), mdf: mat(0xE6E1D6, 1, { roughness: .6 }), graf: mat(0x3A3936, 1, { roughness: .5 }),
    fabric: mat(0x6E6A63, 1, { roughness: .95 }), cushion: mat(0x8C877E, 1, { roughness: .95 }), linen: mat(0xEDEAE2, 1, { roughness: .95 }),
    rug: mat(0x4A4740, 1, { roughness: 1 }), screen: mat(0x0E0E10, 1, { roughness: .2, metalness: .3 }), mirror: mat(0xC9D4DA, 1, { roughness: .05, metalness: .8 }),
    plant: mat(0x5E7B4E, 1, { roughness: .9 })
  };
  var EM = edgeMat(0x3A352C, .45);
  function m(w, h, d, x, y, z, mt, noEdge) { return box(G.mob, w, h, d, x, y, z, mt, noEdge ? null : EM); }

  // --- térreo · cozinha planejada (x 8–12, z 0–4)
  m(2.7, .82, .58, 10.55, .41, .37, W.graf);                       // armário de base sob a bancada
  m(2.7, .7, .34, 10.55, 1.85, .25, W.graf);                       // armários aéreos
  m(.62, 2.3, .7, 11.58, 1.15, 1.1, W.graf);                       // torre quente
  box(G.mob, .02, .5, .56, 11.26, 1.25, 1.1, W.screen);            // forno
  m(.7, 1.8, .66, 8.5, .9, .45, M.fridge);                         // geladeira
  // --- térreo · sala de jantar (x 4–8, z 0–4)
  m(1.8, .05, .9, 6, .76, 2, W.wood); m(.08, .74, .08, 5.25, .37, 1.65, W.wood); m(.08, .74, .08, 6.75, .37, 1.65, W.wood); m(.08, .74, .08, 5.25, .37, 2.35, W.wood); m(.08, .74, .08, 6.75, .37, 2.35, W.wood);
  [[5.4, 1.35], [6, 1.35], [6.6, 1.35], [5.4, 2.65], [6, 2.65], [6.6, 2.65]].forEach(function (c) {
    var back = c[1] < 2 ? c[1] - .2 : c[1] + .2;
    m(.42, .05, .42, c[0], .46, c[1], W.wood); m(.42, .45, .04, c[0], .7, back, W.wood);
    m(.04, .44, .04, c[0] - .18, .22, c[1] - .18, W.wood, true); m(.04, .44, .04, c[0] + .18, .22, c[1] - .18, W.wood, true);
    m(.04, .44, .04, c[0] - .18, .22, c[1] + .18, W.wood, true); m(.04, .44, .04, c[0] + .18, .22, c[1] + .18, W.wood, true);
  });
  m(1.2, .02, .4, 6, 1.6, .1, W.wood);                             // aparador / nicho
  // --- térreo · sala de estar (x 0–8, z 4–8): sofá, tapete, mesa de centro, painel de TV
  m(2.6, .015, 2.0, 4.6, .008, 6, W.rug, true);
  m(.95, .42, 2.4, 3.3, .21, 6, W.fabric); m(.25, .5, 2.4, 2.95, .55, 6, W.fabric);
  m(.95, .25, .2, 3.3, .55, 4.9, W.fabric); m(.95, .25, .2, 3.3, .55, 7.1, W.fabric);
  m(.6, .12, .7, 3.4, .48, 5.6, W.cushion); m(.6, .12, .7, 3.4, .48, 6.4, W.cushion);
  m(.9, .35, .6, 4.9, .175, 6, W.wood);
  for (var rs = 0; rs < 12; rs++) m(.04, 2.3, .09, 7.88, 1.15, 4.95 + rs * .19, W.wood, true); // painel ripado
  m(.45, .45, 2.0, 7.65, .3, 6, W.wood);                            // rack
  box(G.mob, .05, .82, 1.45, 7.83, 1.45, 6, W.screen);               // TV
  cyl(G.mob, .18, .5, .55, .25, 7.4, W.graf, 16); cyl(G.mob, .35, .5, .55, .75, 7.4, W.plant, 12);
  // --- térreo · escritório (x 8–12, z 4–8)
  m(1.8, .04, .65, 10.8, .75, 4.45, W.wood); m(.04, .73, .6, 9.95, .37, 4.45, W.wood); m(.04, .73, .6, 11.65, .37, 4.45, W.wood);
  m(.48, .08, .48, 10.8, .48, 5.1, W.graf); m(.48, .5, .06, 10.8, .78, 5.36, W.graf); cyl(G.mob, .03, .44, 10.8, .22, 5.1, M.steel, 8);
  m(.38, 2.2, 3.4, 8.3, 1.1, 6, W.mdf);
  for (var sh = 1; sh < 5; sh++) m(.4, .025, 3.36, 8.32, sh * .44, 6, W.wood, true);
  box(G.mob, .56, .36, .03, 10.8, 1.0, 4.2, W.screen);
  // --- banheiros: gabinetes e espelhos
  [[11.3, FL[1]], [1.9, FL[1]], [1.9, FL[0]]].forEach(function (b) {
    m(.6, .5, .42, b[0], b[1] + .3, .3, W.mdf);
    box(G.mob, .6, .8, .02, b[0], b[1] + 1.55, .1, W.mirror);
  });
  // --- superior · suíte (x 8–12, z 4–8): cama casal, criados, guarda-roupa
  var u = FL[1];
  m(2.0, .3, 1.6, 9.15, u + .15, 6.1, W.wood); m(1.95, .22, 1.55, 9.17, u + .41, 6.1, W.linen);
  m(.08, 1.1, 2.4, 8.12, u + .55, 6.1, W.wood);                     // cabeceira
  m(.35, .1, .55, 8.45, u + .57, 5.65, W.linen, true); m(.35, .1, .55, 8.45, u + .57, 6.55, W.linen, true);
  m(.45, .5, .4, 8.35, u + .25, 4.75, W.wood); m(.45, .5, .4, 8.35, u + .25, 7.45, W.wood);
  m(2.2, 2.4, .6, 10.8, u + 1.2, 4.42, W.mdf);                      // guarda-roupa
  for (var gp = 1; gp < 4; gp++) m(.02, 2.3, .02, 9.7 + gp * .55, u + 1.2, 4.73, W.wood, true);
  // --- superior · quarto 2 (x 0–4, z 4–8): cama de solteiro e guarda-roupa
  m(2.0, .3, 1.0, 1.15, u + .15, 6.6, W.wood); m(1.95, .2, .95, 1.17, u + .4, 6.6, W.linen); m(.06, .9, 1.1, .12, u + .45, 6.6, W.wood);
  m(.45, .5, .4, .35, u + .25, 5.75, W.wood);
  m(2.4, 2.4, .6, 1.45, u + 1.2, 4.42, W.mdf);
  for (var gq = 1; gq < 4; gq++) m(.02, 2.3, .02, .25 + gq * .6, u + 1.2, 4.73, W.wood, true);
  m(1.0, .04, .5, 3.4, u + .75, 7.6, W.wood); m(.04, .73, .45, 2.92, u + .37, 7.6, W.wood); m(.04, .73, .45, 3.88, u + .37, 7.6, W.wood);
  // --- superior · quarto 3 (x 4–8, z 4–8): cama casal e guarda-roupa
  m(2.0, .3, 1.6, 6.85, u + .15, 6.2, W.wood); m(1.95, .22, 1.55, 6.83, u + .41, 6.2, W.linen);
  m(.08, 1.0, 2.2, 7.88, u + .5, 6.2, W.wood);
  m(2.3, 2.4, .6, 5.3, u + 1.2, 4.42, W.mdf);
  for (var gr = 1; gr < 4; gr++) m(.02, 2.3, .02, 4.15 + gr * .58, u + 1.2, 4.73, W.wood, true);

  /* ---------- terreno ---------- */
  box(G.terr, 21, .02, 14, 7.5, -.16, 4.4, M.ground);

  /* ---------- hidrossanitário ---------- */
  var RT = 2 * H + .19; // topo da base da caixa d'água
  // caixa d'água aparente sobre a laje
  cyl(G.hid, .78, .95, 10.4, RT + .475, 2.2, M.tank, 40);
  cyl(G.hid, .82, .07, 10.4, RT + .985, 2.2, M.tankLid, 40);
  // entrada de água: hidrômetro na mureta e alimentação até a caixa
  box(G.hid, .5, .75, .22, 11.3, .37, 9.7, M.precast);
  box(G.hid, .22, .2, .06, 11.3, .5, 9.57, M.meter);
  run(G.hid, [[11.3, .3, 9.6], [11.3, -.35, 9.6], [11.75, -.35, 9.6], [11.75, -.35, .3], [11.75, RT + .7, .3], [11.15, RT + .7, 1.6]], .04, M.af);
  // barrilete e colunas de água fria
  run(G.hid, [[10.4, RT + .08, 1.45], [10.4, RT - .02, .3], [8.3, RT - .02, .3], [.35, RT - .02, .3]], .045, M.af);
  seg(G.hid, [8.3, RT - .02, .3], [8.3, .55, .3], .045, M.af);    // AF-1
  seg(G.hid, [.35, RT - .02, .3], [.35, .55, .3], .045, M.af);    // AF-2
  // ramais do pavimento superior
  var y1 = FL[1] + .6;
  run(G.hid, [[8.3, y1, .3], [8.3, y1, .14], [11.3, y1, .14]], .035, M.af);
  seg(G.hid, [8.75, y1, .14], [8.75, FL[1] + 2.05, .14], .03, M.af);        // chuveiro
  seg(G.hid, [10.2, y1, .14], [10.2, FL[1] + .3, .14], .03, M.af);          // vaso
  seg(G.hid, [11.3, y1, .14], [11.3, FL[1] + .75, .14], .03, M.af);          // lavatório
  run(G.hid, [[.35, y1, .3], [.35, y1, .14], [1.9, y1, .14]], .035, M.af);
  seg(G.hid, [.9, y1, .14], [.9, FL[1] + .3, .14], .03, M.af);
  seg(G.hid, [1.9, y1, .14], [1.9, FL[1] + .75, .14], .03, M.af);
  run(G.hid, [[.35, y1, .3], [.14, y1, .3], [.14, y1, 1.5], [.14, FL[1] + 2.05, 1.5]], .03, M.af);
  // ramais do térreo
  var y0r = .6;
  run(G.hid, [[8.3, y0r, .3], [8.3, y0r, .14], [10.4, y0r, .14], [10.4, 1.0, .14]], .035, M.af);
  run(G.hid, [[.35, y0r, .3], [.35, y0r, .14], [1.9, y0r, .14]], .035, M.af);
  seg(G.hid, [.9, y0r, .14], [.9, .3, .14], .03, M.af);
  seg(G.hid, [1.9, y0r, .14], [1.9, .75, .14], .03, M.af);

  // esgoto: tubos de queda, ramais, subcoletor, caixas, fossa e sumidouro
  var yEs = H - .3; // ramais do superior correm no forro do térreo
  var TQ1 = [7.7, .4], TQ2 = [2.35, .4];
  seg(G.hid, [TQ1[0], FL[1] + .1, TQ1[1]], [TQ1[0], -.5, TQ1[1]], .07, M.esg);
  seg(G.hid, [TQ2[0], FL[1] + .1, TQ2[1]], [TQ2[0], -.5, TQ2[1]], .07, M.esg);
  seg(G.hid, [TQ1[0], FL[1] + .1, TQ1[1]], [TQ1[0], 2 * H + 1.3, TQ1[1]], .045, M.vent); // ventilação
  seg(G.hid, [TQ2[0], FL[1] + .1, TQ2[1]], [TQ2[0], 2 * H + 1.3, TQ2[1]], .045, M.vent);
  // banheiro 1: o ramal ø100 cruza a viga do eixo C (x = 8) — é a interferência
  run(G.hid, [[11.3, FL[1] + .5, .3], [11.3, yEs, .3], [11.3, yEs, .45], [TQ1[0], yEs, .45], [TQ1[0], yEs, TQ1[1]]], .07, M.esg);
  seg(G.hid, [10.2, FL[1] + .05, .45], [10.2, yEs, .45], .07, M.esg);
  seg(G.hid, [8.75, FL[1] + .05, .7], [8.75, yEs, .7], .045, M.esg);
  seg(G.hid, [8.75, yEs, .7], [8.75, yEs, .45], .045, M.esg);
  // banheiro 2
  run(G.hid, [[1.9, FL[1] + .5, .3], [1.9, yEs, .3], [1.9, yEs, .55], [.7, yEs, .55]], .07, M.esg);
  seg(G.hid, [.9, FL[1] + .05, .45], [.9, yEs, .45], .07, M.esg);
  run(G.hid, [[1.9, yEs, .55], [TQ2[0], yEs, .55], [TQ2[0], yEs, TQ2[1]]], .07, M.esg);
  seg(G.hid, [.7, FL[1] + .05, 1.75], [.7, yEs, 1.75], .045, M.esg);
  seg(G.hid, [.7, yEs, 1.75], [.7, yEs, .55], .045, M.esg);
  // lavabo e cozinha (abaixo do piso)
  run(G.hid, [[.9, .05, .45], [.9, -.4, .45], [TQ2[0], -.4, .45]], .07, M.esg);
  run(G.hid, [[1.9, .5, .3], [1.9, -.4, .3]], .045, M.esg);
  run(G.hid, [[10.4, .7, .3], [10.4, -.4, .3], [12.9, -.4, .3], [12.9, -.4, .9]], .055, M.esg);
  // caixa de gordura, caixa de inspeção, fossa séptica e sumidouro
  cyl(G.hid, .3, .55, 12.9, -.25, .95, M.precast, 24); cyl(G.hid, .33, .05, 12.9, .03, .95, M.lid, 24);
  box(G.hid, .6, .6, .6, 13.1, -.28, 2.5, M.precast); box(G.hid, .66, .05, .66, 13.1, .03, 2.5, M.lid);
  run(G.hid, [[12.9, -.4, 1.25], [12.9, -.4, 2.2], [12.8, -.4, 2.5]], .055, M.esg);
  run(G.hid, [[TQ2[0], -.5, TQ2[1]], [TQ2[0], -.5, 2.5], [12.8, -.5, 2.5]], .07, M.esg);
  seg(G.hid, [TQ1[0], -.5, TQ1[1]], [TQ1[0], -.5, 2.5], .07, M.esg);
  cyl(G.hid, .95, 1.7, 14.9, -.8, 2.5, M.precast, 36); cyl(G.hid, 1.0, .07, 14.9, .04, 2.5, M.lid, 36);
  cyl(G.hid, .85, 2.1, 14.9, -1.0, 5.6, M.precast, 36); cyl(G.hid, .9, .07, 14.9, .04, 5.6, M.lid, 36);
  seg(G.hid, [13.4, -.5, 2.5], [13.95, -.5, 2.5], .07, M.esg);
  run(G.hid, [[14.9, -.55, 3.45], [14.9, -.55, 4.75]], .07, M.esg);

  // águas pluviais: calhas junto à platibanda, condutores e caixas de areia
  var yC = 2 * H + .2;
  box(G.hid, LX - .2, .16, .26, LX / 2, yC, .1, M.pluv); box(G.hid, LX - .2, .16, .26, LX / 2, yC, LZ - .1, M.pluv);
  [[.3, -.45], [11.7, -.45], [.3, LZ + .45], [11.7, LZ + .45]].forEach(function (p) {
    var zin = p[1] < 0 ? .1 : LZ - .1;
    run(G.hid, [[p[0], yC, zin], [p[0], yC + .05, p[1]], [p[0], .1, p[1]]], .06, M.pluv);
    box(G.hid, .45, .45, .45, p[0], -.15, p[1], M.precast);
  });
  run(G.hid, [[11.7, -.3, -.45], [-.9, -.3, -.45], [-.9, -.3, 9.9]], .06, M.pluv);
  run(G.hid, [[.3, -.3, LZ + .45], [-.9, -.3, LZ + .45]], .06, M.pluv);
  run(G.hid, [[11.7, -.3, LZ + .45], [11.7, -.3, 9.9]], .06, M.pluv);

  /* ---------- elétrica ---------- */
  // padrão de entrada: poste e mureta com medidor
  cyl(G.ele, .07, 5.2, .45, 2.6, 9.9, M.pole, 12);
  box(G.ele, .9, 1.4, .25, 1.3, .7, 9.75, M.precast);
  box(G.ele, .34, .44, .1, 1.3, 1.0, 9.6, M.meter);
  run(G.ele, [[.45, 3.2, 9.9], [1.3, 1.2, 9.65]], .02, M.eleUnder);
  run(G.ele, [[1.3, .7, 9.62], [1.3, -.3, 9.62], [.22, -.3, 9.62], [.22, -.3, 6.5], [.22, 1.3, 6.5]], .035, M.eleUnder);
  // QDC com disjuntores
  box(G.ele, .1, .55, .42, .13, 1.6, 6.5, M.panel);
  box(G.ele, .02, .44, .34, .19, 1.6, 6.5, M.breaker);
  for (var r = 0; r < 2; r++) for (var c = 0; c < 6; c++) box(G.ele, .04, .08, .04, .21, 1.71 - r * .19, 6.39 + c * .045, M.plate);
  // prumada até o pavimento superior
  seg(G.ele, [.22, 1.88, 6.5], [.22, ceil(1), 6.5], .035, M.eleWall);

  var lights = [[2, 2], [6, 2], [10, 2], [2, 6], [6, 6], [10, 6], [1.3, 1.2]];
  var XL = [2, 6, 10];
  function nearestX(x) { return XL.reduce(function (a, b) { return Math.abs(b - x) < Math.abs(a - x) ? b : a; }); }
  function feedFromSlab(x, z, f) {
    var y = ceil(f), xl = nearestX(x), zc = Math.min(6, Math.max(2, z));
    run(G.ele, [[xl, y, zc], [xl, y, z], [x, y, z]], .03, M.eleSlab);
  }
  function plateAt(x, y, z, axis, kind, f) {
    var w = kind === "int" ? .09 : .1;
    if (axis === "x") box(G.ele, .025, .13, w, x, y, z, M.plate); else box(G.ele, w, .13, .025, x, y, z, M.plate);
    feedFromSlab(x, z, f);
    seg(G.ele, [x, ceil(f), z], [x, y + .07, z], .025, M.eleWall);
  }
  for (var fe = 0; fe < FLOORS; fe++) {
    var yc = ceil(fe), ff = FL[fe];
    // rede de eletrodutos na laje
    run(G.ele, [[.22, yc, 6.5], [.22, yc, 6], [10, yc, 6]], .035, M.eleSlab);
    XL.forEach(function (x) { seg(G.ele, [x, yc, 6], [x, yc, 2], .035, M.eleSlab); });
    run(G.ele, [[2, yc, 2], [1.3, yc, 2], [1.3, yc, 1.2]], .03, M.eleSlab);
    lights.forEach(function (p) { cyl(G.ele, .2, .04, p[0], yc - .06, p[1], M.lamp, 24); });
    // tomadas e interruptores
    plateAt(.09, ff + .3, 3.4, "x", "tom", fe);
    plateAt(.09, ff + .3, 5.2, "x", "tom", fe);
    plateAt(11.91, ff + .3, 5.0, "x", "tom", fe);
    plateAt(11.91, ff + .3, 7.0, "x", "tom", fe);
    plateAt(7.9, ff + 1.1, 2.3, "x", "int", fe);
    plateAt(3.9, ff + .3, 7.5, "x", "tom", fe);
    plateAt(2.75, ff + 1.1, 1.3, "x", "int", fe);
  }
  // cozinha: tomadas acima da bancada e da geladeira
  plateAt(9.5, 1.15, .09, "z", "tom", 0);
  plateAt(11.6, 1.15, .09, "z", "tom", 0);
  plateAt(8.5, 2.05, .09, "z", "tom", 0);
  // banheiros: tomada do lavatório e ponto do chuveiro elétrico
  plateAt(11.75, FL[1] + 1.15, .09, "z", "tom", 1);
  plateAt(9.2, FL[1] + 2.25, .09, "z", "tom", 1);
  plateAt(1.4, FL[1] + 2.25, .09, "z", "tom", 1);

  /* ---------- interferência ---------- */
  var ring = new THREE.Mesh(new THREE.TorusGeometry(.75, .09, 14, 48), M.clash);
  ring.position.set(8, yEs, .45); ring.rotation.y = Math.PI / 2; G.clash.add(ring);
  var core = new THREE.Mesh(new THREE.SphereGeometry(.26, 20, 16), M.clash); core.position.copy(ring.position); G.clash.add(core);
  ring.renderOrder = core.renderOrder = 10;

  model.position.set(-7.2, -2.7, -4.6);

  /* ---------- disciplinas ---------- */
  var PRESETS = {
    all:   { arq: 1,   est: 1,   fix: 1,   mob: 1, hid: 1, ele: 1, terr: 1,   clash: 0 },
    arq:   { arq: 1,   est: .12, fix: 1,   mob: 0, hid: 0, ele: 0, terr: 1,   clash: 0 },
    est:   { arq: 0,   est: 1,   fix: 0,   mob: 0, hid: 0, ele: 0, terr: .35, clash: 0 },
    mob:   { arq: .1,  est: .1,  fix: 1,   mob: 1, hid: 0, ele: 0, terr: .3,  clash: 0 },
    hid:   { arq: .06, est: .14, fix: 1,   mob: 0, hid: 1, ele: 0, terr: .22, clash: 0 },
    ele:   { arq: .06, est: .14, fix: .25, mob: .15, hid: 0, ele: 1, terr: .22, clash: 0 },
    clash: { arq: 0,   est: .4,  fix: .2,  mob: 0, hid: 1, ele: 0, terr: .12, clash: 1 }
  };

  var LEGENDS = {
    mob: [["#B08559", "Marcenaria em madeira"], ["#E6E1D6", "Planejados em MDF"], ["#3A3936", "Cozinha planejada"], ["#6E6A63", "Estofados"], ["#EDEAE2", "Camas"], ["#0E0E10", "TV e eletros"]],
    hid: [["#4C9BE8", "Água fria"], ["#A0693F", "Esgoto"], ["#9A9A94", "Ventilação"], ["#9C86D6", "Águas pluviais"], ["#2F6FB0", "Caixa d'água"], ["#8A877F", "Fossa, sumidouro e caixas"]],
    ele: [["#E3B341", "Eletroduto na parede"], ["#E07B2E", "Eletroduto na laje"], ["#3A3A3A", "Entrada subterrânea"], ["#8E8E8A", "QDC"], ["#F4F3EE", "Tomadas e interruptores"], ["#FFE8B0", "Pontos de luz"]]
  };
  var target = Object.assign({}, PRESETS.all), current = Object.assign({}, PRESETS.all);

  function setOp(o, v) {
    if (!o.material) return;
    var m = o.material, base = m.userData.base == null ? 1 : m.userData.base;
    if (!o.userData.own) { o.material = m.clone(); o.material.userData.base = base; o.userData.own = true; m = o.material; }
    m.opacity = base * v; m.depthWrite = m.opacity > .9;
  }
  function applyOpacity() {
    NAMES.forEach(function (k) {
      var v = current[k];
      G[k].visible = v > .01;
      if (G[k].visible) G[k].traverse(function (o) { setOp(o, v); });
    });
  }
  function showLegend(mode) {
    if (!legend) return;
    var items = LEGENDS[mode];
    legend.hidden = !items;
    if (!items) return;
    legend.innerHTML = items.map(function (it) { return '<span><i style="background:' + it[0] + '"></i>' + it[1] + "</span>"; }).join("");
  }

  var buttons = document.querySelectorAll(".mode");
  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var mode = b.dataset.mode;
      buttons.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      target = PRESETS[mode];
      clashTag.hidden = mode !== "clash";
      showLegend(mode);
      if (mode === "clash") yawTarget = nearestYaw(yaw, -0.55);
      if (mode === "hid" || mode === "ele" || mode === "mob") yawTarget = nearestYaw(yaw, 0.75);
      zoomTarget = ZOOM[mode]; idle = -2.5;
      wake();
    });
  });
  function nearestYaw(from, to) { var k = Math.round((from - to) / (2 * Math.PI)); return to + k * 2 * Math.PI; }

  /* ---------- câmera ---------- */
  var ZOOM = { all: 1, arq: 1, est: 1, mob: .86, hid: .86, ele: .86, clash: .8 }, zoom = 1, zoomTarget = 1;
  var yaw = 0.7, yawTarget = 0.7, pitch = 0.42, dragging = false, lastX = 0, idle = 0;
  host.addEventListener("pointerdown", function (e) { dragging = true; lastX = e.clientX; idle = 0; wake(); });
  window.addEventListener("pointerup", function () { dragging = false; });
  window.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    yawTarget -= (e.clientX - lastX) * 0.008; lastX = e.clientX; wake();
  });

  function resize() {
    var w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", function () { resize(); wake(); });
  resize();

  var visible = true, running = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) wake(); }).observe(host);
  }
  function wake() { if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(loop); } }

  var last = performance.now();
  function loop(now) {
    var dt = Math.min((now - last) / 1000, .05); last = now;
    if (!dragging && !reduce) { idle += dt; if (idle > 1.2) yawTarget += dt * 0.1; }
    yaw += (yawTarget - yaw) * Math.min(1, dt * 5);
    var moving = Math.abs(yawTarget - yaw) > .0005, changed = false;
    NAMES.forEach(function (k) {
      var d = target[k] - current[k];
      if (Math.abs(d) > .002) { current[k] += d * Math.min(1, dt * 7); changed = true; } else current[k] = target[k];
    });
    applyOpacity();
    zoom += (zoomTarget - zoom) * Math.min(1, dt * 4);
    if (Math.abs(zoomTarget - zoom) > .001) changed = true;
    var R = (host.clientWidth < 520 ? 42 : 40) * zoom;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * R, Math.sin(pitch) * R, Math.cos(yaw) * Math.cos(pitch) * R);
    camera.lookAt(0, .4, 0);
    var pulse = 1 + Math.sin(now / 260) * .12; ring.scale.set(pulse, pulse, pulse);
    renderer.render(scene, camera);
    if (visible && (moving || changed || dragging || !reduce || current.clash > 0)) requestAnimationFrame(loop);
    else running = false;
  }
  wake();
})();
