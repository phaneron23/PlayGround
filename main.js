import * as THREE from 'three';

/* ============================================================
   HOTLINE MIAMI 3D — fan homage
   Top-down one-hit-kills neon shooter. No assets, all synth.
   ============================================================ */

const TILE = 2;
const WALL_H = 1.7;

// ASCII levels: # wall, P player, m melee, g gunner, b bat, p pistol, u uzi
const LEVELS = [
  {
    name: 'HOTEL FANTASY',
    map: [
      '####################',
      '#P...#.............#',
      '#....#....m....m...#',
      '#....#.............#',
      '#....D.....####....#',
      '#....#....m#..#..g.#',
      '###.##.....#..#....#',
      '#.....m...mD..D....#',
      '#..b..#.....#..#.p.#',
      '#.....#.....#..#...#',
      '#.....#...........m#',
      '#.....#.....####...#',
      '####################',
    ],
  },
  {
    name: 'NEON PALMS',
    map: [
      '########################',
      '#P.....#......m....#...p#',
      '#......#.............#..#',
      '#..m...#..####...m..#..##',
      '#......#..#..#......#...#',
      '####.####.#..#.####.#.g.#',
      '#......m..#..#.#......#.#',
      '#..p...#.....m...m...#..#',
      '#......#.####..#####.#..#',
      '#..m...#.#......g.#..#..#',
      '#......#.#..u...#.#..#..#',
      '#..g...D....m...#.D.....#',
      '#......#.#......#.#..m..#',
      '########################',
    ],
  },
  {
    name: 'SUNSET EXECUTION',
    map: [
      '##########################',
      '#P....#....m......#....g..#',
      '#.....#...........#.......#',
      '#..m..#.####.######.####..#',
      '#.....#.#..........#..#...#',
      '#.#####.#..m....m..#..#.m.#',
      '#.....D....####....D..#...#',
      '#.#####.#..#..#....#..#.g.#',
      '#..u...#..#..#..m.#..#....#',
      '#......#.m#..#.g..#.####.##',
      '#..g...#..#..#....#......##',
      '#......D.....m....D..m...##',
      '#..p...#..####..###..##...#',
      '#......#.............#..p.#',
      '##########################',
    ],
  },
];

const WEAPONS = {
  fists: { name: 'FISTS', melee: true, range: 1.9, arc: 1.5, cooldown: 0.32 },
  bat:   { name: 'BAT', melee: true, range: 2.6, arc: 1.9, cooldown: 0.45 },
  pistol:{ name: 'PISTOL', melee: false, ammo: 6, cooldown: 0.32, spread: 0.03 },
  uzi:   { name: 'UZI', melee: false, ammo: 24, cooldown: 0.11, spread: 0.09 },
};

const MASKS = {
  tiger: { speed: 1.0, meleeCd: 0.7, comboWindow: 3.0 },
  horse: { speed: 1.2, meleeCd: 1.0, comboWindow: 3.0 },
  owl:   { speed: 1.0, meleeCd: 1.0, comboWindow: 5.5 },
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const hudEl = $('hud'), menuEl = $('menu'), deathEl = $('death'),
  clearEl = $('clear'), winEl = $('win');
const hudFloor = $('hud-floor'), hudEnemies = $('hud-enemies'),
  hudScore = $('hud-score'), hudCombo = $('hud-combo'),
  hudWeapon = $('hud-weapon'), hudAmmo = $('hud-ammo'),
  crosshair = $('crosshair');

let mask = 'tiger';
document.querySelectorAll('.mask').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mask').forEach((x) => x.classList.remove('selected'));
    b.classList.add('selected');
    mask = b.dataset.mask;
    sfx.click();
  });
});

