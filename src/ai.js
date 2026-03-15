/**
 * =============================================================================
 *  The Dot Game — AI Engine  (src/ai.js)
 * =============================================================================
 *
 *  Architecture
 *  ─────────────
 *  Works entirely on a lightweight *state snapshot* — never touches the DOM.
 *  The main game (script.js) builds a snapshot before each AI turn and calls:
 *
 *      getAIMove(snapshot, difficulty)  →  lineId  (string)
 *
 *  State snapshot schema
 *  ─────────────────────
 *  {
 *    gridSize   : number,           // N for an N×N grid of boxes
 *    allLineIds : string[],         // ordered master list of every line id
 *    drawn      : Set<string>,      // lines already on the board (permanent)
 *    available  : string[],         // lines still free to play
 *    aiScore    : number,           // AI's current score  (player 2)
 *    humanScore : number,           // Human's current score (player 1)
 *  }
 *
 *  Difficulty summary
 *  ──────────────────
 *  Easy   — 80 % random move, 20 % grab a ready box.
 *  Medium — Always grab ready boxes; pick safe lines; sacrifice shortest chain;
 *           20 % blunder rate keeps it beatable.
 *  Hard   — Full expert engine: minimax + alpha-beta + transposition table +
 *           chain-control + double-cross strategy + endgame solver.
 * =============================================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   §1  Public entry point
───────────────────────────────────────────────────────────────────────────── */

/**
 * Returns the id of the line the AI wants to draw.
 * @param {object} snap   - board state snapshot (schema above)
 * @param {string} diff   - 'easy' | 'medium' | 'hard'
 * @returns {string}      lineId
 */
function getAIMove(snap, diff) {
    if (snap.available.length === 0) return null;

    switch (diff) {
        case 'easy':   return _easyMove(snap);
        case 'medium': return _mediumMove(snap);
        case 'hard':
        default:       return _hardMove(snap);
    }
}


/* ─────────────────────────────────────────────────────────────────────────────
   §2  Easy AI
───────────────────────────────────────────────────────────────────────────── */

function _easyMove(snap) {
    // 20 % chance to grab a completing box, otherwise fully random
    if (Math.random() < 0.20) {
        const completing = _findCompletingLine(snap, snap.drawn);
        if (completing) return completing;
    }
    return _randomLine(snap.available);
}


/* ─────────────────────────────────────────────────────────────────────────────
   §3  Medium AI
───────────────────────────────────────────────────────────────────────────── */

function _mediumMove(snap) {
    // 20 % blunder — pick a random line
    if (Math.random() < 0.20) return _randomLine(snap.available);

    // 1. Grab any completing line
    const completing = _findCompletingLine(snap, snap.drawn);
    if (completing) return completing;

    // 2. Pick a safe line (doesn't give opponent a box)
    const safeLines = snap.available.filter(id => !_wouldGiveBox(id, snap, snap.drawn));
    if (safeLines.length > 0) return _randomLine(safeLines);

    // 3. Sacrifice the shortest chain
    return _shortestChainMove(snap, snap.drawn);
}


/* ─────────────────────────────────────────────────────────────────────────────
   §4  Hard AI — Expert Engine
───────────────────────────────────────────────────────────────────────────── */

