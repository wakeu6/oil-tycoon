import { CONFIG } from "./config.js";
import { audio } from "./audio.js";
import { state } from "./state.js";
import { storage } from "./storage.js";
import { platform } from "./platform-bridge.js";
import { IsometricView } from "./engine/isometric-view.js";
import { HudView } from "./ui/hud.js";
import { WellCardsView } from "./ui/well-cards.js";
import { ModalsManager } from "./ui/modals.js";
import { NewsTickerView } from "./ui/ticker.js";
import { TutorialManager } from "./ui/tutorial.js";
import { WorldMapView } from "./ui/world-map.js";
import { BlockBlastView } from "./ui/block-blast-view.js";
import { GeonavGameView, geonavView } from "./ui/geonav-game.js";
import { IndustrialModalView } from "./ui/industrial-modal.js";
import { ContractsBoardView } from "./ui/contracts-board.js";
import { SettlementModalView } from "./ui/settlement-modal.js";
import { MegaprojectModalView } from "./ui/megaproject-modal.js";
import { MarineExportModalView } from "./ui/marine-export-modal.js";

/**
 * TownshipWindowCoordinator
 * Coordinates mutual exclusivity among township modals:
 * contracts, settlement, industrial, megaproject, market, marine.
 * Ensures single-window switching without accumulating hidden background modals,
 * and maintains active tab state on the township dock.
 */
export class TownshipWindowCoordinator {
  constructor(app) {
    this.app = app;
    this.modals = [
      {
        id: "contracts",
        modalId: "modal-contracts-board",
        btnId: "dock-btn-contracts",
        open: () => {
          if (this.app?.contractsBoardView?.open) {
            this.app.contractsBoardView.open();
          } else {
            state.emit("openContractsModal");
            state.emit("openContractsBoard");
          }
        },
        close: () => {
          if (this.app?.contractsBoardView?.close) {
            this.app.contractsBoardView.close();
          } else {
            const el = document.getElementById("modal-contracts-board");
            if (el) el.classList.add("hidden");
          }
        }
      },
      {
        id: "settlement",
        modalId: "modal-settlement",
        btnId: "dock-btn-settlement",
        open: () => {
          if (this.app?.settlementModalView?.open) {
            this.app.settlementModalView.open();
          } else {
            state.emit("openSettlementModal");
          }
        },
        close: () => {
          if (this.app?.settlementModalView?.close) {
            this.app.settlementModalView.close();
          } else {
            const el = document.getElementById("modal-settlement");
            if (el) el.classList.add("hidden");
          }
        }
      },
      {
        id: "industrial",
        modalId: "modal-industrial-sector",
        btnId: "dock-btn-industrial",
        open: () => {
          if (this.app?.industrialModalView?.open) {
            this.app.industrialModalView.open();
          } else {
            state.emit("openIndustrialSectorModal");
          }
        },
        close: () => {
          if (this.app?.industrialModalView?.close) {
            this.app.industrialModalView.close();
          } else {
            const el = document.getElementById("modal-industrial-sector");
            if (el) el.classList.add("hidden");
          }
        }
      },
      {
        id: "megaproject",
        modalId: "modal-megaproject",
        btnId: "dock-btn-megaproject",
        open: () => {
          if (this.app?.megaprojectModalView?.open) {
            this.app.megaprojectModalView.open();
          } else {
            state.emit("openMegaprojectModal");
          }
        },
        close: () => {
          if (this.app?.megaprojectModalView?.close) {
            this.app.megaprojectModalView.close();
          } else {
            const el = document.getElementById("modal-megaproject");
            if (el) el.classList.add("hidden");
          }
        }
      },
      {
        id: "market",
        modalId: "modal-marketplace",
        btnId: "dock-btn-market",
        open: () => {
          if (this.app?.modals?.showMarketplaceModal) {
            this.app.modals.showMarketplaceModal();
          } else {
            state.emit("openMarketplaceModal");
          }
        },
        close: () => {
          if (this.app?.modals?.hideMarketplaceModal) {
            this.app.modals.hideMarketplaceModal();
          } else {
            const el = document.getElementById("modal-marketplace");
            if (el) el.classList.add("hidden");
          }
        }
      },
      {
        id: "marine",
        modalId: "modal-marine-export",
        btnId: null,
        open: () => {
          if (this.app?.marineExportModalView?.open) {
            this.app.marineExportModalView.open();
          } else {
            state.emit("openMarineExportModal");
          }
        },
        close: () => {
          if (this.app?.marineExportModalView?.close) {
            this.app.marineExportModalView.close();
          } else {
            const el = document.getElementById("modal-marine-export");
            if (el) el.classList.add("hidden");
          }
        }
      }
    ];

    this.activeId = null;
    this._switching = false;
    this.init();
  }

