import * as THREE from 'three';
import { CFG } from './config.js';
import { makeTreeMesh, makeGoldMineMesh } from './units.js';

export function rand(min, max) { return min + Math.random() * (max - min); }

export function buildTerrain(scene) {
  const size = CFG.world;
  const geo = new THREE.PlaneGeometry(size, size, 64, 64);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const cGrass = new THREE.Color(0x3f7a34);
  const cGrass2 = new THREE.Color(0x4d8a3a);
  const cDirt = new THREE.Color(0x8a6f3f);
  const cSand = new THREE.Color(0xb8a05e);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.max(Math.abs(x), Math.abs(z));
    let h = 0;
    h += Math.sin(x * 0.25) * Math.cos(z * 0.22) * 0.35;
    h += Math.sin(x * 0.06 + 2) * 0.5;
    if (d > size / 2 - 6) h -= (d - (size / 2 - 6)) * 0.8; // water moat edge
    pos.setY(i, h);
    const n = Math.sin(x * 0.8) * Math.cos(z * 0.7);
    const c = n > 0.3 ? cGrass2.clone() : cGrass.clone();
    if (Math.abs(x + 10) < 3 && z > -30 && z < 30) c.lerp(cDirt, 0.55); // dirt road
    if (d > size / 2 - 7) c.lerp(new THREE.Color(0x1d4e6b), 0.75);
    if (Math.abs(x) < 2 && Math.abs(z) < 2) c.lerp(cSand, 0.3);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // water plane
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 60, size + 60),
    new THREE.MeshLambertMaterial({ color: 0x1d5e7e, transparent: true, opacity: 0.9 })
  );
  water.rotation.x = -Math.PI / 2; water.position.y = -2.2;
  scene.add(water);

  // scattered rocks / grass tufts
  const rockM = new THREE.MeshLambertMaterial({ color: 0x777777 });
  for (let i = 0; i < 14; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 1.1), 0), rockM);
    r.position.set(rand(-34, 34), 0.3, rand(-34, 34));
    r.castShadow = true;
    scene.add(r);
  }
  return ground;
}

export function scatterTrees(scene, game, count = 46) {
  // keep clear of bases + road
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard++ < 800) {
    const x = rand(-34, 34), z = rand(-34, 34);
    if (Math.hypot(x - game.playerBase.x, z - game.playerBase.z) < 12) continue;
    if (Math.hypot(x - game.enemyBase.x, z - game.enemyBase.z) < 12) continue;
    if (Math.abs(x + 10) < 5) continue;
    if (Math.hypot(x - game.minePos.x, z - game.minePos.z) < 6) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 3)) continue;
    spots.push({ x, z });
  }
  for (const s of spots) {
    const mesh = makeTreeMesh();
    mesh.position.set(s.x, 0, s.z);
    scene.add(mesh);
    game.entities.push({
      id: game.nextId(), kind: 'tree', team: 'neutral', hp: 1, maxHp: 1,
      wood: 150, mesh, radius: 1.2, selectable: true, alive: true,
    });
    mesh.userData.eid = game.entities[game.entities.length - 1].id;
  }
}

export function addGoldMine(scene, game) {
  const mesh = makeGoldMineMesh();
  mesh.position.set(game.minePos.x, 0, game.minePos.z);
  scene.add(mesh);
  game.entities.push({
    id: game.nextId(), kind: 'goldmine', team: 'neutral', hp: 1, maxHp: 1,
    gold: 2500, mesh, radius: 4, selectable: true, alive: true,
  });
  mesh.userData.eid = game.entities[game.entities.length - 1].id;
}

export function groundHeight(x, z) {
  return Math.sin(x * 0.25) * Math.cos(z * 0.22) * 0.35 + Math.sin(x * 0.06 + 2) * 0.5;
}
