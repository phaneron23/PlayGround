import * as THREE from 'three';
import { CFG } from './config.js';
import { sfx } from './audio.js';
import {
  makePeasantMesh, makeFootmanMesh, makeGruntMesh, makeTownHallMesh,
  makeFarmMesh, makeStrongholdMesh, makeTowerMesh, makeRing, makeHpSprite,
  drawHp, unitRadius, isBuilding, STATS,
} from './units.js';
import { buildTerrain, scatterTrees, addGoldMine, groundHeight } from './world.js';

let uid = 1;

export class Game {
  constructor(scene) {
    this.scene = scene;
    this.entities = [];
    this.selection = [];
    this.gold = 450; this.wood = 250;
    this.time = 0; this.paused = false; this.over = null;
    this.waveNum = 0; this.waveTimer = CFG.wave.first;
    this.playerBase = { x: -20, z: 20 };
    this.enemyBase = { x: 20, z: -20 };
    this.minePos = { x: -14, z: 8 };
    this.rally = null;
    this.onEvent = null; // (type, data) => ui hook
  }
  nextId() { return uid++; }
  emit(t, d) { if (this.onEvent) this.onEvent(t, d); }

  foodUsed() {
    let f = 0;
    for (const e of this.entities) {
      if (!e.alive || e.team !== 'human') continue;
      if (e.kind === 'peasant') f += 1;
      if (e.kind === 'footman') f += 2;
      if (e.kind === 'grunt') f += 0;
    }
    return f;
  }
  foodCap() {
    let c = 0;
    for (const e of this.entities) {
      if (!e.alive || e.team !== 'human') continue;
      if (e.kind === 'townHall') c += 11;
      if (e.kind === 'farm') c += 6;
    }
    return c;
  }

  init() {
    buildTerrain(this.scene);
    scatterTrees(this.scene, this, 46);
    addGoldMine(this.scene, this);
    this.addBuilding('townHall', 'human', this.playerBase.x, this.playerBase.z);
    // starting peasants + footman
    for (let i = 0; i < 4; i++) this.addUnit('peasant', 'human', this.playerBase.x + 4 + i, this.playerBase.z + 3);
    this.addUnit('footman', 'human', this.playerBase.x + 5, this.playerBase.z - 4);
    // enemy base: stronghold + 2 towers + 2 starting grunts
    this.addBuilding('stronghold', 'orc', this.enemyBase.x, this.enemyBase.z);
    this.addBuilding('tower', 'orc', this.enemyBase.x - 7, this.enemyBase.z + 3);
    this.addBuilding('tower', 'orc', this.enemyBase.x + 3, this.enemyBase.z - 7);
    for (let i = 0; i < 2; i++) this.addUnit('grunt', 'orc', this.enemyBase.x - 4 + i * 3, this.enemyBase.z + 6);
    this.emit('toast', 'Train peasants (G), harvest gold & wood, build footmen (F)!');
  }

  byId(id) { return this.entities.find((e) => e.id === id); }

  addUnit(kind, team, x, z) {
    let mesh;
    if (kind === 'peasant') mesh = makePeasantMesh(team);
    else if (kind === 'footman') mesh = makeFootmanMesh();
    else mesh = makeGruntMesh();
    const st = STATS[kind];
    mesh.position.set(x, groundHeight(x, z), z);
    this.scene.add(mesh);
    const e = {
      id: this.nextId(), kind, team, mesh,
      hp: st.hp, maxHp: st.hp, dmg: st.dmg || 0, range: st.range || 2,
      cooldown: st.cooldown || 1, speed: st.speed || 6, sight: st.sight || 12,
      radius: unitRadius(kind), selectable: true, alive: true,
      dest: null, target: null, attackMove: null, hold: false,
      cd: 0, gatherT: 0, carry: null, carryAmt: 0, harvestNode: null,
      retarget: 0, walkPhase: Math.random() * 6, building: null,
    };
    mesh.userData.eid = e.id;
    mesh.traverse((o) => { o.userData.eid = e.id; });
    // hp bar
    const hp = makeHpSprite(); hp.visible = false;
    mesh.add(hp); e.hpSprite = hp;
    this.entities.push(e);
    return e;
  }

