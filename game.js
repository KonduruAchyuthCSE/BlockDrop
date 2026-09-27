"use strict";

const BOARD_SIZE = 8;
const PIECES_COUNT = 3;

const boardEl = document.getElementById("board");
const piecesEl = document.getElementById("pieces");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");

const soundBtn = document.getElementById("soundBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");

const newGameBtn = document.getElementById("newGameBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

const pauseOverlay = document.getElementById("pauseOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreEl = document.getElementById("finalScore");
const scorePopup = document.getElementById("scorePopup");

let board = [];
let currentPieces = [];

let score = 0;
let bestScore = Number(localStorage.getItem("blockDropBest") || 0);

let soundOn = true;
let paused = false;
let gameOver = false;
let clearing = false;

let dragged = null;

const COLORS = [
    "#20d6ad",
    "#35a9ff",
    "#ff9b45",
    "#ff4f70",
    "#b879ff",
    "#ffd34e",
    "#42d8e8"
];

const SHAPES = [
    [[0,0]],

    [[0,0],[0,1]],

    [[0,0],[1,0]],

    [[0,0],[0,1],[0,2]],

    [[0,0],[1,0],[2,0]],

    [[0,0],[0,1],[1,0],[1,1]],

    [[0,0],[0,1],[0,2],[0,3]],

    [[0,0],[1,0],[2,0],[3,0]],

    [[0,0],[0,1],[1,1]],

    [[0,1],[1,0],[1,1]],

    [[0,0],[1,0],[1,1]],

    [[0,0],[0,1],[1,0]],

    [[0,0],[0,1],[0,2],[1,1]],

    [[0,1],[1,0],[1,1],[1,2]],

    [[0,0],[1,0],[2,0],[1,1]],

    [[0,1],[1,1],[2,1],[1,0]],

    [[0,0],[1,0],[2,0],[2,1]],

    [[0,0],[0,1],[0,2],[1,2]],

    [[0,0],[1,0],[2,0],[0,1]],

    [[0,0],[0,1],[1,1],[2,1]]
];

/* =========================
   SOUND
========================= */

let audioContext = null;

function beep(frequency = 500, duration = 70) {
    if (!soundOn) return;

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext ||
                window.webkitAudioContext)();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration / 1000
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(
            audioContext.currentTime + duration / 1000
        );
    } catch (error) {
        /* Sound is optional */
    }
}

function vibrate(pattern = 20) {
    if ("vibrate" in navigator) {
        navigator.vibrate(pattern);
    }
}

soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "🔊" : "🔇";

    if (soundOn) {
        beep(650, 60);
        vibrate(15);
    }
});

/* =========================
   BOARD
========================= */

function createEmptyBoard() {
    return Array.from(
        { length: BOARD_SIZE },
        () => Array(BOARD_SIZE).fill(null)
    );
}

function renderBoard() {
    boardEl.innerHTML = "";

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {

            const cell = document.createElement("div");

            cell.className = "board-cell";

            cell.dataset.row = row;
            cell.dataset.col = col;

            if (board[row][col]) {
                cell.classList.add("filled");
                cell.style.setProperty(
                    "--block-color",
                    board[row][col]
                );
            }

            boardEl.appendChild(cell);
        }
    }
}

/* =========================
   SCORE
========================= */

function updateScore() {
    scoreEl.textContent = score;
    bestScoreEl.textContent = bestScore;
}

function addScore(points) {
    score += points;

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem(
            "blockDropBest",
            String(bestScore)
        );
    }

    updateScore();
}

function showScorePopup(points) {
    scorePopup.textContent = "+" + points;
    scorePopup.classList.remove("show");

    void scorePopup.offsetWidth;

    scorePopup.classList.add("show");
}

/* =========================
   RANDOM PIECES
========================= */

function cloneShape(shape) {
    return shape.map(cell => [cell[0], cell[1]]);
}

function randomShape() {
    const shape =
        SHAPES[Math.floor(Math.random() * SHAPES.length)];

    return cloneShape(shape);
}

function randomColor() {
    return COLORS[
        Math.floor(Math.random() * COLORS.length)
    ];
}

