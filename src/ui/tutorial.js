/**
 * Onboarding Tutorial, Savelich Quests & Animated Hand Pointer
 * Implements interactive guidance, foreman Savelich progression and hand cues.
 */
import { state } from "../state.js";
import { audio } from "../audio.js";

export class TutorialManager {
  constructor() {
    this.questBanner = document.getElementById("savelich-quest-banner");
    this.btnClaimQuest = document.getElementById("btn-claim-quest");
    this.questTitle = document.getElementById("quest-title-text");
    this.questTitleClone = document.getElementById("quest-title-text-clone");
    this.questTitleTrack = document.getElementById("quest-title-track");
    this.questTitleSep1 = document.getElementById("quest-title-sep");
    this.questTitleSep2 = document.getElementById("quest-title-sep-2");
    this.questCounter = document.getElementById("quest-counter-text");
    this.questProgressFill = document.getElementById("quest-progress-fill");
    this.btnOpenSavelich = document.getElementById("btn-open-savelich");
    this.handPointer = document.getElementById("tutorial-hand-pointer");

    // Savelich Upgrade Modal
    this.modalSavelich = document.getElementById("modal-savelich-upgrade");
    this.btnUpgradeSavelich = document.getElementById("btn-upgrade-savelich");
    this.btnCloseSavelich = document.getElementById("btn-close-savelich");
    this.savelichLevelText = document.getElementById("savelich-level-val");
    this.savelichCurrentBonus = document.getElementById("savelich-cur-bonus");
    this.savelichNextBonus = document.getElementById("savelich-next-bonus");
    this.savelichCostText = document.getElementById("savelich-upgrade-cost");

    this._handTimer = null;

    this.initEvents();
    this.updateQuestBanner();
    this.updateSavelichModal();
    this.updateHandPointer();
  }

  initEvents() {
    if (this.btnClaimQuest) {
      this.btnClaimQuest.addEventListener("click", () => {
        if (state.claimQuestReward()) {
          this.updateQuestBanner();
          this.updateHandPointer();
        }
      });
    }

    if (this.btnOpenSavelich) {
      this.btnOpenSavelich.addEventListener("click", () => {
        this.openSavelichModal();
      });
    }

    if (this.btnUpgradeSavelich) {
      this.btnUpgradeSavelich.addEventListener("click", () => {
        if (state.upgradeSavelich()) {
          this.updateSavelichModal();
          this.updateQuestBanner();
          this.hideHand();
        }
      });
    }

    if (this.btnCloseSavelich) {
      this.btnCloseSavelich.addEventListener("click", () => {
        this.closeSavelichModal();
      });
    }

    // Dismiss hand on any user pointer down
    window.addEventListener("pointerdown", () => {
      this.hideHand();
    }, { passive: true });

    if (this.handPointer) {
      this.handPointer.addEventListener("click", () => {
        this.hideHand();
      });
    }

    state.on("questProgress", () => {
      this.updateQuestBanner();
      this.updateHandPointer();
    });

    state.on("questClaimed", () => {
      this.updateQuestBanner();
      this.updateHandPointer();
    });

    state.on("savelichUpgraded", () => {
      this.updateSavelichModal();
      this.hideHand();
    });

    state.on("moneyChanged", () => {
      this.updateSavelichModal();
    });

    state.on("openWellUpgradeSheet", () => {
      if (!state.tutorialCompleted && state.currentQuestIndex === 1) {
        this.positionHandOnElement("btn-sheet-upgrade");
      } else {
        this.hideHand();
      }
    });

    // Hide hand on ANY modal opening
    ["openWorldMap", "openBlockBlastModal", "openCryptoActivationModal", "openIpoModal", "openMarketplaceModal", "openCompanyStockModal", "openStructureUpgradeSheet"].forEach(evt => {
      state.on(evt, () => {
        this.hideHand();
      });
    });
  }

  updateQuestBanner() {
    const q = state.getCurrentQuest();
    if (!q) {
      if (this.questBanner) {
        this.questBanner.classList.add("all-completed");
        if (this.questTitle) this.questTitle.textContent = "Все вводные задания выполнены! Бригада в строю.";
        if (this.questCounter) this.questCounter.textContent = "100%";
        if (this.questProgressFill) this.questProgressFill.style.width = "100%";
        if (this.btnClaimQuest) this.btnClaimQuest.classList.add("hidden");
      }
      this.hideHand();
      return;
    }

    if (this.questTitle) {
      this.questTitle.textContent = q.title;
      if (this.questTitleClone) this.questTitleClone.textContent = q.title;

      const containerWidth = this.questTitle.parentElement?.clientWidth || 150;
      const textWidth = this.questTitle.scrollWidth || (q.title ? q.title.length * 8 : 100);
      const isLong = Boolean(q.title && (q.title.length > 20 || textWidth > containerWidth + 4));

      if (isLong) {
        const overflow = Math.max(40, textWidth - containerWidth + 16);
        this.questTitle.style.setProperty('--marquee-distance', `-${overflow}px`);
        this.questTitle.classList.add('marquee-active');
        if (this.questTitleTrack) this.questTitleTrack.classList.add('marquee-running');
        if (this.questTitleSep1) this.questTitleSep1.style.display = 'inline';
        if (this.questTitleSep2) this.questTitleSep2.style.display = 'inline';
        if (this.questTitleClone) this.questTitleClone.style.display = 'inline-block';
      } else {
        this.questTitle.classList.remove('marquee-active');
        this.questTitle.style.removeProperty('--marquee-distance');
        if (this.questTitleTrack) this.questTitleTrack.classList.remove('marquee-running');
        if (this.questTitleSep1) this.questTitleSep1.style.display = 'none';
        if (this.questTitleSep2) this.questTitleSep2.style.display = 'none';
        if (this.questTitleClone) this.questTitleClone.style.display = 'none';
      }
    }
    if (this.questCounter) this.questCounter.textContent = `${q.current || 0}/${q.target}`;

    const pct = Math.max(0, Math.min(100, Math.round(((q.current || 0) / q.target) * 100)));
    if (this.questProgressFill) this.questProgressFill.style.width = `${pct}%`;

    if (this.btnClaimQuest) {
      this.btnClaimQuest.classList.remove("hidden");
      if (q.completed) {
        this.btnClaimQuest.classList.add("claim-ready");
        this.btnClaimQuest.disabled = false;
        const rewardText = q.rewardMoney > 0 ? `+${q.rewardMoney.toLocaleString("ru-RU")} ₽` : `+${q.rewardCrypto} ⭐`;
        this.btnClaimQuest.innerHTML = `<span class="claim-icon">🎁</span><span>ЗАБРАТЬ</span><span class="claim-amt">${rewardText}</span>`;
      } else {
        this.btnClaimQuest.classList.remove("claim-ready");
        this.btnClaimQuest.disabled = true;
        const rewardText = q.rewardMoney > 0 ? `${q.rewardMoney.toLocaleString("ru-RU")} ₽` : `${q.rewardCrypto} ⭐`;
        this.btnClaimQuest.innerHTML = `<span class="claim-icon">🔒</span><span>НАГРАДА</span><span class="claim-amt">${rewardText}</span>`;
      }
    }
  }