// ---------- Audio (all synthesized) ----------
let audioCtx = null, muted = false, musicTimer = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
const sfx = {
  click() { if (muted) return; try { const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type='square'; o.frequency.value=660; env(g,t,0.005,0.08,0.06); o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.1);} catch{} },
  shoot(big=false) { if (muted) return; try { const c=ac(), t=c.currentTime;
    const o=c.createOscillator(), g=c.createGain(); o.type='sawtooth';
    o.frequency.setValueAtTime(big?900:1400, t); o.frequency.exponentialRampToValueAtTime(120, t+0.12);
    env(g,t,0.004,big?0.5:0.35,0.14); o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.2);
    const n=c.createBufferSource(), buf=c.createBuffer(1, 2205, 44100), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    n.buffer=buf; const ng=c.createGain(); ng.gain.value=big?0.5:0.3; n.connect(ng).connect(c.destination); n.start(t);
  } catch{} },
  eshoot() { if (muted) return; try { const c=ac(), t=c.currentTime, o=c.createOscillator(), g=c.createGain(); o.type='square'; o.frequency.setValueAtTime(500,t); o.frequency.exponentialRampToValueAtTime(90,t+0.15); env(g,t,0.004,0.22,0.15); o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.2);} catch{} },
  swing() { if (muted) return; try { const c=ac(), t=c.currentTime, n=c.createBufferSource(), buf=c.createBuffer(1,3000,44100), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(i/d.length);
    const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2500; n.buffer=buf; const g=c.createGain(); g.gain.value=0.25;
    n.connect(f).connect(g).connect(c.destination); n.start(t);} catch{} },
  splat() { if (muted) return; try { const c=ac(), t=c.currentTime, n=c.createBufferSource(), buf=c.createBuffer(1,5000,44100), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(3000,t); f.frequency.exponentialRampToValueAtTime(300,t+0.2);
    n.buffer=buf; const g=c.createGain(); g.gain.value=0.5; n.connect(f).connect(g).connect(c.destination); n.start(t);} catch{} },
  pickup() { if (muted) return; try { const c=ac(), t=c.currentTime; [523,784].forEach((fq,i)=>{ const o=c.createOscillator(), g=c.createGain(); o.type='square'; o.frequency.value=fq; env(g,t+i*0.07,0.005,0.15,0.09); o.connect(g).connect(c.destination); o.start(t+i*0.07); o.stop(t+i*0.07+0.12);});} catch{} },
  clear() { if (muted) return; try { const c=ac(), t=c.currentTime; [392,523,659,784,1046].forEach((fq,i)=>{ const o=c.createOscillator(), g=c.createGain(); o.type='sawtooth'; o.frequency.value=fq; env(g,t+i*0.09,0.01,0.2,0.25); o.connect(g).connect(c.destination); o.start(t+i*0.09); o.stop(t+i*0.09+0.3);});} catch{} },
  death() { if (muted) return; try { const c=ac(), t=c.currentTime, o=c.createOscillator(), g=c.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(400,t); o.frequency.exponentialRampToValueAtTime(40,t+0.5); env(g,t,0.01,0.4,0.5); o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.6);} catch{} },
};
// Tiny synthwave loop: bass + arp scheduled with lookahead
let musicStep = 0;
function startMusic() {
  if (musicTimer || muted) return;
  const bass = [110,110,130.8,98,110,110,146.8,164.8];
  const arp = [220,277.2,329.6,440,329.6,277.2];
  musicTimer = setInterval(() => {
    if (muted) return;
    try {
      const c = ac(), t = c.currentTime;
      const b = bass[musicStep % bass.length];
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type='sawtooth'; o.frequency.value=b; f.type='lowpass'; f.frequency.value=500;
      env(g,t,0.01,0.10,0.22); o.connect(f).connect(g).connect(c.destination); o.start(t); o.stop(t+0.26);
      if (musicStep % 2 === 0) {
        const a = arp[(musicStep/2|0) % arp.length];
        const o2=c.createOscillator(), g2=c.createGain(); o2.type='square'; o2.frequency.value=a*2;
        env(g2,t,0.01,0.035,0.12); o2.connect(g2).connect(c.destination); o2.start(t); o2.stop(t+0.15);
      }
      musicStep++;
    } catch {}
  }, 240);
}
function stopMusic(){ clearInterval(musicTimer); musicTimer=null; }

// ---------- Three setup ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0614);
scene.fog = new THREE.Fog(0x0a0614, 30, 70);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 200);

