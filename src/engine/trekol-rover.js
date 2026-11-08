import { audio } from "../audio.js";
import { state } from "../state.js";

/**
 * ROVER_STATES
 * Complete Finite State Machine for Russian Arctic 6x6 TREKOL Maintenance Rover & Crew
 * Includes Checkpoint Protocol and Snowdrift Shoveling Mechanics
 */
export const ROVER_STATES = {
  PATROL_DRIVING: "driving",
  STOP_AND_PARK: "parking",
  CREW_DISEMBARK: "disembark",
  WALK_TO_WELLHEAD: "walk_to_wellhead",
  INSPECT_WELLHEAD: "inspecting",
  WALK_TO_VEHICLE: "walk_to_vehicle",
  CREW_EMBARK: "embark",
  // Checkpoint (КПП) Sequence
  CHECKPOINT_STOP: "checkpoint_stop",
  CHECKPOINT_INSPECT: "checkpoint_inspect",
  CHECKPOINT_CLEAR: "checkpoint_clear",
  // Snowdrift Stuck Mechanic
  STUCK_IN_SNOWDRIFT: "stuck_in_snowdrift"
};

/**
 * Authentic Russian Arctic TREKOL Rover Vehicle Fleet Models
 * 5 visually distinct all-terrain amphibious models unlocked across Garage Levels 1 to 5
 */
export const TREKOL_MODELS = [
  {
    id: 0,
    modelKey: "trekol_39294",
    name: "ТРЭКОЛ 39294 (6х6 Патруль)",
    badge: "ПАТРУЛЬ 6х6",
    wheelCount: 6,
    speed: 13.5,
    colors: { primary: 0xf97316, stripe: 0x1e3a8a, cabin: 0xf8fafc },
    description: "Классический шестиколесный вездеход с утепленным пассажирским кузовом"
  },
  {
    id: 1,
    modelKey: "trekol_39295",
    name: "ТРЭКОЛ 39295 (6х6 Пикап КИПиА)",
    badge: "СЕРВИС 6х6",
    wheelCount: 6,
    speed: 12.8,
    colors: { primary: 0x15803d, stripe: 0xf8fafc, cabin: 0x166534 },
    description: "Сервисный пикап с грузовой платформой, баллонами и инструментами"
  },
  {
    id: 2,
    modelKey: "trekol_39041",
    name: "ТРЭКОЛ 39041 «Хантер» (4х4)",
    badge: "ХАНТЕР 4х4",
    wheelCount: 4,
    speed: 14.8,
    colors: { primary: 0xf8fafc, stripe: 0xdc2626, cabin: 0xf8fafc },
    description: "Компактный скоростной полноприводный 4х4 со шноркелем, люстрой и запаской"
  },
  {
    id: 3,
    modelKey: "trekol_husky",
    name: "ТРЭКОЛ «Хаски» (6х6 Экспедиция)",
    badge: "ХАСКИ 6х6",
    wheelCount: 6,
    speed: 12.5,
    colors: { primary: 0xc8a882, stripe: 0x18181b, cabin: 0xd4b996 },
    description: "Тяжелый арктический вездеход с силовым кенгурятником, лебедкой и канистрами"
  },
  {
    id: 4,
    modelKey: "trekol_mchs",
    name: "ТРЭКОЛ-МЧС (6х6 Спасатель)",
    badge: "МЧС 6х6",
    wheelCount: 6,
    speed: 14.2,
    colors: { primary: 0xffffff, stripe: 0xdc2626, cabin: 0xffffff },
    description: "Аварийно-спасательный вездеход с сине-красной балкой и сиреной"
  }
];

/**
 * Hard building collision bounds preventing TREKOL from cutting through structures & fence
 */
export const BUILDING_OBSTACLES = [
  // Industrial Perimeter Security Fence Walls
  { id: "fence_north", minX: -66.8, maxX: 35.0, minZ: -56.0, maxZ: -52.0 },
  { id: "fence_east", minX: 32.0, maxX: 36.0, minZ: -54.0, maxZ: 48.0 },
  { id: "fence_south", minX: -66.8, maxX: 35.0, minZ: 44.0, maxZ: 48.0 },
  // West Fence split around КПП driveway (pass-through opening between z = -21.5 and z = -10.5)
  { id: "fence_west_south", minX: -66.8, maxX: -65.2, minZ: -10.5, maxZ: 46.0 },
  { id: "fence_west_north", minX: -66.8, maxX: -65.2, minZ: -54.0, maxZ: -21.5 },

  // Base Buildings
  { id: "gatehouse_booth", minX: -70.0, maxX: -58.0, minZ: -28.0, maxZ: -21.5 },
  { id: "plant", minX: -27.0, maxX: 16.5, minZ: -21.0, maxZ: 10.5 },
  { id: "canteen", minX: -43.0, maxX: -30.5, minZ: 4.0, maxZ: 13.0 },
  { id: "dormitory", minX: -43.0, maxX: -30.5, minZ: 29.0, maxZ: 38.0 },
  { id: "garage", minX: -55.0, maxX: -33.0, minZ: -36.0, maxZ: -22.0 },
  { id: "rd_office", minX: -64.0, maxX: -49.0, minZ: 7.0, maxZ: 18.0 },
  { id: "ktpn", minX: 7.0, maxX: 18.0, minZ: -28.0, maxZ: -18.0 },
  { id: "dks", minX: 10.0, maxX: 21.0, minZ: -38.0, maxZ: -29.0 },
  { id: "nts", minX: -28.0, maxX: -18.0, minZ: -48.0, maxZ: -40.0 },
  { id: "mtr", minX: 0.0, maxX: 9.0, minZ: 6.0, maxZ: 15.0 },
  { id: "flare_stack", minX: 47.0, maxX: 58.0, minZ: 42.0, maxZ: 52.0 },

  // Wellhead Cluster Pads
  { id: "well_1_rig", minX: -70.0, maxX: -60.0, minZ: -70.0, maxZ: -60.0 },
  { id: "well_2_rig", minX: 60.0, maxX: 70.0, minZ: -70.0, maxZ: -60.0 },
  { id: "well_3_rig", minX: 63.0, maxX: 71.0, minZ: 21.0, maxZ: 31.0 },
  { id: "well_4_rig", minX: 18.0, maxX: 28.0, minZ: 63.0, maxZ: 71.0 },
  { id: "well_5_rig", minX: -24.0, maxX: -14.0, minZ: -71.5, maxZ: -64.0 },
  { id: "well_6_rig", minX: 66.0, maxX: 71.5, minZ: -20.0, maxZ: -11.5 },

  // Industrial Expansion Processing Sectors & Marine Infrastructure
  { id: "refinery", minX: -142.0, maxX: -94.0, minZ: -6.0, maxZ: 30.0 },
  { id: "gas_plant", minX: 52.0, maxX: 98.0, minZ: -132.0, maxZ: -98.0 },
  { id: "petrochem", minX: 94.0, maxX: 142.0, minZ: -33.0, maxZ: 3.0 },
  { id: "storage_park", minX: -5.0, maxX: 45.0, minZ: 87.0, maxZ: 123.0 },
  { id: "marine_terminal", minX: -52.0, maxX: -28.0, minZ: 108.0, maxZ: 172.0 }
];

export function resolveBuildingCollisions(pos, buffer = 1.8) {
  // Allow free passage through Gatehouse driveway corridor between Garage and outside Zimnik
  if (pos.x >= -76.0 && pos.x <= -40.0 && Math.abs(pos.z - (-15.75)) < 3.8) {
    return;
  }

  // 1. Perimeter Security Fence 4-corner post bumpers (R=2.4m)
  // Prevents rovers from cutting corners or clipping corner posts & wire (Screenshot 2 fix)
  const fenceCorners = [
    { cx: -66.0, cz: 46.0 },   // SW
    { cx: -66.0, cz: -54.0 },  // NW
    { cx: 34.0, cz: 46.0 },    // SE
    { cx: 34.0, cz: -54.0 }    // NE
  ];
  for (let i = 0; i < 4; i++) {
    const c = fenceCorners[i];
    const dx = pos.x - c.cx;
    const dz = pos.z - c.cz;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.4 && dist > 0.01) {
      pos.x = c.cx + (dx / dist) * 2.4;
      pos.z = c.cz + (dz / dist) * 2.4;
    }
  }

  // 2. Iterate standard building, fence walls, and well obstacles
  for (let i = 0; i < BUILDING_OBSTACLES.length; i++) {
    const b = BUILDING_OBSTACLES[i];
    const obsBuf = b.id && b.id.startsWith("fence_") ? 1.2 : buffer;

    const minX = b.minX - obsBuf;
    const maxX = b.maxX + obsBuf;
    const minZ = b.minZ - obsBuf;
    const maxZ = b.maxZ + obsBuf;

    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const dLeft = Math.abs(pos.x - minX);
      const dRight = Math.abs(maxX - pos.x);
      const dTop = Math.abs(pos.z - minZ);
      const dBottom = Math.abs(maxZ - pos.z);
      const minD = Math.min(dLeft, dRight, dTop, dBottom);

      if (minD === dLeft) pos.x = minX;
      else if (minD === dRight) pos.x = maxX;
      else if (minD === dTop) pos.z = minZ;
      else pos.z = maxZ;
    }
  }
}

/**
 * 5 Distinct Realistic Routes for Russian Arctic TREKOL Rover Fleet
 */
export const ROVER_ROUTES = [
  // Маршрут 0: ТРЭКОЛ 39294 (6х6 Патруль) - Северный инспекционный патруль
  [
    "garage",
    "checkpoint_approach",
    "gatehouse",
    "zimnik_outside",
    "junction_north",
    "well_1",
    "well_5",
    "well_2",
    "junction_northeast",
    "gasplant_apron",
    "well_6",
    "petrochem_apron",
    "well_3",
    "junction_south",
    "well_4",
    "storage_apron",
    "marine_apron",
    "junction_southwest",
    "refinery_apron",
    "zimnik_outside",
    "gatehouse",
    "checkpoint_approach"
  ],
  // Маршрут 1: ТРЭКОЛ 39295 (6х6 Пикап КИПиА) - Промышленно-технологический контур
  [
    "garage",
    "checkpoint_approach",
    "gatehouse",
    "zimnik_outside",
    "junction_north",
    "well_1",
    "well_2",
    "junction_northeast",
    "gasplant_apron",
    "well_6",
    "petrochem_apron",
    "well_3",
    "junction_south",
    "well_4",
    "storage_apron",
    "marine_apron",
    "junction_southwest",
    "refinery_apron",
    "zimnik_outside",
    "gatehouse",
    "checkpoint_approach"
  ],
  // Маршрут 2: ТРЭКОЛ 39041 «Хантер» (4х4) - Большой периметральный зимник (Скоростной рейд)
  [
    "zimnik_outside",
    "junction_north",
    "well_1",
    "well_5",
    "well_2",
    "junction_northeast",
    "gasplant_apron",
    "well_6",
    "petrochem_apron",
    "well_3",
    "junction_south",
    "well_4",
    "storage_apron",
    "marine_apron",
    "junction_southwest",
    "refinery_apron",
    "zimnik_outside"
  ],
  // Маршрут 3: ТРЭКОЛ «Хаски» (6х6 Экспедиция) - Экспедиционный маршрут дальних кустов и ГПЗ
  [
    "garage",
    "checkpoint_approach",
    "gatehouse",
    "zimnik_outside",
    "junction_north",
    "well_5",
    "well_2",
    "junction_northeast",
    "gasplant_apron",
    "well_6",
    "petrochem_apron",
    "well_3",
    "junction_south",
    "well_4",
    "storage_apron",
    "marine_apron",
    "junction_southwest",
    "refinery_apron",
    "zimnik_outside",
    "gatehouse",
    "garage"
  ],
  // Маршрут 4: ТРЭКОЛ-МЧС (6х6 Спасатель) - Экстренный маршрут охраны и безопасности промысла
  [
    "gatehouse",
    "campus",
    "station_cps",
    "garage",
    "checkpoint_approach",
    "gatehouse",
    "zimnik_outside",
    "junction_north",
    "well_1",
    "well_5",
    "well_2",
    "junction_northeast",
    "well_6",
    "petrochem_apron",
    "junction_south",
    "marine_apron",
    "junction_southwest",
    "refinery_apron",
    "zimnik_outside",
    "gatehouse"
  ]
];

/**
 * RoadNetwork
 * Waypoint graph connecting central base, garage, checkpoint, and arctic zimniks to well clusters and industrial sectors.
 */