  init() {
    this._wireDockButtons();
    this._wireCloseButtons();
    this._wireStateEvents();
    this._observeModals();
  }

  _wireDockButtons() {
    this.modals.forEach(m => {
      if (!m.btnId) return;
      const btn = document.getElementById(m.btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          this.switchTo(m.id);
        });
      }
    });
  }

  _wireCloseButtons() {
    const closeButtons = [
      "btn-close-contracts-modal",
      "btn-close-settlement-modal",
      "btn-close-industrial-modal",
      "btn-close-megaproject-modal",
      "btn-close-marketplace",
      "btn-close-marine-modal"
    ];
    closeButtons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          setTimeout(() => this.syncActiveButton(), 0);
        });
      }
    });
  }

  _wireStateEvents() {
    const eventMap = [
      { evt: "openContractsModal", id: "contracts" },
      { evt: "openContractsBoard", id: "contracts" },
      { evt: "openSettlementModal", id: "settlement" },
      { evt: "openIndustrialSectorModal", id: "industrial" },
      { evt: "openMegaprojectModal", id: "megaproject" },
      { evt: "openMarketplaceModal", id: "market" },
      { evt: "openMarineExportModal", id: "marine" }
    ];
    eventMap.forEach(({ evt, id }) => {
      state.on(evt, () => {
        if (!this._switching) {
          this.closeAllExcept(id);
          this.syncActiveButton();
        }
      });
    });
  }

  _observeModals() {
    if (typeof MutationObserver === "undefined") return;
    this.observer = new MutationObserver(() => {
      this.syncActiveButton();
    });
    this.modals.forEach(m => {
      const el = document.getElementById(m.modalId);
      if (el) {
        this.observer.observe(el, { attributes: true, attributeFilter: ["class"] });
      }
    });
  }

  closeAllExcept(targetId) {
    this.modals.forEach(m => {
      if (m.id !== targetId) {
        if (typeof m.close === "function") m.close();
        const el = document.getElementById(m.modalId);
        if (el) el.classList.add("hidden");
        if (m.btnId) {
          const btn = document.getElementById(m.btnId);
          if (btn) btn.classList.remove("active");
        }
      }
    });
  }

  closeAll() {
    this.modals.forEach(m => {
      if (typeof m.close === "function") m.close();
      const el = document.getElementById(m.modalId);
      if (el) el.classList.add("hidden");
      if (m.btnId) {
        const btn = document.getElementById(m.btnId);
        if (btn) btn.classList.remove("active");
      }
    });
    this.activeId = null;
  }

  switchTo(targetId) {
    if (this._switching) return;
    this._switching = true;
    try {
      // 1. Close all other modals
      this.closeAllExcept(targetId);

      // 2. Open target modal
      const target = this.modals.find(m => m.id === targetId);
      if (target) {
        if (typeof target.open === "function") target.open();
        const el = document.getElementById(target.modalId);
        if (el) el.classList.remove("hidden");
        this.activeId = targetId;
      }
    } finally {
      this._switching = false;
      this.syncActiveButton();
    }
  }

  syncActiveButton() {
    let anyOpen = false;
    this.modals.forEach(m => {
      const el = document.getElementById(m.modalId);
      const isOpen = el && !el.classList.contains("hidden");
      if (m.btnId) {
        const btn = document.getElementById(m.btnId);
        if (btn) {
          if (isOpen) {
            btn.classList.add("active");
            anyOpen = true;
            this.activeId = m.id;
          } else {
            btn.classList.remove("active");
          }
        }
      } else if (isOpen) {
        anyOpen = true;
        this.activeId = m.id;
      }
    });
    if (!anyOpen) {
      this.activeId = null;
      this.clearActiveTabs();
    }
  }

  clearActiveTabs() {
    this.modals.forEach(m => {
      if (m.btnId) {
        const btn = document.getElementById(m.btnId);
        if (btn) btn.classList.remove("active");
      }
    });
  }
}