scene.add(new THREE.HemisphereLight(0x8877ff, 0x110811, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(10, 24, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024,1024);
keyLight.shadow.camera.left=-30; keyLight.shadow.camera.right=30;
keyLight.shadow.camera.top=30; keyLight.shadow.camera.bottom=-30;
scene.add(keyLight);
const pinkLight = new THREE.PointLight(0xff2e88, 60, 60); pinkLight.position.set(-10, 8, -6); scene.add(pinkLight);
const cyanLight = new THREE.PointLight(0x22e6ff, 60, 60); cyanLight.position.set(10, 8, 10); scene.add(cyanLight);
const muzzle = new THREE.PointLight(0xffe94a, 0, 18); scene.add(muzzle);

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Game state ----------
const G = {
  running: false, dead: false, cleared: false,
  floor: 0, score: 0, combo: 0, comboT: 0, kills: 0,
  floorTime: 0, totalTime: 0,
  walls: [], // {minX,maxX,minZ,maxZ,mesh}
  enemies: [], pickups: [], bullets: [], tracers: [], parts: [], decals: [],
  mapW: 0, mapH: 0,
  shake: 0, hitstop: 0,
};

const player = {
  mesh: null, body: null, head: null, gunMesh: null,
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  angle: 0, radius: 0.55,
  weapon: 'bat', ammo: 0, cd: 0, swingT: 0,
  alive: true,
};

function maskStats(){ return MASKS[mask] || MASKS.tiger; }

// ---------- Procedural textures ----------
function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#14101f'; x.fillRect(0,0,512,512);
  // carpet noise
  for (let i=0;i<2600;i++){
    x.fillStyle = `rgba(${20+Math.random()*30|0},${10+Math.random()*20|0},${30+Math.random()*30|0},0.5)`;
    x.fillRect(Math.random()*512, Math.random()*512, 2, 2);
  }
  // neon grid
  x.strokeStyle = 'rgba(255,46,136,0.28)'; x.lineWidth = 2;
  for (let i=0;i<=8;i++){ x.beginPath(); x.moveTo(i*64,0); x.lineTo(i*64,512); x.stroke(); x.beginPath(); x.moveTo(0,i*64); x.lineTo(512,i*64); x.stroke(); }
  x.strokeStyle = 'rgba(34,230,255,0.16)'; x.lineWidth = 1;
  for (let i=0;i<=32;i++){ x.beginPath(); x.moveTo(i*16,0); x.lineTo(i*16,512); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const floorTex = floorTexture();

// ---------- Level build ----------
let levelGroup = null;
function clearLevel() {
  if (levelGroup) { scene.remove(levelGroup); levelGroup.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
  levelGroup = new THREE.Group(); scene.add(levelGroup);
  G.walls = []; G.enemies = []; G.pickups = []; G.bullets = []; G.tracers = []; G.parts = []; G.decals = [];
  // remove old dynamic meshes (they live in levelGroup anyway); reset player mesh
  player.mesh = null;
}

function buildLevel(idx) {
  clearLevel();
  const def = LEVELS[idx];
  const rows = def.map.map(r => r.split(''));
  const W = Math.max(...rows.map(r=>r.length)), H = rows.length;
  G.mapW = W*TILE; G.mapH = H*TILE;
  rows.forEach(r => { while (r.length < W) r.push('#'); });

  // floor
  floorTex.repeat.set(W/4, H/4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W*TILE, H*TILE),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI/2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  levelGroup.add(floor);
  // outer glow plane frame
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(W*TILE+1, 0.15, H*TILE+1),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 })
  );
  edge.position.y = -0.15; levelGroup.add(edge);
  // dark ground skirt far beyond the map so the frustum never shows pure void
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(W*TILE+160, H*TILE+160),
    new THREE.MeshBasicMaterial({ color: 0x070410 })
  );
  skirt.rotation.x = -Math.PI/2;
  skirt.position.y = -0.3; levelGroup.add(skirt);

  const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2140, roughness: 0.7, metalness: 0.25 });
  const topGeo = new THREE.BoxGeometry(TILE+0.06, 0.1, TILE+0.06);
  const topMat = new THREE.MeshBasicMaterial({ color: 0xff2e88 });

  let pSpawn = new THREE.Vector3(0,0,0);
  const enemySpawns = [], pickupSpawns = [];

  const ox = -W*TILE/2 + TILE/2, oz = -H*TILE/2 + TILE/2;
  for (let z=0; z<H; z++) for (let x=0; x<W; x++) {
    const ch = rows[z][x];
    const wx = ox + x*TILE, wz = oz + z*TILE;
    if (ch === '#') {
      const m = new THREE.Mesh(wallGeo, wallMat);
      m.position.set(wx, WALL_H/2, wz); m.castShadow = true; m.receiveShadow = true;
      levelGroup.add(m);
      const top = new THREE.Mesh(topGeo, (x+z)%2 ? topMat : new THREE.MeshBasicMaterial({color:0x22e6ff}));
      top.position.set(wx, WALL_H+0.02, wz); levelGroup.add(top);
      G.walls.push({ minX: wx-TILE/2, maxX: wx+TILE/2, minZ: wz-TILE/2, maxZ: wz+TILE/2 });
    } else {
      if (ch==='P') pSpawn.set(wx,0,wz);
      else if (ch==='m') enemySpawns.push({x:wx,z:wz,type:'melee'});
      else if (ch==='g') enemySpawns.push({x:wx,z:wz,type:'gun'});
      else if (ch==='b'||ch==='p'||ch==='u') pickupSpawns.push({x:wx,z:wz,kind:ch==='b'?'bat':ch==='p'?'pistol':'uzi'});
    }
  }

  // player
  makeHuman(player, 0xffe94a, 0x22e6ff, true);
  player.pos.copy(pSpawn); player.alive = true;
  player.weapon = 'bat'; player.ammo = 0; player.cd = 0;
  player.mesh.position.copy(player.pos);
  levelGroup.add(player.mesh);

  // enemies
  for (const s of enemySpawns) {
    const e = { pos: new THREE.Vector3(s.x,0,s.z), angle: Math.random()*Math.PI*2,
      type: s.type, alive: true, radius: 0.55,
      state: 'patrol', target: new THREE.Vector3(s.x,0,s.z),
      wanderT: Math.random()*3, shootCd: 1+Math.random()*2, windup: 0, seenT: 0, speed: 0,
      mesh:null, body:null, head:null, gunMesh:null };
    const jacket = s.type==='gun' ? 0xff3355 : 0xf2f2f2;
    makeHuman(e, jacket, s.type==='gun' ? 0x111111 : 0x222222, false);
    e.mesh.position.copy(e.pos);
    levelGroup.add(e.mesh);
    e.speed = s.type==='gun' ? 3.6 : 4.6 + Math.random()*0.9;
    G.enemies.push(e);
  }
  // pickups
  for (const s of pickupSpawns) spawnPickup(s.x, s.z, s.kind);

  G.floorTime = 0; G.combo = 0; G.comboT = 0; G.cleared = false; G.dead = false;
  updateHUD();
}

function makeHuman(ent, jacketColor, pantsColor, isPlayer) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.55, 4, 10),
    new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.6 })
  );
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 12),
    new THREE.MeshStandardMaterial({ color: isPlayer ? 0xffd9b3 : 0xe8b98a, roughness: 0.7 })
  );
  head.position.y = 1.5; head.castShadow = true; g.add(head);
  if (isPlayer) { // animal mask: box snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.22,0.24),
      new THREE.MeshStandardMaterial({ color: mask==='tiger'?0xff8800:mask==='horse'?0x8a5a2b:0xcccccc }));
    snout.position.set(0, 1.5, 0.32); g.add(snout);
  } else {
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.1,0.12),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    shades.position.set(0,1.55,0.26); g.add(shades);
  }
  // direction nose
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.5),
    new THREE.MeshBasicMaterial({ color: isPlayer?0x22e6ff:0xff2e88 }));
  nose.position.set(0, 0.8, 0.55); g.add(nose);
  // weapon in hand
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.9),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 }));
  gun.position.set(0.4, 0.9, 0.35); g.add(gun);
  ent.mesh = g; ent.body = body; ent.head = head; ent.gunMesh = gun;
  refreshWeaponMesh(ent, ent===player ? player.weapon : (ent.type==='gun'?'pistol':'fists'));
}
function refreshWeaponMesh(ent, w) {
  if (!ent.gunMesh) return;
  const m = ent.gunMesh;
  if (w==='fists' || !w) m.visible = false;
  else {
    m.visible = true;
    if (w==='bat') { m.scale.set(1.4,2.2,1.6); m.material.color.set(0x8a5a2b); }
    else if (w==='pistol') { m.scale.set(1,1,0.8); m.material.color.set(0x222222); }
    else { m.scale.set(1,1,1.3); m.material.color.set(0x555555); }
  }
}

