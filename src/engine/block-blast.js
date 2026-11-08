/**
 * Pipeline Block Blast Mini-Game ("Сборка коллектора: Очистка гидратных пробок")
 * 8x8 Gas collector manifold puzzle engine inspired by Block Blast,
 * deeply themed for Oil & Gas wellhead servicing.
 */
import { state } from "../state.js";
import { audio } from "../audio.js";

// Standard industrial pipe shapes
export const PIPE_SHAPES = [
  // 1. Single Valve (1x1)
  { id: "single_valve", name: "Запорный клапан 1x1", color: "#f59e0b", matrix: [[1]] },

  // 2. Straight Pipe Segments (Horizontal & Vertical)
  { id: "pipe_h2", name: "Патрубок 2x1", color: "#38bdf8", matrix: [[1, 1]] },
  { id: "pipe_v2", name: "Стояк 1x2", color: "#38bdf8", matrix: [[1], [1]] },
  { id: "pipe_h3", name: "Шлейф 3x1", color: "#0ea5e9", matrix: [[1, 1, 1]] },
  { id: "pipe_v3", name: "Стояк 1x3", color: "#0ea5e9", matrix: [[1], [1], [1]] },
  { id: "pipe_h4", name: "Магистраль 4x1", color: "#0284c7", matrix: [[1, 1, 1, 1]] },
  { id: "pipe_v4", name: "Магистраль 1x4", color: "#0284c7", matrix: [[1], [1], [1], [1]] },

  // 3. Compact Separation Skids (2x2)
  { id: "skid_2x2", name: "Блок сепаратора 2x2", color: "#10b981", matrix: [[1, 1], [1, 1]] },

  // 4. L-Bends & Expansion Loops
  { id: "bend_l1", name: "Отвод 2x2 (Г-образный)", color: "#ec4899", matrix: [[1, 0], [1, 1]] },
  { id: "bend_l2", name: "Отвод 2x2", color: "#ec4899", matrix: [[0, 1], [1, 1]] },
  { id: "bend_l3", name: "Отвод 2x2", color: "#ec4899", matrix: [[1, 1], [1, 0]] },
  { id: "bend_l4", name: "Отвод 2x2", color: "#ec4899", matrix: [[1, 1], [0, 1]] },

  // 5. Large 3x3 L-Bends
  { id: "loop_l1", name: "Компенсатор 3x3", color: "#a855f7", matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
  { id: "loop_l2", name: "Компенсатор 3x3", color: "#a855f7", matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]] },

  // 6. T-Junctions (Тройники)
  { id: "tee_down", name: "Тройник 3x2", color: "#eab308", matrix: [[1, 1, 1], [0, 1, 0]] },
  { id: "tee_up", name: "Тройник 3x2", color: "#eab308", matrix: [[0, 1, 0], [1, 1, 1]] },
  { id: "tee_right", name: "Тройник 2x3", color: "#eab308", matrix: [[1, 0], [1, 1], [1, 0]] },
  { id: "tee_left", name: "Тройник 2x3", color: "#eab308", matrix: [[0, 1], [1, 1], [0, 1]] },

  // 7. Cross-Distributor (Крестовина)
  { id: "cross", name: "Крестовина 3x3", color: "#f97316", matrix: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] }
];

export class PipelineBlockBlast {
  constructor(options = {}) {
    this.gridSize = 8;
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.dock = [];
    this.score = 0;
    this.combo = 0;
    this.linesPurged = 0;
    this.isGameOver = false;
    this.selectedDockIndex = null;
    this.targetWellId = options.wellId || "well_1";
    this.container = options.container || null;

    this.initBoard();
    this.refillDock();
  }

