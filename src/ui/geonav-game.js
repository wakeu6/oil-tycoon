/**
 * src/ui/geonav-game.js
 * Subsurface Reservoir Geonavigation & Multi-Stage Hydraulic Fracturing (ГРП) Simulation.
 * 
 * Modular 3-Tier Architecture:
 * 1. GeonavGame: Pure headless simulation & physics engine (100% Node.js testable).
 * 2. GeonavCanvasRenderer: High-DPI 2D canvas presentation layer with zero-GC particles and trauma screen shake.
 * 3. GeonavGameView: DOM/modal coordinator adhering strictly to Emil Kowalski UI & AGENTS.md standards.
 */

import { state } from "../state.js";
import { CONFIG } from "../config.js";
import { audio } from "../audio.js";

/**
 * 1. HEADLESS SIMULATION ENGINE: GeonavGame
 */
export class GeonavGame {
  constructor(options = {}) {
    this.wellId = options.wellId || "well_1";
    this.state = options.state || state;
    this.canvas = options.canvas || null;
    this.targetLength = options.targetLength || (CONFIG.GEONAV?.DRILLING?.TARGET_LENGTH ?? 800.0);
    this.kop = options.kop || (CONFIG.GEONAV?.DRILLING?.KOP ?? 800.0);
    this.startAtLanding = Boolean(options.startAtLanding);

    // Stratigraphy geological layers (TVD in meters)
    this.layers = {
      overburden: {
        top: 0,
        bottom: 1400,
        name: "Кровля (глинистая покрышка / аргиллит)",
        grMin: 100,
        grMax: 140,
        grAvg: 120
      },
      payZone: {
        top: 1400,
        bottom: 1650,
        sweetSpotTop: 1475,
        sweetSpotBottom: 1575,
        name: "Продуктивный пласт АС (песчаник)",
        grMin: 25,
        grMax: 45,
        grAvg: 35
      },
      basalWater: {
        top: 1650,
        bottom: 3000,
        name: "Подошвенная вода (ВНК / водоносный горизонт)",
        grMin: 80,
        grMax: 110,
        grAvg: 95
      }
    };

    if (this.canvas) {
      this.renderer = new GeonavCanvasRenderer(this.canvas, this);
    }

    this.reset();
  }

  reset() {
    this.phase = "idle"; // "idle" | "drilling" | "fracing" | "completed"
    this.isDrilling = false;
    this.isCompleted = false;

    // Steering controls: 1 = build angle (up), -1 = drop angle (down), 0 = hold horizontal
    this.steering = 0;
    this.steerMode = "hold"; // "up" | "down" | "hold"

    // Directional drill bit kinematics
    const startLanding = Boolean(this.startAtLanding);
    this.bit = {
      x: 0,
      tvd: startLanding ? 1420 : 0,
      md: startLanding ? 1420 : 0,
      inclination: startLanding ? 75.0 : 0.0,
      rop: startLanding ? 18.0 : (CONFIG.GEONAV?.DRILLING?.BASE_ROP ?? 12.0),
      dls: 0.0, // dogleg severity (deg / 30m)
      dlsMax: CONFIG.GEONAV?.DRILLING?.MAX_DLS ?? 5.0,
      wear: 0.0, // 0.0 to 1.0
      temp: 65.0 // °C
    };

    this.lateralLength = 0;
    this.sweetSpotDistance = 0;
    this.payZoneDistance = 0;
    this.retentionPct = 100.0;
    this.trauma = 0.0; // Screen shake trauma [0..1]

    this.trajectory = [];
    this.lwdHistory = [];

    // Hydraulic fracturing stages (toe to heel completion)
    const fracCfg = CONFIG.FRAC || {};
    this.stages = [
      {
        index: 0,
        name: "Стадия 1 (Забой / Toe)",
        position: 0.85,
        pressure: fracCfg.P_HYDROSTATIC ?? 15.0,
        timer: 0.0,
        completed: false,
        efficiency: 0.0,
        zone: null
      },
      {
        index: 1,
        name: "Стадия 2",
        position: 0.65,
        pressure: fracCfg.P_HYDROSTATIC ?? 15.0,
        timer: 0.0,
        completed: false,
        efficiency: 0.0,
        zone: null
      },
      {
        index: 2,
        name: "Стадия 3",
        position: 0.45,
        pressure: fracCfg.P_HYDROSTATIC ?? 15.0,
        timer: 0.0,
        completed: false,
        efficiency: 0.0,
        zone: null
      },
      {
        index: 3,
        name: "Стадия 4 (Пятка / Heel)",
        position: 0.25,
        pressure: fracCfg.P_HYDROSTATIC ?? 15.0,
        timer: 0.0,
        completed: false,
        efficiency: 0.0,
        zone: null
      }
    ];
    this.currentStageIndex = 0;
    this.stimulationResult = null;
  }

