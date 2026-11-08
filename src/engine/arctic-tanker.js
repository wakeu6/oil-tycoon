/**
 * src/engine/arctic-tanker.js
 * Arc7 Arctic Ice-Class Shuttle Tanker 3D Model & Kinematics Engine.
 *
 * Visual & Kinematic Features:
 * - Double-hull icebreaker profile with submerged bulb and raked bow.
 * - Dual 360-degree rotating Azipod stern thrusters with 4-blade propellers.
 * - Forward winterized bridge with extended wings and spinning radar scanners.
 * - Forecastle bow helipad with marked 'H', perimeter safety net, and beacons.
 * - Midship cargo manifold station, P/V expansion domes, and trunk catwalk.
 * - Zero-GC dynamic wake foam particles (bow wave, flank wash, Azipod boil).
 * - Full 6-state export voyage FSM kinematics (idle, approaching, berthing, loading, departing, voyage).
 */

export class ArcticTanker3D {
  constructor(THREE, sharedMaterials = {}) {
    this.THREE = THREE;
    this.group = new THREE.Group();
    this.group.name = "Arc7Tanker";
    this.meshGroup = this.group;

    // Reusable scratch vectors and math objects for Zero-GC 60 FPS execution
    this._scratchVecA = new THREE.Vector3();
    this._scratchVecB = new THREE.Vector3();
    this._scratchEuler = new THREE.Euler();

    // Visual Kinematics State
    this.state = "idle";
    this.voyageProgress = 0.0;
    this.speed = 0.0;
    this.targetSpeed = 0.0;
    this.heading = 0.0; // Yaw angle in radians (0 = pointing South +Z)
    this.propRotation = 0.0;
    this.radarRotation = 0.0;

    // Loading Arms Reference Progress (0.0 to 1.0)
    this.loadingProgress = 0.0;

    // Docked Reference Coordinates (Deep water bay at x: -22.8, z: 190.0)
    this.BERTH_POS = { x: -22.8, y: -0.2, z: 190.0, heading: 0.0 };
    this.waypoints = {
      berth: { ...this.BERTH_POS },
      departing: { x: -10.8, y: -0.2, z: 240.0, heading: 0.08 },
      voyage: { x: 10.0, y: -0.2, z: 450.0, heading: 0.0 }
    };

    this.initMaterials(sharedMaterials);
    this.buildModel();
    this.initWakeParticles();

    // Default placement at berth
    this.group.position.set(this.BERTH_POS.x, this.BERTH_POS.y, this.BERTH_POS.z);
    this.group.rotation.y = this.BERTH_POS.heading;
  }