const pickupMats = { bat: 0x8a5a2b, pistol: 0x333333, uzi: 0x888888 };
function spawnPickup(x, z, kind) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.08,16),
    new THREE.MeshBasicMaterial({ color: kind==='bat'?0x22e6ff:0xffe94a }));
  base.position.y = 0.05; g.add(base);
  const item = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,kind==='bat'?1.2:0.8),
    new THREE.MeshStandardMaterial({ color: pickupMats[kind], roughness:0.4, metalness:0.5 }));
  item.position.y = 0.35; item.rotation.y = Math.random()*Math.PI; item.castShadow = true; g.add(item);
  g.position.set(x, 0, z);
  levelGroup.add(g);
  G.pickups.push({ mesh: g, item, kind, x, z, taken: false, bob: Math.random()*6 });
}

// ---------- Collision & LOS ----------
function collideCircle(p, r) {
  for (const w of G.walls) {
    const cx = Math.max(w.minX, Math.min(p.x, w.maxX));
    const cz = Math.max(w.minZ, Math.min(p.z, w.maxZ));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx*dx + dz*dz;
    if (d2 < r*r) {
      if (d2 < 1e-8) { p.x += r*0.1; continue; }
      const d = Math.sqrt(d2), push = (r - d);
      p.x += (dx/d)*push; p.z += (dz/d)*push;
    }
  }
  const hx = G.mapW/2 - 0.6, hz = G.mapH/2 - 0.6;
  p.x = Math.max(-hx, Math.min(hx, p.x));
  p.z = Math.max(-hz, Math.min(hz, p.z));
}
function segHitsWall(x1,z1,x2,z2) {
  for (const w of G.walls) {
    if (segAABB(x1,z1,x2,z2,w)) return w;
  }
  return null;
}
function segAABB(x1,z1,x2,z2,w) {
  // slab test
  let tmin=0, tmax=1;
  const dx=x2-x1, dz=z2-z1;
  for (const [p,d,mn,mx] of [[x1,dx,w.minX,w.maxX],[z1,dz,w.minZ,w.maxZ]]) {
    if (Math.abs(d)<1e-9) { if (p<mn||p>mx) return false; }
    else {
      let t1=(mn-p)/d, t2=(mx-p)/d;
      if (t1>t2) [t1,t2]=[t2,t1];
      tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2);
      if (tmin>tmax) return false;
    }
  }
  return true;
}
function hasLOS(a, b) { return !segHitsWall(a.x, a.z, b.x, b.z); }
function wallDist(x,z,dx,dz,maxD) {
  let best = maxD;
  // march + refine via slab per wall (cheap: few hundred walls, few shots/frame OK)
  for (const w of G.walls) {
    const t = rayAABB(x,z,dx,dz,w);
    if (t!==null && t<best) best=t;
  }
  return best;
}
function rayAABB(x,z,dx,dz,w) {
  let tmin=0, tmax=Infinity;
  if (Math.abs(dx)<1e-9){ if(x<w.minX||x>w.maxX) return null; }
  else { let t1=(w.minX-x)/dx,t2=(w.maxX-x)/dx; if(t1>t2)[t1,t2]=[t2,t1]; tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2);}
  if (Math.abs(dz)<1e-9){ if(z<w.minZ||z>w.maxZ) return null; }
  else { let t1=(w.minZ-z)/dz,t2=(w.maxZ-z)/dz; if(t1>t2)[t1,t2]=[t2,t1]; tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2);}
  return tmin<=tmax ? tmin : null;
}

// ---------- Effects ----------
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8a0510 });
function bloodBurst(x, z, big=true) {
  const n = big ? 26 : 12;
  for (let i=0;i<n;i++){
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12),
      new THREE.MeshBasicMaterial({ color: Math.random()<0.3?0xd21a1a:0x8a0510 }));
    m.position.set(x, 0.6+Math.random()*0.8, z);
    levelGroup.add(m);
    G.parts.push({ mesh:m, vx:(Math.random()-0.5)*9, vy:Math.random()*6, vz:(Math.random()-0.5)*9, life:0.6+Math.random()*0.5 });
  }
  // floor decals
  for (let i=0;i<(big?5:2);i++){
    const s = 0.4+Math.random()*1.1;
    const d = new THREE.Mesh(new THREE.CircleGeometry(s, 10),
      new THREE.MeshBasicMaterial({ color:0x6d020d, transparent:true, opacity:0.9, depthWrite:false }));
    d.rotation.x = -Math.PI/2;
    d.rotation.z = Math.random()*Math.PI*2;
    d.position.set(x+(Math.random()-0.5)*1.6, 0.02 + G.decals.length*0.0006, z+(Math.random()-0.5)*1.6);
    d.scale.set(1, 0.6+Math.random()*0.6, 1);
    levelGroup.add(d); G.decals.push(d);
    if (G.decals.length>220){ const old=G.decals.shift(); levelGroup.remove(old); }
  }
  if (G.parts.length>260){ const ex=G.parts.splice(0, G.parts.length-260); ex.forEach(p=>levelGroup.remove(p.mesh)); }
}
function tracer(x1,z1,x2,z2,color=0xffe94a) {
  const g = new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(x1,1.0,z1), new THREE.Vector3(x2,1.0,z2)]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent:true, opacity:1 }));
  levelGroup.add(l);
  G.tracers.push({ mesh:l, life:0.09 });
}
function spawnEnemyBullet(x,z,angle) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.14,10,8),
    new THREE.MeshBasicMaterial({ color: 0xff4455 }));
  const glow = new THREE.PointLight(0xff2244, 4, 6); m.add(glow);
  m.position.set(x,1.0,z); levelGroup.add(m);
  G.bullets.push({ mesh:m, vx:Math.sin(angle)*17, vz:Math.cos(angle)*17, life:2.2, foe:true });
}
function flashKill() {
  const k = $('kill-flash'); k.style.opacity = 1;
  setTimeout(()=>k.style.opacity=0, 60);
}