  startHorizontalDrilling(opts = {}) {
    this.phase = "drilling";
    this.isDrilling = true;
    this.isCompleted = false;
    this.bit.tvd = opts.tvd ?? 1420;
    this.bit.md = opts.md ?? 1420;
    this.bit.inclination = opts.inc ?? 75.0;
    this.bit.rop = opts.rop ?? 18.0;
    this.kop = opts.kop ?? (this.kop || 800);
  }

  startDrilling(startAtLanding = false, opts = {}) {
    this.phase = "drilling";
    this.isDrilling = true;
    this.isCompleted = false;
    if (startAtLanding || this.startAtLanding) {
      this.bit.tvd = opts.tvd ?? 1420;
      this.bit.md = opts.md ?? 1420;
      this.bit.inclination = opts.inc ?? 75.0;
      this.bit.rop = opts.rop ?? 18.0;
      this.kop = opts.kop ?? (this.kop || 800);
    }
  }

  setSteering(cmd) {
    if (typeof cmd === "number") {
      this.steering = cmd > 0 ? 1 : cmd < 0 ? -1 : 0;
      this.steerMode = this.steering === 1 ? "up" : this.steering === -1 ? "down" : "hold";
    } else if (typeof cmd === "string") {
      const lower = cmd.toLowerCase();
      if (lower === "up" || lower === "build") {
        this.steering = 1;
        this.steerMode = "up";
      } else if (lower === "down" || lower === "drop") {
        this.steering = -1;
        this.steerMode = "down";
      } else {
        this.steering = 0;
        this.steerMode = "hold";
      }
    }
  }

  setSteerMode(mode) {
    this.setSteering(mode);
  }

  isInsidePayZone(tvd) {
    return tvd >= this.layers.payZone.top && tvd <= this.layers.payZone.bottom;
  }

  isSweetSpot(tvd) {
    return tvd >= this.layers.payZone.sweetSpotTop && tvd <= this.layers.payZone.sweetSpotBottom;
  }

  getGammaRayAt(tvd) {
    if (tvd < this.layers.overburden.bottom) {
      // Overburden shale: high gamma ray 100-140 API
      const norm = Math.max(0, Math.min(1, tvd / 1400));
      return 115.0 + Math.sin(norm * Math.PI * 4) * 10.0;
    }
    if (this.isSweetSpot(tvd)) {
      // Clean sweet-spot quartz sandstone: low radioactivity 25-45 API
      const distFromCenter = Math.abs(tvd - 1525) / 50;
      return 30.0 + distFromCenter * 10.0;
    }
    if (this.isInsidePayZone(tvd)) {
      // Marginal pay zone: 45-65 API
      return 52.0;
    }
    // Basal water aquifer: 80-110 API
    const depthOver = Math.min(1, (tvd - 1650) / 350);
    return 88.0 + depthOver * 12.0;
  }

  getFormationAt(tvd) {
    const gr = this.getGammaRayAt(tvd);
    const inPayZone = this.isInsidePayZone(tvd);
    const inSweetSpot = this.isSweetSpot(tvd);
    let layer = "overburden";
    if (inSweetSpot) layer = "sweet_spot";
    else if (inPayZone) layer = "marginal_pay";
    else if (tvd >= this.layers.basalWater.top) layer = "basal_water";

    return { layer, gr, inPayZone, inSweetSpot };
  }

