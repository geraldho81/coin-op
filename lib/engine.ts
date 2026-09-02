import {
  DEMO_PATH,
  ENEMY_SPAWNS,
  PICKUP_SPOTS,
  SPAWN,
  blocked,
  castWall,
  hasLOS,
  tryMove,
} from "./map";

export type Mode = "attract" | "play" | "paused" | "gameover" | "scores";
export type EnemyKind = "grunt" | "runner" | "tank";
export type PickupKind = "ammo" | "health" | "credit";

export type Sfx = {
  coin(): void;
  shoot(): void;
  dry(): void;
  hit(): void;
  death(): void;
  wave(): void;
  pickup(): void;
  hurt(): void;
};

export type Enemy = {
  x: number;
  y: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  score: number;
  radius: number;
  attackCd: number;
  wanderT: number;
  wanderA: number;
  alive: boolean;
  hitFlash: number;
};

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

export type Game = {
  mode: Mode;
  credits: number;
  lives: number;
  health: number;
  ammo: number;
  score: number;
  wave: number;
  px: number;
  py: number;
  pa: number;
  keys: Record<string, boolean>;
  mouseDown: boolean;
  enemies: Enemy[];
  pickups: Pickup[];
  particles: Particle[];
  zbuf: Float64Array;
  shootCd: number;
  weaponKick: number;
  muzzle: number;
  hurtFlash: number;
  invuln: number;
  waveMsgT: number;
  wavePause: number;
  demoT: number;
  initials: string;
  initialSlot: number;
  submitted: boolean;
  insertFlash: number;
  time: number;
};

export const FB_W = 400;
export const FB_H = 250;
export const PLANE = 0.66;
const MOVE_SPEED = 3.35;
const PLAYER_R = 0.18;

const STATS: Record<
  EnemyKind,
  { hp: number; speed: number; dmg: number; score: number; radius: number }
> = {
  grunt: { hp: 30, speed: 1.15, dmg: 8, score: 100, radius: 0.28 },
  runner: { hp: 16, speed: 2.35, dmg: 5, score: 150, radius: 0.22 },
  tank: { hp: 92, speed: 0.72, dmg: 18, score: 400, radius: 0.4 },
};

export function createGame(): Game {
  return {
    mode: "attract",
    credits: 1,
    lives: 3,
    health: 100,
    ammo: 50,
    score: 0,
    wave: 1,
    px: SPAWN.x,
    py: SPAWN.y,
    pa: SPAWN.a,
    keys: {},
    mouseDown: false,
    enemies: [],
    pickups: [],
    particles: [],
    zbuf: new Float64Array(FB_W),
    shootCd: 0,
    weaponKick: 0,
    muzzle: 0,
    hurtFlash: 0,
    invuln: 0,
    waveMsgT: 0,
    wavePause: 0,
    demoT: 0,
    initials: "AAA",
    initialSlot: 0,
    submitted: false,
    insertFlash: 0,
    time: 0,
  };
}

export function insertCoin(g: Game, sfx: Sfx) {
  g.credits += 1;
  sfx.coin();
}

export function tryStart(g: Game, sfx: Sfx): boolean {
  if (g.mode === "play" || g.mode === "paused") return false;
  if (g.credits < 1) {
    g.insertFlash = 0.8;
    return false;
  }
  g.credits -= 1;
  startRun(g, sfx);
  return true;
}

export function startRun(g: Game, sfx: Sfx) {
  g.mode = "play";
  g.lives = 3;
  g.health = 100;
  g.ammo = 50;
  g.score = 0;
  g.wave = 1;
  g.px = SPAWN.x;
  g.py = SPAWN.y;
  g.pa = SPAWN.a;
  g.shootCd = 0;
  g.weaponKick = 0;
  g.muzzle = 0;
  g.hurtFlash = 0;
  g.invuln = 1.2;
  g.waveMsgT = 2.2;
  g.wavePause = 0;
  g.initials = "AAA";
  g.initialSlot = 0;
  g.submitted = false;
  g.enemies = [];
  g.pickups = [];
  g.particles = [];
  spawnWave(g);
  sfx.wave();
}