  addBuilding(kind, team, x, z, instant = true) {
    let mesh;
    if (kind === 'townHall') mesh = makeTownHallMesh();
    else if (kind === 'farm') mesh = makeFarmMesh();
    else if (kind === 'stronghold') mesh = makeStrongholdMesh();
    else mesh = makeTowerMesh();
    mesh.position.set(x, groundHeight(x, z), z);
    if (team === 'orc') mesh.rotation.y = Math.PI;
    this.scene.add(mesh);
    const st = STATS[kind];
    const e = {
      id: this.nextId(), kind, team, mesh,
      hp: instant ? st.hp : Math.round(st.hp * 0.25), maxHp: st.hp,
      dmg: st.dmg || 0, range: st.range || 0, cooldown: st.cooldown || 1.5,
      radius: unitRadius(kind), selectable: true, alive: true,
      dest: null, target: null, cd: 0, retarget: 0,
      queue: [], trainT: 0, constructing: !instant, buildT: 0,
      rally: null,
    };
    mesh.userData.eid = e.id;
    mesh.traverse((o) => { o.userData.eid = e.id; });
    const hp = makeHpSprite(); hp.position.y = kind === 'townHall' || kind === 'stronghold' ? 8 : 5; hp.visible = false;
    mesh.add(hp); e.hpSprite = hp;
    this.entities.push(e);
    return e;
  }

  // --- orders ---------------------------------------------------------------
  orderMove(list, x, z, attackMove = false) {
    let i = 0;
    for (const e of list) {
      if (!e.alive || isBuilding(e.kind)) continue;
      const ox = (i % 3 - 1) * 1.6, oz = (Math.floor(i / 3) % 3 - 1) * 1.6;
      e.dest = { x: x + ox, z: z + oz };
      e.target = null; e.harvestNode = null; e.carry = e.carry; // keep carry
      e.attackMove = attackMove ? { x, z } : null;
      e.building = null;
      i++;
    }
    sfx.order();
  }

  orderAttack(list, target) {
    for (const e of list) {
      if (!e.alive || isBuilding(e.kind)) continue;
      e.target = target; e.dest = null; e.attackMove = null; e.harvestNode = null; e.building = null;
    }
    sfx.order();
  }

  orderHarvest(peasants, node) {
    for (const e of peasants) {
      if (!e.alive || e.kind !== 'peasant') continue;
      e.harvestNode = node; e.target = null; e.dest = null; e.building = null; e.gatherT = 0;
    }
    sfx.order();
  }

  orderStop(list) {
    for (const e of list) {
      if (!e.alive) continue;
      e.dest = null; e.target = null; e.attackMove = null; e.harvestNode = null; e.building = null;
    }
  }

  tryTrain(hall, kind) {
    const cost = CFG.costs[kind];
    if (!hall?.alive || hall.team !== 'human') return false;
    if (this.gold < cost.gold || this.wood < cost.wood) { this.emit('toast', 'Not enough resources!'); sfx.error(); return false; }
    if (this.foodUsed() + cost.food > this.foodCap()) { this.emit('toast', 'Need more food — build a Farm (B)!'); sfx.error(); return false; }
    if (hall.queue.length >= 5) { this.emit('toast', 'Training queue is full!'); sfx.error(); return false; }
    this.gold -= cost.gold; this.wood -= cost.wood;
    hall.queue.push(kind);
    sfx.train();
    this.emit('ui', {});
    return true;
  }

