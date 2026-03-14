// Game State
let gameState = {
    mode: '1v1',       // '1v1' or 'pvc'
    difficulty: 'easy', // 'easy' or 'medium'
    player1: { name: 'Player 1', score: 0 },
    player2: { name: 'Player 2', score: 0 },
    currentTurn: 1,    // 1 or 2
    startingPlayer: 1, // 1 or 2 (for PVC mode)
    gridSize: 3,       // Default 3x3 grid
    totalBoxes: 16,
    filledBoxes: 0,
    availableLines: [],
    drawnLines: new Set(),
    gameOver: false,
    isProcessing: false
};

// DOM Elements
const screens = {
    setup: document.getElementById('setup-menu'),
    game: document.getElementById('game-screen'),
    results: document.getElementById('results-screen'),
    quitModal: document.getElementById('quit-modal')
};

const startBtn = document.getElementById('start-btn');
const pvcOptions = document.getElementById('pvc-options');
const gameBoard = document.getElementById('game-board');

// Initialize
function init() {
    setupEventListeners();
    initSliders();
}

function setupEventListeners() {
    startBtn.addEventListener('click', startGame);
    document.getElementById('quit-btn').addEventListener('click', () => { vibrate(20); screens.quitModal.classList.remove('hidden'); });
    document.getElementById('confirm-quit-btn').addEventListener('click', () => { vibrate(20); screens.quitModal.classList.add('hidden'); quitGame(); });
    document.getElementById('cancel-quit-btn').addEventListener('click', () => { vibrate(20); screens.quitModal.classList.add('hidden'); });
    document.getElementById('rematch-btn').addEventListener('click', () => { vibrate(20); rematch(); });
    document.getElementById('new-game-btn').addEventListener('click', () => { vibrate(20); quitGame(); });
}

function initSliders() {
    document.querySelectorAll('.toggle-group').forEach(group => {
        const slider = document.createElement('div');
        slider.className = 'slider';
        group.insertBefore(slider, group.firstChild);
        
        // Initial setup
        const activeBtn = group.querySelector('.active');
        if (activeBtn) setTimeout(() => updateSlider(activeBtn), 50);
    });

    window.addEventListener('resize', () => {
        document.querySelectorAll('.toggle-group .active').forEach(activeBtn => updateSlider(activeBtn));
    });
}

function updateSlider(btn) {
    if (!btn) return;
    const group = btn.parentElement;
    const slider = group.querySelector('.slider');
    if (slider) {
        slider.style.width = `${btn.offsetWidth}px`;
        slider.style.height = `${btn.offsetHeight}px`;
        slider.style.left = `${btn.offsetLeft}px`;
        slider.style.top = `${btn.offsetTop}px`;
    }
}

// UI Handlers
function vibrate(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

function setSize(size) {
    vibrate(20);
    gameState.gridSize = size;
    document.querySelectorAll('#size-3, #size-4, #size-5, #size-6').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`size-${size}`);
    btn.classList.add('active');
    updateSlider(btn);
}

function setMode(mode) {
    vibrate(20);
    gameState.mode = mode;
    document.querySelectorAll('#mode-1v1, #mode-pvc').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`mode-${mode}`);
    btn.classList.add('active');
    updateSlider(btn);

    if (mode === 'pvc') {
        pvcOptions.classList.remove('hidden');
        gameState.player2.name = 'Computer';
        // Recalculate slider for all active buttons in pvcOptions since they were hidden on load
        setTimeout(() => {
            pvcOptions.querySelectorAll('.active').forEach(activeBtn => updateSlider(activeBtn));
        }, 10);
    } else {
        pvcOptions.classList.add('hidden');
        gameState.player2.name = 'Player 2';
    }
    updateScoreboardNames();
}

function setDiff(diff) {
    vibrate(20);
    gameState.difficulty = diff;
    document.querySelectorAll('#diff-easy, #diff-medium, #diff-hard').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`diff-${diff}`);
    btn.classList.add('active');
    updateSlider(btn);
}

