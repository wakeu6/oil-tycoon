import { BasePlatformAdapter } from "./base-adapter.js";

/**
 * VkAdapter
 * Native adapter for VK Mini Apps and VK Play web bridge.
 * Includes resilient storage chunking (bypassing VK's 4096-byte key limit)
 * and dynamic banner offset management.
 */
export class VkAdapter extends BasePlatformAdapter {
  constructor(bridge) {
    super(bridge);
    this.platformName = "vk";
    this.CHUNK_SIZE = 3500; // Safe threshold well below 4096 bytes for UTF-8 string safety
  }

  async init() {
    if (typeof window === "undefined" || !window.vkBridge) {
      return false;
    }

    try {
      await window.vkBridge.send("VKWebAppInit");
      const params = new URLSearchParams(window.location.search);
      this.lang = params.get("vk_language") || "ru";
      this.initStickyBanner();
      this.isReady = true;
      return true;
    } catch (err) {
      console.error("[VkAdapter] Init error:", err);
      return false;
    }
  }

  initStickyBanner() {
    if (typeof window !== "undefined" && window.vkBridge) {
      try {
        window.vkBridge.send("VKWebAppShowBannerAd", { banner_location: "bottom" })
          .then((data) => {
            if (data?.result && data.banner_height) {
              const h = Math.max(50, Math.min(100, Number(data.banner_height) || 50));
              if (typeof document !== "undefined" && document.documentElement) {
                document.documentElement.style.setProperty("--vk-banner-offset", `${h}px`);
              }
              console.log("[VkAdapter] Sticky banner active, bottom offset:", h);
            }
          })
          .catch(() => {});
      } catch (e) {}
    }
  }

  showRewardedAd({ onOpen, onRewarded, onClose, onError }) {
    if (typeof window === "undefined" || !window.vkBridge) {
      if (onError) onError(new Error("VK Bridge not available"));
      return;
    }

    if (onOpen) onOpen();

    window.vkBridge.send("VKWebAppShowNativeAds", { ad_format: "reward" })
      .then((data) => {
        if (data && data.result) {
          if (onRewarded) onRewarded();
        }
        if (onClose) onClose();
      })
      .catch((err) => {
        if (onError) onError(err);
      });
  }

  showInterstitial({ onOpen, onClose, onError }) {
    if (typeof window === "undefined" || !window.vkBridge) {
      if (onError) onError(new Error("VK Bridge not available"));
      return false;
    }

    if (onOpen) onOpen();

    window.vkBridge.send("VKWebAppShowNativeAds", { ad_format: "interstitial" })
      .then((res) => {
        if (onClose) onClose(Boolean(res && res.result));
      })
      .catch((err) => {
        if (onError) onError(err);
      });

    return true;
  }

  /**
   * Resilient save with automatic chunking for VK's 4096-byte storage limit
   */
  async saveData(key, data) {
    if (typeof window === "undefined" || !window.vkBridge) return false;
    try {
      const jsonStr = JSON.stringify(data);

      if (jsonStr.length <= this.CHUNK_SIZE) {
        // Direct save under single key; mark meta as unchunked
        await window.vkBridge.send("VKWebAppStorageSet", { key, value: jsonStr });
        try {
          await window.vkBridge.send("VKWebAppStorageSet", { key: `${key}_meta`, value: "" });
        } catch (_) {}
        return true;
      }

      // Chunked save: split into parts <= CHUNK_SIZE
      const chunksCount = Math.ceil(jsonStr.length / this.CHUNK_SIZE);
      const meta = JSON.stringify({
        chunks: chunksCount,
        totalLength: jsonStr.length,
        version: 3,
        timestamp: Date.now()
      });

      // 1. Write meta descriptor
      await window.vkBridge.send("VKWebAppStorageSet", { key: `${key}_meta`, value: meta });

      // 2. Write each chunk
      for (let i = 0; i < chunksCount; i++) {
        const start = i * this.CHUNK_SIZE;
        const part = jsonStr.slice(start, start + this.CHUNK_SIZE);
        await window.vkBridge.send("VKWebAppStorageSet", { key: `${key}_${i}`, value: part });
      }

      // Clear legacy raw key to avoid stale conflicts
      try {
        await window.vkBridge.send("VKWebAppStorageSet", { key, value: "" });
      } catch (_) {}

      return true;
    } catch (err) {
      console.warn("[VkAdapter] StorageSet failed:", err);
      return false;
    }
  }

  /**
   * Resilient load reconstructing chunked or standard saves
   */
  async loadData(key) {
    if (typeof window === "undefined" || !window.vkBridge) return null;
    try {
      // 1. Request primary key and chunk metadata
      const res = await window.vkBridge.send("VKWebAppStorageGet", { keys: [key, `${key}_meta`] });
      const map = {};
      if (res?.keys) {
        res.keys.forEach(k => { map[k.key] = k.value; });
      }

      // 2. Check if chunked save exists
      if (map[`${key}_meta`] && map[`${key}_meta`].trim().length > 0) {
        try {
          const meta = JSON.parse(map[`${key}_meta`]);
          if (meta?.chunks && meta.chunks > 0) {
            const chunkKeys = [];
            for (let i = 0; i < meta.chunks; i++) {
              chunkKeys.push(`${key}_${i}`);
            }
            const chunkRes = await window.vkBridge.send("VKWebAppStorageGet", { keys: chunkKeys });
            const chunkMap = {};
            if (chunkRes?.keys) {
              chunkRes.keys.forEach(k => { chunkMap[k.key] = k.value; });
            }

            let reconstructed = "";
            for (let i = 0; i < meta.chunks; i++) {
              reconstructed += chunkMap[`${key}_${i}`] || "";
            }

            if (reconstructed.length > 0) {
              return JSON.parse(reconstructed);
            }
          }
        } catch (parseErr) {
          console.warn("[VkAdapter] Chunk reconstruction failed, checking direct key:", parseErr);
        }
      }

      // 3. Fallback to unchunked direct key
      if (map[key] && map[key].trim().length > 0) {
        return JSON.parse(map[key]);
      }

      return null;
    } catch (err) {
      console.warn("[VkAdapter] StorageGet failed:", err);
      return null;
    }
  }

  async addToFavorites() {
    if (typeof window === "undefined" || !window.vkBridge) return false;
    try {
      const res = await window.vkBridge.send("VKWebAppAddToFavorites");
      return Boolean(res?.result);
    } catch (e) {
      return false;
    }
  }

  async share(wallText = "Я управляю полярным нефтегазовым промыслом на Ямале! Присоединяйся!") {
    if (typeof window === "undefined" || !window.vkBridge) return false;
    try {
      const res = await window.vkBridge.send("VKWebAppShowWallPostBox", { message: wallText });
      return Boolean(res?.post_id);
    } catch (e) {
      return false;
    }
  }

  async inviteFriends() {
    if (typeof window === "undefined" || !window.vkBridge) return false;
    try {
      const res = await window.vkBridge.send("VKWebAppShowInviteBox");
      return Boolean(res?.success);
    } catch (e) {
      return false;
    }
  }
}
