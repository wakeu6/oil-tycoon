import { audio } from "../audio.js";
import { state } from "../state.js";

/**
 * WorkerBob
 * Cute capsule-shaped oilfield worker in the style of Overcrowded: Tycoon.
 * Features:
 * - Autonomous FSM: Walk to rig -> Work with tool animation -> Coffee break at canteen -> Rest -> Resume.
 * - Reactive states: Panic during Gryphon emergency, celebration during Broker Pump / IPO.
 * - Tap interaction: Squash & stretch, funny pitch-varied sound, job & status badge.
 * - Synergistic boost: +1% debit to assigned well when working.
 */
export class WorkerBob {
  static STATES = {
    IDLE_AT_BASE: 0,
    WALK_TO_WORK: 1,
    WORKING: 2,
    TIRED_NEED_BREAK: 3,
    RESTING: 4,
    PANIC_EMERGENCY: 5,
    CELEBRATE: 6,
    ECO_RESPONDER: 7
  };

  static ROLES = [
    { role: "driller", title: "Бурильщик 5 разряда", bodyColor: "#1d4ed8", vestColor: "#facc15", hatColor: "#facc15" },
    { role: "mechanic", title: "Слесарь-ремонтник КИПиА", bodyColor: "#c2410c", vestColor: "#f97316", hatColor: "#ffffff" },
    { role: "operator", title: "Оператор ДНГ 4 разряда", bodyColor: "#0f766e", vestColor: "#14b8a6", hatColor: "#e2e8f0" },
    { role: "electrician", title: "Электромонтёр ЭЦН", bodyColor: "#475569", vestColor: "#eab308", hatColor: "#38bdf8" }
  ];

  static NAMES = [
    "Иваныч", "Петрович", "Михалыч", "Саня", "Димон", "Григорьич",
    "Васильич", "Колян", "Степаныч", "Юрич", "Федорыч", "Палыч",
    "Андрюха", "Борисыч", "Макс", "Кузьмич", "Серёга", "Толян"
  ];

  constructor(id) {
    this.id = id;
    this.active = false;

    // Pick personality
    const roleDef = WorkerBob.ROLES[id % WorkerBob.ROLES.length];
    this.name = WorkerBob.NAMES[id % WorkerBob.NAMES.length];
    this.role = roleDef.role;
    this.jobTitle = roleDef.title;
    this.bodyColor = roleDef.bodyColor;
    this.vestColor = roleDef.vestColor;
    this.hatColor = roleDef.hatColor;

    // Grid Coordinates
    this.gx = 4.5;
    this.gy = 7.5; // Canteen / Camp location
    this.targetGx = 4.5;
    this.targetGy = 7.5;
    this.moveSpeed = 1.05 + (id % 4) * 0.08; // Slight speed variation
    this.facing = 1;
    this.wobblePhase = (id * 1.7) % (Math.PI * 2);
    this.isWalking = false;

    // FSM State
    this.state = WorkerBob.STATES.IDLE_AT_BASE;
    this.assignedTargetId = null; // 'well_1' .. 'well_4', 'station_cps', 'crypto_flare'
    this.workTargetGx = 3.5;
    this.workTargetGy = 3.5;
    this.homeTargetGx = 4.5;
    this.homeTargetGy = 7.5; // Canteen

    // Energy & Timers
    this.energy = 100;
    this.maxEnergy = 100;
    this.workShiftDuration = 22 + (id % 5) * 4; // 22-38 seconds shift
    this.workShiftTimer = 0;
    this.restDuration = 8.0;
    this.restTimer = 0;
    this.celebrateTimer = 0;
    this.panicTimer = 0;
    this.toolAnimTimer = 0;

    // Visual Squash & Stretch
    this.jumpTimer = 0;
    this.jumpDuration = 0.32;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.jumpHeight = 0;

    // Speech / Status Badge
    this.statusText = "";
    this.statusTimer = 0;
    this.statusAlpha = 0;

    // Eco-Responder State (Phase 4)
    this.isEcoResponder = false;
    this.ecoTargetGx = 0;
    this.ecoTargetGy = 0;

    // Lucky Bob (Phase 6)
    this.isLuckyBob = false;
    this.luckyBobRemaining = 0;
    this.luckyBobPulse = 0;

    // Cached Screen Position for Hit-Testing
    this.screenX = 0;
    this.screenY = 0;
    this.screenRadius = 24;
  }