function setStartingPlayer(player) {
    vibrate(20);
    gameState.startingPlayer = player;
    document.querySelectorAll('#start-p1, #start-p2').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`start-p${player}`);
    btn.classList.add('active');
    updateSlider(btn);
}

function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

function quitGame() {
    // Full reset when going back to setup
    gameState.player1.score = 0;
    gameState.player2.score = 0;
    gameState.filledBoxes = 0;
    gameState.currentTurn = 1;
    gameState.isProcessing = false; // Reset lock
    showScreen('setup');
    updateScoreboard();
}

// Game Logic
function startGame() {
    gameState.totalBoxes = gameState.gridSize * gameState.gridSize;
    gameState.filledBoxes = 0;
    gameState.player1.score = 0;
    gameState.player2.score = 0;
    gameState.currentTurn = gameState.mode === 'pvc' ? gameState.startingPlayer : 1;
    gameState.gameOver = false;
    gameState.isProcessing = false; // Safety reset
    gameState.availableLines = [];
    gameState.allLineIds = [];
    gameState.totalLines = 0;

    vibrate(30);

    // Show game screen FIRST so board-container has a real clientWidth
    showScreen('game');
    updateScoreboard();
    updateScoreboardNames();

    // Build board after layout paint so clientWidth is accurate
    requestAnimationFrame(() => {
        createBoard();
        gameState.drawnLines.clear();
        setProcessing(false);
        // Trigger AI if pvc mode starts with AI turn
        if (gameState.mode === 'pvc' && gameState.currentTurn === 2) {
            setTimeout(computerMove, 600);
        }
    });
}

function getSpacing() {
    const container = document.getElementById('board-container');
    // Use actual rendered width; fallback to 300 if still 0
    const availableWidth = container.clientWidth || 300;
    // Subtract some padding and compute per-cell spacing
    const spacing = Math.floor((availableWidth - 24) / gameState.gridSize);
    // Clamp between 30px (tiny phone large grid) and 90px (desktop)
    return Math.max(35, Math.min(spacing, 90));
}

function createBoard() {
    gameBoard.innerHTML = '';
    const size = gameState.gridSize;
    const dotSize = 12;
    const spacing = getSpacing();

    const boardPx = size * spacing + dotSize;
    gameBoard.style.width  = `${boardPx}px`;
    gameBoard.style.height = `${boardPx}px`;

    // Dynamic Scoreboard Sizing
    const scoreboard = document.querySelector('.scoreboard');
    if (scoreboard) {
        scoreboard.style.width = `${boardPx}px`;
    }

    // Create dots
    for (let r = 0; r <= size; r++) {
        for (let c = 0; c <= size; c++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.left = `${c * spacing + dotSize / 2}px`;
            dot.style.top  = `${r * spacing + dotSize / 2}px`;
            gameBoard.appendChild(dot);
        }
    }

    // Horizontal Lines
    for (let r = 0; r <= size; r++) {
        for (let c = 0; c < size; c++) {
            createLine(r, c, 'horizontal', spacing, dotSize);
        }
    }

    // Vertical Lines
    for (let r = 0; r < size; r++) {
        for (let c = 0; c <= size; c++) {
            createLine(r, c, 'vertical', spacing, dotSize);
        }
    }

    // Boxes (numbered 1–9)
    let boxNumber = 1;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const box = document.createElement('div');
            box.className = 'box';
            box.id = `box-${r}-${c}`;
            box.dataset.number = boxNumber++;
            box.style.left   = `${c * spacing + dotSize / 2 + 6}px`;
            box.style.top    = `${r * spacing + dotSize / 2 + 6}px`;
            box.style.width  = `${spacing - 12}px`;
            box.style.height = `${spacing - 12}px`;

            const numEl = document.createElement('span');
            numEl.className = 'box-word';
            // Scale font size based on spacing so large grids fit inside boxes
            numEl.style.fontSize = `${Math.min(0.9, spacing / 60)}rem`;
            box.appendChild(numEl);

            gameBoard.appendChild(box);
        }
    }
}

