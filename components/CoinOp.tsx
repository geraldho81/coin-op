"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArcadeAudio } from "@/lib/audio";
import {
  FB_H,
  FB_W,
  createGame,
  handleInitialsKey,
  insertCoin,
  tryStart,
  updateGame,
  type Game,
  type Mode,
} from "@/lib/engine";
import { drawGun, renderWorld } from "@/lib/render";

type Hud = {
  credits: number;
  lives: number;
  health: number;
  ammo: number;
  score: number;
  wave: number;
  mode: Mode;
  initials: string;
  initialSlot: number;
  submitted: boolean;
  waveMsgT: number;
  insertFlash: number;
  muted: boolean;
};

type ScoreRow = {
  id: string;
  initials: string;
  score: number;
  wave: number;
  created_at?: string;
};

const pad = (n: number, w: number) => n.toString().padStart(w, "0");

export default function CoinOp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game>(createGame());
  const audioRef = useRef<ArcadeAudio>(new ArcadeAudio());
  const imgRef = useRef<ImageData | null>(null);
  const [hud, setHud] = useState<Hud>(() => snapshot(gameRef.current, false));
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [boardErr, setBoardErr] = useState<string | null>(null);
  const [aimLocked, setAimLocked] = useState(false);

  const syncHud = useCallback((g: Game) => {
    setHud(snapshot(g, audioRef.current.muted));
  }, []);

  const loadScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      if (!res.ok) throw new Error("board down");
      const data = (await res.json()) as ScoreRow[];
      setScores(Array.isArray(data) ? data : []);
      setBoardErr(null);
    } catch {
      setBoardErr("BOARD OFFLINE");
    }
  }, []);

  const submitScore = useCallback(async () => {
    const g = gameRef.current;
    if (g.submitted) return;
    g.submitted = true;
    try {
      await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initials: g.initials,
          score: g.score,
          wave: g.wave,
        }),
      });
    } catch {
      /* still show local board */
    }
    g.mode = "scores";
    syncHud(g);
    await loadScores();
  }, [loadScores, syncHud]);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    imgRef.current = ctx.createImageData(FB_W, FB_H);
    const g = gameRef.current;
    const sfx = audioRef.current;
    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      updateGame(g, dt, sfx);
      const img = imgRef.current;
      if (img) {
        renderWorld(g, img);
        ctx.putImageData(img, 0, 0);
        drawGun(ctx, g);
        if (g.hurtFlash > 0) {
          ctx.fillStyle = `rgba(180,0,40,${Math.min(0.45, g.hurtFlash)})`;
          ctx.fillRect(0, 0, FB_W, FB_H);
        }
        if (g.invuln > 0 && g.mode === "play" && Math.floor(g.time * 12) % 2 === 0) {
          ctx.fillStyle = "rgba(184,255,42,0.08)";
          ctx.fillRect(0, 0, FB_W, FB_H);
        }
      }
      hudAcc += dt;
      if (hudAcc > 0.08) {
        hudAcc = 0;
        syncHud(g);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      g.keys[e.code] = true;
      if (e.code === "KeyM") {
        sfx.toggle();
        syncHud(g);
      }
      if (e.code === "Digit5" || e.code === "Numpad5") {
        insertCoin(g, sfx);
        syncHud(g);
      }
      if (e.code === "KeyC") {
        if (g.mode === "gameover" && !g.submitted) {
          /* initials entry uses C as a letter */
        } else if (g.mode === "play" || g.mode === "paused") {
          insertCoin(g, sfx);
          syncHud(g);
        } else if (g.credits < 1) {
          insertCoin(g, sfx);
          tryStart(g, sfx);
          syncHud(g);
        } else {
          tryStart(g, sfx);
          syncHud(g);
        }
      }
      if (e.code === "Enter") {
        if (g.mode === "gameover" && !g.submitted) {
          void submitScore();
        } else if (g.mode !== "play" && g.mode !== "paused") {
          tryStart(g, sfx);
          syncHud(g);
        }
      }
      if (g.mode === "gameover") {
        const act = handleInitialsKey(g, e.key);
        if (act === "submit") void submitScore();
        syncHud(g);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      g.keys[e.code] = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas && g.mode === "play") {
        g.pa += e.movementX * 0.00225;
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) g.mouseDown = true;
    };
    const onMouseUp = () => {
      g.mouseDown = false;
    };
    const onLock = () => {
      const locked = document.pointerLockElement === canvas;
      setAimLocked(locked);
      if (g.mode === "play" && !locked) {
        g.mode = "paused";
        g.mouseDown = false;
        syncHud(g);
      }
    };
    const onContext = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerlockchange", onLock);
    canvas.addEventListener("contextmenu", onContext);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerlockchange", onLock);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, [submitScore, syncHud]);

  const onCanvasClick = () => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    const sfx = audioRef.current;
    sfx.setMuted(sfx.muted);
    if (g.mode === "paused") {
      g.mode = "play";
      syncHud(g);
      canvas?.requestPointerLock();
      return;
    }
    if (g.mode === "play") {
      canvas?.requestPointerLock();
      return;
    }
    if (g.mode === "gameover" && !g.submitted) return;
    if (tryStart(g, sfx)) {
      syncHud(g);
      canvas?.requestPointerLock();
    } else {
      syncHud(g);
    }
  };

  const onInsert = () => {
    insertCoin(gameRef.current, audioRef.current);
    syncHud(gameRef.current);
  };

  const onMute = () => {
    audioRef.current.toggle();
    syncHud(gameRef.current);
  };

  return (
    <div className="cabinet">
      <div className="marquee">
        <span className="kanji">コインオペ</span>
        <h1>COIN-OP</h1>
        <span className="kanji">第一弾</span>
      </div>
      <div className="bezel">
        <div className="side-art left">
          <span>危険</span>
          <span>PLAYER 1</span>
          <span>残機</span>
        </div>
        <div className="crt">
          <canvas
            ref={canvasRef}
            width={FB_W}
            height={FB_H}
            className="playfield"
            onClick={onCanvasClick}
          />
          <div className="scanlines" />
          <div className="vignette" />
          <div className="hud-top">
            <span>1UP {pad(hud.score, 6)}</span>
            <span>WAVE {pad(hud.wave, 2)}</span>
            <span>HI {pad(scores[0]?.score ?? 12800, 6)}</span>
          </div>
          <div className="hud-bot">
            <span className="health">
              HP
              <i style={{ width: `${hud.health}%` }} />
            </span>
            <span>AMMO {pad(hud.ammo, 2)}</span>
            <span>P1 {"●".repeat(Math.max(0, hud.lives))}</span>
            <span className={hud.credits < 1 ? "blink" : ""}>
              CREDIT {pad(hud.credits, 2)}
            </span>
          </div>
          {hud.mode === "attract" && (
            <div className="overlay attract">
              <p className="demo">DEMO</p>
              <h2>COIN-OP</h2>
              <p className={`insert ${hud.insertFlash > 0 ? "flash-hard" : "blink"}`}>
                INSERT COIN
              </p>
              <p className="hint">CLICK / ENTER / C TO START</p>
              <ol className="mini-board">
                {scores.slice(0, 5).map((s, i) => (
                  <li key={s.id}>
                    <em>{pad(i + 1, 2)}</em> {s.initials} {pad(s.score, 6)}
                  </li>
                ))}
              </ol>
              <p className="story">YEAR 19XX — THE CABINET WAKES</p>
            </div>
          )}
          {hud.mode === "paused" && (
            <div className="overlay">
              <h2>PAUSED</h2>
              <p className="blink">CLICK TO CONTINUE</p>
              <p className="hint">ESC RELEASES THE MOUSE</p>
            </div>
          )}
          {hud.mode === "play" && hud.waveMsgT > 0 && (
            <div className="overlay thin">
              <h2>WAVE {pad(hud.wave, 2)}</h2>
            </div>
          )}
          {hud.mode === "play" && !aimLocked && hud.waveMsgT <= 0 && (
            <div className="overlay thin">
              <p className="hint blink">CLICK TO LOCK AIM</p>
            </div>
          )}
          {hud.mode === "gameover" && (
            <div className="overlay">
              <h2>GAME OVER</h2>
              <p>SCORE {pad(hud.score, 6)}</p>
              <p className="hint">ENTER INITIALS</p>
              <div className="initials">
                {hud.initials.split("").map((ch, i) => (
                  <b key={i} className={i === hud.initialSlot ? "on" : ""}>
                    {ch}
                  </b>
                ))}
              </div>
              <p className="hint">ARROWS / TYPE / ENTER</p>
            </div>
          )}
          {hud.mode === "scores" && (
            <div className="overlay scores">
              <h2>HIGH SCORES</h2>
              {boardErr && <p className="hint">{boardErr}</p>}
              <ol className="board">
                {scores.slice(0, 10).map((s, i) => (
                  <li key={s.id}>
                    <em>{pad(i + 1, 2)}</em>
                    <span>{s.initials}</span>
                    <span>{pad(s.score, 6)}</span>
                    <span>W{pad(s.wave, 2)}</span>
                  </li>
                ))}
              </ol>
              <p className={`insert ${hud.credits < 1 ? "blink" : ""}`}>
                {hud.credits < 1 ? "INSERT COIN" : "ENTER / C TO RESTART"}
              </p>
            </div>
          )}
        </div>
        <div className="side-art right">
          <span>1クレジット</span>
          <span>ハイスコア</span>
          <span>撃てー</span>
        </div>
      </div>
      <div className="control-plate">
        <div className="lamp">
          <span>PLAYER 1</span>
          <strong className={hud.credits < 1 ? "blink" : ""}>
            {hud.credits < 1 ? "INSERT COIN" : "READY"}
          </strong>
        </div>
        <button type="button" className="mute" onClick={onMute}>
          {hud.muted ? "MUTED" : "MUTE"}
        </button>
        <button type="button" className="coin-btn" onClick={onInsert}>
          INSERT COIN
        </button>
      </div>
      <p className="deck-copy">
        WASD MOVE · MOUSE LOOK · CLICK / SPACE FIRE · ESC PAUSE · 5 COIN
      </p>
    </div>
  );
}

function snapshot(g: Game, muted: boolean): Hud {
  return {
    credits: g.credits,
    lives: g.lives,
    health: g.health,
    ammo: g.ammo,
    score: g.score,
    wave: g.wave,
    mode: g.mode,
    initials: g.initials,
    initialSlot: g.initialSlot,
    submitted: g.submitted,
    waveMsgT: g.waveMsgT,
    insertFlash: g.insertFlash,
    muted,
  };
}
