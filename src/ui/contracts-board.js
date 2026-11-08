/**
 * src/ui/contracts-board.js
 * Regional Contracts & Logistics Board (Township Oil Hub M2)
 * Features dynamic orders from Arctic factions, caravan dispatches, MTR materials rewards.
 * Adheres strictly to Emil Kowalski design engineering principles and Gazprom corporate styling.
 */

import { CONFIG } from "../config.js";
import { audio } from "../audio.js";

export class ContractsBoardView {
  constructor(state) {
    this.state = state;
    this.modalEl = null;
    this.gridEl = null;
    this.mtrValEl = null;
    this.fulfilledValEl = null;
    this.closeBtn = null;
    this.liveTimer = null;
  }

  init() {
    this.modalEl = document.getElementById("modal-contracts-board");
    if (!this.modalEl) return;

    this.gridEl = document.getElementById("contracts-cards-grid");
    this.mtrValEl = document.getElementById("contracts-mtr-val");
    this.fulfilledValEl = document.getElementById("contracts-fulfilled-val");
    this.closeBtn = document.getElementById("btn-close-contracts-modal");

    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", () => this.close());
    }

    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const hudBtn = document.getElementById("btn-open-contracts");
    if (hudBtn) {
      hudBtn.addEventListener("click", () => this.open());
    }

    // Wire state listeners
    if (this.state && typeof this.state.on === "function") {
      this.state.on("openContractsModal", () => this.open());
      this.state.on("openContractsBoard", () => this.open());
      this.state.on("renderContractsInline", () => this.renderInlineActive());
      this.state.on("contractFulfilled", () => {
        if (this.isOpen()) this.render();
        this.renderInlineActive();
      });
      this.state.on("contractDismissed", () => {
        if (this.isOpen()) this.render();
        this.renderInlineActive();
      });
      this.state.on("contractSpawned", () => {
        if (this.isOpen()) this.render();
        this.renderInlineActive();
      });
      this.state.on("contractDelivered", () => {
        if (this.isOpen()) this.render();
        this.renderInlineActive();
      });
      this.state.on("inventoryChanged", () => {
        if (this.isOpen()) this.render();
        this.renderInlineActive();
      });
      this.state.on("mtrChanged", () => {
        this.updateCounters();
      });
    }