function createLine(r, c, type, spacing, dotSize) {
    const line = document.createElement('div');
    line.className = `line ${type}`;
    line.dataset.r = r;
    line.dataset.c = c;
    line.id = `line-${type}-${r}-${c}`;

    if (type === 'horizontal') {
        line.style.width  = `${spacing - 12}px`;
        line.style.left   = `${c * spacing + dotSize / 2 + 6}px`;
        line.style.top    = `${r * spacing + dotSize / 2}px`;
    } else {
        line.style.height = `${spacing - 12}px`;
        line.style.left   = `${c * spacing + dotSize / 2}px`;
        line.style.top    = `${r * spacing + dotSize / 2 + 6}px`;
    }

    line.addEventListener('click', () => handleLineClick(line, true));
    // Touch support for mobile
    line.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleLineClick(line, true);
    }, { passive: false });

    gameBoard.appendChild(line);
    gameState.availableLines.push(line.id);
    gameState.allLineIds.push(line.id);
    gameState.totalLines++;
}

function setProcessing(val) {
    gameState.isProcessing = val;
    const container = document.getElementById('board-container');
    if (container) {
        container.classList.toggle('disabled-board', val || (gameState.mode === 'pvc' && gameState.currentTurn === 2));
    }
}

function handleLineClick(line, isManual = false) {
    if (gameState.gameOver || gameState.drawnLines.has(line.id)) return;
    
    // Guard: Prevent manual moves during AI turn or while board is explicitly locked
    if (isManual && (gameState.isProcessing || (gameState.mode === 'pvc' && gameState.currentTurn === 2))) return;

    if (isManual) {
        // Coarse lock during the processing of a single move click
        gameState.isProcessing = true;
    }

    try {
        vibrate(15);
        drawLine(line);
        const boxesCompleted = checkBoxes(line);

        if (boxesCompleted > 0) {
            updateScore(boxesCompleted);
            if (checkGameOver()) return;

            // Bonus turn — stay as current player
            if (gameState.mode === 'pvc' && gameState.currentTurn === 2) {
                // Keep board locked during AI thinking gap
                setProcessing(true);
                setTimeout(computerMove, 600);
            }
        } else {
            switchTurn();
        }
    } finally {
        if (isManual) {
            gameState.isProcessing = false;
        }
    }
}

function drawLine(line) {
    line.classList.add('drawn', `drawn-p${gameState.currentTurn}`);
    gameState.drawnLines.add(line.id);
    gameState.availableLines = gameState.availableLines.filter(id => id !== line.id);
}

function checkBoxes(line) {
    const r = parseInt(line.dataset.r);
    const c = parseInt(line.dataset.c);
    const isHorizontal = line.classList.contains('horizontal');
    let completed = 0;

    if (isHorizontal) {
        if (r > 0 && isBoxComplete(r - 1, c)) { fillBox(r - 1, c); completed++; }
        if (r < gameState.gridSize && isBoxComplete(r, c))  { fillBox(r, c);     completed++; }
    } else {
        if (c > 0 && isBoxComplete(r, c - 1)) { fillBox(r, c - 1); completed++; }
        if (c < gameState.gridSize && isBoxComplete(r, c))  { fillBox(r, c);     completed++; }
    }
    return completed;
}

function isBoxComplete(r, c) {
    const top    = document.getElementById(`line-horizontal-${r}-${c}`);
    const bottom = document.getElementById(`line-horizontal-${r + 1}-${c}`);
    const left   = document.getElementById(`line-vertical-${r}-${c}`);
    const right  = document.getElementById(`line-vertical-${r}-${c + 1}`);

    // Guard: all four elements must exist
    if (!top || !bottom || !left || !right) return false;

    return top.classList.contains('drawn') &&
           bottom.classList.contains('drawn') &&
           left.classList.contains('drawn') &&
           right.classList.contains('drawn');
}

function fillBox(r, c) {
    const box = document.getElementById(`box-${r}-${c}`);
    if (!box || box.classList.contains('filled')) return;

    box.classList.add('filled', `filled-p${gameState.currentTurn}`);
    
    // Set initials: P1, P2, or AI
    let text = 'P1';
    if (gameState.currentTurn === 2) {
        text = gameState.mode === 'pvc' ? 'AI' : 'P2';
    }
    box.querySelector('.box-word').textContent = text;
    
    gameState.filledBoxes++;
    vibrate([30, 30, 30]);
}

