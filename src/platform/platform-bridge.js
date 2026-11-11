import { audio } from "../audio.js";
import { YandexGamesAdapter } from "./adapters/yandex-adapter.js";
import { VkAdapter } from "./adapters/vk-adapter.js";
import { RuStoreAdapter } from "./adapters/rustore-adapter.js";
import { MockAdapter } from "./adapters/mock-adapter.js";

export function isAdBlockError(err) {
  if (!err) return false;
  if (err.isAdBlock) return true;
  const str = String(err.message || err.error_type || err.error_data?.error_reason || JSON.stringify(err)).toLowerCase();
  return (
    str.includes("adblock") ||
    str.includes("block") ||
    str.includes("filter") ||
    str.includes("extension") ||
    str.includes("failed to fetch") ||
    str.includes("err_blocked_by_client")
  );
}

export function showToast(message, duration = 3000) {
  if (typeof document === "undefined") return;
  let toast = document.getElementById("game-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "game-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("toast-show");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("toast-show");
  }, duration);
}

if (typeof window !== "undefined") {
  window.showToast = showToast;
}

/**
 * PlatformBridge
 * Unified cross-platform abstraction over Yandex Games, VK, RuStore, and Local Dev.
 * Provides resilient lifecycle safety (dt=0 freeze, audio mute during ads and tab blur).
 */
export class PlatformBridge {
  constructor() {
    this.platformType = "mock";
    this.adapter = null;
    this.isReady = false;
    this.lang = "ru";
    this.sessionStartTime = Date.now();
    this.lastInterstitialTime = Date.now();
    this.interstitialCooldownMs = 180 * 1000;
    this.isAdShowing = false;

    // Listeners for lifecycle hooks (game loop pause, audio duck/mute)
    this._freezeCallbacks = new Set();
  }

  get isVK() { return this.platformType === "vk"; }
  get isYandex() { return this.platformType === "yandex"; }
  get isRuStore() { return this.platformType === "rustore"; }
  get isMock() { return this.platformType === "mock"; }

  onFreezeDeltaTime(callback) {
    if (typeof callback === "function") {
      this._freezeCallbacks.add(callback);
    }
  }

  setFreeze(shouldFreeze) {
    for (const cb of this._freezeCallbacks) {
      try { cb(shouldFreeze); } catch (e) {}
    }
  }

  detectEnvironment() {
    try {
      const search = (typeof window !== "undefined" && window.location.search) ? window.location.search : "";
      const host = (typeof window !== "undefined" && window.location.hostname) ? window.location.hostname : "";

      // 1. Check RuStore
      const hasRuStoreParam = search.includes("rustore") || search.includes("platform=rustore");
      const hasRuStoreSdk = Boolean(typeof window !== "undefined" && (window.rustore || window.RuStore));
      if (hasRuStoreParam || hasRuStoreSdk) {
        return "rustore";
      }

      // 2. Check VK
      const hasVKParams = search.includes("vk_app_id") || search.includes("vk_user_id") || search.includes("vk_platform") || search.includes("platform=vk");
      const isVKDomain = host.endsWith("vk.com") || host.endsWith("vk-apps.com") || host.endsWith("userapi.com");
      const isVKBridge = Boolean(typeof window !== "undefined" && window.vkBridge && typeof window.vkBridge.send === "function");
      if (hasVKParams || isVKDomain || (isVKBridge && (window.vkBridge.isWebView?.() || window.vkBridge.isIframe?.()))) {
        return "vk";
      }

      // 3. Check Yandex
      const isIframe = typeof window !== "undefined" && window.self !== window.top;
      const isYandexDomain = host.endsWith("yandex.net") || host.endsWith("yandex.ru") || host.endsWith("yandex.com");
      const hasYandexParam = search.includes("yandex");
      const hasYaGames = Boolean(typeof window !== "undefined" && window.YaGames);
      if (isYandexDomain || hasYandexParam || (hasYaGames && isIframe)) {
        return "yandex";
      }
    } catch (e) {
      console.warn("[PlatformBridge] Environment detection fallback to mock:", e);
    }
    return "mock";
  }

  async init() {
    this.platformType = this.detectEnvironment();

    switch (this.platformType) {
      case "yandex":
        this.adapter = new YandexGamesAdapter(this);
        break;
      case "vk":
        this.adapter = new VkAdapter(this);
        break;
      case "rustore":
        this.adapter = new RuStoreAdapter(this);
        break;
      default:
        this.adapter = new MockAdapter(this);
        break;
    }

    try {
      const success = await this.adapter.init();
      if (!success && this.platformType !== "mock") {
        console.warn(`[PlatformBridge] ${this.platformType} init failed, falling back to mock`);
        this.platformType = "mock";
        this.adapter = new MockAdapter(this);
        await this.adapter.init();
      }
    } catch (err) {
      console.error("[PlatformBridge] Adapter init error:", err);
      this.platformType = "mock";
      this.adapter = new MockAdapter(this);
      await this.adapter.init();
    }

    this.lang = this.adapter.lang || "ru";
    this.isReady = true;
    return true;
  }