export class RoadNetwork {
  constructor() {
    this.surfaceType = "sand-dusted-snow";
    this.waypoints = [
      { id: "garage", name: "Гараж техники (АТБ)", gx: 2.8, gy: 4.2, x: -44.1, y: 1.42, z: -15.75 },
      { id: "checkpoint_approach", name: "Подъезд к КПП", gx: 1.5, gy: 5.5, x: -58.0, y: 1.42, z: -15.75 },
      { id: "gatehouse", name: "КПП Промысла", gx: 1.0, gy: 5.5, x: -66.0, y: 1.42, z: -15.75 },
      { id: "zimnik_outside", name: "Выезд на зимник", gx: 0.1, gy: 5.5, x: -73.5, y: 1.42, z: -15.75 },
      { id: "junction_north", name: "Северный объезд", gx: 0.1, gy: 0.1, x: -73.5, y: 1.42, z: -73.5 },
      { id: "well_1", name: "Куст №1 «Пионер»", gx: 0.8, gy: 0.8, x: -65.1, y: 1.42, z: -65.1, roadX: -65.1, roadZ: -73.5, wellX: -65.1, wellZ: -65.1 },
      { id: "well_5", name: "Куст №5 «Таёжный»", gx: 5.2, gy: 0.8, x: -18.9, y: 1.42, z: -68.25, roadX: -18.9, roadZ: -73.5, wellX: -18.9, wellZ: -68.25 },
      { id: "well_2", name: "Куст №2 «Северный»", gx: 13.2, gy: 0.8, x: 65.1, y: 1.42, z: -65.1, roadX: 65.1, roadZ: -73.5, wellX: 65.1, wellZ: -65.1 },
      { id: "junction_northeast", name: "Северо-восточный поворот", gx: 13.9, gy: 0.1, x: 73.5, y: 1.42, z: -73.5 },
      { id: "well_6", name: "Куст №6 «Ачимовский»", gx: 13.9, gy: 5.5, x: 71.4, y: 1.42, z: -15.75, roadX: 73.5, roadZ: -15.75, wellX: 71.4, wellZ: -15.75 },
      { id: "well_3", name: "Куст №3 «Полярный»", gx: 13.9, gy: 9.5, x: 68.25, y: 1.42, z: 26.25, roadX: 73.5, roadZ: 26.25, wellX: 68.25, wellZ: 26.25 },
      { id: "junction_south", name: "Южная развилка", gx: 13.9, gy: 13.9, x: 73.5, y: 1.42, z: 73.5 },
      { id: "well_4", name: "Куст №4 «Горизонт»", gx: 9.2, gy: 13.2, x: 23.1, y: 1.42, z: 68.25, roadX: 23.1, roadZ: 73.5, wellX: 23.1, wellZ: 68.25 },
      { id: "junction_southwest", name: "Юго-западный поворот", gx: 0.1, gy: 13.9, x: -73.5, y: 1.42, z: 73.5 },
      { id: "station_cps", name: "Газовый Промысел (ЦПС)", gx: 6.5, gy: 8.4, x: -5.25, y: 1.2, z: 14.7 },
      { id: "campus", name: "Вахтовый поселок", gx: 3.5, gy: 7.8, x: -36.75, y: 1.2, z: 8.40 },

      // Expansion Industrial Sectors Waypoints (Turn-offs along the outer perimeter road)
      { id: "refinery_apron", name: "Подъезд к НПЗ", gx: 0.1, gy: 7.2, x: -73.5, y: 1.42, z: 12.0 },
      { id: "gasplant_apron", name: "Подъезд к ГПЗ", gx: 13.9, gy: 1.5, x: 73.5, y: 1.42, z: -68.0 },
      { id: "petrochem_apron", name: "Подъезд к НХК", gx: 13.9, gy: 6.2, x: 73.5, y: 1.42, z: -12.0 },
      { id: "storage_apron", name: "Подъезд к РВС", gx: 8.8, gy: 13.9, x: 20.0, y: 1.42, z: 73.5 },
      { id: "marine_apron", name: "Морской терминал", gx: 2.2, gy: 13.9, x: -36.0, y: 1.42, z: 73.5 }
    ];

    this.edges = [
      ["garage", "checkpoint_approach"],
      ["checkpoint_approach", "gatehouse"],
      ["gatehouse", "zimnik_outside"],
      ["zimnik_outside", "junction_north"],
      ["junction_north", "well_1"],
      ["well_1", "well_5"],
      ["well_5", "well_2"],
      ["well_2", "junction_northeast"],
      ["junction_northeast", "well_6"],
      ["well_6", "well_3"],
      ["well_3", "junction_south"],
      ["junction_south", "well_4"],
      ["well_4", "junction_southwest"],
      ["junction_southwest", "zimnik_outside"],
      ["zimnik_outside", "gatehouse"],
      ["gatehouse", "garage"],
      // Expansion sector spurs
      ["zimnik_outside", "refinery_apron"],
      ["refinery_apron", "junction_north"],
      ["junction_northeast", "gasplant_apron"],
      ["gasplant_apron", "well_6"],
      ["well_6", "petrochem_apron"],
      ["petrochem_apron", "well_3"],
      ["well_4", "storage_apron"],
      ["storage_apron", "marine_apron"],
      ["marine_apron", "junction_southwest"]
    ];

    this.materialSpecs = {
      baseColor: "#d6dbdf",
      rutColor: "#9ca3af",
      sandGranuleColors: ["#78350f", "#b45309", "#d97706"],
      roughness: 0.92,
      metalness: 0.02
    };
  }

  getWaypoint(id) {
    for (let i = 0; i < this.waypoints.length; i++) {
      if (this.waypoints[i].id === id) return this.waypoints[i];
    }
    return null;
  }

  updateWellWaypoint(wellId, newX, newZ) {
    const wp = this.getWaypoint(wellId);
    if (!wp) return;
    wp.wellX = newX;
    wp.wellZ = newZ;
    const offsetZ = newZ < 0 ? -9.5 : 9.5;
    wp.roadX = newX;
    wp.roadZ = newZ + offsetZ;
    // Keep waypoint outside the fence perimeter buffer if close to perimeter walls
    if (wp.roadX >= -70.0 && wp.roadX <= 38.0 && wp.roadZ >= -58.0 && wp.roadZ <= 50.0) {
      if (newZ >= 0) wp.roadZ = Math.max(wp.roadZ, 52.0);
      else wp.roadZ = Math.min(wp.roadZ, -60.0);
    }
    wp.x = wp.roadX;
    wp.z = wp.roadZ;
  }

  resetWaypointsToDefault() {
    const defaults = {
      well_1: { wellX: -65.1, wellZ: -65.1, roadX: -65.1, roadZ: -73.5 },
      well_2: { wellX: 65.1, wellZ: -65.1, roadX: 65.1, roadZ: -73.5 },
      well_3: { wellX: 68.25, wellZ: 26.25, roadX: 73.5, roadZ: 26.25 },
      well_4: { wellX: 23.1, wellZ: 68.25, roadX: 23.1, roadZ: 73.5 },
      well_5: { wellX: -18.9, wellZ: -68.25, roadX: -18.9, roadZ: -73.5 },
      well_6: { wellX: 71.4, wellZ: -15.75, roadX: 73.5, roadZ: -15.75 }
    };
    for (const [id, coords] of Object.entries(defaults)) {
      const wp = this.getWaypoint(id);
      if (wp) {
        Object.assign(wp, coords);
        wp.x = wp.roadX;
        wp.z = wp.roadZ;
      }
    }
  }
}

/**
 * Builds authentic ultra-low-pressure Arctic balloon wheel (radius 1.25, width 1.10)
 */
export function buildBalloonWheel(THREE, matTire, matTireRim) {
  const wheelGroup = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(1.25, 1.25, 1.10, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, matTire);
  tireMesh.castShadow = true;
  wheelGroup.add(tireMesh);

  const rimGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.12, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, matTireRim);
  wheelGroup.add(rimMesh);

  return wheelGroup;
}

/**
 * Builds Siberian winter maintenance technician figure
 */
export function buildWorkerMesh(THREE, jacketMat, matDarkMetal, matWhite, scene) {
  const figureGroup = new THREE.Group();
  figureGroup.visible = false;

  const torsoGeo = new THREE.CylinderGeometry(0.38, 0.34, 0.95, 8);
  const torsoMesh = new THREE.Mesh(torsoGeo, jacketMat);
  torsoMesh.position.y = 1.35;
  torsoMesh.castShadow = true;
  figureGroup.add(torsoMesh);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.95, 0);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), matDarkMetal);
  headPivot.add(headMesh);
  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), matWhite);
  helmetMesh.position.y = 0.08;
  helmetMesh.scale.set(1, 0.7, 1.1);
  headPivot.add(helmetMesh);
  figureGroup.add(headPivot);

  const legL = new THREE.Group();
  legL.position.set(-0.20, 0.88, 0);
  const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), matDarkMetal);
  legLMesh.position.y = -0.42;
  legL.add(legLMesh);
  figureGroup.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.20, 0.88, 0);
  const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), matDarkMetal);
  legRMesh.position.y = -0.42;
  legR.add(legRMesh);
  figureGroup.add(legR);

  const armL = new THREE.Group();
  armL.position.set(-0.48, 1.75, 0);
  const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.10, 0.75, 6), jacketMat);
  armLMesh.position.y = -0.35;
  armL.add(armLMesh);
  figureGroup.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.48, 1.75, 0);
  const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.10, 0.75, 6), jacketMat);
  armRMesh.position.y = -0.35;
  armR.add(armRMesh);
  figureGroup.add(armR);

  if (scene) scene.add(figureGroup);
  return { group: figureGroup, head: headPivot, legL, legR, armL, armR };
}

/**
 * 3D Model Factory for Russian Arctic TREKOL Rover Fleet (Models 0..4)
 */
