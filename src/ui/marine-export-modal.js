/**
 * src/ui/marine-export-modal.js
 * Marine Terminal & Arctic Tanker Export Cycle Modal View.
 * Adheres strictly to Emil Kowalski design engineering principles and AGENTS.md rules:
 * - Ease-out transitions (cubic-bezier(0.23, 1, 0.32, 1))
 * - Animations on transform and opacity only
 * - Tactile active button states
 * - Mobile safe layout and zero layout shifts
 */

import { CONFIG } from "../config.js";

export class MarineExportModalView {
  constructor(state) {
    this.state = state;
    this.modalEl = null;
    this.closeBtn = null;
    this.liveTimer = null;
    this.commodities = [
      { id: "polymers", name: "Полимеры", icon: "🧪", color: "#a855f7" },
      { id: "petrochem", name: "Продукты НГХК", icon: "⚗️", color: "#c084fc" },
      { id: "fuel_ai100", name: "Бензин АИ-100", icon: "⚡", color: "#eab308" },
      { id: "fuel_ai98", name: "Бензин АИ-98", icon: "⛽", color: "#38bdf8" },
      { id: "fuel_ai95", name: "Бензин АИ-95", icon: "⛽", color: "#22c55e" },
      { id: "fuel_ai92", name: "Бензин АИ-92", icon: "⛽", color: "#06b6d4" },
      { id: "rawOil", name: "Товарная нефть", icon: "🛢️", color: "#f59e0b" }
    ];
  }

