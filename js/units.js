import * as THREE from 'three';
import { CFG } from './config.js';

let uid = 1;
export const nextId = () => uid++;

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function teamColor(team) {
  return team === 'human' ? 0x2f6fed : team === 'orc' ? 0xd23b2e : 0x9a9a9a;
}

// --- low-poly humanoid -------------------------------------------------------
export function makeHumanoid({ skin = 0xe8b98a, cloth = 0x2f6fed, trim = 0xffffff, weapon = 0xb9c2cc, orc = false } = {}) {
  const g = new THREE.Group();
  const legM = mat(0x4a3826);
  const bodyM = mat(cloth);
  const skinM = mat(skin);
  const trimM = mat(trim);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.42), legM);
  const legR = legL.clone();
  legL.position.set(-0.25, 0.45, 0); legR.position.set(0.25, 0.45, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.6), bodyM);
  torso.position.y = 1.45;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.18, 0.64), trimM);
  belt.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), skinM);
  head.position.y = 2.32;
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.7), trimM);
  helm.position.y = 2.62;
  if (orc) {
    const tuskL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), mat(0xfff6d8));
    const tuskR = tuskL.clone();
    tuskL.position.set(-0.2, 2.05, 0.33); tuskR.position.set(0.2, 2.05, 0.33);
    g.add(tuskL, tuskR);
  }
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.0, 0.32), bodyM);
  const armR = armL.clone();
  armL.position.set(-0.68, 1.5, 0); armR.position.set(0.68, 1.5, 0);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.3, 0.22), mat(weapon));
  sword.position.set(0.68, 1.1, 0.5); sword.rotation.x = 0.5;
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.7), mat(0x7a4a1f));
  shield.position.set(-0.85, 1.4, 0.1);

  g.add(legL, legR, torso, belt, head, helm, armL, armR, sword, shield);
  g.userData.parts = { legL, legR, armR, sword, torso, head };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makePeasantMesh(team) {
  const blue = team === 'human';
  return makeHumanoid({
    cloth: blue ? 0x8a6b3a : 0x5a4a2a, trim: blue ? 0x2f6fed : 0xd23b2e,
    skin: blue ? 0xe8b98a : 0x6fae4e, weapon: 0x8a6b3a, orc: !blue,
  });
}

export function makeFootmanMesh() {
  return makeHumanoid({ cloth: 0x2f6fed, trim: 0xcfd8e3, skin: 0xe8b98a, weapon: 0xd7dee8 });
}

export function makeGruntMesh() {
  const g = makeHumanoid({ cloth: 0x3a3a3a, trim: 0xd23b2e, skin: 0x6fae4e, weapon: 0x555f6a, orc: true });
  g.scale.setScalar(1.15);
  return g;
}

// --- buildings ---------------------------------------------------------------
function baseBox(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function makeTownHallMesh() {
  const g = new THREE.Group();
  const main = baseBox(7, 4, 6, 0xd9c9a3); main.position.y = 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.6, 4), mat(0x2f6fed));
  roof.position.y = 5.2; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  const door = baseBox(1.8, 2.4, 0.3, 0x4a2f16); door.position.set(0, 1.2, 3.05);
  const trim = baseBox(7.3, 0.5, 6.3, 0x8a6d2f); trim.position.y = 4.1;
  const flag = baseBox(0.12, 3, 0.12, 0x5a4a2a); flag.position.set(2.4, 6.4, 0);
  const cloth = baseBox(1.4, 0.9, 0.06, 0x2f6fed); cloth.position.set(3.1, 7.3, 0);
  g.add(main, roof, door, trim, flag, cloth);
  return g;
}

export function makeFarmMesh() {
  const g = new THREE.Group();
  const main = baseBox(4.4, 2.6, 3.6, 0xc9a06a); main.position.y = 1.3;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.8, 4), mat(0xa33f2e));
  roof.position.y = 3.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(main, roof);
  return g;
}

export function makeStrongholdMesh() {
  const g = new THREE.Group();
  const main = baseBox(8, 5, 7, 0x4a4a4a); main.position.y = 2.5;
  const spikes = [];
  for (let i = -3; i <= 3; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 5), mat(0xd8cfb8));
    s.position.set(i * 1.1, 6.2, 0); s.castShadow = true; spikes.push(s);
  }
  const gate = baseBox(2.4, 3, 0.4, 0x1c0f08); gate.position.set(0, 1.5, 3.6);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 7.2), new THREE.MeshBasicMaterial({ color: 0xff4d2e }));
  glow.position.y = 0.25;
  g.add(main, gate, glow, ...spikes);
  return g;
}

export function makeTowerMesh() {
  const g = new THREE.Group();
  const post = baseBox(2.2, 5, 2.2, 0x5a4630); post.position.y = 2.5;
  const top = baseBox(3.4, 1.6, 3.4, 0x3d3225); top.position.y = 5.8;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), mat(0xd23b2e));
  roof.position.y = 7.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(post, top, roof);
  return g;
}

export function makeTreeMesh() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.8, 6), mat(0x6b4a2a));
  trunk.position.y = 0.9; trunk.castShadow = true;
  const c = [0x2d6a2e, 0x35923a, 0x1f5223][Math.floor(Math.random() * 3)];
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.4, 7), mat(c));
  top.position.y = 3.2; top.castShadow = true;
  g.add(trunk, top);
  const s = 0.8 + Math.random() * 0.7;
  g.scale.setScalar(s);
  return g;
}

export function makeGoldMineMesh() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 0), mat(0x8a8a8a));
  rock.position.y = 1.6; rock.scale.y = 0.75; rock.castShadow = true; rock.receiveShadow = true;
  const gold = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0),
    new THREE.MeshLambertMaterial({ color: 0xffcf4d, emissive: 0x6b4d00 }));
  gold.position.set(0.6, 1.4, 1.6);
  g.add(rock, gold);
  return g;
}

// --- selection ring / hp bar sprites -----------------------------------------
export function makeRing(color = 0x3fb950) {
  const geo = new THREE.RingGeometry(1.1, 1.45, 28);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.08;
  return m;
}

const hpCanvas = document.createElement('canvas');
hpCanvas.width = 64; hpCanvas.height = 8;
export function makeHpSprite() {
  const tex = new THREE.CanvasTexture(hpCanvas);
  const m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const s = new THREE.Sprite(m);
  s.scale.set(3.4, 0.45, 1);
  s.position.y = 3.6;
  s.userData.tex = tex;
  return s;
}

export function drawHp(sprite, frac) {
  const c = hpCanvas.getContext('2d');
  // NOTE: shared canvas; fine for small unit counts. Redraw per sprite is cheap enough.
  c.clearRect(0, 0, 64, 8);
  c.fillStyle = '#300'; c.fillRect(0, 0, 64, 8);
  c.fillStyle = frac > 0.35 ? '#3fb950' : '#f85149';
  c.fillRect(1, 1, 62 * Math.max(0, frac), 6);
  sprite.userData.tex.needsUpdate = true;
}

export function unitRadius(kind) {
  if (kind === 'townHall' || kind === 'stronghold') return 5;
  if (kind === 'farm') return 3;
  if (kind === 'tower') return 2.4;
  if (kind === 'goldmine') return 4;
  if (kind === 'tree') return 1.2;
  return 1;
}

export function isBuilding(kind) {
  return kind === 'townHall' || kind === 'farm' || kind === 'stronghold' || kind === 'tower';
}

export { teamColor };
export const STATS = CFG.stats;