function makeEnemy(kind: EnemyKind, x: number, y: number, wave: number): Enemy {
  const s = STATS[kind];
  const hpMul = 1 + (wave - 1) * 0.12;
  const spMul = Math.min(1.45, 1 + (wave - 1) * 0.055);
  return {
    x,
    y,
    kind,
    hp: Math.round(s.hp * hpMul),
    maxHp: Math.round(s.hp * hpMul),
    speed: s.speed * spMul,
    dmg: s.dmg,
    score: s.score,
    radius: s.radius,
    attackCd: 0.3,
    wanderT: Math.random(),
    wanderA: Math.random() * Math.PI * 2,
    alive: true,
    hitFlash: 0,
  };
}

function shuffledSpawns(px: number, py: number): Array<{ x: number; y: number }> {
  const spots = ENEMY_SPAWNS.filter((s) => Math.hypot(s.x - px, s.y - py) > 4.2);
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = spots[i];
    spots[i] = spots[j];
    spots[j] = tmp;
  }
  return spots.length ? spots : [...ENEMY_SPAWNS];
}

export function spawnWave(g: Game) {
  const w = g.wave;
  let nGrunt = 2 + Math.floor(w / 2);
  let nRunner = w >= 2 ? w : 0;
  let nTank = w >= 3 ? Math.floor((w - 1) / 2) : 0;
  let total = nGrunt + nRunner + nTank;
  if (total > 12) {
    const scale = 12 / total;
    nGrunt = Math.max(1, Math.floor(nGrunt * scale));
    nRunner = Math.floor(nRunner * scale);
    nTank = Math.max(w >= 3 ? 1 : 0, Math.floor(nTank * scale));
  }
  const kinds: EnemyKind[] = [
    ...Array<EnemyKind>(nGrunt).fill("grunt"),
    ...Array<EnemyKind>(nRunner).fill("runner"),
    ...Array<EnemyKind>(nTank).fill("tank"),
  ];
  const spots = shuffledSpawns(g.px, g.py);
  g.enemies = kinds.map((kind, i) => {
    const s = spots[i % spots.length];
    const jitter = 0.15 * ((i % 3) - 1);
    return makeEnemy(kind, s.x + jitter, s.y - jitter, w);
  });
  if (w === 1 || w % 2 === 0) {
    const p = PICKUP_SPOTS[w % PICKUP_SPOTS.length];
    const kind: PickupKind = w % 3 === 0 ? "credit" : w % 2 === 0 ? "health" : "ammo";
    g.pickups.push({ x: p.x, y: p.y, kind, t: 0 });
  }
}

function burst(g: Game, x: number, y: number, r: number, gb: number, b: number) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * 1.6;
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.25,
      r,
      g: gb,
      b,
    });
  }
}

function hitscan(g: Game, sfx: Sfx) {
  const dirX = Math.cos(g.pa);
  const dirY = Math.sin(g.pa);
  const wall = castWall(g.px, g.py, dirX, dirY);
  let best: Enemy | null = null;
  let bestD = Math.min(14, wall.dist);
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const dx = e.x - g.px;
    const dy = e.y - g.py;
    const depth = dx * dirX + dy * dirY;
    if (depth < 0.25 || depth > bestD) continue;
    const lat = Math.abs(-dx * dirY + dy * dirX);
    if (lat < e.radius + 0.1) {
      best = e;
      bestD = depth;
    }
  }
  if (!best) return;
  best.hp -= 14;
  best.hitFlash = 0.12;
  sfx.hit();
  burst(g, best.x, best.y, 255, 240, 80);
  if (best.hp <= 0) {
    best.alive = false;
    g.score += best.score;
    burst(g, best.x, best.y, 184, 255, 42);
    if (Math.random() < 0.28) {
      const kinds: PickupKind[] = ["ammo", "ammo", "health", "credit"];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      g.pickups.push({ x: best.x, y: best.y, kind, t: 0 });
    }
  }
}

