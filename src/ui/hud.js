import { state } from "../state.js";
import { audio } from "../audio.js";
import { platform } from "../platform-bridge.js";
import { CONFIG } from "../config.js";

export class HudView {
  constructor() {
    const g = (id) => document.getElementById(id);
    this.moneyEl = g("stat-money");
    this.dollarsEl = g("stat-dollars");
    this.cryptoEl = g("stat-crypto");
    this.marketBtn = g("btn-market-trigger");
    this.advisorBubble = g("advisor-bubble");
    this.advisorTitle = g("advisor-title");
    this.advisorText = g("advisor-text");
    this.btnDismissAdvisor = g("btn-dismiss-advisor");
    this.rateEl = g("stat-income-rate");
    this.soundBtn = g("btn-sound");
    this.boostBtn = g("btn-boost");
    this.favoriteBtn = g("btn-favorite");
    this.btnIpo = g("btn-ipo-trigger");
    this.companyNameEl = g("hud-company-name");
    this.companyContainerEl = g("hud-company-container");
    this.platformTitleEl = g("hud-platform-title");
    this.boostIndicator = g("boost-indicator");
    this.boostTimerEl = g("boost-timer");
    this.boostBarFill = g("boost-bar-fill");
    this.activeWellNameEl = g("active-well-name");
    this.activeWellStatEl = g("active-well-stat");
    this.specBadge = g("hud-spec-badge");
    this.specIcon = g("hud-spec-icon");
    this.specName = g("hud-spec-name");
    this.specBuff = g("hud-spec-buff");
    this.gameAppEl = g("game-app");
    this.debitPill = g("rewarded-debit-pill");
    this.btnWatchDebitAd = g("btn-watch-debit-ad");
    this.btnDismissDebitAd = g("btn-dismiss-debit-ad");

    this._unlockedFeatures = {};
    this._initialized = false;

    this.initEvents();
    this.updateAudioButton();
    this.updateSpecialization(state.specialization);
    this.updateActiveWell(state.getActiveWellDef());
    this.updateCompanyName(state.ipo ? state.ipo.companyName : "");
    this.updateIpoButton();
    this.syncFeatureGating();
    this._initialized = true;

    if (this.dollarsEl) this.dollarsEl.textContent = "$" + Math.floor(state.dollars || 0).toLocaleString("ru-RU");
    if (this.cryptoEl) this.cryptoEl.textContent = Math.floor(state.crypto || 0).toLocaleString("ru-RU") + " ⚡";
  }