  updateDrilling(dt) {
    if (this.phase !== "drilling" && this.phase !== "idle") return;
    const clampedDt = Math.max(0, Math.min(typeof dt === "number" && !isNaN(dt) ? dt : 0, 2.0));
    if (clampedDt <= 0) return;

    // Rate of Penetration modified by formation and bit wear
    const form = this.getFormationAt(this.bit.tvd);
    let layerRopMult = 1.0;
    if (form.inSweetSpot) layerRopMult = 1.25;
    else if (form.inPayZone) layerRopMult = 1.0;
    else if (this.bit.tvd < this.layers.overburden.bottom) layerRopMult = 0.65;
    else layerRopMult = 0.80;

    const baseRop = CONFIG.GEONAV?.DRILLING?.BASE_ROP ?? 12.0;
    this.bit.rop = baseRop * layerRopMult * Math.max(0.4, 1.0 - this.bit.wear * 0.5);

    // Kinematics: before KOP the drill string travels vertically
    if (this.bit.tvd < this.kop) {
      const deltaTvd = this.bit.rop * clampedDt;
      this.bit.tvd += deltaTvd;
      this.bit.md += deltaTvd;
      this.bit.inclination = 0.0;
      this.bit.dls = 0.0;
    } else {
      // Directional steering build/drop
      const maxDls = this.bit.dlsMax || 5.0; // deg per 30m
      const buildRateDegPerSec = 4.0; // °/s
      let targetIncDelta = 0;

      if (this.steering > 0) {
        targetIncDelta = buildRateDegPerSec * clampedDt;
      } else if (this.steering < 0) {
        targetIncDelta = -buildRateDegPerSec * clampedDt;
      }

      // Mechanical DLS clamping per step
      const stepDlsCap = Math.max(0.1, maxDls * clampedDt);
      const effectiveIncDelta = Math.max(-stepDlsCap, Math.min(stepDlsCap, targetIncDelta));
      const oldInc = this.bit.inclination;
      this.bit.inclination = Math.max(0.0, Math.min(110.0, oldInc + effectiveIncDelta));

      // Calculate instantaneous Dogleg Severity (deg / 30m)
      const dInc = Math.abs(this.bit.inclination - oldInc);
      const stepMd = Math.max(0.001, this.bit.rop * clampedDt);
      this.bit.dls = (dInc / stepMd) * 30.0;

      if (this.bit.dls > maxDls) {
        this.trauma = Math.min(1.0, this.trauma + 0.35);
        this.bit.wear += 0.002 * clampedDt;
      }

      // Spatial integration (inclination angle: 0 = down, 90 = right horizontal)
      const rad = (this.bit.inclination * Math.PI) / 180.0;
      const deltaX = stepMd * Math.sin(rad);
      const deltaTvd = stepMd * Math.cos(rad);

      this.bit.x += deltaX;
      this.bit.tvd += deltaTvd;
      this.bit.md += stepMd;

      // Track horizontal lateral metrics
      if (this.lateralLength > 0 || this.bit.inclination >= 75.0 || this.bit.tvd >= this.kop) {
        this.lateralLength += stepMd;
        if (form.inSweetSpot) {
          this.sweetSpotDistance += stepMd;
        }
        if (form.inPayZone) {
          this.payZoneDistance += stepMd;
        }
      }

      // Bit temperature thermodynamics
      this.bit.temp = Math.max(50.0, Math.min(160.0, this.bit.temp + (0.5 * this.bit.rop - 0.25 * (this.bit.temp - 60.0)) * clampedDt));
      this.bit.wear = Math.min(1.0, this.bit.wear + 0.0001 * stepMd);
    }

    // Record trajectory point
    const gr = this.getGammaRayAt(this.bit.tvd);
    const inSweet = this.isSweetSpot(this.bit.tvd);
    const inPay = this.isInsidePayZone(this.bit.tvd);

    this.trajectory.push({
      x: this.bit.x,
      tvd: this.bit.tvd,
      md: this.bit.md,
      inclination: this.bit.inclination,
      inSweetSpot: inSweet,
      inPayZone: inPay,
      dls: this.bit.dls
    });

    if (this.trajectory.length > 500) {
      this.trajectory.shift();
    }

    // Update real-time LWD history
    this.lwdHistory.push({
      md: this.bit.md,
      tvd: this.bit.tvd,
      gr,
      inSweetSpot: inSweet
    });
    if (this.lwdHistory.length > 120) {
      this.lwdHistory.shift();
    }

    // Retention % calculation
    if (this.lateralLength > 0) {
      this.retentionPct = Math.min(100.0, (this.sweetSpotDistance / this.lateralLength) * 100.0);
    }

    // Auto transition to fracing when target lateral length is achieved
    if (this.lateralLength >= this.targetLength && this.phase === "drilling") {
      this.finishDrilling();
    }
  }

  finishDrilling() {
    this.isDrilling = false;
    this.startFracing();
  }

  getGeonavScore() {
    if (this.lateralLength <= 0) return 1.0;
    const ratio = this.sweetSpotDistance / this.lateralLength;
    if (ratio >= 0.999) return 1.0;
    return Math.max(0.20, Math.min(1.0, ratio));
  }

  startFracing() {
    this.phase = "fracing";
    this.currentStageIndex = 0;
  }

  getCurrentStage() {
    return this.stages[this.currentStageIndex] || null;
  }

  updateFracing(dt) {
    if (this.phase !== "fracing") return;
    const clampedDt = Math.max(0, Math.min(dt, 0.1));
    if (clampedDt <= 0) return;

    const stage = this.getCurrentStage();
    if (!stage) return;

    stage.timer += clampedDt;
    const pumpRate = CONFIG.FRAC?.PUMP_RATE ?? 20.0;
    const pBreakdown = CONFIG.FRAC?.P_BREAKDOWN ?? 55.0;

    // Dynamic pressure curve accelerates under rock strain
    stage.pressure += pumpRate * (1.0 + (stage.pressure / pBreakdown) * 0.30) * clampedDt;

    // Emergency burst limit blowout hazard
    const pBurst = CONFIG.FRAC?.P_BURST_LIMIT ?? 75.0;
    const timeout = CONFIG.FRAC?.STAGE_TIMEOUT_SEC ?? 3.5;

    if (stage.pressure >= pBurst || stage.timer >= timeout) {
      // Overpressure emergency blowout
      stage.completed = true;
      stage.efficiency = 0.10;
      stage.zone = "blowout";
      this.trauma = 0.75;
      if (typeof audio?.vibrate === "function") audio.vibrate([120, 60, 150]);

      this.currentStageIndex++;
      if (this.currentStageIndex >= this.stages.length) {
        this.completeFracing();
      }
    }
  }

