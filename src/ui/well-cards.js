import { CONFIG } from "../config.js";
import { state } from "../state.js";
import { HudView } from "./hud.js";
import { audio } from "../audio.js";

/**
 * WellCardsView
 * Manages:
 * 1. In-World Well Upgrade Bottom Sheet (#well-upgrade-sheet) for inspect & upgrade on tap.
 * 2. Dispatcher Control Room (#dispatcher-content) in management drawer with tabs (Logistics, Crew, Summary).
 * 3. Backwards-compatible well cards in #wells-list.
 */
export class WellCardsView {
  constructor(containerElement) {
    this.container = containerElement || document.getElementById("wells-list");
    this.dispatchContainer = document.getElementById("dispatcher-content");
    this.activeDispatchTab = "logistics";
    this.currentSheetWellId = "well_1";

    this.ensureKowalskiStyles();
    this.initSheetElements();
    this.initDispatcherDashboard();
    this.renderInitialCards();
    // --- Structure Upgrade Sheet (KTPN, Gatehouse, Fence, MTR, Compressor, Gas Treatment, Dormitory) ---
    this.structureSheet = document.getElementById("structure-upgrade-sheet");
    this.sheetStructureBadge = document.getElementById("sheet-structure-badge");
    this.sheetStructureName = document.getElementById("sheet-structure-name");
    this.sheetStructureCurrentLevel = document.getElementById("sheet-structure-current-level");
    this.sheetStructureBonusVal = document.getElementById("sheet-structure-bonus-val");
    this.sheetStructureBtnText = document.getElementById("sheet-structure-btn-text");
    this.sheetStructureCost = document.getElementById("sheet-structure-cost");
    this.btnStructureUpgrade = document.getElementById("btn-structure-upgrade");
    this.btnCloseStructureSheet = document.getElementById("btn-close-structure-sheet");
    this.currentStructureType = null;
    this.purgeTimerInterval = null;

    this.initDispatchModal();
    this.initEvents();
  }

  ensureKowalskiStyles() {
    if (typeof document === "undefined" || !document.head || document.getElementById("kowalski-shake-styles")) {
      return;
    }
    try {
      const style = document.createElement("style");
      style.id = "kowalski-shake-styles";
      style.textContent = `
        @keyframes btn-kowalski-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(2px); }
        }
        .btn-sheet-upgrade.insufficient-funds,
        .btn-sheet-upgrade.btn-disabled,
        #btn-facility-upgrade.insufficient-funds,
        #btn-canteen-upgrade.insufficient-funds {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #94a3b8 !important;
          box-shadow: none !important;
          cursor: pointer !important;
        }
        .btn-insufficient-funds {
          animation: btn-kowalski-shake 260ms cubic-bezier(0.23, 1, 0.32, 1) !important;
          border-color: #ef4444 !important;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.6) !important;
        }
        .cost-insufficient {
          color: #ef4444 !important;
          transition: color 150ms cubic-bezier(0.23, 1, 0.32, 1) !important;
        }
      `;
      document.head.appendChild(style);
    } catch (e) {}
  }

  triggerInsufficientFundsFeedback(button, costElement, sheetElement) {
    if (typeof audio?.playInsufficientFunds === "function") {
      audio.playInsufficientFunds();
    } else if (typeof audio?.playError === "function") {
      audio.playError();
    }

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try { navigator.vibrate([40, 30, 40]); } catch (e) {}
    }

    if (button) {
      if (button.classList?.remove) button.classList.remove("shake-error", "btn-insufficient-funds");
      if (typeof button.offsetWidth === "number") void button.offsetWidth;
      if (button.classList?.add) button.classList.add("btn-insufficient-funds");
      if (button.style) {
        button.style.animation = "btn-kowalski-shake 260ms cubic-bezier(0.23, 1, 0.32, 1)";
      }

      // Add floating popover directly over button
      if (typeof document !== "undefined" && document.createElement && !button.querySelector(".insufficient-funds-popover")) {
        const popover = document.createElement("div");
        popover.className = "insufficient-funds-popover";
        popover.textContent = "⚠️ Недостаточно средств!";
        button.style.position = "relative";
        button.appendChild(popover);
        setTimeout(() => {
          if (popover.parentNode) popover.parentNode.removeChild(popover);
        }, 1200);
      }

      setTimeout(() => {
        if (button.classList?.remove) button.classList.remove("btn-insufficient-funds");
        if (button.style) button.style.animation = "";
      }, 260);
    }

    if (costElement) {
      if (costElement.classList?.add) costElement.classList.add("cost-insufficient");
      if (costElement.style) costElement.style.color = "#ef4444";
      setTimeout(() => {
        if (costElement.classList?.remove) costElement.classList.remove("cost-insufficient");
        if (costElement.style) costElement.style.color = "";
      }, 800);
    }

    if (sheetElement) {
      this.showErrorHint(sheetElement, "Недостаточно средств!");
    }

