import { state } from "../state.js";
import { audio } from "../audio.js";

/**
 * SavelichAgent
 * Physical in-game Foreman Savelich (Прораб Савельич) in the style of Overcrowded: Tycoon.
 * A cute bean-shaped worker in a hard hat and hi-vis vest walking around the oilfield,
 * reacting to taps with squash & stretch, witty speech bubbles, and micro-grants.
 */
export class SavelichAgent {
  constructor() {
    // Grid position
    this.gx = 6.0;
    this.gy = 5.0;
    this.targetGx = 6.0;
    this.targetGy = 5.0;
    this.moveSpeed = 1.2; // tiles per second
    this.facing = 1; // 1 = right, -1 = left

    // Waypoints for patrol (grid coordinates along roads)
    this.waypoints = [
      { gx: 6.0, gy: 5.0, wait: 3.0, label: "ЦПС" },
      { gx: 4.0, gy: 4.0, wait: 4.0, label: "Скважина №1" },
      { gx: 7.0, gy: 3.0, wait: 3.5, label: "Скважина №2" },
      { gx: 8.5, gy: 6.0, wait: 3.0, label: "Скважина №3" },
      { gx: 9.0, gy: 8.0, wait: 4.0, label: "Скважина №4" },
      { gx: 7.5, gy: 9.0, wait: 3.0, label: "Факел" },
      { gx: 3.5, gy: 7.5, wait: 3.0, label: "Эстакада" }
    ];
    this.currentWaypointIndex = 0;
    this.waitTimer = 2.0;

    // Animation states
    this.wobblePhase = 0;
    this.isWalking = false;
    this.jumpTimer = 0;
    this.jumpDuration = 0.35;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.jumpHeight = 0;

    // Speech bubble state
    this.speechText = "";
    this.speechTimer = 0;
    this.speechDuration = 3.5;
    this.speechAlpha = 0;

    // Micro-bonus cooldown
    this.lastBonusTime = 0;
    this.bonusCooldownSec = 120; // 2 minutes

    // Witty quotes
    this.quotes = [
      "Качай, качай! Баррель рубль бережёт!",
      "Скважина №1 работает как швейцарские часы!",
      "Давление в норме, грифон нам не страшен!",
      "На бирже жара! Не упусти котировки!",
      "Савельич на объекте — порядок на промысле!",
      "Ох и морозец на Ямале, градусов сорок пять!",
      "Загляни на склад технологий, там новые штанги!",
      "Бензовозы наготове, отгрузка идёт полным ходом!"
    ];

    // Screen coordinates cache for hit-testing
    this.screenX = 0;
    this.screenY = 0;
    this.screenRadius = 32;
  }