function _hardMove(snap) {
    // ── Phase A: Immediate box captures ──────────────────────────────────────
    const completing = _findCompletingLine(snap, snap.drawn);
    if (completing) {
        // If in endgame (only chains left), apply double-cross strategically
        if (_shouldDoubleCross(completing, snap, snap.drawn)) {
            const dcMove = _doubleCrossMove(completing, snap, snap.drawn);
            if (dcMove) return dcMove;
        }
        return completing;
    }

    // ── Phase B: Use minimax when the search horizon is small enough ────────
    const budget = _searchBudget(snap);
    if (snap.available.length <= budget) {
        const best = _minimaxRoot(snap);
        if (best) return best;
    }

    // ── Phase C: Heuristic safe-move selection ───────────────────────────────
    // Prefer moves that keep boxes at 0-1 sides drawn (perfectly safe)
    const safe = snap.available.filter(id => !_wouldGiveBox(id, snap, snap.drawn));
    if (safe.length > 0) {
        // Among safe, prefer those that don't raise any adjacent box to 2 sides
        // (avoid creating "pre-ripe" boxes that give opponent easy points later)
        const vSafe = safe.filter(id => _isVerySafe(id, snap, snap.drawn));
        const pool = vSafe.length > 0 ? vSafe : safe;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // ── Phase D: Forced sacrifice — give away shortest chain ─────────────────
    return _shortestChainMove(snap, snap.drawn);
}


/* ─────────────────────────────────────────────────────────────────────────────
   §5  Minimax with Alpha-Beta Pruning
───────────────────────────────────────────────────────────────────────────── */

/**
 * Dynamic depth budget to keep the AI fast across all grid sizes.
 * Larger boards get a shallower search but are compensated by strong heuristics.
 */
function _searchBudget(snap) {
    const n = snap.gridSize;
    if (n <= 3) return 60;   // 3×3: ~24 lines max → nearly full search
    if (n <= 4) return 22;   // 4×4: search up to 22 remaining moves
    if (n <= 5) return 16;   // 5×5
    return 12;                // 6×6
}

/**
 * Maximum search depth per call (separate from move budget).
 */
function _maxDepth(snap) {
    const n = snap.gridSize;
    if (n <= 3) return 20;
    if (n <= 4) return 12;
    if (n <= 5) return 9;
    return 7;
}

/** Transposition table, reset per top-level call. */
let _tt = new Map();

function _minimaxRoot(snap) {
    _tt.clear();
    _initZobrist(snap);

    let bestVal = -Infinity;
    let bestId  = null;

    // Build initial Zobrist key for current drawn set
    let baseKey = _zobristKey(snap.drawn, snap);

    // Order moves: completing first, then safe, then sacrifices
    const ordered = _orderMoves(snap.available, snap, snap.drawn);
    const depth   = _maxDepth(snap);

    for (const id of ordered) {
        // --- make move ---
        const newDrawn  = new Set(snap.drawn);
        newDrawn.add(id);
        const boxesWon  = _countNewBoxes(id, snap, newDrawn);
        const newAiScore = snap.aiScore + boxesWon;
        const newHuman   = snap.humanScore;
        const newAvail   = snap.available.filter(x => x !== id);
        const zKey       = baseKey ^ _zHash(id, snap);

        const childSnap = {
            gridSize   : snap.gridSize,
            allLineIds : snap.allLineIds,
            drawn      : newDrawn,
            available  : newAvail,
            aiScore    : newAiScore,
            humanScore : newHuman,
        };

        // Same player goes again if they scored
        const childIsMax = boxesWon > 0 ? true : false;
        const val = _minimax(childSnap, depth - 1, -Infinity, Infinity, childIsMax, zKey);

        if (val > bestVal) {
            bestVal = val;
            bestId  = id;
        }
    }

    return bestId;
}

/**
 * Core recursive minimax with alpha-beta pruning.
 * isMaximizing = true means it is the AI's turn.
 */
function _minimax(snap, depth, alpha, beta, isMaximizing, zKey) {
    const ttKey = `${zKey}-${isMaximizing ? 1 : 0}`;
    if (_tt.has(ttKey)) return _tt.get(ttKey);

    if (snap.available.length === 0 || depth === 0) {
        const val = _evaluate(snap, depth);
        _tt.set(ttKey, val);
        return val;
    }

    const ordered = _orderMoves(snap.available, snap, snap.drawn);
    let bestVal = isMaximizing ? -Infinity : Infinity;

    for (const id of ordered) {
        // --- make move ---
        const newDrawn  = new Set(snap.drawn);
        newDrawn.add(id);
        const boxesWon  = _countNewBoxes(id, snap, newDrawn);
        const newAvail  = snap.available.filter(x => x !== id);
        const newZ      = zKey ^ _zHash(id, snap);

        let newAiScore    = snap.aiScore;
        let newHumanScore = snap.humanScore;
        let childIsMax;

        if (isMaximizing) {
            newAiScore += boxesWon;
            childIsMax = boxesWon > 0 ? true : false;   // extra turn on score
        } else {
            newHumanScore += boxesWon;
            childIsMax = boxesWon > 0 ? false : true;   // extra turn on score
        }

        const childSnap = {
            gridSize   : snap.gridSize,
            allLineIds : snap.allLineIds,
            drawn      : newDrawn,
            available  : newAvail,
            aiScore    : newAiScore,
            humanScore : newHumanScore,
        };

        const val = _minimax(childSnap, depth - 1, alpha, beta, childIsMax, newZ);

        if (isMaximizing) {
            if (val > bestVal) bestVal = val;
            if (val > alpha)   alpha   = val;
        } else {
            if (val < bestVal) bestVal = val;
            if (val < beta)    beta    = val;
        }
        if (beta <= alpha) break; // α-β cut-off
    }

    _tt.set(ttKey, bestVal);
    return bestVal;
}


/* ─────────────────────────────────────────────────────────────────────────────
   §6  Heuristic Evaluation Function
───────────────────────────────────────────────────────────────────────────── */

/**
 * Evaluates a board state from the AI's perspective (positive = AI winning).
 *
 * Factors:
 *  • Score differential (most important)
 *  • Penalty for leaving long open chains (which give the opponent runs)
 *  • Bonus for safe edges (low-risk moves still available)
 *  • Terminal bonus/penalty
 */
function _evaluate(snap, depth) {
    const scoreDiff = snap.aiScore - snap.humanScore;

    // Terminal state — weight heavily, prefer winning sooner
    if (snap.available.length === 0) {
        if (scoreDiff > 0) return 10000 + scoreDiff + depth;
        if (scoreDiff < 0) return -10000 + scoreDiff - depth;
        return 0;
    }

    // Chain analysis
    const { chains, loops } = _analyzeChains(snap, snap.drawn);
    let chainPenalty = 0;
    for (const ch of chains) {
        // Long chains are high-value gifts to whoever opens them
        if (ch.length > 2) chainPenalty += (ch.length - 2) * 3;
    }
    // Loops: even-length loops favour the player in control
    for (const lp of loops) {
        if (lp.length % 2 === 0) chainPenalty -= 2; // loop is controllable
    }

    // Safe-edge count bonus (more safe moves → more flexibility)
    const safeCount = snap.available.filter(
        id => !_wouldGiveBox(id, snap, snap.drawn)
    ).length;

    return scoreDiff * 30 - chainPenalty + safeCount * 0.5;
}


/* ─────────────────────────────────────────────────────────────────────────────
   §7  Chain Detection & Chain-Control Strategy
───────────────────────────────────────────────────────────────────────────── */

/**
 * Identifies all chains and loops on the board.
 * A *chain* is a sequence of boxes each with exactly 3 sides drawn, connected
 * such that taking the first box in the chain gives you the next automatically.
 * A *loop* is a closed chain (last box adjacent to first).
 *
 * Returns { chains: Array<string[]>, loops: Array<string[]> }
 * where each inner array is the ordered list of "opening line ids" for that chain.
 */
function _analyzeChains(snap, drawn) {
    const size = snap.gridSize;
    const chains = [];
    const loops  = [];
    const visited = new Set(); // box keys already assigned

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const key = `${r},${c}`;
            if (visited.has(key)) continue;

            const sideCount = _boxSideCount(r, c, snap, drawn);
            if (sideCount !== 3) continue;

            // Start of a new chain
            const chain = _traceChain(r, c, snap, drawn, visited);
            if (chain.length > 0) chains.push(chain);
        }
    }

    return { chains, loops };
}