  setTargetWork(targetId, gx, gy) {
    this.assignedTargetId = targetId;
    this.workTargetGx = gx;
    this.workTargetGy = gy;
    this.targetGx = gx;
    this.targetGy = gy;
    this.state = WorkerBob.STATES.WALK_TO_WORK;
    this.isWalking = true;
  }

  update(dt, emojiPool) {
    if (!this.active) return;

    // 1. Status Pill Fade
    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer > 0.25) {
        this.statusAlpha = Math.min(1.0, this.statusAlpha + dt * 6);
      } else {
        this.statusAlpha = Math.max(0, this.statusTimer / 0.25);
      }
    } else {
      this.statusAlpha = 0;
    }

    // 2. Jump / Squash & Stretch
    if (this.jumpTimer > 0) {
      this.jumpTimer -= dt;
      const progress = 1 - (this.jumpTimer / this.jumpDuration);
      if (progress < 0.28) {
        // Anticipation Squash
        this.scaleX = 1.22;
        this.scaleY = 0.82;
        this.jumpHeight = 0;
      } else if (progress < 0.72) {
        // Airborne Stretch
        const airP = (progress - 0.28) / 0.44;
        this.jumpHeight = Math.sin(airP * Math.PI) * 18;
        this.scaleX = 0.88;
        this.scaleY = 1.15;
      } else {
        // Landing Settle
        const landP = (progress - 0.72) / 0.28;
        this.jumpHeight = 0;
        this.scaleX = 1.0 + (1 - landP) * 0.12;
        this.scaleY = 1.0 - (1 - landP) * 0.12;
      }
    } else {
      this.scaleX = 1.0;
      this.scaleY = 1.0;
      this.jumpHeight = 0;
    }

    // Lucky Bob Tick (Phase 6)
    if (this.isLuckyBob) {
      this.luckyBobRemaining -= dt;
      this.luckyBobPulse += dt * 6;
      if (this.luckyBobRemaining <= 0) {
        this.isLuckyBob = false;
        this.luckyBobRemaining = 0;
      }
    }

    // 3. FSM Update
    switch (this.state) {
      case WorkerBob.STATES.WALK_TO_WORK:
        this.updateWalking(dt, this.workTargetGx, this.workTargetGy, () => {
          this.state = WorkerBob.STATES.WORKING;
          this.workShiftTimer = 0;
          this.isWalking = false;
        });
        break;

      case WorkerBob.STATES.WORKING:
        this.isWalking = false;
        this.workShiftTimer += dt;
        this.toolAnimTimer += dt * 6;
        this.energy = Math.max(0, this.energy - dt * (100 / this.workShiftDuration));

        if (this.energy <= 0 || this.workShiftTimer >= this.workShiftDuration) {
          // Shift over: need coffee break!
          this.state = WorkerBob.STATES.TIRED_NEED_BREAK;
          this.targetGx = this.homeTargetGx;
          this.targetGy = this.homeTargetGy;
        }
        break;

      case WorkerBob.STATES.TIRED_NEED_BREAK:
        this.updateWalking(dt, this.homeTargetGx, this.homeTargetGy, () => {
          this.state = WorkerBob.STATES.RESTING;
          this.restTimer = 0;
          this.isWalking = false;
        });
        break;

      case WorkerBob.STATES.RESTING:
        this.isWalking = false;
        this.restTimer += dt;
        this.energy = Math.min(100, this.energy + dt * (100 / this.restDuration));

        if (this.restTimer >= this.restDuration) {
          // Rest complete, head back to work
          this.energy = 100;
          this.state = WorkerBob.STATES.WALK_TO_WORK;
          this.targetGx = this.workTargetGx;
          this.targetGy = this.workTargetGy;
        }
        break;

      case WorkerBob.STATES.PANIC_EMERGENCY:
        this.isWalking = true;
        this.panicTimer += dt;
        this.wobblePhase += dt * 18; // Fast frantic wobble

        // Run around randomly along roads
        const pdx = Math.sin(this.panicTimer * 3 + this.id) * 0.8;
        const pdy = Math.cos(this.panicTimer * 3 + this.id) * 0.8;
        this.gx += pdx * dt * 1.5;
        this.gy += pdy * dt * 1.5;

        // Arm-waving jump
        this.jumpHeight = Math.abs(Math.sin(this.panicTimer * 12)) * 8;

        if (Math.random() < 0.015 && emojiPool) {
          emojiPool.spawn(this.screenX, this.screenY - 35, Math.random() < 0.5 ? "😱" : "🚨", 1.4, this);
        }
        break;

      case WorkerBob.STATES.CELEBRATE:
        this.isWalking = false;
        this.celebrateTimer -= dt;
        if (this.jumpTimer <= 0) {
          this.jumpHeight = Math.abs(Math.sin((10 - this.celebrateTimer) * 10)) * 14;
          this.scaleX = 0.9 + Math.cos(this.celebrateTimer * 12) * 0.15;
          this.scaleY = 1.1 - Math.cos(this.celebrateTimer * 12) * 0.15;
        }

        if (Math.random() < 0.02 && emojiPool) {
          emojiPool.spawn(this.screenX, this.screenY - 35, Math.random() < 0.5 ? "💰" : "🥳", 1.6, this);
        }

        if (this.celebrateTimer <= 0) {
          if (this.jumpTimer <= 0) {
            this.jumpHeight = 0;
            this.scaleX = 1.0;
            this.scaleY = 1.0;
          }
          this.state = WorkerBob.STATES.WALK_TO_WORK;
        }
        break;

      case WorkerBob.STATES.ECO_RESPONDER: {
        const dx = this.ecoTargetGx - this.gx;
        const dy = this.ecoTargetGy - this.gy;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.1) {
          // Walking to oil spill perimeter
          this.isWalking = true;
          const step = Math.min(dist, this.moveSpeed * 1.25 * dt);
          this.gx += (dx / dist) * step;
          this.gy += (dy / dist) * step;
          if (dx > 0.02) this.facing = 1;
          else if (dx < -0.02) this.facing = -1;
          this.wobblePhase += dt * 12;
        } else {
          // Standing at spill perimeter, actively spreading sorbent!
          this.isWalking = false;
          this.toolAnimTimer += dt * 8;

          // Passive QTE progress (+2% per second per eco responder)
          if (state.accident && state.accident.active) {
            state.progressAccidentQte(dt * 0.02);
          }

          if (Math.random() < 0.015 && emojiPool) {
            emojiPool.spawn(this.screenX, this.screenY - 35, Math.random() < 0.5 ? "🧯" : "🌿", 1.8, this);
          }
        }
        break;
      }

      case WorkerBob.STATES.IDLE_AT_BASE:
      default:
        this.isWalking = false;
        break;
    }
  }

  updateWalking(dt, destGx, destGy, onArrived) {
    const dx = destGx - this.gx;
    const dy = destGy - this.gy;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.08) {
      this.gx = destGx;
      this.gy = destGy;
      if (onArrived) onArrived();
    } else {
      this.isWalking = true;
      const step = Math.min(dist, this.moveSpeed * dt);
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;

      if (dx > 0.02) this.facing = 1;
      else if (dx < -0.02) this.facing = -1;

      this.wobblePhase += dt * 10;
    }
  }

  setEcoResponder(isEco, leakGx = 3.5, leakGy = 3.5, angle = 0) {
    this.isEcoResponder = isEco;
    if (isEco) {
      this.state = WorkerBob.STATES.ECO_RESPONDER;
      this.ecoTargetGx = leakGx + Math.cos(angle) * 0.7;
      this.ecoTargetGy = leakGy + Math.sin(angle) * 0.7;
      this.targetGx = this.ecoTargetGx;
      this.targetGy = this.ecoTargetGy;
      this.isWalking = true;
    } else {
      this.state = WorkerBob.STATES.WALK_TO_WORK;
      this.targetGx = this.workTargetGx;
      this.targetGy = this.workTargetGy;
      this.jumpHeight = 0;
    }
  }

  setPanic(isPanic) {
    if (this.isEcoResponder) return; // Eco responders don't panic, they neutralize!
    if (isPanic) {
      this.state = WorkerBob.STATES.PANIC_EMERGENCY;
      this.panicTimer = 0;
    } else if (this.state === WorkerBob.STATES.PANIC_EMERGENCY) {
      // Relief!
      this.state = WorkerBob.STATES.WALK_TO_WORK;
      this.jumpHeight = 0;
    }
  }

  setCelebration(durationSec = 6.0) {
    this.state = WorkerBob.STATES.CELEBRATE;
    this.celebrateTimer = durationSec;
  }

  handleTap(screenX, screenY, emojiPool, particleSystem) {
    const dist = Math.hypot(screenX - this.screenX, screenY - this.screenY);
    if (dist > this.screenRadius) return false;

    // Lucky Bob special payout tap!
    if (this.isLuckyBob) {
      this.isLuckyBob = false;
      this.luckyBobRemaining = 0;
      this.jumpTimer = this.jumpDuration * 1.5;

      const incomeRate = (typeof state?.getIncomeRate === "function") ? state.getIncomeRate() : 50;
      const bonusRubles = Math.max(1000, Math.round(incomeRate * 45));
      if (typeof state?.addMoney === "function") state.addMoney(bonusRubles);

      const gotPetro = Math.random() < 0.35;
      if (gotPetro && typeof state?.addCrypto === "function") {
        state.addCrypto(1);
      }

      if (typeof audio?.playPayout === "function") audio.playPayout();
      else if (typeof audio?.playTap === "function") audio.playTap();
      if (typeof audio?.vibrate === "function") audio.vibrate([30, 20, 50]);

      this.statusText = `${this.name}: Премия выдана! ⭐`;
      this.statusTimer = 3.2;
      this.statusAlpha = 1.0;

      if (emojiPool) {
        emojiPool.spawn(this.screenX, this.screenY - 34, "🎁", 2.2, this);
      }
      if (particleSystem) {
        const text = gotPetro ? `+${bonusRubles.toLocaleString("ru-RU")} ₽ & +1 🪙!` : `+${bonusRubles.toLocaleString("ru-RU")} ₽ ПРЕМИЯ!`;
        particleSystem.spawnFloatingText(this.screenX, this.screenY - 45, text, "#fbbf24", true);
        if (typeof particleSystem.spawnOilSplatter === "function") {
          particleSystem.spawnOilSplatter(this.screenX, this.screenY - 20, 10, true);
        }
      }
      return true;
    }

    // 1. Squash & Stretch Jump
    this.jumpTimer = this.jumpDuration;

    // 2. Audio Squeak with random pitch
    if (typeof audio?.playTap === "function") {
      audio.playTap();
    }
    if (typeof audio?.vibrate === "function") {
      audio.vibrate(15);
    }

    // 3. Status Badge Text
    let stateDesc = "В графике! 🛢️";
    if (this.isEcoResponder) stateDesc = "Локализую разлив сорбентом! 🧯";
    else if (this.state === WorkerBob.STATES.WORKING) stateDesc = "На вахте 🔧";
    else if (this.state === WorkerBob.STATES.TIRED_NEED_BREAK) stateDesc = "Иду за кофе ☕";
    else if (this.state === WorkerBob.STATES.RESTING) stateDesc = "Обед в столовой 🥪";
    else if (this.state === WorkerBob.STATES.PANIC_EMERGENCY) stateDesc = "Спасайся! 😱";
    else if (this.state === WorkerBob.STATES.CELEBRATE) stateDesc = "Памп котировок! 💰";

    this.statusText = `${this.name} (${this.jobTitle}): ${stateDesc}`;
    this.statusTimer = 3.0;
    this.statusAlpha = 1.0;

    // 4. Spawn Reaction Emoji
    if (emojiPool) {
      const emojiChoice = this.state === WorkerBob.STATES.WORKING ? "👍" : "👷‍♂️";
      emojiPool.spawn(this.screenX, this.screenY - 34, emojiChoice, 1.6, this);
    }

    if (particleSystem) {
      particleSystem.spawnFloatingText(this.screenX, this.screenY - 36, "+1% синергия", "#38bdf8", false);
    }

    return true;
  }

  draw(ctx, screenX, screenY) {
    this.screenX = screenX;
    this.screenY = screenY;

    ctx.save();
    ctx.translate(screenX, screenY - this.jumpHeight);

    // Soft drop shadow
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
    ctx.beginPath();
    ctx.ellipse(0, this.jumpHeight * 0.4 + 3, 11 * this.scaleX, 5.5 * this.scaleX, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Walking wobble rotation
    const wobbleAngle = this.isWalking ? Math.sin(this.wobblePhase) * 0.15 : 0;
    ctx.rotate(wobbleAngle);
    ctx.scale(this.facing * this.scaleX, this.scaleY);

    const isCorp = Boolean(state?.isCorporateEmpire);

    // === BOB WORKER SPRITE ===

    // 1. Boots (dark slate)
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(-6, 4, 4.5, 5.5, 2);
    ctx.roundRect(1.5, 4, 4.5, 5.5, 2);
    ctx.fill();

    // 2. Overalls (Capsule Body) - Corporate Deep Navy if Post-IPO
    ctx.fillStyle = isCorp ? "#1e3a8a" : this.bodyColor;
    ctx.beginPath();
    ctx.roundRect(-8, -14, 16, 20, 8);
    ctx.fill();

    // 3. High-Vis Vest - Branded Gold if Post-IPO
    ctx.fillStyle = this.isEcoResponder ? "#84cc16" : (isCorp ? "#f59e0b" : this.vestColor);
    ctx.beginPath();
    ctx.roundRect(-7.5, -12, 15, 14, 5);
    ctx.fill();

    // Silver reflective band & corporate badge
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-7, -7, 14, 2);
    if (isCorp) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(0, -9, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Head / Face (Warm peach)
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.arc(0, -18, 6.8, 0, Math.PI * 2);
    ctx.fill();

    // Face mask / respirator for eco responder
    if (this.isEcoResponder) {
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.roundRect(0, -17, 5.5, 4.5, 2);
      ctx.fill();
    }

    // Eye
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(2.5, -19, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Cheerful blush
    ctx.fillStyle = "rgba(244, 63, 94, 0.45)";
    ctx.beginPath();
    ctx.arc(2.5, -16.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Hard Hat - Corporate Crisp White with Gold Stripe if Post-IPO
    ctx.fillStyle = isCorp ? "#f8fafc" : this.hatColor;
    ctx.beginPath();
    ctx.arc(0, -21, 7.5, Math.PI, 0, false);
    ctx.fill();
    // Brim
    ctx.beginPath();
    ctx.roundRect(-9, -21, 18, 2.5, 1);
    ctx.fill();
    if (isCorp) {
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(-1.5, -21, 3, 6);
    }

    // 6. Working Tool / Sorbent Animation
    if (this.isEcoResponder && this.state === WorkerBob.STATES.ECO_RESPONDER && !this.isWalking) {
      // Sorbent Bag under arm
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.roundRect(-8, -10, 5, 8, 2);
      ctx.fill();

      // Sprinkling hand
      const sprinkle = Math.sin(this.toolAnimTimer) * 3;
      ctx.fillStyle = "#fed7aa";
      ctx.beginPath();
      ctx.arc(8, -10 + sprinkle, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state === WorkerBob.STATES.WORKING) {
      const toolSwing = Math.sin(this.toolAnimTimer) * 4;
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(5, -12 + toolSwing, 7, 2.5); // Wrench / tool
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(12, -11 + toolSwing, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Lucky Bob Glowing Prize Halo (Phase 6)
    if (this.isLuckyBob) {
      this.drawLuckyBobHalo(ctx, screenX, screenY - this.jumpHeight);
    }

    // Status Pill (Above Head)
    if (this.statusAlpha > 0.01 && this.statusText) {
      this.drawStatusPill(ctx, screenX, screenY - this.jumpHeight - 38);
    }
  }

  drawLuckyBobHalo(ctx, sx, sy) {
    ctx.save();
    const bob = Math.sin(this.luckyBobPulse) * 3;
    const cy = sy - 34 + bob;

    // Glowing halo disc
    ctx.fillStyle = "rgba(251, 191, 36, 0.35)";
    ctx.beginPath();
    ctx.arc(sx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Gold stroke ring
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(sx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();

    // Prize Icon
    ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎁", sx, cy);
    ctx.restore();
  }

  drawStatusPill(ctx, sx, sy) {
    ctx.save();
    ctx.globalAlpha = this.statusAlpha;
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif";

    const textWidth = ctx.measureText(this.statusText).width;
    const pw = textWidth + 14;
    const ph = 18;
    const px = sx - pw / 2;
    const py = sy - ph;

    // Drop shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(px, py + 1.5, pw, ph, 9);
    ctx.fill();

    // Pill background
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 9);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.statusText, sx, py + ph / 2);

    ctx.restore();
  }
}
