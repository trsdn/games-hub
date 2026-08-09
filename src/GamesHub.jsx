import React, { useState, useMemo, useRef, useEffect } from "react";

const HX = "#fb7185", HO = "#7dd3fc";

const G_SuperTicTacToe = (function () {

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(cells) {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  if (cells.every((c) => c !== null)) return "draw";
  return null;
}

function findLine(marks) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (marks[a] && marks[a] !== "draw" && marks[a] === marks[b] && marks[a] === marks[c]) {
      return line;
    }
  }
  return null;
}

const emptyBoards = () => Array.from({ length: 9 }, () => Array(9).fill(null));
const bigCenter = (i) => ({ x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 });

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8,
    drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: Math.random() > 0.5,
  }));


// --- Bot: Negamax Alpha-Beta ueber Sub-Board-Zwang ---
function sttMoves(boards, wins, act) {
  const ms = [];
  for (let bi = 0; bi < 9; bi++) {
    if (wins[bi]) continue;
    if (act !== null && bi !== act) continue;
    for (let ci = 0; ci < 9; ci++) if (!boards[bi][ci]) ms.push([bi, ci]);
  }
  return ms;
}
function sttApply(boards, wins, act, bi, ci, p) {
  const nb = boards.map((b, i) => (i === bi ? [...b] : b));
  nb[bi][ci] = p;
  const nw = [...wins];
  const w = winnerOf(nb[bi]);
  if (w) nw[bi] = w;
  const big = winnerOf(nw.map((x) => (x === "draw" ? null : x)));
  let na = ci;
  if (nw[ci] || nb[ci].every((c) => c !== null)) na = null;
  return { boards: nb, wins: nw, act: big ? null : na, big };
}
function sttEval(wins, boards) {
  const pot = (cells, p) => {
    let s = 0;
    for (const L of LINES) {
      let n = 0, blocked = false;
      for (const i of L) { if (cells[i] === p) n++; else if (cells[i] && cells[i] !== "draw") blocked = true; }
      if (!blocked) s += n === 2 ? 6 : n === 1 ? 1 : 0;
    }
    return s;
  };
  const big = wins.map((x) => (x === "draw" ? null : x));
  let s = 0;
  for (let i = 0; i < 9; i++) { if (big[i] === "O") s += 30 + (i === 4 ? 8 : 0); else if (big[i] === "X") s -= 30 + (i === 4 ? 8 : 0); }
  s += 3 * (pot(big, "O") - pot(big, "X"));
  for (let bi = 0; bi < 9; bi++) if (!wins[bi]) s += 0.6 * (pot(boards[bi], "O") - pot(boards[bi], "X"));
  return s;
}
function sttNm(boards, wins, act, depth, alpha, beta, p) {
  const ms = sttMoves(boards, wins, act);
  if (!ms.length) return 0;
  let best = -Infinity;
  for (const [bi, ci] of ms) {
    const r = sttApply(boards, wins, act, bi, ci, p);
    let sc;
    if (r.big === p) sc = 5000;
    else if (r.big === "draw") sc = 0;
    else if (depth <= 1) sc = (p === "O" ? 1 : -1) * sttEval(r.wins, r.boards);
    else sc = -sttNm(r.boards, r.wins, r.act, depth - 1, -beta, -alpha, p === "X" ? "O" : "X");
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function sttBotMove(boards, wins, act) {
  let best = null, bs = -Infinity;
  for (const [bi, ci] of sttMoves(boards, wins, act)) {
    const r = sttApply(boards, wins, act, bi, ci, "O");
    const sc = r.big === "O" ? 5000 : r.big === "draw" ? 0 : -sttNm(r.boards, r.wins, r.act, 4, -Infinity, Infinity, "X");
    if (sc > bs) { bs = sc; best = [bi, ci]; }
  }
  return best;
}

function SuperTicTacToe() {
  const [boards, setBoards] = useState(emptyBoards);
  const [boardWins, setBoardWins] = useState(Array(9).fill(null));
  const [player, setPlayer] = useState("X");
  const [active, setActive] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [winLine, setWinLine] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const reset = () => {
    setBoards(emptyBoards());
    setBoardWins(Array(9).fill(null));
    setPlayer("X");
    setActive(null);
    setWinner(null);
    setWinLine(null);
    setConfetti([]);
  };

  const playable = (bi) => !winner && !boardWins[bi] && (active === null || active === bi);

  const move = (bi, ci, byBot) => {
    if (winner || !playable(bi) || boards[bi][ci] !== null) return;
    if (mode === "bot" && player === "O" && !byBot) return;

    const next = boards.map((b, i) => (i === bi ? [...b] : b));
    next[bi][ci] = player;

    const newWins = [...boardWins];
    const w = winnerOf(next[bi]);
    if (w) newWins[bi] = w;

    const big = winnerOf(newWins.map((x) => (x === "draw" ? null : x)));

    let nextActive = ci;
    if (newWins[ci] || next[ci].every((c) => c !== null)) nextActive = null;

    setBoards(next);
    setBoardWins(newWins);
    if (big && big !== "draw") {
      setWinner(big);
      setWinLine(findLine(newWins));
      setConfetti(makeConfetti());
    } else if (big === "draw") {
      setWinner("draw");
    }
    setActive(big ? null : nextActive);
    setPlayer(player === "X" ? "O" : "X");
  };

  const mark = (v, size) => {
    if (v === "X") return <span className={`${size} font-light text-rose-400 leading-none`}>✕</span>;
    if (v === "O") return <span className={`${size} font-light text-sky-300 leading-none`}>○</span>;
    return null;
  };

  const inWin = (bi) => winLine && winLine.includes(bi);
  const lineColor = winner === "X" ? "#fb7185" : "#7dd3fc";

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const m = sttBotMove(boards, boardWins, active); if (m) move(m[0], m[1], true); }, 400);
    return () => clearTimeout(t);
  }, [mode, player, winner, boards, boardWins, active]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes stt-draw { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
        @keyframes stt-glow {
          0%,100% { box-shadow: 0 0 0 2px var(--c), 0 0 14px 1px var(--c); }
          50%     { box-shadow: 0 0 0 2px var(--c), 0 0 26px 5px var(--c); }
        }
        @keyframes stt-pop {
          0%   { transform: scale(.6); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes stt-confetti {
          0%   { transform: translateY(-12vh) translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateY(112vh) translateX(var(--drift)) rotate(var(--rot)); opacity: 0; }
        }
        .stt-line { stroke-dasharray: 400; animation: stt-draw .5s ease-out forwards; }
        .stt-win  { animation: stt-glow 1.4s ease-in-out infinite; }
        .stt-pop  { animation: stt-pop .4s cubic-bezier(.34,1.56,.64,1) both; }
        .stt-dim  { opacity: .3; transition: opacity .4s; }
        .stt-confetti {
          position: absolute; top: 0;
          animation-name: stt-confetti;
          animation-timing-function: cubic-bezier(.3,.6,.5,1);
          animation-fill-mode: forwards;
        }
      `}</style>

      {/* Konfetti */}
      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span
              key={p.id}
              className="stt-confetti block"
              style={{
                left: p.left + "%",
                width: p.size + "px",
                height: p.size + "px",
                background: p.color,
                borderRadius: p.round ? "50%" : "2px",
                animationDelay: p.delay + "s",
                animationDuration: p.dur + "s",
                "--drift": p.drift + "px",
                "--rot": p.rot + "deg",
              }}
            />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Gewinne drei der neun kleinen Felder in einer Reihe.</p>
              <p><span className="text-neutral-100">Clou:</span> Dein Zug bestimmt das nächste Feld — wo du in einem kleinen Feld spielst, dorthin (großes Feld) muss der Gegner.</p>
              <p><span className="text-neutral-100">Freie Wahl:</span> Ist das vorgegebene Feld schon entschieden oder voll, darf der Gegner frei wählen.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.2em] font-light text-neutral-100">SUPER · TIC&nbsp;TAC&nbsp;TOE</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-5 tracking-wide">
          Drei kleine Felder in einer Reihe gewinnen.
        </p>

        {/* Status */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="text-sky-300">○</span>:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="mb-4 h-10 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            winner === "draw" ? (
              <span className="text-sm text-neutral-300">Unentschieden</span>
            ) : (
              <span key="win" className="text-sm stt-pop inline-flex items-center gap-2">
                <span className="text-neutral-500">Sieger</span>
                <span className={winner === "X" ? "text-rose-400 text-xl" : "text-sky-300 text-xl"}>
                  {winner === "X" ? "✕" : "○"}
                </span>
              </span>
            )
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className={player === "X" ? "text-rose-400 text-lg" : "text-sky-300 text-lg"}>
                {player === "X" ? "✕" : "○"}
              </span>
            </span>
          )}
          <span className="text-[11px] text-neutral-500 tracking-wide">
            {winner ? "" : active === null ? "freie Wahl" : "Zielfeld aktiv"}
          </span>
        </div>

        {/* Grosses Brett */}
        <div className="relative">
          <div className="grid grid-cols-3 gap-2 aspect-square">
            {boards.map((cells, bi) => {
              const decided = boardWins[bi];
              const isActive = playable(bi);
              const won = inWin(bi);
              return (
                <div
                  key={bi}
                  style={won ? { "--c": lineColor } : undefined}
                  className={[
                    "relative rounded-xl p-1.5 transition-all duration-200",
                    won ? "stt-win bg-neutral-900" : winner ? "stt-dim" : "",
                    decided
                      ? "bg-neutral-900"
                      : isActive
                      ? "bg-neutral-800 ring-2 ring-amber-400/70 shadow-lg shadow-amber-400/5"
                      : "bg-neutral-900/60",
                  ].join(" ")}
                >
                  {decided && decided !== "draw" ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {mark(decided, "text-6xl")}
                    </div>
                  ) : null}
                  <div className={`grid grid-cols-3 gap-1 h-full ${decided ? "opacity-20" : ""}`}>
                    {cells.map((v, ci) => (
                      <button
                        key={ci}
                        onClick={() => move(bi, ci)}
                        disabled={!isActive || v !== null || !!decided}
                        className={[
                          "aspect-square rounded-md flex items-center justify-center bg-neutral-950/60 transition-colors",
                          isActive && v === null && !decided
                            ? "hover:bg-neutral-700 active:bg-neutral-600 cursor-pointer"
                            : "cursor-default",
                        ].join(" ")}
                      >
                        {mark(v, "text-xl sm:text-2xl")}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Siegeslinie im grossen Brett */}
          {winLine ? (
            <svg
              viewBox="0 0 300 300"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              <line
                className="stt-line"
                x1={bigCenter(winLine[0]).x}
                y1={bigCenter(winLine[0]).y}
                x2={bigCenter(winLine[2]).x}
                y2={bigCenter(winLine[2]).y}
                stroke={lineColor}
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.9"
              />
            </svg>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={reset}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors"
          >
            NEUSTART
          </button>
          <span className="text-[10px] text-neutral-600 tracking-wide text-right max-w-[55%]">
            Dein Zug schickt den Gegner ins gleichnamige Feld.
          </span>
        </div>
      </div>
    </div>
  );
}
return SuperTicTacToe;
})();

const G_ConnectFour = (function () {

const ROWS = 6, COLS = 7;
const COL_X = "#fb7185", COL_O = "#7dd3fc";

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));
const inb = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

function winCellsAt(grid, r, c, pl) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [[r, c]];
    let rr = r + dr, cc = c + dc;
    while (inb(rr, cc) && grid[rr * COLS + cc] === pl) { line.push([rr, cc]); rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inb(rr, cc) && grid[rr * COLS + cc] === pl) { line.unshift([rr, cc]); rr -= dr; cc -= dc; }
    if (line.length >= 4) return line.map(([a, b]) => a * COLS + b);
  }
  return null;
}


// --- Bot: Negamax mit Alpha-Beta, Tiefe 7, Zentrums-Ordering ---
const CF_ORDER = [3, 2, 4, 1, 5, 0, 6];
const cfLanding = (g, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!g[r * COLS + c]) return r; return -1; };
function cfEval(g) {
  let s = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const er = r + 3 * dr, ec = c + 3 * dc;
      if (!inb(er, ec)) continue;
      let o = 0, x = 0;
      for (let k = 0; k < 4; k++) { const v = g[(r + k * dr) * COLS + (c + k * dc)]; if (v === "O") o++; else if (v === "X") x++; }
      if (o && x) continue;
      const w = (n) => (n === 3 ? 60 : n === 2 ? 8 : n === 1 ? 1 : 0);
      if (o) s += w(o); else if (x) s -= w(x);
    }
  }
  for (let r = 0; r < ROWS; r++) { const v = g[r * COLS + 3]; if (v === "O") s += 4; else if (v === "X") s -= 4; }
  return s;
}
function cfNm(g, depth, alpha, beta, p, ply) {
  let any = false, best = -Infinity;
  for (const c of CF_ORDER) {
    const r = cfLanding(g, c); if (r < 0) continue; any = true;
    const idx = r * COLS + c; g[idx] = p;
    let sc;
    if (winCellsAt(g, r, c, p)) sc = 100000 - ply;
    else if (depth <= 1) sc = (p === "O" ? 1 : -1) * cfEval(g);
    else sc = -cfNm(g, depth - 1, -beta, -alpha, p === "O" ? "X" : "O", ply + 1);
    g[idx] = null;
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}
function cfBotMove(grid) {
  const g = [...grid];
  let bestC = -1, best = -Infinity;
  for (const c of CF_ORDER) {
    const r = cfLanding(g, c); if (r < 0) continue;
    const idx = r * COLS + c; g[idx] = "O";
    const sc = winCellsAt(g, r, c, "O") ? 100000 : -cfNm(g, 6, -Infinity, Infinity, "X", 1);
    g[idx] = null;
    if (sc > best) { best = sc; bestC = c; }
  }
  return bestC;
}

function ConnectFour() {
  const [grid, setGrid] = useState(() => Array(ROWS * COLS).fill(null));
  const [player, setPlayer] = useState("X");
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [winCells, setWinCells] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const winSet = useMemo(() => new Set(winCells || []), [winCells]);

  const newGame = () => { setGrid(Array(ROWS * COLS).fill(null)); setPlayer("X"); setWinner(null); setWinCells(null); setConfetti([]); };

  const drop = (c, byBot) => {
    if (winner) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) if (!grid[r * COLS + c]) { row = r; break; }
    if (row < 0) return;
    const ng = [...grid]; ng[row * COLS + c] = player;
    const wc = winCellsAt(ng, row, c, player);
    setGrid(ng);
    if (wc) { setWinner(player); setWinCells(wc); setConfetti(makeConfetti()); }
    else if (ng.every(Boolean)) setWinner("draw");
    else setPlayer(player === "X" ? "O" : "X");
  };

  const colFull = (c) => grid[c] !== null;
  const center = (i) => ({ x: (i % COLS) + 0.5, y: Math.floor(i / COLS) + 0.5 });

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const c = cfBotMove(grid); if (c >= 0) drop(c, true); }, 380);
    return () => clearTimeout(t);
  }, [mode, player, winner, grid]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes c4-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}
        @keyframes c4-fall{0%{transform:translateY(var(--fall))}65%{transform:translateY(0)}78%{transform:translateY(-13%)}90%{transform:translateY(0)}96%{transform:translateY(-4%)}100%{transform:translateY(0)}}
        @keyframes c4-line{to{stroke-dashoffset:0}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .c4-pop{animation:c4-pop .4s cubic-bezier(.34,1.56,.64,1) both}
        .c4-coin{animation:c4-fall .45s cubic-bezier(.5,.05,.5,1) both;box-shadow:inset 0 -3px 5px rgba(0,0,0,.45),inset 0 2px 3px rgba(255,255,255,.25)}
        .c4-line{stroke-dasharray:1;stroke-dashoffset:1;animation:c4-line .5s ease-out forwards}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Vier eigene Steine in einer Reihe — waagerecht, senkrecht oder diagonal.</p>
              <p><span className="text-neutral-100">Zug:</span> Tippe eine Spalte an. Der Stein fällt auf das unterste freie Feld.</p>
              <p><span className="text-neutral-100">Ende:</span> Wer zuerst vier in einer Reihe hat, gewinnt. Volles Brett ohne Reihe ist unentschieden.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.2em] font-light text-neutral-100">CONNECT&nbsp;FOUR</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-4 tracking-wide">Vier in einer Reihe — waagerecht, senkrecht oder diagonal.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm c4-pop inline-flex items-center gap-2">{winner === "draw" ? <span className="text-neutral-300">Unentschieden</span> : (<><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></>)}</span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] text-neutral-600 tracking-wide">Spalte antippen</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="relative" style={{ width: "100%", aspectRatio: `${COLS} / ${ROWS}` }}>
            <div className="grid grid-cols-7 gap-1 w-full" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
              {grid.map((v, i) => {
                const r = Math.floor(i / COLS), c = i % COLS;
                const ghost = !v && !winner && r === 0 && hoverCol === c && !colFull(c);
                const isWin = winSet.has(i);
                return (
                  <div key={i} className="relative rounded-md bg-neutral-900 flex items-center justify-center" style={{ aspectRatio: "1" }}>
                    <div className="absolute rounded-full bg-neutral-950" style={{ width: "82%", height: "82%" }} />
                    {v ? (<div className="relative c4-coin rounded-full" style={{ width: "82%", height: "82%", background: v === "X" ? COL_X : COL_O, "--fall": `${-(r + 2) * 120}%`, opacity: winner && !isWin ? 0.45 : 1, boxShadow: isWin ? "0 0 0 2px #fff, 0 0 12px 2px rgba(255,255,255,.4)" : undefined }} />)
                      : ghost ? (<div className="relative rounded-full" style={{ width: "82%", height: "82%", opacity: 0.25, background: player === "X" ? COL_X : COL_O }} />) : null}
                  </div>
                );
              })}
            </div>
            {winCells ? (<svg viewBox={`0 0 ${COLS} ${ROWS}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none"><line className="c4-line" x1={center(winCells[0]).x} y1={center(winCells[0]).y} x2={center(winCells[winCells.length - 1]).x} y2={center(winCells[winCells.length - 1]).y} stroke="#fff" strokeWidth="0.12" strokeLinecap="round" pathLength={1} opacity="0.85" /></svg>) : null}
            <div className="absolute inset-0 flex">
              {Array.from({ length: COLS }, (_, c) => (<button key={c} onClick={() => drop(c)} onMouseEnter={() => setHoverCol(c)} onMouseLeave={() => setHoverCol(null)} disabled={!!winner || colFull(c)} className="flex-1 h-full bg-transparent border-0 appearance-none outline-none" style={{ cursor: !winner && !colFull(c) ? "pointer" : "default" }} />))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return ConnectFour;
})();

const G_Pentago = (function () {

const CELL = 42, CG = 3, QG = 10, DISC = 34;
const QUAD = 3 * CELL + 2 * CG;        // 132
const BOARD = 2 * QUAD + QG;           // 274
const COL_X = "#fb7185"; // beginnt
const COL_O = "#7dd3fc";

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

function winners(grid) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const res = {};
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const v = grid[r * 6 + c];
    if (!v || res[v]) continue;
    for (const [dr, dc] of dirs) {
      const cells = [[r, c]];
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 6 && cc >= 0 && cc < 6 && grid[rr * 6 + cc] === v) { cells.push([rr, cc]); rr += dr; cc += dc; }
      if (cells.length >= 5) { res[v] = cells.map(([a, b]) => a * 6 + b); break; }
    }
  }
  return res;
}

function rotateQuad(grid, q, dir) {
  const ng = [...grid];
  const baseR = q >= 2 ? 3 : 0, baseC = q % 2 ? 3 : 0;
  for (let lr = 0; lr < 3; lr++) for (let lc = 0; lc < 3; lc++) {
    const src = grid[(baseR + lr) * 6 + (baseC + lc)];
    const nr = dir === "cw" ? lc : 2 - lc;
    const nc = dir === "cw" ? 2 - lr : lr;
    ng[(baseR + nr) * 6 + (baseC + nc)] = src;
  }
  return ng;
}


// --- Bot: plant Setzen+Drehung gemeinsam, prueft X-Sofortsiege fuer Top-Kandidaten ---
const PENT_WINS = (() => {
  const L = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) L.push([0, 1, 2, 3, 4].map((k) => r * 6 + c + k));
  for (let c = 0; c < 6; c++) for (let r = 0; r < 2; r++) L.push([0, 1, 2, 3, 4].map((k) => (r + k) * 6 + c));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    L.push([0, 1, 2, 3, 4].map((k) => (r + k) * 6 + (c + k)));
    L.push([0, 1, 2, 3, 4].map((k) => (r + k) * 6 + (c + 4 - k)));
  }
  return L;
})();
const PENT_V = [0, 1, 6, 30, 200, 9999];
function pentEval(g) {
  let s = 0;
  for (const W of PENT_WINS) {
    let o = 0, x = 0;
    for (const i of W) { if (g[i] === "O") o++; else if (g[i] === "X") x++; }
    if (o && x) continue;
    if (o) s += PENT_V[o]; else if (x) s -= PENT_V[x];
  }
  return s;
}
function pentXWins(g) {
  for (let j = 0; j < 36; j++) {
    if (g[j]) continue;
    const g3 = [...g]; g3[j] = "X";
    if (winners(g3).X) return true;
    for (let q = 0; q < 4; q++) for (const d of ["cw", "ccw"]) {
      const w = winners(rotateQuad(g3, q, d));
      if (w.X && !w.O) return true;
    }
  }
  return false;
}
function pentBotPlan(grid) {
  const cands = [];
  for (let idx = 0; idx < 36; idx++) {
    if (grid[idx]) continue;
    const g1 = [...grid]; g1[idx] = "O";
    if (winners(g1).O) return { idx, q: 0, dir: "cw" };
    for (let q = 0; q < 4; q++) for (const dir of ["cw", "ccw"]) {
      const g2 = rotateQuad(g1, q, dir);
      const w = winners(g2);
      let sc;
      if (w.O && w.X) sc = 0;
      else if (w.O) sc = 100000;
      else if (w.X) sc = -100000;
      else sc = pentEval(g2);
      cands.push({ idx, q, dir, sc, g2 });
    }
  }
  cands.sort((a, b) => b.sc - a.sc);
  if (cands[0] && cands[0].sc >= 100000) return cands[0];
  for (const c of cands.slice(0, 12)) {
    if (c.sc <= -100000) continue;
    if (!pentXWins(c.g2)) return c;
  }
  return cands[0];
}

