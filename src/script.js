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
    lastMove: null, // ID of the most recent move
    gameOver: false,
    isProcessing: false,
    inactivityTimer: null
};

// DOM Elements
const screens = {
    setup: document.getElementById('setup-menu'),
    game: document.getElementById('game-screen'),
    results: document.getElementById('results-screen'),
    quitModal: document.getElementById('quit-modal'),
    restartModal: document.getElementById('restart-modal')
};

const startBtn = document.getElementById('start-btn');
const pvcOptions = document.getElementById('pvc-options');
const gameBoard = document.getElementById('game-board');
const hintContainer = document.getElementById('hint-container');
const hintBtn = document.getElementById('hint-btn');
const lastMoveBtn = document.getElementById('last-move-btn');
const restartBtn = document.getElementById('restart-btn');

// Initialize
function init() {
    setupEventListeners();
    initSliders();
}

function setupEventListeners() {
    startBtn.addEventListener('click', startGame);
    document.getElementById('quit-btn').addEventListener('click', () => { vibrate(20); screens.quitModal.classList.remove('hidden'); document.getElementById('quit-btn').classList.add('hidden'); });
    document.getElementById('confirm-quit-btn').addEventListener('click', () => { vibrate(20); screens.quitModal.classList.add('hidden'); document.getElementById('quit-btn').classList.remove('hidden'); quitGame(); });
    document.getElementById('cancel-quit-btn').addEventListener('click', () => { vibrate(20); screens.quitModal.classList.add('hidden'); document.getElementById('quit-btn').classList.remove('hidden'); });
    document.getElementById('rematch-btn').addEventListener('click', () => { vibrate(20); rematch(); });
    document.getElementById('new-game-btn').addEventListener('click', () => { vibrate(20); quitGame(); });
    hintBtn.addEventListener('click', provideHint);
    
    // View Last Move Event Listeners
    if (lastMoveBtn) {
        lastMoveBtn.addEventListener('mousedown', highlightLastMove);
        lastMoveBtn.addEventListener('mouseup', clearLastMoveHighlight);
        lastMoveBtn.addEventListener('mouseleave', clearLastMoveHighlight);
        // Touch support
        lastMoveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); highlightLastMove(); }, { passive: false });
        lastMoveBtn.addEventListener('touchend', (e) => { e.preventDefault(); clearLastMoveHighlight(); }, { passive: false });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => { 
            vibrate(20); 
            screens.restartModal.classList.remove('hidden'); 
        });
    }

    document.getElementById('confirm-restart-btn').addEventListener('click', () => { 
        vibrate(20); 
        screens.restartModal.classList.add('hidden'); 
        rematch(); 
    });
    document.getElementById('cancel-restart-btn').addEventListener('click', () => { 
        vibrate(20); 
        screens.restartModal.classList.add('hidden'); 
    });
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
        hintContainer.classList.remove('hidden');
        gameState.player2.name = 'Computer';
        // Recalculate slider for all active buttons in pvcOptions since they were hidden on load
        setTimeout(() => {
            pvcOptions.querySelectorAll('.active').forEach(activeBtn => updateSlider(activeBtn));
        }, 10);
    } else {
        pvcOptions.classList.add('hidden');
        hintContainer.classList.add('hidden');
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

    const quitBtn = document.getElementById('quit-btn');
    if (quitBtn) {
        if (screenId === 'game') {
            quitBtn.classList.remove('hidden');
        } else {
            quitBtn.classList.add('hidden');
        }
    }
}

function quitGame() {
    // Full reset when going back to setup
    gameState.player1.score = 0;
    gameState.player2.score = 0;
    gameState.filledBoxes = 0;
    gameState.currentTurn = 1;
    gameState.lastMove = null;
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
    gameState.lastMove = null;

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
        } else {
            resetInactivityTimer();
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
    // Update hint button state
    if (hintBtn) {
        hintBtn.disabled = val || (gameState.mode === 'pvc' && gameState.currentTurn === 2) || gameState.gameOver;
    }
    if (lastMoveBtn) {
        lastMoveBtn.disabled = val || (gameState.mode === 'pvc' && gameState.currentTurn === 2) || gameState.gameOver;
    }
    if (restartBtn) {
        restartBtn.disabled = val || (gameState.mode === 'pvc' && gameState.currentTurn === 2) || gameState.gameOver;
    }
}

