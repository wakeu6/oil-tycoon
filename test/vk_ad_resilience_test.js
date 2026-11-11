import assert from "node:assert";
import { VkAdapter } from "../src/platform/adapters/vk-adapter.js";

console.log("=== RUNNING VK STRICT AD COMPLIANCE VERIFICATION ===");

// 1. Mock window and vkBridge
let lastSendMethod = null;
let lastSendParams = null;
let shouldFailAd = false;
let adResultValue = true;
let simulateAdBlock = false;

globalThis.document = {
  createElement: (tag) => {
    return {
      className: "",
      style: {},
      setAttribute: () => {},
      offsetParent: simulateAdBlock ? null : { clientWidth: 100 },
      offsetHeight: simulateAdBlock ? 0 : 20,
      offsetLeft: simulateAdBlock ? 0 : 10,
      remove: function() { this.parentNode = null; },
      parentNode: null
    };
  },
  body: {
    appendChild: (el) => { el.parentNode = true; },
    removeChild: (el) => { el.parentNode = null; }
  }
};

globalThis.window = {
  showToast: (msg) => { console.log("  [Toast triggered]:", msg); },
  getComputedStyle: (el) => ({ display: simulateAdBlock ? "none" : "block", visibility: simulateAdBlock ? "hidden" : "visible" }),
  document: globalThis.document,
  vkBridge: {
    send: async (method, params) => {
      lastSendMethod = method;
      lastSendParams = params;
      if (method === "VKWebAppInit") return { result: true };
      if (method === "VKWebAppShowNativeAds") {
        if (shouldFailAd) {
          throw new Error("Ads not found / No fill / Blocked by client");
        }
        return { result: adResultValue };
      }
      return { result: true };
    }
  }
};

const adapter = new VkAdapter({});
await adapter.init();

// Test 1: Full ad watch completion (result: true)
console.log("\n--- Test 1: Full Ad Watch Completion (result: true) ---");
let rewarded1 = false;
let closed1 = false;
let error1 = null;
adapter.showRewardedAd({
  onRewarded: () => { rewarded1 = true; },
  onClose: (status) => { closed1 = status; },
  onError: (err) => { error1 = err; }
});
await new Promise(r => setTimeout(r, 50));
assert.strictEqual(rewarded1, true, "Reward must be granted ONLY on successful completion");
assert.strictEqual(closed1, true, "onClose(true) must be called");
assert.strictEqual(error1, null, "No error on successful ad");
assert.strictEqual(lastSendParams.use_interstitial_fallback, true, "use_interstitial_fallback must be enabled");
console.log("  [PASS] Successfully watched ad yields reward");

// Test 2: User closes ad early (result: false) -> ZERO reward
console.log("\n--- Test 2: User Closed Ad Early (result: false) ---");
adResultValue = false;
shouldFailAd = false;
let rewarded2 = false;
let closed2 = true;
let error2 = null;
adapter.showRewardedAd({
  onRewarded: () => { rewarded2 = true; },
  onClose: (status) => { closed2 = status; },
  onError: (err) => { error2 = err; }
});
await new Promise(r => setTimeout(r, 50));
assert.strictEqual(rewarded2, false, "ZERO reward when user closes ad early");
assert.strictEqual(closed2, false, "onClose(false) when closed early");
assert.strictEqual(error2?.wasClosedEarly, true, "Error must flag wasClosedEarly");
console.log("  [PASS] Closed early: zero reward, flagged wasClosedEarly");

// Test 3: Ad no fill / network error -> ZERO reward
console.log("\n--- Test 3: Ad No Fill / Network Rejection ---");
shouldFailAd = true;
let rewarded3 = false;
let closed3 = true;
let error3 = null;
adapter.showRewardedAd({
  onRewarded: () => { rewarded3 = true; },
  onClose: (status) => { closed3 = status; },
  onError: (err) => { error3 = err; }
});
await new Promise(r => setTimeout(r, 50));
assert.strictEqual(rewarded3, false, "ZERO reward when ad fails to load / no fill");
assert.strictEqual(closed3, false, "onClose(false) on failure");
assert(error3 !== null, "onError must be triggered with failure error");
console.log("  [PASS] No fill / error: zero reward, handled gracefully");

// Test 4: AdBlock Active -> ZERO reward
console.log("\n--- Test 4: AdBlock Active Detection ---");
shouldFailAd = false;
adResultValue = true;
simulateAdBlock = true;
let rewarded4 = false;
let closed4 = true;
let error4 = null;
adapter.showRewardedAd({
  onRewarded: () => { rewarded4 = true; },
  onClose: (status) => { closed4 = status; },
  onError: (err) => { error4 = err; }
});
await new Promise(r => setTimeout(r, 50));
assert.strictEqual(rewarded4, false, "ZERO reward when AdBlock is detected");
assert.strictEqual(closed4, false, "onClose(false) when AdBlock active");
assert.strictEqual(error4?.isAdBlock, true, "Error must flag isAdBlock: true");
console.log("  [PASS] AdBlock detected: zero reward, flagged isAdBlock");

console.log("\n=======================================================");
console.log("   ALL VK STRICT AD COMPLIANCE TESTS PASSED (100%)!    ");
console.log("=======================================================");