/**
 * GameApp
 * Main application coordinator managing game lifecycle, render loop,
 * cross-platform bridge integration, and offline progression.
 */
export class GameApp {
  constructor() {
    this.state = state;
    if (typeof window !== "undefined") {
      window.state = state;
    }
    this.canvasView = null;
    this.hudView = null;
    this.wellCardsView = null;
    this.modals = null;
    this.tickerView = null;
    this.geonavView = null;

    this.lastFrameTime = performance.now();
    this.autoSaveTimer = 0;
    this.isSimulationFrozen = false;
    this.isTabHidden = false;
  }

  async start() {
    // 0. Check for reset URL parameter (?reset=1 or ?reset=true)
    if (typeof window !== "undefined" && (window.location.search.includes("reset=1") || window.location.search.includes("reset=true"))) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn("Storage reset error:", e);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // 1. Web Audio Gesture Unlock
    const unlockAudio = () => {
      audio.unlock();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });
    window.addEventListener("touchstart", unlockAudio, { passive: true });

    // 2. Initialize Platform SDK Bridge
    await platform.init();

    // 3. Load Saved Game Data (v2 with v1 auto-migration)
    const savedData = await storage.load();
    if (savedData) {
      state.importSave(savedData);
    }

    // 4. Initialize Isometric 2.5D Canvas View
    const canvasEl = document.getElementById("oil-canvas");
    this.canvasView = new IsometricView(canvasEl);

    // 5. Initialize UI Managers
    this.hudView = new HudView();
    const wellsContainer = document.getElementById("wells-list");
    if (wellsContainer) {
      this.wellCardsView = new WellCardsView(wellsContainer);
    }
    this.modals = new ModalsManager();
    if (state.ftueCompleted) {
      this.modals.checkDailyStreak();
    }
    this.tickerView = new NewsTickerView();
    this.tutorialManager = new TutorialManager();
    this.worldMapView = new WorldMapView();
    this.blockBlastView = new BlockBlastView();
    this.geonavView = geonavView || (typeof document !== "undefined" ? new GeonavGameView() : null);
    this.industrialModalView = new IndustrialModalView(state);
    this.industrialModalView.init();
    this.contractsBoardView = new ContractsBoardView(state);
    this.contractsBoardView.init();
    this.settlementModalView = new SettlementModalView(state);
    this.settlementModalView.init();
    this.megaprojectModalView = new MegaprojectModalView(state);
    this.megaprojectModalView.init();
    this.marineExportModalView = new MarineExportModalView(state);
    this.marineExportModalView.init();

    // Initialize Township Window Coordinator for single-window switching & dock tabs
    this.townshipCoordinator = new TownshipWindowCoordinator(this);
    if (typeof window !== "undefined") {
      window.townshipCoordinator = this.townshipCoordinator;
      window.__gameApp = this;
    }

    // Convenience deep-link for testing modals
    if (typeof window !== "undefined" && window.location) {
      if (window.location.search.includes("modal=settlement") || window.location.hash === "#settlement") {
        setTimeout(() => this.townshipCoordinator?.switchTo("settlement"), 150);
      } else if (window.location.search.includes("modal=megaproject") || window.location.hash === "#megaproject") {
        setTimeout(() => this.townshipCoordinator?.switchTo("megaproject"), 150);
      } else if (window.location.search.includes("modal=marine") || window.location.hash === "#marine") {
        setTimeout(() => this.townshipCoordinator?.switchTo("marine"), 150);
      }
    }

