import { state } from "../state.js";
import { TankerTruck } from "./tanker-truck.js";

/**
 * TankerPool
 * High-performance object pool managing tanker traffic, loading rack queues,
 * and VIP vehicle arrivals in Overcrowded: Tycoon style.
 * - Zero-GC execution: preallocated 16 tanker trucks.
 * - Multi-bay dispatching: supports 1 to 3 bays matching state.loadingRackLevel.
 * - Driver queueing with collision spacing along the access road.
 * - Automated barrier gatehouse control.
 */
export class TankerPool {
  constructor(capacity = 16) {
    this.capacity = capacity;
    this.trucks = new Array(capacity);

    for (let i = 0; i < capacity; i++) {
      this.trucks[i] = new TankerTruck(i);
    }

    // Bay Definitions (Matching loading rack positions at gx: 4.2)
    this.bays = [
      { id: 0, gx: 4.2, gy: 5.2, occupiedBy: null },
      { id: 1, gx: 4.2, gy: 6.0, occupiedBy: null },
      { id: 2, gx: 4.2, gy: 6.8, occupiedBy: null }
    ];

    // Spawn Interval
    this.spawnTimer = 2.0; // Quick initial truck
    this.spawnIntervalSec = 7.0;

    // Gatehouse Barrier State
    this.isBarrierOpen = false;
    this.barrierAngle = 0; // 0 = closed, 1 = open

    this.initEventListeners();
  }

  initEventListeners() {
    // When broker pump activates, guarantee VIP arrival!
    state.on("brokerInsiderActivated", () => {
      this.spawnVipTanker();
    });
  }

  spawnVipTanker() {
    // Find free truck slot
    for (let i = 0; i < this.capacity; i++) {
      const truck = this.trucks[i];
      if (!truck.active) {
        truck.spawn("VIP");
        return truck;
      }
    }
    return null;
  }

  spawnNextTruck() {
    // Count trucks currently in queue or approaching
    let waitingCount = 0;
    for (let i = 0; i < this.capacity; i++) {
      const t = this.trucks[i];
      if (t.active && (t.state === TankerTruck.STATES.APPROACHING_GATE || t.state === TankerTruck.STATES.IN_QUEUE)) {
        waitingCount++;
      }
    }

    // Limit road queue to max 4 trucks to avoid infinite road block
    if (waitingCount >= 4) return null;

    for (let i = 0; i < this.capacity; i++) {
      const truck = this.trucks[i];
      if (!truck.active) {
        // Determine type based on market conditions
        let typeKey = "STANDARD";
        if (state.brokerInsider?.active) {
          typeKey = "VIP";
        } else if (state.market?.oilPrice > 85 && Math.random() < 0.15) {
          typeKey = "VIP";
        } else if (Math.random() < 0.35) {
          typeKey = "HEAVY";
        }

        truck.spawn(typeKey);
        return truck;
      }
    }
    return null;
  }

  update(dt, emojiPool) {
    if (dt <= 0) return;

    // In gas field specialization, oil loading rack is removed and replaced by pipeline grid
    if (state.specialization === "gas") {
      this.isBarrierOpen = false;
      this.barrierAngle = 0;
      for (let i = 0; i < this.capacity; i++) {
        this.trucks[i].active = false;
      }
      return;
    }

    // 1. Spawner Timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnIntervalSec) {
      this.spawnTimer = 0;
      this.spawnNextTruck();
    }

    // 2. Refresh Bay Occupancy
    const activeBaysCount = Math.max(1, Math.min(3, state.loadingRackLevel || 1));
    for (let b = 0; b < this.bays.length; b++) {
      const bay = this.bays[b];
      if (bay.occupiedBy !== null) {
        const truck = this.trucks[bay.occupiedBy];
        if (!truck || !truck.active || truck.state === TankerTruck.STATES.DEPARTING) {
          bay.occupiedBy = null;
        }
      }
    }

    // 3. Dispatch Waiting Trucks to Free Bays
    for (let b = 0; b < activeBaysCount; b++) {
      const bay = this.bays[b];
      if (bay.occupiedBy === null) {
        // Find front-most truck waiting in queue
        let frontTruck = null;
        let maxX = -999;

        for (let i = 0; i < this.capacity; i++) {
          const t = this.trucks[i];
          if (t.active && t.state === TankerTruck.STATES.IN_QUEUE && t.gx > maxX) {
            maxX = t.gx;
            frontTruck = t;
          }
        }

        if (frontTruck) {
          bay.occupiedBy = frontTruck.id;
          frontTruck.assignedBayIndex = b;
          frontTruck.bayTargetGx = bay.gx;
          frontTruck.bayTargetGy = bay.gy;
          frontTruck.state = TankerTruck.STATES.ENTERING_BAY;
        }
      }
    }

    // 4. Update Barrier Gatehouse State
    let needsBarrierOpen = false;
    for (let i = 0; i < this.capacity; i++) {
      const t = this.trucks[i];
      if (t.active && (t.gx >= 0.5 && t.gx <= 1.8)) {
        needsBarrierOpen = true;
        break;
      }
    }
    this.isBarrierOpen = needsBarrierOpen;
    const targetAngle = needsBarrierOpen ? 1.0 : 0.0;
    this.barrierAngle += (targetAngle - this.barrierAngle) * Math.min(1.0, dt * 6);

    // 5. Update Trucks (Zero-GC loop with distance checking)
    for (let i = 0; i < this.capacity; i++) {
      const truck = this.trucks[i];
      if (!truck.active) continue;

      // Find leading vehicle ahead in queue
      let leadTruck = null;
      let minDistanceAhead = 999;

      if (truck.state === TankerTruck.STATES.APPROACHING_GATE || truck.state === TankerTruck.STATES.IN_QUEUE) {
        for (let j = 0; j < this.capacity; j++) {
          if (i === j) continue;
          const other = this.trucks[j];
          if (other.active && (other.state === TankerTruck.STATES.IN_QUEUE || other.state === TankerTruck.STATES.ENTERING_BAY)) {
            const dist = other.gx - truck.gx;
            if (dist > 0 && dist < minDistanceAhead) {
              minDistanceAhead = dist;
              leadTruck = other;
            }
          }
        }
      }

      truck.update(dt, emojiPool, leadTruck);
    }
  }

  handleTap(screenX, screenY, emojiPool, particleSystem) {
    for (let i = this.capacity - 1; i >= 0; i--) {
      const truck = this.trucks[i];
      if (truck.active && truck.handleTap(screenX, screenY, emojiPool, particleSystem)) {
        return true;
      }
    }
    return false;
  }
}
