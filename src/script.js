// Game State
let gameState = {
    mode: '1v1',       // '1v1' or 'pvc'
    difficulty: 'easy', // 'easy' or 'medium'
    player1: { name: 'Player 1', score: 0 },
    player2: { name: 'Player 2', score: 0 },
    currentTurn: 1,    // 1 or 2
    gridSize: 3,       // Default 3x3 grid
    totalBoxes: 16,
    filledBoxes: 0,
    availableLines: [],
    gameOver: false
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
        // Recalculate slider for difficulty buttons since they were hidden on load
        setTimeout(() => {
            const activeDiff = pvcOptions.querySelector('.active');
            if (activeDiff) updateSlider(activeDiff);
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
    gameState.gameOver = false;
    showScreen('setup');
    updateScoreboard();
}

// Game Logic
function startGame() {
    gameState.totalBoxes = gameState.gridSize * gameState.gridSize;
    gameState.filledBoxes = 0;
    gameState.player1.score = 0;
    gameState.player2.score = 0;
    gameState.currentTurn = 1;
    gameState.gameOver = false;
    gameState.availableLines = [];

    vibrate(30);

    // Show game screen FIRST so board-container has a real clientWidth
    showScreen('game');
    updateScoreboard();
    updateScoreboardNames();

    // Build board after layout paint so clientWidth is accurate
    requestAnimationFrame(() => {
        createBoard();
        // Trigger AI if pvc mode starts with AI turn (it shouldn't, but safety)
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

    line.addEventListener('click', () => handleLineClick(line));
    // Touch support for mobile
    line.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleLineClick(line);
    }, { passive: false });

    gameBoard.appendChild(line);
    gameState.availableLines.push(line.id);
}

function handleLineClick(line) {
    if (line.classList.contains('drawn') || gameState.gameOver) return;

    vibrate(15);
    drawLine(line);
    const boxesCompleted = checkBoxes(line);

    if (boxesCompleted > 0) {
        updateScore(boxesCompleted);
        if (checkGameOver()) return;

        // Bonus turn — stay as current player
        if (gameState.mode === 'pvc' && gameState.currentTurn === 2) {
            setTimeout(computerMove, 600);
        }
    } else {
        switchTurn();
    }
}

function drawLine(line) {
    line.classList.add('drawn', `drawn-p${gameState.currentTurn}`);
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
        setTimeout(computerMove, 600);
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
    if (gameState.gameOver || gameState.currentTurn !== 2) return;
    if (gameState.availableLines.length === 0) return; // Safety guard

    let targetLineId = null;

    if (gameState.difficulty === 'medium' || gameState.difficulty === 'hard') {
        // ALWAYS take a completing line if available
        targetLineId = findBoxCompletingLine();
    }

    if (!targetLineId) {
        if (gameState.difficulty === 'hard') {
            // Hard: ALWAYS take a safe line if one exists
            targetLineId = findSafeLine();
        } else if (gameState.difficulty === 'medium') {
            // Medium: 50% chance to make a random sub-optimal move instead of a safe one
            if (Math.random() > 0.5) {
                targetLineId = findSafeLine();
            }
        }
    }

    if (!targetLineId) {
        // Random move
        const randomIndex = Math.floor(Math.random() * gameState.availableLines.length);
        targetLineId = gameState.availableLines[randomIndex];
    }

    const line = document.getElementById(targetLineId);
    if (line) handleLineClick(line);
}

function findBoxCompletingLine() {
    for (let r = 0; r < gameState.gridSize; r++) {
        for (let c = 0; c < gameState.gridSize; c++) {
            const lineIds = [
                `line-horizontal-${r}-${c}`,
                `line-horizontal-${r + 1}-${c}`,
                `line-vertical-${r}-${c}`,
                `line-vertical-${r}-${c + 1}`
            ];
            const drawnCount = lineIds.filter(id => {
                const el = document.getElementById(id);
                return el && el.classList.contains('drawn');
            }).length;
            if (drawnCount === 3) {
                const missing = lineIds.find(id => {
                    const el = document.getElementById(id);
                    return el && !el.classList.contains('drawn');
                });
                if (missing) return missing;
            }
        }
    }
    return null;
}

function findSafeLine() {
    // Prefer lines that don't give opponent a box (not 3rd side of a box)
    const safeMoves = gameState.availableLines.filter(id => !wouldGiveBox(id));
    if (safeMoves.length > 0) {
        return safeMoves[Math.floor(Math.random() * safeMoves.length)];
    }
    return null;
}

function wouldGiveBox(lineId) {
    // Simulate drawing this line and check if it creates a 3-sided box for the opponent
    const el = document.getElementById(lineId);
    if (!el) return false;
    const r = parseInt(el.dataset.r);
    const c = parseInt(el.dataset.c);
    const isH = el.classList.contains('horizontal');

    const boxesToCheck = [];
    if (isH) {
        if (r > 0) boxesToCheck.push([r - 1, c]);
        if (r < gameState.gridSize) boxesToCheck.push([r, c]);
    } else {
        if (c > 0) boxesToCheck.push([r, c - 1]);
        if (c < gameState.gridSize) boxesToCheck.push([r, c]);
    }

    return boxesToCheck.some(([br, bc]) => {
        const lineIds = [
            `line-horizontal-${br}-${bc}`,
            `line-horizontal-${br + 1}-${bc}`,
            `line-vertical-${br}-${bc}`,
            `line-vertical-${br}-${bc + 1}`
        ];
        const drawnCount = lineIds.filter(id => {
            const el2 = document.getElementById(id);
            return el2 && (el2.classList.contains('drawn') || el2.id === lineId);
        }).length;
        // 3 sides already means giving this line completes the box
        return drawnCount === 3;
    });
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