// ---------- Input ----------
const keys = {};
addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (e.key==='m'||e.key==='M'){ muted=!muted; if(muted) stopMusic(); else if(G.running) startMusic(); }
  if (e.key==='r'||e.key==='R'){ if (G.running) restartFloor(); }
  if (e.key==='Enter'){ if (!clearEl.classList.contains('hidden')) nextFloor(); }
  if (e.key==='e'||e.key==='E'){ tryPickup(); }
});
addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const mouse = { x: innerWidth/2, y: innerHeight/2, down: false, pressed: false };
addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  crosshair.style.left = e.clientX+'px'; crosshair.style.top = e.clientY+'px';
});
addEventListener('mousedown', (e) => { if(e.button===0){ mouse.down=true; mouse.pressed=true; ac(); } });
addEventListener('mouseup', (e) => { if(e.button===0) mouse.down=false; });

// touch: left half move, right half aim+fire
const touches = { move: null, aim: null };
function touchPos(t){ return {x:t.clientX, y:t.clientY}; }
canvas.addEventListener('touchstart', (e)=>{ ac(); for(const t of e.changedTouches){
  const p=touchPos(t);
  if(p.x<innerWidth/2 && !touches.move) touches.move={id:t.identifier,sx:p.x,sy:p.y,dx:0,dy:0};
  else if(!touches.aim) touches.aim={id:t.identifier,sx:p.x,sy:p.y,dx:0,dy:0};
} showSticks(); e.preventDefault();},{passive:false});
canvas.addEventListener('touchmove', (e)=>{ for(const t of e.changedTouches){
  const p=touchPos(t);
  for(const k of ['move','aim']){ const s=touches[k]; if(s&&s.id===t.identifier){ s.dx=p.x-s.sx; s.dy=p.y-s.sy; } }
} moveSticks(); e.preventDefault();},{passive:false});
function endTouch(e){ for(const t of e.changedTouches){ for(const k of ['move','aim']) if(touches[k]?.id===t.identifier) touches[k]=null; }
  if(!touches.move&&!touches.aim){ $('stick-move').classList.add('hidden'); $('stick-aim').classList.add('hidden'); } }
canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
function showSticks(){
  if(touches.move){ const s=$('stick-move'); s.classList.remove('hidden'); s.style.left=(touches.move.sx-55)+'px'; s.style.top=(touches.move.sy-55)+'px'; }
  if(touches.aim){ const s=$('stick-aim'); s.classList.remove('hidden'); s.style.left=(touches.aim.sx-55)+'px'; s.style.top=(touches.aim.sy-55)+'px'; }
}
function moveSticks(){
  for(const [k,id] of [['move','stick-move'],['aim','stick-aim']]){ const s=touches[k]; if(!s) continue;
    const el=$(id).querySelector('.nub');
    el.style.transform=`translate(${Math.max(-30,Math.min(30,s.dx/3))}px,${Math.max(-30,Math.min(30,s.dy/3))}px)`; }
}

// ---------- Combat ----------
function playerAttack() {
  if (!player.alive || G.cleared || G.dead) return;
  if (player.cd > 0) return;
  const w = WEAPONS[player.weapon];
  const cdMul = (w.melee && mask==='tiger') ? maskStats().meleeCd : 1;
  player.cd = w.cooldown * cdMul;
  const dx = Math.sin(player.angle), dz = Math.cos(player.angle);
  const px = player.pos.x, pz = player.pos.z;
  muzzle.position.set(px+dx, 1.2, pz+dz);

  if (w.melee) {
    sfx.swing();
    player.swingT = 0.18;
    alertEnemies(px, pz, 9);
    let hitAny = false;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const ex = e.pos.x-px, ez = e.pos.z-pz;
      const d = Math.hypot(ex,ez);
      if (d > w.range + e.radius) continue;
      const ang = Math.atan2(ex,ez);
      let diff = Math.abs(ang-player.angle) % (Math.PI*2);
      if (diff > Math.PI) diff = Math.PI*2-diff;
      if (diff < w.arc || d < 1.0) {
        if (hasLOS(player.pos, e.pos)) { killEnemy(e, true); hitAny = true; }
      }
    }
    // swing arc visual
    const a2 = player.angle + 0.6;
    tracer(px+Math.sin(player.angle-0.6)*w.range, pz+Math.cos(player.angle-0.6)*w.range,
           px+Math.sin(a2)*w.range, pz+Math.cos(a2)*w.range, 0x22e6ff);
    if (hitAny){ G.shake=Math.min(0.5,G.shake+0.25); G.hitstop=0.06; }
  } else {
    if (player.ammo <= 0) { sfx.click(); player.cd = 0.25; autoSwapToMelee(); return; }
    player.ammo--;
    sfx.shoot(player.weapon==='uzi');
    muzzle.intensity = 30;
    setTimeout(()=>muzzle.intensity=0, 50);
    G.shake = Math.min(0.6, G.shake + (player.weapon==='uzi'?0.08:0.2));
    const spread = (Math.random()-0.5)*2*w.spread;
    const a = player.angle + spread;
    const dx2 = Math.sin(a), dz2 = Math.cos(a);
    const maxD = wallDist(px,pz,dx2,dz2,40);
    // nearest enemy along ray
    let best=null, bestD=maxD;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const rx = e.pos.x-px, rz = e.pos.z-pz;
      const along = rx*dx2 + rz*dz2;
      if (along<0 || along>bestD) continue;
      const perp = Math.abs(rx*dz2 - rz*dx2);
      if (perp < 0.55) { best=e; bestD=along; }
    }
    const hx = px+dx2*bestD, hz = pz+dz2*bestD;
    tracer(px+dx2*0.8, pz+dz2*0.8, hx, hz);
    bloodBurst(hx, hz, false);
    if (best) killEnemy(best, false);
    alertEnemies(px, pz, 30);
    if (player.ammo<=0) setTimeout(autoSwapToMelee, 250);
    updateHUD();
  }
}
function autoSwapToMelee(){ if(player.ammo<=0 && !WEAPONS[player.weapon].melee && player.alive){ player.weapon='fists'; refreshWeaponMesh(player,'fists'); updateHUD(); } }

