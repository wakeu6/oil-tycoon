import { state } from "../state.js";
import { audio } from "../audio.js";

const PI2 = Math.PI * 2;

/**
 * MchsTruck
 * All-terrain heavy emergency rescue vehicle (EMERCOM / МЧС).
 * Visual style: Overcrowded: Tycoon / ZeptoLab pastel polar aesthetic.
 * Features:
 * - Red and white rescue livery with stenciled "МЧС 01".
 * - Dual alternating high-intensity blue strobe beacons (🚨).
 * - Roof-mounted firefighting foam monitor cannon.
 * - Autonomous FSM: DISPATCHED -> RUSHING -> SPRAYING_FOAM -> RETURNING -> INACTIVE.
 * - Zero-GC design: preallocated state and scratch coordinates.
 */
export class MchsTruck {
  static STATES = {
    INACTIVE: 0,
    DISPATCHED: 1,
    RUSHING: 2,
    SPRAYING_FOAM: 3,
    RETURNING: 4
  };

  constructor() {
    this.active = false;
    this.state = MchsTruck.STATES.INACTIVE;

    // Grid Coordinates
    this.gx = -2.5;
    this.gy = 5.5;
    this.targetGx = -2.5;
    this.targetGy = 5.5;
    this.moveSpeed = 3.4; // Swift emergency response speed
    this.facing = 1; // 1 = right/forward, -1 = left/backward

    // Mission Details
    this.targetWellId = "well_1";
    this.destinationGx = 3.5;
    this.destinationGy = 5.5;
    this.sprayTimer = 0;
    this.sprayDuration = 1.8;

    // Visuals & Animations
    this.animTime = 0;
    this.suspensionWobble = 0;
    this.beaconStrobe = 0;
    this.screenX = 0;
    this.screenY = 0;
    this.screenRadius = 32;

    this.initEventListeners();
  }

  initEventListeners() {
    state.on("mchsDispatch", (data) => {
      this.dispatch(data?.targetWellId || "well_1");
    });
  }

  dispatch(wellId = "well_1") {
    this.active = true;
    this.state = MchsTruck.STATES.DISPATCHED;
    this.targetWellId = wellId;

    // Coordinates of wells and suitable vehicle parking positions:
    // well_1: (3.5, 3.5) -> park at (3.5, 4.8)
    // well_2: (8.5, 3.0) -> park at (8.0, 5.0)
    // well_3: (10.5, 6.5) -> park at (9.8, 6.0)
    // well_4: (10.0, 9.5) -> park at (8.8, 8.5)
    if (wellId === "well_2") {
      this.destinationGx = 8.0;
      this.destinationGy = 5.0;
    } else if (wellId === "well_3") {
      this.destinationGx = 9.8;
      this.destinationGy = 6.0;
    } else if (wellId === "well_4") {
      this.destinationGx = 8.8;
      this.destinationGy = 8.5;
    } else {
      this.destinationGx = 3.5;
      this.destinationGy = 4.8;
    }

    this.gx = -2.5;
    this.gy = 5.5;
    this.targetGx = 0.8; // Approach gate
    this.targetGy = 5.5;
    this.facing = 1;
    this.sprayTimer = 0;

    if (typeof audio?.playEmergencySiren === "function") {
      audio.playEmergencySiren(3.5);
    } else if (typeof audio?.playBoost === "function") {
      audio.playBoost();
    }
  }