  triggerProppantInjection() {
    if (this.phase !== "fracing") return null;
    const stage = this.getCurrentStage();
    if (!stage) return null;

    const p = stage.pressure;
    let zone = "sweet_spot";
    let efficiency = 0.85;

    const pSweetMin = CONFIG.FRAC?.P_SWEET_MIN ?? 48.0;
    const pSweetMax = CONFIG.FRAC?.P_SWEET_MAX ?? 58.0;
    const pSweetOpt = CONFIG.FRAC?.P_SWEET_OPTIMAL ?? 53.0;

    if (p >= pSweetMin && p <= pSweetMax) {
      zone = "sweet_spot";
      const accuracy = 1.0 - Math.abs(p - pSweetOpt) / 5.0;
      efficiency = Math.max(0.85, Math.min(1.0, 0.85 + 0.15 * accuracy));
      this.trauma = 0.15;
      if (typeof audio?.playCoin === "function") audio.playCoin();
    } else if (p < pSweetMin) {
      zone = "underpressure";
      efficiency = Math.max(0.20, Math.min(0.65, ((p - 15.0) / 33.0) * 0.65));
      this.trauma = 0.25;
    } else if (p <= 68.0) {
      zone = "screenout";
      efficiency = Math.max(0.15, Math.min(0.60, 0.70 - ((p - 58.0) / 10.0) * 0.55));
      this.trauma = 0.45;
    } else {
      zone = "blowout";
      efficiency = 0.10;
      this.trauma = 0.75;
    }

    stage.completed = true;
    stage.efficiency = efficiency;
    stage.zone = zone;

    const result = {
      stageIndex: this.currentStageIndex,
      pressure: p,
      zone,
      efficiency
    };

    this.currentStageIndex++;
    if (this.currentStageIndex >= this.stages.length) {
      this.completeFracing();
    }

    return result;
  }

  getFracScore() {
    let total = 0;
    let count = 0;
    for (const stage of this.stages) {
      if (stage.completed) {
        total += stage.efficiency;
        count++;
      }
    }
    if (count === 0) return 0.10;
    return Math.max(0.10, Math.min(1.0, total / count));
  }

  completeFracing() {
    this.phase = "completed";
    this.isCompleted = true;

    const geonavScore = this.getGeonavScore();
    const fracScore = this.getFracScore();

    // Economic stimulation formula: raw = 1.0 + (geonav * 0.60 + frac * 0.90), clamped [1.25 .. 2.50]
    const rawMult = 1.0 + (geonavScore * 0.60 + fracScore * 0.90);
    const multiplier = Math.max(1.25, Math.min(2.50, rawMult));

    this.stimulationResult = {
      wellId: this.wellId,
      geonavScore,
      fracScore,
      multiplier,
      retentionPct: this.retentionPct
    };

    if (this.state && typeof this.state.applyWellStimulation === "function") {
      this.state.applyWellStimulation(this.wellId, multiplier, 240.0, {
        geonavScore,
        fracScore,
        stagesCompleted: this.stages.length
      });
    }

    if (this.state && typeof this.state.emit === "function") {
      this.state.emit("geonavCompleted", this.stimulationResult);
    }

    return this.stimulationResult;
  }

  update(dt) {
    const clampedDt = Math.max(0, Math.min(dt || 0, 0.1));
    this.trauma = Math.max(0, this.trauma - 1.5 * clampedDt);

    if (this.phase === "drilling") {
      this.updateDrilling(clampedDt);
    } else if (this.phase === "fracing") {
      this.updateFracing(clampedDt);
    }
  }

  getLwdReadout() {
    return {
      md: this.bit.md,
      tvd: this.bit.tvd,
      inclination: this.bit.inclination,
      rop: this.bit.rop,
      dls: this.bit.dls,
      wear: this.bit.wear,
      temp: this.bit.temp,
      gr: this.getGammaRayAt(this.bit.tvd),
      inSweetSpot: this.isSweetSpot(this.bit.tvd),
      inPayZone: this.isInsidePayZone(this.bit.tvd)
    };
  }

  render() {
    if (this.renderer) {
      this.renderer.render();
    }
  }

  destroy() {
    this.phase = "idle";
    this.isDrilling = false;
    this.renderer = null;
  }
}

export const ReservoirGeonavGame = GeonavGame;

/**
 * 2. CANVAS VISUAL RENDERER: GeonavCanvasRenderer
 */