function updateEnemies(g: Game, dt: number, sfx: Sfx) {
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    const dx = g.px - e.x;
    const dy = g.py - e.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d < 0.62 + e.radius * 0.15) {
      if (g.invuln <= 0 && e.attackCd <= 0 && g.mode === "play") {
        e.attackCd = e.kind === "runner" ? 0.5 : e.kind === "tank" ? 1.05 : 0.72;
        g.health -= e.dmg;
        g.hurtFlash = 0.38;
        sfx.hurt();
      }
      continue;
    }
    let mx = 0;
    let my = 0;
    const los = hasLOS(e.x, e.y, g.px, g.py);
    if (los && d < 13) {
      mx = dx / d;
      my = dy / d;
      if (e.kind === "runner" && d < 2.4) {
        const sx = -my;
        const sy = mx;
        mx = mx * 0.25 + sx * 0.95;
        my = my * 0.25 + sy * 0.95;
      }
    } else {
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 0.7 + Math.random() * 1.3;
        e.wanderA = Math.random() * Math.PI * 2;
      }
      mx = Math.cos(e.wanderA);
      my = Math.sin(e.wanderA);
    }
    const sp = e.speed * dt;
    const n = tryMove(e.x, e.y, mx * sp, my * sp, e.radius);
    e.x = n.x;
    e.y = n.y;
  }
}

function updatePickups(g: Game, dt: number, sfx: Sfx) {
  for (const p of g.pickups) p.t += dt;
  if (g.mode !== "play") return;
  g.pickups = g.pickups.filter((p) => {
    if (Math.hypot(p.x - g.px, p.y - g.py) > 0.48) return true;
    if (p.kind === "ammo") g.ammo = Math.min(99, g.ammo + 15);
    if (p.kind === "health") g.health = Math.min(100, g.health + 28);
    if (p.kind === "credit") g.credits += 1;
    sfx.pickup();
    return false;
  });
}

function updateDemo(g: Game, dt: number) {
  g.demoT += dt;
  const path = DEMO_PATH;
  const segTime = 2.4;
  const total = path.length * segTime;
  const t = g.demoT % total;
  const i = Math.floor(t / segTime) % path.length;
  const j = (i + 1) % path.length;
  const u = (t - i * segTime) / segTime;
  const a = path[i];
  const b = path[j];
  g.px = a.x + (b.x - a.x) * u;
  g.py = a.y + (b.y - a.y) * u;
  let da = b.a - a.a;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  g.pa = a.a + da * u;
  if (g.enemies.length === 0) {
    g.enemies = [
      makeEnemy("grunt", 6.5, 9.5, 1),
      makeEnemy("runner", 17.5, 9.5, 1),
      makeEnemy("tank", 11.5, 15.5, 1),
    ];
  }
}

export function handleInitialsKey(g: Game, key: string): "submit" | null {
  if (g.mode !== "gameover" || g.submitted) return null;
  const k = key.length === 1 ? key.toUpperCase() : key;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const chars = g.initials.split("");
  while (chars.length < 3) chars.push("A");
  if (k === "ArrowLeft") g.initialSlot = (g.initialSlot + 2) % 3;
  else if (k === "ArrowRight") g.initialSlot = (g.initialSlot + 1) % 3;
  else if (k === "ArrowUp") {
    const i = letters.indexOf(chars[g.initialSlot] || "A");
    chars[g.initialSlot] = letters[(i + 1) % 26];
  } else if (k === "ArrowDown") {
    const i = letters.indexOf(chars[g.initialSlot] || "A");
    chars[g.initialSlot] = letters[(i + 25) % 26];
  } else if (k === "Backspace") {
    chars[g.initialSlot] = "A";
    g.initialSlot = Math.max(0, g.initialSlot - 1);
  } else if (/^[A-Z]$/.test(k)) {
    chars[g.initialSlot] = k;
    g.initialSlot = Math.min(2, g.initialSlot + 1);
  } else if (k === "Enter") {
    g.initials = chars.join("").slice(0, 3);
    return "submit";
  }
  g.initials = chars.join("").slice(0, 3);
  return null;
}