function getShapeSize(shape) {
    let maxRow = 0;
    let maxCol = 0;

    shape.forEach(([row, col]) => {
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, col);
    });

    return {
        rows: maxRow + 1,
        cols: maxCol + 1
    };
}

/* =========================
   CREATE BOTTOM PIECE
========================= */

function createPiece(shape, color, index) {

    const piece = document.createElement("div");

    piece.className = "piece";
    piece.dataset.index = index;

    piece._shape = shape;
    piece._color = color;

    const size = getShapeSize(shape);
    const blockSize = 34;

    const totalWidth = size.cols * blockSize;
    const totalHeight = size.rows * blockSize;

    const offsetX = (96 - totalWidth) / 2;
    const offsetY = (100 - totalHeight) / 2;

    shape.forEach(([row, col]) => {

        const block = document.createElement("div");

        block.className = "mini-block";

        block.dataset.row = row;
        block.dataset.col = col;

        block.style.setProperty(
            "--block-color",
            color
        );

        block.style.left =
            (offsetX + col * blockSize) + "px";

        block.style.top =
            (offsetY + row * blockSize) + "px";

        piece.appendChild(block);
    });

    piece.addEventListener(
        "pointerdown",
        startDrag,
        { passive: false }
    );

    return piece;
}

function createPieces() {
    piecesEl.innerHTML = "";
    currentPieces = [];

    for (let i = 0; i < PIECES_COUNT; i++) {

        const pieceData = {
            shape: randomShape(),
            color: randomColor()
        };

        currentPieces.push(pieceData);

        const element = createPiece(
            pieceData.shape,
            pieceData.color,
            i
        );

        piecesEl.appendChild(element);
    }
}
/* =========================
   BOARD GEOMETRY
========================= */

function getBoardGeometry() {

    const rect = boardEl.getBoundingClientRect();

    const computed =
        window.getComputedStyle(boardEl);

    const paddingLeft =
        parseFloat(computed.paddingLeft) || 0;

    const paddingTop =
        parseFloat(computed.paddingTop) || 0;

    const innerWidth =
        rect.width - paddingLeft -
        (parseFloat(computed.paddingRight) || 0);

    const innerHeight =
        rect.height - paddingTop -
        (parseFloat(computed.paddingBottom) || 0);

    return {
        left: rect.left + paddingLeft,
        top: rect.top + paddingTop,
        cellWidth: innerWidth / BOARD_SIZE,
        cellHeight: innerHeight / BOARD_SIZE
    };
}

/* =========================
   CHECK PLACEMENT
========================= */

function canPlacePiece(shape, startRow, startCol) {

    for (const [row, col] of shape) {

        const r = startRow + row;
        const c = startCol + col;

        if (
            r < 0 ||
            r >= BOARD_SIZE ||
            c < 0 ||
            c >= BOARD_SIZE
        ) {
            return false;
        }

        if (board[r][c] !== null) {
            return false;
        }
    }

    return true;
}

/* =========================
   PLACE PIECE
========================= */

function placePiece(pieceIndex, startRow, startCol) {

    const pieceData =
        currentPieces[pieceIndex];

    if (!pieceData) return false;

    if (
        !canPlacePiece(
            pieceData.shape,
            startRow,
            startCol
        )
    ) {
        return false;
    }

    pieceData.shape.forEach(([row, col]) => {

        board[startRow + row][startCol + col] =
            pieceData.color;
    });

    beep(520, 65);
    vibrate(15);

    const pieceElement =
        piecesEl.querySelector(
            `.piece[data-index="${pieceIndex}"]`
        );

    if (pieceElement) {
        pieceElement.remove();
    }

    currentPieces[pieceIndex] = null;

    renderBoard();

    return true;
}

/* =========================
   DRAG COPY
========================= */

