import { BasePlatformAdapter } from "./base-adapter.js";

/**
 * YandexGamesAdapter
 * Native adapter for Yandex Games SDK (YaGames).
 */
export class YandexGamesAdapter extends BasePlatformAdapter {
  constructor(bridge) {
    super(bridge);
    this.platformName = "yandex";
    this.ysdk = null;
    this.player = null;
  }

  async init() {
    if (typeof window === "undefined" || !window.YaGames) {
      return false;
    }

    try {
      this.ysdk = await window.YaGames.init();
      if (this.ysdk.environment?.i18n) {
        this.lang = this.ysdk.environment.i18n.lang || "ru";
      }

      try {
        this.player = await this.ysdk.getPlayer({ scopes: false });
      } catch (e) {
        console.warn("[YandexAdapter] Player auth deferred:", e);
      }

      this.reportGameplayStart();
      this.initStickyBanner();
      this.isReady = true;
      return true;
    } catch (err) {
      console.error("[YandexAdapter] Init error:", err);
      return false;
    }
  }

  initStickyBanner() {
    if (this.ysdk?.adv) {
      try {
        this.ysdk.adv.getBannerAdvStatus().then(({ stickyAdvIsShowing }) => {
          if (!stickyAdvIsShowing) {
            this.ysdk.adv.showBannerAdv();
          }
        }).catch(() => {});
      } catch (e) {}
    }
  }

  reportGameplayStart() {
    try {
      this.ysdk?.features?.GameplayAPI?.start();
    } catch (e) {}
  }

  reportGameplayStop() {
    try {
      this.ysdk?.features?.GameplayAPI?.stop();
    } catch (e) {}
  }

  showRewardedAd({ onOpen, onRewarded, onClose, onError }) {
    if (!this.ysdk?.adv) {
      if (onError) onError(new Error("Yandex adv not available"));
      return;
    }

    try {
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { if (onOpen) onOpen(); },
          onRewarded: () => { if (onRewarded) onRewarded(); },
          onClose: () => { if (onClose) onClose(); },
          onError: (err) => { if (onError) onError(err); }
        }
      });
    } catch (err) {
      if (onError) onError(err);
    }
  }

  showInterstitial({ onOpen, onClose, onError }) {
    if (!this.ysdk?.adv) {
      if (onError) onError(new Error("Yandex adv not available"));
      return false;
    }

    try {
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => { if (onOpen) onOpen(); },
          onClose: (wasShown) => { if (onClose) onClose(wasShown); },
          onError: (err) => { if (onError) onError(err); }
        }
      });
      return true;
    } catch (err) {
      if (onError) onError(err);
      return false;
    }
  }

  async saveData(key, data) {
    if (!this.player) return false;
    try {
      await this.player.setData({ [key]: data }, true);
      return true;
    } catch (err) {
      console.warn("[YandexAdapter] Cloud save failed:", err);
      return false;
    }
  }

  async loadData(key) {
    if (!this.player) return null;
    try {
      const res = await this.player.getData([key]);
      return res?.[key] || null;
    } catch (err) {
      console.warn("[YandexAdapter] Cloud load failed:", err);
      return null;
    }
  }

  async requestReview() {
    if (this.ysdk?.feedback) {
      try {
        const { canReview } = await this.ysdk.feedback.canReview();
        if (canReview) {
          const { value } = await this.ysdk.feedback.requestReview();
          return Boolean(value);
        }
      } catch (e) {}
    }
    return false;
  }
}