  initBoard() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.score = 0;
    this.combo = 0;
    this.linesPurged = 0;
    this.isGameOver = false;
    this.selectedDockIndex = null;
  }

  refillDock() {
    this.dock = [];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(Math.random() * PIPE_SHAPES.length);
      const template = PIPE_SHAPES[idx];
      this.dock.push({
        ...template,
        uid: `dock_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`
      });
    }
  }

  canPlacePiece(matrix, atR, atC) {
    const rows = matrix.length;
    const cols = matrix[0].length;

    if (atR < 0 || atC < 0 || atR + rows > this.gridSize || atC + cols > this.gridSize) {
      return false;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === 1) {
          if (this.board[atR + r][atC + c] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  }

  canAnyPieceFit() {
    for (const piece of this.dock) {
      if (!piece) continue;
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          if (this.canPlacePiece(piece.matrix, r, c)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  placePiece(dockIndex, atR, atC) {
    const piece = this.dock[dockIndex];
    if (!piece) return { success: false, reason: "Piece not found" };

    if (!this.canPlacePiece(piece.matrix, atR, atC)) {
      return { success: false, reason: "Invalid position" };
    }

    const rows = piece.matrix.length;
    const cols = piece.matrix[0].length;
    let placedBlocksCount = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (piece.matrix[r][c] === 1) {
          this.board[atR + r][atC + c] = {
            color: piece.color,
            id: piece.id
          };
          placedBlocksCount++;
        }
      }
    }

    // Points for placing blocks
    this.score += placedBlocksCount * 10;
    this.dock[dockIndex] = null;
    this.selectedDockIndex = null;

    if (typeof audio?.playTap === "function") {
      audio.playTap();
    }

    // Check for filled lines (horizontal & vertical)
    const purgeResult = this.checkAndPurgeLines();

    // Refill dock if all 3 pieces used
    if (this.dock.every(p => p === null)) {
      this.refillDock();
    }

    // Check game over
    if (!this.canAnyPieceFit()) {
      this.isGameOver = true;
      this.handleGameOver();
    }

    return {
      success: true,
      linesCleared: purgeResult.linesCleared,
      scoreGained: purgeResult.scoreGained,
      combo: this.combo,
      isGameOver: this.isGameOver
    };
  }

  checkAndPurgeLines() {
    const rowsToClear = [];
    const colsToClear = [];

    // Check rows
    for (let r = 0; r < this.gridSize; r++) {
      if (this.board[r].every(cell => cell !== null)) {
        rowsToClear.push(r);
      }
    }

    // Check columns
    for (let c = 0; c < this.gridSize; c++) {
      let full = true;
      for (let r = 0; r < this.gridSize; r++) {
        if (this.board[r][c] === null) {
          full = false;
          break;
        }
      }
      if (full) {
        colsToClear.push(c);
      }
    }

    const totalLines = rowsToClear.length + colsToClear.length;
    let scoreGained = 0;

    if (totalLines > 0) {
      this.combo++;
      this.linesPurged += totalLines;

      // Clear rows
      for (const r of rowsToClear) {
        for (let c = 0; c < this.gridSize; c++) {
          this.board[r][c] = null;
        }
      }

      // Clear columns
      for (const c of colsToClear) {
        for (let r = 0; r < this.gridSize; r++) {
          this.board[r][c] = null;
        }
      }

      // Combo formula: 100 * lines * combo
      scoreGained = totalLines * 100 * Math.max(1, this.combo);
      this.score += scoreGained;

      // Audio & Haptic Feedback
      if (typeof audio?.playUpgrade === "function") {
        audio.playUpgrade();
      }
      if (typeof audio?.vibrate === "function") {
        audio.vibrate([30, 20, 60]);
      }

      // Instant cash reward for purging hydrate plugs
      const cashReward = totalLines * 250 * (state.facilityLevel || 1);
      state.addMoney(cashReward);
    } else {
      this.combo = 0;
    }

    return { linesCleared: totalLines, scoreGained };
  }

  handleGameOver() {
    // Reward player based on total lines cleared & score
    const wellBonusDebit = Math.max(1500, this.score * 5);
    state.addMoney(wellBonusDebit);

    // Super Debit Boost for wellhead (+150% for 180 seconds)
    state.activateBoost(180.0, 2.5);

    // Savelich experience/stars
    if (this.linesPurged >= 3 && typeof state.addCrypto === "function") {
      state.addCrypto(Math.floor(this.linesPurged / 3));
    }

    if (typeof audio?.playPayout === "function") {
      audio.playPayout();
    }

    state.emit("blockBlastCompleted", {
      score: this.score,
      linesPurged: this.linesPurged,
      cashReward: wellBonusDebit
    });
  }
}