export class GeonavCanvasRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.ctx = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width || 960;
    const h = this.canvas.height || 540;

    ctx.save();

    // Trauma screen shake
    if (this.game.trauma > 0) {
      const shakeAmt = Math.pow(this.game.trauma, 2) * 12.0;
      const ox = (Math.random() - 0.5) * shakeAmt;
      const oy = (Math.random() - 0.5) * shakeAmt;
      ctx.translate(ox, oy);
    }

    ctx.clearRect(0, 0, w, h);

    if (this.game.phase === "fracing" || this.game.phase === "completed") {
      this.renderFracingPhase(ctx, w, h);
    } else {
      this.renderDrillingPhase(ctx, w, h);
    }

    ctx.restore();
  }

  renderDrillingPhase(ctx, w, h) {
    const chartW = Math.round(w * 0.28);
    const mainW = w - chartW;

    // 1. Geological formations background
    this.renderFormations(ctx, mainW, h);

    // 2. Trajectory borehole path
    this.renderTrajectory(ctx, mainW, h);

    // 3. Drill bit and guidance corridor
    this.renderBit(ctx, mainW, h);

    // 4. LWD Gamma-Ray Strip Chart
    this.renderLwdChart(ctx, mainW, 0, chartW, h);

    // 5. Digital telemetry HUD overlay
    this.renderTelemetryOverlay(ctx, mainW, h);
  }

  renderFormations(ctx, w, h) {
    // Overburden cap shale (0 .. 1400m -> mapped to 0..25% height)
    const yOver = h * 0.25;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, w, yOver);

    // Target reservoir pay zone (1400 .. 1650m -> mapped to 25%..75% height)
    const yPayStart = yOver;
    const yPayHeight = h * 0.50;
    const grad = ctx.createLinearGradient(0, yPayStart, 0, yPayStart + yPayHeight);
    grad.addColorStop(0, "#78350f");
    grad.addColorStop(0.5, "#b45309");
    grad.addColorStop(1, "#78350f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, yPayStart, w, yPayHeight);

    // Sweet spot core corridor (1475 .. 1575m -> mapped to 35%..65% height)
    const ySweetStart = yPayStart + yPayHeight * 0.25;
    const ySweetHeight = yPayHeight * 0.50;
    ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
    ctx.fillRect(0, ySweetStart, w, ySweetHeight);

    // Sweet spot guideline bounds
    ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, ySweetStart);
    ctx.lineTo(w, ySweetStart);
    ctx.moveTo(0, ySweetStart + ySweetHeight);
    ctx.lineTo(w, ySweetStart + ySweetHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Basal water aquifer (> 1650m -> 75%..100% height)
    const yWater = yPayStart + yPayHeight;
    ctx.fillStyle = "#0e7490";
    ctx.fillRect(0, yWater, w, h - yWater);

    // Oil-water contact line (ВНК)
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, yWater);
    ctx.lineTo(w, yWater);
    ctx.stroke();

    // Formation Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("КРОВЛЯ: АРГИЛЛИТ / ГЛИНЫ (120 API)", 15, 25);
    ctx.fillStyle = "#fef08a";
    ctx.fillText("★ ЦЕЛЕВОЙ ПЛАСТ АС: СВИТ-СПОТ (30-45 API)", 15, ySweetStart + 20);
    ctx.fillStyle = "#a5f3fc";
    ctx.fillText("ПОДОШВА: ВОДОНОСНЫЙ ГОРИЗОНТ / ВНК (95 API)", 15, yWater + 20);
  }

  renderTrajectory(ctx, w, h) {
    const traj = this.game.trajectory;
    if (!traj || traj.length < 2) return;

    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Wellbore trajectory line
    for (let i = 1; i < traj.length; i++) {
      const p0 = this.mapBitCoords(traj[i - 1], w, h);
      const p1 = this.mapBitCoords(traj[i], w, h);

      ctx.strokeStyle = traj[i].inSweetSpot ? "#22c55e" : traj[i].inPayZone ? "#eab308" : "#ef4444";
      ctx.beginPath();
      ctx.moveTo(p0.cx, p0.cy);
      ctx.lineTo(p1.cx, p1.cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderBit(ctx, w, h) {
    const bitPos = this.mapBitCoords(this.game.bit, w, h);

    ctx.save();
    ctx.translate(bitPos.cx, bitPos.cy);
    ctx.rotate(((this.game.bit.inclination - 90) * Math.PI) / 180.0);

    // Rotating drill bit cutterhead
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  mapBitCoords(bit, w, h) {
    // Maps simulation bit coordinates { x, tvd } to canvas space
    // x maps from 0..800 to 40..w-40
    // tvd maps from 1350..1700 to 20..h-20
    const bitX = (bit && typeof bit.x === "number" && !isNaN(bit.x)) ? bit.x : 0;
    const normX = Math.max(0, Math.min(1.0, bitX / (this.game.targetLength || 800)));
    const cx = 50 + normX * (w - 100);

    const minTvd = 1350;
    const maxTvd = 1700;
    const tvd = (bit && typeof bit.tvd === "number" && !isNaN(bit.tvd)) ? bit.tvd : 1420;
    const normY = Math.max(0, Math.min(1.0, (tvd - minTvd) / (maxTvd - minTvd)));
    const cy = 30 + normY * (h - 60);

    return { cx, cy };
  }

  renderLwdChart(ctx, x, y, w, h) {
    // Strip chart panel background
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Header title
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("LWD ГАММА-КАРОТАЖ", x + 12, y + 22);

    // API scale track (0 to 150 API)
    const trackX = x + 15;
    const trackW = w - 30;
    const trackY = y + 40;
    const trackH = h - 60;

    // Sweet spot target zone stripe [25..45 API]
    const z1 = trackX + (25 / 150) * trackW;
    const z2 = trackX + (45 / 150) * trackW;
    ctx.fillStyle = "rgba(34, 197, 94, 0.20)";
    ctx.fillRect(z1, trackY, z2 - z1, trackH);

    // Grid markings
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    [0, 50, 100, 150].forEach(val => {
      const gx = trackX + (val / 150) * trackW;
      ctx.moveTo(gx, trackY);
      ctx.lineTo(gx, trackY + trackH);
    });
    ctx.stroke();

    // Gamma ray curve history
    const history = this.game.lwdHistory;
    if (history && history.length > 1) {
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const ptX = trackX + (Math.max(0, Math.min(150, item.gr)) / 150) * trackW;
        const ptY = trackY + (i / history.length) * trackH;
        if (i === 0) ctx.moveTo(ptX, ptY);
        else ctx.lineTo(ptX, ptY);
      }
      ctx.stroke();
    }

    // Digital Gamma Ray readout badge
    const curGr = this.game.getGammaRayAt(this.game.bit.tvd);
    ctx.fillStyle = curGr <= 45 ? "#22c55e" : curGr <= 75 ? "#eab308" : "#ef4444";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`${curGr.toFixed(1)} API`, x + 15, h - 15);
  }

  renderTelemetryOverlay(ctx, w, h) {
    const bit = this.game.bit;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(15, h - 55, 480, 42);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
    ctx.strokeRect(15, h - 55, 480, 42);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "11px monospace";
    ctx.fillText(`TVD: ${bit.tvd.toFixed(1)}м`, 25, h - 38);
    ctx.fillText(`MD: ${bit.md.toFixed(1)}м`, 125, h - 38);
    ctx.fillText(`УГОЛ: ${bit.inclination.toFixed(1)}°`, 225, h - 38);
    ctx.fillText(`DLS: ${bit.dls.toFixed(1)}°/30м`, 325, h - 38);

    ctx.fillStyle = this.game.retentionPct >= 80 ? "#22c55e" : "#f59e0b";
    ctx.fillText(`СВИТ-СПОТ: ${this.game.retentionPct.toFixed(1)}%`, 25, h - 20);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`ЗАБОЙ: ${Math.round(this.game.lateralLength)}/${this.game.targetLength}м`, 225, h - 20);
  }

  renderFracingPhase(ctx, w, h) {
    // Dark subterranean completion cavern backdrop
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    // Title banner
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("⚡ МНОГОСТАДИЙНЫЙ ГИДРОРАЗРЫВ ПЛАСТА (ГРП)", 30, 40);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText("Удерживайте давление в окне разрыва пласта и закачивайте проппант!", 30, 65);

    // Horizontal lateral schematic
    const latY = h * 0.45;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(60, latY);
    ctx.lineTo(w - 60, latY);
    ctx.stroke();

    // Render 4 completion stages along lateral
    const stages = this.game.stages;
    stages.forEach((st, idx) => {
      const sx = 60 + st.position * (w - 120);
      const isCur = idx === this.game.currentStageIndex;

      // Fracture cracks
      if (st.completed || isCur) {
        ctx.strokeStyle = st.zone === "sweet_spot" ? "#22c55e" : st.zone === "screenout" ? "#f97316" : "#ef4444";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, latY);
        ctx.lineTo(sx - 15, latY - 60);
        ctx.moveTo(sx, latY);
        ctx.lineTo(sx + 15, latY - 55);
        ctx.moveTo(sx, latY);
        ctx.lineTo(sx - 10, latY + 55);
        ctx.moveTo(sx, latY);
        ctx.lineTo(sx + 12, latY + 60);
        ctx.stroke();
      }

      // Stage node marker
      ctx.fillStyle = st.completed ? (st.zone === "sweet_spot" ? "#22c55e" : "#f59e0b") : isCur ? "#38bdf8" : "#334155";
      ctx.beginPath();
      ctx.arc(sx, latY, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`${idx + 1}`, sx - 4, latY + 4);
    });

    // Active stage pressure manometer bar
    const curStage = this.game.getCurrentStage();
    if (curStage) {
      this.renderPressureGauge(ctx, w, h, curStage);
    } else {
      // Completed summary
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 22px sans-serif";
      const mult = this.game.stimulationResult?.multiplier || 2.0;
      ctx.fillText(`🎉 ГРП УСПЕШНО ЗАВЕРШЕН! СУПЕР-БУСТ: x${mult.toFixed(2)} ДЕБИТА`, 60, h - 60);
    }
  }

  renderPressureGauge(ctx, w, h, stage) {
    const barX = 60;
    const barY = h - 100;
    const barW = w - 120;
    const barH = 34;

    // Bar background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(barX, barY, barW, barH);

    // Target Sweet-Spot Green Zone [48..58 MPa]
    const zMin = barX + (48.0 / 75.0) * barW;
    const zMax = barX + (58.0 / 75.0) * barW;
    ctx.fillStyle = "rgba(34, 197, 94, 0.45)";
    ctx.fillRect(zMin, barY, zMax - zMin, barH);

    // Screen-out Warning Zone [58..68 MPa]
    const sMax = barX + (68.0 / 75.0) * barW;
    ctx.fillStyle = "rgba(249, 115, 22, 0.45)";
    ctx.fillRect(zMax, barY, sMax - zMax, barH);

    // Overpressure Rupture Zone [>68 MPa]
    ctx.fillStyle = "rgba(239, 68, 68, 0.45)";
    ctx.fillRect(sMax, barY, barX + barW - sMax, barH);

    // Pressure Indicator Needle
    const curP = Math.min(75.0, stage.pressure);
    const needleX = barX + (curP / 75.0) * barW;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(needleX - 3, barY - 6, 6, barH + 12);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Gauge Labels
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`${stage.name} — ДАВЛЕНИЕ: ${curP.toFixed(1)} МПа`, barX, barY - 15);
    ctx.fillStyle = "#22c55e";
    ctx.fillText("ОПТИМАЛЬНО: [48..58 МПа]", zMin, barY + barH + 20);
  }
}