  initMaterials(mat) {
    const THREE = this.THREE;
    this.mat = {
      hullUnderwater: mat.hullUnderwater || new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.55, metalness: 0.25 }), // Crimson
      iceBelt: mat.iceBelt || new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.15 }),               // Reinforced ice white
      hullTopsides: mat.hullTopsides || new THREE.MeshStandardMaterial({ color: 0x002b54, roughness: 0.45, metalness: 0.35 }),         // Dark Gazprom navy
      hullOrange: mat.hullOrange || new THREE.MeshStandardMaterial({ color: 0x005bab, roughness: 0.35, metalness: 0.2 }),             // Gazprom corporate blue
      cargoDeck: mat.cargoDeck || new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.15 }),             // Slate deck
      whiteSuperstructure: mat.whiteWall || new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 }),
      bridgeGlass: mat.rdOfficeGlass || new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.85 }),
      darkMetal: mat.darkMetal || new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.7 }),
      steelTruss: mat.steelTruss || new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.6 }),
      propellerBronze: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.85 }),
      pipeBlue: mat.bluePipe || new THREE.MeshStandardMaterial({ color: 0x005bab, roughness: 0.35, metalness: 0.3 }),
      pipeYellow: mat.yellowGasPipe || new THREE.MeshStandardMaterial({ color: 0x00a3e0, roughness: 0.35, metalness: 0.3 }),
      valveRed: mat.redValve || new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.2 }),
      helipadGreen: new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85 }),
      helipadMarking: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      beaconGreen: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
      navRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      navGreen: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
      navWhite: new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
      wakeFoam: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide })
    };
  }

  buildModel() {
    const THREE = this.THREE;

    // 1. HULL ASSEMBLY
    this.hullGroup = new THREE.Group();
    this.hullGroup.name = "Hull";

    // 1a. Submerged Keel Block (Length: 28, Beam: 10.2, Depth: 1.4)
    const keelMesh = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.4, 28.0), this.mat.hullUnderwater);
    keelMesh.position.set(0, -0.9, 0);
    keelMesh.receiveShadow = true;
    this.hullGroup.add(keelMesh);

    // 1b. Waterline Reinforced Ice-Belt (Length: 30, Beam: 11.0, Height: 0.9)
    const iceBeltMesh = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.9, 30.0), this.mat.iceBelt);
    iceBeltMesh.position.set(0, 0.25, 0);
    this.hullGroup.add(iceBeltMesh);

    // 1c. Upper Freeboard & Topsides (Length: 30, Beam: 10.8, Height: 1.6)
    const topsidesMesh = new THREE.Mesh(new THREE.BoxGeometry(10.8, 1.6, 30.0), this.mat.hullTopsides);
    topsidesMesh.position.set(0, 1.5, 0);
    topsidesMesh.castShadow = true;
    this.hullGroup.add(topsidesMesh);

    // 1d. Arctic Safety Orange Sheer Strake
    const sheerStrake = new THREE.Mesh(new THREE.BoxGeometry(10.85, 0.35, 30.05), this.mat.hullOrange);
    sheerStrake.position.set(0, 2.15, 0);
    this.hullGroup.add(sheerStrake);

    // 1e. Main Cargo Deck
    const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.15, 30.0), this.mat.cargoDeck);
    mainDeck.position.set(0, 2.35, 0);
    mainDeck.receiveShadow = true;
    this.hullGroup.add(mainDeck);

    // 2. ICEBREAKER BOW SECTION (Forward from z = 15.0 to z = 26.5)
    this.bowGroup = new THREE.Group();
    this.bowGroup.name = "IcebreakerBow";

    // 2a. Sloped Ice-Shearing Stem (Rake Angle ~ 25 degrees)
    const stemGeo = new THREE.CylinderGeometry(1.2, 5.4, 11.5, 8, 1, false, 0, Math.PI);
    const stemMesh = new THREE.Mesh(stemGeo, this.mat.hullTopsides);
    stemMesh.rotation.x = -Math.PI / 2;
    stemMesh.rotation.y = Math.PI;
    stemMesh.position.set(0, 1.2, 20.5);
    stemMesh.scale.set(1.0, 1.0, 0.75);
    stemMesh.castShadow = true;
    this.bowGroup.add(stemMesh);

    // 2b. Submerged Ice-Knife Bulb
    const bulbGeo = new THREE.CylinderGeometry(0.55, 1.15, 4.2, 12);
    const bulbMesh = new THREE.Mesh(bulbGeo, this.mat.hullUnderwater);
    bulbMesh.rotation.x = Math.PI / 2;
    bulbMesh.position.set(0, -0.9, 23.2);
    this.bowGroup.add(bulbMesh);

    const bulbNose = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), this.mat.hullUnderwater);
    bulbNose.position.set(0, -0.9, 25.3);
    this.bowGroup.add(bulbNose);

    // 2c. Raised Forecastle Deck (Бак) with Anchor Windlasses & Fairleads
    const fcastDeck = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.4, 8.0), this.mat.cargoDeck);
    fcastDeck.position.set(0, 2.55, 19.0);
    this.bowGroup.add(fcastDeck);

    [-2.2, 2.2].forEach(wx => {
      const windlass = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8), this.mat.darkMetal);
      windlass.rotation.z = Math.PI / 2;
      windlass.position.set(wx, 2.9, 20.5);
      this.bowGroup.add(windlass);
    });

    this.hullGroup.add(this.bowGroup);

    // 3. DOUBLE-ACTING STERN & TWIN AZIPOD THRUSTERS (Aft from z = -15.0 to z = -25.0)
    this.sternGroup = new THREE.Group();
    this.sternGroup.name = "SternAzipods";

    // 3a. Tapered Transom Stern
    const transomMesh = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.4, 6.0), this.mat.hullTopsides);
    transomMesh.position.set(0, 1.2, -18.0);
    this.sternGroup.add(transomMesh);

    // 3b. Centerline Stern Ice-Clearing Skeg
    const skegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 5.0), this.mat.hullUnderwater);
    skegMesh.position.set(0, -0.9, -18.0);
    this.sternGroup.add(skegMesh);

    // 3c. Dual Azipod Thrusters (Port & Starboard)
    this.azipods = [];
    [-2.8, 2.8].forEach((px, idx) => {
      const azipodGroup = new THREE.Group();
      azipodGroup.name = idx === 0 ? "PortAzipod" : "StbdAzipod";
      azipodGroup.position.set(px, -1.8, -20.5);

      // Vertical Azimuth Steering Strut
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.4, 8), this.mat.darkMetal);
      strut.position.y = 0.7;
      azipodGroup.add(strut);

      // Torpedo Nacelle Housing (Horizontal cylinder)
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.8, 10), this.mat.darkMetal);
      nacelle.rotation.x = Math.PI / 2;
      azipodGroup.add(nacelle);

      // Lower Stabilizing Fin
      const podFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 1.4), this.mat.darkMetal);
      podFin.position.y = -0.55;
      azipodGroup.add(podFin);

      // 4-Blade Stainless-Steel Ice-Class Propeller Assembly
      const propGroup = new THREE.Group();
      propGroup.position.set(0, 0, -1.45);

      const hub = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 8), this.mat.propellerBronze);
      hub.rotation.x = -Math.PI / 2;
      propGroup.add(hub);

      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.08), this.mat.propellerBronze);
        blade.position.y = 0.42;
        blade.rotation.z = (Math.PI / 2) * b;
        blade.rotation.y = 0.35;
        propGroup.add(blade);
      }

      azipodGroup.add(propGroup);
      this.sternGroup.add(azipodGroup);

      this.azipods.push({ group: azipodGroup, propGroup, baseAngle: 0.0 });
    });

    this.hullGroup.add(this.sternGroup);
    this.group.add(this.hullGroup);

    // 4. FORWARD SUPERSTRUCTURE & WINTERIZED BRIDGE (Mounted at z = 12.0)
    this.bridgeGroup = new THREE.Group();
    this.bridgeGroup.name = "ForwardBridge";
    this.bridgeGroup.position.set(0, 2.4, 12.0);

    // 4a. Lower Living Quarters Block (Tier 1 & 2)
    const block1 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.8, 5.4), this.mat.whiteSuperstructure);
    block1.position.set(0, 0.9, 0);
    block1.castShadow = true;
    this.bridgeGroup.add(block1);

    const block2 = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.5, 4.6), this.mat.whiteSuperstructure);
    block2.position.set(0, 2.55, 0);
    this.bridgeGroup.add(block2);

    // 4b. Upper Wheelhouse with Extended Panoramic Bridge Wings
    const bridgeWings = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.3, 3.6), this.mat.whiteSuperstructure);
    bridgeWings.position.set(0, 3.95, 0.2);
    bridgeWings.castShadow = true;
    this.bridgeGroup.add(bridgeWings);

    // 4c. Heated Panoramic Navigation Glass
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.5, 0.08), this.mat.bridgeGlass);
    frontGlass.position.set(0, 4.05, 2.02);
    this.bridgeGroup.add(frontGlass);

    // 4d. Navigational Radar Tower & Spinning Scanners
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 4.8, 8), this.mat.darkMetal);
    mast.position.set(0, 7.0, 0);
    this.bridgeGroup.add(mast);

    this.radarAntennas = [];
    const sBandScanner = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.2), this.mat.cargoDeck);
    sBandScanner.position.set(0, 8.8, 0);
    this.bridgeGroup.add(sBandScanner);
    this.radarAntennas.push({ mesh: sBandScanner, speed: 4.5 });

    const xBandScanner = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.16), this.mat.darkMetal);
    xBandScanner.position.set(0, 9.6, 0);
    this.bridgeGroup.add(xBandScanner);
    this.radarAntennas.push({ mesh: xBandScanner, speed: 7.2 });

    // 4e. Bridge Wing Navigation Running Lights
    const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), this.mat.navRed);
    redLight.position.set(-6.15, 3.95, 0.2);
    this.bridgeGroup.add(redLight);

    const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), this.mat.navGreen);
    greenLight.position.set(6.15, 3.95, 0.2);
    this.bridgeGroup.add(greenLight);

    this.group.add(this.bridgeGroup);

    // 5. BOW HELIPAD (Вертолетная площадка над баком at z = 20.5)
    this.helipadGroup = new THREE.Group();
    this.helipadGroup.name = "BowHelipad";
    this.helipadGroup.position.set(0, 3.9, 20.5);

    // 5a. Support Truss Under Helideck
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), this.mat.steelTruss);
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      leg.position.set(Math.cos(angle) * 2.8, -0.7, Math.sin(angle) * 2.8);
      this.helipadGroup.add(leg);
    }

    // 5b. Octagonal Landing Platform
    const padPlatform = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.25, 8), this.mat.helipadGreen);
    padPlatform.receiveShadow = true;
    this.helipadGroup.add(padPlatform);

    // 5c. Perimeter Yellow Coaming Netting
    const safetyCoaming = new THREE.Mesh(new THREE.TorusGeometry(3.65, 0.06, 6, 8), this.mat.hullOrange);
    safetyCoaming.rotation.x = Math.PI / 2;
    this.helipadGroup.add(safetyCoaming);

    // 5d. Bold White 'H' Helideck Marking
    const hBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 2.2), this.mat.helipadMarking);
    hBar1.position.set(-0.85, 0.14, 0);
    this.helipadGroup.add(hBar1);

    const hBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 2.2), this.mat.helipadMarking);
    hBar2.position.set(0.85, 0.14, 0);
    this.helipadGroup.add(hBar2);

    const hCross = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.35), this.mat.helipadMarking);
    hCross.position.set(0, 0.14, 0);
    this.helipadGroup.add(hCross);

    // 5e. Perimeter Green Night Landing Beacons
    for (let i = 0; i < 8; i++) {
      const bAngle = (Math.PI / 4) * i;
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), this.mat.beaconGreen);
      beacon.position.set(Math.cos(bAngle) * 3.55, 0.15, Math.sin(bAngle) * 3.55);
      this.helipadGroup.add(beacon);
    }

    this.group.add(this.helipadGroup);

    // 6. CARGO DECK PIPING & MIDSHIP MANIFOLD STATION
    this.cargoDeckGroup = new THREE.Group();
    this.cargoDeckGroup.name = "CargoDeckPiping";
    this.cargoDeckGroup.position.set(0, 2.4, 0);

    // 6a. Elevated Centerline Trunk Catwalk (Переходный мостик)
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 22.0), this.mat.steelTruss);
    catwalk.position.set(0, 0.8, -1.0);
    this.cargoDeckGroup.add(catwalk);

    [-0.55, 0.55].forEach(rx => {
      const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 22.0), this.mat.whiteSuperstructure);
      handrail.position.set(rx, 1.15, -1.0);
      this.cargoDeckGroup.add(handrail);
    });

    // 6b. Cargo Tank Expansion Hatches / Domes (6 Cylinders with P/V relief risers)
    [-8.0, -3.0, 3.0].forEach(dz => {
      [-2.6, 2.6].forEach(dx => {
        const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.65, 10), this.mat.whiteSuperstructure);
        dome.position.set(dx, 0.35, dz);
        this.cargoDeckGroup.add(dome);

        const pvRiser = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), this.mat.pipeYellow);
        pvRiser.position.set(dx + 0.5, 0.9, dz);
        this.cargoDeckGroup.add(pvRiser);
      });
    });

    // 6c. Midship Cargo Manifold Station (at z = 0.0)
    const manifoldDripTray = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.35, 4.0), this.mat.darkMetal);
    manifoldDripTray.position.set(0, 0.2, 0);
    this.cargoDeckGroup.add(manifoldDripTray);

    const headerConfigs = [
      { z: -1.2, mat: this.mat.pipeBlue, r: 0.22, name: "CrudeOilHeader" },
      { z: -0.4, mat: this.mat.pipeBlue, r: 0.22, name: "FuelProductHeader" },
      { z: 0.4, mat: this.mat.pipeYellow, r: 0.16, name: "VaporRecoveryHeader" },
      { z: 1.2, mat: this.mat.darkMetal, r: 0.15, name: "BunkeringHeader" }
    ];

    headerConfigs.forEach(cfg => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r, cfg.r, 10.4, 8), cfg.mat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 0.65, cfg.z);
      this.cargoDeckGroup.add(pipe);

      [-5.25, 5.25].forEach(ex => {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r * 1.6, cfg.r * 1.6, 0.12, 8), this.mat.steelTruss);
        flange.rotation.z = Math.PI / 2;
        flange.position.set(ex, 0.65, cfg.z);
        this.cargoDeckGroup.add(flange);

        const valve = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 8), this.mat.valveRed);
        valve.position.set(ex > 0 ? ex - 0.3 : ex + 0.3, 0.95, cfg.z);
        this.cargoDeckGroup.add(valve);
      });
    });

    // 6d. Hose-Handling Crane
    const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.2, 8), this.mat.hullOrange);
    craneBase.position.set(3.2, 1.1, 1.8);
    this.cargoDeckGroup.add(craneBase);

    const craneJib = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 4.6), this.mat.hullOrange);
    craneJib.position.set(3.2, 2.6, 0.2);
    craneJib.rotation.x = 0.4;
    this.cargoDeckGroup.add(craneJib);

    // 6e. Exhaust Funnel Casing (Aft at z = -10.5)
    const funnel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 1.8), this.mat.whiteSuperstructure);
    funnel.position.set(0, 2.4, -10.5);
    funnel.castShadow = true;
    this.cargoDeckGroup.add(funnel);

    [-0.5, 0.5].forEach(fx => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 8), this.mat.darkMetal);
      pipe.position.set(fx, 4.2, -10.5);
      this.cargoDeckGroup.add(pipe);
    });

    this.group.add(this.cargoDeckGroup);
  }

  initWakeParticles() {
    const THREE = this.THREE;
    this.wakePool = [];
    this.wakePoolSize = 48;

    this.wakeGroup = new THREE.Group();
    this.wakeGroup.name = "WakeFoamSystem";

    for (let i = 0; i < this.wakePoolSize; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), this.mat.wakeFoam.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.wakeGroup.add(mesh);

      this.wakePool.push({
        mesh,
        active: false,
        life: 0.0,
        maxLife: 2.2,
        x: 0,
        y: -0.15,
        z: 0,
        vx: 0,
        vz: 0,
        scale: 1.0,
        startScale: 0.8,
        endScale: 3.2,
        baseOpacity: 0.75,
        type: i < 16 ? "bow" : i < 32 ? "flank" : "azipod"
      });
    }
  }

  /**
   * Zero-GC update called every animation frame (60 FPS)
   */
  update(dt, tankerState = "idle") {
    if (typeof dt !== "number" || isNaN(dt) || dt <= 0) return;
    const clampedDt = Math.min(dt, 0.1);
    const t = performance.now() * 0.001;
    this.state = tankerState;

    // 1. Radar Scanners Rotation
    for (let i = 0; i < this.radarAntennas.length; i++) {
      const r = this.radarAntennas[i];
      r.mesh.rotation.y = t * r.speed;
    }

    // 2. Determine target speed & ship kinematics based on 6 FSM stages
    let targetX = this.BERTH_POS.x;
    let targetZ = this.BERTH_POS.z;
    let targetHeading = this.BERTH_POS.heading;

    switch (tankerState) {
      case "idle":
        this.targetSpeed = 0.0;
        targetX = this.BERTH_POS.x;
        targetZ = this.BERTH_POS.z;
        targetHeading = this.BERTH_POS.heading;
        break;
      case "approaching":
        this.targetSpeed = 10.0;
        targetX = this.BERTH_POS.x;
        targetZ = this.BERTH_POS.z;
        targetHeading = 0.0;
        break;
      case "berthing":
        this.targetSpeed = 2.0;
        targetX = this.BERTH_POS.x;
        targetZ = this.BERTH_POS.z;
        targetHeading = 0.0;
        break;
      case "loading":
        this.targetSpeed = 0.0;
        targetX = this.BERTH_POS.x;
        targetZ = this.BERTH_POS.z;
        targetHeading = 0.0;
        break;
      case "departing":
        this.targetSpeed = 6.0;
        targetX = -10.8;
        targetZ = 240.0;
        targetHeading = 0.08;
        break;
      case "voyage":
        this.targetSpeed = 16.0;
        targetX = 10.0;
        targetZ = 450.0;
        targetHeading = 0.0;
        break;
      case "returned":
        this.targetSpeed = 0.0;
        targetX = this.BERTH_POS.x;
        targetZ = this.BERTH_POS.z;
        targetHeading = 0.0;
        break;
      default:
        this.targetSpeed = 0.0;
        break;
    }

    // Smooth speed & position lerp
    this.speed += (this.targetSpeed - this.speed) * Math.min(1.0, clampedDt * 2.0);
    const posLerp = Math.min(1.0, clampedDt * (tankerState === "voyage" ? 0.35 : 1.2));
    this.group.position.x += (targetX - this.group.position.x) * posLerp;
    this.group.position.z += (targetZ - this.group.position.z) * posLerp;
    this.heading += (targetHeading - this.heading) * Math.min(1.0, clampedDt * 2.0);
    this.group.rotation.y = this.heading;

    // 3. Azipod Propeller Spin & Steering Vectoring
    const isMoving = this.speed > 0.05;
    const propSpeed = isMoving ? this.speed * 8.0 : 0.8;
    this.propRotation += clampedDt * propSpeed;

    for (let i = 0; i < this.azipods.length; i++) {
      const pod = this.azipods[i];
      pod.propGroup.rotation.z = this.propRotation;
      pod.group.rotation.y = pod.baseAngle + (isMoving ? Math.sin(t * 1.5) * 0.12 : 0.0);
    }

    // 4. Dynamic Wake Particle Emission & Life Cycle
    this.updateWakeParticles(clampedDt, isMoving);
  }

  updateWakeParticles(dt, isMoving) {
    const shipPos = this.group.position;
    const shipHeading = this.group.rotation.y;

    for (let i = 0; i < this.wakePoolSize; i++) {
      const p = this.wakePool[i];

      if (p.active) {
        p.life += dt;
        p.x += p.vx * dt;
        p.z += p.vz * dt;

        const progress = p.life / p.maxLife;
        const scale = p.startScale + (p.endScale - p.startScale) * progress;
        p.mesh.scale.set(scale, scale, 1.0);
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.material.opacity = Math.max(0, p.baseOpacity * (1.0 - progress));

        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        }
      } else if (isMoving && Math.random() < 0.28) {
        p.active = true;
        p.mesh.visible = true;
        p.life = 0.0;

        let localX = 0, localZ = 0;
        if (p.type === "bow") {
          localX = (Math.random() - 0.5) * 2.4;
          localZ = 24.5;
          p.startScale = 0.8;
          p.endScale = 2.4;
          p.maxLife = 1.8;
        } else if (p.type === "flank") {
          localX = (Math.random() > 0.5 ? 1 : -1) * 5.6;
          localZ = (Math.random() - 0.5) * 26.0;
          p.startScale = 1.0;
          p.endScale = 2.8;
          p.maxLife = 2.2;
        } else {
          localX = (Math.random() > 0.5 ? 2.8 : -2.8);
          localZ = -22.5;
          p.startScale = 1.2;
          p.endScale = 3.8;
          p.maxLife = 2.5;
        }

        const cosH = Math.cos(shipHeading);
        const sinH = Math.sin(shipHeading);
        p.x = shipPos.x + (localX * cosH + localZ * sinH);
        p.y = -0.15;
        p.z = shipPos.z + (-localX * sinH + localZ * cosH);

        p.vx = -sinH * this.speed * 0.25 + (Math.random() - 0.5) * 0.2;
        p.vz = -cosH * this.speed * 0.25 + (Math.random() - 0.5) * 0.2;
      }
    }
  }

  dispose() {
    this.group.traverse(child => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
      }
    });
    if (this.wakeGroup) {
      this.wakeGroup.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
    }
  }
}

