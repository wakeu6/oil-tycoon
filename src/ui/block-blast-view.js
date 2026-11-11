/**
 * Block Blast View ("Сборка коллектора / Очистка гидратных пробок")
 * Interactive 8x8 pipe grid UI modal with piece dock, placement preview, and blast FX.
 */
import { PipelineBlockBlast, PIPE_SHAPES } from "../engine/block-blast.js";
import { state } from "../state.js";
import { audio } from "../audio.js";

export class BlockBlastView {
  constructor() {
    this.modal = document.getElementById("modal-block-blast");
    this.btnClose = document.getElementById("btn-close-block-blast");
    this.gridContainer = document.getElementById("block-blast-grid");
    this.dockContainer = document.getElementById("block-blast-dock");
    this.scoreText = document.getElementById("block-blast-score");
    this.comboText = document.getElementById("block-blast-combo");
    this.linesText = document.getElementById("block-blast-lines");
    this.gameSummary = document.getElementById("block-blast-summary");
    this.btnFinish = document.getElementById("btn-finish-block-blast");

    this.engine = new PipelineBlockBlast();
    this.selectedDockIndex = null;
    this.timerRemaining = 60;
    this.timerInterval = null;
    this.timerText = document.getElementById("block-blast-timer");

    this.initEvents();
  }

  initEvents() {
    state.on("openBlockBlastModal", (opts = {}) => {
      this.open(opts.wellId || "well_1");
    });

    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.close());
    }

    if (this.btnFinish) {
      this.btnFinish.addEventListener("click", () => {
        if (this.gameSummary) this.gameSummary.classList.add("hidden");
        this.close();
      });
    }

    state.on("blockBlastCompleted", (data) => {
      this.showSummary(data);
    });
  }

  open(wellId) {
    if (!this.modal) return;
    state.emit("closeAllBottomSheets");
    this.engine = new PipelineBlockBlast({ wellId });
    this.selectedDockIndex = null;
    this.modal.classList.remove("hidden");
    if (this.gameSummary) this.gameSummary.classList.add("hidden");
    this.renderBoard();
    this.renderDock();
    this.updateStats();
    this.startTimer();
  }

  close() {
    this.stopTimer();
    if (!this.modal) return;
    this.modal.classList.add("hidden");
  }

  startTimer() {
    this.stopTimer();
    this.timerRemaining = 60;
    if (this.timerText) this.timerText.textContent = this.timerRemaining;
    this.timerInterval = setInterval(() => {
      this.timerRemaining--;
      if (this.timerText) this.timerText.textContent = Math.max(0, this.timerRemaining);
      if (this.timerRemaining <= 0) {
        this.stopTimer();
        this.timeUpFinish();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  timeUpFinish() {
    if (typeof audio?.playWarning === "function") audio.playWarning();
    const score = this.engine.score || 0;
    const lines = this.engine.linesPurged || 0;
    const cashReward = state.completeBlockBlast(lines, score);
    this.showSummary({ score, linesPurged: lines, cashReward });
  }

  updateStats() {
    if (this.scoreText) this.scoreText.textContent = this.engine.score.toLocaleString("ru-RU");
    if (this.comboText) this.comboText.textContent = `x${this.engine.combo}`;
    if (this.linesText) this.linesText.textContent = this.engine.linesPurged;
  }

  renderBoard() {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = "";

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement("div");
        cell.className = "blast-cell";
        cell.dataset.r = r;
        cell.dataset.c = c;

        const val = this.engine.board[r][c];
        if (val) {
          cell.classList.add("filled");
          cell.style.backgroundColor = val.color;
        }

        cell.addEventListener("mouseenter", () => this.onCellHover(r, c));
        cell.addEventListener("mouseleave", () => this.clearPreview());
        cell.addEventListener("click", () => this.onCellClick(r, c));

        this.gridContainer.appendChild(cell);
      }
    }
  }

  renderDock() {
    if (!this.dockContainer) return;
    this.dockContainer.innerHTML = "";

    this.engine.dock.forEach((piece, idx) => {
      const slot = document.createElement("div");
      slot.className = `blast-dock-slot ${this.selectedDockIndex === idx ? "selected" : ""} ${piece ? "" : "empty"}`;

      if (piece) {
        const rows = piece.matrix.length;
        const cols = piece.matrix[0].length;
        const miniGrid = document.createElement("div");
        miniGrid.className = "mini-piece-grid";
        miniGrid.style.gridTemplateRows = `repeat(${rows}, 14px)`;
        miniGrid.style.gridTemplateColumns = `repeat(${cols}, 14px)`;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const dot = document.createElement("div");
            dot.className = "mini-piece-cell";
            if (piece.matrix[r][c] === 1) {
              dot.classList.add("solid");
              dot.style.backgroundColor = piece.color;
            }
            miniGrid.appendChild(dot);
          }
        }
        slot.appendChild(miniGrid);

        slot.addEventListener("click", () => {
          if (typeof audio?.playClick === "function") audio.playClick();
          this.selectedDockIndex = this.selectedDockIndex === idx ? null : idx;
          this.renderDock();
        });
      }

      this.dockContainer.appendChild(slot);
    });
  }

  onCellHover(atR, atC) {
    if (this.selectedDockIndex === null) return;
    const piece = this.engine.dock[this.selectedDockIndex];
    if (!piece) return;

    this.clearPreview();
    const canPlace = this.engine.canPlacePiece(piece.matrix, atR, atC);
    const rows = piece.matrix.length;
    const cols = piece.matrix[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (piece.matrix[r][c] === 1) {
          const targetR = atR + r;
          const targetC = atC + c;
          if (targetR < 8 && targetC < 8) {
            const cell = this.gridContainer.querySelector(`.blast-cell[data-r="${targetR}"][data-c="${targetC}"]`);
            if (cell) {
              cell.classList.add(canPlace ? "preview-valid" : "preview-invalid");
              if (canPlace) cell.style.borderColor = piece.color;
            }
          }
        }
      }
    }
  }

  clearPreview() {
    if (!this.gridContainer) return;
    const previews = this.gridContainer.querySelectorAll(".preview-valid, .preview-invalid");
    previews.forEach(p => {
      p.classList.remove("preview-valid", "preview-invalid");
      p.style.borderColor = "";
    });
  }

  onCellClick(atR, atC) {
    if (this.selectedDockIndex === null) return;
    const res = this.engine.placePiece(this.selectedDockIndex, atR, atC);
    if (res.success) {
      this.selectedDockIndex = null;
      this.renderBoard();
      this.renderDock();
      this.updateStats();

      if (res.linesCleared > 0) {
        this.flashLinesFX();
      }
    } else {
      if (typeof audio?.playError === "function") audio.playError();
    }
  }

  flashLinesFX() {
    if (!this.gridContainer) return;
    this.gridContainer.classList.add("purging-anim");
    setTimeout(() => {
      this.gridContainer.classList.remove("purging-anim");
    }, 280);
  }

  showSummary(data) {
    if (!this.gameSummary) return;
    const scoreVal = document.getElementById("summary-score-val");
    const linesVal = document.getElementById("summary-lines-val");
    const rewardVal = document.getElementById("summary-reward-val");

    if (scoreVal) scoreVal.textContent = data.score.toLocaleString("ru-RU");
    if (linesVal) linesVal.textContent = data.linesPurged;
    if (rewardVal) rewardVal.textContent = `+${data.cashReward.toLocaleString("ru-RU")} ₽`;

    this.gameSummary.classList.remove("hidden");
  }
}