function killEnemy(e, isMelee) {
  if (!e.alive) return;
  e.alive = false;
  e.mesh.visible = false;
  bloodBurst(e.pos.x, e.pos.z, true);
  sfx.splat();
  flashKill();
  G.kills++;
  // combo
  const now = performance.now()/1000;
  if (G.comboT > 0) G.combo++;
  else G.combo = 1;
  G.comboT = maskStats().comboWindow;
  const pts = 100 * Math.min(G.combo, 8) + (isMelee ? 25 : 0);
  G.score += pts;
  G.shake = Math.min(0.7, G.shake + 0.18);
  // drop weapon
  if (e.type==='gun' && Math.random()<0.75) spawnPickup(e.pos.x, e.pos.z, Math.random()<0.7?'pistol':'uzi');
  updateHUD();
  checkClear();
}
function killPlayer() {
  if (!player.alive || G.dead) return;
  player.alive = false; G.dead = true;
  bloodBurst(player.pos.x, player.pos.z, true);
  sfx.death(); sfx.splat();
  stopMusic();
  G.shake = 0.8;
  $('damage-flash').style.opacity = 1;
  setTimeout(()=>{ if(G.running){ deathEl.classList.remove('hidden'); $('death-msg').textContent =
    [`Wrong move. The phone rings again…`,`Miami doesn't forgive. Dial again.`,`You saw the masks. Now be the mess.`][G.floor % 3]; } }, 700);
}
function alertEnemies(x, z, radius) {
  for (const e of G.enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.pos.x-x, e.pos.z-z) < radius) { if (e.state==='patrol'){ e.state='chase'; e.seenT=2; } else e.seenT=2; }
  }
}
function checkClear() {
  if (G.cleared) return;
  if (G.enemies.length && G.enemies.every(e=>!e.alive)) {
    G.cleared = true;
    sfx.clear();
    const t = fmtTime(G.floorTime);
    $('clear-stats').textContent = `${LEVELS[G.floor].name} · Score ${G.score} · Kills ${G.kills} · ${t}`;
    setTimeout(()=>{ if(G.running && !G.dead) clearEl.classList.remove('hidden'); }, 600);
  }
}
function tryPickup() {
  if (!player.alive || G.dead || G.cleared) return;
  let best=null, bd=1.8;
  for (const p of G.pickups) {
    if (p.taken) continue;
    const d = Math.hypot(p.x-player.pos.x, p.z-player.pos.z);
    if (d<bd){ bd=d; best=p; }
  }
  if (!best) return;
  // drop current gun as pickup
  if (!WEAPONS[player.weapon].melee) spawnPickup(player.pos.x, player.pos.z, player.weapon);
  best.taken = true; levelGroup.remove(best.mesh);
  player.weapon = best.kind;
  player.ammo = best.kind==='pistol' ? 6 : best.kind==='uzi' ? 24 : 0;
  refreshWeaponMesh(player, player.weapon);
  sfx.pickup();
  updateHUD();
}

// ---------- Enemy AI ----------
function updateEnemies(dt) {
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z;
    const dist = Math.hypot(dx,dz) || 0.001;
    const canSee = player.alive && dist < (mask==='owl'?15:18) && hasLOS(e.pos, player.pos);

    if (canSee) { e.state='chase'; e.seenT = 1.5; }
    else if (e.seenT>0) e.seenT -= dt;
    else if (e.state==='chase' && e.seenT<=0) e.state='patrol';

    let mvx=0, mvz=0;
    if (e.state==='patrol') {
      e.wanderT -= dt;
      if (e.wanderT<=0 || Math.hypot(e.target.x-e.pos.x, e.target.z-e.pos.z)<1){
        e.wanderT = 2+Math.random()*3;
        e.target.set(e.pos.x+(Math.random()-0.5)*12, 0, e.pos.z+(Math.random()-0.5)*12);
      }
      const tx=e.target.x-e.pos.x, tz=e.target.z-e.pos.z, td=Math.hypot(tx,tz)||1;
      mvx=tx/td*e.speed*0.4; mvz=tz/td*e.speed*0.4;
      e.angle = lerpAngle(e.angle, Math.atan2(tx,tz), dt*3);
    } else {
      e.angle = lerpAngle(e.angle, Math.atan2(dx,dz), dt*8);
      if (e.type==='melee') {
        if (dist > 1.5) { mvx=dx/dist*e.speed; mvz=dz/dist*e.speed; e.windup=0; }
        else {
          // windup then kill
          e.windup += dt;
          // shake telegraph
          e.mesh.position.x = e.pos.x + (Math.random()-0.5)*0.08;
          if (e.windup > 0.32) {
            if (dist < 2.2 && player.alive && hasLOS(e.pos, player.pos)) { killPlayer(); }
            e.windup = -0.5; // cooldown pause
          }
        }
      } else {
        // gunner: keep distance ~9, strafe, shoot
        const want = 9;
        if (dist > want+2) { mvx=dx/dist*e.speed; mvz=dz/dist*e.speed; }
        else if (dist < want-3) { mvx=-dx/dist*e.speed; mvz=-dz/dist*e.speed; }
        else { const s = Math.sin(performance.now()/700 + e.pos.x); mvx=-dz/dist*e.speed*0.5*s; mvz=dx/dist*e.speed*0.5*s; }
        e.shootCd -= dt;
        if (e.shootCd<=0 && canSee && dist<16) {
          e.shootCd = 1.1 + Math.random()*0.9;
          const spread = (Math.random()-0.5)*0.25 + (dist>10?0.15:0);
          spawnEnemyBullet(e.pos.x, e.pos.z, Math.atan2(dx,dz)+spread);
          sfx.eshoot();
        }
      }
    }
    if (e.windup < 0) e.windup += dt;
    e.pos.x += mvx*dt; e.pos.z += mvz*dt;
    collideCircle(e.pos, e.radius);
    e.mesh.position.set(e.pos.x, 0, e.pos.z);
    e.mesh.rotation.y = e.angle;
    // run bob
    e.body.position.y = 0.75 + Math.abs(Math.sin(performance.now()/130 + e.pos.x))*0.06;
  }
}
function lerpAngle(a,b,t){
  let d=(b-a)%(Math.PI*2);
  if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2;
  return a+d*Math.min(1,t);
}