function createDragCopy(shape, color) {

    const geometry = getBoardGeometry();

    const cellSize = Math.min(
        geometry.cellWidth,
        geometry.cellHeight
    );

    const size = getShapeSize(shape);

    const copy =
        document.createElement("div");

    copy.className = "block-drag-copy";

    copy.style.width =
        (size.cols * cellSize) + "px";

    copy.style.height =
        (size.rows * cellSize) + "px";

    shape.forEach(([row, col]) => {

        const block =
            document.createElement("div");

        block.className = "mini-block";

        block.style.width =
            cellSize + "px";

        block.style.height =
            cellSize + "px";

        block.style.left =
            (col * cellSize) + "px";

        block.style.top =
            (row * cellSize) + "px";

        block.style.setProperty(
            "--block-color",
            color
        );

        copy.appendChild(block);
    });

    document.body.appendChild(copy);

    return {
        element: copy,
        cellSize
    };
}

/* =========================
   START DRAG
========================= */

function startDrag(event) {

    if (paused || gameOver || clearing) {
        return;
    }

    event.preventDefault();

    const piece = event.currentTarget;

    const pieceIndex =
        Number(piece.dataset.index);

    const pieceData =
        currentPieces[pieceIndex];

    if (!pieceData) return;

    const target =
        event.target.closest(".mini-block");

    if (!target) return;

    const grabbedRow =
        Number(target.dataset.row);

    const grabbedCol =
        Number(target.dataset.col);

    const dragCopy =
        createDragCopy(
            pieceData.shape,
            pieceData.color
        );

    dragged = {
        piece,
        pieceIndex,
        shape: pieceData.shape,
        color: pieceData.color,
        grabbedRow,
        grabbedCol,
        copy: dragCopy.element,
        cellSize: dragCopy.cellSize,
        pointerId: event.pointerId
    };

    piece.style.visibility = "hidden";

    moveDraggedPiece(
        event.clientX,
        event.clientY
    );

    beep(720, 35);

    try {
        piece.setPointerCapture(
            event.pointerId
        );
    } catch (error) {
        /* Not required on every browser */
    }
}

/* =========================
   MOVE DRAGGED PIECE
========================= */

function moveDraggedPiece(x, y) {

    if (!dragged) return;

    const size = dragged.cellSize;

    const left =
        x -
        size / 2 -
        dragged.grabbedCol * size;

    const top =
        y -
        size / 2 -
        dragged.grabbedRow * size;

    dragged.copy.style.left =
        left + "px";

    dragged.copy.style.top =
        top + "px";
}

document.addEventListener(
    "pointermove",
    event => {

        if (!dragged) return;

        event.preventDefault();

        moveDraggedPiece(
            event.clientX,
            event.clientY
        );
    },
    { passive: false }
);

/* =========================
   CANCEL DRAG
========================= */

function cancelDrag() {

    if (!dragged) return;

    dragged.piece.style.visibility =
        "visible";

    if (dragged.copy) {
        dragged.copy.remove();
    }

    dragged = null;
}

/* =========================
   FINISH DRAG
========================= */

function finishDrag(event) {

    if (!dragged) return;

    event.preventDefault();

    const current = dragged;

    const geometry =
        getBoardGeometry();

    const x = event.clientX;
    const y = event.clientY;

    const fingerCol =
        Math.floor(
            (x - geometry.left) /
            geometry.cellWidth
        );

    const fingerRow =
        Math.floor(
            (y - geometry.top) /
            geometry.cellHeight
        );

    const startCol =
        fingerCol - current.grabbedCol;

    const startRow =
        fingerRow - current.grabbedRow;

    const placed =
        placePiece(
            current.pieceIndex,
            startRow,
            startCol
        );

    if (!placed) {

        current.piece.style.visibility =
            "visible";

        beep(180, 70);
        vibrate(25);

    } else {

        beep(620, 65);
    }

    if (current.copy) {
        current.copy.remove();
    }

    dragged = null;

    if (placed) {
        handleAfterPlacement();
    }
}

/* =========================
   POINTER END
========================= */

document.addEventListener(
    "pointerup",
    finishDrag,
    { passive: false }
);

document.addEventListener(
    "pointercancel",
    () => {
        cancelDrag();
    }
);

document.addEventListener(
    "pointerleave",
    () => {
        /* Do nothing */
    }
);

/* =========================
   COMPLETED LINES
========================= */

