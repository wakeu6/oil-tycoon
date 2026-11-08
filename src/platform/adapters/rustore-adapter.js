import { BasePlatformAdapter } from "./base-adapter.js";

/**
 * RuStoreAdapter
 * Adapter for RuStore Web / WebView App environment.
 */
export class RuStoreAdapter extends BasePlatformAdapter {
  constructor(bridge) {
    super(bridge);
    this.platformName = "rustore";
    this.sdk = null;
  }

  async init() {
    this.lang = "ru";

    if (typeof window !== "undefined") {
      this.sdk = window.rustore || window.RuStore || null;
    }

    if (this.sdk && typeof this.sdk.init === "function") {
      try {
        await this.sdk.init();
      } catch (err) {
        console.warn("[RuStoreAdapter] SDK init warning:", err);
      }
    }

    this.isReady = true;
    return true;
  }

  showRewardedAd({ onOpen, onRewarded, onClose, onError }) {
    if (this.sdk?.ads && typeof this.sdk.ads.showRewardedVideo === "function") {
      try {
        if (onOpen) onOpen();
        this.sdk.ads.showRewardedVideo({
          onRewarded: () => { if (onRewarded) onRewarded(); },
          onClose: () => { if (onClose) onClose(); },
          onError: (e) => { if (onError) onError(e); }
        });
        return;
      } catch (err) {
        console.warn("[RuStoreAdapter] Ad error:", err);
      }
    }

    // Safe fallback for RuStore web wrapper
    if (onOpen) onOpen();
    setTimeout(() => {
      if (onRewarded) onRewarded();
      if (onClose) onClose();
    }, 300);
  }

  showInterstitial({ onOpen, onClose, onError }) {
    if (this.sdk?.ads && typeof this.sdk.ads.showInterstitial === "function") {
      try {
        if (onOpen) onOpen();
        this.sdk.ads.showInterstitial({
          onClose: (wasShown) => { if (onClose) onClose(wasShown); },
          onError: (e) => { if (onError) onError(e); }
        });
        return true;
      } catch (err) {
        console.warn("[RuStoreAdapter] Interstitial error:", err);
      }
    }

    if (onOpen) onOpen();
    setTimeout(() => {
      if (onClose) onClose(true);
    }, 300);
    return true;
  }

  async saveData(key, data) {
    if (this.sdk?.storage && typeof this.sdk.storage.set === "function") {
      try {
        await this.sdk.storage.set(key, JSON.stringify(data));
        return true;
      } catch (err) {
        console.warn("[RuStoreAdapter] Storage set failed:", err);
      }
    }

    // Fallback to localStorage
    try {
      localStorage.setItem(`rustore_${key}`, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  async loadData(key) {
    if (this.sdk?.storage && typeof this.sdk.storage.get === "function") {
      try {
        const res = await this.sdk.storage.get(key);
        if (res) return typeof res === "string" ? JSON.parse(res) : res;
      } catch (err) {
        console.warn("[RuStoreAdapter] Storage get failed:", err);
      }
    }

    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(`rustore_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}
