import { state } from "../state.js";
import { WorkerBob } from "./worker-bob.js";
import { EmojiBubblePool } from "./emoji-bubble-pool.js";

/**
 * WorkerPool
 * High-performance object pool managing the oilfield crowd in Overcrowded: Tycoon style.
 * - Zero-GC execution: preallocated 40 workers and 60 emoji bubbles.
 * - Progressive crowd scaling from 4 to 32 bobs.
 * - Economic synergy calculation (+1% debit per working bob).
 * - Multi-agent state synchronization (Accidents, Broker Insider, IPO).
 */
export class WorkerPool {
  constructor(capacity = 40) {
    this.capacity = capacity;
    this.workers = new Array(capacity);
    this.activeCount = 4;
    this.emojiPool = new EmojiBubblePool(60);
    this.luckyBobTimer = 30.0; // First lucky bob appears after 30s

    // Structure Grid Targets
    this.targets = [
      { id: "well_1", gx: 3.5, gy: 3.5, label: "Скважина №1" },
      { id: "well_2", gx: 8.5, gy: 3.0, label: "Скважина №2" },
      { id: "well_3", gx: 10.5, gy: 6.5, label: "Скважина №3" },
      { id: "well_4", gx: 10.0, gy: 9.5, label: "Скважина №4" },
      { id: "station_cps", gx: 6.0, gy: 6.0, label: "ЦПС" },
      { id: "crypto_flare", gx: 8.5, gy: 10.5, label: "Факел" }
    ];

    // Preallocate all workers
    for (let i = 0; i < capacity; i++) {
      this.workers[i] = new WorkerBob(i);
    }

    this.recalculateCrowdSize();
    this.assignWorkersToTargets();
    this.initEventListeners();
  }

  initEventListeners() {
    // Listen to GameState events
    state.on("accidentTriggered", (data) => {
      this.setEmergency(true, data?.targetWellId || state.accident?.targetWellId || "well_1");
    });

    state.on("accidentResolved", () => {
      this.setEmergency(false);
      this.setCelebration(4.0);
    });

    state.on("brokerInsiderActivated", () => {
      this.setCelebration(8.0);
    });

    state.on("ipoComplete", () => {
      this.setCelebration(10.0);
    });

    state.on("wellUpdated", () => {
      this.recalculateCrowdSize();
      this.assignWorkersToTargets();
    });

    state.on("specializationChanged", () => {
      this.setCelebration(5.0);
    });
  }

  recalculateCrowdSize() {
    let unlockedWells = 0;
    let totalLevels = 0;

    if (state.wells) {
      for (const key in state.wells) {
        const w = state.wells[key];
        if (w && w.unlocked) {
          unlockedWells++;
          totalLevels += (w.level || 0);
        }
      }
    }

    // Scaling: 4 base + 3 per unlocked well + 1 per 3 well levels, capped at 32
    const targetSize = Math.min(32, Math.max(4, 4 + unlockedWells * 3 + Math.floor(totalLevels / 3)));

    if (targetSize !== this.activeCount) {
      this.activeCount = targetSize;
      for (let i = 0; i < this.capacity; i++) {
        this.workers[i].active = (i < this.activeCount);
      }
    }
  }

  assignWorkersToTargets() {
    const MAX_WORKERS_PER_WELL = 2;
    const wellTargets = this.targets.filter(t => t.id.startsWith("well_") && state.wells?.[t.id]?.unlocked);
    const infraTargets = this.targets.filter(t => !t.id.startsWith("well_"));

    if (wellTargets.length === 0 && infraTargets.length === 0) return;

    const wellCounts = {};
    wellTargets.forEach(t => { wellCounts[t.id] = 0; });

    for (let i = 0; i < this.activeCount; i++) {
      const worker = this.workers[i];
      worker.active = true;

      let chosenTarget = null;
      for (let w = 0; w < wellTargets.length; w++) {
        const wt = wellTargets[w];
        if (wellCounts[wt.id] < MAX_WORKERS_PER_WELL) {
          chosenTarget = wt;
          wellCounts[wt.id]++;
          break;
        }
      }

      if (!chosenTarget) {
        if (infraTargets.length > 0) {
          chosenTarget = infraTargets[i % infraTargets.length];
        } else {
          chosenTarget = wellTargets[i % wellTargets.length];
        }
      }

      const scatterX = (Math.sin(i * 1.5) * 0.35);
      const scatterY = (Math.cos(i * 1.5) * 0.35);

      worker.setTargetWork(chosenTarget.id, chosenTarget.gx + scatterX, chosenTarget.gy + scatterY);
    }
  }