  update(dt, particleSystem) {
    if (!this.active) return;
    this.animTime += dt;
    this.beaconStrobe = (this.animTime * 10) % 1;

    switch (this.state) {
      case MchsTruck.STATES.DISPATCHED: {
        // Drive towards gate
        const dx = this.targetGx - this.gx;
        const dist = Math.abs(dx);
        if (dist > 0.05) {
          this.gx += Math.sign(dx) * this.moveSpeed * dt;
          this.facing = Math.sign(dx) || 1;
          this.suspensionWobble = Math.sin(this.animTime * 18) * 1.5;
        } else {
          // Gate reached, rush to destination well
          this.state = MchsTruck.STATES.RUSHING;
          this.targetGx = this.destinationGx;
          this.targetGy = this.destinationGy;
        }
        break;
      }

      case MchsTruck.STATES.RUSHING: {
        // Navigate towards destination coordinates
        const dx = this.targetGx - this.gx;
        const dy = this.targetGy - this.gy;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.1) {
          const moveDist = this.moveSpeed * dt;
          this.gx += (dx / dist) * Math.min(moveDist, dist);
          this.gy += (dy / dist) * Math.min(moveDist, dist);
          if (Math.abs(dx) > 0.05) this.facing = Math.sign(dx);
          this.suspensionWobble = Math.sin(this.animTime * 20) * 1.8;

          // Exhaust / snow dust particles
          if (particleSystem && Math.random() < 0.25) {
            particleSystem.spawnSnowDust?.(this.screenX, this.screenY + 12);
          }
        } else {
          // Arrived at well, deploy foam monitor
          this.state = MchsTruck.STATES.SPRAYING_FOAM;
          this.sprayTimer = this.sprayDuration;
          this.suspensionWobble = 0;
        }
        break;
      }

      case MchsTruck.STATES.SPRAYING_FOAM: {
        this.sprayTimer -= dt;

        // Emit firefighting foam particles
        if (particleSystem) {
          // Spray dense white foam blobs
          for (let p = 0; p < 3; p++) {
            const foamX = this.screenX + (this.facing > 0 ? 18 : -18);
            const foamY = this.screenY - 14;
            const targetX = foamX + (this.facing > 0 ? 40 : -40) + (Math.random() - 0.5) * 20;
            const targetY = foamY - 10 + (Math.random() - 0.5) * 16;
            particleSystem.spawnFoamBlob?.(foamX, foamY, targetX, targetY);
          }
        }

        if (this.sprayTimer <= 0) {
          // Extinguishing complete, start return trip
          this.state = MchsTruck.STATES.RETURNING;
          this.targetGx = -3.5;
          this.targetGy = 5.5;
        }
        break;
      }

      case MchsTruck.STATES.RETURNING: {
        const dx = this.targetGx - this.gx;
        const dy = this.targetGy - this.gy;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.1) {
          const moveDist = (this.moveSpeed * 0.85) * dt;
          this.gx += (dx / dist) * Math.min(moveDist, dist);
          this.gy += (dy / dist) * Math.min(moveDist, dist);
          if (Math.abs(dx) > 0.05) this.facing = Math.sign(dx);
          this.suspensionWobble = Math.sin(this.animTime * 14) * 1.2;
        } else {
          // Deactivate
          this.active = false;
          this.state = MchsTruck.STATES.INACTIVE;
        }
        break;
      }
    }
  }

  draw(ctx, screenX, screenY) {
    if (!this.active) return;
    this.screenX = screenX;
    this.screenY = screenY;

    ctx.save();
    ctx.translate(screenX, screenY + this.suspensionWobble);

    // Soft drop shadow
    ctx.fillStyle = "rgba(15, 23, 42, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 26, 12, 0, 0, PI2);
    ctx.fill();

    // Direction flip
    if (this.facing < 0) {
      ctx.scale(-1, 1);
    }

    // 1. Off-Road Polar Wheels (6x6)
    ctx.fillStyle = "#0f172a";
    const wheelPositions = [-18, -4, 14];
    for (let i = 0; i < wheelPositions.length; i++) {
      const wx = wheelPositions[i];
      ctx.beginPath();
      ctx.roundRect(wx - 4, 3, 9, 12, 3);
      ctx.fill();

      // Silver hubcap
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(wx + 0.5, 9, 2.0, 0, PI2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
    }

    // 2. Heavy Steel Chassis Frame
    ctx.fillStyle = "#334155";
    ctx.fillRect(-22, 1, 44, 4);

    // 3. Equipment Box / Water-Foam Tank Body
    const bodyGrad = ctx.createLinearGradient(-22, -18, -22, 4);
    bodyGrad.addColorStop(0, "#ef4444");
    bodyGrad.addColorStop(0.5, "#dc2626");
    bodyGrad.addColorStop(1, "#b91c1c");

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#991b1b";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-22, -16, 26, 18, [3, 3, 1, 1]);
    ctx.fill();
    ctx.stroke();

    // White MCHS Equipment Stripe
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-22, -8, 26, 5);

    // Text "МЧС 01"
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 5.5px monospace";
    ctx.textAlign = "center";
    ctx.fillText("МЧС 01", -9, -4.5);

    // 4. Crew Cab (Front)
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(4, -18, 18, 20, [4, 6, 2, 2]);
    ctx.fill();
    ctx.stroke();

    // White Cab Door Stripe
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(4, -8, 18, 5);

    // Windshield & Side Window (Cyan tempered safety glass)
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(10, -16, 9, 7, [2, 4, 1, 1]);
    ctx.fill();

    // Window glare
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.moveTo(12, -16);
    ctx.lineTo(15, -16);
    ctx.lineTo(13, -10);
    ctx.lineTo(10.5, -10);
    ctx.closePath();
    ctx.fill();

    // Chrome Bumper and Grille
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(20, -3, 3, 6);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(21, -6, 2, 2.5); // Headlight

    // 5. Roof Monitor Foam Cannon
    ctx.save();
    ctx.translate(12, -19);
    // Aim cannon towards target if spraying
    if (this.state === MchsTruck.STATES.SPRAYING_FOAM) {
      ctx.rotate(-0.35);
    }
    ctx.fillStyle = "#475569";
    ctx.fillRect(-2, -2, 5, 4);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(10, -3);
    ctx.stroke();
    ctx.restore();

    // 6. Dual Alternating Strobe Emergency Beacons (🚨)
    const leftOn = this.beaconStrobe < 0.5;
    const rightOn = !leftOn;

    // Beacon mount
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(6, -21, 10, 3);

    // Left Beacon (Blue Strobe)
    ctx.fillStyle = leftOn ? "#60a5fa" : "#1e40af";
    ctx.beginPath();
    ctx.roundRect(6, -23, 4, 3.5, 1.5);
    ctx.fill();

    // Right Beacon (Blue Strobe)
    ctx.fillStyle = rightOn ? "#60a5fa" : "#1e40af";
    ctx.beginPath();
    ctx.roundRect(12, -23, 4, 3.5, 1.5);
    ctx.fill();

    // Light Corona Glow
    if (this.state !== MchsTruck.STATES.INACTIVE) {
      const glowX = leftOn ? 8 : 14;
      const blueGlow = ctx.createRadialGradient(glowX, -22, 1, glowX, -22, 22);
      blueGlow.addColorStop(0, "rgba(59, 130, 246, 0.65)");
      blueGlow.addColorStop(0.5, "rgba(96, 165, 250, 0.25)");
      blueGlow.addColorStop(1, "rgba(37, 99, 235, 0)");
      ctx.fillStyle = blueGlow;
      ctx.beginPath();
      ctx.arc(glowX, -22, 22, 0, PI2);
      ctx.fill();
    }

    ctx.restore();
  }
}
