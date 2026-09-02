import { randomUUID } from "crypto";
import { Pool } from "pg";

export type ScoreRow = {
  id: string;
  initials: string;
  score: number;
  wave: number;
  created_at: string;
};

const SCHEMA = `CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initials TEXT NOT NULL,
  score INT NOT NULL,
  wave INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

function seed(): ScoreRow[] {
  return [
    { id: "11111111-1111-4111-8111-111111111111", initials: "GHO", score: 12800, wave: 6, created_at: "2026-01-01T00:00:00.000Z" },
    { id: "22222222-2222-4222-8222-222222222222", initials: "ACE", score: 9600, wave: 5, created_at: "2026-01-02T00:00:00.000Z" },
    { id: "33333333-3333-4333-8333-333333333333", initials: "NEO", score: 7200, wave: 4, created_at: "2026-01-03T00:00:00.000Z" },
    { id: "44444444-4444-4444-8444-444444444444", initials: "QST", score: 4800, wave: 3, created_at: "2026-01-04T00:00:00.000Z" },
    { id: "55555555-5555-4555-8555-555555555555", initials: "ZZZ", score: 1337, wave: 2, created_at: "2026-01-05T00:00:00.000Z" },
  ];
}

let memory: ScoreRow[] = seed();
let pool: Pool | null | undefined;
let schemaReady = false;

function getPool(): Pool | null {
  if (pool !== undefined) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    pool = null;
    return null;
  }
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

async function ensureSchema(p: Pool): Promise<void> {
  if (schemaReady) return;
  await p.query(SCHEMA);
  schemaReady = true;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function validateInitials(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(v)) return null;
  return v;
}

export function validateInt(raw: unknown, min: number, max: number): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max) {
    return raw;
  }
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= min && n <= max) return n;
  }
  return null;
}

export async function getTopScores(limit = 20): Promise<ScoreRow[]> {
  const p = getPool();
  if (!p) {
    return [...memory]
      .sort((a, b) => b.score - a.score || b.wave - a.wave)
      .slice(0, limit);
  }
  await ensureSchema(p);
  const result = await p.query(
    `SELECT id::text AS id, initials, score, wave, created_at
     FROM scores
     ORDER BY score DESC, created_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((r: { id: string; initials: string; score: number; wave: number; created_at: unknown }) => ({
    id: r.id,
    initials: r.initials,
    score: r.score,
    wave: r.wave,
    created_at: asIso(r.created_at),
  }));
}

export async function addScore(input: {
  initials: string;
  score: number;
  wave: number;
}): Promise<ScoreRow> {
  const p = getPool();
  if (!p) {
    const row: ScoreRow = {
      id: randomUUID(),
      initials: input.initials,
      score: input.score,
      wave: input.wave,
      created_at: new Date().toISOString(),
    };
    memory.push(row);
    return row;
  }
  await ensureSchema(p);
  const result = await p.query(
    `INSERT INTO scores (initials, score, wave)
     VALUES ($1, $2, $3)
     RETURNING id::text AS id, initials, score, wave, created_at`,
    [input.initials, input.score, input.wave],
  );
  const r = result.rows[0] as {
    id: string;
    initials: string;
    score: number;
    wave: number;
    created_at: unknown;
  };
  return {
    id: r.id,
    initials: r.initials,
    score: r.score,
    wave: r.wave,
    created_at: asIso(r.created_at),
  };
}