export function buildRover3DMesh(THREE, modelId = 0, scene = null) {
  const modelInfo = TREKOL_MODELS[modelId] || TREKOL_MODELS[0];
  const is4x4 = modelInfo.wheelCount === 4;

  const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, metalness: 0.6 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.8 });
  const matTire = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.92, metalness: 0.08 });
  const matTireRim = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.45, metalness: 0.6 });
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 });
  const matOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.1 });
  const matNavyStripe = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4, metalness: 0.1 });
  const matPineGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.38, metalness: 0.1 });
  const matDarkGreen = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.4, metalness: 0.1 });
  const matRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.1 });
  const matSand = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.42, metalness: 0.1 });
  const matAmber = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.8, roughness: 0.2 });
  const matSilverReflect = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x94a3b8, emissiveIntensity: 0.3, roughness: 0.2 });
  const matBlueStrobe = new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x2563eb, emissiveIntensity: 1.8, roughness: 0.2 });
  const matRedStrobe = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8, roughness: 0.2 });
  const matIceBlueLED = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.5, roughness: 0.2 });

  const group = new THREE.Group();
  group.name = `TrekolRover_${modelInfo.modelKey}`;

  // 1. Heavy Chassis (scaled to wheelbase)
  const chassisL = is4x4 ? 4.0 : (modelId === 3 ? 6.2 : 5.8);
  const chassisGeo = new THREE.BoxGeometry(2.3, 0.45, chassisL);
  const chassisMesh = new THREE.Mesh(chassisGeo, matDarkMetal);
  chassisMesh.position.y = 0.65;
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  group.add(chassisMesh);

  // 2. Cabin Group
  const cabinGroup = new THREE.Group();
  cabinGroup.position.y = 1.0;

  let beaconMesh = null;
  let beaconLight = null;
  let strobeL = null;
  let strobeR = null;
  let doorMesh = null;

  if (modelId === 0) {
    // === MODEL 0: ТРЭКОЛ 39294 (6х6 Патруль) ===
    const hullGeo = new THREE.BoxGeometry(2.6, 1.1, 5.6);
    const hullMesh = new THREE.Mesh(hullGeo, matOrange);
    hullMesh.position.y = 0.55;
    hullMesh.castShadow = true;
    cabinGroup.add(hullMesh);

    const stripeGeo = new THREE.BoxGeometry(2.62, 0.25, 5.62);
    const stripeMesh = new THREE.Mesh(stripeGeo, matNavyStripe);
    stripeMesh.position.y = 0.72;
    cabinGroup.add(stripeMesh);

    const cabinGeo = new THREE.BoxGeometry(2.4, 1.35, 3.8);
    const cabinMesh = new THREE.Mesh(cabinGeo, matWhite);
    cabinMesh.position.set(0, 1.65, -0.6);
    cabinMesh.castShadow = true;
    cabinGroup.add(cabinMesh);

    const hoodGeo = new THREE.BoxGeometry(2.4, 0.8, 1.6);
    const hoodMesh = new THREE.Mesh(hoodGeo, matOrange);
    hoodMesh.position.set(0, 1.25, 1.9);
    hoodMesh.rotation.x = -0.22;
    hoodMesh.castShadow = true;
    cabinGroup.add(hoodMesh);

    const windshieldGeo = new THREE.PlaneGeometry(2.2, 0.95);
    const windshieldMesh = new THREE.Mesh(windshieldGeo, matGlass);
    windshieldMesh.position.set(0, 1.85, 1.32);
    windshieldMesh.rotation.x = -0.32;
    cabinGroup.add(windshieldMesh);

    [-1.22, 1.22].forEach(sideX => {
      const sideWinGeo = new THREE.BoxGeometry(0.08, 0.65, 3.2);
      const sideWinMesh = new THREE.Mesh(sideWinGeo, matGlass);
      sideWinMesh.position.set(sideX, 1.75, -0.6);
      cabinGroup.add(sideWinMesh);
    });

    const rackGeo = new THREE.BoxGeometry(2.2, 0.15, 3.4);
    const rackMesh = new THREE.Mesh(rackGeo, matDarkMetal);
    rackMesh.position.set(0, 2.42, -0.6);
    cabinGroup.add(rackMesh);

    const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 12);
    beaconMesh = new THREE.Mesh(beaconGeo, matAmber);
    beaconMesh.position.set(0, 2.65, 0.6);
    cabinGroup.add(beaconMesh);

    beaconLight = new THREE.PointLight(0xf59e0b, 1.2, 14);
    beaconLight.position.set(0, 2.8, 0.6);
    cabinGroup.add(beaconLight);

    const doorGeo = new THREE.BoxGeometry(0.1, 1.5, 1.1);
    doorMesh = new THREE.Mesh(doorGeo, matOrange);
    doorMesh.position.set(1.26, 1.45, -0.2);
    cabinGroup.add(doorMesh);

  } else if (modelId === 1) {
    // === MODEL 1: ТРЭКОЛ 39295 (6х6 Пикап КИПиА) ===
    const hullGeo = new THREE.BoxGeometry(2.6, 1.1, 5.6);
    const hullMesh = new THREE.Mesh(hullGeo, matPineGreen);
    hullMesh.position.y = 0.55;
    hullMesh.castShadow = true;
    cabinGroup.add(hullMesh);

    const stripeGeo = new THREE.BoxGeometry(2.62, 0.22, 5.62);
    const stripeMesh = new THREE.Mesh(stripeGeo, matWhite);
    stripeMesh.position.y = 0.72;
    cabinGroup.add(stripeMesh);

    const cabGeo = new THREE.BoxGeometry(2.4, 1.35, 2.3);
    const cabMesh = new THREE.Mesh(cabGeo, matDarkGreen);
    cabMesh.position.set(0, 1.65, 0.65);
    cabMesh.castShadow = true;
    cabinGroup.add(cabMesh);

    const hoodGeo = new THREE.BoxGeometry(2.4, 0.8, 1.6);
    const hoodMesh = new THREE.Mesh(hoodGeo, matPineGreen);
    hoodMesh.position.set(0, 1.25, 1.9);
    hoodMesh.rotation.x = -0.22;
    hoodMesh.castShadow = true;
    cabinGroup.add(hoodMesh);

    const windshieldGeo = new THREE.PlaneGeometry(2.2, 0.95);
    const windshieldMesh = new THREE.Mesh(windshieldGeo, matGlass);
    windshieldMesh.position.set(0, 1.85, 1.72);
    windshieldMesh.rotation.x = -0.32;
    cabinGroup.add(windshieldMesh);

    [-1.22, 1.22].forEach(sideX => {
      const sideWinGeo = new THREE.BoxGeometry(0.08, 0.65, 1.6);
      const sideWinMesh = new THREE.Mesh(sideWinGeo, matGlass);
      sideWinMesh.position.set(sideX, 1.75, 0.65);
      cabinGroup.add(sideWinMesh);
    });

    const bedFloorGeo = new THREE.BoxGeometry(2.45, 0.35, 3.1);
    const bedFloor = new THREE.Mesh(bedFloorGeo, matDarkMetal);
    bedFloor.position.set(0, 0.95, -1.35);
    cabinGroup.add(bedFloor);

    [-1.25, 1.25].forEach(sideX => {
      const railGeo = new THREE.BoxGeometry(0.12, 0.65, 3.1);
      const railMesh = new THREE.Mesh(railGeo, matPineGreen);
      railMesh.position.set(sideX, 1.35, -1.35);
      cabinGroup.add(railMesh);
    });

    const tailgateGeo = new THREE.BoxGeometry(2.4, 0.65, 0.12);
    const tailgateMesh = new THREE.Mesh(tailgateGeo, matPineGreen);
    tailgateMesh.position.set(0, 1.35, -2.85);
    cabinGroup.add(tailgateMesh);

    const matKhakiCanvas = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.85, metalness: 0.05 });
    const canopyGeo = new THREE.BoxGeometry(2.45, 1.1, 1.2);
    const canopyMesh = new THREE.Mesh(canopyGeo, matKhakiCanvas);
    canopyMesh.position.set(0, 1.8, -0.65);
    canopyMesh.castShadow = true;
    cabinGroup.add(canopyMesh);

    const matBlueCyl = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.3 });
    const matGoldCyl = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.3 });
    const cylGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.3, 8);
    cylGeo.rotateX(Math.PI / 2);

    const cyl1 = new THREE.Mesh(cylGeo, matBlueCyl);
    cyl1.position.set(-0.6, 1.3, -1.8);
    cyl1.castShadow = true;
    cabinGroup.add(cyl1);

    const cyl2 = new THREE.Mesh(cylGeo, matGoldCyl);
    cyl2.position.set(-0.15, 1.3, -1.8);
    cyl2.castShadow = true;
    cabinGroup.add(cyl2);

    const chestGeo = new THREE.BoxGeometry(0.85, 0.5, 0.65);
    const chestMesh = new THREE.Mesh(chestGeo, matSilverReflect);
    chestMesh.position.set(0.6, 1.35, -1.8);
    chestMesh.castShadow = true;
    cabinGroup.add(chestMesh);

    [-0.7, 0.7].forEach(sX => {
      const spotGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.18, 8);
      const spotMesh = new THREE.Mesh(spotGeo, matSilverReflect);
      spotMesh.position.set(sX, 2.38, -0.5);
      spotMesh.rotation.x = Math.PI / 2;
      cabinGroup.add(spotMesh);
    });

    const doorGeo = new THREE.BoxGeometry(0.1, 1.45, 1.1);
    doorMesh = new THREE.Mesh(doorGeo, matPineGreen);
    doorMesh.position.set(1.26, 1.45, 0.65);
    cabinGroup.add(doorMesh);

  } else if (modelId === 2) {
    // === MODEL 2: ТРЭКОЛ 39041 «Хантер» (4х4) ===
    const hullGeo = new THREE.BoxGeometry(2.55, 1.05, 3.8);
    const hullMesh = new THREE.Mesh(hullGeo, matWhite);
    hullMesh.position.y = 0.55;
    hullMesh.castShadow = true;
    cabinGroup.add(hullMesh);

    const stripeGeo = new THREE.BoxGeometry(2.57, 0.22, 3.82);
    const stripeMesh = new THREE.Mesh(stripeGeo, matRed);
    stripeMesh.position.y = 0.72;
    cabinGroup.add(stripeMesh);

    const cabGeo = new THREE.BoxGeometry(2.35, 1.3, 2.6);
    const cabMesh = new THREE.Mesh(cabGeo, matWhite);
    cabMesh.position.set(0, 1.62, -0.2);
    cabMesh.castShadow = true;
    cabinGroup.add(cabMesh);

    const hoodGeo = new THREE.BoxGeometry(2.35, 0.75, 1.3);
    const hoodMesh = new THREE.Mesh(hoodGeo, matWhite);
    hoodMesh.position.set(0, 1.22, 1.35);
    hoodMesh.rotation.x = -0.18;
    hoodMesh.castShadow = true;
    cabinGroup.add(hoodMesh);

    const windshieldGeo = new THREE.PlaneGeometry(2.1, 0.9);
    const windshieldMesh = new THREE.Mesh(windshieldGeo, matGlass);
    windshieldMesh.position.set(0, 1.8, 1.02);
    windshieldMesh.rotation.x = -0.28;
    cabinGroup.add(windshieldMesh);

    [-1.20, 1.20].forEach(sideX => {
      const sideWinGeo = new THREE.BoxGeometry(0.08, 0.6, 2.1);
      const sideWinMesh = new THREE.Mesh(sideWinGeo, matGlass);
      sideWinMesh.position.set(sideX, 1.7, -0.2);
      cabinGroup.add(sideWinMesh);
    });

    const snorkelTube = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.5, 6), matDarkMetal);
    snorkelTube.position.set(1.28, 1.85, 0.95);
    cabinGroup.add(snorkelTube);

    const snorkelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.10, 0.15, 8), matDarkMetal);
    snorkelCap.position.set(1.28, 2.62, 0.95);
    cabinGroup.add(snorkelCap);

    const barHousing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.18), matDarkMetal);
    barHousing.position.set(0, 2.38, 0.7);
    cabinGroup.add(barHousing);

    const barLens = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.08), matIceBlueLED);
    barLens.position.set(0, 2.38, 0.79);
    cabinGroup.add(barLens);

    const spareWheel = buildBalloonWheel(THREE, matTire, matTireRim);
    spareWheel.position.set(0, 1.45, -1.65);
    spareWheel.rotation.x = 0.12;
    cabinGroup.add(spareWheel);

    const doorGeo = new THREE.BoxGeometry(0.1, 1.4, 1.0);
    doorMesh = new THREE.Mesh(doorGeo, matWhite);
    doorMesh.position.set(1.24, 1.45, -0.1);
    cabinGroup.add(doorMesh);

  } else if (modelId === 3) {
    // === MODEL 3: ТРЭКОЛ «Хаски» (6х6 Тяжелая экспедиция) ===
    const hullGeo = new THREE.BoxGeometry(2.65, 1.15, 6.0);
    const hullMesh = new THREE.Mesh(hullGeo, matDarkMetal);
    hullMesh.position.y = 0.55;
    hullMesh.castShadow = true;
    cabinGroup.add(hullMesh);

    const cabGeo = new THREE.BoxGeometry(2.45, 1.4, 4.2);
    const cabMesh = new THREE.Mesh(cabGeo, matSand);
    cabMesh.position.set(0, 1.7, -0.5);
    cabMesh.castShadow = true;
    cabinGroup.add(cabMesh);

    const hoodGeo = new THREE.BoxGeometry(2.45, 0.85, 1.8);
    const hoodMesh = new THREE.Mesh(hoodGeo, matSand);
    hoodMesh.position.set(0, 1.3, 2.05);
    hoodMesh.rotation.x = -0.25;
    hoodMesh.castShadow = true;
    cabinGroup.add(hoodMesh);

    const windshieldGeo = new THREE.PlaneGeometry(2.25, 0.95);
    const windshieldMesh = new THREE.Mesh(windshieldGeo, matGlass);
    windshieldMesh.position.set(0, 1.9, 1.42);
    windshieldMesh.rotation.x = -0.35;
    cabinGroup.add(windshieldMesh);

    [-1.24, 1.24].forEach(sideX => {
      const sideWinGeo = new THREE.BoxGeometry(0.08, 0.65, 3.6);
      const sideWinMesh = new THREE.Mesh(sideWinGeo, matGlass);
      sideWinMesh.position.set(sideX, 1.75, -0.5);
      cabinGroup.add(sideWinMesh);
    });

    const bullbarMesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 0.12), matDarkMetal);
    bullbarMesh.position.set(0, 1.25, 3.05);
    cabinGroup.add(bullbarMesh);

    const winchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 }));
    winchMesh.position.set(0, 0.95, 3.12);
    cabinGroup.add(winchMesh);

    const hookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), matRed);
    hookMesh.position.set(0, 0.88, 3.3);
    cabinGroup.add(hookMesh);

    [-1.36, 1.36].forEach(sideX => {
      const canMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.42), matRed);
      canMesh.position.set(sideX, 1.6, 0.2);
      canMesh.castShadow = true;
      cabinGroup.add(canMesh);
    });

    const safariRack = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.2, 3.8), matDarkMetal);
    safariRack.position.set(0, 2.5, -0.5);
    cabinGroup.add(safariRack);

    [-0.75, -0.25, 0.25, 0.75].forEach(spotX => {
      const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.18, 8), matSilverReflect);
      spot.position.set(spotX, 2.65, 1.3);
      spot.rotation.x = Math.PI / 2;
      cabinGroup.add(spot);
    });

    const doorGeo = new THREE.BoxGeometry(0.1, 1.5, 1.1);
    doorMesh = new THREE.Mesh(doorGeo, matSand);
    doorMesh.position.set(1.26, 1.45, -0.2);
    cabinGroup.add(doorMesh);

  } else if (modelId === 4) {
    // === MODEL 4: ТРЭКОЛ-МЧС (6х6 Спасатель «Север») ===
    const hullGeo = new THREE.BoxGeometry(2.6, 1.1, 5.6);
    const hullMesh = new THREE.Mesh(hullGeo, matWhite);
    hullMesh.position.y = 0.55;
    hullMesh.castShadow = true;
    cabinGroup.add(hullMesh);

    const redStripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.28, 5.62), matRed);
    redStripe.position.y = 0.72;
    cabinGroup.add(redStripe);

    const orangeStripe = new THREE.Mesh(new THREE.BoxGeometry(2.63, 0.12, 5.63), matOrange);
    orangeStripe.position.y = 0.92;
    cabinGroup.add(orangeStripe);

    const cabinGeo = new THREE.BoxGeometry(2.4, 1.35, 3.8);
    const cabinMesh = new THREE.Mesh(cabinGeo, matWhite);
    cabinMesh.position.set(0, 1.65, -0.6);
    cabinMesh.castShadow = true;
    cabinGroup.add(cabinMesh);

    const hoodGeo = new THREE.BoxGeometry(2.4, 0.8, 1.6);
    const hoodMesh = new THREE.Mesh(hoodGeo, matWhite);
    hoodMesh.position.set(0, 1.25, 1.9);
    hoodMesh.rotation.x = -0.22;
    hoodMesh.castShadow = true;
    cabinGroup.add(hoodMesh);

    const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.82, 1.62), matRed);
    hoodStripe.position.set(0, 1.25, 1.9);
    hoodStripe.rotation.x = -0.22;
    cabinGroup.add(hoodStripe);

    const windshieldGeo = new THREE.PlaneGeometry(2.2, 0.95);
    const windshieldMesh = new THREE.Mesh(windshieldGeo, matGlass);
    windshieldMesh.position.set(0, 1.85, 1.32);
    windshieldMesh.rotation.x = -0.32;
    cabinGroup.add(windshieldMesh);

    [-1.22, 1.22].forEach(sideX => {
      const sideWinGeo = new THREE.BoxGeometry(0.08, 0.65, 3.2);
      const sideWinMesh = new THREE.Mesh(sideWinGeo, matGlass);
      sideWinMesh.position.set(sideX, 1.75, -0.6);
      cabinGroup.add(sideWinMesh);
    });

    const strobeBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.3), matDarkMetal);
    strobeBase.position.set(0, 2.45, 0.6);
    cabinGroup.add(strobeBase);

    strobeL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.24), matBlueStrobe);
    strobeL.position.set(-0.4, 2.55, 0.6);
    cabinGroup.add(strobeL);

    strobeR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.24), matRedStrobe);
    strobeR.position.set(0.4, 2.55, 0.6);
    cabinGroup.add(strobeR);

    const sirenTrumpet = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.4, 8), matSilverReflect);
    sirenTrumpet.rotation.x = Math.PI / 2;
    sirenTrumpet.position.set(0, 2.62, 1.1);
    cabinGroup.add(sirenTrumpet);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), matDarkMetal);
    turret.position.set(0.7, 2.58, -0.2);
    cabinGroup.add(turret);

    const doorGeo = new THREE.BoxGeometry(0.1, 1.5, 1.1);
    doorMesh = new THREE.Mesh(doorGeo, matWhite);
    doorMesh.position.set(1.26, 1.45, -0.2);
    cabinGroup.add(doorMesh);
  }

  group.add(cabinGroup);

  // 3. Ultra-Low-Pressure Balloon Wheels
  const wheels = [];
  let frontAxlePivot = null;

  if (is4x4) {
    frontAxlePivot = new THREE.Group();
    frontAxlePivot.position.set(0, 0.65, 1.35);

    const wheelFL = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelFL.position.set(1.45, 0, 0);
    frontAxlePivot.add(wheelFL);
    wheels.push(wheelFL);

    const wheelFR = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelFR.position.set(-1.45, 0, 0);
    frontAxlePivot.add(wheelFR);
    wheels.push(wheelFR);
    group.add(frontAxlePivot);

    const rearAxleGroup = new THREE.Group();
    rearAxleGroup.position.set(0, 0.65, -1.35);

    const wheelRL = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelRL.position.set(1.45, 0, 0);
    rearAxleGroup.add(wheelRL);
    wheels.push(wheelRL);

    const wheelRR = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelRR.position.set(-1.45, 0, 0);
    rearAxleGroup.add(wheelRR);
    wheels.push(wheelRR);
    group.add(rearAxleGroup);

  } else {
    frontAxlePivot = new THREE.Group();
    const frontZ = modelId === 3 ? 2.1 : 1.95;
    const midZ = modelId === 3 ? 0.0 : -0.15;
    const rearZ = modelId === 3 ? -2.1 : -2.15;

    frontAxlePivot.position.set(0, 0.65, frontZ);

    const wheelFL = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelFL.position.set(1.45, 0, 0);
    frontAxlePivot.add(wheelFL);
    wheels.push(wheelFL);

    const wheelFR = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelFR.position.set(-1.45, 0, 0);
    frontAxlePivot.add(wheelFR);
    wheels.push(wheelFR);
    group.add(frontAxlePivot);

    const midAxleGroup = new THREE.Group();
    midAxleGroup.position.set(0, 0.65, midZ);
    const wheelML = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelML.position.set(1.45, 0, 0);
    midAxleGroup.add(wheelML);
    wheels.push(wheelML);

    const wheelMR = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelMR.position.set(-1.45, 0, 0);
    midAxleGroup.add(wheelMR);
    wheels.push(wheelMR);
    group.add(midAxleGroup);

    const rearAxleGroup = new THREE.Group();
    rearAxleGroup.position.set(0, 0.65, rearZ);
    const wheelRL = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelRL.position.set(1.45, 0, 0);
    rearAxleGroup.add(wheelRL);
    wheels.push(wheelRL);

    const wheelRR = buildBalloonWheel(THREE, matTire, matTireRim);
    wheelRR.position.set(-1.45, 0, 0);
    rearAxleGroup.add(wheelRR);
    wheels.push(wheelRR);
    group.add(rearAxleGroup);
  }

  // 4. Operator Crew Figures
  const crewMeshes = [];
  const crewJackets = [
    [matOrange, matNavyStripe],    // Model 0
    [matPineGreen, matDarkGreen], // Model 1
    [matWhite, matRed],           // Model 2
    [matSand, matDarkMetal],      // Model 3
    [matBlueStrobe, matOrange]    // Model 4
  ];
  const mats = crewJackets[modelId] || crewJackets[0];
  crewMeshes.push(buildWorkerMesh(THREE, mats[0], matDarkMetal, matWhite, scene));
  crewMeshes.push(buildWorkerMesh(THREE, mats[1], matDarkMetal, matWhite, scene));

  return {
    group,
    chassisMesh,
    cabinGroup,
    frontAxlePivot,
    wheels,
    beaconMesh,
    beaconLight,
    strobeL,
    strobeR,
    doorMesh,
    crewMeshes,
    modelId,
    wheelCount: is4x4 ? 4 : 6
  };
}

