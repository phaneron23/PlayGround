import * as THREE from 'three';
import { CFG } from './config.js';
import { isBuilding } from './units.js';
import { groundHeight } from './world.js';

// Camera rig + RTS selection/orders. Emits through callbacks into main.js
export class Controls {
  constructor(game, camera, renderer, ui) {
    this.game = game; this.camera = camera; this.renderer = renderer; this.ui = ui;
    this.target = new THREE.Vector3(-14, 0, 14);
    this.yaw = Math.PI * 0.25; this.dist = CFG.camDist;
    this.keys = {};
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragging = null; // {x0,y0,x1,y1, button}
    this.attackMoveArmed = false;
    this.middle = null;
    this.selCanvas = document.getElementById('selection-box');
    this.selCtx = this.selCanvas.getContext('2d');
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.bind();
    this.resizeSel();
  }

  resizeSel() {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.selCanvas.width = r.width; this.selCanvas.height = r.height;
  }

  bind() {
    window.addEventListener('resize', () => this.resizeSel());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'a') this.armAttackMove();
      if (e.key.toLowerCase() === 's') this.game.orderStop(this.selected());
      if (e.key.toLowerCase() === 'h') this.toggleHold();
      if (e.key.toLowerCase() === 'g') this.ui.trainFirst('peasant');
      if (e.key.toLowerCase() === 'f') this.ui.trainFirst('footman');
      if (e.key.toLowerCase() === 'b') this.ui.buildFarm();
      if (e.key.toLowerCase() === 'p') this.ui.togglePause();
      if (e.key.toLowerCase() === 'c') this.resetCam();
      if (e.key.toLowerCase() === 'r' && this.game.over) location.reload();
      if (e.key.toLowerCase() === 'escape') { this.attackMoveArmed = false; this.ui.refresh(); }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    const cv = this.renderer.domElement;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    cv.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.max(CFG.camMin, Math.min(CFG.camMax, this.dist + e.deltaY * 0.04));
    }, { passive: false });

    // minimap jump
    const mm = document.getElementById('minimap');
    const jump = (e) => {
      const r = mm.getBoundingClientRect();
      const fx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const fz = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.target.set(fx * 36, 0, fz * 36);
    };
    mm.addEventListener('pointerdown', jump);
    mm.addEventListener('pointermove', (e) => { if (e.buttons) jump(e); });
  }

  selected() {
    return this.game.selection.map((id) => this.game.byId(id)).filter((e) => e?.alive);
  }

  resetCam() {
    const sel = this.selected()[0];
    if (sel) this.target.copy(sel.mesh.position);
    else this.target.set(-14, 0, 14);
    this.yaw = Math.PI * 0.25; this.dist = CFG.camDist;
  }

  armAttackMove() {
    if (this.selected().some((e) => !isBuilding(e.kind))) {
      this.attackMoveArmed = true;
      this.ui.toast('Attack-move: left-click a location (A)');
    }
  }

  toggleHold() {
    for (const e of this.selected()) { e.hold = !e.hold; if (e.hold) e.dest = null; }
    this.ui.refresh();
  }

  pickEntity(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const meshes = [];
    for (const e of this.game.entities) {
      if (!e.alive || !e.selectable) continue;
      meshes.push(e.mesh);
    }
    const hits = this.ray.intersectObjects(meshes, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && o.userData.eid === undefined) o = o.parent;
    return o ? this.game.byId(o.userData.eid) : null;
  }

  groundPoint(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const pt = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.groundPlane, pt)) {
      pt.x = Math.max(-36, Math.min(36, pt.x));
      pt.z = Math.max(-36, Math.min(36, pt.z));
      pt.y = groundHeight(pt.x, pt.z);
      return pt;
    }
    return null;
  }

  onDown(e) {
    if (e.button === 1) { this.middle = { x: e.clientX, y: e.clientY, yaw: this.yaw, tx: this.target.x, tz: this.target.z }; return; }
    if (e.button === 2) { this.issueRight(e.clientX, e.clientY); return; }
    if (e.button === 0) {
      // attack-move consumes the click
      if (this.attackMoveArmed) {
        const pt = this.groundPoint(e.clientX, e.clientY);
        const foe = this.pickEntity(e.clientX, e.clientY);
        if (foe && foe.team !== 'human' && foe.team !== 'neutral') this.game.orderAttack(this.selected(), foe);
        else if (pt) this.game.orderMove(this.selected(), pt.x, pt.z, true);
        this.attackMoveArmed = false;
        this.ui.refresh();
        return;
      }
      this.dragging = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, moved: false };
    }
  }

  onMove(e) {
    if (this.middle) {
      const dx = e.clientX - this.middle.x, dy = e.clientY - this.middle.y;
      const s = this.dist / 500;
      const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
      this.target.x = THREE.MathUtils.clamp(this.middle.tx - (dx * cos - dy * sin) * s * 4, -36, 36);
      this.target.z = THREE.MathUtils.clamp(this.middle.tz - (dx * sin + dy * cos) * s * 4, -36, 36);
      return;
    }
    if (this.dragging) {
      this.dragging.x1 = e.clientX; this.dragging.y1 = e.clientY;
      if (Math.hypot(this.dragging.x1 - this.dragging.x0, this.dragging.y1 - this.dragging.y0) > 6) this.dragging.moved = true;
      this.drawBox();
    }
  }

  onUp(e) {
    if (e.button === 1) { this.middle = null; return; }
    if (e.button !== 0 || !this.dragging) return;
    const d = this.dragging; this.dragging = null;
    this.selCtx.clearRect(0, 0, this.selCanvas.width, this.selCanvas.height);
    if (!d.moved) {
      const ent = this.pickEntity(e.clientX, e.clientY);
      if (ent) this.select(ent, e.shiftKey);
      else if (!e.shiftKey) this.setSelection([]);
    } else {
      this.boxSelect(d, e.shiftKey);
    }
    this.ui.refresh();
  }

  drawBox() {
    const c = this.selCtx;
    const r = this.renderer.domElement.getBoundingClientRect();
    const sx = this.selCanvas.width / r.width, sy = this.selCanvas.height / r.height;
    c.clearRect(0, 0, this.selCanvas.width, this.selCanvas.height);
    const d = this.dragging;
    c.strokeStyle = '#3fb950'; c.lineWidth = 2;
    c.fillStyle = 'rgba(63,185,80,.15)';
    const x = Math.min(d.x0, d.x1) - r.left, y = Math.min(d.y0, d.y1) - r.top;
    const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
    c.fillRect(x * sx, y * sy, w * sx, h * sy);
    c.strokeRect(x * sx, y * sy, w * sx, h * sy);
  }

  setSelection(list) {
    this.game.selection = list.filter((e) => e?.alive).map((e) => e.id);
    this.ui.refreshRings();
  }

  select(ent, additive) {
    import('./audio.js').then(({ sfx }) => sfx.select());
    // buildings select solo; units combine
    if (isBuilding(ent.kind)) { this.setSelection([ent]); return; }
    if (ent.team === 'orc' || ent.team === 'neutral') { this.setSelection([ent]); return; }
    if (!additive) this.setSelection([ent]);
    else {
      const cur = this.selected().filter((e) => !isBuilding(e.kind) && e.team === 'human');
      if (!cur.includes(ent)) cur.push(ent);
      this.setSelection(cur);
    }
  }

  boxSelect(d, additive) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1);
    const y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    const v = new THREE.Vector3();
    const found = [];
    for (const e of this.game.entities) {
      if (!e.alive || e.team !== 'human' || isBuilding(e.kind)) continue;
      v.copy(e.mesh.position); v.y += 1.5; v.project(this.camera);
      const sx = r.left + ((v.x + 1) / 2) * r.width;
      const sy = r.top + ((1 - v.y) / 2) * r.height;
      if (v.z < 1 && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) found.push(e);
    }
    if (!found.length) return;
    if (!additive) this.setSelection(found.slice(0, 12));
    else {
      const cur = this.selected();
      for (const e of found) if (!cur.includes(e) && cur.length < 12) cur.push(e);
      this.setSelection(cur);
    }
    import('./audio.js').then(({ sfx }) => sfx.select());
  }

  issueRight(cx, cy) {
    const sel = this.selected().filter((e) => !isBuilding(e.kind));
    if (!sel.length) {
      // set rally point
      const halls = this.selected().filter((e) => e.kind === 'townHall');
      const pt = this.groundPoint(cx, cy);
      if (halls.length && pt) { halls.forEach((h) => (h.rally = { x: pt.x, z: pt.z })); this.ui.toast('Rally point set'); }
      return;
    }
    const foe = this.pickEntity(cx, cy);
    if (foe && foe.kind === 'farm' && foe.team === 'human' && foe.constructing) {
      // resume construction with selected peasants
      const peasants = sel.filter((e) => e.kind === 'peasant');
      const others = sel.filter((e) => e.kind !== 'peasant');
      let ok = false;
      for (const p of peasants) ok = this.game.orderBuild(p, foe) || ok;
      const pt = this.groundPoint(cx, cy);
      if (others.length && pt) this.game.orderMove(others, pt.x, pt.z);
      if (ok) this.ui.toast('Peasant resuming Farm construction…');
      this.ui.refresh();
      return;
    }
    if (foe && foe.team !== 'human' && foe.team !== 'neutral' && foe.kind !== 'tree' && foe.kind !== 'goldmine') {
      this.game.orderAttack(sel, foe);
      this.ui.refresh();
      return;
    }
    if (foe && (foe.kind === 'tree' || foe.kind === 'goldmine')) {
      const peasants = sel.filter((e) => e.kind === 'peasant');
      if (peasants.length) {
        const others = sel.filter((e) => e.kind !== 'peasant');
        this.game.orderHarvest(peasants, foe);
        const pt = this.groundPoint(cx, cy);
        if (others.length && pt) this.game.orderMove(others, pt.x, pt.z);
      } else {
        const pt = this.groundPoint(cx, cy);
        if (pt) this.game.orderMove(sel, pt.x, pt.z);
      }
      this.ui.refresh();
      return;
    }
    const pt = this.groundPoint(cx, cy);
    if (pt) { this.game.orderMove(sel, pt.x, pt.z); this.ui.ping(pt); }
    this.ui.refresh();
  }

  update(dt) {
    const sp = (this.dist * 0.55 + 8) * dt;
    let mx = 0, mz = 0;
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    const fwd = { x: -sin, z: -cos }, right = { x: cos, z: -sin };
    // WASD + arrows pan. A/D also pan (A keydown only arms attack-move once).
    if (this.keys['w'] || this.keys['arrowup']) { mx += fwd.x * sp; mz += fwd.z * sp; }
    if (this.keys['s'] || this.keys['arrowdown']) { mx -= fwd.x * sp; mz -= fwd.z * sp; }
    if (this.keys['a'] || this.keys['arrowleft']) { mx -= right.x * sp; mz -= right.z * sp; }
    if (this.keys['d'] || this.keys['arrowright']) { mx += right.x * sp; mz += right.z * sp; }
    if (this.keys['q']) this.yaw += dt * 1.6;
    if (this.keys['e']) this.yaw -= dt * 1.6;
    this.target.x = THREE.MathUtils.clamp(this.target.x + mx, -38, 38);
    this.target.z = THREE.MathUtils.clamp(this.target.z + mz, -38, 38);

    const cx = this.target.x + Math.sin(this.yaw) * this.dist * 0.75;
    const cz = this.target.z + Math.cos(this.yaw) * this.dist * 0.75;
    const cy = this.dist * 0.85;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.target.x, 0, this.target.z);
  }
}
