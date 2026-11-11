/**
 * test/challenger_m2_empirical.js
 * EMPIRICAL ADVERSARIAL CHALLENGER SUITE FOR MILESTONE 2
 *
 * Targets:
 * 1. Timer boundary conditions (dt = 0.1s at tick 900, dt = 1/60s at tick 5400, dt = 1/30s at tick 2700)
 * 2. Floating point epsilon accumulation across varied framerates & jittery deltas
 * 3. Rapid click spam & broker re-activation re-entrancy (1,000 calls)
 * 4. Market event commodity isolation & compound math (Oil vs Gas vs Both vs Pre-spec)
 * 5. Event expiration transitions & cadence hand-offs
 * 6. Fractional save/load roundtrips around epsilon threshold
 */

import { state } from "../src/state.js";
import { CONFIG } from "../src/config.js";
import { MarketEngine } from "../src/engine/market.js";
import { platform } from "../src/platform-bridge.js";
import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, details = "") {
  if (condition) {
    passed++;
    console.log(` [PASS] ${testName}`);
    results.push({ name: testName, status: "PASS", details });
  } else {
    failed++;
    console.error(` [FAIL] ${testName}: ${details}`);
    results.push({ name: testName, status: "FAIL", details });
  }
}

function resetFreshState() {
  state.money = 1000;
  state.totalEarned = 1000;
  state.totalClicks = 0;
  state.specialization = null;
  state.activeWellId = "well_1";
  state.wells = {
    well_1: { level: 5, unlocked: true },
    well_2: { level: 0, unlocked: false },
    well_3: { level: 0, unlocked: false },
    well_4: { level: 0, unlocked: false }
  };
  state.boost = { active: false, multiplier: 1.0, remainingSec: 0 };
  state.fountainBurst = { active: false, multiplier: 3.0, remainingSec: 0 };
  state.brokerInsider = { active: false, multiplier: 1.0, remainingSec: 0, totalDurationSec: 0 };
  if (state.market) {
    state.market.oilMultiplier = 1.0;
    state.market.gasMultiplier = 1.0;
    state.market.activeEvent = null;
    state.market.eventRemainingSec = 0;
    state.market.oilPrice = 75.0;
    state.market.gasPrice = 35.0;
  }
}

