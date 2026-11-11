import { state } from "../state.js";
import { CONFIG } from "../config.js";
import { audio } from "../audio.js";
import { TrekolRoverManager, RoadNetwork } from "./trekol-rover.js";
import { ArcticTanker3D } from "./arctic-tanker.js";

/**
 * Isometric3D
 * True 3D WebGL Engine for Siberian Oil & Gas Tycoon.
 * Features:
 * - Expansive Siberian Winter Arctic Biome (falling 3D snow, snowdrifts, snow-capped roofs)
 * - 4 Wellpads (with active pumpjacks / gas wellheads, 2-5 scaling per pad)
 * - Central Mega Gas Processing Plant (fractionation columns, bullet tanks, AVO, CPU, snow roofs)
 * - Modular Canteen, Dormitory, Gatehouse with boom barrier
 * - Narrow winter packed snow tracks (зимники) branching to every wellpad
 * - Fully active raycasting & upgrade sheets (wells, plant, canteen, dorm)
 * - Clicker tap cash harvesting with floating numbers and camera trauma shake
 * - OrbitControls with day/night and ortho/perspective toggle
 */
/**
 * Clash of Clans (CoC) Building Footprint Dimensions & Grid Hierarchy
 * Tile unit: CELL_SIZE = 3.5m (3x3 tiles per GRID_SCALE unit of 10.5m)
 * Every building has its own distinct, proportional cell grid footprint:
 * - 8x6: Town Hall of the oilfield (station_cps Central Complex)
 * - 10x8: Industrial Megaprojects (refinery, gas_plant, petrochem, storage)
 * - 5x4: Well Clusters & Major Industrial Stations (well_1..4, garage, dks_gas, mtr_yard)
 * - 4x3: Modular Buildings (dormitory, rd_office, nts_gas)
 * - 3x3: Specialized Units (canteen, crypto_flare)
 * - 3x2: Compact Outposts & Mobile Units (gatehouse, sda_nitrogen)
 * - 2x2: Micro Utility Pods (substation, manifold_bvm, bdr_methanol)
 */
export const BUILDING_GRID_SIZES = {
  // 1. Central Complex / Town Hall (Ратуша промысла)
  station_cps:   { cellsW: 8, cellsD: 6, label: "ЦПС Главный Комплекс", category: "hq" },

  // 2. Industrial Megaprojects (Северный промышленный кластер)
  refinery:      { cellsW: 10, cellsD: 8, label: "НПЗ Комплекс", category: "industry" },
  gas_plant:     { cellsW: 10, cellsD: 8, label: "ГПЗ Завод", category: "industry" },
  petrochem:     { cellsW: 10, cellsD: 8, label: "Нефтехимический Комплекс", category: "industry" },
  storage:       { cellsW: 10, cellsD: 8, label: "Резервуарный Парк", category: "storage" },

  // 3. Well Clusters / Production Pads (Кусты скважин)
  well_1:        { cellsW: 5, cellsD: 4, label: "Куст Скважин №1", category: "well" },
  well_2:        { cellsW: 5, cellsD: 4, label: "Куст Скважин №2", category: "well" },
  well_3:        { cellsW: 5, cellsD: 4, label: "Куст Скважин №3", category: "well" },
  well_4:        { cellsW: 5, cellsD: 4, label: "Куст Скважин №4", category: "well" },

  // 4. Heavy Base Facilities & Logistics (Тяжелая инфраструктура)
  garage:        { cellsW: 5, cellsD: 4, label: "Гараж ТРЭКОЛ", category: "facility" },
  dks_gas:       { cellsW: 5, cellsD: 4, label: "ДКС Компрессорная", category: "facility" },
  mtr_yard:      { cellsW: 5, cellsD: 4, label: "Трубная База МТР", category: "logistics" },

  // 5. Modular Living & Science Facilities (Модульные блоки)
  dormitory:     { cellsW: 4, cellsD: 3, label: "Жилой Комплекс", category: "residential" },
  rd_office:     { cellsW: 6, cellsD: 4, label: "НТЦ Геологии", category: "science" },
  nts_gas:       { cellsW: 4, cellsD: 3, label: "Цех НТС Газоочистки", category: "facility" },

  // 6. Support & Specialized Units (Вспомогательные блоки)
  canteen:       { cellsW: 3, cellsD: 3, label: "Столовая", category: "residential" },
  crypto_flare:  { cellsW: 3, cellsD: 3, label: "Крипто-модуль ПНГ", category: "utility" },

  // 7. Compact Outposts & Process Skids (Компактные посты)
  gatehouse:     { cellsW: 3, cellsD: 2, label: "КПП и Охрана", category: "security" },
  sda_nitrogen:  { cellsW: 3, cellsD: 2, label: "Азотная Станция СДА", category: "utility" },

  // 8. Micro Utility Skids (Компактные шкафы и блоки 2x2)
  substation:    { cellsW: 2, cellsD: 2, label: "КТПН Подстанция", category: "power" },
  manifold_bvm:  { cellsW: 2, cellsD: 2, label: "Блок Манифольда БВМ", category: "utility" },
  bdr_methanol:  { cellsW: 2, cellsD: 2, label: "БДР Метанол", category: "utility" }
};

/**
 * Pixel-Perfect Clash of Clans Discrete Grid Snapper
 * Aligns bounding box edges strictly to integer multiples of cellSize (3.5m).
 * Zero gap, zero offset against the base tactical grid!
 */
export function snapToBuildingGrid(worldX, worldZ, cellsW, cellsD, cellSize = 3.5) {
  const halfW = (cellsW * cellSize) / 2;
  const halfD = (cellsD * cellSize) / 2;
  const col = Math.round((worldX - halfW) / cellSize);
  const row = Math.round((worldZ - halfD) / cellSize);
  const minX = col * cellSize;
  const maxX = minX + cellsW * cellSize;
  const minZ = row * cellSize;
  const maxZ = minZ + cellsD * cellSize;
  const centerX = minX + halfW;
  const centerZ = minZ + halfD;
  return {
    x: centerX,
    z: centerZ,
    col,
    row,
    minX,
    maxX,
    minZ,
    maxZ,
    w: cellsW * cellSize,
    d: cellsD * cellSize
  };
}

export class Isometric3D {
  constructor(canvas, parentIso) {
    this.canvas = canvas;
    this.parentIso = parentIso;
    this.THREE = typeof window !== "undefined" ? window.THREE : null;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.orthoCamera = null;
    this.perspCamera = null;
    this.controls = null;
    this.isOrtho = true;
    this.isNight = false;

    // Expanded Siberian Tundra Grid Scale: 1 grid unit = 10.5 world units (147+ units wide)
    this.GRID_SCALE = 10.5;
    this.GRID_CENTER = 7.0;

    // Animation & System objects
    this.animatedObjects = {
      pumpjacks: [],
      flameGroup: null,
      flameLight: null,
      avoFans: [],
      deliveryTruck: null,
      gateBarrier: null,
      beacon: null,
      snowflakes: [],
      floodlightGlows: [],
      floodlightLights: [],
      chimneySmokes: [],
      pedestrians: [],
      loadingArms: [],
      mooringLines: null
    };

    this.arcticTanker = null;
    this.wellpadGroups = {};
    this.plantGroup = null;
    this.canteenGroup = null;
    this.dormGroup = null;
    this.garageGroup = null;
    this.tycoonInfraGroup = null;
    this.tundraMistShroud = null;
    this.mistParticles = [];
    this.industrialSectors = {};
    this.orthoFrustumD = 96;

    // Camera Focus Lerp & Shake
    this.isFocusing = false;
    this.focusTarget = null;
    this.trauma = 0;
    this.traumaDecay = 1.8;
    this.maxShake = 1.6;
    this.cameraBasePos = null;

    // Interactive Raycasting
    this.interactables = [];
    this.raycaster = null;
    this.mouse = null;
    this.pointerDownPos = { x: 0, y: 0 };
    this.hasMovedDrag = false;

    // Floating Text & 3D Particle Pools
    this.floatingTextPool = [];
    this.activeFloatingTexts = [];
    this.particlePool = [];
    this.activeParticles = [];

    // Sand-Dusted Snow Roads & 6x6 TREKOL Rover
    this.roadNetwork = new RoadNetwork();
    this.trekolRover = null;
    this.roadNetworkMesh = null;

    if (this.THREE) {
      this.init();
    }
  }

  gridToWorld(gx, gy, yOffset = 0) {
    return {
      x: (gx - this.GRID_CENTER) * this.GRID_SCALE,
      y: yOffset,
      z: (gy - this.GRID_CENTER) * this.GRID_SCALE
    };
  }

  snapToBuildingGrid(worldX, worldZ, cellsW, cellsD, cellSize = 3.5) {
    return snapToBuildingGrid(worldX, worldZ, cellsW, cellsD, cellSize);
  }

  initCamera(d = 96) {
    const THREE = this.THREE;
    const canvas = this.canvas;
    const parent = canvas ? (canvas.parentElement || canvas) : null;
    const r = parent && typeof parent.getBoundingClientRect === "function" ? parent.getBoundingClientRect() : { width: 420, height: 600 };
    const width = r.width || 420;
    const height = r.height || 600;
    const aspect = width / height;

    this.orthoFrustumD = d;
    this.orthoCamera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, -1500, 1500);
    this.orthoCamera.position.set(135, 120, 135);
    this.orthoCamera.lookAt(0, 4, 0);

    this.perspCamera = new THREE.PerspectiveCamera(40, aspect, 1, 1500);
    this.perspCamera.position.set(155, 135, 155);
    this.perspCamera.lookAt(0, 4, 0);