function updateScore(points) {
    gameState[`player${gameState.currentTurn}`].score += points;
    updateScoreboard();
}

function switchTurn() {
    gameState.currentTurn = gameState.currentTurn === 1 ? 2 : 1;
    updateScoreboard();

    if (gameState.mode === 'pvc' && gameState.currentTurn === 2) {
        // UI lock for AI thinking
        setProcessing(true);
        setTimeout(computerMove, 600);
    } else if (gameState.mode === 'pvc' && gameState.currentTurn === 1) {
        // Ensure UI is unlocked for human turn
        setProcessing(false);
    }
}

function updateScoreboard() {
    document.getElementById('p1-score').querySelector('.player-points').textContent = gameState.player1.score;
    document.getElementById('p2-score').querySelector('.player-points').textContent = gameState.player2.score;

    document.getElementById('p1-score').classList.toggle('active', gameState.currentTurn === 1);
    document.getElementById('p2-score').classList.toggle('active', gameState.currentTurn === 2);
}

function updateScoreboardNames() {
    document.getElementById('p1-score').querySelector('.player-name').textContent = gameState.player1.name;
    document.getElementById('p2-score').querySelector('.player-name').textContent = gameState.player2.name;
}

// AI Logic
function computerMove() {
    if (gameState.gameOver || gameState.currentTurn !== 2) {
        setProcessing(false);
        return;
    }
    if (gameState.availableLines.length === 0) {
        setProcessing(false);
        return;
    }

    let targetLineId = null;

    if (gameState.difficulty === 'easy') {
        // Easy: Randomly pick completing lines (50%) or any line
        targetLineId = findBoxCompletingLine();
        if (!targetLineId || Math.random() > 0.5) {
            const randomIndex = Math.floor(Math.random() * gameState.availableLines.length);
            targetLineId = gameState.availableLines[randomIndex];
        }
    } else {
        // Medium & Hard use strategic logic
        targetLineId = getBestMove();
        
        // Medium: 30% chance to make a random move instead of the best one
        if (gameState.difficulty === 'medium' && Math.random() < 0.3) {
            const randomIndex = Math.floor(Math.random() * gameState.availableLines.length);
            targetLineId = gameState.availableLines[randomIndex];
        }
    }

    const line = document.getElementById(targetLineId);
    if (line) {
        // If AI made a move, processing will be handled by handleLineClick
        handleLineClick(line, false);
    } else {
        // Fallback safety
        setProcessing(false);
    }
}