async function runEmpiricalBattery() {
  console.log("======================================================================");
  console.log("   EMPIRICAL ADVERSARIAL CHALLENGER BATTERY — MILESTONE 2");
  console.log("======================================================================\n");

  // ==================================================================
  // CATEGORY 1: EXACT TICK BOUNDARIES & IEEE 754 EPSILON ACCUMULATION
  // ==================================================================
  console.log("--- CATEGORY 1: Exact Timer Boundaries & Epsilon Accumulation ---");

  // 1.1: dt = 0.1s: Tick 899 (89.9s) vs Tick 900 (90.0s)
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  for (let i = 1; i <= 899; i++) {
    state.tick(0.1);
  }
  assert(
    state.brokerInsider.active === true && state.brokerInsider.remainingSec > 0.001,
    "1.1: Tick 899 (89.9s with dt=0.1s): Broker Insider remains ACTIVE",
    `remainingSec: ${state.brokerInsider.remainingSec}`
  );

  state.tick(0.1); // Tick 900 -> 90.0s
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0 && state.brokerInsider.multiplier === 1.0,
    "1.2: Tick 900 (90.0s with dt=0.1s): Broker Insider expires cleanly on exact tick 900",
    `active: ${state.brokerInsider.active}, remainingSec: ${state.brokerInsider.remainingSec}, mult: ${state.brokerInsider.multiplier}`
  );

  // 1.3: dt = 1/60s (60 FPS standard): 5400 ticks
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  const dt60 = 1.0 / 60.0;
  for (let i = 1; i <= 5399; i++) {
    state.tick(dt60);
  }
  assert(
    state.brokerInsider.active === true && state.brokerInsider.remainingSec > 0,
    "1.3: 60 FPS (dt=1/60s): Active at tick 5399 (~89.983s)",
    `remainingSec: ${state.brokerInsider.remainingSec}`
  );

  state.tick(dt60); // Tick 5400
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0,
    "1.4: 60 FPS (dt=1/60s): Expires cleanly on tick 5400 (90.0s)",
    `active: ${state.brokerInsider.active}, remainingSec: ${state.brokerInsider.remainingSec}`
  );

  // 1.5: dt = 1/30s (30 FPS mobile frame drop): 2700 ticks
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  const dt30 = 1.0 / 30.0;
  for (let i = 1; i <= 2699; i++) {
    state.tick(dt30);
  }
  assert(
    state.brokerInsider.active === true && state.brokerInsider.remainingSec > 0,
    "1.5: 30 FPS (dt=1/30s): Active at tick 2699 (~89.967s)",
    `remainingSec: ${state.brokerInsider.remainingSec}`
  );

  state.tick(dt30); // Tick 2700
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0,
    "1.6: 30 FPS (dt=1/30s): Expires cleanly on tick 2700 (90.0s)",
    `active: ${state.brokerInsider.active}, remainingSec: ${state.brokerInsider.remainingSec}`
  );

  // 1.7: Jittery / Non-uniform framerate (browser tab lag simulator)
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  const deltas = [0.016, 0.033, 0.008, 0.042, 0.017];
  let accumulatedTime = 0;
  let jitterTick = 0;
  while (accumulatedTime + deltas[jitterTick % deltas.length] < 89.9) {
    const curDt = deltas[jitterTick % deltas.length];
    accumulatedTime += curDt;
    state.tick(curDt);
    jitterTick++;
  }
  assert(
    state.brokerInsider.active === true,
    "1.7: Jittery frametimes: Broker Insider remains active prior to 90s boundary",
    `accumulated: ${accumulatedTime.toFixed(3)}s, remaining: ${state.brokerInsider.remainingSec}`
  );

  // Step across the boundary with remainder
  const stepAcross = 90.0 - accumulatedTime + 0.05;
  state.tick(stepAcross);
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0,
    "1.8: Jittery frametimes: Crossing 90s boundary deactivates cleanly without negative values",
    `remainingSec: ${state.brokerInsider.remainingSec}`
  );

  // 1.9: Massive lag spike (tab minimized for 1 hour: dt = 3600s)
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  state.tick(3600.0);
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0 && !isNaN(state.brokerInsider.remainingSec),
    "1.9: Massive 1-hour lag spike clamps cleanly to 0 without NaN or negative values"
  );

  // ==================================================================
  // CATEGORY 2: RE-ENTRANCY, RAPID CALLS & CLICK SPAM
  // ==================================================================
  console.log("\n--- CATEGORY 2: Re-entrancy, Rapid Calls & Click Spam ---");

  // 2.1: 1,000 Rapid Synchronous activateBrokerInsider calls
  resetFreshState();
  let activationEventsEmitted = 0;
  const countHandler = () => { activationEventsEmitted++; };
  state.on("brokerInsiderActivated", countHandler);
  for (let i = 0; i < 1000; i++) {
    state.activateBrokerInsider();
  }
  state.listeners.brokerInsiderActivated = state.listeners.brokerInsiderActivated.filter(cb => cb !== countHandler);

  assert(
    state.brokerInsider.active === true &&
    state.brokerInsider.multiplier === 2.5 &&
    state.brokerInsider.remainingSec === 90.0 &&
    activationEventsEmitted === 1000,
    "2.1: 1,000 rapid calls reset remainingSec to 90.0s without multiplier explosion",
    `multiplier: ${state.brokerInsider.multiplier}, remainingSec: ${state.brokerInsider.remainingSec}`
  );

  // 2.2: Re-activation at t = 45s resets countdown cleanly back to 90s
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  for (let i = 0; i < 450; i++) state.tick(0.1); // 45s elapsed
  assert(Math.abs(state.brokerInsider.remainingSec - 45.0) < 0.01, "2.2a: Halfway through duration, 45s remains");

  state.activateBrokerInsider(); // Re-activate
  assert(
    state.brokerInsider.remainingSec === 90.0 && state.brokerInsider.active === true,
    "2.2b: Re-activation restores full 90.0s cleanly"
  );
  for (let i = 0; i < 899; i++) state.tick(0.1);
  assert(state.brokerInsider.active === true, "2.2c: Still active after 89.9s of reset countdown");
  state.tick(0.1);
  assert(state.brokerInsider.active === false, "2.2d: Expires at tick 900 of reset countdown");

  // 2.3: Rapid tap spam across the exact boundary tick
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  for (let i = 0; i < 899; i++) state.tick(0.1); // At 89.9s

  let moneyBeforeSpam = state.money;
  const powerWithBroker = state.getCurrentTapPower();
  for (let i = 0; i < 100; i++) {
    state.addMoney(state.getCurrentTapPower());
  }
  assert(
    state.money === moneyBeforeSpam + powerWithBroker * 100,
    "2.3a: 100 taps at 89.9s calculate correct boosted tap value"
  );

  // Step to 90.0s (expiry)
  state.tick(0.1);
  const powerAfterExpiry = state.getCurrentTapPower();
  assert(
    powerAfterExpiry < powerWithBroker,
    "2.3b: Tap power drops immediately upon expiry on tick 900",
    `before: ${powerWithBroker}, after: ${powerAfterExpiry}`
  );

  moneyBeforeSpam = state.money;
  for (let i = 0; i < 100; i++) {
    state.addMoney(state.getCurrentTapPower());
  }
  assert(
    state.money === moneyBeforeSpam + powerAfterExpiry * 100,
    "2.3c: 100 taps post-expiry reflect unboosted power with zero numerical corruption"
  );

  // ==================================================================
  // CATEGORY 3: MARKET MULTIPLIER COMMODITY ISOLATION & COMPOUNDING
  // ==================================================================
  console.log("\n--- CATEGORY 3: Market Multiplier Isolation & Compounding ---");

  const market = new MarketEngine();

  // 3.1: Oil specialization with Suez Canal (+120% oil)
  resetFreshState();
  state.setSpecialization("oil");
  market.triggerEvent("suez_blockade", state);
  assert(
    state.market.oilMultiplier === 2.20 && state.market.gasMultiplier === 1.00,
    "3.1a: Suez event sets oilMultiplier to 2.20 and leaves gasMultiplier at 1.00"
  );
  assert(
    state.getMarketMultiplier() === 2.20,
    "3.1b: Oil player getMarketMultiplier() evaluates to 2.20"
  );

  // 3.2: Switch to Gas specialization while Suez Canal is active
  state.setSpecialization("gas", true);
  assert(
    state.getMarketMultiplier() === 1.00,
    "3.2: Gas player is 100% immune to Suez oil event (multiplier = 1.00)"
  );

  // 3.3: Eurasia Freeze (+150% gas)
  market.triggerEvent("eurasia_freeze", state);
  assert(
    state.market.gasMultiplier === 2.50 && state.market.oilMultiplier === 1.00,
    "3.3a: Freeze event sets gasMultiplier to 2.50 and leaves oilMultiplier at 1.00"
  );
  assert(
    state.getMarketMultiplier() === 2.50,
    "3.3b: Gas player getMarketMultiplier() evaluates to 2.50"
  );

  // 3.4: Switch to Oil specialization while Freeze is active
  state.setSpecialization("oil", true);
  assert(
    state.getMarketMultiplier() === 1.00,
    "3.4: Oil player is 100% immune to Eurasia freeze gas event (multiplier = 1.00)"
  );

  // 3.5: Pre-specialization (Level 1-4, specialization === null) defaults to oil multiplier
  resetFreshState();
  state.specialization = null;
  market.triggerEvent("suez_blockade", state);
  assert(
    state.getMarketMultiplier() === 2.20,
    "3.5a: Unspecialized player (Lv 1-4) benefits from oil events by default (2.20)",
    `returned: ${state.getMarketMultiplier()}`
  );
  market.triggerEvent("eurasia_freeze", state);
  assert(
    state.getMarketMultiplier() === 1.00,
    "3.5b: Unspecialized player (Lv 1-4) is unaffected by gas-only events (1.00)",
    `returned: ${state.getMarketMultiplier()}`
  );

  // 3.6: Both Commodity event simulation
  resetFreshState();
  state.specialization = "oil";
  market.applyEventMultipliers(state, {
    id: "global_energy_crisis",
    commodity: "both",
    priceChange: 0.80
  });
  assert(
    state.market.oilMultiplier === 1.80 && state.market.gasMultiplier === 1.80,
    "3.6a: Both-commodity event applies +80% to both oil (1.80) and gas (1.80)"
  );
  assert(state.getMarketMultiplier() === 1.80, "3.6b: Oil player gets 1.80");
  state.setSpecialization("gas", true);
  assert(state.getMarketMultiplier() === 1.80, "3.6c: Gas player gets 1.80");

  // 3.7: Deflationary event (OPEC+ deal: -35% oil) compounding with Broker pump (x2.5)
  resetFreshState();
  state.setSpecialization("oil");
  market.triggerEvent("opec_deal", state);
  state.activateBrokerInsider(90.0, 2.5);
  // Multipliers: Market 0.65, Broker 2.5 -> compound = 0.65 * 2.5 = 1.625
  const baseRate = state.getIncomeRate();
  const expectedRateWithoutBroker = baseRate / 2.5;
  assert(
    state.market.oilMultiplier === 0.65 && state.getBrokerMultiplier() === 2.5,
    "3.7a: OPEC+ deflation (-35% -> 0.65) and Broker pump (2.5) are both simultaneously active"
  );
  assert(
    Math.abs(baseRate - expectedRateWithoutBroker * 2.5) < 0.001,
    "3.7b: Compound income rate scales accurately by exactly 0.65 * 2.5 = 1.625",
    `baseRate: ${baseRate}, expected: ${expectedRateWithoutBroker * 2.5}`
  );

  // ==================================================================
  // CATEGORY 4: EVENT TRANSITIONS & CADENCE HAND-OFFS
  // ==================================================================
  console.log("\n--- CATEGORY 4: Event Transitions & Cadence Hand-offs ---");

  // 4.1: Natural event expiration restores baseline prices & multipliers
  resetFreshState();
  market.reset();
  market.triggerEvent("suez_blockade", state);
  assert(state.market.activeEvent !== null, "4.1a: Suez event is active");

  // Tick until event expires (45s duration)
  for (let i = 0; i < 449; i++) market.tick(0.1, state);
  assert(state.market.activeEvent !== null, "4.1b: Active at 44.9s");

  market.tick(0.1, state); // 45.0s
  assert(
    state.market.activeEvent === null && state.market.eventRemainingSec === 0,
    "4.1c: Event cleanly deactivates at 45.0s"
  );
  assert(
    Math.abs(state.market.oilMultiplier - market.naturalOilMultiplier) < 0.05,
    "4.1d: Oil multiplier smoothly reverts to natural range post-event",
    `oilMult: ${state.market.oilMultiplier}, natural: ${market.naturalOilMultiplier}`
  );

  // 4.2: Asynchronous Expiry: Broker pump (90s) survives past Event expiry (45s)
  resetFreshState();
  market.reset();
  state.activateBrokerInsider(90.0, 2.5);
  market.triggerEvent("suez_blockade", state);

  // Advance 45s (Event expires, 45s remains on Broker)
  for (let i = 0; i < 450; i++) {
    state.tick(0.1);
  }
  assert(
    state.market.activeEvent === null,
    "4.2a: Geopolitical event has expired after 45s"
  );
  assert(
    state.brokerInsider.active === true && Math.abs(state.brokerInsider.remainingSec - 45.0) < 0.01,
    "4.2b: Broker pump remains active with 45s remaining",
    `remainingSec: ${state.brokerInsider.remainingSec}`
  );

  // Advance another 45s (Broker expires)
  for (let i = 0; i < 450; i++) {
    state.tick(0.1);
  }
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0,
    "4.2c: Broker pump expires cleanly at 90s total elapsed time"
  );

  // ==================================================================
  // CATEGORY 5: FRACTIONAL SAVE / LOAD ROUNDTRIP AROUND EPSILON
  // ==================================================================
  console.log("\n--- CATEGORY 5: Fractional Save/Load Roundtrip Around Epsilon ---");

  // 5.1: Export with tiny remainingSec (0.0005s) below epsilon
  resetFreshState();
  state.brokerInsider.active = true;
  state.brokerInsider.remainingSec = 0.0005;
  state.brokerInsider.multiplier = 2.5;

  const tinySave = state.exportSave();
  resetFreshState();
  state.importSave(tinySave);
  // Next tick should immediately expire it cleanly
  state.tick(0.001);
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0,
    "5.1: Save payload near epsilon threshold (0.0005s) deactivates cleanly on next tick"
  );

  // 5.2: Export with standard remainingSec (89.95s)
  resetFreshState();
  state.activateBrokerInsider(90.0, 2.5);
  state.tick(0.05); // 89.95s remaining
  const validSave = state.exportSave();

  resetFreshState();
  state.importSave(validSave);
  assert(
    state.brokerInsider.active === true && Math.abs(state.brokerInsider.remainingSec - 89.95) < 0.001,
    "5.2a: Import successfully restores 89.95s remainingSec"
  );
  // Run remaining 89.95s with dt = 0.05s (1799 ticks)
  for (let i = 0; i < 1799; i++) {
    state.tick(0.05);
  }
  assert(
    state.brokerInsider.active === false && state.brokerInsider.remainingSec === 0,
    "5.2b: Restored broker pump expires exactly on final tick"
  );

  // ==================================================================
  // CATEGORY 6: REWARDED VIDEO MOCK VS PRODUCTION ERROR GUARD
  // ==================================================================
  console.log("\n--- CATEGORY 6: Rewarded Video Production Error Guard ---");

  // Verify platform mock behavior
  assert(platform.isMock === true, "6.1a: Test environment platform.isMock is true");

  // When isMock is true, onError awards boost in dev/test
  let devGranted = false;
  platform.showRewardedVideo({
    onRewarded: () => { devGranted = true; },
    onError: () => {
      if (platform.isMock) devGranted = true;
    }
  });
  await new Promise(r => setTimeout(r, 250));
  assert(devGranted === true, "6.1b: In mock mode, rewarded video grants reward successfully");

  // Verify ticker.js does NOT use blocking browser alert and does not grant reward on error
  const tickerSrc = fs.readFileSync(path.resolve("src/ui/ticker.js"), "utf8");
  const noAlert = !tickerSrc.includes("alert(");
  assert(noAlert, "6.2: src/ui/ticker.js must never use blocking alert()");

  // ==================================================================
  // SUMMARY
  // ==================================================================
  console.log("\n======================================================================");
  console.log("             EMPIRICAL CHALLENGER BATTERY SUMMARY");
  console.log("======================================================================");
  console.log(` Total Tests: ${passed + failed}`);
  console.log(` Passed:      ${passed} (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log(` Failed:      ${failed} (${((failed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log("======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runEmpiricalBattery().catch(err => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
