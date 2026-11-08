import { state } from "../state.js";
import { audio } from "../audio.js";

const PI2 = Math.PI * 2;

/**
 * TankerTruck
 * Stylized oil tanker truck in the aesthetic of ZeptoLab's Overcrowded: Tycoon.
 * Features:
 * - 3 classes: Standard (400 bbl), Heavy (900 bbl), Golden VIP (1500 bbl, x3 rate).
 * - FSM: Approach Gate -> Wait in Queue -> Pull into Loading Bay -> Fill Tank -> Depart with payout.
 * - Driver frustration: waiting > 12s spawns 😡 and triggers horn honks.
 * - Interactive tap: manual fast-pumping (+15% fill) and tactile squash & stretch.
 */
export class TankerTruck {
  static STATES = {
    INACTIVE: 0,
    APPROACHING_GATE: 1,
    IN_QUEUE: 2,
    ENTERING_BAY: 3,
    LOADING: 4,
    DEPARTING: 5
  };

  static TYPES = {
    STANDARD: {
      type: "standard",
      capacity: 400,
      cabColor: "#0284c7",
      tankColor: "#cbd5e1",
      payoutMult: 1.0,
      length: 22
    },
    HEAVY: {
      type: "heavy",
      capacity: 900,
      cabColor: "#dc2626",
      tankColor: "#94a3b8",
      payoutMult: 1.5,
      length: 28
    },
    VIP: {
      type: "vip",
      capacity: 1500,
      cabColor: "#f59e0b",
      tankColor: "#fef08a",
      payoutMult: 3.0,
      length: 25
    }
  };

  constructor(id) {
    this.id = id;
    this.active = false;
    this.typeDef = TankerTruck.TYPES.STANDARD;

    // Grid Coordinates
    this.gx = -2.0;
    this.gy = 5.5;
    this.targetGx = -2.0;
    this.targetGy = 5.5;
    this.moveSpeed = 1.35;
    this.facing = 1; // 1 = moving right/forward, -1 = left

    // FSM State
    this.state = TankerTruck.STATES.INACTIVE;
    this.assignedBayIndex = 0; // 0, 1, or 2
    this.bayTargetGx = 2.5;
    this.bayTargetGy = 5.2;

    // Loading & Queue Dynamics
    this.fillAmount = 0; // 0..1
    this.fillRate = 0.28; // ~3.5s base fill time
    this.waitTimer = 0;
    this.hasComplained = false;

    // Squash & Stretch / Bounce
    this.jumpTimer = 0;
    this.jumpDuration = 0.28;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.jumpHeight = 0;

    // Screen Coords Cache
    this.screenX = 0;
    this.screenY = 0;
    this.screenRadius = 30;
  }

  spawn(typeKey = "STANDARD") {
    this.active = true;
    this.typeDef = TankerTruck.TYPES[typeKey] || TankerTruck.TYPES.STANDARD;

    this.gx = -2.5;
    this.gy = 5.5;
    this.targetGx = 0.8;
    this.targetGy = 5.5;
    this.facing = 1;

    this.state = TankerTruck.STATES.APPROACHING_GATE;
    this.fillAmount = 0;
    this.waitTimer = 0;
    this.hasComplained = false;
    this.jumpTimer = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.jumpHeight = 0;
  }

  update(dt, emojiPool, prevTruck) {
    if (!this.active) return;

    // 1. Squash & Stretch Bounce
    if (this.jumpTimer > 0) {
      this.jumpTimer -= dt;
      const progress = 1 - (this.jumpTimer / this.jumpDuration);
      if (progress < 0.3) {
        this.scaleX = 1.18;
        this.scaleY = 0.84;
        this.jumpHeight = 0;
      } else if (progress < 0.7) {
        const airP = (progress - 0.3) / 0.4;
        this.jumpHeight = Math.sin(airP * Math.PI) * 12;
        this.scaleX = 0.9;
        this.scaleY = 1.12;
      } else {
        const landP = (progress - 0.7) / 0.3;
        this.jumpHeight = 0;
        this.scaleX = 1.0 + (1 - landP) * 0.1;
        this.scaleY = 1.0 - (1 - landP) * 0.1;
      }
    } else {
      this.scaleX = 1.0;
      this.scaleY = 1.0;
      this.jumpHeight = 0;
    }

    // 2. FSM Logic
    switch (this.state) {
      case TankerTruck.STATES.APPROACHING_GATE:
        this.updateDriveTowards(dt, this.targetGx, this.targetGy, prevTruck, () => {
          this.state = TankerTruck.STATES.IN_QUEUE;
        });
        break;

      case TankerTruck.STATES.IN_QUEUE:
        this.waitTimer += dt;

        // Driver Impatience (Bottle-neck frustration)
        if (this.waitTimer > 12.0 && !this.hasComplained) {
          this.hasComplained = true;
          if (emojiPool) {
            emojiPool.spawn(this.screenX, this.screenY - 32, "😡", 2.2, this);
          }
          if (typeof audio?.playHorn === "function") {
            audio.playHorn();
          } else if (typeof audio?.playTap === "function") {
            audio.playTap();
          }
        }

        // Advance in queue if road ahead is clear
        if (this.targetGx > this.gx) {
          this.updateDriveTowards(dt, this.targetGx, this.targetGy, prevTruck);
        }
        break;

      case TankerTruck.STATES.ENTERING_BAY:
        this.updateDriveTowards(dt, this.bayTargetGx, this.bayTargetGy, null, () => {
          this.state = TankerTruck.STATES.LOADING;
          this.fillAmount = 0;
          if (emojiPool) {
            emojiPool.spawn(this.screenX, this.screenY - 32, "🛢️", 1.5, this);
          }
        });
        break;

      case TankerTruck.STATES.LOADING:
        // Pumping crude oil from RVS into the tanker
        this.fillAmount += this.fillRate * dt;

        // Drain oil storage buffer proportionally
        if (state.oilStorageCurrent > 0) {
          state.oilStorageCurrent = Math.max(0, state.oilStorageCurrent - (this.typeDef.capacity * this.fillRate * dt));
        }

        // Full Tank -> Payout and Departure!
        if (this.fillAmount >= 1.0) {
          this.completeLoading(emojiPool);
        }
        break;

      case TankerTruck.STATES.DEPARTING:
        // Drive towards exit
        this.updateDriveTowards(dt, -3.0, 7.0, null, () => {
          this.active = false;
          this.state = TankerTruck.STATES.INACTIVE;
        });
        break;
    }
  }