  getWellSynergyMultiplier(wellId) {
    if (!wellId) return 1.0;
    let workingWorkers = 0;

    for (let i = 0; i < this.activeCount; i++) {
      const w = this.workers[i];
      if (w.active && w.assignedTargetId === wellId && w.state === WorkerBob.STATES.WORKING) {
        workingWorkers++;
      }
    }

    // +1% per actively working bob on this well
    return 1.0 + workingWorkers * 0.01;
  }

  getTotalSynergyMultiplier() {
    let workingCount = 0;
    for (let i = 0; i < this.activeCount; i++) {
      const w = this.workers[i];
      if (w.active && w.state === WorkerBob.STATES.WORKING) {
        workingCount++;
      }
    }
    // General crowd synergy: up to +15% total passive throughput
    return 1.0 + Math.min(0.15, workingCount * 0.008);
  }

  setEmergency(isEmergency, targetWellId = "well_1") {
    if (isEmergency) {
      // Find coordinates of target well
      const target = this.targets.find(t => t.id === targetWellId) || this.targets[0];
      const leakGx = target ? target.gx : 3.5;
      const leakGy = target ? target.gy : 3.5;

      // Assign 2 to 3 workers as eco-responders
      const ecoCount = Math.min(3, Math.max(2, Math.floor(this.activeCount * 0.25)));
      for (let i = 0; i < this.activeCount; i++) {
        const w = this.workers[i];
        if (i < ecoCount) {
          const angle = (i / ecoCount) * Math.PI * 2 + 0.3;
          w.setEcoResponder(true, leakGx, leakGy, angle);
        } else {
          w.setPanic(true);
        }
      }
    } else {
      for (let i = 0; i < this.activeCount; i++) {
        const w = this.workers[i];
        w.setEcoResponder(false);
        w.setPanic(false);
      }
    }
  }

  setCelebration(durationSec = 6.0) {
    for (let i = 0; i < this.activeCount; i++) {
      this.workers[i].setCelebration(durationSec);
    }
  }

  handleTap(screenX, screenY, particleSystem) {
    // Hit test from top to bottom
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const w = this.workers[i];
      if (w.active && w.handleTap(screenX, screenY, this.emojiPool, particleSystem)) {
        return true;
      }
    }
    return false;
  }

  spawnLuckyBob() {
    // Only spawn if no worker is currently lucky
    for (let i = 0; i < this.activeCount; i++) {
      if (this.workers[i].isLuckyBob) return;
    }
    const candidates = [];
    for (let i = 0; i < this.activeCount; i++) {
      const w = this.workers[i];
      if (w.active && !w.isEcoResponder && w.state !== WorkerBob.STATES.PANIC_EMERGENCY) {
        candidates.push(w);
      }
    }
    if (candidates.length > 0) {
      const lucky = candidates[Math.floor(Math.random() * candidates.length)];
      lucky.isLuckyBob = true;
      lucky.luckyBobRemaining = 15.0;
      lucky.luckyBobPulse = 0;
    }
  }

  update(dt) {
    if (dt <= 0) return;

    // Periodic Lucky Bob bonus (every ~50-60s)
    this.luckyBobTimer -= dt;
    if (this.luckyBobTimer <= 0) {
      this.luckyBobTimer = 50.0 + Math.random() * 15.0;
      this.spawnLuckyBob();
    }

    // Update Workers (Zero-GC loop)
    for (let i = 0; i < this.activeCount; i++) {
      this.workers[i].update(dt, this.emojiPool);
    }

    // Update Floating Emoji Bubbles
    this.emojiPool.update(dt);

    // Sync synergy with state
    if (state) {
      state.workerSynergy = this.getTotalSynergyMultiplier();
    }
  }

  drawBubbles(ctx) {
    this.emojiPool.draw(ctx);
  }
}
