/**
 * ServiceVehiclesManager
 * Zero-GC management of field utility trucks (Food supply van and Field maintenance truck).
 * Handles gate crossing, waypoint following, parking at destinations, and gate barrier control.
 */

export class ServiceVehiclesManager {
  constructor() {
    this.vehicles = [
      {
        id: "food_van",
        type: "food",
        name: "Снабжение",
        gx: -2.0,
        gy: 5.5,
        state: "idle", // idle, enter_gate, to_dest, parked, to_exit, exit_gate
        timer: 3.0,
        speed: 1.1,
        destGx: 3.5,
        destGy: 7.6,
        color: "#f8fafc",
        roofColor: "#0284c7",
        cargoEmoji: "📦",
        parkDuration: 7.0
      },
      {
        id: "tech_truck",
        type: "tech",
        name: "Техпомощь",
        gx: -4.0,
        gy: 5.5,
        state: "idle",
        timer: 18.0,
        speed: 1.25,
        destGx: 5.6,
        destGy: 6.5,
        color: "#005bab",
        roofColor: "#00a3e0",
        cargoEmoji: "🔧",
        parkDuration: 8.0
      }
    ];

    this.barrierAngle = 0; // 0 = closed, 1 = fully open
  }

  update(dt, particles) {
    let nearGate = false;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];

      // Check proximity to gatehouse (1.0, 5.5)
      const distToGate = Math.hypot(v.gx - 1.0, v.gy - 5.5);
      if (distToGate < 1.6 && v.state !== "idle") {
        nearGate = true;
      }

      switch (v.state) {
        case "idle":
          v.timer -= dt;
          if (v.timer <= 0) {
            v.state = "to_dest";
            v.gx = -1.5;
            v.gy = 5.5;
          }
          break;

        case "to_dest": {
          // Wait for barrier if right at gate
          if (distToGate < 0.6 && this.barrierAngle < 0.6) {
            break; // Waiting for barrier arm to raise
          }

          // Move along road towards destination
          const dx = v.destGx - v.gx;
          const dy = v.destGy - v.gy;
          const dist = Math.hypot(dx, dy);

          if (dist < 0.15) {
            v.state = "parked";
            v.timer = v.parkDuration;
            if (particles) {
              particles.spawnSnowDust?.(0, 0); // dust on stop
            }
          } else {
            const step = v.speed * dt;
            v.gx += (dx / dist) * Math.min(step, dist);
            v.gy += (dy / dist) * Math.min(step, dist);
          }
          break;
        }

        case "parked":
          v.timer -= dt;
          if (v.timer <= 0) {
            v.state = "to_exit";
          }
          break;

        case "to_exit": {
          const exitGx = -2.5;
          const exitGy = 5.5;
          const dx = exitGx - v.gx;
          const dy = exitGy - v.gy;
          const dist = Math.hypot(dx, dy);

          if (dist < 0.2) {
            v.state = "idle";
            v.timer = 20.0 + Math.random() * 25.0; // Wait before next service run
            v.gx = -3.0;
          } else {
            const step = v.speed * dt;
            v.gx += (dx / dist) * Math.min(step, dist);
            v.gy += (dy / dist) * Math.min(step, dist);
          }
          break;
        }
      }
    }

    // Smooth barrier arm physics
    const targetAngle = nearGate ? 1.0 : 0.0;
    const rate = nearGate ? 4.5 : 2.5;
    if (this.barrierAngle < targetAngle) {
      this.barrierAngle = Math.min(targetAngle, this.barrierAngle + dt * rate);
    } else if (this.barrierAngle > targetAngle) {
      this.barrierAngle = Math.max(targetAngle, this.barrierAngle - dt * rate);
    }
  }

  drawVehicle(ctx, v, sc, zoom, animTime) {
    if (v.state === "idle" || v.gx < -1.0) return;

    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.scale(zoom, zoom);

    // Drop shadow
    ctx.fillStyle = "rgba(15, 23, 42, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chassis / Body
    ctx.fillStyle = v.color;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-14, -8, 28, 12, 3);
    ctx.fill();
    ctx.stroke();

    // Cabin Roof & Windshield
    ctx.fillStyle = v.roofColor;
    ctx.beginPath();
    ctx.roundRect(-4, -13, 16, 7, 2);
    ctx.fill();
    ctx.stroke();

    // Windshield
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(6, -11, 4, 5);

    // Wheels
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-11, 2, 5, 4);
    ctx.fillRect(6, 2, 5, 4);

    // Service Decal / Logo
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 6px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(v.name.slice(0, 4).toUpperCase(), -4, -1);

    // Parked Cargo Delivery Floating Indicator
    if (v.state === "parked") {
      const bob = Math.sin(animTime * 5) * 3;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-10, -30 + bob, 20, 14, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(v.cargoEmoji, 0, -20 + bob);
    }

    ctx.restore();
  }
}