  ready() {
    if (this.isYandex && this.adapter?.ysdk?.features?.LoadingAPI) {
      try {
        this.adapter.ysdk.features.LoadingAPI.ready();
      } catch (e) {}
    }
  }

  startGameplay() {
    this.adapter?.reportGameplayStart();
  }

  stopGameplay() {
    this.adapter?.reportGameplayStop();
  }

  reportGameplayStart() {
    this.startGameplay();
  }

  reportGameplayStop() {
    this.stopGameplay();
  }

  /**
   * Safe ad wrapper that enforces audio muting and delta time freeze
   */
  showRewardedVideo({ onOpen, onRewarded, onClose, onError }) {
    this.isAdShowing = true;
    this.setFreeze(true);
    audio.setAdMuted(true);
    this.stopGameplay();

    let rewarded = false;

    const handleOpen = () => {
      if (onOpen) onOpen();
    };

    const handleRewarded = () => {
      rewarded = true;
      if (onRewarded) onRewarded();
    };

    const handleClose = () => {
      this.isAdShowing = false;
      audio.setAdMuted(false);
      this.setFreeze(false);
      this.startGameplay();
      if (onClose) onClose(rewarded);
    };

    const handleError = (err) => {
      console.warn("[PlatformBridge] Rewarded ad error:", err);
      this.isAdShowing = false;
      audio.setAdMuted(false);
      this.setFreeze(false);
      this.startGameplay();

      // STRICT BUSINESS RULE:
      // DO NOT award bonuses if there is no ad, if ad was closed early, or if AdBlock is active!
      if (typeof showToast === "function") {
        if (isAdBlockError(err)) {
          showToast("⚠️ Отключите AdBlock, чтобы получить бонус!");
        } else if (err?.wasClosedEarly) {
          showToast("ℹ️ Реклама не была досмотрена — бонус не начислен.");
        } else {
          showToast("ℹ️ Реклама сейчас недоступна. Попробуйте позже.");
        }
      }

      if (onError) onError(err);
      if (onClose) onClose(false);
    };

    if (this.adapter) {
      this.adapter.showRewardedAd({
        onOpen: handleOpen,
        onRewarded: handleRewarded,
        onClose: handleClose,
        onError: handleError
      });
    } else {
      handleError(new Error("No adapter configured"));
    }
  }

  /**
   * Promise-based rewarded ad helper
   */
  showRewardedAd(placementName = "default") {
    return new Promise((resolve) => {
      this.showRewardedVideo({
        onRewarded: () => resolve(true),
        onError: () => resolve(this.isMock),
        onClose: (rewarded) => resolve(rewarded)
      });
    });
  }

  showInterstitial({ onOpen, onClose, onError } = {}) {
    const now = Date.now();
    const elapsedSinceLast = now - this.lastInterstitialTime;
    if (elapsedSinceLast < this.interstitialCooldownMs) {
      if (onClose) onClose(false);
      return false;
    }
    this.lastInterstitialTime = now;

    this.isAdShowing = true;
    this.setFreeze(true);
    audio.setAdMuted(true);
    this.stopGameplay();

    const handleOpen = () => {
      if (onOpen) onOpen();
    };

    const handleClose = (wasShown) => {
      this.isAdShowing = false;
      audio.setAdMuted(false);
      this.setFreeze(false);
      this.startGameplay();
      if (onClose) onClose(wasShown);
    };

    const handleError = (err) => {
      this.isAdShowing = false;
      audio.setAdMuted(false);
      this.setFreeze(false);
      this.startGameplay();
      if (onError) onError(err);
    };

    if (this.adapter) {
      return this.adapter.showInterstitial({
        onOpen: handleOpen,
        onClose: handleClose,
        onError: handleError
      });
    }

    handleClose(false);
    return false;
  }

  async saveToCloud(data, key = "oil_tycoon_save_v2") {
    if (!data || !this.adapter) return false;
    try {
      return await this.adapter.saveData(key, data);
    } catch (e) {
      return false;
    }
  }

  async loadFromCloud(key = "oil_tycoon_save_v2") {
    if (!this.adapter) return null;
    try {
      // First attempt primary key (v2)
      let data = await this.adapter.loadData(key);
      if (!data && key === "oil_tycoon_save_v2") {
        // Fallback to legacy v1 key for migration
        data = await this.adapter.loadData("oil_tycoon_save_v1");
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  async requestReview() {
    return this.adapter ? await this.adapter.requestReview() : false;
  }

  async addToFavorites() {
    return this.adapter ? await this.adapter.addToFavorites() : false;
  }

  async inviteFriends() {
    if (this.isVK && typeof window !== "undefined" && window.vkBridge) {
      try {
        const res = await window.vkBridge.send("VKWebAppShowInviteBox");
        return Boolean(res?.success);
      } catch (e) {
        return false;
      }
    }
    return false;
  }
}

export const platform = new PlatformBridge();