// ---------- HUD / flow ----------
function updateHUD(){
  hudFloor.textContent = `${G.floor+1}/${LEVELS.length}`;
  hudEnemies.textContent = G.enemies.filter(e=>e.alive).length;
  hudScore.textContent = G.score;
  const w = WEAPONS[player.weapon];
  hudWeapon.textContent = w.name;
  hudWeapon.style.color = w.melee ? '#22e6ff' : '#ffe94a';
  hudAmmo.textContent = w.melee ? (mask==='tiger'?'🐯 fast fists':mask==='horse'?'🐴 swift':'🦉 focused') : `▮`.repeat(Math.max(0,player.ammo)) + `▯`.repeat(Math.max(0,(player.weapon==='pistol'?6:24)-player.ammo));
  if (G.combo>1 && G.comboT>0){ hudCombo.classList.remove('hidden'); hudCombo.textContent=`x${Math.min(G.combo,8)} COMBO +${100*Math.min(G.combo,8)}`; }
  else hudCombo.classList.add('hidden');
}
function fmtTime(s){ const m=Math.floor(s/60), ss=Math.floor(s%60); return `${m}:${String(ss).padStart(2,'0')}`; }

function startGame(){
  ac(); startMusic();
  menuEl.classList.add('hidden'); deathEl.classList.add('hidden');
  clearEl.classList.add('hidden'); winEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  G.running = true; G.floor = 0; G.score = 0; G.kills = 0; G.totalTime = 0;
  G.floorBaseline = 0;
  mouse.down = false; mouse.pressed = false;
  buildLevel(0);
}
function restartFloor(){
  deathEl.classList.add('hidden'); clearEl.classList.add('hidden');
  $('damage-flash').style.opacity = 0;
  if(!G.running) return;
  startMusic();
  // rebuild same floor but keep score floor-baseline? simpler: subtract floor-earned? keep total simple: replay wipes floor kills only via stored baseline
  buildLevel(G.floor);
  // restore score baseline
  G.score = G.floorBaseline ?? (G.floor===0?0:G.score);
  updateHUD();
}
function nextFloor(){
  clearEl.classList.add('hidden');
  G.floorBaseline = G.score;
  if (G.floor+1 >= LEVELS.length) {
    winEl.classList.remove('hidden');
    $('win-stats').textContent = `All floors clean · Score ${G.score} · Kills ${G.kills} · Time ${fmtTime(G.totalTime)}`;
    stopMusic(); sfx.clear();
    G.running = false;
    return;
  }
  G.floor++;
  buildLevel(G.floor);
}
$('start-btn').addEventListener('click', ()=>{ G.floorBaseline=0; startGame(); });
$('retry-btn').addEventListener('click', restartFloor);
$('next-btn').addEventListener('click', nextFloor);
$('again-btn').addEventListener('click', ()=>{ winEl.classList.add('hidden'); G.floorBaseline=0; startGame(); });

// ---------- Main loop ----------
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const ndc = new THREE.Vector2();
const hitP = new THREE.Vector3();
const clock = new THREE.Clock();
// idle menu backdrop: build floor 0 behind menu
buildLevel(0); G.running = false;

function aimFromMouse(){
  ndc.set((mouse.x/innerWidth)*2-1, -(mouse.y/innerHeight)*2+1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(groundPlane, hitP)) {
    player.angle = Math.atan2(hitP.x - player.pos.x, hitP.z - player.pos.z);
  }
}