  update(dt) {
    // 1. Update Speech Bubble
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer > 0.3) {
        this.speechAlpha = Math.min(1, this.speechAlpha + dt * 5);
      } else {
        this.speechAlpha = Math.max(0, this.speechTimer / 0.3);
      }
    } else {
      this.speechAlpha = 0;
    }

    // 2. Update Jump / Squash & Stretch
    if (this.jumpTimer > 0) {
      this.jumpTimer -= dt;
      const progress = 1 - (this.jumpTimer / this.jumpDuration);
      if (progress < 0.3) {
        // Squish down before jump
        this.scaleX = 1.25;
        this.scaleY = 0.8;
        this.jumpHeight = 0;
      } else if (progress < 0.7) {
        // Stretch in air
        const airProgress = (progress - 0.3) / 0.4;
        this.jumpHeight = Math.sin(airProgress * Math.PI) * 24;
        this.scaleX = 0.85;
        this.scaleY = 1.18;
      } else {
        // Land and settle
        const landProgress = (progress - 0.7) / 0.3;
        this.jumpHeight = 0;
        this.scaleX = 1 + (1 - landProgress) * 0.15;
        this.scaleY = 1 - (1 - landProgress) * 0.15;
      }
    } else {
      this.scaleX = 1.0;
      this.scaleY = 1.0;
      this.jumpHeight = 0;
    }

    // 3. Waypoint Navigation
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      this.isWalking = false;
      return;
    }

    const currentWp = this.waypoints[this.currentWaypointIndex];
    const dx = currentWp.gx - this.gx;
    const dy = currentWp.gy - this.gy;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.08) {
      // Reached waypoint
      this.gx = currentWp.gx;
      this.gy = currentWp.gy;
      this.waitTimer = currentWp.wait;
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      this.isWalking = false;
    } else {
      // Move towards waypoint
      this.isWalking = true;
      const step = Math.min(dist, this.moveSpeed * dt);
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;

      // Facing direction
      if (dx > 0.01) this.facing = 1;
      else if (dx < -0.01) this.facing = -1;

      // Wobble animation while walking
      this.wobblePhase += dt * 10;
    }
  }

  handleTap(screenX, screenY, particleSystem) {
    const dist = Math.hypot(screenX - this.screenX, screenY - this.screenY);
    if (dist > this.screenRadius) return false;

    // 1. Trigger Jump & Squash/Stretch
    this.jumpTimer = this.jumpDuration;

    // 2. Play funny audio squeak/voice
    if (typeof audio?.playTap === "function") {
      audio.playTap();
    }
    if (typeof audio?.vibrate === "function") {
      audio.vibrate(25);
    }

    // 3. Pick random quote
    const quote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
    this.speechText = quote;
    this.speechTimer = this.speechDuration;
    this.speechAlpha = 1;

    // 4. Trigger HUD advisor tip as well
    state.triggerAdvisorTip("savelich_field", "Прораб Савельич", quote);

    // 5. Check Micro-bonus opportunity
    const now = Date.now() / 1000;
    if (now - this.lastBonusTime >= this.bonusCooldownSec) {
      this.lastBonusTime = now;
      const rate = state.getIncomeRate();
      const bonusMoney = Math.max(300, Math.round(rate * 25));
      state.addMoney(bonusMoney);

      if (particleSystem) {
        particleSystem.spawnFloatingText(
          this.screenX,
          this.screenY - 45,
          `+${bonusMoney} ₽ Премия!`,
          "#fbbf24",
          true
        );
        particleSystem.spawnOilSplatter(this.screenX, this.screenY, 12, true);
      }
      if (typeof audio?.playCoin === "function") {
        audio.playCoin();
      }
    } else {
      if (particleSystem) {
        particleSystem.spawnFloatingText(
          this.screenX,
          this.screenY - 40,
          "👷‍♂️ Молодец!",
          "#38bdf8",
          false
        );
      }
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
    ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, this.jumpHeight * 0.4 + 4, 16 * this.scaleX, 8 * this.scaleX, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Walking wobble rotation
    const wobbleAngle = this.isWalking ? Math.sin(this.wobblePhase) * 0.12 : 0;
    ctx.rotate(wobbleAngle);
    ctx.scale(this.facing * this.scaleX, this.scaleY);

    // === SAVELICH BOB BODY ===

    // 1. Legs / Work Boots (dark slate)
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(-8, 6, 6, 7, [2, 2, 3, 3]);
    ctx.roundRect(2, 6, 6, 7, [2, 2, 3, 3]);
    ctx.fill();

    // 2. Bean Body / Work Overalls (deep navy blue)
    ctx.fillStyle = "#1e3a8a";
    ctx.beginPath();
    ctx.roundRect(-12, -18, 24, 26, 12);
    ctx.fill();

    // 3. High-Vis Orange Vest
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.roundRect(-11, -16, 22, 19, 7);
    ctx.fill();

    // Reflective Silver Stripes
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(-10, -9, 20, 2.5);
    ctx.fillRect(-10, -3, 20, 2.5);

    // Vest zipper
    ctx.strokeStyle = "#c2410c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(0, 3);
    ctx.stroke();

    // 4. Head / Face (Warm peachy tone)
    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.arc(0, -22, 9, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(3, -23, 1.4, 0, Math.PI * 2);
    ctx.arc(7, -23, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Mustaches (Foreman trademark)
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.ellipse(4, -19, 5, 2.2, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // 5. Yellow Safety Hard Hat
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    // Dome
    ctx.arc(0, -26, 9.5, Math.PI, 0, false);
    ctx.fill();
    // Brim
    ctx.beginPath();
    ctx.roundRect(-12, -26, 24, 3.5, 1.5);
    ctx.fill();

    // Hard hat ridge
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(0, -26);
    ctx.stroke();

    ctx.restore();

    // === SPEECH BUBBLE (Above head) ===
    if (this.speechAlpha > 0.01 && this.speechText) {
      this.drawSpeechBubble(ctx, screenX, screenY - this.jumpHeight - 48);
    }
  }

  drawSpeechBubble(ctx, bx, by) {
    ctx.save();
    ctx.globalAlpha = this.speechAlpha;
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    const textWidth = ctx.measureText(this.speechText).width;
    const padX = 10;
    const padY = 6;
    const bw = Math.min(220, textWidth + padX * 2);
    const bh = 26;

    const x = bx - bw / 2;
    const y = by - bh;

    // Bubble card shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 2, bw, bh, 8);
    ctx.fill();

    // Bubble card background
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    // Little tail pointing to Savelich
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(bx - 5, y + bh);
    ctx.lineTo(bx, y + bh + 6);
    ctx.lineTo(bx + 5, y + bh);
    ctx.closePath();
    ctx.fill();

    // Tail border
    ctx.strokeStyle = "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(bx - 5, y + bh);
    ctx.lineTo(bx, y + bh + 6);
    ctx.lineTo(bx + 5, y + bh);
    ctx.stroke();

    // Text
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.speechText, bx, y + bh / 2);

    ctx.restore();
  }
}