function Pentago() {
  const [grid, setGrid] = useState(() => Array(36).fill(null));
  const [player, setPlayer] = useState("X");
  const [phase, setPhase] = useState("place"); // place | rotate
  const [rotating, setRotating] = useState(null); // {q,dir}
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [winLine, setWinLine] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const winSet = useMemo(() => new Set(winLine || []), [winLine]);

  const newGame = () => {
    setGrid(Array(36).fill(null));
    setPlayer("X"); setPhase("place"); setRotating(null);
    setWinner(null); setWinLine(null); setConfetti([]);
  };

  const place = (idx, byBot) => {
    if (winner || phase !== "place" || grid[idx]) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    const ng = [...grid];
    ng[idx] = player;
    const w = winners(ng);
    setGrid(ng);
    if (w[player]) { setWinner(player); setWinLine(w[player]); setConfetti(makeConfetti()); return; }
    if (ng.every(Boolean)) { setWinner("draw"); return; }
    setPhase("rotate");
  };

  const startRotate = (q, dir, byBot) => {
    if (winner || phase !== "rotate" || rotating) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    setRotating({ q, dir });
  };

  const finishRotate = (q) => {
    if (!rotating || rotating.q !== q) return;
    const ng = rotateQuad(grid, rotating.q, rotating.dir);
    const w = winners(ng);
    setGrid(ng);
    setRotating(null);
    if (w.X && w.O) { setWinner("draw"); return; }
    if (w.X || w.O) {
      const win = w.X ? "X" : "O";
      setWinner(win); setWinLine(w[win]); setConfetti(makeConfetti()); return;
    }
    if (ng.every(Boolean)) { setWinner("draw"); return; }
    setPlayer(player === "X" ? "O" : "X");
    setPhase("place");
  };

  const center = (i) => {
    const r = Math.floor(i / 6), c = i % 6;
    const x = (c < 3 ? 0 : QUAD + QG) + (c % 3) * (CELL + CG) + CELL / 2;
    const y = (r < 3 ? 0 : QUAD + QG) + (r % 3) * (CELL + CG) + CELL / 2;
    return { x, y };
  };

  const Coin = ({ v, isWin }) => (
    <div className="pent-coin rounded-full" style={{
      width: "81%", height: "81%", background: v === "X" ? COL_X : COL_O,
      opacity: winner && !isWin ? 0.4 : 1,
      boxShadow: isWin
        ? "0 0 0 2px #fff, 0 0 12px 2px rgba(255,255,255,.4)"
        : "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)",
    }} />
  );

  const pentPlanRef = useRef(null);
  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    if (phase === "place") {
      const t = setTimeout(() => {
        const plan = pentBotPlan(grid);
        if (!plan) return;
        pentPlanRef.current = plan;
        place(plan.idx, true);
      }, 420);
      return () => clearTimeout(t);
    }
    if (phase === "rotate" && !rotating) {
      const t = setTimeout(() => {
        const plan = pentPlanRef.current || pentBotPlan(grid);
        pentPlanRef.current = null;
        startRotate(plan ? plan.q : 0, plan ? plan.dir : "cw", true);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [mode, player, winner, phase, rotating, grid]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes pent-pop { 0%{transform:scale(0)} 70%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes pent-cw { from{transform:rotate(0)} to{transform:rotate(90deg)} }
        @keyframes pent-ccw { from{transform:rotate(0)} to{transform:rotate(-90deg)} }
        @keyframes pent-line { to { stroke-dashoffset: 0; } }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .pent-coin { animation: pent-pop .24s cubic-bezier(.34,1.56,.64,1) both; }
        .pent-rot-cw { animation: pent-cw .42s cubic-bezier(.4,0,.2,1); }
        .pent-rot-ccw { animation: pent-ccw .42s cubic-bezier(.4,0,.2,1); }
        .pent-line { stroke-dasharray:1; stroke-dashoffset:1; animation: pent-line .55s ease-out forwards; }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Fünf eigene Steine in einer Reihe — waagerecht, senkrecht oder diagonal, auch über Quadrantengrenzen hinweg.</p>
              <p><span className="text-neutral-100">Zug:</span> Erst einen Stein auf ein freies Feld setzen, dann einen der vier Quadranten um 90° drehen (↺/↻). Die Drehung gehört zwingend zum Zug dazu.</p>
              <p><span className="text-neutral-100">Achtung:</span> Auch die Drehung kann dem Gegner fünf in einer Reihe bescheren. Entsteht für beide gleichzeitig eine Reihe, ist es unentschieden.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] font-light text-neutral-100">PENTAGO</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">
          Stein setzen, dann einen Quadranten drehen. Fünf in einer Reihe gewinnen.
        </p>

        {/* Status */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm inline-flex items-center gap-2" style={{ animation: "pent-pop .4s both" }}>
              {winner === "draw" ? <span className="text-neutral-300">Unentschieden</span> : (
                <>
                  <span className="text-neutral-500">Sieger</span>
                  <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} />
                </>
              )}
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}
          <span className="text-[11px] text-neutral-500 tracking-wide">
            {winner ? "" : phase === "place" ? "Stein setzen" : "Quadrant drehen"}
          </span>
        </div>

        {/* Brett */}
        <div className="rounded-xl bg-neutral-950 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="relative" style={{ width: "100%", aspectRatio: "1" }}>
            {/* Quadranten + Steine */}
            <div className="grid grid-cols-2" style={{ gap: "3.6%" }}>
              {[0, 1, 2, 3].map((q) => {
                const baseR = q >= 2 ? 3 : 0, baseC = q % 2 ? 3 : 0;
                const rot = rotating && rotating.q === q ? (rotating.dir === "cw" ? "pent-rot-cw" : "pent-rot-ccw") : "";
                return (
                  <div key={q} className={`rounded-lg bg-neutral-900 grid grid-cols-3 ${rot}`}
                    style={{ gap: "2.3%", padding: 0, width: "100%", aspectRatio: "1", transformOrigin: "center" }}
                    onAnimationEnd={() => finishRotate(q)}>
                    {Array.from({ length: 9 }, (_, k) => {
                      const lr = Math.floor(k / 3), lc = k % 3;
                      const idx = (baseR + lr) * 6 + (baseC + lc);
                      const v = grid[idx];
                      const canPlace = !winner && phase === "place" && !v && !rotating;
                      return (
                        <button key={k} onClick={() => canPlace && place(idx)} disabled={!canPlace}
                          className="rounded-md bg-neutral-950/60 flex items-center justify-center"
                          style={{ aspectRatio: "1", cursor: canPlace ? "pointer" : "default", border: 0, padding: 0 }}>
                          {v ? <Coin v={v} isWin={winSet.has(idx)} /> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Gewinnlinie */}
            {winLine ? (
              <svg viewBox={`0 0 ${BOARD} ${BOARD}`} preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none">
                <line className="pent-line"
                  x1={center(winLine[0]).x} y1={center(winLine[0]).y}
                  x2={center(winLine[winLine.length - 1]).x} y2={center(winLine[winLine.length - 1]).y}
                  stroke="#fff" strokeWidth="6" strokeLinecap="round" pathLength={1} opacity="0.85" />
              </svg>
            ) : null}

            {/* Dreh-Steuerung */}
            {phase === "rotate" && !winner && !rotating ? (
              <div className="absolute inset-0 grid grid-cols-2 pointer-events-none" style={{ gap: "3.6%" }}>
                {[0, 1, 2, 3].map((q) => (
                  <div key={q} className="flex items-center justify-center gap-2" style={{ width: "100%", aspectRatio: "1" }}>
                    <button onClick={() => startRotate(q, "ccw")}
                      className="pointer-events-auto w-10 h-10 rounded-full bg-neutral-800/90 border border-neutral-600 text-neutral-100 text-xl flex items-center justify-center hover:bg-neutral-700">↺</button>
                    <button onClick={() => startRotate(q, "cw")}
                      className="pointer-events-auto w-10 h-10 rounded-full bg-neutral-800/90 border border-neutral-600 text-neutral-100 text-xl flex items-center justify-center hover:bg-neutral-700">↻</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-600 tracking-wide max-w-[58%]">
            Nach dem Setzen ↺/↻ auf einem Quadranten wählen.
          </span>
          <button onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return Pentago;
})();

const G_Gobblet = (function () {

const CELL = 86, GAP = 8, BOARD = 3 * CELL + 2 * GAP; // 274
const BOARD_PX = ["37%", "60%", "86%"]; // klein, mittel, gross (% der Zelle)
const RES_PX = [18, 24, 30];     // Vorrat
const COL_X = "#fb7185"; // beginnt
const COL_O = "#7dd3fc";
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

const topOf = (stack) => (stack.length ? stack[stack.length - 1] : null);

function winnerAfter(board, current) {
  const t = (i) => { const s = board[i]; return s.length ? s[s.length - 1].p : null; };
  let cur = null, opp = null;
  for (const L of LINES) {
    const [a, b, c] = L, pa = t(a);
    if (pa && pa === t(b) && pa === t(c)) { if (pa === current) cur = cur || L; else opp = opp || L; }
  }
  if (cur) return { p: current, cells: cur };
  if (opp) return { p: current === "X" ? "O" : "X", cells: opp };
  return null;
}


// --- Bot: Negamax Alpha-Beta ueber Reserve- und Brettzuege ---
function gbMoves(board, reserve, p) {
  const ms = [];
  const top = (i) => topOf(board[i]);
  for (let s = 0; s < 3; s++) if (reserve[p][s] > 0) for (let i = 0; i < 9; i++) { const t = top(i); if (!t || t.s < s) ms.push({ type: "r", s, to: i }); }
  for (let i = 0; i < 9; i++) { const t = top(i); if (t && t.p === p) for (let j = 0; j < 9; j++) { if (j === i) continue; const tj = top(j); if (!tj || tj.s < t.s) ms.push({ type: "b", from: i, to: j }); } }
  return ms;
}
function gbApply(board, reserve, p, m) {
  const nb = board.map((s) => [...s]);
  let nr = reserve;
  if (m.type === "r") { nb[m.to].push({ p, s: m.s }); nr = { X: [...reserve.X], O: [...reserve.O] }; nr[p][m.s]--; }
  else nb[m.to].push(nb[m.from].pop());
  const w = winnerAfter(nb, p);
  return { board: nb, reserve: nr, win: w ? w.p : null };
}
function gbEval(board) {
  const t = (i) => { const s = board[i]; return s.length ? s[s.length - 1].p : null; };
  let sc = 0;
  for (const L of LINES) {
    let o = 0, x = 0;
    for (const i of L) { const v = t(i); if (v === "O") o++; else if (v === "X") x++; }
    if (o && x) continue;
    sc += (o === 2 ? 12 : o === 1 ? 2 : 0) - (x === 2 ? 12 : x === 1 ? 2 : 0);
  }
  if (t(4) === "O") sc += 4; else if (t(4) === "X") sc -= 4;
  return sc;
}
function gbNm(board, reserve, depth, alpha, beta, p) {
  const ms = gbMoves(board, reserve, p);
  if (!ms.length) return 0;
  let best = -Infinity;
  for (const m of ms) {
    const r = gbApply(board, reserve, p, m);
    let sc;
    if (r.win) sc = r.win === p ? 10000 : -10000;
    else if (depth <= 1) sc = (p === "O" ? 1 : -1) * gbEval(r.board);
    else sc = -gbNm(r.board, r.reserve, depth - 1, -beta, -alpha, p === "X" ? "O" : "X");
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function gbBotMove(board, reserve) {
  let best = null, bs = -Infinity;
  for (const m of gbMoves(board, reserve, "O")) {
    const r = gbApply(board, reserve, "O", m);
    const sc = r.win ? (r.win === "O" ? 10000 : -10000) : -gbNm(r.board, r.reserve, 3, -Infinity, Infinity, "X");
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}

function Gobblet() {
  const [board, setBoard] = useState(() => Array.from({ length: 9 }, () => []));
  const [reserve, setReserve] = useState({ X: [2, 2, 2], O: [2, 2, 2] });
  const [player, setPlayer] = useState("X");
  const [selected, setSelected] = useState(null); // {type:"reserve",size} | {type:"board",idx}
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [winLine, setWinLine] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const winSet = useMemo(() => new Set(winLine || []), [winLine]);

  const movingSize = selected
    ? (selected.type === "reserve" ? selected.size : topOf(board[selected.idx])?.s)
    : null;

  const targets = useMemo(() => {
    if (!selected || winner) return new Set();
    const out = new Set();
    for (let i = 0; i < 9; i++) {
      if (selected.type === "board" && i === selected.idx) continue;
      const t = topOf(board[i]);
      if (!t || t.s < movingSize) out.add(i);
    }
    return out;
  }, [selected, board, movingSize, winner]);

  const newGame = () => {
    setBoard(Array.from({ length: 9 }, () => []));
    setReserve({ X: [2, 2, 2], O: [2, 2, 2] });
    setPlayer("X"); setSelected(null); setWinner(null); setWinLine(null); setConfetti([]);
  };

  const apply = (target, selOverride) => {
    const selA = selOverride || selected;
    const ng = board.map((s) => [...s]);
    if (selA.type === "reserve") {
      ng[target].push({ p: player, s: selA.size });
      const nr = { X: [...reserve.X], O: [...reserve.O] };
      nr[player][selA.size]--;
      setReserve(nr);
    } else {
      ng[target].push(ng[selA.idx].pop());
    }
    setBoard(ng);
    setSelected(null);
    const w = winnerAfter(ng, player);
    if (w) { setWinner(w.p); setWinLine(w.cells); setConfetti(makeConfetti()); return; }
    setPlayer(player === "X" ? "O" : "X");
  };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && player === "O") return;
    if (selected && targets.has(idx)) { apply(idx); return; }
    const t = topOf(board[idx]);
    if (t && t.p === player) {
      setSelected(selected && selected.type === "board" && selected.idx === idx ? null : { type: "board", idx });
    } else setSelected(null);
  };

  const clickReserve = (size) => {
    if (winner || reserve[player][size] <= 0) return;
    if (mode === "bot" && player === "O") return;
    setSelected(selected && selected.type === "reserve" && selected.size === size ? null : { type: "reserve", size });
  };

  const Coin = ({ p, s, px, dim, glow, faded }) => (
    <div className="gg-coin rounded-full" style={{
      width: px, height: px, background: p === "X" ? COL_X : COL_O,
      opacity: faded ? 0.4 : dim ? 0.5 : 1,
      boxShadow: glow
        ? "0 0 0 2px #fff, 0 0 12px 2px rgba(255,255,255,.4)"
        : "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)",
    }} />
  );

  const ReserveRow = ({ who }) => {
    const active = who === player && !winner;
    return (
      <div className={`flex items-center justify-center gap-4 h-14 rounded-lg border transition-colors ${active ? "border-neutral-700 bg-neutral-900" : "border-neutral-900 bg-neutral-950"}`}>
        {[2, 1, 0].map((s) => {
          const n = reserve[who][s];
          const sel = active && selected && selected.type === "reserve" && selected.size === s;
          return (
            <button key={s} onClick={() => who === player && clickReserve(s)} disabled={!active || n <= 0}
              className="flex items-center gap-1.5"
              style={{ cursor: active && n > 0 ? "pointer" : "default", opacity: n > 0 ? 1 : 0.25, background: "transparent", border: 0, padding: 0 }}>
              <div className="rounded-full" style={{
                width: RES_PX[s], height: RES_PX[s], background: who === "X" ? COL_X : COL_O,
                boxShadow: sel ? "0 0 0 2px #fff" : "inset 0 -2px 3px rgba(0,0,0,.4)",
              }} />
              <span className="text-xs text-neutral-500 tabular-nums">×{n}</span>
            </button>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => {
      const m = gbBotMove(board, reserve);
      if (m) apply(m.to, m.type === "r" ? { type: "reserve", size: m.s } : { type: "board", idx: m.from });
    }, 420);
    return () => clearTimeout(t);
  }, [mode, player, winner, board, reserve]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes gg-pop { 0%{transform:scale(.4)} 70%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes gg-line { to { stroke-dashoffset: 0; } }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .gg-coin { animation: gg-pop .22s cubic-bezier(.34,1.56,.64,1) both; }
        .gg-line { stroke-dasharray:1; stroke-dashoffset:1; animation: gg-line .5s ease-out forwards; }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Drei eigene Steine in einer Reihe — waagerecht, senkrecht oder diagonal.</p>
              <p><span className="text-neutral-100">Steine:</span> Jeder hat je zwei kleine, mittlere und große. Ein größerer Stein darf einen kleineren verschlucken — auch einen eigenen, auch auf dem Brett.</p>
              <p><span className="text-neutral-100">Zug:</span> Entweder einen neuen Stein aus dem Vorrat setzen oder einen eigenen obenliegenden Stein vom Brett umsetzen. Vorsicht: Hebt man einen Stein hoch, kann darunter eine gegnerische Reihe sichtbar werden.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.2em] font-light text-neutral-100">GOBBLET&nbsp;GOBBLERS</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">
          Drei in einer Reihe. Ein größerer Stein verschluckt einen kleineren.
        </p>

        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm inline-flex items-center gap-2" style={{ animation: "gg-pop .4s both" }}>
              <span className="text-neutral-500">Sieger</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} />
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}
          <span className="text-[11px] text-neutral-500 tracking-wide">
            {winner ? "" : selected ? "Ziel wählen" : "Stein wählen"}
          </span>
        </div>

        <div className="mb-3"><ReserveRow who="O" /></div>

        {/* Brett */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="relative" style={{ width: "100%", aspectRatio: "1" }}>
            <div className="grid grid-cols-3" style={{ gap: "2.9%" }}>
              {board.map((stack, idx) => {
                const t = topOf(stack);
                const isSel = selected && selected.type === "board" && selected.idx === idx;
                const isTarget = targets.has(idx);
                const isWin = winSet.has(idx);
                return (
                  <button key={idx} onClick={() => clickField(idx)}
                    className="relative rounded-lg bg-neutral-950/60 flex items-center justify-center"
                    style={{
                      aspectRatio: "1", border: 0, padding: 0,
                      cursor: !winner ? "pointer" : "default",
                      boxShadow: isSel ? "inset 0 0 0 2px #fff"
                        : isTarget ? `inset 0 0 0 2px ${player === "X" ? COL_X : COL_O}` : undefined,
                    }}>
                    {t ? (
                      <Coin key={`${idx}-${stack.length}-${t.p}${t.s}`} p={t.p} s={t.s} px={BOARD_PX[t.s]}
                        glow={isWin} faded={winner && !isWin} />
                    ) : isTarget ? (
                      <div className="rounded-full" style={{ width: BOARD_PX[movingSize], height: BOARD_PX[movingSize], background: player === "X" ? COL_X : COL_O, opacity: 0.22 }} />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {winLine ? (
              <svg viewBox={`0 0 ${BOARD} ${BOARD}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                {(() => {
                  const ctr = (i) => ({ x: (i % 3) * (CELL + GAP) + CELL / 2, y: Math.floor(i / 3) * (CELL + GAP) + CELL / 2 });
                  const a = ctr(winLine[0]), b = ctr(winLine[2]);
                  return <line className="gg-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth="6" strokeLinecap="round" pathLength={1} opacity="0.85" />;
                })()}
              </svg>
            ) : null}
          </div>
        </div>

        <div className="mt-3"><ReserveRow who="X" /></div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-neutral-600 tracking-wide max-w-[58%]">
            Vorrat-Stein oder eigenes Feld wählen, dann Ziel antippen.
          </span>
          <button onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return Gobblet;
})();

const G_Hex = (function () {

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [-1, 1], [1, -1]];
const COL_X = "#fb7185"; // X / Rot: oben <-> unten
const COL_O = "#7dd3fc"; // O / Blau: links <-> rechts

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8,
    drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: Math.random() > 0.5,
  }));

// Gewinnpfad via BFS: X verbindet Reihe 0<->N-1, O verbindet Spalte 0<->N-1
function winPathFor(grid, N, pl) {
  const idx = (r, c) => r * N + c;
  const seen = new Set();
  const parent = new Map();
  const queue = [];
  for (let i = 0; i < N; i++) {
    const r = pl === "X" ? 0 : i;
    const c = pl === "X" ? i : 0;
    if (grid[idx(r, c)] === pl) {
      seen.add(idx(r, c));
      parent.set(idx(r, c), null);
      queue.push([r, c]);
    }
  }
  while (queue.length) {
    const [r, c] = queue.shift();
    const goal = pl === "X" ? r === N - 1 : c === N - 1;
    if (goal) {
      const path = [];
      let k = idx(r, c);
      while (k !== null && k !== undefined) {
        path.push([Math.floor(k / N), k % N]);
        k = parent.get(k);
      }
      return path;
    }
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
      const ni = idx(nr, nc);
      if (seen.has(ni) || grid[ni] !== pl) continue;
      seen.add(ni);
      parent.set(ni, idx(r, c));
      queue.push([nr, nc]);
    }
  }
  return null;
}

const hexPoints = (cx, cy, s) => {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    p.push(`${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`);
  }
  return p.join(" ");
};


// --- Bot: kuerzeste-Pfad-Differenz (Dijkstra), nutzt die Tausch-Regel ---
function hexDist(grid, Nn, p) {
  const idx = (r, c) => r * Nn + c;
  const INF = 1e9;
  const dist = Array(Nn * Nn).fill(INF);
  const pq = [];
  for (let k = 0; k < Nn; k++) {
    const r = p === "X" ? 0 : k, c = p === "X" ? k : 0;
    const i = idx(r, c), v = grid[i];
    if (v === p) { dist[i] = 0; pq.push([0, i]); }
    else if (!v) { dist[i] = 1; pq.push([1, i]); }
  }
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, i] = pq.shift();
    if (d > dist[i]) continue;
    const r = Math.floor(i / Nn), c = i % Nn;
    if (p === "X" ? r === Nn - 1 : c === Nn - 1) return d;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= Nn || nc >= Nn) continue;
      const ni = idx(nr, nc), v = grid[ni];
      if (v && v !== p) continue;
      const nd = d + (v === p ? 0 : 1);
      if (nd < dist[ni]) { dist[ni] = nd; pq.push([nd, ni]); }
    }
  }
  return INF;
}
function hexBotMove(grid, Nn) {
  const empt = [];
  for (let i = 0; i < Nn * Nn; i++) if (!grid[i]) empt.push(i);
  if (empt.length === Nn * Nn) return Math.floor(Nn / 2) * Nn + Math.floor(Nn / 2);
  let best = -1, bs = -Infinity;
  for (const i of empt) {
    const g = [...grid]; g[i] = "O";
    if (winPathFor(g, Nn, "O")) return i;
    const my = hexDist(g, Nn, "O"), op = hexDist(g, Nn, "X");
    const sc = (op - my) * 10 - my * 0.5 + Math.random() * 0.01;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}

function Hex() {
  const [size, setSize] = useState(11);
  const [grid, setGrid] = useState(() => Array(11 * 11).fill(null));
  const [player, setPlayer] = useState("X");
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [path, setPath] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const N = size;
  const s = 1;

  const centers = useMemo(() => {
    const arr = [];
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        arr[r * N + c] = { x: s * Math.sqrt(3) * (c + r / 2), y: s * 1.5 * r };
    return arr;
  }, [N]);

  const view = useMemo(() => {
    const xs = centers.map((p) => p.x);
    const ys = centers.map((p) => p.y);
    const minX = Math.min(...xs) - s, maxX = Math.max(...xs) + s;
    const minY = Math.min(...ys) - s, maxY = Math.max(...ys) + s;
    const m = 1.5;
    return { minX, minY, w: maxX - minX, h: maxY - minY, m };
  }, [centers]);

  const newGame = (n) => {
    setSize(n);
    setGrid(Array(n * n).fill(null));
    setPlayer("X");
    setWinner(null);
    setPath(null);
    setConfetti([]);
  };

  const move = (r, c, byBot) => {
    if (winner) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    const i = r * N + c;
    if (grid[i]) return;
    const ng = [...grid];
    ng[i] = player;
    const wp = winPathFor(ng, N, player);
    setGrid(ng);
    if (wp) {
      setWinner(player);
      setPath(wp);
      setConfetti(makeConfetti());
    } else {
      setPlayer(player === "X" ? "O" : "X");
    }
  };

  const placed = useMemo(() => grid.reduce((n, v) => n + (v ? 1 : 0), 0), [grid]);
  const canSwap = !winner && placed === 1 && player === "O";

  const swap = () => {
    if (!canSwap) return;
    setGrid(grid.map((v) => (v ? "O" : null))); // Eroeffnungsstein wird O
    setPlayer("X");
  };

  const winColor = winner === "X" ? COL_X : COL_O;
  const pathSet = useMemo(
    () => new Set((path || []).map(([r, c]) => r * N + c)),
    [path, N]
  );

  // Eckzentren fuer die Randbalken
  const tl = centers[0], tr = centers[N - 1];
  const bl = centers[(N - 1) * N], br = centers[(N - 1) * N + (N - 1)];

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => {
      if (canSwap) {
        const fi = grid.findIndex(Boolean);
        const r = Math.floor(fi / N), c = fi % N;
        if (Math.min(r, c, N - 1 - r, N - 1 - c) >= 1) { swap(); return; }
      }
      const i = hexBotMove(grid, N);
      if (i >= 0) move(Math.floor(i / N), i % N, true);
    }, 450);
    return () => clearTimeout(t);
  }, [mode, player, winner, grid, canSwap]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes stt-draw { to { stroke-dashoffset: 0; } }
        @keyframes stt-pop {
          0% { transform: scale(.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes stt-confetti {
          0% { transform: translateY(-12vh) translateX(0) rotate(0); opacity: 1; }
          100% { transform: translateY(112vh) translateX(var(--drift)) rotate(var(--rot)); opacity: 0; }
        }
        .stt-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: stt-draw .7s ease-out forwards; }
        .stt-pop { animation: stt-pop .4s cubic-bezier(.34,1.56,.64,1) both; }
        .stt-hex { transition: fill .15s; cursor: pointer; }
        .stt-hex:hover { fill: #2e2e35 !important; }
        .stt-confetti {
          position: absolute; top: 0;
          animation-name: stt-confetti;
          animation-timing-function: cubic-bezier(.3,.6,.5,1);
          animation-fill-mode: forwards;
        }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Verbinde mit einer durchgehenden Kette eigener Steine deine beiden Ränder — <span style={{ color: COL_X }}>✕ oben/unten</span>, <span style={{ color: COL_O }}>○ links/rechts</span>.</p>
              <p><span className="text-neutral-100">Zug:</span> Setze einen Stein auf ein freies Feld. Es gibt kein Unentschieden — eine Seite verbindet immer.</p>
              <p><span className="text-neutral-100">Pie Rule:</span> Direkt nach dem ersten Zug darf ○ diesen übernehmen statt selbst zu setzen — das gleicht den Anzugsvorteil aus.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.35em] font-light text-neutral-100">HEX</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-4 tracking-wide">
          Verbinde deine beiden Ränder mit einer durchgehenden Kette.
        </p>

        {/* Status */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="mb-3 h-10 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm stt-pop inline-flex items-center gap-2">
              <span className="text-neutral-500">Sieger</span>
              <span className="text-xl" style={{ color: winColor }}>{winner === "X" ? "✕" : "○"}</span>
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="text-lg" style={{ color: player === "X" ? COL_X : COL_O }}>
                {player === "X" ? "✕" : "○"}
              </span>
            </span>
          )}
          <span className="text-[11px] tracking-wide flex items-center gap-3">
            <span style={{ color: COL_X }}>✕ oben/unten</span>
            <span style={{ color: COL_O }}>○ links/rechts</span>
          </span>
        </div>

        {/* Pie Rule: Tausch-Angebot nach dem ersten Zug */}
        {canSwap ? (
          <div className="mb-3 stt-pop flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2">
            <span className="text-xs text-amber-200/90 tracking-wide">
              Pie Rule: ○ kann den Eröffnungszug übernehmen.
            </span>
            <button
              onClick={swap}
              className="text-xs tracking-[0.15em] rounded-md px-3 py-1.5 border border-amber-400/60 text-amber-100 hover:bg-amber-400/20 transition-colors"
            >
              TAUSCHEN
            </button>
          </div>
        ) : null}

        {/* Brett */}
        <svg
          viewBox={`${view.minX - view.m} ${view.minY - view.m} ${view.w + 2 * view.m} ${view.h + 2 * view.m}`}
          className="w-full h-auto"
        >
          {/* Randbalken */}
          <g strokeLinecap="round" strokeWidth="0.45" opacity="0.9">
            <line x1={tl.x - 0.6} y1={tl.y - 1.35} x2={tr.x + 0.6} y2={tr.y - 1.35} stroke={COL_X} />
            <line x1={bl.x - 0.6} y1={bl.y + 1.35} x2={br.x + 0.6} y2={br.y + 1.35} stroke={COL_X} />
            <line x1={tl.x - 1.15} y1={tl.y - 0.3} x2={bl.x - 1.15} y2={bl.y + 0.3} stroke={COL_O} />
            <line x1={tr.x + 1.15} y1={tr.y - 0.3} x2={br.x + 1.15} y2={br.y + 0.3} stroke={COL_O} />
          </g>

          {/* Felder */}
          {centers.map((p, i) => {
            const v = grid[i];
            const onPath = pathSet.has(i);
            const fill = v === "X" ? COL_X : v === "O" ? COL_O : "#18181b";
            const interactive = !v && !winner;
            return (
              <polygon
                key={i}
                points={hexPoints(p.x, p.y, s * 0.94)}
                fill={fill}
                stroke={onPath ? "#f5f5f5" : "#3f3f46"}
                strokeWidth={onPath ? 0.18 : 0.08}
                opacity={winner && !onPath && v ? 0.5 : 1}
                className={interactive ? "stt-hex" : undefined}
                onClick={interactive ? () => move(Math.floor(i / N), i % N) : undefined}
              />
            );
          })}

          {/* Siegeskette */}
          {path ? (
            <polyline
              className="stt-line"
              points={path.map(([r, c]) => `${centers[r * N + c].x},${centers[r * N + c].y}`).join(" ")}
              fill="none"
              stroke={winColor}
              strokeWidth="0.45"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
            />
          ) : null}
        </svg>

        {/* Steuerung */}
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[9, 11, 13].map((n) => (
              <button
                key={n}
                onClick={() => newGame(n)}
                className={[
                  "text-xs tracking-wide rounded-md px-3 py-1.5 border transition-colors",
                  size === n
                    ? "border-neutral-500 text-neutral-100 bg-neutral-800"
                    : "border-neutral-800 text-neutral-500 hover:text-neutral-300",
                ].join(" ")}
              >
                {n}×{n}
              </button>
            ))}
          </div>
          <button
            onClick={() => newGame(size)}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors"
          >
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return Hex;
})();

const G_LinesOfAction = (function () {

const N = 8, CELL = 38, GAP = 2, BOARD = N * CELL + (N - 1) * GAP; // 318
const DISC = 28;
const COL_X = "#fb7185"; // beginnt
const COL_O = "#7dd3fc";
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

const initBoard = () => {
  const b = Array(64).fill(null);
  for (let c = 1; c <= 6; c++) { b[c] = "X"; b[56 + c] = "X"; }
  for (let r = 1; r <= 6; r++) { b[r * 8] = "O"; b[r * 8 + 7] = "O"; }
  return b;
};

function countLine(board, r, c, dr, dc) {
  let n = 1;
  for (const s of [1, -1]) {
    let rr = r + dr * s, cc = c + dc * s;
    while (inb(rr, cc)) { if (board[rr * 8 + cc]) n++; rr += dr * s; cc += dc * s; }
  }
  return n;
}

function legalTargets(board, idx, player) {
  const r = Math.floor(idx / 8), c = idx % 8;
  const opp = player === "X" ? "O" : "X";
  const out = new Set();
  for (const [dr, dc] of DIRS) {
    const n = countLine(board, r, c, dr, dc);
    const tr = r + dr * n, tc = c + dc * n;
    if (!inb(tr, tc)) continue;
    let blocked = false;
    for (let k = 1; k < n; k++) if (board[(r + dr * k) * 8 + (c + dc * k)] === opp) { blocked = true; break; }
    if (blocked) continue;
    if (board[tr * 8 + tc] === player) continue;
    out.add(tr * 8 + tc);
  }
  return out;
}

function connected(board, player) {
  const cells = [];
  for (let i = 0; i < 64; i++) if (board[i] === player) cells.push(i);
  if (cells.length <= 1) return true;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / 8), c = i % 8;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (inb(nr, nc) && board[nr * 8 + nc] === player && !seen.has(nr * 8 + nc)) {
        seen.add(nr * 8 + nc); stack.push(nr * 8 + nc);
      }
    }
  }
  return seen.size === cells.length;
}


// --- Bot: Negamax Alpha-Beta, Eval = Konzentration + Komponenten ---
function loaMoves(b, p) {
  const ms = [];
  for (let i = 0; i < 64; i++) if (b[i] === p) for (const t of legalTargets(b, i, p)) ms.push([i, t]);
  return ms;
}
function loaEval(b) {
  const side = (p) => {
    const cs = [];
    for (let i = 0; i < 64; i++) if (b[i] === p) cs.push(i);
    if (!cs.length) return 0;
    let mr = 0, mc = 0;
    for (const i of cs) { mr += Math.floor(i / 8); mc += i % 8; }
    mr /= cs.length; mc /= cs.length;
    let d = 0;
    for (const i of cs) { const r = Math.floor(i / 8) - mr, c = (i % 8) - mc; d += r * r + c * c; }
    const seen = new Set(); let comp = 0;
    for (const i of cs) {
      if (seen.has(i)) continue;
      comp++; const st = [i]; seen.add(i);
      while (st.length) {
        const k = st.pop(), r = Math.floor(k / 8), c = k % 8;
        for (const [dr, dc] of DIRS) {
          const nr = r + dr, nc = c + dc;
          if (inb(nr, nc) && b[nr * 8 + nc] === p && !seen.has(nr * 8 + nc)) { seen.add(nr * 8 + nc); st.push(nr * 8 + nc); }
        }
      }
    }
    return -d - comp * 14;
  };
  return side("O") - side("X");
}
function loaNm(b, depth, alpha, beta, p) {
  const opp = p === "X" ? "O" : "X";
  const ms = loaMoves(b, p);
  if (!ms.length) return (p === "O" ? 1 : -1) * loaEval(b);
  let best = -Infinity;
  for (const [f, t] of ms) {
    const sf = b[f], st = b[t];
    b[t] = p; b[f] = null;
    let sc;
    if (connected(b, p)) sc = 10000;
    else if (connected(b, opp)) sc = -10000;
    else if (depth <= 1) sc = (p === "O" ? 1 : -1) * loaEval(b);
    else sc = -loaNm(b, depth - 1, -beta, -alpha, opp);
    b[f] = sf; b[t] = st;
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function loaBotMove(board) {
  const b = [...board];
  let best = null, bs = -Infinity;
  for (const [f, t] of loaMoves(b, "O")) {
    const sf = b[f], st = b[t];
    b[t] = "O"; b[f] = null;
    let sc;
    if (connected(b, "O")) sc = 10000;
    else if (connected(b, "X")) sc = -10000;
    else sc = -loaNm(b, 2, -Infinity, Infinity, "X");
    b[f] = sf; b[t] = st;
    if (sc > bs) { bs = sc; best = [f, t]; }
  }
  return best;
}

function LinesOfAction() {
  const [board, setBoard] = useState(initBoard);
  const [player, setPlayer] = useState("X");
  const [sel, setSel] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const targets = useMemo(
    () => (sel === null || winner ? new Set() : legalTargets(board, sel, player)),
    [sel, board, player, winner]
  );

  const newGame = () => {
    setBoard(initBoard()); setPlayer("X"); setSel(null); setWinner(null); setConfetti([]);
  };

  const move = (to, fromIdx) => {
    const from = fromIdx != null ? fromIdx : sel;
    const ng = [...board];
    ng[to] = player; ng[from] = null;
    setBoard(ng); setSel(null);
    const meConn = connected(ng, player);
    const opp = player === "X" ? "O" : "X";
    const oppConn = connected(ng, opp);
    if (meConn) { setWinner(player); setConfetti(makeConfetti()); return; }
    if (oppConn) { setWinner(opp); setConfetti(makeConfetti()); return; }
    setPlayer(opp);
  };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && player === "O") return;
    if (sel !== null && targets.has(idx)) { move(idx); return; }
    if (board[idx] === player) setSel(sel === idx ? null : idx);
    else setSel(null);
  };

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const mv = loaBotMove(board); if (mv) move(mv[1], mv[0]); }, 420);
    return () => clearTimeout(t);
  }, [mode, player, winner, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes loa-pop { 0%{transform:scale(.5)} 70%{transform:scale(1.1)} 100%{transform:scale(1)} }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .loa-pop { animation: loa-pop .22s cubic-bezier(.34,1.56,.64,1) both; }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5"
          style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2>
              <button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button>
            </div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Bringe alle deine Steine zu einer einzigen zusammenhängenden Gruppe — waagerecht, senkrecht oder diagonal benachbart zählt.</p>
              <p><span className="text-neutral-100">Bewegung:</span> Ein Stein zieht waagerecht, senkrecht oder diagonal. Die Weite ist genau die Anzahl aller Steine (beide Farben) auf dieser Linie.</p>
              <p><span className="text-neutral-100">Pfad:</span> Über eigene Steine darfst du springen, nicht über gegnerische. Auf dem Zielfeld darf kein eigener Stein stehen — ein gegnerischer wird geschlagen.</p>
              <p><span className="text-neutral-100">Sieg:</span> Wer zuerst alle eigenen Steine verbunden hat, gewinnt. Verbindet dein Zug (etwa durch Schlagen) nur den Gegner, gewinnt dieser.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-base tracking-[0.18em] font-light text-neutral-100">LINES OF ACTION</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln"
            className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Verbinde alle deine Steine zu einer Gruppe.</p>

        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm loa-pop inline-flex items-center gap-2">
              <span className="text-neutral-500">Sieger</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} />
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}
          <span className="text-[11px] text-neutral-500 tracking-wide">{winner ? "" : sel === null ? "Stein wählen" : "Ziel wählen"}</span>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="relative" style={{ width: "100%", aspectRatio: "1" }}>
            <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 3, aspectRatio: "1" }}>
              {board.map((v, idx) => {
                const r = Math.floor(idx / 8), c = idx % 8;
                const dark = (r + c) % 2 === 1;
                const isSel = sel === idx;
                const isTarget = targets.has(idx);
                const capture = isTarget && v;
                return (
                  <button key={idx} onClick={() => clickField(idx)}
                    className="relative flex items-center justify-center"
                    style={{
                      aspectRatio: "1", border: 0, padding: 0, borderRadius: 5,
                      background: dark ? "#141417" : "#1d1d21",
                      cursor: winner ? "default" : "pointer",
                      boxShadow: isSel ? "inset 0 0 0 2px #fff"
                        : capture ? `inset 0 0 0 2px ${player === "X" ? COL_X : COL_O}` : undefined,
                    }}>
                    {v ? (
                      <div className="loa-pop rounded-full" style={{
                        width: "74%", height: "74%", background: v === "X" ? COL_X : COL_O,
                        opacity: winner && winner !== v ? 0.45 : 1,
                        boxShadow: "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)",
                      }} />
                    ) : isTarget ? (
                      <div className="rounded-full" style={{ width: 12, height: 12, background: player === "X" ? COL_X : COL_O, opacity: 0.45 }} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-neutral-600 tracking-wide max-w-[58%]">Eigenen Stein wählen, dann ein leuchtendes Ziel.</span>
          <button onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return LinesOfAction;
})();

const G_Amazons = (function () {

const N = 8, CELL = 38, GAP = 2, BOARD = N * CELL + (N - 1) * GAP;
const DISC = 26;
const COL_X = "#fb7185", COL_O = "#7dd3fc", ARROW = "#52525b";
const D8 = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

const initBoard = () => { const b = Array(64).fill(null); [2, 5, 16, 23].forEach((i) => b[i] = "O"); [58, 61, 40, 47].forEach((i) => b[i] = "X"); return b; };

function queen(board, idx) {
  const r = Math.floor(idx / 8), c = idx % 8, out = new Set();
  for (const [dr, dc] of D8) {
    let nr = r + dr, nc = c + dc;
    while (inb(nr, nc) && !board[nr * 8 + nc]) { out.add(nr * 8 + nc); nr += dr; nc += dc; }
  }
  return out;
}
const hasMove = (board, p) => { for (let i = 0; i < 64; i++) if (board[i] === p && queen(board, i).size) return true; return false; };


// --- Bot: vollstaendige Zug+Pfeil-Enumeration, Mobilitaets-Differenz ---
function azEval(b) {
  const mob = (p) => { let s = 0; for (let i = 0; i < 64; i++) if (b[i] === p) s += queen(b, i).size; return s; };
  const mo = mob("O"), mx = mob("X");
  return (mo - mx) + (mx === 0 ? 5000 : 0) - (mo === 0 ? 5000 : 0);
}
function azBotMove(board) {
  const b = [...board];
  let best = null, bs = -Infinity;
  for (let f = 0; f < 64; f++) {
    if (b[f] !== "O") continue;
    for (const t of queen(b, f)) {
      b[t] = "O"; b[f] = null;
      for (const a of queen(b, t)) {
        b[a] = "#";
        const sc = azEval(b) + Math.random() * 0.01;
        b[a] = null;
        if (sc > bs) { bs = sc; best = [f, t, a]; }
      }
      b[f] = "O"; b[t] = null;
    }
  }
  return best;
}

function Amazons() {
  const [board, setBoard] = useState(initBoard);
  const [player, setPlayer] = useState("X");
  const [phase, setPhase] = useState("move"); // move | shoot
  const [sel, setSel] = useState(null);
  const [shooter, setShooter] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const targets = useMemo(() => {
    if (winner) return new Set();
    if (phase === "move") return sel === null ? new Set() : queen(board, sel);
    return shooter === null ? new Set() : queen(board, shooter);
  }, [phase, sel, shooter, board, winner]);

  const newGame = () => { setBoard(initBoard()); setPlayer("X"); setPhase("move"); setSel(null); setShooter(null); setWinner(null); setConfetti([]); };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && player === "O") return;
    if (phase === "move") {
      if (sel !== null && targets.has(idx)) {
        const ng = [...board]; ng[idx] = player; ng[sel] = null;
        setBoard(ng); setSel(null); setShooter(idx); setPhase("shoot"); return;
      }
      if (board[idx] === player) setSel(sel === idx ? null : idx); else setSel(null);
      return;
    }
    // shoot
    if (targets.has(idx)) {
      const ng = [...board]; ng[idx] = "#";
      const opp = player === "X" ? "O" : "X";
      setBoard(ng); setShooter(null); setPhase("move");
      if (!hasMove(ng, opp)) { setWinner(player); setConfetti(makeConfetti()); return; }
      setPlayer(opp);
    }
  };

  const hint = winner ? "" : phase === "shoot" ? "Pfeil schießen" : sel === null ? "Amazone wählen" : "Ziel wählen";

  const azPlanRef = useRef(null);
  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    if (phase === "move") {
      const t = setTimeout(() => {
        const plan = azBotMove(board);
        if (!plan) return;
        azPlanRef.current = plan;
        const ng = [...board]; ng[plan[1]] = "O"; ng[plan[0]] = null;
        setBoard(ng); setSel(null); setShooter(plan[1]); setPhase("shoot");
      }, 420);
      return () => clearTimeout(t);
    }
    if (phase === "shoot" && azPlanRef.current) {
      const t = setTimeout(() => {
        const plan = azPlanRef.current; azPlanRef.current = null;
        const ng = [...board]; ng[plan[2]] = "#";
        setBoard(ng); setShooter(null); setPhase("move");
        if (!hasMove(ng, "X")) { setWinner("O"); setConfetti(makeConfetti()); return; }
        setPlayer("X");
      }, 330);
      return () => clearTimeout(t);
    }
  }, [mode, player, winner, phase, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes az-pop{0%{transform:scale(.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .az-pop{animation:az-pop .2s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Zug in zwei Schritten:</span> Bewege eine deiner vier Amazonen wie eine Schachdame (beliebig weit, 8 Richtungen, nicht über Figuren).</p>
              <p><span className="text-neutral-100">Dann:</span> Von ihrem neuen Feld schießt sie einen Pfeil — ebenfalls wie eine Dame. Das getroffene Feld ist dauerhaft blockiert.</p>
              <p><span className="text-neutral-100">Sieg:</span> Pfeile und Amazonen sperren das Brett zu. Wer keine Amazone mehr bewegen kann, verliert.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.25em] font-light text-neutral-100">AMAZONS</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Ziehen, Pfeil schießen, den Gegner einsperren.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm az-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] text-neutral-500 tracking-wide">{hint}</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 3, aspectRatio: "1" }}>
            {board.map((v, idx) => {
              const r = Math.floor(idx / 8), c = idx % 8, dark = (r + c) % 2 === 1;
              const isSel = sel === idx || shooter === idx, isTarget = targets.has(idx);
              const tcol = phase === "shoot" ? ARROW : player === "X" ? COL_X : COL_O;
              return (
                <button key={idx} onClick={() => clickField(idx)} className="relative flex items-center justify-center"
                  style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 5, background: dark ? "#141417" : "#1d1d21", cursor: winner ? "default" : "pointer", boxShadow: isSel ? "inset 0 0 0 2px #fff" : isTarget ? `inset 0 0 0 2px ${tcol}` : undefined }}>
                  {v === "X" || v === "O" ? (<div className="az-pop rounded-full" style={{ width: "68%", height: "68%", background: v === "X" ? COL_X : COL_O, opacity: winner && winner !== v ? 0.45 : 1, boxShadow: "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)" }} />)
                    : v === "#" ? (<div className="az-pop" style={{ width: "47%", height: "47%", borderRadius: 4, background: ARROW, transform: "rotate(45deg)" }} />)
                      : isTarget ? (<div className="rounded-full" style={{ width: 11, height: 11, background: tcol, opacity: 0.5 }} />) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Amazons;
})();

const G_DotsAndBoxes = (function () {

const DOTS = 5, BOX = 4, D = 64, SIZE = (DOTS - 1) * D; // 256
const COL_X = "#fb7185"; // beginnt
const COL_O = "#7dd3fc";

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

// hE[r*BOX+c]: r 0..4, c 0..3  (20)  | vE[r*DOTS+c]: r 0..3, c 0..4 (20) | bx: 16
const boxDone = (br, bc, hE, vE) =>
  hE[br * BOX + bc] && hE[(br + 1) * BOX + bc] && vE[br * DOTS + bc] && vE[br * DOTS + (bc + 1)];


// --- Bot: nimmt Boxen, meidet dritte Kanten, opfert sonst die kleinste Kette ---
function dbSidesHV(h, v, r, c) {
  let n = 0;
  if (h[r * BOX + c]) n++;
  if (h[(r + 1) * BOX + c]) n++;
  if (v[r * DOTS + c]) n++;
  if (v[r * DOTS + (c + 1)]) n++;
  return n;
}
function dbEdgesOfBox(r, c) {
  return [["h", r * BOX + c], ["h", (r + 1) * BOX + c], ["v", r * DOTS + c], ["v", r * DOTS + (c + 1)]];
}
function dbBoxesOf(type, idx) {
  const out = [];
  if (type === "h") { const r = Math.floor(idx / BOX), c = idx % BOX; if (r < BOX) out.push([r, c]); if (r > 0) out.push([r - 1, c]); }
  else { const r = Math.floor(idx / DOTS), c = idx % DOTS; if (c < BOX) out.push([r, c]); if (c > 0) out.push([r, c - 1]); }
  return out;
}
function dbCount4(h, v) {
  let n = 0;
  for (let r = 0; r < BOX; r++) for (let c = 0; c < BOX; c++) if (dbSidesHV(h, v, r, c) === 4) n++;
  return n;
}
function dbGreedyTakeAll(h, v) {
  let prog = true;
  while (prog) {
    prog = false;
    for (let r = 0; r < BOX; r++) for (let c = 0; c < BOX; c++) {
      if (dbSidesHV(h, v, r, c) !== 3) continue;
      const miss = dbEdgesOfBox(r, c).find(([t, i]) => (t === "h" ? !h[i] : !v[i]));
      if (miss) { (miss[0] === "h" ? h : v)[miss[1]] = 1; prog = true; }
    }
  }
}
function dbBotMove(hE, vE) {
  const edges = [];
  for (let i = 0; i < DOTS * BOX; i++) if (!hE[i]) edges.push(["h", i]);
  for (let i = 0; i < BOX * DOTS; i++) if (!vE[i]) edges.push(["v", i]);
  if (!edges.length) return null;
  const base4 = dbCount4(hE, vE);
  for (const [t, i] of edges) {
    const h = hE.map((x) => (x ? 1 : 0)), v = vE.map((x) => (x ? 1 : 0));
    (t === "h" ? h : v)[i] = 1;
    if (dbCount4(h, v) > base4) return [t, i];
  }
  const safe = edges.filter(([t, i]) => {
    const h = hE.map((x) => (x ? 1 : 0)), v = vE.map((x) => (x ? 1 : 0));
    (t === "h" ? h : v)[i] = 1;
    return dbBoxesOf(t, i).every(([r, c]) => dbSidesHV(h, v, r, c) !== 3);
  });
  if (safe.length) return safe[Math.floor(Math.random() * safe.length)];
  let best = null, bs = Infinity;
  for (const [t, i] of edges) {
    const h = hE.map((x) => (x ? 1 : 0)), v = vE.map((x) => (x ? 1 : 0));
    (t === "h" ? h : v)[i] = 1;
    const before = dbCount4(h, v);
    dbGreedyTakeAll(h, v);
    const given = dbCount4(h, v) - before;
    if (given < bs) { bs = given; best = [t, i]; }
  }
  return best;
}

function DotsAndBoxes() {
  const [hE, setHE] = useState(() => Array(DOTS * BOX).fill(null));
  const [vE, setVE] = useState(() => Array(BOX * DOTS).fill(null));
  const [bx, setBx] = useState(() => Array(BOX * BOX).fill(null));
  const [player, setPlayer] = useState("X");
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [scored, setScored] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const nX = useMemo(() => bx.filter((v) => v === "X").length, [bx]);
  const nO = useMemo(() => bx.filter((v) => v === "O").length, [bx]);

  const newGame = () => {
    setHE(Array(DOTS * BOX).fill(null));
    setVE(Array(BOX * DOTS).fill(null));
    setBx(Array(BOX * BOX).fill(null));
    setPlayer("X"); setWinner(null); setScored(false); setConfetti([]);
  };

  const draw = (type, idx, byBot) => {
    if (winner) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    const nh = [...hE], nv = [...vE];
    if (type === "h") { if (nh[idx]) return; nh[idx] = player; }
    else { if (nv[idx]) return; nv[idx] = player; }

    const nb = [...bx];
    let made = 0;
    for (let br = 0; br < BOX; br++) for (let bc = 0; bc < BOX; bc++) {
      const i = br * BOX + bc;
      if (!nb[i] && boxDone(br, bc, nh, nv)) { nb[i] = player; made++; }
    }
    setHE(nh); setVE(nv); setBx(nb);

    const full = nh.every(Boolean) && nv.every(Boolean);
    if (full) {
      const x = nb.filter((v) => v === "X").length, o = nb.filter((v) => v === "O").length;
      const w = x > o ? "X" : o > x ? "O" : "draw";
      setWinner(w); if (w !== "draw") setConfetti(makeConfetti());
      return;
    }
    if (made > 0) { setScored(true); }
    else { setScored(false); setPlayer(player === "X" ? "O" : "X"); }
  };

  const dotXY = (r, c) => ({ x: c * D, y: r * D });

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const m = dbBotMove(hE, vE); if (m) draw(m[0], m[1], true); }, 400);
    return () => clearTimeout(t);
  }, [mode, player, winner, hE, vE]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes db-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes db-fade { from{opacity:0} to{opacity:1} }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .db-pop { animation: db-pop .4s cubic-bezier(.34,1.56,.64,1) both; }
        .db-fade { animation: db-fade .3s ease-out both; }
        .db-hit { cursor:pointer; }
        .db-hit:hover + line, .db-hit:hover { }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5"
          style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2>
              <button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button>
            </div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Mehr Kästchen einnehmen als der Gegner.</p>
              <p><span className="text-neutral-100">Zug:</span> Tippe eine Lücke zwischen zwei Punkten an, um diese Kante zu ziehen.</p>
              <p><span className="text-neutral-100">Kästchen:</span> Wer die vierte Kante eines Kästchens zieht und es damit schließt, bekommt es in seiner Farbe.</p>
              <p><span className="text-neutral-100">Nochmal:</span> Hast du ein Kästchen geschlossen, bist du sofort wieder dran. Sonst wechselt der Zug.</p>
              <p><span className="text-neutral-100">Ende:</span> Wenn alle Kanten gezogen sind, gewinnt die Mehrheit der Kästchen.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.2em] font-light text-neutral-100">KÄSEKÄSTCHEN</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln"
            className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Schließe Kästchen, dann bist du nochmal dran.</p>

        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm db-pop inline-flex items-center gap-2">
              {winner === "draw" ? <span className="text-neutral-300">Unentschieden</span> : (
                <><span className="text-neutral-500">Sieger</span>
                  <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></>
              )}
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}
          <span className="text-sm flex items-center gap-2 tabular-nums">
            <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: COL_X }} />
            <span className="text-neutral-300">{nX}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-300">{nO}</span>
            <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: COL_O }} />
          </span>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-4 border border-neutral-800 flex justify-center">
          <svg viewBox={`-14 -14 ${SIZE + 28} ${SIZE + 28}`} className="w-full h-auto" style={{ maxWidth: 560 }}>
            {/* Kästchen */}
            {bx.map((owner, i) => {
              if (!owner) return null;
              const br = Math.floor(i / BOX), bc = i % BOX;
              const col = owner === "X" ? COL_X : COL_O;
              return (
                <g key={i} className="db-fade">
                  <rect x={bc * D + 6} y={br * D + 6} width={D - 12} height={D - 12} rx="7" fill={col} opacity="0.22" />
                  <circle cx={bc * D + D / 2} cy={br * D + D / 2} r="7" fill={col} />
                </g>
              );
            })}

            {/* gezogene Kanten */}
            {hE.map((o, i) => o ? (() => { const r = Math.floor(i / BOX), c = i % BOX;
              return <line key={"h" + i} x1={c * D} y1={r * D} x2={(c + 1) * D} y2={r * D} stroke="#d4d4d8" strokeWidth="5" strokeLinecap="round" />;
            })() : null)}
            {vE.map((o, i) => o ? (() => { const r = Math.floor(i / DOTS), c = i % DOTS;
              return <line key={"v" + i} x1={c * D} y1={r * D} x2={c * D} y2={(r + 1) * D} stroke="#d4d4d8" strokeWidth="5" strokeLinecap="round" />;
            })() : null)}

            {/* klickbare Lücken */}
            {!winner && hE.map((o, i) => { if (o) return null; const r = Math.floor(i / BOX), c = i % BOX;
              return <line key={"hh" + i} className="db-hit" x1={c * D} y1={r * D} x2={(c + 1) * D} y2={r * D}
                stroke="transparent" strokeWidth="18" strokeLinecap="round" onClick={() => draw("h", i)} />;
            })}
            {!winner && vE.map((o, i) => { if (o) return null; const r = Math.floor(i / DOTS), c = i % DOTS;
              return <line key={"vv" + i} className="db-hit" x1={c * D} y1={r * D} x2={c * D} y2={(r + 1) * D}
                stroke="transparent" strokeWidth="18" strokeLinecap="round" onClick={() => draw("v", i)} />;
            })}

            {/* Punkte */}
            {Array.from({ length: DOTS * DOTS }, (_, i) => {
              const r = Math.floor(i / DOTS), c = i % DOTS, p = dotXY(r, c);
              return <circle key={"d" + i} cx={p.x} cy={p.y} r="4" fill="#71717a" />;
            })}
          </svg>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-neutral-600 tracking-wide">Lücke zwischen zwei Punkten antippen.</span>
          <button onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return DotsAndBoxes;
})();

const G_Reversi = (function () {

const N = 8;
const COL_X = "#fb7185"; // beginnt
const COL_O = "#7dd3fc";
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

const initGrid = () => {
  const g = Array(N * N).fill(null);
  g[3 * N + 3] = "O"; g[4 * N + 4] = "O";
  g[3 * N + 4] = "X"; g[4 * N + 3] = "X";
  return g;
};

function flipsFor(grid, r, c, pl) {
  if (grid[r * N + c]) return [];
  const opp = pl === "X" ? "O" : "X";
  const out = [];
  for (const [dr, dc] of DIRS) {
    let rr = r + dr, cc = c + dc;
    const line = [];
    while (rr >= 0 && rr < N && cc >= 0 && cc < N && grid[rr * N + cc] === opp) {
      line.push(rr * N + cc); rr += dr; cc += dc;
    }
    if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && grid[rr * N + cc] === pl) {
      out.push(...line);
    }
  }
  return out;
}

function validMoves(grid, pl) {
  const set = new Set();
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (flipsFor(grid, r, c, pl).length) set.add(r * N + c);
  return set;
}

const count = (grid, pl) => grid.reduce((n, v) => n + (v === pl ? 1 : 0), 0);


// --- Bot: Negamax Alpha-Beta (Tiefe 5), Positionsgewichte + Mobilitaet, exaktes Endspiel ---
const RV_W = [
  120, -25, 12, 6, 6, 12, -25, 120,
  -25, -45, -3, -3, -3, -3, -45, -25,
  12, -3, 4, 2, 2, 4, -3, 12,
  6, -3, 2, 1, 1, 2, -3, 6,
  6, -3, 2, 1, 1, 2, -3, 6,
  12, -3, 4, 2, 2, 4, -3, 12,
  -25, -45, -3, -3, -3, -3, -45, -25,
  120, -25, 12, 6, 6, 12, -25, 120,
];
function rvApply(g, idx, p) {
  const fl = flipsFor(g, Math.floor(idx / N), idx % N, p);
  const ng = [...g]; ng[idx] = p; for (const f of fl) ng[f] = p; return ng;
}
function rvEval(g) {
  let s = 0;
  for (let i = 0; i < N * N; i++) { if (g[i] === "O") s += RV_W[i]; else if (g[i] === "X") s -= RV_W[i]; }
  s += 9 * (validMoves(g, "O").size - validMoves(g, "X").size);
  return s;
}
function rvNm(g, depth, alpha, beta, p, passed) {
  const opp = p === "X" ? "O" : "X";
  const moves = [...validMoves(g, p)];
  if (!moves.length) {
    if (passed) { const d = count(g, p) - count(g, opp); return d > 0 ? 10000 + d : d < 0 ? -10000 + d : 0; }
    return -rvNm(g, depth, -beta, -alpha, opp, true);
  }
  if (depth <= 0) return (p === "O" ? 1 : -1) * rvEval(g);
  moves.sort((a, b) => RV_W[b] - RV_W[a]);
  let best = -Infinity;
  for (const m of moves) {
    const sc = -rvNm(rvApply(g, m, p), depth - 1, -beta, -alpha, opp, false);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function rvBotMove(grid) {
  const empties = grid.filter((v) => !v).length;
  const depth = empties <= 9 ? empties : 5;
  const moves = [...validMoves(grid, "O")];
  if (!moves.length) return null;
  moves.sort((a, b) => RV_W[b] - RV_W[a]);
  let best = null, bs = -Infinity;
  for (const m of moves) {
    const sc = -rvNm(rvApply(grid, m, "O"), depth - 1, -Infinity, Infinity, "X", false);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}

function Reversi() {
  const [grid, setGrid] = useState(initGrid);
  const [player, setPlayer] = useState("X");
  const [winner, _setWinner] = useState(null); // "X" | "O" | "draw"
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [skipped, setSkipped] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const valid = useMemo(() => (winner ? new Set() : validMoves(grid, player)), [grid, player, winner]);
  const nX = count(grid, "X");
  const nO = count(grid, "O");

  const newGame = () => {
    setGrid(initGrid());
    setPlayer("X");
    setWinner(null);
    setSkipped(null);
    setConfetti([]);
  };

  const move = (r, c, byBot) => {
    if (winner) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    const flips = flipsFor(grid, r, c, player);
    if (!flips.length) return;

    const ng = [...grid];
    ng[r * N + c] = player;
    for (const f of flips) ng[f] = player;

    const other = player === "X" ? "O" : "X";
    setGrid(ng);

    if (validMoves(ng, other).size) {
      setPlayer(other);
      setSkipped(null);
    } else if (validMoves(ng, player).size) {
      setSkipped(other); // Gegner setzt aus, gleicher Spieler nochmal
    } else {
      const fx = count(ng, "X"), fo = count(ng, "O");
      const w = fx > fo ? "X" : fo > fx ? "O" : "draw";
      setWinner(w);
      setSkipped(null);
      if (w !== "draw") setConfetti(makeConfetti());
    }
  };

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const m = rvBotMove(grid); if (m != null) move(Math.floor(m / N), m % N, true); }, 420);
    return () => clearTimeout(t);
  }, [mode, player, winner, grid]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes rv-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes rv-in { 0%{transform:scale(0)} 100%{transform:scale(1)} }
        @keyframes rv-pulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:.45;transform:scale(1)} }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .rv-pop { animation: rv-pop .4s cubic-bezier(.34,1.56,.64,1) both; }
        .rv-mount { width:76%; height:76%; perspective:340px; animation: rv-in .28s cubic-bezier(.34,1.56,.64,1) both; }
        .rv-flip { width:100%; height:100%; position:relative; transform-style:preserve-3d; transition: transform .5s cubic-bezier(.4,0,.2,1); }
        .rv-face { position:absolute; inset:0; border-radius:9999px; backface-visibility:hidden; -webkit-backface-visibility:hidden; box-shadow: inset 0 -3px 5px rgba(0,0,0,.4), inset 0 2px 3px rgba(255,255,255,.25); }
        .rv-hint { width:30%; height:30%; border-radius:9999px; animation: rv-pulse 1.6s ease-in-out infinite; }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Am Ende die meisten Steine deiner Farbe auf dem Brett haben.</p>
              <p><span className="text-neutral-100">Zug:</span> Setze so, dass zwischen dem neuen Stein und einem bestehenden eigenen Stein eine ununterbrochene Reihe gegnerischer Steine eingeschlossen wird — diese werden umgedreht. Mögliche Felder sind markiert.</p>
              <p><span className="text-neutral-100">Passen:</span> Wer keinen gültigen Zug hat, setzt aus. Sind beide blockiert oder ist das Brett voll, endet das Spiel.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] font-light text-neutral-100">REVERSI</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-4 tracking-wide">
          Schließe gegnerische Steine ein, um sie zu drehen. Wer am Ende mehr hat, gewinnt.
        </p>

        {/* Status + Punktestand */}
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm rv-pop inline-flex items-center gap-2">
              {winner === "draw" ? (
                <span className="text-neutral-300">Unentschieden</span>
              ) : (
                <>
                  <span className="text-neutral-500">Sieger</span>
                  <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} />
                </>
              )}
            </span>
          ) : skipped ? (
            <span className="text-sm flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: skipped === "X" ? COL_X : COL_O }} />
              <span className="text-neutral-400">setzt aus —</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}

          <span className="text-sm flex items-center gap-2 tabular-nums">
            <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: COL_X }} />
            <span className="text-neutral-300">{nX}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-300">{nO}</span>
            <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: COL_O }} />
          </span>
        </div>

        {/* Brett */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800">
          <div className="grid grid-cols-8 gap-1 aspect-square">
            {grid.map((v, i) => {
              const r = Math.floor(i / N), c = i % N;
              const isValid = valid.has(i);
              return (
                <button
                  key={i}
                  onClick={() => isValid && move(r, c)}
                  disabled={!isValid}
                  className={[
                    "aspect-square rounded-md flex items-center justify-center bg-neutral-950/70 transition-colors",
                    isValid ? "hover:bg-neutral-800 cursor-pointer" : "cursor-default",
                  ].join(" ")}
                >
                  {v ? (
                    <div className="rv-mount">
                      <div className="rv-flip" style={{ transform: `rotateY(${v === "O" ? 180 : 0}deg)` }}>
                        <div className="rv-face" style={{ background: COL_X }} />
                        <div className="rv-face" style={{ background: COL_O, transform: "rotateY(180deg)" }} />
                      </div>
                    </div>
                  ) : isValid ? (
                    <div className="rv-hint" style={{ background: player === "X" ? COL_X : COL_O }} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end">
          <button
            onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors"
          >
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return Reversi;
})();

const G_Konane = (function () {

const N = 6, CELL = 46, GAP = 3, BOARD = N * CELL + (N - 1) * GAP;
const DISC = 32;
const COL_X = "#fb7185", COL_O = "#7dd3fc";
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

const initBoard = () => Array.from({ length: 36 }, (_, i) => ((Math.floor(i / 6) + (i % 6)) % 2 === 0 ? "X" : "O"));

function jumps(board, idx, player) {
  const opp = player === "X" ? "O" : "X";
  const r = Math.floor(idx / 6), c = idx % 6;
  const res = {};
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    let cr = r, cc = c; const cap = [];
    while (true) {
      const mr = cr + dr, mc = cc + dc, lr = cr + 2 * dr, lc = cc + 2 * dc;
      if (!inb(lr, lc) || board[mr * 6 + mc] !== opp || board[lr * 6 + lc] !== null) break;
      cap.push(mr * 6 + mc); res[lr * 6 + lc] = [...cap]; cr = lr; cc = lc;
    }
  }
  return res;
}
const hasJump = (board, player) => { for (let i = 0; i < 36; i++) if (board[i] === player && Object.keys(jumps(board, i, player)).length) return true; return false; };


// --- Bot: Negamax Alpha-Beta ueber Sprungzuege, adaptive Tiefe ---
function knMoves(b, p) {
  const ms = [];
  for (let i = 0; i < 36; i++) if (b[i] === p) { const t = jumps(b, i, p); for (const k of Object.keys(t)) ms.push([i, +k, t[k]]); }
  return ms;
}
function knNm(b, depth, alpha, beta, p, ply) {
  const ms = knMoves(b, p);
  if (!ms.length) return -10000 + ply;
  if (depth <= 0) return ms.length - knMoves(b, p === "X" ? "O" : "X").length;
  let best = -Infinity;
  for (const [f, t, cap] of ms) {
    const undo = [[f, b[f]], [t, b[t]]];
    for (const c of cap) undo.push([c, b[c]]);
    b[t] = p; b[f] = null;
    for (const c of cap) b[c] = null;
    const sc = -knNm(b, depth - 1, -beta, -alpha, p === "X" ? "O" : "X", ply + 1);
    for (const [i, v] of undo) b[i] = v;
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function knBotMove(board) {
  const b = [...board];
  const n = b.filter(Boolean).length;
  const depth = n > 28 ? 4 : n > 18 ? 6 : 8;
  let best = null, bs = -Infinity;
  for (const [f, t, cap] of knMoves(b, "O")) {
    const undo = [[f, b[f]], [t, b[t]]];
    for (const c of cap) undo.push([c, b[c]]);
    b[t] = "O"; b[f] = null;
    for (const c of cap) b[c] = null;
    const sc = -knNm(b, depth - 1, -Infinity, Infinity, "X", 1);
    for (const [i, v] of undo) b[i] = v;
    if (sc > bs) { bs = sc; best = [f, t]; }
  }
  return best;
}
function knBotRemove(board) {
  const cands = [];
  for (let i = 0; i < 36; i++) {
    if (board[i] !== "O") continue;
    const r = Math.floor(i / 6), c = i % 6;
    if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => inb(r + dr, c + dc) && board[(r + dr) * 6 + (c + dc)] === null)) cands.push(i);
  }
  cands.sort((a, b) => {
    const da = Math.abs(Math.floor(a / 6) - 2.5) + Math.abs((a % 6) - 2.5);
    const db = Math.abs(Math.floor(b / 6) - 2.5) + Math.abs((b % 6) - 2.5);
    return da - db;
  });
  return cands.length ? cands[0] : null;
}

function Konane() {
  const [board, setBoard] = useState(initBoard);
  const [phase, setPhase] = useState("rm1"); // rm1, rm2, play
  const [player, setPlayer] = useState("X");
  const [sel, setSel] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const targets = useMemo(() => (phase !== "play" || sel === null || winner ? {} : jumps(board, sel, player)), [phase, sel, board, player, winner]);

  const newGame = () => { setBoard(initBoard()); setPhase("rm1"); setPlayer("X"); setSel(null); setWinner(null); setConfetti([]); };

  const adjEmpty = (idx) => { const r = Math.floor(idx / 6), c = idx % 6; return [[0,1],[0,-1],[1,0],[-1,0]].some(([dr,dc]) => inb(r+dr,c+dc) && board[(r+dr)*6+(c+dc)] === null); };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && (phase === "rm2" || (phase === "play" && player === "O"))) return;
    if (phase === "rm1") { if (board[idx] === "X") { const ng = [...board]; ng[idx] = null; setBoard(ng); setPhase("rm2"); setPlayer("O"); } return; }
    if (phase === "rm2") { if (board[idx] === "O" && adjEmpty(idx)) { const ng = [...board]; ng[idx] = null; setBoard(ng); setPhase("play"); setPlayer("X"); } return; }
    // play
    if (sel !== null && targets[idx]) {
      const ng = [...board]; ng[idx] = player; ng[sel] = null;
      for (const cidx of targets[idx]) ng[cidx] = null;
      setBoard(ng); setSel(null);
      const opp = player === "X" ? "O" : "X";
      if (!hasJump(ng, opp)) { setWinner(player); setConfetti(makeConfetti()); return; }
      setPlayer(opp); return;
    }
    if (board[idx] === player && Object.keys(jumps(board, idx, player)).length) setSel(sel === idx ? null : idx);
    else setSel(null);
  };

  const hint = winner ? "" : phase === "rm1" ? "✕ entfernt einen eigenen Stein" : phase === "rm2" ? "○ entfernt angrenzenden Stein" : sel === null ? "springenden Stein wählen" : "Ziel wählen";

  useEffect(() => {
    if (mode !== "bot" || winner) return;
    if (phase === "rm2") {
      const t = setTimeout(() => {
        const i = knBotRemove(board);
        if (i == null) return;
        const ng = [...board]; ng[i] = null;
        setBoard(ng); setPhase("play"); setPlayer("X");
      }, 420);
      return () => clearTimeout(t);
    }
    if (phase === "play" && player === "O") {
      const t = setTimeout(() => {
        const mv = knBotMove(board);
        if (!mv) return;
        const [f, to] = mv;
        const ng = [...board]; ng[to] = "O"; ng[f] = null;
        for (const c of jumps(board, f, "O")[to]) ng[c] = null;
        setBoard(ng); setSel(null);
        if (!hasJump(ng, "X")) { setWinner("O"); setConfetti(makeConfetti()); return; }
        setPlayer("X");
      }, 420);
      return () => clearTimeout(t);
    }
  }, [mode, player, winner, phase, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes kn-pop{0%{transform:scale(.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .kn-pop{animation:kn-pop .22s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Start:</span> Zuerst entfernt ✕ einen eigenen Stein, dann ○ einen daran angrenzenden eigenen Stein.</p>
              <p><span className="text-neutral-100">Zug:</span> Springe waagerecht/senkrecht über einen gegnerischen Stein auf das leere Feld dahinter — der übersprungene Stein wird entfernt.</p>
              <p><span className="text-neutral-100">Mehrfach:</span> In gerader Linie darfst du in einem Zug mehrere Steine hintereinander schlagen. Tippe das gewünschte Endfeld an.</p>
              <p><span className="text-neutral-100">Ende:</span> Wer keinen Sprung mehr machen kann, verliert.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.25em] font-light text-neutral-100">KONANE</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Springe und schlage. Wer nicht mehr kann, verliert.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm kn-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">{phase === "play" ? "Am Zug" : "Start"}</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] text-neutral-500 tracking-wide">{hint}</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 4, aspectRatio: "1" }}>
            {board.map((v, idx) => {
              const r = Math.floor(idx / 6), c = idx % 6, dark = (r + c) % 2 === 1;
              const isSel = sel === idx, isTarget = !!targets[idx];
              return (
                <button key={idx} onClick={() => clickField(idx)} className="relative flex items-center justify-center"
                  style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 6, background: dark ? "#141417" : "#1d1d21", cursor: winner ? "default" : "pointer", boxShadow: isSel ? "inset 0 0 0 2px #fff" : isTarget ? `inset 0 0 0 2px ${player === "X" ? COL_X : COL_O}` : undefined }}>
                  {v ? (<div className="kn-pop rounded-full" style={{ width: "70%", height: "70%", background: v === "X" ? COL_X : COL_O, opacity: winner && winner !== v ? 0.45 : 1, boxShadow: "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)" }} />)
                    : isTarget ? (<div className="rounded-full" style={{ width: 12, height: 12, background: player === "X" ? COL_X : COL_O, opacity: 0.45 }} />) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Konane;
})();

const G_Breakthrough = (function () {

const N = 8, CELL = 38, GAP = 2, BOARD = N * CELL + (N - 1) * GAP;
const DISC = 28;
const COL_X = "#fb7185", COL_O = "#7dd3fc";

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

const initBoard = () => {
  const b = Array(64).fill(null);
  for (let c = 0; c < 8; c++) { b[c] = "O"; b[8 + c] = "O"; b[48 + c] = "X"; b[56 + c] = "X"; }
  return b;
};

function moves(board, idx, p) {
  const r = Math.floor(idx / 8), c = idx % 8, fwd = p === "X" ? -1 : 1, out = new Set();
  if (inb(r + fwd, c) && !board[(r + fwd) * 8 + c]) out.add((r + fwd) * 8 + c);
  for (const dc of [-1, 1]) {
    const nr = r + fwd, nc = c + dc;
    if (inb(nr, nc) && board[nr * 8 + nc] !== p) out.add(nr * 8 + nc);
  }
  return out;
}


// --- Bot: Negamax Alpha-Beta Tiefe 5, Material + Vorrueckung ---
function btMoves(b, p) {
  const ms = [];
  for (let i = 0; i < 64; i++) if (b[i] === p) for (const t of moves(b, i, p)) ms.push([i, t]);
  return ms;
}
function btEval(b) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const v = b[i];
    if (!v) continue;
    const r = Math.floor(i / 8);
    if (v === "O") s += 14 + r * r * 0.6;
    else s -= 14 + (7 - r) * (7 - r) * 0.6;
  }
  return s;
}
function btNm(b, depth, alpha, beta, p, ply) {
  const ms = btMoves(b, p);
  if (!ms.length) return -10000 + ply;
  if (depth <= 0) return (p === "O" ? 1 : -1) * btEval(b);
  ms.sort((m1, m2) => {
    const o = (m) => (b[m[1]] ? 9 : 0) + (p === "O" ? Math.floor(m[1] / 8) : 7 - Math.floor(m[1] / 8));
    return o(m2) - o(m1);
  });
  let best = -Infinity;
  for (const [f, t] of ms) {
    const sf = b[f], st = b[t];
    b[t] = p; b[f] = null;
    const r = Math.floor(t / 8);
    let sc;
    if ((p === "O" && r === 7) || (p === "X" && r === 0)) sc = 10000 - ply;
    else sc = -btNm(b, depth - 1, -beta, -alpha, p === "X" ? "O" : "X", ply + 1);
    b[f] = sf; b[t] = st;
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function btBotMove(board) {
  const b = [...board];
  let best = null, bs = -Infinity;
  for (const [f, t] of btMoves(b, "O")) {
    const sf = b[f], st = b[t];
    b[t] = "O"; b[f] = null;
    const sc = Math.floor(t / 8) === 7 ? 10000 : -btNm(b, 4, -Infinity, Infinity, "X", 1);
    b[f] = sf; b[t] = st;
    if (sc > bs) { bs = sc; best = [f, t]; }
  }
  return best;
}

function Breakthrough() {
  const [board, setBoard] = useState(initBoard);
  const [player, setPlayer] = useState("X");
  const [sel, setSel] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const targets = useMemo(() => (sel === null || winner ? new Set() : moves(board, sel, player)), [sel, board, player, winner]);

  const newGame = () => { setBoard(initBoard()); setPlayer("X"); setSel(null); setWinner(null); setConfetti([]); };

  const move = (to, fromIdx) => {
    const from = fromIdx != null ? fromIdx : sel;
    const ng = [...board]; ng[to] = player; ng[from] = null;
    setBoard(ng); setSel(null);
    const r = Math.floor(to / 8);
    const oppLeft = ng.some((v) => v === (player === "X" ? "O" : "X"));
    if ((player === "X" && r === 0) || (player === "O" && r === 7) || !oppLeft) {
      setWinner(player); setConfetti(makeConfetti()); return;
    }
    setPlayer(player === "X" ? "O" : "X");
  };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && player === "O") return;
    if (sel !== null && targets.has(idx)) { move(idx); return; }
    if (board[idx] === player) setSel(sel === idx ? null : idx); else setSel(null);
  };

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const mv = btBotMove(board); if (mv) move(mv[1], mv[0]); }, 420);
    return () => clearTimeout(t);
  }, [mode, player, winner, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes bt-pop{0%{transform:scale(.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .bt-pop{animation:bt-pop .22s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}
        </div>
      ) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Bring einen Stein in die gegnerische Grundreihe — oder schlage alle gegnerischen Steine.</p>
              <p><span className="text-neutral-100">Bewegung:</span> Ein Stein zieht ein Feld geradeaus oder diagonal vorwärts, wenn das Ziel leer ist.</p>
              <p><span className="text-neutral-100">Schlagen:</span> Nur diagonal vorwärts. Geradeaus kann nicht geschlagen werden — ein Stein direkt davor blockiert.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.2em] font-light text-neutral-100">BREAKTHROUGH</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Durchbrich zur gegnerischen Grundreihe.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm bt-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] text-neutral-500 tracking-wide">{winner ? "" : sel === null ? "Stein wählen" : "Ziel wählen"}</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 3, aspectRatio: "1" }}>
            {board.map((v, idx) => {
              const r = Math.floor(idx / 8), c = idx % 8, dark = (r + c) % 2 === 1;
              const isSel = sel === idx, isTarget = targets.has(idx), capture = isTarget && v;
              return (
                <button key={idx} onClick={() => clickField(idx)} className="relative flex items-center justify-center"
                  style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 5, background: dark ? "#141417" : "#1d1d21", cursor: winner ? "default" : "pointer", boxShadow: isSel ? "inset 0 0 0 2px #fff" : capture ? `inset 0 0 0 2px ${player === "X" ? COL_X : COL_O}` : undefined }}>
                  {v ? (<div className="bt-pop rounded-full" style={{ width: "74%", height: "74%", background: v === "X" ? COL_X : COL_O, opacity: winner && winner !== v ? 0.45 : 1, boxShadow: "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)" }} />)
                    : isTarget ? (<div className="rounded-full" style={{ width: 12, height: 12, background: player === "X" ? COL_X : COL_O, opacity: 0.45 }} />) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Breakthrough;
})();

const G_Hnefatafl = (function () {

const N = 9, CELL = 34, GAP = 2, BOARD = N * CELL + (N - 1) * GAP;
const COL_A = "#7dd3fc"; // Angreifer (viele)
const COL_D = "#fb7185"; // Verteidiger
const GOLD = "#fbbf24";
const THRONE = 40, CORNERS = [0, 8, 72, 80];
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

const initBoard = () => {
  const b = Array(81).fill(null);
  [22, 31, 49, 58, 38, 39, 41, 42].forEach((i) => b[i] = "D");
  [3, 4, 5, 13, 75, 76, 77, 67, 27, 36, 45, 37, 35, 44, 53, 43].forEach((i) => b[i] = "A");
  b[40] = "K";
  return b;
};

function rookTargets(board, idx, piece) {
  const r = Math.floor(idx / 9), c = idx % 9, out = new Set(), king = piece === "K";
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    let nr = r + dr, nc = c + dc;
    while (inb(nr, nc)) {
      const ni = nr * 9 + nc;
      if (board[ni]) break;
      const restricted = ni === THRONE || CORNERS.includes(ni);
      if (!(restricted && !king)) out.add(ni);
      nr += dr; nc += dc;
    }
  }
  return out;
}

function applyCaptures(board, idx, side) {
  const r = Math.floor(idx / 9), c = idx % 9;
  const hostile = (i) => CORNERS.includes(i) || (i === THRONE && board[THRONE] === null);
  const isEnemy = (v) => (side === "att" ? v === "D" : v === "A");
  const isFriend = (i) => (side === "att" ? board[i] === "A" : board[i] === "D" || board[i] === "K");
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const nr = r + dr, nc = c + dc, br = r + 2 * dr, bc = c + 2 * dc;
    if (!inb(nr, nc) || !isEnemy(board[nr * 9 + nc])) continue;
    if (!inb(br, bc)) continue;
    const bi = br * 9 + bc;
    if (isFriend(bi) || hostile(bi)) board[nr * 9 + nc] = null;
  }
}

function kingCaptured(board) {
  const k = board.indexOf("K");
  if (k < 0) return true;
  const r = Math.floor(k / 9), c = k % 9;
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const nr = r + dr, nc = c + dc;
    if (!inb(nr, nc)) return false;
    const ni = nr * 9 + nc;
    if (!(board[ni] === "A" || ni === THRONE)) return false;
  }
  return true;
}


// --- Bot (Angreifer): Negamax Tiefe 2, Material + Koenigsumzingelung ---
function hnMoves(b, side) {
  const ms = [];
  for (let i = 0; i < 81; i++) {
    const v = b[i];
    if (!v) continue;
    if (side === "att" ? v !== "A" : (v !== "D" && v !== "K")) continue;
    for (const t of rookTargets(b, i, v)) ms.push([i, t]);
  }
  return ms;
}
function hnEval(b) {
  let a = 0, d = 0;
  for (const v of b) { if (v === "A") a++; else if (v === "D") d++; }
  const k = b.indexOf("K");
  let s = a * 10 - d * 16;
  if (k >= 0) {
    const kr = Math.floor(k / 9), kc = k % 9;
    let kd = 99;
    for (const ci of CORNERS) {
      const dd = Math.abs(Math.floor(ci / 9) - kr) + Math.abs((ci % 9) - kc);
      if (dd < kd) kd = dd;
    }
    s += kd * 6;
    let around = 0;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = kr + dr, nc = kc + dc;
      if (!inb(nr, nc)) continue;
      const ni = nr * 9 + nc;
      if (b[ni] === "A" || ni === THRONE) around++;
    }
    s += around * 8;
  } else s += 500;
  return s;
}
function hnApply(b, f, t) {
  const nb = [...b];
  const piece = nb[f];
  nb[t] = piece; nb[f] = null;
  applyCaptures(nb, t, piece === "A" ? "att" : "def");
  return nb;
}
function hnNm(b, depth, alpha, beta, side) {
  const ms = hnMoves(b, side);
  if (!ms.length) return -9000;
  if (depth <= 0) return (side === "att" ? 1 : -1) * hnEval(b);
  let best = -Infinity;
  for (const [f, t] of ms) {
    const piece = b[f];
    const nb = hnApply(b, f, t);
    let sc;
    if (piece === "K" && CORNERS.includes(t)) sc = 10000;
    else if (side === "att" && kingCaptured(nb)) sc = 10000;
    else sc = -hnNm(nb, depth - 1, -beta, -alpha, side === "att" ? "def" : "att");
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function hnBotMove(board) {
  let best = null, bs = -Infinity;
  for (const [f, t] of hnMoves(board, "att")) {
    const nb = hnApply(board, f, t);
    const sc = kingCaptured(nb) ? 10000 : -hnNm(nb, 1, -Infinity, Infinity, "def");
    if (sc > bs) { bs = sc; best = [f, t]; }
  }
  return best;
}

function Hnefatafl() {
  const [board, setBoard] = useState(initBoard);
  const [turn, setTurn] = useState("att"); // att | def
  const [sel, setSel] = useState(null);
  const [winner, _setWinner] = useState(null); // "A" | "D"
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const targets = useMemo(() => (sel === null || winner ? new Set() : rookTargets(board, sel, board[sel])), [sel, board, winner]);
  const canSel = (idx) => { const v = board[idx]; if (!v) return false; return turn === "att" ? v === "A" : v === "D" || v === "K"; };

  const newGame = () => { setBoard(initBoard()); setTurn("att"); setSel(null); setWinner(null); setConfetti([]); };

  const move = (to, fromIdx) => {
    const from = fromIdx != null ? fromIdx : sel;
    const ng = [...board]; const piece = ng[from]; ng[to] = piece; ng[from] = null;
    const side = piece === "A" ? "att" : "def";
    applyCaptures(ng, to, side);
    setBoard(ng); setSel(null);
    if (piece === "K" && CORNERS.includes(to)) { setWinner("D"); setConfetti(makeConfetti()); return; }
    if (side === "att" && kingCaptured(ng)) { setWinner("A"); setConfetti(makeConfetti()); return; }
    setTurn(turn === "att" ? "def" : "att");
  };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && turn === "att") return;
    if (sel !== null && targets.has(idx)) { move(idx); return; }
    if (canSel(idx)) setSel(sel === idx ? null : idx); else setSel(null);
  };

  const Piece = ({ v }) => {
    if (v === "A") return <div className="hf-pop rounded-full" style={{ width: "71%", height: "71%", background: COL_A, boxShadow: "inset 0 -2px 4px rgba(0,0,0,.45)" }} />;
    if (v === "D") return <div className="hf-pop rounded-full" style={{ width: "71%", height: "71%", background: COL_D, boxShadow: "inset 0 -2px 4px rgba(0,0,0,.45)" }} />;
    return <div className="hf-pop rounded-full flex items-center justify-center" style={{ width: "80%", height: "80%", background: COL_D, boxShadow: "inset 0 -2px 4px rgba(0,0,0,.45)" }}><div className="rounded-full" style={{ width: "42%", height: "42%", border: `2px solid ${GOLD}` }} /></div>;
  };

  useEffect(() => {
    if (mode !== "bot" || winner || turn !== "att") return;
    const t = setTimeout(() => { const mv = hnBotMove(board); if (mv) move(mv[1], mv[0]); }, 450);
    return () => clearTimeout(t);
  }, [mode, turn, winner, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes hf-pop{0%{transform:scale(.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .hf-pop{animation:hf-pop .2s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p>Asymmetrisch: <span style={{ color: COL_A }}>Angreifer</span> (16) gegen <span style={{ color: COL_D }}>Verteidiger</span> (8) plus den <span style={{ color: GOLD }}>König</span> (goldener Ring). Angreifer beginnen.</p>
              <p><span className="text-neutral-100">Bewegung:</span> Alle ziehen waagerecht/senkrecht beliebig weit, nicht über Figuren. Thron (Mitte) und Ecken darf nur der König betreten.</p>
              <p><span className="text-neutral-100">Schlagen:</span> Klemme einen gegnerischen Stein zwischen zwei eigene (oder einen eigenen und Thron/Ecke) — er wird entfernt.</p>
              <p><span className="text-neutral-100">König:</span> Wird nur geschlagen, wenn er von allen vier Seiten (Angreifer oder Thron) umzingelt ist.</p>
              <p><span className="text-neutral-100">Sieg:</span> Verteidiger gewinnen, wenn der König eine Ecke erreicht. Angreifer gewinnen, wenn sie den König fangen.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.2em] font-light text-neutral-100">HNEFATAFL</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">König flieht in die Ecke — Angreifer wollen ihn fangen.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm hf-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span style={{ color: winner === "A" ? COL_A : COL_D }}>{winner === "A" ? "Angreifer" : "Verteidiger"}</span></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span style={{ color: turn === "att" ? COL_A : COL_D }}>{turn === "att" ? "Angreifer" : "Verteidiger"}</span></span>)}
          <span className="text-[11px] text-neutral-500 tracking-wide">{winner ? "" : sel === null ? "Figur wählen" : "Ziel wählen"}</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Angreifer <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_A }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 2, aspectRatio: "1" }}>
            {board.map((v, idx) => {
              const isSel = sel === idx, isTarget = targets.has(idx);
              const special = idx === THRONE || CORNERS.includes(idx);
              return (
                <button key={idx} onClick={() => clickField(idx)} className="relative flex items-center justify-center"
                  style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 4, background: special ? "#26262c" : ((Math.floor(idx / 9) + idx % 9) % 2 ? "#141417" : "#1b1b1f"), cursor: winner ? "default" : "pointer", boxShadow: isSel ? "inset 0 0 0 2px #fff" : isTarget ? `inset 0 0 0 2px ${turn === "att" ? COL_A : COL_D}` : CORNERS.includes(idx) ? `inset 0 0 0 1.5px ${GOLD}66` : undefined }}>
                  {v ? <Piece v={v} /> : isTarget ? <div className="rounded-full" style={{ width: 10, height: 10, background: turn === "att" ? COL_A : COL_D, opacity: 0.45 }} /> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Hnefatafl;
})();

const G_Quoridor = (function () {

const NB = 9;          // Felder pro Seite
const F = 9, G = 2;    // Feldgroesse / Rillenbreite (SVG-Einheiten)
const STEP = F + G;    // 11
const SIZE = NB * F + (NB - 1) * G; // 97
const COL_X = "#fb7185"; // unten -> oben, beginnt
const COL_O = "#7dd3fc"; // oben -> unten

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const inb = (r, c) => r >= 0 && r < NB && c >= 0 && c < NB;
const key = (r, c) => `${r},${c}`;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

// Ist die Bewegung von (r,c) in Richtung (dr,dc) durch eine Wand blockiert?
function blocked(r, c, dr, dc, H, V) {
  if (dr === -1) return H.has(key(r - 1, c)) || H.has(key(r - 1, c - 1));
  if (dr === 1) return H.has(key(r, c)) || H.has(key(r, c - 1));
  if (dc === -1) return V.has(key(r, c - 1)) || V.has(key(r - 1, c - 1));
  if (dc === 1) return V.has(key(r, c)) || V.has(key(r - 1, c));
  return false;
}

function hasPath(start, goalRow, H, V) {
  const seen = new Set([key(start[0], start[1])]);
  const q = [start];
  while (q.length) {
    const [r, c] = q.shift();
    if (r === goalRow) return true;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (inb(nr, nc) && !blocked(r, c, dr, dc, H, V) && !seen.has(key(nr, nc))) {
        seen.add(key(nr, nc)); q.push([nr, nc]);
      }
    }
  }
  return false;
}

function legalMoves(p, opp, H, V) {
  const [r, c] = p;
  const moves = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (!inb(nr, nc) || blocked(r, c, dr, dc, H, V)) continue;
    if (!(nr === opp[0] && nc === opp[1])) { moves.push([nr, nc]); continue; }
    const jr = nr + dr, jc = nc + dc;
    if (inb(jr, jc) && !blocked(nr, nc, dr, dc, H, V)) {
      moves.push([jr, jc]);
    } else {
      const perps = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
      for (const [pr, pc] of perps) {
        const tr = nr + pr, tc = nc + pc;
        if (inb(tr, tc) && !blocked(nr, nc, pr, pc, H, V)) moves.push([tr, tc]);
      }
    }
  }
  return moves;
}

function wallOk(orient, r, c, H, V, posX, posO) {
  if (r < 0 || r > NB - 2 || c < 0 || c > NB - 2) return false;
  if (orient === "H") {
    if (H.has(key(r, c)) || H.has(key(r, c - 1)) || H.has(key(r, c + 1))) return false;
    if (V.has(key(r, c))) return false;
  } else {
    if (V.has(key(r, c)) || V.has(key(r - 1, c)) || V.has(key(r + 1, c))) return false;
    if (H.has(key(r, c))) return false;
  }
  const H2 = new Set(H), V2 = new Set(V);
  (orient === "H" ? H2 : V2).add(key(r, c));
  return hasPath(posX, 0, H2, V2) && hasPath(posO, NB - 1, H2, V2);
}


// --- Bot: BFS-Pfaddifferenz; bester Bauernzug vs. beste Wand ---
function qdDist(pos, goalRow, H, V) {
  const seen = new Set([key(pos[0], pos[1])]);
  let q = [[pos[0], pos[1]]], d = 0;
  while (q.length) {
    const nq = [];
    for (const [r, c] of q) {
      if (r === goalRow) return d;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (inb(nr, nc) && !blocked(r, c, dr, dc, H, V) && !seen.has(key(nr, nc))) {
          seen.add(key(nr, nc)); nq.push([nr, nc]);
        }
      }
    }
    q = nq; d++;
  }
  return 999;
}
function qdBotPlan(posX, posO, H, V, wallsO) {
  const dO = qdDist(posO, NB - 1, H, V);
  const dX = qdDist(posX, 0, H, V);
  let best = null, bs = -Infinity;
  for (const [r, c] of legalMoves(posO, posX, H, V)) {
    const nd = qdDist([r, c], NB - 1, H, V);
    const sc = (dX - nd) * 10 + (dO - nd) + Math.random() * 0.1;
    if (sc > bs) { bs = sc; best = { type: "move", r, c }; }
  }
  if (wallsO > 0) {
    for (const orient of ["H", "V"]) {
      for (let r = 0; r < NB - 1; r++) for (let c = 0; c < NB - 1; c++) {
        if (!wallOk(orient, r, c, H, V, posX, posO)) continue;
        const H2 = new Set(H), V2 = new Set(V);
        (orient === "H" ? H2 : V2).add(key(r, c));
        const nX = qdDist(posX, 0, H2, V2);
        const nO = qdDist(posO, NB - 1, H2, V2);
        const sc = (nX - nO) * 10 - 1 + Math.random() * 0.1;
        if (sc > bs) { bs = sc; best = { type: "wall", orient, r, c }; }
      }
    }
  }
  return best;
}

function Quoridor() {
  const [posX, setPosX] = useState([NB - 1, 4]);
  const [posO, setPosO] = useState([0, 4]);
  const [H, setH] = useState(() => new Set());
  const [V, setV] = useState(() => new Set());
  const [walls, setWalls] = useState({ X: 10, O: 10 });
  const [player, setPlayer] = useState("X");
  const [mode, setMode] = useState("move"); // move | wallH | wallV
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [hover, setHover] = useState(null); // {r,c}
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [vsBot, setVsBot] = useState("2p");

  const me = player === "X" ? posX : posO;
  const opp = player === "X" ? posO : posX;

  const moves = useMemo(
    () => (winner || mode !== "move" ? [] : legalMoves(me, opp, H, V)),
    [winner, mode, me, opp, H, V]
  );

  const slots = useMemo(() => {
    if (winner || mode === "move" || walls[player] <= 0) return [];
    const orient = mode === "wallH" ? "H" : "V";
    const out = [];
    for (let r = 0; r < NB - 1; r++)
      for (let c = 0; c < NB - 1; c++)
        if (wallOk(orient, r, c, H, V, posX, posO)) out.push([r, c]);
    return out;
  }, [winner, mode, walls, player, H, V, posX, posO]);

  const newGame = () => {
    setPosX([NB - 1, 4]); setPosO([0, 4]);
    setH(new Set()); setV(new Set());
    setWalls({ X: 10, O: 10 });
    setPlayer("X"); setMode("move"); setWinner(null); setHover(null); setConfetti([]);
  };

  const next = () => { setPlayer(player === "X" ? "O" : "X"); setMode("move"); setHover(null); };

  const movePawn = (r, c, byBot) => {
    if (winner) return;
    if (vsBot === "bot" && player === "O" && !byBot) return;
    if (player === "X") {
      setPosX([r, c]);
      if (r === 0) { setWinner("X"); setConfetti(makeConfetti()); return; }
    } else {
      setPosO([r, c]);
      if (r === NB - 1) { setWinner("O"); setConfetti(makeConfetti()); return; }
    }
    next();
  };

  const placeWall = (r, c, byBot, ovOrient) => {
    if (winner) return;
    if (vsBot === "bot" && player === "O" && !byBot) return;
    const orient = ovOrient || (mode === "wallH" ? "H" : "V");
    if (!wallOk(orient, r, c, H, V, posX, posO)) return;
    if (orient === "H") setH(new Set(H).add(key(r, c)));
    else setV(new Set(V).add(key(r, c)));
    setWalls({ ...walls, [player]: walls[player] - 1 });
    next();
  };

  // SVG-Helfer
  const fx = (c) => c * STEP;
  const fy = (r) => r * STEP;
  const cx = (c) => c * STEP + F / 2;
  const cy = (r) => r * STEP + F / 2;

  const wallRect = (orient, r, c) =>
    orient === "H"
      ? { x: fx(c), y: fy(r) + F, w: 2 * F + G, h: G }
      : { x: fx(c) + F, y: fy(r), w: G, h: 2 * F + G };

  const modeBtn = (m, label, disabled) => (
    <button
      onClick={() => !disabled && setMode(m)}
      disabled={disabled}
      className={[
        "text-xs tracking-wide rounded-md px-3 py-1.5 border transition-colors",
        disabled ? "border-neutral-900 text-neutral-700 cursor-default"
          : mode === m ? "border-neutral-500 text-neutral-100 bg-neutral-800"
            : "border-neutral-800 text-neutral-400 hover:text-neutral-200",
      ].join(" ")}
    >{label}</button>
  );

  useEffect(() => {
    if (vsBot !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => {
      const plan = qdBotPlan(posX, posO, H, V, walls.O);
      if (!plan) return;
      if (plan.type === "move") movePawn(plan.r, plan.c, true);
      else placeWall(plan.r, plan.c, true, plan.orient);
    }, 450);
    return () => clearTimeout(t);
  }, [vsBot, player, winner, posX, posO, H, V, walls]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes q-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .q-pop { animation: q-pop .4s cubic-bezier(.34,1.56,.64,1) both; }
        .q-target { cursor:pointer; }
        .q-slothit { cursor:pointer; }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Bring deine Figur auf die gegenüberliegende Grundreihe.</p>
              <p><span className="text-neutral-100">Zug:</span> Pro Runde entweder ein Feld weit ziehen (waagerecht/senkrecht) oder eine Wand setzen. Stehen die Figuren direkt voreinander, darf übersprungen werden.</p>
              <p><span className="text-neutral-100">Wände:</span> Über die Modus-Buttons waagerecht oder senkrecht platzieren. Jeder hat zehn Stück — sie bremsen den Gegner, dürfen ihm aber nie den letzten Weg komplett versperren.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] font-light text-neutral-100">QUORIDOR</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">
          Erreiche die gegenüberliegende Seite. Wände blockieren — aber nie komplett.
        </p>

        {/* Status */}
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm q-pop inline-flex items-center gap-2">
              <span className="text-neutral-500">Sieger</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} />
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}
          <span className="text-sm flex items-center gap-2 tabular-nums">
            <span className="text-neutral-600 text-[11px] mr-1">Wände</span>
            <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: COL_X }} />
            <span className="text-neutral-300">{walls.X}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-300">{walls.O}</span>
            <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: COL_O }} />
          </span>
        </div>

        {/* Modus */}
        <div className="mb-3 flex items-center gap-1">
          {modeBtn("move", "Bewegen", false)}
          {modeBtn("wallH", "Wand ▬", walls[player] <= 0 || !!winner)}
          {modeBtn("wallV", "Wand ▮", walls[player] <= 0 || !!winner)}
        </div>

        {/* Brett */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setVsBot(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (vsBot === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800">
          <svg viewBox={`-1 -1 ${SIZE + 2} ${SIZE + 2}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
            {/* Zielkanten */}
            <rect x={-1} y={-1.6} width={SIZE + 2} height={1.1} fill={COL_X} opacity="0.7" rx="0.5" />
            <rect x={-1} y={SIZE + 0.5} width={SIZE + 2} height={1.1} fill={COL_O} opacity="0.7" rx="0.5" />

            {/* Felder */}
            {Array.from({ length: NB * NB }, (_, i) => {
              const r = Math.floor(i / NB), c = i % NB;
              return <rect key={i} x={fx(c)} y={fy(r)} width={F} height={F} rx="1.4" fill="#18181b" />;
            })}

            {/* Platzierte Waende */}
            {[...H].map((k) => {
              const [r, c] = k.split(",").map(Number);
              const w = wallRect("H", r, c);
              return <rect key={"H" + k} x={w.x} y={w.y} width={w.w} height={w.h} rx="0.8" fill="#e5e7eb" />;
            })}
            {[...V].map((k) => {
              const [r, c] = k.split(",").map(Number);
              const w = wallRect("V", r, c);
              return <rect key={"V" + k} x={w.x} y={w.y} width={w.w} height={w.h} rx="0.8" fill="#e5e7eb" />;
            })}

            {/* Zugziele (Bewegen-Modus) */}
            {mode === "move" && !winner && moves.map(([r, c], i) => (
              <circle key={"m" + i} className="q-target" cx={cx(c)} cy={cy(r)} r={2.6}
                fill={player === "X" ? COL_X : COL_O} opacity="0.5"
                onClick={() => movePawn(r, c)} />
            ))}

            {/* Figuren */}
            <circle cx={cx(posX[1])} cy={cy(posX[0])} r={3.3} fill={COL_X}
              style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.5))", pointerEvents: "none" }} />
            <circle cx={cx(posO[1])} cy={cy(posO[0])} r={3.3} fill={COL_O}
              style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.5))", pointerEvents: "none" }} />

            {/* Wand-Vorschau */}
            {hover && mode !== "move" && (() => {
              const orient = mode === "wallH" ? "H" : "V";
              const w = wallRect(orient, hover.r, hover.c);
              return <rect x={w.x} y={w.y} width={w.w} height={w.h} rx="0.8"
                fill={player === "X" ? COL_X : COL_O} opacity="0.85" pointerEvents="none" />;
            })()}

            {/* Wand-Slots (klickbar) */}
            {slots.map(([r, c]) => {
              const orient = mode === "wallH" ? "H" : "V";
              const w = wallRect(orient, r, c);
              const hit = orient === "H"
                ? { x: w.x, y: w.y - 1.5, w: w.w, h: w.h + 3 }
                : { x: w.x - 1.5, y: w.y, w: w.w + 3, h: w.h };
              const isHover = hover && hover.r === r && hover.c === c;
              return (
                <g key={"s" + r + "_" + c}>
                  <rect x={w.x} y={w.y} width={w.w} height={w.h} rx="0.8"
                    fill={player === "X" ? COL_X : COL_O} opacity={isHover ? 0 : 0.16} pointerEvents="none" />
                  <rect className="q-slothit" x={hit.x} y={hit.y} width={hit.w} height={hit.h}
                    fill="transparent"
                    onMouseEnter={() => setHover({ r, c })}
                    onClick={() => placeWall(r, c)} />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[10px] text-neutral-600 tracking-wide max-w-[60%]">
            Im Wand-Modus eine Lücke antippen. ✕ will nach oben, ○ nach unten.
          </span>
          <button onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return Quoridor;
})();

const G_Onitama = (function () {

const CELL = 52, GAP = 6, BOARD = 5 * CELL + 4 * GAP; // 284
const COL_X = "#fb7185"; // unten, beginnt
const COL_O = "#7dd3fc"; // oben
const ACCENT = "#fbbf24";
const X_GOAL = 2, O_GOAL = 22; // Tempelfelder

const DECK = [
  { name: "Tiger", moves: [[-2, 0], [1, 0]] },
  { name: "Dragon", moves: [[-1, -2], [-1, 2], [1, -1], [1, 1]] },
  { name: "Frog", moves: [[-1, -1], [0, -2], [1, 1]] },
  { name: "Rabbit", moves: [[-1, 1], [0, 2], [1, -1]] },
  { name: "Crab", moves: [[-1, 0], [0, -2], [0, 2]] },
  { name: "Elephant", moves: [[-1, -1], [-1, 1], [0, -1], [0, 1]] },
  { name: "Goose", moves: [[-1, -1], [0, -1], [0, 1], [1, 1]] },
  { name: "Rooster", moves: [[-1, 1], [0, -1], [0, 1], [1, -1]] },
  { name: "Monkey", moves: [[-1, -1], [-1, 1], [1, -1], [1, 1]] },
  { name: "Mantis", moves: [[-1, -1], [-1, 1], [1, 0]] },
  { name: "Horse", moves: [[-1, 0], [0, -1], [1, 0]] },
  { name: "Ox", moves: [[-1, 0], [0, 1], [1, 0]] },
  { name: "Crane", moves: [[-1, 0], [1, -1], [1, 1]] },
  { name: "Boar", moves: [[-1, 0], [0, -1], [0, 1]] },
  { name: "Eel", moves: [[-1, -1], [0, 1], [1, -1]] },
  { name: "Cobra", moves: [[-1, 1], [0, -1], [1, 1]] },
];

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

const deal = () => {
  const d = [...DECK].sort(() => Math.random() - 0.5).slice(0, 5);
  return { hand: { X: [d[0], d[1]], O: [d[2], d[3]] }, neutral: d[4] };
};

const initBoard = () => {
  const b = Array(25).fill(null);
  for (let c = 0; c < 5; c++) { b[c] = { p: "O", master: c === 2 }; b[20 + c] = { p: "X", master: c === 2 }; }
  return b;
};

function legalDests(board, idx, card, player) {
  const r = Math.floor(idx / 5), c = idx % 5;
  const out = [];
  for (const [dr, dc] of card.moves) {
    const ar = player === "X" ? dr : -dr;
    const ac = player === "X" ? dc : -dc;
    const nr = r + ar, nc = c + ac;
    if (nr < 0 || nr > 4 || nc < 0 || nc > 4) continue;
    const occ = board[nr * 5 + nc];
    if (occ && occ.p === player) continue;
    out.push(nr * 5 + nc);
  }
  return out;
}


// --- Bot: Negamax Alpha-Beta ueber Karten+Figuren, inkl. Pass-Tausch ---
function onMoves(board, hand, p) {
  const ms = [];
  for (let i = 0; i < 25; i++) {
    const pc = board[i];
    if (!pc || pc.p !== p) continue;
    for (let ci = 0; ci < 2; ci++) for (const t of legalDests(board, i, hand[p][ci], p)) ms.push([ci, i, t]);
  }
  return ms;
}
function onApply(board, hand, neutral, p, ci, f, t) {
  const nb = [...board];
  const piece = nb[f], cap = nb[t];
  nb[t] = piece; nb[f] = null;
  const nh = { X: [...hand.X], O: [...hand.O] };
  const used = nh[p].splice(ci, 1)[0];
  nh[p].push(neutral);
  let win = null;
  if (cap && cap.master) win = p;
  else if (piece.master && ((p === "X" && t === X_GOAL) || (p === "O" && t === O_GOAL))) win = p;
  return { board: nb, hand: nh, neutral: used, win };
}
function onEval(board) {
  let s = 0;
  for (let i = 0; i < 25; i++) {
    const pc = board[i];
    if (!pc) continue;
    const r = Math.floor(i / 5), c = i % 5;
    const ctr = 2 - (Math.abs(r - 2) + Math.abs(c - 2)) * 0.4;
    if (pc.p === "O") { s += 10 + ctr; if (pc.master) s -= (Math.abs(r - 4) + Math.abs(c - 2)) * 1.2; }
    else { s -= 10 + ctr; if (pc.master) s += (Math.abs(r - 0) + Math.abs(c - 2)) * 1.2; }
  }
  return s;
}
function onNm(board, hand, neutral, depth, alpha, beta, p) {
  const ms = onMoves(board, hand, p);
  if (!ms.length) {
    if (depth <= 0) return (p === "O" ? 1 : -1) * onEval(board);
    let best = -Infinity;
    for (let ci = 0; ci < 2; ci++) {
      const nh = { X: [...hand.X], O: [...hand.O] };
      const g = nh[p].splice(ci, 1)[0];
      nh[p].push(neutral);
      const sc = -onNm(board, nh, g, depth - 1, -beta, -alpha, p === "X" ? "O" : "X");
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  if (depth <= 0) return (p === "O" ? 1 : -1) * onEval(board);
  let best = -Infinity;
  for (const [ci, f, t] of ms) {
    const r = onApply(board, hand, neutral, p, ci, f, t);
    const sc = r.win ? 10000 : -onNm(r.board, r.hand, r.neutral, depth - 1, -beta, -alpha, p === "X" ? "O" : "X");
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function onBotMove(board, hand, neutral) {
  let best = null, bs = -Infinity;
  for (const [ci, f, t] of onMoves(board, hand, "O")) {
    const r = onApply(board, hand, neutral, "O", ci, f, t);
    const sc = r.win ? 10000 : -onNm(r.board, r.hand, r.neutral, 4, -Infinity, Infinity, "X");
    if (sc > bs) { bs = sc; best = [ci, f, t]; }
  }
  return best;
}

function Onitama() {
  const start = useMemo(deal, []);
  const [board, setBoard] = useState(initBoard);
  const [hand, setHand] = useState(start.hand);
  const [neutral, setNeutral] = useState(start.neutral);
  const [player, setPlayer] = useState("X");
  const [selCard, setSelCard] = useState(null);
  const [selPiece, setSelPiece] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [reason, setReason] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const dests = useMemo(() => {
    if (winner || selCard === null || selPiece === null) return new Set();
    return new Set(legalDests(board, selPiece, hand[player][selCard], player));
  }, [winner, selCard, selPiece, board, hand, player]);

  const anyMoves = useMemo(() => {
    if (winner) return true;
    for (let i = 0; i < 25; i++) {
      const pc = board[i];
      if (!pc || pc.p !== player) continue;
      for (const card of hand[player]) if (legalDests(board, i, card, player).length) return true;
    }
    return false;
  }, [board, hand, player, winner]);

  const newGame = () => {
    const s = deal();
    setBoard(initBoard()); setHand(s.hand); setNeutral(s.neutral);
    setPlayer("X"); setSelCard(null); setSelPiece(null);
    setWinner(null); setReason(null); setConfetti([]);
  };

  const swapCards = (player2, cardIdx) => {
    const nh = hand[player2].slice();
    const giving = nh[cardIdx];
    nh[cardIdx] = neutral;
    setHand({ ...hand, [player2]: nh });
    setNeutral(giving);
  };

  const move = (target, ovCard, ovPiece) => {
    const useCard = ovCard != null ? ovCard : selCard;
    const usePiece = ovPiece != null ? ovPiece : selPiece;
    const ng = [...board];
    const piece = ng[usePiece];
    const captured = ng[target];
    ng[target] = piece; ng[usePiece] = null;

    const nh = hand[player].slice();
    const used = nh.splice(useCard, 1)[0];
    nh.push(neutral);
    setBoard(ng);
    setHand({ ...hand, [player]: nh });
    setNeutral(used);
    setSelCard(null); setSelPiece(null);

    let win = null, why = null;
    if (captured && captured.master) { win = player; why = "Meister geschlagen"; }
    else if (piece.master && ((player === "X" && target === X_GOAL) || (player === "O" && target === O_GOAL))) {
      win = player; why = "Tempel erreicht";
    }
    if (win) { setWinner(win); setReason(why); setConfetti(makeConfetti()); }
    else setPlayer(player === "X" ? "O" : "X");
  };

  const clickCard = (owner, i) => {
    if (winner || owner !== player) return;
    if (mode === "bot" && player === "O") return;
    if (!anyMoves) { swapCards(player, i); setPlayer(player === "X" ? "O" : "X"); setSelCard(null); setSelPiece(null); return; }
    setSelCard(selCard === i ? null : i);
  };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && player === "O") return;
    if (selCard !== null && selPiece !== null && dests.has(idx)) { move(idx); return; }
    const occ = board[idx];
    if (occ && occ.p === player) setSelPiece(selPiece === idx ? null : idx);
    else setSelPiece(null);
  };

  const Piece = ({ pc, sel }) => (
    <div className="on-pop rounded-full flex items-center justify-center" style={{
      width: pc.master ? "77%" : "58%", height: pc.master ? "77%" : "58%",
      background: pc.p === "X" ? COL_X : COL_O,
      opacity: winner && winner !== pc.p ? 0.45 : 1,
      boxShadow: sel ? "0 0 0 3px #fff" : "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)",
    }}>
      {pc.master ? <div className="rounded-full" style={{ width: "30%", height: "30%", border: "2px solid rgba(255,255,255,.9)" }} /> : null}
    </div>
  );

  const Card = ({ card, owner, idx }) => {
    const ms = new Set(card.moves.map(([dr, dc]) => `${2 + dr},${2 + dc}`));
    const active = owner === player && !winner;
    const sel = active && selCard === idx;
    const rot = owner === "O";
    return (
      <button onClick={() => owner && clickCard(owner, idx)} disabled={!owner || !active}
        className="rounded-lg p-1.5 flex flex-col items-center gap-1 transition-colors"
        style={{
          background: "#18181b", border: sel ? "2px solid #fff" : "2px solid #27272a",
          opacity: owner && owner !== player && !winner ? 0.5 : 1,
          cursor: active ? "pointer" : "default", transform: rot ? "rotate(180deg)" : undefined,
        }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(5, 10px)", gap: 1 }}>
          {Array.from({ length: 25 }, (_, k) => {
            const mr = Math.floor(k / 5), mc = k % 5;
            const isC = mr === 2 && mc === 2;
            const isM = ms.has(`${mr},${mc}`);
            return <div key={k} style={{ width: 10, height: 10, borderRadius: 2, background: isC ? "#52525b" : isM ? ACCENT : "#2a2a30" }} />;
          })}
        </div>
        <span className="text-[9px] tracking-wide text-neutral-400">{card.name}</span>
      </button>
    );
  };

  const ctr = (i) => ({ x: (i % 5) * (CELL + GAP) + CELL / 2, y: Math.floor(i / 5) * (CELL + GAP) + CELL / 2 });

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => {
      const m = onBotMove(board, hand, neutral);
      if (m) { move(m[2], m[0], m[1]); return; }
      let ci = 0, bs = -Infinity;
      for (let k = 0; k < 2; k++) {
        const nh = { X: [...hand.X], O: [...hand.O] };
        const g = nh.O.splice(k, 1)[0];
        nh.O.push(neutral);
        const sc = -onNm(board, nh, g, 2, -Infinity, Infinity, "X");
        if (sc > bs) { bs = sc; ci = k; }
      }
      swapCards("O", ci);
      setPlayer("X");
    }, 430);
    return () => clearTimeout(t);
  }, [mode, player, winner, board, hand, neutral]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes on-pop { 0%{transform:scale(.5)} 70%{transform:scale(1.1)} 100%{transform:scale(1)} }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .on-pop { animation: on-pop .2s cubic-bezier(.34,1.56,.64,1) both; }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Figuren:</span> Jeder hat einen Meister (mit Ring) und vier Schüler. Der Meister startet auf dem eigenen Tempelfeld.</p>
              <p><span className="text-neutral-100">Karten:</span> Du hast zwei Bewegungskarten; das Raster auf der Karte zeigt die möglichen Sprünge. Wähle Karte, dann Figur, dann Ziel.</p>
              <p><span className="text-neutral-100">Kartentausch:</span> Die genutzte Karte wandert zur Seite, die dort wartende neutrale Karte kommt in deine Hand — die Karten rotieren also ständig.</p>
              <p><span className="text-neutral-100">Sieg:</span> Schlage den gegnerischen Meister oder ziehe deinen Meister auf das gegnerische Tempelfeld.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] font-light text-neutral-100">ONITAMA</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">
          Karte + Figur wählen, dann ziehen. Schlage den Meister oder erreiche den gegnerischen Tempel.
        </p>

        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm on-pop inline-flex items-center gap-2">
              <span className="text-neutral-500">Sieger</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} />
              <span className="text-[11px] text-neutral-500">· {reason}</span>
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}
          <span className="text-[11px] text-neutral-500 tracking-wide">
            {winner ? "" : !anyMoves ? "kein Zug — Karte abgeben" : selCard === null ? "Karte wählen" : selPiece === null ? "Figur wählen" : "Ziel wählen"}
          </span>
        </div>

        {/* O-Hand */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <Card card={hand.O[0]} owner="O" idx={0} />
          <Card card={hand.O[1]} owner="O" idx={1} />
        </div>

        {/* Brett */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="relative" style={{ width: "100%", aspectRatio: "1" }}>
            <div className="grid grid-cols-5" style={{ gap: "2.1%" }}>
              {board.map((pc, idx) => {
                const isDest = dests.has(idx);
                const isTemple = idx === X_GOAL || idx === O_GOAL;
                const templeCol = idx === X_GOAL ? COL_X : COL_O;
                return (
                  <button key={idx} onClick={() => clickField(idx)}
                    className="relative rounded-md flex items-center justify-center"
                    style={{
                      aspectRatio: "1", border: 0, padding: 0, cursor: winner ? "default" : "pointer",
                      background: "#0c0c0e",
                      boxShadow: isDest ? `inset 0 0 0 2px ${player === "X" ? COL_X : COL_O}`
                        : isTemple ? `inset 0 0 0 1.5px ${templeCol}55` : undefined,
                    }}>
                    {pc ? <Piece pc={pc} sel={selPiece === idx} /> :
                      isDest ? <div className="rounded-full" style={{ width: 16, height: 16, background: player === "X" ? COL_X : COL_O, opacity: 0.4 }} /> : null}
                  </button>
                );
              })}
            </div>
            {winner && reason === "Tempel erreicht" ? null : null}
          </div>
        </div>

        {/* X-Hand + neutrale Karte */}
        <div className="flex items-end justify-center gap-2 mt-3">
          <Card card={hand.X[0]} owner="X" idx={0} />
          <Card card={hand.X[1]} owner="X" idx={1} />
          <div className="flex flex-col items-center gap-1 ml-2 opacity-70">
            <Card card={neutral} owner={null} idx={-1} />
            <span className="text-[9px] text-neutral-600 tracking-wide">als Nächstes</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return Onitama;
})();

const G_Halma = (function () {

const N = 8, CELL = 38, GAP = 2, BOARD = N * CELL + (N - 1) * GAP;
const DISC = 28;
const COL_X = "#fb7185", COL_O = "#7dd3fc";
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const D8 = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];

const X_CAMP = [56, 57, 58, 48, 49, 40];        // unten links
const O_CAMP = [7, 6, 5, 15, 14, 23];           // oben rechts

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

const initBoard = () => { const b = Array(64).fill(null); X_CAMP.forEach((i) => b[i] = "X"); O_CAMP.forEach((i) => b[i] = "O"); return b; };

function reach(board, idx) {
  const out = new Set();
  const r = Math.floor(idx / 8), c = idx % 8;
  for (const [dr, dc] of D8) if (inb(r + dr, c + dc) && !board[(r + dr) * 8 + (c + dc)]) out.add((r + dr) * 8 + (c + dc)); // Schritt
  const seen = new Set([idx]), stack = [idx]; // Sprungketten
  while (stack.length) {
    const i = stack.pop(), ir = Math.floor(i / 8), ic = i % 8;
    for (const [dr, dc] of D8) {
      const mr = ir + dr, mc = ic + dc, lr = ir + 2 * dr, lc = ic + 2 * dc;
      if (inb(lr, lc) && board[mr * 8 + mc] && !board[lr * 8 + lc] && !seen.has(lr * 8 + lc)) {
        seen.add(lr * 8 + lc); out.add(lr * 8 + lc); stack.push(lr * 8 + lc);
      }
    }
  }
  out.delete(idx);
  return out;
}


// --- Bot: Greedy auf freie Lagerfelder, Sprungketten via reach() ---
function hlDistDyn(b, i, self) {
  const r = Math.floor(i / 8), c = i % 8;
  let m = 99;
  for (const ci of X_CAMP) {
    if (b[ci] === "O" && ci !== self) continue;
    const d = Math.max(Math.abs(Math.floor(ci / 8) - r), Math.abs((ci % 8) - c));
    if (d < m) m = d;
  }
  return m === 99 ? 0 : m;
}
function hlBotMove(board) {
  let best = null, bs = -Infinity;
  const inGoal = (i) => X_CAMP.includes(i);
  for (let f = 0; f < 64; f++) {
    if (board[f] !== "O") continue;
    for (const t of reach(board, f)) {
      if (inGoal(f) && !inGoal(t)) continue;
      const nb = [...board]; nb[t] = "O"; nb[f] = null;
      const gain = hlDistDyn(board, f, f) - hlDistDyn(nb, t, t) + (inGoal(t) && !inGoal(f) ? 2 : 0) + Math.random() * 0.1;
      if (gain > bs) { bs = gain; best = [f, t]; }
    }
  }
  return best;
}

function Halma() {
  const [board, setBoard] = useState(initBoard);
  const [player, setPlayer] = useState("X");
  const [sel, setSel] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const targets = useMemo(() => (sel === null || winner ? new Set() : reach(board, sel)), [sel, board, winner]);

  const newGame = () => { setBoard(initBoard()); setPlayer("X"); setSel(null); setWinner(null); setConfetti([]); };

  const move = (to, fromIdx) => {
    const from = fromIdx != null ? fromIdx : sel;
    const ng = [...board]; ng[to] = player; ng[from] = null;
    setBoard(ng); setSel(null);
    const goal = player === "X" ? O_CAMP : X_CAMP;
    if (goal.every((i) => ng[i] === player)) { setWinner(player); setConfetti(makeConfetti()); return; }
    setPlayer(player === "X" ? "O" : "X");
  };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && player === "O") return;
    if (sel !== null && targets.has(idx)) { move(idx); return; }
    if (board[idx] === player) setSel(sel === idx ? null : idx); else setSel(null);
  };

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const mv = hlBotMove(board); if (mv) move(mv[1], mv[0]); }, 400);
    return () => clearTimeout(t);
  }, [mode, player, winner, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes hl-pop{0%{transform:scale(.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .hl-pop{animation:hl-pop .22s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Bring alle sechs Steine ins gegenüberliegende Lager (markiert).</p>
              <p><span className="text-neutral-100">Schritt:</span> Ein Feld in jede Richtung auf ein leeres Feld.</p>
              <p><span className="text-neutral-100">Sprung:</span> Über einen benachbarten Stein (egal welche Farbe) auf das leere Feld dahinter — Sprünge dürfen in einem Zug verkettet werden. Nichts wird geschlagen.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.25em] font-light text-neutral-100">HALMA</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Alle Steine ins gegnerische Lager bringen.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm hl-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] text-neutral-500 tracking-wide">{winner ? "" : sel === null ? "Stein wählen" : "Ziel wählen"}</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 3, aspectRatio: "1" }}>
            {board.map((v, idx) => {
              const r = Math.floor(idx / 8), c = idx % 8, dark = (r + c) % 2 === 1;
              const isSel = sel === idx, isTarget = targets.has(idx);
              const camp = X_CAMP.includes(idx) ? COL_X : O_CAMP.includes(idx) ? COL_O : null;
              return (
                <button key={idx} onClick={() => clickField(idx)} className="relative flex items-center justify-center"
                  style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 5, background: dark ? "#141417" : "#1d1d21", cursor: winner ? "default" : "pointer", boxShadow: isSel ? "inset 0 0 0 2px #fff" : isTarget ? `inset 0 0 0 2px ${player === "X" ? COL_X : COL_O}` : camp ? `inset 0 0 0 1.5px ${camp}44` : undefined }}>
                  {v ? (<div className="hl-pop rounded-full" style={{ width: "74%", height: "74%", background: v === "X" ? COL_X : COL_O, opacity: winner && winner !== v ? 0.45 : 1, boxShadow: "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)" }} />)
                    : isTarget ? (<div className="rounded-full" style={{ width: 12, height: 12, background: player === "X" ? COL_X : COL_O, opacity: 0.45 }} />) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Halma;
})();

const G_Mancala = (function () {

const PIT = 40, STORE = 36, GAP = 5;
const COL_X = "#fb7185"; // unten + rechter Store (6), beginnt
const COL_O = "#7dd3fc"; // oben + linker Store (13)
const X_PITS = [0, 1, 2, 3, 4, 5], O_PITS = [7, 8, 9, 10, 11, 12];
const X_STORE = 6, O_STORE = 13;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 2.4 + Math.random() * 1.8, drift: (Math.random() * 2 - 1) * 140,
    rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
  }));

const initPits = () => { const p = Array(14).fill(4); p[X_STORE] = 0; p[O_STORE] = 0; return p; };


// --- Bot: Negamax mit Extrazuegen (gleiche Seite, kein Vorzeichenwechsel) ---
function mcSim(pits, start, who) {
  const w = [...pits];
  let hand = w[start];
  w[start] = 0;
  let i = start;
  const oppStore = who === "X" ? O_STORE : X_STORE;
  while (hand > 0) {
    i = (i + 1) % 14;
    if (i === oppStore) continue;
    w[i]++; hand--;
  }
  const ownStore = who === "X" ? X_STORE : O_STORE;
  const ownPits = who === "X" ? X_PITS : O_PITS;
  const extra = i === ownStore;
  if (!extra && ownPits.includes(i) && w[i] === 1) {
    const opp = 12 - i;
    if (w[opp] > 0) { w[ownStore] += w[opp] + 1; w[opp] = 0; w[i] = 0; }
  }
  const xE = X_PITS.every((k) => w[k] === 0);
  const oE = O_PITS.every((k) => w[k] === 0);
  if (xE || oE) {
    if (xE) for (const k of O_PITS) { w[O_STORE] += w[k]; w[k] = 0; }
    else for (const k of X_PITS) { w[X_STORE] += w[k]; w[k] = 0; }
    return { pits: w, extra: false, ended: true };
  }
  return { pits: w, extra, ended: false };
}
function mcNm(pits, depth, alpha, beta, who) {
  const own = who === "X" ? X_PITS : O_PITS;
  const ms = own.filter((k) => pits[k] > 0);
  if (!ms.length || depth <= 0) {
    const d = pits[O_STORE] - pits[X_STORE];
    return (who === "O" ? 1 : -1) * d;
  }
  let best = -Infinity;
  for (const k of ms) {
    const r = mcSim(pits, k, who);
    let sc;
    if (r.ended) sc = (who === "O" ? 1 : -1) * (r.pits[O_STORE] - r.pits[X_STORE]) * 10;
    else if (r.extra) sc = mcNm(r.pits, depth - 1, alpha, beta, who);
    else sc = -mcNm(r.pits, depth - 1, -beta, -alpha, who === "X" ? "O" : "X");
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function mcBotPit(pits) {
  let best = null, bs = -Infinity;
  for (const k of O_PITS) {
    if (pits[k] === 0) continue;
    const r = mcSim(pits, k, "O");
    let sc;
    if (r.ended) sc = (r.pits[O_STORE] - r.pits[X_STORE]) * 10;
    else if (r.extra) sc = 0.5 + mcNm(r.pits, 7, -Infinity, Infinity, "O");
    else sc = -mcNm(r.pits, 7, -Infinity, Infinity, "X");
    if (sc > bs) { bs = sc; best = k; }
  }
  return best;
}

function Mancala() {
  const [pits, setPits] = useState(initPits);
  const [player, setPlayer] = useState("X");
  const [active, setActive] = useState(null); // gerade befüllte Mulde
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState(false);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");
  const gen = useRef(0);

  const newGame = () => {
    gen.current++;
    setPits(initPits()); setPlayer("X"); setActive(null);
    setBusy(false); setExtra(false); setWinner(null); setConfetti([]);
  };

  const finish = (work, last, who, myGen) => {
    if (gen.current !== myGen) return;
    const ownStore = who === "X" ? X_STORE : O_STORE;
    const ownPits = who === "X" ? X_PITS : O_PITS;
    const gotExtra = last === ownStore;
    let captured = false;
    if (!gotExtra && ownPits.includes(last) && work[last] === 1) {
      const opp = 12 - last;
      if (work[opp] > 0) { work[ownStore] += work[opp] + 1; work[opp] = 0; work[last] = 0; captured = true; }
    }
    setTimeout(() => {
      if (gen.current !== myGen) return;
      let w = [...work];
      const xE = X_PITS.every((k) => w[k] === 0);
      const oE = O_PITS.every((k) => w[k] === 0);
      if (xE || oE) {
        if (xE) for (const k of O_PITS) { w[O_STORE] += w[k]; w[k] = 0; }
        else for (const k of X_PITS) { w[X_STORE] += w[k]; w[k] = 0; }
        setPits(w); setActive(null); setBusy(false);
        const win = w[X_STORE] > w[O_STORE] ? "X" : w[O_STORE] > w[X_STORE] ? "O" : "draw";
        setWinner(win); if (win !== "draw") setConfetti(makeConfetti());
        return;
      }
      setPits(w); setActive(null); setBusy(false);
      setExtra(gotExtra);
      if (!gotExtra) setPlayer(who === "X" ? "O" : "X");
    }, captured ? 300 : 130);
  };

  const play = (start, byBot) => {
    if (busy || winner) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    const ownPits = player === "X" ? X_PITS : O_PITS;
    if (!ownPits.includes(start) || pits[start] === 0) return;
    setBusy(true); setExtra(false);
    const myGen = ++gen.current;
    const work = [...pits];
    let hand = work[start];
    work[start] = 0;
    setPits([...work]); setActive(start);
    let i = start;
    const oppStore = player === "X" ? O_STORE : X_STORE;
    const step = () => {
      if (gen.current !== myGen) return;
      if (hand === 0) { finish(work, i, player, myGen); return; }
      i = (i + 1) % 14;
      if (i === oppStore) { step(); return; }
      work[i]++; hand--;
      setPits([...work]); setActive(i);
      setTimeout(step, 145);
    };
    setTimeout(step, 160);
  };

  const cellStyle = (idx) => {
    if (idx === O_STORE) return { gridColumn: 1, gridRow: "1 / span 2" };
    if (idx === X_STORE) return { gridColumn: 8, gridRow: "1 / span 2" };
    if (O_PITS.includes(idx)) return { gridColumn: 2 + (12 - idx), gridRow: 1 };
    return { gridColumn: 2 + idx, gridRow: 2 };
  };

  const playablePit = (idx) => {
    const own = player === "X" ? X_PITS : O_PITS;
    return !busy && !winner && own.includes(idx) && pits[idx] > 0;
  };

  useEffect(() => {
    if (mode !== "bot" || winner || busy || player !== "O") return;
    const t = setTimeout(() => { const k = mcBotPit(pits); if (k != null) play(k, true); }, 420);
    return () => clearTimeout(t);
  }, [mode, player, winner, busy, pits]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes mc-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes mc-pulse { 0%,100%{box-shadow:0 0 0 1px #3f3f46} 50%{box-shadow:0 0 0 2px #fff, 0 0 10px 1px rgba(255,255,255,.4)} }
        @keyframes stt-confetti { 0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1} 100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0} }
        .mc-pop { animation: mc-pop .4s cubic-bezier(.34,1.56,.64,1) both; }
        .mc-active { animation: mc-pulse .3s ease-in-out; }
        .stt-confetti { position:absolute; top:0; animation-name: stt-confetti; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
      `}</style>

      {confetti.length > 0 ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confetti.map((p) => (
            <span key={p.id} className="stt-confetti block" style={{
              left: p.left + "%", width: p.size + "px", height: p.size + "px",
              background: p.color, borderRadius: p.round ? "50%" : "2px",
              animationDelay: p.delay + "s", animationDuration: p.dur + "s",
              "--drift": p.drift + "px", "--rot": p.rot + "deg",
            }} />
          ))}
        </div>
      ) : null}

      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5"
          style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT MANCALA</h2>
              <button onClick={() => setShowInfo(false)}
                className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button>
            </div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Am Spielende mehr Steine im eigenen Speicher haben.</p>
              <p><span className="text-neutral-100">Dein Bereich:</span> ✕ hat die untere Reihe und den rechten Speicher, ○ die obere Reihe und den linken. Jede Mulde startet mit vier Steinen.</p>
              <p><span className="text-neutral-100">Zug:</span> Tippe eine deiner Mulden an. Alle Steine daraus werden einzeln gegen den Uhrzeigersinn in die folgenden Mulden verteilt — dein Speicher wird mitgefüllt, der gegnerische übersprungen.</p>
              <p><span className="text-neutral-100">Nochmal:</span> Landet der letzte Stein in deinem Speicher, bist du sofort wieder dran.</p>
              <p><span className="text-neutral-100">Fangen:</span> Landet der letzte Stein in einer leeren eigenen Mulde, nimmst du ihn und alle Steine der gegenüberliegenden gegnerischen Mulde in deinen Speicher.</p>
              <p><span className="text-neutral-100">Ende:</span> Sobald eine Reihe leer ist, wandern die übrigen Steine der anderen Reihe in deren Speicher. Mehrheit gewinnt.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] font-light text-neutral-100">MANCALA</h1>
          <button onClick={() => setShowInfo(true)}
            className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors"
            aria-label="Regeln">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">
          Säe deine Steine gegen den Uhrzeigersinn. Mehr im eigenen Speicher gewinnt.
        </p>

        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (
            <span key="w" className="text-sm mc-pop inline-flex items-center gap-2">
              {winner === "draw" ? <span className="text-neutral-300">Unentschieden</span> : (
                <>
                  <span className="text-neutral-500">Sieger</span>
                  <span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} />
                </>
              )}
              <span className="text-[11px] text-neutral-500">{pits[X_STORE]} : {pits[O_STORE]}</span>
            </span>
          ) : (
            <span className="text-sm flex items-center gap-2">
              <span className="text-neutral-500">Am Zug</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} />
            </span>
          )}
          <span className="text-[11px] text-neutral-500 tracking-wide">
            {winner ? "" : extra ? "Nochmal dran" : "eigene Mulde antippen"}
          </span>
        </div>

        {/* Brett */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-3 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{
            gridTemplateColumns: "0.9fr repeat(6, 1fr) 0.9fr",
            gridTemplateRows: "1fr 1fr", gap: GAP, aspectRatio: "3.9",
          }}>
            {Array.from({ length: 14 }, (_, idx) => {
              const isStore = idx === X_STORE || idx === O_STORE;
              const ring = idx === X_STORE ? COL_X : idx === O_STORE ? COL_O
                : playablePit(idx) ? (player === "X" ? COL_X : COL_O) : "#3f3f46";
              const isActive = active === idx;
              const clickable = playablePit(idx);
              return (
                <button key={idx} onClick={() => clickable && play(idx)} disabled={!clickable}
                  className={isActive ? "mc-active" : ""}
                  style={{
                    ...cellStyle(idx),
                    borderRadius: isStore ? 18 : 9999,
                    background: isStore ? "#0c0c0e" : "#16161a",
                    boxShadow: isActive ? undefined : `0 0 0 ${isStore ? 1.5 : 1}px ${ring}${isStore ? "" : "99"}`,
                    border: 0, cursor: clickable ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#e5e7eb",
                  }}>
                  <span key={pits[idx]} className="mc-pop tabular-nums"
                    style={{ fontSize: isStore ? 22 : 17, fontWeight: 300 }}>
                    {pits[idx]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: COL_O }} /> Speicher links · obere Reihe
          </span>
          <span className="flex items-center gap-1.5">
            obere/untere · rechts <span className="w-3 h-3 rounded-full inline-block" style={{ background: COL_X }} />
          </span>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame}
            className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">
            NEUSTART
          </button>
        </div>
      </div>
    </div>
  );
}
return Mancala;
})();

const G_Gomoku = (function () {

const N = 15;
const COL_X = "#fb7185", COL_O = "#7dd3fc";
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

function runAt(grid, r, c, p) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [[r, c]];
    let rr = r + dr, cc = c + dc;
    while (inb(rr, cc) && grid[rr * N + cc] === p) { line.push([rr, cc]); rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inb(rr, cc) && grid[rr * N + cc] === p) { line.unshift([rr, cc]); rr -= dr; cc -= dc; }
    if (line.length >= 5) return line.map(([a, b]) => a * N + b);
  }
  return null;
}


// --- Bot: Threat-Heuristik — eigene Linien bauen, gegnerische blocken ---
function gkLineScore(g, idx, p) {
  const r = Math.floor(idx / N), c = idx % N;
  let s = 0;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let cnt = 1, openA = 0, openB = 0;
    let rr = r + dr, cc = c + dc;
    while (inb(rr, cc) && g[rr * N + cc] === p) { cnt++; rr += dr; cc += dc; }
    if (inb(rr, cc) && !g[rr * N + cc]) openA = 1;
    rr = r - dr; cc = c - dc;
    while (inb(rr, cc) && g[rr * N + cc] === p) { cnt++; rr -= dr; cc -= dc; }
    if (inb(rr, cc) && !g[rr * N + cc]) openB = 1;
    const open = openA + openB;
    if (cnt >= 5) s += 1e9;
    else if (cnt === 4) s += open === 2 ? 1e7 : open === 1 ? 120000 : 0;
    else if (cnt === 3) s += open === 2 ? 50000 : open === 1 ? 900 : 0;
    else if (cnt === 2) s += open === 2 ? 250 : open === 1 ? 30 : 0;
    else s += open * 5;
  }
  return s;
}
function gkBotMove(grid) {
  const stones = [];
  for (let i = 0; i < N * N; i++) if (grid[i]) stones.push(i);
  if (!stones.length) return Math.floor(N / 2) * N + Math.floor(N / 2);
  const cand = new Set();
  for (const i of stones) {
    const r = Math.floor(i / N), c = i % N;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (inb(rr, cc) && !grid[rr * N + cc]) cand.add(rr * N + cc);
    }
  }
  let best = -1, bs = -1;
  for (const idx of cand) {
    const s = gkLineScore(grid, idx, "O") + gkLineScore(grid, idx, "X") * 0.85;
    if (s > bs) { bs = s; best = idx; }
  }
  return best;
}

function Gomoku() {
  const [grid, setGrid] = useState(() => Array(N * N).fill(null));
  const [player, setPlayer] = useState("X");
  const [count, setCount] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [winCells, setWinCells] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const winSet = useMemo(() => new Set(winCells || []), [winCells]);
  const canSwap = !winner && !swapped && count === 1 && player === "O" && mode === "2p";

  const newGame = () => { setGrid(Array(N * N).fill(null)); setPlayer("X"); setCount(0); setSwapped(false); setWinner(null); setWinCells(null); setConfetti([]); };

  const swap = () => {
    const ng = grid.map((v) => (v === "X" ? "O" : v));
    setGrid(ng); setSwapped(true); setPlayer("X");
  };

  const place = (idx, byBot) => {
    if (winner || grid[idx]) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    const ng = [...grid]; ng[idx] = player;
    const run = runAt(ng, Math.floor(idx / N), idx % N, player);
    setGrid(ng); setCount(count + 1);
    if (run) { setWinner(player); setWinCells(run); setConfetti(makeConfetti()); return; }
    setPlayer(player === "X" ? "O" : "X");
  };

  const ctr = (i) => ({ x: (i % N) + 0.5, y: Math.floor(i / N) + 0.5 });

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const i = gkBotMove(grid); if (i >= 0) place(i, true); }, 380);
    return () => clearTimeout(t);
  }, [mode, player, winner, grid]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes gk-pop{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes gk-line{to{stroke-dashoffset:0}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .gk-pop{animation:gk-pop .2s cubic-bezier(.34,1.56,.64,1) both}
        .gk-line{stroke-dasharray:1;stroke-dashoffset:1;animation:gk-line .5s ease-out forwards}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Fünf eigene Steine in einer ununterbrochenen Reihe — waagerecht, senkrecht oder diagonal.</p>
              <p><span className="text-neutral-100">Zug:</span> Setze einen Stein auf ein beliebiges freies Feld.</p>
              <p><span className="text-neutral-100">Tausch-Regel:</span> Weil der erste Zug stark ist, darf ○ direkt nach dem allerersten Stein die Seiten tauschen statt selbst zu setzen.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.25em] font-light text-neutral-100">GOMOKU</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Fünf in einer Reihe auf freiem Feld.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm gk-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] text-neutral-600 tracking-wide">{winner ? "" : "Feld antippen"}</span>
        </div>
        {canSwap ? (
          <div className="mb-3 gk-pop flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2">
            <span className="text-xs text-amber-200/90 tracking-wide">Tausch: ○ kann den Eröffnungszug übernehmen.</span>
            <button onClick={swap} className="text-xs tracking-[0.15em] rounded-md px-3 py-1.5 border border-amber-400/60 text-amber-100 hover:bg-amber-400/20 transition-colors">TAUSCHEN</button>
          </div>
        ) : null}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="relative" style={{ width: "100%", aspectRatio: "1" }}>
            <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 1, aspectRatio: "1" }}>
              {grid.map((v, idx) => {
                const r = Math.floor(idx / N), c = idx % N, dark = (r + c) % 2 === 1, isWin = winSet.has(idx);
                return (
                  <button key={idx} onClick={() => place(idx)} className="relative flex items-center justify-center"
                    style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 2, background: dark ? "#141417" : "#1b1b1f", cursor: winner || v ? "default" : "pointer" }}>
                    {v ? (<div className="gk-pop rounded-full" style={{ width: "82%", height: "82%", background: v === "X" ? COL_X : COL_O, opacity: winner && !isWin ? 0.4 : 1, boxShadow: isWin ? "0 0 0 1.5px #fff" : "inset 0 -2px 3px rgba(0,0,0,.45), inset 0 1px 2px rgba(255,255,255,.25)" }} />) : null}
                  </button>
                );
              })}
            </div>
            {winCells ? (<svg viewBox={`0 0 ${N} ${N}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none"><line className="gk-line" x1={ctr(winCells[0]).x} y1={ctr(winCells[0]).y} x2={ctr(winCells[winCells.length - 1]).x} y2={ctr(winCells[winCells.length - 1]).y} stroke="#fff" strokeWidth="0.18" strokeLinecap="round" pathLength={1} opacity="0.85" /></svg>) : null}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Gomoku;
})();

const G_OrderChaos = (function () {

const N = 6;
const COL_X = "#fb7185", COL_O = "#7dd3fc";
const ORDER_COL = "#fbbf24", CHAOS_COL = "#a78bfa";
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

function fiveAt(grid, r, c, s) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [[r, c]];
    let rr = r + dr, cc = c + dc;
    while (inb(rr, cc) && grid[rr * N + cc] === s) { line.push([rr, cc]); rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inb(rr, cc) && grid[rr * N + cc] === s) { line.unshift([rr, cc]); rr -= dr; cc -= dc; }
    if (line.length >= 5) return line.slice(0, 5).map(([a, b]) => a * N + b);
  }
  return null;
}


// --- Bot (Chaos): meidet Fuenfer, blockt Ordnungs-Sofortsiege, minimiert Drohpotenzial ---
function ocThreat(g) {
  let s = 0;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const sym of ["X", "O"]) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const [dr, dc] of dirs) {
        const er = r + 4 * dr, ec = c + 4 * dc;
        if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
        let n = 0, bad = false;
        for (let k = 0; k < 5; k++) {
          const v = g[(r + k * dr) * N + (c + k * dc)];
          if (v === sym) n++; else if (v) bad = true;
        }
        if (!bad) s += n === 4 ? 500 : n === 3 ? 40 : n === 2 ? 4 : 0;
      }
    }
  }
  return s;
}
function ocOrderCanWin(g) {
  for (let i = 0; i < N * N; i++) {
    if (g[i]) continue;
    for (const sym of ["X", "O"]) {
      const ng = [...g]; ng[i] = sym;
      if (fiveAt(ng, Math.floor(i / N), i % N, sym)) return true;
    }
  }
  return false;
}
function ocBotMove(grid) {
  let best = null, bs = Infinity, bestUnsafe = null, bu = Infinity;
  for (let i = 0; i < N * N; i++) {
    if (grid[i]) continue;
    for (const sym of ["X", "O"]) {
      const g = [...grid]; g[i] = sym;
      if (fiveAt(g, Math.floor(i / N), i % N, sym)) continue;
      const t = ocThreat(g) + Math.random() * 0.5;
      if (!ocOrderCanWin(g)) { if (t < bs) { bs = t; best = [i, sym]; } }
      else if (t < bu) { bu = t; bestUnsafe = [i, sym]; }
    }
  }
  if (best) return best;
  if (bestUnsafe) return bestUnsafe;
  const e = grid.findIndex((v) => !v);
  return e >= 0 ? [e, "X"] : null;
}

function OrderChaos() {
  const [grid, setGrid] = useState(() => Array(N * N).fill(null));
  const [role, setRole] = useState("order"); // order beginnt
  const [armed, setArmed] = useState("X");
  const [winner, _setWinner] = useState(null); // "order" | "chaos"
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [winCells, setWinCells] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const winSet = useMemo(() => new Set(winCells || []), [winCells]);

  const newGame = () => { setGrid(Array(N * N).fill(null)); setRole("order"); setArmed("X"); setWinner(null); setWinCells(null); setConfetti([]); };

  const place = (idx, byBot, symOverride) => {
    if (winner || grid[idx]) return;
    if (mode === "bot" && role === "chaos" && !byBot) return;
    const sym = symOverride || armed;
    const ng = [...grid]; ng[idx] = sym;
    const five = fiveAt(ng, Math.floor(idx / N), idx % N, sym);
    setGrid(ng);
    if (five) { setWinner("order"); setWinCells(five); setConfetti(makeConfetti()); return; }
    if (ng.every(Boolean)) { setWinner("chaos"); setConfetti(makeConfetti()); return; }
    setRole(role === "order" ? "chaos" : "order");
  };

  useEffect(() => {
    if (mode !== "bot" || winner || role !== "chaos") return;
    const t = setTimeout(() => { const m = ocBotMove(grid); if (m) place(m[0], true, m[1]); }, 420);
    return () => clearTimeout(t);
  }, [mode, role, winner, grid]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes oc-pop{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .oc-pop{animation:oc-pop .2s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Der Clou:</span> Beide Spieler setzen <span style={{ color: COL_X }}>✕</span> oder <span style={{ color: COL_O }}>○</span> — frei wählbar pro Zug. Die Symbole gehören niemandem.</p>
              <p><span style={{ color: ORDER_COL }}>Ordnung</span> gewinnt, sobald <span className="text-neutral-100">fünf gleiche Symbole</span> in einer Reihe stehen (egal wer sie gesetzt hat).</p>
              <p><span style={{ color: CHAOS_COL }}>Chaos</span> gewinnt, wenn das Brett voll ist, ohne dass das passiert.</p>
              <p>Ordnung beginnt. Wähle oben dein Symbol, dann tippe ein Feld.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.2em] font-light text-neutral-100">ORDER&nbsp;&amp;&nbsp;CHAOS</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Ordnung will fünf in Reihe — Chaos will es verhindern.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm oc-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span style={{ color: winner === "order" ? ORDER_COL : CHAOS_COL }}>{winner === "order" ? "Ordnung" : "Chaos"}</span></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span style={{ color: role === "order" ? ORDER_COL : CHAOS_COL }}>{role === "order" ? "Ordnung" : "Chaos"}</span></span>)}
          <span className="text-[11px] text-neutral-500 tracking-wide">{winner ? "" : "Symbol + Feld"}</span>
        </div>
        {!winner ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Setzen:</span>
            {["X", "O"].map((s) => (
              <button key={s} onClick={() => setArmed(s)} className="flex items-center justify-center rounded-lg border transition-colors"
                style={{ width: 46, height: 38, background: armed === s ? "#1f1f24" : "#141417", borderColor: armed === s ? "#fff" : "#27272a" }}>
                <span className="w-5 h-5 rounded-full inline-block" style={{ background: s === "X" ? COL_X : COL_O, opacity: armed === s ? 1 : 0.55 }} />
              </button>
            ))}
          </div>
        ) : null}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner (<span style={{ color: CHAOS_COL }}>Chaos</span>):</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 4, aspectRatio: "1" }}>
            {grid.map((v, idx) => {
              const r = Math.floor(idx / N), c = idx % N, dark = (r + c) % 2 === 1, isWin = winSet.has(idx);
              return (
                <button key={idx} onClick={() => place(idx)} className="relative flex items-center justify-center"
                  style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 6, background: dark ? "#141417" : "#1d1d21", cursor: winner || v ? "default" : "pointer", boxShadow: isWin ? "inset 0 0 0 2px #fff" : undefined }}>
                  {v ? (<div className="oc-pop rounded-full" style={{ width: "70%", height: "70%", background: v === "X" ? COL_X : COL_O, opacity: winner && !isWin && winCells ? 0.5 : 1, boxShadow: "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)" }} />) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return OrderChaos;
})();

const G_Quarto = (function () {

const COL_X = "#fb7185", COL_O = "#7dd3fc";
// Stück = 4 Bits: 1=Farbe(sky), 2=eckig, 4=klein, 8=hohl
const LINES = [
  [0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],
  [0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],
  [0,5,10,15],[3,6,9,12],
];

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

const Glyph = ({ p, dim }) => {
  const color = (p & 1) ? COL_O : COL_X, square = !!(p & 2), small = !!(p & 4), hollow = !!(p & 8);
  return (<div style={{
    width: small ? "50%" : "80%", height: small ? "50%" : "80%",
    borderRadius: square ? "16%" : "50%",
    background: hollow ? "transparent" : color,
    border: hollow ? `0.28rem solid ${color}` : "none",
    boxShadow: hollow ? "none" : "inset 0 -3px 5px rgba(0,0,0,.4), inset 0 2px 3px rgba(255,255,255,.25)",
    opacity: dim ? 0.22 : 1, transition: "opacity .15s",
  }} />);
};

function winningLine(board) {
  for (const L of LINES) {
    if (L.some((i) => board[i] === null)) continue;
    let and = 15, or = 0;
    for (const i of L) { and &= board[i]; or |= board[i]; }
    if (and !== 0 || or !== 15) return L;
  }
  return null;
}


// --- Bot: Siegzelle setzen, sonst sichere Gaben maximieren; reicht nur ungefaehrliche Stuecke ---
function qtWinCell(board, piece) {
  for (let i = 0; i < 16; i++) {
    if (board[i] !== null) continue;
    const nb = [...board]; nb[i] = piece;
    if (winningLine(nb)) return i;
  }
  return -1;
}
function qtBotPlace(board, hand) {
  const w = qtWinCell(board, hand);
  if (w >= 0) return w;
  let best = -1, bs = -Infinity;
  for (let i = 0; i < 16; i++) {
    if (board[i] !== null) continue;
    const nb = [...board]; nb[i] = hand;
    const used = new Set(nb.filter((v) => v !== null));
    let safe = 0;
    for (let p = 0; p < 16; p++) {
      if (used.has(p)) continue;
      if (qtWinCell(nb, p) < 0) safe++;
    }
    const sc = safe * 10 + (i === 5 || i === 6 || i === 9 || i === 10 ? 0.5 : 0) + Math.random() * 0.1;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
function qtBotGive(board) {
  const used = new Set(board.filter((v) => v !== null));
  const avail = [];
  for (let p = 0; p < 16; p++) if (!used.has(p)) avail.push(p);
  if (!avail.length) return null;
  const safe = avail.filter((p) => qtWinCell(board, p) < 0);
  const pool = safe.length ? safe : avail;
  return pool[Math.floor(Math.random() * pool.length)];
}

function Quarto() {
  const [board, setBoard] = useState(() => Array(16).fill(null));
  const [placed, setPlaced] = useState(() => new Set());
  const [hand, setHand] = useState(null);
  const [phase, setPhase] = useState("give"); // give | place
  const [player, setPlayer] = useState("X");
  const [winner, _setWinner] = useState(null); // "X" | "O" | "draw"
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [winCells, setWinCells] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const winSet = useMemo(() => new Set(winCells || []), [winCells]);

  const newGame = () => { setBoard(Array(16).fill(null)); setPlaced(new Set()); setHand(null); setPhase("give"); setPlayer("X"); setWinner(null); setWinCells(null); setConfetti([]); };

  const givePiece = (p, byBot) => {
    if (winner || phase !== "give" || placed.has(p) || p === hand) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    setHand(p); setPlayer(player === "X" ? "O" : "X"); setPhase("place");
  };

  const placePiece = (idx, byBot) => {
    if (winner || phase !== "place" || board[idx] !== null || hand === null) return;
    if (mode === "bot" && player === "O" && !byBot) return;
    const ng = [...board]; ng[idx] = hand;
    const np = new Set(placed); np.add(hand);
    setBoard(ng); setPlaced(np); setHand(null);
    const wl = winningLine(ng);
    if (wl) { setWinner(player); setWinCells(wl); setConfetti(makeConfetti()); return; }
    if (np.size === 16) { setWinner("draw"); return; }
    setPhase("give");
  };

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    if (phase === "place" && hand !== null) {
      const t = setTimeout(() => { const i = qtBotPlace(board, hand); if (i >= 0) placePiece(i, true); }, 430);
      return () => clearTimeout(t);
    }
    if (phase === "give") {
      const t = setTimeout(() => { const p = qtBotGive(board); if (p != null) givePiece(p, true); }, 430);
      return () => clearTimeout(t);
    }
  }, [mode, player, winner, phase, hand, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes qt-pop{0%{transform:scale(.4)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .qt-pop{animation:qt-pop .22s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">16 Stücke,</span> jedes mit vier Eigenschaften: Farbe (<span style={{ color: COL_X }}>rosé</span>/<span style={{ color: COL_O }}>blau</span>), Form (rund/eckig), Größe (groß/klein), Füllung (voll/hohl).</p>
              <p><span className="text-neutral-100">Der Clou:</span> Nicht du wählst, was du setzt — dein <span className="text-neutral-100">Gegner</span> reicht dir das Stück. Du setzt es, dann suchst du eins für ihn aus.</p>
              <p><span className="text-neutral-100">Sieg:</span> Wer eine Reihe, Spalte oder Diagonale aus vier Stücken vollendet, die <span className="text-neutral-100">mindestens eine Eigenschaft teilen</span>, gewinnt — egal, wer die anderen drei gesetzt hat.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 480 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] font-light text-neutral-100">QUARTO</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Vier mit gemeinsamer Eigenschaft — der Gegner reicht dir das Stück.</p>
        <div className="mb-3 min-h-[2.75rem] flex items-center justify-between rounded-lg bg-neutral-900 px-4 py-2 border border-neutral-800 gap-3">
          {winner ? (
            <span key="w" className="text-sm qt-pop inline-flex items-center gap-2">{winner === "draw" ? <span className="text-neutral-300">Unentschieden</span> : (<><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></>)}</span>
          ) : (
            <span className="text-sm flex items-center gap-2"><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /><span className="text-neutral-400 text-[12px]">{phase === "give" ? "wählt ein Stück für den Gegner" : "setzt das erhaltene Stück"}</span></span>
          )}
          {hand !== null && !winner ? (<div className="flex items-center justify-center rounded-md border border-neutral-600 bg-neutral-950" style={{ width: 38, height: 38, flexShrink: 0 }}><Glyph p={hand} /></div>) : null}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2.5 border border-neutral-800 mb-4" style={{ width: "100%" }}>
          <div className="grid grid-cols-4 w-full" style={{ gap: 6, aspectRatio: "1" }}>
            {board.map((p, idx) => {
              const isWin = winSet.has(idx);
              const canPlace = !winner && phase === "place" && p === null && hand !== null;
              return (
                <button key={idx} onClick={() => placePiece(idx)} className="relative flex items-center justify-center rounded-lg"
                  style={{ aspectRatio: "1", border: 0, padding: 0, background: "#0c0c0e", cursor: canPlace ? "pointer" : "default", boxShadow: isWin ? "inset 0 0 0 2px #fff" : canPlace ? "inset 0 0 0 1.5px #3f3f46" : undefined }}>
                  {p !== null ? <div className="qt-pop w-full h-full flex items-center justify-center" style={{ opacity: winner && !isWin && winCells ? 0.4 : 1 }}><Glyph p={p} /></div> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-[10px] tracking-[0.25em] text-neutral-600 mb-2">{winner ? "STÜCKE" : phase === "give" ? "STÜCK FÜR DEN GEGNER WÄHLEN" : "VORRAT"}</div>
        <div className="rounded-xl bg-neutral-900 p-2.5 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid grid-cols-8" style={{ gap: 6 }}>
            {Array.from({ length: 16 }, (_, p) => {
              const used = placed.has(p), inHand = p === hand;
              const selectable = !winner && phase === "give" && !used && !inHand;
              return (
                <button key={p} onClick={() => givePiece(p)} className="relative flex items-center justify-center rounded-md"
                  style={{ aspectRatio: "1", border: 0, padding: 0, background: inHand ? "#1f1f24" : "#141417", cursor: selectable ? "pointer" : "default", boxShadow: inHand ? "inset 0 0 0 1.5px #fff" : selectable ? "inset 0 0 0 1px #2a2a30" : undefined }}>
                  {!used ? <Glyph p={p} dim={inHand} /> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Quarto;
})();

const G_Clobber = (function () {

const N = 6;
const COL_X = "#fb7185", COL_O = "#7dd3fc";
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const ORTH = [[0, 1], [0, -1], [1, 0], [-1, 0]];

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

const initBoard = () => Array.from({ length: 36 }, (_, i) => ((Math.floor(i / N) + (i % N)) % 2 === 0 ? "X" : "O"));

function targetsFor(board, idx, p) {
  const opp = p === "X" ? "O" : "X";
  const r = Math.floor(idx / N), c = idx % N, out = new Set();
  for (const [dr, dc] of ORTH) if (inb(r + dr, c + dc) && board[(r + dr) * N + (c + dc)] === opp) out.add((r + dr) * N + (c + dc));
  return out;
}
const hasMove = (board, p) => { for (let i = 0; i < 36; i++) if (board[i] === p && targetsFor(board, i, p).size) return true; return false; };


// --- Bot: Negamax Alpha-Beta, Mobilitaet als Eval, adaptive Tiefe ---
function clMoves(b, p) {
  const ms = [];
  for (let i = 0; i < 36; i++) if (b[i] === p) for (const t of targetsFor(b, i, p)) ms.push([i, t]);
  return ms;
}
function clNm(b, depth, alpha, beta, p, ply) {
  const ms = clMoves(b, p);
  if (!ms.length) return -10000 + ply;
  if (depth <= 0) return ms.length - clMoves(b, p === "X" ? "O" : "X").length;
  let best = -Infinity;
  for (const [f, t] of ms) {
    const sf = b[f], st = b[t];
    b[t] = p; b[f] = null;
    const sc = -clNm(b, depth - 1, -beta, -alpha, p === "X" ? "O" : "X", ply + 1);
    b[f] = sf; b[t] = st;
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function clBotMove(board) {
  const b = [...board];
  const pieces = b.filter(Boolean).length;
  const depth = pieces > 26 ? 3 : pieces > 18 ? 4 : pieces > 10 ? 6 : 9;
  let best = null, bs = -Infinity;
  for (const [f, t] of clMoves(b, "O")) {
    const sf = b[f], st = b[t];
    b[t] = "O"; b[f] = null;
    const sc = -clNm(b, depth - 1, -Infinity, Infinity, "X", 1);
    b[f] = sf; b[t] = st;
    if (sc > bs) { bs = sc; best = [f, t]; }
  }
  return best;
}

function Clobber() {
  const [board, setBoard] = useState(initBoard);
  const [player, setPlayer] = useState("X");
  const [sel, setSel] = useState(null);
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const targets = useMemo(() => (sel === null || winner ? new Set() : targetsFor(board, sel, player)), [sel, board, player, winner]);

  const newGame = () => { setBoard(initBoard()); setPlayer("X"); setSel(null); setWinner(null); setConfetti([]); };

  const move = (to, fromIdx) => {
    const from = fromIdx != null ? fromIdx : sel;
    const ng = [...board]; ng[to] = player; ng[from] = null;
    setBoard(ng); setSel(null);
    const opp = player === "X" ? "O" : "X";
    if (!hasMove(ng, opp)) { setWinner(player); setConfetti(makeConfetti()); return; }
    setPlayer(opp);
  };

  const clickField = (idx) => {
    if (winner) return;
    if (mode === "bot" && player === "O") return;
    if (sel !== null && targets.has(idx)) { move(idx); return; }
    if (board[idx] === player && targetsFor(board, idx, player).size) setSel(sel === idx ? null : idx); else setSel(null);
  };

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O") return;
    const t = setTimeout(() => { const mv = clBotMove(board); if (mv) move(mv[1], mv[0]); }, 380);
    return () => clearTimeout(t);
  }, [mode, player, winner, board]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes cl-pop{0%{transform:scale(.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .cl-pop{animation:cl-pop .2s cubic-bezier(.34,1.56,.64,1) both}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Zug:</span> Ziehe einen eigenen Stein auf ein direkt benachbartes Feld (waagerecht/senkrecht), das von einem gegnerischen Stein besetzt ist — und ersetze ihn.</p>
              <p><span className="text-neutral-100">Nur so:</span> Es gibt ausschließlich diesen schlagenden Zug. Auf leere Felder kann man nicht ziehen.</p>
              <p><span className="text-neutral-100">Ende:</span> Wer am Zug ist und keinen Stein mehr neben einem Gegner hat, verliert.</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 600 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.25em] font-light text-neutral-100">CLOBBER</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Schlage einen Nachbarn. Wer nicht mehr kann, verliert.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm cl-pop inline-flex items-center gap-2"><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] text-neutral-500 tracking-wide">{winner ? "" : sel === null ? "Stein wählen" : "Gegner schlagen"}</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-2 border border-neutral-800" style={{ width: "100%" }}>
          <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 4, aspectRatio: "1" }}>
            {board.map((v, idx) => {
              const r = Math.floor(idx / N), c = idx % N, dark = (r + c) % 2 === 1;
              const isSel = sel === idx, isTarget = targets.has(idx);
              return (
                <button key={idx} onClick={() => clickField(idx)} className="relative flex items-center justify-center"
                  style={{ aspectRatio: "1", border: 0, padding: 0, borderRadius: 6, background: dark ? "#141417" : "#1d1d21", cursor: winner ? "default" : "pointer", boxShadow: isSel ? "inset 0 0 0 2px #fff" : isTarget ? `inset 0 0 0 2px ${player === "X" ? COL_X : COL_O}` : undefined }}>
                  {v ? (<div className="cl-pop rounded-full" style={{ width: "72%", height: "72%", background: v === "X" ? COL_X : COL_O, opacity: winner && winner !== v ? 0.45 : 1, boxShadow: isTarget ? "0 0 0 2px #fff" : "inset 0 -3px 5px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.25)" }} />) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Clobber;
})();

const G_Fanorona = (function () {

const COLS = 9, ROWS = 5;
const COL_X = "#fb7185", COL_O = "#7dd3fc";
const id = (r, c) => r * COLS + c;
const inb = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
const dirOK = (r, c, dr, dc) => (dr === 0 || dc === 0) ? true : (r + c) % 2 === 0;

const CONFETTI_COLORS = ["#fb7185", "#7dd3fc", "#fbbf24", "#34d399", "#a78bfa", "#f5f5f5"];
const makeConfetti = () => Array.from({ length: 80 }, (_, i) => ({
  id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.8,
  drift: (Math.random() * 2 - 1) * 140, rot: 360 + Math.random() * 720, size: 6 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], round: Math.random() > 0.5,
}));

const initBoard = () => {
  const b = Array(45).fill(null);
  for (let c = 0; c < 9; c++) { b[id(0, c)] = "O"; b[id(1, c)] = "O"; b[id(3, c)] = "X"; b[id(4, c)] = "X"; }
  const mid = ["O", "X", "O", "X", null, "O", "X", "O", "X"];
  for (let c = 0; c < 9; c++) b[id(2, c)] = mid[c];
  return b;
};

function captureForStep(board, from, dr, dc, player) {
  const r = Math.floor(from / COLS), c = from % COLS, nr = r + dr, nc = c + dc;
  if (!inb(nr, nc) || board[id(nr, nc)] !== null) return null;
  const opp = player === "X" ? "O" : "X";
  const app = []; let ar = nr + dr, ac = nc + dc;
  while (inb(ar, ac) && board[id(ar, ac)] === opp) { app.push(id(ar, ac)); ar += dr; ac += dc; }
  const wd = []; let wr = r - dr, wc = c - dc;
  while (inb(wr, wc) && board[id(wr, wc)] === opp) { wd.push(id(wr, wc)); wr -= dr; wc -= dc; }
  return { from, to: id(nr, nc), dir: [dr, dc], approach: app, withdrawal: wd };
}

function stepsFrom(board, from, player, opts = {}) {
  const r = Math.floor(from / COLS), c = from % COLS, res = [];
  for (const [dr, dc] of DIRS) {
    if (!dirOK(r, c, dr, dc)) continue;
    if (opts.lastDir && dr === opts.lastDir[0] && dc === opts.lastDir[1]) continue;
    const cap = captureForStep(board, from, dr, dc, player);
    if (!cap) continue;
    if (opts.visited && opts.visited.has(cap.to)) continue;
    const can = cap.approach.length || cap.withdrawal.length;
    if (opts.captureOnly && !can) continue;
    res.push(cap);
  }
  return res;
}
const hasCapture = (board, p) => { for (let i = 0; i < 45; i++) if (board[i] === p && stepsFrom(board, i, p, { captureOnly: true }).length) return true; return false; };
const hasMove = (board, p) => { for (let i = 0; i < 45; i++) if (board[i] === p && stepsFrom(board, i, p).length) return true; return false; };


// --- Bot: groesste Schlagserie, Ketten werden fortgesetzt ---
function fnBotPick(board, chain) {
  if (chain) {
    const conts = stepsFrom(board, chain.active, "O", { captureOnly: true, lastDir: chain.lastDir, visited: chain.visited });
    let best = null, bs = -1;
    for (const cap of conts) {
      const n = Math.max(cap.approach.length, cap.withdrawal.length);
      if (n > bs) { bs = n; best = cap; }
    }
    return best;
  }
  const mustC = hasCapture(board, "O");
  let best = null, bs = -Infinity;
  for (let i = 0; i < 45; i++) {
    if (board[i] !== "O") continue;
    for (const cap of stepsFrom(board, i, "O", { captureOnly: mustC })) {
      const n = Math.max(cap.approach.length, cap.withdrawal.length);
      const sc = n * 10 + Math.random();
      if (sc > bs) { bs = sc; best = cap; }
    }
  }
  return best;
}

function Fanorona() {
  const [board, setBoard] = useState(initBoard);
  const [player, setPlayer] = useState("X");
  const [sel, setSel] = useState(null);
  const [chain, setChain] = useState(null); // {active, lastDir, visited:Set}
  const [pending, setPending] = useState(null); // cap mit beiden Optionen
  const [winner, _setWinner] = useState(null);
  const setWinner = (w) => { _setWinner(w); try { if (w && window.__hsWin) window.__hsWin(w); } catch (e) {} };
  const [confetti, setConfetti] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("2p");

  const mustCap = useMemo(() => (!winner && !chain ? hasCapture(board, player) : false), [board, player, winner, chain]);

  const selectable = useMemo(() => {
    if (winner) return new Set();
    if (chain) return new Set([chain.active]);
    const s = new Set();
    for (let i = 0; i < 45; i++) if (board[i] === player && stepsFrom(board, i, player, { captureOnly: mustCap }).length) s.add(i);
    return s;
  }, [board, player, winner, chain, mustCap]);

  const destMap = useMemo(() => {
    const m = new Map();
    if (winner) return m;
    if (chain) { for (const cap of stepsFrom(board, chain.active, player, { captureOnly: true, lastDir: chain.lastDir, visited: chain.visited })) m.set(cap.to, cap); }
    else if (sel !== null) { for (const cap of stepsFrom(board, sel, player, { captureOnly: mustCap })) m.set(cap.to, cap); }
    return m;
  }, [board, player, winner, chain, sel, mustCap]);

  const newGame = () => { setBoard(initBoard()); setPlayer("X"); setSel(null); setChain(null); setPending(null); setWinner(null); setConfetti([]); };

  const endTurn = (ng) => {
    const opp = player === "X" ? "O" : "X";
    const oppCount = ng.reduce((a, v) => a + (v === opp ? 1 : 0), 0);
    if (oppCount === 0 || !hasMove(ng, opp)) { setBoard(ng); setWinner(player); setConfetti(makeConfetti()); setSel(null); setChain(null); return; }
    setBoard(ng); setPlayer(opp); setSel(null); setChain(null);
  };

  const applyMove = (cap, captured) => {
    const ng = [...board]; ng[cap.to] = player; ng[cap.from] = null;
    for (const k of captured) ng[k] = null;
    if (captured.length === 0) { endTurn(ng); return; }
    const opp = player === "X" ? "O" : "X";
    if (ng.reduce((a, v) => a + (v === opp ? 1 : 0), 0) === 0) { setBoard(ng); setWinner(player); setConfetti(makeConfetti()); setSel(null); setChain(null); return; }
    const visited = new Set(chain ? chain.visited : []); visited.add(cap.from); visited.add(cap.to);
    const conts = stepsFrom(ng, cap.to, player, { captureOnly: true, lastDir: cap.dir, visited });
    if (conts.length) { setBoard(ng); setChain({ active: cap.to, lastDir: cap.dir, visited }); setSel(cap.to); }
    else endTurn(ng);
  };

  const doStep = (cap) => {
    if (cap.approach.length && cap.withdrawal.length) { setPending(cap); return; }
    applyMove(cap, cap.approach.length ? cap.approach : cap.withdrawal);
  };

  const clickPoint = (i) => {
    if (winner || pending) return;
    if (mode === "bot" && player === "O") return;
    if (destMap.has(i)) { doStep(destMap.get(i)); return; }
    if (chain) return;
    if (board[i] === player && selectable.has(i)) setSel(sel === i ? null : i); else setSel(null);
  };

  const X = (c) => c, Y = (r) => r;
  const diagSegs = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 0) diagSegs.push([c, r, c + 1, r + 1]); else diagSegs.push([c + 1, r, c, r + 1]);
  }
  const pcol = player === "X" ? COL_X : COL_O;

  useEffect(() => {
    if (mode !== "bot" || winner || player !== "O" || pending) return;
    const t = setTimeout(() => {
      const cap = fnBotPick(board, chain);
      if (!cap) return;
      const list = cap.approach.length >= cap.withdrawal.length ? cap.approach : cap.withdrawal;
      applyMove(cap, list);
    }, 430);
    return () => clearTimeout(t);
  }, [mode, player, winner, board, chain, pending]);


  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-200 flex flex-col items-center px-4 py-6 select-none">
      <style>{`
        @keyframes fn-pop{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes stt-confetti{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}100%{transform:translateY(112vh) translateX(var(--drift)) rotate(var(--rot));opacity:0}}
        .stt-confetti{position:absolute;top:0;animation-name:stt-confetti;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
      `}</style>
      {confetti.length > 0 ? (<div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{confetti.map((p) => (<span key={p.id} className="stt-confetti block" style={{ left: p.left + "%", width: p.size + "px", height: p.size + "px", background: p.color, borderRadius: p.round ? "50%" : "2px", animationDelay: p.delay + "s", animationDuration: p.dur + "s", "--drift": p.drift + "px", "--rot": p.rot + "deg" }} />))}</div>) : null}
      {showInfo ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }} onClick={() => setShowInfo(false)}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm tracking-[0.2em] text-neutral-100">SO GEHT'S</h2><button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 flex items-center justify-center">×</button></div>
            <div className="text-xs text-neutral-300 leading-relaxed space-y-2.5">
              <p><span className="text-neutral-100">Ziel:</span> Schlage alle gegnerischen Steine. Gezogen wird ein Feld weit entlang der eingezeichneten Linien (diagonal nur an den verstärkten Punkten).</p>
              <p><span className="text-neutral-100">Schlagen:</span> Ziehe auf ein leeres Feld — und schlage entweder durch <span className="text-neutral-100">Annähern</span> (Gegner liegt vor dir in Zugrichtung) oder durch <span className="text-neutral-100">Zurückweichen</span> (Gegner lag hinter dir). Alle Steine in gerader Linie dahinter fallen mit.</p>
              <p><span className="text-neutral-100">Schlagzwang:</span> Kannst du schlagen, musst du. Bietet ein Zug beide Richtungen, darfst du wählen.</p>
              <p><span className="text-neutral-100">Kette:</span> Nach einem Schlag darf derselbe Stein weiterschlagen — nicht zweimal dieselbe Richtung, kein Punkt doppelt. Fortsetzen ist freiwillig.</p>
            </div>
          </div>
        </div>
      ) : null}
      {pending ? (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.65)", zIndex: 60 }}>
          <div className="w-full rounded-xl bg-neutral-900 border border-neutral-700 p-5" style={{ maxWidth: 320 }}>
            <h2 className="text-sm tracking-[0.15em] text-neutral-100 mb-3">In welche Richtung schlagen?</h2>
            <div className="flex flex-col gap-2">
              <button onClick={() => { const c = pending; setPending(null); applyMove(c, c.approach); }} className="rounded-lg border border-neutral-700 hover:border-neutral-500 px-4 py-2.5 text-left text-sm text-neutral-200 transition-colors">Annähern — {pending.approach.length} schlagen</button>
              <button onClick={() => { const c = pending; setPending(null); applyMove(c, c.withdrawal); }} className="rounded-lg border border-neutral-700 hover:border-neutral-500 px-4 py-2.5 text-left text-sm text-neutral-200 transition-colors">Zurückweichen — {pending.withdrawal.length} schlagen</button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="w-full" style={{ maxWidth: 640 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.25em] font-light text-neutral-100">FANORONA</h1>
          <button onClick={() => setShowInfo(true)} aria-label="Regeln" className="w-8 h-8 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 flex items-center justify-center text-sm transition-colors">i</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3 tracking-wide">Schlage durch Annähern oder Zurückweichen. Ketten erlaubt.</p>
        <div className="mb-3 h-11 flex items-center justify-between rounded-lg bg-neutral-900 px-4 border border-neutral-800">
          {winner ? (<span key="w" className="text-sm inline-flex items-center gap-2" style={{ animation: "fn-pop .4s both" }}><span className="text-neutral-500">Sieger</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: winner === "X" ? COL_X : COL_O }} /></span>)
            : (<span className="text-sm flex items-center gap-2"><span className="text-neutral-500">Am Zug</span><span className="w-4 h-4 rounded-full inline-block" style={{ background: player === "X" ? COL_X : COL_O }} /></span>)}
          <span className="text-[11px] tracking-wide" style={{ color: chain ? "#fbbf24" : mustCap ? "#fbbf24" : "#71717a" }}>{winner ? "" : chain ? "Kette — weiter oder beenden" : mustCap ? "Schlagzwang" : sel === null ? "Stein wählen" : "Ziel wählen"}</span>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 tracking-wide mr-1">Gegner <span className="inline-block rounded-full align-middle" style={{ width: 10, height: 10, background: COL_O }} />:</span>
          {[["2p", "MENSCH"], ["bot", "BOT"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={"text-[11px] tracking-[0.12em] rounded-md px-3 py-1.5 border transition-colors " + (mode === m ? "border-neutral-400 text-neutral-100 bg-neutral-800" : "border-neutral-800 text-neutral-500 hover:border-neutral-600")}>{l}</button>
          ))}
        </div>
        <div className="rounded-xl bg-neutral-900 p-3 border border-neutral-800" style={{ width: "100%" }}>
          <svg viewBox="-0.6 -0.6 9.2 5.2" className="w-full h-auto">
            <g stroke="#3f3f46" strokeWidth="0.045">
              {Array.from({ length: ROWS }, (_, r) => <line key={"h" + r} x1={X(0)} y1={Y(r)} x2={X(8)} y2={Y(r)} />)}
              {Array.from({ length: COLS }, (_, c) => <line key={"v" + c} x1={X(c)} y1={Y(0)} x2={X(c)} y2={Y(4)} />)}
              {diagSegs.map((s, i) => <line key={"d" + i} x1={X(s[0])} y1={Y(s[1])} x2={X(s[2])} y2={Y(s[3])} />)}
            </g>
            {[...destMap.keys()].map((to) => { const r = Math.floor(to / COLS), c = to % COLS; return <circle key={"t" + to} cx={X(c)} cy={Y(r)} r="0.3" fill="none" stroke={pcol} strokeWidth="0.06" opacity="0.85" />; })}
            {board.map((v, i) => { if (!v) return null; const r = Math.floor(i / COLS), c = i % COLS; const isAct = (chain && chain.active === i) || sel === i; const isSelectable = selectable.has(i) && !isAct;
              return (<g key={"p" + i} style={{ transformOrigin: "center", animation: "fn-pop .2s both" }}>
                <circle cx={X(c)} cy={Y(r)} r="0.34" fill={v === "X" ? COL_X : COL_O} opacity={winner && winner !== v ? 0.45 : 1} />
                {isAct ? <circle cx={X(c)} cy={Y(r)} r="0.42" fill="none" stroke="#fff" strokeWidth="0.07" /> : null}
                {isSelectable ? <circle cx={X(c)} cy={Y(r)} r="0.42" fill="none" stroke={pcol} strokeWidth="0.05" opacity="0.55" /> : null}
              </g>);
            })}
            {board.map((_, i) => { const r = Math.floor(i / COLS), c = i % COLS; return <circle key={"c" + i} cx={X(c)} cy={Y(r)} r="0.46" fill="transparent" style={{ cursor: winner ? "default" : "pointer" }} onClick={() => clickPoint(i)} />; })}
          </svg>
        </div>
        <div className="mt-4 flex items-center justify-between">
          {chain ? (<button onClick={() => endTurn(board)} className="text-xs tracking-[0.15em] text-amber-100 border border-amber-400/60 hover:bg-amber-400/20 rounded-lg px-4 py-2 transition-colors">ZUG BEENDEN</button>) : <span />}
          <button onClick={newGame} className="text-xs tracking-[0.15em] text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-2 transition-colors">NEUSTART</button>
        </div>
      </div>
    </div>
  );
}
return Fanorona;
})();

const Ico = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">{children}</svg>
);
const dot = (cx, cy, r = 1.6) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
const ICONS = {
  superttt: <Ico><path d="M4 9h16M4 15h16M9 4v16M15 4v16" /></Ico>,
  connect4: <Ico><circle cx="12" cy="5.2" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="18.8" r="2.5" /></Ico>,
  pentago: <Ico><path d="M19 12a7 7 0 1 1-7-7" /><path d="M12 2.2 16 5l-4 2.8z" fill="currentColor" stroke="none" />{dot(12, 12, 1.7)}</Ico>,
  gobblet: <Ico><circle cx="10" cy="14" r="6" /><circle cx="15.5" cy="8.5" r="3.6" /></Ico>,
  gomoku: <Ico>{dot(4, 20)}{dot(8, 16)}{dot(12, 12)}{dot(16, 8)}{dot(20, 4)}</Ico>,
  orderchaos: <Ico><path d="M4 5l6 6M10 5l-6 6" /><circle cx="16.5" cy="16.5" r="3.6" /></Ico>,
  quarto: <Ico>{dot(7, 7, 3)}<rect x="13.5" y="4" width="6" height="6" rx="1" /><circle cx="7" cy="17" r="3" /><rect x="14" y="14.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" /></Ico>,
  hex: <Ico><path d="M12 3l7 4.5v9L12 21l-7-4.5v-9z" /></Ico>,
  loa: <Ico>{dot(6, 6)}{dot(18, 8)}{dot(9, 18)}{dot(16, 15)}<path d="M6 6l12 2M6 6l3 12M18 8l-2 7M9 18l7-3" strokeWidth="1" /></Ico>,
  amazons: <Ico><path d="M5 19 16 8M16 8h-4.5M16 8v4.5" /><path d="M18.5 3.5l2.5 2.5M21 3.5l-2.5 2.5" /></Ico>,
  dots: <Ico>{dot(5, 5, 1.4)}{dot(19, 5, 1.4)}{dot(5, 19, 1.4)}{dot(19, 19, 1.4)}<path d="M5 5h14M5 5v14M5 19h14" /></Ico>,
  reversi: <Ico><circle cx="12" cy="12" r="7.5" /><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" stroke="none" /></Ico>,
  konane: <Ico>{dot(12, 16, 2)}<circle cx="5" cy="16" r="2.4" /><path d="M5 12a7 7 0 0 1 14 0" /><path d="M19 12.5 19 9M19 12.5l-3-1.7" /></Ico>,
  breakthr: <Ico><path d="M12 20V7M8 11l4-4 4 4" /><path d="M4 4h16" /></Ico>,
  hnefatafl: <Ico><rect x="9.5" y="9.5" width="5" height="5" /><path d="M3 6V3h3M18 3h3v3M3 18v3h3M21 18v3h-3" /></Ico>,
  clobber: <Ico>{dot(6.5, 12, 3)}<circle cx="17.5" cy="12" r="3" /><path d="M10.5 12h3.5m-1.6-1.8 1.8 1.8-1.8 1.8" /></Ico>,
  fanorona: <Ico><path d="M4 12h16M12 4v16M5.5 5.5l13 13M18.5 5.5l-13 13" strokeWidth="1.1" />{dot(12, 12, 1.7)}</Ico>,
  quoridor: <Ico>{dot(8.5, 16.5, 2.6)}<path d="M4 9.5h16" strokeWidth="2.6" /></Ico>,
  onitama: <Ico><rect x="4" y="7" width="9" height="13" rx="1.5" /><rect x="11.5" y="4" width="8.5" height="12" rx="1.5" /></Ico>,
  halma: <Ico><path d="M6 18 18 6M18 6h-5M18 6v5M6 18h5M6 18v-5" /></Ico>,
  mancala: <Ico><ellipse cx="12" cy="12" rx="9" ry="5.5" />{dot(8, 12, 1.3)}{dot(12, 12, 1.3)}{dot(16, 12, 1.3)}</Ico>,
};

const GAMES = [
  { id: "superttt",   name: "Super-Tic-Tac-Toe", tag: "Drei in Reihe, verschachtelt", cat: "REIHE BILDEN",        comp: G_SuperTicTacToe },
  { id: "connect4",   name: "Connect Four",       tag: "Vier in einer Reihe",          cat: "REIHE BILDEN",        comp: G_ConnectFour, bot: true },
  { id: "pentago",    name: "Pentago",            tag: "Setzen & Quadrant drehen",     cat: "REIHE BILDEN",        comp: G_Pentago },
  { id: "gobblet",    name: "Gobblet Gobblers",   tag: "Drei in Reihe, gefräßig",      cat: "REIHE BILDEN",        comp: G_Gobblet },
  { id: "gomoku",     name: "Gomoku",             tag: "Fünf in einer Reihe",          cat: "REIHE BILDEN",        comp: G_Gomoku, bot: true },
  { id: "orderchaos", name: "Order & Chaos",      tag: "Ordnung gegen Chaos",          cat: "REIHE BILDEN",        comp: G_OrderChaos },
  { id: "quarto",     name: "Quarto",             tag: "Der Gegner reicht das Stück",  cat: "REIHE BILDEN",        comp: G_Quarto },
  { id: "hex",        name: "Hex",                tag: "Ränder verbinden",             cat: "VERBINDEN & EROBERN", comp: G_Hex },
  { id: "loa",        name: "Lines of Action",    tag: "Steine versammeln",            cat: "VERBINDEN & EROBERN", comp: G_LinesOfAction },
  { id: "amazons",    name: "Amazonen",           tag: "Ziehen & einsperren",          cat: "VERBINDEN & EROBERN", comp: G_Amazons },
  { id: "dots",       name: "Käsekästchen",       tag: "Kästchen schließen",           cat: "VERBINDEN & EROBERN", comp: G_DotsAndBoxes },
  { id: "reversi",    name: "Reversi",            tag: "Steine umdrehen",              cat: "SCHLAGEN & FANGEN",   comp: G_Reversi, bot: true },
  { id: "konane",     name: "Kōnane",             tag: "Springen & schlagen",          cat: "SCHLAGEN & FANGEN",   comp: G_Konane },
  { id: "breakthr",   name: "Breakthrough",       tag: "Linie durchbrechen",           cat: "SCHLAGEN & FANGEN",   comp: G_Breakthrough },
  { id: "hnefatafl",  name: "Hnefatafl",          tag: "König flieht zur Ecke",        cat: "SCHLAGEN & FANGEN",   comp: G_Hnefatafl },
  { id: "clobber",    name: "Clobber",            tag: "Nachbarn schlagen",            cat: "SCHLAGEN & FANGEN",   comp: G_Clobber, bot: true },
  { id: "fanorona",   name: "Fanorona",           tag: "Annähern oder zurückweichen",  cat: "SCHLAGEN & FANGEN",   comp: G_Fanorona },
  { id: "quoridor",   name: "Quoridor",           tag: "Weg zum Ziel",                 cat: "ZIEHEN & RENNEN",     comp: G_Quoridor },
  { id: "onitama",    name: "Onitama",            tag: "Karten-Duell",                 cat: "ZIEHEN & RENNEN",     comp: G_Onitama },
  { id: "halma",      name: "Halma",              tag: "Lager wechseln",               cat: "ZIEHEN & RENNEN",     comp: G_Halma },
  { id: "mancala",    name: "Mancala",            tag: "Steine säen",                  cat: "ZIEHEN & RENNEN",     comp: G_Mancala },
];
const CATS = ["REIHE BILDEN", "VERBINDEN & EROBERN", "SCHLAGEN & FANGEN", "ZIEHEN & RENNEN"];
const CAT_COL = { "REIHE BILDEN": "#fbbf24", "VERBINDEN & EROBERN": "#34d399", "SCHLAGEN & FANGEN": "#fb7185", "ZIEHEN & RENNEN": "#7dd3fc" };
// Spiele mit eigenen Sieger-Labels → auf Spieler 1 (rosé) / Spieler 2 (blau) abbilden
const P1L = { hnefatafl: "D", orderchaos: "order" };
const P2L = { hnefatafl: "A", orderchaos: "chaos" };

export default function GamesHub() {
  const [active, setActive] = useState(null);
  const [visited, setVisited] = useState([]);
  const [resetKeys, setResetKeys] = useState({});
  const [sound, setSound] = useState(true);
  const [query, setQuery] = useState("");
  const [coin, setCoin] = useState(null);
  const [scores, setScores] = useState({});
  const [nameX, setNameX] = useState("");
  const [nameO, setNameO] = useState("");
  const audioRef = useRef(null);
  const soundRef = useRef(true);
  const activeRef = useRef(null);
  const winLockRef = useRef(0);
  const repLockRef = useRef(0);
  const wrapRef = useRef(null);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { activeRef.current = active; }, [active]);

  const ctx = () => {
    if (!audioRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioRef.current = new AC();
    }
    if (audioRef.current.state === "suspended") audioRef.current.resume();
    return audioRef.current;
  };
  const blip = (f, t, dur, vol, type) => {
    try {
      const c = ctx(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(vol, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + t); o.stop(c.currentTime + t + dur + 0.03);
    } catch (e) {}
  };
  const tick = () => { if (!soundRef.current) return; blip(660 + Math.random() * 220, 0, 0.05, 0.035, "triangle"); };
  const fanfare = () => {
    if (!soundRef.current) return;
    blip(523, 0, 0.14, 0.06); blip(659, 0.11, 0.14, 0.06); blip(784, 0.22, 0.14, 0.06); blip(1047, 0.33, 0.3, 0.07);
  };

  // Sieger-Reporting aus allen Spielen (setWinner-Hook)
  useEffect(() => {
    window.__hsWin = (w) => {
      const id = activeRef.current;
      if (!id) return;
      const now = Date.now();
      if (now - repLockRef.current < 800) return;
      repLockRef.current = now;
      setScores((s) => {
        const g = { ...(s[id] || {}) };
        g[w] = (g[w] || 0) + 1;
        return { ...s, [id]: g };
      });
    };
    return () => { window.__hsWin = null; };
  }, []);

  // Sieg-Sound + Haptik via Konfetti-Observer
  useEffect(() => {
    if (!active || !wrapRef.current) return;
    const obs = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && ((n.classList && n.classList.contains("stt-confetti")) || (n.querySelector && n.querySelector(".stt-confetti")))) {
          const now = Date.now();
          if (now - winLockRef.current > 1500) {
            winLockRef.current = now;
            fanfare();
            if (soundRef.current && navigator.vibrate) navigator.vibrate([40, 60, 40]);
          }
          return;
        }
      }
    });
    obs.observe(wrapRef.current, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [active]);

  const open = (id) => {
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    setActive(id);
  };
  const resetGame = (id) => setResetKeys((k) => ({ ...k, [id]: (k[id] || 0) + 1 }));
  const randomGame = () => open(GAMES[Math.floor(Math.random() * GAMES.length)].id);
  const flipCoin = () => {
    if (coin === "spin") return;
    setCoin("spin");
    setTimeout(() => setCoin(Math.random() < 0.5 ? "X" : "O"), 700);
  };

  const onAnyClick = (e) => {
    if (!active) return;
    if (e.target.closest && e.target.closest("button")) {
      tick();
      if (soundRef.current && navigator.vibrate) navigator.vibrate(8);
    }
  };

  const countsFor = (id) => {
    const g = scores[id] || {};
    return { p1: g[P1L[id] || "X"] || 0, p2: g[P2L[id] || "O"] || 0, dr: g["draw"] || 0 };
  };
  const totals = useMemo(() => {
    let p1 = 0, p2 = 0, dr = 0;
    for (const id of Object.keys(scores)) { const c = countsFor(id); p1 += c.p1; p2 += c.p2; dr += c.dr; }
    return { p1, p2, dr };
  }, [scores]);
  const hasStats = totals.p1 + totals.p2 + totals.dr > 0;
  const dispX = nameX.trim() || "Spieler ✕";
  const dispO = nameO.trim() || "Spieler ○";

  const q = query.trim().toLowerCase();
  const filtered = q ? GAMES.filter((g) => (g.name + " " + g.tag).toLowerCase().includes(q)) : GAMES;

  return (
    <div className="min-h-screen w-full bg-neutral-950" onClickCapture={onAnyClick}>
      {visited.map((id) => {
        const g = GAMES.find((x) => x.id === id);
        const C = g.comp;
        const isAct = id === active;
        const sc = countsFor(id);
        return (
          <div key={id + ":" + (resetKeys[id] || 0)} ref={(el) => { if (isAct) wrapRef.current = el; }} style={{ display: isAct ? "block" : "none" }}>
            <div className="fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-3 bg-neutral-950/85 backdrop-blur border-b border-neutral-800">
              <div className="flex items-center min-w-0">
                <button onClick={() => setActive(null)}
                  className="text-xs tracking-[0.15em] text-neutral-300 hover:text-neutral-100 border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0">
                  ‹ MENÜ
                </button>
                <span className="ml-3 text-xs tracking-[0.2em] text-neutral-500 truncate hidden sm:inline">{g.name.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {sc.p1 + sc.p2 + sc.dr > 0 ? (
                  <span className="text-xs text-neutral-400 flex items-center gap-1.5 mr-1">
                    <span className="rounded-full inline-block" style={{ width: 9, height: 9, background: HX }} />
                    <span className="text-neutral-200">{sc.p1}</span>
                    <span className="text-neutral-600">:</span>
                    <span className="text-neutral-200">{sc.p2}</span>
                    <span className="rounded-full inline-block" style={{ width: 9, height: 9, background: HO }} />
                  </span>
                ) : null}
                <button onClick={() => setSound(!sound)} aria-label="Ton"
                  className={"text-xs tracking-[0.1em] border rounded-lg px-2.5 py-1.5 transition-colors " + (sound ? "text-neutral-300 border-neutral-700 hover:border-neutral-500" : "text-neutral-600 border-neutral-800 line-through")}>
                  TON
                </button>
                <button onClick={() => resetGame(id)} aria-label="Partie zurücksetzen"
                  className="text-sm text-neutral-300 hover:text-neutral-100 border border-neutral-700 hover:border-neutral-500 rounded-lg px-2.5 py-1 transition-colors">
                  ↻
                </button>
              </div>
            </div>
            <div style={{ paddingTop: 48 }}>
              <C />
            </div>
          </div>
        );
      })}

      {!active ? (
        <div className="min-h-screen w-full text-neutral-200 px-4 py-8 flex flex-col items-center select-none">
          <div className="w-full" style={{ maxWidth: 760 }}>
            <div className="flex items-end justify-between mb-1">
              <h1 className="text-2xl tracking-[0.25em] font-light text-neutral-100">HOTSEAT</h1>
              <div className="flex items-center gap-3">
                <button onClick={() => setSound(!sound)}
                  className={"text-[11px] tracking-[0.1em] border rounded-lg px-2.5 py-1 transition-colors " + (sound ? "text-neutral-400 border-neutral-700 hover:border-neutral-500" : "text-neutral-600 border-neutral-800 line-through")}>
                  TON
                </button>
                <span className="text-[11px] text-neutral-600 tracking-wide">21 Spiele · 2 Spieler · 1 Gerät</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500 mb-5 tracking-wide">
              Gegeneinander am selben Bildschirm — oder gegen den Bot. <span style={{ color: HX }}>✕</span> beginnt.
            </p>

            <div className="flex gap-2 mb-5">
              <input id="game-search" name="game-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen…"
                className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 focus:border-neutral-600 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none transition-colors" />
              <button onClick={randomGame}
                className="text-xs tracking-[0.12em] text-neutral-300 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-3 py-2 transition-colors flex-shrink-0">
                ZUFALL
              </button>
              <button onClick={flipCoin}
                className="text-xs tracking-[0.12em] text-neutral-300 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-600 rounded-lg px-3 py-2 transition-colors flex items-center gap-2 flex-shrink-0">
                MÜNZWURF
                {coin === "spin" ? (<span className="w-3 h-3 rounded-full bg-neutral-500 animate-pulse" />)
                  : coin ? (<span className="w-3 h-3 rounded-full" style={{ background: coin === "X" ? HX : HO }} />) : null}
              </button>
            </div>

            <div className="mb-7 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] tracking-[0.25em] text-neutral-600">SESSION</span>
                {hasStats ? (
                  <button onClick={() => setScores({})} className="text-[10px] tracking-[0.15em] text-neutral-600 hover:text-neutral-300 transition-colors">ZURÜCKSETZEN</button>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: HX }} />
                <input id="player-x" name="player-x" value={nameX} onChange={(e) => setNameX(e.target.value)} placeholder="Spieler ✕"
                  className="w-0 flex-1 bg-neutral-950 border border-neutral-800 focus:border-neutral-600 rounded-md px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none transition-colors" />
                <span className="text-lg text-neutral-100 tabular-nums px-1">{totals.p1}<span className="text-neutral-600 mx-1.5">:</span>{totals.p2}</span>
                <input id="player-o" name="player-o" value={nameO} onChange={(e) => setNameO(e.target.value)} placeholder="Spieler ○"
                  className="w-0 flex-1 bg-neutral-950 border border-neutral-800 focus:border-neutral-600 rounded-md px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none transition-colors text-right" />
                <span className="rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: HO }} />
              </div>
              {hasStats ? (
                <div className="space-y-1">
                  {GAMES.filter((g) => scores[g.id]).map((g) => {
                    const c = countsFor(g.id);
                    return (
                      <div key={g.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500">{g.name}</span>
                        <span className="text-neutral-300 tabular-nums">{c.p1} : {c.p2}{c.dr ? <span className="text-neutral-600"> · {c.dr} Remis</span> : null}</span>
                      </div>
                    );
                  })}
                  {totals.dr ? <div className="text-[10px] text-neutral-600 pt-1">{totals.dr} Remis gesamt</div> : null}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-600">Siege werden automatisch gezählt — in jedem Spiel, für {dispX} und {dispO}.</p>
              )}
            </div>

            {CATS.map((cat) => {
              const list = filtered.filter((g) => g.cat === cat);
              if (!list.length) return null;
              return (
                <div key={cat} className="mb-7">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="rounded-full" style={{ width: 6, height: 6, background: CAT_COL[cat] }} />
                    <span className="text-[10px] tracking-[0.25em] text-neutral-600">{cat}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {list.map((g) => (
                      <button key={g.id} onClick={() => open(g.id)}
                        className="group rounded-xl border border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800/60 active:scale-[0.98] p-4 text-left transition-all">
                        <div className="flex items-start justify-between mb-2.5">
                          <span className="text-neutral-500 group-hover:text-neutral-200 transition-colors">{ICONS[g.id]}</span>
                          {visited.includes(g.id) ? (
                            <span className="text-[9px] tracking-[0.15em] rounded px-1.5 py-0.5 border" style={{ color: CAT_COL[g.cat], borderColor: CAT_COL[g.cat] + "55" }}>LÄUFT</span>
                          ) : null}
                        </div>
                        <div className="text-sm text-neutral-100 tracking-wide leading-tight">{g.name}</div>
                        <div className="text-[11px] text-neutral-500 mt-1 leading-snug">{g.tag}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {q && !filtered.length ? (<p className="text-xs text-neutral-600 tracking-wide">Nichts gefunden.</p>) : null}

            <p className="text-[10px] text-neutral-700 tracking-wide mt-2">
              Partien bleiben beim Wechsel ins Menü erhalten — „↻" oben setzt sie zurück. Jedes Spiel hat einen Computergegner: Schalter MENSCH/BOT direkt im Spiel. Regeln unter dem „i" oben rechts.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
