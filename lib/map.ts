export const MAP_W = 24;
export const MAP_H = 20;

const ROWS: string[] = [
  "111111111111111111111111",
  "100000011000000110000001",
  "100000011000000110000001",
  "100000000000000000000001",
  "100000011000000110000001",
  "111001111111001111110011",
  "100000000000000000000001",
  "100220000111111000033001",
  "100200000100000100003001",
  "100200000100000100003001",
  "100220000100000100033001",
  "100000000000000000000001",
  "111001111000000111100111",
  "100000100000000010000001",
  "100000100044400010000001",
  "100000000000000000000001",
  "100000100044400010000001",
  "100000100000000010000001",
  "100000100000000010000001",
  "111111111111111111111111",
];

export const MAP: number[] = new Array(MAP_W * MAP_H);

for (let y = 0; y < MAP_H; y++) {
  const row = ROWS[y];
  if (row.length !== MAP_W) {
    throw new Error(`map row ${y} length ${row.length}`);
  }
  for (let x = 0; x < MAP_W; x++) {
    MAP[y * MAP_W + x] = row.charCodeAt(x) - 48;
  }
}

export const SPAWN = { x: 3.5, y: 2.5, a: 0 };

export const ENEMY_SPAWNS: Array<{ x: number; y: number }> = [
  { x: 20.5, y: 2.5 },
  { x: 12.5, y: 2.5 },
  { x: 3.5, y: 8.5 },
  { x: 6.5, y: 9.5 },
  { x: 17.5, y: 9.5 },
  { x: 20.5, y: 8.5 },
  { x: 11.5, y: 9.5 },
  { x: 3.5, y: 17.5 },
  { x: 11.5, y: 15.5 },
  { x: 20.5, y: 17.5 },
  { x: 8.5, y: 17.5 },
  { x: 15.5, y: 17.5 },
  { x: 2.5, y: 11.5 },
  { x: 21.5, y: 11.5 },
];

export const PICKUP_SPOTS: Array<{ x: number; y: number }> = [
  { x: 12.5, y: 3.5 },
  { x: 4.5, y: 9.5 },
  { x: 19.5, y: 9.5 },
  { x: 11.5, y: 14.5 },
  { x: 7.5, y: 17.5 },
  { x: 16.5, y: 17.5 },
];

export type Waypoint = { x: number; y: number; a: number };

export const DEMO_PATH: Waypoint[] = [
  { x: 3.5, y: 2.5, a: 0 },
  { x: 12.0, y: 2.5, a: 0 },
  { x: 12.0, y: 2.5, a: Math.PI / 2 },
  { x: 12.0, y: 11.0, a: Math.PI / 2 },
  { x: 12.0, y: 11.0, a: 0 },
  { x: 20.5, y: 11.0, a: 0 },
  { x: 20.5, y: 11.0, a: Math.PI / 2 },
  { x: 20.5, y: 17.5, a: Math.PI / 2 },
  { x: 20.5, y: 17.5, a: Math.PI },
  { x: 12.0, y: 17.5, a: Math.PI },
  { x: 12.0, y: 17.5, a: -Math.PI / 2 },
  { x: 12.0, y: 11.0, a: -Math.PI / 2 },
  { x: 12.0, y: 11.0, a: Math.PI },
  { x: 3.5, y: 11.0, a: Math.PI },
  { x: 3.5, y: 11.0, a: -Math.PI / 2 },
  { x: 3.5, y: 2.5, a: -Math.PI / 2 },
];

export function cell(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 1;
  return MAP[y * MAP_W + x];
}

export function isSolid(x: number, y: number): boolean {
  return cell(x, y) > 0;
}

export function blocked(px: number, py: number, radius: number): boolean {
  const r = radius;
  return (
    isSolid(Math.floor(px - r), Math.floor(py - r)) ||
    isSolid(Math.floor(px + r), Math.floor(py - r)) ||
    isSolid(Math.floor(px - r), Math.floor(py + r)) ||
    isSolid(Math.floor(px + r), Math.floor(py + r))
  );
}

export function tryMove(
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  if (!blocked(x + dx, y, radius)) nx = x + dx;
  if (!blocked(nx, y + dy, radius)) ny = y + dy;
  return { x: nx, y: ny };
}

export function hasLOS(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) return true;
  const steps = Math.ceil(dist * 8);
  const sx = dx / steps;
  const sy = dy / steps;
  let x = ax;
  let y = ay;
  for (let i = 0; i < steps; i++) {
    x += sx;
    y += sy;
    if (isSolid(Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}

export function castWall(
  px: number,
  py: number,
  rdx: number,
  rdy: number,
): { dist: number; side: 0 | 1; texX: number; type: number } {
  let mapX = Math.floor(px);
  let mapY = Math.floor(py);
  const deltaDistX = Math.abs(1 / (rdx === 0 ? 1e-12 : rdx));
  const deltaDistY = Math.abs(1 / (rdy === 0 ? 1e-12 : rdy));
  const stepX = rdx < 0 ? -1 : 1;
  const stepY = rdy < 0 ? -1 : 1;
  let sideDistX =
    rdx < 0 ? (px - mapX) * deltaDistX : (mapX + 1 - px) * deltaDistX;
  let sideDistY =
    rdy < 0 ? (py - mapY) * deltaDistY : (mapY + 1 - py) * deltaDistY;
  let side: 0 | 1 = 0;
  let type = 1;
  for (let i = 0; i < 48; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    type = cell(mapX, mapY);
    if (type > 0) break;
  }
  const dist =
    side === 0
      ? Math.abs((mapX - px + (1 - stepX) / 2) / (rdx === 0 ? 1e-12 : rdx))
      : Math.abs((mapY - py + (1 - stepY) / 2) / (rdy === 0 ? 1e-12 : rdy));
  const wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
  const texX = wallX - Math.floor(wallX);
  return { dist: Math.max(0.08, dist), side, texX, type };
}