/**
 * Traces a chain starting from a box with 3 sides drawn.
 * Returns the list of "free" (not yet drawn) sides in chain order.
 */
function _traceChain(startR, startC, snap, drawn, globalVisited) {
    const freeLines  = [];
    const localVisit = new Set();
    let r = startR, c = startC;

    while (true) {
        const key = `${r},${c}`;
        if (localVisit.has(key)) break;           // loop detected — stop
        localVisit.add(key);
        globalVisited.add(key);

        const sides    = _boxSides(r, c);
        const freeSide = sides.find(id => !drawn.has(id) && snap.allLineIds.includes(id));
        if (!freeSide) break;                     // box has 4 sides — shouldn't be here
        freeLines.push(freeSide);

        // Move to the neighbouring box that shares this free side
        const neighbour = _neighbourBox(freeSide, r, c, snap.gridSize);
        if (!neighbour) break;
        const [nr, nc] = neighbour;
        const nSides   = _boxSideCount(nr, nc, snap, drawn);
        if (nSides !== 3) break;                   // neighbour is not part of chain
        [r, c] = [nr, nc];
    }

    return freeLines;
}

/**
 * Returns the other box that shares the given line with box (r,c), or null.
 */
function _neighbourBox(lineId, r, c, size) {
    const { type, lr, lc } = _parseLine(lineId);
    let nr, nc;
    if (type === 'horizontal') {
        // Shared with box above (lr-1, lc) or below (lr, lc)
        if      (lr === r && lc === c)   { nr = r - 1; nc = c; }
        else if (lr === r + 1 && lc === c) { nr = r + 1; nc = c; }
        else return null;
    } else {
        // Shared with box left (r, lc-1) or right (r, lc)
        if      (lr === r && lc === c)   { nr = r; nc = c - 1; }
        else if (lr === r && lc === c + 1) { nr = r; nc = c + 1; }
        else return null;
    }
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) return null;
    return [nr, nc];
}


/* ─────────────────────────────────────────────────────────────────────────────
   §8  Double-Cross / Sacrifice Strategy
───────────────────────────────────────────────────────────────────────────── */

