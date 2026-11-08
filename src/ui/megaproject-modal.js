/**
 * megaproject-modal.js — Megaproject «Ямал-СПГ» & Endless Horizon View Coordinator (Milestone M5 Township)
 * 
 * Features:
 * - 4-stage monumental industrial construction (Piles, Cryo Tanks, Liquefaction Trains, Sabetta Port)
 * - Material requirements validation (MTR materials, Rubles, Dollars, Commodities)
 * - Dynamic Polar Seasons tracker (Polar Day, Polar Night, Ice Breakup) with live buffs
 * - Infinite Tycoon Corporate Prestige progression (Tiers 1..100+)
 * 
 * Complies with Emil Kowalski Design Engineering & Zero-GC patterns.
 */

import { CONFIG } from "../config.js";

export class MegaprojectModalView {
  constructor(state) {
    this.state = state;
    this.modal = null;
    this.closeBtn = null;
    this.stagesContainer = null;
    this.seasonBanner = null;
    this.isOpen = false;
    this._rafId = null;
  }

  init() {
    this.modal = document.getElementById("modal-megaproject");
    if (!this.modal) return;

    this.closeBtn = document.getElementById("btn-close-megaproject-modal");
    this.stagesContainer = document.getElementById("megaproject-stages-list");
    this.seasonBanner = document.getElementById("megaproject-season-banner");

    // HUD Trigger Button
    const hudBtn = document.getElementById("btn-open-megaproject");
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

    // Prestige upgrade button
    const btnPrestige = document.getElementById("btn-advance-prestige");
    if (btnPrestige) {
      btnPrestige.addEventListener("click", () => {
        if (this.state && typeof this.state.advanceCorporatePrestige === "function") {
          this.state.advanceCorporatePrestige();
          this.render();
        }
      });
    }

    // Subscribe to State Events
    if (this.state && typeof this.state.on === "function") {
      this.state.on("openMegaprojectModal", () => this.open());
      this.state.on("megaprojectStageCompleted", () => this.render());
      this.state.on("megaprojectCompleted", () => this.render());
      this.state.on("seasonChanged", () => this.render());
      this.state.on("corporatePrestigeAdvanced", () => this.render());
    }
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.remove("hidden");
    this.modal.classList.add("entering");
    this.isOpen = true;
    this.render();
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
        this.updateSeasonCountdown();
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

  updateSeasonCountdown() {
    if (!this.state || !this.state.megaproject) return;
    const m = this.state.megaproject;
    const timerEl = document.getElementById("megaproject-season-timer");
    if (timerEl && typeof m.seasonTimer === "number") {
      const min = Math.floor(m.seasonTimer / 60);
      const sec = Math.floor(m.seasonTimer % 60);
      timerEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }
  }

  handleBuildStage() {
    if (this.state && typeof this.state.buildMegaprojectStage === "function") {
      const ok = this.state.buildMegaprojectStage();
      if (ok) this.render();
    }
  }

  render() {
    if (!this.state || !this.state.megaproject) return;
    const m = this.state.megaproject;
    const curStage = m.currentStage || 0;
    const totalStages = CONFIG.MEGAPROJECT?.totalStages || 4;

    // 1. Season Banner
    const seasonId = m.activeSeason || "polar_day";
    const seasonDef = CONFIG.MEGAPROJECT?.seasons?.[seasonId] || { name: "Полярный день", icon: "☀️", buffDesc: "+25% скорость" };
    const seasonNameEl = document.getElementById("megaproject-season-name");
    const seasonIconEl = document.getElementById("megaproject-season-icon");
    const seasonBuffEl = document.getElementById("megaproject-season-buff");

    if (seasonNameEl) seasonNameEl.textContent = seasonDef.name;
    if (seasonIconEl) seasonIconEl.textContent = seasonDef.icon;
    if (seasonBuffEl) seasonBuffEl.textContent = seasonDef.buffDesc;
    this.updateSeasonCountdown();

    // 2. Global Progress Bar & Stage Indicator
    const progressFill = document.getElementById("megaproject-progress-bar");
    const stageIndicator = document.getElementById("megaproject-stage-indicator");
    const progressPct = Math.min(100, (curStage / totalStages) * 100);

    if (progressFill) progressFill.style.width = `${progressPct}%`;
    if (stageIndicator) {
      stageIndicator.textContent = m.completed ? "СТРОИТЕЛЬСТВО ЗАВЕРШЕНО (4/4)" : `ЭТАП ${curStage + 1} ИЗ ${totalStages}`;
    }

    // 3. Render 4 Monumental Stages
    if (this.stagesContainer) {
      this.stagesContainer.innerHTML = "";
      const stagesConfig = CONFIG.MEGAPROJECT?.stages || {};

      for (let s = 1; s <= totalStages; s++) {
        const def = stagesConfig[s];
        if (!def) continue;

        const isCompleted = curStage >= s;
        const isCurrent = curStage + 1 === s;
        const isLocked = curStage + 1 < s;

        const card = document.createElement("div");
        card.className = `megaproject-stage-card ${isCompleted ? 'completed' : isCurrent ? 'current' : 'locked'}`;

        let costItemsHtml = "";
        costItemsHtml += `<span class="cost-tag money-tag">💰 ${def.costMoney.toLocaleString("ru-RU")} ₽</span>`;
        costItemsHtml += `<span class="cost-tag mtr-tag">🏗️ ${def.costMtr} МТР</span>`;
        if (def.costDollars > 0) {
          costItemsHtml += `<span class="cost-tag dollars-tag">💵 ${def.costDollars} $</span>`;
        }
        if (def.costGoods) {
          for (const [gKey, gQty] of Object.entries(def.costGoods)) {
            const gName = gKey === "polymers" ? "полимеров" : gKey === "lpg" ? "СУГ" : "метана";
            const curQty = (this.state.inventory && this.state.inventory[gKey]) || 0;
            const hasEnough = curQty >= gQty;
            costItemsHtml += `<span class="cost-tag good-tag ${hasEnough ? '' : 'insufficient'}">📦 ${gQty} ${gName}</span>`;
          }
        }

        let actionHtml = "";
        if (isCompleted) {
          actionHtml = `<div class="stage-status-badge completed-badge">✓ ЭТАП СДАН В ЭКСПЛУАТАЦИЮ</div>`;
        } else if (isCurrent) {
          const canBuild = this.state.canBuildMegaprojectStage();
          actionHtml = `
            <button class="btn-build-stage ${canBuild ? '' : 'disabled'}" type="button" ${canBuild ? '' : 'disabled'}>
              🏗️ ВОЗВЕСТИ ОБЪЕКТ
            </button>
          `;
        } else {
          actionHtml = `<div class="stage-status-badge locked-badge">🔒 ЗАБЛОКИРОВАНО</div>`;
        }

        card.innerHTML = `
          <div class="stage-card-header">
            <div class="stage-number-pill">ФАЗА ${s}</div>
            <h4 class="stage-card-title">${def.title}</h4>
          </div>
          <p class="stage-card-desc">${def.desc}</p>
          <div class="stage-reward-box">
            <span class="stage-reward-label">Награда за сдачу фазы:</span>
            <span class="stage-reward-val cyan-text">★ ${def.rewardDesc}</span>
          </div>
          <div class="stage-costs-row">
            ${costItemsHtml}
          </div>
          <div class="stage-action-wrap">
            ${actionHtml}
          </div>
        `;

        const btnBuild = card.querySelector(".btn-build-stage");
        if (btnBuild) {
          btnBuild.addEventListener("click", () => this.handleBuildStage());
        }

        this.stagesContainer.appendChild(card);
      }
    }

    // 4. Endless Prestige Section
    const prestigeSection = document.getElementById("megaproject-prestige-section");
    if (prestigeSection) {
      if (m.completed) {
        prestigeSection.classList.remove("hidden");
        const lvlVal = document.getElementById("prestige-level-val");
        const costVal = document.getElementById("prestige-cost-val");
        const btnPrestige = document.getElementById("btn-advance-prestige");

        const curLvl = m.corporatePrestigeLevel || 1;
        const threshold = 50000000 * Math.pow(1.5, curLvl - 1);

        if (lvlVal) lvlVal.textContent = `УРОВЕНЬ ${curLvl}`;
        if (costVal) costVal.textContent = `${threshold.toLocaleString("ru-RU")} ₽`;
        if (btnPrestige) {
          btnPrestige.disabled = (this.state.money || 0) < threshold;
        }
      } else {
        prestigeSection.classList.add("hidden");
      }
    }
  }
}