function getBestMove() {
    // 0. Use Minimax for perfect play if the search space is small enough
    if (gameState.availableLines.length <= 10 || (gameState.gridSize === 3 && gameState.availableLines.length <= 15)) {
        transpositionTable.clear();
        let bestVal = -Infinity;
        let bestMove = null;
        
        const simDrawn = new Set();
        // Depth-limited search for performance
        const searchDepth = gameState.availableLines.length > 12 ? 6 : 8;

        for (let lineId of gameState.availableLines) {
            const oldTurn = gameState.currentTurn;
            const won = getNewlyCompletedBoxesSim(lineId, simDrawn);
            
            simDrawn.add(lineId);
            gameState[`player${gameState.currentTurn}`].score += won;
            
            let val;
            if (won > 0) {
                // Same player gets another turn
                val = minimaxSearch(searchDepth, -Infinity, Infinity, true, simDrawn);
            } else {
                gameState.currentTurn = oldTurn === 1 ? 2 : 1;
                val = minimaxSearch(searchDepth, -Infinity, Infinity, false, simDrawn);
            }
            
            // Undo
            simDrawn.delete(lineId);
            gameState[`player${gameState.currentTurn}`].score -= won;
            gameState.currentTurn = oldTurn;
            
            if (val > bestVal) {
                bestVal = val;
                bestMove = lineId;
            }
        }
        if (bestMove) return bestMove;
    }

    // 1. Priority: Take ALL completing lines
    const completingLine = findBoxCompletingLine();
    if (completingLine) {
        // If we're on Hard, check if we should "Double-Cross"
        if (gameState.difficulty === 'hard') {
            const chain = getChain(completingLine);
            if (chain.length >= 3 && !isFinalChain(chain)) {
                if (shouldDoubleCross(chain)) {
                    return getDoubleCrossMove(chain);
                }
            }
        }
        return completingLine;
    }

    // 2. Priority: Take a "Safe" line (doesn't give a box)
    const safeLines = gameState.availableLines.filter(id => !wouldGiveBox(id));
    if (safeLines.length > 0) {
        // Strategic Improvement: Prefer "Quiet" safe moves
        // A quiet move is one that doesn't create a box with 2 sides already drawn
        const quietLines = safeLines.filter(id => {
            const boxes = getBoxesForLine(id);
            return boxes.every(([br, bc]) => {
                const sides = getBoxSides(br, bc);
                const drawnCount = sides.filter(sid => {
                    const s = document.getElementById(sid);
                    return s && (s.classList.contains('drawn') || s.id === id);
                }).length;
                return drawnCount <= 2; // If drawing this makes 3, it's not quiet (it would give a box next turn)
                // Actually, drawnCount here includes the line itself. 
                // So drawnCount <= 2 means 1 or 2 sides will be drawn.
            });
        });

        const targetPool = (quietLines.length > 0 && gameState.difficulty === 'hard') ? quietLines : safeLines;
        return targetPool[Math.floor(Math.random() * targetPool.length)];
    }

    // 3. Priority: If forced to give a box, give the SHORTEST chain
    return getShortestChainMove();
}

function getBoxesForLine(lineId) {
    const parts = lineId.split('-');
    const type = parts[1];
    const r = parseInt(parts[2]);
    const c = parseInt(parts[3]);
    return (type === 'horizontal') ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
}

function findBoxCompletingLine() {
    for (let id of gameState.availableLines) {
        if (completesABox(id)) return id;
    }
    return null;
}

function completesABox(lineId) {
    const el = document.getElementById(lineId);
    const r = parseInt(el.dataset.r);
    const c = parseInt(el.dataset.c);
    const isH = el.classList.contains('horizontal');

    const boxes = [];
    if (isH) {
        if (r > 0) boxes.push([r - 1, c]);
        if (r < gameState.gridSize) boxes.push([r, c]);
    } else {
        if (c > 0) boxes.push([r, c - 1]);
        if (c < gameState.gridSize) boxes.push([r, c]);
    }

    return boxes.some(([br, bc]) => {
        const sides = getBoxSides(br, bc);
        const drawnCount = sides.filter(sid => {
            const s = document.getElementById(sid);
            return s && (s.classList.contains('drawn') || s.id === lineId);
        }).length;
        return drawnCount === 4;
    });
}

function getBoxSides(r, c) {
    return [
        `line-horizontal-${r}-${c}`,
        `line-horizontal-${r + 1}-${c}`,
        `line-vertical-${r}-${c}`,
        `line-vertical-${r}-${c + 1}`
    ];
}

function wouldGiveBox(lineId) {
    const el = document.getElementById(lineId);
    const r = parseInt(el.dataset.r);
    const c = parseInt(el.dataset.c);
    const isH = el.classList.contains('horizontal');

    const boxes = [];
    if (isH) {
        if (r > 0) boxes.push([r - 1, c]);
        if (r < gameState.gridSize) boxes.push([r, c]);
    } else {
        if (c > 0) boxes.push([r, c - 1]);
        if (c < gameState.gridSize) boxes.push([r, c]);
    }

    return boxes.some(([br, bc]) => {
        const sides = getBoxSides(br, bc);
        const drawnCount = sides.filter(sid => {
            const s = document.getElementById(sid);
            return s && (s.classList.contains('drawn') || s.id === lineId);
        }).length;
        return drawnCount === 3;
    });
}

