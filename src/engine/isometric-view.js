import { state } from "../state.js";
import { CONFIG } from "../config.js";
import { audio } from "../audio.js";
import { ParticleSystem } from "./particles.js";
import { SavelichAgent } from "./savelich-agent.js";
import { WorkerPool } from "./worker-pool.js";
import { TankerPool } from "./tanker-pool.js";
import { MchsTruck } from "./mchs-truck.js";
import { ServiceVehiclesManager } from "./service-vehicles.js";
import { TrekolRoverManager } from "./trekol-rover.js";
import { Isometric3D } from "./isometric-3d.js";

const PI2 = Math.PI * 2;
const TILE_W = 96;
const TILE_H = 48;
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

/**
 * IsometricView
 * 2.5D Dimetric Isometric Engine for "Overcrowded: Tycoon" style oilfield simulation.
 * Features:
 * - 2:1 dimetric projection with depth-sorted rendering
 * - Hybrid camera: kinetic inertia, pinch-to-zoom (0.6x - 2.0x), mouse wheel zoom to cursor
 * - Pastel Polar Siberian theme with soft blob shadows
 * - Interactive Savelich agent, pumpjacks, tanks, flare stack, helipad
 * - Zero-GC per frame execution with pre-allocated scratch vectors
 */
export class IsometricView {
  constructor(canvas) {
    this.canvas = canvas;
    this.is3D = typeof window !== "undefined" && Boolean(window.THREE);
    this.engine3D = null;

    if (this.is3D) {
      this.engine3D = new Isometric3D(canvas, this);
    } else {
      this.ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    }
    this.particles = new ParticleSystem();
    this.savelich = new SavelichAgent();
    this.workerPool = new WorkerPool(40);
    this.tankerPool = new TankerPool(16);
    this.mchsTruck = new MchsTruck();
    this.serviceVehicles = new ServiceVehiclesManager();
    this.trekolRover = new TrekolRoverManager();

    this.width = 0;
    this.height = 0;
    this.dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

    // Simulation & Visual Timers
    this.animTime = 0;
    this.tapSurge = 0;

    // Screen Shake (Decaying Trauma^2 model)
    this.trauma = 0;
    this.traumaDecay = 1.6;
    this.maxShakeOffset = 14;

    // Camera State
    this.camera = {
      x: 0,
      y: 220,
      targetX: 0,
      targetY: 220,
      zoom: 1.0,
      targetZoom: 1.0,
      isFocusing: false,
      vx: 0,
      vy: 0,
      minZoom: 0.6,
      maxZoom: 2.0
    };

    // World Bounds (Grid units 0..14)
    this.gridSize = 14;

    // Touch & Pointer Tracking
    this.activePointers = new Map();
    this.isDragging = false;
    this.hasMovedDrag = false;
    this.dragStartCamX = 0;
    this.dragStartCamY = 0;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.initialPinchDistance = 0;
    this.initialPinchZoom = 1.0;

    // Scratch objects for Zero-GC calculations
    this._scratchIso = { x: 0, y: 0 };
    this._scratchScreen = { x: 0, y: 0 };
    this._scratchGrid = { gx: 0, gy: 0 };

    // Structure Definitions (Grid Coordinates - Mega Field Layout, Phase 12)
    this.structures = [
      { id: "well_1", name: "Куст 1 (Пионер)", type: "well_cluster", gx: 2.5, gy: 2.5, radius: 52 },
      { id: "well_2", name: "Куст 2 (Северный)", type: "well_cluster", gx: 11.5, gy: 2.5, radius: 52 },
      { id: "well_3", name: "Куст 3 (Полярный)", type: "well_cluster", gx: 11.5, gy: 8.5, radius: 52 },
      { id: "well_4", name: "Куст 4 (Горизонт)", type: "well_cluster", gx: 9.5, gy: 11.5, radius: 52 },
      { id: "station_cps", name: "Газовый промысел", type: "gathering_station", gx: 6.5, gy: 6.5, radius: 88 },
      { id: "canteen", name: "Столовая промысла", type: "canteen", gx: 3.5, gy: 7.8, radius: 36 },
      { id: "dormitory", name: "Вахтовое общежитие", type: "dormitory", gx: 3.5, gy: 9.8, radius: 38 },
      { id: "crypto_flare", name: "Факельная установка & ЦОД", type: "flare_crypto", gx: 12.0, gy: 11.5, radius: 45 },
      { id: "gatehouse", name: "КПП Промысла", type: "gatehouse", gx: 1.0, gy: 5.5, radius: 45 }
    ];

    // Preallocated Render List for Depth Sorting
    this.renderQueue = [];

    // Falling Snow Particles (Preallocated Zero-GC, Phase 6)
    this.snowflakes = new Array(65);
    for (let i = 0; i < 65; i++) {
      this.snowflakes[i] = {
        x: Math.random() * 1200,
        y: Math.random() * 900,
        r: 1.0 + Math.random() * 2.0,
        vx: -0.4 - Math.random() * 0.7,
        vy: 1.1 + Math.random() * 1.6,
        alpha: 0.35 + Math.random() * 0.55
      };
    }

    // Interactive Valve Tuning Mini-Game (Phase 6)
    this.valveMiniGame = {
      active: false,
      wellId: null,
      pressure: 120, // 0..250 atm
      targetMin: 160,
      targetMax: 200,
      needleSpeed: 3.5,
      turnsCompleted: 0,
      turnsRequired: 3,
      wheelAngle: 0,
      cooldownTimer: 0
    };

    this.initEvents();
    this.resize();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => this.resize());
    }
  }

  // --- COORDINATE TRANSFORMS ---

  gridToIso(gx, gy, gz = 0) {
    this._scratchIso.x = (gx - gy) * HALF_W;
    this._scratchIso.y = (gx + gy) * HALF_H - gz;
    return this._scratchIso;
  }

  isoToScreen(isoX, isoY) {
    this._scratchScreen.x = (isoX - this.camera.x) * this.camera.zoom + this.width * 0.5;
    this._scratchScreen.y = (isoY - this.camera.y) * this.camera.zoom + this.height * 0.5;
    return this._scratchScreen;
  }

  screenToIso(sx, sy) {
    this._scratchIso.x = (sx - this.width * 0.5) / this.camera.zoom + this.camera.x;
    this._scratchIso.y = (sy - this.height * 0.5) / this.camera.zoom + this.camera.y;
    return this._scratchIso;
  }

  isoToGrid(isoX, isoY) {
    this._scratchGrid.gx = (isoX / HALF_W + isoY / HALF_H) * 0.5;
    this._scratchGrid.gy = (isoY / HALF_H - isoX / HALF_W) * 0.5;
    return this._scratchGrid;
  }

  gridToScreen(gx, gy, gz = 0) {
    const iso = this.gridToIso(gx, gy, gz);
    return this.isoToScreen(iso.x, iso.y);
  }

  screenToGrid(sx, sy) {
    const iso = this.screenToIso(sx, sy);
    return this.isoToGrid(iso.x, iso.y);
  }

  // --- SCREEN SHAKE & JUICE ---

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  triggerScreenShake(duration = 0.25, intensity = 5.0) {
    this.addTrauma(0.5);
  }

  // --- SIZING & EVENTS ---

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    this.width = r.width || 400;
    this.height = r.height || 600;
    this.dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

    if (this.is3D && this.engine3D) {
      this.engine3D.resize();
      return;
    }

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    if (this.ctx && this.ctx.setTransform) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    // Dynamically balance default camera Y based on viewport height so the field doesn't look clipped
    if (!this.camera.isFocusing && Math.hypot(this.camera.x, this.camera.y - 220) < 5) {
      this.camera.y = Math.min(260, Math.max(160, 220 + (500 - this.height) * 0.25));
    }
  }

  initEvents() {
    if (this.is3D) {
      // 3D mode uses Raycasting & OrbitControls inside Isometric3D
      // Wire up state events for structure focus
      state.on("focusOnStructure", (data) => {
        if (this.engine3D && data?.id) {
          // Can focus in 3D
        }
      });
      return;
    }

    this.canvas.style.touchAction = "none";

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    // Pointer Down
    this.canvas.addEventListener("pointerdown", (e) => {
      this.canvas.setPointerCapture?.(e.pointerId);
      const p = getPos(e);
      this.activePointers.set(e.pointerId, p);

      if (this.activePointers.size === 1) {
        this.camera.isFocusing = false;
        this.isDragging = true;
        this.hasMovedDrag = false;
        this.dragStartCamX = this.camera.x;
        this.dragStartCamY = this.camera.y;
        this.lastPointerX = p.x;
        this.lastPointerY = p.y;
        this.camera.vx = 0;
        this.camera.vy = 0;
      } else if (this.activePointers.size === 2) {
        // Start Pinch Zoom
        const pts = Array.from(this.activePointers.values());
        this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.initialPinchZoom = this.camera.zoom;
      }
    });

    // Pointer Move
    if (typeof window !== "undefined") {
      window.addEventListener("pointermove", (e) => {
        if (!this.activePointers.has(e.pointerId)) return;
        const p = getPos(e);
        this.activePointers.set(e.pointerId, p);

        if (this.activePointers.size === 1 && this.isDragging) {
          const dx = p.x - this.lastPointerX;
          const dy = p.y - this.lastPointerY;

          if (Math.hypot(dx, dy) > 4) {
            this.hasMovedDrag = true;
          }

          // Kinetic pan
          this.camera.x -= dx / this.camera.zoom;
          this.camera.y -= dy / this.camera.zoom;

          // Track velocity
          this.camera.vx = -dx / this.camera.zoom;
          this.camera.vy = -dy / this.camera.zoom;

          this.lastPointerX = p.x;
          this.lastPointerY = p.y;
        } else if (this.activePointers.size === 2) {
          // Handle Pinch
          const pts = Array.from(this.activePointers.values());
          const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (this.initialPinchDistance > 0) {
            const ratio = currentDist / this.initialPinchDistance;
            const newZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, this.initialPinchZoom * ratio));
            this.camera.zoom = newZoom;
          }
        }
      });

      // Pointer Up
      const onPointerUp = (e) => {
        if (this.activePointers.has(e.pointerId)) {
          const p = this.activePointers.get(e.pointerId);
          this.activePointers.delete(e.pointerId);

          if (this.activePointers.size === 0) {
            this.isDragging = false;
            if (!this.hasMovedDrag && p) {
              this.handleTapAt(p.x, p.y);
            }
          } else if (this.activePointers.size === 1) {
            const remaining = Array.from(this.activePointers.values())[0];
            this.lastPointerX = remaining.x;
            this.lastPointerY = remaining.y;
          }
        }
      };

      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    }

    // Mouse Wheel Zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.camera.isFocusing = false;
      const p = getPos(e);

      // World point before zoom
      const isoBefore = this.screenToIso(p.x, p.y);
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const targetZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, this.camera.zoom * factor));
      this.camera.zoom = targetZoom;

      // Adjust camera so world point under cursor remains stable
      const isoAfter = this.screenToIso(p.x, p.y);
      this.camera.x += (isoBefore.x - isoAfter.x);
      this.camera.y += (isoBefore.y - isoAfter.y);
    }, { passive: false });

    // Stock Exchange Opening Bell & Confetti Celebration on IPO (Phase 7)
    this.celebrationBanner = null;
    state.on("ipoComplete", (data) => {
      this.addTrauma(0.55);
      if (typeof audio?.playExchangeBell === "function") {
        audio.playExchangeBell();
      } else if (typeof audio?.playPayout === "function") {
        audio.playPayout();
      }
      // Confetti shower
      for (let i = 0; i < 40; i++) {
        const rx = Math.random() * (this.width || 400);
        const ry = Math.random() * ((this.height || 600) * 0.6);
        this.particles.spawnOilSplatter(rx, ry, 6, Math.random() < 0.6);
      }
      const cName = data?.companyName || state.ipo?.companyName || "ПАО";
      this.celebrationBanner = {
        text: `🔔 ПАО «${cName}» ВЫШЛО НА БИРЖУ!`,
        subText: `⭐ КОРПОРАТИВНЫЙ ТИР ${state.corporatePrestigeTier || 1} ⭐`,
        timer: 4.5
      };
      this.particles.spawnFloatingText((this.width || 400) * 0.5, (this.height || 600) * 0.35, `🔔 ПАО «${cName}» ВЫШЛО НА БИРЖУ!`, "#fbbf24", true);
    });

    // Well Tuning Mini-Game Trigger
    state.on("startValveMiniGame", (data) => {
      state.emit("openWellTuningModal", data || { wellId: state.activeWellId || "well_1" });
    });

    // Smooth Camera Focusing on Well Cluster / Structure (Phase 12)
    state.on("focusOnStructure", (data) => {
      const s = this.structures.find(item => item.id === data.id);
      if (s) {
        const iso = this.gridToIso(s.gx, s.gy);
        this.camera.targetX = iso.x;
        this.camera.targetY = iso.y + 35;
        this.camera.targetZoom = 1.65;
        this.camera.isFocusing = true;
      }
    });

    state.on("resetCameraFocus", () => {
      this.camera.targetX = 0;
      this.camera.targetY = 220;
      this.camera.targetZoom = 1.0;
      this.camera.isFocusing = true;
    });
  }

  // --- TAP & HIT TESTING ---

  handleTapAt(sx, sy) {
    // 0. Check Valve Tuning Mini-Game tap (Phase 6 legacy)
    if (this.valveMiniGame?.active) {
      if (this.handleValveMiniGameTap(sx, sy)) {
        return;
      }
    }

    // 1. Check Savelich Tap
    if (this.savelich.handleTap(sx, sy, this.particles)) {
      this.tapSurge = Math.min(this.tapSurge + 0.5, 3.0);
      return;
    }

    // Check Accident Oil Spill / Well QTE Tap (Phase 4)
    if (state.accident && state.accident.active) {
      const targetWellId = state.accident.targetWellId || state.activeWellId || "well_1";
      const leakStruct = this.structures.find(s => s.id === targetWellId) || this.structures[0];
      const leakSc = this.gridToScreen(leakStruct.gx, leakStruct.gy);
      const hitSpill = Math.hypot(sx - leakSc.x, sy - leakSc.y) <= (65 * this.camera.zoom);

      if (hitSpill) {
        state.progressAccidentQte(0.12);
        if (state.specialization === "gas") {
          this.particles.spawnGasPuff(sx, sy, 10);
          this.particles.spawnSnowDust(sx, sy);
          this.particles.spawnFloatingText(sx, sy, "ПЕРЕКРЫТИЕ! -12%", "#38bdf8", true);
        } else {
          this.particles.spawnOilSplatter(sx, sy, 10, state.accident.isGoldTap);
          this.particles.spawnSnowDust(sx, sy);
          this.particles.spawnFloatingText(sx, sy, "ЛИКВИДАЦИЯ! -12%", "#34d399", true);
        }
        this.addTrauma(0.18);
        this.tapSurge = Math.min(this.tapSurge + 0.6, 3.0);
        return;
      }
    }

    // 2. Check Worker Bob Tap
    if (this.workerPool.handleTap(sx, sy, this.particles)) {
      this.tapSurge = Math.min(this.tapSurge + 0.4, 3.0);
      return;
    }

    // 3. Check Helicopter or Supply Crate Click (2.5D World Anchor, Phase 6 & Phase 9)
    if (state.helicopter && (state.helicopter.active || state.helicopter.crateDropped)) {
      const hsc = this.gridToScreen(state.helicopter.gx ?? 1.5, state.helicopter.gy ?? 11.5, state.helicopter.gz ?? 110);
      const csc = this.gridToScreen(state.helicopter.crateGx ?? 1.5, state.helicopter.crateGy ?? 11.5, state.helicopter.crateGz ?? 0);
      const hitHeli = state.helicopter.active && (Math.hypot(sx - hsc.x, sy - hsc.y) <= (65 * this.camera.zoom));
      const hitCrate = state.helicopter.crateDropped && (Math.hypot(sx - csc.x, sy - csc.y) <= Math.max(50, 65 * this.camera.zoom));

      if (hitHeli || hitCrate) {
        if (state.handleHelicopterClick(hitCrate ? "crate" : "heli")) {
          this.particles.spawnOilSplatter(sx, sy, 12, true);
          return;
        }
      }
    }

    // 4. Check Structure Click (Well Clusters 1-4 with generous hitboxes)
    for (let i = 0; i < this.structures.length; i++) {
      const s = this.structures[i];
      if (s.id.startsWith("well_")) {
        const sc = this.gridToScreen(s.gx, s.gy);
        const z = this.camera.zoom;
        const dx = sx - sc.x;
        const dy = sy - sc.y;
        // Generous hitbox covering the ground cluster slab AND vertical wellhead valves
        const hitDiamond = (Math.abs(dx) / (65 * z) + Math.abs(dy) / (38 * z)) <= 1.0;
        const hitTower = (Math.abs(dx) <= 55 * z) && (dy >= -75 * z && dy <= 20 * z);

        if (hitDiamond || hitTower) {
          const well = state.wells[s.id];
          if (!well?.unlocked) {
            // Locked sector clicked: Show cost prompt & open upgrade/unlock sheet!
            const def = CONFIG.WELLS.find(w => w.id === s.id);
            this.particles.spawnFloatingText(sc.x, sc.y - 45, `🔒 ${s.name}: ${def ? def.unlockCost.toLocaleString("ru-RU") : ""} ₽`, "#f87171", true);
            if (typeof audio?.playTap === "function") audio.playTap();
            state.emit("openWellUpgradeSheet", { wellId: s.id });
            return;
          }

          // Unlocked well cluster tapped: select active well and open upgrade sheet
          state.setActiveWell(s.id);
          state.emit("openWellUpgradeSheet", { wellId: s.id });
          return;
        }
      }
    }

    // 5. Check Mega Gas Processing Plant Tap (Central Facility at 6.5, 6.5)
    const cpsStruct = this.structures.find(s => s.id === "station_cps");
    if (cpsStruct) {
      const cpsSc = this.gridToScreen(cpsStruct.gx, cpsStruct.gy);
      const z = this.camera.zoom;
      const gdx = sx - cpsSc.x;
      const gdy = sy - cpsSc.y;
      if (Math.abs(gdx) <= (85 * z) && (gdy >= -80 * z && gdy <= 30 * z)) {
        state.emit("openFacilityUpgradeSheet");
        if (typeof audio?.playTap === "function") audio.playTap();
        return;
      }
    }

    // 6. Check Canteen Tap (Kitchen module at 3.5, 7.8)
    const canteenStruct = this.structures.find(s => s.id === "canteen");
    if (canteenStruct) {
      const cSc = this.gridToScreen(canteenStruct.gx, canteenStruct.gy);
      const z = this.camera.zoom;
      const cdx = sx - cSc.x;
      const cdy = sy - cSc.y;
      if (Math.abs(cdx) <= (32 * z) && (cdy >= -32 * z && cdy <= 16 * z)) {
        state.emit("openCanteenUpgradeSheet");
        if (typeof audio?.playTap === "function") audio.playTap();
        return;
      }
    }

    // 6B. Check Crew Dormitory Tap (Living quarters at 3.5, 9.8)
    const dormStruct = this.structures.find(s => s.id === "dormitory");
    if (dormStruct) {
      const dSc = this.gridToScreen(dormStruct.gx, dormStruct.gy);
      const z = this.camera.zoom;
      const ddx = sx - dSc.x;
      const ddy = sy - dSc.y;
      if (Math.abs(ddx) <= (34 * z) && (ddy >= -36 * z && ddy <= 16 * z)) {
        state.emit("openCanteenUpgradeSheet");
        if (typeof audio?.playTap === "function") audio.playTap();
        return;
      }
    }

    // 7. Check Crypto Flare & Data Center Tap (Phase 12 Inactive Lock / Active Purge)
    const flareStruct = this.structures.find(s => s.id === "crypto_flare");
    if (flareStruct) {
      const flareSc = this.gridToScreen(flareStruct.gx, flareStruct.gy);
      const z = this.camera.zoom;
      if (Math.hypot(sx - flareSc.x, sy - (flareSc.y - 45 * z)) <= (45 * z)) {
        if (!state.cryptoMiningActive) {
          // Inactive flare mining: open activation modal with 5M cash or 10 ads!
          state.emit("openCryptoActivationModal");
          if (typeof audio?.playTap === "function") audio.playTap();
          return;
        }
        const bonus = 0.5;
        if (typeof state.addCrypto === "function") state.addCrypto(bonus);
        else state.crypto = (state.crypto || 0) + bonus;
        this.addTrauma(0.25);
        this.particles.spawnGasPuff(flareSc.x, flareSc.y - 65 * z, 12);
        this.particles.spawnFloatingText(flareSc.x, flareSc.y - 55 * z, `🔥 ПРОДУВКА! +${bonus} ⚡`, "#f59e0b", true);
        if (typeof audio?.playBoost === "function") audio.playBoost();
        return;
      }
    }

    // 8. Check Expansion Territories Click (East Sector & North Sector)
    const z = this.camera.zoom;
    const eastCenter = this.gridToScreen(19.5, 5.0);
    if (Math.hypot(sx - eastCenter.x, sy - eastCenter.y) <= (65 * z)) {
      const unlocked = state.isTerritoryUnlocked ? state.isTerritoryUnlocked("east_achim") : false;
      if (!unlocked) {
        this.addTrauma(0.15);
        this.particles.spawnFloatingText(eastCenter.x, eastCenter.y - 45 * z, "🔒 ТРЕБУЕТСЯ ВЫХОД НА IPO!", "#f59e0b", true);
        if (typeof audio?.playTap === "function") audio.playTap();
      } else {
        this.particles.spawnFloatingText(eastCenter.x, eastCenter.y - 45 * z, "✓ ВОСТОЧНЫЙ УЧАСТОК РАЗВЕДАН!", "#4ade80", true);
      }
      return;
    }

    const northCenter = this.gridToScreen(5.0, -6.0);
    if (Math.hypot(sx - northCenter.x, sy - northCenter.y) <= (65 * z)) {
      const unlocked = state.isTerritoryUnlocked ? state.isTerritoryUnlocked("north_shelf") : false;
      if (!unlocked) {
        this.addTrauma(0.15);
        this.particles.spawnFloatingText(northCenter.x, northCenter.y - 45 * z, "🔒 ТРЕБУЕТСЯ КОРПОРАТИВНЫЙ ТИР 2!", "#38bdf8", true);
        if (typeof audio?.playTap === "function") audio.playTap();
      } else {
        this.particles.spawnFloatingText(northCenter.x, northCenter.y - 45 * z, "✓ СЕВЕРНЫЙ ШЕЛЬФ РАЗВЕДАН!", "#4ade80", true);
      }
      return;
    }

    // Tapping on empty ground: close any open bottom sheets
    state.emit("closeAllBottomSheets");

    // 9. Default Tap Harvest
    const earned = state.handleTap(sx, sy);
    if (earned <= 0) return;

    this.tapSurge = Math.min(this.tapSurge + 0.6, 3.5);
    const boosted = state.boost.active;
    const burst = state.fountainBurst?.active;

    if (state.specialization === "gas") {
      this.particles.spawnGasPuff(sx, sy, boosted ? 10 : 6);
      this.particles.spawnFloatingText(sx, sy, `+${Math.round(earned)} ₽`, "#38bdf8", boosted);
    } else if (burst) {
      this.addTrauma(0.35);
      this.particles.spawnOilSplatter(sx, sy, 14, true);
      this.particles.spawnFloatingText(sx, sy, `💥+${Math.round(earned)} ₽`, "#fbbf24", true);
    } else {
      const isOil = state.specialization === "oil";
      this.particles.spawnOilSplatter(sx, sy, boosted ? 14 : (isOil ? 10 : 7), boosted || isOil);
      this.particles.spawnFloatingText(
        sx,
        sy,
        `+${Math.round(earned)} ₽`,
        boosted ? "#f59e0b" : (isOil ? "#fbbf24" : "#38bdf8"),
        boosted
      );
    }
  }

  // --- UPDATE LOOP ---

  update(dt) {
    if (dt <= 0) return;

    if (this.is3D && this.engine3D) {
      this.engine3D.update(dt);
    }

    const speed = (1.6 + this.tapSurge) * (state.boost.active ? 1.8 : 1.0);
    this.animTime += dt * speed;
    this.tapSurge = Math.max(0, this.tapSurge - dt * 2.0);

    // Decay trauma for smooth screen shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    }

    // Camera physics & smooth focus interpolation (Phase 12)
    if (this.camera.isFocusing) {
      const lerpSpeed = Math.min(1.0, dt * 5.5);
      this.camera.x += (this.camera.targetX - this.camera.x) * lerpSpeed;
      this.camera.y += (this.camera.targetY - this.camera.y) * lerpSpeed;
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * lerpSpeed;
      if (Math.hypot(this.camera.targetX - this.camera.x, this.camera.targetY - this.camera.y) < 1.0 &&
          Math.abs(this.camera.targetZoom - this.camera.zoom) < 0.005) {
        this.camera.x = this.camera.targetX;
        this.camera.y = this.camera.targetY;
        this.camera.zoom = this.camera.targetZoom;
        this.camera.isFocusing = false;
      }
    } else if (!this.isDragging) {
      this.camera.x += this.camera.vx * dt * 45;
      this.camera.y += this.camera.vy * dt * 45;
      this.camera.vx *= 0.91;
      this.camera.vy *= 0.91;
    }

    // Soft clamp camera within world boundaries
    const maxBound = 650;
    this.camera.x = Math.max(-maxBound, Math.min(maxBound, this.camera.x));
    this.camera.y = Math.max(-100, Math.min(maxBound + 200, this.camera.y));

    // Update Savelich
    this.savelich.update(dt);

    // Update Worker Crowd & Emoji Bubbles
    this.workerPool.update(dt);

    // Update Tanker Logistics
    this.tankerPool.update(dt, this.workerPool.emojiPool);

    // Update MCHS Emergency Truck (Phase 4)
    this.mchsTruck.update(dt, this.particles);

    // Update Service Delivery & Maintenance Vehicles (Phase 11)
    if (this.serviceVehicles) {
      this.serviceVehicles.update(dt, this.particles);
    }

    // Update Arctic 6x6 TREKOL Rover Maintenance Life (Milestone 2)
    if (this.trekolRover) {
      this.trekolRover.update(dt, state);
    }

    // Barrier Gatehouse auto-open for MCHS truck
    if (this.mchsTruck.active && this.mchsTruck.gx >= 0.3 && this.mchsTruck.gx <= 1.8) {
      this.tankerPool.isBarrierOpen = true;
      this.tankerPool.barrierAngle = Math.min(1.0, this.tankerPool.barrierAngle + dt * 8);
    }

    // Update Particles
    this.particles.update();

    // Update Falling Snowflakes (Zero-GC, Phase 6)
    if (this.snowflakes) {
      for (let i = 0; i < 65; i++) {
        const f = this.snowflakes[i];
        f.x += f.vx * dt * 60;
        f.y += f.vy * dt * 60;
        if (f.y > this.height + 15) {
          f.y = -12;
          f.x = Math.random() * (this.width + 120);
        }
        if (f.x < -20) {
          f.x = this.width + 15;
        }
      }
    }

    // Update Valve Tuning Mini-Game
    if (this.valveMiniGame) {
      if (this.valveMiniGame.cooldownTimer > 0) {
        this.valveMiniGame.cooldownTimer = Math.max(0, this.valveMiniGame.cooldownTimer - dt);
      }
      if (this.valveMiniGame.active) {
        const pSin = Math.sin(this.animTime * this.valveMiniGame.needleSpeed);
        this.valveMiniGame.pressure = 100 + pSin * 85;
      }
    }

    // Update Corporate IPO Celebration Banner (Phase 7)
    if (this.celebrationBanner && this.celebrationBanner.timer > 0) {
      this.celebrationBanner.timer = Math.max(0, this.celebrationBanner.timer - dt);
    }
  }

  // --- RENDER PIPELINE ---

  render() {
    if (this.is3D && this.engine3D) {
      this.engine3D.render();
      return;
    }

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // 1. Screen Shake Transform (Visual only, trauma^2)
    if (this.trauma > 0.01) {
      const shake = this.trauma * this.trauma;
      const offX = this.maxShakeOffset * shake * Math.sin(this.animTime * 34);
      const offY = this.maxShakeOffset * shake * Math.cos(this.animTime * 42);
      ctx.translate(offX, offY);
    }

    // 2. Polar Dawn Sky with Aurora Borealis
    this.drawSkyAndAurora(ctx, w, h);

    // 3. Ground Foundation (3D Extruded Permafrost Slab) & Terrain Grid
    this.drawPermafrostFoundation(ctx);
    this.drawIsometricTerrain(ctx);

    // Expansion Territories (Adjacent Locked Sectors with 3D Padlocks, Issue 9)
    this.drawExpansionTerritories(ctx);

    // Pipelines, Snowdrifts & Industrial Fences (Phase 6)
    this.drawPipelines(ctx);
    this.drawSnowdrifts(ctx);
    this.drawIndustrialFencing(ctx);

    // 4. Ground Oil Spill & Rainbow Sheen (Phase 4)
    this.drawOilSpill(ctx);

    // 5. Depth-Sorted World Entities (Buildings, Pumpjacks, Savelich, Workers, MCHS)
    this.drawDepthSortedEntities(ctx);

    // 6. Floating Emoji Bubbles (Above heads)
    this.workerPool.drawBubbles(ctx);

    // 7. Particles & Floating Text Overlay
    this.particles.draw(ctx);

    // 8. Helicopter & Cargo Crate (If Active)
    if (state.helicopter && (state.helicopter.active || state.helicopter.crateDropped)) {
      this.drawHelicopter(ctx, w, h);
    }

    // 9. Interactive Valve Tuning Mini-Game Overlay (Phase 6)
    if (this.valveMiniGame && this.valveMiniGame.active) {
      this.drawValveMiniGame(ctx);
    }

    // 10. Real-Time Siberian Falling Snow (Zero-GC, Phase 6)
    this.drawSnowfall(ctx);

    // 11. Minimal Zoom & Pan Hint
    this.drawMapCompass(ctx, w, h);

    // 12. Corporate IPO Celebration Banner (Phase 7)
    if (this.celebrationBanner && this.celebrationBanner.timer > 0) {
      this.drawCelebrationBanner(ctx, w, h);
    }

    ctx.restore();
  }

  drawCelebrationBanner(ctx, w, h) {
    const b = this.celebrationBanner;
    if (!b || b.timer <= 0) return;
    const alpha = Math.min(1.0, b.timer * 2.0);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = Math.min(w * 0.92, 340);
    const bx = (w - bw) * 0.5;
    const by = 22;

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 46, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.text, w * 0.5, by + 18);

    ctx.fillStyle = "#93c5fd";
    ctx.font = "bold 10px -apple-system, sans-serif";
    ctx.fillText(b.subText, w * 0.5, by + 34);
    ctx.restore();
  }

  drawSkyAndAurora(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, "#04070e");
    sky.addColorStop(0.45, "#080e18");
    sky.addColorStop(0.85, "#101826");
    sky.addColorStop(1, "#182337");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Subtle, ethereal atmospheric northern twilight (restrained, Bauhaus/TE style)
    const t = this.animTime * 0.25;
    const auroras = [
      { y: h * 0.10, c1: "rgba(16, 185, 129, 0.10)", c2: "rgba(16, 185, 129, 0)" },
      { y: h * 0.16, c1: "rgba(56, 189, 248, 0.07)", c2: "rgba(56, 189, 248, 0)" }
    ];

    auroras.forEach(({ y, c1, c2 }, i) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w + 60; x += 60) {
        const wave = Math.sin(t + x * 0.005 + i) * 18 + Math.cos(t * 0.8 + x * 0.01) * 10;
        ctx.lineTo(x, y + wave);
      }
      ctx.lineTo(w, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();

      const g = ctx.createLinearGradient(0, y - 20, 0, y + 35);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fill();
    });
  }

  drawPermafrostFoundation(ctx) {
    ctx.save();
    const z = this.camera.zoom;
    const cliffDepth = 48 * z;

    // 1. South-West Cliff Face (Along gy = this.gridSize - 1, bottom-left border facing viewer)
    // Runs from gx = 0 to this.gridSize - 1
    for (let gx = 0; gx < this.gridSize; gx++) {
      const p = this.gridToScreen(gx, this.gridSize - 1);
      const x1 = p.x - HALF_W * z;
      const y1 = p.y;
      const x2 = p.x;
      const y2 = p.y + HALF_H * z;

      // Frustum check
      if (Math.max(x1, x2) < -80 || Math.min(x1, x2) > this.width + 80) continue;

      // Slab polygon
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 + cliffDepth);
      ctx.lineTo(x1, y1 + cliffDepth);
      ctx.closePath();

      // Architectural titanium & matte basalt gradient
      const grad = ctx.createLinearGradient(x1, y1, x1, y1 + cliffDepth);
      grad.addColorStop(0, "#1a2333");
      grad.addColorStop(0.35, "#101622");
      grad.addColorStop(0.8, "#090d14");
      grad.addColorStop(1, "#03060a");
      ctx.fillStyle = grad;
      ctx.fill();

      // Precision horizontal laser scores
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cliffDepth * 0.35);
      ctx.lineTo(x2, y2 + cliffDepth * 0.35);
      ctx.moveTo(x1, y1 + cliffDepth * 0.65);
      ctx.lineTo(x2, y2 + cliffDepth * 0.65);
      ctx.stroke();

      // Subtle cyan frost line
      if ((gx % 3) === 0) {
        ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x1 + (x2 - x1) * 0.2, y1 + (y2 - y1) * 0.2 + cliffDepth * 0.45);
        ctx.lineTo(x1 + (x2 - x1) * 0.8, y1 + (y2 - y1) * 0.8 + cliffDepth * 0.52);
        ctx.stroke();
      }

      // Concrete curb / 1px laser chamfer
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 2. South-East Cliff Face (Along gx = this.gridSize - 1, bottom-right border facing viewer)
    // Runs from gy = this.gridSize - 1 down to 0
    for (let gy = this.gridSize - 1; gy >= 0; gy--) {
      const p = this.gridToScreen(this.gridSize - 1, gy);
      const x1 = p.x;
      const y1 = p.y + HALF_H * z;
      const x2 = p.x + HALF_W * z;
      const y2 = p.y;

      // Frustum check
      if (Math.max(x1, x2) < -80 || Math.min(x1, x2) > this.width + 80) continue;

      // Slab polygon
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 + cliffDepth);
      ctx.lineTo(x1, y1 + cliffDepth);
      ctx.closePath();

      // Shaded eastern face
      const grad = ctx.createLinearGradient(x1, y1, x1, y1 + cliffDepth);
      grad.addColorStop(0, "#101723");
      grad.addColorStop(0.4, "#090d14");
      grad.addColorStop(0.85, "#04070c");
      grad.addColorStop(1, "#020408");
      ctx.fillStyle = grad;
      ctx.fill();

      // Strata lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cliffDepth * 0.4);
      ctx.lineTo(x2, y2 + cliffDepth * 0.4);
      ctx.moveTo(x1, y1 + cliffDepth * 0.7);
      ctx.lineTo(x2, y2 + cliffDepth * 0.7);
      ctx.stroke();

      // Concrete curb / 1px laser chamfer
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 3. Foundation drop shadow underneath (diffuse studio lighting)
    const pSouth = this.gridToScreen(this.gridSize - 1, this.gridSize - 1);
    const pWest = this.gridToScreen(0, this.gridSize - 1);
    const pEast = this.gridToScreen(this.gridSize - 1, 0);

    ctx.fillStyle = "rgba(2, 4, 8, 0.65)";
    ctx.beginPath();
    ctx.moveTo(pWest.x - HALF_W * z, pWest.y + cliffDepth);
    ctx.lineTo(pSouth.x, pSouth.y + HALF_H * z + cliffDepth);
    ctx.lineTo(pEast.x + HALF_W * z, pEast.y + cliffDepth);
    ctx.lineTo(pSouth.x, pSouth.y + HALF_H * z + cliffDepth + 22 * z);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawIsometricTerrain(ctx) {
    ctx.save();
    const z = this.camera.zoom;

    // Loop through grid tiles (0..gridSize, bounded firmly on 14x14 platform)
    for (let gx = 0; gx < this.gridSize; gx++) {
      for (let gy = 0; gy < this.gridSize; gy++) {
        const p = this.gridToScreen(gx, gy);

        // Frustum Culling
        if (p.x < -120 || p.x > this.width + 120 || p.y < -120 || p.y > this.height + 120) {
          continue;
        }

        const isRoad = this.isRoadTile(gx, gy);
        const isClusterPlat = this.isClusterPlatform(gx, gy);

        // Tile base polygon
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - HALF_H * z);
        ctx.lineTo(p.x + HALF_W * z, p.y);
        ctx.lineTo(p.x, p.y + HALF_H * z);
        ctx.lineTo(p.x - HALF_W * z, p.y);
        ctx.closePath();

        const isCorp = Boolean(state?.isCorporateEmpire);

        if (isClusterPlat) {
          // Architectural Reinforced Concrete Pad (Matte dark anodized plate)
          ctx.fillStyle = isCorp ? "#111827" : "#141c2b";
          ctx.fill();
          ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Minimalist pad corner marks
          ctx.fillStyle = isCorp ? "#fbbf24" : "#ea580c";
          ctx.fillRect(p.x - 1, p.y - HALF_H * z + 2, 2, 2);
          ctx.fillRect(p.x - 1, p.y + HALF_H * z - 4, 2, 2);
        } else if (isRoad) {
          // Dark Graphite / Basalt Paved Road
          ctx.fillStyle = isCorp ? "#0b0f19" : "#111724";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Minimalist Centerline dashes
          ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.35)";
          ctx.lineWidth = 1.0 * z;
          ctx.setLineDash([4 * z, 4 * z]);
          ctx.beginPath();
          ctx.moveTo(p.x - HALF_W * 0.45 * z, p.y);
          ctx.lineTo(p.x + HALF_W * 0.45 * z, p.y);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Matte Permafrost Slate Terrain (Sleek minimalist dark tone)
          const noise = Math.sin(gx * 3.7 + gy * 7.1);
          if (noise > 0.45) {
            ctx.fillStyle = "#1e293b"; // Subtle frozen crust
          } else if (noise > 0.0) {
            ctx.fillStyle = "#111827"; // Deep matte slate
          } else {
            ctx.fillStyle = "#0c131f"; // Obsidian turf
          }
          ctx.fill();

          // Minimalist hairline grid seams
          ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
          ctx.lineWidth = 0.5;
          ctx.stroke();

          // Subtle dot matrix marker at center of selected tiles
          if ((gx + gy) % 4 === 0) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
            ctx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
          }
        }
      }
    }

    ctx.restore();
  }

  drawExpansionTerritories(ctx) {
    ctx.save();
    const z = this.camera.zoom;
    const cliffDepth = 36 * z;

    // Territory 1: East Sector (Ачимовский кластер, Phase 12 spaced with chasm)
    // Bounds: gx: 17..22, gy: 2..8 (Gap of 3 tiles from main 14x14 platform)
    const eastUnlocked = state.isTerritoryUnlocked ? state.isTerritoryUnlocked("east_achim") : false;

    // 1A. East Foundation Slab (South-West Face: gy = 8, gx: 17..22)
    for (let gx = 17; gx <= 22; gx++) {
      const p = this.gridToScreen(gx, 8);
      const x1 = p.x - HALF_W * z;
      const y1 = p.y;
      const x2 = p.x;
      const y2 = p.y + HALF_H * z;
      if (Math.max(x1, x2) >= -80 && Math.min(x1, x2) <= this.width + 80) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 + cliffDepth);
        ctx.lineTo(x1, y1 + cliffDepth);
        ctx.closePath();
        const grad = ctx.createLinearGradient(x1, y1, x1, y1 + cliffDepth);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#020617");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 1B. East Foundation Slab (South-East Face: gx = 22, gy: 8 down to 2)
    for (let gy = 8; gy >= 2; gy--) {
      const p = this.gridToScreen(22, gy);
      const x1 = p.x;
      const y1 = p.y + HALF_H * z;
      const x2 = p.x + HALF_W * z;
      const y2 = p.y;
      if (Math.max(x1, x2) >= -80 && Math.min(x1, x2) <= this.width + 80) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 + cliffDepth);
        ctx.lineTo(x1, y1 + cliffDepth);
        ctx.closePath();
        const grad = ctx.createLinearGradient(x1, y1, x1, y1 + cliffDepth);
        grad.addColorStop(0, "#0f172a");
        grad.addColorStop(1, "#020617");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 1C. East Ground Tiles
    for (let gx = 17; gx <= 22; gx++) {
      for (let gy = 2; gy <= 8; gy++) {
        const p = this.gridToScreen(gx, gy);
        if (p.x < -60 || p.x > this.width + 60 || p.y < -60 || p.y > this.height + 60) continue;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - HALF_H * z);
        ctx.lineTo(p.x + HALF_W * z, p.y);
        ctx.lineTo(p.x, p.y + HALF_H * z);
        ctx.lineTo(p.x - HALF_W * z, p.y);
        ctx.closePath();
        ctx.fillStyle = ((gx + gy) % 2 === 0) ? "#334155" : "#1e293b";
        ctx.fill();
        ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // 1D. East Pipeline Utility Bridge Crossing (gx: 14 -> 17 at gy: 5)
    const b1Start = this.gridToScreen(14, 5);
    const b1End = this.gridToScreen(17, 5);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3.5 * z;
    ctx.beginPath();
    ctx.moveTo(b1Start.x, b1Start.y - 6 * z);
    ctx.lineTo(b1End.x, b1End.y - 6 * z);
    ctx.stroke();
    // Yellow gas pipe across bridge
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(b1Start.x, b1Start.y - 8 * z);
    ctx.lineTo(b1End.x, b1End.y - 8 * z);
    ctx.stroke();

    // 1E. East Floating Lock & Plaque (At center gx = 19.5, gy = 5.0)
    const eastSc = this.gridToScreen(19.5, 5.0);
    const bounce1 = Math.sin(this.animTime * 3) * (4 * z);
    const lockY1 = eastSc.y - 20 * z + bounce1;

    // Glowing Lock Symbol
    ctx.fillStyle = eastUnlocked ? "#10b981" : "#ea580c";
    ctx.font = `bold ${Math.round(20 * z)}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(eastUnlocked ? "🔓" : "🔒", eastSc.x, lockY1);

    // Overhead Info Plaque (Frosted Glass Card)
    ctx.fillStyle = "rgba(17, 23, 35, 0.9)";
    ctx.strokeStyle = eastUnlocked ? "#10b981" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(eastSc.x - 62 * z, lockY1 - 36 * z, 124 * z, 24 * z, 4 * z);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(6.5, Math.round(7.5 * z))}px 'JetBrains Mono', monospace, sans-serif`;
    ctx.fillText("ВОСТОЧНЫЙ УЧАСТОК", eastSc.x, lockY1 - 29 * z);

    ctx.fillStyle = eastUnlocked ? "#34d399" : "#ea580c";
    ctx.font = `bold ${Math.max(5.5, Math.round(6.5 * z))}px 'JetBrains Mono', monospace, sans-serif`;
    ctx.fillText(eastUnlocked ? "✓ РАЗВЕДАН • ДОСТУПЕН" : "ТРЕБУЕТСЯ: ВЫХОД НА IPO", eastSc.x, lockY1 - 19 * z);


    // Territory 2: North Sector (Северный шельф, Phase 12 spaced with chasm)
    // Bounds: gx: 2..8, gy: -9..-3 (Gap of 3 tiles from main 14x14 platform gy: 0)
    const northUnlocked = state.isTerritoryUnlocked ? state.isTerritoryUnlocked("north_shelf") : false;

    // 2A. North Foundation Slab (South-West Face: gy = -3, gx: 2..8)
    for (let gx = 2; gx <= 8; gx++) {
      const p = this.gridToScreen(gx, -3);
      const x1 = p.x - HALF_W * z;
      const y1 = p.y;
      const x2 = p.x;
      const y2 = p.y + HALF_H * z;
      if (Math.max(x1, x2) >= -80 && Math.min(x1, x2) <= this.width + 80) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 + cliffDepth);
        ctx.lineTo(x1, y1 + cliffDepth);
        ctx.closePath();
        const grad = ctx.createLinearGradient(x1, y1, x1, y1 + cliffDepth);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#020617");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 2B. North Foundation Slab (South-East Face: gx = 8, gy: -3 down to -9)
    for (let gy = -3; gy >= -9; gy--) {
      const p = this.gridToScreen(8, gy);
      const x1 = p.x;
      const y1 = p.y + HALF_H * z;
      const x2 = p.x + HALF_W * z;
      const y2 = p.y;
      if (Math.max(x1, x2) >= -80 && Math.min(x1, x2) <= this.width + 80) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 + cliffDepth);
        ctx.lineTo(x1, y1 + cliffDepth);
        ctx.closePath();
        const grad = ctx.createLinearGradient(x1, y1, x1, y1 + cliffDepth);
        grad.addColorStop(0, "#0f172a");
        grad.addColorStop(1, "#020617");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 2C. North Ground Tiles
    for (let gx = 2; gx <= 8; gx++) {
      for (let gy = -9; gy <= -3; gy++) {
        const p = this.gridToScreen(gx, gy);
        if (p.x < -60 || p.x > this.width + 60 || p.y < -60 || p.y > this.height + 60) continue;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - HALF_H * z);
        ctx.lineTo(p.x + HALF_W * z, p.y);
        ctx.lineTo(p.x, p.y + HALF_H * z);
        ctx.lineTo(p.x - HALF_W * z, p.y);
        ctx.closePath();
        ctx.fillStyle = ((gx + gy) % 2 === 0) ? "#1a2436" : "#111827";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // 2D. North Pipeline Utility Bridge Crossing (gy: 0 -> -3 at gx: 5)
    const b2Start = this.gridToScreen(5, 0);
    const b2End = this.gridToScreen(5, -3);
    ctx.strokeStyle = "#161f2e";
    ctx.lineWidth = 3.5 * z;
    ctx.beginPath();
    ctx.moveTo(b2Start.x, b2Start.y - 6 * z);
    ctx.lineTo(b2End.x, b2End.y - 6 * z);
    ctx.stroke();
    // Orange pipeline across bridge
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(b2Start.x, b2Start.y - 8 * z);
    ctx.lineTo(b2End.x, b2End.y - 8 * z);
    ctx.stroke();

    // 2E. North Floating Lock & Plaque (At center gx = 5.0, gy = -6.0)
    const northSc = this.gridToScreen(5.0, -6.0);
    const bounce2 = Math.cos(this.animTime * 3) * (4 * z);
    const lockY2 = northSc.y - 20 * z + bounce2;

    ctx.fillStyle = northUnlocked ? "#10b981" : "#ea580c";
    ctx.font = `bold ${Math.round(20 * z)}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(northUnlocked ? "🔓" : "🔒", northSc.x, lockY2);

    ctx.fillStyle = "rgba(17, 23, 35, 0.9)";
    ctx.strokeStyle = northUnlocked ? "#10b981" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(northSc.x - 62 * z, lockY2 - 36 * z, 124 * z, 24 * z, 4 * z);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(6.5, Math.round(7.5 * z))}px 'JetBrains Mono', monospace, sans-serif`;
    ctx.fillText("СЕВЕРНЫЙ ШЕЛЬФ", northSc.x, lockY2 - 29 * z);

    ctx.fillStyle = northUnlocked ? "#34d399" : "#ea580c";
    ctx.font = `bold ${Math.max(5.5, Math.round(6.5 * z))}px 'JetBrains Mono', monospace, sans-serif`;
    ctx.fillText(northUnlocked ? "✓ РАЗВЕДАН • ДОСТУПЕН" : "ТРЕБУЕТСЯ: ТИР 2 ХОЛДИНГА", northSc.x, lockY2 - 19 * z);

    ctx.restore();
  }

  isRoadTile(gx, gy) {
    // Highway approach from beyond the gatehouse (Phase 6)
    if (gx < 2 && (gy === 5 || gy === 6)) return true;
    if (gy === 6 && gx >= 2 && gx <= 10) return true;
    if (gx === 6 && gy >= 3 && gy <= 9) return true;
    if (gx === 4 && gy >= 6 && gy <= 8) return true;
    if (gx === 5 && gy >= 6 && gy <= 8) return true;
    if (gx === 3 && gy >= 3 && gy <= 8) return true;
    if (gx === 8 && gy >= 3 && gy <= 10) return true;
    return false;
  }

  isClusterPlatform(gx, gy) {
    return (
      (Math.abs(gx - 2.5) < 1.0 && Math.abs(gy - 2.5) < 1.0) ||
      (Math.abs(gx - 11.5) < 1.0 && Math.abs(gy - 2.5) < 1.0) ||
      (Math.abs(gx - 11.5) < 1.0 && Math.abs(gy - 8.5) < 1.0) ||
      (Math.abs(gx - 9.5) < 1.0 && Math.abs(gy - 11.5) < 1.0) ||
      (Math.abs(gx - 6.5) < 1.8 && Math.abs(gy - 6.5) < 1.8)
    );
  }

  // --- INDUSTRIAL OILFIELD ENVIRONMENT (Phase 6 & 12) ---

  drawPipelines(ctx) {
    // Pipeline trestles connecting well pads to the mega gas processing plant at (6.5, 6.5)
    this.drawPipelineSegment(ctx, 2.5, 2.5, 5.2, 5.2);   // Well 1 -> Mega Plant NW corner
    this.drawPipelineSegment(ctx, 11.5, 2.5, 7.8, 5.2);  // Well 2 -> Mega Plant NE corner
    this.drawPipelineSegment(ctx, 11.5, 8.5, 7.8, 7.2);  // Well 3 -> Mega Plant SE corner
    this.drawPipelineSegment(ctx, 9.5, 11.5, 7.2, 7.8);  // Well 4 -> Mega Plant S corner
    this.drawPipelineSegment(ctx, 7.8, 7.8, 12.0, 11.5); // Mega Plant -> Crypto Flare Stack
  }

  drawPipelineSegment(ctx, gx1, gy1, gx2, gy2) {
    const steps = 3;
    const z = this.camera.zoom;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const gx = gx1 + (gx2 - gx1) * t;
      const gy = gy1 + (gy2 - gy1) * t;
      const pGround = this.gridToScreen(gx, gy, 0);
      const pPipe = this.gridToScreen(gx, gy, 12);

      // Support post: architectural dark anodized titanium pier
      ctx.fillStyle = "#111723";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.fillRect(pPipe.x - 2, pPipe.y, 4, pGround.y - pPipe.y);
      ctx.strokeRect(pPipe.x - 2, pPipe.y, 4, pGround.y - pPipe.y);

      // Foundation foot
      ctx.fillStyle = "#1a2233";
      ctx.fillRect(pGround.x - 4, pGround.y - 2, 8, 4);
    }

    const pStart = this.gridToScreen(gx1, gy1, 12);
    const pEnd = this.gridToScreen(gx2, gy2, 12);

    // Main line: Brushed dark graphite with satin highlight
    ctx.strokeStyle = "#161f2e";
    ctx.lineWidth = 3.8 * z;
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1.0 * z;
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y - 1.2);
    ctx.lineTo(pEnd.x, pEnd.y - 1.2);
    ctx.stroke();

    // Gas line with Teenage Engineering Orange accent
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y + 3);
    ctx.lineTo(pEnd.x, pEnd.y + 3);
    ctx.stroke();
  }

  drawSnowdrifts(ctx) {
    // Soft pillowed white mounds along building corners and roadside berms
    const drifts = [
      { gx: 2.8, gy: 2.8, rx: 18, ry: 9 },
      { gx: 4.2, gy: 2.6, rx: 22, ry: 10 },
      { gx: 7.8, gy: 2.3, rx: 20, ry: 9 },
      { gx: 9.2, gy: 3.8, rx: 24, ry: 11 },
      { gx: 5.2, gy: 5.2, rx: 26, ry: 12 },
      { gx: 6.8, gy: 7.0, rx: 25, ry: 12 },
      { gx: 1.0, gy: 4.8, rx: 20, ry: 10 },
      { gx: 1.8, gy: 6.5, rx: 22, ry: 10 },
      { gx: -1.5, gy: 4.8, rx: 28, ry: 12 },
      { gx: -2.8, gy: 6.8, rx: 32, ry: 14 }
    ];

    ctx.save();
    for (let i = 0; i < drifts.length; i++) {
      const d = drifts[i];
      const p = this.gridToScreen(d.gx, d.gy, 0);
      if (p.x < -60 || p.x > this.width + 60 || p.y < -60 || p.y > this.height + 60) continue;

      // Soft underside shadow
      ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 2, d.rx * this.camera.zoom, d.ry * this.camera.zoom, 0, 0, PI2);
      ctx.fill();

      // Pillowed white snow crust
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, (d.rx - 2) * this.camera.zoom, (d.ry - 2) * this.camera.zoom, 0, 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawIndustrialFencing(ctx) {
    // 1. Full Security Perimeter Fence around 14x14 Territory (Issue 7)
    // Road enters at gx: 0.5, gy: 4.8 .. 6.2 through gatehouse КПП arch
    const perimeter = [
      // Top-Left (NW) boundary
      { gx1: 0.5, gy1: 0.5, gx2: 4.5, gy2: 0.5, sign: false },
      { gx1: 4.5, gy1: 0.5, gx2: 9.0, gy2: 0.5, sign: true },
      { gx1: 9.0, gy1: 0.5, gx2: 13.5, gy2: 0.5, sign: false },
      // Top-Right (NE) boundary
      { gx1: 13.5, gy1: 0.5, gx2: 13.5, gy2: 4.5, sign: false },
      { gx1: 13.5, gy1: 4.5, gx2: 13.5, gy2: 9.0, sign: true },
      { gx1: 13.5, gy1: 9.0, gx2: 13.5, gy2: 13.5, sign: false },
      // Bottom-Right (SE) boundary
      { gx1: 13.5, gy1: 13.5, gx2: 9.0, gy2: 13.5, sign: false },
      { gx1: 9.0, gy1: 13.5, gx2: 4.5, gy2: 13.5, sign: true },
      { gx1: 4.5, gy1: 13.5, gx2: 0.5, gy2: 13.5, sign: false },
      // Bottom-Left (SW) boundary - Lower wing (gy: 13.5 -> 6.5)
      { gx1: 0.5, gy1: 13.5, gx2: 0.5, gy2: 9.5, sign: false },
      { gx1: 0.5, gy1: 9.5, gx2: 0.5, gy2: 6.5, sign: true },
      // Bottom-Left (SW) boundary - Upper wing (gy: 4.5 -> 0.5)
      { gx1: 0.5, gy1: 4.5, gx2: 0.5, gy2: 2.5, sign: true },
      { gx1: 0.5, gy1: 2.5, gx2: 0.5, gy2: 0.5, sign: false },
      // Inner security barriers around operational clusters
      { gx1: 1.5, gy1: 4.5, gx2: 1.5, gy2: 2.8, sign: false },
      { gx1: 1.5, gy1: 2.8, gx2: 4.8, gy2: 2.8, sign: true },
      { gx1: 7.2, gy1: 2.2, gx2: 9.8, gy2: 2.2, sign: false },
      { gx1: 9.8, gy1: 2.2, gx2: 9.8, gy2: 4.2, sign: true }
    ];

    const z = this.camera.zoom;
    ctx.save();
    for (let i = 0; i < perimeter.length; i++) {
      const f = perimeter[i];
      const p1 = this.gridToScreen(f.gx1, f.gy1, 0);
      const p2 = this.gridToScreen(f.gx2, f.gy2, 0);

      // Frustum culling
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y) - 20 * z;
      const maxY = Math.max(p1.y, p2.y);
      if (maxX < -50 || minX > this.width + 50 || maxY < -50 || minY > this.height + 50) continue;

      // Steel fence posts with concrete footings
      ctx.fillStyle = "#334155";
      ctx.fillRect(p1.x - 1.5, p1.y - 15 * z, 3, 15 * z);
      ctx.fillRect(p2.x - 1.5, p2.y - 15 * z, 3, 15 * z);

      // Intermediate post
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5;
      ctx.fillRect(midX - 1.2, midY - 15 * z, 2.4, 15 * z);

      // 3 Tension wire rails
      ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
      ctx.lineWidth = Math.max(0.8, 1.0 * z);
      ctx.beginPath();
      // Upper rail
      ctx.moveTo(p1.x, p1.y - 13 * z);
      ctx.lineTo(p2.x, p2.y - 13 * z);
      // Middle rail
      ctx.moveTo(p1.x, p1.y - 8 * z);
      ctx.lineTo(p2.x, p2.y - 8 * z);
      // Bottom rail
      ctx.moveTo(p1.x, p1.y - 2 * z);
      ctx.lineTo(p2.x, p2.y - 2 * z);
      ctx.stroke();

      // Steel Chain-Link Mesh Netting (Сетка-рабица между столбами, Issue 5)
      const meshSegs = 10;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.42)";
      ctx.lineWidth = Math.max(0.6, 0.75 * z);
      ctx.beginPath();
      for (let s = 0; s < meshSegs; s++) {
        const t1 = s / meshSegs;
        const t2 = (s + 1) / meshSegs;
        const x1Seg = p1.x + (p2.x - p1.x) * t1;
        const y1Seg = p1.y + (p2.y - p1.y) * t1;
        const x2Seg = p1.x + (p2.x - p1.x) * t2;
        const y2Seg = p1.y + (p2.y - p1.y) * t2;
        ctx.moveTo(x1Seg, y1Seg - 13 * z);
        ctx.lineTo(x2Seg, y2Seg - 2 * z);
        ctx.moveTo(x1Seg, y1Seg - 2 * z);
        ctx.lineTo(x2Seg, y2Seg - 13 * z);
      }
      ctx.stroke();

      // Top Razor / Barbed wire coil
      ctx.strokeStyle = "rgba(226, 232, 240, 0.85)";
      ctx.lineWidth = Math.max(0.7, 0.9 * z);
      ctx.setLineDash([3 * z, 3 * z]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y - 15 * z);
      ctx.lineTo(p2.x, p2.y - 15 * z);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hazard Warning Placard
      if (f.sign) {
        ctx.save();
        ctx.translate(midX, midY - 9 * z);
        ctx.fillStyle = "#eab308";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-7 * z, -3.5 * z, 14 * z, 7 * z, 1.5);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawSnowfall(ctx) {
    if (!this.snowflakes) return;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 65; i++) {
      const f = this.snowflakes[i];
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawOilSpill(ctx) {
    if (!state.accident || !state.accident.active) return;

    const targetWellId = state.accident.targetWellId || state.activeWellId || "well_1";
    const struct = this.structures.find(s => s.id === targetWellId) || this.structures[0];
    const sc = this.gridToScreen(struct.gx, struct.gy);

    // Frustum culling
    if (sc.x < -120 || sc.x > this.width + 120 || sc.y < -120 || sc.y > this.height + 120) {
      return;
    }

    const qte = state.accident.qteProgress || 0;
    const progressRemaining = Math.max(0.08, 1.0 - qte);
    const baseRadius = (30 + progressRemaining * 28) * this.camera.zoom;
    const pulse = Math.sin(this.animTime * 4.5) * (2.2 * this.camera.zoom);
    const z = this.camera.zoom;
    const isGas = state.specialization === "gas";

    ctx.save();
    ctx.translate(sc.x, sc.y);

    if (isGas) {
      // --- GAS SPECIALIZATION: HIGH-PRESSURE METHANE LEAK & JOULE-THOMSON CRYOGENIC FROST (Issue 13) ---
      // 1. Cryogenic Ice Frost Halo on Snow
      ctx.beginPath();
      const lobes = 8;
      for (let i = 0; i <= lobes; i++) {
        const angle = (i / lobes) * PI2;
        const wave = Math.sin(angle * 4 + this.animTime * 3) * (3.5 * z);
        const rX = baseRadius + pulse + wave;
        const rY = (baseRadius * 0.5 + pulse * 0.5 + wave * 0.5);
        const px = Math.cos(angle) * rX;
        const py = Math.sin(angle) * rY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const frostGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, baseRadius);
      frostGrad.addColorStop(0, "rgba(240, 249, 255, 0.95)");
      frostGrad.addColorStop(0.4, "rgba(186, 230, 253, 0.85)");
      frostGrad.addColorStop(0.8, "rgba(125, 211, 252, 0.45)");
      frostGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = frostGrad;
      ctx.fill();

      // Ice fracture fissures
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = Math.max(1, 1.4 * z);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * PI2 + 0.15;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * baseRadius * 0.85, Math.sin(ang) * (baseRadius * 0.42));
        ctx.stroke();
      }

      // Billowing cold white methane gas clouds (Cryogenic expansion)
      for (let c = 0; c < 5; c++) {
        const puffY = -14 * z - c * (11 * z) - Math.sin(this.animTime * 5 + c) * (4 * z);
        const puffX = Math.sin(this.animTime * 3.5 + c * 2.2) * (12 * z);
        const puffR = (9 + c * 5) * z;
        ctx.fillStyle = `rgba(240, 249, 255, ${0.48 - c * 0.08})`;
        ctx.beginPath();
        ctx.arc(puffX, puffY, puffR, 0, PI2);
        ctx.fill();
      }

      // White icy perimeter ring
      ctx.strokeStyle = "rgba(224, 242, 254, 0.9)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 0, baseRadius * 0.96, baseRadius * 0.48, 0, 0, PI2);
      ctx.stroke();
      ctx.setLineDash([]);

      // In-World Prompt Badge (Methane Leak / Joule-Thomson)
      const badgeY = -baseRadius * 0.5 - 38 * z;
      const pctLeft = Math.round((1.0 - qte) * 100);

      ctx.fillStyle = "#0284c7";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-62 * z, badgeY - 9 * z, 124 * z, 18 * z, 9 * z);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(8.5 * z)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`❄️ МЕТАН! ЗАКРОЙ: ${pctLeft}%`, 0, badgeY + 1);

    } else {
      // --- OIL SPECIALIZATION: VISCOUS CRUDE OIL PUDDLE & SORBENT BOOM ---
      // 1. Amoeba Puddle Shape (Organic lobes in 2:1 isometric ratio)
      ctx.beginPath();
      const lobes = 8;
      for (let i = 0; i <= lobes; i++) {
        const angle = (i / lobes) * PI2;
        const wave = Math.sin(angle * 3 + this.animTime * 2.2) * (3.8 * z);
        const rX = baseRadius + pulse + wave;
        const rY = (baseRadius * 0.5 + pulse * 0.5 + wave * 0.5);
        const px = Math.cos(angle) * rX;
        const py = Math.sin(angle) * rY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Dark Viscous Crude Core
      const oilGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, baseRadius);
      oilGrad.addColorStop(0, "#090d16");
      oilGrad.addColorStop(0.7, "#0f172a");
      oilGrad.addColorStop(0.92, "#1e293b");
      oilGrad.addColorStop(1, "rgba(30, 41, 59, 0)");
      ctx.fillStyle = oilGrad;
      ctx.fill();

      // 2. Rainbow Thin-Film Hydrocarbon Interference Sheen
      ctx.save();
      ctx.clip();
      const sheenGrad = ctx.createLinearGradient(-baseRadius, -baseRadius * 0.5, baseRadius, baseRadius * 0.5);
      sheenGrad.addColorStop(0, "rgba(6, 182, 212, 0.38)");
      sheenGrad.addColorStop(0.35, "rgba(236, 72, 153, 0.32)");
      sheenGrad.addColorStop(0.7, "rgba(234, 179, 8, 0.36)");
      sheenGrad.addColorStop(1, "rgba(16, 185, 129, 0.28)");
      ctx.fillStyle = sheenGrad;
      ctx.fill();

      // Specular Highlight Arc
      ctx.strokeStyle = "rgba(241, 245, 249, 0.35)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, -baseRadius * 0.15, baseRadius * 0.55, baseRadius * 0.25, 0, Math.PI * 0.8, Math.PI * 1.6);
      ctx.stroke();

      // Gas bubbles popping on surface
      const bubbleOffX = Math.sin(this.animTime * 7) * (baseRadius * 0.4);
      const bubbleOffY = Math.cos(this.animTime * 5) * (baseRadius * 0.2);
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(bubbleOffX, bubbleOffY, 2.5 * z, 0, PI2);
      ctx.fill();
      ctx.restore();

      // 3. White Foamy Sorbent Rim
      ctx.strokeStyle = "rgba(248, 250, 252, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, baseRadius * 0.95, baseRadius * 0.48, 0, 0, PI2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. In-World QTE Tap Prompt Badge
      const badgeY = -baseRadius * 0.5 - 34 * z;
      const pctLeft = Math.round((1.0 - qte) * 100);

      ctx.fillStyle = "#dc2626";
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-52 * z, badgeY - 8 * z, 104 * z, 18 * z, 9 * z);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(8.5 * z)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`🚨 ТАП! ОСТАЛОСЬ: ${pctLeft}%`, 0, badgeY + 1);
    }

    ctx.restore();
  }

  drawDepthSortedEntities(ctx) {
    // 1. Build Render Queue
    this.renderQueue.length = 0;

    // Add structures
    for (let i = 0; i < this.structures.length; i++) {
      const s = this.structures[i];
      this.renderQueue.push({
        type: "structure",
        depth: s.gx + s.gy,
        entity: s
      });
    }

    // Add Savelich
    this.renderQueue.push({
      type: "savelich",
      depth: this.savelich.gx + this.savelich.gy,
      entity: this.savelich
    });

    // Add Active Workers from Pool
    for (let i = 0; i < this.workerPool.activeCount; i++) {
      const w = this.workerPool.workers[i];
      if (w.active) {
        this.renderQueue.push({
          type: "worker",
          depth: w.gx + w.gy,
          entity: w
        });
      }
    }

    // Add Active MCHS Emergency Truck (Phase 4)
    if (this.mchsTruck && this.mchsTruck.active) {
      this.renderQueue.push({
        type: "mchs_truck",
        depth: this.mchsTruck.gx + this.mchsTruck.gy,
        entity: this.mchsTruck
      });
    }

    // Add Active Service Delivery & Repair Vehicles (Phase 11)
    if (this.serviceVehicles) {
      for (let i = 0; i < this.serviceVehicles.vehicles.length; i++) {
        const v = this.serviceVehicles.vehicles[i];
        if (v.active) {
          this.renderQueue.push({
            type: "service_vehicle",
            depth: v.gx + v.gy,
            entity: v
          });
        }
      }
    }

    // Sort by depth (from back to front)
    this.renderQueue.sort((a, b) => a.depth - b.depth);

    // 2. Render each entity
    for (let i = 0; i < this.renderQueue.length; i++) {
      const item = this.renderQueue[i];
      if (item.type === "savelich") {
        const sc = this.gridToScreen(item.entity.gx, item.entity.gy);
        this.savelich.draw(ctx, sc.x, sc.y);
      } else if (item.type === "worker") {
        const sc = this.gridToScreen(item.entity.gx, item.entity.gy);
        item.entity.draw(ctx, sc.x, sc.y);
      } else if (item.type === "mchs_truck") {
        const sc = this.gridToScreen(item.entity.gx, item.entity.gy);
        item.entity.draw(ctx, sc.x, sc.y);
      } else if (item.type === "service_vehicle") {
        const sc = this.gridToScreen(item.entity.gx, item.entity.gy);
        this.serviceVehicles.drawVehicle(ctx, item.entity, sc, this.camera.zoom, this.animTime);
      } else if (item.type === "structure") {
        this.drawStructure(ctx, item.entity);
      }
    }
  }

  drawStructure(ctx, s) {
    const sc = this.gridToScreen(s.gx, s.gy);

    // Frustum check
    if (sc.x < -100 || sc.x > this.width + 100 || sc.y < -120 || sc.y > this.height + 120) {
      return;
    }

    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Soft Blob Drop Shadow under structure
    ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 4, s.radius * 0.8, s.radius * 0.4, 0, 0, PI2);
    ctx.fill();

    switch (s.type) {
      case "well_cluster":
      case "pumpjack_classic":
      case "pumpjack_heavy":
      case "christmas_tree":
      case "submersible_ecn":
        this.drawIsometricWellCluster(ctx, s);
        break;
      case "gathering_station":
        this.drawMegaGasPlant(ctx, s);
        break;
      case "flare_crypto":
        this.drawIsometricFlareCrypto(ctx, s);
        break;
      case "helipad":
        this.drawIsometricHelipad(ctx, s);
        break;
      case "gatehouse":
        this.drawIsometricGatehouse(ctx, s);
        break;
      case "canteen":
        this.drawIsometricCanteen(ctx, s);
        break;
      case "dormitory":
        this.drawIsometricDormitory(ctx, s);
        break;
    }

    // Active Selection Pulsing Ring & Clicker Guidance (Minimal Studio Style)
    if (state.activeWellId === s.id) {
      const pulse = 4 + Math.sin(this.animTime * 5) * 3;
      ctx.strokeStyle = "#ea580c"; // Teenage Engineering Studio Orange
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 4, (s.radius * 0.8) + pulse, (s.radius * 0.4) + pulse * 0.5, 0, 0, PI2);
      ctx.stroke();

      // In-World Clicker Indicator (Frosted Glass Card)
      if (!this.valveMiniGame?.active) {
        const tapPower = state.getCurrentTapPower();
        const bounce = Math.sin(this.animTime * 6) * 3;
        const promptY = -78 + bounce;

        ctx.save();
        ctx.fillStyle = "rgba(17, 24, 38, 0.88)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.roundRect(-60, promptY - 10, 120, 20, 6);
        ctx.fill();
        ctx.stroke();

        // Top specular hairline
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.moveTo(-54, promptY - 9);
        ctx.lineTo(54, promptY - 9);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px 'JetBrains Mono', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`👆 ТАПАЙ! +${tapPower.toLocaleString("ru-RU")} ₽`, 0, promptY);
        ctx.restore();

        // Valve tuning prompt badge if cooldown ready
        if (this.valveMiniGame && this.valveMiniGame.cooldownTimer <= 0) {
          ctx.save();
          const vPillY = -102;
          ctx.fillStyle = "rgba(234, 88, 12, 0.92)"; // Studio Orange
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.roundRect(-48, vPillY - 8, 96, 16, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 8px 'JetBrains Mono', monospace, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⚙️ ЗАДВИЖКА x2", 0, vPillY);
          ctx.restore();
        }
      }
    }

    // Well Title / Locked Sector Barricade
    if (s.id.startsWith("well_")) {
      const well = state.wells[s.id];
      const unl = well?.unlocked;

      if (unl) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px 'JetBrains Mono', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.name + ` (ур. ${well.level})`, 0, -56);
      } else {
        // Locked Sector: Barricade sawhorse & warning ribbon
        ctx.save();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(-s.radius * 0.7, 0);
        ctx.lineTo(s.radius * 0.7, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        const def = CONFIG.WELLS.find(w => w.id === s.id);
        const costText = def ? `${def.unlockCost.toLocaleString("ru-RU")} ₽` : "";

        // Lock Badge (Frosted Glass)
        const badgeY = -54;
        ctx.fillStyle = "rgba(17, 24, 38, 0.92)";
        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.roundRect(-60, badgeY - 9, 120, 18, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fca5a5";
        ctx.font = "bold 8px 'JetBrains Mono', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`🔒 ЗАКРЫТО: ${costText}`, 0, badgeY);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // --- STRUCTURE RENDERERS ---

  drawIsometricWellCluster(ctx, s) {
    const well = state.wells[s.id];
    const isUnlocked = well && well.unlocked;
    const wellCount = state.getWellsCountOnPad(s.id); // 2..5
    const isCorp = state.isCorporateEmpire;

    // 1. Reinforced Concrete Drilling Pad (Кустовая площадка - Architectural Dark Plate)
    ctx.fillStyle = isUnlocked ? (isCorp ? "#0f1623" : "#141c2b") : "#0b1019";
    ctx.strokeStyle = isUnlocked ? (isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)") : "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-48, -20, 96, 40, 5);
    ctx.fill();
    ctx.stroke();

    // 1px inner chamfer hairline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-45, -17, 90, 34);

    // Stencil coordinates on concrete pad (MOUTHWASH Studio style)
    if (isUnlocked) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.font = "600 5px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`PAD // 0${s.id.split('_')[1] || 1}`, -42, 17);
      ctx.textAlign = "right";
      ctx.fillText("67.24°N", 42, 17);
    }

    // 2. High-pressure manifold collection line (Brushed dark line with orange accent)
    ctx.strokeStyle = isUnlocked ? "#1e293b" : "#111827";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-38, 10);
    ctx.lineTo(38, 10);
    ctx.stroke();

    ctx.strokeStyle = isUnlocked ? "#ea580c" : "#475569";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-38, 9);
    ctx.lineTo(38, 9);
    ctx.stroke();

    // 3. Render 2 to 5 wellheads along the pad (Teenage Engineering Precision Hardware)
    const count = Math.max(2, Math.min(5, wellCount));
    const span = 64;
    const step = span / (count - 1);

    for (let i = 0; i < count; i++) {
      const wx = -32 + i * step;
      const wy = -4 + (i % 2) * 3;

      // Connecting feeder pipe to central manifold
      ctx.strokeStyle = isUnlocked ? "#334155" : "#1e293b";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx, 10);
      ctx.stroke();

      // Casing head spool (Колонный фланец с микро-винтами)
      ctx.fillStyle = "#0c131f";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 0.8;
      ctx.fillRect(wx - 5, wy - 3, 10, 6);
      ctx.strokeRect(wx - 5, wy - 3, 10, 6);

      // Gas Christmas Tree Column: Brushed Titanium Cylinder with Anisotropic Satin Sheen
      const cw = 5.5, ch = 20;
      const cy = wy - 22;
      const titanGrad = ctx.createLinearGradient(wx - cw/2, 0, wx + cw/2, 0);
      titanGrad.addColorStop(0, isUnlocked ? "#1f2937" : "#111827");
      titanGrad.addColorStop(0.35, isUnlocked ? "#4b5563" : "#1f2937");
      titanGrad.addColorStop(0.7, isUnlocked ? "#374151" : "#111827");
      titanGrad.addColorStop(1, isUnlocked ? "#111827" : "#090d14");
      ctx.fillStyle = titanGrad;
      ctx.fillRect(wx - cw/2, cy, cw, ch);

      // Fine vertical satin reflection hairline
      if (isUnlocked) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(wx - 1, cy + 2);
        ctx.lineTo(wx - 1, cy + ch - 2);
        ctx.stroke();
      }

      // Master & Wing valve cross bar
      ctx.fillStyle = isUnlocked ? "#1f2937" : "#111827";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 0.8;
      ctx.fillRect(wx - 8, wy - 16, 16, 4);
      ctx.strokeRect(wx - 8, wy - 16, 16, 4);

      // TE Studio Orange Handwheels (Маховики задвижек)
      const hColor = isUnlocked ? "#ea580c" : "#4b5563";
      ctx.fillStyle = hColor;
      ctx.beginPath();
      ctx.arc(wx - 7, wy - 14, 2.5, 0, PI2);
      ctx.arc(wx + 7, wy - 14, 2.5, 0, PI2);
      ctx.fill();

      // Golden brass center dot
      if (isUnlocked) {
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(wx - 7.5, wy - 14.5, 1, 1);
        ctx.fillRect(wx + 6.5, wy - 14.5, 1, 1);
      }

      // Frosted Glass Pressure Gauge on top (Манометр устьевой)
      ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
      ctx.strokeStyle = isUnlocked ? "rgba(255, 255, 255, 0.25)" : "#334155";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(wx, wy - 25, 3.5, 0, PI2);
      ctx.fill();
      ctx.stroke();

      // Active Emerald pressure arc
      if (isUnlocked) {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(wx, wy - 25, 2.6, -Math.PI * 0.7, 0);
        ctx.stroke();
      }

      // Gauge needle with gentle vibration if producing
      const needleAngle = isUnlocked ? Math.sin(this.animTime * 8 + i) * 0.4 : 0;
      ctx.strokeStyle = isUnlocked ? "#ea580c" : "#64748b";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(wx, wy - 25);
      ctx.lineTo(wx + Math.sin(needleAngle) * 2.5, wy - 25 - Math.cos(needleAngle) * 2.5);
      ctx.stroke();

      // Wellhead number stencil on concrete
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.font = "bold 5.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`№${i + 1}`, wx, wy + 16);
    }

    // 4. Cluster Overhead Plaque (Frosted Glass Card)
    const plaqueY = -34;
    ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
    ctx.strokeStyle = isUnlocked ? (isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.22)") : "#475569";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(-44, plaqueY - 8, 88, 16, 4);
    ctx.fill();
    ctx.stroke();

    // Top specular hairline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(-40, plaqueY - 7);
    ctx.lineTo(40, plaqueY - 7);
    ctx.stroke();

    ctx.fillStyle = isUnlocked ? (isCorp ? "#fbbf24" : "#ffffff") : "#94a3b8";
    ctx.font = "bold 6.5px 'JetBrains Mono', monospace, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isUnlocked ? `${s.name} • ${count} СКВ.` : `🔒 ${s.name}`, 0, plaqueY);

    // Debit indicator
    if (isUnlocked) {
      const debit = Math.round(state.getWellDebit(s.id));
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 5.5px 'JetBrains Mono', monospace, sans-serif";
      ctx.fillText(`${debit} м³/с`, 0, plaqueY + 13);
    }
  }

  drawMegaGasPlant(ctx, s) {
    const isCorp = state.isCorporateEmpire;
    const facLvl = state.facilityLevel || 1;

    // 0. Reinforced Concrete Industrial Foundation Pad (Architectural Dark Plate 156x88 px)
    ctx.fillStyle = isCorp ? "#0f1623" : "#111723";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-78, -44, 156, 88, 6);
    ctx.fill();
    ctx.stroke();

    // 1px inner hairline chamfer
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1.0;
    ctx.setLineDash([7, 7]);
    ctx.strokeRect(-74, -40, 148, 80);
    ctx.setLineDash([]);

    // Floor steel grating texture (subtle matte scorelines)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let gy = -34; gy <= 34; gy += 8) {
      ctx.moveTo(-70, gy);
      ctx.lineTo(70, gy);
    }
    ctx.stroke();

    // ==========================================
    // UNIT 1: FRACTIONATION & ABSORPTION COLUMNS (Left Bank)
    // ==========================================

    // Column 1: K-1 (Tallest Primary Distillation Tower, height 92px)
    ctx.save();
    ctx.translate(-52, -26);
    const colGrad1 = ctx.createLinearGradient(-11, 0, 11, 0);
    colGrad1.addColorStop(0, "#1f2937");
    colGrad1.addColorStop(0.35, "#4b5563");
    colGrad1.addColorStop(0.7, "#374151");
    colGrad1.addColorStop(1, "#111827");

    ctx.fillStyle = colGrad1;
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-11, -72, 22, 92, [5, 5, 2, 2]);
    ctx.fill();
    ctx.stroke();

    // Vertical satin reflection hairline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-7, -68);
    ctx.lineTo(-7, 16);
    ctx.stroke();

    // External lattice cage & ladder
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(11, -70);
    ctx.lineTo(11, 18);
    for (let ly = -65; ly <= 15; ly += 6) {
      ctx.moveTo(9, ly);
      ctx.lineTo(13, ly);
    }
    ctx.stroke();

    // 3 Catwalk Service Platforms with railings
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-15, -55, 30, 2.5);
    ctx.strokeRect(-15, -30, 30, 2.5);
    ctx.strokeRect(-15, -5, 30, 2.5);

    // Top Dome & Safety Relief Line (TE Studio Orange Accent)
    ctx.beginPath();
    ctx.arc(0, -72, 8, Math.PI, 0);
    ctx.fillStyle = "#374151";
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -80);
    ctx.lineTo(0, -88);
    ctx.lineTo(18, -88);
    ctx.stroke();

    // Badge K-1 (Frosted Glass Stencil)
    ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(-10, 8, 20, 9, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 6px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("К-1", 0, 14.5);
    ctx.restore();

    // Column 2: TEG-1 (Glycol Dehydration Column, height 68px)
    ctx.save();
    ctx.translate(-30, -22);
    const colGrad2 = ctx.createLinearGradient(-9, 0, 9, 0);
    colGrad2.addColorStop(0, "#1f2937");
    colGrad2.addColorStop(0.35, "#4b5563");
    colGrad2.addColorStop(0.7, "#374151");
    colGrad2.addColorStop(1, "#111827");

    ctx.fillStyle = colGrad2;
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-9, -52, 18, 70, [5, 5, 2, 2]);
    ctx.fill();
    ctx.stroke();

    // Vertical satin hairline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-6, -48);
    ctx.lineTo(-6, 14);
    ctx.stroke();

    // Catwalks
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-12, -38, 24, 2);
    ctx.strokeRect(-12, -15, 24, 2);

    // Dome
    ctx.beginPath();
    ctx.arc(0, -52, 6, Math.PI, 0);
    ctx.fillStyle = "#374151";
    ctx.fill();
    ctx.stroke();

    // Badge TEG-1
    ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(-9, 6, 18, 9, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 5.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("ТЭГ-1", 0, 12.5);
    ctx.restore();

    // Column 3: NTS-1 (Low Temperature Separator, height 54px)
    ctx.save();
    ctx.translate(-12, -18);
    const colGrad3 = ctx.createLinearGradient(-8, 0, 8, 0);
    colGrad3.addColorStop(0, "#1f2937");
    colGrad3.addColorStop(0.4, "#4b5563");
    colGrad3.addColorStop(0.8, "#374151");
    colGrad3.addColorStop(1, "#111827");

    ctx.fillStyle = colGrad3;
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-8, -40, 16, 56, [4, 4, 2, 2]);
    ctx.fill();
    ctx.stroke();

    // Dome
    ctx.beginPath();
    ctx.arc(0, -40, 5, Math.PI, 0);
    ctx.fillStyle = "#374151";
    ctx.fill();
    ctx.stroke();

    // Badge NTS-1
    ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(-8, 4, 16, 8, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 5px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("НТС-1", 0, 10);
    ctx.restore();

    // Overhead Pipe Rack Bridges connecting K-1, TEG-1, and NTS-1
    ctx.strokeStyle = "#161f2e";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-52, -55);
    ctx.lineTo(-30, -45);
    ctx.lineTo(-12, -35);
    ctx.stroke();

    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-52, -53);
    ctx.lineTo(-30, -43);
    ctx.lineTo(-12, -33);
    ctx.stroke();

    // ==========================================
    // UNIT 2: HORIZONTAL BULLET TANKS & STORAGE (Right Bank)
    // ==========================================

    // 4 Horizontal Bullet Tanks (РГС 16 МПа) arranged in a 2-tier bank
    const bullets = [
      { x: 18, y: -26, name: "РГС-1" },
      { x: 54, y: -26, name: "РГС-2" },
      { x: 18, y: -8,  name: "РГС-3" },
      { x: 54, y: -8,  name: "РГС-4" }
    ];

    const cap = state.getOilStorageCapacity ? state.getOilStorageCapacity() : 2000;
    const cur = state.oilStorageCurrent || 0;
    const fill = Math.min(1.0, Math.max(0.1, cur / cap));

    for (let b = 0; b < bullets.length; b++) {
      const bt = bullets[b];
      ctx.save();
      ctx.translate(bt.x, bt.y);

      // Concrete saddle supports with 1px chamfers
      ctx.fillStyle = "#111723";
      ctx.fillRect(-12, 6, 5, 6);
      ctx.fillRect(7, 6, 5, 6);

      // Bullet cylinder: Matte Anodized Dark Graphite
      const bGrad = ctx.createLinearGradient(0, -8, 0, 8);
      bGrad.addColorStop(0, "#2a3547");
      bGrad.addColorStop(0.35, "#1a2233");
      bGrad.addColorStop(0.75, "#101622");
      bGrad.addColorStop(1, "#0a0e17");

      ctx.fillStyle = bGrad;
      ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-16, -7, 32, 14, 6);
      ctx.fill();
      ctx.stroke();

      // Translucent frosted glass inspection level indicator
      ctx.fillStyle = "rgba(10, 14, 23, 0.75)";
      ctx.beginPath();
      ctx.roundRect(-12, -2, 24, 4, [2]);
      ctx.fill();

      // Fluid level fill
      ctx.fillStyle = fill >= 0.95 ? "#ea580c" : "#10b981";
      ctx.fillRect(-12, -2, 24 * fill, 4);

      // Stenciled badge
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(bt.name, 0, 7);

      ctx.restore();
    }

    // 2 Large Storage Tanks (РВС-1 & РВС-2) on the far right edge
    const rvsTanks = [
      { x: 38, y: 16, name: "РВС-1" },
      { x: 62, y: 22, name: "РВС-2" }
    ];

    for (let r = 0; r < rvsTanks.length; r++) {
      const rvs = rvsTanks[r];
      ctx.save();
      ctx.translate(rvs.x, rvs.y);

      const rvsGrad = ctx.createLinearGradient(-12, 0, 12, 0);
      rvsGrad.addColorStop(0, "#2a3547");
      rvsGrad.addColorStop(0.3, "#374151");
      rvsGrad.addColorStop(0.7, "#1f2937");
      rvsGrad.addColorStop(1, "#111827");

      ctx.fillStyle = rvsGrad;
      ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-12, -14, 24, 26, [3, 3, 2, 2]);
      ctx.fill();
      ctx.stroke();

      // Spiral inspection staircase hairline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-12, 8);
      ctx.lineTo(0, -2);
      ctx.lineTo(12, -10);
      ctx.stroke();

      // Badge
      ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(-10, 1, 20, 8, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isCorp ? "#fbbf24" : "#ffffff";
      ctx.font = "bold 5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(rvs.name, 0, 7);

      ctx.restore();
    }

    // ==========================================
    // UNIT 3: AIR-COOLED HEAT EXCHANGERS (АВО газа)
    // ==========================================
    ctx.save();
    ctx.translate(-42, 14);

    // AVO Bank Housing
    ctx.fillStyle = "#111723";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-24, -10, 48, 20, 3);
    ctx.fill();
    ctx.stroke();

    // 3 Rotating Cooling Fans (with TE Studio Orange accent)
    const fanSpeed = this.animTime * 12;
    for (let f = 0; f < 3; f++) {
      const fx = -16 + f * 16;
      ctx.save();
      ctx.translate(fx, 0);

      // Fan ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, PI2);
      ctx.stroke();

      // Spinning 3-blade propeller
      ctx.rotate(fanSpeed + f * 0.8);
      ctx.strokeStyle = isCorp ? "#fbbf24" : "#ea580c";
      ctx.lineWidth = 1.5;
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -5);
        ctx.stroke();
        ctx.rotate((Math.PI * 2) / 3);
      }
      ctx.restore();
    }

    // AVO Badge
    ctx.fillStyle = "#ea580c";
    ctx.font = "bold 5px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("АВО ГАЗА", 0, 8);
    ctx.restore();

    // ==========================================
    // UNIT 4: CENTRAL CONTROL ROOM (ЦПУ)
    // ==========================================
    ctx.save();
    ctx.translate(0, 18);

    // 2-Story Modern Architectural Dispatch Pavilion
    ctx.fillStyle = "#0c131f";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-18, -12, 36, 24, 4);
    ctx.fill();
    ctx.stroke();

    // Panoramic Glazed Slit Windows with warm amber interior glow
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-14, -8, 28, 7);
    ctx.fillRect(-14, 2, 28, 7);

    ctx.fillStyle = "rgba(245, 158, 11, 0.65)"; // warm amber monitor glow
    ctx.fillRect(-12, -7, 10, 5);
    ctx.fillRect(2, 3, 10, 5);

    // Telecommunications Mast on roof
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(10, -12);
    ctx.lineTo(10, -28);
    ctx.stroke();

    // Blinking aviation beacon
    ctx.fillStyle = Math.sin(this.animTime * 6) > 0 ? "#ea580c" : "#7f1d1d";
    ctx.beginPath();
    ctx.arc(10, -29, 2.5, 0, PI2);
    ctx.fill();

    ctx.restore();

    // ==========================================
    // ELEVATED SIGNBOARD & LEVEL BADGE (Point 3: NEVER "холдинга"!)
    // ==========================================
    const signY = -78;
    // Frosted Glass floating plaque
    ctx.fillStyle = "rgba(17, 24, 38, 0.92)";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-64, signY - 8, 128, 16, 4);
    ctx.fill();
    ctx.stroke();

    // Top specular glass hairline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(-60, signY - 7);
    ctx.lineTo(60, signY - 7);
    ctx.stroke();

    // Title: Strictly "★ ГАЗОВЫЙ ПРОМЫСЕЛ ★" (Never "холдинга"!)
    ctx.fillStyle = isCorp ? "#fbbf24" : "#ffffff";
    ctx.font = "bold 8px 'JetBrains Mono', monospace, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★ ГАЗОВЫЙ ПРОМЫСЕЛ ★", 0, signY);

    // Facility Level & Debit Bonus Badge
    ctx.fillStyle = "rgba(17, 24, 38, 0.94)";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "#10b981";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(-38, signY + 11, 76, 12, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isCorp ? "#fbbf24" : "#34d399";
    ctx.font = "bold 6.5px 'JetBrains Mono', monospace, sans-serif";
    ctx.fillText(`Ур. ${facLvl} (+${facLvl * 15}%)`, 0, signY + 17);
  }

  drawIsometricGatheringStation(ctx, s) {
    this.drawMegaGasPlant(ctx, s);
  }

  drawIsometricPumpjack(ctx, s) {
    const isHeavy = s.type === "pumpjack_heavy";
    const well = state.wells[s.id];
    const isRunning = well && well.unlocked && well.level > 0;
    const beamAngle = isRunning ? Math.sin(this.animTime * (isHeavy ? 2.5 : 3.2)) * 0.22 : 0;

    // 1. Concrete Pedestal
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-22, -6, 44, 16, 4);
    ctx.fill();
    ctx.stroke();

    // 2. Samson Post (Pylon)
    ctx.strokeStyle = isHeavy ? "#b45309" : "#475569";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(0, -40);
    ctx.lineTo(10, -4);
    ctx.stroke();

    // Cross brace
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -18);
    ctx.lineTo(6, -18);
    ctx.stroke();

    // 3. Walking Beam & Horsehead
    ctx.save();
    ctx.translate(0, -40);
    ctx.rotate(beamAngle);

    // Walking Beam
    ctx.strokeStyle = isHeavy ? "#f59e0b" : "#0284c7";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();

    // Horsehead (Left end)
    ctx.fillStyle = isHeavy ? "#d97706" : "#0369a1";
    ctx.beginPath();
    ctx.arc(-28, -2, 9, 0, PI2);
    ctx.fill();

    // Counterweight (Right end)
    ctx.fillStyle = "#334155";
    ctx.fillRect(16, -6, 12, 12);

    ctx.restore();

    // 4. Polished Rod dipping into wellhead
    const rodTopY = -40 - Math.sin(beamAngle) * 28;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-28, rodTopY);
    ctx.lineTo(-28, -2);
    ctx.stroke();

    // Wellhead flange
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-32, -4, 8, 6);
  }

  drawIsometricChristmasTree(ctx, s) {
    // AФК Gas Tree
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-16, -6, 32, 12);

    // Main column
    ctx.fillStyle = "#334155";
    ctx.fillRect(-6, -42, 12, 38);

    // Master valve wing
    ctx.fillStyle = "#ec4899";
    ctx.fillRect(-20, -32, 40, 7);

    // Red handwheels
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(-16, -28, 4, 0, PI2);
    ctx.arc(16, -28, 4, 0, PI2);
    ctx.fill();

    // Top pressure gauge
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(0, -46, 6, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dial needle
    ctx.strokeStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(3, -48);
    ctx.stroke();
  }

  drawIsometricEcn(ctx, s) {
    // Submersible Electric Centrifugal Pump station
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-18, -6, 36, 12);

    // Control cabinet (Electric substation)
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -42, 28, 38, 4);
    ctx.fill();
    ctx.stroke();

    // Neon telemetry status indicator
    ctx.fillStyle = Math.sin(this.animTime * 6) > 0 ? "#10b981" : "#047857";
    ctx.beginPath();
    ctx.arc(0, -32, 3.5, 0, PI2);
    ctx.fill();

    // Power cable line
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, -18);
    ctx.quadraticCurveTo(22, -4, 28, -12);
    ctx.stroke();
  }

  drawIsometricFlareCrypto(ctx, s) {
    const isActive = state.cryptoMiningActive;

    // 1. Lattice Flare Tower (Dark titanium lattice)
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -60);
    ctx.stroke();

    // Cross braces
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let y = -10; y >= -50; y -= 12) {
      ctx.moveTo(-6, y);
      ctx.lineTo(6, y + 6);
      ctx.moveTo(6, y);
      ctx.lineTo(-6, y + 6);
    }
    ctx.stroke();

    // Tip flare burner with Studio Orange rim
    ctx.fillStyle = "#111827";
    ctx.fillRect(-5, -64, 10, 5);
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(-4, -65, 8, 1.5);

    // Server Container Module (PetroCoin Datacenter)
    ctx.fillStyle = "#0c131f";
    ctx.strokeStyle = isActive ? "#10b981" : "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-20, -18, 40, 22, 3);
    ctx.fill();
    ctx.stroke();

    if (isActive) {
      // Roaring Flare Flame
      const fb = -64;
      const hf = 24 + Math.sin(this.animTime * 14) * 6;
      const sw = Math.sin(this.animTime * 8) * 4;

      const flameGrad = ctx.createLinearGradient(0, fb, 0, fb - hf);
      flameGrad.addColorStop(0, "#ea580c");
      flameGrad.addColorStop(0.5, "#f59e0b");
      flameGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = flameGrad;

      ctx.beginPath();
      ctx.moveTo(-5, fb);
      ctx.quadraticCurveTo(sw, fb - hf * 0.6, sw, fb - hf);
      ctx.quadraticCurveTo(5, fb - hf * 0.6, 5, fb);
      ctx.closePath();
      ctx.fill();

      // Blinking LEDs
      ctx.fillStyle = Math.sin(this.animTime * 10) > 0 ? "#10b981" : "#047857";
      ctx.fillRect(-14, -12, 5, 3);
      ctx.fillStyle = Math.cos(this.animTime * 12) > 0 ? "#ea580c" : "#9a3412";
      ctx.fillRect(-6, -12, 5, 3);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 7px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("⚡PETRO", 0, -2);

      // Status Badge (Frosted Glass)
      ctx.fillStyle = "rgba(17, 24, 38, 0.92)";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.roundRect(-32, -84, 64, 14, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 6px 'JetBrains Mono', monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`⚡ +${state.getCryptoRate().toFixed(2)}/с`, 0, -77);
    } else {
      // INACTIVE / LOCKED: Unlit flare, yellow warning tape across server
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(-18, -16, 36, 18);
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "bold 6px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("ОБЕСТОЧЕНО", 0, -2);

      // Status Badge (Frosted Glass)
      ctx.fillStyle = "rgba(17, 24, 38, 0.92)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.roundRect(-42, -84, 84, 14, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fcd34d";
      ctx.font = "bold 6px 'JetBrains Mono', monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔒 МАЙНИНГ (ОТКЛЮЧЕН)", 0, -77);
    }
  }

  drawIsometricHelipad(ctx, s) {
    const isCorp = state.isCorporateEmpire;

    if (isCorp) {
      // Obsidian VIP Executive Landing Pad
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 18, 0, 0, PI2);
      ctx.fill();
      ctx.stroke();

      // Outer gold trim ring
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 15, 0, 0, PI2);
      ctx.stroke();

      // Inner gold landing circle
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 10, 0, 0, PI2);
      ctx.stroke();

      // Golden "H" & VIP Star
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 13px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", 0, -1);
      ctx.font = "bold 7px -apple-system, sans-serif";
      ctx.fillText("★ VIP ★", 0, 9);

      // Gold pulsing beacons
      const beaconOn = Math.sin(this.animTime * 6) > 0;
      ctx.fillStyle = beaconOn ? "#fde047" : "#b45309";
      ctx.beginPath();
      ctx.arc(-28, 0, 3, 0, PI2);
      ctx.arc(28, 0, 3, 0, PI2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#161f2e";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 18, 0, 0, PI2);
      ctx.fill();
      ctx.stroke();

      // Inner landing circle
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 11, 0, 0, PI2);
      ctx.stroke();

      // "H" mark
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px 'JetBrains Mono', monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", 0, 0);

      // Beacons
      const beaconOn = Math.sin(this.animTime * 6) > 0;
      ctx.fillStyle = beaconOn ? "#ea580c" : "#7c2d12";
      ctx.beginPath();
      ctx.arc(-28, 0, 2.5, 0, PI2);
      ctx.arc(28, 0, 2.5, 0, PI2);
      ctx.fill();
    }
  }

  drawIsometricGatehouse(ctx, s) {
    const isCorp = state.isCorporateEmpire;
    const serviceBarrier = this.serviceVehicles ? this.serviceVehicles.barrierAngle : 0;
    const tankerBarrier = this.tankerPool ? this.tankerPool.barrierAngle : 0;
    const effectiveBarrier = Math.max(serviceBarrier, tankerBarrier);
    const isOpen = effectiveBarrier > 0.2;
    const bAngle = -effectiveBarrier * 0.85;

    // 1. Roadway Entry Arch spanning overhead (Architectural Dark Graphite)
    // Left Pylon
    ctx.fillStyle = isCorp ? "#0f1623" : "#111723";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.2;
    ctx.fillRect(-28, -52, 6, 44);
    ctx.strokeRect(-28, -52, 6, 44);

    // Right Pylon
    ctx.fillRect(22, -52, 6, 44);
    ctx.strokeRect(22, -52, 6, 44);

    // Overhead Sign Arch Crossbeam (Frosted Glass Card)
    ctx.fillStyle = "rgba(17, 24, 38, 0.92)";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-34, -62, 64, 14, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isCorp ? "#fbbf24" : "#ffffff";
    ctx.font = "bold 7px 'JetBrains Mono', monospace, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★ КПП ПРОМЫСЛА ★", -2, -55);

    // 2. Guard Booth on right roadside shoulder (Minimalist pavilion)
    ctx.fillStyle = "#0c131f";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(16, -18, 22, 20, 3);
    ctx.fill();
    ctx.stroke();

    // Guard Window with warm amber glow
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(20, -12, 7, 7);

    // Traffic LED Light
    ctx.fillStyle = "#000000";
    ctx.fillRect(11, -26, 4, 12);
    ctx.fillStyle = isOpen ? "#10b981" : "#ea580c";
    ctx.beginPath();
    ctx.arc(13, -20, 2.5, 0, PI2);
    ctx.fill();

    // 3. Automated Barrier Arm Pivot (At road shoulder, blocks lane when closed)
    ctx.save();
    ctx.translate(14, 0);
    ctx.rotate(bAngle);

    // Sleek Studio Orange / Laser Barrier Arm
    ctx.strokeStyle = isOpen ? "#10b981" : "#ea580c";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, -3);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2, -0.3);
    ctx.lineTo(-28, -2.7);
    ctx.stroke();
    ctx.restore();
  }

  drawIsometricLoadingRack(ctx, s) {
    const bays = Math.max(1, Math.min(3, state.loadingRackLevel || 1));
    const width = 36 + (bays - 1) * 22;

    // 1. Concrete Loading Island / Foundation Curb
    ctx.fillStyle = "#141c2b";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-width * 0.5, -10, width, 18, 4);
    ctx.fill();
    ctx.stroke();

    // 2. Steel Support Columns
    const colLeft = -width * 0.5 + 4;
    const colRight = width * 0.5 - 4;
    ctx.fillStyle = "#111723";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.5;

    // Left column
    ctx.fillRect(colLeft, -36, 5, 28);
    ctx.strokeRect(colLeft, -36, 5, 28);

    // Right column
    ctx.fillRect(colRight - 5, -36, 5, 28);
    ctx.strokeRect(colRight - 5, -36, 5, 28);

    // 3. Overhead Fuel Distribution Pipe (Amber/Orange)
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(colLeft, -30);
    ctx.lineTo(colRight, -30);
    ctx.stroke();

    // 4. Bay Stations (Pipes & Loading Hoses)
    for (let b = 0; b < bays; b++) {
      const bayX = bays === 1 ? 0 : colLeft + 10 + (b / (bays - 1)) * (colRight - colLeft - 20);

      ctx.strokeStyle = "#161f2e";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(bayX, -30);
      ctx.lineTo(bayX, -22);
      ctx.stroke();

      let isFilling = false;
      if (this.tankerPool && this.tankerPool.bays[b]) {
        const occId = this.tankerPool.bays[b].occupiedBy;
        if (occId !== null && this.tankerPool.trucks[occId]) {
          const occTruck = this.tankerPool.trucks[occId];
          isFilling = occTruck.state === 4;
        }
      }

      ctx.strokeStyle = isFilling ? "#ea580c" : "#475569";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(bayX, -22);
      if (isFilling) {
        ctx.bezierCurveTo(bayX - 4, -14, bayX + 4, -4, bayX, 0);
      } else {
        ctx.quadraticCurveTo(bayX + 5, -16, bayX + 2, -10);
      }
      ctx.stroke();

      if (isFilling) {
        const pulse = (this.animTime * 14) % 18;
        ctx.fillStyle = "#ea580c";
        ctx.beginPath();
        ctx.arc(bayX, -22 + pulse, 1.8, 0, PI2);
        ctx.fill();
      }

      ctx.fillStyle = isFilling ? "#ea580c" : "#10b981";
      ctx.beginPath();
      ctx.arc(bayX, -32, 2.2, 0, PI2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 7px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`П-${b + 1}`, bayX, -35);
    }

    // 5. Minimalist Canopy Roof
    ctx.fillStyle = "#0c131f";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-width * 0.5 - 4, -42, width + 8, 9, 2);
    ctx.fill();
    ctx.stroke();

    // 6. In-World Clickable Upgrade Badge
    if (bays < 3) {
      const canUpgrade = state.canUpgradeLoadingRack();
      const cost = state.getLoadingRackUpgradeCost();
      const costText = cost >= 1000 ? Math.floor(cost / 1000) + "K ₽" : cost + " ₽";
      const bounce = Math.sin(this.animTime * 4.5) * 2;
      const badgeY = -52 + bounce;

      ctx.fillStyle = canUpgrade ? "#059669" : "rgba(17, 24, 38, 0.9)";
      ctx.strokeStyle = canUpgrade ? "#34d399" : "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.roundRect(-42, badgeY - 8, 84, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px 'JetBrains Mono', monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+ПОСТ №${bays + 1} (${costText})`, 0, badgeY);
    }
  }

  drawIsometricCanteen(ctx, s) {
    const isCorp = state.isCorporateEmpire;
    const canLvl = state.canteenLevel || 1;

    // Kitchen module foundation (Architectural Dark Pavilion at 3.5, 7.8, Phase 12)
    ctx.fillStyle = "#111827";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-24, -14, 48, 28, 4);
    ctx.fill();
    ctx.stroke();

    // Food delivery loading dock on side
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(-28, -6, 4, 16);

    // Panoramic horizontal slit window with warm amber glow
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(-18, -6, 12, 5);
    ctx.fillRect(6, -6, 12, 5);
    ctx.fillStyle = "rgba(254, 243, 199, 0.6)";
    ctx.fillRect(-16, -5, 5, 3);
    ctx.fillRect(8, -5, 5, 3);

    // Kitchen exhaust chimney with animated steam puffs
    ctx.fillStyle = "#374151";
    ctx.fillRect(-14, -22, 6, 8);
    const steamY = Math.sin(this.animTime * 4) * 3;
    ctx.fillStyle = "rgba(241, 245, 249, 0.35)";
    ctx.beginPath();
    ctx.arc(-11, -26 + steamY, 2.5, 0, PI2);
    ctx.arc(-9, -31 + steamY * 1.5, 3.5, 0, PI2);
    ctx.fill();

    // Overhead Signboard (Frosted Glass Card)
    ctx.fillStyle = "rgba(17, 24, 38, 0.92)";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(-30, -32, 60, 14, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isCorp ? "#fbbf24" : "#ffffff";
    ctx.font = "bold 6.5px 'JetBrains Mono', monospace, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("☕ СТОЛОВАЯ", 0, -25);

    // Level badge
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 5.5px 'JetBrains Mono', monospace, sans-serif";
    ctx.fillText(`Ур. ${canLvl} (+${canLvl * 10}%)`, 0, 8);
  }

  drawIsometricDormitory(ctx, s) {
    const isCorp = state.isCorporateEmpire;
    const fed = state.canteen?.workersFed || 20;

    // 2-story Arctic Crew Dormitory (Separate building at 3.5, 9.8, Phase 12)
    ctx.fillStyle = isCorp ? "#090d14" : "#111827";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-26, -18, 52, 34, 4);
    ctx.fill();
    ctx.stroke();

    // 2 floors of warm cozy slit windows
    ctx.fillStyle = "#ea580c";
    for (let f = 0; f < 2; f++) {
      const wy = -11 + f * 10;
      ctx.fillRect(-20, wy, 8, 4);
      ctx.fillRect(-6, wy, 8, 4);
      ctx.fillRect(8, wy, 8, 4);
      ctx.fillStyle = "rgba(254, 243, 199, 0.5)";
      ctx.fillRect(-19, wy + 1, 3, 2);
      ctx.fillRect(-5, wy + 1, 3, 2);
      ctx.fillRect(9, wy + 1, 3, 2);
      ctx.fillStyle = "#ea580c";
    }

    // Telemetry satellite dish on roof
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(14, -22, 5, Math.PI * 0.7, Math.PI * 1.7);
    ctx.stroke();
    ctx.moveTo(14, -22);
    ctx.lineTo(14, -18);
    ctx.stroke();

    // Overhead Signboard (Frosted Glass Card)
    ctx.fillStyle = "rgba(17, 24, 38, 0.92)";
    ctx.strokeStyle = isCorp ? "#fbbf24" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(-40, -36, 80, 14, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isCorp ? "#fbbf24" : "#ffffff";
    ctx.font = "bold 6.5px 'JetBrains Mono', monospace, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏠 ВАХТОВОЕ ОБЩЕЖИТИЕ", 0, -29);

    // Shift info
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "bold 5.5px 'JetBrains Mono', monospace, sans-serif";
    ctx.fillText(`Смена: ${fed} чел.`, 0, 11);
  }

  // --- HELICOPTER & SUPPLY CRATE (2.5D World Anchor, Phase 6) ---

  drawHelicopter(ctx, w, h) {
    const heli = state.helicopter;
    if (!heli) return;
    const isCorp = state.isCorporateEmpire;

    // Projected 2.5D World Coordinates (Pinned to Helipad at 1.5, 11.5)
    const hgx = Number.isFinite(heli.gx) ? heli.gx : 1.5;
    const hgy = Number.isFinite(heli.gy) ? heli.gy : 11.5;
    const hgz = Number.isFinite(heli.gz) ? heli.gz : 110;

    const cgx = Number.isFinite(heli.crateGx) ? heli.crateGx : 1.5;
    const cgy = Number.isFinite(heli.crateGy) ? heli.crateGy : 11.5;
    const cgz = Number.isFinite(heli.crateGz) ? heli.crateGz : 0;

    const hsc = this.gridToScreen(hgx, hgy, hgz);
    const csc = this.gridToScreen(cgx, cgy, cgz);
    const groundSc = this.gridToScreen(hgx, hgy, 0);
    const zoom = this.camera.zoom;

    ctx.save();

    // 1. Helicopter Shadow on ground & Searchlight Cone
    if (heli.active && hgx < 14) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
      ctx.beginPath();
      ctx.ellipse(groundSc.x, groundSc.y, 26 * zoom, 13 * zoom, 0, 0, PI2);
      ctx.fill();

      // Searchlight beam pointing down from helicopter towards the Helipad
      if (heli.waitingClick) {
        const spotGrad = ctx.createRadialGradient(groundSc.x, groundSc.y, 4 * zoom, groundSc.x, groundSc.y, 38 * zoom);
        if (isCorp) {
          spotGrad.addColorStop(0, "rgba(250, 204, 21, 0.42)");
          spotGrad.addColorStop(1, "rgba(250, 204, 21, 0)");
        } else {
          spotGrad.addColorStop(0, "rgba(56, 189, 248, 0.38)");
          spotGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
        }
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.ellipse(groundSc.x, groundSc.y, 40 * zoom, 20 * zoom, 0, 0, PI2);
        ctx.fill();
      }
    }

    // 2. Helicopter Fuselage (In Flight)
    if (heli.active && hgx < 14) {
      const hx = hsc.x;
      const hy = hsc.y;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(zoom, zoom);

      // Tail boom
      ctx.fillStyle = isCorp ? "#1e3a8a" : "#0284c7";
      ctx.fillRect(-38, -4, 20, 5);

      if (isCorp) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 6px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("VIP", -28, 0);
      }

      // Tail rotor blade
      ctx.strokeStyle = "rgba(241, 245, 249, 0.8)";
      ctx.lineWidth = 1.5;
      const tSpan = Math.sin(this.animTime * 45) * 8;
      ctx.beginPath();
      ctx.moveTo(-38, -4 - tSpan);
      ctx.lineTo(-38, -4 + tSpan);
      ctx.stroke();

      // Fuselage body
      ctx.fillStyle = isCorp ? "#f8fafc" : "#0284c7";
      ctx.beginPath();
      ctx.roundRect(-18, -11, 38, 20, [8, 12, 6, 6]);
      ctx.fill();

      // Gold / Yellow cheatline stripe
      ctx.fillStyle = isCorp ? "#fbbf24" : "#facc15";
      ctx.fillRect(-18, -2, 38, 3.5);

      // Cockpit canopy window
      ctx.fillStyle = isCorp ? "#0284c7" : "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(6, -8, 12, 11, [2, 6, 2, 2]);
      ctx.fill();

      // Landing skids
      ctx.strokeStyle = isCorp ? "#94a3b8" : "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, 10); ctx.lineTo(16, 10);
      ctx.moveTo(-6, 8); ctx.lineTo(-6, 10);
      ctx.moveTo(10, 8); ctx.lineTo(10, 10);
      ctx.stroke();

      // Rotor mast
      ctx.strokeStyle = isCorp ? "#1e293b" : "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(0, -15);
      ctx.stroke();

      // Main rotor blades (blur disk)
      ctx.strokeStyle = isCorp ? "rgba(251, 191, 36, 0.85)" : "rgba(241, 245, 249, 0.75)";
      ctx.lineWidth = 2.2;
      const span = Math.cos(this.animTime * 40) * 44;
      ctx.beginPath();
      ctx.moveTo(-span, -15); ctx.lineTo(span, -15);
      ctx.stroke();

      // Hover prompt
      if (heli.waitingClick) {
        ctx.fillStyle = isCorp ? "#fbbf24" : "#facc15";
        ctx.font = "bold 9px -apple-system, sans-serif";
        ctx.textAlign = "center";
        const bob = Math.sin(this.animTime * 6) * 3;
        ctx.fillText(isCorp ? "👑 СБРОСИТЬ VIP ГРУЗ!" : "👆 СБРОСИТЬ ГРУЗ!", 0, -26 + bob);
      }

      ctx.restore();
    }

    // 3. Cargo Crate (Airborne or Landed on Helipad)
    if (heli.crateDropped || (!heli.crateDropped && heli.waitingClick)) {
      const cx = csc.x;
      const cy = csc.y;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);

      if (cgz > 5) {
        // Falling on parachute
        ctx.fillStyle = isCorp ? "#7c3aed" : "#ef4444";
        ctx.beginPath();
        ctx.arc(0, -22, 18, Math.PI, 0);
        ctx.fill();

        ctx.strokeStyle = isCorp ? "#fbbf24" : "#cbd5e1";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-18, -22); ctx.lineTo(0, -5);
        ctx.moveTo(18, -22); ctx.lineTo(0, -5);
        ctx.stroke();
      }

      // Supply crate box
      ctx.fillStyle = isCorp ? "#fbbf24" : "#f59e0b";
      ctx.strokeStyle = isCorp ? "#1e3a8a" : "#78350f";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-9, -9, 18, 18, 2);
      ctx.fill();
      ctx.stroke();

      // Steel corners / strapping
      ctx.strokeStyle = isCorp ? "#1e3a8a" : "#78350f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-9, -9); ctx.lineTo(9, 9);
      ctx.moveTo(9, -9); ctx.lineTo(-9, 9);
      ctx.stroke();

      // Landed crate prompt
      if (cgz <= 5 && !heli.crateCollected) {
        const pulse = Math.sin(this.animTime * 6) * 3;
        ctx.fillStyle = isCorp ? "#fbbf24" : "#22c55e";
        ctx.font = "bold 9px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(isCorp ? "👑 ТАПАЙ VIP ГРУЗ!" : "🎁 ТАПАЙ ГРУЗ!", 0, -18 + pulse);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // --- VALVE TUNING MINI-GAME (Item 6) ---

  startValveMiniGame(wellId) {
    this.valveMiniGame.active = true;
    this.valveMiniGame.wellId = wellId;
    this.valveMiniGame.turnsCompleted = 0;
    this.valveMiniGame.wheelAngle = 0;
    if (typeof audio?.playTap === "function") audio.playTap();
  }

  handleValveMiniGameTap(sx, sy) {
    const s = this.structures.find(item => item.id === this.valveMiniGame.wellId) || this.structures[0];
    const sc = this.gridToScreen(s.gx, s.gy);
    const mgY = sc.y - (105 * this.camera.zoom);
    const dist = Math.hypot(sx - sc.x, sy - mgY);
    if (dist > (68 * this.camera.zoom)) {
      this.valveMiniGame.active = false;
      return false;
    }

    const curP = this.valveMiniGame.pressure;
    const inGreen = curP >= this.valveMiniGame.targetMin && curP <= this.valveMiniGame.targetMax;

    if (inGreen) {
      this.valveMiniGame.turnsCompleted++;
      this.valveMiniGame.wheelAngle += Math.PI * 0.6;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      if (typeof audio?.vibrate === "function") audio.vibrate([25, 25, 50]);
      this.particles.spawnSnowDust(sc.x, sc.y - 40);

      if (this.valveMiniGame.turnsCompleted >= this.valveMiniGame.turnsRequired) {
        this.valveMiniGame.active = false;
        this.valveMiniGame.cooldownTimer = 75.0;
        state.activateBoost(60.0, 2.0); // +100% debit for 60s!
        if (typeof audio?.playPayout === "function") audio.playPayout();
        this.particles.spawnFloatingText(sc.x, sc.y - 65, "🔥 ТУРБО-ДЕБИТ x2 (60 сек)!", "#34d399", true);
        this.particles.spawnOilSplatter(sc.x, sc.y - 30, 16, true);
        this.addTrauma(0.2);
      } else {
        const left = this.valveMiniGame.turnsRequired - this.valveMiniGame.turnsCompleted;
        this.particles.spawnFloatingText(sc.x, sc.y - 60, `🎯 ТОЧНО! Ещё ${left} пов.!`, "#fbbf24", false);
      }
    } else {
      if (typeof audio?.playTap === "function") audio.playTap();
      this.particles.spawnFloatingText(sc.x, sc.y - 60, "⚠️ МИМО ЗЕЛЁНОЙ ЗОНЫ!", "#f87171", false);
      this.addTrauma(0.08);
    }
    return true;
  }

  drawValveMiniGame(ctx) {
    const s = this.structures.find(item => item.id === this.valveMiniGame.wellId) || this.structures[0];
    const sc = this.gridToScreen(s.gx, s.gy);
    const mx = sc.x;
    const my = sc.y - (105 * this.camera.zoom);

    ctx.save();
    ctx.translate(mx, my);

    // Backing plate
    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.roundRect(-65, -55, 130, 110, 12);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 9px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("РЕГУЛИРОВКА ЗАДВИЖКИ", 0, -40);

    // Manometer Dial Face
    const dialY = -8;
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, dialY, 24, 0, PI2);
    ctx.fill();
    ctx.stroke();

    // Green Sweet Spot Arc
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, dialY, 20, Math.PI * 0.9, Math.PI * 1.45);
    ctx.stroke();

    // Needle based on pressure
    const needleP = Math.max(0, Math.min(1.0, (this.valveMiniGame.pressure) / 200));
    const needleAngle = Math.PI * 0.7 + needleP * (Math.PI * 1.1);
    ctx.save();
    ctx.translate(0, dialY);
    ctx.rotate(needleAngle);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -18);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, PI2);
    ctx.fill();
    ctx.restore();

    // Red Valve Handwheel
    const wheelY = 32;
    ctx.save();
    ctx.translate(0, wheelY);
    ctx.rotate(this.valveMiniGame.wheelAngle);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, PI2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
    ctx.moveTo(0, -12); ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();

    // Prompt & Progress
    const inGreen = this.valveMiniGame.pressure >= this.valveMiniGame.targetMin && this.valveMiniGame.pressure <= this.valveMiniGame.targetMax;
    ctx.fillStyle = inGreen ? "#4ade80" : "#facc15";
    ctx.font = "bold 8.5px -apple-system, sans-serif";
    ctx.fillText(inGreen ? "🔥 ТАПАЙ СЕЙЧАС!" : "ЖДИ ЗЕЛЁНУЮ ЗОНУ", 0, 16);

    for (let d = 0; d < this.valveMiniGame.turnsRequired; d++) {
      ctx.fillStyle = d < this.valveMiniGame.turnsCompleted ? "#22c55e" : "#475569";
      ctx.beginPath();
      ctx.arc(-12 + d * 12, 48, 2.5, 0, PI2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawMapCompass(ctx, w, h) {
    // Subtle zoom pill in bottom right
    const zoomPct = Math.round(this.camera.zoom * 100);
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w - 76, h - 30, 64, 20, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🔍 ${zoomPct}%`, w - 44, h - 20);
    ctx.restore();
  }
}
