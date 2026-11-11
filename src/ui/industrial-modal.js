/**
 * src/ui/industrial-modal.js
 * Industrial Sector & Production Recipes View (Township Oil Hub M1)
 * Adheres to Emil Kowalski standards & Gazprom corporate design.
 */

import { CONFIG } from "../config.js";

export class IndustrialModalView {
  constructor(state) {
    this.state = state;
    this.currentSector = "refinery";
    this.modalEl = null;
    this.bodyEl = null;
    this.titleEl = null;
    this.descEl = null;
    this.badgeEl = null;
    this.closeBtn = null;
    this.tabButtons = [];
    this.liveTimer = null;
  }

  init() {
    this.modalEl = document.getElementById("modal-industrial-sector");
    if (!this.modalEl) return;

    this.bodyEl = document.getElementById("industrial-sector-body");
    this.titleEl = document.getElementById("industrial-modal-title");
    this.descEl = document.getElementById("industrial-modal-desc");
    this.badgeEl = document.getElementById("industrial-sector-badge");
    this.closeBtn = document.getElementById("btn-close-industrial-modal");
    this.tabButtons = Array.from(this.modalEl.querySelectorAll(".btn-ind-tab"));

    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", () => this.close());
    }

    const hudBtn = document.getElementById("btn-open-industrial");
    if (hudBtn) {
      hudBtn.addEventListener("click", () => this.open(this.currentSector || "refinery"));
    }

    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) this.close();
    });

    this.tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const sec = btn.getAttribute("data-sector");
        if (sec) {
          this.currentSector = sec;
          this.tabButtons.forEach(b => b.classList.toggle("active", b === btn));
          this.render();
        }
      });
    });

    // Wire state listeners
    if (this.state && typeof this.state.on === "function") {
      this.state.on("openRefineryModal", () => this.open("refinery"));
      this.state.on("openGasPlantModal", () => this.open("gas_plant"));
      this.state.on("openPetrochemModal", () => this.open("petrochem"));
      this.state.on("openStorageModal", () => this.open("storage_park"));
      this.state.on("refineryUpgraded", () => { if (this.isOpen()) this.render(); });
      this.state.on("gasPlantUpgraded", () => { if (this.isOpen()) this.render(); });
      this.state.on("petrochemUpgraded", () => { if (this.isOpen()) this.render(); });
      this.state.on("rvsParkUpgraded", () => { if (this.isOpen()) this.render(); });
      this.state.on("industrialRecipeChanged", () => { if (this.isOpen()) this.render(); });
      this.state.on("sectorUnlocked", () => { if (this.isOpen()) this.render(); });
    }
  }

  isOpen() {
    return this.modalEl && !this.modalEl.classList.contains("hidden");
  }

  open(sectorId = "refinery") {
    if (!this.modalEl) return;
    this.state?.emit?.("closeAllBottomSheets");
    this.currentSector = sectorId;
    this.modalEl.classList.remove("hidden");

    this.tabButtons.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-sector") === this.currentSector);
    });

    this.render();

    if (this.liveTimer) clearInterval(this.liveTimer);
    this.liveTimer = setInterval(() => this.updateLiveCounters(), 1000);
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
  }

  switchSector(sectorId) {
    if (!sectorId) return;
    this.currentSector = sectorId;
    if (this.tabButtons) {
      this.tabButtons.forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-sector") === this.currentSector);
      });
    }
    this.render();
  }

  getSectorMeta(sectorId) {
    switch (sectorId) {
      case "refinery":
        return {
          title: "НПЗ «Северный Факел»",
          badge: "⛽ ТОПЛИВНЫЙ КЛАСТЕР",
          desc: "Перегонка сырой нефти в высокооктановые бензины и арктический дизель",
          level: this.state.refineryLevel || 1,
          maxLevel: CONFIG.REFINERY?.maxLevel || 4,
          upgradeCost: typeof this.state.getRefineryUpgradeCost === "function" ? this.state.getRefineryUpgradeCost() : 75000,
          canUpgrade: typeof this.state.canUpgradeRefinery === "function" ? this.state.canUpgradeRefinery() : false,
          upgradeMethod: () => this.state.upgradeRefinery(),
          rawName: "Сырая нефть",
          rawAmount: Math.floor(this.state.inventory?.rawOil || 0),
          rawUnit: "bbl",
          rate: (CONFIG.REFINERY?.throughputs?.[this.state.refineryLevel || 1] || 25) + " bbl/с"
        };
      case "gas_plant":
        return {
          title: "ГПЗ «Полярный Метан»",
          badge: "❄️ ГАЗОХИМИЧЕСКИЙ КЛАСТЕР",
          desc: "Криогенная сепарация попутного газа в товарный метан, СУГ и гелий",
          level: this.state.gasPlantLevel || 1,
          maxLevel: CONFIG.GAS_PLANT?.maxLevel || 4,
          upgradeCost: typeof this.state.getGasPlantUpgradeCost === "function" ? this.state.getGasPlantUpgradeCost() : 150000,
          canUpgrade: typeof this.state.canUpgradeGasPlant === "function" ? this.state.canUpgradeGasPlant() : false,
          upgradeMethod: () => this.state.upgradeGasPlant(),
          rawName: "Попутный газ (ПНГ)",
          rawAmount: Math.floor(this.state.inventory?.rawGas || 0),
          rawUnit: "м³",
          rate: (CONFIG.GAS_PLANT?.throughputs?.[this.state.gasPlantLevel || 1] || 30) + " м³/с"
        };
      case "petrochem":
        return {
          title: "НГХК «Сибирский Полимер»",
          badge: "🧪 НЕФТЕГАЗОХИМИЯ",
          desc: "Глубокая полимеризация СУГ в полиэтилен, композиты МТР и химреагенты",
          level: this.state.petrochemLevel || 1,
          maxLevel: CONFIG.PETROCHEM?.maxLevel || 4,
          upgradeCost: typeof this.state.getPetrochemUpgradeCost === "function" ? this.state.getPetrochemUpgradeCost() : 300000,
          canUpgrade: typeof this.state.canUpgradePetrochem === "function" ? this.state.canUpgradePetrochem() : false,
          upgradeMethod: () => this.state.upgradePetrochem(),
          rawName: "Сжиженные газы (СУГ)",
          rawAmount: Math.floor(this.state.inventory?.lpg || 0),
          rawUnit: "т",
          rate: (CONFIG.PETROCHEM?.throughputs?.[this.state.petrochemLevel || 1] || 20) + " т/с"
        };
      case "storage_park":
      default:
        return {
          title: "Резервуарный парк РВС-50000 & МТР",
          badge: "🛢️ СКЛАДСКОЙ ХАБ",
          desc: "Резервуарный парк длительного хранения наливных углеводородов и базы МТР",
          level: this.state.rvsParkLevel || 1,
          maxLevel: CONFIG.RVS_PARK?.maxLevel || 4,
          upgradeCost: typeof this.state.getRvsParkUpgradeCost === "function" ? this.state.getRvsParkUpgradeCost() : 200000,
          canUpgrade: typeof this.state.canUpgradeRvsPark === "function" ? this.state.canUpgradeRvsPark() : false,
          upgradeMethod: () => this.state.upgradeRvsPark(),
          rawName: "Вместимость парка",
          rawAmount: Math.floor(this.state.oilStorageCapacity || 2000),
          rawUnit: "bbl",
          rate: "Хранилище"
        };
    }
  }

  render() {
    if (!this.bodyEl) return;
    const meta = this.getSectorMeta(this.currentSector);

    if (this.titleEl) this.titleEl.textContent = meta.title;
    if (this.descEl) this.descEl.textContent = meta.desc;
    if (this.badgeEl) this.badgeEl.textContent = meta.badge;

    const isUnlocked = typeof this.state.isSectorUnlocked === "function"
      ? this.state.isSectorUnlocked(this.currentSector)
      : true;

    if (!isUnlocked) {
      const secDef = CONFIG.SECTORS?.[this.currentSector] || { cost: 50000, name: meta.title };
      const canUnlock = (this.state.money || 0) >= secDef.cost;
      this.bodyEl.innerHTML = `
        <div class="ind-locked-card">
          <div class="ind-locked-icon">🔒</div>
          <h3 class="ind-locked-title">Сектор законсервирован</h3>
          <p class="ind-locked-desc">Для ввода установки в эксплуатацию требуются инвестиции в инженерную подготовку и пусконаладку.</p>
          <div class="ind-locked-cost">Стоимость ввода: <span class="gold-text">${secDef.cost.toLocaleString("ru-RU")} ₽</span></div>
          <button id="btn-unlock-sector" class="btn-primary-gazprom" ${canUnlock ? "" : "disabled"}>
            <span>⚡ ВВЕСТИ В ЭКСПЛУАТАЦИЮ (${secDef.cost.toLocaleString("ru-RU")} ₽)</span>
          </button>
        </div>
      `;

      const unlockBtn = this.bodyEl.querySelector("#btn-unlock-sector");
      if (unlockBtn) {
        unlockBtn.addEventListener("click", () => {
          if (typeof this.state.unlockSector === "function" && this.state.unlockSector(this.currentSector)) {
            this.render();
          }
        });
      }
      return;
    }

    // Unlocked sector view:
    const activeRecipeId = typeof this.state.getIndustrialRecipe === "function"
      ? this.state.getIndustrialRecipe(this.currentSector)
      : "ai92_focus";

    let html = `
      <div class="ind-metrics-bar">
        <div class="ind-metric-box">
          <span class="ind-metric-label">Уровень цеха</span>
          <span class="ind-metric-val cyan-text">УР. ${meta.level} / ${meta.maxLevel}</span>
        </div>
        <div class="ind-metric-box">
          <span class="ind-metric-label">Мощность переработки</span>
          <span class="ind-metric-val green-text">${meta.rate}</span>
        </div>
        <div class="ind-metric-box">
          <span class="ind-metric-label">Запас: ${meta.rawName}</span>
          <span class="ind-metric-val gold-text" id="ind-live-raw">${meta.rawAmount.toLocaleString("ru-RU")} ${meta.rawUnit}</span>
        </div>
        <div class="ind-upgrade-col">
          <button id="btn-upgrade-sector" class="btn-ind-upgrade" ${meta.canUpgrade ? "" : "disabled"}>
            <span class="btn-up-title">+1 УРОВЕНЬ ЦЕХА</span>
            <span class="btn-up-cost">${Number.isFinite(meta.upgradeCost) ? meta.upgradeCost.toLocaleString("ru-RU") + " ₽" : "МАКСИМУМ"}</span>
          </button>
        </div>
      </div>
    `;

    if (this.currentSector === "storage_park") {
      const inv = this.state.inventory || {};
      html += `
        <div class="ind-recipes-section">
          <h3 class="ind-section-title">📊 Инвентарь товарных нефтепродуктов и сырья:</h3>
          <div class="ind-storage-grid">
            <div class="ind-storage-item">
              <span class="st-icon">🛢️</span>
              <span class="st-name">Сырая нефть:</span>
              <span class="st-val gold-text">${Math.floor(inv.rawOil || 0).toLocaleString("ru-RU")} bbl</span>
            </div>
            <div class="ind-storage-item">
              <span class="st-icon">⛽</span>
              <span class="st-name">АИ-92 Регуляр:</span>
              <span class="st-val cyan-text">${Math.floor(inv.fuel_ai92 || 0).toLocaleString("ru-RU")} bbl</span>
            </div>
            <div class="ind-storage-item">
              <span class="st-icon">🚗</span>
              <span class="st-name">АИ-95 Премиум:</span>
              <span class="st-val cyan-text">${Math.floor(inv.fuel_ai95 || 0).toLocaleString("ru-RU")} bbl</span>
            </div>
            <div class="ind-storage-item">
              <span class="st-icon">🏎️</span>
              <span class="st-name">АИ-98 Супер:</span>
              <span class="st-val cyan-text">${Math.floor(inv.fuel_ai98 || 0).toLocaleString("ru-RU")} bbl</span>
            </div>
            <div class="ind-storage-item">
              <span class="st-icon">✈️</span>
              <span class="st-name">АИ-100 Рейсинг:</span>
              <span class="st-val cyan-text">${Math.floor(inv.fuel_ai100 || 0).toLocaleString("ru-RU")} bbl</span>
            </div>
            <div class="ind-storage-item">
              <span class="st-icon">🧪</span>
              <span class="st-name">СУГ (Пропан/Бутан):</span>
              <span class="st-val purple-text">${Math.floor(inv.lpg || 0).toLocaleString("ru-RU")} т</span>
            </div>
            <div class="ind-storage-item">
              <span class="st-icon">🎈</span>
              <span class="st-name">Сверхчистый Гелий:</span>
              <span class="st-val neon-cyan">${Math.floor(inv.helium || 0).toLocaleString("ru-RU")} м³</span>
            </div>
            <div class="ind-storage-item">
              <span class="st-icon">🧱</span>
              <span class="st-name">Полимеры ПНД:</span>
              <span class="st-val green-text">${Math.floor(inv.polymers || 0).toLocaleString("ru-RU")} т</span>
            </div>
          </div>
        </div>
      `;
    } else {
      const recipes = CONFIG.RECIPES?.[this.currentSector] || {};
      html += `
        <div class="ind-recipes-section">
          <h3 class="ind-section-title">⚙️ Активные производственные рецепты:</h3>
          <div class="ind-recipes-grid">
      `;

      for (const [rId, rDef] of Object.entries(recipes)) {
        const isActive = rId === activeRecipeId;
        const isLocked = meta.level < (rDef.reqLevel || 1);

        let yieldStr = "";
        if (rDef.yields) {
          yieldStr = Object.entries(rDef.yields)
            .map(([k, v]) => `${k.replace("fuel_", "").toUpperCase()}: ${Math.round(v * 100)}%`)
            .join(" • ");
        }

        html += `
          <div class="ind-recipe-card ${isActive ? "active" : ""} ${isLocked ? "locked" : ""}">
            <div class="ind-recipe-header">
              <span class="ind-recipe-icon">${rDef.icon || "⚙️"}</span>
              <div class="ind-recipe-title-group">
                <h4 class="ind-recipe-title">${rDef.name}</h4>
                <span class="ind-recipe-yields">${yieldStr}</span>
              </div>
              ${isActive ? '<span class="ind-active-badge">АКТИВЕН</span>' : ""}
            </div>
            <p class="ind-recipe-desc">${rDef.desc}</p>
            <div class="ind-recipe-footer">
              ${isLocked
                ? `<span class="ind-lock-label">🔒 Требуется Ур. ${rDef.reqLevel} цеха</span>`
                : isActive
                ? `<span class="ind-running-label">⚡ Линия запущена</span>`
                : `<button class="btn-select-recipe" data-recipe="${rId}" type="button">ВЫБРАТЬ РЕЦЕПТ</button>`
              }
            </div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    this.bodyEl.innerHTML = html;

    // Attach actions
    const upBtn = this.bodyEl.querySelector("#btn-upgrade-sector");
    if (upBtn) {
      upBtn.addEventListener("click", () => {
        if (meta.upgradeMethod()) {
          this.render();
        }
      });
    }

    const selectBtns = this.bodyEl.querySelectorAll(".btn-select-recipe");
    selectBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const recId = btn.getAttribute("data-recipe");
        if (recId && typeof this.state.setIndustrialRecipe === "function") {
          this.state.setIndustrialRecipe(this.currentSector, recId);
          this.render();
        }
      });
    });
  }

  updateLiveCounters() {
    if (!this.isOpen() || !this.bodyEl) return;
    const meta = this.getSectorMeta(this.currentSector);
    const rawEl = this.bodyEl.querySelector("#ind-live-raw");
    if (rawEl) {
      rawEl.textContent = `${meta.rawAmount.toLocaleString("ru-RU")} ${meta.rawUnit}`;
    }
  }
}