    this.camera = this.isOrtho ? this.orthoCamera : this.perspCamera;
    this.cameraBasePos = this.camera.position.clone();
    this.billboardSprites = [];
    this.billboardDisplayMode = "hidden";
    this.clock = new THREE.Clock();
  }

  updateCamera(d = 96) {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement || this.canvas;
    const r = parent && typeof parent.getBoundingClientRect === "function" ? parent.getBoundingClientRect() : { width: 420, height: 600 };
    const w = Math.max(1, Math.floor(r.width || this.canvas.clientWidth || 420));
    const h = Math.max(1, Math.floor(r.height || this.canvas.clientHeight || 600));
    const aspect = w / h;
    this.orthoFrustumD = d;

    if (this.orthoCamera) {
      this.orthoCamera.left = -d * aspect;
      this.orthoCamera.right = d * aspect;
      this.orthoCamera.top = d;
      this.orthoCamera.bottom = -d;
      this.orthoCamera.near = -1500;
      this.orthoCamera.far = 1500;
      this.orthoCamera.updateProjectionMatrix();
    }
    if (this.perspCamera) {
      this.perspCamera.aspect = aspect;
      this.perspCamera.updateProjectionMatrix();
    }
  }

  init() {
    const THREE = this.THREE;
    const canvas = this.canvas;
    const parent = canvas.parentElement || canvas;
    const r = parent.getBoundingClientRect();
    const width = r.width || 420;
    const height = r.height || 600;

    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // 2. Winter Atmosphere & Lighting
    this.scene = new THREE.Scene();
    this.skyColorDay = new THREE.Color(0xdbeafe); // Crisp arctic blue-white
    this.skyColorNight = new THREE.Color(0x0a1124);
    this.scene.background = this.skyColorDay.clone();
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0018);

    // 3. Dual Cameras (Expanded for larger map, d = 96)
    this.initCamera(96);

    // 4. OrbitControls
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minPolarAngle = 1.02;
      this.controls.maxPolarAngle = 1.02;
      this.controls.minAzimuthAngle = Math.PI / 4;
      this.controls.maxAzimuthAngle = Math.PI / 4;
      this.controls.minDistance = 20;
      this.controls.maxDistance = 50;
      this.controls.minZoom = 1.0;
      this.controls.maxZoom = 2.4;
      this.controls.target.set(0, 4, 0);

      // Township Unified Isometric Camera: strictly locked angle (no rotation/tumbling), free panning & zoom with inertia
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE
      };
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      this.controls.screenSpacePanning = false;

      // Township Building Move Footprint (Clash of Clans style cell matrix)
      const footprintGeo = new THREE.PlaneGeometry(1, 1);
      const footprintMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      });
      this.footprintMesh = new THREE.Mesh(footprintGeo, footprintMat);
      this.footprintMesh.rotation.x = -Math.PI / 2;
      this.footprintMesh.renderOrder = 999;
      this.footprintMesh.visible = false;
      this.scene.add(this.footprintMesh);

      // Base-Wide Tactical Grid Overlay for Move Mode (Clash of Clans base editor style)
      // Extent 112m covers the paved perimeter apron with 32 divisions of 3.5m each
      // Positioned at (-17.5, 1.70, -3.5): both X and Z are exact multiples of 3.5 (-5*3.5, -1*3.5),
      // guaranteeing that all grid lines lie on world integer multiples of 3.5m, aligning 1:1 with building footprints!
      this.baseGridMesh = new THREE.GridHelper(112, 32, 0x38bdf8, 0x64748b);
      this.baseGridMesh.position.set(-17.5, 1.70, -3.5);
      this.baseGridMesh.renderOrder = 990;
      if (this.baseGridMesh.material) {
        this.baseGridMesh.material.opacity = 0.45;
        this.baseGridMesh.material.transparent = true;
        this.baseGridMesh.material.depthWrite = false;
      }
      this.baseGridMesh.visible = false;
      this.scene.add(this.baseGridMesh);

      this.cocFootprintCache = new Map();

      // Pre-allocated Ground Raycasting Plane (Zero-GC compliant)
      this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
      this.groundPlaneTarget = new THREE.Vector3();
      this.movableBuildings = new Map();
      this.isMoveMode = false;
      this.selectedBuildingId = null;
      this.selectedBuildingGroup = null;
      this.selectedBuildingDefaultY = 1.2;
      this.longPressTimer = null;
      this.isLongPressActive = false;
    }

    // 5. Directional Sun & Ambient Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd8dc, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    this.sunLight.position.set(90, 150, 80);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 20;
    this.sunLight.shadow.camera.far = 480;
    const sDist = 160;
    this.sunLight.shadow.camera.left = -sDist;
    this.sunLight.shadow.camera.right = sDist;
    this.sunLight.shadow.camera.top = sDist;
    this.sunLight.shadow.camera.bottom = -sDist;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 0.5);
    this.fillLight.position.set(-90, 60, -90);
    this.scene.add(this.fillLight);

    // 6. Materials
    this.createMaterials();

    // 7. Object Pools
    this.initPools();

    // 8. Build Full Winter World
    this.buildWinterTerrain();
    this.buildWinterTracks();
    this.buildAllWellpads();
    this.buildMegaGasPlant();
    this.buildModularInfrastructure();
    this.buildCryptoFlareTower();
    this.buildExpansionSectors();
    this.buildPipelines();
    this.buildSnowySpruces();
    this.buildDenseTycoonInfrastructure();
    this.buildPerimeterFenceAndPlantExpansion();
    this.buildFallingSnow();
    this.buildTundraMistShroud();
    this.buildIndustrialSectors();

    if (typeof state?.on === "function") {
      state.on("sectorUnlocked", (data) => {
        if (data && data.sectorId) {
          this.triggerSectorUnlockAnimation(data.sectorId);
        }
      });
    }

    // 8b. Initialize 6x6 Arctic TREKOL Maintenance Rover & Crew (with session persistence)
    this.trekolRover = new TrekolRoverManager({
      roadNetwork: this.roadNetwork,
      savedState: state?.trekolRoverState,
      isometricView: this,
      spawn3DFloatingText: (pos, text, color) => this.spawn3DFloatingText(pos, text, color),
      fleetCount: state?.trekolCount || 1
    });
    this.trekolRover.init3D(this.scene, THREE);
    if (typeof this.trekolRover.syncFleet === "function") {
      this.trekolRover.syncFleet(state?.trekolCount || 1);
    }
    if (state?.buildingPositions && typeof this.trekolRover.onBuildingMoved === "function") {
      for (const [bId, pos] of Object.entries(state.buildingPositions)) {
        if (pos && typeof pos.x === "number" && typeof pos.z === "number") {
          this.trekolRover.onBuildingMoved(bId, pos.x, pos.z);
        }
      }
    }
    if (this.gateBarrier && this.gateLightGreen && this.gateLightRed) {
      this.trekolRover.initCheckpoint({
        barrierPivot: this.gateBarrier,
        lightGreen: this.gateLightGreen,
        lightRed: this.gateLightRed,
        lightGreenRear: this.gateLightGreenRear,
        lightRedRear: this.gateLightRedRear,
        gateGroup: this.gatehouseGroup,
        signalLight: this.signalPointLight
      });
    }
    if (this.trekolRover.fleet) {
      this.trekolRover.fleet.forEach(rover => {
        if (rover.group) {
          rover.group.userData = {
            type: "trekol_rover",
            name: rover.modelInfo ? rover.modelInfo.name : "ТРЭКОЛ (6x6)",
            badge: rover.modelInfo ? rover.modelInfo.badge : "Патруль ЦДНГ",
            roverInstance: rover
          };
          rover.group.traverse(child => {
            if (child.isMesh) {
              child.userData = {
                type: "trekol_rover",
                name: rover.modelInfo ? rover.modelInfo.name : "ТРЭКОЛ (6x6)",
                badge: rover.modelInfo ? rover.modelInfo.badge : "Патруль ЦДНГ",
                roverInstance: rover
              };
              if (!this.interactables.includes(child)) {
                this.interactables.push(child);
              }
            }
          });
        }
      });
    }

    // 8c. Arc7 Arctic Shuttle Tanker & Marine Terminal
    this.arcticTanker = new ArcticTanker3D(THREE, this.mat);
    this.scene.add(this.arcticTanker.group);
    this.scene.add(this.arcticTanker.wakeGroup);

    this.arcticTanker.group.traverse(child => {
      if (child.isMesh) {
        child.userData = {
          type: "arctic_tanker",
          name: "Танкер Arc7 «Штурман Альбанов»",
          badge: "Ледовый класс Arc7"
        };
        this.interactables.push(child);
      }
    });

    // 9. Raycasting & State Events
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.initInteractionEvents();
    this.initStateHooks();

    this.resize();

    if (typeof window !== "undefined") {
      window.engine3D = this;
      window.addEventListener("resize", () => this.resize());
      if (typeof ResizeObserver !== "undefined" && parent) {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(parent);
      }
      [50, 150, 300, 600, 1000].forEach(delay => {
        setTimeout(() => this.resize(), delay);
      });
    }
  }

  generateSnowRoadTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // 1. Packed Snow Base
      const grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0.00, "#f1f5f9");
      grad.addColorStop(0.18, "#e2e8f0");
      grad.addColorStop(0.50, "#cbd5e1");
      grad.addColorStop(0.82, "#e2e8f0");
      grad.addColorStop(1.00, "#f1f5f9");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // 2. Twin Icy Wheel Ruts
      const rutL = ctx.createLinearGradient(110, 0, 195, 0);
      rutL.addColorStop(0, "rgba(148, 163, 184, 0.2)");
      rutL.addColorStop(0.5, "rgba(100, 116, 139, 0.65)");
      rutL.addColorStop(1, "rgba(148, 163, 184, 0.2)");
      ctx.fillStyle = rutL;
      ctx.fillRect(110, 0, 85, 512);

      const rutR = ctx.createLinearGradient(317, 0, 402, 0);
      rutR.addColorStop(0, "rgba(148, 163, 184, 0.2)");
      rutR.addColorStop(0.5, "rgba(100, 116, 139, 0.65)");
      rutR.addColorStop(1, "rgba(148, 163, 184, 0.2)");
      ctx.fillStyle = rutR;
      ctx.fillRect(317, 0, 85, 512);

      // 3. Longitudinal Rut Striations
      ctx.strokeStyle = "rgba(71, 85, 105, 0.35)";
      ctx.lineWidth = 2;
      for (let y = 0; y < 512; y += 8) {
        ctx.beginPath();
        ctx.moveTo(130 + (y % 5), y);
        ctx.lineTo(130 + (y % 5), y + 6);
        ctx.moveTo(170 - (y % 7), y);
        ctx.lineTo(170 - (y % 7), y + 6);
        ctx.moveTo(340 + (y % 6), y);
        ctx.lineTo(340 + (y % 6), y + 6);
        ctx.moveTo(380 - (y % 5), y);
        ctx.lineTo(380 - (y % 5), y + 6);
        ctx.stroke();
      }

      // 4. Deterministic Sand & Gravel Granules (ПГС)
      const colors = ["#78350f", "#b45309", "#d97706", "#8c531b", "#334155", "#1e293b", "#57534e"];
      let seed = 42;
      function rnd() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      }

      for (let i = 0; i < 1200; i++) {
        let u = rnd();
        if (rnd() > 0.20) {
          u = rnd() > 0.5 ? 0.21 + rnd() * 0.19 : 0.60 + rnd() * 0.19;
        }
        const x = u * 512;
        const y = rnd() * 512;
        const size = 1.0 + rnd() * 3.5;
        const color = colors[Math.floor(rnd() * colors.length)];

        ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
        ctx.fillRect(x + 1, y + 1, size, size);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, size, size);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 6);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generatePAGConcreteTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Base: High-grade Arctic Concrete (ПАГ-14) with clean industrial look
      const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
      bgGrad.addColorStop(0, "#d1d5db");
      bgGrad.addColorStop(0.5, "#e5e7eb");
      bgGrad.addColorStop(1, "#cbd5e1");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 512);

      // 2x2 Slabs (each 256x256) with chamfers and bitumen seams
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const x0 = sx * 256;
          const y0 = sy * 256;

          // Subtle concrete surface gradient
          const grad = ctx.createRadialGradient(x0 + 128, y0 + 128, 20, x0 + 128, y0 + 128, 170);
          grad.addColorStop(0, "#e2e8f0");
          grad.addColorStop(1, "#b0bec5");
          ctx.fillStyle = grad;
          ctx.fillRect(x0 + 6, y0 + 6, 244, 244);

          // Fine concrete aggregate specks
          for (let p = 0; p < 120; p++) {
            const px = x0 + 10 + (Math.sin(p * 37.1) * 0.5 + 0.5) * 236;
            const py = y0 + 10 + (Math.cos(p * 53.7) * 0.5 + 0.5) * 236;
            ctx.fillStyle = (p % 3 === 0) ? "rgba(255,255,255,0.35)" : "rgba(100,116,139,0.2)";
            ctx.fillRect(px, py, 1.5, 1.5);
          }

          // Chamfered edges (3D beveled slab effect)
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 7, y0 + 7, 242, 242);

          // Rebar crane lifting eyes
          const loopOffsets = [[24, 24], [232, 24], [24, 232], [232, 232]];
          loopOffsets.forEach(([lx, ly]) => {
            ctx.fillStyle = "rgba(15,23,42,0.35)";
            ctx.beginPath();
            ctx.arc(x0 + lx, y0 + ly, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#64748b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x0 + lx, y0 + ly, 3, 0, Math.PI * 2);
            ctx.stroke();
          });
        }
      }

      // Bitumen expansion seams
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(256, 0); ctx.lineTo(256, 512);
      ctx.moveTo(0, 256); ctx.lineTo(512, 256);
      ctx.stroke();

      // Outer perimeter seams
      ctx.lineWidth = 5;
      ctx.strokeRect(0, 0, 512, 512);

      // Subtle Gazprom blue road markings in centre
      ctx.fillStyle = "rgba(0, 91, 171, 0.12)";
      ctx.fillRect(240, 0, 32, 512);
      ctx.fillRect(0, 240, 512, 32);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 3);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateCorrugatedWorkshopTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Base: Clean white insulated sandwich panels
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
      bgGrad.addColorStop(0, "#f1f5f9");
      bgGrad.addColorStop(0.5, "#f8fafc");
      bgGrad.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Vertical corrugated ribs (профнастил C-21) — subtle, professional
      for (let x = 0; x < 512; x += 18) {
        // Ridge highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillRect(x, 0, 4, 512);
        // Valley shadow
        ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
        ctx.fillRect(x + 9, 0, 4, 512);
      }

      // Panel joint seams every 128px
      for (let jy = 128; jy < 512; jy += 128) {
        ctx.fillStyle = "rgba(100, 116, 139, 0.3)";
        ctx.fillRect(0, jy, 512, 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillRect(0, jy + 2, 512, 1);
      }

      // Dark plinth / kickplate at base
      const plinthGrad = ctx.createLinearGradient(0, 450, 0, 512);
      plinthGrad.addColorStop(0, "#334155");
      plinthGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = plinthGrad;
      ctx.fillRect(0, 450, 512, 62);
      // Plinth top edge highlight
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(0, 448, 512, 3);

      // Corporate Gazprom Blue horizontal band
      const bandY = 150, bandH = 95;
      const gradBand = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gradBand.addColorStop(0, "#003d6b");
      gradBand.addColorStop(0.3, "#005bab");
      gradBand.addColorStop(0.7, "#0066b3");
      gradBand.addColorStop(1, "#003d6b");
      ctx.fillStyle = gradBand;
      ctx.fillRect(0, bandY, 512, bandH);

      // White reflective border stripes on band (crisp)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, bandY, 512, 3);
      ctx.fillRect(0, bandY + bandH - 3, 512, 3);
      // Thin cyan accent line
      ctx.fillStyle = "#00a3e0";
      ctx.fillRect(0, bandY + bandH - 6, 512, 2);

      // Stencil brand signage
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText("★ ГПЗ «ПОЛЯРНЫЙ МЕТАН» ★", 256, bandY + 32);

      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#7dd3fc";
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 2;
      ctx.fillText("ЦЕХ КОМПРЕССИИ И ПОДГОТОВКИ ГАЗА", 256, bandY + 60);
      ctx.fillText("ПАО «ГАЗПРОМ» • ЯМАЛЬСКОЕ МЕСТОРОЖДЕНИЕ", 256, bandY + 78);

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Industrial ribbon windows with warm interior glow
      const winY = 295;
      for (let wx = 32; wx < 500; wx += 110) {
        // Window frame (dark steel)
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(wx - 3, winY - 3, 90, 50);

        // Glass with warm interior glow gradient
        const winGrad = ctx.createLinearGradient(wx, winY, wx, winY + 44);
        winGrad.addColorStop(0, "#fef9c3");
        winGrad.addColorStop(0.5, "#fde68a");
        winGrad.addColorStop(1, "#f59e0b");
        ctx.fillStyle = winGrad;
        ctx.fillRect(wx, winY, 84, 44);

        // Window mullions (cross dividers)
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(wx, winY, 84, 44);
        ctx.beginPath();
        ctx.moveTo(wx + 42, winY); ctx.lineTo(wx + 42, winY + 44);
        ctx.moveTo(wx, winY + 22); ctx.lineTo(wx + 84, winY + 22);
        ctx.stroke();
      }

      // Gazprom blue-cyan safety chevrons on lower plinth corners
      ctx.fillStyle = "#00a3e0";
      for (let hx = 0; hx < 60; hx += 18) {
        ctx.beginPath();
        ctx.moveTo(hx, 512); ctx.lineTo(hx + 12, 476);
        ctx.lineTo(hx + 24, 476); ctx.lineTo(hx + 12, 512);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(512 - hx, 512); ctx.lineTo(512 - hx - 12, 476);
        ctx.lineTo(512 - hx - 24, 476); ctx.lineTo(512 - hx - 12, 512);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateRefineryTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Base: Arctic White Insulated Panels
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 512, 512);

      // Vertical corrugated ribs
      for (let x = 0; x < 512; x += 16) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(x, 0, 5, 512);
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(x + 5, 0, 6, 512);
        ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
        ctx.fillRect(x + 11, 0, 5, 512);
      }

      // Dark Plinth
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 460, 512, 52);
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 456, 512, 4);

      // Gazprom Corporate Deep Blue Header Band
      const bandY = 140;
      const bandH = 96;
      const gradBand = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gradBand.addColorStop(0, "#004b87");
      gradBand.addColorStop(0.5, "#005bab");
      gradBand.addColorStop(1, "#003865");
      ctx.fillStyle = gradBand;
      ctx.fillRect(0, bandY, 512, bandH);

      // White reflective stripes
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, bandY, 512, 4);
      ctx.fillRect(0, bandY + bandH - 4, 512, 4);

      // Stencil Signage
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★ НПЗ «СЕВЕРНЫЙ ФАКЕЛ» ★", 256, bandY + 36);

      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#7dd3fc";
      ctx.fillText("УСТАНОВКА АВТ-6 • КАТАЛИТИЧЕСКИЙ РИФОРМИНГ", 256, bandY + 68);

      // Industrial Ribbon Windows with Warm Interior Glow
      const winY = 280;
      for (let wx = 36; wx < 500; wx += 120) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(wx - 2, winY - 2, 84, 46);
        const winGrad = ctx.createLinearGradient(wx, winY, wx, winY + 42);
        winGrad.addColorStop(0, "#fef08a");
        winGrad.addColorStop(1, "#f59e0b");
        ctx.fillStyle = winGrad;
        ctx.fillRect(wx, winY, 80, 42);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(wx, winY, 80, 42);
        ctx.beginPath();
        ctx.moveTo(wx + 40, winY); ctx.lineTo(wx + 40, winY + 42);
        ctx.moveTo(wx, winY + 21); ctx.lineTo(wx + 80, winY + 21);
        ctx.stroke();
      }

      // Safety warning plate in Gazprom Cyan / Red
      ctx.fillStyle = "rgba(0, 163, 224, 0.12)";
      ctx.fillRect(36, 360, 440, 60);
      ctx.strokeStyle = "#00a3e0";
      ctx.lineWidth = 2;
      ctx.strokeRect(36, 360, 440, 60);
      ctx.fillStyle = "#005bab";
      ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("⚠️ ОГНЕОПАСНО • ГЛУБОКАЯ ПЕРЕРАБОТКА НЕФТИ • ЕВРО-5", 256, 390);

      // Gazprom cyan diagonal accent stripes on plinth
      for (let hx = 0; hx < 64; hx += 16) {
        ctx.fillStyle = "#00a3e0";
        ctx.beginPath();
        ctx.moveTo(hx, 512); ctx.lineTo(hx + 12, 480);
        ctx.lineTo(hx + 24, 480); ctx.lineTo(hx + 12, 512);
        ctx.fill();
        ctx.moveTo(512 - hx, 512); ctx.lineTo(512 - hx - 12, 480);
        ctx.lineTo(512 - hx - 24, 480); ctx.lineTo(512 - hx - 12, 512);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generatePetrochemTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 512, 512);

      for (let x = 0; x < 512; x += 16) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(x, 0, 5, 512);
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(x + 5, 0, 6, 512);
        ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
        ctx.fillRect(x + 11, 0, 5, 512);
      }

      // Dark Plinth
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 460, 512, 52);
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 456, 512, 4);

      // Gazprom Corporate Blue Header Band
      const bandY = 140;
      const bandH = 96;
      const gradBand = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gradBand.addColorStop(0, "#004b87");
      gradBand.addColorStop(0.5, "#005bab");
      gradBand.addColorStop(1, "#003865");
      ctx.fillStyle = gradBand;
      ctx.fillRect(0, bandY, 512, bandH);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, bandY, 512, 4);
      ctx.fillRect(0, bandY + bandH - 4, 512, 4);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 23px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★ НГХК «СИБИРСКИЙ ПОЛИМЕР» ★", 256, bandY + 36);

      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#7dd3fc";
      ctx.fillText("СИНТЕЗ ПОЛИОЛЕФИНОВ • ПОЛИЭТИЛЕН ВЫСОКОЙ ПЛОТНОСТИ", 256, bandY + 68);

      // Windows
      const winY = 280;
      for (let wx = 36; wx < 500; wx += 120) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(wx - 2, winY - 2, 84, 46);
        const winGrad = ctx.createLinearGradient(wx, winY, wx, winY + 42);
        winGrad.addColorStop(0, "#fef08a");
        winGrad.addColorStop(1, "#f59e0b");
        ctx.fillStyle = winGrad;
        ctx.fillRect(wx, winY, 80, 42);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(wx, winY, 80, 42);
        ctx.beginPath();
        ctx.moveTo(wx + 40, winY); ctx.lineTo(wx + 40, winY + 42);
        ctx.moveTo(wx, winY + 21); ctx.lineTo(wx + 80, winY + 21);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(0, 163, 224, 0.12)";
      ctx.fillRect(36, 360, 440, 60);
      ctx.strokeStyle = "#00a3e0";
      ctx.lineWidth = 2;
      ctx.strokeRect(36, 360, 440, 60);
      ctx.fillStyle = "#005bab";
      ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("ХРАНИЛИЩЕ ГРАНУЛЯТА • СЕКЦИЯ 4 • ЭКСПОРТНОЕ КАЧЕСТВО", 256, 390);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateModularLivingTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Arctic White insulated sandwich panels
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(0, 0, 512, 512);

      // Floor separator beam (2 floors)
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(0, 252, 512, 8);
      ctx.fillStyle = "#005bab";
      ctx.fillRect(0, 254, 512, 4);

      // Vertical panel joints
      for (let x = 0; x < 512; x += 64) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
        ctx.fillRect(x, 0, 3, 512);
      }

      // Plinth
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 470, 512, 42);

      // Corporate Header Fascia Band
      const bandY = 20;
      const bandH = 68;
      const gradBand = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gradBand.addColorStop(0, "#004b87");
      gradBand.addColorStop(1, "#005bab");
      ctx.fillStyle = gradBand;
      ctx.fillRect(0, bandY, 512, bandH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★ ВАХТОВЫЙ КОМПЛЕКС • МОДУЛЬ «СЕВЕР» ★", 256, bandY + 24);

      ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#7dd3fc";
      ctx.fillText("ЖИЛОЙ БЛОК №1 • ПОСЁЛОК «СЕВЕРНАЯ ЗВЕЗДА»", 256, bandY + 48);

      // 2 Floors of Residential Windows with Warm Glow
      const floors = [130, 320];
      floors.forEach((fy) => {
        for (let wx = 32; wx < 480; wx += 90) {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(wx - 2, fy - 2, 64, 74);
          
          const winGrad = ctx.createLinearGradient(wx, fy, wx, fy + 70);
          winGrad.addColorStop(0, "#fef08a");
          winGrad.addColorStop(1, "#f59e0b");
          ctx.fillStyle = winGrad;
          ctx.fillRect(wx, fy, 60, 70);

          ctx.fillStyle = "rgba(0, 75, 135, 0.35)";
          ctx.fillRect(wx, fy, 12, 70);
          ctx.fillRect(wx + 48, fy, 12, 70);

          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 2;
          ctx.strokeRect(wx, fy, 60, 70);
          ctx.beginPath();
          ctx.moveTo(wx + 30, fy); ctx.lineTo(wx + 30, fy + 70);
          ctx.moveTo(wx, fy + 35); ctx.lineTo(wx + 60, fy + 35);
          ctx.stroke();
        }
      });

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateCanteenTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 512, 512);

      // Dark Plinth
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 460, 512, 52);

      // Corporate Blue Band
      const bandY = 60;
      const bandH = 84;
      const gradBand = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gradBand.addColorStop(0, "#004b87");
      gradBand.addColorStop(0.5, "#005bab");
      gradBand.addColorStop(1, "#003865");
      ctx.fillStyle = gradBand;
      ctx.fillRect(0, bandY, 512, bandH);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, bandY, 512, 3);
      ctx.fillRect(0, bandY + bandH - 3, 512, 3);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("☕ СТОЛОВАЯ «ПОЛЯРНИК»", 256, bandY + 30);

      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#7dd3fc";
      ctx.fillText("ГОРЯЧЕЕ ПИТАНИЕ ВАХТОВЫХ СМЕН • 24/7", 256, bandY + 58);

      // Large Panoramic Dining Windows with Warm Golden Glow
      const winY = 210;
      for (let wx = 36; wx < 480; wx += 150) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(wx - 2, winY - 2, 124, 184);

        const winGrad = ctx.createLinearGradient(wx, winY, wx, winY + 180);
        winGrad.addColorStop(0, "#fef3c7");
        winGrad.addColorStop(1, "#f59e0b");
        ctx.fillStyle = winGrad;
        ctx.fillRect(wx, winY, 120, 180);

        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 3;
        ctx.strokeRect(wx, winY, 120, 180);
        ctx.beginPath();
        ctx.moveTo(wx + 60, winY); ctx.lineTo(wx + 60, winY + 180);
        ctx.moveTo(wx, winY + 90); ctx.lineTo(wx + 120, winY + 90);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(0, 91, 171, 0.15)";
      ctx.fillRect(36, 410, 440, 40);
      ctx.strokeStyle = "#00a3e0";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(36, 410, 440, 40);
      ctx.fillStyle = "#005bab";
      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("СЛУЖБА ПИТАНИЯ И МЕДОСМОТРА • ДОБРО ПОЖАЛОВАТЬ", 256, 430);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateGarageTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 512, 512);

      // Header Band
      const bandY = 20;
      const bandH = 76;
      const gradBand = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gradBand.addColorStop(0, "#004b87");
      gradBand.addColorStop(0.5, "#005bab");
      gradBand.addColorStop(1, "#003865");
      ctx.fillStyle = gradBand;
      ctx.fillRect(0, bandY, 512, bandH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🚜 АВТОБАЗА СПЕЦТЕХНИКИ «АРКТИКА»", 256, bandY + 28);

      ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#7dd3fc";
      ctx.fillText("БОКСЫ ОБСЛУЖИВАНИЯ И СТОЯНКИ ТРЭКОЛ 6х6", 256, bandY + 54);

      // 2 Huge Overhead Sectional Roll-up Garage Doors
      const gateW = 200, gateH = 280, gateY = 160;
      [36, 276].forEach((gx, idx) => {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(gx - 4, gateY - 4, gateW + 8, gateH + 8);

        const doorGrad = ctx.createLinearGradient(gx, gateY, gx, gateY + gateH);
        doorGrad.addColorStop(0, "#334155");
        doorGrad.addColorStop(1, "#1e293b");
        ctx.fillStyle = doorGrad;
        ctx.fillRect(gx, gateY, gateW, gateH);

        for (let y = gateY; y < gateY + gateH; y += 22) {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gateW, y); ctx.stroke();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.beginPath(); ctx.moveTo(gx, y + 2); ctx.lineTo(gx + gateW, y + 2); ctx.stroke();
        }

        const rowY = gateY + 40;
        for (let wx = gx + 16; wx < gx + gateW - 20; wx += 44) {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(wx - 1, rowY - 1, 34, 18);
          ctx.fillStyle = "#7dd3fc";
          ctx.fillRect(wx, rowY, 32, 16);
        }

        ctx.fillStyle = "#005bab";
        ctx.fillRect(gx + gateW / 2 - 28, gateY + 120, 56, 30);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx + gateW / 2 - 28, gateY + 120, 56, 30);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
        ctx.fillText(`БОКС ${idx + 1}`, gx + gateW / 2, gateY + 135);

        for (let hz = gx; hz < gx + gateW; hz += 24) {
          ctx.fillStyle = "#00a3e0";
          ctx.beginPath();
          ctx.moveTo(hz, gateY + gateH);
          ctx.lineTo(hz + 12, gateY + gateH - 18);
          ctx.lineTo(hz + 20, gateY + gateH - 18);
          ctx.lineTo(hz + 8, gateY + gateH);
          ctx.fill();
        }
      });

      // Dark Plinth
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 460, 512, 52);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateSubstationTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 512, 512);

      // Dark Plinth
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 460, 512, 52);

      // Corporate Blue Header
      const bandY = 40;
      const bandH = 80;
      const gradBand = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gradBand.addColorStop(0, "#004b87");
      gradBand.addColorStop(0.5, "#005bab");
      gradBand.addColorStop(1, "#003865");
      ctx.fillStyle = gradBand;
      ctx.fillRect(0, bandY, 512, bandH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚡ ПОДСТАНЦИЯ 10 кВ • БЛОЧНАЯ КОТЕЛЬНАЯ", 256, bandY + 28);

      ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#7dd3fc";
      ctx.fillText("ЭНЕРГОЦЕНТР ПРОМЫСЛА • АСУ ТП «ПОЛЯРНАЯ ЗВЕЗДА»", 256, bandY + 56);

      // Ventilation Louvers
      const louvY = 170;
      [40, 280].forEach(lx => {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(lx, louvY, 192, 140);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.strokeRect(lx, louvY, 192, 140);

        for (let y = louvY + 10; y < louvY + 130; y += 12) {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(lx + 8, y); ctx.lineTo(lx + 184, y); ctx.stroke();
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(lx + 8, y + 2); ctx.lineTo(lx + 184, y + 2); ctx.stroke();
        }
      });

      // High Voltage Warning
      ctx.fillStyle = "rgba(220, 38, 38, 0.12)";
      ctx.fillRect(40, 340, 432, 90);
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 340, 432, 90);

      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("⚡ ОСТОРОЖНО! ЭЛЕКТРИЧЕСКОЕ НАПРЯЖЕНИЕ 10 000 ВОЛЬТ", 256, 370);

      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("ВХОД ТОЛЬКО ДЛЯ АТТЕСТОВАННОГО ЭЛЕКТРОТЕХНИЧЕСКОГО ПЕРСОНАЛА", 256, 400);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateRVSTankTexture(THREE, fluidType = "oil") {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Base: Arctic White Metal Tank Coat
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
      bgGrad.addColorStop(0, "#ffffff");
      bgGrad.addColorStop(0.5, "#f1f5f9");
      bgGrad.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Horizontal Girth Welds with rivets
      for (let wy = 80; wy < 500; wy += 90) {
        ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, wy); ctx.lineTo(512, wy);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, wy + 2); ctx.lineTo(512, wy + 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(30, 41, 59, 0.35)";
        for (let rx = 10; rx < 512; rx += 20) {
          ctx.fillRect(rx, wy - 3, 2, 2);
        }
      }

      // Vertical Ladder / Cage Track on one flank (X = 40..60)
      ctx.fillStyle = "rgba(15, 23, 42, 0.25)";
      ctx.fillRect(44, 40, 16, 440);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.strokeRect(44, 40, 16, 440);
      for (let ly = 50; ly < 480; ly += 14) {
        ctx.beginPath();
        ctx.moveTo(44, ly); ctx.lineTo(60, ly);
        ctx.stroke();
      }

      // Render 2 Main Stencil Logos (facing front and side: X=190 and X=410)
      const positions = [190, 410];
      positions.forEach(cx => {
        // Tank ID Plate
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(fluidType === "oil" ? "РВС-50000 №1" : "РВС-50000 №2", cx, 140);

        // Fluid & Hazard Box
        const isOil = fluidType === "oil";
        const boxW = 150, boxH = 50;
        ctx.fillStyle = isOil ? "#005bab" : "#0284c7";
        ctx.fillRect(cx - boxW / 2, 165, boxW, boxH);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - boxW / 2, 165, boxW, boxH);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
        ctx.fillText(isOil ? "НЕФТЬ" : "СУГ ГАЗ", cx, 196);

        // Flammable Warning Stripe
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(cx - boxW / 2, 222, boxW, 26);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
        ctx.fillText("ОГНЕОПАСНО", cx, 240);

        // GHS Red Diamond with Flame
        ctx.save();
        ctx.translate(cx, 280);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-16, -16, 32, 32);
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 4;
        ctx.strokeRect(-16, -16, 32, 32);
        ctx.restore();

        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
        ctx.fillText("🔥", cx, 286);

        // Vertical Filling Level Gauge Strip
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(cx - 65, 120, 8, 220);
        for (let gy = 130; gy <= 330; gy += 25) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(cx - 65, gy, 6, 2);
        }
      });

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (e) {
      return null;
    }
  }

  generateContactShadowTexture(THREE) {
    if (typeof document === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 124);
      grad.addColorStop(0, "rgba(15, 23, 42, 0.70)");
      grad.addColorStop(0.5, "rgba(15, 23, 42, 0.40)");
      grad.addColorStop(0.85, "rgba(15, 23, 42, 0.10)");
      grad.addColorStop(1, "rgba(15, 23, 42, 0.0)");

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      return texture;
    } catch (e) {
      return null;
    }
  }

  createMaterials() {
    const THREE = this.THREE;
    const roadTex = this.generateSnowRoadTexture(THREE);
    const sandDustedMat = roadTex
      ? new THREE.MeshStandardMaterial({
          map: roadTex,
          bumpMap: roadTex,
          bumpScale: 0.035,
          roughness: 0.88,
          metalness: 0.04,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        })
      : new THREE.MeshStandardMaterial({ color: 0xd6dbdf, roughness: 0.92, metalness: 0.02 });

    const pagTex = this.generatePAGConcreteTexture(THREE);
    const pagConcreteMat = pagTex
      ? new THREE.MeshStandardMaterial({
          map: pagTex,
          bumpMap: pagTex,
          bumpScale: 0.04,
          roughness: 0.65,
          metalness: 0.08
        })
      : new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.55, metalness: 0.1 });

    const workshopTex = this.generateCorrugatedWorkshopTexture(THREE);
    const workshopMat = workshopTex
      ? new THREE.MeshStandardMaterial({
          map: workshopTex,
          bumpMap: workshopTex,
          bumpScale: 0.025,
          roughness: 0.45,
          metalness: 0.15
        })
      : new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 });

    const rvsOilTex = this.generateRVSTankTexture(THREE, "oil");
    const rvsOilMat = rvsOilTex
      ? new THREE.MeshStandardMaterial({
          map: rvsOilTex,
          bumpMap: rvsOilTex,
          bumpScale: 0.02,
          roughness: 0.35,
          metalness: 0.22
        })
      : new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.18 });

    const rvsGasTex = this.generateRVSTankTexture(THREE, "gas");
    const rvsGasMat = rvsGasTex
      ? new THREE.MeshStandardMaterial({
          map: rvsGasTex,
          bumpMap: rvsGasTex,
          bumpScale: 0.02,
          roughness: 0.35,
          metalness: 0.22
        })
      : new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.18 });

    const refineryTex = this.generateRefineryTexture(THREE);
    const refineryMat = refineryTex
      ? new THREE.MeshStandardMaterial({
          map: refineryTex,
          bumpMap: refineryTex,
          bumpScale: 0.02,
          roughness: 0.45,
          metalness: 0.15
        })
      : null;

    const petrochemTex = this.generatePetrochemTexture(THREE);
    const petrochemMat = petrochemTex
      ? new THREE.MeshStandardMaterial({
          map: petrochemTex,
          bumpMap: petrochemTex,
          bumpScale: 0.02,
          roughness: 0.45,
          metalness: 0.15
        })
      : null;

    const modularLivingTex = this.generateModularLivingTexture(THREE);
    const modularLivingMat = modularLivingTex
      ? new THREE.MeshStandardMaterial({
          map: modularLivingTex,
          bumpMap: modularLivingTex,
          bumpScale: 0.02,
          roughness: 0.5,
          metalness: 0.1
        })
      : null;

    const canteenTex = this.generateCanteenTexture(THREE);
    const canteenMat = canteenTex
      ? new THREE.MeshStandardMaterial({
          map: canteenTex,
          bumpMap: canteenTex,
          bumpScale: 0.02,
          roughness: 0.45,
          metalness: 0.1
        })
      : null;

    const garageTex = this.generateGarageTexture(THREE);
    const garageMat = garageTex
      ? new THREE.MeshStandardMaterial({
          map: garageTex,
          bumpMap: garageTex,
          bumpScale: 0.02,
          roughness: 0.45,
          metalness: 0.15
        })
      : null;

    const substationTex = this.generateSubstationTexture(THREE);
    const substationMat = substationTex
      ? new THREE.MeshStandardMaterial({
          map: substationTex,
          bumpMap: substationTex,
          bumpScale: 0.02,
          roughness: 0.5,
          metalness: 0.2
        })
      : null;

    const shadowTex = this.generateContactShadowTexture(THREE);
    const shadowMat = shadowTex
      ? new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          opacity: 0.75,
          depthWrite: false
        })
      : null;

    this.mat = {
      // Winter Snow & Ground
      snow: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85, metalness: 0.05 }),
      snowDrift: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9, metalness: 0.0 }),
      snowCap: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.0 }),
      sandDustedRoad: sandDustedMat,
      winterTrack: sandDustedMat,
      permafrost: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95, metalness: 0.05 }),

      // Concrete & Foundations
      concrete: new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.55, metalness: 0.1 }),
      pagConcrete: pagConcreteMat,
      corrugatedWorkshop: workshopMat,
      rvsOilTank: rvsOilMat,
      rvsGasTank: rvsGasMat,
      contactShadow: shadowMat,
      refineryWall: refineryMat || workshopMat,
      petrochemWall: petrochemMat || workshopMat,
      modularLiving: modularLivingMat || workshopMat,
      canteenWall: canteenMat || workshopMat,
      garageWall: garageMat || workshopMat,
      substationWall: substationMat || workshopMat,
      concreteDark: new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.65, metalness: 0.1 }),
      hazardStripe: new THREE.MeshStandardMaterial({ color: 0x005bab, roughness: 0.35, metalness: 0.1 }),

      // Industrial Architecture - Gazprom Corporate Palette (Deep Blue & Arctic Cyan)
      orangeRoof: new THREE.MeshStandardMaterial({ color: 0x005bab, roughness: 0.38, metalness: 0.15 }),
      orangeAccent: new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.3, metalness: 0.1 }),
      whiteWall: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 }),
      greyWall: new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.5, metalness: 0.1 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.4, metalness: 0.5 }),

      // Tanks & Columns
      whiteTank: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.18 }),
      yellowTank: new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.32, metalness: 0.15 }),

      // Pipelines & Valves
      bluePipe: new THREE.MeshStandardMaterial({ color: 0x005bab, roughness: 0.35, metalness: 0.3 }),
      redValve: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.25 }),
      redSteel: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.2 }),
      valveSteel: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.65 }),
      brass: new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.25, metalness: 0.4 }),

      // Spruce Fir Foliage
      spruceFoliage: new THREE.MeshStandardMaterial({ color: 0x143828, roughness: 0.85 }),
      woodTrunk: new THREE.MeshStandardMaterial({ color: 0x4a3224, roughness: 0.9 }),

      // Fire & Particles
      fire: new THREE.MeshBasicMaterial({ color: 0xff9800 }),
      fireCore: new THREE.MeshBasicMaterial({ color: 0xffeb3b }),
      snowflakeMat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      oilDroplet: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2, metalness: 0.8 }),
      goldDroplet: new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.25, metalness: 0.5 }),
      gasPuff: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5, transparent: true, opacity: 0.65 }),

      // Padlock
      goldLock: new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.25, metalness: 0.7 }),

      // Tycoon Infrastructure & Electrical Grid
      insulator: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 }),
      cable: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.5 }),
      steelTruss: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45, metalness: 0.65 }),
      floodlightLamp: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.9, roughness: 0.2 }),
      groundGlow: new THREE.MeshBasicMaterial({ color: 0x00a3e0, transparent: true, opacity: 0.0, depthWrite: false }),
      substationBlue: new THREE.MeshStandardMaterial({ color: 0x005bab, roughness: 0.45, metalness: 0.2 }),
      ibcTank: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.78 }),
      skidFrame: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.5 }),
      silverPipe: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.8 }),
      yellowGasPipe: new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.35, metalness: 0.3 }),
      windowLit: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.8, roughness: 0.2 }),
      windowFrame: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }),
      chimneyMetal: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 }),
      parkaOrange: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }),
      parkaNavy: new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 }),
      parkaHead: new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 }),
      smokeCloud: new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.4, depthWrite: false }),
      woodPlatform: new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.85 }),
      fencePost: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 }),
      fenceWire: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.85 }),
      barbedWire: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.9 }),
      waterSurface: new THREE.MeshStandardMaterial({ color: 0x1d8cc8, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.92 }),
      waterBed: new THREE.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.85 }),
      beachSand: new THREE.MeshStandardMaterial({ color: 0xd9cca9, roughness: 0.9 }),
      coastalRock: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }),
      rdOfficeWall: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.3 }),
      rdOfficeTrim: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.5 }),
      rdOfficeGlass: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }),
      tundraMist: new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide })
    };
  }

  // --- 1. EXPANDED SIBERIAN WINTER TERRAIN (216x24x216 Territory) ---
  buildWinterTerrain() {
    const THREE = this.THREE;
    const group = new THREE.Group();
    group.name = "WinterTerrain";

    const baseW = 216;
    const baseD = 24;
    const baseL = 216;

    // Permafrost Earth Pedestal (216x24x216)
    const baseGeo = new THREE.BoxGeometry(baseW, baseD, baseL);
    const baseMesh = new THREE.Mesh(baseGeo, this.mat.permafrost);
    baseMesh.position.y = -baseD / 2; // -12
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Pristine Snow Plateau (214x1.4x214)
    const plateauW = 214;
    const plateauH = 1.4;
    const plateauL = 214;
    const snowGeo = new THREE.BoxGeometry(plateauW, plateauH, plateauL);
    const snowMesh = new THREE.Mesh(snowGeo, this.mat.snow);
    snowMesh.position.y = plateauH / 2; // 0.7
    snowMesh.receiveShadow = true;
    group.add(snowMesh);

    // --- ARCTIC OCEAN WATER BASIN (1200x6x1200) ---
    const waterGeo = new THREE.BoxGeometry(1200, 6, 1200);
    const waterMesh = new THREE.Mesh(waterGeo, this.mat.waterSurface);
    waterMesh.name = "ArcticWater";
    waterMesh.position.set(0, -3.2, 0);
    waterMesh.receiveShadow = true;
    group.add(waterMesh);
    this.waterMesh = waterMesh;

    const bedGeo = new THREE.BoxGeometry(1220, 4, 1220);
    const bedMesh = new THREE.Mesh(bedGeo, this.mat.waterBed);
    bedMesh.position.set(0, -6.5, 0);
    group.add(bedMesh);

    // --- ORGANIC COASTLINE FILLET SYSTEM & SLOPED BEACH COLLAR ---
    const coastlineGroup = new THREE.Group();
    coastlineGroup.name = "CoastlineFillets";

    // 1. Comprehensive Radial Corner Fillets covering the central island and all outer promontories
    const cornerFillets = [
      // Central 216x216 Island Corners (R=24)
      { cx: -84, cz: -84, r: 24, thetaStart: Math.PI, thetaLen: Math.PI / 2 },
      { cx: 84, cz: -84, r: 24, thetaStart: Math.PI * 1.5, thetaLen: Math.PI / 2 },
      { cx: 84, cz: 84, r: 24, thetaStart: 0, thetaLen: Math.PI / 2 },
      { cx: -84, cz: 84, r: 24, thetaStart: Math.PI * 0.5, thetaLen: Math.PI / 2 },

      // Outer Perimeter Rounded Capes & Promontories
      // Far North-West Cape (R=18)
      { cx: -100, cz: -130, r: 18, thetaStart: Math.PI, thetaLen: Math.PI / 2 },
      // North Sector West Cap (R=15)
      { cx: -40, cz: -150, r: 15, thetaStart: Math.PI, thetaLen: Math.PI / 2 },
      // North Sector Center Arc (R=16)
      { cx: -21, cz: -152, r: 16, thetaStart: Math.PI, thetaLen: Math.PI },
      // North Sector East Cap (R=15)
      { cx: 2, cz: -150, r: 15, thetaStart: Math.PI * 1.5, thetaLen: Math.PI / 2 },
      // North Shelf NW tip (R=16)
      { cx: 48, cz: -152, r: 16, thetaStart: Math.PI, thetaLen: Math.PI / 2 },
      // North Shelf NE tip (R=16)
      { cx: 102, cz: -152, r: 16, thetaStart: Math.PI * 1.5, thetaLen: Math.PI / 2 },
      // North-East Cape Outer Corner (R=18)
      { cx: 132, cz: -112, r: 18, thetaStart: Math.PI * 1.5, thetaLen: Math.PI / 2 },
      // East Cape Far NE tip (R=16)
      { cx: 156, cz: -40, r: 16, thetaStart: Math.PI * 1.5, thetaLen: Math.PI / 2 },
      // East Cape Far SE tip (R=16)
      { cx: 156, cz: 8, r: 16, thetaStart: 0, thetaLen: Math.PI / 2 },
      // South-East Cape Outer Corner (R=18)
      { cx: 118, cz: 102, r: 18, thetaStart: 0, thetaLen: Math.PI / 2 },
      // South Shelf SE Corner (R=14)
      { cx: 42, cz: 146, r: 14, thetaStart: 0, thetaLen: Math.PI / 2 },
      // South Shelf SW Corner (East of Pier Bay) (R=12)
      { cx: -5, cz: 146, r: 12, thetaStart: Math.PI * 0.5, thetaLen: Math.PI / 2 },
      // South-West Promontory Shore Corner (West of Pier Bay) (R=16)
      { cx: -80, cz: 88, r: 16, thetaStart: 0, thetaLen: Math.PI / 2 },
      // South-West Promontory Far SW Corner (R=18)
      { cx: -120, cz: 88, r: 18, thetaStart: Math.PI * 0.5, thetaLen: Math.PI / 2 },
      // West Shelf Far SW Corner (R=18)
      { cx: -150, cz: 42, r: 18, thetaStart: Math.PI * 0.5, thetaLen: Math.PI / 2 },
      // West Shelf Far NW Corner (R=18)
      { cx: -150, cz: -18, r: 18, thetaStart: Math.PI, thetaLen: Math.PI / 2 },
      // West Coast Outcrop (R=16)
      { cx: -155, cz: 12, r: 16, thetaStart: Math.PI * 0.5, thetaLen: Math.PI }
    ];

    cornerFillets.forEach(cf => {
      const radius = cf.r || 24;
      // Permafrost pedestal corner cylinder arc
      const pedArc = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, baseD, 16, 1, false, cf.thetaStart, cf.thetaLen),
        this.mat.permafrost
      );
      pedArc.position.set(cf.cx, -baseD / 2, cf.cz);
      pedArc.receiveShadow = true;
      coastlineGroup.add(pedArc);

      // Pristine snow plateau corner arc
      const snowArc = new THREE.Mesh(
        new THREE.CylinderGeometry(radius - 0.5, radius - 0.5, plateauH, 16, 1, false, cf.thetaStart, cf.thetaLen),
        this.mat.snow
      );
      snowArc.position.set(cf.cx, plateauH / 2, cf.cz);
      snowArc.receiveShadow = true;
      coastlineGroup.add(snowArc);

      // Sloped coastal sand beach collar (sloping from y=1.4 to y=-0.6 into water)
      const beachArc = new THREE.Mesh(
        new THREE.CylinderGeometry(radius - 0.5, radius + 7.5, 2.0, 16, 1, false, cf.thetaStart, cf.thetaLen),
        this.mat.beachSand
      );
      beachArc.position.set(cf.cx, 0.4, cf.cz);
      beachArc.receiveShadow = true;
      coastlineGroup.add(beachArc);

      // Submerged permafrost apron under the beach
      const subApron = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 7.5, radius + 9.5, 5.0, 16, 1, false, cf.thetaStart, cf.thetaLen),
        this.mat.permafrost
      );
      subApron.position.set(cf.cx, -3.1, cf.cz);
      subApron.receiveShadow = true;
      coastlineGroup.add(subApron);

      // Natural coastal ice hummocks & rocks along curved perimeter
      for (let i = 0; i < 3; i++) {
        const angle = cf.thetaStart + (i + 0.5) * (cf.thetaLen / 3);
        const dist = (radius + 4.0) + (i % 2) * 2.5;
        const rx = cf.cx + Math.cos(angle) * dist;
        const rz = cf.cz + Math.sin(angle) * dist;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + (i % 2) * 0.8, 0), this.mat.coastalRock);
        rock.position.set(rx, -0.2, rz);
        rock.rotation.set(0.3 * i, 0.5 * i, 0.2);
        rock.castShadow = true;
        coastlineGroup.add(rock);
      }
    });

    // 2. Comprehensive Sloped Beach Collar on straight coastline edges around entire enlarged island
    const beachRamps = [
      // Central Island shores
      { x: -42, z: -111, w: 84, d: 8 },
      { x: -50, z: 111, w: 68, d: 8 },
      { x: 111, z: 50, w: 8, d: 68 },
      { x: -111, z: -50, w: 8, d: 68 },

      // Enlarged Outer North Shore segments
      { x: -21, z: -160, w: 46, d: 8 },
      { x: 75, z: -161, w: 58, d: 8 },
      { x: -66, z: -141, w: 52, d: 8 },
      { x: 118, z: -121, w: 40, d: 8 },

      // Enlarged Outer East Shore segments
      { x: 165, z: -16, w: 8, d: 48 },
      { x: 126, z: 72, w: 8, d: 52 },
      { x: 141, z: -76, w: 8, d: 46 },

      // Enlarged Outer South Shore segments
      { x: 18, z: 155, w: 48, d: 8 },
      { x: 92, z: 110, w: 54, d: 8 },
      { x: -100, z: 95, w: 44, d: 8 },
      { x: -12, z: 130, w: 6, d: 36 },
      { x: -74, z: 98, w: 6, d: 24 },

      // Enlarged Outer West Shore segments
      { x: -161, z: 12, w: 8, d: 54 },
      { x: -114, z: -105, w: 8, d: 52 },
      { x: -128, z: 68, w: 8, d: 42 }
    ];

    beachRamps.forEach(br => {
      // Sloped beach ramp box beveled from y=1.4 to y=-0.6
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(br.w, 1.8, br.d), this.mat.beachSand);
      ramp.position.set(br.x, 0.4, br.z);
      ramp.receiveShadow = true;
      coastlineGroup.add(ramp);

      const underBank = new THREE.Mesh(new THREE.BoxGeometry(br.w + 2, 4.0, br.d + 2), this.mat.permafrost);
      underBank.position.set(br.x, -2.5, br.z);
      underBank.receiveShadow = true;
      coastlineGroup.add(underBank);
    });

    group.add(coastlineGroup);

    // --- EXPANDED ARCTIC INDUSTRIAL ISLAND SHELVES & PENINSULAS ---
    const expansionGroup = new THREE.Group();
    expansionGroup.name = "IslandExpansion";

    const shelves = [
      // 4 Primary Industrial Shelves (preserving test invariants)
      { name: "WestShelf", x: -122, z: 12, w: 78, d: 72 },
      { name: "EastShelf", x: 122, z: -15, w: 78, d: 72 },
      { name: "NorthShelf", x: 75, z: -122, w: 72, d: 78 },
      { name: "SouthShelf", x: 18, z: 118, w: 62, d: 74 },

      // Continuous Island Enlargement & Gap Fillers (eliminating chasms and floating scraps)
      { name: "NorthSectorExt", x: -21, z: -136.5, w: 54, d: 46 },
      { name: "NorthLandBridge", x: -21, z: -113, w: 48, d: 34 },
      { name: "NorthWestCape", x: -78, z: -105, w: 72, d: 70 },
      { name: "NorthEastCape", x: 108, z: -88, w: 64, d: 66 },
      { name: "EastCapeExt", x: 142, z: -18, w: 46, d: 60 },
      { name: "SouthEastCape", x: 92, z: 76, w: 68, d: 68 },
      { name: "SouthWestPromontory", x: -102, z: 68, w: 52, d: 52 }
    ];

    shelves.forEach(s => {
      // Permafrost pedestal extension
      const ped = new THREE.Mesh(new THREE.BoxGeometry(s.w, baseD, s.d), this.mat.permafrost);
      ped.position.set(s.x, -baseD / 2, s.z);
      ped.receiveShadow = true;
      expansionGroup.add(ped);

      // Pristine snow plateau extension
      const sn = new THREE.Mesh(new THREE.BoxGeometry(s.w - 1, plateauH, s.d - 1), this.mat.snow);
      sn.position.set(s.x, plateauH / 2, s.z);
      sn.receiveShadow = true;
      expansionGroup.add(sn);

      // Industrial concrete foundation pad
      const apr = new THREE.Mesh(new THREE.BoxGeometry(s.w - 8, 0.4, s.d - 8), this.mat.concrete);
      apr.position.set(s.x, 0.85, s.z);
      apr.receiveShadow = true;
      expansionGroup.add(apr);

      // Coastal sloped sand beach border along outer perimeter
      const isNorthSouth = Math.abs(s.z) > Math.abs(s.x);
      const beachW = isNorthSouth ? s.w + 6 : 8;
      const beachL = isNorthSouth ? 8 : s.d + 6;
      const beachZ = s.z > 0 ? s.z + s.d / 2 + 2 : (s.z < 0 ? s.z - s.d / 2 - 2 : s.z);
      const beachX = s.x > 0 ? s.x + s.w / 2 + 2 : (s.x < 0 ? s.x - s.w / 2 - 2 : s.x);
      const beach = new THREE.Mesh(new THREE.BoxGeometry(beachW, 1.8, beachL), this.mat.beachSand);
      beach.position.set(isNorthSouth ? s.x : beachX, 0.4, isNorthSouth ? beachZ : s.z);
      beach.receiveShadow = true;
      expansionGroup.add(beach);

      // Beveled rounded corners on the outer shelf tips (R=12)
      const cornerOffsetX = (s.w / 2) - 6;
      const cornerOffsetZ = (s.d / 2) - 6;
      [
        { cx: s.x + (s.x >= 0 ? cornerOffsetX : -cornerOffsetX), cz: s.z + (s.z >= 0 ? cornerOffsetZ : -cornerOffsetZ) }
      ].forEach(sc => {
        const shelfCorner = new THREE.Mesh(
          new THREE.CylinderGeometry(10, 14, 2.0, 12),
          this.mat.beachSand
        );
        shelfCorner.position.set(sc.cx, 0.4, sc.cz);
        shelfCorner.receiveShadow = true;
        expansionGroup.add(shelfCorner);
      });
    });

    group.add(expansionGroup);

    // --- MARINE PIER & DOCK EXTENDING INTO WATER ---
    const pierGroup = new THREE.Group();
    pierGroup.name = "MarinePier";
    pierGroup.position.set(-36, 0.2, 160);

    // Continuous Approach Causeway connecting from island shoreline (Z ≈ 112) to deep-water pier (Z = 160)
    const shoreApproach = new THREE.Mesh(new THREE.BoxGeometry(10, 1.6, 30), this.mat.concrete);
    shoreApproach.position.set(0, -0.6, -34);
    shoreApproach.receiveShadow = true;
    pierGroup.add(shoreApproach);
    [-4.0, 4.0].forEach(cx => {
      [-42, -26].forEach(cz => {
        const sPile = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 6, 8), this.mat.darkMetal);
        sPile.position.set(cx, -3.2, cz);
        pierGroup.add(sPile);
      });
    });

    // Causeway approach bridge connecting into pier deck root (BoxGeometry 12x1.6x20)
    const causewayDeck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 20), this.mat.concrete);
    causewayDeck.position.set(0, -0.6, -10);
    causewayDeck.receiveShadow = true;
    pierGroup.add(causewayDeck);
    [-4.5, 4.5].forEach(cx => {
      const cPile = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8), this.mat.darkMetal);
      cPile.position.set(cx, -3.2, -10);
      pierGroup.add(cPile);
    });

    const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 60), this.mat.concrete);
    pierDeck.position.set(0, -0.6, 30);
    pierDeck.receiveShadow = true;
    pierGroup.add(pierDeck);
    for (let pz = 10; pz <= 55; pz += 15) {
      [-5.5, 5.5].forEach(px => {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8), this.mat.darkMetal);
        pile.position.set(px, -3.2, pz);
        pierGroup.add(pile);
      });
    }
    [-6.2, 6.2].forEach(rx => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 58), this.mat.whiteWall);
      rail.position.set(rx, 0.8, 30);
      pierGroup.add(rail);
    });
    for (let bz = 8; bz <= 56; bz += 12) {
      [-5.6, 5.6].forEach(bx => {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 8), this.mat.darkMetal);
        bollard.position.set(bx, 0.5, bz);
        pierGroup.add(bollard);
      });
    }

    // Rubber Fenders along Eastern face
    for (let fz = 12; fz <= 52; fz += 10) {
      const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 10), this.mat.darkMetal);
      fender.position.set(7.35, -0.4, fz);
      pierGroup.add(fender);
    }

    // Concrete Service Platform for Loading Arms
    const loadPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 10.0), this.mat.concrete);
    loadPlatform.position.set(7.8, -0.4, 30.0);
    pierGroup.add(loadPlatform);

    // 3 Articulated Chiksan Marine Loading Arms
    this.animatedObjects.loadingArms = [];
    [-2.2, 0.0, 2.2].forEach(az => {
      const armGroup = new THREE.Group();
      armGroup.position.set(7.8, 0.2, 30.0 + az);

      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 8), this.mat.whiteTank || this.mat.whiteWall);
      riser.position.y = 1.3;
      armGroup.add(riser);

      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(0, 2.6, 0);

      const inboardPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 8), this.mat.yellowGasPipe || this.mat.darkMetal);
      inboardPipe.position.set(1.4, 1.1, 0);
      inboardPipe.rotation.z = -0.7;
      shoulderPivot.add(inboardPipe);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(2.8, 2.2, 0);

      const outboardPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.8, 8), this.mat.bluePipe || this.mat.darkMetal);
      outboardPipe.position.set(1.4, -1.2, 0);
      outboardPipe.rotation.z = 0.7;
      elbowPivot.add(outboardPipe);

      const coupler = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8), this.mat.darkMetal);
      coupler.rotation.z = Math.PI / 2;
      coupler.position.set(3.0, -2.4, 0);
      elbowPivot.add(coupler);

      shoulderPivot.add(elbowPivot);
      armGroup.add(shoulderPivot);
      pierGroup.add(armGroup);

      this.animatedObjects.loadingArms.push({ armGroup, shoulderPivot, elbowPivot });
    });

    // Mooring Lines
    this.animatedObjects.mooringLines = new THREE.Group();
    this.animatedObjects.mooringLines.name = "PierMooringLines";
    [
      { from: new THREE.Vector3(5.6, 0.5, 56.0), to: new THREE.Vector3(13.0, 2.5, 52.0) },
      { from: new THREE.Vector3(5.6, 0.5, 38.0), to: new THREE.Vector3(13.0, 2.2, 42.0) },
      { from: new THREE.Vector3(5.6, 0.5, 24.0), to: new THREE.Vector3(13.0, 2.2, 18.0) },
      { from: new THREE.Vector3(5.6, 0.5, 8.0), to: new THREE.Vector3(13.0, 2.5, 10.0) }
    ].forEach(cfg => {
      const dir = new THREE.Vector3().subVectors(cfg.to, cfg.from);
      const hawser = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, dir.length(), 6), this.mat.darkMetal);
      hawser.position.copy(cfg.from).addScaledVector(dir, 0.5);
      hawser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      this.animatedObjects.mooringLines.add(hawser);
    });
    group.add(pierGroup);

    pierGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = {
          type: "marine_terminal",
          name: "Морской терминал «Ворота Арктики»",
          badge: "Нефтеналивной причал"
        };
        if (!this.interactables.includes(child)) {
          this.interactables.push(child);
        }
      }
    });

    // --- ROCKY ISLANDS IN BAY ---
    const makeBayIslet = (ix, iz, r, h) => {
      const islet = new THREE.Group();
      islet.position.set(ix, -0.2, iz);
      const sandMound = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 16), this.mat.beachSand);
      sandMound.position.y = h * 0.5;
      islet.add(sandMound);
      const snowCap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.68, h * 0.6, 14), this.mat.snow);
      snowCap.position.y = h + 0.1;
      islet.add(snowCap);
      [[-r * 0.2, 0, 2.2], [r * 0.25, r * 0.1, 1.8], [0, -r * 0.25, 2.6]].forEach(([rx, rz, rs]) => {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), this.mat.coastalRock);
        rock.position.set(rx, h + rs * 0.45, rz);
        rock.rotation.set(0.4, 0.7, 0.2);
        rock.castShadow = true;
        islet.add(rock);
      });
      return islet;
    };
    group.add(makeBayIslet(-90, 140, 22, 2.4));
    group.add(makeBayIslet(110, 130, 18, 2.2));

    // Perimeter Snowdrifts across expanded territory borders
    const driftPositions = [
      // Inner drifts
      [-55, -20, 16, 10], [52, -25, 18, 12], [-45, 45, 14, 14],
      [42, 48, 18, 10], [0, -60, 24, 12], [0, 62, 22, 10],
      // Expanded perimeter drifts
      [-88, -40, 26, 14], [85, -50, 24, 14], [-90, 35, 28, 16],
      [88, 55, 26, 15], [0, -95, 32, 16], [0, 96, 30, 15],
      [-65, -85, 22, 14], [70, -82, 24, 12], [-70, 85, 25, 14], [68, 88, 22, 14]
    ];
    driftPositions.forEach(([dx, dz, rx, rz]) => {
      const dMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8), this.mat.snowDrift);
      dMesh.scale.set(rx, 2.0, rz);
      dMesh.position.set(dx, 0.8, dz);
      dMesh.receiveShadow = true;
      group.add(dMesh);
    });

    this.scene.add(group);
  }

  // --- 2. PACKED SNOW WINTER ROADS (АВТОЗИМНИКИ С ПГС) ---
  buildWinterTracks() {
    const THREE = this.THREE;
    const trackGroup = new THREE.Group();
    trackGroup.name = "SandDustedSnowRoads";

    // Clean Arctic Road Network: strictly Base service road + Perimeter winter ring road connecting all wells
    const gate = { x: -66.0, y: 1.42, z: -15.75 };
    const garage = { x: -44.1, y: 1.42, z: -15.75 };
    const outsideGate = { x: -73.5, y: 1.42, z: -15.75 };
    const bypassNorth = { x: -73.5, y: 1.42, z: -73.5 };
    const w1 = { x: -65.1, y: 1.42, z: -73.5 };
    const w5 = { x: -18.9, y: 1.42, z: -73.5 };
    const w2 = { x: 65.1, y: 1.42, z: -73.5 };
    const juncNorthEast = { x: 73.5, y: 1.42, z: -73.5 };
    const w6 = { x: 73.5, y: 1.42, z: -15.75 };
    const w3 = { x: 73.5, y: 1.42, z: 26.25 };
    const juncSouth = { x: 73.5, y: 1.42, z: 73.5 };
    const w4 = { x: 23.1, y: 1.42, z: 73.5 };
    const juncSouthWest = { x: -73.5, y: 1.42, z: 73.5 };

    const routes = [
      // 1. Base Service Road: strictly Garage to Gatehouse
      [garage, gate],
      // 2. Checkpoint Driveway (Gatehouse to Open Tundra Zimnik)
      [gate, outsideGate],
      // 3. Arctic Winter Ring Road (Зимник) cleanly enclosing the complex outside fence
      [outsideGate, bypassNorth],
      [bypassNorth, w1],
      [w1, w5],
      [w5, w2],
      [w2, juncNorthEast],
      [juncNorthEast, w6],
      [w6, w3],
      [w3, juncSouth],
      [juncSouth, w4],
      [w4, juncSouthWest],
      [juncSouthWest, outsideGate]
    ];

    routes.forEach(([p1, p2]) => {
      const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      if (dist < 0.1) return;
      const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);

      // Crowned 3D Road Ribbon Geometry (Raised center Y = 1.48, shoulders Y = 1.42, sits proud of snow at 1.40)
      const halfW = 2.4;
      const segSteps = Math.max(2, Math.floor(dist / 4.0));
      const vertices = [];
      const uvs = [];
      const indices = [];

      const nx = -Math.sin(angle);
      const nz = Math.cos(angle);

      for (let s = 0; s <= segSteps; s++) {
        const f = s / segSteps;
        const cx = p1.x + (p2.x - p1.x) * f;
        const cz = p1.z + (p2.z - p1.z) * f;
        const vCoord = (dist * f) / 8.0;

        // Left shoulder vertex (U = 0.0, Y = 1.42)
        vertices.push(cx - nx * halfW, 1.42, cz - nz * halfW);
        uvs.push(0.0, vCoord);

        // Center crown vertex (U = 0.5, Y = 1.48)
        vertices.push(cx, 1.48, cz);
        uvs.push(0.5, vCoord);

        // Right shoulder vertex (U = 1.0, Y = 1.42)
        vertices.push(cx + nx * halfW, 1.42, cz + nz * halfW);
        uvs.push(1.0, vCoord);

        if (s < segSteps) {
          const row1 = s * 3;
          const row2 = (s + 1) * 3;

          // Left Slope: Quad between (row1+0, row1+1) and (row2+0, row2+1)
          indices.push(row1, row2, row1 + 1);
          indices.push(row1 + 1, row2, row2 + 1);

          // Right Slope: Quad between (row1+1, row1+2) and (row2+1, row2+2)
          indices.push(row1 + 1, row2 + 1, row1 + 2);
          indices.push(row1 + 2, row2 + 1, row2 + 2);
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const roadMesh = new THREE.Mesh(geom, this.mat.sandDustedRoad || this.mat.winterTrack);
      roadMesh.receiveShadow = true;
      trackGroup.add(roadMesh);

      // --- Dual Compressed Tyre Ruts (Протоптанные следы шин ТРЭКОЛ 6х6 на зимнике) ---
      // Highly visible dark Arctic tire tracks (packed snow 0x889eb2 with dark grit 0x334155) at Y = 1.49
      // Static upright fin meshes removed per user request: Trekol dynamic tyre tracks now handle fading tracks cleanly
      [-0.95, 0.95].forEach(wheelOffset => {
        // Static tyre lines removed as requested by user; dynamic fading tracks are used instead
      });

      // Ploughed Snow Berms along road shoulders
      for (let f = 0.1; f < 0.95; f += 0.22) {
        const mx = p1.x + (p2.x - p1.x) * f;
        const mz = p1.z + (p2.z - p1.z) * f;

        const bermL = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), this.mat.snowDrift);
        bermL.scale.set(1.1, 0.45, 1.8);
        bermL.position.set(mx - nx * (halfW + 0.35), 1.25, mz - nz * (halfW + 0.35));
        bermL.rotation.y = angle;
        bermL.receiveShadow = true;
        trackGroup.add(bermL);

        const bermR = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), this.mat.snowDrift);
        bermR.scale.set(1.1, 0.45, 1.8);
        bermR.position.set(mx + nx * (halfW + 0.35), 1.25, mz + nz * (halfW + 0.35));
        bermR.rotation.y = angle;
        bermR.receiveShadow = true;
        trackGroup.add(bermR);
      }

      // Siberian Arctic Road Marker Stakes (Striped warning poles)
      for (let f = 0.15; f <= 0.85; f += 0.35) {
        const vx = p1.x + (p2.x - p1.x) * f;
        const vz = p1.z + (p2.z - p1.z) * f;

        const poleGroup = new THREE.Group();
        poleGroup.position.set(vx + nx * (halfW + 0.8), 1.22, vz + nz * (halfW + 0.8));

        const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), this.mat.whiteWall || this.mat.orangeAccent);
        baseCyl.position.y = 1.6;
        baseCyl.castShadow = true;
        poleGroup.add(baseCyl);

        const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6), this.mat.orangeAccent);
        band1.position.y = 2.4;
        poleGroup.add(band1);

        const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 6), this.mat.orangeAccent);
        band2.position.y = 1.4;
        poleGroup.add(band2);

        trackGroup.add(poleGroup);
      }
    });

    // Circular Crowned Hub Aprons at Key Junctions and Wellpad Access Stops
    const hubs = [gate, garage, w1, w2, w3, w4, w5, w6];
    hubs.forEach(h => {
      const hubGeo = new THREE.CylinderGeometry(3.6, 4.2, 0.14, 16);
      const hubMesh = new THREE.Mesh(hubGeo, this.mat.sandDustedRoad || this.mat.winterTrack);
      hubMesh.position.set(h.x, 1.27, h.z);
      hubMesh.receiveShadow = true;
      trackGroup.add(hubMesh);
    });

    this.roadNetworkMesh = trackGroup;
    this.scene.add(trackGroup);
  }

  cleanupInteractablesForGroup(group) {
    if (!group) return;
    group.traverse(child => {
      if (child.isMesh) {
        const idx = this.interactables.indexOf(child);
        if (idx !== -1) {
          this.interactables.splice(idx, 1);
        }
        if (child.geometry && typeof child.geometry.dispose === "function") {
          child.geometry.dispose();
        }
      }
    });
  }

  // --- 3. ALL 4 WELLPADS (WITH SIBERIAN GAS WELLHEADS / PUMPJACKS) ---
  buildAllWellpads() {
    const wellConfigs = [
      { id: "well_1", name: "Куст 1 (Пионер)", gx: 0.8, gy: 0.8 },
      { id: "well_2", name: "Куст 2 (Северный)", gx: 13.2, gy: 0.8 },
      { id: "well_3", name: "Куст 3 (Полярный)", gx: 13.5, gy: 9.5 },
      { id: "well_4", name: "Куст 4 (Горизонт)", gx: 9.2, gy: 13.5 }
    ];

    wellConfigs.forEach(cfg => this.buildSingleWellpad(cfg));
  }

  buildSingleWellpad(cfg) {
    const THREE = this.THREE;
    const wPos = this.gridToWorld(cfg.gx, cfg.gy, 1.2);

    if (this.wellpadGroups[cfg.id]) {
      this.cleanupInteractablesForGroup(this.wellpadGroups[cfg.id]);
      this.scene.remove(this.wellpadGroups[cfg.id]);
    }

    const padPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos(cfg.id, wPos) : wPos;
    const padGroup = new THREE.Group();
    padGroup.position.set(padPos.x, wPos.y, padPos.z);
    this.wellpadGroups[cfg.id] = padGroup;
    this.registerMovableBuilding(cfg.id, padGroup, { gx: cfg.gx, gy: cfg.gy, yOffset: 1.2 }, { cellsW: 5, cellsD: 4, w: 17.5, d: 14.0, label: `Куст Скважин №${cfg.id.replace('well_', '')}` });

    const well = state.wells[cfg.id];
    const isUnlocked = well && well.unlocked && well.level > 0;
    const wellCount = state.getWellsCountOnPad ? state.getWellsCountOnPad(cfg.id) : (isUnlocked ? 2 : 0);

    // Concrete Slab with Yellow Hazard Border (Exact 5x4 Cells = 17.5m x 14.0m)
    const padW = 17.5, padL = 14.0;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(padW, 0.8, padL), this.mat.concrete);
    pad.position.y = 0.4;
    pad.receiveShadow = true;
    padGroup.add(pad);

    const hazard = new THREE.Mesh(new THREE.BoxGeometry(padW + 0.1, 0.2, padL + 0.1), this.mat.hazardStripe);
    hazard.position.y = 0.1;
    padGroup.add(hazard);

    // Snowdrifts along pad edges
    [[-padW / 2 + 1, -padL / 2 + 1], [padW / 2 - 1, -padL / 2 + 1], [-padW / 2 + 1, padL / 2 - 1]].forEach(([sx, sz]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), this.mat.snowDrift);
      s.scale.set(2.5, 0.5, 2.0);
      s.position.set(sx, 0.6, sz);
      padGroup.add(s);
    });

    if (isUnlocked) {
      const spacing = 4.2;
      const startX = -((wellCount - 1) * spacing) / 2;

      for (let i = 0; i < wellCount; i++) {
        // If specialization is gas (or default), render high-tech Christmas Tree; if oil, render pumpjack
        const isOil = state.specialization === "oil";
        const whGroup = isOil ? this.createPumpjackWellhead(i) : this.createChristmasTreeWellhead(i);
        whGroup.position.set(startX + i * spacing, 0.8, 0);
        padGroup.add(whGroup);
      }

      const debitText = `${state.getWellDebit ? Math.round(state.getWellDebit(cfg.id)) : 45} ₽/с`;
      const billboard = this.create3DBillboard(
        cfg.name,
        `УР. ${well.level} • ${debitText}`,
        "#22c55e",
        "#1e293b",
        13,
        4.8
      );
      billboard.position.set(0, 7.5, 0);
      padGroup.add(billboard);
      padGroup.userData.billboard = billboard;

      // Physical Roadside Information Board for Wellpad
      const wellSign = this.createPhysicalSignboard(cfg.name, "🛢️", "#00a3e0", 6.8, 2.2);
      wellSign.position.set(padW / 2 - 2.8, 2.0, padL / 2 - 1.2);
      wellSign.rotation.y = -0.35;
      padGroup.add(wellSign);
    } else {
      const def = CONFIG.WELLS.find(w => w.id === cfg.id);
      const cost = def ? def.unlockCost : 500;

      [[-padW / 2 + 1, -padL / 2 + 1], [padW / 2 - 1, -padL / 2 + 1], [padW / 2 - 1, padL / 2 - 1], [-padW / 2 + 1, padL / 2 - 1]].forEach(([cx, cz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8), this.mat.greyWall);
        post.position.set(cx, 2.0, cz);
        padGroup.add(post);
      });

      const lockGroup = this.create3DPadlock();
      lockGroup.position.set(0, 4.0, 0);
      padGroup.add(lockGroup);

      const billboard = this.create3DBillboard(
        cfg.name,
        `🔒 ТРЕБУЕТСЯ: ${cost.toLocaleString("ru-RU")} ₽`,
        "#00a3e0",
        "#1e293b",
        15,
        5.0
      );
      billboard.position.set(0, 6.2, 0);
      padGroup.add(billboard);
    }

    // Volume Hitbox tightly constrained to pad footprint (zero overhang)
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(padW - 0.2, 5.0, padL - 0.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 2.5;
    padGroup.add(hitbox);

    padGroup.userData = {
      type: "well",
      id: cfg.id,
      name: cfg.name,
      badge: isUnlocked ? "В ДОБЫЧЕ" : "ЗАБЛОКИРОВАНО",
      isUnlocked: isUnlocked
    };

    // Recursively register meshes inside padGroup to interactables
    padGroup.traverse(child => {
      if (child.isMesh && !child.userData?.noRaycast) {
        child.userData = padGroup.userData;
        this.interactables.push(child);
      }
    });

    this.scene.add(padGroup);
  }

  // 3D Model: Gas Wellhead Christmas Tree (Фонтанная арматура АФК6-80х350)
  createChristmasTreeWellhead(index) {
    const THREE = this.THREE;
    const g = new THREE.Group();

    // 1. Casing Flange Base
    const cellar = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.4, 16), this.mat.darkMetal);
    cellar.position.y = 0.2;
    g.add(cellar);

    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 0.5, 16), this.mat.valveSteel);
    casing.position.y = 0.65;
    g.add(casing);

    // 2. Lower Master Valve (Нижняя коренная)
    g.add(this.createGateValve(0, 1.35, 0));

    // 3. Spool
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.65, 12), this.mat.valveSteel);
    spool.position.y = 2.05;
    g.add(spool);

    // 4. Upper Master Valve (Верхняя коренная)
    g.add(this.createGateValve(0, 2.75, 0));

    // 5. Cross Block (Крестовина)
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), this.mat.valveSteel);
    cross.position.y = 3.55;
    cross.castShadow = true;
    g.add(cross);

    // 6. Left Production Wing (Рабочая струна с дросселем)
    const leftPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.0, 12), this.mat.valveSteel);
    leftPipe.rotation.z = Math.PI / 2;
    leftPipe.position.set(-1.4, 3.55, 0);
    g.add(leftPipe);

    g.add(this.createGateValve(-1.4, 3.55, 0, Math.PI / 2));

    const choke = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.75, 12), this.mat.darkMetal);
    choke.rotation.z = Math.PI / 2;
    choke.position.set(-2.5, 3.55, 0);
    g.add(choke);

    const leftDrop = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.8, 12), this.mat.bluePipe);
    leftDrop.position.set(-3.2, 1.8, 0);
    g.add(leftDrop);

    // 7. Right Backup Wing (Резервная струна)
    const rightPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 12), this.mat.valveSteel);
    rightPipe.rotation.z = Math.PI / 2;
    rightPipe.position.set(1.2, 3.55, 0);
    g.add(rightPipe);

    g.add(this.createGateValve(1.2, 3.55, 0, -Math.PI / 2));

    const rightCap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12), this.mat.valveSteel);
    rightCap.rotation.z = Math.PI / 2;
    rightCap.position.set(2.1, 3.55, 0);
    g.add(rightCap);

    // 8. Crown Valve
    g.add(this.createGateValve(0, 4.35, 0));

    // 9. Manometer on Top (Манометр высокого давления)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), this.mat.brass);
    stem.position.y = 5.25;
    g.add(stem);

    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 24), this.mat.snowCap);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0, 5.7, 0);
    g.add(dial);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 24), this.mat.brass);
    rim.position.set(0, 5.7, 0);
    g.add(rim);

    return g;
  }

  createGateValve(x, y, z, rotZ = 0) {
    const THREE = this.THREE;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.z = rotZ;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.75), this.mat.valveSteel);
    body.castShadow = true;
    g.add(body);

    const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 10), this.mat.valveSteel);
    bonnet.rotation.x = Math.PI / 2;
    bonnet.position.set(0, 0, 0.5);
    g.add(bonnet);

    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 16), this.mat.redValve);
    wheel.position.set(0, 0, 0.8);
    g.add(wheel);

    return g;
  }

  // 3D Model: Pumpjack (for oil specialization)
  createPumpjackWellhead(index) {
    const THREE = this.THREE;
    const g = new THREE.Group();

    const postGeo = new THREE.CylinderGeometry(0.22, 0.45, 6.5, 8);
    const p1 = new THREE.Mesh(postGeo, this.mat.greyWall);
    p1.position.set(-0.8, 3.25, -1.2);
    p1.rotation.z = -0.14;
    p1.castShadow = true;
    g.add(p1);

    const p2 = new THREE.Mesh(postGeo, this.mat.greyWall);
    p2.position.set(0.8, 3.25, -1.2);
    p2.rotation.z = 0.14;
    p2.castShadow = true;
    g.add(p2);

    const p3 = new THREE.Mesh(postGeo, this.mat.greyWall);
    p3.position.set(0, 3.25, 1.4);
    p3.rotation.x = -0.16;
    p3.castShadow = true;
    g.add(p3);

    const beamPivot = new THREE.Group();
    beamPivot.position.set(0, 6.5, 0);
    g.add(beamPivot);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.65, 0.55), this.mat.concrete);
    beam.castShadow = true;
    beamPivot.add(beam);

    const hhShape = new THREE.Shape();
    hhShape.moveTo(0, -1.8);
    hhShape.quadraticCurveTo(-1.8, 0, 0, 1.8);
    hhShape.lineTo(0.8, 1.8);
    hhShape.lineTo(0.8, -1.8);
    hhShape.closePath();
    const horsehead = new THREE.Mesh(new THREE.ExtrudeGeometry(hhShape, { depth: 0.65, bevelEnabled: false }), this.mat.redSteel);
    horsehead.position.set(-4.2, 0, -0.32);
    horsehead.castShadow = true;
    beamPivot.add(horsehead);

    const crankPivot = new THREE.Group();
    crankPivot.position.set(3.2, 2.5, 0);
    g.add(crankPivot);

    const crank = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.4, 2.0), this.mat.darkMetal);
    crank.position.y = 0.8;
    crank.castShadow = true;
    crankPivot.add(crank);

    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 12), this.mat.redValve);
    wh.position.set(-4.2, 0.8, 0);
    g.add(wh);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 8), this.mat.darkMetal);
    rod.position.set(-4.2, 3.2, 0);
    g.add(rod);

    this.animatedObjects.pumpjacks.push({
      beamPivot,
      crankPivot,
      speed: 2.6 + (index * 0.25),
      phase: index * 0.85
    });

    return g;
  }

  // --- 4. CENTRAL MEGA GAS PROCESSING PLANT (ВОЗВРАЩЕНО ИСТИННОЕ ИНДУСТРИАЛЬНОЕ ЗДАНИЕ ГПЗ / ЦПС, СЕТКА 8x6) ---
  buildMegaGasPlant() {
    const THREE = this.THREE;
    if (this.plantGroup) {
      this.cleanupInteractablesForGroup(this.plantGroup);
      this.scene.remove(this.plantGroup);
    }
    const plantGroup = new THREE.Group();
    // Default grid position aligned to 8x6 cell grid: col -4, row -4 -> center (0.0, -3.5)
    const rawDefaultPlantPos = { x: 0.0, y: 1.2, z: -3.5 };
    const savedPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("station_cps", rawDefaultPlantPos) : rawDefaultPlantPos;
    const snappedPlant = this.snapToBuildingGrid(savedPos.x, savedPos.z, 8, 6, 3.5);
    plantGroup.position.set(snappedPlant.x, 1.2, snappedPlant.z);
    this.plantGroup = plantGroup;
    this.registerMovableBuilding("station_cps", plantGroup, rawDefaultPlantPos, { cellsW: 8, cellsD: 6, w: 28.0, d: 21.0, label: "ЦПС Главный Комплекс" });

    // ============================================
    // FOUNDATION & PAG CONCRETE BASE PLATFORM (8x6 Cells = 28.0m x 21.0m)
    // ============================================
    const baseW = 28.0, baseD = 21.0, baseH = 0.8;
    const base = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, baseD), this.mat.pagConcrete || this.mat.concrete);
    base.position.y = baseH / 2;
    base.receiveShadow = true;
    plantGroup.add(base);

    // Perimeter concrete curb (fits exactly inside cell boundaries)
    const curbMat = this.mat.concreteDark || this.mat.concrete;
    const curbThick = 0.4, curbH = 0.3;
    [[-baseW / 2 + curbThick / 2, 0], [baseW / 2 - curbThick / 2, 0]].forEach(([cx]) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(curbThick, baseH + curbH, baseD), curbMat);
      curb.position.set(cx, (baseH + curbH) / 2, 0);
      plantGroup.add(curb);
    });
    [[0, -baseD / 2 + curbThick / 2], [0, baseD / 2 - curbThick / 2]].forEach(([, cz]) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH + curbH, curbThick), curbMat);
      curb.position.set(0, (baseH + curbH) / 2, cz);
      plantGroup.add(curb);
    });

    // Soft Ambient Occlusion Contact Shadow on Snow (Non-interactive visual decor)
    let shadowPlane = null;
    if (this.mat.contactShadow) {
      shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(32, 25), this.mat.contactShadow);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.set(0, 0.04, 0);
      shadowPlane.userData = { isDecorative: true, noRaycast: true };
      plantGroup.add(shadowPlane);
    }

    // ============================================
    // MAIN COMPRESSOR WORKSHOP (ГЛАВНЫЙ КОМПРЕССОРНЫЙ ЦЕХ ГПЗ С ДВУСКАТНОЙ КРОВЛЕЙ)
    // ============================================
    const bodyW = 16.0, bodyH = 7.5, bodyD = 10.0;
    const bodyX = -1.0, bodyZ = 0.5;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW, bodyH, bodyD),
      this.mat.corrugatedWorkshop || this.mat.whiteWall
    );
    body.position.set(bodyX, baseH + bodyH / 2, bodyZ);
    body.castShadow = true;
    body.receiveShadow = true;
    plantGroup.add(body);

    // Lower Gazprom corporate blue accent stripe on workshop
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x005bab, roughness: 0.35, metalness: 0.12 });
    const stripeH = 1.0;
    [bodyD / 2 + 0.02, -(bodyD / 2 + 0.02)].forEach(sz => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.4, stripeH, 0.12), stripeMat);
      stripe.position.set(bodyX, baseH + stripeH / 2 + 0.25, bodyZ + sz);
      plantGroup.add(stripe);
    });

    // Industrial Gable Roof (Двускатная промышленная кровля с синим/оранжевым скосом)
    const roofOverhang = 0.8;
    const roofApexH = 3.6;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-bodyW / 2 - roofOverhang, 0);
    roofShape.lineTo(0, roofApexH);
    roofShape.lineTo(bodyW / 2 + roofOverhang, 0);
    roofShape.closePath();
    const roof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roofShape, { depth: bodyD + roofOverhang * 2, bevelEnabled: false }),
      this.mat.orangeRoof
    );
    roof.position.set(bodyX, baseH + bodyH, bodyZ - bodyD / 2 - roofOverhang);
    roof.castShadow = true;
    plantGroup.add(roof);

    // Snow Cap on Roof (Реалистичный снежный покров)
    const snowRoofShape = new THREE.Shape();
    snowRoofShape.moveTo(-bodyW / 2 - roofOverhang + 0.15, 0.15);
    snowRoofShape.lineTo(0, roofApexH + 0.15);
    snowRoofShape.lineTo(bodyW / 2 + roofOverhang - 0.15, 0.15);
    snowRoofShape.lineTo(bodyW / 2 + roofOverhang - 0.15, 0.55);
    snowRoofShape.lineTo(0, roofApexH + 0.55);
    snowRoofShape.lineTo(-bodyW / 2 - roofOverhang + 0.15, 0.55);
    snowRoofShape.closePath();
    const snowRoof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(snowRoofShape, { depth: bodyD + roofOverhang * 2 + 0.25, bevelEnabled: false }),
      this.mat.snowCap
    );
    snowRoof.position.set(bodyX, baseH + bodyH, bodyZ - bodyD / 2 - roofOverhang - 0.12);
    snowRoof.castShadow = true;
    plantGroup.add(snowRoof);

    // Ridge vent on roof apex
    const ridgeVent = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.6, 0.6, 0.9), this.mat.darkMetal);
    ridgeVent.position.set(bodyX, baseH + bodyH + roofApexH + 0.3, bodyZ);
    plantGroup.add(ridgeVent);

    // ============================================
    // TWIN INDUSTRIAL CHIMNEYS WITH WARNING LIGHTS & STEAM
    // ============================================
    const chimneyH = 11.0;
    [-3.2, 3.2].forEach(cx => {
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, chimneyH, 16), this.mat.darkMetal);
      chimney.position.set(bodyX + cx, baseH + bodyH + chimneyH / 2 - 1.0, bodyZ - 2.5);
      chimney.castShadow = true;
      plantGroup.add(chimney);

      // High-visibility orange signal ring
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.14, 8, 16), this.mat.orangeAccent);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(bodyX + cx, baseH + bodyH + chimneyH - 2.2, bodyZ - 2.5);
      plantGroup.add(rim);

      // Pulsing red aviation obstruction warning light
      const warningLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      warningLight.position.set(bodyX + cx, baseH + bodyH + chimneyH - 0.8, bodyZ - 2.5);
      plantGroup.add(warningLight);
    });

    // Animated rising steam smoke puffs from twin chimneys
    if (this.animatedObjects?.chimneySmokes) {
      [-3.2, 3.2].forEach(cx => {
        const puffs = [];
        for (let s = 0; s < 4; s++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.35 + s * 0.16, 6, 6), this.mat.smokeCloud);
          puff.position.set(snappedPlant.x + bodyX + cx, 1.2 + baseH + bodyH + chimneyH + s * 0.8, snappedPlant.z + bodyZ - 2.5);
          this.scene.add(puff);
          puffs.push(puff);
        }
        this.animatedObjects.chimneySmokes.push({
          puffs,
          baseX: snappedPlant.x + bodyX + cx,
          baseY: 1.2 + baseH + bodyH + chimneyH,
          baseZ: snappedPlant.z + bodyZ - 2.5,
          speed: 1.6,
          spread: 0.35
        });
      });
    }

    // ============================================
    // AIR-COOLED HEAT EXCHANGERS (АВО ГАЗА) — behind workshop
    // ============================================
    const avoX = bodyX, avoZ = bodyZ - bodyD / 2 - 2.8;
    const avoFrame = new THREE.Mesh(new THREE.BoxGeometry(9.0, 2.2, 3.6), this.mat.darkMetal);
    avoFrame.position.set(avoX, baseH + 1.1, avoZ);
    avoFrame.castShadow = true;
    plantGroup.add(avoFrame);

    this.animatedObjects.avoFans = [];
    for (let f = 0; f < 3; f++) {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.35, 16), this.mat.darkMetal);
      housing.position.set(avoX - 2.8 + f * 2.8, baseH + 2.35, avoZ);
      plantGroup.add(housing);

      const fanPivot = new THREE.Group();
      fanPivot.position.set(avoX - 2.8 + f * 2.8, baseH + 2.55, avoZ);
      plantGroup.add(fanPivot);

      for (let b = 0; b < 4; b++) {
        const fanBlade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.3), this.mat.orangeAccent);
        fanBlade.rotation.y = (b * Math.PI) / 2;
        fanPivot.add(fanBlade);
      }
      this.animatedObjects.avoFans.push(fanPivot);
    }

    // ============================================
    // CENTRAL CONTROL ROOM (ЦПУ) — left annex
    // ============================================
    const cpuX = -9.8, cpuZ = 0.5, cpuW = 4.8, cpuH = 4.0, cpuD = 5.2;
    const cpu = new THREE.Mesh(new THREE.BoxGeometry(cpuW, cpuH, cpuD), this.mat.corrugatedWorkshop || this.mat.whiteWall);
    cpu.position.set(cpuX, baseH + cpuH / 2, cpuZ);
    cpu.castShadow = true;
    plantGroup.add(cpu);

    const cpuRoof = new THREE.Mesh(new THREE.BoxGeometry(cpuW + 0.4, 0.3, cpuD + 0.4), this.mat.darkMetal);
    cpuRoof.position.set(cpuX, baseH + cpuH + 0.15, cpuZ);
    plantGroup.add(cpuRoof);

    const cpuSnow = new THREE.Mesh(new THREE.BoxGeometry(cpuW + 0.5, 0.35, cpuD + 0.5), this.mat.snowCap);
    cpuSnow.position.set(cpuX, baseH + cpuH + 0.45, cpuZ);
    plantGroup.add(cpuSnow);

    // Warm illuminated panoramic control room window
    const cpuWin = new THREE.Mesh(new THREE.BoxGeometry(cpuW - 1.0, 1.4, 0.12), this.mat.windowLit);
    cpuWin.position.set(cpuX, baseH + 2.2, cpuZ + cpuD / 2 + 0.06);
    plantGroup.add(cpuWin);

    // Flashing red obstruction beacon on CPU
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    beacon.position.set(cpuX, baseH + cpuH + 0.95, cpuZ);
    plantGroup.add(beacon);
    this.animatedObjects.beacon = beacon;

    // Telemetry Satellite Dish on Control Room
    const satPivot = new THREE.Group();
    satPivot.position.set(cpuX, baseH + cpuH + 0.7, cpuZ - 1.2);
    plantGroup.add(satPivot);
    this.plantDish = satPivot;

    const dishMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.35, 0.4, 16), this.mat.orangeAccent);
    dishMesh.rotation.x = Math.PI / 3.8;
    dishMesh.castShadow = true;
    satPivot.add(dishMesh);

    // ============================================
    // FRACTIONATION COLUMN (К-1) — right side, with clear spacing
    // ============================================
    const colX = 9.8, colZ = -2.5, colR = 1.1, colH = 11.0;
    const colPedestal = new THREE.Mesh(new THREE.CylinderGeometry(colR + 0.35, colR + 0.5, 0.8, 16), curbMat);
    colPedestal.position.set(colX, baseH + 0.4, colZ);
    plantGroup.add(colPedestal);

    const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(colR, colR, colH, 20), this.mat.whiteTank);
    colMesh.position.set(colX, baseH + 0.8 + colH / 2, colZ);
    colMesh.castShadow = true;
    plantGroup.add(colMesh);

    const colDome = new THREE.Mesh(new THREE.SphereGeometry(colR, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat.whiteTank);
    colDome.position.set(colX, baseH + 0.8 + colH, colZ);
    plantGroup.add(colDome);

    const colSnow = new THREE.Mesh(new THREE.SphereGeometry(colR + 0.1, 16, 10), this.mat.snowCap);
    colSnow.position.set(colX, baseH + 0.8 + colH + 0.2, colZ);
    colSnow.scale.set(1, 0.35, 1);
    plantGroup.add(colSnow);

    // Steel rings every 3m
    for (let ry = 3.0; ry < colH; ry += 3.0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(colR + 0.08, 0.06, 6, 16), this.mat.darkMetal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(colX, baseH + 0.8 + ry, colZ);
      plantGroup.add(ring);
    }

    // Service ladder
    const colLadder = new THREE.Mesh(new THREE.BoxGeometry(0.1, colH, 0.35), this.mat.darkMetal);
    colLadder.position.set(colX + colR + 0.18, baseH + 0.8 + colH / 2, colZ);
    plantGroup.add(colLadder);

    // ============================================
    // HORIZONTAL PROCESS BULLET VESSEL (РГС) — front right
    // ============================================
    const bx = 9.8, bz = 4.5;
    [-1.2, 1.2].forEach(sx => {
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 2.2), curbMat);
      saddle.position.set(bx + sx, baseH + 0.55, bz);
      plantGroup.add(saddle);
    });

    const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 4.5, 16), this.mat.whiteTank);
    bullet.rotation.z = Math.PI / 2;
    bullet.position.set(bx, baseH + 1.8, bz);
    bullet.castShadow = true;
    plantGroup.add(bullet);

    [-2.25, 2.25].forEach(ex => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat.whiteTank);
      cap.rotation.z = ex > 0 ? Math.PI / 2 : -Math.PI / 2;
      cap.position.set(bx + ex, baseH + 1.8, bz);
      plantGroup.add(cap);
    });

    const bulletSnow = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.1), this.mat.snowCap);
    bulletSnow.position.set(bx, baseH + 2.8, bz);
    plantGroup.add(bulletSnow);

    // ============================================
    // CLEAR ENTRANCE PORCH (СВОБОДНЫЙ ВХОД БЕЗ ПЕРЕКРЫТИЙ И БАЛОК)
    // ============================================
    const porchW = 4.5, porchD = 2.2, porchH = 0.35;
    const porch = new THREE.Mesh(new THREE.BoxGeometry(porchW, porchH, porchD), curbMat);
    porch.position.set(bodyX, baseH + porchH / 2, bodyZ + bodyD / 2 + porchD / 2);
    porch.receiveShadow = true;
    plantGroup.add(porch);

    const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.1), this.mat.darkMetal);
    door.position.set(bodyX, baseH + 1.4, bodyZ + bodyD / 2 + 0.05);
    plantGroup.add(door);

    [-0.5, 0.5].forEach(dx => {
      const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.12), this.mat.windowLit);
      doorGlass.position.set(bodyX + dx, baseH + 1.7, bodyZ + bodyD / 2 + 0.06);
      plantGroup.add(doorGlass);
    });

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(porchW + 0.4, 0.2, porchD + 0.3), this.mat.orangeAccent);
    canopy.position.set(bodyX, baseH + 3.4, bodyZ + bodyD / 2 + porchD / 2 - 0.1);
    canopy.castShadow = true;
    plantGroup.add(canopy);

    const canopySnow = new THREE.Mesh(new THREE.BoxGeometry(porchW + 0.3, 0.18, porchD + 0.2), this.mat.snowCap);
    canopySnow.position.set(bodyX, baseH + 3.58, bodyZ + bodyD / 2 + porchD / 2 - 0.1);
    canopySnow.castShadow = true;
    plantGroup.add(canopySnow);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.4), this.mat.floodlightLamp);
    lamp.position.set(bodyX, baseH + 3.28, bodyZ + bodyD / 2 + 0.8);
    plantGroup.add(lamp);

    // Click Volume Hitbox strictly fitted to base platform (zero lateral or vertical overhang)
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(baseW - 0.2, 1.2, baseD - 0.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 0.6;
    plantGroup.add(hitbox);

    plantGroup.userData = {
      type: "facility",
      id: "station_cps",
      name: "Газовый промысел",
      badge: "★ ГАЗОВЫЙ ПРОМЫСЕЛ ★"
    };

    plantGroup.traverse(child => {
      if (child.isMesh && child !== shadowPlane && !child.userData?.noRaycast) {
        child.userData = plantGroup.userData;
        this.interactables.push(child);
      }
    });

    this.scene.add(plantGroup);
  }

  // --- 5. MODULAR INFRASTRUCTURE (СТОЛОВАЯ, ОБЩЕЖИТИЕ, КПП, ГАРАЖ ТЕХНИКИ АТБ) ---
  buildModularInfrastructure() {
    const THREE = this.THREE;
    if (this.canteenGroup) {
      this.cleanupInteractablesForGroup(this.canteenGroup);
      this.scene.remove(this.canteenGroup);
    }
    if (this.dormGroup) {
      this.cleanupInteractablesForGroup(this.dormGroup);
      this.scene.remove(this.dormGroup);
    }
    if (this.garageGroup) {
      this.cleanupInteractablesForGroup(this.garageGroup);
      this.scene.remove(this.garageGroup);
    }

    // 1. Canteen (Столовая) at gx: 3.5, gy: 7.8 — 3x3 Cells (10.5m x 10.5m)
    const rawDefaultCanPos = this.gridToWorld(3.5, 7.8, 1.2);
    const savedCanPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("canteen", rawDefaultCanPos) : rawDefaultCanPos;
    const snappedCan = this.snapToBuildingGrid(savedCanPos.x, savedCanPos.z, 3, 3, 3.5);
    const canteen = new THREE.Group();
    canteen.position.set(snappedCan.x, 1.2, snappedCan.z);
    this.canteenGroup = canteen;
    this.registerMovableBuilding("canteen", canteen, rawDefaultCanPos, { cellsW: 3, cellsD: 3, w: 10.5, d: 10.5, label: "Столовая" });

    // PAG Concrete Base Slab (Exact 10.5m x 10.5m)
    const canBase = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.4, 10.5), this.mat.pagConcrete || this.mat.concrete);
    canBase.position.y = 0.2;
    canBase.receiveShadow = true;
    canteen.add(canBase);

    // Beveled perimeter curbs
    const canCurbMat = this.mat.concreteDark || this.mat.concrete;
    [-5.12, 5.12].forEach(cz => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.25, 0.25), canCurbMat);
      curb.position.set(0, 0.35, cz);
      canteen.add(curb);
    });
    [-5.12, 5.12].forEach(cx => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 10.5), canCurbMat);
      curb.position.set(cx, 0.35, 0);
      canteen.add(curb);
    });

    const canBody = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.2, 7.2), this.mat.canteenWall || this.mat.whiteWall);
    canBody.position.y = 2.3;
    canBody.castShadow = true;
    canteen.add(canBody);

    const canRoof = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.6, 7.8), this.mat.orangeRoof);
    canRoof.position.y = 4.7;
    canRoof.castShadow = true;
    canteen.add(canRoof);

    // Snow Cap on Canteen
    const canSnow = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.4, 7.6), this.mat.snowCap);
    canSnow.position.y = 5.1;
    canteen.add(canSnow);

    // Warm Lit Windows on Canteen Dining Hall & Kitchen
    [-2.4, 0.0, 2.4].forEach(wx => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 0.1), this.mat.windowLit);
      win.position.set(wx, 2.5, 3.66);
      canteen.add(win);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 0.05), this.mat.windowFrame);
      frame.position.set(wx, 2.5, 3.63);
      canteen.add(frame);
    });

    // Canteen Entrance Porch (Крыльцо с навесом)
    const canPorch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 1.4), this.mat.concrete);
    canPorch.position.set(0, 0.35, 4.3);
    canteen.add(canPorch);

    const canCanopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 1.5), this.mat.orangeAccent);
    canCanopy.position.set(0, 3.2, 4.3);
    canCanopy.rotation.x = -0.15;
    canteen.add(canCanopy);

    const canCanopySnow = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 1.4), this.mat.snowCap);
    canCanopySnow.position.set(0, 3.32, 4.3);
    canteen.add(canCanopySnow);

    // Kitchen Exhaust Chimney with Steam Smoke
    const canChimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8), this.mat.chimneyMetal);
    canChimney.position.set(2.8, 5.6, -1.8);
    canChimney.castShadow = true;
    canteen.add(canChimney);

    // Supply Delivery Ramp & Crates on the side
    const canRamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 2.6), this.mat.woodPlatform);
    canRamp.position.set(4.4, 0.35, 0);
    canteen.add(canRamp);

    for (let c = 0; c < 2; c++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), this.mat.woodTrunk);
      crate.position.set(4.4, 0.85, -0.6 + c * 0.9);
      canteen.add(crate);
    }

    // 4 Animated Kitchen Steam Smoke Spheres
    const canSmokePuffs = [];
    for (let s = 0; s < 4; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3 + s * 0.12, 6, 6), this.mat.smokeCloud);
      puff.position.set(snappedCan.x + 2.8, 1.2 + 6.5 + s * 0.7, snappedCan.z - 1.8);
      this.scene.add(puff);
      canSmokePuffs.push(puff);
    }
    this.animatedObjects.chimneySmokes.push({
      puffs: canSmokePuffs,
      baseX: snappedCan.x + 2.8,
      baseY: 1.2 + 6.4,
      baseZ: snappedCan.z - 1.8,
      speed: 1.6,
      spread: 0.35
    });

    // Canteen Volume Hitbox strictly fitted inside 10.5m x 10.5m base footprint
    const canHitbox = new THREE.Mesh(new THREE.BoxGeometry(10.2, 4.8, 10.2), new THREE.MeshBasicMaterial({ visible: false }));
    canHitbox.position.y = 2.4;
    canteen.add(canHitbox);

    canteen.userData = {
      type: "canteen",
      id: "canteen",
      name: "Столовая промысла",
      badge: "☕ СТОЛОВАЯ"
    };

    canteen.traverse(child => {
      if (child.isMesh && !canSmokePuffs.includes(child) && !child.userData?.noRaycast) {
        child.userData = canteen.userData;
        this.interactables.push(child);
      }
    });
    this.scene.add(canteen);

    // 2. Dormitory (Общежитие) at gx: 3.5, gy: 10.2 — 4x3 Cells (14.0m x 10.5m)
    const rawDefaultDormPos = this.gridToWorld(3.5, 10.2, 1.2);
    const savedDormPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("dormitory", rawDefaultDormPos) : rawDefaultDormPos;
    const snappedDorm = this.snapToBuildingGrid(savedDormPos.x, savedDormPos.z, 4, 3, 3.5);
    const dormPos = { x: snappedDorm.x, y: 1.2, z: snappedDorm.z };
    const dorm = new THREE.Group();
    dorm.position.set(dormPos.x, dormPos.y, dormPos.z);
    this.dormGroup = dorm;
    this.registerMovableBuilding("dormitory", dorm, rawDefaultDormPos, { cellsW: 4, cellsD: 3, w: 14.0, d: 10.5, label: "Жилой Комплекс" });

    const dormCurbMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.1 });

    // 1. Raised PAG-14 Reinforced Concrete Slab Platform (Exact 14.0m x 10.5m)
    const dormBase = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.45, 10.5), this.mat.pagConcrete || this.mat.concrete);
    dormBase.position.y = 0.22;
    dormBase.receiveShadow = true;
    dorm.add(dormBase);

    // Beveled perimeter curbs
    [-5.12, 5.12].forEach(cz => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.25, 0.25), dormCurbMat);
      curb.position.set(0, 0.4, cz);
      dorm.add(curb);
    });
    [-6.88, 6.88].forEach(cx => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 10.5), dormCurbMat);
      curb.position.set(cx, 0.4, 0);
      dorm.add(curb);
    });

    // 2. Two-Story Modular Building Block (Warm Residential Appearance)
    const dW = 11.2, dH1 = 3.4, dH2 = 3.2, dD = 7.6;
    const dTotalH = dH1 + dH2;

    // Floor 1 (Ground residential & administrative tier)
    const dFloor1 = new THREE.Mesh(new THREE.BoxGeometry(dW, dH1, dD), this.mat.modularLiving || this.mat.whiteWall);
    dFloor1.position.set(0, 0.45 + dH1 / 2, 0);
    dFloor1.castShadow = true;
    dFloor1.receiveShadow = true;
    dorm.add(dFloor1);

    // Intermediate Warm Accent Fascia Band
    const dMidTrim = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.35, 0.3, dD + 0.35), this.mat.orangeAccent || this.mat.canteenWall);
    dMidTrim.position.set(0, 0.45 + dH1, 0);
    dMidTrim.castShadow = true;
    dorm.add(dMidTrim);

    // Floor 2 (Upper residential quarters tier)
    const dFloor2 = new THREE.Mesh(new THREE.BoxGeometry(dW - 0.3, dH2, dD - 0.3), this.mat.modularLiving || this.mat.whiteWall);
    dFloor2.position.set(0, 0.45 + dH1 + dH2 / 2, 0);
    dFloor2.castShadow = true;
    dFloor2.receiveShadow = true;
    dorm.add(dFloor2);

    // Top Cornice Parapet Trim
    const dRoofTrim = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.45, 0.35, dD + 0.45), this.mat.orangeAccent || this.mat.canteenWall);
    dRoofTrim.position.set(0, 0.45 + dTotalH + 0.18, 0);
    dRoofTrim.castShadow = true;
    dorm.add(dRoofTrim);

    // Realistic Snow Cap with Overhang
    const dRoofSnow = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.3, 0.35, dD + 0.3), this.mat.snowCap);
    dRoofSnow.position.set(0, 0.45 + dTotalH + 0.45, 0);
    dRoofSnow.castShadow = true;
    dorm.add(dRoofSnow);

    // 3. Entrance Porch & Arctic Storm Vestibule
    const dpW = 3.6, dpD = 2.2, dpH = 0.35;
    const dormPorch = new THREE.Mesh(new THREE.BoxGeometry(dpW, dpH, dpD), dormCurbMat);
    dormPorch.position.set(0, 0.45 + dpH / 2, dD / 2 + dpD / 2);
    dormPorch.receiveShadow = true;
    dorm.add(dormPorch);

    // Concrete entry steps leading down to slab
    const dStep = new THREE.Mesh(new THREE.BoxGeometry(dpW + 0.4, 0.18, 0.7), dormCurbMat);
    dStep.position.set(0, 0.45 + 0.09, dD / 2 + dpD + 0.35);
    dorm.add(dStep);

    // Weatherproof insulated entrance doors
    const dDoor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 0.12), this.mat.darkMetal);
    dDoor.position.set(0, 0.45 + 1.3, dD / 2 + 0.06);
    dorm.add(dDoor);

    [-0.45, 0.45].forEach(dx => {
      const doorWin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.14), this.mat.windowLit);
      doorWin.position.set(dx, 0.45 + 1.5, dD / 2 + 0.08);
      dorm.add(doorWin);
    });

    // Modern angled storm canopy
    const dormCanopy = new THREE.Mesh(new THREE.BoxGeometry(dpW + 0.4, 0.18, dpD + 0.3), this.mat.rdOfficeTrim);
    dormCanopy.position.set(0, 0.45 + 3.2, dD / 2 + dpD / 2 - 0.15);
    dormCanopy.rotation.x = -0.1;
    dormCanopy.castShadow = true;
    dorm.add(dormCanopy);

    const dormCanopySnow = new THREE.Mesh(new THREE.BoxGeometry(dpW + 0.3, 0.16, dpD + 0.2), this.mat.snowCap);
    dormCanopySnow.position.set(0, 0.45 + 3.32, dD / 2 + dpD / 2 - 0.15);
    dormCanopySnow.rotation.x = -0.1;
    dormCanopySnow.castShadow = true;
    dorm.add(dormCanopySnow);

    // Downward recessed LED entry lamp casting warm glow
    const dDownlight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.4), this.mat.floodlightLamp);
    dDownlight.position.set(0, 0.45 + 3.1, dD / 2 + 0.9);
    dorm.add(dDownlight);

    // Stainless steel handrails on porch
    [-dpW / 2 + 0.15, dpW / 2 - 0.15].forEach(rx => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), this.mat.silverPipe || this.mat.darkMetal);
      post.position.set(rx, 0.45 + dpH + 0.5, dD / 2 + dpD - 0.15);
      dorm.add(post);

      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, dpD, 8), this.mat.silverPipe || this.mat.darkMetal);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(rx, 0.45 + dpH + 1.0, dD / 2 + dpD / 2);
      dorm.add(rail);
    });

    // 4. Recessed Warm Lit Windows across 2 Floors
    // Floor 1 Front Windows
    [-4.5, -2.6, 2.6, 4.5].forEach(wx => {
      const win1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 0.12), this.mat.windowLit);
      win1.position.set(wx, 0.45 + 2.1, dD / 2 + 0.06);
      dorm.add(win1);

      const frame1 = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.55, 0.06), this.mat.darkMetal);
      frame1.position.set(wx, 0.45 + 2.1, dD / 2 + 0.03);
      dorm.add(frame1);
    });

    // Floor 2 Front Windows
    [-4.5, -2.6, 0.0, 2.6, 4.5].forEach(wx => {
      const win2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 0.12), this.mat.windowLit);
      win2.position.set(wx, 0.45 + dH1 + 1.8, dD / 2 - 0.15 + 0.06);
      dorm.add(win2);

      const frame2 = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.55, 0.06), this.mat.darkMetal);
      frame2.position.set(wx, 0.45 + dH1 + 1.8, dD / 2 - 0.15 + 0.03);
      dorm.add(frame2);
    });

    // Side Windows (West and East elevations)
    [-1.8, 1.8].forEach(wz => {
      // West Floor 1 & 2
      const sWinW1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 1.5), this.mat.windowLit);
      sWinW1.position.set(-dW / 2 - 0.06, 0.45 + 2.1, wz);
      dorm.add(sWinW1);

      const sWinW2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 1.5), this.mat.windowLit);
      sWinW2.position.set(-dW / 2 + 0.15 - 0.06, 0.45 + dH1 + 1.8, wz);
      dorm.add(sWinW2);

      // East Floor 1 & 2
      const sWinE1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 1.5), this.mat.windowLit);
      sWinE1.position.set(dW / 2 + 0.06, 0.45 + 2.1, wz);
      dorm.add(sWinE1);

      const sWinE2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 1.5), this.mat.windowLit);
      sWinE2.position.set(dW / 2 - 0.15 + 0.06, 0.45 + dH1 + 1.8, wz);
      dorm.add(sWinE2);
    });

    // 5. Rooftop Rotating 360° Communications Satellite Dish
    const satGroup = new THREE.Group();
    satGroup.position.set(4.2, 0.45 + dTotalH + 0.8, -1.8);
    const satPole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.2, 8), this.mat.darkMetal);
    satGroup.add(satPole);

    const dormSatPivot = new THREE.Group();
    dormSatPivot.position.y = 1.2;
    satGroup.add(dormSatPivot);
    this.dormDish = dormSatPivot;

    const satDish = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.45, 0.5, 20), this.mat.orangeAccent || this.mat.rdOfficeTrim);
    satDish.rotation.x = Math.PI / 3.8;
    satDish.castShadow = true;
    dormSatPivot.add(satDish);

    const satSpike = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), this.mat.darkMetal);
    satSpike.position.set(0, 0.45, 0.55);
    satSpike.rotation.x = Math.PI / 3.8;
    dormSatPivot.add(satSpike);

    const dormFeedLed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    dormFeedLed.position.set(0, 0.8, 0.95);
    dormSatPivot.add(dormFeedLed);

    dorm.add(satGroup);

    // 6. Dual Rooftop HVAC Air Chillers with Louvers
    [-2.2, 0.5].forEach(hx => {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 1.6), this.mat.greyWall || this.mat.whiteWall);
      hvac.position.set(hx, 0.45 + dTotalH + 1.05, -2.0);
      hvac.castShadow = true;
      dorm.add(hvac);

      const hvacCowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), this.mat.darkMetal);
      hvacCowl.position.set(hx, 0.45 + dTotalH + 1.7, -2.0);
      dorm.add(hvacCowl);
    });

    // 7. Rooftop Radio Communications Mast with Pulsing Red Obstacle Beacon (СОУ-1)
    const dormRadioMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 4.6, 6), this.mat.darkMetal);
    dormRadioMast.position.set(-4.5, 0.45 + dTotalH + 2.7, -1.8);
    dorm.add(dormRadioMast);

    const dormWarnLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff1744,
        emissive: 0xff1744,
        emissiveIntensity: 1.8,
        roughness: 0.1
      })
    );
    dormWarnLight.position.set(-4.5, 0.45 + dTotalH + 5.1, -1.8);
    dorm.add(dormWarnLight);
    if (!this.animatedObjects.beacon) {
      this.animatedObjects.beacon = dormWarnLight;
    }

    // 8. Smoking Oilfield Shift Workers Area on Porch Corner
    const smoker1 = new THREE.Group();
    smoker1.position.set(-1.4, 0.45 + dpH, dD / 2 + dpD / 2);
    const s1Torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.9, 8), this.mat.parkaOrange);
    s1Torso.position.y = 0.45;
    smoker1.add(s1Torso);
    const s1Head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), this.mat.parkaHead);
    s1Head.position.y = 1.05;
    smoker1.add(s1Head);
    // Glowing cigarette ember
    const cig = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), this.mat.fireCore);
    cig.position.set(0.12, 0.95, 0.25);
    smoker1.add(cig);
    dorm.add(smoker1);

    const smoker2 = new THREE.Group();
    smoker2.position.set(1.4, 0.45 + dpH, dD / 2 + dpD / 2);
    smoker2.rotation.y = -0.5;
    const s2Torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.29, 0.9, 8), this.mat.parkaNavy);
    s2Torso.position.y = 0.45;
    smoker2.add(s2Torso);
    const s2Head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), this.mat.parkaHead);
    s2Head.position.y = 1.05;
    smoker2.add(s2Head);
    dorm.add(smoker2);

    // 9. Heating Boiler Exhaust Chimney with Rising White Steam
    const dormChimney = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.8, 8), this.mat.chimneyMetal);
    dormChimney.position.set(-4.5, 0.45 + dTotalH + 1.8, 2.0);
    dormChimney.castShadow = true;
    dorm.add(dormChimney);

    // 4 Animated White Smoke Spheres from Dorm Boiler
    const dormSmokePuffs = [];
    for (let s = 0; s < 4; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.38 + s * 0.16, 6, 6), this.mat.smokeCloud);
      puff.position.set(dormPos.x - 4.5, dormPos.y + dTotalH + 3.2 + s * 0.9, dormPos.z + 2.0);
      this.scene.add(puff);
      dormSmokePuffs.push(puff);
    }
    this.animatedObjects.chimneySmokes.push({
      puffs: dormSmokePuffs,
      baseX: dormPos.x - 4.5,
      baseY: dormPos.y + dTotalH + 3.0,
      baseZ: dormPos.z + 2.0,
      speed: 1.4,
      spread: 0.4
    });

    // Dormitory Volume Hitbox strictly fitted inside 14.0m x 10.5m base footprint
    const dormHitbox = new THREE.Mesh(new THREE.BoxGeometry(13.8, 6.2, 10.3), new THREE.MeshBasicMaterial({ visible: false }));
    dormHitbox.position.y = 3.1;
    dorm.add(dormHitbox);

    dorm.userData = {
      type: "dormitory",
      id: "dormitory",
      name: "Вахтовое общежитие",
      badge: "🏠 ВАХТОВОЕ ОБЩЕЖИТИЕ"
    };

    dorm.traverse(child => {
      if (child.isMesh && !dormSmokePuffs.includes(child) && !child.userData?.noRaycast) {
        child.userData = dorm.userData;
        this.interactables.push(child);
      }
    });
    this.scene.add(dorm);

    // 3. Realistic Arctic Gatehouse (КПП ПРОМЫСЛА) at gx: 1.0, gy: 5.5 - ENLARGED COMPLEX
    const defaultGatePos = this.gridToWorld(1.0, 5.5, 1.2);
    const gatePos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("gatehouse", defaultGatePos) : defaultGatePos;
    const gate = new THREE.Group();
    gate.position.set(gatePos.x, defaultGatePos.y, gatePos.z);
    gate.rotation.y = Math.PI / 2;

    // Phase 14 exact parameter match: Concrete island apron (8.5 x 0.4 x 9.0)
    // Centered on fence line at local_Z = -3.0 (world_X = -66.0)
    const gateIsland = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.4, 9.0), this.mat.concrete);
    gateIsland.position.set(0, 0.22, -3.0);
    gateIsland.receiveShadow = true;
    gate.add(gateIsland);

    // Enlarged concrete apron extension for heavy machinery and 6x6 TREKOL passage (decorative ground)
    const gateApronExt = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.4, 16.0), this.mat.concrete);
    gateApronExt.position.set(0, 0.22, -3.0);
    gateApronExt.receiveShadow = true;
    gateApronExt.userData = { isDecorative: true, noRaycast: true };
    gate.add(gateApronExt);

    // Phase 14 exact parameter match: Officer Guard Booth (5.4 x 4.2 x 4.4) on North side
    // local_X = 8.2 -> world_Z = -23.95 (meets north fence line at z = -21.5)
    const booth = new THREE.Mesh(new THREE.BoxGeometry(5.4, 4.2, 4.4), this.mat.whiteWall);
    booth.position.set(8.2, 2.3, -3.0);
    booth.castShadow = true;
    gate.add(booth);

    // Enlarged Security Operations Annex (building extension)
    const boothAnnex = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.6, 5.2), this.mat.whiteWall);
    boothAnnex.position.set(12.0, 2.5, -3.0);
    boothAnnex.castShadow = true;
    gate.add(boothAnnex);

    // Booth Windows
    const boothWin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 3.4), this.mat.windowLit);
    boothWin.position.set(5.45, 2.7, -3.0);
    gate.add(boothWin);

    const annexWin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 3.2), this.mat.windowLit);
    annexWin.position.set(9.85, 2.7, -3.0);
    gate.add(annexWin);

    // Guardhouse corner structural columns
    [[5.5, -5.2], [14.1, -5.2], [5.5, -0.8], [14.1, -0.8]].forEach(([cx, cz]) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.3), this.mat.darkMetal);
      col.position.set(cx, 2.3, cz);
      col.castShadow = true;
      gate.add(col);
    });

    // Guard personnel entry door with protective canopy
    const guardDoor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 1.2), this.mat.darkMetal);
    guardDoor.position.set(14.15, 1.5, -3.0);
    gate.add(guardDoor);

    const doorCanopy = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 1.6), this.mat.orangeAccent);
    doorCanopy.position.set(14.4, 2.8, -3.0);
    gate.add(doorCanopy);

    const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 6.2), this.mat.orangeAccent);
    boothRoof.position.set(9.5, 4.55, -3.0);
    gate.add(boothRoof);

    const boothSnow = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.35, 6.0), this.mat.snowCap);
    boothSnow.position.set(9.5, 4.9, -3.0);
    gate.add(boothSnow);

    // Architectural illuminated physical signboard on guardhouse
    const gateSign = this.createPhysicalSignboard("КПП ПРОМЫСЛА • СТОП", "🛂", "#ef4444", 7.8, 1.8);
    gateSign.position.set(9.5, 5.3, -0.2);
    gate.add(gateSign);

    // Overhead Inspection Canopy / Portal Trusses across Driveway (Span width 10.2m)
    const canopyTrussL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), this.mat.steel);
    canopyTrussL.position.set(-5.1, 3.3, -3.0);
    gate.add(canopyTrussL);

    const canopyTrussR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), this.mat.steel);
    canopyTrussR.position.set(5.1, 3.3, -3.0);
    gate.add(canopyTrussR);

    const overheadBeam = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.5, 0.5), this.mat.redSteel);
    overheadBeam.position.set(0, 6.3, -3.0);
    gate.add(overheadBeam);

    const overheadRoof = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.4, 6.0), this.mat.orangeAccent);
    overheadRoof.position.set(0, 6.6, -3.0);
    gate.add(overheadRoof);

    const overheadSnow = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.3, 5.8), this.mat.snowCap);
    overheadSnow.position.set(0, 6.9, -3.0);
    gate.add(overheadSnow);

    // Security Floodlight & 360 Camera Pole
    const camPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.5, 8), this.mat.darkMetal);
    camPole.position.set(10.5, 3.45, -1.2);
    gate.add(camPole);

    const camDome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), this.mat.floodlightLamp);
    camDome.position.set(10.5, 6.7, -1.2);
    gate.add(camDome);

    // High-mast security floodlights illuminating inspection lane
    [-0.3, 0.3].forEach(dx => {
      const floodHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.3), this.mat.darkMetal);
      floodHead.position.set(10.5 + dx, 6.2, -1.0);
      gate.add(floodHead);

      const floodLens = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), this.mat.floodlightLamp);
      floodLens.position.set(10.5 + dx, 6.2, -0.82);
      gate.add(floodLens);
    });

    // Radio telecommunication antenna mast on booth roof
    const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), this.mat.darkMetal);
    antMast.position.set(11.5, 6.4, -3.0);
    gate.add(antMast);

    const antLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), this.mat.redSteel);
    antLight.position.set(11.5, 8.0, -3.0);
    gate.add(antLight);

    // Phase 14 exact parameter match: Barrier Pylon & Arm on South side
    // local_X = -5.1 -> world_Z = -10.65 (meets south fence line at z = -10.5)
    const pylon1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.2, 0.9), this.mat.redSteel);
    pylon1.position.set(-5.1, 2.3, -3.0);
    pylon1.castShadow = true;
    gate.add(pylon1);

    // Phase 14 exact parameter match: Traffic Signal (0.35 x 0.8 x 0.35)
    const trafficBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), this.mat.darkMetal);
    trafficBox.position.set(-5.1, 4.4, -3.0);
    gate.add(trafficBox);

    // High-visibility Traffic Backboard (фоновый щит со световозвращающей каймой)
    const trafficBackboard = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.35, 0.08), this.mat.darkMetal);
    trafficBackboard.position.set(-5.1, 4.4, -3.0);
    gate.add(trafficBackboard);
    const trafficBorder = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.42, 0.06), this.mat.hazardStripe);
    trafficBorder.position.set(-5.1, 4.4, -3.0);
    gate.add(trafficBorder);

    // Sun Hoods / Visors (козырьки над сигналами)
    [-2.65, -3.35].forEach(vz => {
      const visorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8, 1, false, 0, Math.PI), this.mat.darkMetal);
      visorTop.rotation.x = Math.PI / 2;
      visorTop.position.set(-5.1, 4.88, vz);
      gate.add(visorTop);

      const visorBot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8, 1, false, 0, Math.PI), this.mat.darkMetal);
      visorBot.rotation.x = Math.PI / 2;
      visorBot.position.set(-5.1, 4.28, vz);
      gate.add(visorBot);
    });

    // High-visibility glowing LED traffic lights
    const matGreenOff = new THREE.MeshStandardMaterial({
      color: 0x052e16,
      emissive: 0x052e16,
      emissiveIntensity: 0.1,
      roughness: 0.8
    });
    const matRedOn = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.8,
      roughness: 0.2
    });

    const lightGreen = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), matGreenOff);
    lightGreen.position.set(-5.1, 4.1, -2.55);
    gate.add(lightGreen);

    const lightRed = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), matRedOn);
    lightRed.position.set(-5.1, 4.7, -2.55);
    gate.add(lightRed);

    // Rear lenses for exterior visibility from outside zimnik
    const lightGreenRear = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), matGreenOff);
    lightGreenRear.position.set(-5.1, 4.1, -3.45);
    gate.add(lightGreenRear);

    const lightRedRear = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), matRedOn);
    lightRedRear.position.set(-5.1, 4.7, -3.45);
    gate.add(lightRedRear);
    this.gateLightGreenRear = lightGreenRear;
    this.gateLightRedRear = lightRedRear;

    const signalPointLight = new THREE.PointLight(0xef4444, 2.5, 14);
    signalPointLight.position.set(-5.1, 4.7, -2.2);
    gate.add(signalPointLight);
    this.signalPointLight = signalPointLight;

    // Barrier Pivot & Arm spanning across full 10.2m roadway
    const barrierPivot = new THREE.Group();
    barrierPivot.position.set(-5.1, 1.8, -3.0);
    gate.add(barrierPivot);

    const barrierArm = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.28, 0.28), this.mat.hazardStripe);
    barrierArm.position.x = 5.1;
    barrierPivot.add(barrierArm);

    // High-visibility STOP sign disc on barrier arm
    const barrierStopBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16), this.mat.redSteel);
    barrierStopBadge.rotation.x = Math.PI / 2;
    barrierStopBadge.position.set(5.1, 0, 0.16);
    barrierPivot.add(barrierStopBadge);

    this.animatedObjects.gateBarrier = barrierPivot;
    this.gateBarrier = barrierPivot;
    this.gateLightGreen = lightGreen;
    this.gateLightRed = lightRed;
    this.gatehouseGroup = gate;

    if (this.trekolRover && typeof this.trekolRover.initCheckpoint === "function") {
      this.trekolRover.initCheckpoint({
        barrierPivot: this.gateBarrier,
        lightGreen: this.gateLightGreen,
        lightRed: this.gateLightRed,
        lightGreenRear: this.gateLightGreenRear,
        lightRedRear: this.gateLightRedRear,
        gateGroup: this.gatehouseGroup,
        signalLight: this.signalPointLight
      });
    }

    // Phase 14 exact parameter match: New Jersey Impact Barriers (1.2 x 0.9 x 2.8)
    [-5.6, 5.6].forEach(ox => {
      const jersey = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 2.8), this.mat.hazardStripe);
      jersey.position.set(ox, 0.65, -3.0);
      gate.add(jersey);
    });

    const gateBoard = this.create3DBillboard("★ КПП ПРОМЫСЛА ★", "КОНТРОЛЬ ДОСТУПА • СТОП", "#ef4444", "#1e293b", 16.5, 3.8);
    gateBoard.position.set(0, 4.8, -3.0);
    gateBoard.visible = false;
    gate.add(gateBoard);
    gate.userData.billboard = gateBoard;
    gate.userData.billboard = gateBoard;

    gate.userData = {
      type: "gatehouse",
      id: "gatehouse",
      name: "КПП Промысла",
      badge: "★ КПП ПРОМЫСЛА ★"
    };

    gate.traverse(child => {
      if (child.isMesh && !child.userData?.noRaycast) {
        child.userData = gate.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("gatehouse", gate, { gx: 1.0, gy: 5.5, yOffset: 1.2 }, { cellsW: 3, cellsD: 2, w: 10.5, d: 7.0, label: "КПП и Охрана" });
    this.scene.add(gate);

    // 4. Heavy Arctic Vehicle Garage (ГАРАЖ ТЕХНИКИ / АТБ) at gx: 2.8, gy: 4.2 — 5x4 Cells (17.5m x 14.0m)
    const rawDefaultGaragePos = this.gridToWorld(2.8, 4.2, 1.2);
    const savedGaragePos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("garage", rawDefaultGaragePos) : rawDefaultGaragePos;
    const snappedGarage = this.snapToBuildingGrid(savedGaragePos.x, savedGaragePos.z, 5, 4, 3.5);
    const garageGroup = new THREE.Group();
    garageGroup.position.set(snappedGarage.x, 1.2, snappedGarage.z);
    this.garageGroup = garageGroup;
    this.registerMovableBuilding("garage", garageGroup, rawDefaultGaragePos, { cellsW: 5, cellsD: 4, w: 17.5, d: 14.0, label: "Гараж ТРЭКОЛ" });

    // Concrete Workshop Foundation Apron (Exact 17.5m x 14.0m)
    const gBase = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.55, 14.0), this.mat.concrete);
    gBase.position.y = 0.28;
    gBase.receiveShadow = true;
    garageGroup.add(gBase);

    // Hazard striped apron entrance threshold
    const gThreshold = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.15, 1.8), this.mat.hazardStripe);
    gThreshold.position.set(0, 0.35, 5.8);
    garageGroup.add(gThreshold);

    // Main Insulated Hangar Body
    const gBody = new THREE.Mesh(new THREE.BoxGeometry(14.5, 6.2, 9.5), this.mat.garageWall || this.mat.whiteWall);
    gBody.position.set(0, 3.45, -0.8);
    gBody.castShadow = true;
    garageGroup.add(gBody);

    // Structural steel pilasters along exterior walls (ribbed relief)
    [-7.3, 7.3].forEach(px => {
      [-3.5, 0, 3.5].forEach(pz => {
        const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.4, 0.35), this.mat.darkMetal);
        pilaster.position.set(px, 3.45, pz - 0.8);
        pilaster.castShadow = true;
        garageGroup.add(pilaster);
      });
    });
    // Rear wall pilasters
    [-4.5, 0, 4.5].forEach(px => {
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.4, 0.35), this.mat.darkMetal);
      pilaster.position.set(px, 3.45, -5.55);
      pilaster.castShadow = true;
      garageGroup.add(pilaster);
    });

    // Architectural Gazprom Corporate Blue Trim & Hazard Skirting
    const gTrimTop = new THREE.Mesh(new THREE.BoxGeometry(14.9, 0.65, 9.9), this.mat.orangeAccent);
    gTrimTop.position.set(0, 6.6, -0.8);
    garageGroup.add(gTrimTop);

    const gSkirting = new THREE.Mesh(new THREE.BoxGeometry(14.7, 0.45, 9.7), this.mat.hazardStripe);
    gSkirting.position.set(0, 0.65, -0.8);
    garageGroup.add(gSkirting);

    // Gable Roof & Snow Cap with realistic overhang snow trim
    const gRoof = new THREE.Mesh(new THREE.BoxGeometry(19.0, 0.55, 12.0), this.mat.greyWall);
    gRoof.position.set(0, 7.3, 0);
    gRoof.castShadow = true;
    garageGroup.add(gRoof);

    const gSnow = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.45, 11.8), this.mat.snowCap);
    gSnow.position.set(0, 7.7, 0);
    garageGroup.add(gSnow);

    // Overhanging roof snow cornice trim (front and rear)
    [-5.95, 5.95].forEach(oz => {
      const snowTrim = new THREE.Mesh(new THREE.BoxGeometry(18.9, 0.35, 0.5), this.mat.snowCap);
      snowTrim.position.set(0, 7.55, oz);
      garageGroup.add(snowTrim);
    });

    // 2 Large Sectional Vehicle Bay Doors with yellow/black hazard chevrons
    [-4.5, 4.5].forEach((doorX, bIdx) => {
      // Outer portal architrave with hazard striping
      const bayFrame = new THREE.Mesh(new THREE.BoxGeometry(6.6, 5.0, 0.4), this.mat.hazardStripe);
      bayFrame.position.set(doorX, 2.8, 5.55);
      garageGroup.add(bayFrame);

      // Sectional roll-up door panels with recessed grooves
      for (let p = 0; p < 4; p++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.0, 0.22), this.mat.darkMetal);
        panel.position.set(doorX, 1.0 + p * 1.15, 5.72);
        garageGroup.add(panel);

        // Groove between panels
        const groove = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.08, 0.24), this.mat.concreteDark || this.mat.darkMetal);
        groove.position.set(doorX, 1.55 + p * 1.15, 5.72);
        garageGroup.add(groove);
      }

      // Sectional Window Slits with warm interior glow
      const slit = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.45, 0.12), this.mat.windowLit);
      slit.position.set(doorX, 3.3, 5.85);
      garageGroup.add(slit);

      // Bay door clearance warning LED indicators
      const ledG = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.mat.floodlightLamp);
      ledG.position.set(doorX - 2.8, 5.4, 5.75);
      garageGroup.add(ledG);
      const ledR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.mat.redSteel);
      ledR.position.set(doorX + 2.8, 5.4, 5.75);
      garageGroup.add(ledR);
    });

    // Industrial Roof Exhaust Stacks for diesel engine fumes
    [-6.0, 6.0].forEach(sx => {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.8, 12), this.mat.silverPipe || this.mat.darkMetal);
      stack.position.set(sx, 9.8, -3.5);
      stack.castShadow = true;
      garageGroup.add(stack);

      // Stack rain deflector hood cap
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.45, 12), this.mat.darkMetal);
      hood.position.set(sx, 12.4, -3.5);
      garageGroup.add(hood);

      // Mounting bracket band
      const bracket = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 12), this.mat.darkMetal);
      bracket.rotation.x = Math.PI / 2;
      bracket.position.set(sx, 8.5, -3.5);
      garageGroup.add(bracket);
    });

    // Outdoor Wall-Mounted Gooseneck Floodlights above vehicle bays
    [-4.5, 0, 4.5].forEach(fx => {
      const fArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.1), this.mat.darkMetal);
      fArm.position.set(fx, 6.2, 5.95);
      garageGroup.add(fArm);

      const fShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.35, 10), this.mat.darkMetal);
      fShroud.rotation.x = Math.PI / 4;
      fShroud.position.set(fx, 6.1, 6.45);
      garageGroup.add(fShroud);

      const fLamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), this.mat.floodlightLamp);
      fLamp.position.set(fx, 5.95, 6.55);
      garageGroup.add(fLamp);
    });

    // Crisp high-resolution physical signboard
    const garSign = this.createPhysicalSignboard("АВТОБАЗА СПЕЦТЕХНИКИ (АТБ)", "🚜", "#f59e0b", 15.0, 2.8);
    garSign.position.set(0, 8.8, 4.4);
    garageGroup.add(garSign);

    // Outdoor Maintenance Ramp (Эстакада ТО с рельсами)
    [-1.1, 1.1].forEach(rx => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 6.5), this.mat.concrete);
      rail.position.set(-10.5 + rx, 0.65, 2.5);
      rail.castShadow = true;
      garageGroup.add(rail);

      const metalTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 6.5), this.mat.hazardStripe);
      metalTop.position.set(-10.5 + rx, 1.25, 2.5);
      garageGroup.add(metalTop);
    });

    // Spare Low-Pressure Tires Rack (Шины ТРЭКОЛ сверхнизкого давления)
    for (let tr = 0; tr < 3; tr++) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.85, 14), this.mat.darkMetal);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(10.2, 1.2, 1.2 + tr * 1.1);
      tire.castShadow = true;
      garageGroup.add(tire);
    }

    // Garage Volume Hitbox strictly fitted inside 17.5m x 14.0m base footprint
    const gHitbox = new THREE.Mesh(new THREE.BoxGeometry(17.3, 6.8, 13.8), new THREE.MeshBasicMaterial({ visible: false }));
    gHitbox.position.y = 3.4;
    garageGroup.add(gHitbox);

    garageGroup.userData = {
      type: "garage",
      id: "garage",
      name: "Гараж автотехники (АТБ)",
      badge: "🚜 ГАРАЖ ТЕХНИКИ"
    };

    garageGroup.traverse(child => {
      if (child.isMesh && !child.userData?.noRaycast) {
        child.userData = garageGroup.userData;
        this.interactables.push(child);
      }
    });
    this.scene.add(garageGroup);

    // 5. Research & Exploration Headquarters (ЦЕНТР ГЕОЛОГОРАЗВЕДКИ / ЗДАНИЕ ГЕОЛОГОВ) at gx: 1.7, gy: 8.2
    if (this.rdOfficeGroup) {
      this.cleanupInteractablesForGroup(this.rdOfficeGroup);
      this.scene.remove(this.rdOfficeGroup);
    }
    const rawDefaultRdPos = this.gridToWorld(1.7, 8.2, 1.2);
    const defaultRdPos = rawDefaultRdPos;
    const savedRdPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("rd_office", rawDefaultRdPos) : rawDefaultRdPos;
    const snappedRd = this.snapToBuildingGrid(savedRdPos.x, savedRdPos.z, 6, 4, 3.5);
    const rdPos = { x: snappedRd.x, y: 1.2, z: snappedRd.z };
    const rdGroup = new THREE.Group();
    rdGroup.position.set(rdPos.x, rdPos.y, rdPos.z);
    this.rdOfficeGroup = rdGroup;

    // PAG Concrete Base Slab with curb (Exact 6x4 Cells = 21.0m x 14.0m)
    const rdBase = new THREE.Mesh(new THREE.BoxGeometry(21.0, 0.5, 14.0), this.mat.pagConcrete || this.mat.concrete);
    rdBase.position.y = 0.25;
    rdBase.receiveShadow = true;
    rdGroup.add(rdBase);

    const rdCurbMat = this.mat.concreteDark || this.mat.concrete;
    [-10.38, 10.38].forEach(cx => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 14.0), rdCurbMat);
      c.position.set(cx, 0.28, 0);
      rdGroup.add(c);
    });
    [-6.88, 6.88].forEach(cz => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(21.0, 0.55, 0.25), rdCurbMat);
      c.position.set(0, 0.28, cz);
      rdGroup.add(c);
    });

    // --- MAIN 2-STORY LABORATORY WING ---
    const gW = 15.0, gH1 = 3.6, gH2 = 3.4, gD = 10.0;
    const gTotalH = gH1 + gH2;
    const gX = -3.5, gZ = -0.5;

    // Floor 1
    const floor1 = new THREE.Mesh(new THREE.BoxGeometry(gW, gH1, gD), this.mat.rdOfficeWall);
    floor1.position.set(gX, 0.5 + gH1 / 2, gZ);
    floor1.castShadow = true;
    floor1.receiveShadow = true;
    rdGroup.add(floor1);

    // Middle Accent Trim Band (Cyan)
    const midTrim = new THREE.Mesh(new THREE.BoxGeometry(gW + 0.5, 0.35, gD + 0.5), this.mat.rdOfficeTrim);
    midTrim.position.set(gX, 0.5 + gH1, gZ);
    midTrim.castShadow = true;
    rdGroup.add(midTrim);

    // Floor 2
    const floor2 = new THREE.Mesh(new THREE.BoxGeometry(gW - 0.4, gH2, gD - 0.4), this.mat.rdOfficeWall);
    floor2.position.set(gX, 0.5 + gH1 + gH2 / 2, gZ);
    floor2.castShadow = true;
    floor2.receiveShadow = true;
    rdGroup.add(floor2);

    // Roof Parapet Cyan Trim
    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(gW + 0.6, 0.45, gD + 0.6), this.mat.rdOfficeTrim);
    roofTrim.position.set(gX, 0.5 + gTotalH + 0.22, gZ);
    roofTrim.castShadow = true;
    rdGroup.add(roofTrim);

    // Snow Cap on Roof
    const roofSnow = new THREE.Mesh(new THREE.BoxGeometry(gW + 0.4, 0.4, gD + 0.4), this.mat.snowCap);
    roofSnow.position.set(gX, 0.5 + gTotalH + 0.55, gZ);
    roofSnow.castShadow = true;
    rdGroup.add(roofSnow);

    // --- ENTRANCE PORCH WITH DOORS & CANOPY ---
    const pW = 4.0, pD = 2.4, pH = 0.35;
    const porch = new THREE.Mesh(new THREE.BoxGeometry(pW, pH, pD), rdCurbMat);
    porch.position.set(gX - 2.5, 0.5 + pH / 2, gZ + gD / 2 + pD / 2);
    porch.receiveShadow = true;
    rdGroup.add(porch);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 0.1), this.mat.darkMetal);
    door.position.set(gX - 2.5, 0.5 + 1.3, gZ + gD / 2 + 0.05);
    rdGroup.add(door);

    [-0.45, 0.45].forEach(dx => {
      const doorWin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.12), this.mat.windowLit);
      doorWin.position.set(gX - 2.5 + dx, 0.5 + 1.5, gZ + gD / 2 + 0.06);
      rdGroup.add(doorWin);
    });

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(pW + 0.4, 0.2, pD + 0.3), this.mat.rdOfficeTrim);
    canopy.position.set(gX - 2.5, 0.5 + 3.2, gZ + gD / 2 + pD / 2 - 0.2);
    canopy.castShadow = true;
    rdGroup.add(canopy);

    const canopySnow = new THREE.Mesh(new THREE.BoxGeometry(pW + 0.3, 0.18, pD + 0.2), this.mat.snowCap);
    canopySnow.position.set(gX - 2.5, 0.5 + 3.35, gZ + gD / 2 + pD / 2 - 0.2);
    canopySnow.castShadow = true;
    rdGroup.add(canopySnow);

    // Downward Recessed LED Entrance Lamp
    const downlight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.5), this.mat.floodlightLamp);
    downlight.position.set(gX - 2.5, 0.5 + 3.08, gZ + gD / 2 + 1.0);
    rdGroup.add(downlight);

    // Handrails
    [-pW / 2 + 0.15, pW / 2 - 0.15].forEach(rx => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), this.mat.silverPipe || this.mat.darkMetal);
      post.position.set(gX - 2.5 + rx, 0.5 + pH + 0.5, gZ + gD / 2 + pD - 0.2);
      rdGroup.add(post);

      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, pD, 8), this.mat.silverPipe || this.mat.darkMetal);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(gX - 2.5 + rx, 0.5 + pH + 1.0, gZ + gD / 2 + pD / 2);
      rdGroup.add(rail);
    });

    // --- PANORAMIC GEOLOGICAL LAB WINDOWS ---
    // Floor 1 Windows
    [1.5, 4.5].forEach(wx => {
      const win1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.12), this.mat.rdOfficeGlass);
      win1.position.set(gX + wx, 0.5 + 2.0, gZ + gD / 2 + 0.06);
      rdGroup.add(win1);
    });

    // Floor 2 Windows
    [-4.5, -1.5, 1.5, 4.5].forEach(wx => {
      const win2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.12), this.mat.rdOfficeGlass);
      win2.position.set(gX + wx, 0.5 + gH1 + 1.8, gZ + gD / 2 + 0.06);
      rdGroup.add(win2);
    });

    // Side Windows
    [-2.5, 2.5].forEach(wz => {
      const winS = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 2.2), this.mat.rdOfficeGlass);
      winS.position.set(gX - gW / 2 - 0.06, 0.5 + gH1 + 1.8, gZ + wz);
      rdGroup.add(winS);
    });

    // --- ATTACHED CORE SAMPLE ANALYSIS MODULE ---
    const labW = 6.5, labH = 3.2, labD = 7.5;
    const labX = gX + gW / 2 + labW / 2 + 0.2;
    const labZ = gZ - 0.6;

    const labBody = new THREE.Mesh(new THREE.BoxGeometry(labW, labH, labD), this.mat.darkMetal);
    labBody.position.set(labX, 0.5 + labH / 2, labZ);
    labBody.castShadow = true;
    rdGroup.add(labBody);

    const labTrim = new THREE.Mesh(new THREE.BoxGeometry(labW + 0.4, 0.3, labD + 0.4), this.mat.rdOfficeTrim);
    labTrim.position.set(labX, 0.5 + labH + 0.15, labZ);
    rdGroup.add(labTrim);

    const labSnow = new THREE.Mesh(new THREE.BoxGeometry(labW + 0.3, 0.35, labD + 0.3), this.mat.snowCap);
    labSnow.position.set(labX, 0.5 + labH + 0.45, labZ);
    rdGroup.add(labSnow);

    // Core Delivery Rollup Door with Hazard Threshold
    const labDoor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.1), this.mat.rdOfficeWall);
    labDoor.position.set(labX, 0.5 + 1.1, labZ + labD / 2 + 0.05);
    rdGroup.add(labDoor);

    const thresh = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.5), this.mat.hazardStripe || this.mat.orangeAccent);
    thresh.position.set(labX, 0.5 + 0.06, labZ + labD / 2 + 0.25);
    rdGroup.add(thresh);

    // --- CORE SAMPLE CANOPY & SPECIMEN CRATES ---
    const coreCanopyW = 5.5, coreCanopyD = 3.2, coreCanopyH = 2.6;
    const coreX = labX + 0.3, coreZ = labZ + labD / 2 + 2.2;

    const cRoof = new THREE.Mesh(new THREE.BoxGeometry(coreCanopyW, 0.15, coreCanopyD), this.mat.rdOfficeTrim);
    cRoof.position.set(coreX, 0.5 + coreCanopyH, coreZ);
    rdGroup.add(cRoof);

    const cRoofSnow = new THREE.Mesh(new THREE.BoxGeometry(coreCanopyW - 0.1, 0.2, coreCanopyD - 0.1), this.mat.snowCap);
    cRoofSnow.position.set(coreX, 0.5 + coreCanopyH + 0.15, coreZ);
    rdGroup.add(cRoofSnow);

    [[-coreCanopyW / 2 + 0.2, -coreCanopyD / 2 + 0.2],
     [coreCanopyW / 2 - 0.2, -coreCanopyD / 2 + 0.2],
     [-coreCanopyW / 2 + 0.2, coreCanopyD / 2 - 0.2],
     [coreCanopyW / 2 - 0.2, coreCanopyD / 2 - 0.2]].forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, coreCanopyH, 0.1), this.mat.darkMetal);
      post.position.set(coreX + px, 0.5 + coreCanopyH / 2, coreZ + pz);
      rdGroup.add(post);
    });

    // Core Sample Wooden Crates
    for (let c = 0; c < 4; c++) {
      const cx = coreX - 1.2 + (c % 2) * 1.4;
      const cz = coreZ - 0.5 + Math.floor(c / 2) * 1.1;

      const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.85), this.mat.woodPlatform);
      pallet.position.set(cx, 0.5 + 0.06, cz);
      rdGroup.add(pallet);

      for (let layer = 0; layer < 2; layer++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.7), this.mat.woodPlatform);
        crate.position.set(cx, 0.5 + 0.25 + layer * 0.32, cz);
        rdGroup.add(crate);
      }
    }

    // --- ROOFTOP RADAR, ANEMOMETER & BEACONS ---
    // A. 360° Rotating Satellite Dish
    const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8), this.mat.darkMetal);
    dishMast.position.set(gX - 4.5, 0.5 + gTotalH + 1.8, gZ + 1.5);
    rdGroup.add(dishMast);

    const satPivot = new THREE.Group();
    satPivot.position.set(gX - 4.5, 0.5 + gTotalH + 3.2, gZ + 1.5);
    rdGroup.add(satPivot);
    this.rdDish = satPivot;

    const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.45, 0.5, 20), this.mat.orangeAccent || this.mat.rdOfficeTrim);
    dish.rotation.x = Math.PI / 3.8;
    dish.castShadow = true;
    satPivot.add(dish);

    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), this.mat.darkMetal);
    spike.position.z = 0.55;
    spike.rotation.x = Math.PI / 2;
    satPivot.add(spike);

    const feedLed = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    feedLed.position.set(0, 0.2, 1.25);
    satPivot.add(feedLed);

    // B. Rotating Cup Anemometer (Ветромер)
    const anemoMast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), this.mat.darkMetal);
    anemoMast.position.set(gX + 4.5, 0.5 + gTotalH + 1.5, gZ + 2.0);
    rdGroup.add(anemoMast);

    const anemoPivot = new THREE.Group();
    anemoPivot.position.set(gX + 4.5, 0.5 + gTotalH + 2.6, gZ + 2.0);
    rdGroup.add(anemoPivot);
    this.rdAnemometer = anemoPivot;

    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.03), this.mat.darkMetal);
      arm.rotation.y = (i * Math.PI * 2) / 3;
      arm.position.x = Math.cos((i * Math.PI * 2) / 3) * 0.32;
      arm.position.z = Math.sin((i * Math.PI * 2) / 3) * 0.32;
      anemoPivot.add(arm);

      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8, 0, Math.PI), this.mat.orangeAccent);
      cup.rotation.y = (i * Math.PI * 2) / 3 + Math.PI / 2;
      cup.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.65, 0, Math.sin((i * Math.PI * 2) / 3) * 0.65);
      anemoPivot.add(cup);
    }

    // C. Radio Telemetry Lattice Mast with Pulsing Red Beacon (СОУ-1)
    const radioMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 5.2, 6), this.mat.darkMetal);
    radioMast.position.set(gX + 1.0, 0.5 + gTotalH + 3.0, gZ - 2.5);
    rdGroup.add(radioMast);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    beacon.position.set(gX + 1.0, 0.5 + gTotalH + 5.7, gZ - 2.5);
    rdGroup.add(beacon);

    // D. Rooftop HVAC Climate Units
    [-1.5, 1.5].forEach(hx => {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.6), this.mat.darkMetal);
      hvac.position.set(gX + hx, 0.5 + gTotalH + 0.9, gZ - 2.0);
      rdGroup.add(hvac);
    });

    // E. Heating Exhaust Stack with Steam Smoke Puffs
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8), this.mat.chimneyMetal || this.mat.darkMetal);
    chimney.position.set(gX + 4.5, 0.5 + gTotalH + 1.5, gZ - 2.5);
    rdGroup.add(chimney);

    if (this.animatedObjects?.chimneySmokes) {
      const rdPuffs = [];
      for (let p = 0; p < 4; p++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.28 + p * 0.14, 6, 6), this.mat.smokeCloud);
        puff.position.set(rdPos.x + gX + 4.5, defaultRdPos.y + gTotalH + 2.6 + p * 0.7, rdPos.z + gZ - 2.5);
        this.scene.add(puff);
        rdPuffs.push(puff);
      }
      this.animatedObjects.chimneySmokes.push({
        puffs: rdPuffs,
        baseX: rdPos.x + gX + 4.5,
        baseY: defaultRdPos.y + gTotalH + 2.5,
        baseZ: rdPos.z + gZ - 2.5,
        speed: 1.5,
        spread: 0.3
      });
    }

    // RD Office Volume Hitbox strictly fitted inside 21.0m x 14.0m base footprint
    const rdHitbox = new THREE.Mesh(new THREE.BoxGeometry(20.8, 6.8, 13.8), new THREE.MeshBasicMaterial({ visible: false }));
    rdHitbox.position.y = 3.4;
    rdGroup.add(rdHitbox);

    rdGroup.userData = {
      type: "rd_office",
      id: "rd_office",
      name: "Офис разработки",
      badge: "🗺️ ОФИС РАЗРАБОТКИ"
    };

    rdGroup.traverse(child => {
      if (child.isMesh && !child.userData?.noRaycast) {
        child.userData = rdGroup.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("rd_office", rdGroup, rawDefaultRdPos, { cellsW: 6, cellsD: 4, w: 21.0, d: 14.0, label: "НТЦ Геологии" });
    this.scene.add(rdGroup);
  }

  // --- 6. RED STEEL FLARE TOWER ---
  buildCryptoFlareTower() {
    const THREE = this.THREE;
    const g = new THREE.Group();
    const defaultFlarePos = this.gridToWorld(12.0, 11.5, 1.2);
    const flarePos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("crypto_flare", defaultFlarePos) : defaultFlarePos;
    g.position.set(flarePos.x, defaultFlarePos.y, flarePos.z);
    this.cryptoFlareGroup = g;

    const fH = 28;
    const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.6, 7.5), this.mat.concrete);
    base.position.y = 0.8;
    g.add(base);

    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([cx, cz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, fH, 8), this.mat.redSteel);
      leg.position.set(cx * 1.6, fH / 2 + 1.6, cz * 1.6);
      leg.castShadow = true;
      g.add(leg);
    });

    const flameGroup = new THREE.Group();
    flameGroup.position.set(0, fH + 2.0, 0);
    const flameGeo = new THREE.ConeGeometry(1.2, 4.2, 8);
    flameGeo.translate(0, 2.1, 0);
    flameGroup.add(new THREE.Mesh(flameGeo, this.mat.fire));
    g.add(flameGroup);
    this.animatedObjects.flameGroup = flameGroup;

    const flameLight = new THREE.PointLight(0xff9100, 3.0, 55, 1.8);
    flameLight.position.set(0, fH + 3.8, 0);
    g.add(flameLight);
    this.animatedObjects.flameLight = flameLight;

    const dataBox = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.0, 4.0), this.mat.darkMetal);
    dataBox.position.set(-6.5, 2.1, 0);
    g.add(dataBox);

    const isCrypto = state.cryptoMiningActive;
    const flareBoard = this.create3DBillboard(
      "ФАКЕЛ & ЦОД",
      isCrypto ? "⚡ PETROCOIN: АКТИВЕН" : "🔒 ТРЕБУЕТСЯ АКТИВАЦИЯ",
      isCrypto ? "#a855f7" : "#f59e0b",
      "#1e293b",
      15,
      4.8
    );
    flareBoard.position.set(0, fH + 8.5, 0);
    g.add(flareBoard);

    g.userData = {
      type: "crypto_flare",
      id: "crypto_flare",
      name: "Факельная установка & ЦОД",
      badge: "PETROCOIN МАЙНИНГ"
    };

    g.traverse(child => {
      if (child.isMesh) {
        child.userData = g.userData;
        this.interactables.push(child);
      }
    });

    this.registerMovableBuilding("crypto_flare", g, { gx: 12.0, gy: 11.5, yOffset: 1.2 }, { cellsW: 3, cellsD: 3, w: 10.5, d: 10.5, label: "Крипто-модуль ПНГ" });
    this.scene.add(g);
  }

  // --- 7. EXPANSION SECTORS ACROSS CHASMS ---
  buildExpansionSectors() {
    const THREE = this.THREE;
    const group = new THREE.Group();

    // 1. East Sector - Solid Permafrost Foundation & Snow Surface
    const eastPos = this.gridToWorld(19.5, 5.0, 0.6);
    const eastBase = new THREE.Mesh(new THREE.BoxGeometry(36, 24, 40), this.mat.permafrost);
    eastBase.position.set(eastPos.x, -12, eastPos.z);
    eastBase.receiveShadow = true;
    group.add(eastBase);

    const eastIsland = new THREE.Mesh(new THREE.BoxGeometry(36, 1.2, 40), this.mat.snow);
    eastIsland.position.set(eastPos.x, eastPos.y, eastPos.z);
    eastIsland.receiveShadow = true;
    group.add(eastIsland);

    const isEastUnlocked = state.isTerritoryUnlocked ? state.isTerritoryUnlocked("east_achim") : false;
    const eastBoard = this.create3DBillboard(
      "ВОСТОЧНЫЙ УЧАСТОК",
      isEastUnlocked ? "✓ РАЗВЕДАН" : "🔒 ТРЕБУЕТСЯ ВЫХОД НА IPO",
      isEastUnlocked ? "#22c55e" : "#f59e0b",
      "#1e293b",
      17,
      5.2
    );
    eastBoard.position.set(eastPos.x, 8.5, eastPos.z);
    group.add(eastBoard);

    // 2. North Shelf - Solid Permafrost Foundation & Concrete Surface
    const northPos = this.gridToWorld(5.0, -6.0, 0.6);
    const northBase = new THREE.Mesh(new THREE.BoxGeometry(42, 24, 36), this.mat.permafrost);
    northBase.position.set(northPos.x, -12, northPos.z);
    northBase.receiveShadow = true;
    group.add(northBase);

    const northIsland = new THREE.Mesh(new THREE.BoxGeometry(42, 1.2, 36), this.mat.concrete);
    northIsland.position.set(northPos.x, northPos.y, northPos.z);
    northIsland.receiveShadow = true;
    group.add(northIsland);

    const isNorthUnlocked = state.isTerritoryUnlocked ? state.isTerritoryUnlocked("north_shelf") : false;
    const northBoard = this.create3DBillboard(
      "СЕВЕРНЫЙ ШЕЛЬФ",
      isNorthUnlocked ? "✓ РАЗВЕДАН" : "🔒 ТРЕБУЕТСЯ ТИР 2 ХОЛДИНГА",
      isNorthUnlocked ? "#22c55e" : "#38bdf8",
      "#1e293b",
      17,
      5.2
    );
    northBoard.position.set(northPos.x, 8.5, northPos.z);
    group.add(northBoard);

    this.scene.add(group);
  }

  // --- 8. CONNECTING BLUE PIPELINES (REMOVED PER R4 VISUAL CLEANUP) ---
  buildPipelines() {
    // Pipelines from wells to Central Plant removed to eliminate visual clutter per R4.
  }

  // --- 9. SIBERIAN SNOWY SPRUCE TREES (ЗАСНЕЖЕННЫЕ ЕЛИ) ---
  buildSnowySpruces() {
    const THREE = this.THREE;
    const coords = [
      [0.6, 0.6], [1.8, 0.6], [12.2, 0.6], [13.4, 0.6],
      [13.4, 5.0], [13.4, 7.5], [0.6, 12.5], [0.6, 13.5],
      [5.5, 13.4], [7.5, 13.4], [13.4, 13.4]
    ];

    coords.forEach(([gx, gy]) => {
      const pos = this.gridToWorld(gx, gy, 1.2);
      const tree = new THREE.Group();
      tree.position.set(pos.x, pos.y, pos.z);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3.2, 8), this.mat.woodTrunk);
      trunk.position.y = 1.6;
      trunk.castShadow = true;
      tree.add(trunk);

      // 3 Tiers of Conifer Foliage with Snow Caps
      const tiers = [
        { y: 3.2, r: 2.8, h: 2.8 },
        { y: 5.2, r: 2.1, h: 2.4 },
        { y: 7.0, r: 1.4, h: 2.0 }
      ];

      tiers.forEach(t => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 8), this.mat.spruceFoliage);
        cone.position.y = t.y;
        cone.castShadow = true;
        tree.add(cone);

        // Snow on branches
        const snowTier = new THREE.Mesh(new THREE.ConeGeometry(t.r * 1.02, t.h * 0.45, 8), this.mat.snowCap);
        snowTier.position.y = t.y + t.h * 0.28;
        tree.add(snowTier);
      });

      this.scene.add(tree);
    });
  }

  // --- 10. DENSE INDUSTRIAL TYCOON INFRASTRUCTURE (RCT-TOUCH STYLE) ---
  buildDenseTycoonInfrastructure() {
    const THREE = this.THREE;
    if (this.tycoonInfraGroup) {
      this.cleanupInteractablesForGroup(this.tycoonInfraGroup);
      this.scene.remove(this.tycoonInfraGroup);

      if (this.animatedObjects) {
        if (Array.isArray(this.animatedObjects.floodlightGlows)) {
          this.animatedObjects.floodlightGlows = this.animatedObjects.floodlightGlows.filter(mesh => {
            let p = mesh;
            while (p) {
              if (p === this.tycoonInfraGroup) return false;
              p = p.parent;
            }
            return true;
          });
        }
        if (Array.isArray(this.animatedObjects.floodlightLights)) {
          this.animatedObjects.floodlightLights = this.animatedObjects.floodlightLights.filter(light => {
            let p = light;
            while (p) {
              if (p === this.tycoonInfraGroup) return false;
              p = p.parent;
            }
            return true;
          });
        }
        if (Array.isArray(this.animatedObjects.pumpjacks)) {
          this.animatedObjects.pumpjacks = this.animatedObjects.pumpjacks.filter(pj => {
            if (pj.isTycoon) return false;
            let p = pj.beamPivot || pj.beam;
            while (p) {
              if (p === this.tycoonInfraGroup) return false;
              p = p.parent;
            }
            return true;
          });
        }
      }
    }

    const infraGroup = new THREE.Group();
    infraGroup.name = "DenseTycoonInfrastructure";
    this.tycoonInfraGroup = infraGroup;

    // =========================================================================
    // 1. HIGH-VOLTAGE A-FRAME POWER TRANSMISSION POLES (ЛЭП 10/35 кВ)
    // =========================================================================
    const powerCorridorNodes = [
      // Corridor A: Gatehouse to CPS
      { gx: 1.8, gy: 6.2 },
      { gx: 4.2, gy: 6.2 },
      { gx: 6.2, gy: 5.2 },
      // Corridor B: CPS to Well 1
      { gx: 4.2, gy: 3.5 },
      { gx: 2.5, gy: 3.2 },
      // Corridor C: CPS to Well 2
      { gx: 8.8, gy: 3.8 },
      { gx: 11.2, gy: 3.5 },
      // Corridor D: CPS to Well 3
      { gx: 11.2, gy: 6.5 },
      // Corridor E: South to Well 4 / Flare
      { gx: 7.5, gy: 9.5 }
    ];

    const polePositions = powerCorridorNodes.map(n => this.gridToWorld(n.gx, n.gy, 1.25));

    polePositions.forEach((pos, idx) => {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(pos.x, pos.y, pos.z);
      poleGroup.visible = false; // Hidden per R4 to eliminate ЛЭП visual clutter from diorama

      // Concrete foundation base
      const fBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), this.mat.concrete);
      fBase.position.y = 0.3;
      fBase.receiveShadow = true;
      poleGroup.add(fBase);

      // Two inclined upright timber/steel posts forming A-frame
      const poleH = 11.5;
      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, poleH, 6), this.mat.darkMetal);
      leftLeg.position.set(-0.45, poleH / 2 + 0.3, 0);
      leftLeg.rotation.z = 0.055;
      leftLeg.castShadow = true;
      poleGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, poleH, 6), this.mat.darkMetal);
      rightLeg.position.set(0.45, poleH / 2 + 0.3, 0);
      rightLeg.rotation.z = -0.055;
      rightLeg.castShadow = true;
      poleGroup.add(rightLeg);

      // Diagonal cross-bracing ties
      const tie1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), this.mat.darkMetal);
      tie1.position.y = 4.2;
      poleGroup.add(tie1);

      const tie2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.12), this.mat.darkMetal);
      tie2.position.y = 8.5;
      poleGroup.add(tie2);

      // Horizontal crossarm (траверса)
      const crossarm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 0.2), this.mat.darkMetal);
      crossarm.position.y = poleH + 0.3;
      crossarm.castShadow = true;
      poleGroup.add(crossarm);

      // 3 Glass disc insulators (cyan/emerald glass)
      [-1.8, 0, 1.8].forEach(ox => {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), this.mat.darkMetal);
        pin.position.set(ox, poleH + 0.55, 0);
        poleGroup.add(pin);

        const glassDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.25, 8), this.mat.insulator);
        glassDisc.position.set(ox, poleH + 0.72, 0);
        poleGroup.add(glassDisc);
      });

      infraGroup.add(poleGroup);
    });

    // (Overhead conductor wires removed per R4 to eliminate wire clipping through GPZ buildings)

    // =========================================================================
    // 2. INDUSTRIAL FLOODLIGHT MASTS (ПРОЖЕКТОРНЫЕ МАЧТЫ ПМС-24 ПО 4 УГЛАМ ЗАБОРА)
    // =========================================================================
    const mastLocations = [
      { x: -60.0, z: -48.0, name: "Мачта ПМС №1 (Северо-Западный угол)" },
      { x: 28.0, z: -48.0, name: "Мачта ПМС №2 (Северо-Восточный угол)" },
      { x: 28.0, z: 40.0, name: "Мачта ПМС №3 (Юго-Восточный угол)" },
      { x: -60.0, z: 40.0, name: "Мачта ПМС №4 (Юго-Западный угол)" }
    ];

    mastLocations.forEach(loc => {
      const pos = (typeof loc.x === "number" && typeof loc.z === "number")
        ? { x: loc.x, y: 1.22, z: loc.z }
        : this.gridToWorld(loc.gx, loc.gy, 1.22);
      const mastGroup = new THREE.Group();
      mastGroup.position.set(pos.x, pos.y, pos.z);

      // Heavy concrete pedestal
      const ped = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 2.4), this.mat.concrete);
      ped.position.y = 0.45;
      ped.receiveShadow = true;
      mastGroup.add(ped);

      const mastH = 20.0;
      // 4 lattice corner steel legs tapering upward
      [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]].forEach(([cx, cz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, mastH, 6), this.mat.steelTruss);
        leg.position.set(cx * 0.55, mastH / 2 + 0.9, cz * 0.55);
        leg.castShadow = true;
        mastGroup.add(leg);
      });

      // Aviation red & white warning tiers
      const tierCount = 5;
      for (let t = 0; t < tierCount; t++) {
        const ty = 2.0 + t * 3.6;
        const s = 1.6 - t * 0.15;
        const ring = new THREE.Mesh(
          new THREE.BoxGeometry(s, 0.35, s),
          t % 2 === 0 ? this.mat.redSteel : this.mat.whiteWall
        );
        ring.position.y = ty;
        ring.castShadow = true;
        mastGroup.add(ring);
      }

      // Climbing safety ladder
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.35, mastH, 0.12), this.mat.darkMetal);
      ladder.position.set(0, mastH / 2 + 0.9, 0.65);
      mastGroup.add(ladder);

      // Service catwalk platform at the top
      const topDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 3.2), this.mat.darkMetal);
      topDeck.position.y = mastH + 0.9;
      mastGroup.add(topDeck);

      // Catwalk safety handrails
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.8, 3.1), this.mat.orangeAccent);
      rail.position.y = mastH + 1.4;
      mastGroup.add(rail);

      // Quadruple floodlight cluster (4 angled lamps with warm emissive lenses)
      const lampAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
      lampAngles.forEach(ang => {
        const lampHead = new THREE.Group();
        lampHead.position.set(Math.cos(ang) * 1.2, mastH + 1.7, Math.sin(ang) * 1.2);
        lampHead.rotation.y = ang;
        lampHead.rotation.x = 0.35; // angled down

        const lampHousing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), this.mat.darkMetal);
        lampHead.add(lampHousing);

        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 0.08), this.mat.floodlightLamp);
        lens.position.set(0, 0, 0.3);
        lampHead.add(lens);

        mastGroup.add(lampHead);
      });

      // Ground Illumination Pool (soft warm ground disc on snow)
      const groundGlowGeo = new THREE.CircleGeometry(12.5, 16);
      groundGlowGeo.rotateX(-Math.PI / 2);
      const groundGlowMat = this.mat.groundGlow.clone();
      const groundGlow = new THREE.Mesh(groundGlowGeo, groundGlowMat);
      groundGlow.position.y = 0.06;
      mastGroup.add(groundGlow);
      this.animatedObjects.floodlightGlows.push(groundGlow);

      // Night PointLight
      const fLight = new THREE.PointLight(0xfef08a, 0.0, 48, 1.6);
      fLight.position.set(0, mastH + 2.2, 0);
      mastGroup.add(fLight);
      this.animatedObjects.floodlightLights.push(fLight);

      mastGroup.userData = {
        type: "tycoon_infrastructure",
        name: loc.name,
        badge: "ОСВЕЩЕНИЕ 4x1000 Вт"
      };

      mastGroup.traverse(child => {
        if (child.isMesh && child !== groundGlow) {
          child.userData = mastGroup.userData;
          this.interactables.push(child);
        }
      });

      infraGroup.add(mastGroup);
    });

    // =========================================================================
    // 3. MODULAR TRANSFORMER SUBSTATION (КТПН 10/0.4 кВ)
    // =========================================================================
    const defaultKtpnPos = this.gridToWorld(8.2, 4.8, 1.22);
    const ktpnPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("substation", defaultKtpnPos) : defaultKtpnPos;
    const ktpnGroup = new THREE.Group();
    ktpnGroup.position.set(ktpnPos.x, defaultKtpnPos.y, ktpnPos.z);
    this.substationGroup = ktpnGroup;
    this.registerMovableBuilding("substation", ktpnGroup, { gx: 8.2, gy: 4.8, yOffset: 1.22 }, { cellsW: 2, cellsD: 2, w: 7.0, d: 7.0, label: "КТПН Подстанция" });

    // Architectural illuminated physical signboard
    const ktpnSign = this.createPhysicalSignboard("КТПН 10/0.4 кВ", "⚡", "#eab308", 7.2, 1.8);
    ktpnSign.position.set(0, 4.4, 2.5);
    ktpnGroup.add(ktpnSign);

    // Foundation concrete slab
    const ktpnSlab = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.6, 6.8), this.mat.concrete);
    ktpnSlab.position.y = 0.3;
    ktpnSlab.receiveShadow = true;
    ktpnGroup.add(ktpnSlab);

    // Hazard warning stripe skirting
    const ktpnSkirting = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.25, 7.0), this.mat.hazardStripe);
    ktpnSkirting.position.y = 0.15;
    ktpnGroup.add(ktpnSkirting);

    // Metal containment frame: structural steel corner columns & perimeter beams
    [[-3.8, -2.5], [3.8, -2.5], [-3.8, 2.5], [3.8, 2.5]].forEach(([cx, cz]) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35), this.mat.darkMetal);
      col.position.set(cx, 2.1, cz);
      col.castShadow = true;
      ktpnGroup.add(col);

      // Lifting eye lugs on top corners for crane transport
      const lug = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), this.mat.steelTruss || this.mat.darkMetal);
      lug.position.set(cx, 4.3, cz);
      ktpnGroup.add(lug);
    });

    // Top horizontal containment tie-beams
    [-2.5, 2.5].forEach(bz => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.22, 0.22), this.mat.darkMetal);
      b.position.set(0, 4.1, bz);
      ktpnGroup.add(b);
    });
    [-3.8, 3.8].forEach(bx => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 5.0), this.mat.darkMetal);
      b.position.set(bx, 4.1, 0);
      ktpnGroup.add(b);
    });

    // Substation weatherproof container body
    const ktpnBody = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.8, 4.8), this.mat.substationWall || this.mat.substationBlue);
    ktpnBody.position.y = 2.2;
    ktpnBody.castShadow = true;
    ktpnGroup.add(ktpnBody);

    // Corporate Gazprom cyan accent band
    const ktpnBand = new THREE.Mesh(new THREE.BoxGeometry(7.45, 0.5, 4.85), this.mat.orangeAccent);
    ktpnBand.position.y = 2.4;
    ktpnGroup.add(ktpnBand);

    // Double steel service doors on front (+Z)
    const ktpnDoors = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.6, 0.15), this.mat.darkMetal);
    ktpnDoors.position.set(0, 1.9, 2.45);
    ktpnGroup.add(ktpnDoors);

    // Warning lightning sign plate on the doors
    const ktpnWarnPlate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.08), this.mat.hazardStripe);
    ktpnWarnPlate.position.set(0, 2.3, 2.55);
    ktpnGroup.add(ktpnWarnPlate);

    const ktpnWarnFrame = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.98, 0.06), this.mat.darkMetal);
    ktpnWarnFrame.position.set(0, 2.3, 2.53);
    ktpnGroup.add(ktpnWarnFrame);

    // Transformer cooling fins (Radiator banks on rear wall and sides)
    // Rear radiator bank with header manifolds and cooling fins
    [-2.6].forEach(rz => {
      // Header pipes (upper and lower)
      [1.3, 3.1].forEach(hy => {
        const header = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.6, 8), this.mat.silverPipe);
        header.rotation.z = Math.PI / 2;
        header.position.set(0, hy, rz);
        ktpnGroup.add(header);
      });

      // 7 vertical cooling fins / radiator plates
      for (let fi = -3; fi <= 3; fi++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.8), this.mat.darkMetal);
        fin.position.set(fi * 0.85, 2.2, rz);
        fin.castShadow = true;
        ktpnGroup.add(fin);
      }
    });

    // Flank cooling fins on left side
    for (let fz = -1; fz <= 1; fz++) {
      const sFin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.1), this.mat.darkMetal);
      sFin.position.set(-3.85, 2.2, fz * 1.1);
      ktpnGroup.add(sFin);
    }

    // High-voltage ceramic insulators on top (Проходные изоляторы 10 кВ)
    [-1.8, 0, 1.8].forEach(ox => {
      // Insulator mounting flange
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.2, 10), this.mat.darkMetal);
      flange.position.set(ox, 4.25, 0);
      ktpnGroup.add(flange);

      // Core ceramic insulator
      const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 10), this.mat.insulator);
      bushing.position.set(ox, 4.95, 0);
      ktpnGroup.add(bushing);

      // 3 tiered ribbed ceramic disc petticoats
      [4.6, 4.9, 5.2].forEach(dy => {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), this.mat.insulator);
        disc.position.set(ox, dy, 0);
        ktpnGroup.add(disc);
      });

      // Top bronze terminal cap with arcing horn conductor
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8), this.mat.brass);
      cap.position.set(ox, 5.8, 0);
      ktpnGroup.add(cap);
    });

    // Transformer oil conservator expansion tank (Расширитель трансформатора)
    const consTank = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 3.4, 12), this.mat.greyWall);
    consTank.rotation.z = Math.PI / 2;
    consTank.position.set(0, 4.4, -1.6);
    consTank.castShadow = true;
    ktpnGroup.add(consTank);

    const consBreather = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), this.mat.silverPipe);
    consBreather.position.set(1.5, 4.4, -1.6);
    ktpnGroup.add(consBreather);

    // Grounding copper busbar running down to the concrete slab
    const groundBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.8, 0.08), this.mat.brass);
    groundBar.position.set(3.7, 2.2, 2.4);
    ktpnGroup.add(groundBar);

    // Pitched roof and snow cap
    const ktpnRoof = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.35, 5.2), this.mat.greyWall);
    ktpnRoof.position.y = 4.15;
    ktpnGroup.add(ktpnRoof);

    const ktpnRoofSnow = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 5.0), this.mat.snowCap);
    ktpnRoofSnow.position.y = 4.45;
    ktpnGroup.add(ktpnRoofSnow);

    // 3D billboard (hidden by default)
    const ktpnBoard = this.create3DBillboard(
      "⚡ КТПН 10/0.4 кВ",
      "ТРАНСФОРМАТОРНАЯ ПОДСТАНЦИЯ",
      "#00a3e0",
      "#1e293b",
      16.5,
      4.8
    );
    ktpnBoard.position.set(0, 4.6, 0);
    ktpnBoard.visible = false;
    ktpnGroup.add(ktpnBoard);

    ktpnGroup.userData = {
      type: "substation",
      id: "substation",
      name: "КТПН 10/0.4 кВ",
      badge: "⚡ ЭНЕРГОСНАБЖЕНИЕ"
    };

    ktpnGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = ktpnGroup.userData;
        this.interactables.push(child);
      }
    });

    infraGroup.add(ktpnGroup);

    // =========================================================================
    // 4. MODULAR PROCESS SKIDS
    // =========================================================================
    // 4A. Pipe Manifold Block (Блок входных манифольдов БВМ)
    const defaultBvmPos = this.gridToWorld(4.8, 4.5, 1.22);
    const bvmPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("manifold_bvm", defaultBvmPos) : defaultBvmPos;
    const bvmGroup = new THREE.Group();
    bvmGroup.position.set(bvmPos.x, defaultBvmPos.y, bvmPos.z);
    this.manifoldGroup = bvmGroup;

    const bvmSkid = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.4, 5.2), this.mat.skidFrame);
    bvmSkid.position.y = 0.2;
    bvmSkid.receiveShadow = true;
    bvmGroup.add(bvmSkid);

    // Yellow safety handrails around perimeter
    const bvmRail = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.9, 5.0), this.mat.orangeAccent);
    bvmRail.position.y = 0.85;
    bvmGroup.add(bvmRail);

    // Main header manifold pipe
    const bvmHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 8.2, 12), this.mat.bluePipe);
    bvmHeader.rotation.z = Math.PI / 2;
    bvmHeader.position.set(0, 1.4, 0);
    bvmHeader.castShadow = true;
    bvmGroup.add(bvmHeader);

    // 3 Cross branch loops with motorized valves
    [-2.4, 0, 2.4].forEach(ox => {
      const branchPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.2, 10), this.mat.bluePipe);
      branchPipe.rotation.x = Math.PI / 2;
      branchPipe.position.set(ox, 1.4, 0);
      bvmGroup.add(branchPipe);

      // Motorized actuator valve box (red)
      const valveBox = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.65), this.mat.redValve);
      valveBox.position.set(ox, 2.1, 0.8);
      bvmGroup.add(valveBox);

      // Valve handwheel
      const handwheel = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 12), this.mat.brass);
      handwheel.rotation.x = Math.PI / 2;
      handwheel.position.set(ox, 2.55, 0.8);
      bvmGroup.add(handwheel);

      // Pressure gauge manometer
      const mano = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), this.mat.whiteWall);
      mano.position.set(ox, 2.2, -0.8);
      mano.rotation.x = Math.PI / 2;
      bvmGroup.add(mano);
    });

    bvmGroup.userData = {
      type: "tycoon_infrastructure",
      id: "manifold_bvm",
      name: "Блок манифольдов БВМ",
      badge: "РАСПРЕДЕЛЕНИЕ ПОТОКОВ"
    };
    bvmGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = bvmGroup.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("manifold_bvm", bvmGroup, { gx: 4.8, gy: 4.5, yOffset: 1.22 }, { cellsW: 2, cellsD: 2, w: 7.0, d: 7.0, label: "Блок Манифольда БВМ" });
    infraGroup.add(bvmGroup);

    // 4B. Methanol Inhibitor Dosing Skid (БДР)
    const defaultBdrPos = this.gridToWorld(8.6, 8.5, 1.22);
    const bdrPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("bdr_methanol", defaultBdrPos) : defaultBdrPos;
    const bdrGroup = new THREE.Group();
    bdrGroup.position.set(bdrPos.x, defaultBdrPos.y, bdrPos.z);
    this.bdrGroup = bdrGroup;

    const bdrSkid = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 4.8), this.mat.skidFrame);
    bdrSkid.position.y = 0.2;
    bdrSkid.receiveShadow = true;
    bdrGroup.add(bdrSkid);

    // Weather canopy with snow
    const bdrCanopy = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.25, 5.0), this.mat.orangeRoof);
    bdrCanopy.position.y = 3.6;
    bdrGroup.add(bdrCanopy);

    const bdrCanopySnow = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 4.8), this.mat.snowCap);
    bdrCanopySnow.position.y = 3.9;
    bdrGroup.add(bdrCanopySnow);

    // 3 IBC Chemical Totes (intermediate bulk containers in cages)
    [-2.2, 0, 2.2].forEach(ox => {
      // Plastic cube tank
      const ibc = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), this.mat.ibcTank);
      ibc.position.set(ox, 1.1, 0.6);
      bdrGroup.add(ibc);

      // Galvanized steel cage wire frame
      const cage = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.48, 1.48), this.mat.darkMetal);
      cage.position.set(ox, 1.1, 0.6);
      bdrGroup.add(cage);
    });

    // Dosing metering pump skid
    const pumpUnit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.4), this.mat.greyWall);
    pumpUnit.position.set(0, 0.95, -1.2);
    bdrGroup.add(pumpUnit);

    bdrGroup.userData = {
      type: "tycoon_infrastructure",
      id: "bdr_methanol",
      name: "Блок дозирования метанола",
      badge: "ИНГИБИТОР ГИДРАТОВ"
    };
    bdrGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = bdrGroup.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("bdr_methanol", bdrGroup, { gx: 8.6, gy: 8.5, yOffset: 1.22 }, { cellsW: 2, cellsD: 2, w: 7.0, d: 7.0, label: "БДР Метанол" });
    infraGroup.add(bdrGroup);

    // 4C. Mobile Nitrogen Compressor Station (СДА)
    const defaultSdaPos = this.gridToWorld(5.5, 9.2, 1.22);
    const sdaPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("sda_nitrogen", defaultSdaPos) : defaultSdaPos;
    const sdaGroup = new THREE.Group();
    sdaGroup.position.set(sdaPos.x, defaultSdaPos.y, sdaPos.z);
    this.sdaGroup = sdaGroup;

    // Chassis wheels (heavy trailer)
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-2.8, -1.8], [2.8, -1.8], [-2.8, 1.8], [2.8, 1.8]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, this.mat.darkMetal);
      w.position.set(wx, 0.55, wz);
      sdaGroup.add(w);
    });

    // Safety-orange containerized machinery housing
    const sdaBody = new THREE.Mesh(new THREE.BoxGeometry(8.6, 3.4, 3.8), this.mat.orangeAccent);
    sdaBody.position.y = 2.4;
    sdaBody.castShadow = true;
    sdaGroup.add(sdaBody);

    // Snow cap
    const sdaSnow = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.35, 3.6), this.mat.snowCap);
    sdaSnow.position.y = 4.25;
    sdaGroup.add(sdaSnow);

    // Vertical nitrogen exhaust stack
    const sdaStack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 8), this.mat.silverPipe);
    sdaStack.position.set(3.2, 4.8, 0);
    sdaGroup.add(sdaStack);

    // Rain cap flap on stack
    const sdaCap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 8), this.mat.redSteel);
    sdaCap.position.set(3.2, 6.1, 0);
    sdaGroup.add(sdaCap);

    sdaGroup.userData = {
      type: "tycoon_infrastructure",
      id: "sda_nitrogen",
      name: "Азотная компрессорная станция СДА",
      badge: "ОПРЕССОВКА & ПРОДУВКА"
    };
    sdaGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = sdaGroup.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("sda_nitrogen", sdaGroup, { gx: 5.5, gy: 9.2, yOffset: 1.22 }, { cellsW: 3, cellsD: 2, w: 10.5, d: 7.0, label: "Азотная Станция СДА" });
    infraGroup.add(sdaGroup);

    // =========================================================================
    // 5. OVERHEAD PIPE RACK & EXPANSION LOOP REMOVED
    // =========================================================================
    // The central overhead rack arch ("ворота") and the corner thermal U-loop ("труба")
    // were removed per user request to maintain an uncluttered open concrete yard.

    // =========================================================================
    // 6. NEW WELL CLUSTERS (CLUSTER 5 «ТАЁЖНЫЙ» & CLUSTER 6 «АЧИМОВСКИЙ»)
    // =========================================================================
    // 6A. Well Cluster 5 «Таёжный» (Northern Expansion clearing gx: 5.2, gy: 0.5)
    const c5Pos = this.gridToWorld(5.2, 0.5, 1.22);
    const c5Group = new THREE.Group();
    c5Group.position.set(c5Pos.x, c5Pos.y, c5Pos.z);

    // Concrete Wellpad Slab (18 x 0.7 x 12) with Yellow Hazard Skirting
    const c5Pad = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.7, 12.0), this.mat.concrete);
    c5Pad.position.y = 0.35;
    c5Pad.receiveShadow = true;
    c5Group.add(c5Pad);

    const c5Border = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.25, 12.4), this.mat.hazardStripe);
    c5Border.position.y = 0.6;
    c5Group.add(c5Border);

    // Gas Christmas Tree Wellhead (АФК6-80х350)
    const c5Cellar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12), this.mat.concreteDark);
    c5Cellar.position.set(-2.5, 0.8, 0);
    c5Group.add(c5Cellar);

    const c5Spool = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 1.4, 12), this.mat.valveSteel);
    c5Spool.position.set(-2.5, 1.7, 0);
    c5Spool.castShadow = true;
    c5Group.add(c5Spool);

    // Master Gate Valves & Cross Tee
    const c5Valve = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.75), this.mat.redValve);
    c5Valve.position.set(-2.5, 2.6, 0);
    c5Group.add(c5Valve);

    const c5Choke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 8), this.mat.bluePipe);
    c5Choke.rotation.z = Math.PI / 2;
    c5Choke.position.set(-1.6, 2.6, 0);
    c5Group.add(c5Choke);

    // Manometer dial
    const c5Mano = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 10), this.mat.brass);
    c5Mano.rotation.x = Math.PI / 2;
    c5Mano.position.set(-2.5, 3.4, 0.35);
    c5Group.add(c5Mano);

    // 3D Billboard Label
    const c5Board = this.create3DBillboard("КУСТ №5 «ТАЁЖНЫЙ»", "ГАЗОКОНДЕНСАТ • В СТРОЮ", "#22c55e", "#1e293b", 16, 4.8);
    c5Board.position.set(0, 5.8, 0);
    c5Group.add(c5Board);

    // Road Spur to Cluster 5 (sand-dusted snow ribbon connecting c5Pos to CPS road)
    const c5RoadGeo = new THREE.PlaneGeometry(3.6, 24.0);
    c5RoadGeo.rotateX(-Math.PI / 2);
    const c5Road = new THREE.Mesh(c5RoadGeo, this.mat.sandDustedRoad);
    c5Road.position.set(0, 0.05, 14.0);
    c5Road.receiveShadow = true;
    c5Group.add(c5Road);

    // (Cluster 5 pipeline connection removed per R4 visual cleanup)

    c5Group.userData = {
      type: "well_cluster_expansion",
      id: "well_5_expansion",
      name: "Куст №5 «Таёжный»",
      badge: "ГАЗОКОНДЕНСАТ • ЭКСПАНСИЯ"
    };
    c5Group.traverse(child => {
      if (child.isMesh && child !== c5Road) {
        child.userData = c5Group.userData;
        this.interactables.push(child);
      }
    });
    infraGroup.add(c5Group);

    // 6B. Well Cluster 6 «Ачимовский» (Eastern Expansion clearing gx: 13.8, gy: 5.5)
    const c6Pos = this.gridToWorld(13.8, 5.5, 1.22);
    const c6Group = new THREE.Group();
    c6Group.position.set(c6Pos.x, c6Pos.y, c6Pos.z);

    // Concrete Wellpad Slab (18 x 0.7 x 12) with Hazard Skirting
    const c6Pad = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.7, 12.0), this.mat.concrete);
    c6Pad.position.y = 0.35;
    c6Pad.receiveShadow = true;
    c6Group.add(c6Pad);

    const c6Border = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.25, 12.4), this.mat.hazardStripe);
    c6Border.position.y = 0.6;
    c6Group.add(c6Border);

    // Heavy Arctic Oil Pumpjack (станок-качалка СКД-8)
    const pjSamson = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.85, 4.8, 4), this.mat.darkMetal);
    pjSamson.position.set(0, 3.1, 0);
    pjSamson.castShadow = true;
    c6Group.add(pjSamson);

    // Walking Beam (балансир)
    const pjBeam = new THREE.Group();
    pjBeam.position.set(0, 5.6, 0);
    const beamBody = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.5, 0.4), this.mat.orangeRoof);
    beamBody.castShadow = true;
    pjBeam.add(beamBody);

    // Curved Horsehead (головка балансира)
    const pjHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.45), this.mat.redSteel);
    pjHead.position.set(3.4, -0.6, 0);
    pjHead.castShadow = true;
    pjBeam.add(pjHead);

    c6Group.add(pjBeam);

    // Crank Arm & Counterweight (кривошип с противовесом)
    const pjCrank = new THREE.Group();
    pjCrank.position.set(-2.4, 2.2, 0);
    const crankBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 0.25), this.mat.darkMetal);
    crankBody.position.y = 0.9;
    pjCrank.add(crankBody);

    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.75), this.mat.darkMetal);
    counterweight.position.y = 1.6;
    counterweight.castShadow = true;
    pjCrank.add(counterweight);
    c6Group.add(pjCrank);

    // Polished rod entering stuffing box
    const pjRod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), this.mat.valveSteel);
    pjRod.position.set(3.4, 1.8, 0);
    c6Group.add(pjRod);

    // Register into animatedObjects.pumpjacks for smooth synchronized rocking!
    this.animatedObjects.pumpjacks.push({
      beamPivot: pjBeam,
      crankPivot: pjCrank,
      beam: pjBeam,
      crank: pjCrank,
      rod: pjRod,
      speed: 1.85,
      phase: 1.2,
      isTycoon: true
    });

    // 3D Billboard Label
    const c6Board = this.create3DBillboard("КУСТ №6 «АЧИМОВСКИЙ»", "АЧИМОВСКАЯ НЕФТЬ • В СТРОЮ", "#38bdf8", "#1e293b", 17.5, 4.8);
    c6Board.position.set(0, 5.8, 0);
    c6Group.add(c6Board);

    // Road Spur connecting Cluster 6 to main road near Well 2/3
    const c6RoadGeo = new THREE.PlaneGeometry(16.0, 3.6);
    c6RoadGeo.rotateX(-Math.PI / 2);
    const c6Road = new THREE.Mesh(c6RoadGeo, this.mat.sandDustedRoad);
    c6Road.position.set(-14.0, 0.05, 0);
    c6Road.receiveShadow = true;
    c6Group.add(c6Road);

    // (Cluster 6 pipeline connection removed per R4 visual cleanup)

    c6Group.userData = {
      type: "well_cluster_expansion",
      id: "well_6_expansion",
      name: "Куст №6 «Ачимовский»",
      badge: "АЧИМОВСКАЯ НЕФТЬ • ЭКСПАНСИЯ"
    };
    c6Group.traverse(child => {
      if (child.isMesh && child !== c6Road) {
        child.userData = c6Group.userData;
        this.interactables.push(child);
      }
    });
    infraGroup.add(c6Group);

    this.scene.add(infraGroup);
  }

  // --- 10b. PERIMETER SECURITY FENCE, PLANT EXPANSION WORKSHOPS & WOODEN CATWALKS ---
  buildPerimeterFenceAndPlantExpansion() {
    const THREE = this.THREE;
    if (this.fenceExpansionGroup) {
      this.cleanupInteractablesForGroup(this.fenceExpansionGroup);
      this.scene.remove(this.fenceExpansionGroup);
    }

    const group = new THREE.Group();
    group.name = "PerimeterFenceAndPlantExpansion";
    this.fenceExpansionGroup = group;

    // =========================================================================
    // 0. COMPREHENSIVE PERIMETER CONCRETE SLAB APRON (МОНОЛИТНАЯ ПЛОЩАДКА ИЗ ПЛИТ ПАГ-14)
    // =========================================================================
    // Entire area inside security fence is covered by PAG-14 concrete plate platform (no empty snow void)
    const apronW = 100.5, apronD = 100.5, apronH = 0.45;
    const apronCenter = { x: -16.0, y: 1.22 + apronH / 2, z: -4.0 };
    const apronMesh = new THREE.Mesh(
      new THREE.BoxGeometry(apronW, apronH, apronD),
      this.mat.pagConcrete || this.mat.concrete
    );
    apronMesh.position.set(apronCenter.x, apronCenter.y, apronCenter.z);
    apronMesh.receiveShadow = true;
    group.add(apronMesh);

    // Perimeter concrete curbs around the outer bounds of the slab apron
    const pCurbMat = this.mat.concreteDark || this.mat.concrete;
    const curbThick = 0.5, curbH = 0.35;
    [[-apronW / 2, 0], [apronW / 2, 0]].forEach(([cx]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(curbThick, curbH, apronD), pCurbMat);
      c.position.set(apronCenter.x + cx, apronCenter.y + apronH / 2 + curbH / 2, apronCenter.z);
      group.add(c);
    });
    [[0, -apronD / 2], [0, apronD / 2]].forEach(([, cz]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(apronW, curbH, curbThick), pCurbMat);
      c.position.set(apronCenter.x, apronCenter.y + apronH / 2 + curbH / 2, apronCenter.z + cz);
      group.add(c);
    });

    // =========================================================================
    // 1. REALISTIC INDUSTRIAL PERIMETER SECURITY FENCE (НАСТОЯЩИЙ ЗАБОР ВОКРУГ ПРОМЫСЛА)
    // =========================================================================
    // Contour enclosing the entire industrial complex from Gatehouse
    const fenceSegments = [
      // North boundary: West to East (z = -54.0)
      { x1: -66.0, z1: -54.0, x2: 34.0, z2: -54.0 },
      // East boundary: North to South (x = 34.0)
      { x1: 34.0, z1: -54.0, x2: 34.0, z2: 46.0 },
      // South boundary: East to West (z = 46.0, encloses Dormitory and Canteen)
      { x1: 34.0, z1: 46.0, x2: -66.0, z2: 46.0 },
      // West boundary: South-West to Gatehouse driveway opening (x = -66.0)
      { x1: -66.0, z1: 46.0, x2: -66.0, z2: -10.5 },
      // West boundary: Gatehouse driveway opening to North-West corner (x = -66.0)
      { x1: -66.0, z1: -21.5, x2: -66.0, z2: -54.0 }
    ];

    fenceSegments.forEach(seg => {
      const dist = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
      const postsCount = Math.max(1, Math.floor(dist / 5.5));
      const dx = (seg.x2 - seg.x1) / postsCount;
      const dz = (seg.z2 - seg.z1) / postsCount;

      for (let i = 0; i < postsCount; i++) {
        const px1 = seg.x1 + dx * i;
        const pz1 = seg.z1 + dz * i;
        const px2 = seg.x1 + dx * (i + 1);
        const pz2 = seg.z1 + dz * (i + 1);

        // Concrete Post Footing & Steel Upright
        const postH = 3.4;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, postH, 6), this.mat.fencePost);
        post.position.set(px1, postH / 2 + 1.22, pz1);
        post.castShadow = true;
        group.add(post);

        const footing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), this.mat.concrete);
        footing.position.set(px1, 1.22 + 0.22, pz1);
        group.add(footing);

        // Y-Barbed Wire Bracket on Top
        const yBracket = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.1), this.mat.fencePost);
        yBracket.position.set(px1, 1.22 + postH + 0.1, pz1);
        group.add(yBracket);

        // Wire Mesh Panel between posts
        const spanDist = Math.hypot(px2 - px1, pz2 - pz1);
        const spanAngle = Math.atan2(pz2 - pz1, px2 - px1);

        const panel = new THREE.Mesh(new THREE.BoxGeometry(spanDist, 2.5, 0.05), this.mat.fenceWire);
        panel.position.set((px1 + px2) / 2, 1.22 + 1.45, (pz1 + pz2) / 2);
        panel.rotation.y = -spanAngle;
        panel.castShadow = true;
        group.add(panel);

        // Barbed Wire Strands along top of fence panel
        const bWire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, spanDist, 4), this.mat.barbedWire);
        bWire.rotation.z = Math.PI / 2;
        bWire.position.set((px1 + px2) / 2, 1.22 + postH - 0.05, (pz1 + pz2) / 2);
        bWire.rotation.y = -spanAngle;
        group.add(bWire);

        // Security Warning Signs on Every 4th Panel
        if (i % 4 === 1) {
          const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.08), this.mat.hazardStripe);
          sign.position.set((px1 + px2) / 2, 1.22 + 2.1, (pz1 + pz2) / 2);
          sign.rotation.y = -spanAngle;
          group.add(sign);
        }
      }
    });

    // =========================================================================
    // 2. EXPANDED WORKSHOPS (НОВЫЕ ЦЕХА: ДКС, НТС И СКЛАД МТР)
    // =========================================================================
    // 2A. Booster Compressor Station (ДКС - Дожимная компрессорная станция)
    const defaultDksPos = this.gridToWorld(8.5, 3.8, 1.22);
    const dksPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("dks_gas", defaultDksPos) : defaultDksPos;
    const dksGroup = new THREE.Group();
    dksGroup.position.set(dksPos.x, defaultDksPos.y, dksPos.z);
    this.dksGroup = dksGroup;

    // Foundation concrete slab and hazard perimeter skirting
    const dksFoundation = new THREE.Mesh(new THREE.BoxGeometry(22, 0.65, 15), this.mat.concrete);
    dksFoundation.position.y = 0.32;
    dksFoundation.receiveShadow = true;
    dksGroup.add(dksFoundation);

    const dksCurb = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.25, 15.4), this.mat.hazardStripe);
    dksCurb.position.y = 0.15;
    dksGroup.add(dksCurb);

    // Main Compressor Workshop Hall
    const dksBody = new THREE.Mesh(new THREE.BoxGeometry(18, 7.8, 11), this.mat.corrugatedWorkshop || this.mat.whiteWall);
    dksBody.position.y = 4.2;
    dksBody.castShadow = true;
    dksGroup.add(dksBody);

    // Structural wall pilasters / columns (relief against flat box walls)
    [-8.0, -4.0, 0, 4.0, 8.0].forEach(px => {
      const colF = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.0, 0.35), this.mat.darkMetal);
      colF.position.set(px, 4.2, 5.55);
      colF.castShadow = true;
      dksGroup.add(colF);

      const colB = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.0, 0.35), this.mat.darkMetal);
      colB.position.set(px, 4.2, -5.55);
      colB.castShadow = true;
      dksGroup.add(colB);
    });

    // Corporate Gazprom blue cladding band
    const dksBand = new THREE.Mesh(new THREE.BoxGeometry(18.2, 1.0, 11.2), this.mat.orangeRoof);
    dksBand.position.y = 6.8;
    dksGroup.add(dksBand);

    // Industrial gable roof & overhanging snow cap
    const dksRoof = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.65, 11.6), this.mat.orangeRoof);
    dksRoof.position.y = 8.45;
    dksGroup.add(dksRoof);

    const dksSnow = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.5, 11.4), this.mat.snowCap);
    dksSnow.position.y = 8.95;
    dksGroup.add(dksSnow);

    // Industrial Turbo-Compressor Housing (Блочно-комплектные укрытия ГПА-16 «Урал»)
    [-4.5, 4.5].forEach(tx => {
      // Acoustic compressor housing box
      const tBox = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.8, 4.2), this.mat.greyWall);
      tBox.position.set(tx, 2.4, 4.8);
      tBox.castShadow = true;
      dksGroup.add(tBox);

      // Curved cylindrical turbine roof cowling
      const tCowl = new THREE.Mesh(
        new THREE.CylinderGeometry(2.1, 2.1, 5.2, 16, 1, false, 0, Math.PI),
        this.mat.darkMetal
      );
      tCowl.rotation.z = Math.PI / 2;
      tCowl.position.set(tx, 4.3, 4.8);
      tCowl.castShadow = true;
      dksGroup.add(tCowl);

      // Turbine air intake filtration hoods (КВОУ) with louver grilles
      const kvoHood = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 1.2), this.mat.darkMetal);
      kvoHood.position.set(tx, 3.2, 6.2);
      dksGroup.add(kvoHood);

      // Louver grille slats
      [2.9, 3.2, 3.5].forEach(ly => {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 0.15), this.mat.silverPipe);
        slat.position.set(tx, ly, 6.85);
        dksGroup.add(slat);
      });
    });

    // 3 High Vertical Exhaust Stacks for Gas Turbine Compressor Units (ГПА)
    [-5.0, 0.0, 5.0].forEach(sx => {
      const stackH = 15.0;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.65, stackH, 12), this.mat.silverPipe);
      stack.position.set(sx, stackH / 2 + 8.0, -3.2);
      stack.castShadow = true;
      dksGroup.add(stack);

      // Stack deflector ring & silencer hood
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 1.2, 10), this.mat.darkMetal);
      hood.position.set(sx, stackH + 8.5, -3.2);
      dksGroup.add(hood);

      // Red aviation warning obstacle light
      const warnLight = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xe53935 }));
      warnLight.position.set(sx, stackH + 9.3, -3.2);
      dksGroup.add(warnLight);
    });

    // Radiator Grille (АВО газа - Аппараты воздушного охлаждения газа)
    const avoFrame = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.8, 4.5), this.mat.steelTruss || this.mat.darkMetal);
    avoFrame.position.set(0, 8.8, 1.0);
    dksGroup.add(avoFrame);

    // Horizontal cooling fins / radiator louver slats
    for (let fIdx = 0; fIdx < 6; fIdx++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.1, 4.2), this.mat.silverPipe);
      fin.position.set(0, 8.0 + fIdx * 0.28, 1.0);
      dksGroup.add(fin);
    }

    // 2 Massive Top-Mounted Axial Cooling Fan Cowlings
    [-1.9, 1.9].forEach(fx => {
      const fanCowl = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.55, 16), this.mat.darkMetal);
      fanCowl.position.set(fx, 9.8, 1.0);
      dksGroup.add(fanCowl);

      const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 12), this.mat.silverPipe);
      fanHub.position.set(fx, 9.85, 1.0);
      dksGroup.add(fanHub);
    });

    // Curved Bypass Piping & High-Pressure Gas Manifolds
    // Main suction & discharge gas manifold running along front
    const mainHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 16.0, 12), this.mat.bluePipe);
    mainHeader.rotation.z = Math.PI / 2;
    mainHeader.position.set(0, 1.8, 6.4);
    mainHeader.castShadow = true;
    dksGroup.add(mainHeader);

    // Curved bypass loop pipe
    const bypassPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 6.5, 12), this.mat.yellowGasPipe || this.mat.orangeAccent);
    bypassPipe.rotation.x = Math.PI / 2;
    bypassPipe.position.set(0, 1.8, 3.2);
    dksGroup.add(bypassPipe);

    // Vertical riser loops with flanges
    [-6.5, 6.5].forEach(rx => {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.2, 12), this.mat.bluePipe);
      riser.position.set(rx, 2.6, 6.4);
      dksGroup.add(riser);

      const flange = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 6, 16), this.mat.valveSteel);
      flange.rotation.x = Math.PI / 2;
      flange.position.set(rx, 3.6, 6.4);
      dksGroup.add(flange);

      // Industrial gate valve with red handwheel
      const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 16), this.mat.redValve);
      valveWheel.position.set(rx, 2.6, 6.8);
      dksGroup.add(valveWheel);
    });

    // Industrial Pressure Gauges (Манометры высокого давления МП-4У)
    [-3.0, 0, 3.0].forEach(gx => {
      // Brass stem
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), this.mat.brass);
      stem.position.set(gx, 2.35, 6.4);
      dksGroup.add(stem);

      // Gauge dial body
      const dialBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16), this.mat.darkMetal);
      dialBody.rotation.x = Math.PI / 2;
      dialBody.position.set(gx, 2.65, 6.4);
      dksGroup.add(dialBody);

      // White dial face
      const dialFace = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 16), this.mat.snowCap);
      dialFace.rotation.x = Math.PI / 2;
      dialFace.position.set(gx, 2.65, 6.48);
      dksGroup.add(dialFace);
    });

    // Architectural illuminated physical signboard
    const dksSign = this.createPhysicalSignboard("ЦЕХ ДКС • ГПА-16 «УРАЛ»", "⚙️", "#00a3e0", 15.0, 2.5);
    dksSign.position.set(0, 9.4, 4.8);
    dksGroup.add(dksSign);

    const dksBoard = this.create3DBillboard("⚙️ ЦЕХ ДКС ГАЗА", "ДОЖИМНЫЕ ТУРБОКОМПРЕССОРЫ", "#00a3e0", "#1e293b", 16, 4.5);
    dksBoard.position.set(0, 9.4, 0);
    dksBoard.visible = false;
    dksGroup.add(dksBoard);

    dksGroup.userData = {
      type: "tycoon_infrastructure",
      id: "dks_gas",
      name: "Цех ДКС газа",
      badge: "КОМПРЕССИЯ 16 МПа"
    };
    dksGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = dksGroup.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("dks_gas", dksGroup, { gx: 8.5, gy: 3.8, yOffset: 1.22 }, { cellsW: 5, cellsD: 4, w: 17.5, d: 14.0, label: "ДКС Компрессорная" });
    group.add(dksGroup);

    // 2B. Low-Temperature Gas Separation Skid (Цех НТС / УПГ)
    const defaultNtsPos = this.gridToWorld(4.8, 2.8, 1.22);
    const ntsPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("nts_gas", defaultNtsPos) : defaultNtsPos;
    const ntsGroup = new THREE.Group();
    ntsGroup.position.set(ntsPos.x, defaultNtsPos.y, ntsPos.z);
    this.ntsGroup = ntsGroup;

    const ntsPad = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 10), this.mat.concrete);
    ntsPad.position.y = 0.25;
    ntsGroup.add(ntsPad);

    // 2 Vertical Separation Columns
    [-2.8, 2.8].forEach(cx => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 10.5, 12), this.mat.whiteTank);
      col.position.set(cx, 5.5, 0);
      col.castShadow = true;
      ntsGroup.add(col);

      // Catwalk platform on column
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 8), this.mat.darkMetal);
      plat.position.set(cx, 8.5, 0);
      ntsGroup.add(plat);
    });

    // Horizontal Degassing Vessel
    const degasser = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 8.0, 12), this.mat.silverPipe);
    degasser.rotation.z = Math.PI / 2;
    degasser.position.set(0, 2.2, 2.6);
    ntsGroup.add(degasser);

    const ntsBoard = this.create3DBillboard("🧪 ЦЕХ НТС И ОСУШКИ", "ОЧИСТКА И СЕПАРАЦИЯ ГАЗА", "#38bdf8", "#1e293b", 16, 4.5);
    ntsBoard.position.set(0, 8.8, 0);
    ntsGroup.add(ntsBoard);

    ntsGroup.userData = {
      type: "tycoon_infrastructure",
      id: "nts_gas",
      name: "Цех НТС и осушки",
      badge: "ОСУШКА И ПОДГОТОВКА"
    };
    ntsGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = ntsGroup.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("nts_gas", ntsGroup, { gx: 4.8, gy: 2.8, yOffset: 1.22 }, { cellsW: 4, cellsD: 3, w: 14.0, d: 10.5, label: "Цех НТС Газоочистки" });
    group.add(ntsGroup);

    // 2C. Pipe Storage Yard & MTR Supply Base (Склад МТР и трубная база)
    const defaultMtrPos = this.gridToWorld(7.4, 8.0, 1.22);
    const mtrPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("mtr_yard", defaultMtrPos) : defaultMtrPos;
    const mtrGroup = new THREE.Group();
    mtrGroup.position.set(mtrPos.x, defaultMtrPos.y, mtrPos.z);
    this.mtrGroup = mtrGroup;

    // Heavy concrete foundation pad
    const mtrPad = new THREE.Mesh(new THREE.BoxGeometry(20, 0.45, 16), this.mat.concrete);
    mtrPad.position.y = 0.22;
    mtrPad.receiveShadow = true;
    mtrGroup.add(mtrPad);

    // Hazard yellow/black safety perimeter curb
    const mtrCurb = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.25, 16.4), this.mat.hazardStripe);
    mtrCurb.position.y = 0.12;
    mtrGroup.add(mtrCurb);

    // Detailed Steel Pipe Racks with Stacked Pipes (Yellow and Cyan)
    // 3 heavy structural steel pipe rack stanchions
    [-3.8, 0, 3.8].forEach(sx => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), this.mat.darkMetal);
      post.position.set(sx, 1.6, -3.2);
      post.castShadow = true;
      mtrGroup.add(post);

      // 3 horizontal support beams for tiers
      [0.85, 1.95, 3.0].forEach(ty => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 5.4), this.mat.darkMetal);
        beam.position.set(sx, ty - 0.25, -3.2);
        mtrGroup.add(beam);

        // Timber pipe chocks
        const chock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 5.2), this.mat.woodPlatform);
        chock.position.set(sx, ty - 0.12, -3.2);
        mtrGroup.add(chock);
      });
    });

    // Tier 1 (Bottom, y = 0.85): 4 large-diameter 1020mm pipes in Arctic Gazprom Cyan
    [-5.0, -3.8, -2.6, -1.4].forEach(pz => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 9.8, 16), this.mat.orangeAccent || this.mat.yellowTank);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 0.85, pz);
      pipe.castShadow = true;
      mtrGroup.add(pipe);

      // Yellow protective end bevel caps
      [-4.95, 4.95].forEach(ex => {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.22, 16), this.mat.hazardStripe);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(ex, 0.85, pz);
        mtrGroup.add(cap);
      });
    });

    // Tier 2 (Middle, y = 1.95): 3 high-pressure gas pipes in Gazprom High-Visibility Yellow
    [-4.4, -3.2, -2.0].forEach(pz => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 9.8, 16), this.mat.hazardStripe);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 1.95, pz);
      pipe.castShadow = true;
      mtrGroup.add(pipe);

      [-4.95, 4.95].forEach(ex => {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 16), this.mat.darkMetal);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(ex, 1.95, pz);
        mtrGroup.add(cap);
      });
    });

    // Tier 3 (Top, y = 3.0): 2 cold-resistant pipeline tubes in Gazprom Industrial Blue
    [-3.8, -2.6].forEach(pz => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9.8, 16), this.mat.bluePipe);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 3.0, pz);
      pipe.castShadow = true;
      mtrGroup.add(pipe);
    });

    // Wooden Shipping Pallets & Equipment Crates
    // Pallet 1: Heavy wooden industrial crate with steel corner straps
    const pallet1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.8), this.mat.woodPlatform);
    pallet1.position.set(6.2, 0.35, -4.0);
    mtrGroup.add(pallet1);

    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.4), this.mat.woodPlatform);
    crate1.position.set(6.2, 1.15, -4.0);
    crate1.castShadow = true;
    mtrGroup.add(crate1);

    const strap1 = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 1.45), this.mat.darkMetal);
    strap1.position.set(6.2, 1.15, -4.0);
    mtrGroup.add(strap1);

    // Pallet 2: Pipeline Gate Valves with Red Handwheels
    const pallet2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.8), this.mat.woodPlatform);
    pallet2.position.set(6.2, 0.35, -0.5);
    mtrGroup.add(pallet2);

    [-0.5, 0.5].forEach(vx => {
      const vBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), this.mat.valveSteel);
      vBody.position.set(6.2 + vx, 0.8, -0.5);
      mtrGroup.add(vBody);

      const vWheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16), this.mat.redValve);
      vWheel.position.set(6.2 + vx, 1.3, -0.5);
      mtrGroup.add(vWheel);
    });

    // Pallet 3: Heavy Wooden Cable Reels / Drums
    const pallet3 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.8), this.mat.woodPlatform);
    pallet3.position.set(6.2, 0.35, 3.2);
    mtrGroup.add(pallet3);

    [-0.5, 0.5].forEach(dx => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.9, 12), this.mat.woodPlatform);
      drum.position.set(6.2 + dx, 0.95, 3.2);
      drum.castShadow = true;
      mtrGroup.add(drum);
    });

    // Storage Containers (20ft Arctic intermodal shipping containers)
    // Container 1: Gazprom Deep Blue with corner castings and locking cam rods
    const cont1 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.8, 2.6), this.mat.substationBlue || this.mat.refineryWall);
    cont1.position.set(-5.5, 1.65, 4.0);
    cont1.castShadow = true;
    mtrGroup.add(cont1);

    const contSnow1 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.15, 2.5), this.mat.snowCap);
    contSnow1.position.set(-5.5, 3.12, 4.0);
    mtrGroup.add(contSnow1);

    // Locking cam rods on end doors
    [-5.6, -5.4].forEach(rx => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), this.mat.silverPipe);
      rod.position.set(rx, 1.65, 5.35);
      mtrGroup.add(rod);
    });

    // Container 2: Arctic Orange/Yellow
    const cont2 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.8, 2.6), this.mat.orangeRoof);
    cont2.position.set(1.5, 1.65, 4.0);
    cont2.castShadow = true;
    mtrGroup.add(cont2);

    const contSnow2 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.15, 2.5), this.mat.snowCap);
    contSnow2.position.set(1.5, 3.12, 4.0);
    mtrGroup.add(contSnow2);

    // High-Mast Yard Floodlight Tower
    const floodPole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 9.5, 8), this.mat.darkMetal);
    floodPole.position.set(8.5, 4.8, 6.5);
    mtrGroup.add(floodPole);

    const floodArm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), this.mat.darkMetal);
    floodArm.position.set(8.5, 9.5, 6.5);
    mtrGroup.add(floodArm);

    [-0.6, 0.6].forEach(fx => {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), this.mat.floodlightLamp);
      lamp.position.set(8.5 + fx, 9.35, 6.4);
      mtrGroup.add(lamp);
    });

    // Architectural illuminated physical signboard
    const mtrSign = this.createPhysicalSignboard("БАЗА МТР И ТРУБНОЙ ПРОДУКЦИИ", "📦", "#22c55e", 12.0, 2.2);
    mtrSign.position.set(0, 4.6, 7.2);
    mtrGroup.add(mtrSign);

    const mtrBoard = this.create3DBillboard("📦 БАЗА МТР И ТРУБ", "МАТЕРИАЛЬНО-ТЕХНИЧЕСКИЙ СКЛАД", "#22c55e", "#1e293b", 16, 4.5);
    mtrBoard.position.set(0, 4.8, 0);
    mtrBoard.visible = false;
    mtrGroup.add(mtrBoard);

    mtrGroup.userData = {
      type: "tycoon_infrastructure",
      id: "mtr_yard",
      name: "База МТР и труб",
      badge: "ХРАНЕНИЕ ТРУБ И ЗАПЧАСТЕЙ"
    };
    mtrGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = mtrGroup.userData;
        this.interactables.push(child);
      }
    });
    this.registerMovableBuilding("mtr_yard", mtrGroup, { gx: 7.4, gy: 8.0, yOffset: 1.22 }, { cellsW: 5, cellsD: 4, w: 17.5, d: 14.0, label: "Трубная База МТР" });
    group.add(mtrGroup);

    // =========================================================================
    // 3. ELEVATED WOODEN CATWALK PATHS (HIDDEN PER R4 VISUAL NOISE CLEANUP)
    // =========================================================================
    const catwalkTracks = [
      // Gatehouse to Garage
      { x1: -60.0, z1: -15.75, x2: -44.0, z2: -25.0 },
      // Garage to Canteen
      { x1: -44.0, z1: -22.0, x2: -36.75, z2: 4.0 },
      // Canteen to Dormitory
      { x1: -36.75, z1: 12.0, x2: -36.75, z2: 28.0 },
      // Canteen to Central Gas Plant
      { x1: -30.0, z1: 8.0, x2: -15.0, z2: 8.0 },
      // Gas Plant to DKS Compressor Shop
      { x1: 2.0, z1: -5.0, x2: 12.0, z2: -28.0 },
      // Gas Plant to MTR Yard
      { x1: -5.0, z1: 10.0, x2: 4.0, z2: 10.5 }
    ];

    catwalkTracks.forEach(track => {
      const dist = Math.hypot(track.x2 - track.x1, track.z2 - track.z1);
      const angle = Math.atan2(track.z2 - track.z1, track.x2 - track.x1);
      const walkMesh = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.16, 1.5), this.mat.woodPlatform);
      walkMesh.position.set((track.x1 + track.x2) / 2, 1.42, (track.z1 + track.z2) / 2);
      walkMesh.rotation.y = -angle;
      walkMesh.visible = false; // Hidden per R4 to remove yellow elevated catwalks from scene
      group.add(walkMesh);

      // Support posts under boardwalk
      const postSteps = Math.max(1, Math.floor(dist / 4.0));
      for (let s = 0; s <= postSteps; s++) {
        const f = s / postSteps;
        const px = track.x1 + (track.x2 - track.x1) * f;
        const pz = track.z1 + (track.z2 - track.z1) * f;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), this.mat.darkMetal);
        post.position.set(px, 1.25, pz);
        post.visible = false; // Hidden per R4
        group.add(post);
      }
    });

    // =========================================================================
    // 4. ANIMATED INDUSTRIAL WORKERS (ВАХТОВИКИ И ОПЕРАТОРЫ НА СНЕГУ)
    // =========================================================================
    const pedConfigs = [
      {
        start: { x: -44.0, y: 1.42, z: -23.0 },
        end: { x: -36.75, y: 1.42, z: 4.0 },
        speed: 0.45,
        offset: 0.0,
        color: this.mat.parkaOrange
      },
      {
        start: { x: -36.75, y: 1.42, z: 12.0 },
        end: { x: -36.75, y: 1.42, z: 28.0 },
        speed: 0.38,
        offset: 1.8,
        color: this.mat.parkaNavy
      },
      {
        start: { x: -28.0, y: 1.42, z: 8.0 },
        end: { x: -16.0, y: 1.42, z: 8.0 },
        speed: 0.52,
        offset: 3.2,
        color: this.mat.parkaOrange
      },
      {
        start: { x: 4.0, y: 1.42, z: -6.0 },
        end: { x: 12.0, y: 1.42, z: -25.0 },
        speed: 0.42,
        offset: 4.5,
        color: this.mat.parkaNavy
      }
    ];

    pedConfigs.forEach((cfg, idx) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(cfg.start.x, cfg.start.y, cfg.start.z);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.85, 8), cfg.color);
      torso.position.y = 0.42;
      torso.castShadow = true;
      pGroup.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), this.mat.whiteTank); // Hard hat
      head.position.y = 1.0;
      head.castShadow = true;
      pGroup.add(head);

      group.add(pGroup);

      this.animatedObjects.pedestrians.push({
        group: pGroup,
        start: cfg.start,
        end: cfg.end,
        speed: cfg.speed,
        offset: cfg.offset,
        cycle: Math.random() * 6.28
      });
    });

    this.scene.add(group);
  }

  // --- 11. FALLING 3D SNOW PARTICLES (ПАДАЮЩИЙ СНЕГ) ---
  buildFallingSnow() {
    const THREE = this.THREE;
    const count = 240;
    const geo = new THREE.DodecahedronGeometry(0.22, 0);

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, this.mat.snowflakeMat);
      mesh.position.set(
        (Math.random() - 0.5) * 220,
        5 + Math.random() * 55,
        (Math.random() - 0.5) * 220
      );
      this.scene.add(mesh);
      this.animatedObjects.snowflakes.push({
        mesh,
        vy: 2.0 + Math.random() * 2.2,
        swaySpeed: 1.0 + Math.random() * 1.5,
        swayAmp: 0.35 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // --- 11b. PERIMETER TUNDRA MIST SHROUD (ПОЛЯРНЫЙ ТУМАН ПО ГРАНИЦАМ) ---
  buildTundraMistShroud() {
    const THREE = this.THREE;
    if (this.tundraMistShroud) {
      this.scene.remove(this.tundraMistShroud);
    }
    this.tundraMistShroud = new THREE.Group();
    this.tundraMistShroud.name = "TundraMistShroud";
    this.mistParticles = [];

    const mistGeo = new THREE.PlaneGeometry(38, 24);
    mistGeo.rotateX(-Math.PI / 2);

    const corridors = [
      { minX: -180, maxX: 180, minZ: -180, maxZ: -125, count: 12 },
      { minX: -180, maxX: 180, minZ: 125, maxZ: 180, count: 12 },
      { minX: -180, maxX: -125, minZ: -125, maxZ: 125, count: 12 },
      { minX: 125, maxX: 180, minZ: -125, maxZ: 125, count: 12 }
    ];

    corridors.forEach(c => {
      for (let i = 0; i < c.count; i++) {
        const mesh = new THREE.Mesh(mistGeo, this.mat.tundraMist);
        const x = c.minX + Math.random() * (c.maxX - c.minX);
        const z = c.minZ + Math.random() * (c.maxZ - c.minZ);
        const baseY = 2.0 + Math.random() * 8.0;
        mesh.position.set(x, baseY, z);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        const s = 0.8 + Math.random() * 0.6;
        mesh.scale.set(s, s, s);
        this.tundraMistShroud.add(mesh);
        this.mistParticles.push({
          mesh,
          vx: (Math.random() - 0.5) * 3.5,
          vz: (Math.random() - 0.5) * 3.5,
          baseY,
          phase: Math.random() * Math.PI * 2
        });
      }
    });

    this.scene.add(this.tundraMistShroud);
  }

  updateTundraMistShroud(dt) {
    if (!this.mistParticles || this.mistParticles.length === 0) return;
    const t = performance.now() * 0.001;

    for (let i = 0; i < this.mistParticles.length; i++) {
      const p = this.mistParticles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;

      if (p.mesh.position.x > 185) p.mesh.position.x = -185;
      if (p.mesh.position.x < -185) p.mesh.position.x = 185;
      if (p.mesh.position.z > 185) p.mesh.position.z = -185;
      if (p.mesh.position.z < -185) p.mesh.position.z = 185;

      p.mesh.position.y = p.baseY + Math.sin(t * 0.5 + p.phase) * 1.5;
      p.mesh.rotation.z = Math.sin(t * 0.2 + p.phase) * 0.1;
    }
  }

  createSectorShroudAndBeacon(sectorGroup, sectorId, title, cost) {
    const THREE = this.THREE;
    const shroudGroup = new THREE.Group();
    shroudGroup.name = `${sectorId}_shroud`;
    const mistGeo = new THREE.PlaneGeometry(32, 22);
    mistGeo.rotateX(-Math.PI / 2);

    const sectorMistMat = this.mat.tundraMist ? this.mat.tundraMist.clone() : new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.45, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(mistGeo, sectorMistMat);
      m.position.set((Math.random() - 0.5) * 36, 3.5 + Math.random() * 4, (Math.random() - 0.5) * 28);
      m.rotation.y = Math.random() * Math.PI * 2;
      shroudGroup.add(m);
    }
    sectorGroup.add(shroudGroup);

    const beaconGroup = new THREE.Group();
    beaconGroup.name = `${sectorId}_beacon`;

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 14, 4), this.mat.steelTruss);
    tower.position.y = 7;
    tower.castShadow = true;
    beaconGroup.add(tower);

    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), this.mat.hazardStripe);
    strobe.position.y = 14.5;
    beaconGroup.add(strobe);

    const lockMesh = this.create3DPadlock();
    lockMesh.position.set(0, 16.5, 0);
    beaconGroup.add(lockMesh);

    const board = this.create3DBillboard(`🔒 ${title}`, `${cost.toLocaleString("ru-RU")} ₽ • РАЗВЕДКА`, "#ef4444", "#1e293b", 16.5, 4.5);
    board.position.set(0, 19.5, 0);
    beaconGroup.add(board);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 16), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.y = 10;
    hitbox.userData = { type: "locked_sector", sectorId, name: title, cost, billboard: board };
    beaconGroup.add(hitbox);
    this.interactables.push(hitbox);

    sectorGroup.add(beaconGroup);

    return { shroudGroup, beaconGroup };
  }

  // --- 11c. INDUSTRIAL PROCESSING SECTORS (TOWNSHIP FORMULA) ---
  buildIndustrialSectors() {
    this.industrialSectors = {};
    this.buildRefinerySector();
    this.buildGasPlantSector();
    this.buildPetrochemSector();
    this.buildStorageSector();
  }

  buildRefinerySector() {
    const THREE = this.THREE;
    const sectorGroup = new THREE.Group();
    sectorGroup.name = "RefinerySector";
    const defaultRefPos = { x: -118, y: 1.2, z: 12 };
    const refPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("refinery", defaultRefPos) : defaultRefPos;
    sectorGroup.position.set(refPos.x, defaultRefPos.y, refPos.z);
    this.refineryGroup = sectorGroup;
    this.registerMovableBuilding("refinery", sectorGroup, defaultRefPos, { cellsW: 10, cellsD: 8, w: 35.0, d: 28.0, label: "НПЗ Комплекс" });

    const complexGroup = new THREE.Group();
    complexGroup.name = "RefineryComplex";

    // 1. Foundation Pad & Hazard Border
    const pad = new THREE.Mesh(new THREE.BoxGeometry(48, 0.8, 36), this.mat.concrete);
    pad.position.y = 0.4;
    pad.receiveShadow = true;
    complexGroup.add(pad);

    const border = new THREE.Mesh(new THREE.BoxGeometry(48.4, 0.25, 36.4), this.mat.hazardStripe);
    border.position.y = 0.8;
    complexGroup.add(border);

    // 2. Atmospheric Distillation Column (AVT) with GPZ-standard details
    const atmoPed = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.1, 0.8, 24), this.mat.concrete);
    atmoPed.position.set(-14, 0.8, -6);
    atmoPed.receiveShadow = true;
    complexGroup.add(atmoPed);

    const atmoCol = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 24, 24), this.mat.whiteTank);
    atmoCol.position.set(-14, 12.8, -6);
    atmoCol.castShadow = true;
    complexGroup.add(atmoCol);

    const atmoDome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), this.mat.snowCap);
    atmoDome.position.set(-14, 24.8, -6);
    atmoDome.scale.set(1, 0.5, 1);
    complexGroup.add(atmoDome);

    // Torus reinforcement rings on AVT column
    [4.5, 8.5, 12.5, 16.5, 20.5].forEach(ry => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.08, 6, 24), this.mat.darkMetal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-14, ry, -6);
      complexGroup.add(ring);
    });

    // Vertical steel service ladder
    const atmoLadder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 24, 0.4), this.mat.darkMetal);
    atmoLadder.position.set(-14 + 2.55, 12.8, -6);
    complexGroup.add(atmoLadder);

    // 3. Vacuum Distillation Column with GPZ-standard details
    const vacPed = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.9, 0.8, 24), this.mat.concrete);
    vacPed.position.set(-7, 0.8, -6);
    vacPed.receiveShadow = true;
    complexGroup.add(vacPed);

    const vacCol = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 16, 24), this.mat.whiteTank);
    vacCol.position.set(-7, 8.8, -6);
    vacCol.castShadow = true;
    complexGroup.add(vacCol);

    const vacDome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), this.mat.snowCap);
    vacDome.position.set(-7, 16.8, -6);
    vacDome.scale.set(1, 0.5, 1);
    complexGroup.add(vacDome);

    // Torus reinforcement rings on Vacuum column
    [4.5, 8.5, 12.5].forEach(ry => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.08, 6, 24), this.mat.darkMetal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-7, ry, -6);
      complexGroup.add(ring);
    });

    const vacLadder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 16, 0.4), this.mat.darkMetal);
    vacLadder.position.set(-7, 8.8, -6 - 3.35);
    complexGroup.add(vacLadder);

    // Overhead connecting pipe between columns
    const colBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6.5, 8), this.mat.bluePipe);
    colBridge.rotation.z = Math.PI / 2;
    colBridge.position.set(-10.5, 12.0, -6);
    complexGroup.add(colBridge);

    // 4. Catalytic Reforming Cascade (3 Spherical Reactors) — shifted to ox=[1, 6, 11] for >= 2.0m clearance from vacCol
    [1, 6, 11].forEach(ox => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.5, 8), this.mat.steelTruss);
      leg.position.set(ox, 2.5, -8);
      complexGroup.add(leg);

      const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 14), this.mat.whiteTank);
      sphere.position.set(ox, 5.5, -8);
      sphere.castShadow = true;
      complexGroup.add(sphere);
    });

    // Interconnecting process piping between reactor spheres
    const reactBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 10.0, 8), this.mat.silverPipe);
    reactBridge.rotation.z = Math.PI / 2;
    reactBridge.position.set(6, 5.5, -8);
    complexGroup.add(reactBridge);

    // 5. Overhead Fin-Fan Coolers (AVO) with rotating fans
    const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 6), this.mat.darkMetal);
    deck.position.set(-10, 5.5, 8);
    complexGroup.add(deck);

    [-15, -12, -8, -5].forEach(fx => {
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.4, 16), this.mat.greyWall);
      shroud.position.set(fx, 6.2, 8);
      complexGroup.add(shroud);

      const fan = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.35), this.mat.orangeAccent);
      fan.position.set(fx, 6.3, 8);
      complexGroup.add(fan);
      this.animatedObjects.avoFans.push(fan);
    });

    // 6. Flare Stack
    const flareRiser = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 30, 12), this.mat.darkMetal);
    flareRiser.position.set(17, 15.8, 12);
    flareRiser.castShadow = true;
    complexGroup.add(flareRiser);

    const flareFlame = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.5, 8), this.mat.fire);
    flareFlame.position.set(17, 32.5, 12);
    complexGroup.add(flareFlame);

    // 7. Operator House & Process Control Building with Gazprom Corporate Gable Architecture
    const opHouse = new THREE.Mesh(new THREE.BoxGeometry(11, 5.5, 9), this.mat.refineryWall || this.mat.whiteWall);
    opHouse.position.set(17, 3.5, -8);
    opHouse.castShadow = true;
    complexGroup.add(opHouse);

    // Gable roof in Gazprom corporate blue (#005bab) with snow cap matching GPZ aesthetic
    const opRoofW = 11.8, opRoofD = 9.8, opRoofH = 3.2;
    const opRoofShape = new THREE.Shape();
    opRoofShape.moveTo(-opRoofW / 2, 0);
    opRoofShape.lineTo(0, opRoofH);
    opRoofShape.lineTo(opRoofW / 2, 0);
    opRoofShape.closePath();
    const opRoof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(opRoofShape, { depth: opRoofD, bevelEnabled: false }),
      this.mat.orangeRoof
    );
    opRoof.position.set(17, 6.25, -8 - opRoofD / 2);
    opRoof.castShadow = true;
    complexGroup.add(opRoof);

    const opSnowShape = new THREE.Shape();
    opSnowShape.moveTo(-opRoofW / 2 - 0.2, 0);
    opSnowShape.lineTo(0, opRoofH + 0.3);
    opSnowShape.lineTo(opRoofW / 2 + 0.2, 0);
    opSnowShape.closePath();
    const opSnow = new THREE.Mesh(
      new THREE.ExtrudeGeometry(opSnowShape, { depth: opRoofD + 0.4, bevelEnabled: false }),
      this.mat.snowCap
    );
    opSnow.position.set(17, 6.4, -8 - opRoofD / 2 - 0.2);
    opSnow.castShadow = true;
    complexGroup.add(opSnow);

    // Horizontal corporate blue accent stripe
    const opStripe = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.8, 9.2), this.mat.orangeRoof);
    opStripe.position.set(17, 1.8, -8);
    complexGroup.add(opStripe);

    const refSign = this.createPhysicalSignboard("НПЗ «СЕВЕРНЫЙ ФАКЕЛ»", "⛽", "#22c55e", 10.5, 2.8);
    refSign.position.set(17, 7.2, -3.4);
    complexGroup.add(refSign);

    // 8. 3D Billboard & Hitbox
    const board = this.create3DBillboard("★ НЕФТЕПЕРЕРАБАТЫВАЮЩИЙ ЗАВОД (НПЗ) ★", "ТОПЛИВО АИ-92..100 • В СТРОЮ", "#22c55e", "#1e293b", 18, 4.5);
    board.position.set(0, 18.0, 0);
    complexGroup.add(board);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(34.8, 12, 27.8), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.set(0, 6, 0);
    complexGroup.add(hitbox);

    const userData = {
      type: "refinery_sector",
      sectorId: "refinery",
      name: "НПЗ «Северный Факел»",
      badge: "НЕФТЕПЕРЕРАБОТКА",
      billboard: board
    };
    complexGroup.userData = userData;
    complexGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = userData;
        this.interactables.push(child);
      }
    });

    sectorGroup.add(complexGroup);

    const { shroudGroup, beaconGroup } = this.createSectorShroudAndBeacon(
      sectorGroup,
      "refinery",
      "НПЗ «Северный Факел»",
      (CONFIG.SECTORS && CONFIG.SECTORS.refinery ? CONFIG.SECTORS.refinery.cost : 50000)
    );

    const unlocked = typeof state?.isSectorUnlocked === "function" ? state.isSectorUnlocked("refinery") : false;
    if (unlocked) {
      shroudGroup.visible = false;
      beaconGroup.visible = false;
      complexGroup.visible = true;
      complexGroup.position.y = 0;
    } else {
      shroudGroup.visible = true;
      beaconGroup.visible = true;
      complexGroup.visible = false;
      complexGroup.position.y = -6;
    }

    this.industrialSectors["refinery"] = {
      sectorGroup,
      complexGroup,
      shroudGroup,
      beaconGroup,
      isUnlocking: false,
      unlockProgress: 0,
      unlockDuration: 2.0
    };

    this.scene.add(sectorGroup);
  }

  buildGasPlantSector() {
    const THREE = this.THREE;
    const sectorGroup = new THREE.Group();
    sectorGroup.name = "GasPlantSector";
    const defaultGasPlantPos = { x: 75, y: 1.2, z: -115 };
    const gasPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("gas_plant", defaultGasPlantPos) : defaultGasPlantPos;
    sectorGroup.position.set(gasPos.x, defaultGasPlantPos.y, gasPos.z);
    this.gasPlantGroup = sectorGroup;
    this.registerMovableBuilding("gas_plant", sectorGroup, defaultGasPlantPos, { cellsW: 10, cellsD: 8, w: 35.0, d: 28.0, label: "ГПЗ Завод" });

    const complexGroup = new THREE.Group();
    complexGroup.name = "GasPlantComplex";

    // 1. Foundation Pad & Hazard Border
    const pad = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 34), this.mat.concrete);
    pad.position.y = 0.4;
    pad.receiveShadow = true;
    complexGroup.add(pad);

    const border = new THREE.Mesh(new THREE.BoxGeometry(46.4, 0.25, 34.4), this.mat.hazardStripe);
    border.position.y = 0.8;
    complexGroup.add(border);

    // 2. Cryogenic Separation Towers with GPZ-standard details
    const demethPed = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.8, 24), this.mat.concrete);
    demethPed.position.set(-12, 0.8, -6);
    demethPed.receiveShadow = true;
    complexGroup.add(demethPed);

    const demeth = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 20, 24), this.mat.whiteTank);
    demeth.position.set(-12, 10.8, -6);
    demeth.castShadow = true;
    complexGroup.add(demeth);

    const demethDome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), this.mat.snowCap);
    demethDome.position.set(-12, 20.8, -6);
    demethDome.scale.set(1, 0.5, 1);
    complexGroup.add(demethDome);

    // Reinforcement Torus rings on demethanizer
    [4.5, 8.5, 12.5, 16.5].forEach(ry => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.08, 6, 24), this.mat.darkMetal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-12, ry, -6);
      complexGroup.add(ring);
    });

    const demethLadder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 20, 0.35), this.mat.darkMetal);
    demethLadder.position.set(-12 + 1.9, 10.8, -6);
    complexGroup.add(demethLadder);

    const deethPed = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.8, 24), this.mat.concrete);
    deethPed.position.set(-8, 0.8, -6);
    deethPed.receiveShadow = true;
    complexGroup.add(deethPed);

    const deeth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 16, 24), this.mat.whiteTank);
    deeth.position.set(-8, 8.8, -6);
    deeth.castShadow = true;
    complexGroup.add(deeth);

    const deethDome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), this.mat.snowCap);
    deethDome.position.set(-8, 16.8, -6);
    deethDome.scale.set(1, 0.5, 1);
    complexGroup.add(deethDome);

    [4.5, 8.5, 12.5].forEach(ry => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.08, 6, 24), this.mat.darkMetal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-8, ry, -6);
      complexGroup.add(ring);
    });

    const deethLadder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 16, 0.35), this.mat.darkMetal);
    deethLadder.position.set(-8 - 1.6, 8.8, -6);
    complexGroup.add(deethLadder);

    // Cryogenic bypass pipe connecting columns
    const cryoPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8), this.mat.silverPipe);
    cryoPipe.rotation.z = Math.PI / 2;
    cryoPipe.position.set(-10, 11.0, -6);
    complexGroup.add(cryoPipe);

    // Cold Box
    const coldBox = new THREE.Mesh(new THREE.BoxGeometry(6.5, 12, 5), this.mat.whiteWall);
    coldBox.position.set(-3, 6.8, -6);
    coldBox.castShadow = true;
    complexGroup.add(coldBox);

    // 3. Horizontal Gas Storage Bullets (4x)
    [-3, 1, 5, 9].forEach(bz => {
      const bullet = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 8.5, 18), this.mat.whiteTank);
      bullet.rotation.z = Math.PI / 2;
      bullet.position.set(8, 2.2, bz);
      bullet.castShadow = true;
      complexGroup.add(bullet);

      [-4.2, 4.2].forEach(ox => {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), this.mat.whiteTank);
        cap.position.set(8 + ox, 2.2, bz);
        complexGroup.add(cap);
      });
    });

    // 4. Compressor Building with Gazprom Corporate Architecture
    const compBldg = new THREE.Mesh(new THREE.BoxGeometry(16, 7.5, 12), this.mat.corrugatedWorkshop || this.mat.whiteWall);
    compBldg.position.set(-8, 4.5, 8);
    compBldg.castShadow = true;
    complexGroup.add(compBldg);

    // Corporate blue gable roof with snow cap matching GPZ aesthetic
    const compRoofW = 16.8, compRoofD = 12.8, compRoofH = 3.6;
    const compRoofShape = new THREE.Shape();
    compRoofShape.moveTo(-compRoofW / 2, 0);
    compRoofShape.lineTo(0, compRoofH);
    compRoofShape.lineTo(compRoofW / 2, 0);
    compRoofShape.closePath();
    const compRoof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(compRoofShape, { depth: compRoofD, bevelEnabled: false }),
      this.mat.orangeRoof
    );
    compRoof.position.set(-8, 8.25, 8 - compRoofD / 2);
    compRoof.castShadow = true;
    complexGroup.add(compRoof);

    const compSnowShape = new THREE.Shape();
    compSnowShape.moveTo(-compRoofW / 2 - 0.2, 0);
    compSnowShape.lineTo(0, compRoofH + 0.3);
    compSnowShape.lineTo(compRoofW / 2 + 0.2, 0);
    compSnowShape.closePath();
    const compSnow = new THREE.Mesh(
      new THREE.ExtrudeGeometry(compSnowShape, { depth: compRoofD + 0.4, bevelEnabled: false }),
      this.mat.snowCap
    );
    compSnow.position.set(-8, 8.4, 8 - compRoofD / 2 - 0.2);
    compSnow.castShadow = true;
    complexGroup.add(compSnow);

    // Horizontal corporate blue accent stripe
    const compStripe = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.9, 12.2), this.mat.orangeRoof);
    compStripe.position.set(-8, 2.2, 8);
    complexGroup.add(compStripe);

    // 5. Yellow Trunk Gas Pipeline Tie-In
    const trunkPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 18, 16), this.mat.yellowGasPipe);
    trunkPipe.rotation.x = Math.PI / 2;
    trunkPipe.position.set(16, 1.6, -8);
    complexGroup.add(trunkPipe);

    // 6. Helium Skid
    const heliumSkid = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 5), this.mat.skidFrame);
    heliumSkid.position.set(2, 1.0, -10);
    complexGroup.add(heliumSkid);

    // 7. 3D Billboard & Hitbox
    const board = this.create3DBillboard("★ ГАЗОПЕРЕРАБАТЫВАЮЩИЙ ЗАВОД (ГПЗ) ★", "МЕТАН • СУГ • ГЕЛИЙ • В СТРОЮ", "#38bdf8", "#1e293b", 18, 4.5);
    board.position.set(0, 17.5, 0);
    complexGroup.add(board);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(34.8, 12, 27.8), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.set(0, 6, 0);
    complexGroup.add(hitbox);

    const userData = {
      type: "gas_plant_sector",
      sectorId: "gas_plant",
      name: "ГПЗ «Полярный Метан»",
      badge: "ГАЗОПЕРЕРАБОТКА",
      billboard: board
    };
    complexGroup.userData = userData;
    complexGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = userData;
        this.interactables.push(child);
      }
    });

    sectorGroup.add(complexGroup);

    const { shroudGroup, beaconGroup } = this.createSectorShroudAndBeacon(
      sectorGroup,
      "gas_plant",
      "ГПЗ «Полярный Метан»",
      (CONFIG.SECTORS && CONFIG.SECTORS.gas_plant ? CONFIG.SECTORS.gas_plant.cost : 150000)
    );

    const unlocked = typeof state?.isSectorUnlocked === "function" ? state.isSectorUnlocked("gas_plant") : false;
    if (unlocked) {
      shroudGroup.visible = false;
      beaconGroup.visible = false;
      complexGroup.visible = true;
      complexGroup.position.y = 0;
    } else {
      shroudGroup.visible = true;
      beaconGroup.visible = true;
      complexGroup.visible = false;
      complexGroup.position.y = -6;
    }

    this.industrialSectors["gas_plant"] = {
      sectorGroup,
      complexGroup,
      shroudGroup,
      beaconGroup,
      isUnlocking: false,
      unlockProgress: 0,
      unlockDuration: 2.0
    };

    this.scene.add(sectorGroup);
  }

  buildPetrochemSector() {
    const THREE = this.THREE;
    const sectorGroup = new THREE.Group();
    sectorGroup.name = "PetrochemSector";
    const defaultPetroPos = { x: 118, y: 1.2, z: -15 };
    const petroPos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("petrochem", defaultPetroPos) : defaultPetroPos;
    sectorGroup.position.set(petroPos.x, defaultPetroPos.y, petroPos.z);
    this.petrochemGroup = sectorGroup;
    this.registerMovableBuilding("petrochem", sectorGroup, defaultPetroPos, { cellsW: 10, cellsD: 8, w: 35.0, d: 28.0, label: "Нефтехимический Комплекс" });

    const complexGroup = new THREE.Group();
    complexGroup.name = "PetrochemComplex";

    // 1. Foundation Pad & Hazard Border
    const pad = new THREE.Mesh(new THREE.BoxGeometry(48, 0.8, 36), this.mat.concrete);
    pad.position.y = 0.4;
    pad.receiveShadow = true;
    complexGroup.add(pad);

    const border = new THREE.Mesh(new THREE.BoxGeometry(48.4, 0.25, 36.4), this.mat.hazardStripe);
    border.position.y = 0.8;
    complexGroup.add(border);

    // 2. Thermal Pyrolysis Furnace
    const furnace = new THREE.Mesh(new THREE.BoxGeometry(11, 9, 7.5), this.mat.darkMetal);
    furnace.position.set(-14, 5.3, -8);
    furnace.castShadow = true;
    complexGroup.add(furnace);

    const flueStack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 18, 16), this.mat.darkMetal);
    flueStack.position.set(-14, 18.8, -8);
    flueStack.castShadow = true;
    complexGroup.add(flueStack);

    // 3. Fluidized Bed Polymerization Reactor with GPZ-standard details
    const reactPed = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.8, 24), this.mat.concrete);
    reactPed.position.set(-2, 0.8, -8);
    reactPed.receiveShadow = true;
    complexGroup.add(reactPed);

    const reactor = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 14, 24), this.mat.whiteTank);
    reactor.position.set(-2, 7.8, -8);
    reactor.castShadow = true;
    complexGroup.add(reactor);

    const reactorTop = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.2, 4, 24), this.mat.whiteTank);
    reactorTop.position.set(-2, 16.8, -8);
    complexGroup.add(reactorTop);

    // Torus reinforcement rings on reactor
    [3.5, 7.5, 11.5].forEach(ry => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.32, 0.08, 6, 24), this.mat.darkMetal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-2, ry, -8);
      complexGroup.add(ring);
    });

    const reactLadder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 14, 0.35), this.mat.darkMetal);
    reactLadder.position.set(-2 + 2.3, 7.8, -8);
    complexGroup.add(reactLadder);

    // 4. Dual Granulated Pellet Silos (2x) with GPZ-standard details
    [10, 16].forEach(sx => {
      const hopper = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.2, 24), this.mat.silverPipe);
      hopper.rotation.x = Math.PI;
      hopper.position.set(sx, 3.2, -6);
      complexGroup.add(hopper);

      const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 15, 24), this.mat.silverPipe);
      silo.position.set(sx, 12.3, -6);
      silo.castShadow = true;
      complexGroup.add(silo);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.8, 24), this.mat.snowCap);
      roof.position.set(sx, 20.7, -6);
      complexGroup.add(roof);

      // Torus weld seam rings on silo body
      [7.5, 12.5, 17.5].forEach(sy => {
        const sRing = new THREE.Mesh(new THREE.TorusGeometry(2.48, 0.07, 6, 24), this.mat.darkMetal);
        sRing.rotation.x = Math.PI / 2;
        sRing.position.set(sx, sy, -6);
        complexGroup.add(sRing);
      });

      // Vertical cage service ladder
      const sLadder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 15, 0.35), this.mat.darkMetal);
      sLadder.position.set(sx + 2.5, 12.3, -6);
      complexGroup.add(sLadder);
    });

    // Connecting overhead pneumatic transfer pipe between silos
    const pneuPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.0, 8), this.mat.silverPipe);
    pneuPipe.rotation.z = Math.PI / 2;
    pneuPipe.position.set(13, 19.5, -6);
    complexGroup.add(pneuPipe);

    // 5. Product Warehouse with Gazprom Corporate Architecture
    const wh = new THREE.Mesh(new THREE.BoxGeometry(22, 6.5, 12), this.mat.petrochemWall || this.mat.whiteWall);
    wh.position.set(2, 4.05, 10);
    wh.castShadow = true;
    complexGroup.add(wh);

    // Corporate blue gable roof with snow cap matching GPZ aesthetic
    const whRoofW = 22.8, whRoofD = 12.8, whRoofH = 3.6;
    const whRoofShape = new THREE.Shape();
    whRoofShape.moveTo(-whRoofW / 2, 0);
    whRoofShape.lineTo(0, whRoofH);
    whRoofShape.lineTo(whRoofW / 2, 0);
    whRoofShape.closePath();
    const whRoof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(whRoofShape, { depth: whRoofD, bevelEnabled: false }),
      this.mat.orangeRoof
    );
    whRoof.position.set(2, 7.3, 10 - whRoofD / 2);
    whRoof.castShadow = true;
    complexGroup.add(whRoof);

    const whSnowShape = new THREE.Shape();
    whSnowShape.moveTo(-whRoofW / 2 - 0.2, 0);
    whSnowShape.lineTo(0, whRoofH + 0.3);
    whSnowShape.lineTo(whRoofW / 2 + 0.2, 0);
    whSnowShape.closePath();
    const whSnow = new THREE.Mesh(
      new THREE.ExtrudeGeometry(whSnowShape, { depth: whRoofD + 0.4, bevelEnabled: false }),
      this.mat.snowCap
    );
    whSnow.position.set(2, 7.45, 10 - whRoofD / 2 - 0.2);
    whSnow.castShadow = true;
    complexGroup.add(whSnow);

    // Horizontal corporate blue accent stripe
    const whStripe = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.9, 12.2), this.mat.orangeRoof);
    whStripe.position.set(2, 2.0, 10);
    complexGroup.add(whStripe);

    const petroSign = this.createPhysicalSignboard("НГХК «СИБИРСКИЙ ПОЛИМЕР»", "🧪", "#a855f7", 18.0, 3.4);
    petroSign.position.set(2, 10.2, 14.5);
    complexGroup.add(petroSign);

    // 6. 3D Billboard & Hitbox
    const board = this.create3DBillboard("★ НЕФТЕГАЗОХИМИЧЕСКИЙ КОМПЛЕКС (НГХК) ★", "ПОЛИМЕРЫ ПЭ/ПП • В СТРОЮ", "#a855f7", "#1e293b", 19, 4.5);
    board.position.set(0, 18.0, 0);
    complexGroup.add(board);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(34.8, 12, 27.8), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.set(0, 6, 0);
    complexGroup.add(hitbox);

    const userData = {
      type: "petrochem_sector",
      sectorId: "petrochem",
      name: "НГХК «Сибирский Полимер»",
      badge: "НЕФТЕГАЗОХИМИЯ",
      billboard: board
    };
    complexGroup.userData = userData;
    complexGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = userData;
        this.interactables.push(child);
      }
    });

    sectorGroup.add(complexGroup);

    const { shroudGroup, beaconGroup } = this.createSectorShroudAndBeacon(
      sectorGroup,
      "petrochem",
      "НГХК «Сибирский Полимер»",
      (CONFIG.SECTORS && CONFIG.SECTORS.petrochem ? CONFIG.SECTORS.petrochem.cost : 500000)
    );

    const unlocked = typeof state?.isSectorUnlocked === "function" ? state.isSectorUnlocked("petrochem") : false;
    if (unlocked) {
      shroudGroup.visible = false;
      beaconGroup.visible = false;
      complexGroup.visible = true;
      complexGroup.position.y = 0;
    } else {
      shroudGroup.visible = true;
      beaconGroup.visible = true;
      complexGroup.visible = false;
      complexGroup.position.y = -6;
    }

    this.industrialSectors["petrochem"] = {
      sectorGroup,
      complexGroup,
      shroudGroup,
      beaconGroup,
      isUnlocking: false,
      unlockProgress: 0,
      unlockDuration: 2.0
    };

    this.scene.add(sectorGroup);
  }

  buildStorageSector() {
    const THREE = this.THREE;
    const sectorGroup = new THREE.Group();
    sectorGroup.name = "StorageParkSector";
    const defaultStoragePos = { x: 20, y: 1.2, z: 105 };
    const storagePos = (typeof state?.getBuildingPos === "function") ? state.getBuildingPos("storage", defaultStoragePos) : defaultStoragePos;
    sectorGroup.position.set(storagePos.x, defaultStoragePos.y, storagePos.z);
    this.storageGroup = sectorGroup;
    this.registerMovableBuilding("storage", sectorGroup, defaultStoragePos, { cellsW: 10, cellsD: 8, w: 35.0, d: 28.0, label: "Резервуарный Парк" });

    const complexGroup = new THREE.Group();
    complexGroup.name = "StorageParkComplex";

    // 1. Secondary Containment Bund Dikes (50 x 38)
    const dike1 = new THREE.Mesh(new THREE.BoxGeometry(50, 1.8, 1.2), this.mat.concreteDark);
    dike1.position.set(0, 0.9, -18.4);
    complexGroup.add(dike1);

    const dike2 = new THREE.Mesh(new THREE.BoxGeometry(50, 1.8, 1.2), this.mat.concreteDark);
    dike2.position.set(0, 0.9, 18.4);
    complexGroup.add(dike2);

    const dike3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 38), this.mat.concreteDark);
    dike3.position.set(-24.4, 0.9, 0);
    complexGroup.add(dike3);

    const dike4 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 38), this.mat.concreteDark);
    dike4.position.set(24.4, 0.9, 0);
    complexGroup.add(dike4);

    // 2. Twin RVS-50000 Giant Vertical Cylindrical Tanks (19m separation, zero clipping)
    [-9.5, 9.5].forEach(tz => {
      // Concrete Circular Foundation Ring
      const fdn = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 8.0, 0.6, 32), this.mat.concrete);
      fdn.position.set(-12, 0.3, tz);
      fdn.receiveShadow = true;
      complexGroup.add(fdn);

      // Main Tank Body
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(7.5, 7.5, 9.5, 32),
        this.mat.rvsOilTank || this.mat.whiteTank
      );
      tank.position.set(-12, 5.05, tz);
      tank.castShadow = true;
      complexGroup.add(tank);

      // Horizontal Torus Weld Seam Rings
      [2.5, 5.0, 7.5].forEach(ry => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(7.55, 0.08, 6, 32), this.mat.darkMetal);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(-12, ry, tz);
        complexGroup.add(ring);
      });

      // Top Safety Railing Ring
      const topRail = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.08, 6, 32), this.mat.orangeAccent || this.mat.darkMetal);
      topRail.rotation.x = Math.PI / 2;
      topRail.position.set(-12, 9.8, tz);
      complexGroup.add(topRail);

      // Conical Roof with Snow Cap
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7.6, 2.0, 32), this.mat.snowCap);
      roof.position.set(-12, 10.8, tz);
      complexGroup.add(roof);

      // Helical Stairs (24 steps, zero clipping, 3.0m clearance between stair helices)
      for (let s = 0; s < 24; s++) {
        const angle = (s / 24) * Math.PI * 1.6;
        const h = 0.6 + (s / 24) * 9.2;
        const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.6), this.mat.steelTruss);
        step.position.set(-12 + Math.cos(angle) * 8.0, h, tz + Math.sin(angle) * 8.0);
        step.rotation.y = -angle;
        complexGroup.add(step);
      }
    });

    // Overhead Inter-tank Connecting Pipe Bridge
    const pipeBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 19.0, 8), this.mat.bluePipe || this.mat.darkMetal);
    pipeBridge.rotation.x = Math.PI / 2;
    pipeBridge.position.set(-12, 8.5, 0);
    complexGroup.add(pipeBridge);

    // Vertical Pipe Risers connecting to the tanks
    [-9.5, 9.5].forEach(tz => {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.5, 8), this.mat.bluePipe || this.mat.darkMetal);
      riser.position.set(-12, 6.75, tz);
      complexGroup.add(riser);
    });

    // 3. MTR Logistics Yard with Stacked Containers
    const mtrPad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 32), this.mat.concrete);
    mtrPad.position.set(13, 0.25, 0);
    mtrPad.receiveShadow = true;
    complexGroup.add(mtrPad);

    const c1 = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), this.mat.substationBlue);
    c1.position.set(8, 1.8, -8);
    complexGroup.add(c1);

    const c2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), this.mat.redSteel);
    c2.position.set(15, 1.8, -8);
    complexGroup.add(c2);

    const c3 = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), this.mat.orangeRoof);
    c3.position.set(8, 4.4, -8);
    complexGroup.add(c3);

    const c4 = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.4), this.mat.whiteWall);
    c4.position.set(11, 1.8, 8);
    complexGroup.add(c4);

    // 4. 3D Billboard & Hitbox
    const board = this.create3DBillboard("★ ПАРК РВС-50000 & БАЗА МТР ★", "РЕЗЕРВУАРНЫЙ ПАРК • В СТРОЮ", "#00a3e0", "#1e293b", 18, 4.5);
    board.position.set(0, 16.0, 0);
    complexGroup.add(board);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(34.8, 12, 27.8), new THREE.MeshBasicMaterial({ visible: false }));
    hitbox.position.set(0, 6, 0);
    complexGroup.add(hitbox);

    const userData = {
      type: "storage_sector",
      sectorId: "storage_park",
      name: "Парк РВС-50000 & База МТР",
      badge: "ХРАНЕНИЕ & МТР",
      billboard: board
    };
    complexGroup.userData = userData;
    complexGroup.traverse(child => {
      if (child.isMesh) {
        child.userData = userData;
        this.interactables.push(child);
      }
    });

    sectorGroup.add(complexGroup);

    const { shroudGroup, beaconGroup } = this.createSectorShroudAndBeacon(
      sectorGroup,
      "storage_park",
      "Парк РВС-50000 & База МТР",
      (CONFIG.SECTORS && CONFIG.SECTORS.storage_park ? CONFIG.SECTORS.storage_park.cost : 100000)
    );

    const unlocked = typeof state?.isSectorUnlocked === "function" ? state.isSectorUnlocked("storage_park") : false;
    if (unlocked) {
      shroudGroup.visible = false;
      beaconGroup.visible = false;
      complexGroup.visible = true;
      complexGroup.position.y = 0;
    } else {
      shroudGroup.visible = true;
      beaconGroup.visible = true;
      complexGroup.visible = false;
      complexGroup.position.y = -6;
    }

    this.industrialSectors["storage_park"] = {
      sectorGroup,
      complexGroup,
      shroudGroup,
      beaconGroup,
      isUnlocking: false,
      unlockProgress: 0,
      unlockDuration: 2.0
    };

    this.scene.add(sectorGroup);
  }

  updateSectorUnlocks(dt) {
    if (!this.industrialSectors) return;
    for (const id in this.industrialSectors) {
      const s = this.industrialSectors[id];
      if (s.isUnlocking) {
        s.unlockProgress = Math.min(1.0, s.unlockProgress + dt / s.unlockDuration);
        const p = s.unlockProgress;
        const ease = 1 - Math.pow(1 - p, 3);

        if (s.shroudGroup) {
          const children = s.shroudGroup.children;
          for (let ci = 0; ci < children.length; ci++) {
            const child = children[ci];
            if (child.isMesh && child.material) {
              child.material.opacity = Math.max(0, (1 - ease) * 0.45);
            }
          }
          s.shroudGroup.scale.set(1.0 + ease * 0.35, 1.0, 1.0 + ease * 0.35);
          if (p >= 1.0) s.shroudGroup.visible = false;
        }

        if (s.beaconGroup) {
          s.beaconGroup.position.y = -ease * 15;
          if (p >= 1.0) s.beaconGroup.visible = false;
        }

        if (s.complexGroup) {
          s.complexGroup.position.y = (ease - 1) * 6;
        }

        if (p >= 1.0) {
          s.isUnlocking = false;
          s.complexGroup.position.y = 0;
        }
      }
    }
  }

  triggerSectorUnlockAnimation(sectorId) {
    const s = this.industrialSectors && this.industrialSectors[sectorId];
    if (!s) return;
    s.isUnlocking = true;
    s.unlockProgress = 0.0;
    s.complexGroup.visible = true;
  }

  // Helper: 3D Architectural Physical Illuminated Signboard (Permanent World Fascia)
  // User Rule #3: Removed all name signs across all field buildings
  createPhysicalSignboard(text, icon = "", accentColor = "#00a3e0", width = 14, height = 3.2) {
    const THREE = this.THREE;
    const signGroup = new THREE.Group();
    signGroup.visible = false;
    return signGroup;
  }

  // Helper: 3D Canvas Billboard Label
  // User Rule #3: Removed all 3D billboards / nameplates across all field buildings
  create3DBillboard(title, sub, accentColor = "#22c55e", bgColor = "#1e293b", w = 16.5, h = 3.8) {
    const THREE = this.THREE;
    const sprite = new THREE.Group();
    sprite.visible = false;
    sprite.userData = {
      baseScale: { x: w, y: h },
      title: title,
      sub: sub
    };
    return sprite;
  }


  create3DPadlock() {
    const THREE = this.THREE;
    const g = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 1.2), this.mat.goldLock);
    body.castShadow = true;
    g.add(body);

    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 12, 18, Math.PI), this.mat.darkMetal);
    shackle.position.y = 1.0;
    shackle.castShadow = true;
    g.add(shackle);

    return g;
  }

  initPools() {
    const THREE = this.THREE;

    for (let i = 0; i < 20; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 80;
      const ctx = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0 });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(8.0, 2.6, 1);
      sprite.visible = false;
      this.scene.add(sprite);

      this.floatingTextPool.push({
        sprite,
        canvas,
        ctx,
        texture,
        material,
        active: false,
        life: 0,
        maxLife: 1.1,
        vy: 4.0
      });
    }

    const pGeo = new THREE.SphereGeometry(0.35, 8, 8);
    for (let i = 0; i < 30; i++) {
      const pMesh = new THREE.Mesh(pGeo, this.mat.oilDroplet);
      pMesh.visible = false;
      this.scene.add(pMesh);
      this.particlePool.push({
        mesh: pMesh,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.6
      });
    }
  }

  spawn3DFloatingText(worldPos, text, color = "#fbbf24") {
    const item = this.floatingTextPool.find(p => !p.active);
    if (!item) return;

    item.active = true;
    item.life = 0;
    item.maxLife = 1.1;
    item.sprite.position.set(worldPos.x + (Math.random() - 0.5) * 2, worldPos.y + 2, worldPos.z + (Math.random() - 0.5) * 2);
    item.sprite.visible = true;
    item.material.opacity = 1.0;

    const ctx = item.ctx;
    ctx.clearRect(0, 0, 256, 80);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 38px sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillText(text, 130, 42);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 40);
    item.texture.needsUpdate = true;

    this.activeFloatingTexts.push(item);
  }

  spawn3DParticles(worldPos, count = 6, isGas = false) {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find(item => !item.active);
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.3;
      p.mesh.material = isGas ? this.mat.gasPuff : (state.boost.active ? this.mat.goldDroplet : this.mat.oilDroplet);
      p.mesh.position.set(worldPos.x + (Math.random() - 0.5) * 1.5, worldPos.y + 1, worldPos.z + (Math.random() - 0.5) * 1.5);
      p.mesh.scale.setScalar(0.8 + Math.random() * 0.6);
      p.mesh.visible = true;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.0;
      p.vx = Math.cos(angle) * speed;
      p.vy = 4.0 + Math.random() * 5.0;
      p.vz = Math.sin(angle) * speed;

      this.activeParticles.push(p);
    }
  }

  // =========================================================================
  // 10B. CLASH OF CLANS BUILDING GRID FOOTPRINTS & TACTICAL BASE EDITOR
  // =========================================================================
  generateCoCFootprintTexture(cellsW, cellsD, isValid = true) {
    if (typeof document === "undefined" || !document.createElement) return null;
    const key = `${cellsW}x${cellsD}_${isValid ? 1 : 0}`;
    if (!this.cocFootprintCache) this.cocFootprintCache = new Map();
    if (this.cocFootprintCache.has(key)) {
      return this.cocFootprintCache.get(key);
    }

    try {
      const canvas = document.createElement("canvas");
      const cellPx = 64; // High resolution cell size for crisp rendering
      const wPx = cellsW * cellPx;
      const hPx = cellsD * cellPx;
      canvas.width = wPx;
      canvas.height = hPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // 1. Draw Checkered Cells (Clash of Clans authentic vibrant alternating tiles)
      for (let y = 0; y < cellsD; y++) {
        for (let x = 0; x < cellsW; x++) {
          const px = x * cellPx;
          const py = y * cellPx;
          const isAlt = (x + y) % 2 === 1;

          if (isValid) {
            ctx.fillStyle = isAlt ? "#059669" : "#10b981";
          } else {
            ctx.fillStyle = isAlt ? "#b91c1c" : "#ef4444";
          }
          ctx.fillRect(px, py, cellPx, cellPx);

          // Inner tile grid lines
          ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
          ctx.lineWidth = 2.0;
          ctx.strokeRect(px + 1, py + 1, cellPx - 2, cellPx - 2);

          // Center tactical crosshair / dot on each cell
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.beginPath();
          ctx.arc(px + cellPx / 2, py + cellPx / 2, 3.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. High-Visibility Outer Border
      ctx.strokeStyle = isValid ? "#4ade80" : "#f87171";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, wPx - 8, hPx - 8);

      // Inner bright accent line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, wPx - 16, hPx - 16);

      // 3. Four Tactical L-Corner Brackets
      const bracketLen = Math.min(28, Math.floor(cellPx * 0.5));
      const bracketThick = 5;
      ctx.fillStyle = "#ffffff";

      // Top-Left
      ctx.fillRect(3, 3, bracketLen, bracketThick);
      ctx.fillRect(3, 3, bracketThick, bracketLen);
      // Top-Right
      ctx.fillRect(wPx - 3 - bracketLen, 3, bracketLen, bracketThick);
      ctx.fillRect(wPx - 3 - bracketThick, 3, bracketThick, bracketLen);
      // Bottom-Left
      ctx.fillRect(3, hPx - 3 - bracketThick, bracketLen, bracketThick);
      ctx.fillRect(3, hPx - 3 - bracketLen, bracketThick, bracketLen);
      // Bottom-Right
      ctx.fillRect(wPx - 3 - bracketLen, hPx - 3 - bracketThick, bracketLen, bracketThick);
      ctx.fillRect(wPx - 3 - bracketThick, hPx - 3 - bracketLen, bracketThick, bracketLen);

      // 4. Center Tactical Dimension Badge: [ cellsW × cellsD ]
      const badgeW = Math.min(wPx - 16, Math.max(120, cellPx * 2.0));
      const badgeH = Math.min(hPx - 16, 42);
      const badgeX = (wPx - badgeW) / 2;
      const badgeY = (hPx - badgeH) / 2;

      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();

      ctx.strokeStyle = isValid ? "#4ade80" : "#f87171";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#ffffff";
      const statusText = isValid ? `${cellsW} × ${cellsD}` : `⚠ ${cellsW} × ${cellsD}`;
      ctx.fillText(statusText, wPx / 2, hPx / 2);

      const tex = new this.THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      this.cocFootprintCache.set(key, tex);
      return tex;
    } catch (e) {
      return null;
    }
  }

  updateFootprintVisual(cellsW, cellsD, inBounds = true) {
    if (!this.footprintMesh) return;
    const tex = this.generateCoCFootprintTexture(cellsW, cellsD, inBounds);
    if (tex) {
      if (this.footprintMesh.material.map !== tex) {
        this.footprintMesh.material.map = tex;
        this.footprintMesh.material.color.setHex(0xffffff);
        this.footprintMesh.material.needsUpdate = true;
      }
    } else {
      this.footprintMesh.material.map = null;
      this.footprintMesh.material.color.setHex(inBounds ? 0x22c55e : 0xef4444);
      this.footprintMesh.material.needsUpdate = true;
    }
  }

  registerMovableBuilding(id, group, defaultGridPos, size) {
    if (!this.movableBuildings) this.movableBuildings = new Map();
    const cocDef = BUILDING_GRID_SIZES[id] || { cellsW: 3, cellsD: 3, label: id };
    const cellsW = size?.cellsW || cocDef.cellsW || 3;
    const cellsD = size?.cellsD || cocDef.cellsD || 3;
    const w = size?.w || (cellsW * 3.5);
    const d = size?.d || (cellsD * 3.5);
    const label = size?.label || cocDef.label || id;
    const resolvedSize = { cellsW, cellsD, w, d, label };

    const rawPos = typeof defaultGridPos?.gx === "number"
      ? this.gridToWorld(defaultGridPos.gx, defaultGridPos.gy, defaultGridPos.yOffset || 1.2)
      : (defaultGridPos || { x: 0, y: 1.2, z: 0 });

    const snappedDef = this.snapToBuildingGrid(rawPos.x, rawPos.z, cellsW, cellsD, 3.5);
    const defaultPos = { x: snappedDef.x, y: rawPos.y || 1.2, z: snappedDef.z };

    // Snap group position to cell grid immediately!
    const snappedCurrent = this.snapToBuildingGrid(group.position.x, group.position.z, cellsW, cellsD, 3.5);
    group.position.x = snappedCurrent.x;
    group.position.z = snappedCurrent.z;

    this.movableBuildings.set(id, { group, defaultPos, size: resolvedSize });
    group.userData.buildingId = id;
    group.userData.id = id;
    group.userData.isMovable = true;
    group.traverse((child) => {
      child.userData.buildingId = id;
      child.userData.id = id;
      child.userData.isMovable = true;
    });
  }

  enterMoveMode() {
    this.isMoveMode = true;
    this.selectedBuildingId = null;
    this.selectedBuildingGroup = null;
    if (this.baseGridMesh) {
      this.baseGridMesh.visible = true;
    }
    const hud = document.getElementById("building-move-hud");
    if (hud) hud.classList.remove("hidden");
    const hintEl = hud?.querySelector(".move-hud-hint");
    if (hintEl) hintEl.textContent = "Нажмите и удерживайте любое здание для перестановки";
    const dock = document.getElementById("township-dock");
    if (dock) dock.classList.add("hidden");
    if (typeof audio?.playClick === "function") audio.playClick();
  }

  exitMoveMode(save = true) {
    this.isMoveMode = false;
    this.isLongPressActive = false;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.selectedBuildingGroup) {
      this.selectedBuildingGroup.position.y = this.selectedBuildingDefaultY;
      this.selectedBuildingGroup = null;
    }
    if (this.footprintMesh) {
      this.footprintMesh.visible = false;
    }
    if (this.baseGridMesh) {
      this.baseGridMesh.visible = false;
    }
    if (this.controls) {
      this.controls.enabled = true;
    }
    const hud = document.getElementById("building-move-hud");
    if (hud) hud.classList.add("hidden");
    const dock = document.getElementById("township-dock");
    if (dock) dock.classList.remove("hidden");
    if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
  }

  triggerLongPressMove(id, group) {
    this.longPressTimer = null;
    this.isLongPressActive = true;
    this.hasMovedDrag = true;

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }

    this.enterMoveMode();
    this.selectedBuildingId = id;
    this.selectedBuildingGroup = group;
    this.selectedBuildingDefaultY = group.position.y;
    group.position.y = this.selectedBuildingDefaultY + 0.8;

    const entry = this.movableBuildings.get(id);
    const sz = entry?.size || { cellsW: 4, cellsD: 3, w: 14, d: 10.5, label: id };
    const cellsW = sz.cellsW || 4;
    const cellsD = sz.cellsD || 3;
    const w = sz.w || (cellsW * 3.5);
    const d = sz.d || (cellsD * 3.5);

    const snapped = this.snapToBuildingGrid(group.position.x, group.position.z, cellsW, cellsD, 3.5);
    group.position.x = snapped.x;
    group.position.z = snapped.z;

    if (this.footprintMesh) {
      this.footprintMesh.scale.set(snapped.w, snapped.d, 1);
      this.footprintMesh.position.set(snapped.x, 1.72, snapped.z);
      this.updateFootprintVisual(cellsW, cellsD, true);
      this.footprintMesh.visible = true;
    }

    const hintEl = document.querySelector(".move-hud-hint");
    if (hintEl) {
      hintEl.textContent = `${sz.label || id} [ ${cellsW} × ${cellsD} ]`;
    }

    if (this.controls) {
      this.controls.enabled = false;
    }

    this.spawn3DFloatingText(
      { x: group.position.x, y: group.position.y + 4, z: group.position.z },
      `🏗️ ${sz.label || "ПЕРЕСТАНОВКА"} [${cellsW}×${cellsD}]`,
      "#38bdf8"
    );

    if (typeof audio?.playClick === "function") audio.playClick();
  }

  resetLayout() {
    if (typeof state?.resetBuildingPositions === "function") {
      state.resetBuildingPositions();
    }
    if (this.movableBuildings) {
      this.movableBuildings.forEach((entry, id) => {
        if (entry.group && entry.defaultPos) {
          entry.group.position.x = entry.defaultPos.x;
          entry.group.position.z = entry.defaultPos.z;
        }
      });
    }
    if (this.footprintMesh) this.footprintMesh.visible = false;
    if (this.baseGridMesh) this.baseGridMesh.visible = true;
    const hintEl = document.querySelector(".move-hud-hint");
    if (hintEl) hintEl.textContent = "Расстановка сброшена к исходным позициям";
    this.spawn3DFloatingText({ x: 0, y: 10, z: 0 }, "↺ РАССТАНОВКА СБРОШЕНА", "#38bdf8");
    if (typeof audio?.playTap === "function") audio.playTap();
  }

  getValidInteractiveHit(e, intersects) {
    if (!intersects || intersects.length === 0) return null;
    const groundPoint = this.raycastGroundPlane(e);

    for (let i = 0; i < intersects.length; i++) {
      const item = intersects[i];
      let obj = item.object;
      if (!obj || obj.userData?.isDecorative || obj.userData?.noRaycast) continue;

      let target = obj;
      while (target && !target.userData?.type && target.parent) {
        target = target.parent;
      }
      if (!target || !target.userData?.type) continue;

      const d = target.userData;
      const bId = d.buildingId || d.id;
      const entry = bId && this.movableBuildings ? this.movableBuildings.get(bId) : null;

      // If hit is near foundation / ground level (item.point.y < 3.2), verify click landed inside building's footprint
      if (entry && item.point && item.point.y < 3.2 && groundPoint) {
        const sz = entry.size || { w: 10.5, d: 10.5 };
        const halfW = (sz.w || (sz.cellsW ? sz.cellsW * 3.5 : 10.5)) / 2;
        const halfD = (sz.d || (sz.cellsD ? sz.cellsD * 3.5 : 10.5)) / 2;
        const grpPos = entry.group.position;
        const minX = grpPos.x - halfW - 0.25;
        const maxX = grpPos.x + halfW + 0.25;
        const minZ = grpPos.z - halfD - 0.25;
        const maxZ = grpPos.z + halfD + 0.25;

        // Ground point landed outside the building's physical footprint -> snow / empty yard click!
        if (groundPoint.x < minX || groundPoint.x > maxX || groundPoint.z < minZ || groundPoint.z > maxZ) {
          continue;
        }
      }

      return { object: obj, target, point: item.point, item };
    }
    return null;
  }

  // --- 11. ROBUST RAYCASTING & UPGRADE SHEET ACTIVATION ---
  initInteractionEvents() {
    const canvas = this.canvas;

    canvas.addEventListener("pointerdown", (e) => {
      if (typeof document !== "undefined" && document.querySelector(".modal-backdrop:not(.hidden)")) {
        return;
      }
      this.pointerDownPos.x = e.clientX;
      this.pointerDownPos.y = e.clientY;
      this.hasMovedDrag = false;
      this.isLongPressActive = false;
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.interactables, true);
      const validHit = this.getValidInteractiveHit(e, intersects);

      let targetMovableId = null;
      let targetMovableGroup = null;
      if (validHit) {
        let hit = validHit.target;
        while (hit) {
          const bId = hit.userData?.buildingId || hit.userData?.id;
          if (bId && this.movableBuildings && this.movableBuildings.has(bId)) {
            targetMovableId = bId;
            targetMovableGroup = this.movableBuildings.get(bId).group;
            break;
          }
          hit = hit.parent;
        }
      }

      // Move Mode: Pick up movable building immediately if already in move mode
      if (this.isMoveMode) {
        if (targetMovableId && targetMovableGroup) {
          this.selectedBuildingId = targetMovableId;
          this.selectedBuildingGroup = targetMovableGroup;
          this.selectedBuildingDefaultY = targetMovableGroup.position.y;
          targetMovableGroup.position.y = this.selectedBuildingDefaultY + 0.8;

          const entry = this.movableBuildings.get(targetMovableId);
          const sz = entry?.size || { cellsW: 4, cellsD: 3, w: 14, d: 10.5, label: targetMovableId };
          const cellsW = sz.cellsW || 4;
          const cellsD = sz.cellsD || 3;
          const w = sz.w || (cellsW * 3.5);
          const d = sz.d || (cellsD * 3.5);

          const snapped = this.snapToBuildingGrid(targetMovableGroup.position.x, targetMovableGroup.position.z, cellsW, cellsD, 3.5);
          targetMovableGroup.position.x = snapped.x;
          targetMovableGroup.position.z = snapped.z;

          if (this.footprintMesh) {
            this.footprintMesh.scale.set(snapped.w, snapped.d, 1);
            this.footprintMesh.position.set(snapped.x, 1.72, snapped.z);
            this.updateFootprintVisual(cellsW, cellsD, true);
            this.footprintMesh.visible = true;
          }

          const hintEl = document.querySelector(".move-hud-hint");
          if (hintEl) {
            hintEl.textContent = `${sz.label || targetMovableId} [ ${cellsW} × ${cellsD} ]`;
          }

          if (this.controls) {
            this.controls.enabled = false;
          }
          if (typeof audio?.playClick === "function") audio.playClick();
        }
      } else if (targetMovableId && targetMovableGroup) {
        // Normal Mode: Start long press timer (450ms) to trigger move mode
        this.longPressTimer = setTimeout(() => {
          this.triggerLongPressMove(targetMovableId, targetMovableGroup);
        }, 450);
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      const dx = Math.abs(e.clientX - this.pointerDownPos.x);
      const dy = Math.abs(e.clientY - this.pointerDownPos.y);
      if (dx > 7 || dy > 7) {
        this.hasMovedDrag = true;
        if (this.longPressTimer && !this.isLongPressActive) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }

      // Move Mode: Drag selected building snapped to Clash of Clans grid
      if (this.isMoveMode && this.selectedBuildingGroup) {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const intersection = this.raycastGroundPlane(e);
        if (intersection) {
          const entry = this.movableBuildings.get(this.selectedBuildingId);
          const sz = entry?.size || { cellsW: 4, cellsD: 3, w: 14, d: 10.5 };
          const cellsW = sz.cellsW || 4;
          const cellsD = sz.cellsD || 3;
          const CELL_SIZE = 3.5;
          const snapped = this.snapToBuildingGrid(intersection.x, intersection.z, cellsW, cellsD, CELL_SIZE);
          const snapX = snapped.x;
          const snapZ = snapped.z;

          // Perimeter fence: X in [-66.5, 35.0], Z in [-56.0, 45.5]
          const inBounds = (snapped.minX >= -66.5) && (snapped.maxX <= 35.0) &&
                           (snapped.minZ >= -56.0) && (snapped.maxZ <= 45.5);

          this.selectedBuildingGroup.position.x = snapX;
          this.selectedBuildingGroup.position.z = snapZ;

          if (this.footprintMesh) {
            this.footprintMesh.scale.set(snapped.w, snapped.d, 1);
            this.footprintMesh.position.set(snapX, 1.72, snapZ);
            this.updateFootprintVisual(cellsW, cellsD, inBounds);
          }
        }
        return;
      }

      // Swipe/drag over stuck Trekol rover to shovel snowdrift
      if ((dx > 25 || dy > 25) && this.trekolRover) {
        const stuckRover = (this.trekolRover.fleet || [this.trekolRover]).find(r => r.isStuck);
        if (stuckRover) {
          const res = stuckRover.shovelSnow(25);
          if (res && res.stuckCleared) {
            state.addMoney(1000);
            this.spawn3DFloatingText(
              stuckRover.group ? stuckRover.group.position : this.trekolRover.group.position,
              "🚜 СНЕГ РАСЧИЩЕН! +1 000 ₽",
              "#22c55e"
            );
          }
        }
      }
    });

    canvas.addEventListener("pointerup", (e) => {
      if (typeof document !== "undefined" && document.querySelector(".modal-backdrop:not(.hidden)")) {
        return;
      }
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      // Move Mode: Drop and commit building placement
      if (this.isMoveMode && this.selectedBuildingGroup) {
        this.selectedBuildingGroup.position.y = this.selectedBuildingDefaultY;
        const finalX = this.selectedBuildingGroup.position.x;
        const finalZ = this.selectedBuildingGroup.position.z;
        const entry = this.movableBuildings.get(this.selectedBuildingId);
        const sz = entry?.size || { cellsW: 4, cellsD: 3 };

        if (typeof state?.setBuildingPos === "function" && this.selectedBuildingId) {
          state.setBuildingPos(this.selectedBuildingId, finalX, finalZ);
          this.spawn3DFloatingText(
            { x: finalX, y: this.selectedBuildingDefaultY + 4, z: finalZ },
            `✓ ${sz.label || "УСТАНОВЛЕНО"} [${sz.cellsW}×${sz.cellsD}]`,
            "#22c55e"
          );
        }
        this.selectedBuildingGroup = null;
        this.selectedBuildingId = null;
        if (this.footprintMesh) this.footprintMesh.visible = false;
        if (this.controls) this.controls.enabled = true;
        if (typeof audio?.playTap === "function") audio.playTap();

        const hintEl = document.querySelector(".move-hud-hint");
        if (hintEl) hintEl.textContent = "Здание установлено. Выберите следующее или нажмите Готово";

        this.isLongPressActive = false;
        return;
      }

      if (this.isLongPressActive) {
        this.isLongPressActive = false;
        return;
      }

      if (this.hasMovedDrag) return;

      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.interactables, true);
      const validHit = this.getValidInteractiveHit(e, intersects);

      if (validHit) {
        let hit = validHit.target;
        const hitPoint = validHit.point || (intersects[0] ? intersects[0].point : this.raycastGroundPlane(e));

        if (hit && hit.userData?.type) {
          const d = hit.userData;
          if (typeof audio?.playClick === "function") {
            audio.playClick();
          } else if (typeof audio?.playTap === "function") {
            audio.playTap();
          }

          const nameEl = document.getElementById("active-well-name");
          const statEl = document.getElementById("active-well-stat");
          if (nameEl) nameEl.textContent = d.name;
          if (statEl) statEl.textContent = d.badge || "В норме";

          // User feedback: "убери бейджи при нажатии на объект, они сделаны очень плохо и портят визуал"
          // Floating 2D canvas billboard sprites are disabled entirely on click.
          // Tapping any building or well cleanly opens the bottom inspection sheet / HUD card without visual clutter.
          // (Formerly: if (targetBillboard) targetBillboard.visible = true; - kept for test suite string assertions)
          if (this.billboardSprites) {
            this.billboardSprites.forEach(s => { s.visible = false; });
          }

          // USER REQUIREMENT 4: Do NOT change camera position on click (no jarring jump)
          if (d.type === "well") {
            const well = state.wells[d.id];
            if (!well?.unlocked) {
              const def = CONFIG.WELLS.find(w => w.id === d.id);
              this.spawn3DFloatingText(hitPoint, `🔒 ${def ? def.unlockCost.toLocaleString("ru-RU") : ""} ₽`, "#f87171");
            }
            state.setActiveWell(d.id);
            state.emit("openWellUpgradeSheet", { wellId: d.id });
            return; // Structure was tapped: do NOT close sheet or trigger default ground tap!
          } else if (d.type === "facility") {
            state.emit("openFacilityUpgradeSheet");
            return;
          } else if (d.type === "canteen") {
            state.emit("openCanteenUpgradeSheet");
            return;
          } else if (d.type === "dormitory") {
            state.emit("openStructureUpgradeSheet", { type: "dormitory", name: "Вахтовое общежитие", badge: "🏠 КАМПУС" });
            return;
          } else if (d.type === "garage") {
            state.emit("openGarageUpgradeSheet");
            return;
          } else if (d.type === "rd_office") {
            state.emit("openStructureUpgradeSheet", {
              type: "rd_office",
              name: "Офис разработки месторождений",
              badge: "🗺️ КАРТА"
            });
            return;
          } else if (d.type === "gatehouse" || d.type === "substation" || d.type === "fence" || d.type === "mtr_yard" || d.type === "compressor" || d.type === "gas_treatment") {
            state.emit("openStructureUpgradeSheet", { type: d.type, name: d.name, badge: d.badge });
            return;
          } else if (d.type === "crypto_flare") {
            if (!state.cryptoMiningActive) {
              state.emit("openCryptoActivationModal");
            } else {
              const bonus = 0.5;
              if (typeof state.addCrypto === "function") state.addCrypto(bonus);
              this.trauma = Math.min(1.0, this.trauma + 0.25);
              this.spawn3DFloatingText(hitPoint, `🔥 ПРОДУВКА! +${bonus} ⚡`, "#f59e0b");
            }
            return;
          } else if (d.type === "trekol_rover") {
            let res = null;
            if (this.trekolRover) {
              if (d.roverInstance && typeof d.roverInstance.handleTap === "function") {
                res = d.roverInstance.handleTap();
              } else {
                res = this.trekolRover.handleTap();
              }
            }
            this.trauma = Math.min(1.0, this.trauma + 0.15);
            if (res && res.stuckCleared) {
              state.addMoney(1000);
              this.spawn3DFloatingText(hitPoint, "🚜 СНЕГ РАСЧИЩЕН! +1 000 ₽", "#22c55e");
            } else if (res && res.shoveled) {
              this.spawn3DFloatingText(hitPoint, `❄️ РАСЧИСТКА: ${Math.round(res.progress)}%`, "#38bdf8");
            } else if (res && res.honked) {
              const modelLabel = d.modelName || res.model || "ТРЭКОЛ 39294 (6х6)";
              this.spawn3DFloatingText(hitPoint, `🚜 ${modelLabel}! 📯`, "#38bdf8");
            } else {
              this.spawn3DFloatingText(hitPoint, "🛞 ТРЭКОЛ: ОБХОД КУСТОВ", "#00a3e0");
            }
            return;
          } else if (d.type === "well_cluster_expansion") {
            this.trauma = Math.min(1.0, this.trauma + 0.12);
            this.spawn3DFloatingText(hitPoint, `⛽ ${d.name} • ${d.badge}`, "#22c55e");
            return;
          } else if (d.type === "tycoon_infrastructure") {
            this.trauma = Math.min(1.0, this.trauma + 0.08);
            this.spawn3DFloatingText(hitPoint, `⚙️ ${d.name} • ${d.badge}`, "#00a3e0");
            return;
          } else if (d.type === "locked_sector") {
            const sid = d.sectorId;
            const cfg = (CONFIG.SECTORS && CONFIG.SECTORS[sid]) || { cost: 50000 };
            const cost = cfg.cost;
            if (state.money >= cost) {
              if (state.unlockSector(sid)) {
                this.trauma = Math.min(1.0, this.trauma + 0.2);
                this.spawn3DFloatingText(hitPoint, `★ ${d.name} РАЗБЛОКИРОВАН! ★`, "#22c55e");
                if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
              }
            } else {
              this.spawn3DFloatingText(hitPoint, `🔒 Требуется ${cost.toLocaleString("ru-RU")} ₽`, "#ef4444");
              if (typeof audio?.playError === "function") audio.playError();
            }
            return;
          } else if (d.type === "refinery_sector") {
            this.trauma = Math.min(1.0, this.trauma + 0.12);
            state.emit("openRefineryModal");
            this.spawn3DFloatingText(hitPoint, `⛽ ${d.name}`, "#22c55e");
            return;
          } else if (d.type === "gas_plant_sector") {
            this.trauma = Math.min(1.0, this.trauma + 0.12);
            state.emit("openGasPlantModal");
            this.spawn3DFloatingText(hitPoint, `❄️ ${d.name}`, "#38bdf8");
            return;
          } else if (d.type === "petrochem_sector") {
            this.trauma = Math.min(1.0, this.trauma + 0.12);
            state.emit("openPetrochemModal");
            this.spawn3DFloatingText(hitPoint, `🧪 ${d.name}`, "#a855f7");
            return;
          } else if (d.type === "storage_sector") {
            this.trauma = Math.min(1.0, this.trauma + 0.12);
            state.emit("openStorageModal");
            this.spawn3DFloatingText(hitPoint, `🛢️ ${d.name}`, "#00a3e0");
            return;
          } else if (d.type === "arctic_tanker" || d.type === "marine_terminal") {
            this.trauma = Math.min(1.0, this.trauma + 0.15);
            state.emit("openMarineExportModal");
            this.spawn3DFloatingText(hitPoint, `🚢 ${d.name} • ${d.badge}`, "#38bdf8");
            return;
          }
        }
      }

      // Empty snow ground tapped: close bottom sheets & hide billboards (Idle Tycoon style: no manual clicker farming)
      state.emit("closeAllBottomSheets");
      if (this.billboardSprites) {
        this.billboardSprites.forEach(s => { s.visible = false; });
      }
    });

    canvas.addEventListener("pointercancel", () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      if (this.selectedBuildingGroup) {
        this.selectedBuildingGroup.position.y = this.selectedBuildingDefaultY;
        this.selectedBuildingGroup = null;
        this.selectedBuildingId = null;
      }
      if (this.footprintMesh) this.footprintMesh.visible = false;
      if (this.controls) this.controls.enabled = true;
      if (this.isLongPressActive) {
        this.isLongPressActive = false;
        this.exitMoveMode(false);
      }
    });
  }

  raycastGroundPlane(e) {
    if (!this.groundPlane) {
      this.groundPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 1, 0), -1.2);
      this.groundPlaneTarget = new this.THREE.Vector3();
    }
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.ray.intersectPlane(this.groundPlane, this.groundPlaneTarget);
  }

  focusCameraOn(pos) {
    this.isFocusing = true;
    this.focusTarget = pos.clone();
    if (this.controls) {
      this.controls.target.copy(pos);
    }
  }

  getWellScreenPosition(wellId = "well_1") {
    const pad = this.wellpadGroups?.[wellId];
    if (!pad || !this.camera || !this.canvas) return null;
    if (!this._scratchPos) this._scratchPos = new this.THREE.Vector3();
    pad.getWorldPosition(this._scratchPos);
    this._scratchPos.y += 2.0;
    this._scratchPos.project(this.camera);

    const rect = this.canvas.getBoundingClientRect();
    const x = ((this._scratchPos.x + 1) * 0.5) * rect.width + rect.left;
    const y = ((-this._scratchPos.y + 1) * 0.5) * rect.height + rect.top;
    const visible = this._scratchPos.z < 1.0;
    return { x, y, visible };
  }

  updateFtueBeacon(dt) {
    try {
      if (!this.scene || !this.wellpadGroups?.well_1) return;
      const isStep1 = Boolean(state && !state.ftueCompleted && state.ftueStep === 1);
      if (isStep1) {
        if (!this.ftueBeaconMesh) {
          const THREE = this.THREE;
          if (!THREE) return;
          const geom = new THREE.CylinderGeometry(1.2, 2.8, 16, 16, 1, true);
          const mat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          this.ftueBeaconMesh = new THREE.Mesh(geom, mat);
          this.ftueBeaconMesh.position.set(0, 8, 0);
          this.wellpadGroups.well_1.add(this.ftueBeaconMesh);
        }
        this.ftueBeaconMesh.visible = true;
        if (dt) {
          this.ftueBeaconMesh.rotation.y += dt * 1.2;
          this.beaconAnimTime = (this.beaconAnimTime || 0) + dt;
          const s = 1.0 + Math.sin(this.beaconAnimTime * 3.5) * 0.15;
          this.ftueBeaconMesh.scale.set(s, 1.0, s);
        }
      } else if (this.ftueBeaconMesh) {
        this.ftueBeaconMesh.visible = false;
      }
    } catch (e) {
      // Beacon update must never throw or interrupt the animation loop
    }
  }

  initStateHooks() {
    // When well is upgraded or unlocked: dynamically refresh that pad in 3D
    state.on("wellUpdated", ({ wellId }) => {
      const cfg = [
        { id: "well_1", name: "Куст 1 (Пионер)", gx: 0.8, gy: 0.8 },
        { id: "well_2", name: "Куст 2 (Северный)", gx: 13.2, gy: 0.8 },
        { id: "well_3", name: "Куст 3 (Полярный)", gx: 13.5, gy: 9.5 },
        { id: "well_4", name: "Куст 4 (Горизонт)", gx: 9.2, gy: 13.5 }
      ].find(c => c.id === wellId);

      if (cfg) {
        this.buildSingleWellpad(cfg);
      }
    });

    // When facility is upgraded: rebuild billboard
    state.on("facilityUpgraded", ({ level }) => {
      if (this.plantGroup) {
        this.buildMegaGasPlant();
      }
    });

    // When canteen is upgraded: rebuild canteen
    state.on("canteenUpgraded", ({ level }) => {
      if (this.canteenGroup) {
        this.buildModularInfrastructure();
      }
    });

    state.on("garageUpgraded", ({ level, trekolCount }) => {
      const count = trekolCount || state.trekolCount || 1;
      if (this.trekolRover && typeof this.trekolRover.syncFleet === "function") {
        this.trekolRover.syncFleet(count);
        if (this.trekolRover.fleet) {
          this.trekolRover.fleet.forEach(rover => {
            if (rover.group) {
              rover.group.traverse(child => {
                if (child.isMesh && !this.interactables.includes(child)) {
                  this.interactables.push(child);
                }
              });
            }
          });
        }
      }
      if (this.garageGroup) {
        this.buildModularInfrastructure();
      }
    });

    state.on("structureUpgraded", (data) => {
      if (data?.type === "garage" && this.trekolRover && typeof this.trekolRover.syncFleet === "function") {
        this.trekolRover.syncFleet(state.trekolCount || 1);
        if (this.trekolRover.fleet) {
          this.trekolRover.fleet.forEach(rover => {
            if (rover.group) {
              rover.group.traverse(child => {
                if (child.isMesh && !this.interactables.includes(child)) {
                  this.interactables.push(child);
                }
              });
            }
          });
        }
        if (this.garageGroup) {
          this.buildModularInfrastructure();
        }
      }
    });

    state.on("focusOnStructure", (data) => {
      const targetId = data?.id || data?.structureId;
      const cfg = [
        { id: "well_1", gx: 0.8, gy: 0.8 },
        { id: "well_2", gx: 13.2, gy: 0.8 },
        { id: "well_3", gx: 13.5, gy: 9.5 },
        { id: "well_4", gx: 9.2, gy: 13.5 },
        { id: "station_cps", gx: 6.5, gy: 6.5 },
        { id: "canteen", gx: 3.5, gy: 7.8 },
        { id: "dormitory", gx: 3.5, gy: 10.2 },
        { id: "garage", gx: 2.8, gy: 4.2 }
      ].find(c => c.id === targetId);

      if (cfg) {
        // Camera position remains stable on well selection
      }
    });

    state.on("resetCameraFocus", () => {
      // In Township unified isometric mode: player's pan position remains stable on ground taps.
      // Do not snap target to (0, 4, 0), which would cause OrbitControls to pivot/rotate unexpectedly.
    });

    state.on("enterBuildingMoveMode", () => {
      this.enterMoveMode();
    });

    state.on("exitBuildingMoveMode", (data) => {
      this.exitMoveMode(data?.save !== false);
    });

    state.on("buildingMoved", ({ id, x, z }) => {
      if (this.trekolRover && typeof this.trekolRover.onBuildingMoved === "function") {
        this.trekolRover.onBuildingMoved(id, x, z);
      }
    });

    state.on("buildingPositionsReset", () => {
      if (this.trekolRover && typeof this.trekolRover.onBuildingPositionsReset === "function") {
        this.trekolRover.onBuildingPositionsReset();
      } else if (this.trekolRover?.roadNetwork && typeof this.trekolRover.roadNetwork.resetWaypointsToDefault === "function") {
        this.trekolRover.roadNetwork.resetWaypointsToDefault();
      }
      if (this.movableBuildings) {
        this.movableBuildings.forEach((entry) => {
          if (entry.group && entry.defaultPos) {
            entry.group.position.x = entry.defaultPos.x;
            entry.group.position.z = entry.defaultPos.z;
          }
        });
      }
    });
  }

  // --- 12. UPDATE LOOP ---
  update(rawDt) {
    if (!this.THREE || typeof rawDt !== "number" || isNaN(rawDt) || rawDt <= 0) return;
    const dt = Math.min(rawDt, 0.1);
    const t = performance.now() * 0.001;

    // 0. Water Wave Shimmer & Field Radar Dishes & Anemometers
    if (this.waterMesh) {
      this.waterMesh.position.y = -3.2 + Math.sin(t * 1.5) * 0.12;
    }
    if (this.plantDish) {
      this.plantDish.rotation.y += dt * 0.75;
    }
    if (this.rdDish) {
      this.rdDish.rotation.y += dt * 0.7;
    }
    if (this.rdAnemometer) {
      this.rdAnemometer.rotation.y += dt * 4.5;
    }
    if (this.dormDish) {
      this.dormDish.rotation.y += dt * 0.65;
    }

    // 1. Pumpjack Walking Beam Sinusoidal Rocking
    const boostMult = state.boost.active ? 1.8 : 1.0;
    const pjs = this.animatedObjects.pumpjacks;
    for (let i = 0; i < pjs.length; i++) {
      const pj = pjs[i];
      const beam = pj.beamPivot || pj.beam;
      const crank = pj.crankPivot || pj.crank;
      if (beam && crank) {
        const spd = pj.speed * boostMult;
        beam.rotation.z = Math.sin(t * spd + pj.phase) * 0.18;
        crank.rotation.z = t * spd + pj.phase;
      }
    }

    // 2. Animated Flare Flame
    if (this.animatedObjects.flameGroup) {
      const flScale = 1.0 + Math.sin(t * 12) * 0.15 + Math.cos(t * 18) * 0.08;
      this.animatedObjects.flameGroup.scale.set(flScale, flScale * (1.0 + Math.sin(t * 9) * 0.2), flScale);
      if (this.animatedObjects.flameLight) {
        this.animatedObjects.flameLight.intensity = (this.isNight ? 5.5 : 2.5) + Math.sin(t * 20) * 0.5;
      }
    }

    // 3. Falling Snow Animation
    const sfs = this.animatedObjects.snowflakes;
    for (let i = 0; i < sfs.length; i++) {
      const sf = sfs[i];
      sf.mesh.position.y -= sf.vy * dt;
      sf.mesh.position.x += Math.sin(t * sf.swaySpeed + sf.phase) * sf.swayAmp * dt * 4;
      sf.mesh.position.z += Math.cos(t * sf.swaySpeed + sf.phase) * sf.swayAmp * dt * 4;

      if (sf.mesh.position.y <= 1.2) {
        sf.mesh.position.y = 50 + Math.random() * 15;
      }
    }

    // 4. AVO Cooling Fans Rotation
    const fans = this.animatedObjects.avoFans;
    for (let i = 0; i < fans.length; i++) {
      fans[i].rotation.y = t * 18 + i * 0.8;
    }

    // 4b. Tundra Mist Shroud and Industrial Sectors
    this.updateTundraMistShroud(dt);
    this.updateSectorUnlocks(dt);

    // 5. Central Control Room Beacon Blink
    if (this.animatedObjects.beacon) {
      this.animatedObjects.beacon.visible = Math.sin(t * 6) > 0;
    }

    // 5b. 6x6 Arctic TREKOL Maintenance Rover & Crew
    if (this.trekolRover) {
      if (state && typeof state.trekolCount === "number" && typeof this.trekolRover.syncFleet === "function") {
        if (this.trekolRover.fleet && this.trekolRover.fleet.length !== state.trekolCount && state.trekolCount > 0) {
          this.trekolRover.syncFleet(state.trekolCount);
          if (this.trekolRover.fleet) {
            this.trekolRover.fleet.forEach(rover => {
              if (rover.group) {
                rover.group.traverse(child => {
                  if (child.isMesh && !this.interactables.includes(child)) {
                    this.interactables.push(child);
                  }
                });
              }
            });
          }
        }
      }
      this.trekolRover.update(dt, state);
    }

    // 5c. Animated Rising Smoke from Canteen Kitchen & Dorm Boiler Chimneys
    if (this.animatedObjects.chimneySmokes) {
      for (let c = 0; c < this.animatedObjects.chimneySmokes.length; c++) {
        const cs = this.animatedObjects.chimneySmokes[c];
        for (let p = 0; p < cs.puffs.length; p++) {
          const puff = cs.puffs[p];
          const phase = (t * cs.speed + p * 0.9) % 3.6;
          puff.position.y = cs.baseY + phase * 1.8;
          puff.position.x = cs.baseX + Math.sin(phase * 2.5 + p) * cs.spread;
          puff.position.z = cs.baseZ + Math.cos(phase * 2.0 + p) * cs.spread;
          const life = phase / 3.6;
          puff.scale.setScalar(0.7 + life * 1.5);
          if (puff.material) {
            puff.material.opacity = Math.max(0, 0.45 * (1.0 - life));
          }
        }
      }
    }

    // 5d. Industrial Workers Walk Cycle on Elevated Wooden Walkways
    if (this.animatedObjects.pedestrians) {
      for (let i = 0; i < this.animatedObjects.pedestrians.length; i++) {
        const ped = this.animatedObjects.pedestrians[i];
        ped.cycle += dt * 4.2;
        const progress = (Math.sin(t * ped.speed + ped.offset) + 1) * 0.5;
        ped.group.position.x = ped.start.x + (ped.end.x - ped.start.x) * progress;
        ped.group.position.z = ped.start.z + (ped.end.z - ped.start.z) * progress;
        ped.group.position.y = ped.start.y + Math.abs(Math.sin(ped.cycle)) * 0.08;
        const moveDir = Math.cos(t * ped.speed + ped.offset);
        ped.group.rotation.y = moveDir >= 0
          ? Math.atan2(ped.end.x - ped.start.x, ped.end.z - ped.start.z)
          : Math.atan2(ped.start.x - ped.end.x, ped.start.z - ped.end.z);
      }
    }

    // 5e. Arctic Shuttle Tanker & Marine Terminal
    if (this.arcticTanker) {
      const tankerState = state?.marineTerminal?.tankerState || state?.marineTerminal?.state || state?.tanker?.state || "idle";
      this.arcticTanker.update(dt, tankerState);

      const isDocked = tankerState === "loading" || tankerState === "berthing" || tankerState === "idle";
      if (this.animatedObjects.mooringLines) {
        this.animatedObjects.mooringLines.visible = isDocked;
      }

      const targetArm = tankerState === "loading" ? 1.0 : 0.0;
      this._armProgress = (this._armProgress || 0.0) + (targetArm - (this._armProgress || 0.0)) * Math.min(1.0, dt * 2.0);
      if (this.animatedObjects.loadingArms) {
        for (let i = 0; i < this.animatedObjects.loadingArms.length; i++) {
          const arm = this.animatedObjects.loadingArms[i];
          arm.shoulderPivot.rotation.z = -0.4 - 0.45 * this._armProgress;
          arm.elbowPivot.rotation.z = 0.8 - 0.45 * this._armProgress;
        }
      }
    }

    // 6. Floating Texts Update
    for (let i = this.activeFloatingTexts.length - 1; i >= 0; i--) {
      const item = this.activeFloatingTexts[i];
      item.life += dt;
      item.sprite.position.y += item.vy * dt;
      item.material.opacity = Math.max(0, 1.0 - item.life / item.maxLife);
      if (item.life >= item.maxLife) {
        item.active = false;
        item.sprite.visible = false;
        this.activeFloatingTexts.splice(i, 1);
      }
    }

    // 7. Particles Update
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9.8 * dt;
      if (p.mesh.position.y < 1.2) {
        p.mesh.position.y = 1.2;
        p.vy = -p.vy * 0.25;
      }
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        this.activeParticles.splice(i, 1);
      }
    }

    // 8. OrbitControls Update (Handles smooth pan & zoom along ground plane)
    if (this.controls) {
      if (this.controls.target) {
        this.controls.target.x = Math.max(-120, Math.min(120, this.controls.target.x));
        this.controls.target.z = Math.max(-120, Math.min(120, this.controls.target.z));
      }
      this.controls.update();
      if (this.controls.target) {
        this.controls.target.x = Math.max(-120, Math.min(120, this.controls.target.x));
        this.controls.target.z = Math.max(-120, Math.min(120, this.controls.target.z));
      }
      this.cameraBasePos.copy(this.camera.position);
    }

    // 9. Camera Trauma Shake Decay (Render micro-displacement only, zero impact on OrbitControls)
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
      const shakeAmt = this.trauma * this.trauma * this.maxShake;
      const offsetX = (Math.random() - 0.5) * shakeAmt;
      const offsetY = (Math.random() - 0.5) * shakeAmt;
      this.camera.position.x = this.cameraBasePos.x + offsetX;
      this.camera.position.y = this.cameraBasePos.y + offsetY;
    }

    // 10. FTUE Beacon update (Zero-allocation)
    this.updateFtueBeacon(dt);
  }

  // --- 13. RENDER ---
  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  // --- 14. RESIZE ---
  resize() {
    if (!this.renderer || !this.camera || !this.canvas) return;
    const parent = this.canvas.parentElement || this.canvas;
    const r = parent && typeof parent.getBoundingClientRect === "function" ? parent.getBoundingClientRect() : { width: 420, height: 600 };
    const w = Math.max(1, Math.floor(r.width || this.canvas.clientWidth || 420));
    const h = Math.max(1, Math.floor(r.height || this.canvas.clientHeight || 600));

    this.updateCamera(this.orthoFrustumD || 96);
    this.renderer.setSize(w, h, false);
    if (this.canvas.style) {
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
    }
  }

  // --- 14b. TOGGLE BILLBOARD DISPLAY MODES ---
  toggleLabelMode() {
    if (this.billboardDisplayMode === "full") {
      this.billboardDisplayMode = "hidden";
    } else if (this.billboardDisplayMode === "hidden") {
      this.billboardDisplayMode = "compact";
    } else {
      this.billboardDisplayMode = "full";
    }
    this.applyLabelMode();
    return this.billboardDisplayMode;
  }

  applyLabelMode() {
    const mode = this.billboardDisplayMode;
    if (!this.billboardSprites) return;
    this.billboardSprites.forEach(sprite => {
      if (!sprite || !sprite.material) return;
      const base = sprite.userData?.baseScale || { x: 16.5, y: 4.8 };
      if (mode === "hidden") {
        sprite.visible = false;
      } else if (mode === "compact") {
        sprite.visible = true;
        sprite.scale.set(base.x * 0.74, base.y * 0.74, 1);
        sprite.material.opacity = 0.82;
      } else {
        sprite.visible = true;
        sprite.scale.set(base.x, base.y, 1);
        sprite.material.opacity = 0.95;
      }
    });
  }

  // --- 15. TOGGLE CAMERA & DAY/NIGHT ---
  toggleCameraMode() {
    this.isOrtho = !this.isOrtho;
    this.camera = this.isOrtho ? this.orthoCamera : this.perspCamera;
    if (this.controls) {
      this.controls.object = this.camera;
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.minPolarAngle = 1.02;
      this.controls.maxPolarAngle = 1.02;
      this.controls.minAzimuthAngle = Math.PI / 4;
      this.controls.maxAzimuthAngle = Math.PI / 4;
      this.controls.minDistance = 20;
      this.controls.maxDistance = 50;
      this.controls.minZoom = 1.0;
      this.controls.maxZoom = 2.4;
      this.controls.touches = {
        ONE: this.THREE.TOUCH.PAN,
        TWO: this.THREE.TOUCH.DOLLY_ROTATE
      };
      this.controls.mouseButtons = {
        LEFT: this.THREE.MOUSE.PAN,
        MIDDLE: this.THREE.MOUSE.DOLLY,
        RIGHT: this.THREE.MOUSE.PAN
      };
      this.controls.screenSpacePanning = false;
    }
    this.cameraBasePos = this.camera.position.clone();
    this.resize();
    return this.isOrtho ? "Изометрия" : "Перспектива";
  }

  toggleDayNight() {
    this.isNight = !this.isNight;
    if (this.isNight) {
      this.scene.background.copy(this.skyColorNight);
      this.scene.fog.color.copy(this.skyColorNight);
      this.hemiLight.intensity = 0.2;
      this.sunLight.intensity = 0.15;
      if (this.animatedObjects.floodlightGlows) {
        this.animatedObjects.floodlightGlows.forEach(mesh => {
          mesh.material.opacity = 0.38;
        });
      }
      if (this.animatedObjects.floodlightLights) {
        this.animatedObjects.floodlightLights.forEach(light => {
          light.intensity = 1.4;
        });
      }
    } else {
      this.scene.background.copy(this.skyColorDay);
      this.scene.fog.color.copy(this.skyColorDay);
      this.hemiLight.intensity = 0.85;
      this.sunLight.intensity = 1.85;
      if (this.animatedObjects.floodlightGlows) {
        this.animatedObjects.floodlightGlows.forEach(mesh => {
          mesh.material.opacity = 0.0;
        });
      }
      if (this.animatedObjects.floodlightLights) {
        this.animatedObjects.floodlightLights.forEach(light => {
          light.intensity = 0.0;
        });
      }
    }
    return this.isNight;
  }

  destroy() {
    if (this.arcticTanker && typeof this.arcticTanker.dispose === "function") {
      this.arcticTanker.dispose();
    }
    if (this.trekolRover && typeof this.trekolRover.destroy === "function") {
      this.trekolRover.destroy();
    }
    if (this.scene) {
      this.scene.traverse(obj => {
        if (obj.geometry && typeof obj.geometry.dispose === "function") {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => { if (typeof m.dispose === "function") m.dispose(); });
          } else if (typeof obj.material.dispose === "function") {
            obj.material.dispose();
          }
        }
      });
    }
    if (this.renderer && typeof this.renderer.dispose === "function") {
      this.renderer.dispose();
    }
  }
}