    // Connect to dispatcher tab clicks
    const tabs = document.querySelectorAll(".btn-dispatch-tab[data-tab='contracts']");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        this.renderInlineActive();
      });
    });
  }

  isOpen() {
    return this.modalEl && !this.modalEl.classList.contains("hidden");
  }

  open() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove("hidden");
    this.render();

    if (this.liveTimer) clearInterval(this.liveTimer);
    this.liveTimer = setInterval(() => this.updateLiveTimers(), 1000);
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
  }

  updateCounters() {
    if (this.mtrValEl) {
      this.mtrValEl.textContent = `${this.state.mtrMaterials || 0} шт`;
    }
    if (this.fulfilledValEl) {
      this.fulfilledValEl.textContent = String(this.state.totalContractsFulfilled || 0);
    }
  }

  render() {
    this.updateCounters();
    if (!this.gridEl) return;

    const contracts = this.state.getContracts();
    this.gridEl.innerHTML = "";

    contracts.forEach((contract) => {
      const card = this.buildContractCard(contract);
      this.gridEl.appendChild(card);
    });
  }

  renderInlineActive() {
    const containers = [
      document.getElementById("dispatcher-content"),
      document.getElementById("dispatcher-modal-content")
    ].filter(Boolean);

    containers.forEach(container => {
      const activeTab = document.querySelector(".btn-dispatch-tab.active");
      if (activeTab && activeTab.getAttribute("data-tab") === "contracts") {
        container.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.className = "contracts-inline-wrapper";

        const statsBar = document.createElement("div");
        statsBar.className = "contracts-stats-bar inline";
        statsBar.innerHTML = `
          <div class="contract-stat-pill mtr-pill">
            <span class="pill-icon">🏗️</span>
            <span class="pill-label">МТР:</span>
            <span class="pill-val gold-text">${this.state.mtrMaterials || 0} шт</span>
          </div>
          <div class="contract-stat-pill orders-pill">
            <span class="pill-icon">📦</span>
            <span class="pill-label">Выполнено:</span>
            <span class="pill-val cyan-text">${this.state.totalContractsFulfilled || 0}</span>
          </div>
        `;
        wrapper.appendChild(statsBar);

        const grid = document.createElement("div");
        grid.className = "contracts-cards-grid";
        const contracts = this.state.getContracts();
        contracts.forEach(c => grid.appendChild(this.buildContractCard(c)));
        wrapper.appendChild(grid);

        container.appendChild(wrapper);
      }
    });
  }

  buildContractCard(contract) {
    const card = document.createElement("div");
    card.className = `contract-card state-${contract.status}`;
    card.setAttribute("data-contract-id", contract.id);

    if (contract.status === "delivering") {
      const progressPct = contract.totalDuration > 0
        ? Math.max(0, Math.min(100, Math.round(((contract.totalDuration - contract.timer) / contract.totalDuration) * 100)))
        : 50;

      card.innerHTML = `
        <div class="contract-header">
          <div class="contract-avatar">${contract.factionIcon || "🚚"}</div>
          <div class="contract-meta">
            <div class="contract-faction-badge" style="background:${contract.factionColor}22;color:${contract.factionColor};border-color:${contract.factionColor}66;">
              ${contract.factionBadge || "В ПУТИ"}
            </div>
            <h3 class="contract-title">${contract.factionName}</h3>
          </div>
        </div>
        <div class="contract-delivering-box">
          <div class="delivering-anim">
            <span class="truck-icon">🚚</span>
            <div class="snow-track"></div>
          </div>
          <div class="delivering-label">КАРАВАН В ПУТИ</div>
          <div class="contract-timer-pill">⏱️ ${Math.max(1, Math.ceil(contract.timer))}с</div>
          <div class="contract-bar-track">
            <div class="contract-bar-fill" style="width: ${progressPct}%;"></div>
          </div>
        </div>
      `;
      return card;
    }

    if (contract.status === "cooldown") {
      const progressPct = contract.totalDuration > 0
        ? Math.max(0, Math.min(100, Math.round(((contract.totalDuration - contract.timer) / contract.totalDuration) * 100)))
        : 0;

      card.innerHTML = `
        <div class="contract-header">
          <div class="contract-avatar">📡</div>
          <div class="contract-meta">
            <div class="contract-faction-badge">ПОИСК КЛИЕНТА</div>
            <h3 class="contract-title">Слот №${contract.slotIndex + 1}</h3>
          </div>
        </div>
        <div class="contract-cooldown-box">
          <p class="cooldown-desc">Диспетчер согласовывает заявку с региональными потребителями...</p>
          <div class="contract-timer-pill">⏱️ ${Math.max(1, Math.ceil(contract.timer))}с</div>
          <div class="contract-bar-track">
            <div class="contract-bar-fill cooldown" style="width: ${progressPct}%;"></div>
          </div>
          <button class="btn-contract-speedup" type="button">
            <span>⚡ Ускорить (Подбор)</span>
          </button>
        </div>
      `;

      const speedBtn = card.querySelector(".btn-contract-speedup");
      if (speedBtn) {
        speedBtn.addEventListener("click", () => {
          this.state.speedUpContractSlot(contract.id);
          this.render();
          this.renderInlineActive();
        });
      }
      return card;
    }

    // Default 'ready' state
    let canFulfill = true;
    const reqItemsHtml = Object.entries(contract.requirements || {}).map(([key, reqQty]) => {
      const uDef = CONFIG.CONTRACTS?.unitValues?.[key] || { name: key, icon: "📦", unit: "ед" };
      const currentQty = Math.floor(this.state.inventory?.[key] || 0);
      const isMet = currentQty >= reqQty;
      if (!isMet) canFulfill = false;
      const pct = Math.min(100, Math.round((currentQty / reqQty) * 100));

      return `
        <div class="contract-req-item ${isMet ? 'met' : 'missing'}">
          <div class="req-item-left">
            <span class="req-icon">${uDef.icon}</span>
            <span class="req-name">${uDef.name}</span>
          </div>
          <div class="req-item-right">
            <span class="req-qty ${isMet ? 'green-text' : 'orange-text'}">${currentQty.toLocaleString("ru-RU")} / ${reqQty.toLocaleString("ru-RU")} ${uDef.unit}</span>
            <div class="req-bar-track">
              <div class="req-bar-fill ${isMet ? 'fill-green' : 'fill-orange'}" style="width: ${pct}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const rew = contract.reward || {};
    card.innerHTML = `
      <div class="contract-header">
        <div class="contract-avatar" style="border-color:${contract.factionColor || '#005bab'};">${contract.factionIcon || "📋"}</div>
        <div class="contract-meta">
          <div class="contract-faction-badge" style="background:${contract.factionColor}22;color:${contract.factionColor};border-color:${contract.factionColor}66;">
            ${contract.factionBadge || "ЗАКАЗ"}
          </div>
          <h3 class="contract-title">${contract.factionName}</h3>
        </div>
        <button class="btn-contract-dismiss" type="button" title="Отклонить контракт (новый через 90с)">🗑️</button>
      </div>

      <div class="contract-requirements-list">
        ${reqItemsHtml}
      </div>

      <div class="contract-rewards-row">
        <span class="reward-title">Награда:</span>
        <div class="reward-badges-cluster">
          <span class="reward-badge money-badge">🪙 +${(rew.money || 0).toLocaleString("ru-RU")} ₽</span>
          <span class="reward-badge mtr-badge">🏗️ +${rew.mtr || 1} МТР</span>
          <span class="reward-badge xp-badge">⭐ +${rew.xp || 15} Опыт</span>
        </div>
      </div>

      <div class="contract-actions">
        <button class="btn-contract-fulfill ${canFulfill ? 'ready' : 'disabled'}" type="button" ${canFulfill ? '' : 'disabled'}>
          <span class="btn-icon">🚚</span>
          <span class="btn-label">${canFulfill ? 'ОТПРАВИТЬ КАРАВАН' : 'НЕ ХВАТАЕТ РЕСУРСОВ'}</span>
        </button>
      </div>
    `;

    const fulfillBtn = card.querySelector(".btn-contract-fulfill");
    if (fulfillBtn && canFulfill) {
      fulfillBtn.addEventListener("click", () => {
        const success = this.state.fulfillContract(contract.id);
        if (success) {
          this.spawnCardCelebration(fulfillBtn, `+${(rew.money || 0).toLocaleString("ru-RU")} ₽ • +${rew.mtr || 1} МТР`);
          this.render();
          this.renderInlineActive();
        }
      });
    }

    const dismissBtn = card.querySelector(".btn-contract-dismiss");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        this.state.dismissContract(contract.id);
        this.render();
        this.renderInlineActive();
      });
    }

    return card;
  }

  spawnCardCelebration(anchorEl, text) {
    if (typeof document === "undefined" || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const particle = document.createElement("div");
    particle.className = "contract-floating-reward";
    particle.textContent = text;
    particle.style.left = `${rect.left + rect.width / 2}px`;
    particle.style.top = `${rect.top}px`;
    document.body.appendChild(particle);

    setTimeout(() => {
      particle.remove();
    }, 1200);
  }

  updateLiveTimers() {
    if (!this.isOpen()) return;
    const activeContracts = this.state.getContracts();
    const hasTimers = activeContracts.some(c => c.status === "delivering" || c.status === "cooldown");
    if (hasTimers) {
      this.render();
    }
  }
}