function findCompletedLines() {

    const rows = [];
    const cols = [];

    for (let row = 0; row < BOARD_SIZE; row++) {

        let full = true;

        for (let col = 0; col < BOARD_SIZE; col++) {

            if (board[row][col] === null) {
                full = false;
                break;
            }
        }

        if (full) {
            rows.push(row);
        }
    }

    for (let col = 0; col < BOARD_SIZE; col++) {

        let full = true;

        for (let row = 0; row < BOARD_SIZE; row++) {

            if (board[row][col] === null) {
                full = false;
                break;
            }
        }

        if (full) {
            cols.push(col);
        }
    }

    return { rows, cols };
}
/* =========================
   CLEAR LINES
========================= */

function clearCompletedLines() {

    const completed =
        findCompletedLines();

    const totalLines =
        completed.rows.length +
        completed.cols.length;

    if (totalLines === 0) {
        checkGameOver();
        return;
    }

    clearing = true;

    const cells =
        boardEl.querySelectorAll(".board-cell");

    cells.forEach(cell => {

        const row =
            Number(cell.dataset.row);

        const col =
            Number(cell.dataset.col);

        const rowClear =
            completed.rows.includes(row);

        const colClear =
            completed.cols.includes(col);

        if (rowClear || colClear) {
            cell.classList.add("clearing");
        }
    });

    const points = totalLines * 100;

    setTimeout(() => {

        completed.rows.forEach(row => {

            for (let col = 0; col < BOARD_SIZE; col++) {
                board[row][col] = null;
            }
        });

        completed.cols.forEach(col => {

            for (let row = 0; row < BOARD_SIZE; row++) {
                board[row][col] = null;
            }
        });

        addScore(points);
        showScorePopup(points);

        beep(820, 120);
        vibrate([30, 40, 30]);

        renderBoard();

        clearing = false;

        checkGameOver();

    }, 360);
}

/* =========================
   AFTER PLACEMENT
========================= */

function handleAfterPlacement() {

    const remaining =
        currentPieces.filter(Boolean).length;

    if (remaining === 0) {

        setTimeout(() => {
            createPieces();
            checkGameOver();
        }, 100);

    } else {

        clearCompletedLines();
    }
}

/* =========================
   CHECK ANY MOVE
========================= */

function hasAnyMove() {

    for (
        let pieceIndex = 0;
        pieceIndex < currentPieces.length;
        pieceIndex++
    ) {

        const piece =
            currentPieces[pieceIndex];

        if (!piece) continue;

        for (
            let row = 0;
            row < BOARD_SIZE;
            row++
        ) {

            for (
                let col = 0;
                col < BOARD_SIZE;
                col++
            ) {

                if (
                    canPlacePiece(
                        piece.shape,
                        row,
                        col
                    )
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}

/* =========================
   GAME OVER
========================= */

function checkGameOver() {

    if (paused || clearing) return;

    if (!hasAnyMove()) {

        gameOver = true;

        finalScoreEl.textContent =
            score;

        gameOverOverlay.classList.add(
            "show"
        );

        beep(160, 220);
        vibrate([80, 60, 80]);
    }
}

/* =========================
   PAUSE
========================= */

function pauseGame() {

    if (gameOver || clearing) return;

    paused = true;

    if (dragged) {
        cancelDrag();
    }

    pauseOverlay.classList.add("show");
}

function resumeGame() {

    paused = false;

    pauseOverlay.classList.remove(
        "show"
    );
}

pauseBtn.addEventListener(
    "click",
    pauseGame
);

resumeBtn.addEventListener(
    "click",
    resumeGame
);

/* =========================
   NEW GAME
========================= */

function startNewGame() {

    if (dragged) {
        cancelDrag();
    }

    board = createEmptyBoard();

    score = 0;

    paused = false;
    gameOver = false;
    clearing = false;

    pauseOverlay.classList.remove(
        "show"
    );

    gameOverOverlay.classList.remove(
        "show"
    );

    updateScore();
    renderBoard();
    createPieces();
}

/* =========================
   BUTTONS
========================= */

newGameBtn.addEventListener(
    "click",
    () => {

        beep(600, 60);
        vibrate(20);

        startNewGame();
    }
);

playAgainBtn.addEventListener(
    "click",
    () => {

        beep(600, 60);
        vibrate(20);

        startNewGame();
    }
);

/* =========================
   START
========================= */

updateScore();
startNewGame();