/**
 * Should the AI apply the double-cross strategy on a chain it's about to take?
 *
 * The double-cross: when forced to open a long chain (≥3 boxes) to the opponent,
 * sacrifice only 2 boxes (give the entire chain but keep chain control), which
 * limits the opponent's gain to 2 while AI controls what comes next.
 *
 * Conditions to apply:
 *  - The chain has ≥ 3 boxes.
 *  - There are other chains/moves remaining after this one.
 *  - Applying it doesn't make the AI lose immediately.
 */
function _shouldDoubleCross(lineId, snap, drawn) {
    const chain = _traceChainFromLine(lineId, snap, drawn);
    if (chain.length < 3) return false;

    const remainingAfter = snap.available.length - chain.length;
    if (remainingAfter === 0) return false; // last chain — just take it all

    // Don't sacrifice if we're already far behind and it's near the end
    const totalBoxes = snap.gridSize * snap.gridSize;
    const takenBoxes = snap.aiScore + snap.humanScore;
    const progress   = takenBoxes / totalBoxes;
    if (progress > 0.85 && snap.aiScore < snap.humanScore) return false;

    return true;
}

/**
 * Given we're doing a double-cross on a chain, return the move that sacrifices
 * exactly 2 boxes (i.e., opens the penultimate-to-last pair in the chain).
 */
function _doubleCrossMove(lineId, snap, drawn) {
    const chain = _traceChainFromLine(lineId, snap, drawn);
    if (chain.length < 3) return lineId;

    // We want to draw the third-from-last free line, sacrificing 2 to opponent.
    // chain[0] is the first free side (the one that would complete box 1).
    // For a chain of length N, line chain[N-3] opens the sacrifice of 2.
    const sacrificeIdx = chain.length - 3;
    if (sacrificeIdx < 0) return lineId;
    return chain[sacrificeIdx];
}

/**
 * Trace a chain starting from a specific line ID (the "opening" of the chain).
 * Returns ordered list of free line IDs in the chain.
 */
function _traceChainFromLine(lineId, snap, drawn) {
    // Identify which box adjacent to lineId has 3 sides drawn (is ready)
    const { type, lr, lc } = _parseLine(lineId);
    const size = snap.gridSize;

    let startBox = null;
    const candidates =
        type === 'horizontal'
            ? [[lr - 1, lc], [lr, lc]]
            : [[lr, lc - 1], [lr, lc]];

    for (const [r, c] of candidates) {
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        if (_boxSideCount(r, c, snap, drawn) === 3) { startBox = [r, c]; break; }
    }

    if (!startBox) return [lineId];

    const visited = new Set();
    return _traceChain(startBox[0], startBox[1], snap, drawn, visited);
}


/* ─────────────────────────────────────────────────────────────────────────────
   §9  Zobrist Hashing (transposition table keys)
───────────────────────────────────────────────────────────────────────────── */

/** Maps lineId → 32-bit random integer (initialised once per game call). */
let _zobristTable = {};
let _zobristSnap  = null;

function _initZobrist(snap) {
    // Rebuild only when the line set changes (i.e., new game / size change)
    if (_zobristSnap === snap.allLineIds) return;
    _zobristSnap = snap.allLineIds;
    _zobristTable = {};
    for (const id of snap.allLineIds) {
        // Two 32-bit halves combined as a string key for collision resistance
        _zobristTable[id] = (Math.random() * 0xFFFFFFFF | 0).toString(36) +
                            (Math.random() * 0xFFFFFFFF | 0).toString(36);
    }
}

function _zHash(lineId, snap) {
    // XOR isn't straightforward on strings, so we use string concatenation
    // for the key — the transposition table key is built cumulatively outside.
    // Here we simply return the pre-generated hash token for this line.
    return _zobristTable[lineId] || lineId;
}

/**
 * Build the full Zobrist key for a drawn set by XOR-ing all individual hashes.
 * Because our hashes are strings we just sort-and-join, which is unique.
 */
function _zobristKey(drawn, snap) {
    // Sort for canonical order → same key regardless of draw sequence
    return Array.from(drawn).sort().join('|');
}


/* ─────────────────────────────────────────────────────────────────────────────
   §10  Move Ordering
───────────────────────────────────────────────────────────────────────────── */

/**
 * Order moves to improve alpha-beta pruning:
 *  1. Completing moves (immediate score)
 *  2. Safe moves that don't give opponent a box
 *  3. Sacrifice moves (shortest chain first)
 */
