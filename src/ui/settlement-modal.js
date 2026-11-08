/**
 * settlement-modal.js — Worker Settlement «Северная Звезда» View Coordinator (Milestone M3 Township)
 * 
 * Manages life-support vitals in -45°C Arctic frost:
 * - Boiler heating simulation & fuel monitoring (warmth gauge)
 * - Housing module upgrades & demographic population expansion
 * - Canteen morale & Arctic hot rations boost
 * - Interactive 4-sector workforce shift allocation matrix (Wells, Refinery, GPZ, Petrochem)
 * 
 * Strict compliance with Emil Kowalski Design Engineering & Zero-GC UI patterns.
 */

import { CONFIG } from "../config.js";

export class SettlementModalView {
  constructor(state) {
    this.state = state;
    this.modal = null;
    this.closeBtn = null;
    this.shiftsGrid = null;
    this.isOpen = false;
    this.cachedState = null;
    this._rafId = null;
  }

  init() {
    this.modal = document.getElementById("modal-settlement");
    if (!this.modal) return;

    this.closeBtn = document.getElementById("btn-close-settlement-modal");
    this.shiftsGrid = document.getElementById("settlement-shifts-grid");

    // Open button in HUD
    const hudBtn = document.getElementById("btn-open-settlement");
    if (hudBtn) {
      hudBtn.addEventListener("click", () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", () => this.close());
    }

    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) {
          this.close();
        }
      });
    }

    // Action button listeners
    const btnBoiler = document.getElementById("btn-upgrade-boiler");
    if (btnBoiler) {
      btnBoiler.addEventListener("click", () => this.handleUpgradeBoiler());
    }

    const btnHousing = document.getElementById("btn-upgrade-housing");
    if (btnHousing) {
      btnHousing.addEventListener("click", () => this.handleUpgradeHousing());
    }

    const btnRations = document.getElementById("btn-distribute-rations");
    if (btnRations) {
      btnRations.addEventListener("click", () => this.handleDistributeRations());
    }

    const btnAuto = document.getElementById("btn-auto-allocate-shifts");
    if (btnAuto) {
      btnAuto.addEventListener("click", () => this.autoAllocateShifts());
    }

    // Subscribe to State Events
    if (this.state && typeof this.state.on === "function") {
      this.state.on("openSettlementModal", () => this.open());
      this.state.on("settlementShiftsChanged", () => this.render());
      this.state.on("settlementHousingUpgraded", () => this.render());
      this.state.on("settlementBoilerUpgraded", () => this.render());
      this.state.on("settlementRationsDistributed", () => this.render());
      this.state.on("settlementPopulationGrowth", () => this.render());
      this.state.on("canteenUpgraded", () => this.render());
    }
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.remove("hidden");
    this.modal.classList.add("entering");
    this.isOpen = true;
    this.render();

    // Start live poll loop for smooth warmth bar and ration countdown updates
    this.startLiveLoop();
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.add("hidden");
    this.modal.classList.remove("entering");
    this.isOpen = false;
    this.stopLiveLoop();
  }

  startLiveLoop() {
    this.stopLiveLoop();
    const tick = () => {
      if (this.isOpen) {
        this.updateVitalsOnly();
        this._rafId = requestAnimationFrame(tick);
      }
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stopLiveLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  handleUpgradeBoiler() {
    if (this.state && typeof this.state.upgradeBoiler === "function") {
      const ok = this.state.upgradeBoiler();
      if (ok) this.render();
    }
  }

  handleUpgradeHousing() {
    if (this.state && typeof this.state.upgradeHousing === "function") {
      const ok = this.state.upgradeHousing();
      if (ok) this.render();
    }
  }

  handleDistributeRations() {
    if (this.state && typeof this.state.distributeRations === "function") {
      const ok = this.state.distributeRations();
      if (ok) this.render();
    }
  }

  autoAllocateShifts() {
    if (!this.state || !this.state.settlement) return;
    const s = this.state.settlement;
    const pop = s.population || 24;
    const sectors = ["wells", "refinery", "gas_plant", "petrochem"];
    const perSector = Math.floor(pop / sectors.length);
    const remainder = pop % sectors.length;

    s.shifts = {
      wells: perSector + (remainder > 0 ? 1 : 0),
      refinery: perSector + (remainder > 1 ? 1 : 0),
      gas_plant: perSector + (remainder > 2 ? 1 : 0),
      petrochem: perSector
    };

    if (typeof this.state.emit === "function") {
      this.state.emit("settlementShiftsChanged", { sector: "all", shifts: { ...s.shifts }, settlement: s });
    }
    this.render();
  }

  allocateShift(sector, delta) {
    if (this.state && typeof this.state.allocateShiftWorker === "function") {
      this.state.allocateShiftWorker(sector, delta);
      this.render();
    }
  }

  updateVitalsOnly() {
    if (!this.state || !this.state.settlement) return;
    const s = this.state.settlement;

    // 1. Warmth Gauge
    const warmth = Math.max(0, Math.min(100, typeof s.warmthLevel === "number" ? s.warmthLevel : 100.0));
    const warmthVal = document.getElementById("settlement-warmth-val");
    const warmthBar = document.getElementById("settlement-warmth-bar");
    const boilerStatus = document.getElementById("settlement-boiler-status");

    if (warmthBar) {
      warmthBar.style.width = `${warmth.toFixed(1)}%`;
      if (warmth >= 70) {
        warmthBar.className = "vital-progress-fill cyan-fill";
      } else if (warmth >= 20) {
        warmthBar.className = "vital-progress-fill yellow-fill";
      } else {
        warmthBar.className = "vital-progress-fill red-fill";
      }
    }

    if (warmthVal) {
      const tempC = Math.round(-45 + (warmth / 100) * 67); // -45°C to +22°C
      warmthVal.textContent = `${warmth.toFixed(0)}% (${tempC > 0 ? `+${tempC}` : tempC}°C)`;
      warmthVal.className = warmth >= 70 ? "vital-val cyan-text" : warmth >= 20 ? "vital-val yellow-text" : "vital-val red-text";
    }

    if (boilerStatus) {
      if (warmth >= 70) {
        boilerStatus.textContent = "Отопление: в норме (+22°C в модулях)";
      } else if (warmth >= 20) {
        boilerStatus.textContent = "⚠️ Прохладно (+8°C). Снижение КПД на 15%";
      } else {
        boilerStatus.textContent = "🚨 МОРОЗ (-50% К СМЕНАМ! НУЖЕН ГАЗ/ДИЗЕЛЬ)";
      }
    }

    // 2. Ration Boost Countdown
    const rationTimer = document.getElementById("settlement-ration-timer");
    const btnRations = document.getElementById("btn-distribute-rations");
    if (rationTimer) {
      if (s.rationBoostSec > 0) {
        const m = Math.floor(s.rationBoostSec / 60);
        const sec = Math.floor(s.rationBoostSec % 60);
        rationTimer.textContent = `⚡ Паёк активен: ${m}:${sec < 10 ? '0' : ''}${sec}`;
        rationTimer.className = "vital-subtext green-text";
        if (btnRations) btnRations.disabled = true;
      } else {
        rationTimer.textContent = "Паёк: готов к раздаче";
        rationTimer.className = "vital-subtext";
        if (btnRations) btnRations.disabled = false;
      }
    }
  }

  render() {
    if (!this.state || !this.state.settlement) return;
    const s = this.state.settlement;
    this.updateVitalsOnly();

    // 1. Boiler Upgrade Button State
    const btnBoiler = document.getElementById("btn-upgrade-boiler");
    if (btnBoiler && typeof this.state.getBoilerUpgradeCost === "function") {
      const bCost = this.state.getBoilerUpgradeCost();
      if (bCost) {
        btnBoiler.textContent = `Ур. ${bCost.nextLvl} • ${bCost.money.toLocaleString("ru-RU")} ₽ + ${bCost.mtr} МТР`;
        btnBoiler.disabled = !this.state.canUpgradeBoiler();
      } else {
        btnBoiler.textContent = `МАКС. УРОВЕНЬ (5/5)`;
        btnBoiler.disabled = true;
      }
    }

    // 2. Housing Modules
    const popVal = document.getElementById("settlement-pop-val");
    const popBar = document.getElementById("settlement-pop-bar");
    const freeWorkersVal = document.getElementById("settlement-free-workers-val");
    const btnHousing = document.getElementById("btn-upgrade-housing");

    const pop = s.population || 24;
    const maxPop = s.maxPopulation || 40;
    const shifts = s.shifts || { wells: 8, refinery: 6, gas_plant: 5, petrochem: 5 };
    const allocated = Object.values(shifts).reduce((a, b) => a + b, 0);
    const free = Math.max(0, pop - allocated);

    if (popVal) popVal.textContent = `${pop} / ${maxPop} чел`;
    if (popBar) popBar.style.width = `${Math.min(100, (pop / maxPop) * 100).toFixed(0)}%`;
    if (freeWorkersVal) {
      freeWorkersVal.textContent = `Свободно для смен: ${free} чел`;
      freeWorkersVal.className = free > 0 ? "vital-subtext cyan-text" : "vital-subtext";
    }

    if (btnHousing && typeof this.state.getHousingUpgradeCost === "function") {
      const hCost = this.state.getHousingUpgradeCost();
      if (hCost) {
        btnHousing.textContent = `Ур. ${hCost.nextLvl} • ${hCost.money.toLocaleString("ru-RU")} ₽ + ${hCost.mtr} МТР`;
        btnHousing.disabled = !this.state.canUpgradeHousing();
      } else {
        btnHousing.textContent = `МАКС. УРОВЕНЬ (5/5)`;
        btnHousing.disabled = true;
      }
    }

    // 3. Canteen Morale
    const moraleVal = document.getElementById("settlement-morale-val");
    const canteenLvl = Math.max(1, this.state.canteenLevel || s.canteenLevel || 1);
    const canteenData = CONFIG.SETTLEMENT?.canteen?.levels?.[canteenLvl];
    const baseMoralePct = Math.round(((canteenData?.moraleBonus) ?? (0.10 * canteenLvl)) * 100);
    const rationActive = s.rationBoostSec > 0;
    if (moraleVal) {
      moraleVal.textContent = rationActive ? `+${baseMoralePct + 25}% (Усиленный паёк)` : `+${baseMoralePct}%`;
    }

    // 4. Render 4 Sector Shift Cards
    if (this.shiftsGrid) {
      this.shiftsGrid.innerHTML = "";
      const sectorDefs = [
        {
          id: "wells",
          name: "Кусты скважин",
          badge: "ДОБЫЧА СЫРЬЯ",
          icon: "⛽",
          eff: "+1.5% дебит / чел",
          desc: "Операторы ДНГ обслуживают фонтанную арматуру кустовых площадок."
        },
        {
          id: "refinery",
          name: "НПЗ «Северный Факел»",
          badge: "ПЕРЕГОНКА ТОПЛИВА",
          icon: "🏭",
          eff: "+2.0% скорость / чел",
          desc: "Технологи атмосферно-вакуумной трубчатки глубокой переработки нефти."
        },
        {
          id: "gas_plant",
          name: "ГПЗ «Полярный Метан»",
          badge: "ПОДГОТОВКА ГАЗА",
          icon: "❄️",
          eff: "+2.0% скорость / чел",
          desc: "Инженеры криогенного разделения фракций метана, СУГ и гелия."
        },
        {
          id: "petrochem",
          name: "НГХК «Сибирский Полимер»",
          badge: "СИНТЕЗ ПОЛИМЕРОВ",
          icon: "🧪",
          eff: "+2.0% скорость / чел",
          desc: "Аппаратчики полимеризации гранулированного полиэтилена и композитов."
        }
      ];

      sectorDefs.forEach(def => {
        const count = shifts[def.id] || 0;
        const card = document.createElement("div");
        card.className = "shift-sector-card";

        const bonusMult = typeof this.state.getSettlementBonus === "function" ? this.state.getSettlementBonus(def.id) : 1.0;
        const bonusPct = ((bonusMult - 1.0) * 100).toFixed(1);

        card.innerHTML = `
          <div class="shift-card-header">
            <div class="shift-icon-wrap">${def.icon}</div>
            <div class="shift-title-wrap">
              <div class="shift-badge badge-gazprom">${def.badge}</div>
              <h4 class="shift-title">${def.name}</h4>
              <span class="shift-desc">${def.desc}</span>
            </div>
          </div>
          <div class="shift-rate-info">
            <span class="shift-eff-pill">${def.eff}</span>
            <span class="shift-total-bonus cyan-text">+${bonusPct}%</span>
          </div>
          <div class="shift-stepper-wrap">
            <button class="btn-shift-step btn-step-minus" type="button" aria-label="Уменьшить смену" ${count <= 0 ? 'disabled' : ''}>−</button>
            <div class="shift-counter-box">
              <span class="shift-count-number">${count}</span>
              <span class="shift-count-unit">чел</span>
            </div>
            <button class="btn-shift-step btn-step-plus" type="button" aria-label="Увеличить смену" ${free <= 0 ? 'disabled' : ''}>+</button>
          </div>
        `;

        const minusBtn = card.querySelector(".btn-step-minus");
        const plusBtn = card.querySelector(".btn-step-plus");

        if (minusBtn) {
          minusBtn.addEventListener("click", () => this.allocateShift(def.id, -1));
        }
        if (plusBtn) {
          plusBtn.addEventListener("click", () => this.allocateShift(def.id, 1));
        }

        this.shiftsGrid.appendChild(card);
      });
    }
  }
}