    // Reset Game Fresh button in settings
    const btnResetFresh = document.getElementById("btn-reset-game-fresh");
    if (btnResetFresh) {
      let confirmPending = false;
      let resetTimer = null;
      btnResetFresh.addEventListener("click", () => {
        const textEl = btnResetFresh.querySelector(".btn-danger-text");
        if (!confirmPending) {
          confirmPending = true;
          if (textEl) textEl.textContent = "⚠️ ПОДТВЕРДИТЬ СБРОС (НАЧАТЬ С 0 ₽)";
          btnResetFresh.classList.add("btn-danger-confirming");

          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            confirmPending = false;
            btnResetFresh.classList.remove("btn-danger-confirming");
            if (textEl) textEl.textContent = "Сбросить прогресс игры (Начать с 0 ₽)";
          }, 5000);
          return;
        }

        // Confirmed second tap
        clearTimeout(resetTimer);
        window.__isResetting = true;
        storage.isResetting = true;
        if (state) state.__preventSave = true;

        if (textEl) textEl.textContent = "✅ Сброс выполнен! Перезагрузка...";

        try {
          localStorage.setItem("game_hard_reset_flag", "1");
          storage.clear();
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem("game_hard_reset_flag", "1");
        } catch (e) {
          console.warn("[GameApp] Reset error:", e);
        }

        // Clean reload after 120ms
        setTimeout(() => {
          window.location.href = window.location.origin + window.location.pathname;
        }, 120);
      });
    }

    // Drawer Panel Toggle (More screen for 2.5D world)
    const togglePanelBtn = document.getElementById("btn-toggle-panel");
    const mgmtPanel = document.getElementById("management-panel");
    if (togglePanelBtn && mgmtPanel) {
      togglePanelBtn.addEventListener("click", () => {
        mgmtPanel.classList.toggle("collapsed");
        const isCollapsed = mgmtPanel.classList.contains("collapsed");
        togglePanelBtn.textContent = isCollapsed ? "▲ Пульт" : "▼ Скрыть";
        setTimeout(() => {
          this.canvasView?.resize();
        }, 260);
      });
    }

    // 3D Viewport Controls (Camera mode, Billboard Labels, Day/Night toggle, Center reset)
    const btnCam = document.getElementById("btn-3d-cam");
    const btnLabels = document.getElementById("btn-3d-labels");
    const btnNight = document.getElementById("btn-3d-night");
    const btnReset = document.getElementById("btn-3d-reset");

    if (btnCam) {
      btnCam.addEventListener("click", () => {
        if (this.canvasView?.engine3D) {
          const mode = this.canvasView.engine3D.toggleCameraMode();
          btnCam.textContent = mode === "Изометрия" ? "📐 Изо" : "🎥 Персп";
        }
      });
    }

    if (btnLabels) {
      btnLabels.addEventListener("click", () => {
        if (this.canvasView?.engine3D) {
          const mode = this.canvasView.engine3D.toggleLabelMode();
          const labels = {
            hidden: "🏷️ Скрыты",
            compact: "🏷️ Компакт",
            full: "🏷️ Все"
          };
          btnLabels.textContent = labels[mode] || "🏷️ Метки";
        }
      });
    }

    if (btnNight) {
      btnNight.addEventListener("click", () => {
        if (this.canvasView?.engine3D) {
          const isNight = this.canvasView.engine3D.toggleDayNight();
          btnNight.textContent = isNight ? "🌙 Ночь" : "☀️ День";
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        state.emit("resetCameraFocus");
      });
    }

    // Township Action Dock Wiring is coordinated via this.townshipCoordinator

    // Move Mode HUD Buttons
    const btnMoveConfirm = document.getElementById("btn-move-confirm");
    const btnMoveReset = document.getElementById("btn-move-reset");

    if (btnMoveConfirm) {
      btnMoveConfirm.addEventListener("click", () => {
        state.emit("exitBuildingMoveMode", { save: true });
      });
    }
    if (btnMoveReset) {
      btnMoveReset.addEventListener("click", () => {
        if (this.canvasView?.resetLayout) {
          this.canvasView.resetLayout();
        } else {
          state.resetBuildingPositions();
        }
      });
    }

    // 6. Check Unlock Criteria & Offline Progress
    state.checkSpecializationUnlock();
    this.checkOfflineEarnings(savedData);

    // 7. Lifecycle Safety & Ad Pause Listeners
    platform.onFreezeDeltaTime((shouldFreeze) => {
      this.isSimulationFrozen = Boolean(shouldFreeze);
      if (!this.isSimulationFrozen) {
        this.lastFrameTime = performance.now();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.isTabHidden = true;
        audio.setTabMuted(true);
        platform.stopGameplay();
        storage.save(state.exportSave());
      } else {
        this.isTabHidden = false;
        audio.setTabMuted(false);
        platform.startGameplay();
        this.lastFrameTime = performance.now();
      }
    });

    window.addEventListener("blur", () => {
      this.isTabHidden = true;
      audio.setTabMuted(true);
      platform.stopGameplay();
    });

    window.addEventListener("focus", () => {
      this.isTabHidden = false;
      audio.setTabMuted(false);
      platform.startGameplay();
      this.lastFrameTime = performance.now();
    });

    window.addEventListener("beforeunload", () => {
      storage.save(state.exportSave());
    });

    // 8. Remove Loading Screen with smooth fade
    const loader = document.getElementById("loading-screen");
    if (loader) {
      setTimeout(() => {
        loader.classList.add("fade-out");
        this.canvasView?.resize();
        setTimeout(() => {
          loader.remove();
          this.canvasView?.resize();
        }, 400);
      }, 300);
    }

    platform.ready();
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  checkOfflineEarnings(savedData) {
    if (!savedData || !savedData.lastSaveTime) return;

    const now = Date.now();
    const elapsedSec = (now - savedData.lastSaveTime) / 1000;
    const offlineCfg = state.getOfflineBankParams();

    if (elapsedSec >= offlineCfg.minSecondsToShow) {
      const maxSec = offlineCfg.maxHours * 3600;
      const effectiveSec = Math.min(elapsedSec, maxSec);
      const rate = state.getIncomeRate();
      const offlineEarned = Math.floor(rate * effectiveSec * offlineCfg.efficiency);

      // --- M4 Township Industrial Offline Progression ---
      // 1. Physical Extraction into Inventory
      const wellShift = typeof state.getSettlementBonus === "function" ? state.getSettlementBonus("wells") : 1.0;
      const offlineOil = Math.round(offlineEarned * 0.05 * wellShift);
      const offlineGas = Math.round(offlineEarned * 0.08 * wellShift);

      if (!state.inventory) {
        state.inventory = {
          rawOil: 500, rawGas: 1000, fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0,
          dryGas: 0, lpg: 0, helium: 0, polymers: 0, petrochem: 0
        };
      }
      state.inventory.rawGas = (state.inventory.rawGas || 0) + offlineGas;

      const maxCap = state.getOilStorageCapacity();
      state.oilStorageCurrent = Math.min(maxCap, (state.oilStorageCurrent || 0) + offlineOil);

      // 2. Offline Tanker Voyage Advance
      if (state.marineTerminal && state.marineTerminal.state === "voyage") {
        const vDur = state.marineTerminal.voyageDuration || 60.0;
        const vProg = (state.marineTerminal.voyageProgress || 0.0) + (effectiveSec / vDur);
        if (vProg >= 1.0) {
          if (typeof state.completeVoyage === "function") {
            state.completeVoyage();
          }
        } else {
          state.marineTerminal.voyageProgress = vProg;
        }
      }

      // 3. Offline Life-Support Heating
      if (typeof state.tickSettlement === "function") {
        state.tickSettlement(effectiveSec);
      }

      if (offlineEarned > 0 && this.modals) {
        this.modals.showOfflineModal(effectiveSec, offlineEarned);
      }
    }
  }

  loop(currentTime) {
    try {
      // Delta-time clamping & freeze protection
      let dt = 0;
      if (!this.isSimulationFrozen && !this.isTabHidden) {
        const rawDt = (currentTime - this.lastFrameTime) / 1000;
        dt = Math.min(rawDt, 0.1); // Clamped to 100ms max to prevent physics spiral
      }
      this.lastFrameTime = currentTime;

      // Simulation Tick
      if (dt > 0) {
        state.tick(dt);
      }

      // Render & Visual Update
      if (this.canvasView) {
        this.canvasView.update(dt);
        this.canvasView.render();
      }

      // Autosave Debounce
      if (dt > 0) {
        this.autoSaveTimer += dt;
        if (this.autoSaveTimer >= 4.0) {
          this.autoSaveTimer = 0;
          storage.save(state.exportSave());
        }
      }
    } catch (loopErr) {
      console.error("[GameApp] Critical error in frame loop:", loopErr);
    } finally {
      requestAnimationFrame((t) => this.loop(t));
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new GameApp();
  window.__gameApp = app;
  app.start().catch((err) => {
    console.error("[GameApp] Startup fatal error:", err);
  });
});
