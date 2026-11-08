import { BasePlatformAdapter } from "./base-adapter.js";

/**
 * MockAdapter
 * Local developer environment simulation adapter.
 */
export class MockAdapter extends BasePlatformAdapter {
  constructor(bridge) {
    super(bridge);
    this.platformName = "mock";
    this.mockCloudStorage = new Map();
  }

  async init() {
    this.lang = "ru";
    this.isReady = true;
    return true;
  }

  showRewardedAd({ onOpen, onRewarded, onClose, onError }) {
    if (onOpen) onOpen();

    // Fast simulated ad viewing in dev
    setTimeout(() => {
      if (onRewarded) onRewarded();
      if (onClose) onClose();
    }, 250);
  }

  showInterstitial({ onOpen, onClose, onError }) {
    if (onOpen) onOpen();

    setTimeout(() => {
      if (onClose) onClose(true);
    }, 200);

    return true;
  }

  async saveData(key, data) {
    try {
      this.mockCloudStorage.set(key, JSON.parse(JSON.stringify(data)));
      localStorage.setItem(`mock_cloud_${key}`, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  async loadData(key) {
    if (this.mockCloudStorage.has(key)) {
      return this.mockCloudStorage.get(key);
    }
    try {
      const raw = localStorage.getItem(`mock_cloud_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async requestReview() {
    console.log("[MockAdapter] requestReview invoked");
    return true;
  }

  async addToFavorites() {
    console.log("[MockAdapter] addToFavorites invoked");
    return true;
  }
}
