import assert from "node:assert";
import { VkAdapter } from "../src/platform/adapters/vk-adapter.js";

console.log("=== RUNNING VK AD RESILIENCE VERIFICATION ===");

// 1. Mock window and vkBridge
let lastSendMethod = null;
let lastSendParams = null;
let shouldFailReward = false;
let shouldFailFallback = false;

globalThis.window = {
  showToast: (msg) => { console.log("  [Toast triggered]:", msg); },
  vkBridge: {
    send: async (method, params) => {
      lastSendMethod = method;
      lastSendParams = params;
      if (method === "VKWebAppInit") return { result: true };
      if (method === "VKWebAppShowNativeAds") {
        if (params.ad_format === "reward" && shouldFailReward) {
          throw new Error("Ads not found / No fill");
        }
        if (params.ad_format === "interstitial" && shouldFailFallback) {
          throw new Error("Interstitial failed");
        }
        return { result: true };
      }
      return { result: true };
    }
  }
};

const adapter = new VkAdapter({});
await adapter.init();

// Test A: Normal rewarded ad success
console.log("\n--- Test A: Normal Rewarded Ad Success ---");
let rewardedA = false;
let closedA = false;
adapter.showRewardedAd({
  onRewarded: () => { rewardedA = true; },
  onClose: () => { closedA = true; }
});
await new Promise(r => setTimeout(r, 50));
assert.strictEqual(rewardedA, true, "Reward should be granted on success");
assert.strictEqual(lastSendParams.use_interstitial_fallback, true, "Should enable use_interstitial_fallback");
console.log("  [PASS] Normal ad rewarded and fallback flag enabled");

// Test B: Rewarded video fails -> Fallback succeeds
console.log("\n--- Test B: Video No-Fill -> Interstitial Fallback ---");
shouldFailReward = true;
shouldFailFallback = false;
let rewardedB = false;
let closedB = false;
adapter.showRewardedAd({
  onRewarded: () => { rewardedB = true; },
  onClose: () => { closedB = true; }
});
await new Promise(r => setTimeout(r, 50));
assert.strictEqual(rewardedB, true, "Reward should be granted via fallback");
assert.strictEqual(lastSendParams.ad_format, "interstitial", "Should fallback to interstitial");
console.log("  [PASS] Interstitial fallback succeeded and rewarded");

// Test C: Both fail (desktop web / AdBlock / unmoderated) -> Graceful reward
console.log("\n--- Test C: Both Video & Fallback Fail (Zero Fill / AdBlock) ---");
shouldFailReward = true;
shouldFailFallback = true;
let rewardedC = false;
let closedC = false;
adapter.showRewardedAd({
  onRewarded: () => { rewardedC = true; },
  onClose: () => { closedC = true; }
});
await new Promise(r => setTimeout(r, 50));
assert.strictEqual(rewardedC, true, "Grace reward must be granted to player");
console.log("  [PASS] Graceful reward granted without crashing or showing alert()");

console.log("\n=== ALL VK AD RESILIENCE TESTS PASSED! ===");
