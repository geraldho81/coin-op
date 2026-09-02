export const FB_W = 400;
export const FB_H = 250;
export const FOV = 0.9;
export const PLANE = Math.tan(FOV / 2);

export type Mode =
  | "attract"
  | "insert"
  | "ready"
  | "play"
  | "wave"
  | "dead"
  | "continue"
  | "gameover"
  | "initials";

export type EnemyKind = "grunt" | "runner" | "tank";

export type Enemy = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  kind: EnemyKind;
  speed: number;
  dmg: number;
  score: number;
  alive: boolean;
  hitFlash: number;
  biteCd: number;
};

export type PickupKind = "health" | "ammo" | "credit";

export type Pickup = {
  x: number;
  y: number;
  kind: PickupKind;
  t: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
  g: number;
  b: number;
};

export type ScoreRow = {
  initials: string;
  score: number;
  wave: number;
};

export type Game = {
  mode: Mode;
  px: number;
  py: number;
  pa: number;
  hp: number;
  ammo: number;
  score: number;
  wave: number;
  lives: number;
  credits: number;
  enemies: Enemy[];
  pickups: Pickup[];
  particles: Particle[];
  zbuf: Float32Array;
  fireCd: number;
  muzzle: number;
  hurt: number;
  shake: number;
  weaponKick: number;
  time: number;
  overlayT: number;
  continueT: number;
  initials: [string, string, string];
  cursor: number;
  board: ScoreRow[];
  high: number;
};

import { MAP_H, MAP_W, SPAWNS, START, isWall } from "./map";

export function makeGame(credits = 1): Game {
  return {
    mode: "attract",
    px: START.x,
    py: START.y,
    pa: START.a,
    hp: 100,
    ammo: 40,
    score: 0,
    wave: 0,
    lives: 3,
    credits,
    enemies: [],
    pickups: [],
    particles: [],
    zbuf: new Float32Array(FB_W),
    fireCd: 0,
    muzzle: 0,
    hurt: 0,
    shake: 0,
    weaponKick: 0,
    time: 0,
    overlayT: 0,
    continueT: 9,
    initials: ["A", "A", "A"],
    cursor: 0,
    board: [],
    high: 20000,
  };
}

function enemyStats(kind: EnemyKind): Omit<Enemy, "x" | "y" | "alive" | "hitFlash" | "biteCd"> {
  if (kind === "runner") {
    return { hp: 18, maxHp: 18, kind, speed: 2.6, dmg: 7, score: 250 };
  }
  if (kind === "tank") {
    return { hp: 90, maxHp: 90, kind, speed: 0.95, dmg: 18, score: 800 };
  }
  return { hp: 34, maxHp: 34, kind, speed: 1.45, dmg: 10, score: 120 };
}

function pickKind(wave: number): EnemyKind {
  const r = Math.random();
  if (wave >= 5 && r < 0.18) return "tank";
  if (wave >= 2 && r < 0.42) return "runner";
  return "grunt";
}

export function spawnWave(g: Game) {
  g.wave += 1;
  g.enemies = [];
  const n = 4 + g.wave * 2;
  for (let i = 0; i < n; i++) {
    const s = SPAWNS[(i * 3 + g.wave) % SPAWNS.length];
    const jitter = (Math.random() - 0.5) * 0.4;
    const kind = pickKind(g.wave);
    g.enemies.push({
      ...enemyStats(kind),
      x: s.x + jitter,
      y: s.y + jitter * 0.5,
      alive: true,
      hitFlash: 0,
      biteCd: 0,
    });
  }
  if (g.wave % 2 === 0) {
    g.pickups.push({
      x: 11.5,
      y: 10.5,
      kind: "health",
      t: 0,
    });
  }
  if (g.wave % 3 === 0) {
    g.pickups.push({ x: 4.5, y: 15.5, kind: "ammo", t: 0 });
  }
}

export function resetRun(g: Game) {
  g.px = START.x;
  g.py = START.y;
  g.pa = START.a;
  g.hp = 100;
  g.ammo = 40;
  g.score = 0;
  g.wave = 0;
  g.lives = 3;
  g.enemies = [];
  g.pickups = [];
  g.particles = [];
  g.hurt = 0;
  g.shake = 0;
  g.fireCd = 0;
  g.muzzle = 0;
  g.weaponKick = 0;
  g.mode = "ready";
  g.overlayT = 1.4;
}

function tryMove(g: Game, nx: number, ny: number) {
  const r = 0.18;
  if (!isWall(nx, g.py) && !isWall(nx - r, g.py) && !isWall(nx + r, g.py)) g.px = nx;
  if (!isWall(g.px, ny) && !isWall(g.px, ny - r) && !isWall(g.px, ny + r)) g.py = ny;
}

