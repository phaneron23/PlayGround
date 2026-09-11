import * as THREE from 'three';
import { Game } from './game.js';
import { Controls } from './controls.js';
import { UI } from './ui.js';

async function boot() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1420);
  scene.fog = new THREE.Fog(0x0a1420, 70, 140);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a5f2f, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 1.6);
  sun.position.set(-30, 45, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  sun.shadow.camera.far = 140;
  scene.add(sun);

  const game = new Game(scene);
  game.init();

  const ui = new UI(game, null);
  const controls = new Controls(game, camera, renderer, ui);
  ui.controls = controls;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    controls.resizeSel();
  }
  window.addEventListener('resize', resize);
  resize();

  // initial selection: town hall
  const hall = game.entities.find((e) => e.kind === 'townHall');
  if (hall) game.selection = [hall.id];
  ui.refresh();

  document.getElementById('loading').classList.add('done');

  let last = performance.now();
  let uiTick = 0;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    controls.update(dt);
    game.update(dt);
    ui.drawMinimap(now);
    uiTick += dt;
    if (uiTick > 0.5) { uiTick = 0; ui.refreshTop(); }
    renderer.render(scene, camera);
  });
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<p>Failed to start: ${err.message}</p><p>Needs internet for the three.js CDN.</p>`;
});