/**
 * TrekolVehicle
 * Individual autonomous rover entity within the Trekol multi-rover fleet.
 */
export class TrekolVehicle {
  constructor(manager, modelId = 1) {
    this.manager = manager;
    this.modelId = modelId;
    this.modelInfo = TREKOL_MODELS[modelId] || TREKOL_MODELS[0];
    this.speed = this.modelInfo.speed || 13.0;
    this.roadNetwork = manager.roadNetwork;
    this.patrolRoute = ROVER_ROUTES[modelId % ROVER_ROUTES.length];

    // Stagger initial waypoint locations along its dedicated route
    this.routeIndex = (modelId * 2) % this.patrolRoute.length;

    const wp = this.roadNetwork.getWaypoint(this.patrolRoute[this.routeIndex]) || this.roadNetwork.waypoints[0];
    this.posX = typeof wp.roadX === "number" ? wp.roadX : wp.x;
    this.posZ = typeof wp.roadZ === "number" ? wp.roadZ : wp.z;
    this.posY = 1.35;
    this.heading = Math.PI / 2;
    this.steerAngle = 0;
    this.wheelRotation = 0;
    this.suspensionRoll = 0;
    this.suspensionPitch = 0;
    this.doorAngle = 0;
    this.tapSquash = 0;
    this.state = ROVER_STATES.PATROL_DRIVING;
    this.stateTimer = 0;
    this.currentClusterId = null;
    this.isStuck = false;
    this.snowShovelProgress = 0;
    this._scratchCollisionPos = { x: 0, z: 0 };

    this.scene = null;
    this.THREE = null;
    this.group = null;
    this.cabinGroup = null;
    this.chassisMesh = null;
    this.frontAxlePivot = null;
    this.wheels = [];
    this.crewMeshes = [];
    this.beaconMesh = null;
    this.beaconLight = null;
    this.strobeL = null;
    this.strobeR = null;

    this.trackPool = [];
    this.trackPoolIdx = 0;
    this.lastTrackPos = { x: this.posX, z: this.posZ };
    this.trackGroup = null;
    this.wheelOffsets = this.modelInfo.wheelCount === 4 ? [-0.92, 0.92] : [-0.95, 0.95];
  }

  init3D(scene, THREE) {
    if (!scene || !THREE || this.group) return;
    this.scene = scene;
    this.THREE = THREE;

    const m = buildRover3DMesh(THREE, this.modelId, scene);
    this.group = m.group;
    this.group.name = `TrekolRover_${this.modelInfo.modelKey}`;
    this.group.position.set(this.posX, this.posY, this.posZ);
    this.chassisMesh = m.chassisMesh;
    this.cabinGroup = m.cabinGroup;
    this.beaconMesh = m.beaconMesh;
    this.beaconLight = m.beaconLight;
    this.strobeL = m.strobeL;
    this.strobeR = m.strobeR;
    this.doorMesh = m.doorMesh;
    this.frontAxlePivot = m.frontAxlePivot;
    this.wheels = m.wheels;
    this.crewMeshes = m.crewMeshes;

    this.group.userData = {
      type: "trekol_rover",
      id: this.modelInfo.modelKey,
      roverInstance: this,
      modelName: this.modelInfo.name,
      modelId: this.modelId
    };
    this.group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData = {
          type: "trekol_rover",
          id: this.modelInfo.modelKey,
          roverInstance: this,
          modelName: this.modelInfo.name,
          modelId: this.modelId
        };
      }
    });

    this.scene.add(this.group);

    // Dynamic tyre tracks pool (40 segments, 3.0s fadeout)
    this.trackGroup = new THREE.Group();
    const trackGeom = new THREE.PlaneGeometry(0.85, 1.6);
    trackGeom.rotateX(-Math.PI / 2);

    for (let i = 0; i < 40; i++) {
      const segMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.95,
        metalness: 0.0,
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      const segGroup = new THREE.Group();
      segGroup.position.set(0, -100, 0);
      segGroup.visible = false;
      const offsets = this.wheelOffsets;
      for (let w = 0; w < offsets.length; w++) {
        const trMesh = new THREE.Mesh(trackGeom, segMat);
        trMesh.position.set(offsets[w], 0, 0);
        segGroup.add(trMesh);
      }
      segGroup.userData = { active: false, age: 0, maxLife: 3.0, mat: segMat };
      this.trackGroup.add(segGroup);
      this.trackPool.push(segGroup);
    }
    this.scene.add(this.trackGroup);
  }

  _simulateStep(dt) {
    if (this.state === ROVER_STATES.PATROL_DRIVING) {
      const targetWpId = this.patrolRoute[this.routeIndex];
      const wp = this.roadNetwork.getWaypoint(targetWpId) || this.roadNetwork.waypoints[0];
      const targetX = typeof wp.roadX === "number" ? wp.roadX : wp.x;
      const targetZ = typeof wp.roadZ === "number" ? wp.roadZ : wp.z;
      const dx = targetX - this.posX;
      const dz = targetZ - this.posZ;
      const dist = Math.hypot(dx, dz);
      const moveDist = this.speed * dt;
      if (dist <= moveDist + 1.5) {
        this.posX = targetX;
        this.posZ = targetZ;
        this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
      } else {
        const angle = Math.atan2(dx, dz);
        this.heading = angle;
        this.posX += Math.sin(angle) * moveDist;
        this.posZ += Math.cos(angle) * moveDist;
      }
    }
  }

  update(rawDt, stateRef, allRovers = []) {
    const dt = Math.min(rawDt || 0.016, 0.1);

    if (!this.scene) {
      this._simulateStep(dt);
      return;
    }

    const t = performance.now() * 0.001;

    // Tap squash relaxation
    if (this.tapSquash > 0) {
      this.tapSquash = Math.max(0, this.tapSquash - dt * 3.5);
      if (this.cabinGroup) {
        const sq = this.tapSquash;
        this.cabinGroup.scale.set(1.0 + sq * 0.18, 1.0 - sq * 0.18, 1.0 + sq * 0.18);
      }
    }

    // Emergency strobes / beacon
    if (this.strobeL && this.strobeR) {
      const strobeCycle = (Math.sin(t * 14.0) > 0);
      this.strobeL.material.emissiveIntensity = strobeCycle ? 2.5 : 0.2;
      this.strobeR.material.emissiveIntensity = strobeCycle ? 0.2 : 2.5;
    } else if (this.beaconLight) {
      this.beaconLight.intensity = (Math.sin(t * 10.0) > 0) ? 1.4 : 0.1;
    }

    // Anti-clumping fleet spacing & lateral right-hand passing lane (Anti-Deadlock)
    let speedMult = 1.0;
    if (allRovers && allRovers.length > 1) {
      for (let i = 0; i < allRovers.length; i++) {
        const other = allRovers[i];
        if (other === this) continue;
        const dx = other.posX - this.posX;
        const dz = other.posZ - this.posZ;
        const dist = Math.hypot(dx, dz);

        if (dist < 9.5) {
          const fwdX = Math.sin(this.heading);
          const fwdZ = Math.cos(this.heading);
          const dot = dx * fwdX + dz * fwdZ;

          // Lateral right-hand traffic evasion: gently nudge right relative to heading
          const rightX = Math.cos(this.heading);
          const rightZ = -Math.sin(this.heading);
          const sideNudge = (1.0 - dist / 9.5) * 1.5 * dt * 4.0;
          this.posX += rightX * sideNudge;
          this.posZ += rightZ * sideNudge;

          // Check relative headings (head-on vs tailgating)
          const otherHeading = typeof other.heading === "number" ? other.heading : 0;
          const otherFwdX = Math.sin(otherHeading);
          const otherFwdZ = Math.cos(otherHeading);
          const headDot = fwdX * otherFwdX + fwdZ * otherFwdZ;

          if (dot > 0) {
            if (headDot < -0.2) {
              // Oncoming head-on traffic: NEVER freeze! Both pass on the right at 65% speed
              speedMult = Math.min(speedMult, 0.65);
            } else {
              // Same direction tailgating: vehicle behind maintains safe distance
              if (dist < 3.2) {
                speedMult = 0.0;
              } else if (dist < 6.5) {
                speedMult = Math.min(speedMult, 0.45);
              }
            }
          }
        }
      }
    }

    // Anti-deadlock watchdog: if vehicle is stopped for > 1.2s, force breakaway
    if (speedMult < 0.1) {
      this._deadlockTimer = (this._deadlockTimer || 0) + dt;
      if (this._deadlockTimer > 1.2) {
        speedMult = 0.65;
        const rightX = Math.cos(this.heading);
        const rightZ = -Math.sin(this.heading);
        this.posX += rightX * 0.9;
        this.posZ += rightZ * 0.9;
        this._deadlockTimer = 0;
      }
    } else {
      this._deadlockTimer = 0;
    }

    switch (this.state) {
      case ROVER_STATES.PATROL_DRIVING: {
        this.waypointWatchdog = (this.waypointWatchdog || 0) + dt;
        if (this.waypointWatchdog > 6.0) {
          this.waypointWatchdog = 0;
          this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
        }

        const targetWpId = this.patrolRoute[this.routeIndex];
        const wp = this.roadNetwork.getWaypoint(targetWpId) || this.roadNetwork.waypoints[0];
        const targetX = typeof wp.roadX === "number" ? wp.roadX : wp.x;
        const targetZ = typeof wp.roadZ === "number" ? wp.roadZ : wp.z;

        const dx = targetX - this.posX;
        const dz = targetZ - this.posZ;
        const dist = Math.hypot(dx, dz);

        const desiredHeading = Math.atan2(dx, dz);
        let deltaHeading = desiredHeading - this.heading;
        while (deltaHeading > Math.PI) deltaHeading -= Math.PI * 2;
        while (deltaHeading < -Math.PI) deltaHeading += Math.PI * 2;

        this.steerAngle = Math.max(-0.45, Math.min(0.45, deltaHeading * 0.85));
        this.heading += this.steerAngle * dt * 4.5;

        const moveDist = this.speed * speedMult * dt;
        this.posX += Math.sin(this.heading) * moveDist;
        this.posZ += Math.cos(this.heading) * moveDist;

        this._scratchCollisionPos.x = this.posX;
        this._scratchCollisionPos.z = this.posZ;
        resolveBuildingCollisions(this._scratchCollisionPos, 2.5);
        this.posX = this._scratchCollisionPos.x;
        this.posZ = this._scratchCollisionPos.z;

        this.wheelRotation += moveDist / 1.25;
        this.suspensionRoll = -this.steerAngle * 0.12;
        this.suspensionPitch = Math.sin(t * 9.5) * 0.025;

        if (dist < 4.2) {
          this.waypointWatchdog = 0;
          if (wp.id.startsWith("well_")) {
            this.state = ROVER_STATES.STOP_AND_PARK;
            this.currentClusterId = wp.id;
            this.stateTimer = 2.2;
          } else {
            this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
          }
        }
        break;
      }

      case ROVER_STATES.STOP_AND_PARK: {
        this.stateTimer -= dt;
        this.steerAngle *= 0.85;
        this.suspensionRoll *= 0.85;
        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.PATROL_DRIVING;
          this.currentClusterId = null;
          this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
        }
        break;
      }
    }

    // Drop tyre tracks
    if (this.trackPool && this.trackPool.length > 0) {
      const trackDist = Math.hypot(this.posX - this.lastTrackPos.x, this.posZ - this.lastTrackPos.z);
      if (trackDist >= 1.4) {
        const seg = this.trackPool[this.trackPoolIdx];
        seg.position.set(this.posX, 1.488, this.posZ);
        seg.rotation.y = this.heading;
        seg.userData.active = true;
        seg.userData.age = 0;
        seg.userData.mat.opacity = 0.85;
        seg.visible = true;
        this.trackPoolIdx = (this.trackPoolIdx + 1) % this.trackPool.length;
        this.lastTrackPos.x = this.posX;
        this.lastTrackPos.z = this.posZ;
      }

      for (let k = 0; k < this.trackPool.length; k++) {
        const seg = this.trackPool[k];
        if (seg.userData && seg.userData.active) {
          seg.userData.age += dt;
          if (seg.userData.age >= seg.userData.maxLife) {
            seg.userData.active = false;
            seg.visible = false;
            seg.userData.mat.opacity = 0;
          } else {
            const lifeRatio = 1.0 - (seg.userData.age / seg.userData.maxLife);
            seg.userData.mat.opacity = Math.max(0, 0.85 * lifeRatio);
          }
        }
      }
    }

    // Apply transforms
    if (this.group) {
      this.group.position.set(this.posX, this.posY, this.posZ);
      this.group.rotation.y = this.heading;
      this.group.rotation.z = this.suspensionRoll;
      this.group.rotation.x = this.suspensionPitch;
    }

    if (this.frontAxlePivot) {
      this.frontAxlePivot.rotation.y = this.steerAngle;
    }

    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].rotation.x = this.wheelRotation;
    }
  }

  handleTap() {
    this.tapSquash = 1.0;
    if (typeof audio?.playHorn === "function") {
      audio.playHorn();
    } else if (typeof audio?.playTap === "function") {
      audio.playTap();
    }
    return { honked: true, model: this.modelInfo.name };
  }

  shovelSnow(amount = 25) {
    if (!this.isStuck) return null;
    this.snowShovelProgress = Math.min(100, (this.snowShovelProgress || 0) + amount);
    this.tapSquash = 1.0;
    if (typeof audio?.playSnowShovel === "function") audio.playSnowShovel();
    if (this.snowShovelProgress >= 100) {
      this.isStuck = false;
      this.state = ROVER_STATES.PATROL_DRIVING;
      if (typeof audio?.playHorn === "function") audio.playHorn();
      return { stuckCleared: true, progress: 100 };
    }
    return { shoveled: true, progress: this.snowShovelProgress };
  }

  serializeState() {
    return {
      modelId: this.modelId,
      posX: this.posX,
      posY: this.posY,
      posZ: this.posZ,
      heading: this.heading,
      routeIndex: this.routeIndex,
      state: this.state,
      stateTimer: this.stateTimer,
      isStuck: this.isStuck
    };
  }

  deserializeState(saved) {
    if (!saved) return;
    if (typeof saved.posX === "number") this.posX = saved.posX;
    if (typeof saved.posY === "number") this.posY = saved.posY;
    if (typeof saved.posZ === "number") this.posZ = saved.posZ;
    if (typeof saved.heading === "number") this.heading = saved.heading;
    if (typeof saved.routeIndex === "number") this.routeIndex = saved.routeIndex;
    if (saved.state) this.state = saved.state;
    if (typeof saved.stateTimer === "number") this.stateTimer = saved.stateTimer;
    this.isStuck = Boolean(saved.isStuck);
  }

  fastForward(elapsedSec) {
    let rem = Math.min(Math.max(0, elapsedSec), 1800);
    while (rem > 0) {
      const step = Math.min(rem, 0.5);
      this._simulateStep(step);
      rem -= step;
    }
  }

  destroy() {
    if (this.trackGroup && this.scene) {
      this.scene.remove(this.trackGroup);
    }
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
  }
}