    state.emit("showToast", { text: "Недостаточно средств!", type: "error" });
  }

  showErrorHint(container, message = "Недостаточно средств!") {
    if (!container) return;
    let hint = container.querySelector ? container.querySelector(".sheet-error-hint") : null;
    if (!hint && typeof document !== "undefined" && document.createElement) {
      hint = document.createElement("div");
      hint.className = "sheet-error-hint";
      if (container.appendChild) container.appendChild(hint);
    }
    if (hint) {
      hint.textContent = message;
      if (hint.style) {
        hint.style.cssText = "color: #ef4444; font-size: 11px; font-weight: 800; text-align: center; margin-top: 4px; transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);";
        hint.style.opacity = "1";
      }
      clearTimeout(hint._timer);
      hint._timer = setTimeout(() => {
        if (hint.style) hint.style.opacity = "0";
        setTimeout(() => {
          if (hint.parentNode && hint.parentNode.removeChild) {
            hint.parentNode.removeChild(hint);
          }
        }, 200);
      }, 1500);
    }
  }

  // --- 1. IN-WORLD WELL UPGRADE BOTTOM SHEET ---

  initSheetElements() {
    this.sheet = document.getElementById("well-upgrade-sheet");
    this.sheetBadge = document.getElementById("sheet-well-badge");
    this.sheetName = document.getElementById("sheet-well-name");
    this.sheetCurDebit = document.getElementById("sheet-current-debit");
    this.sheetNextDebit = document.getElementById("sheet-next-debit");
    this.btnSheetUpgrade = document.getElementById("btn-sheet-upgrade");
    this.sheetUpgradeCost = document.getElementById("sheet-upgrade-cost");
    this.sheetActionText = this.sheet?.querySelector(".sheet-btn-action-text");
    this.btnSheetValve = document.getElementById("btn-sheet-valve-mini");
    this.btnSheetClose = document.getElementById("btn-close-well-sheet");

    if (this.btnSheetClose) {
      this.btnSheetClose.addEventListener("click", () => this.closeWellSheet());
    }

    if (this.btnSheetUpgrade) {
      this.btnSheetUpgrade.addEventListener("click", () => {
        const well = state.wells[this.currentSheetWellId];
        if (!well) return;
        const def = CONFIG.WELLS.find(w => w.id === this.currentSheetWellId);
        if (!def) return;

        const cost = !well.unlocked ? def.unlockCost : (well.level === 0 ? 50000 : CONFIG.getUpgradeCost(def.baseCost, def.costMultiplier, well.level));
        const canAfford = (state.money || 0) >= cost;

        if (!canAfford) {
          this.triggerInsufficientFundsFeedback(this.btnSheetUpgrade, this.sheetUpgradeCost, this.sheet);
          return;
        }

        const success = !well.unlocked
          ? state.unlockWell(this.currentSheetWellId)
          : state.upgradeWell(this.currentSheetWellId);

        if (success) {
          this.updateWellSheet();
    if (this.purgeTimerInterval) clearInterval(this.purgeTimerInterval);
    this.purgeTimerInterval = setInterval(() => {
      if (!this.sheet || this.sheet.classList.contains("hidden")) {
        clearInterval(this.purgeTimerInterval);
        this.purgeTimerInterval = null;
        return;
      }
      this.updateWellSheet();
    }, 1000);
          this.updateAllCards();
        } else {
          this.triggerInsufficientFundsFeedback(this.btnSheetUpgrade, this.sheetUpgradeCost, this.sheet);
        }
      });
    }

    // --- Block Blast Purge Cooldown (1.5h = 5400s) ---
    const btnPurge = document.getElementById("btn-sheet-block-blast");
    if (btnPurge) {
      const cd = typeof state.getPurgeCooldownRemaining === "function" ? state.getPurgeCooldownRemaining() : 0;
      if (cd > 0) {
        btnPurge.disabled = true;
        btnPurge.classList.add("btn-completed");
        const h = Math.floor(cd / 3600);
        const m = Math.floor((cd % 3600) / 60);
        const s = Math.floor(cd % 60);
        const hStr = h > 0 ? h + "ч " : "";
        const mStr = m.toString().padStart(2, "0") + "м ";
        const sStr = s.toString().padStart(2, "0") + "с";
        btnPurge.innerHTML = "<span>⏱️ Продувка через " + hStr + mStr + sStr + "</span>";
      } else {
        btnPurge.disabled = false;
        btnPurge.classList.remove("btn-completed");
        btnPurge.innerHTML = "<span>🧩 Продуть коллектор (Block Blast)</span>";
      }
    }

    if (this.btnSheetValve) {
      this.btnSheetValve.addEventListener("click", () => {
        this.closeWellSheet();
        state.emit("openWellTuningModal", { wellId: this.currentSheetWellId });
      });
    }

    const btnSheetBlockBlast = document.getElementById("btn-sheet-block-blast");
    if (btnSheetBlockBlast) {
      btnSheetBlockBlast.addEventListener("click", () => {
        this.closeWellSheet();
        state.emit("openBlockBlastModal", { wellId: this.currentSheetWellId });
      });
    }

    const btnSheetGeonav = document.getElementById("btn-sheet-geonav");
    if (btnSheetGeonav) {
      btnSheetGeonav.addEventListener("click", () => {
        const wellId = this.currentSheetWellId || state.activeWellId || "well_1";
        this.closeWellSheet();
        state.emit("openGeonavModal", { wellId });
      });
    }

    // --- Facility Upgrade Sheet ---
    this.facilitySheet = document.getElementById("facility-upgrade-sheet");
    this.sheetFacilityName = document.getElementById("sheet-facility-name");
    this.sheetFacilityCurBonus = document.getElementById("sheet-facility-current-bonus");
    this.sheetFacilityNextBonus = document.getElementById("sheet-facility-next-bonus");
    this.sheetFacilityCap = document.getElementById("sheet-facility-capacity");
    this.sheetFacilityStored = document.getElementById("sheet-facility-stored");
    this.btnFacilityUpgrade = document.getElementById("btn-facility-upgrade");
    this.sheetFacilityCost = document.getElementById("sheet-facility-cost");
    this.facilityBtnActionText = document.getElementById("facility-btn-action-text");
    this.btnFacilitySell = document.getElementById("btn-facility-sell-reserves");
    this.btnCloseFacility = document.getElementById("btn-close-facility-sheet");

    if (this.btnCloseFacility) {
      this.btnCloseFacility.addEventListener("click", () => this.closeFacilitySheet());
    }

    if (this.btnFacilityUpgrade) {
      this.btnFacilityUpgrade.addEventListener("click", () => {
        const lvl = state.facilityLevel || 1;
        const isMax = lvl >= 10;
        if (isMax) return;

        if (!state.canUpgradeFacility()) {
          this.triggerInsufficientFundsFeedback(this.btnFacilityUpgrade, this.sheetFacilityCost, this.facilitySheet);
          return;
        }

        if (state.upgradeFacility()) {
          this.updateFacilitySheet();
          this.updateAllCards();
        } else {
          this.triggerInsufficientFundsFeedback(this.btnFacilityUpgrade, this.sheetFacilityCost, this.facilitySheet);
        }
      });
    }

    if (this.btnFacilitySell) {
      this.btnFacilitySell.addEventListener("click", () => {
        const sold = state.sellStoredReserves();
        if (sold && sold.revenue > 0) {
          if (typeof audio?.playPayout === "function") audio.playPayout();
        }
        this.updateFacilitySheet();
      });
    }

    // --- Canteen Upgrade Sheet ---
    this.canteenSheet = document.getElementById("canteen-upgrade-sheet");
    this.sheetCanteenName = document.getElementById("sheet-canteen-name");
    this.sheetCanteenCurBonus = document.getElementById("sheet-canteen-current-bonus");
    this.sheetCanteenNextBonus = document.getElementById("sheet-canteen-next-bonus");
    this.btnCanteenUpgrade = document.getElementById("btn-canteen-upgrade");
    this.sheetCanteenCost = document.getElementById("sheet-canteen-cost");
    this.canteenBtnActionText = document.getElementById("canteen-btn-action-text");
    this.btnCloseCanteen = document.getElementById("btn-close-canteen-sheet");

    if (this.btnCloseCanteen) {
      this.btnCloseCanteen.addEventListener("click", () => this.closeCanteenSheet());
    }

    if (this.btnCanteenUpgrade) {
      this.btnCanteenUpgrade.addEventListener("click", () => {
        const lvl = state.canteenLevel || 1;
        const isMax = lvl >= 5;
        if (isMax) return;

        if (!state.canUpgradeCanteen || !state.canUpgradeCanteen()) {
          this.triggerInsufficientFundsFeedback(this.btnCanteenUpgrade, this.sheetCanteenCost, this.canteenSheet);
          return;
        }

        if (state.upgradeCanteen()) {
          this.updateCanteenSheet();
          this.updateAllCards();
        } else {
          this.triggerInsufficientFundsFeedback(this.btnCanteenUpgrade, this.sheetCanteenCost, this.canteenSheet);
        }
      });
    }

    // --- Garage Upgrade Sheet ---
    this.garageSheet = document.getElementById("garage-upgrade-sheet");
    this.sheetGarageName = document.getElementById("sheet-garage-name");
    this.sheetGarageCurrentRovers = document.getElementById("sheet-garage-current-rovers");
    this.sheetGarageNextRovers = document.getElementById("sheet-garage-next-rovers");
    this.btnGarageUpgrade = document.getElementById("btn-garage-upgrade");
    this.sheetGarageCost = document.getElementById("sheet-garage-cost");
    this.garageBtnActionText = document.getElementById("garage-btn-action-text");
    this.btnCloseGarage = document.getElementById("btn-close-garage-sheet");

    if (this.btnCloseGarage) {
      this.btnCloseGarage.addEventListener("click", () => this.closeGarageSheet());
    }

    if (this.btnGarageUpgrade) {
      this.btnGarageUpgrade.addEventListener("click", () => {
        const lvl = state.garageLevel || 1;
        const isMax = lvl >= 5;
        if (isMax) return;

        if (!state.canUpgradeGarage || !state.canUpgradeGarage()) {
          this.triggerInsufficientFundsFeedback(this.btnGarageUpgrade, this.sheetGarageCost, this.garageSheet);
          return;
        }

        if (state.upgradeGarage()) {
          this.updateGarageSheet();
          this.updateAllCards();
        } else {
          this.triggerInsufficientFundsFeedback(this.btnGarageUpgrade, this.sheetGarageCost, this.garageSheet);
        }
      });
    }
  }

  setDockVisible(visible) {
    const dock = document.getElementById("township-dock");
    if (!dock) return;
    if (visible) {
      dock.classList.remove("dock-hidden-by-sheet");
    } else {
      dock.classList.add("dock-hidden-by-sheet");
    }
  }

  checkAnySheetOpen() {
    const open = [this.sheet, this.facilitySheet, this.canteenSheet, this.garageSheet, this.structureSheet]
      .some(s => s && !s.classList.contains("hidden") && !s.classList.contains("sliding-down"));
    this.setDockVisible(!open);
  }

  closeAllModals() {
    if (typeof document === "undefined") return;
    document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m => {
      m.classList.add("hidden");
    });
  }

  openFacilitySheet() {
    if (!this.facilitySheet) return;
    this.closeAllModals();
    this.closeAllSheets(true);
    this.setDockVisible(false);
    this.facilitySheet.classList.remove("hidden", "sliding-down");
    this.updateFacilitySheet();
    if (typeof audio?.playTap === "function") audio.playTap();
  }

  closeFacilitySheet() {
    if (!this.facilitySheet || this.facilitySheet.classList.contains("hidden")) return;
    this.facilitySheet.classList.add("sliding-down");
    setTimeout(() => {
      if (this.facilitySheet.classList.contains("sliding-down")) {
        this.facilitySheet.classList.add("hidden");
        this.facilitySheet.classList.remove("sliding-down");
      }
      this.checkAnySheetOpen();
    }, 220);
  }

  updateFacilitySheet() {
    if (!this.facilitySheet || this.facilitySheet.classList.contains("hidden")) return;
    const lvl = state.facilityLevel || 1;
    const isMax = lvl >= 10;
    const cost = state.getFacilityUpgradeCost();
    const canBuy = state.canUpgradeFacility();

    if (this.sheetFacilityName) {
      this.sheetFacilityName.textContent = `Газовый промысел (Ур. ${lvl}${isMax ? " МАКС" : ""})`;
    }
    if (this.sheetFacilityCurBonus) {
      this.sheetFacilityCurBonus.textContent = `+${lvl * 15}% дебит`;
    }
    if (this.sheetFacilityNextBonus) {
      this.sheetFacilityNextBonus.textContent = isMax ? "МАКС" : `+${(lvl + 1) * 15}% дебит`;
    }
    if (this.sheetFacilityCap) {
      this.sheetFacilityCap.textContent = `${(state.getOilStorageCapacity ? state.getOilStorageCapacity() : 2000).toLocaleString("ru-RU")} ед.`;
    }
    if (this.sheetFacilityStored) {
      this.sheetFacilityStored.textContent = `${Math.round(state.oilStorageCurrent || 0).toLocaleString("ru-RU")} ед.`;
    }
    if (this.sheetFacilityCost) {
      this.sheetFacilityCost.textContent = isMax ? "МАКС" : `${cost.toLocaleString("ru-RU")} ₽`;
    }
    if (this.facilityBtnActionText) {
      this.facilityBtnActionText.textContent = isMax ? "МАКСИМАЛЬНЫЙ УРОВЕНЬ" : "+1 УРОВЕНЬ ПРОМЫСЛА";
    }
    if (this.btnFacilityUpgrade) {
      this.btnFacilityUpgrade.disabled = isMax;
      this.btnFacilityUpgrade.classList.toggle("btn-disabled", isMax || !canBuy);
      this.btnFacilityUpgrade.classList.toggle("insufficient-funds", !canBuy && !isMax);
      if (this.btnFacilityUpgrade.setAttribute) {
        this.btnFacilityUpgrade.setAttribute("aria-disabled", isMax || !canBuy ? "true" : "false");
      }
    }
  }

  updateCanteenSheet() {
    if (!this.canteenSheet || this.canteenSheet.classList.contains("hidden")) return;
    const lvl = state.canteenLevel || 1;
    const isMax = lvl >= 5;
    const cost = state.getCanteenUpgradeCost ? state.getCanteenUpgradeCost() : 1000;
    const canBuy = state.canUpgradeCanteen ? state.canUpgradeCanteen() : false;

    if (this.sheetCanteenName) {
      this.sheetCanteenName.textContent = `Столовая & Вахтовый поселок (Ур. ${lvl}${isMax ? " МАКС" : ""})`;
    }
    if (this.sheetCanteenCurBonus) {
      this.sheetCanteenCurBonus.textContent = `+${lvl * 10}% синергия рабочих`;
    }
    if (this.sheetCanteenNextBonus) {
      this.sheetCanteenNextBonus.textContent = isMax ? "МАКС" : `+${(lvl + 1) * 10}% синергия`;
    }
    if (this.sheetCanteenCost) {
      this.sheetCanteenCost.textContent = isMax ? "МАКС" : `${cost.toLocaleString("ru-RU")} ₽`;
    }
    if (this.canteenBtnActionText) {
      this.canteenBtnActionText.textContent = isMax ? "МАКСИМАЛЬНЫЙ УРОВЕНЬ" : "+1 УРОВЕНЬ СТОЛОВОЙ";
    }
    if (this.btnCanteenUpgrade) {
      this.btnCanteenUpgrade.disabled = isMax;
      this.btnCanteenUpgrade.classList.toggle("btn-disabled", isMax || !canBuy);
      this.btnCanteenUpgrade.classList.toggle("insufficient-funds", !canBuy && !isMax);
      if (this.btnCanteenUpgrade.setAttribute) {
        this.btnCanteenUpgrade.setAttribute("aria-disabled", isMax || !canBuy ? "true" : "false");
      }
    }
  }

  openCanteenSheet() {
    if (!this.canteenSheet) return;
    this.closeAllModals();
    this.closeAllSheets(true);
    this.setDockVisible(false);
    this.canteenSheet.classList.remove("hidden", "sliding-down");
    this.updateCanteenSheet();
    if (typeof audio?.playTap === "function") audio.playTap();
  }

  closeCanteenSheet() {
    if (!this.canteenSheet || this.canteenSheet.classList.contains("hidden")) return;
    this.canteenSheet.classList.add("sliding-down");
    setTimeout(() => {
      if (this.canteenSheet.classList.contains("sliding-down")) {
        this.canteenSheet.classList.add("hidden");
        this.canteenSheet.classList.remove("sliding-down");
      }
      this.checkAnySheetOpen();
    }, 220);
  }

  
  openStructureSheet(type, customName, customBadge) {
    if (!this.structureSheet) return;
    this.closeAllModals();
    this.closeAllSheets(true);
    this.setDockVisible(false);

    this.currentStructureType = type;
    this.structureSheet.classList.remove("hidden", "sliding-down");
    this.updateStructureSheet(customName, customBadge);

    state.emit("focusOnStructure", {
      id: type,
      structureId: type
    });
    if (typeof audio?.playTap === "function") audio.playTap();
  }

  closeStructureSheet() {
    if (!this.structureSheet || this.structureSheet.classList.contains("hidden")) return;
    this.structureSheet.classList.add("sliding-down");
    state.emit("resetCameraFocus");
    setTimeout(() => {
      if (this.structureSheet.classList.contains("sliding-down")) {
        this.structureSheet.classList.add("hidden");
        this.structureSheet.classList.remove("sliding-down");
      }
      this.checkAnySheetOpen();
    }, 220);
  }

  updateStructureSheet(customName, customBadge) {
    if (!this.structureSheet || this.structureSheet.classList.contains("hidden")) return;
    const type = this.currentStructureType;
    if (!type) return;

    const names = {
      gatehouse: "КПП Промысла и охрана",
      substation: "КТПН 10/0.4 кВ и ЛЭП",
      fence: "Периметральный забор",
      mtr_yard: "База МТР и склад труб",
      compressor: "Дожимная компрессорная станция",
      gas_treatment: "Комплексная подготовка газа",
      dormitory: "Вахтовое общежитие",
      facility: "Газовый промысел",
      canteen: "Столовая промысла",
      rd_office: "Офис разработки месторождений"
    };

    const badges = {
      gatehouse: "★ ОХРАНА ★",
      substation: "⚡ ЭНЕРГОСЕТЬ",
      fence: "🛡️ ПЕРИМЕТР",
      mtr_yard: "📦 СКЛАД МТР",
      compressor: "💨 ДКС",
      gas_treatment: "💧 НТС",
      dormitory: "🏠 КАМПУС",
      facility: "★ ПРОМЫСЕЛ ★",
      canteen: "☕ СТОЛОВАЯ",
      rd_office: "🗺️ КАРТА"
    };

    const roles = {
      substation: "⚡ ЭНЕРГОСНАБЖЕНИЕ ПРОМЫСЛА",
      garage: "🚗 АВТОТРАНСПОРТНАЯ БАЗА",
      canteen: "🍲 БЫТ И ПИТАНИЕ ВАХТЫ",
      dormitory: "🏠 ЖИЛОЙ ВАХТОВЫЙ КОМПЛЕКС",
      mtr_yard: "📦 СКЛАД ОБОРУДОВАНИЯ И ТРУБ",
      compressor: "💨 ДОЖИМНАЯ КОМПРЕССОРНАЯ",
      gas_treatment: "💧 НИЗКОТЕМПЕРАТУРНАЯ СЕПАРАЦИЯ",
      gatehouse: "🛡️ ОХРАНА И РЕЖИМНЫЙ КОНТРОЛЬ",
      fence: "🔒 ЗАЩИТНЫЙ ПЕРИМЕТР",
      facility: "🏭 ГОЛОВНЫЕ СООРУЖЕНИЯ ПРОМЫСЛА",
      rd_office: "🗺️ ОФИС РАЗРАБОТКИ И ГЕОЛОГОРАЗВЕДКИ"
    };

    const quotes = {
      substation: "«В -50°C без тока скважина встанет за 20 минут — парафин забьёт шлейф насмерть! КТПН питает греющие кабели труб и насосы.»",
      garage: "«В тундре дорог нет — только зимники и снег. ТРЭКОЛы 6х6 на шинах низкого давления возят смены и аварийщиков в любую пургу!»",
      canteen: "«Сытый вахтовик на Ямале — залог безаварийной добычи! Горячий борщ и чай поднимают выработку рабочих на лютом морозе.»",
      dormitory: "«Тёплые жилые модули с сауной и сушилками для спецодежды. Полноценный отдых после 12-часовой смены на буровой.»",
      mtr_yard: "«Здесь запас обсадных труб, фонтанных ёлок, фланцев и реагентов. Чем богаче склад — тем быстрее и дешевле разбуривать кусты!»",
      compressor: "«Сердце газового промысла! Мощные турбокомпрессоры давят газ до 75–100 атм, чтобы протолкнуть его по магистральной трубе на экспорт.»",
      gas_treatment: "«Осушка природного газа от влаги и конденсата. Без этого в трубе образуются ледяные пробки гидратов, способные разорвать металл!»",
      gatehouse: "«Суровый ямальский ЧОП. Пьяных и посторонних не пускаем, въезд техники строго по путевым листам — защищает промысел от аварий и диверсий.»",
      fence: "«Ограждение промысла с колючей лентой и датчиками движения. Защищает площадку от белых медведей, песцов и метелей.»",
      facility: "«Центральный пункт сбора сырья: сепарация нефти, осушка газа на ТЭГ-колоннах и перекачка в магистральные трубопроводы.»",
      rd_office: "«Штаб геологического моделирования и освоения новых лицензионных участков Ямала и арктического шельфа. Отсюда мы координируем расширение промысла на новые горизонты!»"
    };

    const roleEl = document.getElementById("sheet-structure-role");
    const quoteEl = document.getElementById("sheet-structure-quote");
    if (roleEl) roleEl.textContent = roles[type] || "ИНФРАСТРУКТУРА";
    if (quoteEl) quoteEl.textContent = quotes[type] || "«Объект обеспечивает бесперебойную добычу и безопасность на промысле.»";

    if (type === "rd_office") {
      const btnTextEl = document.getElementById("sheet-structure-btn-text");
      if (btnTextEl) btnTextEl.textContent = "🗺️ КАРТА МЕСТОРОЖДЕНИЙ";
      if (this.sheetStructureBadge) this.sheetStructureBadge.textContent = "🗺️ КАРТА";
      if (this.sheetStructureName) this.sheetStructureName.textContent = "Офис разработки месторождений";
      if (this.sheetStructureCurrentLevel) this.sheetStructureCurrentLevel.textContent = "Действует";
      if (this.sheetStructureBonusVal) this.sheetStructureBonusVal.textContent = "9 регионов";
      if (this.sheetStructureCost) this.sheetStructureCost.textContent = "ОБЗОР ➔";
      if (this.btnStructureUpgrade) this.btnStructureUpgrade.disabled = false;
      return;
    }

    const lvl = typeof state.getStructureLevel === "function" ? state.getStructureLevel(type) : 1;
    const cost = typeof state.getStructureUpgradeCost === "function" ? state.getStructureUpgradeCost(type) : 15000;
    const bonus = typeof state.getStructureBonus === "function" ? state.getStructureBonus(type) : (lvl - 1) * 0.10;
    const nextBonus = bonus + 0.10;
    const canAfford = typeof state.canUpgradeStructure === "function" ? state.canUpgradeStructure(type) : (state.money || 0) >= cost;

    const isUnbuilt = (lvl <= 0);
    const actionBtnText = isUnbuilt ? "ПОСТРОИТЬ ОБЪЕКТ" : "УЛУЧШИТЬ ОБЪЕКТ";
    const btnTextEl = document.getElementById("sheet-structure-btn-text");
    if (btnTextEl) btnTextEl.textContent = actionBtnText;

    if (this.sheetStructureBadge) this.sheetStructureBadge.textContent = customBadge || badges[type] || "ИНФРАСТРУКТУРА";
    if (this.sheetStructureName) this.sheetStructureName.textContent = (customName || names[type] || "Объект промысла") + (isUnbuilt ? " (Не построено)" : " (Ур. " + lvl + ")");
    if (this.sheetStructureCurrentLevel) this.sheetStructureCurrentLevel.textContent = isUnbuilt ? "Не построено" : "Ур. " + lvl;
    if (this.sheetStructureBonusVal) this.sheetStructureBonusVal.textContent = "+" + Math.round(nextBonus * 100) + "% к дебиту";
    if (this.sheetStructureCost) this.sheetStructureCost.textContent = cost.toLocaleString("ru-RU") + " ₽";

    if (this.btnStructureUpgrade) {
      this.btnStructureUpgrade.disabled = !canAfford;
    }
  }

  openGarageSheet() {
    if (!this.garageSheet) return;
    this.closeAllModals();
    this.closeAllSheets(true);
    this.setDockVisible(false);
    this.garageSheet.classList.remove("hidden", "sliding-down");
    this.updateGarageSheet();
    if (typeof audio?.playTap === "function") audio.playTap();
  }

  closeGarageSheet() {
    if (!this.garageSheet || this.garageSheet.classList.contains("hidden")) return;
    this.garageSheet.classList.add("sliding-down");
    setTimeout(() => {
      if (this.garageSheet && this.garageSheet.classList.contains("sliding-down")) {
        this.garageSheet.classList.add("hidden");
        this.garageSheet.classList.remove("sliding-down");
      }
      this.checkAnySheetOpen();
    }, 220);
  }

  updateGarageSheet() {
    if (!this.garageSheet || this.garageSheet.classList.contains("hidden")) return;
    const lvl = state.garageLevel || 1;
    const isMax = lvl >= 5;
    const cost = state.getGarageUpgradeCost ? state.getGarageUpgradeCost() : 35000;
    const canBuy = state.canUpgradeGarage ? state.canUpgradeGarage() : false;
    const rovers = state.trekolCount || 1;
    const modelNames = [
      "ТРЭКОЛ 39294 (6х6 Патруль)",
      "ТРЭКОЛ 39295 (6х6 Пикап КИПиА)",
      "ТРЭКОЛ 39041 (4х4 «Хантер»)",
      "ТРЭКОЛ «Хаски» (6х6 Экспедиция)",
      "ТРЭКОЛ-МЧС (6х6 Спасатель)"
    ];
    const currentModelName = modelNames[Math.min(modelNames.length - 1, rovers - 1)] || "ТРЭКОЛ 6х6";
    const nextModelName = !isMax ? (modelNames[lvl] || "ТРЭКОЛ") : "МАКСИМУМ";

    if (this.sheetGarageName) {
      this.sheetGarageName.textContent = `Гараж техники (АТБ) (Ур. ${lvl}${isMax ? " МАКС" : ""})`;
    }
    if (this.sheetGarageCurrentRovers) {
      this.sheetGarageCurrentRovers.textContent = `${rovers} ТРЭКОЛ • ${currentModelName} (ППР +${rovers * 15}%)`;
    }
    if (this.sheetGarageNextRovers) {
      this.sheetGarageNextRovers.textContent = isMax ? "МАКСИМУМ" : `${lvl + 1} машины (+${nextModelName})`;
    }
    if (this.sheetGarageCost) {
      this.sheetGarageCost.textContent = isMax ? "МАКС" : `${cost.toLocaleString("ru-RU")} ₽`;
    }
    if (this.garageBtnActionText) {
      this.garageBtnActionText.textContent = isMax ? "МАКСИМАЛЬНЫЙ ПАРК" : "+1 БОКС / ПОКУПКА ТРЭКОЛА";
    }
    if (this.btnGarageUpgrade) {
      this.btnGarageUpgrade.disabled = isMax;
      this.btnGarageUpgrade.classList.toggle("btn-disabled", isMax || !canBuy);
      this.btnGarageUpgrade.classList.toggle("insufficient-funds", !canBuy && !isMax);
      if (this.btnGarageUpgrade.setAttribute) {
        this.btnGarageUpgrade.setAttribute("aria-disabled", isMax || !canBuy ? "true" : "false");
      }
    }
  }

  closeAllSheets(immediate = true) {
    if (immediate) {
      const sheets = [this.sheet, this.facilitySheet, this.canteenSheet, this.garageSheet, this.structureSheet];
      sheets.forEach(s => {
        if (s) {
          s.classList.remove("sliding-down");
          s.classList.add("hidden");
        }
      });
      if (this.purgeTimerInterval) {
        clearInterval(this.purgeTimerInterval);
        this.purgeTimerInterval = null;
      }
      this.setDockVisible(true);
      state.emit("resetCameraFocus");
      state.emit("wellSheetClosed");
      return;
    }
    this.closeWellSheet();
    this.closeFacilitySheet();
    this.closeCanteenSheet();
    this.closeGarageSheet();
    this.closeStructureSheet();
    this.setDockVisible(true);
    state.emit("resetCameraFocus");
  }

  openWellSheet(wellId) {
    if (!this.sheet) return;
    this.closeAllModals();
    this.closeAllSheets(true);
    this.setDockVisible(false);
    this.currentSheetWellId = wellId || state.activeWellId || "well_1";
    this.sheet.classList.remove("hidden", "sliding-down");
    this.updateWellSheet();

    state.emit("focusOnStructure", {
      id: this.currentSheetWellId,
      structureId: this.currentSheetWellId
    });
    if (typeof audio?.playTap === "function") audio.playTap();
  }

  closeWellSheet() {
    if (this.purgeTimerInterval) {
      clearInterval(this.purgeTimerInterval);
      this.purgeTimerInterval = null;
    }
    if (!this.sheet || this.sheet.classList.contains("hidden")) return;
    this.sheet.classList.add("sliding-down");
    state.emit("resetCameraFocus");
    state.emit("wellSheetClosed");
    setTimeout(() => {
      if (this.sheet.classList.contains("sliding-down")) {
        this.sheet.classList.add("hidden");
        this.sheet.classList.remove("sliding-down");
      }
      this.checkAnySheetOpen();
    }, 220);
  }

  updateWellSheet() {
    if (!this.sheet || this.sheet.classList.contains("hidden")) return;
    const def = CONFIG.WELLS.find(w => w.id === this.currentSheetWellId);
    const well = state.wells[this.currentSheetWellId];
    if (!def || !well) return;

    const padWellsCount = typeof state.getWellsCountOnPad === "function" ? state.getWellsCountOnPad(this.currentSheetWellId) : (well.level > 0 ? 2 : 0);
    if (this.sheetBadge) {
      if (!well.unlocked) {
        this.sheetBadge.textContent = "ЗАКРЫТЫЙ КУСТ";
      } else if (well.level === 0) {
        this.sheetBadge.textContent = "НОВАЯ ПЛОЩАДКА • 0 СКВАЖИН";
      } else {
        this.sheetBadge.textContent = `КУСТ • ${padWellsCount} СКВАЖИНЫ`;
      }
    }

    if (this.sheetName) {
      const lvlStr = !well.unlocked ? `(Закрыт)` : (well.level === 0 ? `(Не разбурена)` : `(Ур. ${well.level})`);
      this.sheetName.textContent = `${def.name || "Кустовая площадка"} ${lvlStr}`;
    }

    const stimMult = typeof state.getWellStimulationMultiplier === "function" ? state.getWellStimulationMultiplier(well.id) : 1.0;
    const curIncome = (well.unlocked && well.level > 0) ? (CONFIG.getWellIncome(def.baseIncome, well.level) * stimMult) : 0;
    const nextIncome = (well.level === 0) ? (CONFIG.getWellIncome(def.baseIncome, 1) * stimMult) : (CONFIG.getWellIncome(def.baseIncome, (well.level || 0) + 1) * stimMult);

    if (this.sheetCurDebit) {
      this.sheetCurDebit.textContent = `+${HudView.formatNumber(curIncome)}/сек`;
    }

    if (this.sheetNextDebit) {
      this.sheetNextDebit.textContent = `+${HudView.formatNumber(nextIncome)}/сек`;
    }

    const cost = !well.unlocked ? def.unlockCost : (well.level === 0 ? 50000 : CONFIG.getUpgradeCost(def.baseCost, def.costMultiplier, well.level));
    const canAfford = (state.money || 0) >= cost;

    if (this.sheetUpgradeCost) {
      this.sheetUpgradeCost.textContent = HudView.formatNumber(cost);
    }

    if (this.sheetActionText) {
      if (!well.unlocked) {
        this.sheetActionText.textContent = "РАЗБУРИТЬ КУСТ";
      } else if (well.level === 0) {
        this.sheetActionText.textContent = "🚜 РАЗБУРИТЬ СКВАЖИНУ";
      } else if (padWellsCount < 5) {
        this.sheetActionText.textContent = `+1 СКВАЖИНА НА КУСТЕ (№${padWellsCount + 1})`;
      } else {
        this.sheetActionText.textContent = "+1 УРОВЕНЬ (ГЛУБОКИЙ ГОРИЗОНТ)";
      }
    }

    if (this.btnSheetUpgrade) {
      this.btnSheetUpgrade.disabled = false;
      this.btnSheetUpgrade.classList.toggle("btn-disabled", !canAfford);
      this.btnSheetUpgrade.classList.toggle("insufficient-funds", !canAfford);
      if (this.btnSheetUpgrade.setAttribute) {
        this.btnSheetUpgrade.setAttribute("aria-disabled", !canAfford ? "true" : "false");
      }
    }

    if (this.btnSheetValve) {
      const cooldown = typeof state.getWellMaintenanceCooldown === "function" ? state.getWellMaintenanceCooldown(this.currentSheetWellId) : 0;
      if (cooldown > 0) {
        const mins = Math.floor(cooldown / 60);
        const secs = Math.floor(cooldown % 60);
        const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
        this.btnSheetValve.innerHTML = `<span>⏱️ ТО ЧЕРЕЗ: ${timeStr}</span>`;
        this.btnSheetValve.disabled = true;
      } else {
        const m = state.wellMastery?.[this.currentSheetWellId];
        const isMax = m && m.valve && m.purge && m.sensor;
        this.btnSheetValve.innerHTML = `<span>⚙️ ${isMax ? "ТО СКВАЖИНЫ (+100%)" : "КАЛИБРОВКА СКВАЖИНЫ"}</span>`;
        this.btnSheetValve.disabled = false;
      }
    }
  }

  // --- 2. DISPATCHER CONTROL ROOM DASHBOARD ---

  initDispatchModal() {
    if (typeof document === "undefined") return;
    const btnOpen = document.getElementById("btn-open-dispatch");
    const modal = document.getElementById("modal-dispatch-panel");
    const btnClose = document.getElementById("btn-close-dispatch-modal");

    if (btnOpen && modal) {
      btnOpen.addEventListener("click", () => {
        modal.classList.remove("hidden");
        this.renderDispatcherDashboard();
        if (typeof audio?.playTap === "function") audio.playTap();
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener("click", () => {
        modal.classList.add("hidden");
        if (typeof audio?.playTap === "function") audio.playTap();
      });
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.add("hidden");
        }
      });
    }
  }

  initDispatcherDashboard() {
    const tabs = document.querySelectorAll(".btn-dispatch-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeDispatchTab = tab.dataset.tab || "logistics";
        this.renderDispatcherDashboard();
        if (typeof audio?.playTap === "function") audio.playTap();
      });
    });

    this.renderDispatcherDashboard();
  }

  renderDispatcherDashboard() {
    const modalContainer = document.getElementById("dispatcher-modal-content");
    const containers = [this.dispatchContainer, modalContainer].filter(Boolean);
    if (containers.length === 0) return;

    containers.forEach(c => { c.innerHTML = ""; });

    if (this.activeDispatchTab === "logistics") {
      this.renderLogisticsTab(containers);
    } else if (this.activeDispatchTab === "crew") {
      this.renderCrewTab(containers);
    } else if (this.activeDispatchTab === "contracts") {
      state.emit("renderContractsInline");
    } else {
      this.renderSummaryTab(containers);
    }
  }

  renderLogisticsTab(targetContainers) {
    const containers = targetContainers || [this.dispatchContainer].filter(Boolean);
    const rackLvl = state.loadingRackLevel || 1;
    const rackCost = state.getLoadingRackUpgradeCost ? state.getLoadingRackUpgradeCost() : (rackLvl === 1 ? 25000 : 120000);
    const canUpgradeRack = state.canUpgradeLoadingRack ? state.canUpgradeLoadingRack() : false;
    const storageCur = Math.round(state.oilStorageCurrent || 0);
    const storageCap = state.oilStorageCapacity || 2000;
    const storagePct = Math.min(100, Math.round((storageCur / storageCap) * 100));

    const isGas = state.specialization === "gas" || true; // Gas diorama theme
    const rackTitle = isGas ? `⛽ Газораспределительная станция (ГРС) (Ур. ${rackLvl}/3)` : `🏗️ Наливная эстакада (Ур. ${rackLvl}/3)`;
    const rackSub = isGas ? `Линий редуцирования: ${rackLvl} • Подача товарного метана в магистраль` : `Постов налива: ${rackLvl} • Быстрый слив нефти`;
    const rackBtnText = isGas ? `+1 ЛИНИЯ ГРС (${HudView.formatNumber(rackCost)})` : `+1 ПОСТ (${HudView.formatNumber(rackCost)})`;

    const storageTitle = isGas ? "⚡ Парк РГС &amp; Буллиты (СПГ &amp; Конденсат)" : "🛢️ Парк РВС (Резервуары)";
    const storageSub = isGas ? `Буфер метана: ${storageCur.toLocaleString("ru-RU")} / ${storageCap.toLocaleString("ru-RU")} тыс. м³ (${storagePct}%)` : `Буфер: ${storageCur.toLocaleString("ru-RU")} / ${storageCap.toLocaleString("ru-RU")} bbl (${storagePct}%)`;
    const sellBtnText = isGas ? "ПРОДАТЬ В МАГИСТРАЛЬ" : "ПРОДАТЬ РЕЗЕРВЫ";

    const exportTitle = isGas ? "🚛 СПГ-метановозы &amp; Экспортный терминал" : "🚚 Бензовозы &amp; Экспорт";
    const exportSub = isGas ? "Транзит СПГ на внешние рынки (валюта)" : "Экспортная выручка в валюте";

    containers.forEach(container => {
      // 1. Loading Rack / GRS Card
      const rackCard = document.createElement("div");
      rackCard.className = "dispatch-card";
      rackCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">${rackTitle}</span>
          <span class="dispatch-sub">${rackSub}</span>
        </div>
        ${rackLvl < 3 ? `
          <button class="btn-dispatch-action btn-dispatch-rack" ${!canUpgradeRack ? "disabled" : ""}>
            ${rackBtnText}
          </button>
        ` : `<span class="dispatch-value green-text">МАКС УР.</span>`}
      `;
      const btnUpRack = rackCard.querySelector(".btn-dispatch-rack");
      if (btnUpRack) {
        btnUpRack.addEventListener("click", () => {
          if (state.upgradeLoadingRack && state.upgradeLoadingRack()) {
            this.renderDispatcherDashboard();
          }
        });
      }
      container.appendChild(rackCard);

      // 2. Storage Tanks Card
      const canSell = storageCur > 0;
      const rvsCard = document.createElement("div");
      rvsCard.className = "dispatch-card";
      rvsCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">${storageTitle}</span>
          <span class="dispatch-sub">${storageSub}</span>
        </div>
        <button class="btn-dispatch-action btn-dispatch-sell" ${!canSell ? "disabled" : ""}>
          ${sellBtnText}
        </button>
      `;
      const btnSellStorage = rvsCard.querySelector(".btn-dispatch-sell");
      if (btnSellStorage) {
        btnSellStorage.addEventListener("click", () => {
          if (state.sellStoredReserves) {
            const res = state.sellStoredReserves();
            if (res && res.revenue > 0) {
              this.renderDispatcherDashboard();
            }
          }
        });
      }
      container.appendChild(rvsCard);

      // 3. Tankers & Export Card
      const tankerCard = document.createElement("div");
      tankerCard.className = "dispatch-card";
      tankerCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">${exportTitle}</span>
          <span class="dispatch-sub">${exportSub}</span>
        </div>
        <span class="dispatch-value green-text">${Math.floor(state.dollars || 0).toLocaleString("ru-RU")}</span>
      `;
      container.appendChild(tankerCard);
    });
  }

    renderCrewTab(targetContainers) {
    const containers = targetContainers || [this.dispatchContainer].filter(Boolean);
    const synergy = Math.round(((state.workerSynergy || 1.0) - 1.0) * 100);

    containers.forEach(container => {
      // 1. Personnel Card
      const crewCard = document.createElement("div");
      crewCard.className = "dispatch-card";
      crewCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">👷 Служба КИПиА и добычи газа</span>
          <span class="dispatch-sub">Операторы УКПГ и обходчики скважин • FSM-синергия</span>
        </div>
        <span class="dispatch-value cyan-text">+${synergy}% дебит</span>
      `;
      container.appendChild(crewCard);

      // 2. Lucky Bob Card
      const luckyCard = document.createElement("div");
      luckyCard.className = "dispatch-card";
      luckyCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">🎁 Инженерный патруль (Lucky Bob)</span>
          <span class="dispatch-sub">Периодический осмотр узлов учета газа</span>
        </div>
        <span class="dispatch-value gold-text">Активен</span>
      `;
      container.appendChild(luckyCard);

      // 3. Safety & MCHS Card
      const safeCard = document.createElement("div");
      safeCard.className = "dispatch-card";
      safeCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">🚒 ВГСО &amp; Газоспасательная служба</span>
          <span class="dispatch-sub">Контроль ПДК метана и пожарная безопасность</span>
        </div>
        <span class="dispatch-value green-text">100% готовность</span>
      `;
      container.appendChild(safeCard);
    });
  }

    renderSummaryTab(targetContainers) {
    const containers = targetContainers || [this.dispatchContainer].filter(Boolean);
    const rate = state.getIncomeRate();
    const tap = state.getCurrentTapPower ? state.getCurrentTapPower() : 1;
    const isCorp = Boolean(state.isCorporateEmpire);

    containers.forEach(container => {
      // 1. Production Summary Card
      const prodCard = document.createElement("div");
      prodCard.className = "dispatch-card";
      prodCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">⚡ Суммарный дебит товарного газа</span>
          <span class="dispatch-sub">Базовый отбор: +${HudView.formatNumber(state.getIncomeRate())}/сек</span>
        </div>
        <span class="dispatch-value gold-text">+${HudView.formatNumber(rate)}/сек</span>
      `;
      container.appendChild(prodCard);

      // 2. Corporate Status Card
      const corpCard = document.createElement("div");
      corpCard.className = "dispatch-card";
      const cName = state.ipo?.companyName || "ГазПромНефть";
      const shares = state.ipo?.goldenShares || 0;
      corpCard.innerHTML = `
        <div class="dispatch-info">
          <span class="dispatch-title">🏛️ ${isCorp ? `ПАО «${cName}»` : 'Статус: Газовая корпорация'}</span>
          <span class="dispatch-sub">Золотые акции: +${shares} (${shares * 2}% дивидендов)</span>
        </div>
        <span class="dispatch-value cyan-text">ТИР ${state.corporatePrestigeTier || 1}</span>
      `;
      container.appendChild(corpCard);
    });
  }

  // --- 3. BACKWARDS COMPATIBILITY FOR WELLS LIST ---

  renderInitialCards() {
    if (!this.container) return;
    this.container.innerHTML = "";
    CONFIG.WELLS.forEach(def => {
      const card = document.createElement("div");
      card.className = "well-card";
      card.id = `card-${def.id}`;
      card.dataset.wellId = def.id;
      card.innerHTML = `
        <div class="well-icon-box">${def.icon}</div>
        <div class="well-details">
          <div class="well-title-row">
            <span class="well-name">${def.name || "Скважина"}</span>
            <span class="well-lvl-badge" id="lvl-${def.id}">Ур. 0</span>
          </div>
          <div class="well-metrics" id="metrics-${def.id}">Дебит: 0 ₽/сек</div>
        </div>
        <button class="btn-upgrade" id="btn-up-${def.id}">
          <span class="upgrade-cost-text" id="cost-${def.id}">0 ₽</span>
          <span class="upgrade-sub-text" id="action-text-${def.id}">ПРОКАЧАТЬ</span>
        </button>
      `;

      card.addEventListener("click", (e) => {
        if (!e.target.closest(".btn-upgrade")) {
          state.setActiveWell(def.id);
          this.openWellSheet(def.id);
        }
      });

      const btn = card.querySelector ? card.querySelector(`#btn-up-${def.id}`) : null;
      if (btn && btn.addEventListener) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          state.upgradeWell(def.id);
        });
      }

      this.container.appendChild(card);
    });
    this.updateAllCards();
  }

  initEvents() {
    state.on("moneyChanged", () => {
      this.updateAffordability();
      this.updateWellSheet();
      this.updateFacilitySheet();
      this.updateCanteenSheet();
      if (this.activeDispatchTab === "logistics") {
        this.updateLogisticsButtons();
      }
    });

    state.on("wellUpdated", ({ wellId }) => {
      this.updateCard(wellId);
      this.updateWellSheet();
      this.renderDispatcherDashboard();
    });

    state.on("activeWellChanged", () => {
      this.updateSelectionHighlight();
      if (this.sheet && !this.sheet.classList.contains("hidden")) {
        this.currentSheetWellId = state.activeWellId;
        this.updateWellSheet();
      }
    });

    state.on("openWellUpgradeSheet", ({ wellId }) => {
      this.openWellSheet(wellId);
    });

    state.on("openFacilityUpgradeSheet", () => {
      this.openFacilitySheet();
    });

    state.on("openCanteenUpgradeSheet", () => {
      this.openCanteenSheet();
    });

    state.on("openGarageUpgradeSheet", () => {
      this.openGarageSheet();
    });

    state.on("openStructureUpgradeSheet", (data) => {
      this.openStructureSheet(data?.type || "facility", data?.name, data?.badge);
    });

    if (this.btnCloseStructureSheet) {
      this.btnCloseStructureSheet.addEventListener("click", () => this.closeStructureSheet());
    }

    if (this.btnStructureUpgrade) {
      this.btnStructureUpgrade.addEventListener("click", () => {
        if (!this.currentStructureType) return;
        if (this.currentStructureType === "rd_office") {
          this.closeStructureSheet();
          state.emit("openWorldMap");
          state.progressQuest("world_map", 1);
          return;
        }
        if (state.upgradeStructure(this.currentStructureType)) {
          this.updateStructureSheet();
        } else {
          this.triggerInsufficientFundsFeedback(this.btnStructureUpgrade, this.sheetStructureCost, this.structureSheet);
        }
      });
    }

    state.on("structureUpgraded", () => {
      this.updateStructureSheet();
    });

    state.on("facilityUpgraded", () => {
      this.updateFacilitySheet();
    });

    state.on("canteenUpgraded", () => {
      this.updateCanteenSheet();
    });

    state.on("garageUpgraded", () => {
      this.updateGarageSheet();
    });

    state.on("closeAllBottomSheets", (data) => {
      this.closeAllSheets(data?.immediate ?? true);
    });

    state.on("wellMasteryUpdated", () => {
      this.updateWellSheet();
    });

    state.on("loadingRackUpgraded", () => {
      this.renderDispatcherDashboard();
    });
  }

  updateLogisticsButtons() {
    const btnUpRack = document.getElementById("btn-dispatch-upgrade-rack");
    if (btnUpRack) {
      const canUpgradeRack = state.canUpgradeLoadingRack ? state.canUpgradeLoadingRack() : false;
      btnUpRack.disabled = !canUpgradeRack;
    }
  }

  updateSelectionHighlight() {
    CONFIG.WELLS.forEach(def => {
      const card = document.getElementById(`card-${def.id}`);
      if (!card) return;
      if (def.id === state.activeWellId) {
        card.classList.add("active-selected");
      } else {
        card.classList.remove("active-selected");
      }
    });
  }

  updateCard(wellId) {
    const def = CONFIG.WELLS.find(w => w.id === wellId);
    const well = state.wells[wellId];
    if (!def || !well) return;

    const card = document.getElementById(`card-${wellId}`);
    const lvlEl = document.getElementById(`lvl-${wellId}`);
    const metricsEl = document.getElementById(`metrics-${wellId}`);
    const costEl = document.getElementById(`cost-${wellId}`);
    const actionEl = document.getElementById(`action-text-${wellId}`);
    const btn = document.getElementById(`btn-up-${wellId}`);

    if (!card) return;

    if (!well.unlocked) {
      card.classList.add("locked");
      if (lvlEl) {
        lvlEl.textContent = "🔒 Закрыта";
        lvlEl.style.background = "#334155";
        lvlEl.style.color = "#94a3b8";
      }
      if (metricsEl) {
        metricsEl.innerHTML = `<span style="color:#94a3b8">${def.description || (def.type + " привод • Дебит +" + def.baseIncome + "/с")}</span>`;
      }
      if (costEl) costEl.textContent = HudView.formatNumber(def.unlockCost);
      if (actionEl) actionEl.textContent = "ОТКРЫТЬ";
    } else {
      card.classList.remove("locked");
      if (lvlEl) {
        lvlEl.textContent = `Ур. ${well.level}`;
        lvlEl.style.background = "#1e293b";
        lvlEl.style.color = "#38bdf8";
      }
      const income = CONFIG.getWellIncome(def.baseIncome, well.level);
      const tap = CONFIG.getWellTapPower(def.baseTapPower, well.level);
      if (metricsEl) {
        metricsEl.innerHTML = `Дебит:<span class="well-rate-highlight">+${HudView.formatNumber(income)}/сек</span>`;
      }
      const nextCost = CONFIG.getUpgradeCost(def.baseCost, def.costMultiplier, well.level);
      if (costEl) costEl.textContent = HudView.formatNumber(nextCost);
      if (actionEl) actionEl.textContent = "+1 УРОВЕНЬ";
    }

    this.updateAffordabilityForWell(def, well, btn);
  }

  updateAffordabilityForWell(def, well, btn) {
    if (!btn) return;
    const cost = !well.unlocked ? def.unlockCost : CONFIG.getUpgradeCost(def.baseCost, def.costMultiplier, well.level);
    const canAfford = state.money >= cost;
    btn.disabled = !canAfford;
    if (canAfford) {
      btn.classList.add("can-afford");
    } else {
      btn.classList.remove("can-afford");
    }
  }

  updateAffordability() {
    CONFIG.WELLS.forEach(def => {
      const well = state.wells[def.id];
      const btn = document.getElementById(`btn-up-${def.id}`);
      if (well && btn) {
        this.updateAffordabilityForWell(def, well, btn);
      }
    });
  }

  updateAllCards() {
    CONFIG.WELLS.forEach(def => {
      this.updateCard(def.id);
    });
    this.updateSelectionHighlight();
  }
}