/**
 * 3. DOM & MODAL COORDINATOR: GeonavGameView
 */
export class GeonavGameView {
  constructor() {
    this.modal = null;
    this.canvas = null;
    this.game = null;
    this.animId = null;
    this.animFrameId = null;
    this.controlsBound = false;
    this.lastFrameTime = performance.now();
    this.isOpen = false;

    this.ensureModalDom();
    this.initEvents();
  }

  ensureModalDom() {
    let modal = document.getElementById("modal-geonav");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-geonav";
      modal.className = "modal-backdrop hidden";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "geonav-modal-title");

      modal.innerHTML = `
        <div class="modal-card geonav-modal-card" style="max-width: 980px; width: 95vw; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); user-select: none;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #0284c7; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">БУРЕНИЕ & ГРП</span>
              <h2 id="geonav-modal-title" style="margin: 0; font-size: 16px; color: #f8fafc; font-weight: 800;">ГЕОНАВИГАЦИЯ & РАЗРАБОТКА ПЛАСТА</h2>
            </div>
            <button id="btn-close-geonav" class="btn-sheet-close" type="button" aria-label="Закрыть" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
          </div>
          <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #020617; border-radius: 8px; overflow: hidden; border: 1px solid #1e293b;">
            <canvas id="geonav-canvas" width="960" height="540" style="width: 100%; height: 100%; display: block; -webkit-tap-highlight-color: transparent;"></canvas>
          </div>
          <div class="geonav-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; gap: 8px;">
              <button id="btn-geonav-up" type="button" style="background: #0284c7; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transform: scale(1); transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); user-select: none;">▲ НАБОР УГЛА</button>
              <button id="btn-geonav-hold" type="button" style="background: #334155; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transform: scale(1); transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); user-select: none;">► ГОРИЗОНТ</button>
              <button id="btn-geonav-down" type="button" style="background: #0284c7; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transform: scale(1); transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); user-select: none;">▼ СБРОС УГЛА</button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="btn-geonav-frac" type="button" style="background: #10b981; color: white; border: none; padding: 10px 22px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; box-shadow: 0 0 15px rgba(16,185,129,0.3); transform: scale(1); transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); user-select: none;">⚡ ЗАКАЧАТЬ ПРОППАНТ (ГРП)</button>
              <button id="btn-geonav-done" type="button" class="hidden" style="background: #22c55e; color: white; border: none; padding: 10px 22px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; box-shadow: 0 0 15px rgba(34,197,94,0.4); transform: scale(1); transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); user-select: none;">✅ ВЕРНУТЬСЯ К ПРОМЫСЛУ</button>
            </div>
          </div>
        </div>
      `;