function update(dt){
  if (G.hitstop>0){ G.hitstop-=dt; return; }
  G.floorTime += dt; G.totalTime += dt;
  if (G.comboT>0){ G.comboT-=dt; if(G.comboT<=0) G.combo=0; }

  // --- player move ---
  const st = maskStats();
  const spd = 7.2 * st.speed;
  let ix=0, iz=0;
  if(keys['w']||keys['arrowup']) iz-=1;
  if(keys['s']||keys['arrowdown']) iz+=1;
  if(keys['a']||keys['arrowleft']) ix-=1;
  if(keys['d']||keys['arrowright']) ix+=1;
  if(touches.move){ ix+=touches.move.dx/40; iz+=touches.move.dy/40; }
  const il = Math.hypot(ix,iz);
  if(il>1){ ix/=il; iz/=il; }
  // camera-relative? world-aligned (top-down fixed) is classic
  player.pos.x += ix*spd*dt; player.pos.z += iz*spd*dt;
  collideCircle(player.pos, player.radius);

  // --- aim ---
  if(touches.aim && Math.hypot(touches.aim.dx,touches.aim.dy)>12){
    player.angle = Math.atan2(touches.aim.dx, touches.aim.dy);
    if(player.cd<=0) playerAttack();
  } else aimFromMouse();
  if ((mouse.down && (player.weapon==='uzi' ? true : mouse.pressed)) || keys[' ']) { playerAttack(); }
  mouse.pressed = false;
  if(keys[' ']) keys[' ']=false; // semi for space tap handled via pressed-like; allow hold for uzi
  player.cd = Math.max(0, player.cd-dt);
  player.swingT = Math.max(0, (player.swingT||0)-dt);

  updateEnemies(dt);

  // enemy bullets
  for(let i=G.bullets.length-1;i>=0;i--){
    const b=G.bullets[i];
    b.life-=dt;
    b.mesh.position.x+=b.vx*dt; b.mesh.position.z+=b.vz*dt;
    let dead=b.life<=0;
    if(!dead && segHitsWall(b.mesh.position.x-b.vx*dt, b.mesh.position.z-b.vz*dt, b.mesh.position.x, b.mesh.position.z)) dead=true;
    if(!dead && player.alive){
      const d=Math.hypot(b.mesh.position.x-player.pos.x, b.mesh.position.z-player.pos.z);
      if(d<0.6){ killPlayer(); dead=true; }
    }
    if(dead){ levelGroup.remove(b.mesh); G.bullets.splice(i,1); }
  }
  // tracers
  for(let i=G.tracers.length-1;i>=0;i--){
    const t=G.tracers[i]; t.life-=dt;
    t.mesh.material.opacity=Math.max(0,t.life/0.09);
    if(t.life<=0){ levelGroup.remove(t.mesh); t.mesh.geometry.dispose(); G.tracers.splice(i,1); }
  }
  // particles
  for(let i=G.parts.length-1;i>=0;i--){
    const p=G.parts[i]; p.life-=dt;
    p.vy-=18*dt;
    p.mesh.position.x+=p.vx*dt; p.mesh.position.y+=p.vy*dt; p.mesh.position.z+=p.vz*dt;
    if(p.mesh.position.y<0.06){ p.mesh.position.y=0.06; p.vy*=-0.3; p.vx*=0.7; p.vz*=0.7; }
    p.mesh.scale.setScalar(Math.max(0.05,p.life));
    if(p.life<=0){ levelGroup.remove(p.mesh); G.parts.splice(i,1); }
  }
  // pickups bob
  for(const p of G.pickups){ if(p.taken) continue; p.bob+=dt*3; p.item.position.y=0.35+Math.sin(p.bob)*0.08; p.item.rotation.y+=dt*1.5; }
  // auto pickup hint: E handled on key; also show nearest? skip

  // player mesh
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.angle;
  player.body.position.y = 0.75 + (il>0.1 ? Math.abs(Math.sin(performance.now()/120))*0.08 : 0);
  // swing anim
  if(player.swingT>0) player.gunMesh.rotation.x = -1.2*(player.swingT/0.18);
  else player.gunMesh.rotation.x = 0;

  // camera follow + shake
  G.shake = Math.max(0, G.shake - dt*1.8);
  const sh = G.shake*G.shake*2.2;
  const shx=(Math.random()-0.5)*sh, shz=(Math.random()-0.5)*sh;
  const camY=26, back=11;
  // clamp the look target toward the map interior so corners don't show mostly void
  const mX = Math.max(0, G.mapW/2 - 9), mZ = Math.max(0, G.mapH/2 - 8);
  const tx = Math.max(-mX, Math.min(mX, player.pos.x+shx));
  const tz = Math.max(-mZ, Math.min(mZ, player.pos.z-1+shz));
  camera.position.set(tx+shx*0.5, camY, tz+back+shz*0.5);
  camera.lookAt(tx, 0, tz);
  pinkLight.position.set(player.pos.x-12, 8, player.pos.z-8);
  cyanLight.position.set(player.pos.x+12, 8, player.pos.z+8);

  // muzzle decay
  if(muzzle.intensity>0) muzzle.intensity=Math.max(0,muzzle.intensity-dt*400);

  if(((G.floorTime*2)|0)%2===0) updateHUD();
  $('damage-flash').style.opacity = Math.max(0, parseFloat($('damage-flash').style.opacity||0)-dt*1.2);
}

function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if(G.running && !G.dead && !G.cleared) update(dt);
  else if(!G.running){
    // menu idle orbit
    const t=performance.now()/1000;
    camera.position.set(Math.sin(t*0.2)*16, 26, Math.cos(t*0.2)*16+8);
    camera.lookAt(0,0,0);
  } else if(G.running && (G.dead || G.cleared)){
    // still update particles/tracers for death drama
    G.shake=Math.max(0,G.shake-dt*1.8);
    for(let i=G.parts.length-1;i>=0;i--){ const p=G.parts[i]; p.life-=dt; p.vy-=18*dt;
      p.mesh.position.x+=p.vx*dt; p.mesh.position.y=Math.max(0.06,p.mesh.position.y+p.vy*dt); p.mesh.position.z+=p.vz*dt;
      if(p.life<=0){ levelGroup.remove(p.mesh); G.parts.splice(i,1); } }
  }
  renderer.render(scene, camera);
}
loop();
