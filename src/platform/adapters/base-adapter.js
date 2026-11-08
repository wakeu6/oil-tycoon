/**
 * BasePlatformAdapter
 * Abstract base class defining the contract for all platform SDK adapters.
 */
export class BasePlatformAdapter {
  constructor(bridge) {
    this.bridge = bridge;
    this.platformName = 'base';
    this.lang = 'ru';
    this.isReady = false;
  }

  async init() {
    this.isReady = true;
    return true;
  }

  showRewardedAd({ onOpen, onRewarded, onClose, onError }) {
    if (onError) onError(new Error('Not implemented'));
  }

  showInterstitial({ onOpen, onClose, onError }) {
    if (onClose) onClose(false);
    return false;
  }

  async saveData(key, data) {
    return false;
  }

  async loadData(key) {
    return null;
  }

  reportGameplayStart() {}

  reportGameplayStop() {}

  async requestReview() {
    return false;
  }

  async addToFavorites() {
    return false;
  }
}