  updateDriveTowards(dt, destGx, destGy, leadTruck, onArrived) {
    // Check safe distance with leading truck in queue
    if (leadTruck && leadTruck.active) {
      const distToLead = Math.hypot(leadTruck.gx - this.gx, leadTruck.gy - this.gy);
      if (distToLead < 1.1) {
        // Stop and wait behind lead vehicle
        return;
      }
    }

    const dx = destGx - this.gx;
    const dy = destGy - this.gy;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.08) {
      this.gx = destGx;
      this.gy = destGy;
      if (onArrived) onArrived();
    } else {
      const step = Math.min(dist, this.moveSpeed * dt);
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;

      if (dx > 0.02) this.facing = 1;
      else if (dx < -0.02) this.facing = -1;
    }
  }

  completeLoading(emojiPool) {
    this.fillAmount = 1.0;
    this.state = TankerTruck.STATES.DEPARTING;
    this.targetGx = -3.0;
    this.targetGy = 7.0;

    // Calculate Payout
    const baseRate = state.getIncomeRate();
    const marketMult = state.getMarketMultiplier();
    const capacityVal = this.typeDef.capacity;
    const isVip = this.typeDef.type === "vip";

    // Payout formula tied to market price and truck capacity
    const rawPayout = Math.max(450, Math.round(capacityVal * 0.75 * marketMult * this.typeDef.payoutMult + baseRate * 12));
    state.addMoney(rawPayout);

    // Award Export Dollars ($) for technologies & marketplace
    const earnedDollars = isVip ? 75 : (this.typeDef.type === "heavy" ? 35 : 15);
    state.addDollars(earnedDollars);

    if (typeof audio?.playPayout === "function") {
      audio.playPayout();
    } else if (typeof audio?.playCoin === "function") {
      audio.playCoin();
    }

    if (emojiPool) {
      emojiPool.spawn(this.screenX, this.screenY - 34, isVip ? "💎" : "💰", 2.0, this);
    }
  }

  handleTap(screenX, screenY, emojiPool, particleSystem) {
    const dist = Math.hypot(screenX - this.screenX, screenY - this.screenY);
    if (dist > this.screenRadius) return false;

    // Trigger Squash & Stretch Bounce
    this.jumpTimer = this.jumpDuration;

    if (this.state === TankerTruck.STATES.LOADING) {
      // Fast-Pump Assist (+15% fill per tap!)
      this.fillAmount = Math.min(1.0, this.fillAmount + 0.15);

      if (typeof audio?.playTap === "function") {
        audio.playTap();
      }
      if (typeof audio?.vibrate === "function") {
        audio.vibrate(20);
      }

      if (particleSystem) {
        particleSystem.spawnOilSplatter(this.screenX, this.screenY, 8, this.typeDef.type === "vip");
        particleSystem.spawnFloatingText(this.screenX, this.screenY - 32, "⚡ Быстрый налив!", "#38bdf8", false);
      }

      if (this.fillAmount >= 1.0) {
        this.completeLoading(emojiPool);
      }
      return true;
    }

    if (this.state === TankerTruck.STATES.IN_QUEUE || this.state === TankerTruck.STATES.APPROACHING_GATE) {
      // Driver Honk
      if (typeof audio?.playTap === "function") {
        audio.playTap();
      }
      if (typeof audio?.vibrate === "function") {
        audio.vibrate(15);
      }
      if (emojiPool) {
        emojiPool.spawn(this.screenX, this.screenY - 34, "🚚💨", 1.5, this);
      }
      return true;
    }

    return false;
  }

  draw(ctx, screenX, screenY) {
    this.screenX = screenX;
    this.screenY = screenY;

    ctx.save();
    ctx.translate(screenX, screenY - this.jumpHeight);

    // Distance fog fade-out when driving in / out at road edges (Phase 6)
    if (this.gx < -1.0) {
      const edgeAlpha = Math.max(0, Math.min(1.0, (this.gx - (-3.2)) / 1.8));
      ctx.globalAlpha = edgeAlpha;
    }

    // Soft drop shadow
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, this.jumpHeight * 0.4 + 4, 24 * this.scaleX, 10 * this.scaleX, 0, 0, PI2);
    ctx.fill();
    ctx.restore();

    ctx.scale(this.facing * this.scaleX, this.scaleY);

    const isVip = this.typeDef.type === "vip";
    const isHeavy = this.typeDef.type === "heavy";

    // === TANKER SPRITE ===

    // 1. Wheels (Dark slate tires with silver hubcaps)
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(-18, 2, 7, 6, 2);
    ctx.roundRect(-4, 2, 7, 6, 2);
    ctx.roundRect(10, 2, 7, 6, 2);
    if (isHeavy) {
      ctx.roundRect(-26, 2, 7, 6, 2);
    }
    ctx.fill();

    // 2. Chassis frame
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(isHeavy ? -28 : -20, 0, isHeavy ? 46 : 38, 4);

    // 3. Cylindrical Tank (Trailer)
    const isGas = state?.specialization === "gas";
    if (isGas) {
      // Cryogenic LNG Tanker: insulated pure white / silver with vacuum shell
      const gasGrad = ctx.createLinearGradient(-18, -14, 10, 0);
      gasGrad.addColorStop(0, "#f8fafc");
      gasGrad.addColorStop(0.35, "#ffffff");
      gasGrad.addColorStop(0.7, "#cbd5e1");
      gasGrad.addColorStop(1, "#94a3b8");
      ctx.fillStyle = gasGrad;
    } else if (isVip) {
      // Golden VIP Shimmer
      const goldGrad = ctx.createLinearGradient(-18, -14, 10, 0);
      goldGrad.addColorStop(0, "#d97706");
      goldGrad.addColorStop(0.3, "#fef08a");
      goldGrad.addColorStop(0.7, "#f59e0b");
      goldGrad.addColorStop(1, "#b45309");
      ctx.fillStyle = goldGrad;
    } else {
      ctx.fillStyle = this.typeDef.tankColor;
    }

    const tankLen = isHeavy ? 36 : 26;
    const tankX = isHeavy ? -26 : -18;
    ctx.beginPath();
    ctx.roundRect(tankX, -16, tankLen, 16, 7);
    ctx.fill();

    if (isGas) {
      // Red diamond ADR Class 2.1 Placard ("1972 СПГ / ОГНЕОПАСНО: МЕТАН")
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(tankX + 4, -8);
      ctx.lineTo(tankX + 8, -12);
      ctx.lineTo(tankX + 12, -8);
      ctx.lineTo(tankX + 8, -4);
      ctx.closePath();
      ctx.fill();
    }

    // Tank highlight reflection
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.roundRect(tankX + 2, -14, tankLen - 4, 3, 1.5);
    ctx.fill();

    // Tank strap bands
    ctx.fillStyle = "#334155";
    ctx.fillRect(tankX + 6, -16, 2, 16);
    ctx.fillRect(tankX + tankLen - 8, -16, 2, 16);

    // 4. Truck Cab (Driver compartment)
    ctx.fillStyle = isVip ? "#f59e0b" : this.typeDef.cabColor;
    ctx.beginPath();
    ctx.roundRect(isHeavy ? 10 : 8, -14, 14, 15, [4, 6, 2, 2]);
    ctx.fill();

    // Windshield
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(isHeavy ? 16 : 14, -12, 6, 6, [2, 3, 1, 1]);
    ctx.fill();

    // Front Bumper & Headlights
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(isHeavy ? 22 : 20, -3, 3, 5);
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(isHeavy ? 23 : 21, -1, 1.5, 0, PI2);
    ctx.fill();

    // 5. Exhaust stack with heat shimmer
    ctx.fillStyle = "#64748b";
    ctx.fillRect(isHeavy ? 9 : 7, -19, 2.5, 7);

    ctx.restore();

    // 6. Loading Progress Bar (When filling at bay)
    if (this.state === TankerTruck.STATES.LOADING) {
      this.drawLoadingBar(ctx, screenX, screenY - 28);
    }
  }

  drawLoadingBar(ctx, sx, sy) {
    ctx.save();
    const bw = 34;
    const bh = 5;
    const bx = sx - bw / 2;
    const by = sy;

    // Track
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 2.5);
    ctx.fill();

    // Fill
    const pct = Math.max(0, Math.min(1.0, this.fillAmount));
    const fillGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
    fillGrad.addColorStop(0, "#f59e0b");
    fillGrad.addColorStop(1, "#fbbf24");
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw * pct, bh, 2.5);
    ctx.fill();

    ctx.restore();
  }
}