// Chain Analysis for Advanced Play
function getChain(lineId) {
    // Simplistic chain detection: sequence of boxes that can be taken consecutively
    const chainLines = [];
    const simulatedDrawn = new Set();
    
    let currentLine = lineId;
    while (currentLine) {
        chainLines.push(currentLine);
        simulatedDrawn.add(currentLine);
        
        // After "drawing" this line, what other lines complete boxes?
        currentLine = null;
        for (let id of gameState.availableLines) {
            if (simulatedDrawn.has(id)) continue;
            if (completesABoxWithSim(id, simulatedDrawn)) {
                currentLine = id;
                break;
            }
        }
    }
    return chainLines;
}

function completesABoxWithSim(lineId, simDrawn) {
    const el = document.getElementById(lineId);
    const r = parseInt(el.dataset.r);
    const c = parseInt(el.dataset.c);
    const isH = el.classList.contains('horizontal');
    const boxes = isH ? [[r-1,c],[r,c]] : [[r,c-1],[r,c]];

    return boxes.some(([br, bc]) => {
        if (br < 0 || br >= gameState.gridSize || bc < 0 || bc >= gameState.gridSize) return false;
        const sides = getBoxSides(br, bc);
        const drawnCount = sides.filter(sid => {
            const s = document.getElementById(sid);
            return s && (s.classList.contains('drawn') || simDrawn.has(sid) || sid === lineId);
        }).length;
        return drawnCount === 4;
    });
}

function getShortestChainMove() {
    const forcedMoves = gameState.availableLines;
    const chainMap = forcedMoves.map(id => ({ id, length: getChain(id).length }));
    chainMap.sort((a, b) => a.length - b.length);
    return chainMap[0].id;
}

function isFinalChain(chain) {
    const remainingAfterChain = gameState.availableLines.length - chain.length;
    return remainingAfterChain === 0;
}

function shouldDoubleCross(chain) {
    if (chain.length < 3) return false;
    
    // Expert Move: If taking a long chain, leave 2 boxes for the opponent
    // This forces THEM to open the next chain, giving us control.
    // Recommended when there are other chains (or just one other chain) left.
    
    const remainingLines = gameState.availableLines.filter(id => !chain.includes(id));
    // If no lines left after this chain, don't double cross, just win.
    if (remainingLines.length === 0) return false;

    // Count how many "chains" are left. If multiple chains, double cross is good.
    // For simplicity: if all remaining moves are "forced" (give a box), double cross.
    const safeRemaining = remainingLines.filter(id => !wouldGiveBox(id));
    if (safeRemaining.length > 0) return false;
    
    return true;
}

function getDoubleCrossMove(chain) {
    // If we have >= 3 boxes in a chain, we take all but the last 2.
    // The current 'completingLine' is the first box of the chain.
    // If chain.length > 2, we just take the first box.
    // If chain.length == 2, THIS is where we double-cross by drawing a non-completing line
    // that still sacrifices the 2 boxes.
    if (chain.length > 2) {
        return chain[0];
    }
    
    // Double-cross move for 2-box chain:
    // Draw the line that separates the two boxes (if not drawn) OR a line that 
    // makes them a single takeable block of 2 once the opponent moves.
    // Simplest: just pick a random line that doesn't complete a box but gives these 2 away.
    const sacrificingLine = chain.find(id => !completesABox(id));
    return sacrificingLine || chain[0];
}

// Minimax for Perfect Play on Small Grids
const transpositionTable = new Map();