      const target = document.getElementById("game-app") || document.body;
      target.appendChild(modal);
    }

    this.modal = modal;
    this.canvas = document.getElementById("geonav-canvas");

    this.btnUp = document.getElementById("btn-geonav-up");
    this.btnHold = document.getElementById("btn-geonav-hold");
    this.btnDown = document.getElementById("btn-geonav-down");
    this.btnFrac = document.getElementById("btn-geonav-frac");
    this.btnDone = document.getElementById("btn-geonav-done");
    this.btnClose = document.getElementById("btn-close-geonav");

    this.bindDomControls();
  }

  bindDomControls() {
    if (this.controlsBound) return;
    this.controlsBound = true;

    if (this.btnUp) {
      this.btnUp.addEventListener("click", () => {
        if (this.game) this.game.setSteering(1);
        if (typeof audio?.playTap === "function") audio.playTap();
      });
    }
    if (this.btnHold) {
      this.btnHold.addEventListener("click", () => {
        if (this.game) this.game.setSteering(0);
        if (typeof audio?.playTap === "function") audio.playTap();
      });
    }
    if (this.btnDown) {
      this.btnDown.addEventListener("click", () => {
        if (this.game) this.game.setSteering(-1);
        if (typeof audio?.playTap === "function") audio.playTap();
      });
    }
    if (this.btnFrac) {
      this.btnFrac.addEventListener("click", () => {
        if (this.game) {
          if (this.game.phase === "drilling") {
            this.game.finishDrilling();
          } else if (this.game.phase === "fracing") {
            this.game.triggerProppantInjection();
          } else if (this.game.phase === "completed") {
            this.close();
          }
        }
      });
    }
    if (this.btnDone) {
      this.btnDone.addEventListener("click", () => {
        this.close();
        if (typeof audio?.playTap === "function") audio.playTap();
      });
    }
    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.close());
    }

    // Keyboard bindings (Arrow keys, WASD, Spacebar)
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen || !this.game) return;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        this.game.setSteering(1);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        this.game.setSteering(-1);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        this.game.setSteering(0);
      } else if (e.code === "Space") {
        if (this.game.phase === "drilling") {
          this.game.finishDrilling();
        } else if (this.game.phase === "fracing") {
          this.game.triggerProppantInjection();
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        this.close();
      }
    });
  }

  initEvents() {
    state.on("openGeonavModal", (opts = {}) => {
      this.open(opts.wellId || "well_1");
    });
  }

  open(wellId = "well_1") {
    const cancelFn = typeof cancelAnimationFrame === "function" 
      ? cancelAnimationFrame 
      : (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame.bind(window) : (id) => clearTimeout(id));

    if (this.animFrameId) {
      cancelFn(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.animId) {
      cancelFn(this.animId);
      this.animId = null;
    }

    this.ensureModalDom();
    this.modal.classList.remove("hidden");
    this.isOpen = true;

    if (this.btnUp) this.btnUp.disabled = false;
    if (this.btnHold) this.btnHold.disabled = false;
    if (this.btnDown) this.btnDown.disabled = false;
    if (this.btnDone) this.btnDone.classList.add("hidden");
    if (this.btnFrac) {
      this.btnFrac.classList.remove("hidden");
      this.btnFrac.textContent = "⚡ ПЕРЕЙТИ К ГРП";
      this.btnFrac.style.background = "#0284c7";
    }

    this.game = new GeonavGame({
      canvas: this.canvas,
      wellId,
      state,
      startAtLanding: true
    });
    this.game.startHorizontalDrilling();

    this.lastFrameTime = performance.now();
    this.loop();
  }

  close() {
    if (this.modal) {
      this.modal.classList.add("hidden");
    }
    this.isOpen = false;
    const cancelFn = typeof cancelAnimationFrame === "function" 
      ? cancelAnimationFrame 
      : (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame.bind(window) : (id) => clearTimeout(id));

    if (this.animFrameId) {
      cancelFn(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.animId) {
      cancelFn(this.animId);
      this.animId = null;
    }
    if (this.game) {
      this.game.destroy();
      this.game = null;
    }
  }

  loop() {
    if (!this.isOpen) return;

    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = now;
    const dt = Math.min(Math.max(0, rawDt), 0.1);

    if (this.game) {
      this.game.update(dt);
      this.game.render();

      if (this.game.phase === "completed") {
        if (this.btnDone) this.btnDone.classList.remove("hidden");
        if (this.btnFrac) this.btnFrac.classList.add("hidden");
        if (this.btnUp) this.btnUp.disabled = true;
        if (this.btnHold) this.btnHold.disabled = true;
        if (this.btnDown) this.btnDown.disabled = true;
      } else {
        if (this.btnDone) this.btnDone.classList.add("hidden");
        if (this.btnFrac) {
          this.btnFrac.classList.remove("hidden");
          if (this.game.phase === "drilling") {
            this.btnFrac.textContent = "⚡ ПЕРЕЙТИ К ГРП";
            this.btnFrac.style.background = "#0284c7";
          } else if (this.game.phase === "fracing") {
            this.btnFrac.textContent = "⚡ ЗАКАЧАТЬ ПРОППАНТ (ГРП)";
            this.btnFrac.style.background = "#10b981";
          }
        }
      }
    }

    const rafFn = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : (cb) => setTimeout(cb, 16));

    this.animFrameId = rafFn(() => this.loop());
    this.animId = this.animFrameId;
  }

  destroy() {
    this.close();
  }
}

// Global auto-instantiation in browser context
export let geonavView = null;
if (typeof window !== "undefined" && typeof document !== "undefined") {
  geonavView = new GeonavGameView();
}