  static formatNumber(num) {
    if (num < 1000) return Math.floor(num).toLocaleString("ru-RU") + " ₽";
    const units = ["", "тыс.", "млн", "млрд", "трлн"];
    const order = Math.floor(Math.log10(num) / 3);
    const unitName = units[order] || "";
    const scaled = num / Math.pow(10, order * 3);
    return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${unitName} ₽`;
  }

  syncFeatureGating() {
    const features = [
      { id: "btn-open-dispatch", key: "dispatch" },
      { id: "btn-boost", key: "boost" },
      { id: "btn-open-settlement", key: "settlement" },
      { id: "btn-market-trigger", key: "market" },
      { id: "btn-open-contracts", key: "contracts" },
      { id: "btn-open-industrial", key: "industrial" },
      { id: "btn-open-marine", key: "marine" },
      { id: "btn-open-megaproject", key: "megaproject" },
      { id: "btn-ipo-trigger", key: "ipo" }
    ];

    features.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const isUnlocked = typeof state.isFeatureUnlocked === "function" ? state.isFeatureUnlocked(key) : true;
      const wasUnlocked = Boolean(this._unlockedFeatures[key]);

      if (!isUnlocked) {
        el.classList.add("hud-icon-locked");
        el.classList.remove("hud-icon-revealed");
      } else {
        el.classList.remove("hud-icon-locked");
        if (!wasUnlocked && this._initialized) {
          el.classList.add("hud-icon-revealed");
          if (typeof audio?.playCoin === "function") audio.playCoin();
        }
        this._unlockedFeatures[key] = true;
      }
    });
  }

  initEvents() {
    if (this.favoriteBtn) {
      if (platform.isVK) {
        this.favoriteBtn.classList.remove("hidden");
      }
      this.favoriteBtn.addEventListener("click", () => {
        platform.addToFavorites();
      });
    }

    if (this.soundBtn) {
      this.soundBtn.addEventListener("click", () => {
        audio.toggleMute();
        this.updateAudioButton();
      });
    }

    const btnSettings = document.getElementById("btn-settings-toggle");
    const modalSettings = document.getElementById("modal-settings");
    const btnCloseSettings = document.getElementById("btn-close-settings");
    const btnSettingSound = document.getElementById("btn-setting-sound");
    const btnSettingCam = document.getElementById("btn-setting-cam");
    const btnSettingNight = document.getElementById("btn-setting-night");

    const syncSettingsButtons = () => {
      if (btnSettingSound) {
        btnSettingSound.innerHTML = audio.isMuted
          ? '<span class="toggle-text">ВЫКЛ</span><span class="toggle-icon">🔇</span>'
          : '<span class="toggle-text">ВКЛ</span><span class="toggle-icon">🔊</span>';
      }
      const btn3d = document.getElementById("btn-3d-cam");
      if (btnSettingCam) {
        const isIso = btn3d ? btn3d.textContent.includes("Изо") : true;
        btnSettingCam.innerHTML = isIso
          ? '<span class="toggle-text">ИЗОМЕТРИЯ</span><span class="toggle-icon">📐</span>'
          : '<span class="toggle-text">ПЕРСПЕКТИВА</span><span class="toggle-icon">🎥</span>';
      }
      const btnNight = document.getElementById("btn-3d-night");
      if (btnSettingNight) {
        const isNight = btnNight ? btnNight.textContent.includes("Ночь") : false;
        btnSettingNight.innerHTML = isNight
          ? '<span class="toggle-text">НОЧЬ</span><span class="toggle-icon">🌙</span>'
          : '<span class="toggle-text">ДЕНЬ</span><span class="toggle-icon">☀️</span>';
      }
    };

    if (btnSettings && modalSettings) {
      btnSettings.addEventListener("click", () => {
        syncSettingsButtons();
        modalSettings.classList.remove("hidden");
      });
    }
    if (btnCloseSettings && modalSettings) {
      btnCloseSettings.addEventListener("click", () => modalSettings.classList.add("hidden"));
    }
    if (btnSettingSound) {
      btnSettingSound.addEventListener("click", () => {
        audio.toggleMute();
        this.updateAudioButton();
        syncSettingsButtons();
      });
    }
    if (btnSettingCam) {
      btnSettingCam.addEventListener("click", () => {
        const btn3d = document.getElementById("btn-3d-cam");
        if (btn3d) btn3d.click();
        syncSettingsButtons();
      });
    }
    if (btnSettingNight) {
      btnSettingNight.addEventListener("click", () => {
        const btnNight = document.getElementById("btn-3d-night");
        if (btnNight) btnNight.click();
        syncSettingsButtons();
      });
    }

    const btnQuickPlus = document.getElementById("btn-quick-plus");
    if (btnQuickPlus) {
      btnQuickPlus.addEventListener("click", () => state.emit("openBoostModal"));
    }
    const btnQuickStarPlus = document.getElementById("btn-quick-star-plus");
    if (btnQuickStarPlus) {
      btnQuickStarPlus.addEventListener("click", () => state.emit("openCryptoActivationModal"));
    }

    if (this.btnIpo) {
      this.btnIpo.addEventListener("click", () => {
        if (state.ipo && state.ipo.ipoCount > 0) {
          state.emit("openCompanyStockModal");
        } else {
          state.emit("openIpoModal");
        }
      });
    }

    if (this.companyContainerEl) {
      this.companyContainerEl.addEventListener("click", () => {
        state.emit("openCompanyStockModal");
      });
    }
    if (this.companyNameEl) {
      this.companyNameEl.addEventListener("click", () => {
        state.emit("openCompanyStockModal");
      });
    }
    if (this.specBadge) {
      this.specBadge.addEventListener("click", () => {
        state.emit("openSpecializationInfoModal");
      });
    }
    if (this.marketBtn) {
      this.marketBtn.addEventListener("click", () => {
        state.emit("openMarketplaceModal");
      });
    }
    if (this.btnDismissAdvisor) {
      this.btnDismissAdvisor.addEventListener("click", () => {
        this.hideAdvisor();
      });
    }

    if (this.btnWatchDebitAd) {
      this.btnWatchDebitAd.addEventListener("click", () => {
        this.hideDebitPill();
        platform.showRewardedVideo({
          onRewarded: () => {
            state.activateBoost(180, 2.0);
            if (typeof audio?.playBoost === "function") audio.playBoost();
            if (typeof window.showToast === "function") window.showToast("⚡ Дебит x2 удвоен на 3 мин!");
          },
          onError: () => {
            state.activateBoost(180, 2.0);
            if (typeof audio?.playBoost === "function") audio.playBoost();
            if (typeof window.showToast === "function") window.showToast("⚡ Спонсорский буст: дебит x2 активен!");
          }
        });
      });
    }

    if (this.btnDismissDebitAd) {
      this.btnDismissDebitAd.addEventListener("click", () => {
        this.hideDebitPill();
      });
    }

    setInterval(() => {
      if (!state.boost?.active && Math.random() < 0.75) {
        this.showDebitPill();
      }
    }, 160000);

    state.on("dollarsChanged", ({ dollars }) => {
      if (this.dollarsEl) this.dollarsEl.textContent = "$" + Math.floor(dollars || 0).toLocaleString("ru-RU");
    });
    state.on("cryptoChanged", ({ crypto }) => {
      if (this.cryptoEl) this.cryptoEl.textContent = Math.floor(crypto || 0).toLocaleString("ru-RU") + " ⚡";
    });
    state.on("advisorTip", (d) => {
      this.showAdvisor(d);
    });
    state.on("moneyChanged", ({ money }) => {
      if (this.moneyEl) this.moneyEl.textContent = HudView.formatNumber(money);
      if (this.rateEl) this.rateEl.textContent = `${HudView.formatNumber(state.getIncomeRate())}/сек`;
      this.updateIpoButton();
      this.syncFeatureGating();
    });
    state.on("boostUpdated", (boost) => {
      if (boost.active) {
        if (this.boostIndicator) this.boostIndicator.classList.remove("hidden");
        if (this.boostTimerEl) this.boostTimerEl.textContent = `${Math.ceil(boost.remainingSec)}с`;
        const pct = Math.max(0, Math.min(100, (boost.remainingSec / boost.totalDurationSec) * 100));
        if (this.boostBarFill) this.boostBarFill.style.width = `${pct}%`;
      } else {
        if (this.boostIndicator) this.boostIndicator.classList.add("hidden");
      }
      if (this.rateEl) this.rateEl.textContent = `${HudView.formatNumber(state.getIncomeRate())}/сек`;
      this.updateActiveWell(state.getActiveWellDef());
    });
    state.on("activeWellChanged", (def) => {
      this.updateActiveWell(def);
    });
    state.on("wellUpdated", () => {
      if (this.rateEl) this.rateEl.textContent = `${HudView.formatNumber(state.getIncomeRate())}/сек`;
      this.updateActiveWell(state.getActiveWellDef());
      this.syncFeatureGating();
    });
    state.on("specializationChanged", ({ type }) => {
      this.updateSpecialization(type);
      if (this.rateEl) this.rateEl.textContent = `${HudView.formatNumber(state.getIncomeRate())}/сек`;
      this.updateActiveWell(state.getActiveWellDef());
    });
    state.on("ipoComplete", ({ companyName }) => {
      this.updateCompanyName(companyName);
      this.updateIpoButton();
      if (this.rateEl) this.rateEl.textContent = `${HudView.formatNumber(state.getIncomeRate())}/сек`;
      this.syncFeatureGating();
    });
    state.on("ftueCompleted", () => {
      this.syncFeatureGating();
    });
    state.on("ftueStepChanged", () => {
      this.syncFeatureGating();
    });
    state.on("sectorUnlocked", () => {
      this.syncFeatureGating();
    });
  }

  updateAudioButton() {
    if (!this.soundBtn) return;
    this.soundBtn.innerHTML = '<span class="btn-icon-symbol">' + (audio.isMuted ? "🔇" : "🔊") + "</span>";
    this.soundBtn.style.opacity = audio.isMuted ? "0.6" : "1";
  }

  updateSpecialization(s) {
    if (!this.specBadge) return;
    const o = s === "oil", g = s === "gas";
    this.specBadge.classList.toggle("hidden", !s);
    this.specBadge.classList.toggle("badge-oil", o);
    this.specBadge.classList.toggle("badge-gas", g);
    if (this.gameAppEl) {
      this.gameAppEl.classList.toggle("theme-oil", o);
      this.gameAppEl.classList.toggle("theme-gas", g);
    }
    if (this.specIcon && s) this.specIcon.textContent = o ? "🛢️" : "🔥";
    if (this.specName && s) this.specName.textContent = o ? "НЕФТЬ" : "ГАЗ";
    if (this.specBuff && s) this.specBuff.textContent = o ? "x2.5" : "+45%";
  }

  updateActiveWell(def) {
    if (!def) return;
    const well = state.wells[def.id];
    if (this.activeWellNameEl) this.activeWellNameEl.textContent = def.name;
    const income = CONFIG.getWellIncome(def.baseIncome, well ? well.level : 1);
    if (this.activeWellStatEl) {
      this.activeWellStatEl.textContent = `Дебит: +${HudView.formatNumber(income)}/сек (ур. ${well ? well.level : 1})`;
    }
  }

  updateCompanyName(name) {
    if (!this.companyNameEl) return;
    if (name && typeof name === "string" && name.trim().length > 0) {
      const tier = state.corporatePrestigeTier || 1;
      const tierStars = "⭐".repeat(Math.min(5, tier));
      this.companyNameEl.textContent = `ПАО «${name.trim()}» ${tierStars}`;
      this.companyNameEl.classList.add("corporate-prestige");
      if (this.companyContainerEl) this.companyContainerEl.classList.remove("hidden");
      this.companyNameEl.classList.remove("hidden");
      if (this.platformTitleEl) {
        this.platformTitleEl.classList.add("hidden");
      }
    } else {
      this.companyNameEl.textContent = "";
      this.companyNameEl.classList.remove("corporate-prestige");
      if (this.companyContainerEl) this.companyContainerEl.classList.add("hidden");
      this.companyNameEl.classList.add("hidden");
      if (this.platformTitleEl) {
        this.platformTitleEl.classList.remove("hidden");
      }
    }
  }

  updateIpoButton() {
    if (!this.btnIpo) return;
    const threshold = CONFIG.IPO?.CAPITAL_THRESHOLD || 1000000000;
    const canIpo = (state.money || 0) >= threshold;
    const hasPrestiged = Boolean(state.ipo && state.ipo.ipoCount > 0);
    if (hasPrestiged) {
      this.btnIpo.classList.remove("hidden");
      this.btnIpo.disabled = false;
      this.btnIpo.classList.add("ipo-ready");
      this.btnIpo.setAttribute("title", "Биржевой терминал акций ПАО");
      const iconEl = this.btnIpo.querySelector(".ipo-hud-icon");
      const textEl = this.btnIpo.querySelector(".ipo-hud-text");
      if (iconEl) iconEl.textContent = "📈";
      if (textEl) textEl.textContent = "АКЦИИ";
    } else {
      this.btnIpo.classList.toggle("hidden", !canIpo);
      this.btnIpo.disabled = !canIpo;
      this.btnIpo.classList.toggle("ipo-ready", canIpo);
      this.btnIpo.setAttribute("title", "Выход на IPO");
      const iconEl = this.btnIpo.querySelector(".ipo-hud-icon");
      const textEl = this.btnIpo.querySelector(".ipo-hud-text");
      if (iconEl) iconEl.textContent = "🏛️";
      if (textEl) textEl.textContent = "IPO";
    }
  }

  showAdvisor(d) {
    if (!d) return;
    if (this.advisorTitle) this.advisorTitle.textContent = d.title || "Мастер цеха Савельич";
    if (this.advisorText) this.advisorText.textContent = d.text || "";
    if (this.advisorBubble) {
      this.advisorBubble.classList.remove("hidden", "sliding-out");
      if (this._advisorTimeout) clearTimeout(this._advisorTimeout);
      this._advisorTimeout = setTimeout(() => {
        this.hideAdvisor();
      }, 3800);
    }
  }

  hideAdvisor() {
    if (!this.advisorBubble) return;
    if (this._advisorTimeout) {
      clearTimeout(this._advisorTimeout);
      this._advisorTimeout = null;
    }
    this.advisorBubble.classList.add("sliding-out");
    setTimeout(() => {
      if (this.advisorBubble.classList.contains("sliding-out")) {
        this.advisorBubble.classList.add("hidden");
        this.advisorBubble.classList.remove("sliding-out");
      }
    }, 240);
  }

  showDebitPill() {
    if (!this.debitPill) return;
    this.debitPill.classList.remove("hidden", "sliding-out");
    if (this._debitTimeout) clearTimeout(this._debitTimeout);
    this._debitTimeout = setTimeout(() => {
      this.hideDebitPill();
    }, 15000);
  }

  hideDebitPill() {
    if (!this.debitPill) return;
    if (this._debitTimeout) {
      clearTimeout(this._debitTimeout);
      this._debitTimeout = null;
    }
    this.debitPill.classList.add("sliding-out");
    setTimeout(() => {
      if (this.debitPill.classList.contains("sliding-out")) {
        this.debitPill.classList.add("hidden");
        this.debitPill.classList.remove("sliding-out");
      }
    }, 240);
  }
}