export function updateGame(g: Game, dt: number, sfx: Sfx) {
  const capped = Math.min(0.05, dt);
  g.time += capped;
  g.insertFlash = Math.max(0, g.insertFlash - capped);
  g.weaponKick = Math.max(0, g.weaponKick - capped * 4.5);
  g.muzzle = Math.max(0, g.muzzle - capped);
  g.hurtFlash = Math.max(0, g.hurtFlash - capped);
  g.invuln = Math.max(0, g.invuln - capped);
  g.shootCd = Math.max(0, g.shootCd - capped);
  g.waveMsgT = Math.max(0, g.waveMsgT - capped);
  for (const p of g.particles) {
    p.life -= capped;
    p.x += p.vx * capped;
    p.y += p.vy * capped;
  }
  g.particles = g.particles.filter((p) => p.life > 0);

  if (g.mode === "attract") {
    updateDemo(g, capped);
    updateEnemies(g, capped * 0.35, sfx);
    return;
  }

  if (g.mode !== "play") return;

  const dirX = Math.cos(g.pa);
  const dirY = Math.sin(g.pa);
  let mx = 0;
  let my = 0;
  if (g.keys["KeyW"] || g.keys["ArrowUp"]) {
    mx += dirX;
    my += dirY;
  }
  if (g.keys["KeyS"] || g.keys["ArrowDown"]) {
    mx -= dirX;
    my -= dirY;
  }
  if (g.keys["KeyA"] || g.keys["ArrowLeft"]) {
    mx += dirY;
    my -= dirX;
  }
  if (g.keys["KeyD"] || g.keys["ArrowRight"]) {
    mx -= dirY;
    my += dirX;
  }
  const mag = Math.hypot(mx, my);
  if (mag > 0) {
    const sp = MOVE_SPEED * capped;
    const n = tryMove(g.px, g.py, (mx / mag) * sp, (my / mag) * sp, PLAYER_R);
    g.px = n.x;
    g.py = n.y;
    if (blocked(g.px, g.py, PLAYER_R)) {
      g.px = SPAWN.x;
      g.py = SPAWN.y;
    }
  }

  if ((g.mouseDown || g.keys["Space"]) && g.shootCd <= 0) {
    g.shootCd = 0.17;
    if (g.ammo <= 0) {
      sfx.dry();
      g.weaponKick = 0.25;
    } else {
      g.ammo -= 1;
      g.weaponKick = 1;
      g.muzzle = 0.05;
      sfx.shoot();
      hitscan(g, sfx);
    }
  }

  updateEnemies(g, capped, sfx);
  updatePickups(g, capped, sfx);

  if (g.health <= 0) {
    g.lives -= 1;
    sfx.death();
    if (g.lives <= 0) {
      g.mode = "gameover";
      g.health = 0;
      g.initials = "AAA";
      g.initialSlot = 0;
      g.submitted = false;
    } else {
      g.health = 100;
      g.invuln = 2.2;
      g.hurtFlash = 0.7;
    }
  }

  const alive = g.enemies.some((e) => e.alive);
  if (!alive && g.wavePause <= 0 && g.waveMsgT <= 0) {
    g.wavePause = 2.2;
  }
  if (g.wavePause > 0) {
    g.wavePause -= capped;
    if (g.wavePause <= 0) {
      g.wave += 1;
      g.score += 250;
      spawnWave(g);
      g.waveMsgT = 2;
      sfx.wave();
    }
  }
}
