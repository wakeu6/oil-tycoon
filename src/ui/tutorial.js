/**
 * Onboarding Tutorial, Foreman Savelich FTUE Prologue & Spotlight Coordinator
 * Implements interactive guidance, foreman Savelich progression and spotlight cues.
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

    // FTUE Spotlight & Dialogue Elements
    this.spotlightContainer = document.getElementById("ftue-spotlight-container");
    this.backdropScrim = document.getElementById("ftue-backdrop-scrim");
    this.spotlightHole = document.getElementById("ftue-spotlight-hole");
    this.dialogCard = document.getElementById("ftue-dialog-card");
    this.speakerName = document.getElementById("ftue-speaker-name");
    this.stepBadge = document.getElementById("ftue-step-badge");
    this.dialogText = document.getElementById("ftue-dialog-text");
    this.btnFtueAction = document.getElementById("btn-ftue-action");
    this.ftueActionText = document.getElementById("ftue-action-text");
    this.btnFtueSkip = document.getElementById("btn-ftue-skip");

    this._handTimer = null;
    this._rafId = null;

    this.initEvents();
    this.updateQuestBanner();
    this.updateSavelichModal();
    this.updateFtueFlow();
  }

  initEvents() {
    if (this.btnClaimQuest) {
      this.btnClaimQuest.addEventListener("click", () => {
        if (state.claimQuestReward()) {
          this.updateQuestBanner();
          if (!state.ftueCompleted && (state.ftueStep === 3 || state.ftueStep === 4)) {
            state.completeFtue();
          }
        }
      });
    }

    if (this.backdropScrim) {
      this.backdropScrim.addEventListener("click", () => {
        if (!state.ftueCompleted && state.ftueStep >= 4) {
          state.completeFtue();
        }
      });
    }

    if (this.btnOpenSavelich) {
      this.btnOpenSavelich.addEventListener("click", () => {
        this.openSavelichModal();
      });
    }

    const questInfo = document.getElementById("quest-title-marquee-wrapper") || this.questBanner;
    if (questInfo) {
      questInfo.style.cursor = "pointer";
      questInfo.addEventListener("click", (e) => {
        if (e.target.closest("#btn-claim-quest") || e.target.closest("#btn-open-savelich")) return;
        this.navigateActiveQuestTarget();
      });
    }

    if (this.btnUpgradeSavelich) {
      this.btnUpgradeSavelich.addEventListener("click", () => {
        if (state.upgradeSavelich()) {
          this.updateSavelichModal();
          this.updateQuestBanner();
        }
      });
    }

    if (this.btnCloseSavelich) {
      this.btnCloseSavelich.addEventListener("click", () => {
        this.closeSavelichModal();
      });
    }

    // FTUE Primary Action Button
    if (this.btnFtueAction) {
      this.btnFtueAction.addEventListener("click", () => {
        const step = state.ftueStep || 0;
        if (step === 0) {
          state.grantFtueStartingFund(250000);
          state.advanceFtueStep(1);
        } else if (step === 3) {
          state.claimQuestReward();
          state.completeFtue();
        } else if (step >= 4) {
          state.completeFtue();
        }
      });
    }

    // FTUE Skip Button
    if (this.btnFtueSkip) {
      this.btnFtueSkip.addEventListener("click", () => {
        state.skipFtue();
      });
    }

    // React to game state events
    state.on("ftueStepChanged", () => {
      this.updateFtueFlow();
      this.updateQuestBanner();
    });

    state.on("ftueCompleted", () => {
      this.updateFtueFlow();
      this.updateQuestBanner();
    });

    state.on("questProgress", () => {
      this.updateQuestBanner();
      if (!state.ftueCompleted) this.updateFtueFlow();
    });

    state.on("questClaimed", () => {
      this.updateQuestBanner();
      if (!state.ftueCompleted && (state.ftueStep === 3 || state.ftueStep === 4)) {
        state.completeFtue();
      }
    });

    state.on("wellUpgraded", ({ wellId }) => {
      if (!state.ftueCompleted && state.ftueStep === 2 && wellId === "well_1") {
        if (this.dialogCard) this.dialogCard.classList.remove("dock-top");
        state.emit("closeAllBottomSheets");
        state.advanceFtueStep(3);
      }
    });

    state.on("wellSheetClosed", () => {
      if (!state.ftueCompleted && state.ftueStep === 2) {
        if (this.dialogCard) this.dialogCard.classList.remove("dock-top");
        this.updateFtueFlow();
      }
    });

    state.on("openWellUpgradeSheet", ({ wellId }) => {
      if (!state.ftueCompleted && (state.ftueStep === 1 || state.ftueStep === 0) && wellId === "well_1") {
        state.advanceFtueStep(2);
      } else if (!state.ftueCompleted && state.ftueStep === 2) {
        this.updateFtueFlow();
      }
    });

    state.on("savelichUpgraded", () => {
      this.updateSavelichModal();
    });

    state.on("moneyChanged", () => {
      this.updateSavelichModal();
    });

    state.on("specializationAvailable", () => {
      if (this.spotlightContainer) this.spotlightContainer.classList.add("hidden");
      this.hideHand();
    });

    state.on("specializationChanged", () => {
      if (!state.ftueCompleted) {
        if (this.spotlightContainer) this.spotlightContainer.classList.remove("hidden");
        this.updateFtueFlow();
      }
    });

    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => {
        if (!state.ftueCompleted && state.ftueStep === 1) {
          this.positionSpotlightOnWell("well_1");
        } else if (!state.ftueCompleted && (state.ftueStep === 2 || state.ftueStep === 3)) {
          this.updateFtueFlow();
        }
      });
    }
  }

  updateFtueFlow() {
    if (state.ftueCompleted) {
      if (this.dialogCard) {
        this.dialogCard.classList.remove("dock-top", "center-modal");
        this.dialogCard.classList.add("hidden");
      }
      if (this.backdropScrim) {
        this.backdropScrim.classList.remove("active");
        this.backdropScrim.style.pointerEvents = "none";
      }
      if (this.spotlightContainer) this.spotlightContainer.classList.add("hidden");
      if (this.spotlightHole) this.spotlightHole.style.opacity = "0";
      this.hideHand();
      if (typeof window !== "undefined") {
        if (window.engine3D?.controls) window.engine3D.controls.enabled = true;
        if (window.__gameApp?.canvasView?.engine3D?.controls) window.__gameApp.canvasView.engine3D.controls.enabled = true;
      }
      return;
    }

    const step = state.ftueStep || 0;
    if (this.spotlightContainer) this.spotlightContainer.classList.remove("hidden");

    switch (step) {
      case 0:
        if (this.dialogCard) {
          this.dialogCard.classList.remove("dock-top", "hidden");
          this.dialogCard.classList.add("center-modal");
        }
        if (this.backdropScrim) {
          this.backdropScrim.classList.add("active");
          this.backdropScrim.style.pointerEvents = "auto";
        }
        if (this.spotlightHole) {
          this.spotlightHole.style.opacity = "0";
        }
        if (this.speakerName) this.speakerName.textContent = "Мастер цеха Савельич";
        if (this.stepBadge) this.stepBadge.textContent = "Инструктаж • Шаг 1/4";
        if (this.dialogText) {
          this.dialogText.innerHTML = "Приветствую на Ямале, начальник! Я — Савельич, мастер цеха по добыче нефти и газа. Вечная мерзлота шуток не любит. Держи подъёмную субсидию <strong>250 000 ₽</strong> от округа. Давай разбурим первую эксплуатационную скважину!";
        }
        if (this.btnFtueAction) {
          this.btnFtueAction.classList.remove("hidden");
          if (this.ftueActionText) this.ftueActionText.textContent = "В РАБОТУ! ➔";
        }
        this.hideHand();
        break;

      case 1:
        if (this.dialogCard) this.dialogCard.classList.remove("dock-top", "center-modal", "hidden");
        if (this.backdropScrim) {
          this.backdropScrim.classList.remove("active");
          this.backdropScrim.style.pointerEvents = "none";
        }
        if (this.stepBadge) this.stepBadge.textContent = "Инструктаж • Шаг 2/4";
        if (this.dialogText) {
          this.dialogText.innerHTML = "Жми прямо на <strong>Скважину №1</strong> на кустовой площадке, чтобы подготовить станок к разбуриванию!";
        }
        if (this.btnFtueAction) {
          this.btnFtueAction.classList.add("hidden");
        }
        this.positionSpotlightOnWell("well_1");
        if (typeof window !== "undefined") {
          if (window.engine3D?.controls) window.engine3D.controls.enabled = true;
          if (window.__gameApp?.canvasView?.engine3D?.controls) window.__gameApp.canvasView.engine3D.controls.enabled = true;
        }
        break;

      case 2: {
        // Auto-advance if player already drilled Well 1 (level >= 1)
        if ((state.wells?.well_1?.level || 0) >= 1) {
          if (this.dialogCard) this.dialogCard.classList.remove("dock-top", "center-modal");
          if (this.backdropScrim) {
            this.backdropScrim.classList.remove("active");
            this.backdropScrim.style.pointerEvents = "none";
          }
          state.emit("closeAllBottomSheets");
          state.advanceFtueStep(3);
          return;
        }

        const wellSheet = document.getElementById("well-upgrade-sheet");
        const isSheetOpen = wellSheet && !wellSheet.classList.contains("hidden") && !wellSheet.classList.contains("sliding-down");

        if (this.dialogCard) this.dialogCard.classList.remove("center-modal", "hidden");
        if (this.backdropScrim) {
          this.backdropScrim.classList.remove("active");
          this.backdropScrim.style.pointerEvents = "none";
        }

        if (this.stepBadge) this.stepBadge.textContent = "Инструктаж • Шаг 3/4";
        if (this.dialogText) {
          this.dialogText.innerHTML = "Отлично! Теперь жми <strong>«РАЗБУРИТЬ СКВАЖИНУ»</strong>, чтобы забуриться в продуктивный пласт и получить первый фонтан!";
        }
        if (this.btnFtueAction) {
          this.btnFtueAction.classList.add("hidden");
        }

        if (isSheetOpen) {
          if (this.dialogCard) this.dialogCard.classList.add("dock-top");
          this.positionSpotlightOnElement("btn-sheet-upgrade", true);
          setTimeout(() => {
            if (!state.ftueCompleted && state.ftueStep === 2) {
              this.positionSpotlightOnElement("btn-sheet-upgrade", true);
            }
          }, 260);
        } else {
          if (this.dialogCard) this.dialogCard.classList.remove("dock-top");
          // If sheet was accidentally closed, guide player back to Well 1
          this.positionSpotlightOnWell("well_1");
        }
        break;
      }

      case 3:
        if (this.dialogCard) this.dialogCard.classList.remove("dock-top", "center-modal", "hidden");
        if (this.backdropScrim) {
          this.backdropScrim.classList.remove("active");
          this.backdropScrim.style.pointerEvents = "none";
        }
        if (this.stepBadge) this.stepBadge.textContent = "Инструктаж • Шаг 4/4";
        if (this.dialogText) {
          this.dialogText.innerHTML = "Пошла нефть под давлением! Забирай премию за ввод скважины <strong>500 000 ₽</strong> в верхнем баннере или жми кнопку ниже!";
        }
        if (this.btnFtueAction) {
          this.btnFtueAction.classList.remove("hidden");
          if (this.ftueActionText) this.ftueActionText.textContent = "🎁 ЗАБРАТЬ 500 000 ₽";
        }
        this.positionSpotlightOnElement("btn-claim-quest", true);
        if (typeof window !== "undefined") {
          if (window.engine3D?.controls) window.engine3D.controls.enabled = true;
          if (window.__gameApp?.canvasView?.engine3D?.controls) window.__gameApp.canvasView.engine3D.controls.enabled = true;
        }
        break;

      case 4:
        state.completeFtue();
        break;

      default:
        if (this.dialogCard) this.dialogCard.classList.remove("dock-top", "center-modal");
        if (this.backdropScrim) {
          this.backdropScrim.classList.remove("active");
          this.backdropScrim.style.pointerEvents = "none";
        }
        if (this.spotlightContainer) this.spotlightContainer.classList.add("hidden");
        this.hideHand();
        break;
    }
  }

  positionSpotlightOnElement(elementId, isPill = false) {
    const el = document.getElementById(elementId);
    if (!el || !this.spotlightHole) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.spotlightHole.style.opacity = "1";
    this.spotlightHole.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
    this.spotlightHole.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    this.spotlightHole.style.width = `${Math.round(rect.width + 16)}px`;
    this.spotlightHole.style.height = `${Math.round(rect.height + 16)}px`;
    if (isPill) {
      this.spotlightHole.classList.add("pill-shape");
    } else {
      this.spotlightHole.classList.remove("pill-shape");
    }
    this.positionHandOnCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  positionSpotlightOnWell(wellId = "well_1") {
    let screenPos = null;
    if (typeof window !== "undefined" && window.engine3D && typeof window.engine3D.getWellScreenPosition === "function") {
      screenPos = window.engine3D.getWellScreenPosition(wellId);
    }
    const x = screenPos?.x ?? (typeof window !== "undefined" ? window.innerWidth * 0.45 : 300);
    const y = screenPos?.y ?? (typeof window !== "undefined" ? window.innerHeight * 0.45 : 300);

    if (this.spotlightHole) {
      this.spotlightHole.style.opacity = "1";
      this.spotlightHole.style.left = `${Math.round(x)}px`;
      this.spotlightHole.style.top = `${Math.round(y)}px`;
      this.spotlightHole.style.width = "110px";
      this.spotlightHole.style.height = "110px";
      this.spotlightHole.classList.remove("pill-shape");
    }
    this.positionHandOnCoords(x, y);
  }

  positionHandOnCoords(x, y) {
    if (!this.handPointer) return;
    this.handPointer.classList.remove("hidden");
    this.handPointer.style.left = `${Math.round(x)}px`;
    this.handPointer.style.top = `${Math.round(y)}px`;
  }

  hideHand() {
    if (this.handPointer) {
      this.handPointer.classList.add("hidden");
    }
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
        this.questTitle.style.setProperty("--marquee-distance", `-${overflow}px`);
        this.questTitle.classList.add("marquee-active");
        if (this.questTitleTrack) this.questTitleTrack.classList.add("marquee-running");
        if (this.questTitleSep1) this.questTitleSep1.style.display = "inline";
        if (this.questTitleSep2) this.questTitleSep2.style.display = "inline";
        if (this.questTitleClone) this.questTitleClone.style.display = "inline-block";
      } else {
        this.questTitle.classList.remove("marquee-active");
        this.questTitle.style.removeProperty("--marquee-distance");
        if (this.questTitleTrack) this.questTitleTrack.classList.remove("marquee-running");
        if (this.questTitleSep1) this.questTitleSep1.style.display = "none";
        if (this.questTitleSep2) this.questTitleSep2.style.display = "none";
        if (this.questTitleClone) this.questTitleClone.style.display = "none";
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
    state.emit("closeAllBottomSheets");
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

  navigateActiveQuestTarget() {
    const q = state.getCurrentQuest();
    if (!q || q.completed) return;
    if (audio && typeof audio.playTap === "function") {
      audio.playTap();
    }

    switch (q.id) {
      case "upgrade_well":
        state.emit("openWellUpgradeSheet", { wellId: state.activeWellId || "well_1" });
        break;
      case "upgrade_substation":
        state.emit("openStructureUpgradeSheet", {
          type: "substation",
          name: "КТПН 10/0.4 кВ и ЛЭП",
          badge: "⚡ ЭНЕРГОСЕТЬ"
        });
        break;
      case "upgrade_garage":
        state.emit("openGarageUpgradeSheet");
        break;
      case "upgrade_canteen":
        state.emit("openCanteenUpgradeSheet");
        break;
      case "upgrade_savelich":
        this.openSavelichModal();
        break;
      case "block_blast":
        state.emit("openBlockBlastModal", { wellId: state.activeWellId || "well_1" });
        break;
      case "world_map":
        state.emit("openWorldMap");
        break;
      default:
        break;
    }
  }
}