/**
 * TrekolRoverManager
 * Governs the 6x6 TREKOL amphibious rover kinematics, 3D model, checkpoint inspection ritual, and snowdrift mechanics.
 */
export class TrekolRoverManager {
  static get STATES() {
    return ROVER_STATES;
  }

  constructor(options = {}) {
    const roadNet = (options && options.roadNetwork) || (options instanceof RoadNetwork ? options : new RoadNetwork());
    this.roadNetwork = roadNet;
    this.speed = typeof options.speed === "number" ? options.speed : 13.5;
    this.currentWaypointIndex = 0;
    this.targetWaypointIndex = 1;
    this.state = ROVER_STATES.PATROL_DRIVING;
    this.inspectionTimer = 0;
    this.stateTimer = 0;
    this.currentClusterId = null;

    // Dedicated Arctic Patrol Route (Model 0 - Северный инспекционный маршрут)
    this.patrolRoute = [...ROVER_ROUTES[0]];
    this.routeIndex = 0;

    // Authentic Russian Arctic 6x6 rover specifications
    this.tireSpecs = {
      count: 6,
      radius: 1.25,
      width: 1.10,
      pressureRating: "ultra-low-pressure (0.2 bar)",
      axles: [
        { id: "front", steerable: true, wheels: ["FL", "FR"] },
        { id: "mid", steerable: false, wheels: ["ML", "MR"] },
        { id: "rear", steerable: false, wheels: ["RL", "RR"] }
      ]
    };

    // 2 Maintenance crew members in Arctic gear
    this.crew = [
      { id: "op_1", role: "lead_technician", gear: "arctic_parka_orange", status: "seated" },
      { id: "op_2", role: "manometer_inspector", gear: "arctic_parka_navy", status: "seated" }
    ];

    // Snowdrift Stuck Mechanic Properties
    this.isStuck = false;
    this.snowShovelProgress = 0;
    this.distanceSinceLastStuck = 0;
    this.snowDriftMesh = null;
    this.snowPuffs = [];
    this.stuckBadge = null;

    this.heading = Math.PI / 2;
    this.steerAngle = 0;
    this.wheelRotation = 0;
    this.suspensionRoll = 0;
    this.suspensionPitch = 0;
    this.doorAngle = 0;
    this.beaconFlash = false;
    this.tapSquash = 0;
    this._persistTimer = 0;
    this._scratchCollisionPos = { x: 0, z: 0 };

    // Multi-Rover Arctic Fleet Support (Garage Levels 1..5)
    this.modelId = 0;
    this.modelInfo = TREKOL_MODELS[0];
    this.extraRovers = [];
    this.fleet = [this];

    // Attempt to load saved state from options, state manager, or localStorage for session independence
    let saved = options.savedState;
    if (!saved && typeof state !== "undefined" && state && state.trekolRoverState) {
      saved = state.trekolRoverState;
    }
    if (!saved) {
      try {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem("oil_tycoon_trekol_state_v2");
          if (raw) saved = JSON.parse(raw);
        }
      } catch (e) {}
    }

    if (saved && typeof saved.posX === "number") {
      this.deserializeState(saved);
      const elapsedSec = saved.timestamp ? Math.max(0, (Date.now() - saved.timestamp) / 1000) : 0;
      if (elapsedSec > 0.2) {
        this.fastForward(elapsedSec);
      }
    } else {
      // Clean autonomous start on the Arctic zimnik (lives its life, not locked to exiting checkpoint on reload)
      const startIdx = this.patrolRoute.indexOf("junction_north");
      this.routeIndex = startIdx >= 0 ? startIdx : 4;
      const startWp = this.roadNetwork.getWaypoint(this.patrolRoute[this.routeIndex]) || this.roadNetwork.waypoints[4];
      this.posX = startWp.x;
      this.posY = 1.35;
      this.posZ = startWp.z;
      this.targetX = startWp.x;
      this.targetY = 1.35;
      this.targetZ = startWp.z;
      this.heading = Math.PI / 2; // Facing East along northern winter road
      this.state = ROVER_STATES.PATROL_DRIVING;
    }

    // Synchronize multi-rover fleet count (from options, state, or 1)
    const initFleetCount = typeof options.fleetCount === "number"
      ? options.fleetCount
      : (typeof state !== "undefined" && typeof state?.trekolCount === "number" ? state.trekolCount : 1);
    if (initFleetCount > 1) {
      this.syncFleet(initFleetCount);
    }

    // Dynamic Tyre Tracks Trail Pool
    this.trackPool = [];
    this.trackPoolIdx = 0;
    this.lastTrackPos = { x: this.posX, z: this.posZ };
    this.trackGroup = null;

    // Checkpoint Elements References
    this.gateBarrier = null;
    this.gateLightGreen = null;
    this.gateLightRed = null;
    this.gateLightGreenRear = null;
    this.gateLightRedRear = null;
    this.signalPointLight = null;
    this.checkpointGuardMesh = null;
    this.guardWalkCycle = 0;

    // Crew animation tracking
    this.crewWalkCycle = 0;
    this.crewProgress = 0;
    this.crewPositions = [
      { x: this.posX, y: 1.52, z: this.posZ, heading: 0, visible: false },
      { x: this.posX, y: 1.52, z: this.posZ, heading: 0, visible: false }
    ];
    this.isometricView = options.isometricView || null;
    this.spawn3DFloatingText = options.spawn3DFloatingText || null;

