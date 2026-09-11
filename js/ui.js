import { CFG } from './config.js';
import { sfx } from './audio.js';
import { isBuilding, makeRing } from './units.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game, controls) {
    this.game = game; this.controls = controls;
    this.rings = new Map();
    this.pings = [];
    this.mm = $('minimap'); this.mmCtx = this.mm.getContext('2d');
    this.lastMm = 0;
    game.onEvent = (t, d) => this.onGameEvent(t, d);
    $('btn-help').onclick = () => { $('help').hidden = false; };
    $('btn-close-help').onclick = () => { $('help').hidden = true; };
    $('btn-cam').onclick = () => controls.resetCam();
    $('btn-pause').onclick = () => this.togglePause();
    $('btn-restart').onclick = () => location.reload();
    // Auto-show help on first load; skippable for tests/screenshots via ?nohelp=1
    const skipHelp = new URLSearchParams(location.search).has('nohelp');
    if (!skipHelp) setTimeout(() => { if (!game.over) $('help').hidden = false; }, 600);
    // auto-hide objective
    setTimeout(() => { const o = $('objective'); if (o) o.style.opacity = '0.55'; }, 12000);
  }

  onGameEvent(type, data) {
    if (type === 'toast') this.toast(data);
    if (type === 'ui' || type === 'uiTick') this.refreshTop();
    if (type === 'gameover') this.gameOver(data);
  }

  toast(msg) {
    const box = $('toast');
    const div = document.createElement('div');
    div.className = 'toast-msg'; div.textContent = msg;
    box.appendChild(div);
    setTimeout(() => div.remove(), 3100);
    while (box.children.length > 3) box.firstChild.remove();
  }

  ping(pt) {
    this.pings.push({ x: pt.x, z: pt.z, t: 0 });
  }

  togglePause() {
    this.game.paused = !this.game.paused;
    $('btn-pause').textContent = this.game.paused ? '▶' : '⏸';
    this.toast(this.game.paused ? 'Paused (P)' : 'Resumed (P)');
  }

  gameOver({ win, msg }) {
    $('gameover').hidden = false;
    $('gameover-title').textContent = win ? '🏆 Victory!' : '💀 Defeat';
    $('gameover-title').style.color = win ? '#ffcf4d' : '#f85149';
    $('gameover-sub').textContent = `${msg}  Time: ${Math.floor(this.game.time / 60)}:${String(Math.floor(this.game.time % 60)).padStart(2, '0')} · Waves faced: ${this.game.waveNum}`;
  }

  sel() {
    return this.controls.selected();
  }

  trainFirst(kind) {
    const halls = this.sel().filter((e) => e.kind === 'townHall');
    const hall = halls[0] || this.game.entities.find((e) => e.alive && e.kind === 'townHall' && e.team === 'human');
    if (!hall) return;
    this.game.tryTrain(hall, kind);
    this.refresh();
  }

  buildFarm() {
    const p = this.sel().find((e) => e.kind === 'peasant');
    if (!p) { this.toast('Select a Peasant first, then press B'); sfx.error(); return; }
    this.game.tryBuildFarm(p);
    this.refresh();
  }

  refreshRings() {
    for (const [, r] of this.rings) r.visible = false;
    for (const id of this.game.selection) {
      const e = this.game.byId(id);
      if (!e?.alive) continue;
      let ring = this.rings.get(id);
      if (!ring) {
        const enemy = e.team === 'orc';
        ring = makeRing(enemy ? 0xf85149 : e.team === 'neutral' ? 0xffcf4d : 0x3fb950);
        ring.scale.setScalar(Math.max(1, (e.radius || 1) * 0.9));
        e.mesh.add(ring);
        this.rings.set(id, ring);
      }
      ring.visible = true;
    }
  }

  refreshTop() {
    $('res-gold').textContent = Math.floor(this.game.gold);
    $('res-wood').textContent = Math.floor(this.game.wood);
    $('res-food').textContent = `${this.game.foodUsed()}/${this.game.foodCap()}`;
    $('res-wave').textContent = this.game.waveNum === 0
      ? `Next ${Math.ceil(this.game.waveTimer)}s`
      : `Wave ${this.game.waveNum} · ${Math.ceil(this.game.waveTimer)}s`;
  }

  refresh() {
    this.refreshRings();
    this.refreshTop();
    const sel = this.sel();
    const nameEl = $('selname'), hpEl = $('selhp'), qEl = $('queue'), cmdEl = $('commands'), port = $('portrait');
    cmdEl.innerHTML = ''; qEl.innerHTML = '';
    if (!sel.length) {
      nameEl.textContent = 'Select units with left-click / drag box';
      hpEl.innerHTML = ''; port.firstChild.textContent = '🛡️'; $('portrait-sub').textContent = 'No selection';
      this.cmdButton(cmdEl, '❓ Help', 'controls (H)', () => { $('help').hidden = false; });
      return;
    }
    const first = sel[0];
    const icon = { peasant: '🔨', footman: '⚔️', grunt: '👹', townHall: '🏰', farm: '🌾', stronghold: '🗿', tower: '🗼', tree: '🌲', goldmine: '⛏️' }[first.kind] || '❔';
    port.firstChild.textContent = icon + ' ';
    $('portrait-sub').textContent = `${sel.length} selected`;
    if (sel.length === 1) {
      const e = first;
      nameEl.textContent = `${label(e)} ${e.hold ? '· HOLDING' : ''} ${e.carry ? `· carrying ${e.carryAmt} ${e.carry}` : ''}`;
      if (e.kind === 'tree') hpEl.textContent = `Wood remaining: ${e.wood}`;
      else if (e.kind === 'goldmine') hpEl.textContent = `Gold remaining: ${e.gold}`;
      else {
        hpEl.innerHTML = '';
        const bar = document.createElement('div');
        bar.className = 'hpbar' + (e.hp / e.maxHp < 0.35 ? ' low' : '');
        bar.innerHTML = `<i style="width:${(100 * e.hp / e.maxHp).toFixed(1)}%"></i>`;
        hpEl.append(`HP ${Math.ceil(e.hp)}/${e.maxHp} `, bar);
      }
      if (e.queue?.length) {
        qEl.append(...e.queue.map((k) => {
          const s = document.createElement('span'); s.className = 'qitem';
          const pct = e.queue[0] === k ? ` ${Math.floor((e.trainT / CFG.costs[k].time) * 100)}%` : '';
          s.textContent = (k === 'peasant' ? '🔨 Peasant' : '⚔️ Footman') + pct;
          return s;
        }));
      }
    } else {
      const counts = {};
      sel.forEach((e) => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
      nameEl.textContent = `Group of ${sel.length} — ` + Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
      const avg = sel.reduce((a, e) => a + e.hp / e.maxHp, 0) / sel.length;
      hpEl.innerHTML = '';
      const bar = document.createElement('div');
      bar.className = 'hpbar' + (avg < 0.35 ? ' low' : '');
      bar.innerHTML = `<i style="width:${(100 * avg).toFixed(1)}%"></i>`;
      hpEl.append('Average health ', bar);
    }

    const can = (fn) => fn();
    // commands
    if (first.kind === 'townHall' && first.team === 'human') {
      this.cmdButton(cmdEl, '🔨 Train Peasant', `${CFG.costs.peasant.gold}g · 6s (G)`, () => can(() => this.game.tryTrain(first, 'peasant') && this.refresh()),
        this.game.gold < CFG.costs.peasant.gold);
      this.cmdButton(cmdEl, '⚔️ Train Footman', `${CFG.costs.footman.gold}g ${CFG.costs.footman.wood}w · 9s (F)`, () => can(() => this.game.tryTrain(first, 'footman') && this.refresh()),
        this.game.gold < CFG.costs.footman.gold || this.game.wood < CFG.costs.footman.wood);
      this.cmdButton(cmdEl, '🚩 Rally', 'right-click map', () => this.toast('Select Town Hall, then right-click the map'));
    }
    if (sel.some((e) => e.kind === 'peasant')) {
      this.cmdButton(cmdEl, '🌾 Build Farm', `${CFG.costs.farm.wood}w +6🍖 (B)`, () => { this.buildFarm(); }, this.game.wood < CFG.costs.farm.wood);
    }
    if (sel.some((e) => !isBuilding(e.kind) && e.team === 'human')) {
      this.cmdButton(cmdEl, '💥 Attack', 'A + click (A)', () => this.controls.armAttackMove());
      this.cmdButton(cmdEl, '✋ Stop', 'halt (S)', () => { this.game.orderStop(sel); });
      this.cmdButton(cmdEl, first.hold ? '▶️ Unhold' : '🛑 Hold', 'hold pos (H)', () => { this.controls.toggleHold(); this.refresh(); });
    }
  }

  cmdButton(box, label, sub, fn, disabled = false) {
    const b = document.createElement('button');
    const [t, ...rest] = label.split(' ');
    b.innerHTML = `${label}<small>${sub}</small>`;
    void t; void rest;
    b.disabled = disabled;
    b.onclick = fn;
    box.appendChild(b);
  }

  drawMinimap(now) {
    if (now - this.lastMm < 250) return;
    this.lastMm = now;
    const c = this.mmCtx, W = this.mm.width, H = this.mm.height;
    const toMap = (x, z) => [((x / 76) + 0.5) * W, ((z / 76) + 0.5) * H];
    c.fillStyle = '#123a1a'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1d5e7e';
    c.fillRect(0, 0, W, 6); c.fillRect(0, H - 6, W, 6); c.fillRect(0, 0, 6, H); c.fillRect(W - 6, 0, 6, H);
    // gold mine
    for (const e of this.game.entities) {
      if (!e.alive) continue;
      const [mx, my] = toMap(e.mesh.position.x, e.mesh.position.z);
      if (e.kind === 'tree') { c.fillStyle = '#2d7a2e'; c.fillRect(mx - 1, my - 1, 2, 2); }
      else if (e.kind === 'goldmine') { c.fillStyle = '#ffcf4d'; c.fillRect(mx - 2, my - 2, 4, 4); }
      else if (e.team === 'human') { c.fillStyle = '#58a6ff'; c.fillRect(mx - 2, my - 2, e.kind.length > 6 ? 4 : 3, e.kind.length > 6 ? 4 : 3); }
      else if (e.team === 'orc') { c.fillStyle = '#f85149'; c.fillRect(mx - 2, my - 2, e.kind.length > 6 ? 4 : 3, e.kind.length > 6 ? 4 : 3); }
    }
    // view rect
    const [cx, cy] = toMap(this.controls.target.x, this.controls.target.z);
    c.strokeStyle = '#fff'; c.strokeRect(cx - 22, cy - 22, 44, 44);
    // selection
    c.fillStyle = '#fff';
    for (const id of this.game.selection) {
      const e = this.game.byId(id);
      if (!e?.alive) continue;
      const [mx, my] = toMap(e.mesh.position.x, e.mesh.position.z);
      c.strokeStyle = '#fff'; c.strokeRect(mx - 3, my - 3, 6, 6);
    }
  }
}

function label(e) {
  const names = {
    peasant: 'Peasant', footman: 'Footman', grunt: 'Grunt',
    townHall: 'Town Hall', farm: 'Farm', stronghold: 'Orc Stronghold',
    tower: 'Orc Tower', tree: 'Tree', goldmine: 'Gold Mine',
  };
  const team = e.team === 'human' ? ' (you)' : e.team === 'orc' ? ' (enemy)' : '';
  return (names[e.kind] || e.kind) + team;
}
