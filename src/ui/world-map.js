/**
 * World Map View ("Карта месторождений мира")
 * Renders the global territories exploration map based on Screenshot 2.
 */
import { state } from "../state.js";
import { audio } from "../audio.js";

export class WorldMapView {
  constructor() {
    this.modal = document.getElementById("modal-world-map");
    this.btnClose = document.getElementById("btn-close-world-map");
    this.btnHome = document.getElementById("btn-world-home");
    this.pinsContainer = document.getElementById("world-map-pins");
    this.territoryCard = document.getElementById("world-territory-card");
    this.btnUnlockTerritory = document.getElementById("btn-unlock-territory");
    this.selectedTerritoryId = "yamal";

    this.initEvents();
  }

  initEvents() {
    state.on("openWorldMap", () => {
      this.open();
    });

    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.close());
    }

    if (this.btnHome) {
      this.btnHome.addEventListener("click", () => {
        if (typeof audio?.playClick === "function") audio.playClick();
        this.close();
      });
    }

    if (this.btnUnlockTerritory) {
      this.btnUnlockTerritory.addEventListener("click", () => {
        if (!this.selectedTerritoryId) return;
        if (state.unlockTerritory(this.selectedTerritoryId)) {
          this.renderPins();
          this.showTerritoryDetails(this.selectedTerritoryId);
        }
      });
    }

    state.on("territoryUnlocked", () => {
      this.renderPins();
      if (this.selectedTerritoryId) {
        this.showTerritoryDetails(this.selectedTerritoryId);
      }
    });

    state.on("moneyChanged", () => {
      if (this.isOpen()) {
        this.updateTopStats();
        if (this.selectedTerritoryId) {
          this.showTerritoryDetails(this.selectedTerritoryId);
        }
      }
    });
  }

  isOpen() {
    return this.modal && !this.modal.classList.contains("hidden");
  }

  open() {
    if (!this.modal) return;
    state.emit("closeAllBottomSheets", { immediate: true });
    if (typeof document !== "undefined") {
      document.querySelectorAll(".well-upgrade-sheet").forEach(s => {
        s.classList.remove("sliding-down");
        s.classList.add("hidden");
      });
    }
    this.modal.classList.remove("hidden");
    this.updateTopStats();
    this.renderPins();
    this.showTerritoryDetails(this.selectedTerritoryId || "yamal");
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.add("hidden");
  }

  updateTopStats() {
    const coinsEl = document.getElementById("world-map-coins");
    const starsEl = document.getElementById("world-map-stars");
    if (coinsEl) coinsEl.textContent = Math.floor(state.money || 0).toLocaleString("ru-RU");
    if (starsEl) starsEl.textContent = Math.floor(state.crypto || 0).toLocaleString("ru-RU");
  }

  renderPins() {
    if (!this.pinsContainer) return;
    this.pinsContainer.innerHTML = "";

    const territories = state.getWorldTerritories();
    territories.forEach(t => {
      const pin = document.createElement("div");
      pin.className = `world-map-pin ${t.unlocked ? "unlocked" : "locked"} ${t.id === this.selectedTerritoryId ? "active" : ""}`;
      pin.style.left = `${t.x}%`;
      pin.style.top = `${t.y}%`;

      pin.innerHTML = `
        <div class="pin-badge">
          <span class="pin-avatar">${t.avatar || "👷"}</span>
          <span class="pin-trophy">🏆 ${t.cups || 5}</span>
        </div>
        <div class="pin-label">${t.name.split("•")[0].trim()}</div>
      `;

      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        if (typeof audio?.playClick === "function") audio.playClick();
        this.selectedTerritoryId = t.id;
        this.renderPins();
        this.showTerritoryDetails(t.id);
      });

      this.pinsContainer.appendChild(pin);
    });
  }

  showTerritoryDetails(id) {
    const t = state.territories?.[id];
    if (!t || !this.territoryCard) return;

    const nameEl = document.getElementById("world-territory-name");
    const badgeEl = document.getElementById("world-territory-badge");
    const descEl = document.getElementById("world-territory-desc");
    const bonusEl = document.getElementById("world-territory-bonus");
    const costEl = document.getElementById("world-territory-cost");

    if (nameEl) nameEl.textContent = t.name;
    if (badgeEl) badgeEl.textContent = t.badge || "МЕСТОРОЖДЕНИЕ";
    if (descEl) descEl.textContent = t.requirement || "Требования выполнены";
    if (bonusEl) bonusEl.textContent = t.debitBonus > 0 ? `+${Math.round(t.debitBonus * 100)}% к общему дебиту` : "Базовый промысел";

    if (this.btnUnlockTerritory) {
      if (t.unlocked) {
        this.btnUnlockTerritory.disabled = true;
        this.btnUnlockTerritory.className = "btn-territory-action btn-unlocked";
        this.btnUnlockTerritory.innerHTML = `<span>✅ ОСВОЕНО</span>`;
      } else {
        const canAfford = (state.money || 0) >= (t.cost || 0);
        this.btnUnlockTerritory.disabled = !canAfford;
        this.btnUnlockTerritory.className = "btn-territory-action btn-unlock";
        this.btnUnlockTerritory.innerHTML = `<span>ОСВОИТЬ ЗА ${t.cost.toLocaleString("ru-RU")} ₽</span>`;
      }
    }
  }
}