    // Lifecycle listener for window unload
    if (typeof window !== "undefined") {
      this._onUnload = () => this.persist();
      window.addEventListener("beforeunload", this._onUnload);
      window.addEventListener("pagehide", this._onUnload);
    }
  }

  get fleetCount() {
    return this.fleet ? this.fleet.length : 1;
  }

  syncFleet(targetCount) {
    const finalCount = Math.max(1, Math.min(5, Math.floor(Number(targetCount) || 1)));
    while (this.fleet.length < finalCount) {
      const nextModelId = this.fleet.length;
      const newRover = new TrekolVehicle(this, nextModelId);
      this.extraRovers.push(newRover);
      this.fleet.push(newRover);
      if (this.scene && this.THREE) {
        newRover.init3D(this.scene, this.THREE);
      }
    }
    while (this.fleet.length > finalCount && this.extraRovers.length > 0) {
      const removed = this.extraRovers.pop();
      this.fleet.pop();
      if (removed) {
        removed.destroy();
      }
    }
    return this.fleet.length;
  }

  serializeState() {
    return {
      version: 2,
      posX: this.posX,
      posY: this.posY,
      posZ: this.posZ,
      heading: this.heading,
      steerAngle: this.steerAngle,
      routeIndex: this.routeIndex,
      state: this.state,
      stateTimer: this.stateTimer,
      inspectionTimer: this.inspectionTimer,
      currentClusterId: this.currentClusterId,
      isStuck: this.isStuck,
      snowShovelProgress: this.snowShovelProgress,
      timestamp: Date.now(),
      fleet: this.extraRovers ? this.extraRovers.map(r => r.serializeState()) : []
    };
  }

  deserializeState(saved) {
    if (!saved) return;
    if (typeof saved.posX === "number") this.posX = saved.posX;
    if (typeof saved.posY === "number") this.posY = saved.posY;
    if (typeof saved.posZ === "number") this.posZ = saved.posZ;
    if (typeof saved.heading === "number") this.heading = saved.heading;
    if (typeof saved.steerAngle === "number") this.steerAngle = saved.steerAngle;
    if (typeof saved.routeIndex === "number") {
      this.routeIndex = saved.routeIndex % this.patrolRoute.length;
    }
    if (saved.state && Object.values(ROVER_STATES).includes(saved.state)) {
      this.state = saved.state;
    }
    if (typeof saved.stateTimer === "number") this.stateTimer = saved.stateTimer;
    if (typeof saved.inspectionTimer === "number") this.inspectionTimer = saved.inspectionTimer;
    this.currentClusterId = saved.currentClusterId || null;
    this.isStuck = Boolean(saved.isStuck);
    this.snowShovelProgress = saved.snowShovelProgress || 0;

    if (saved && Array.isArray(saved.fleet)) {
      if (this.fleet.length < saved.fleet.length + 1) {
        this.syncFleet(saved.fleet.length + 1);
      }
      for (let i = 0; i < saved.fleet.length; i++) {
        if (this.extraRovers[i]) {
          this.extraRovers[i].deserializeState(saved.fleet[i]);
        }
      }
    }
  }

  persist(stateRef) {
    const data = this.serializeState();
    const targetState = stateRef || (typeof state !== "undefined" ? state : null);
    if (targetState) {
      targetState.trekolRoverState = data;
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("oil_tycoon_trekol_state_v2", JSON.stringify(data));
      }
    } catch (e) {}
  }

  onBuildingMoved(id, x, z) {
    if (typeof id !== "string") return;
    if (id.startsWith("well_")) {
      this.roadNetwork.updateWellWaypoint(id, x, z);
      const obs = BUILDING_OBSTACLES.find(o => o.id === `${id}_rig`);
      if (obs) {
        const halfW = (obs.maxX - obs.minX) / 2 || 5.0;
        const halfD = (obs.maxZ - obs.minZ) / 2 || 5.0;
        obs.minX = x - halfW;
        obs.maxX = x + halfW;
        obs.minZ = z - halfD;
        obs.maxZ = z + halfD;
      }
    } else if (id === "garage") {
      const wp = this.roadNetwork.getWaypoint("garage");
      if (wp) {
        wp.x = x;
        wp.z = z;
        wp.roadX = x;
        wp.roadZ = z;
      }
      const obs = BUILDING_OBSTACLES.find(o => o.id === "garage");
      if (obs) {
        const halfW = (obs.maxX - obs.minX) / 2 || 11.0;
        const halfD = (obs.maxZ - obs.minZ) / 2 || 7.0;
        obs.minX = x - halfW;
        obs.maxX = x + halfW;
        obs.minZ = z - halfD;
        obs.maxZ = z + halfD;
      }
    }
  }

  onBuildingPositionsReset() {
    this.roadNetwork.resetWaypointsToDefault();
    const defaultObstacles = {
      well_1_rig: { minX: -70.0, maxX: -60.0, minZ: -70.0, maxZ: -60.0 },
      well_2_rig: { minX: 60.0, maxX: 70.0, minZ: -70.0, maxZ: -60.0 },
      well_3_rig: { minX: 63.0, maxX: 71.0, minZ: 21.0, maxZ: 31.0 },
      well_4_rig: { minX: 18.0, maxX: 28.0, minZ: 63.0, maxZ: 71.0 },
      well_5_rig: { minX: -24.0, maxX: -14.0, minZ: -71.5, maxZ: -64.0 },
      well_6_rig: { minX: 66.0, maxX: 71.5, minZ: -20.0, maxZ: -11.5 },
      garage: { minX: -55.0, maxX: -33.0, minZ: -36.0, maxZ: -22.0 }
    };
    for (const [obsId, bounds] of Object.entries(defaultObstacles)) {
      const obs = BUILDING_OBSTACLES.find(o => o.id === obsId);
      if (obs) {
        Object.assign(obs, bounds);
      }
    }
  }

  fastForward(elapsedSec) {
    const totalTime = Math.min(Math.max(0, elapsedSec), 1800);
    if (totalTime <= 0) return;

    if (this.isStuck && totalTime > 45) {
      this.isStuck = false;
      this.state = ROVER_STATES.PATROL_DRIVING;
      this.snowShovelProgress = 0;
    }

    let remaining = totalTime;
    const dt = 0.5;
    while (remaining > 0) {
      const step = Math.min(remaining, dt);
      this._simulateStep(step);
      if (this.extraRovers) {
        for (let i = 0; i < this.extraRovers.length; i++) {
          this.extraRovers[i]._simulateStep(step);
        }
      }
      remaining -= step;
    }
  }

  _simulateStep(dt) {
    switch (this.state) {
      case ROVER_STATES.PATROL_DRIVING: {
        const targetWpId = this.patrolRoute[this.routeIndex];
        const wp = this.roadNetwork.getWaypoint(targetWpId) || this.roadNetwork.waypoints[0];
        const targetX = typeof wp.roadX === "number" ? wp.roadX : wp.x;
        const targetZ = typeof wp.roadZ === "number" ? wp.roadZ : wp.z;
        const dx = targetX - this.posX;
        const dz = targetZ - this.posZ;
        const dist = Math.hypot(dx, dz);
        const moveDist = this.speed * dt;

        if (dist <= moveDist + 1.5) {
          this.posX = targetX;
          this.posZ = targetZ;
          if (wp.id === "checkpoint_approach") {
            this.state = ROVER_STATES.CHECKPOINT_STOP;
            this.stateTimer = 1.0;
          } else if (wp.id.startsWith("well_")) {
            this.state = ROVER_STATES.STOP_AND_PARK;
            this.currentClusterId = wp.id;
            this.stateTimer = 1.2;
          } else if (wp.id === "garage") {
            this.state = ROVER_STATES.STOP_AND_PARK;
            this.currentClusterId = null;
            this.stateTimer = 3.5;
          } else {
            this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
          }
        } else {
          this.heading = Math.atan2(dx, dz);
          this.posX += Math.sin(this.heading) * moveDist;
          this.posZ += Math.cos(this.heading) * moveDist;
        }
        break;
      }
      case ROVER_STATES.CHECKPOINT_STOP: {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.CHECKPOINT_INSPECT;
          this.stateTimer = 2.8;
        }
        break;
      }
      case ROVER_STATES.CHECKPOINT_INSPECT: {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.CHECKPOINT_CLEAR;
          this.stateTimer = 2.6;
        }
        break;
      }
      case ROVER_STATES.CHECKPOINT_CLEAR: {
        this.stateTimer -= dt;
        const moveDist = this.speed * 0.75 * dt;
        this.posX -= moveDist;
        this.posZ = -15.75;
        this.heading = -Math.PI / 2;
        if (this.posX <= -73.5 || this.stateTimer <= -2.5) {
          this.posX = -73.5;
          this.posZ = -15.75;
          this.state = ROVER_STATES.PATROL_DRIVING;
          const northIdx = this.patrolRoute.indexOf("junction_north");
          this.routeIndex = northIdx >= 0 ? northIdx : 4;
        }
        break;
      }
      case ROVER_STATES.STUCK_IN_SNOWDRIFT: {
        this.snowShovelProgress = Math.min(100, (this.snowShovelProgress || 0) + dt * 25.0);
        if (this.snowShovelProgress >= 100) {
          this.isStuck = false;
          this.state = ROVER_STATES.PATROL_DRIVING;
        }
        break;
      }
      case ROVER_STATES.STOP_AND_PARK: {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (this.currentClusterId) {
            this.state = ROVER_STATES.CREW_DISEMBARK;
            this.stateTimer = 1.0;
          } else {
            this.state = ROVER_STATES.PATROL_DRIVING;
            this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
          }
        }
        break;
      }
      case ROVER_STATES.CREW_DISEMBARK: {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.WALK_TO_WELLHEAD;
          this.stateTimer = 3.0;
        }
        break;
      }
      case ROVER_STATES.WALK_TO_WELLHEAD: {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.INSPECT_WELLHEAD;
          this.inspectionTimer = 4.5;
        }
        break;
      }
      case ROVER_STATES.INSPECT_WELLHEAD: {
        this.inspectionTimer -= dt;
        if (this.inspectionTimer <= 0) {
          this.state = ROVER_STATES.WALK_TO_VEHICLE;
          this.stateTimer = 3.0;
        }
        break;
      }
      case ROVER_STATES.WALK_TO_VEHICLE: {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.CREW_EMBARK;
          this.stateTimer = 1.0;
        }
        break;
      }
      case ROVER_STATES.CREW_EMBARK: {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.PATROL_DRIVING;
          this.currentClusterId = null;
          this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
        }
        break;
      }
      case ROVER_STATES.STUCK_IN_SNOWDRIFT: {
        break;
      }
    }
  }

  destroy() {
    this.persist();
    if (typeof window !== "undefined" && this._onUnload) {
      window.removeEventListener("beforeunload", this._onUnload);
      window.removeEventListener("pagehide", this._onUnload);
    }
    if (this.extraRovers) {
      for (let i = 0; i < this.extraRovers.length; i++) {
        this.extraRovers[i].destroy();
      }
    }
    if (this.trackGroup && this.scene) {
      this.scene.remove(this.trackGroup);
    }
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
    if (this.checkpointGuardMesh?.group && this.scene) {
      this.scene.remove(this.checkpointGuardMesh.group);
    }
    for (let i = 0; i < this.crewMeshes.length; i++) {
      if (this.crewMeshes[i]?.group && this.scene) {
        this.scene.remove(this.crewMeshes[i].group);
      }
    }
  }

  /**
   * Initializes 3D Three.js model hierarchy
   */
  init3D(scene, THREE) {
    if (!scene || !THREE) return;
    this.scene = scene;
    this.THREE = THREE;

    this._scratchVecA = new THREE.Vector3();
    this._scratchVecB = new THREE.Vector3();
    this._scratchTarget = new THREE.Vector3();

    const matSnow = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.88, metalness: 0.02 });

    // 1. Build Model 0 (ТРЭКОЛ 39294 6х6 Патруль)
    const m0 = buildRover3DMesh(THREE, 0, scene);
    this.group = m0.group;
    this.group.name = "TrekolRover";
    this.group.position.set(this.posX, this.posY, this.posZ);
    this.chassisMesh = m0.chassisMesh;
    this.cabinGroup = m0.cabinGroup;
    this.beaconMesh = m0.beaconMesh;
    this.beaconLight = m0.beaconLight;
    this.doorMesh = m0.doorMesh;
    this.frontAxlePivot = m0.frontAxlePivot;
    this.wheels = m0.wheels;
    this.crewMeshes = m0.crewMeshes;

    // 5. Snowdrift Stuck Mesh (3D mound wrapping front wheels when stuck)
    const driftGroup = new THREE.Group();
    driftGroup.visible = false;

    const driftMound = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), matSnow);
    driftMound.scale.set(1.4, 0.5, 1.2);
    driftMound.position.set(0, 0.45, 1.8);
    driftGroup.add(driftMound);

    // Snow puff particles around wheels
    this.snowPuffs = [];
    for (let p = 0; p < 8; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 + p * 0.04, 6, 6), matSnow);
      puff.position.set((Math.random() - 0.5) * 3.2, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 3.5);
      puff.visible = false;
      driftGroup.add(puff);
      this.snowPuffs.push(puff);
    }
    this.group.add(driftGroup);
    this.snowDriftMesh = driftGroup;

    // Add Rover to Scene
    this.scene.add(this.group);

    // Pre-allocated Dynamic 6x6 Tyre Track Trail Pool (Реальные остающиеся следы от шин Трэкола на снегу)
    this.trackPool = [];
    this.trackPoolIdx = 0;
    this.lastTrackPos = { x: this.posX, z: this.posZ };
    this.trackGroup = new THREE.Group();
    this.trackGroup.name = "TrekolDynamicTyreTracks";

    const baseTrackMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // dark tire tread imprint in snow
      roughness: 0.95,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      transparent: true,
      opacity: 0.85
    });

    const trackGeom = new THREE.PlaneGeometry(0.85, 1.6);

    for (let k = 0; k < 80; k++) {
      const segGroup = new THREE.Group();
      segGroup.visible = false;
      const segMat = baseTrackMat.clone();
      [-0.95, 0.95].forEach(ox => {
        const trMesh = new THREE.Mesh(trackGeom, segMat);
        trMesh.rotation.x = -Math.PI / 2;
        trMesh.position.set(ox, 0, 0);
        trMesh.receiveShadow = true;
        segGroup.add(trMesh);
      });
      segGroup.position.set(0, 1.488, 0);
      segGroup.userData = {
        active: false,
        age: 0,
        maxLife: 3.0,
        mat: segMat
      };
      this.trackGroup.add(segGroup);
      this.trackPool.push(segGroup);
    }
    this.scene.add(this.trackGroup);
  }

  /**
   * Links Checkpoint 3D elements (Gatehouse barrier, traffic lights, security guard)
   */
  initCheckpoint({ barrierPivot, lightGreen, lightRed, lightGreenRear, lightRedRear, gateGroup, signalLight }) {
    this.gateBarrier = barrierPivot;
    this.gateLightGreen = lightGreen;
    this.gateLightRed = lightRed;
    this.gateLightGreenRear = lightGreenRear;
    this.gateLightRedRear = lightRedRear;
    this.signalPointLight = signalLight;

    if (this.scene && this.THREE && !this.checkpointGuardMesh) {
      const THREE = this.THREE;
      const matGuardJacket = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.1 });
      const matVest = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.1 });
      const matDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
      const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 });
      const matClipboard = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, metalness: 0.1 });

      const guard = new THREE.Group();
      guard.visible = true;
      guard.position.set(-63.5, 1.42, -21.0);

      // Torso in Arctic Guard Uniform
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.95, 8), matGuardJacket);
      torso.position.y = 1.35;
      guard.add(torso);

      // High-Vis Safety Vest
      const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.33, 0.55, 8), matVest);
      vest.position.y = 1.35;
      guard.add(vest);

      // Head & White Security Hardhat
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 1.95, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), matDark);
      headPivot.add(head);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), matWhite);
      helmet.position.y = 0.08;
      helmet.scale.set(1, 0.7, 1.1);
      headPivot.add(helmet);
      guard.add(headPivot);

      // Legs
      const legL = new THREE.Group();
      legL.position.set(-0.20, 0.88, 0);
      const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), matDark);
      legLMesh.position.y = -0.42;
      legL.add(legLMesh);
      guard.add(legL);

      const legR = new THREE.Group();
      legR.position.set(0.20, 0.88, 0);
      const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), matDark);
      legRMesh.position.y = -0.42;
      legR.add(legRMesh);
      guard.add(legR);

      // Arms
      const armL = new THREE.Group();
      armL.position.set(-0.48, 1.75, 0);
      const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.10, 0.75, 6), matGuardJacket);
      armLMesh.position.y = -0.35;
      armL.add(armLMesh);
      guard.add(armL);

      const armR = new THREE.Group();
      armR.position.set(0.48, 1.75, 0);
      const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.10, 0.75, 6), matGuardJacket);
      armRMesh.position.y = -0.35;
      armR.add(armRMesh);

      // Inspection Clipboard / Tablet
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.04), matClipboard);
      clip.position.set(0, -0.65, 0.2);
      clip.rotation.x = -0.4;
      armR.add(clip);
      guard.add(armR);

      this.scene.add(guard);
      this.checkpointGuardMesh = { group: guard, head: headPivot, legL, legR, armL, armR };
    }

    // Initialize 3D models for all active extra fleet rovers
    if (this.extraRovers) {
      for (let i = 0; i < this.extraRovers.length; i++) {
        this.extraRovers[i].init3D(this.scene, this.THREE);
      }
    }
  }

  setCheckpointSignal(isGreen) {
    const redColor = isGreen ? 0x200505 : 0xef4444;
    const redIntensity = isGreen ? 0.1 : 3.2;
    const greenColor = isGreen ? 0x22c55e : 0x052e16;
    const greenIntensity = isGreen ? 3.2 : 0.1;
    const lightColor = isGreen ? 0x22c55e : 0xef4444;

    if (this.gateLightRed) {
      this.gateLightRed.material.color.setHex(redColor);
      this.gateLightRed.material.emissive.setHex(redColor);
      this.gateLightRed.material.emissiveIntensity = redIntensity;
    }
    if (this.gateLightRedRear) {
      this.gateLightRedRear.material.color.setHex(redColor);
      this.gateLightRedRear.material.emissive.setHex(redColor);
      this.gateLightRedRear.material.emissiveIntensity = redIntensity;
    }
    if (this.gateLightGreen) {
      this.gateLightGreen.material.color.setHex(greenColor);
      this.gateLightGreen.material.emissive.setHex(greenColor);
      this.gateLightGreen.material.emissiveIntensity = greenIntensity;
    }
    if (this.gateLightGreenRear) {
      this.gateLightGreenRear.material.color.setHex(greenColor);
      this.gateLightGreenRear.material.emissive.setHex(greenColor);
      this.gateLightGreenRear.material.emissiveIntensity = greenIntensity;
    }
    if (this.signalPointLight) {
      this.signalPointLight.color.setHex(lightColor);
      this.signalPointLight.intensity = 3.0;
    }
  }

  /**
   * Main per-frame update loop.
   * Strictly zero allocations per frame (Zero-GC compliant).
   */
  update(rawDt, stateRef) {
    const dt = Math.min(rawDt || 0.016, 0.1);
    const initialMoney = stateRef ? stateRef.money : 0;

    // Handle Tap Squash & Stretch Juice Relaxation
    if (this.tapSquash > 0) {
      this.tapSquash = Math.max(0, this.tapSquash - dt * 3.5);
      if (this.cabinGroup) {
        const sq = this.tapSquash;
        this.cabinGroup.scale.set(1.0 + sq * 0.18, 1.0 - sq * 0.18, 1.0 + sq * 0.18);
      }
    }

    if (!this.scene) {
      this._updateHeadless(dt);
      if (this.extraRovers) {
        for (let i = 0; i < this.extraRovers.length; i++) {
          this.extraRovers[i]._simulateStep(dt);
        }
      }
    } else {
      this._update3D(dt);
      if (this.extraRovers) {
        for (let i = 0; i < this.extraRovers.length; i++) {
          this.extraRovers[i].update(dt, stateRef, this.fleet);
        }
      }
    }

    if (stateRef && stateRef.money !== initialMoney) {
      throw new Error("TrekolRoverManager mutated state.money! Invariant violated.");
    }
  }

  _updateHeadless(dt) {
    this._simulateStep(dt);
  }

  _update3D(dt) {
    const t = performance.now() * 0.001;

    // Periodic persist of rover position & state (Zero-GC compliant)
    this._persistTimer = (this._persistTimer || 0) + dt;
    if (this._persistTimer >= 2.0) {
      this._persistTimer = 0;
      this.persist();
    }

    // Beacon Flashing
    this.beaconFlash = Math.sin(t * 10) > 0;
    if (this.beaconLight) {
      this.beaconLight.intensity = this.beaconFlash ? 1.6 : 0.05;
    }

    switch (this.state) {
      // 1. PATROL DRIVING ALONG ARCTIC ROAD NETWORK
      case ROVER_STATES.PATROL_DRIVING: {
        this.waypointWatchdog = (this.waypointWatchdog || 0) + dt;
        if (this.waypointWatchdog > 7.0) {
          this.waypointWatchdog = 0;
          this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
        }

        const targetWpId = this.patrolRoute[this.routeIndex];
        const wp = this.roadNetwork.getWaypoint(targetWpId) || this.roadNetwork.waypoints[0];
        const targetX = typeof wp.roadX === "number" ? wp.roadX : wp.x;
        const targetZ = typeof wp.roadZ === "number" ? wp.roadZ : wp.z;

        const dx = targetX - this.posX;
        const dz = targetZ - this.posZ;
        const dist = Math.hypot(dx, dz);

        // Turn heading toward target waypoint
        const desiredHeading = Math.atan2(dx, dz);
        let deltaHeading = desiredHeading - this.heading;
        while (deltaHeading > Math.PI) deltaHeading -= Math.PI * 2;
        while (deltaHeading < -Math.PI) deltaHeading += Math.PI * 2;

        this.steerAngle = Math.max(-0.45, Math.min(0.45, deltaHeading * 0.85));
        this.heading += this.steerAngle * dt * 4.5;

        // Advance position along heading with fleet spacing & lateral evasion (Anti-Deadlock)
        let speedMult = 1.0;
        const fleetList = this.fleet || this.extraRovers;
        if (fleetList && fleetList.length > 0) {
          for (let i = 0; i < fleetList.length; i++) {
            const other = fleetList[i];
            if (other === this) continue;
            const dx = other.posX - this.posX;
            const dz = other.posZ - this.posZ;
            const dist = Math.hypot(dx, dz);

            if (dist < 9.5) {
              const fwdX = Math.sin(this.heading);
              const fwdZ = Math.cos(this.heading);
              const dot = dx * fwdX + dz * fwdZ;

              // Lateral right-hand traffic evasion: gently nudge right relative to heading
              const rightX = Math.cos(this.heading);
              const rightZ = -Math.sin(this.heading);
              const sideNudge = (1.0 - dist / 9.5) * 1.5 * dt * 4.0;
              this.posX += rightX * sideNudge;
              this.posZ += rightZ * sideNudge;

              // Check relative headings (head-on vs tailgating)
              const otherHeading = typeof other.heading === "number" ? other.heading : 0;
              const otherFwdX = Math.sin(otherHeading);
              const otherFwdZ = Math.cos(otherHeading);
              const headDot = fwdX * otherFwdX + fwdZ * otherFwdZ;

              if (dot > 0) {
                if (headDot < -0.2) {
                  // Oncoming head-on traffic: NEVER freeze! Both pass on the right at 65% speed
                  speedMult = Math.min(speedMult, 0.65);
                } else {
                  // Same direction tailgating: vehicle behind maintains safe distance
                  if (dist < 3.2) {
                    speedMult = 0.0;
                  } else if (dist < 6.5) {
                    speedMult = Math.min(speedMult, 0.45);
                  }
                }
              }
            }
          }
        }

        // Anti-deadlock watchdog: if vehicle is stopped for > 1.2s, force breakaway
        if (speedMult < 0.1) {
          this._deadlockTimer = (this._deadlockTimer || 0) + dt;
          if (this._deadlockTimer > 1.2) {
            speedMult = 0.65;
            const rightX = Math.cos(this.heading);
            const rightZ = -Math.sin(this.heading);
            this.posX += rightX * 0.9;
            this.posZ += rightZ * 0.9;
            this._deadlockTimer = 0;
          }
        } else {
          this._deadlockTimer = 0;
        }

        const moveDist = this.speed * speedMult * dt;
        this.posX += Math.sin(this.heading) * moveDist;
        this.posZ += Math.cos(this.heading) * moveDist;

        // Hard obstacle collision avoidance (Zero-GC pre-allocated scratch)
        this._scratchCollisionPos.x = this.posX;
        this._scratchCollisionPos.z = this.posZ;
        resolveBuildingCollisions(this._scratchCollisionPos, 2.5);
        this.posX = this._scratchCollisionPos.x;
        this.posZ = this._scratchCollisionPos.z;

        // Inbound gate passage: lift barrier when approaching gatehouse from outside zimnik
        if (targetWpId === "gatehouse" && dist < 8.0) {
          this.setCheckpointSignal(true);
          if (this.gateBarrier) this.gateBarrier.rotation.z = Math.min(1.48, this.gateBarrier.rotation.z + dt * 2.5);
        } else if (targetWpId === "garage" && this.posX >= -60.0) {
          if (this.gateBarrier) this.gateBarrier.rotation.z = Math.max(0, this.gateBarrier.rotation.z - dt * 2.0);
          this.setCheckpointSignal(false);
        }

        // Wheel Rotation
        const deltaRot = moveDist / 1.25;
        this.wheelRotation += deltaRot;

        this.suspensionRoll = -this.steerAngle * 0.12;
        this.suspensionPitch = Math.sin(t * 9.5) * 0.025;

        // Random/Timed Snowdrift Stuck Trigger on Tundra Road
        this.distanceSinceLastStuck += moveDist;
        if (this.distanceSinceLastStuck > 750 && targetWpId === "junction_north") {
          this.distanceSinceLastStuck = 0;
          this.state = ROVER_STATES.STUCK_IN_SNOWDRIFT;
          this.isStuck = true;
          this.snowShovelProgress = 0;
          if (this.snowDriftMesh) {
            this.snowDriftMesh.visible = true;
            this.snowDriftMesh.scale.set(1, 1, 1);
          }
          break;
        }

        // Check arrival at waypoint
        if (dist < 4.2) {
          this.waypointWatchdog = 0;

          if (wp.id === "checkpoint_approach") {
            // Arrived at Checkpoint stop line!
            this.state = ROVER_STATES.CHECKPOINT_STOP;
            this.stateTimer = 1.0;
            if (typeof audio?.playBrakeHiss === "function") {
              audio.playBrakeHiss();
            }
          } else if (wp.id.startsWith("well_")) {
            // Arrived at Well Cluster!
            this.state = ROVER_STATES.STOP_AND_PARK;
            this.currentClusterId = wp.id;
            this.stateTimer = 1.2;
            if (typeof audio?.playBrakeHiss === "function") {
              audio.playBrakeHiss();
            }
          } else if (wp.id === "garage") {
            // Arrived back at Garage ATB!
            this.state = ROVER_STATES.STOP_AND_PARK;
            this.currentClusterId = null;
            this.stateTimer = 3.5;
            if (typeof audio?.playBrakeHiss === "function") {
              audio.playBrakeHiss();
            }
          } else {
            this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
          }
        }
        break;
      }

      // 2. CHECKPOINT STOP (Stops before barrier at red light)
      case ROVER_STATES.CHECKPOINT_STOP: {
        this.stateTimer -= dt;
        this.steerAngle *= 0.8;
        this.suspensionRoll *= 0.8;
        this.posZ = -15.75; // Locked strictly to driveway center

        this.setCheckpointSignal(false); // Bright RED traffic light
        if (this.gateBarrier) this.gateBarrier.rotation.z = Math.max(0, this.gateBarrier.rotation.z - dt * 2.0);

        if (this.checkpointGuardMesh) {
          this.checkpointGuardMesh.group.visible = true;
          this.checkpointGuardMesh.group.position.set(-63.5, 1.42, -21.0);
        }

        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.CHECKPOINT_INSPECT;
          this.stateTimer = 2.8;
          this.guardWalkCycle = 0;
        }
        break;
      }

      // 3. CHECKPOINT INSPECTION (Guard steps out, checks documents, turns light green)
      case ROVER_STATES.CHECKPOINT_INSPECT: {
        this.stateTimer -= dt;
        this.guardWalkCycle += dt * 8.0;
        this.posZ = -15.75; // Locked strictly to driveway center

        if (this.checkpointGuardMesh) {
          const gm = this.checkpointGuardMesh;
          // Guard walks from booth door (-21.0) to Trekol driver window (-18.0)
          const walkProg = Math.min(1.0, (2.8 - this.stateTimer) / 1.0);
          gm.group.position.set(-63.5 + 0.5 * walkProg, 1.42, -21.0 + 3.0 * walkProg);
          gm.group.rotation.y = 0; // facing driver window

          const swing = Math.sin(this.guardWalkCycle) * 0.5;
          gm.legL.rotation.x = walkProg < 1.0 ? swing : 0;
          gm.legR.rotation.x = walkProg < 1.0 ? -swing : 0;

          // Raising tablet to inspect manifest
          if (this.stateTimer > 0.8) {
            gm.armR.rotation.x = -1.15;
            gm.head.rotation.x = -0.25 + Math.sin(t * 3) * 0.08;
          } else {
            // Signal all clear / wave arm!
            gm.armR.rotation.x = -2.2;
            gm.armR.rotation.z = -0.4 + Math.sin(t * 8) * 0.2;
            // Green traffic light turns ON!
            this.setCheckpointSignal(true);
            // Barrier lifts up smoothly
            if (this.gateBarrier) this.gateBarrier.rotation.z = Math.min(1.48, this.gateBarrier.rotation.z + dt * 2.5);
          }
        }

        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.CHECKPOINT_CLEAR;
          this.stateTimer = 2.6;
          if (typeof audio?.playHorn === "function") {
            audio.playHorn();
          }
        }
        break;
      }

      // 4. CHECKPOINT CLEAR (Trekol rolls out through gate onto the winter road)
      case ROVER_STATES.CHECKPOINT_CLEAR: {
        this.stateTimer -= dt;
        // Trekol drives West through gate portal
        const moveDist = this.speed * 0.75 * dt;
        this.posX -= moveDist; // Driving west
        this.posZ = -15.75;    // Locked strictly to driveway center
        this.heading = -Math.PI / 2; // Locked strictly West
        this.steerAngle = 0;
        this.wheelRotation += moveDist / 1.25;

        // Guard walks back to guard post
        if (this.checkpointGuardMesh) {
          const gm = this.checkpointGuardMesh;
          const returnProg = Math.min(1.0, (2.6 - this.stateTimer) / 1.2);
          gm.group.position.set(-63.0 - 0.5 * returnProg, 1.42, -18.0 - 3.0 * returnProg);
          gm.group.rotation.y = Math.PI; // facing booth
          const swing = Math.sin(this.guardWalkCycle) * 0.5;
          gm.legL.rotation.x = returnProg < 1.0 ? swing : 0;
          gm.legR.rotation.x = returnProg < 1.0 ? -swing : 0;
          gm.armR.rotation.x = 0;
          gm.armR.rotation.z = 0;
          if (returnProg >= 1.0) {
            gm.group.rotation.y = 0;
            gm.group.position.set(-63.5, 1.42, -21.0);
            gm.group.visible = true; // remains visibly on guard duty!
          }
        }

        // Wait until Trekol is past gate onto zimnik at x <= -78.0 before turning north
        if (this.posX <= -73.5 || this.stateTimer <= -2.5) {
          this.posX = -73.5;
          this.posZ = -15.75;
          // Cleared gate: lower barrier and reset light to red
          if (this.gateBarrier) this.gateBarrier.rotation.z = 0;
          this.setCheckpointSignal(false);

          this.state = ROVER_STATES.PATROL_DRIVING;
          const northIdx = this.patrolRoute.indexOf("junction_north");
          this.routeIndex = northIdx >= 0 ? northIdx : 4;
        }
        break;
      }

      // 5. STUCK IN SNOWDRIFT (Wheels spin fast, snow flies, player taps/swipes to shovel or crew auto-shovels)
      case ROVER_STATES.STUCK_IN_SNOWDRIFT: {
        // Fast wheel spin
        this.wheelRotation += dt * 16.0;
        // Rocking chassis
        this.suspensionPitch = 0.08 + Math.sin(t * 14.0) * 0.03;
        this.suspensionRoll = -0.06 + Math.cos(t * 12.0) * 0.02;

        // Flying snow particles
        for (let p = 0; p < this.snowPuffs.length; p++) {
          const puff = this.snowPuffs[p];
          puff.visible = true;
          puff.position.y += dt * 1.5;
          if (puff.position.y > 1.8) {
            puff.position.y = 0.2;
            puff.position.x = (Math.random() - 0.5) * 3.0;
          }
        }

        // Autonomous crew dig-out: auto-clear after ~4.5 seconds if player doesn't tap
        this.snowShovelProgress = Math.min(100, (this.snowShovelProgress || 0) + dt * 22.0);
        if (this.snowDriftMesh) {
          const s = (100 - this.snowShovelProgress) / 100;
          this.snowDriftMesh.scale.set(1.0, Math.max(0.01, s), 1.0);
        }

        if (this.snowShovelProgress >= 100) {
          this.isStuck = false;
          this.state = ROVER_STATES.PATROL_DRIVING;
          if (this.snowDriftMesh) this.snowDriftMesh.visible = false;
          this.suspensionPitch = 0;
          this.suspensionRoll = 0;
          if (typeof audio?.playHorn === "function") {
            audio.playHorn();
          }
          if (this.spawn3DFloatingText) {
            this.spawn3DFloatingText({ x: this.posX, y: 3.5, z: this.posZ }, "🚜 ТРЭКОЛ ВЫБРАЛСЯ ИЗ ЗАНОСА!", "#38bdf8");
          } else if (this.isometricView?.spawn3DFloatingText) {
            this.isometricView.spawn3DFloatingText({ x: this.posX, y: 3.5, z: this.posZ }, "🚜 ТРЭКОЛ ВЫБРАЛСЯ ИЗ ЗАНОСА!", "#38bdf8");
          }
        }
        break;
      }

      // 6. STOP AND PARK ON WELLPAD APRON OR GARAGE
      case ROVER_STATES.STOP_AND_PARK: {
        this.stateTimer -= dt;
        this.steerAngle *= 0.9;
        this.suspensionRoll *= 0.85;

        if (this.stateTimer <= 0) {
          if (this.currentClusterId) {
            this.state = ROVER_STATES.CREW_DISEMBARK;
            this.stateTimer = 1.0;
            for (let i = 0; i < this.crew.length; i++) this.crew[i].status = "disembarking";
          } else {
            // Garage break finished, proceed to checkpoint
            this.state = ROVER_STATES.PATROL_DRIVING;
            this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
          }
        }
        break;
      }

      // 7. CREW DISEMBARKS FROM ROVER
      case ROVER_STATES.CREW_DISEMBARK: {
        this.stateTimer -= dt;
        this.doorAngle = Math.min(1.15, this.doorAngle + dt * 2.5);

        const doorWorldX = this.posX + Math.cos(this.heading) * 1.5;
        const doorWorldZ = this.posZ - Math.sin(this.heading) * 1.5;

        for (let i = 0; i < this.crewMeshes.length; i++) {
          const cm = this.crewMeshes[i];
          cm.group.visible = true;
          // Stand cleanly on snow road ribbon surface (Y = 1.52)
          cm.group.position.set(doorWorldX + i * 0.6, 1.52, doorWorldZ + i * 0.6);
          cm.group.rotation.y = this.heading + Math.PI / 2;
        }

        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.WALK_TO_WELLHEAD;
          this.stateTimer = 3.0;
          this.crewProgress = 0;
          for (let i = 0; i < this.crew.length; i++) this.crew[i].status = "walking_to_wellhead";
        }
        break;
      }

      // 8. WALK TO CHRISTMAS TREE WELLHEAD
      case ROVER_STATES.WALK_TO_WELLHEAD: {
        this.stateTimer -= dt;
        this.crewWalkCycle += dt * 9.0;
        this.crewProgress = Math.min(1.0, this.crewProgress + dt * 0.35);

        const targetWp = this.roadNetwork.getWaypoint(this.currentClusterId);
        const wellX = targetWp ? (typeof targetWp.wellX === "number" ? targetWp.wellX : targetWp.x) : this.posX;
        const wellZ = targetWp ? (typeof targetWp.wellZ === "number" ? targetWp.wellZ : targetWp.z) : this.posZ;

        const doorWorldX = this.posX + Math.cos(this.heading) * 1.5;
        const doorWorldZ = this.posZ - Math.sin(this.heading) * 1.5;

        for (let i = 0; i < this.crewMeshes.length; i++) {
          const cm = this.crewMeshes[i];
          const startX = doorWorldX + i * 0.6;
          const startZ = doorWorldZ + i * 0.6;
          const destX = wellX - 3.5 + i * 1.4;
          const destZ = wellZ + i * 1.2;

          cm.group.position.x = startX + (destX - startX) * this.crewProgress;
          cm.group.position.z = startZ + (destZ - startZ) * this.crewProgress;
          // Smoothly step up from snow road ribbon (1.52) to concrete wellpad slab surface (2.02)
          const baseHeight = 1.52 + (2.02 - 1.52) * this.crewProgress;
          cm.group.position.y = baseHeight + Math.abs(Math.sin(this.crewWalkCycle)) * 0.08;
          cm.group.rotation.y = Math.atan2(destX - startX, destZ - startZ);

          const swing = Math.sin(this.crewWalkCycle + i) * 0.55;
          cm.legL.rotation.x = swing;
          cm.legR.rotation.x = -swing;
          cm.armL.rotation.x = -swing * 0.7;
          cm.armR.rotation.x = swing * 0.7;
        }

        if (this.crewProgress >= 1.0 || this.stateTimer <= 0) {
          this.state = ROVER_STATES.INSPECT_WELLHEAD;
          this.inspectionTimer = 4.5;
          for (let i = 0; i < this.crew.length; i++) this.crew[i].status = "inspecting";
        }
        break;
      }

      // 9. INSPECT WELLHEAD & TELEMETRY MANOMETERS
      case ROVER_STATES.INSPECT_WELLHEAD: {
        const wasActive = this.inspectionTimer > 0;
        this.inspectionTimer -= dt;
        for (let i = 0; i < this.crewMeshes.length; i++) {
          const cm = this.crewMeshes[i];
          cm.legL.rotation.x = 0;
          cm.legR.rotation.x = 0;
          // Stand firmly on top of the concrete wellpad slab
          cm.group.position.y = 2.02;
        }
        if (this.crewMeshes[0]) {
          this.crewMeshes[0].armR.rotation.x = -1.15;
          this.crewMeshes[0].head.rotation.x = -0.22 + Math.sin(t * 2) * 0.08;
        }
        if (this.crewMeshes[1]) {
          this.crewMeshes[1].armR.rotation.x = -0.75 + Math.sin(t * 3) * 0.15;
          this.crewMeshes[1].head.rotation.x = -0.42 + Math.sin(t * 1.5) * 0.12;
        }

        if (this.inspectionTimer <= 0 && wasActive) {
          const wellId = this.currentClusterId || "well_1";
          const targetWp = this.roadNetwork.getWaypoint(wellId);
          const wellX = targetWp ? (typeof targetWp.wellX === "number" ? targetWp.wellX : targetWp.x) : this.posX;
          const wellZ = targetWp ? (typeof targetWp.wellZ === "number" ? targetWp.wellZ : targetWp.z) : this.posZ;

          // Sound effect on inspection completion
          if (typeof audio?.playValveTurn === "function") {
            audio.playValveTurn();
          } else if (typeof audio?.playUpgrade === "function") {
            audio.playUpgrade();
          }

          // 3D Floating text above wellhead
          if (this.spawn3DFloatingText) {
            this.spawn3DFloatingText({ x: wellX, y: 5.5, z: wellZ }, "🔧 ТО ЗАВЕРШЕНО • ДАВЛЕНИЕ В НОРМЕ", "#00a3e0");
          } else if (this.isometricView?.spawn3DFloatingText) {
            this.isometricView.spawn3DFloatingText({ x: wellX, y: 5.5, z: wellZ }, "🔧 ТО ЗАВЕРШЕНО • ДАВЛЕНИЕ В НОРМЕ", "#00a3e0");
          }

          if (typeof state?.emit === "function") {
            state.emit("well_patrol_inspected", { wellId, timestamp: Date.now() });
          }

          this.state = ROVER_STATES.WALK_TO_VEHICLE;
          this.stateTimer = 3.0;
          this.crewProgress = 0;
          for (let i = 0; i < this.crew.length; i++) this.crew[i].status = "walking_to_vehicle";
        }
        break;
      }

      // 10. WALK BACK TO ROVER
      case ROVER_STATES.WALK_TO_VEHICLE: {
        this.stateTimer -= dt;
        this.crewWalkCycle += dt * 9.0;
        this.crewProgress = Math.min(1.0, this.crewProgress + dt * 0.35);

        const targetWp = this.roadNetwork.getWaypoint(this.currentClusterId);
        const wellX = targetWp ? (typeof targetWp.wellX === "number" ? targetWp.wellX : targetWp.x) : this.posX;
        const wellZ = targetWp ? (typeof targetWp.wellZ === "number" ? targetWp.wellZ : targetWp.z) : this.posZ;

        const doorWorldX = this.posX + Math.cos(this.heading) * 1.5;
        const doorWorldZ = this.posZ - Math.sin(this.heading) * 1.5;

        for (let i = 0; i < this.crewMeshes.length; i++) {
          const cm = this.crewMeshes[i];
          const startX = wellX - 3.5 + i * 1.4;
          const startZ = wellZ + i * 1.2;
          const destX = doorWorldX + i * 0.6;
          const destZ = doorWorldZ + i * 0.6;

          cm.group.position.x = startX + (destX - startX) * this.crewProgress;
          cm.group.position.z = startZ + (destZ - startZ) * this.crewProgress;
          // Smoothly descend from concrete wellpad slab (2.02) to snow road ribbon (1.52)
          const baseHeight = 2.02 - (2.02 - 1.52) * this.crewProgress;
          cm.group.position.y = baseHeight + Math.abs(Math.sin(this.crewWalkCycle)) * 0.08;
          cm.group.rotation.y = Math.atan2(destX - startX, destZ - startZ);

          const swing = Math.sin(this.crewWalkCycle + i) * 0.55;
          cm.legL.rotation.x = swing;
          cm.legR.rotation.x = -swing;
          cm.armL.rotation.x = -swing * 0.7;
          cm.armR.rotation.x = swing * 0.7;
        }

        if (this.crewProgress >= 1.0 || this.stateTimer <= 0) {
          this.state = ROVER_STATES.CREW_EMBARK;
          this.stateTimer = 1.0;
          for (let i = 0; i < this.crew.length; i++) this.crew[i].status = "embarking";
        }
        break;
      }

      // 11. CREW EMBARKS AND CLOSES DOOR
      case ROVER_STATES.CREW_EMBARK: {
        this.stateTimer -= dt;
        this.doorAngle = Math.max(0, this.doorAngle - dt * 2.5);

        for (let i = 0; i < this.crewMeshes.length; i++) {
          this.crewMeshes[i].group.visible = false;
        }

        if (this.stateTimer <= 0) {
          this.state = ROVER_STATES.PATROL_DRIVING;
          for (let i = 0; i < this.crew.length; i++) this.crew[i].status = "seated";
          this.currentClusterId = null;
          this.routeIndex = (this.routeIndex + 1) % this.patrolRoute.length;
        }
        break;
      }
    }

    // Drop dynamic 6x6 tire tread impressions onto snow along vehicle travel path
    if (this.trackPool && this.trackPool.length > 0) {
      const trackDist = Math.hypot(this.posX - this.lastTrackPos.x, this.posZ - this.lastTrackPos.z);
      if (trackDist >= 1.4) {
        const seg = this.trackPool[this.trackPoolIdx];
        seg.position.set(this.posX, 1.488, this.posZ);
        seg.rotation.y = this.heading;
        seg.userData.active = true;
        seg.userData.age = 0;
        seg.userData.mat.opacity = 0.85;
        seg.visible = true;
        this.trackPoolIdx = (this.trackPoolIdx + 1) % this.trackPool.length;
        this.lastTrackPos.x = this.posX;
        this.lastTrackPos.z = this.posZ;
      }

      // Smooth 3-second fade-out for all active tyre track segments (Zero-GC)
      for (let k = 0; k < this.trackPool.length; k++) {
        const seg = this.trackPool[k];
        if (seg.userData && seg.userData.active) {
          seg.userData.age += dt;
          if (seg.userData.age >= seg.userData.maxLife) {
            seg.userData.active = false;
            seg.visible = false;
            seg.userData.mat.opacity = 0;
          } else {
            const lifeRatio = 1.0 - (seg.userData.age / seg.userData.maxLife);
            seg.userData.mat.opacity = Math.max(0, 0.85 * lifeRatio);
          }
        }
      }
    }

    // Apply Transforms to 3D Rover Model
    if (this.group) {
      this.group.position.set(this.posX, this.posY, this.posZ);
      this.group.rotation.y = this.heading;
      this.group.rotation.z = this.suspensionRoll;
      this.group.rotation.x = this.suspensionPitch;
    }

    if (this.frontAxlePivot) {
      this.frontAxlePivot.rotation.y = this.steerAngle;
    }

    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].rotation.x = this.wheelRotation;
    }

    if (this.doorMesh) {
      this.doorMesh.rotation.y = this.doorAngle;
    }
  }

  /**
   * Shovels snow to free Trekol from a snowdrift.
   * Can be triggered by taps or swipes.
   */
  shovelSnow(amount = 25) {
    if (!this.isStuck) return null;

    this.snowShovelProgress = Math.min(100, this.snowShovelProgress + amount);
    this.tapSquash = 1.0;

    if (typeof audio?.playSnowShovel === "function") {
      audio.playSnowShovel();
    } else if (typeof audio?.playTap === "function") {
      audio.playTap();
    }

    // Shrink snowdrift mesh as player shovels
    if (this.snowDriftMesh) {
      const s = (100 - this.snowShovelProgress) / 100;
      this.snowDriftMesh.scale.set(1.0, Math.max(0.01, s), 1.0);
    }

    // Check if fully cleared
    if (this.snowShovelProgress >= 100) {
      this.isStuck = false;
      this.state = ROVER_STATES.PATROL_DRIVING;
      if (this.snowDriftMesh) this.snowDriftMesh.visible = false;
      this.suspensionPitch = 0;
      this.suspensionRoll = 0;

      if (typeof audio?.playHorn === "function") {
        audio.playHorn();
      }

      return { stuckCleared: true, progress: 100 };
    }

    return { shoveled: true, progress: this.snowShovelProgress };
  }

  /**
   * Interactive tap feedback on TREKOL Rover:
   * If stuck, shovels snow. If driving, honks horn and squashes.
   */
  handleTap() {
    if (this.isStuck) {
      return this.shovelSnow(25);
    }

    this.tapSquash = 1.0;
    if (typeof audio?.playHorn === "function") {
      audio.playHorn();
    } else if (typeof audio?.playTap === "function") {
      audio.playTap();
    }
    return { honked: true };
  }
}