  openSavelichModal() {
    this.hideHand();
    this.updateSavelichModal();
    if (this.modalSavelich) {
      this.modalSavelich.classList.remove("hidden");
    }
  }

  closeSavelichModal() {
    if (this.modalSavelich) {
      this.modalSavelich.classList.add("hidden");
    }
  }

  updateSavelichModal() {
    const lvl = state.savelichLevel || 1;
    const curBonusPct = Math.round((lvl - 1) * 15);
    const nextBonusPct = Math.round(lvl * 15);
    const cost = state.getSavelichUpgradeCost();
    const canAfford = state.canUpgradeSavelich();

    if (this.savelichLevelText) this.savelichLevelText.textContent = `Разряд ${lvl}`;
    if (this.savelichCurrentBonus) this.savelichCurrentBonus.textContent = `+${curBonusPct}% дебит`;
    if (this.savelichNextBonus) this.savelichNextBonus.textContent = `+${nextBonusPct}% дебит`;

    const formatCost = (num) => {
      if (num < 1000000) return `${Math.floor(num).toLocaleString("ru-RU")} ₽`;
      const units = ["", "тыс.", "млн", "млрд", "трлн"];
      const order = Math.floor(Math.log10(num) / 3);
      const unitName = units[order] || "";
      const scaled = num / Math.pow(10, order * 3);
      return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${unitName} ₽`;
    };

    if (this.savelichCostText) this.savelichCostText.textContent = formatCost(cost);

    if (this.btnUpgradeSavelich) {
      this.btnUpgradeSavelich.disabled = !canAfford;
    }
  }

  hasOpenModal() {
    if (typeof document === "undefined") return false;
    const modals = document.querySelectorAll(".modal-backdrop:not(.hidden)");
    return modals.length > 0;
  }

  updateHandPointer() {
    if (state.tutorialCompleted || this.hasOpenModal()) {
      this.hideHand();
      return;
    }

    const q = state.getCurrentQuest();
    if (!q) {
      this.hideHand();
      return;
    }

    if (q.completed) {
      this.positionHandOnElement("btn-claim-quest");
      return;
    }

    if (q.id === "harvest_passive" || q.id === "tap_well") {
      this.positionHandOnCoords(window.innerWidth * 0.45, window.innerHeight * 0.45);
    } else if (q.id === "upgrade_well") {
      const wellSheet = document.getElementById("well-upgrade-sheet");
      if (wellSheet && !wellSheet.classList.contains("hidden")) {
        this.positionHandOnElement("btn-sheet-upgrade");
      }
    } else if (q.id === "upgrade_savelich") {
      const savModal = document.getElementById("modal-savelich-upgrade");
      if (savModal && !savModal.classList.contains("hidden")) {
        this.positionHandOnElement("btn-upgrade-savelich");
      } else {
        this.positionHandOnElement("btn-open-savelich");
      }
    } else {
      this.hideHand();
    }
  }

  positionHandOnElement(elementId) {
    if (this.hasOpenModal() && elementId !== "btn-upgrade-savelich") {
      this.hideHand();
      return;
    }

    const el = document.getElementById(elementId);
    if (!el || !this.handPointer) {
      this.hideHand();
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      this.hideHand();
      return;
    }

    const targetX = rect.left + rect.width * 0.5;
    const targetY = rect.top + rect.height * 0.5;
    this.positionHandOnCoords(targetX, targetY);
  }

  positionHandOnCoords(x, y) {
    if (!this.handPointer) return;
    if (this._handTimer) clearTimeout(this._handTimer);

    this.handPointer.classList.remove("hidden");
    this.handPointer.style.left = `${Math.round(x)}px`;
    this.handPointer.style.top = `${Math.round(y)}px`;

    // Automatically hide after 6 seconds so it NEVER lingers indefinitely
    this._handTimer = setTimeout(() => {
      this.hideHand();
    }, 6000);
  }

  hideHand() {
    if (this._handTimer) {
      clearTimeout(this._handTimer);
      this._handTimer = null;
    }
    if (this.handPointer) {
      this.handPointer.classList.add("hidden");
    }
  }
}