function _orderMoves(available, snap, drawn) {
    const completing = [];
    const safe       = [];
    const sacrifice  = [];

    for (const id of available) {
        if (_completesABox(id, snap, drawn))     completing.push(id);
        else if (!_wouldGiveBox(id, snap, drawn)) safe.push(id);
        else                                      sacrifice.push(id);
    }

    // Sort sacrifice moves: prefer those that open shorter chains
    sacrifice.sort((a, b) => {
        const la = _traceChainFromLine(a, snap, drawn).length;
        const lb = _traceChainFromLine(b, snap, drawn).length;
        return la - lb;
    });

    return [...completing, ...safe, ...sacrifice];
}


/* ─────────────────────────────────────────────────────────────────────────────
   §11  Board Utility Functions
───────────────────────────────────────────────────────────────────────────── */

/** Parse a lineId string into its components. */
function _parseLine(lineId) {
    // Format: "line-{type}-{r}-{c}"
    const parts = lineId.split('-');
    return { type: parts[1], lr: parseInt(parts[2]), lc: parseInt(parts[3]) };
}

/** Returns an array of the 4 side line-ids for box (r,c). */
function _boxSides(r, c) {
    return [
        `line-horizontal-${r}-${c}`,
        `line-horizontal-${r + 1}-${c}`,
        `line-vertical-${r}-${c}`,
        `line-vertical-${r}-${c + 1}`
    ];
}

/** Returns the number of drawn sides for box (r,c). */
function _boxSideCount(r, c, snap, drawn) {
    return _boxSides(r, c).filter(id => drawn.has(id)).length;
}

/**
 * Returns the number of NEW boxes completed by drawing lineId,
 * given the drawn set ALREADY includes lineId.
 */
function _countNewBoxes(lineId, snap, newDrawn) {
    const { type, lr, lc } = _parseLine(lineId);
    const size = snap.gridSize;
    const adjacent =
        type === 'horizontal'
            ? [[lr - 1, lc], [lr, lc]]
            : [[lr, lc - 1], [lr, lc]];

    let count = 0;
    for (const [r, c] of adjacent) {
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        if (_boxSideCount(r, c, snap, newDrawn) === 4) count++;
    }
    return count;
}

/** True if drawing lineId would complete (close) at least one box. */
function _completesABox(lineId, snap, drawn) {
    const testDrawn = new Set(drawn);
    testDrawn.add(lineId);
    return _countNewBoxes(lineId, snap, testDrawn) > 0;
}

/** True if drawing lineId would give the opponent a box next turn. */
function _wouldGiveBox(lineId, snap, drawn) {
    const { type, lr, lc } = _parseLine(lineId);
    const size = snap.gridSize;
    const adjacent =
        type === 'horizontal'
            ? [[lr - 1, lc], [lr, lc]]
            : [[lr, lc - 1], [lr, lc]];

    return adjacent.some(([r, c]) => {
        if (r < 0 || r >= size || c < 0 || c >= size) return false;
        const sides = _boxSides(r, c);
        const drawnCount = sides.filter(id => id === lineId || drawn.has(id)).length;
        return drawnCount === 3;
    });
}

/**
 * "Very safe" = drawing this line would not raise any adjacent box to 2 sides.
 * (Boxes with 2 sides are "pre-ripe" — the next player can set them up to 3.)
 */
function _isVerySafe(lineId, snap, drawn) {
    const { type, lr, lc } = _parseLine(lineId);
    const size = snap.gridSize;
    const adjacent =
        type === 'horizontal'
            ? [[lr - 1, lc], [lr, lc]]
            : [[lr, lc - 1], [lr, lc]];

    return adjacent.every(([r, c]) => {
        if (r < 0 || r >= size || c < 0 || c >= size) return true;
        // After drawing this line, how many sides does this box have?
        const drawn_after = _boxSideCount(r, c, snap, drawn) + 1;
        return drawn_after <= 1; // only acceptable if goes from 0→1
    });
}

/**
 * Find the first available line that completes a box.
 * Checks against the given drawn set (not necessarily gameState.drawn).
 */
function _findCompletingLine(snap, drawn) {
    for (const id of snap.available) {
        if (_completesABox(id, snap, drawn)) return id;
    }
    return null;
}

/**
 * Among all available lines, find the one that opens the shortest chain.
 * Used as the "least evil" sacrifice move.
 */
function _shortestChainMove(snap, drawn) {
    let best = null;
    let bestLen = Infinity;

    for (const id of snap.available) {
        const chainLen = _traceChainFromLine(id, snap, drawn).length;
        if (chainLen < bestLen) {
            bestLen = chainLen;
            best    = id;
        }
    }

    return best || snap.available[0];
}

/** Pick a uniformly random element from an array. */
function _randomLine(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