  tryBuildFarm(peasant) {
    const cost = CFG.costs.farm;
    if (!peasant?.alive || peasant.kind !== 'peasant') return false;
    if (this.wood < cost.wood) { this.emit('toast', 'Not enough wood (100) for a Farm!'); sfx.error(); return false; }
    // find spot near peasant
    const px = peasant.mesh.position.x, pz = peasant.mesh.position.z;
    const spots = [];
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      spots.push({ x: px + Math.cos(ang) * 6, z: pz + Math.sin(ang) * 6 });
    }
    let spot = spots[0];
    for (const s of spots) {
      if (Math.abs(s.x) > 35 || Math.abs(s.z) > 35) continue;
      const blocked = this.entities.some((e) => e.alive && isBuilding(e.kind) &&
        Math.hypot(e.mesh.position.x - s.x, e.mesh.position.z - s.z) < e.radius + 3);
      if (!blocked) { spot = s; break; }
    }
    this.wood -= cost.wood;
    const farm = this.addBuilding('farm', 'human', spot.x, spot.z, false);
    peasant.building = farm; peasant.dest = { x: spot.x + 3, z: spot.z + 3 };
    peasant.target = null; peasant.harvestNode = null;
    farm.buildT = CFG.costs.farm.time;
    sfx.build();
    this.emit('toast', 'Peasant is constructing a Farm…');
    this.emit('ui', {});
    return true;
  }

  // Assign a peasant to (re)build an unfinished farm — e.g. right-click it.
  orderBuild(peasant, farm) {
    if (!peasant?.alive || peasant.kind !== 'peasant') return false;
    if (!farm?.alive || farm.kind !== 'farm' || !farm.constructing) return false;
    peasant.building = farm;
    peasant.dest = null; peasant.target = null; peasant.harvestNode = null; peasant.attackMove = null;
    sfx.order();
    return true;
  }

  nearestHall(pos, team = 'human') {
    let best = null, bd = 1e9;
    for (const e of this.entities) {
      if (!e.alive || e.team !== team) continue;
      if (e.kind !== 'townHall') continue;
      const d = Math.hypot(e.mesh.position.x - pos.x, e.mesh.position.z - pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  damage(target, amt, from) {
    if (!target?.alive || this.over) return;
    if (target.kind === 'tree' || target.kind === 'goldmine') return;
    target.hp -= amt;
    if (target.hpSprite) {
      target.hpSprite.visible = true;
      drawHp(target.hpSprite, target.hp / target.maxHp);
    }
    if (target.hp <= 0) this.kill(target, from);
    else if (!isBuilding(target.kind) && !target.target && !target.hold && Math.random() < 0.6) {
      // retaliate
      if (from?.alive && from.team !== target.team) target.target = from;
    }
  }

  kill(e, from) {
    e.alive = false;
    e.hp = 0;
    this.scene.remove(e.mesh);
    this.selection = this.selection.filter((s) => s !== e.id);
    if (e.kind === 'townHall' && e.team === 'human') return this.endGame(false, 'Your Town Hall has fallen!');
    if (e.kind === 'stronghold' && e.team === 'orc') return this.endGame(true, 'The Orc Stronghold lies in ruins!');
    if (from?.team === 'human' && (e.kind === 'grunt' || e.kind === 'tower')) {
      this.gold += e.kind === 'grunt' ? 25 : 60;
      sfx.gold();
    }
  }

  endGame(win, msg) {
    if (this.over) return;
    this.over = win ? 'win' : 'lose';
    if (win) sfx.win(); else sfx.lose();
    this.emit('gameover', { win, msg });
  }

  spawnWave() {
    this.waveNum++;
    const n = CFG.wave.base + this.waveNum * CFG.wave.growth;
    const hall = this.entities.find((e) => e.alive && e.kind === 'townHall' && e.team === 'human');
    for (let i = 0; i < n; i++) {
      const g = this.addUnit('grunt', 'orc', this.enemyBase.x + (i % 3 - 1) * 2.5, this.enemyBase.z + 4 + Math.floor(i / 3) * 2);
      if (hall) { g.target = null; g.attackMove = { x: hall.mesh.position.x, z: hall.mesh.position.z }; g.dest = { x: hall.mesh.position.x, z: hall.mesh.position.z }; }
    }
    this.emit('toast', `👹 Orc wave ${this.waveNum} attacks (${n} grunts)!`);
    this.waveTimer = CFG.wave.every;
  }

  // --- per-frame --------------------------------------------------------------
  update(dt) {
    if (this.paused || this.over) return;
    this.time += dt;

    // waves
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) this.spawnWave();

    for (const e of this.entities) {
      if (!e.alive) continue;
      e.cd = Math.max(0, (e.cd || 0) - dt);

      if (e.constructing) {
        // construction progresses when a peasant is close
        const worker = this.entities.find((w) => w.alive && w.kind === 'peasant' && w.building === e);
        if (worker) {
          const d = this.dist(worker, e);
          if (d < e.radius + 2.5) {
            e.buildT -= dt;
            e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * dt) / CFG.costs.farm.time);
            if (e.buildT <= 0) {
              e.constructing = false; e.hp = e.maxHp;
              worker.building = null;
              this.emit('toast', 'Farm complete! +6 food 🍖');
              sfx.build();
            }
          }
        }
        continue;
      }

      if (e.queue && e.queue.length) {
        e.trainT += dt;
        const kind = e.queue[0];
        const need = CFG.costs[kind].time;
        if (e.trainT >= need) {
          e.trainT = 0; e.queue.shift();
          const u = this.addUnit(kind, e.team, e.mesh.position.x + e.radius + 2, e.mesh.position.z + e.radius + 2);
          const r = e.rally || { x: e.mesh.position.x + 8, z: e.mesh.position.z + 8 };
          u.dest = { ...r };
          this.emit('toast', kind === 'peasant' ? 'Peasant ready! 🔨' : 'Footman ready! ⚔️');
          sfx.train();
        }
        this.emit('uiTick', {});
      }

      if (isBuilding(e.kind)) {
        if (e.dmg) this.buildingCombat(e, dt);
        continue;
      }

      this.unitAI(e, dt);
      this.moveUnit(e, dt);
      this.animate(e, dt);
    }

    // separation (cheap O(n^2), n is small)
    const movers = this.entities.filter((e) => e.alive && !isBuilding(e.kind));
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j];
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 1.4) {
          const push = (1.4 - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          a.mesh.position.x -= nx * push * 0.5; a.mesh.position.z -= nz * push * 0.5;
          b.mesh.position.x += nx * push * 0.5; b.mesh.position.z += nz * push * 0.5;
        }
      }
    }
  }

  dist(a, b) {
    return Math.hypot(a.mesh.position.x - b.mesh.position.x, a.mesh.position.z - b.mesh.position.z);
  }

  nearestEnemy(e, range) {
    let best = null, bd = range;
    for (const o of this.entities) {
      if (!o.alive || o.team === e.team || o.team === 'neutral') continue;
      if (o.kind === 'tree' || o.kind === 'goldmine') continue;
      const d = this.dist(e, o) - (o.radius || 0);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  unitAI(e, dt) {
    // validate target
    if (e.target && (!e.target.alive)) e.target = null;
    if (e.harvestNode && (!e.harvestNode.alive ||
        (e.harvestNode.kind === 'tree' && e.harvestNode.wood <= 0) ||
        (e.harvestNode.kind === 'goldmine' && e.harvestNode.gold <= 0))) {
      e.harvestNode = null;
    }

    // building task: walk to a standoff point inside build range, then stay
    if (e.building) {
      if (!e.building.alive) { e.building = null; }
      else {
        const b = e.building;
        const dx = e.mesh.position.x - b.mesh.position.x;
        const dz = e.mesh.position.z - b.mesh.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const want = b.radius + 1.8; // inside build range (radius+2.5), outside avoidance (radius+0.8)
        if (d > want) e.dest = { x: b.mesh.position.x + (dx / d) * want, z: b.mesh.position.z + (dz / d) * want };
        else e.dest = null;
        return;
      }
    }

    // harvesting state machine (peasants)
    if (e.kind === 'peasant' && (e.harvestNode || e.carry)) {
      this.harvestAI(e, dt);
      return;
    }

    // auto-acquire (military, or attack-moving peasants)
    e.retarget -= dt;
    if (!e.target && !e.hold && e.retarget <= 0) {
      e.retarget = 0.4;
      const aggro = e.attackMove ? 10 : (e.kind === 'peasant' ? 0 : e.sight);
      if (aggro > 0) {
        const foe = this.nearestEnemy(e, aggro);
        if (foe) { if (e.attackMove) { e.target = foe; } else if (e.kind !== 'peasant') e.target = foe; }
      }
    }

    if (e.target) {
      const t = e.target;
      const d = this.dist(e, t) - (t.radius || 0);
      if (d <= e.range) {
        e.dest = null;
        e.mesh.lookAt(t.mesh.position.x, e.mesh.position.y, t.mesh.position.z);
        if (e.cd <= 0) {
          e.cd = e.cooldown;
          e.lunge = 0.22;
          this.damage(t, e.dmg, e);
          if (Math.random() < 0.5) sfx.sword();
        }
      } else {
        e.dest = { x: t.mesh.position.x, z: t.mesh.position.z };
      }
      return;
    }

    if (e.attackMove && e.dest) {
      // arrival => clear attack-move
      const d = Math.hypot(e.mesh.position.x - e.dest.x, e.mesh.position.z - e.dest.z);
      if (d < 1.2) { e.dest = null; e.attackMove = null; }
    }
  }

  harvestAI(e, dt) {
    // returning with goods?
    if (e.carry) {
      const hall = this.nearestHall(e.mesh.position);
      if (!hall) { e.dest = null; return; }
      const d = Math.hypot(e.mesh.position.x - hall.mesh.position.x, e.mesh.position.z - hall.mesh.position.z);
      if (d < hall.radius + 3) {
        if (e.carry === 'gold') { this.gold += e.carryAmt; sfx.gold(); }
        else { this.wood += e.carryAmt; sfx.wood(); }
        e.carry = null; e.carryAmt = 0;
        // go back to node
        if (e.harvestNode?.alive) e.dest = this.standoff(e, e.harvestNode);
        else { e.harvestNode = null; e.dest = null; }
        this.emit('uiTick', {});
      } else {
        e.dest = { x: hall.mesh.position.x, z: hall.mesh.position.z };
      }
      return;
    }
    const node = e.harvestNode;
    if (!node) return;
    const d = Math.hypot(e.mesh.position.x - node.mesh.position.x, e.mesh.position.z - node.mesh.position.z);
    // Gather range (radius+2.0) comfortably exceeds standoff (radius+1.4) +
    // arrival threshold (0.4), so workers can never stall out of reach.
    if (d > node.radius + 2.0) {
      e.dest = this.standoff(e, node);
    } else {
      e.dest = null;
      e.mesh.lookAt(node.mesh.position.x, e.mesh.position.y, node.mesh.position.z);
      e.gatherT += dt;
      if (e.gatherT >= CFG.harvest.time) {
        e.gatherT = 0;
        if (node.kind === 'tree' && node.wood > 0) {
          const amt = Math.min(CFG.harvest.carry, node.wood);
          node.wood -= amt; e.carry = 'wood'; e.carryAmt = amt;
          if (node.wood <= 0) this.deplete(node);
        } else if (node.kind === 'goldmine' && node.gold > 0) {
          const amt = Math.min(CFG.harvest.carry, node.gold);
          node.gold -= amt; e.carry = 'gold'; e.carryAmt = amt;
          if (node.gold <= 0) this.deplete(node);
        }
      }
    }
  }

  standoff(e, node) {
    const dx = e.mesh.position.x - node.mesh.position.x;
    const dz = e.mesh.position.z - node.mesh.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const r = node.radius + 1.4;
    return { x: node.mesh.position.x + (dx / d) * r, z: node.mesh.position.z + (dz / d) * r };
  }

  deplete(node) {
    node.alive = false;
    this.scene.remove(node.mesh);
    this.emit('toast', node.kind === 'tree' ? 'A tree was harvested! 🌲' : 'The gold mine is exhausted! ⛏️');
  }

  buildingCombat(e, dt) {
    if (e.constructing) return;
    if (e.target && !e.target.alive) e.target = null;
    if (!e.target) {
      e.retarget -= dt;
      if (e.retarget <= 0) {
        e.retarget = 0.5;
        e.target = this.nearestEnemy(e, e.range);
      }
    }
    if (e.target && e.cd <= 0) {
      e.cd = e.cooldown;
      this.damage(e.target, e.dmg, e);
    }
  }

  moveUnit(e, dt) {
    if (!e.dest) return;
    const dx = e.dest.x - e.mesh.position.x;
    const dz = e.dest.z - e.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) { e.dest = null; return; }
    const sp = e.speed * dt;
    let dirx = dx / d, dirz = dz / d;
    // building avoidance: slide tangentially around buildings that block the
    // straight-line path (stateless — recomputed every frame, can't wedge)
    const px0 = e.mesh.position.x, pz0 = e.mesh.position.z;
    for (const o of this.entities) {
      if (!o.alive || !isBuilding(o.kind) || o === e) continue;
      if (o === e.building || o === e.target) continue; // approach targets freely; standoff logic handles range
      const min = o.radius + 1.0;
      const tox = o.mesh.position.x - px0, toz = o.mesh.position.z - pz0;
      const along = tox * dirx + toz * dirz; // obstacle ahead?
      if (along < 0 || along > d) continue; // behind us or beyond destination
      const perpx = tox - dirx * along, perpz = toz - dirz * along;
      if (Math.hypot(perpx, perpz) > min) continue; // path clears it
      // steer: tangent around the obstacle, keeping forward progress
      const od = Math.hypot(tox, toz) || 1;
      let tx = -toz / od, tz = tox / od;
      if (tx * dirx + tz * dirz < 0) { tx = -tx; tz = -tz; }
      const blend = 0.6;
      const mx = dirx * (1 - blend) + tx * blend;
      const mz = dirz * (1 - blend) + tz * blend;
      const ml = Math.hypot(mx, mz) || 1;
      dirx = mx / ml; dirz = mz / ml;
    }
    const step = Math.min(sp, d);
    let nxp = Math.max(-36, Math.min(36, e.mesh.position.x + dirx * step));
    let nzp = Math.max(-36, Math.min(36, e.mesh.position.z + dirz * step));
    e.mesh.position.x = nxp; e.mesh.position.z = nzp;
    e.mesh.position.y = groundHeight(nxp, nzp);
    e.mesh.lookAt(e.dest.x, e.mesh.position.y, e.dest.z);
    e.walkPhase += dt * 10;
  }

  animate(e, dt) {
    const p = e.mesh.userData.parts;
    if (!p) return;
    const moving = !!e.dest;
    const t = e.walkPhase || 0;
    if (moving) {
      p.legL.rotation.x = Math.sin(t) * 0.7;
      p.legR.rotation.x = -Math.sin(t) * 0.7;
      p.armR.rotation.x = -Math.sin(t) * 0.5;
      e.mesh.position.y += Math.abs(Math.sin(t)) * 0.02;
    } else {
      p.legL.rotation.x *= 0.9; p.legR.rotation.x *= 0.9; p.armR.rotation.x *= 0.9;
      p.torso.position.y = 1.45 + Math.sin(this.time * 2 + t) * 0.02;
    }
    if (e.lunge > 0) {
      e.lunge -= dt;
      p.armR.rotation.x = -1.4;
      p.sword.rotation.x = 1.2;
    } else {
      p.sword.rotation.x += (0.5 - p.sword.rotation.x) * 0.15;
    }
    // carry visual: sword hidden when carrying
    p.sword.visible = !e.carry;
  }
}