function minimaxSearch(depth, alpha, beta, isMaximizing, simDrawn) {
    // Optimization: Use a bitmask or unique string for state tracking
    const stateKey = getBitmaskKey(simDrawn);
    const fullKey = `${stateKey}-${isMaximizing}-${gameState.currentTurn}`;

    if (transpositionTable.has(fullKey)) return transpositionTable.get(fullKey);

    const totalDrawnCount = simDrawn.size + (gameState.totalLines - gameState.availableLines.length);
    if (totalDrawnCount === gameState.totalLines || depth === 0) {
        return (gameState.player2.score - gameState.player1.score) * 100;
    }

    let bestVal = isMaximizing ? -Infinity : Infinity;
    // CRITICAL FIX: Only consider lines that are truly available
    const available = gameState.availableLines.filter(id => !simDrawn.has(id));

    for (let lineId of available) {
        const oldTurn = gameState.currentTurn;
        const boxesWon = getNewlyCompletedBoxesSim(lineId, simDrawn);
        
        simDrawn.add(lineId);
        gameState[`player${gameState.currentTurn}`].score += boxesWon;
        
        let val;
        if (boxesWon > 0) {
            val = minimaxSearch(depth - 1, alpha, beta, isMaximizing, simDrawn);
        } else {
            gameState.currentTurn = oldTurn === 1 ? 2 : 1;
            val = minimaxSearch(depth - 1, alpha, beta, !isMaximizing, simDrawn);
        }

        // Undo
        simDrawn.delete(lineId);
        gameState[`player${gameState.currentTurn}`].score -= boxesWon;
        gameState.currentTurn = oldTurn;

        if (isMaximizing) {
            bestVal = Math.max(bestVal, val);
            alpha = Math.max(alpha, val);
        } else {
            bestVal = Math.min(bestVal, val);
            beta = Math.min(beta, val);
        }
        if (beta <= alpha) break;
    }

    transpositionTable.set(fullKey, bestVal);
    return bestVal;
}

function getNewlyCompletedBoxesSim(lineId, simDrawn) {
    const parts = lineId.split('-');
    const type = parts[1];
    const r = parseInt(parts[2]);
    const c = parseInt(parts[3]);
    const boxes = (type === 'horizontal') ? [[r-1,c],[r,c]] : [[r,c-1],[r,c]];

    let count = 0;
    for (let [br, bc] of boxes) {
        if (br >= 0 && br < gameState.gridSize && bc >= 0 && bc < gameState.gridSize) {
            const sides = getBoxSides(br, bc);
            if (sides.every(sid => sid === lineId || simDrawn.has(sid) || gameState.drawnLines.has(sid))) {
                count++;
            }
        }
    }
    return count;
}

function getBitmaskKey(simDrawn) {
    // Since we have up to ~84 lines (6x6), we can't use a single integer bitmask.
    // Instead, we'll use a string of 0/1 for all line indices to ensure perfect tracking.
    let key = "";
    for (let i = 0; i < gameState.allLineIds.length; i++) {
        const id = gameState.allLineIds[i];
        if (gameState.drawnLines.has(id) || simDrawn.has(id)) {
            key += "1";
        } else {
            key += "0";
        }
    }
    return key;
}


// Win State
function checkGameOver() {
    if (gameState.filledBoxes >= gameState.totalBoxes) {
        gameState.gameOver = true;
        setTimeout(showResults, 1000);
        return true;
    }
    return false;
}

function showResults() {
    const winnerText = document.getElementById('winner-announcement');

    document.getElementById('final-p1-score').textContent = gameState.player1.score;
    document.getElementById('final-p2-score').textContent = gameState.player2.score;

    const p1NameEl = document.querySelector('.final-scores .p1 .final-player-name');
    const p2NameEl = document.querySelector('.final-scores .p2 .final-player-name');
    if (p1NameEl) p1NameEl.textContent = gameState.player1.name;
    if (p2NameEl) p2NameEl.textContent = gameState.player2.name;

    if (gameState.player1.score > gameState.player2.score) {
        winnerText.textContent = `${gameState.player1.name} Wins!`;
        winnerText.style.color = 'var(--accent-p1)';
        vibrate([50, 50, 100]);
    } else if (gameState.player2.score > gameState.player1.score) {
        winnerText.textContent = `${gameState.player2.name} Wins!`;
        winnerText.style.color = 'var(--accent-p2)';
        vibrate([50, 50, 100]);
    } else {
        winnerText.textContent = "It's a Tie!";
        winnerText.style.color = 'var(--text-main)';
        vibrate([30, 30, 30, 30]);
    }

    showScreen('results');
}

function rematch() {
    // Keep mode/difficulty but reset scores and board
    startGame();
}

// Start the app
init();
