# COIN-OP

Insert-coin arcade first-person shooter. Pixel raycaster, CRT cabinet.

## Run

Install deps, then start the Next.js dev server, or build and start.
Open http://localhost:3000

## Scores

In-memory board unless a Postgres URL env var is set (CockroachDB, ssl).
Schema: db/schema.sql (auto-applied). Do not commit env files.

## Controls

Coin button or 5: add credit. Enter / C / click: start.
WASD move. Mouse look (click to lock). Space or click: shoot.
Esc pause. M mute. Type initials at game over.
Starts with one credit.

Env: DATABASE_URL for CockroachDB. Scripts: dev, build, start.