  init() {
    this.modalEl = document.getElementById("modal-marine-export");
    if (!this.modalEl) return;

    this.closeBtn = document.getElementById("btn-close-marine-modal");
    if (this.closeBtn) {
      const handleClose = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.close();
      };
      this.closeBtn.addEventListener("click", handleClose);
      this.closeBtn.addEventListener("pointerup", handleClose);
    }

    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) this.close();
    });

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen()) {
          this.close();
        }
      });
    }

    // Wire HUD button if present
    const hudBtn = document.getElementById("btn-open-marine");
    if (hudBtn) {
      hudBtn.addEventListener("click", () => {
        if (typeof window !== "undefined" && window.townshipCoordinator) {
          window.townshipCoordinator.switchTo("marine");
        } else {
          this.open();
        }
      });
    }

    // Bind state events
    if (this.state && typeof this.state.on === "function") {
      this.state.on("openMarineExportModal", () => this.open());
      this.state.on("tankerStateChanged", () => {
        if (this.isOpen()) this.render();
      });
      this.state.on("tankerCargoLoaded", () => {
        if (this.isOpen()) this.render();
      });
      this.state.on("tankerUpgraded", () => {
        if (this.isOpen()) this.render();
      });
      this.state.on("tankerVoyageCompleted", () => {
        if (this.isOpen()) this.render();
      });
      this.state.on("moneyChanged", () => {
        if (this.isOpen()) this.render();
      });
      this.state.on("inventoryChanged", () => {
        if (this.isOpen()) this.render();
      });
    }

    this.bindActionButtons();
  }

  bindActionButtons() {
    if (!this.modalEl) return;

    // Capacity Upgrade
    const btnCap = document.getElementById("btn-upgrade-tanker-capacity");
    if (btnCap) {
      btnCap.addEventListener("click", () => {
        if (this.state.upgradeTankerCapacity && this.state.upgradeTankerCapacity()) {
          this.render();
        }
      });
    }

    // Speed Upgrade
    const btnSpd = document.getElementById("btn-upgrade-tanker-speed");
    if (btnSpd) {
      btnSpd.addEventListener("click", () => {
        if (this.state.upgradeTankerSpeed && this.state.upgradeTankerSpeed()) {
          this.render();
        }
      });
    }

    // Auto-load all cargo
    const btnAuto = document.getElementById("btn-tanker-autoload");
    if (btnAuto) {
      btnAuto.addEventListener("click", () => {
        if (this.state.autoLoadTankerCargo) {
          this.state.autoLoadTankerCargo();
          this.render();
        }
      });
    }

    // Dispatch Tanker
    const btnDispatch = document.getElementById("btn-dispatch-tanker");
    if (btnDispatch) {
      let dispatching = false;
      const handleDispatch = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (dispatching) return;
        dispatching = true;
        setTimeout(() => { dispatching = false; }, 400);

        if (this.state.marineTerminal) {
          this.state.marineTerminal.unlocked = true;
        }

        if (this.state.dispatchTanker) {
          const success = this.state.dispatchTanker();
          if (success) {
            try {
              if (typeof audio?.playShipHorn === "function") {
                audio.playShipHorn();
              } else if (typeof audio?.playHorn === "function") {
                audio.playHorn();
              }
            } catch (err) {}
          }
          this.render();
        }
      };

      btnDispatch.addEventListener("click", handleDispatch);
      btnDispatch.addEventListener("pointerup", handleDispatch);
    }
  }

  isOpen() {
    return this.modalEl && !this.modalEl.classList.contains("hidden");
  }

  open() {
    if (!this.modalEl) return;
    this.state?.emit?.("closeAllBottomSheets");
    if (this.state && this.state.marineTerminal) {
      this.state.marineTerminal.unlocked = true;
    }
    this.modalEl.classList.remove("hidden");
    const dock = document.getElementById("township-dock");
    if (dock) dock.classList.add("dock-hidden-by-sheet");
    this.render();

    if (this.liveTimer) clearInterval(this.liveTimer);
    this.liveTimer = setInterval(() => this.updateLiveProgress(), 250);
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    const dock = document.getElementById("township-dock");
    if (dock) dock.classList.remove("dock-hidden-by-sheet");
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
    if (typeof window !== "undefined" && window.townshipCoordinator) {
      window.townshipCoordinator.syncActiveButton();
    }
  }

  getStatusMeta(statusKey) {
    switch (statusKey) {
      case "approaching":
        return { label: "ПОДХОД К ПРИЧАЛУ", icon: "🚢", color: "#38bdf8", busy: true };
      case "berthing":
        return { label: "ШВАРТОВКА К ТЕРМИНАЛУ", icon: "⚓", color: "#38bdf8", busy: true };
      case "loading":
        return { label: "НАЛИВ ЧЕРЕЗ СТЕНДЕРЫ CHIKSAN", icon: "⛽", color: "#22c55e", busy: true };
      case "departing":
        return { label: "ОТХОД И ЛЕДОКОЛЬНАЯ ПРОВОДКА", icon: "🌊", color: "#38bdf8", busy: true };
      case "voyage":
        return { label: "В РЕЙСЕ ПО СЕВМОРПУТИ", icon: "❄️", color: "#00a3e0", busy: true };
      case "returned":
        return { label: "ВОЗВРАЩЕНИЕ В ПОРТ", icon: "🎉", color: "#f59e0b", busy: true };
      case "idle":
      default:
        return { label: "В ПОРТУ (ОЖИДАНИЕ НАЛИВА)", icon: "⚓", color: "#94a3b8", busy: false };
    }
  }

  updateLiveProgress() {
    if (!this.isOpen() || !this.state.marineTerminal) return;
    const terminal = this.state.marineTerminal;
    const status = terminal.tankerState || terminal.state || "idle";
    const statusMeta = this.getStatusMeta(status);

    const progressFill = document.getElementById("tanker-progress-fill");
    const timerLabel = document.getElementById("tanker-live-timer");
    const statusLabel = document.getElementById("tanker-status-text");

    if (statusLabel) {
      statusLabel.textContent = `${statusMeta.icon} ${statusMeta.label}`;
      statusLabel.style.color = statusMeta.color;
    }

    if (status === "voyage") {
      const vDur = terminal.voyageDuration || 60.0;
      const vProg = Math.max(0, Math.min(1.0, terminal.voyageProgress || (1.0 - (terminal.voyageTimer || 0) / vDur)));
      const pct = (vProg * 100).toFixed(1);
      const remainingSec = Math.max(0, (vDur * (1 - vProg))).toFixed(1);

      if (progressFill) progressFill.style.width = `${pct}%`;
      if (timerLabel) timerLabel.textContent = `До прибытия: ${remainingSec} с (${pct}%)`;
    } else if (status === "loading" || status === "approaching" || status === "berthing" || status === "departing") {
      const stageTimer = terminal.stageTimer || 0;
      const totalStage = status === "loading" ? 5.0 : status === "departing" ? 5.0 : status === "approaching" ? 5.0 : 3.0;
      const pct = Math.min(100, (stageTimer / totalStage) * 100).toFixed(0);

      if (progressFill) progressFill.style.width = `${pct}%`;
      if (timerLabel) timerLabel.textContent = `Операция: ${stageTimer.toFixed(1)} / ${totalStage.toFixed(1)} с`;
    } else {
      if (progressFill) progressFill.style.width = status === "returned" ? "100%" : "0%";
      if (timerLabel) timerLabel.textContent = status === "returned" ? "Выплата завершена" : "Готов к погрузке";
    }
  }

  render() {
    if (!this.modalEl || !this.state.marineTerminal) return;
    const terminal = this.state.marineTerminal;
    const status = terminal.tankerState || terminal.state || "idle";
    const statusMeta = this.getStatusMeta(status);

    // 1. Live status & progress
    this.updateLiveProgress();

    // 2. Capacity Upgrade Card
    const capLevel = typeof this.state.getTankerCapacityLevel === "function" ? this.state.getTankerCapacityLevel() : 1;
    const capValues = CONFIG.TANKER?.CAPACITY_VALUES || [2000, 3500, 5500, 8000, 12000];
    const capCur = this.state.getTankerCargoCapacity ? this.state.getTankerCargoCapacity() : (capValues[capLevel - 1] || 2000);
    const capNext = capLevel < 5 ? (capValues[capLevel] || capCur) : capCur;
    const capCost = typeof this.state.getTankerCapacityUpgradeCost === "function" ? this.state.getTankerCapacityUpgradeCost() : Infinity;
    const canCap = typeof this.state.canUpgradeTankerCapacity === "function" ? this.state.canUpgradeTankerCapacity() : false;

    const elCapLvl = document.getElementById("tanker-cap-lvl");
    const elCapStat = document.getElementById("tanker-cap-stat");
    const elCapCost = document.getElementById("tanker-cap-cost");
    const btnCap = document.getElementById("btn-upgrade-tanker-capacity");

    if (elCapLvl) elCapLvl.textContent = `УРОВЕНЬ ${capLevel} / 5`;
    if (elCapStat) {
      elCapStat.textContent = capLevel >= 5
        ? `${capCur.toLocaleString("ru-RU")} барр. (МАКС)`
        : `${capCur.toLocaleString("ru-RU")} ➔ ${capNext.toLocaleString("ru-RU")} барр.`;
    }
    if (elCapCost) {
      elCapCost.textContent = capLevel >= 5 ? "МАКСИМУМ" : `${capCost.toLocaleString("ru-RU")} ₽`;
    }
    if (btnCap) {
      btnCap.disabled = !canCap || capLevel >= 5;
      btnCap.classList.toggle("disabled", !canCap || capLevel >= 5);
    }

    // 3. Speed Upgrade Card
    const spdLevel = typeof this.state.getTankerSpeedLevel === "function" ? this.state.getTankerSpeedLevel() : 1;
    const spdDurations = CONFIG.TANKER?.SPEED_DURATIONS || [60.0, 45.0, 32.0, 22.0, 15.0];
    const spdCur = typeof this.state.getTankerVoyageDuration === "function" ? this.state.getTankerVoyageDuration() : (spdDurations[spdLevel - 1] || 60.0);
    const spdNext = spdLevel < 5 ? (spdDurations[spdLevel] || spdCur) : spdCur;
    const spdCost = typeof this.state.getTankerSpeedUpgradeCost === "function" ? this.state.getTankerSpeedUpgradeCost() : Infinity;
    const canSpd = typeof this.state.canUpgradeTankerSpeed === "function" ? this.state.canUpgradeTankerSpeed() : false;

    const elSpdLvl = document.getElementById("tanker-spd-lvl");
    const elSpdStat = document.getElementById("tanker-spd-stat");
    const elSpdCost = document.getElementById("tanker-spd-cost");
    const btnSpd = document.getElementById("btn-upgrade-tanker-speed");

    if (elSpdLvl) elSpdLvl.textContent = `УРОВЕНЬ ${spdLevel} / 5`;
    if (elSpdStat) {
      elSpdStat.textContent = spdLevel >= 5
        ? `${spdCur.toFixed(0)} с (МАКС)`
        : `${spdCur.toFixed(0)} с ➔ ${spdNext.toFixed(0)} с`;
    }
    if (elSpdCost) {
      elSpdCost.textContent = spdLevel >= 5 ? "МАКСИМУМ" : `${spdCost.toLocaleString("ru-RU")} ₽`;
    }
    if (btnSpd) {
      btnSpd.disabled = !canSpd || spdLevel >= 5;
      btnSpd.classList.toggle("disabled", !canSpd || spdLevel >= 5);
    }

    // 4. Cargo Manifest & Hold Capacity
    const holdCap = this.state.getTankerCargoCapacity ? this.state.getTankerCargoCapacity() : 2000;
    const holdCargo = terminal.cargo || {};
    const holdLoaded = Object.values(holdCargo).reduce((s, v) => s + (v || 0), 0);

    const elHoldSum = document.getElementById("tanker-hold-summary");
    if (elHoldSum) {
      elHoldSum.textContent = `${holdLoaded.toLocaleString("ru-RU")} / ${holdCap.toLocaleString("ru-RU")} барр.`;
    }

    const holdPct = Math.min(100, (holdLoaded / holdCap) * 100).toFixed(0);
    const elHoldFill = document.getElementById("tanker-hold-bar-fill");
    if (elHoldFill) {
      elHoldFill.style.width = `${holdPct}%`;
    }

    // Auto-load button state
    const btnAuto = document.getElementById("btn-tanker-autoload");
    if (btnAuto) {
      const hasRoom = holdLoaded < holdCap;
      const hasInventory = this.commodities.some(c => (this.state.inventory?.[c.id] || 0) > 0);
      btnAuto.disabled = statusMeta.busy || !hasRoom || !hasInventory;
    }

    // Cargo Items List
    const cargoListEl = document.getElementById("tanker-cargo-list");
    if (cargoListEl) {
      cargoListEl.innerHTML = this.commodities.map(comm => {
        const inStock = Math.floor(this.state.inventory?.[comm.id] || 0);
        const inHold = Math.floor(holdCargo[comm.id] || 0);
        const canLoad = !statusMeta.busy && inStock > 0 && holdLoaded < holdCap;

        return `
          <div class="tanker-cargo-row" data-commodity="${comm.id}">
            <div class="cargo-row-info">
              <span class="cargo-icon" style="color:${comm.color}">${comm.icon}</span>
              <div class="cargo-name-group">
                <span class="cargo-name">${comm.name}</span>
                <span class="cargo-stock-sub">На складе: ${inStock.toLocaleString("ru-RU")} барр.</span>
              </div>
            </div>
            <div class="cargo-row-action">
              <span class="cargo-in-hold ${inHold > 0 ? "loaded" : ""}">${inHold.toLocaleString("ru-RU")} в трюме</span>
              <button class="btn-load-cargo-item ${!canLoad ? "disabled" : ""}" data-comm="${comm.id}" type="button" ${!canLoad ? "disabled" : ""}>
                + Загрузить
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Bind individual load buttons
      cargoListEl.querySelectorAll(".btn-load-cargo-item").forEach(btn => {
        btn.addEventListener("click", () => {
          const commId = btn.getAttribute("data-comm");
          if (commId && this.state.loadTankerCargo) {
            this.state.loadTankerCargo(commId);
            this.render();
          }
        });
      });
    }

    // 5. Dispatch Button
    const btnDispatch = document.getElementById("btn-dispatch-tanker");
    const elDispatchHint = document.getElementById("tanker-dispatch-hint");
    if (btnDispatch) {
      const isIdle = status === "idle";
      const hasCargo = holdLoaded > 0;
      const canDispatch = isIdle && hasCargo;

      btnDispatch.disabled = !canDispatch;
      btnDispatch.classList.toggle("disabled", !canDispatch);
      btnDispatch.classList.toggle("pulse", canDispatch);

      if (elDispatchHint) {
        if (!isIdle) {
          elDispatchHint.textContent = `Танкер выполняет рейс • ${statusMeta.label}`;
        } else if (!hasCargo) {
          elDispatchHint.textContent = "Загрузите нефть или топливо в трюмы для отправки";
        } else {
          elDispatchHint.textContent = `Готов к выходу в Карское море • Загружено ${holdLoaded.toLocaleString("ru-RU")} барр.`;
        }
      }
    }
  }
}