function handleLineClick(line, isManual = false) {
    if (gameState.gameOver || gameState.drawnLines.has(line.id)) return;
    
    // Clear any hints when a move is made
    clearHint();
    resetInactivityTimer();

    // Guard: Prevent manual moves during AI turn or while board is explicitly locked
    if (isManual && (gameState.isProcessing || (gameState.mode === 'pvc' && gameState.currentTurn === 2))) return;

    if (isManual) {
        // Coarse lock during the processing of a single move click
        gameState.isProcessing = true;
    }

    try {
        vibrate(15);
        gameState.lastMove = line.id;
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
        resetInactivityTimer();
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

// ─── AI Adapter ───────────────────────────────────────────────────────────────
// Builds a DOM-free state snapshot and delegates to the expert engine in ai.js.
// ──────────────────────────────────────────────────────────────────────────────

function computerMove() {
    if (gameState.gameOver || gameState.currentTurn !== 2) {
        setProcessing(false);
        return;
    }
    if (gameState.availableLines.length === 0) {
        setProcessing(false);
        return;
    }

    // Build a lightweight snapshot (no DOM references) for the AI engine.
    const snap = {
        gridSize   : gameState.gridSize,
        allLineIds : gameState.allLineIds,
        drawn      : new Set(gameState.drawnLines),
        available  : [...gameState.availableLines],
        aiScore    : gameState.player2.score,
        humanScore : gameState.player1.score,
    };

    // Delegate to the AI engine (ai.js must be loaded before script.js).
    const targetLineId = getAIMove(snap, gameState.difficulty);

    const line = document.getElementById(targetLineId);
    if (line) {
        handleLineClick(line, false);
    } else {
        setProcessing(false);
    }
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

// ─── Hint System ─────────────────────────────────────────────────────────────

function provideHint() {
    if (gameState.gameOver || gameState.isProcessing) return;
    if (gameState.mode !== 'pvc' || gameState.currentTurn !== 1) return;

    vibrate(20);
    
    // Clear any existing hint first
    clearHint();

    // Snapshot with swapped scores to use AI logic for human player suggestions
    const snap = {
        gridSize   : gameState.gridSize,
        allLineIds : gameState.allLineIds,
        drawn      : new Set(gameState.drawnLines),
        available  : [...gameState.availableLines],
        // Swap scores so AI evaluates best move for "itself" (which is actually us)
        aiScore    : gameState.player1.score, 
        humanScore : gameState.player2.score,
    };

    // 1. Explicitly check for box-completing moves first (guaranteed suggestion)
    let targetLineId = typeof _findCompletingLine === 'function' 
        ? _findCompletingLine(snap, snap.drawn) 
        : null;

    // 2. Fallback to AI's general recommendation if no immediate box capture
    if (!targetLineId) {
        targetLineId = getAIMove(snap, gameState.difficulty);
    }
    
    const line = document.getElementById(targetLineId);
    
    if (line) {
        line.classList.add('hint-highlight');
        // Clear after 2 seconds automatically
        gameState.hintTimeout = setTimeout(clearHint, 2000);
    }
}

function clearHint() {
    if (gameState.hintTimeout) {
        clearTimeout(gameState.hintTimeout);
        gameState.hintTimeout = null;
    }
    hintBtn.classList.remove('hint-pulse');
    document.querySelectorAll('.hint-highlight').forEach(el => {
        el.classList.remove('hint-highlight');
    });
}

// ─── Last Move System ────────────────────────────────────────────────────────

function highlightLastMove() {
    if (gameState.gameOver || gameState.isProcessing || !gameState.lastMove) return;
    vibrate(10);
    const line = document.getElementById(gameState.lastMove);
    if (line) {
        line.classList.add('last-move-highlight');
    }
}

function clearLastMoveHighlight() {
    document.querySelectorAll('.last-move-highlight').forEach(el => {
        el.classList.remove('last-move-highlight');
    });
}

// ─── Interaction Monitoring ─────────────────────────────────────────────────

function resetInactivityTimer() {
    if (gameState.inactivityTimer) {
        clearTimeout(gameState.inactivityTimer);
        gameState.inactivityTimer = null;
    }
    hintBtn.classList.remove('hint-pulse');
    
    if (gameState.mode === 'pvc' && gameState.currentTurn === 1 && !gameState.gameOver) {
        const startPulseTimer = (delay) => {
            gameState.inactivityTimer = setTimeout(() => {
                if (gameState.currentTurn === 1 && !gameState.gameOver && !gameState.isProcessing) {
                    // Apply pulse
                    hintBtn.classList.add('hint-pulse');
                    
                    // The pulse is CSS infinite, but we can restart it if needed.
                    // However, the requirement says "softly fade in and out in a smooth loop".
                    // The CSS animation already does this.
                }
            }, delay);
        };

        // First pulse after 3 seconds
        startPulseTimer(3000);
    }
}

// Global reset on interaction
document.addEventListener('mousedown', resetInactivityTimer);
document.addEventListener('touchstart', resetInactivityTimer);

// Start the app
init();
