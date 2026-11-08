/**
 * EmojiBubblePool
 * Zero-GC pre-allocated pool for floating emoji bubbles in Overcrowded: Tycoon style.
 * Strictly adheres to Emil Kowalski motion rules:
 * - Enter scale starts at 0.95 (never scale 0) up to 1.05 and settles to 1.0
 * - Eased out cubic-bezier(0.23, 1, 0.32, 1)
 * - Durations < 250ms for transition
 */
export class EmojiBubblePool {
  constructor(capacity = 60) {
    this.capacity = capacity;
    this.pool = new Array(capacity);

    for (let i = 0; i < capacity; i++) {
      this.pool[i] = {
        active: false,
        x: 0,
        y: 0,
        emoji: "🛢️",
        timer: 0,
        duration: 1.8,
        scale: 1.0,
        alpha: 1.0,
        offsetY: 0,
        attachEntity: null // Optional entity to follow
      };
    }
  }

  spawn(x, y, emoji, duration = 1.8, attachEntity = null) {
    for (let i = 0; i < this.capacity; i++) {
      const b = this.pool[i];
      if (!b.active) {
        b.active = true;
        b.x = x;
        b.y = y;
        b.emoji = emoji;
        b.timer = 0;
        b.duration = duration;
        b.scale = 0.95;
        b.alpha = 0;
        b.offsetY = 0;
        b.attachEntity = attachEntity;
        return b;
      }
    }
    return null;
  }

  update(dt) {
    for (let i = 0; i < this.capacity; i++) {
      const b = this.pool[i];
      if (!b.active) continue;

      b.timer += dt;

      // Follow attached entity if available
      if (b.attachEntity) {
        b.x = b.attachEntity.screenX || b.x;
        b.y = (b.attachEntity.screenY || b.y) - 38;
      }

      const enterDuration = 0.16; // 160ms Kowalski rapid responsive entry
      const exitDuration = 0.25;

      if (b.timer < enterDuration) {
        // Entry: scale 0.95 -> 1.04 -> 1.0 ease-out
        const t = b.timer / enterDuration;
        // Strong UI curve: 1 - Math.pow(1 - t, 3)
        const ease = 1 - Math.pow(1 - t, 3);
        b.alpha = ease;
        b.scale = 0.95 + ease * 0.08;
      } else if (b.timer > b.duration - exitDuration) {
        // Exit: gentle fade-out
        const t = (b.timer - (b.duration - exitDuration)) / exitDuration;
        b.alpha = Math.max(0, 1 - t);
        b.scale = 1.0 + t * 0.05;
      } else {
        // Resting display
        b.alpha = 1.0;
        b.scale = 1.0;
      }

      // Gentle upward float
      b.offsetY = -Math.sin(b.timer * 3) * 3 - (b.timer * 4);

      if (b.timer >= b.duration) {
        b.active = false;
        b.attachEntity = null;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < this.capacity; i++) {
      const b = this.pool[i];
      if (!b.active || b.alpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.translate(b.x, b.y + b.offsetY);
      ctx.scale(b.scale, b.scale);

      // Bubble background card
      const bw = 24;
      const bh = 24;

      // Soft drop shadow
      ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
      ctx.beginPath();
      ctx.ellipse(0, bh / 2 + 3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rounded white/pastel bubble
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 6);
      ctx.fill();
      ctx.stroke();

      // Tiny triangle tail pointing down
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-3, bh / 2);
      ctx.lineTo(0, bh / 2 + 4);
      ctx.lineTo(3, bh / 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.moveTo(-3, bh / 2);
      ctx.lineTo(0, bh / 2 + 4);
      ctx.lineTo(3, bh / 2);
      ctx.stroke();

      // Emoji
      ctx.fillText(b.emoji, 0, 1);

      ctx.restore();
    }

    ctx.restore();
  }
}