export function movePlayer(g: Game, dt: number, keys: Set<string>, look: number) {
  g.pa += look;
  const s = Math.sin(g.pa);
  const c = Math.cos(g.pa);
  let mx = 0;
  let my = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) {
    mx += c;
    my += s;
  }
  if (keys.has("KeyS") || keys.has("ArrowDown")) {
    mx -= c;
    my -= s;
  }
  if (keys.has("KeyA") || keys.has("ArrowLeft")) {
    mx += s;
    my -= c;
  }
  if (keys.has("KeyD") || keys.has("ArrowRight")) {
    mx -= s;
    my += c;
  }
  const len = Math.hypot(mx, my) || 1;
  const spd = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 3.4 : 2.35;
  tryMove(g, g.px + (mx / len) * spd * dt, g.py + (my / len) * spd * dt);
  void MAP_W;
  void MAP_H;
}

export function shoot(g: Game): boolean {
  if (g.mode !== "play") return false;
  if (g.fireCd > 0 || g.ammo <= 0) return false;
  g.ammo -= 1;
  g.fireCd = 0.16;
  g.muzzle = 0.08;
  g.weaponKick = 1;
  const dirX = Math.cos(g.pa);
  const dirY = Math.sin(g.pa);
  let best: Enemy | null = null;
  let bestD = 18;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const dx = e.x - g.px;
    const dy = e.y - g.py;
    const dist = Math.hypot(dx, dy);
    const along = dx * dirX + dy * dirY;
    if (along < 0.2) continue;
    const perp = Math.abs(dx * dirY - dy * dirX);
    if (perp > 0.38 + dist * 0.02) continue;
    if (dist < bestD) {
      bestD = dist;
      best = e;
    }
  }
  if (best) {
    best.hp -= 18;
    best.hitFlash = 0.12;
    burst(g, best.x, best.y, 184, 255, 42);
    if (best.hp <= 0) {
      best.alive = false;
      g.score += best.score;
      burst(g, best.x, best.y, 255, 43, 214);
      if (Math.random() < 0.28) {
        g.pickups.push({
          x: best.x,
          y: best.y,
          kind: Math.random() < 0.5 ? "ammo" : "health",
          t: 0,
        });
      }
    }
  }
  return true;
}

function burst(g: Game, x: number, y: number, r: number, gb: number, b: number) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * (1 + Math.random() * 2),
      vy: Math.sin(a) * (1 + Math.random() * 2),
      life: 0.25 + Math.random() * 0.25,
      r,
      g: gb,
      b,
    });
  }
}

export function tickWorld(g: Game, dt: number) {
  g.time += dt;
  g.fireCd = Math.max(0, g.fireCd - dt);
  g.muzzle = Math.max(0, g.muzzle - dt);
  g.hurt = Math.max(0, g.hurt - dt);
  g.shake = Math.max(0, g.shake - dt * 2);
  g.weaponKick = Math.max(0, g.weaponKick - dt * 8);
  g.overlayT = Math.max(0, g.overlayT - dt);

  for (const p of g.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);

  for (const p of g.pickups) p.t += dt;

  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const p = g.pickups[i];
    if (Math.hypot(p.x - g.px, p.y - g.py) < 0.45) {
      if (p.kind === "health") g.hp = Math.min(100, g.hp + 32);
      if (p.kind === "ammo") g.ammo = Math.min(99, g.ammo + 18);
      if (p.kind === "credit") g.credits += 1;
      g.pickups.splice(i, 1);
    }
  }

  let alive = 0;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    alive += 1;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.biteCd = Math.max(0, e.biteCd - dt);
    const dx = g.px - e.x;
    const dy = g.py - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 0.42) {
      const nx = e.x + (dx / dist) * e.speed * dt;
      const ny = e.y + (dy / dist) * e.speed * dt;
      if (!isWall(nx, e.y)) e.x = nx;
      if (!isWall(e.x, ny)) e.y = ny;
    } else if (e.biteCd <= 0) {
      g.hp -= e.dmg;
      g.hurt = 0.22;
      g.shake = 0.28;
      e.biteCd = 0.7;
    }
  }

  if (g.hp <= 0) {
    g.lives -= 1;
    g.hp = 100;
    g.px = START.x;
    g.py = START.y;
    g.mode = g.lives > 0 ? "dead" : "continue";
    g.overlayT = g.lives > 0 ? 1.2 : 0;
    g.continueT = 9;
  } else if (alive === 0 && g.mode === "play") {
    g.mode = "wave";
    g.overlayT = 1.6;
    g.score += 400 + g.wave * 50;
  }
}
