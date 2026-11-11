import{CONFIG}from "./config.js";import{audio}from "./audio.js";import{marketEngine}from "./engine/market.js";import{platform}from "./platform-bridge.js";if(!CONFIG.IPO){CONFIG.IPO={CAPITAL_THRESHOLD:1000000000,BONUS_PER_SHARE:0.02,MIN_NAME_LENGTH:2,MAX_NAME_LENGTH:24,STARTING_MONEY:0};}export class GameState{constructor(){this.money=0;this.dollars=0;this.crypto=0;this.technologies={};this.activeWellId="well_1";this.wells={};this.specialization=null;this.isPaused=false;this.ftueStep=0;this.ftueCompleted=false;this.ipo={goldenShares:0,companyName:"",ipoCount:0};this.prestige={shares:0,companyName:"",ipoCount:0};this.helicopter={timer:0,active:false,disabled:true,x:-100,y:90,crateDropped:false,crateY:90,waitingClick:false};this.dailyStreak={day:1,lastClaimDate:""};this.advisor={seenTips:{}};this.market={oilPrice:75.0,gasPrice:35.0,oilMultiplier:1.0,gasMultiplier:1.0,activeEvent:null,eventRemainingSec:0,oilTrend:"flat",gasTrend:"flat"};this.brokerInsider={active:false,multiplier:2.5,remainingSec:0,totalDurationSec:90.0};this.fountainBurst={active:false,multiplier:3.0,remainingSec:0,totalDurationSec:0};this.boost={active:false,multiplier:1.0,remainingSec:0,totalDurationSec:0};this.totalClicks=0;this.totalEarned=0;this.lastSaveTime=Date.now();this.sessionTimeSec=0;this.accidentTimerSec=0;this.accidentNextIntervalSec=300.0+Math.random()*120.0;this.accident={active:false,type:null,remainingSec:0,totalDurationSec:6.0,qteProgress:0,isGoldTap:false};this.listeners={tap:[]};this.wellStimulation={};this.stimulationStats={totalStimulations:0,bestMultiplier:1.0,totalExtraMoneyEarned:0};this.buildingPositions={};this.performIPO=this.performIpo.bind(this);this.isIPOAvailable=this.isIpoAvailable.bind(this);this.initDefaultWells();}
  getBuildingPos(id, defaultPos) {
    if (this.buildingPositions && this.buildingPositions[id]) {
      return this.buildingPositions[id];
    }
    return defaultPos;
  }

  setBuildingPos(id, x, z) {
    if (!this.buildingPositions) this.buildingPositions = {};
    this.buildingPositions[id] = { x, z };
    this.emit("buildingMoved", { id, x, z });
  }

  resetBuildingPositions() {
    this.buildingPositions = {};
    this.emit("buildingPositionsReset");
  }
  get oilStorageCurrent() {
    if (!this.inventory) return this._oilStorageCurrent || 0;
    const fuels = (this.inventory.fuel_ai92 || 0) +
                  (this.inventory.fuel_ai95 || 0) +
                  (this.inventory.fuel_ai98 || 0) +
                  (this.inventory.fuel_ai100 || 0);
    return (this.inventory.rawOil || 0) + fuels;
  }
  set oilStorageCurrent(val) {
    const numVal = Math.max(0, Number(val) || 0);
    this._oilStorageCurrent = numVal;
    if (!this.inventory) {
      this.inventory = {
        rawOil: numVal,
        rawGas: 0,
        fuel_ai92: 0,
        fuel_ai95: 0,
        fuel_ai98: 0,
        fuel_ai100: 0,
        dryGas: 0,
        lpg: 0,
        helium: 0,
        polymers: 0,
        petrochem: 0
      };
    } else if (numVal === 0) {
      this.inventory.rawOil = 0;
      this.inventory.fuel_ai92 = 0;
      this.inventory.fuel_ai95 = 0;
      this.inventory.fuel_ai98 = 0;
      this.inventory.fuel_ai100 = 0;
    } else {
      const fuels = (this.inventory.fuel_ai92 || 0) +
                    (this.inventory.fuel_ai95 || 0) +
                    (this.inventory.fuel_ai98 || 0) +
                    (this.inventory.fuel_ai100 || 0);
      if (numVal >= fuels) {
        this.inventory.rawOil = numVal - fuels;
      } else {
        this.inventory.rawOil = 0;
        if (fuels > 0) {
          const ratio = numVal / fuels;
          this.inventory.fuel_ai92 = (this.inventory.fuel_ai92 || 0) * ratio;
          this.inventory.fuel_ai95 = (this.inventory.fuel_ai95 || 0) * ratio;
          this.inventory.fuel_ai98 = (this.inventory.fuel_ai98 || 0) * ratio;
          this.inventory.fuel_ai100 = (this.inventory.fuel_ai100 || 0) * ratio;
        } else {
          this.inventory.fuel_ai92 = 0;
          this.inventory.fuel_ai95 = 0;
          this.inventory.fuel_ai98 = 0;
          this.inventory.fuel_ai100 = 0;
        }
      }
    }
  }

  get goldenShares() {
    return (this.ipo && typeof this.ipo.goldenShares === "number") ? this.ipo.goldenShares : (this._goldenShares || 0);
  }
  set goldenShares(val) {
    const num = Math.max(0, Number(val) || 0);
    this._goldenShares = num;
    if (this.ipo) this.ipo.goldenShares = num;
    if (this.prestige) this.prestige.shares = num;
  }

  isSectorUnlocked(id) {
    if (id === "central_base" || id === "base") return true;
    if (id === "marine_terminal" || id === "marine_port" || id === "port" || id === "terminal") {
      return Boolean(this.marineTerminal?.unlocked || (this.unlockedSectors && (this.unlockedSectors.marine_terminal || this.unlockedSectors.marine_port || this.unlockedSectors.port || this.unlockedSectors.terminal)));
    }
    if (!this.unlockedSectors) return false;
    if (Array.isArray(this.unlockedSectors)) {
      return this.unlockedSectors.includes(id) || (id === "storage_park" && this.unlockedSectors.includes("storage")) || (id === "storage" && this.unlockedSectors.includes("storage_park"));
    }
    if (this.unlockedSectors[id] !== undefined) return Boolean(this.unlockedSectors[id]);
    if (id === "storage_park" && this.unlockedSectors.storage !== undefined) return Boolean(this.unlockedSectors.storage);
    if (id === "storage" && this.unlockedSectors.storage_park !== undefined) return Boolean(this.unlockedSectors.storage_park);
    return false;
  }

  unlockSector(id) {
    if (!CONFIG.SECTORS || (!CONFIG.SECTORS[id] && !((id === "storage_park" && CONFIG.SECTORS.storage) || (id === "storage" && CONFIG.SECTORS.storage_park)))) return false;
    if (this.isSectorUnlocked(id)) return true;
    const secDef = CONFIG.SECTORS[id] || (id === "storage_park" ? CONFIG.SECTORS.storage : null) || (id === "storage" ? CONFIG.SECTORS.storage_park : null);
    const cost = secDef ? secDef.cost : 0;
    if (cost > 0 && (this.money || 0) < cost) return false;
    if (cost === 0 || this.spendMoney(cost)) {
      if (Array.isArray(this.unlockedSectors)) {
        if (!this.unlockedSectors.includes(id)) this.unlockedSectors.push(id);
        if (id === "storage_park" && !this.unlockedSectors.includes("storage")) this.unlockedSectors.push("storage");
        if (id === "storage" && !this.unlockedSectors.includes("storage_park")) this.unlockedSectors.push("storage_park");
      } else {
        if (!this.unlockedSectors) this.unlockedSectors = { central_base: true, base: true };
        this.unlockedSectors[id] = true;
        if (id === "storage_park") this.unlockedSectors.storage = true;
        if (id === "storage") this.unlockedSectors.storage_park = true;
      }
      if (id === "marine_terminal" || id === "marine_port" || id === "port" || id === "terminal") {
        if (!this.marineTerminal) {
          this.marineTerminal = { unlocked: true, tankerState: "idle", state: "idle", berthLevel: 1, cargoCapacity: 2000, cargo: { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 }, cargoLoaded: 0, stageTimer: 0, voyageProgress: 0.0, voyageTimer: 0, voyageDuration: 60.0, totalVoyages: 0, totalExportRevenue: { rubles: 0, dollars: 0, goldenShares: 0 } };
        } else {
          this.marineTerminal.unlocked = true;
        }
        this.emit("marineTerminalUnlocked", { sectorId: id, sector: secDef });
      }
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("sectorUnlocked", { sectorId: id, sector: secDef });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  unlockMarineTerminal() {
    return this.unlockSector("marine_terminal");
  }

  getRefineryUpgradeCost() {
    const lvl = this.refineryLevel || 1;
    const max = CONFIG.REFINERY?.maxLevel || 4;
    if (lvl >= max) return Infinity;
    const costs = CONFIG.REFINERY?.upgradeCosts || { 1: 75000, 2: 200000, 3: 500000 };
    return costs[lvl] || Infinity;
  }

  canUpgradeRefinery() {
    if ((this.refineryLevel || 1) >= (CONFIG.REFINERY?.maxLevel || 4)) return false;
    return (this.money || 0) >= this.getRefineryUpgradeCost();
  }

  upgradeRefinery() {
    if (!this.canUpgradeRefinery()) return false;
    const cost = this.getRefineryUpgradeCost();
    if (this.spendMoney(cost)) {
      this.refineryLevel = (this.refineryLevel || 1) + 1;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("refineryUpgraded", { level: this.refineryLevel });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  getGasPlantUpgradeCost() {
    const lvl = this.gasPlantLevel || 1;
    const max = CONFIG.GAS_PLANT?.maxLevel || 4;
    if (lvl >= max) return Infinity;
    const costs = CONFIG.GAS_PLANT?.upgradeCosts || { 1: 150000, 2: 350000, 3: 750000 };
    return costs[lvl] || Infinity;
  }

  canUpgradeGasPlant() {
    if ((this.gasPlantLevel || 1) >= (CONFIG.GAS_PLANT?.maxLevel || 4)) return false;
    return (this.money || 0) >= this.getGasPlantUpgradeCost();
  }

  upgradeGasPlant() {
    if (!this.canUpgradeGasPlant()) return false;
    const cost = this.getGasPlantUpgradeCost();
    if (this.spendMoney(cost)) {
      this.gasPlantLevel = (this.gasPlantLevel || 1) + 1;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("gasPlantUpgraded", { level: this.gasPlantLevel });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  getPetrochemUpgradeCost() {
    const lvl = this.petrochemLevel || 1;
    const max = CONFIG.PETROCHEM?.maxLevel || 4;
    if (lvl >= max) return Infinity;
    const costs = CONFIG.PETROCHEM?.upgradeCosts || { 1: 300000, 2: 650000, 3: 1200000 };
    return costs[lvl] || Infinity;
  }

  canUpgradePetrochem() {
    if ((this.petrochemLevel || 1) >= (CONFIG.PETROCHEM?.maxLevel || 4)) return false;
    return (this.money || 0) >= this.getPetrochemUpgradeCost();
  }

  upgradePetrochem() {
    if (!this.canUpgradePetrochem()) return false;
    const cost = this.getPetrochemUpgradeCost();
    if (this.spendMoney(cost)) {
      this.petrochemLevel = (this.petrochemLevel || 1) + 1;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("petrochemUpgraded", { level: this.petrochemLevel });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  getRvsParkUpgradeCost() {
    const lvl = this.rvsParkLevel || 1;
    const max = CONFIG.RVS_PARK?.maxLevel || 4;
    if (lvl >= max) return Infinity;
    const costs = CONFIG.RVS_PARK?.upgradeCosts || { 1: 200000, 2: 450000, 3: 900000 };
    return costs[lvl] || Infinity;
  }

  canUpgradeRvsPark() {
    if ((this.rvsParkLevel || 1) >= (CONFIG.RVS_PARK?.maxLevel || 4)) return false;
    return (this.money || 0) >= this.getRvsParkUpgradeCost();
  }

  upgradeRvsPark() {
    if (!this.canUpgradeRvsPark()) return false;
    const cost = this.getRvsParkUpgradeCost();
    if (this.spendMoney(cost)) {
      this.rvsParkLevel = (this.rvsParkLevel || 1) + 1;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("rvsParkUpgraded", { level: this.rvsParkLevel });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  getBerthUpgradeCost() {
    const lvl = this.marineTerminal?.berthLevel || 1;
    if (lvl >= 4) return Infinity;
    const costs = CONFIG.TANKER?.BERTH_UPGRADE_COSTS || { 1: 150000, 2: 350000, 3: 800000 };
    return costs[lvl] || Infinity;
  }

  canUpgradeBerth() {
    if ((this.marineTerminal?.berthLevel || 1) >= 4) return false;
    return (this.money || 0) >= this.getBerthUpgradeCost();
  }

  upgradeBerth() {
    if (!this.canUpgradeBerth()) return false;
    const cost = this.getBerthUpgradeCost();
    if (this.spendMoney(cost)) {
      this.marineTerminal.berthLevel = (this.marineTerminal.berthLevel || 1) + 1;
      if (this.marineTerminal.capacityLevel !== undefined) {
        this.marineTerminal.capacityLevel = Math.min(5, this.marineTerminal.berthLevel);
      }
      this.getTankerCargoCapacity();
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("berthUpgraded", { level: this.marineTerminal.berthLevel });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  // Tanker Capacity Upgrades (Levels 1 to 5: 2,000 to 12,000 bbl)
  getTankerCapacityLevel() {
    return Math.max(1, Math.min(CONFIG.TANKER?.MAX_CAPACITY_LEVEL || 5, this.marineTerminal?.capacityLevel || this.marineTerminal?.berthLevel || 1));
  }

  getTankerCapacityUpgradeCost() {
    const lvl = this.getTankerCapacityLevel();
    if (lvl >= (CONFIG.TANKER?.MAX_CAPACITY_LEVEL || 5)) return Infinity;
    const costs = CONFIG.TANKER?.CAPACITY_UPGRADE_COSTS || { 1: 150000, 2: 400000, 3: 1000000, 4: 2500000 };
    return costs[lvl] || Infinity;
  }

  canUpgradeTankerCapacity() {
    if (this.getTankerCapacityLevel() >= (CONFIG.TANKER?.MAX_CAPACITY_LEVEL || 5)) return false;
    return (this.money || 0) >= this.getTankerCapacityUpgradeCost();
  }

  upgradeTankerCapacity() {
    if (!this.canUpgradeTankerCapacity()) return false;
    const cost = this.getTankerCapacityUpgradeCost();
    if (this.spendMoney(cost)) {
      const nextLvl = this.getTankerCapacityLevel() + 1;
      this.marineTerminal.capacityLevel = nextLvl;
      this.marineTerminal.berthLevel = Math.min(4, nextLvl);
      this.getTankerCargoCapacity();
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("tankerUpgraded", { type: "capacity", level: nextLvl });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  // Tanker Voyage Speed Upgrades (Levels 1 to 5: 60s down to 15s)
  getTankerSpeedLevel() {
    return Math.max(1, Math.min(CONFIG.TANKER?.MAX_SPEED_LEVEL || 5, this.marineTerminal?.speedLevel || 1));
  }

  getTankerVoyageDuration() {
    const lvl = this.getTankerSpeedLevel();
    return CONFIG.TANKER?.SPEED_DURATIONS?.[lvl - 1] || (this.marineTerminal?.voyageDuration || 60.0);
  }

  getTankerSpeedUpgradeCost() {
    const lvl = this.getTankerSpeedLevel();
    if (lvl >= (CONFIG.TANKER?.MAX_SPEED_LEVEL || 5)) return Infinity;
    const costs = CONFIG.TANKER?.SPEED_UPGRADE_COSTS || { 1: 100000, 2: 250000, 3: 650000, 4: 1600000 };
    return costs[lvl] || Infinity;
  }

  canUpgradeTankerSpeed() {
    if (this.getTankerSpeedLevel() >= (CONFIG.TANKER?.MAX_SPEED_LEVEL || 5)) return false;
    return (this.money || 0) >= this.getTankerSpeedUpgradeCost();
  }

  upgradeTankerSpeed() {
    if (!this.canUpgradeTankerSpeed()) return false;
    const cost = this.getTankerSpeedUpgradeCost();
    if (this.spendMoney(cost)) {
      const nextLvl = this.getTankerSpeedLevel() + 1;
      this.marineTerminal.speedLevel = nextLvl;
      const dur = this.getTankerVoyageDuration();
      this.marineTerminal.voyageDuration = dur;
      if (this.tanker) this.tanker.voyageDuration = dur;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("tankerUpgraded", { type: "speed", level: nextLvl, voyageDuration: dur });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  getTankerCargoCapacity() {
    let baseCap;
    if (this.marineTerminal?.capacityLevel !== undefined) {
      const capLvl = Math.max(1, Math.min(CONFIG.TANKER?.MAX_CAPACITY_LEVEL || 5, this.marineTerminal.capacityLevel));
      baseCap = CONFIG.TANKER?.CAPACITY_VALUES?.[capLvl - 1] || (2000 + (capLvl - 1) * 2500);
    } else {
      const berthLvl = Math.max(1, Math.min(4, this.marineTerminal?.berthLevel || 1));
      baseCap = (CONFIG.TANKER?.BASE_CAPACITY || 2000) +
                (berthLvl - 1) * (CONFIG.TANKER?.BERTH_CAPACITY_PER_LEVEL || 500);
    }
    const aframaxLvl = typeof this.getTechLevel === "function" ? this.getTechLevel("tech_aframax") : 0;
    const aframaxMult = 1.0 + aframaxLvl * (CONFIG.TECHNOLOGIES?.tech_aframax?.effectPerLevel || 0.20);
    const capacity = Math.round(baseCap * aframaxMult);
    if (this.marineTerminal) this.marineTerminal.cargoCapacity = capacity;
    if (this.tanker) this.tanker.cargoCapacity = capacity;
    return capacity;
  }

  loadTankerCargo(commodityKey, requestedAmount) {
    if (!this.inventory || !this.marineTerminal) return 0;
    if (requestedAmount !== undefined && (typeof requestedAmount !== "number" || !Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
      return 0;
    }
    const available = this.inventory[commodityKey] || 0;
    if (available <= 0 || !Number.isFinite(available)) return 0;

    const capacity = this.getTankerCargoCapacity();
    const currentCargo = Object.values(this.marineTerminal.cargo || {}).reduce((s, v) => s + (v || 0), 0);
    const remainingHoldSpace = Math.max(0, capacity - currentCargo);
    if (remainingHoldSpace <= 0) return 0;

    const safeRequested = (requestedAmount !== undefined && Number.isFinite(requestedAmount)) ? requestedAmount : available;
    const toLoad = Math.min(available, remainingHoldSpace, safeRequested);
    if (!Number.isFinite(toLoad) || toLoad <= 0) return 0;

    this.inventory[commodityKey] -= toLoad;
    if (this.oilStorageCurrent !== undefined && (commodityKey.startsWith("fuel_") || commodityKey === "rawOil")) {
      this._oilStorageCurrent = Math.max(0, (this._oilStorageCurrent || 0) - toLoad);
    }

    if (!this.marineTerminal.cargo) {
      this.marineTerminal.cargo = { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 };
    }
    this.marineTerminal.cargo[commodityKey] = (this.marineTerminal.cargo[commodityKey] || 0) + toLoad;
    const newTotal = Object.values(this.marineTerminal.cargo).reduce((s, v) => s + (v || 0), 0);
    this.marineTerminal.cargoLoaded = newTotal;
    if (this.tanker) {
      this.tanker.currentCargo = newTotal;
      this.tanker.cargoType = commodityKey;
      this.tanker.cargoManifest = { ...this.marineTerminal.cargo };
    }

    this.emit("tankerCargoLoaded", {
      commodity: commodityKey,
      amount: toLoad,
      currentCargo: newTotal,
      cargoCapacity: capacity
    });
    return toLoad;
  }

  autoLoadTankerCargo() {
    if (!this.inventory || !this.marineTerminal) return 0;
    const capacity = this.getTankerCargoCapacity();
    let totalLoaded = 0;
    const priority = CONFIG.TANKER?.CARGO_PRIORITY || [
      "polymers", "petrochem", "fuel_ai100", "fuel_ai98", "fuel_ai95", "fuel_ai92", "rawOil"
    ];

    for (let i = 0; i < priority.length; i++) {
      const key = priority[i];
      const cur = Object.values(this.marineTerminal.cargo || {}).reduce((s, v) => s + (v || 0), 0);
      if (cur >= capacity) break;
      const loaded = this.loadTankerCargo(key);
      totalLoaded += loaded;
    }
    return totalLoaded;
  }

  setTankerState(nextState) {
    if (!this.marineTerminal) return;
    const oldState = this.marineTerminal.tankerState || this.marineTerminal.state;
    this.marineTerminal.tankerState = nextState;
    this.marineTerminal.state = nextState;
    this.marineTerminal.stageTimer = 0;
    if (this.tanker) {
      this.tanker.state = nextState;
      this.tanker.stage = nextState;
      this.tanker.stateTimer = 0;
    }
    this.emit("tankerStateChanged", {
      from: oldState,
      to: nextState,
      state: nextState,
      tankerState: nextState
    });
  }

  dispatchTankerExport(cargoSpec) {
    if (!this.marineTerminal || !this.marineTerminal.unlocked) return false;
    const currentState = this.marineTerminal.tankerState || this.marineTerminal.state;
    if (currentState !== "idle") return false;

    if (!cargoSpec || typeof cargoSpec !== "object") return false;
    const keys = Object.keys(cargoSpec);
    let totalRequested = 0;
    for (const k of keys) {
      const amt = Number(cargoSpec[k]) || 0;
      if (amt < 0) return false;
      totalRequested += amt;
    }
    if (totalRequested <= 0) return false;

    const capacity = this.getTankerCargoCapacity();
    if (totalRequested > capacity) return false;

    for (const k of keys) {
      const amt = Number(cargoSpec[k]) || 0;
      if (amt <= 0) continue;
      if ((this.inventory?.[k] || 0) < amt) return false;
    }

    if (!this.marineTerminal.cargo) {
      this.marineTerminal.cargo = { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 };
    }
    for (const k of keys) {
      const amt = Number(cargoSpec[k]) || 0;
      if (amt <= 0) continue;
      this.inventory[k] -= amt;
      if (this.oilStorageCurrent !== undefined && (k.startsWith("fuel_") || k === "rawOil")) {
        this._oilStorageCurrent = Math.max(0, (this._oilStorageCurrent || 0) - amt);
      }
      this.marineTerminal.cargo[k] = (this.marineTerminal.cargo[k] || 0) + amt;
    }

    const totalHeld = Object.values(this.marineTerminal.cargo).reduce((s, v) => s + (v || 0), 0);
    this.marineTerminal.cargoLoaded = totalHeld;
    if (this.tanker) {
      this.tanker.currentCargo = totalHeld;
      this.tanker.cargoManifest = { ...this.marineTerminal.cargo };
      this.tanker.state = "approaching";
      this.tanker.stage = "approaching";
      this.tanker.stateTimer = 0;
    }

    const vDur = typeof this.getTankerVoyageDuration === "function" ? this.getTankerVoyageDuration() : (this.marineTerminal.voyageDuration || 60.0);
    this.marineTerminal.tankerState = "approaching";
    this.marineTerminal.state = "approaching";
    this.marineTerminal.stageTimer = 0;
    this.marineTerminal.voyageProgress = 0.0;
    this.marineTerminal.voyageDuration = vDur;
    this.marineTerminal.voyageTimer = vDur;

    this.emit("tankerStateChanged", { state: "approaching", from: "idle", tankerState: "approaching" });
    return true;
  }

  dispatchTanker(cargoType, amount) {
    if (!this.marineTerminal) return false;
    if (!cargoType && !this.marineTerminal.unlocked) {
      this.marineTerminal.unlocked = true;
    }
    const currentState = this.marineTerminal.tankerState || this.marineTerminal.state;
    if (currentState !== "idle") return false;
    if (!this.marineTerminal.unlocked) return false;

    if (cargoType && typeof cargoType === "string") {
      return this.dispatchTankerExport({ [cargoType]: amount });
    } else {
      this.autoLoadTankerCargo();
      const totalHeld = Object.values(this.marineTerminal.cargo || {}).reduce((s, v) => s + (v || 0), 0);
      if (totalHeld > 0) {
        const vDur = typeof this.getTankerVoyageDuration === "function" ? this.getTankerVoyageDuration() : (this.marineTerminal.voyageDuration || 60.0);
        this.marineTerminal.cargoLoaded = totalHeld;
        this.marineTerminal.tankerState = "approaching";
        this.marineTerminal.state = "approaching";
        this.marineTerminal.stageTimer = 0;
        this.marineTerminal.voyageProgress = 0.0;
        this.marineTerminal.voyageDuration = vDur;
        this.marineTerminal.voyageTimer = vDur;
        if (this.tanker) {
          this.tanker.state = "approaching";
          this.tanker.stage = "approaching";
          this.tanker.stateTimer = 0;
          this.tanker.voyageDuration = vDur;
          this.tanker.voyageTimer = vDur;
        }
        this.emit("tankerStateChanged", { state: "approaching", from: "idle", tankerState: "approaching" });
        return true;
      }
      return false;
    }
  }

  advanceTankerFSM(dt) {
    if (!this.marineTerminal) return;
    if (this.isPaused || typeof dt !== "number" || isNaN(dt) || dt <= 0) return;
    const durations = CONFIG.TANKER?.DURATIONS || {
      idle: 15.0, approaching: 5.0, berthing: 3.0, loading: 5.0, departing: 5.0, voyage: 60.0, returned: 1.0
    };

    if (this.marineTerminal.state && this.marineTerminal.state !== this.marineTerminal.tankerState) {
      if (this.marineTerminal.state !== "idle") {
        this.marineTerminal.tankerState = this.marineTerminal.state;
      } else if (this.marineTerminal.tankerState) {
        this.marineTerminal.state = this.marineTerminal.tankerState;
      }
    }
    const curState = this.marineTerminal.tankerState || this.marineTerminal.state || "idle";

    switch (curState) {
      case "idle": {
        this.marineTerminal.stageTimer = (this.marineTerminal.stageTimer || 0) + dt;
        if (this.tanker) this.tanker.stateTimer = this.marineTerminal.stageTimer;
        const autoInterval = CONFIG.TANKER?.AUTO_DISPATCH_INTERVAL_SEC || 20.0;
        if (this.tanker?.autoDispatch && this.marineTerminal.stageTimer >= autoInterval) {
          if (this.autoLoadTankerCargo() > 0) {
            this.marineTerminal.tankerState = "approaching";
            this.marineTerminal.state = "approaching";
            this.marineTerminal.stageTimer = 0;
            if (this.tanker) {
              this.tanker.state = "approaching";
              this.tanker.stage = "approaching";
              this.tanker.stateTimer = 0;
            }
            this.emit("tankerStateChanged", { state: "approaching", from: "idle", tankerState: "approaching" });
          }
        }
        break;
      }
      case "approaching": {
        this.marineTerminal.stageTimer = (this.marineTerminal.stageTimer || 0) + dt;
        if (this.tanker) this.tanker.stateTimer = this.marineTerminal.stageTimer;
        if (this.marineTerminal.stageTimer >= (durations.approaching || 5.0)) {
          this.marineTerminal.tankerState = "berthing";
          this.marineTerminal.state = "berthing";
          this.marineTerminal.stageTimer = 0;
          if (this.tanker) {
            this.tanker.state = "berthing";
            this.tanker.stage = "berthing";
            this.tanker.stateTimer = 0;
          }
          this.emit("tankerStateChanged", { state: "berthing", from: "approaching", tankerState: "berthing" });
        }
        break;
      }
      case "berthing": {
        this.marineTerminal.stageTimer = (this.marineTerminal.stageTimer || 0) + dt;
        if (this.tanker) this.tanker.stateTimer = this.marineTerminal.stageTimer;
        if (this.marineTerminal.stageTimer >= (durations.berthing || 3.0)) {
          this.marineTerminal.tankerState = "loading";
          this.marineTerminal.state = "loading";
          this.marineTerminal.stageTimer = 0;
          if (this.tanker) {
            this.tanker.state = "loading";
            this.tanker.stage = "loading";
            this.tanker.stateTimer = 0;
          }
          this.emit("tankerStateChanged", { state: "loading", from: "berthing", tankerState: "loading" });
        }
        break;
      }
      case "loading": {
        this.marineTerminal.stageTimer = (this.marineTerminal.stageTimer || 0) + dt;
        if (this.tanker) this.tanker.stateTimer = this.marineTerminal.stageTimer;
        if (this.marineTerminal.stageTimer >= (durations.loading || 5.0)) {
          this.marineTerminal.tankerState = "departing";
          this.marineTerminal.state = "departing";
          this.marineTerminal.stageTimer = 0;
          if (this.tanker) {
            this.tanker.state = "departing";
            this.tanker.stage = "departing";
            this.tanker.stateTimer = 0;
          }
          this.emit("tankerStateChanged", { state: "departing", from: "loading", tankerState: "departing" });
          this.emit("tankerDeparted", {
            cargo: this.marineTerminal.cargo,
            voyageDuration: durations.voyage || 60.0
          });
        }
        break;
      }
      case "departing": {
        this.marineTerminal.stageTimer = (this.marineTerminal.stageTimer || 0) + dt;
        if (this.tanker) this.tanker.stateTimer = this.marineTerminal.stageTimer;
        if (this.marineTerminal.stageTimer >= (durations.departing || 5.0)) {
          const vDur = typeof this.getTankerVoyageDuration === "function" ? this.getTankerVoyageDuration() : (this.marineTerminal.voyageDuration || durations.voyage || 60.0);
          this.marineTerminal.tankerState = "voyage";
          this.marineTerminal.state = "voyage";
          this.marineTerminal.stageTimer = 0;
          this.marineTerminal.voyageDuration = vDur;
          this.marineTerminal.voyageTimer = vDur;
          this.marineTerminal.voyageProgress = 0.0;
          if (this.tanker) {
            this.tanker.state = "voyage";
            this.tanker.stage = "voyage";
            this.tanker.stateTimer = 0;
            this.tanker.voyageDuration = vDur;
            this.tanker.voyageTimer = vDur;
          }
          this.emit("tankerStateChanged", { state: "voyage", from: "departing", tankerState: "voyage" });
        }
        break;
      }
      case "voyage": {
        const vDur = this.marineTerminal.voyageDuration || durations.voyage || 60.0;
        this.marineTerminal.voyageTimer = Math.max(0, (this.marineTerminal.voyageTimer || vDur) - dt);
        const progress = Math.max(0, Math.min(1.0, 1.0 - (this.marineTerminal.voyageTimer / vDur)));
        this.marineTerminal.voyageProgress = progress;
        if (this.tanker) {
          this.tanker.voyageTimer = this.marineTerminal.voyageTimer;
        }

        if (this.marineTerminal.voyageTimer <= 0.001) {
          this.marineTerminal.tankerState = "returned";
          this.marineTerminal.state = "returned";
          this.completeTankerVoyage();
        }
        break;
      }
      case "returned": {
        this.completeTankerVoyage();
        break;
      }
      default:
        this.marineTerminal.tankerState = "idle";
        this.marineTerminal.state = "idle";
        break;
    }
  }

  tickMarineExport(dt) {
    if (!this.marineTerminal || !this.marineTerminal.unlocked) return;
    if (this.isPaused || typeof dt !== "number" || isNaN(dt) || dt <= 0) return;
    this.advanceTankerFSM(dt);
  }

  tickTanker(dt) {
    this.tickMarineExport(dt);
  }

  completeVoyage() {
    return this.completeTankerVoyage();
  }

  completeTankerVoyage() {
    if (!this.marineTerminal) return null;
    const manifest = this.marineTerminal.cargo || {};
    const premiumMult = CONFIG.TANKER?.EXPORT_PREMIUM_MULTIPLIER || 1.60;
    const dollarRates = CONFIG.TANKER?.DOLLAR_RATES || {
      fuel_ai92: 0.04, fuel_ai95: 0.05, fuel_ai98: 0.06, fuel_ai100: 0.08, polymers: 0.12, petrochem: 0.15, rawOil: 0.03
    };

    let totalRubles = 0;
    let totalDollars = 0;
    let totalCargo = 0;

    const commodities = Object.keys(manifest);
    for (let i = 0; i < commodities.length; i++) {
      const key = commodities[i];
      const qty = manifest[key] || 0;
      if (qty <= 0) continue;
      totalCargo += qty;

      let basePrice = 75.0;
      if (CONFIG.FUELS?.[key]?.wholesalePrice) {
        basePrice = CONFIG.FUELS[key].wholesalePrice;
      } else if (CONFIG.PETROCHEM?.prices?.[key]) {
        basePrice = CONFIG.PETROCHEM.prices[key];
      } else if (CONFIG.EXCHANGE?.BASE_OIL_PRICE) {
        basePrice = CONFIG.EXCHANGE.BASE_OIL_PRICE;
      }

      const isOilCommodity = key.startsWith("fuel_") || key === "rawOil";
      const eventMult = isOilCommodity ? (this.market?.oilMultiplier || 1.0) : 1.0;

      const rubleItem = qty * basePrice * premiumMult * eventMult;
      totalRubles += rubleItem;

      const dRate = dollarRates[key] || 0.04;
      totalDollars += qty * dRate;
    }

    if (typeof this.getTechLevel === "function" && this.getTechLevel("tech_lng_term") > 0) {
      totalDollars *= (1.0 + (CONFIG.TECHNOLOGIES?.tech_lng_term?.effect || 0.35));
    }
    let finalDollars = Math.round(totalDollars);
    if (totalDollars > 0 && finalDollars === 0) finalDollars = 1;

    let goldenSharesAward = 0;
    if (totalCargo > 0) {
      goldenSharesAward = Math.max(1, Math.floor(totalCargo / (CONFIG.TANKER?.GOLDEN_SHARES_PER_CARGO || 500)));
    }

    if (totalRubles > 0) {
      this.money = (this.money || 0) + totalRubles;
      this.totalEarned = (this.totalEarned || 0) + totalRubles;
      this.emit("moneyChanged", { money: this.money, delta: totalRubles });
    }
    if (finalDollars > 0) {
      this.addDollars(finalDollars);
    }
    if (goldenSharesAward > 0) {
      if (typeof this.addGoldenShares === "function") {
        this.addGoldenShares(goldenSharesAward);
      } else {
        this.goldenShares = (this.goldenShares || 0) + goldenSharesAward;
      }
    }

    this.marineTerminal.totalVoyages = (this.marineTerminal.totalVoyages || 0) + 1;
    if (!this.marineTerminal.totalExportRevenue) {
      this.marineTerminal.totalExportRevenue = { rubles: 0, dollars: 0, goldenShares: 0 };
    }
    this.marineTerminal.totalExportRevenue.rubles = (this.marineTerminal.totalExportRevenue.rubles || 0) + totalRubles;
    this.marineTerminal.totalExportRevenue.dollars = (this.marineTerminal.totalExportRevenue.dollars || 0) + finalDollars;
    this.marineTerminal.totalExportRevenue.goldenShares = (this.marineTerminal.totalExportRevenue.goldenShares || 0) + goldenSharesAward;

    this.marineTerminal.cargo = {
      fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0
    };
    this.marineTerminal.cargoLoaded = 0;
    this.marineTerminal.tankerState = "idle";
    this.marineTerminal.state = "idle";
    this.marineTerminal.voyageProgress = 0.0;
    this.marineTerminal.voyageTimer = 0;

    if (this.tanker) {
      this.tanker.currentCargo = 0;
      this.tanker.cargoType = null;
      this.tanker.cargoManifest = { ...this.marineTerminal.cargo };
      this.tanker.state = "idle";
      this.tanker.stage = "idle";
      this.tanker.totalVoyages = this.marineTerminal.totalVoyages;
      this.tanker.totalRevenueExport = this.marineTerminal.totalExportRevenue.rubles;
      this.tanker.totalExportDollars = this.marineTerminal.totalExportRevenue.dollars;
    }

    const rewardSummary = {
      rubles: totalRubles,
      dollars: finalDollars,
      goldenShares: goldenSharesAward,
      totalCargo,
      cargoManifest: { ...manifest },
      totalVoyages: this.marineTerminal.totalVoyages
    };
    if (this.tanker) this.tanker.lastReward = rewardSummary;

    if (typeof audio?.playCoin === "function") audio.playCoin();
    this.emit("tankerVoyageCompleted", rewardSummary);
    this.emit("tankerStateChanged", { state: "idle", from: "returned", tankerState: "idle" });
    return rewardSummary;
  }
initDefaultWells(){this.wells={};CONFIG.WELLS.forEach(def=>{this.wells[def.id]={id:def.id,level:0,unlocked:def.unlockCost===0};});this.wellStimulation={};this.stimulationStats={totalStimulations:0,bestMultiplier:1.0,totalExtraMoneyEarned:0};this.mchsBoost={active:false,multiplier:1.5,remainingSec:0,totalDurationSec:180.0};    this.workerSynergy = 1.0;
    this.customRecipeSelected = { refinery: false, gas_plant: false, petrochem: false };
    this.industrialRecipes = { refinery: "ai92_focus", gas_plant: "balanced_gas", petrochem: "poly_standard" };
    this.inventory = { rawOil: 500, rawGas: 1000, fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, dryGas: 0, lpg: 0, helium: 0, polymers: 0, petrochem: 0 };this.unlockedSectors={central_base:true,base:true};this.refineryLevel=0;this.gasPlantLevel=0;this.petrochemLevel=0;this.rvsParkLevel=0;this.pipelineSalesRevenue=0;this.oilStorageCapacity=2000;this.loadingRackLevel=0;this.facilityLevel=0;this.canteenLevel=0;this.garageLevel=0;this.trekolCount=0;this.trekolRoverState=null;this.cryptoMiningActive=false;this.cryptoAdsWatched=0;this.specialization=null;this.wellMastery={well_1:{valve:false,purge:false,sensor:false},well_2:{valve:false,purge:false,sensor:false},well_3:{valve:false,purge:false,sensor:false},well_4:{valve:false,purge:false,sensor:false}};this.wellMaintenanceCooldowns={well_1:0,well_2:0,well_3:0,well_4:0};this.marineTerminal={unlocked:true,tankerState:"idle",state:"idle",berthLevel:1,capacityLevel:1,speedLevel:1,cargoCapacity:(CONFIG.TANKER&&CONFIG.TANKER.cargoCapacity)||2000,cargo:{fuel_ai92:0,fuel_ai95:0,fuel_ai98:0,fuel_ai100:0,polymers:0,petrochem:0,rawOil:0},cargoLoaded:0,stageTimer:0,voyageProgress:0.0,voyageTimer:0,voyageDuration:(CONFIG.TANKER&&CONFIG.TANKER.voyageDuration)||60.0,totalVoyages:0,totalExportRevenue:{rubles:0,dollars:0,goldenShares:0}};this.tanker={state:"idle",stage:"idle",cargoCapacity:2000,currentCargo:0,cargoType:null,cargo:this.marineTerminal.cargo,cargoManifest:this.marineTerminal.cargo,stateTimer:0,stateDuration:15.0,voyageTimer:0,voyageDuration:60.0,totalVoyages:0,totalRevenueExport:0,totalExportDollars:0,autoDispatch:false,lastReward:null};this.savelichLevel = 1;
    this.savelichXp = 0;
    this.settlement = {
      population: 24,
      maxPopulation: 40,
      housingLevel: 1,
      boilerLevel: 1,
      warmthLevel: 100.0,
      heatingStatus: "optimal",
      rationBoostSec: 0,
      growthTimer: 0,
      shifts: {
        wells: 8,
        refinery: 6,
        gas_plant: 5,
        petrochem: 5
      }
    };
    this.megaproject = {
      currentStage: 0,
      completed: false,
      activeSeason: "polar_day",
      seasonTimer: 300.0,
      endlessHorizonUnlocked: false,
      corporatePrestigeLevel: 1
    };
    this.contracts = [];
    this.mtrMaterials = 0;
    this.totalContractsFulfilled = 0;
    this.tutorialStep = 0;
    this.tutorialCompleted = false;
    this.ftueStep = 0;
    this.ftueCompleted = false;
    this.currentQuestIndex = 0;
    this.lastPurgeTime = 0;
    this.gatehouseLevel = 0;
    this.substationLevel = 0;
    this.fenceLevel = 0;
    this.mtrYardLevel = 0;
    this.compressorLevel = 0;
    this.gasTreatmentLevel = 0;
    this.dormitoryLevel = 0;
    this.quests = [
      { id: "upgrade_well", title: "Разбурите Скважину №1 на кустовой площадке", target: 1, current: 0, rewardMoney: 500000, rewardCrypto: 1, completed: false },
      { id: "upgrade_substation", title: "Энергоснабжение: подключите КТПН к сети", target: 1, current: 0, rewardMoney: 750000, rewardCrypto: 1, completed: false },
      { id: "upgrade_garage", title: "Транспортная база: расширьте Гараж АТБ", target: 1, current: 0, rewardMoney: 1000000, rewardCrypto: 1, completed: false },
      { id: "upgrade_canteen", title: "Быт вахты: обустройте Столовую & Посёлок", target: 1, current: 0, rewardMoney: 1500000, rewardCrypto: 1, completed: false },
      { id: "upgrade_savelich", title: "Повысьте разряд мастера цеха Савельича (Разряд 2)", target: 1, current: 0, rewardMoney: 2000000, rewardCrypto: 1, completed: false },
      { id: "block_blast", title: "Соберите коллектор в мини-игре Block Blast", target: 1, current: 0, rewardMoney: 5000000, rewardCrypto: 2, completed: false },
      { id: "world_map", title: "Откройте Офис разработки и изучите карту", target: 1, current: 0, rewardMoney: 25000000, rewardCrypto: 3, completed: false }
    ];
    this.territories = {
      yamal: { id: "yamal", name: "п-ов Ямал • Бованенково", continent: "russia", unlocked: true, cost: 0, debitBonus: 0.0, badge: "НУЛЕВАЯ ТОЧКА (БАЗА)", avatar: "🇷🇺", cups: 10, x: 44, y: 28 },
      east_achim: { id: "east_achim", name: "Восточный участок (Ачимовка)", continent: "russia", unlocked: false, cost: 250000, debitBonus: 0.25, badge: "ГЛУБОКИЙ ГОРИЗОНТ", avatar: "⚒️", cups: 8, x: 70, y: 38, requirement: "Требуется Выход на IPO" },
      north_shelf: { id: "north_shelf", name: "Северный шельф (Заполярье)", continent: "russia", unlocked: false, cost: 1000000, debitBonus: 0.50, badge: "ЛЕДОВЫЙ КЛАСС", avatar: "🚢", cups: 12, x: 65, y: 22, requirement: "Требуется Корпоративный Тир 2" },
      urengoy: { id: "urengoy", name: "Уренгой • Ачимовская толща", continent: "russia", unlocked: false, cost: 250000, debitBonus: 0.25, badge: "ГЛУБОКИЙ ГАЗ", avatar: "⚒️", cups: 8, x: 48, y: 38, requirement: "250 000 ₽" },
      kara_shelf: { id: "kara_shelf", name: "Карское море • Шельф «Победа»", continent: "russia", unlocked: false, cost: 1000000, debitBonus: 0.50, badge: "АРКТИЧЕСКИЙ ШЕЛЬФ", avatar: "🚢", cups: 15, x: 41, y: 18, requirement: "1 000 000 ₽" },
      chayanda: { id: "chayanda", name: "Восточная Сибирь • Чаянда", continent: "russia", unlocked: false, cost: 5000000, debitBonus: 0.75, badge: "СИЛА СИБИРИ", avatar: "🌲", cups: 20, x: 68, y: 46, requirement: "5 000 000 ₽" },
      sakhalin: { id: "sakhalin", name: "Сахалин-2 • Охотское море", continent: "russia", unlocked: false, cost: 15000000, debitBonus: 1.00, badge: "МОРСКАЯ ПЛАТФОРМА", avatar: "⚓", cups: 30, x: 88, y: 55, requirement: "15 000 000 ₽" },
      prirazlom: { id: "prirazlom", name: "Печорское море • Приразломное", continent: "russia", unlocked: false, cost: 40000000, debitBonus: 1.50, badge: "ЛЕДОСТОЙКАЯ МЛСП", avatar: "🧊", cups: 40, x: 33, y: 24, requirement: "40 000 000 ₽" },
      caspian: { id: "caspian", name: "Каспийский шельф • Месторождение Филановского", continent: "russia", unlocked: false, cost: 100000000, debitBonus: 2.00, badge: "ЮЖНЫЙ КЛАСТЕР", avatar: "☀️", cups: 50, x: 22, y: 64, requirement: "100 000 000 ₽" }
    };
  }

  getIndustrialRecipe(sectorId) {
    if (!CONFIG.RECIPES || !CONFIG.RECIPES[sectorId]) return null;
    if (!this.industrialRecipes) {
      this.industrialRecipes = { refinery: "ai92_focus", gas_plant: "balanced_gas", petrochem: "poly_standard" };
    }
    if (!this.customRecipeSelected?.[sectorId]) {
      if (sectorId === "refinery") {
        const lvl = Math.max(1, Math.min(4, this.refineryLevel || 1));
        const autoMap = { 1: "ai92_focus", 2: "ai95_focus", 3: "ai98_focus", 4: "ai100_focus" };
        return autoMap[lvl] || "ai92_focus";
      }
    }
    return this.industrialRecipes[sectorId] || (sectorId === "refinery" ? "ai92_focus" : sectorId === "gas_plant" ? "balanced_gas" : "poly_standard");
  }

  setIndustrialRecipe(sectorId, recipeId) {
    if (!this.industrialRecipes) {
      this.industrialRecipes = { refinery: "ai92_focus", gas_plant: "balanced_gas", petrochem: "poly_standard" };
    }
    if (!this.customRecipeSelected) {
      this.customRecipeSelected = { refinery: false, gas_plant: false, petrochem: false };
    }
    const def = CONFIG.RECIPES?.[sectorId]?.[recipeId];
    if (!def) return false;

    let sectorLvl = 1;
    if (sectorId === "refinery") sectorLvl = this.refineryLevel || 1;
    else if (sectorId === "gas_plant") sectorLvl = this.gasPlantLevel || 1;
    else if (sectorId === "petrochem") sectorLvl = this.petrochemLevel || 1;

    if (sectorLvl < (def.reqLevel || 1)) return false;

    this.customRecipeSelected[sectorId] = true;
    this.industrialRecipes[sectorId] = recipeId;
    this.emit("industrialRecipeChanged", { sector: sectorId, sectorId, recipeId, recipe: def });
    return true;
  }

  generateContract(slotIndex) {
    const factions = Object.values(CONFIG.CONTRACTS?.factions || {});
    if (factions.length === 0) return null;

    const faction = factions[(slotIndex + Math.floor(Math.random() * factions.length)) % factions.length];
    const refLvl = this.refineryLevel || 1;
    const gpLvl = this.gasPlantLevel || 1;
    const pcLvl = this.petrochemLevel || 1;
    const avgLvl = Math.max(1, Math.round((refLvl + gpLvl + pcLvl) / 3));

    const candidates = faction.preferredGoods || ["fuel_ai92", "rawOil"];
    const itemCount = Math.random() < 0.6 ? 1 : 2;
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const selectedKeys = shuffled.slice(0, Math.min(itemCount, shuffled.length));

    const requirements = {};
    let totalBaseValue = 0;

    for (const key of selectedKeys) {
      const uDef = CONFIG.CONTRACTS?.unitValues?.[key] || { price: 100, name: key };
      let baseQty = 15 + Math.floor(Math.random() * 25);
      if (avgLvl >= 2) baseQty = 40 + Math.floor(Math.random() * 60);
      if (avgLvl >= 3) baseQty = 100 + Math.floor(Math.random() * 150);
      if (avgLvl >= 4) baseQty = 250 + Math.floor(Math.random() * 350);

      if (key === "helium") baseQty = Math.max(5, Math.floor(baseQty * 0.15));
      else if (key === "fuel_ai100") baseQty = Math.max(10, Math.floor(baseQty * 0.4));

      requirements[key] = baseQty;
      totalBaseValue += baseQty * (uDef.price || 100);
    }

    const moneyBonus = faction.moneyBonus || 1.15;
    const totalMoney = Math.round(totalBaseValue * moneyBonus);
    const mtrBonus = faction.mtrBonus || 1;
    const totalMtr = Math.max(1, Math.round(mtrBonus * (1 + (avgLvl - 1) * 0.5)));
    const xpReward = 15 + avgLvl * 10;

    return {
      id: `contract_${Date.now()}_${slotIndex}_${Math.floor(Math.random() * 1000)}`,
      slotIndex,
      factionId: faction.id,
      factionName: faction.name,
      factionBadge: faction.badge,
      factionIcon: faction.icon,
      factionColor: faction.color,
      requirements,
      reward: {
        money: totalMoney,
        mtr: totalMtr,
        xp: xpReward
      },
      status: "ready",
      timer: 0,
      totalDuration: 0,
      createdAt: Date.now()
    };
  }

  getContracts() {
    if (!this.contracts) this.contracts = [];
    const maxSlots = CONFIG.CONTRACTS?.maxSlots || 6;
    while (this.contracts.length < maxSlots) {
      const slotIdx = this.contracts.length;
      this.contracts.push(this.generateContract(slotIdx));
    }
    return this.contracts;
  }

  canFulfillContract(contractId) {
    const contracts = this.getContracts();
    const contract = contracts.find(c => c && c.id === contractId);
    if (!contract || contract.status !== "ready") return false;

    if (!this.inventory) return false;
    for (const [key, reqQty] of Object.entries(contract.requirements || {})) {
      if ((this.inventory[key] || 0) < reqQty) {
        return false;
      }
    }
    return true;
  }

  fulfillContract(contractId) {
    const contracts = this.getContracts();
    const contract = contracts.find(c => c && c.id === contractId);
    if (!contract || !this.canFulfillContract(contractId)) return false;

    for (const [key, reqQty] of Object.entries(contract.requirements || {})) {
      this.inventory[key] = Math.max(0, (this.inventory[key] || 0) - reqQty);
    }

    const rew = contract.reward || {};
    if (rew.money) this.addMoney(rew.money);
    if (rew.mtr) {
      this.mtrMaterials = (this.mtrMaterials || 0) + rew.mtr;
      this.emit("mtrChanged", { mtr: this.mtrMaterials, delta: rew.mtr });
    }
    if (rew.xp) {
      this.savelichXp = (this.savelichXp || 0) + rew.xp;
    }
    this.totalContractsFulfilled = (this.totalContractsFulfilled || 0) + 1;

    const delivDuration = CONFIG.CONTRACTS?.deliveryDurationSec || 15.0;
    contract.status = "delivering";
    contract.timer = delivDuration;
    contract.totalDuration = delivDuration;

    if (typeof audio?.playPayout === "function") audio.playPayout();
    this.emit("contractFulfilled", { contract, reward: rew });
    this.emit("inventoryChanged", this.inventory);
    return true;
  }

  dismissContract(contractId) {
    const contracts = this.getContracts();
    const contract = contracts.find(c => c && c.id === contractId);
    if (!contract || contract.status !== "ready") return false;

    const cooldownSec = CONFIG.CONTRACTS?.refreshCooldownSec || 90.0;
    contract.status = "cooldown";
    contract.timer = cooldownSec;
    contract.totalDuration = cooldownSec;

    if (typeof audio?.playTap === "function") audio.playTap();
    this.emit("contractDismissed", { contract });
    return true;
  }

  speedUpContractSlot(contractId) {
    const contracts = this.getContracts();
    const contract = contracts.find(c => c && c.id === contractId);
    if (!contract) return false;

    if (contract.status === "cooldown" || contract.status === "delivering") {
      const slotIdx = contract.slotIndex;
      const newContract = this.generateContract(slotIdx);
      const idx = contracts.findIndex(c => c.id === contractId);
      if (idx >= 0) {
        contracts[idx] = newContract;
      }
      this.emit("contractSpawned", { contract: newContract, slotIndex: slotIdx });
      return true;
    }
    return false;
  }

  tickContracts(dt) {
    if (!this.contracts || !Array.isArray(this.contracts)) return;
    for (let i = 0; i < this.contracts.length; i++) {
      const c = this.contracts[i];
      if (!c) continue;

      if (c.status === "delivering") {
        c.timer -= dt;
        if (c.timer <= 0) {
          const cooldownSec = 45.0;
          c.status = "cooldown";
          c.timer = cooldownSec;
          c.totalDuration = cooldownSec;
          this.emit("contractDelivered", { contract: c });
        }
      } else if (c.status === "cooldown") {
        c.timer -= dt;
        if (c.timer <= 0) {
          const fresh = this.generateContract(c.slotIndex);
          this.contracts[i] = fresh;
          this.emit("contractSpawned", { contract: fresh, slotIndex: c.slotIndex });
        }
      }
    }
  }

  // --- WORKER SETTLEMENT «СЕВЕРНАЯ ЗВЕЗДА» (TOWNSHIP M3) ---
  getSettlementBonus(sector) {
    if (!this.settlement) return 1.0;
    const workers = (this.settlement.shifts && this.settlement.shifts[sector]) || 0;
    const effPerWorker = (CONFIG.SETTLEMENT?.shiftEfficiency?.[sector]) || 0.02;

    let thermalFactor = 1.0;
    const warmth = typeof this.settlement.warmthLevel === "number" ? this.settlement.warmthLevel : 100.0;
    if (warmth < 20.0) {
      thermalFactor = 0.50; // Frostbite penalty: -50% shift efficiency
    } else if (warmth < 70.0) {
      thermalFactor = 0.85; // Chilly: -15% shift efficiency
    }

    const canteenLvl = Math.max(1, this.canteenLevel || (this.settlement && this.settlement.canteenLevel) || 1);
    const canteenBonus = (CONFIG.SETTLEMENT?.canteen?.levels?.[canteenLvl]?.moraleBonus) ?? (0.10 * canteenLvl);
    const rationMult = (this.settlement.rationBoostSec > 0) ? 1.25 : 1.0;
    const moraleMult = (1.0 + canteenBonus) * rationMult;

    return 1.0 + (workers * effPerWorker * thermalFactor * moraleMult);
  }

  allocateShiftWorker(sector, delta) {
    if (!this.settlement) return false;
    if (!this.settlement.shifts) {
      this.settlement.shifts = { wells: 8, refinery: 6, gas_plant: 5, petrochem: 5 };
    }
    const shifts = this.settlement.shifts;
    if (typeof shifts[sector] !== "number") return false;

    if (delta > 0) {
      const totalAllocated = Object.values(shifts).reduce((a, b) => a + b, 0);
      const freeWorkers = (this.settlement.population || 0) - totalAllocated;
      if (freeWorkers < delta) return false;
      shifts[sector] += delta;
    } else if (delta < 0) {
      const dec = Math.min(shifts[sector], Math.abs(delta));
      shifts[sector] -= dec;
    }
    this.emit("settlementShiftsChanged", { sector, shifts: { ...shifts }, settlement: this.settlement });
    return true;
  }

  getHousingUpgradeCost() {
    const curLvl = (this.settlement && this.settlement.housingLevel) || 1;
    const nextLvl = curLvl + 1;
    const data = CONFIG.SETTLEMENT?.housing?.[nextLvl];
    if (!data) return null;
    return { money: data.costMoney, mtr: data.costMtr, nextLvl, capacity: data.capacity, title: data.title };
  }

  canUpgradeHousing() {
    const cost = this.getHousingUpgradeCost();
    if (!cost) return false;
    return (this.money >= cost.money) && ((this.mtrMaterials || 0) >= cost.mtr);
  }

  upgradeHousing() {
    if (!this.canUpgradeHousing()) return false;
    const cost = this.getHousingUpgradeCost();
    if (!cost) return false;
    if (this.spendMoney(cost.money)) {
      this.mtrMaterials = (this.mtrMaterials || 0) - cost.mtr;
      this.settlement.housingLevel = cost.nextLvl;
      const newCap = CONFIG.SETTLEMENT?.housing?.[cost.nextLvl]?.capacity || (40 + cost.nextLvl * 30);
      this.settlement.maxPopulation = newCap;
      const bonusRecruits = Math.min(newCap - this.settlement.population, 8);
      if (bonusRecruits > 0) {
        this.settlement.population += bonusRecruits;
      }
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("settlementHousingUpgraded", { level: this.settlement.housingLevel, maxPopulation: newCap, settlement: this.settlement });
      this.emit("moneyChanged", { money: this.money, delta: -cost.money });
      this.emit("mtrMaterialsChanged", { mtrMaterials: this.mtrMaterials, delta: -cost.mtr });
      return true;
    }
    return false;
  }

  getBoilerUpgradeCost() {
    const curLvl = (this.settlement && this.settlement.boilerLevel) || 1;
    const nextLvl = curLvl + 1;
    const data = CONFIG.SETTLEMENT?.boiler?.levels?.[nextLvl];
    if (!data) return null;
    return { money: data.costMoney, mtr: data.costMtr, nextLvl, efficiency: data.efficiency, title: data.title };
  }

  canUpgradeBoiler() {
    const cost = this.getBoilerUpgradeCost();
    if (!cost) return false;
    return (this.money >= cost.money) && ((this.mtrMaterials || 0) >= cost.mtr);
  }

  upgradeBoiler() {
    if (!this.canUpgradeBoiler()) return false;
    const cost = this.getBoilerUpgradeCost();
    if (!cost) return false;
    if (this.spendMoney(cost.money)) {
      this.mtrMaterials = (this.mtrMaterials || 0) - cost.mtr;
      this.settlement.boilerLevel = cost.nextLvl;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("settlementBoilerUpgraded", { level: this.settlement.boilerLevel, settlement: this.settlement });
      this.emit("moneyChanged", { money: this.money, delta: -cost.money });
      this.emit("mtrMaterialsChanged", { mtrMaterials: this.mtrMaterials, delta: -cost.mtr });
      return true;
    }
    return false;
  }

  canDistributeRations() {
    if (!this.settlement) return false;
    const cost = 10000;
    return (this.money || 0) >= cost;
  }

  distributeRations() {
    if (!this.canDistributeRations()) return false;
    const cost = 10000;
    if (this.spendMoney(cost)) {
      this.settlement.rationBoostSec = 600.0;
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("settlementRationsDistributed", { durationSec: 600.0, settlement: this.settlement });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  tickSettlement(dt) {
    if (!this.settlement) return;
    const s = this.settlement;

    if (s.rationBoostSec > 0) {
      s.rationBoostSec = Math.max(0, s.rationBoostSec - dt);
    }

    const boilerCfg = CONFIG.SETTLEMENT?.boiler;
    const boilerLvl = Math.max(1, Math.min(5, s.boilerLevel || 1));
    const boilerData = boilerCfg?.levels?.[boilerLvl] || { efficiency: 1.0 };
    const baseGas = (boilerCfg?.baseGasConsumption ?? 0.25) * boilerData.efficiency;
    const baseFuel = (boilerCfg?.backupFuelConsumption ?? 0.15) * boilerData.efficiency;

    const gasNeeded = baseGas * dt;
    const fuelNeeded = baseFuel * dt;

    if ((this.inventory?.dryGas || 0) >= gasNeeded) {
      this.inventory.dryGas -= gasNeeded;
      s.warmthLevel = Math.min(100.0, (s.warmthLevel ?? 100.0) + dt * 2.5);
    } else if ((this.inventory?.fuel_ai92 || 0) >= fuelNeeded) {
      this.inventory.fuel_ai92 -= fuelNeeded;
      s.warmthLevel = Math.min(100.0, (s.warmthLevel ?? 100.0) + dt * 1.5);
    } else {
      s.warmthLevel = Math.max(0.0, (s.warmthLevel ?? 100.0) - dt * 1.5);
    }

    if (s.warmthLevel >= 70.0) {
      s.heatingStatus = "optimal";
    } else if (s.warmthLevel >= 20.0) {
      s.heatingStatus = "chilly";
    } else {
      s.heatingStatus = "frostbite";
    }

    if (s.population < s.maxPopulation && s.warmthLevel >= 60.0) {
      s.growthTimer = (s.growthTimer || 0) + dt;
      if (s.growthTimer >= 45.0) {
        s.growthTimer = 0;
        s.population = Math.min(s.maxPopulation, s.population + 1);
        this.emit("settlementPopulationGrowth", { population: s.population, max: s.maxPopulation });
      }
    }
  }

  // --- MEGAPROJECT «ЯМАЛ-СПГ» & ENDLESS HORIZON (TOWNSHIP M5) ---
  getMegaprojectStageDef(stageNum) {
    const s = stageNum !== undefined ? stageNum : ((this.megaproject && this.megaproject.currentStage) || 0) + 1;
    return CONFIG.MEGAPROJECT?.stages?.[s] || null;
  }

  canBuildMegaprojectStage() {
    if (!this.megaproject) return false;
    if (this.megaproject.completed) return false;
    const nextStage = (this.megaproject.currentStage || 0) + 1;
    const def = this.getMegaprojectStageDef(nextStage);
    if (!def) return false;

    if ((this.money || 0) < def.costMoney) return false;
    if ((this.mtrMaterials || 0) < def.costMtr) return false;
    if (def.costDollars > 0 && (this.dollars || 0) < def.costDollars) return false;

    if (def.costGoods && this.inventory) {
      for (const [goodKey, requiredQty] of Object.entries(def.costGoods)) {
        if ((this.inventory[goodKey] || 0) < requiredQty) return false;
      }
    }

    return true;
  }

  buildMegaprojectStage() {
    if (!this.canBuildMegaprojectStage()) return false;
    const nextStage = (this.megaproject.currentStage || 0) + 1;
    const def = this.getMegaprojectStageDef(nextStage);
    if (!def) return false;

    this.spendMoney(def.costMoney);
    this.mtrMaterials = (this.mtrMaterials || 0) - def.costMtr;
    if (def.costDollars > 0) {
      this.spendDollars(def.costDollars);
    }

    if (def.costGoods && this.inventory) {
      for (const [goodKey, requiredQty] of Object.entries(def.costGoods)) {
        this.inventory[goodKey] = (this.inventory[goodKey] || 0) - requiredQty;
      }
    }

    this.megaproject.currentStage = nextStage;

    if (def.buff) {
      if (def.buff.storageBonus) {
        this.oilStorageCapacity = (this.oilStorageCapacity || 2000) + def.buff.storageBonus;
      }
    }

    if (nextStage >= (CONFIG.MEGAPROJECT?.totalStages || 4)) {
      this.megaproject.completed = true;
      this.megaproject.endlessHorizonUnlocked = true;
      if (this.territories && this.territories.kara_shelf) {
        this.territories.kara_shelf.unlocked = true;
      }
      this.addGoldenShares(10);
      this.emit("megaprojectCompleted", {
        megaproject: this.megaproject,
        stage: nextStage,
        bonusShares: 10
      });
    }

    if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
    this.emit("megaprojectStageCompleted", {
      stage: nextStage,
      def,
      megaproject: this.megaproject
    });
    this.emit("moneyChanged", { money: this.money, delta: -def.costMoney });
    this.emit("mtrMaterialsChanged", { mtrMaterials: this.mtrMaterials, delta: -def.costMtr });

    return true;
  }

  tickMegaproject(dt) {
    if (!this.megaproject) return;
    const m = this.megaproject;

    m.seasonTimer = (m.seasonTimer || 300.0) - dt;
    if (m.seasonTimer <= 0) {
      m.seasonTimer = 300.0;
      const order = ["polar_day", "polar_night", "ice_breakup"];
      const curIdx = order.indexOf(m.activeSeason);
      const nextIdx = (curIdx + 1) % order.length;
      m.activeSeason = order[nextIdx];
      this.emit("seasonChanged", { season: m.activeSeason, def: CONFIG.MEGAPROJECT?.seasons?.[m.activeSeason] });
    }
  }

  getSeasonBuff(type) {
    if (!this.megaproject) return 1.0;
    const season = this.megaproject.activeSeason;
    if (type === "construction" && season === "polar_day") return 1.25;
    if (type === "heating_sales" && season === "polar_night") return 1.35;
    if (type === "convoy_reward" && season === "ice_breakup") return 2.00;
    return 1.0;
  }

  advanceCorporatePrestige() {
    if (!this.megaproject || !this.megaproject.completed) return false;
    const threshold = 50000000 * Math.pow(1.5, (this.megaproject.corporatePrestigeLevel || 1) - 1);
    if ((this.money || 0) < threshold) return false;

    if (this.spendMoney(threshold)) {
      this.megaproject.corporatePrestigeLevel = (this.megaproject.corporatePrestigeLevel || 1) + 1;
      const bonusShares = 5 * this.megaproject.corporatePrestigeLevel;
      this.addGoldenShares(bonusShares);
      if (typeof audio?.playPayout === "function") audio.playPayout();
      this.emit("corporatePrestigeAdvanced", {
        level: this.megaproject.corporatePrestigeLevel,
        bonusShares
      });
      return true;
    }
    return false;
  }

  getSavelichUpgradeCost() {
    const lvl = this.savelichLevel || 1;
    return Math.round(1500000 * Math.pow(2.1, lvl - 1));
  }

  canUpgradeSavelich() {
    return (this.money || 0) >= this.getSavelichUpgradeCost();
  }

  upgradeSavelich() {
    if (!this.canUpgradeSavelich()) return false;
    const cost = this.getSavelichUpgradeCost();
    if (this.spendMoney(cost)) {
      this.savelichLevel = (this.savelichLevel || 1) + 1;
      this.progressQuest("upgrade_savelich", 1);
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("savelichUpgraded", { level: this.savelichLevel });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  getSavelichMultiplier() {
    return 1.0 + ((this.savelichLevel || 1) - 1) * 0.15;
  }

  getCurrentQuest() {
    if (!this.quests) return null;
    return this.quests[this.currentQuestIndex] || null;
  }

  progressQuest(type, amount = 1) {
    const q = this.getCurrentQuest();
    if (!q || q.completed) return;
    if (q.id === type) {
      q.current = Math.min(q.target, (q.current || 0) + amount);
      if (q.current >= q.target) {
        q.completed = true;
        if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      }
      this.emit("questProgress", { quest: q });
    }
  }

  claimQuestReward() {
    const q = this.getCurrentQuest();
    if (!q || !q.completed) return false;
    if (q.rewardMoney > 0) this.addMoney(q.rewardMoney);
    if (q.rewardCrypto > 0) this.addCrypto(q.rewardCrypto);
    this.currentQuestIndex++;
    if (this.currentQuestIndex >= this.quests.length) {
      this.tutorialCompleted = true;
      this.ftueCompleted = true;
    }
    if (typeof audio?.playPayout === "function") audio.playPayout();
    this.emit("questClaimed", { completedQuest: q, nextQuest: this.getCurrentQuest() });
    return true;
  }

  grantFtueStartingFund(amount = 250000) {
    if (this.ftueCompleted && (this.money || 0) >= amount) return;
    this.addMoney(amount);
    if (typeof audio?.playCoin === "function") audio.playCoin();
    else if (typeof audio?.playPayout === "function") audio.playPayout();
    this.emit("ftueFundGranted", { amount });
  }

  advanceFtueStep(step) {
    if (typeof step === "number") {
      this.ftueStep = step;
    } else {
      this.ftueStep = (this.ftueStep || 0) + 1;
    }
    this.tutorialStep = this.ftueStep;
    this.emit("ftueStepChanged", { step: this.ftueStep });
    return this.ftueStep;
  }

  completeFtue() {
    this.ftueCompleted = true;
    this.tutorialCompleted = true;
    this.ftueStep = 4;
    this.tutorialStep = 4;
    this.emit("ftueCompleted", {});
    this.emit("tutorialCompleted", {});
    return true;
  }

  skipFtue() {
    if ((this.money || 0) < 250000) {
      this.addMoney(250000 - (this.money || 0));
    }
    this.completeFtue();
    return true;
  }

  isFeatureUnlocked(featureKey) {
    const totalCash = Math.max(this.money || 0, this.totalEarned || 0);
    switch (featureKey) {
      case "dispatch":
        return Boolean(this.ftueCompleted || (this.wells?.well_1?.level >= 2));
      case "boost":
        return Boolean(this.ftueCompleted || totalCash >= 500000);
      case "settlement":
        return Boolean(this.ftueCompleted && (totalCash >= 1000000 || (this.canteenLevel || 0) > 0 || (this.dormitoryLevel || 0) > 0));
      case "market":
        return Boolean(this.ftueCompleted && totalCash >= 1000000);
      case "contracts":
        return Boolean(this.ftueCompleted && totalCash >= 5000000);
      case "industrial":
        return Boolean(this.ftueCompleted && (totalCash >= 25000000 || this.isSectorUnlocked("refinery")));
      case "marine":
        return Boolean(this.ftueCompleted && (totalCash >= 100000000 || this.isSectorUnlocked("marine_terminal")));
      case "megaproject":
        return Boolean(this.ftueCompleted && totalCash >= 250000000);
      case "ipo":
        return Boolean((this.money || 0) >= (CONFIG.IPO?.CAPITAL_THRESHOLD || 1000000000) || (this.ipo && this.ipo.ipoCount > 0));
      default:
        return true;
    }
  }

  getWorldTerritories() {
    return Object.values(this.territories || {});
  }

  getTotalTerritoryDebitBonus() {
    let sum = 0;
    for (const k in (this.territories || {})) {
      const t = this.territories[k];
      if (t && t.unlocked && t.debitBonus) {
        sum += t.debitBonus;
      }
    }
    return sum;
  }

  unlockTerritory(id) {
    const t = this.territories?.[id];
    if (!t || t.unlocked) return false;
    const cost = t.cost || 0;
    if (cost > 0 && (this.money || 0) < cost) return false;
    if (cost === 0 || this.spendMoney(cost)) {
      t.unlocked = true;
      if (typeof audio?.playPayout === "function") audio.playPayout();
      this.emit("territoryUnlocked", { territory: t });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  isTerritoryUnlocked(id) {
    if (!this.territories || !this.territories[id]) return false;
    if (id === "east_achim" && (Boolean(this.isCorporateEmpire) || (this.ipo?.ipoCount || 0) >= 1)) return true;
    if (id === "north_shelf" && (((this.corporatePrestigeTier || 1) >= 2) || (this.ipo?.ipoCount || 0) >= 2)) return true;
    return Boolean(this.territories[id].unlocked);
  }

  getPurgeCooldownRemaining() {
    const elapsed = (Date.now() - (this.lastPurgeTime || 0)) / 1000;
    return Math.max(0, 5400 - elapsed);
  }

  canPurge() {
    return this.getPurgeCooldownRemaining() <= 0;
  }

  getStructureLevel(type) {
    const m = {
      gatehouse: this.gatehouseLevel ?? 0,
      substation: this.substationLevel ?? 0,
      fence: this.fenceLevel ?? 0,
      mtr_yard: this.mtrYardLevel ?? 0,
      compressor: this.compressorLevel ?? 0,
      gas_treatment: this.gasTreatmentLevel ?? 0,
      dormitory: this.dormitoryLevel ?? 0,
      canteen: this.canteenLevel ?? 0,
      facility: this.facilityLevel ?? 0,
      garage: this.garageLevel ?? 0
    };
    return m[type] !== undefined ? m[type] : 0;
  }

  getStructureUpgradeCost(type) {
    const lvl = this.getStructureLevel(type);
    const baseCosts = {
      gatehouse: 1500,
      fence: 800,
      canteen: 2500,
      dormitory: 4000,
      substation: 7000,
      garage: 10000,
      mtr_yard: 12000,
      compressor: 15000,
      gas_treatment: 18000,
      facility: 25000
    };
    const base = baseCosts[type] || 1500;
    if (lvl <= 0) return base;
    return Math.round(base * Math.pow(1.85, lvl));
  }

  canUpgradeStructure(type) {
    return (this.money || 0) >= this.getStructureUpgradeCost(type);
  }

  upgradeStructure(type) {
    if (!this.canUpgradeStructure(type)) return false;
    const cost = this.getStructureUpgradeCost(type);
    if (this.spendMoney(cost)) {
      const propMap = {
        gatehouse: "gatehouseLevel",
        substation: "substationLevel",
        fence: "fenceLevel",
        mtr_yard: "mtrYardLevel",
        compressor: "compressorLevel",
        gas_treatment: "gasTreatmentLevel",
        dormitory: "dormitoryLevel",
        canteen: "canteenLevel",
        facility: "facilityLevel",
        garage: "garageLevel"
      };
      const p = propMap[type];
      if (p) {
        this[p] = (this[p] || 0) + 1;
        if (type === "garage" && this.garageLevel > 0) {
          this.trekolCount = Math.min(5, Math.max(1, this.garageLevel));
        }
        if (type === "substation") this.progressQuest("upgrade_substation", 1);
        if (type === "garage") this.progressQuest("upgrade_garage", 1);
        if (type === "canteen") this.progressQuest("upgrade_canteen", 1);
      }
      if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
      this.emit("structureUpgraded", { type, level: this.getStructureLevel(type) });
      this.emit("moneyChanged", { money: this.money, delta: -cost });
      return true;
    }
    return false;
  }

  getStructureBonus(type) {
    const lvl = this.getStructureLevel(type);
    const bonusMap = {
      gatehouse: 0.10,
      substation: 0.12,
      fence: 0.08,
      mtr_yard: 0.10,
      compressor: 0.15,
      gas_treatment: 0.15,
      dormitory: 0.10,
      canteen: 0.10,
      facility: 0.20,
      garage: 0.15
    };
    const pct = bonusMap[type] || 0.10;
    return (lvl - 1) * pct;
  }

  completeBlockBlast(linesPurged, score) {
    this.lastPurgeTime = Date.now();
    const reward = Math.max(1500, score * 5);
    this.addMoney(reward);
    this.activateBoost(180, 2.5);
    if (linesPurged >= 3) this.addCrypto(Math.floor(linesPurged / 3));
    this.progressQuest("block_blast", 1);
    if (typeof audio?.playPayout === "function") audio.playPayout();
    this.emit("blockBlastCompleted", { linesPurged, score, reward });
    return reward;
  }

  resetGame() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Storage clear error:", e);
    }
    window.location.href = window.location.origin + window.location.pathname;
  }

  getWellStimulation(wellId) {
    if (!this.wellStimulation) return null;
    return this.wellStimulation[wellId] || null;
  }

  getWellStimulationMultiplier(wellId) {
    if (!this.wellStimulation || !this.wellStimulation[wellId]) return 1.0;
    const stim = this.wellStimulation[wellId];
    if (stim && typeof stim.remainingSec === "number" && stim.remainingSec > 0 && typeof stim.durationSec === "number" && stim.durationSec > 0) {
      const progress = Math.max(0, Math.min(1.0, stim.remainingSec / stim.durationSec));
      const currentPeak = (stim.peakMultiplier || 0) * Math.pow(progress, 0.75);
      return (stim.baseMultiplier || 1.0) + currentPeak;
    }
    return (stim && typeof stim.baseMultiplier === "number") ? stim.baseMultiplier : 1.0;
  }

  isWellStimulated(wellId) {
    const stim = this.getWellStimulation(wellId);
    return Boolean(stim && stim.remainingSec > 0);
  }

  applyWellStimulation(wellId, multiplier, duration = 240.0, meta = {}) {
    let targetId = (wellId && this.wells && this.wells[wellId]) ? wellId : (this.activeWellId || "well_1");
    if (!this.wells || !this.wells[targetId]) targetId = "well_1";

    const rawMult = (typeof multiplier === "number" && !isNaN(multiplier)) ? multiplier : 1.25;
    const clampedMult = Math.max(1.25, Math.min(2.50, rawMult));
    const durSec = (typeof duration === "number" && !isNaN(duration) && duration > 0) ? duration : 240.0;

    const gain = clampedMult - 1.0;
    const newBase = 1.0 + gain * 0.35;
    const newPeak = gain * 0.65;

    if (!this.wellStimulation) this.wellStimulation = {};
    const existing = this.wellStimulation[targetId];
    const finalBase = existing ? Math.max(existing.baseMultiplier || 1.0, newBase) : newBase;

    const record = {
      wellId: targetId,
      multiplier: clampedMult,
      baseMultiplier: finalBase,
      peakMultiplier: newPeak,
      durationSec: durSec,
      remainingSec: durSec,
      geonavScore: (meta && typeof meta.geonavScore === "number") ? meta.geonavScore : 1.0,
      fracScore: (meta && typeof meta.fracScore === "number") ? meta.fracScore : 1.0,
      totalStimulations: (existing?.totalStimulations || 0) + 1,
      lastStimulatedTime: Date.now()
    };

    this.wellStimulation[targetId] = record;

    if (!this.stimulationStats) {
      this.stimulationStats = { totalStimulations: 0, bestMultiplier: 1.0, totalExtraMoneyEarned: 0 };
    }
    this.stimulationStats.totalStimulations++;
    this.stimulationStats.bestMultiplier = Math.max(this.stimulationStats.bestMultiplier, clampedMult);

    if (typeof audio?.playBoost === "function") audio.playBoost();
    if (typeof audio?.vibrate === "function") audio.vibrate([80, 40, 120]);

    this.emit("wellStimulated", {
      wellId: targetId,
      multiplier: clampedMult,
      baseMultiplier: finalBase,
      peakMultiplier: newPeak,
      durationSec: durSec,
      meta
    });
    this.emit("wellUpdated", {
      wellId: targetId,
      well: this.wells?.[targetId],
      def: CONFIG.WELLS ? CONFIG.WELLS.find(w => w.id === targetId) : null
    });
    this.emit("moneyChanged", { money: this.money, delta: 0 });

    return record;
  }

  getWellsCountOnPad(wellId){const well=this.wells[wellId];if(!well||!well.unlocked||well.level<=0)return 0;return Math.min(5,Math.max(2,1+well.level));}getWellDebit(wellId){const well=this.wells[wellId];if(!well||!well.unlocked||well.level<=0)return 0;const def=CONFIG.WELLS.find(w=>w.id===wellId);const base=(def&&typeof def.baseRate==="number")?def.baseRate:10;let debit=base*(1+(well.level-1)*0.5)*(this.facilityLevel?1+this.facilityLevel*0.15:1);const stim=this.getWellStimulationMultiplier(wellId);if(stim>1.0)debit*=stim;return debit;}getEffectiveWellDebit(wellId){const debit=this.getWellDebit(wellId);const bonus=typeof this.getSettlementBonus==="function"?this.getSettlementBonus("wells"):1.0;return debit*bonus;}unlockCryptoMiningWithMoney(){const cost=5000000;if(this.cryptoMiningActive)return true;if(this.money<cost)return false;if(this.spendMoney(cost)){this.cryptoMiningActive=true;if(typeof audio?.playUpgrade==="function")audio.playUpgrade();this.emit("cryptoMiningActivated",{method:"money"});return true;}return false;}progressCryptoMiningAd(){if(this.cryptoMiningActive)return true;this.cryptoAdsWatched=(this.cryptoAdsWatched||0)+1;if(this.cryptoAdsWatched>=10){this.cryptoMiningActive=true;if(typeof audio?.playPayout==="function")audio.playPayout();this.emit("cryptoMiningActivated",{method:"ad"});return true;}this.emit("cryptoAdProgress",{watched:this.cryptoAdsWatched,target:10});return false;}getFacilityUpgradeCost(){const lvl=this.facilityLevel||1;if(lvl>=10)return Infinity;return Math.round(50000000*Math.pow(1.85,lvl-1));}canUpgradeFacility(){if((this.facilityLevel||1)>=10)return false;return(this.money||0)>=this.getFacilityUpgradeCost();}upgradeFacility(){if(!this.canUpgradeFacility())return false;const cost=this.getFacilityUpgradeCost();if(this.spendMoney(cost)){this.facilityLevel=(this.facilityLevel||1)+1;if(typeof audio?.playUpgrade==="function")audio.playUpgrade();this.emit("facilityUpgraded",{level:this.facilityLevel});this.emit("moneyChanged",{money:this.money,delta:-cost});return true;}return false;}getCanteenUpgradeCost(){const lvl=this.canteenLevel||1;if(lvl>=5)return Infinity;return Math.round(15000000*Math.pow(2.2,lvl-1));}canUpgradeCanteen(){if((this.canteenLevel||1)>=5)return false;return(this.money||0)>=this.getCanteenUpgradeCost();}upgradeCanteen(){if(!this.canUpgradeCanteen())return false;const cost=this.getCanteenUpgradeCost();if(this.spendMoney(cost)){this.canteenLevel=(this.canteenLevel||1)+1;this.workerSynergy=1.0+(this.canteenLevel-1)*0.15;this.progressQuest("upgrade_canteen",1);if(typeof audio?.playUpgrade==="function")audio.playUpgrade();this.emit("canteenUpgraded",{level:this.canteenLevel});this.emit("moneyChanged",{money:this.money,delta:-cost});return true;}return false;}getGarageUpgradeCost(){const lvl=this.garageLevel||1;if(lvl>=5)return Infinity;return Math.round(35000000*Math.pow(2.4,lvl-1));}canUpgradeGarage(){if((this.garageLevel||1)>=5)return false;return(this.money||0)>=this.getGarageUpgradeCost();}upgradeGarage(){if(!this.canUpgradeGarage())return false;const cost=this.getGarageUpgradeCost();if(this.spendMoney(cost)){this.garageLevel=(this.garageLevel||1)+1;this.trekolCount=Math.min(5,Math.max(1,this.garageLevel));this.progressQuest("upgrade_garage",1);if(typeof audio?.playUpgrade==="function")audio.playUpgrade();this.emit("garageUpgraded",{level:this.garageLevel,trekolCount:this.trekolCount});this.emit("moneyChanged",{money:this.money,delta:-cost});return true;}return false;}getWellMaintenanceCooldown(wellId){if(!this.wellMaintenanceCooldowns)this.wellMaintenanceCooldowns={};return Math.max(0,this.wellMaintenanceCooldowns[wellId]||0);}isWellMaintenanceReady(wellId){return this.getWellMaintenanceCooldown(wellId)<=0;}isTerritoryUnlocked(id){if(!this.territories||!this.territories[id])return false;if(id==="east_achim"&&Boolean(this.isCorporateEmpire))return true;if(id==="north_shelf"&&(this.corporatePrestigeTier||1)>=2)return true;return Boolean(this.territories[id].unlocked);}completeWellTuning(wellId,activityType){if(!this.wellMastery)this.wellMastery={};if(!this.wellMastery[wellId])this.wellMastery[wellId]={valve:false,purge:false,sensor:false};this.wellMastery[wellId][activityType]=true;if(!this.wellMaintenanceCooldowns)this.wellMaintenanceCooldowns={};const m=this.wellMastery[wellId];if(m.valve&&m.purge&&m.sensor){this.wellMaintenanceCooldowns[wellId]=3600;}this.activateBoost(60.0,2.0);if(typeof audio?.playPayout==="function")audio.playPayout();this.emit("wellMasteryUpdated",{wellId,activityType,mastery:this.wellMastery[wellId],cooldown:this.getWellMaintenanceCooldown(wellId)});return true;}getLoadingRackUpgradeCost(){if(this.loadingRackLevel===1)return 25000000;if(this.loadingRackLevel===2)return 120000000;return Infinity;}canUpgradeLoadingRack(){if(this.loadingRackLevel>=3)return false;return(this.money||0)>=this.getLoadingRackUpgradeCost();}upgradeLoadingRack(){if(!this.canUpgradeLoadingRack())return false;const cost=this.getLoadingRackUpgradeCost();if(this.spendMoney(cost)){this.loadingRackLevel++;if(typeof audio?.playUpgrade==="function")audio.playUpgrade();this.emit("loadingRackUpgraded",{level:this.loadingRackLevel});return true;}return false;}getOilStorageCapacity(){let cap=2000+((this.facilityLevel||1)-1)*2000;if(this.getTechLevel("tech_storage")>0)cap+=8000;if(this.isSectorUnlocked("storage_park")||this.isSectorUnlocked("storage")){const lvl=this.rvsParkLevel||1;const bonus=CONFIG.RVS_PARK?.capacityBonus?.[lvl]||(lvl*15000);cap+=bonus;}return cap;}on(event,callback){(this.listeners[event]=this.listeners[event]||[]).push(callback);}off(event,callback){if(this.listeners[event])this.listeners[event]=this.listeners[event].filter(cb=>cb!==callback);}emit(event,data){if(this.listeners[event])this.listeners[event].forEach(cb=>{try{cb(data);}catch(_){}});}setSpecialization(type,force=false){if(this.specialization!==null&&!force){return false;}if(type!=="oil"&&type!=="gas"){return false;}this.specialization=type;this.isPaused=false;audio.playUpgrade();this.emit("specializationChanged",{type});return true;}checkSpecializationUnlock(){const well1=this.wells[CONFIG.SPECIALIZATION.UNLOCK_WELL_ID||"well_1"];const unlockLevel=CONFIG.SPECIALIZATION.UNLOCK_LEVEL||5;if(well1&&well1.level>=unlockLevel&&!this.specialization){this.isPaused=true;this.emit("specializationAvailable",{level:well1.level});return true;}return false;}triggerFountainBurst(durationSec=4.0,multiplier=3.0){this.fountainBurst.active=true;this.fountainBurst.multiplier=multiplier;this.fountainBurst.remainingSec=durationSec;this.fountainBurst.totalDurationSec=durationSec;audio.playBoost();this.emit("fountainBurstUpdated",this.fountainBurst);}activateBrokerInsider(durationSec=90.0,multiplier=2.5){const finalDuration=durationSec||CONFIG.EXCHANGE?.BROKER_INSIDER?.durationSec||90.0;const finalMultiplier=multiplier||CONFIG.EXCHANGE?.BROKER_INSIDER?.multiplier||2.5;this.brokerInsider.active=true;this.brokerInsider.multiplier=finalMultiplier;this.brokerInsider.remainingSec=finalDuration;this.brokerInsider.totalDurationSec=finalDuration;audio.playBoost();audio.vibrate([40,60,40]);this.emit("brokerInsiderActivated",{active:true,remainingSec:finalDuration,multiplier:finalMultiplier});this.emit("brokerInsiderUpdated",this.brokerInsider);this.triggerAdvisorTip("broker");return true;}getMarketMultiplier(){if(!this.market)return 1.0;if(this.specialization==="oil"){return typeof this.market.oilMultiplier==="number"?this.market.oilMultiplier:1.0;}if(this.specialization==="gas"){return typeof this.market.gasMultiplier==="number"?this.market.gasMultiplier:1.0;}return typeof this.market.oilMultiplier==="number"?this.market.oilMultiplier:1.0;}getBrokerMultiplier(){if(this.brokerInsider&&this.brokerInsider.active){return typeof this.brokerInsider.multiplier==="number"?this.brokerInsider.multiplier:2.5;}return 1.0;}getOfflineBankParams(){if(this.getTechLevel("tech_storage")>0){return {maxHours:8.0,efficiency:1.0,minSecondsToShow:CONFIG.OFFLINE?.MIN_SECONDS_TO_SHOW||45};}return CONFIG.getOfflineConfig(this.specialization);}validateCompanyName(name){if(typeof name!=="string")return false;const trimmed=name.trim();const min=CONFIG.IPO?.MIN_NAME_LENGTH||2;const max=CONFIG.IPO?.MAX_NAME_LENGTH||24;return trimmed.length>=min&&trimmed.length<=max;}isIpoAvailable(){const threshold=CONFIG.IPO?.CAPITAL_THRESHOLD||1000000;return(this.money||0)>=threshold;}getDividendMultiplier(){const shares=this.ipo?.goldenShares||0;const bonus=(this.getTechLevel("tech_div_mult")>0)?0.03:(CONFIG.IPO?.BONUS_PER_SHARE||0.02);return 1.0+(shares*bonus);}performIpo(companyName){const finalName=(companyName===undefined)?(this.ipo?.companyName||"СеверНефтьГаз"):companyName;if(!this.validateCompanyName(finalName))return false;const threshold=CONFIG.IPO?.CAPITAL_THRESHOLD||1000000;if((this.money||0)<threshold)return false;const baseShares=Math.floor(this.money/threshold);if(baseShares<=0)return false;const bonusShares=this.getTechLevel("tech_listing");const newShares=baseShares+bonusShares;const sanitizedName=finalName.trim();if(!this.ipo){this.ipo={goldenShares:0,companyName:"",ipoCount:0};}this.ipo.goldenShares=(this.ipo.goldenShares||0)+newShares;this.ipo.companyName=sanitizedName;this.ipo.ipoCount=(this.ipo.ipoCount||0)+1;if(!this.prestige)this.prestige={shares:0,companyName:"",ipoCount:0};this.prestige.shares=this.ipo.goldenShares;this.prestige.companyName=sanitizedName;this.prestige.ipoCount=this.ipo.ipoCount;const hasSubsidy=this.getTechLevel("tech_subsidy")>0;this.money=hasSubsidy?100000:(CONFIG.IPO?.STARTING_MONEY||0);CONFIG.WELLS.forEach(def=>{const isFirst=def.id==="well_1"||def.unlockCost===0;this.wells[def.id]={id:def.id,level:isFirst?1:0,unlocked:isFirst};});this.activeWellId="well_1";if(this.accident)this.accident={active:false,type:null,remainingSec:0,qteProgress:0,isGoldTap:false};if(this.fountainBurst)this.fountainBurst={active:false,remainingSec:0};if(this.technologies){for(const k in this.technologies)if(this.getTechDef(k)?.cat!==4)delete this.technologies[k];}if(typeof audio?.stopAccidentSounds==="function")audio.stopAccidentSounds();if(typeof audio?.playUpgrade==="function")audio.playUpgrade();if(typeof audio?.vibrate==="function")audio.vibrate([100,50,150]);this.emit("moneyChanged",{money:this.money,delta:0});this.emit("activeWellChanged",this.getActiveWellDef());CONFIG.WELLS.forEach(def=>{this.emit("wellUpdated",{wellId:def.id,well:this.wells[def.id],def});});this.emit("technologiesUpdated",this.technologies);this.emit("ipoComplete",{companyName:this.ipo.companyName,goldenShares:newShares,totalShares:this.ipo.goldenShares,ipoCount:this.ipo.ipoCount});return true;}performSpo(){return this.performIpo(this.ipo?.companyName||"СеверНефтьГаз");}sellStoredReserves(){const amount=Math.floor(this.oilStorageCurrent||0);if(amount<=0)return{amount:0,revenue:0};const basePrice=this.specialization==="gas"?(this.market?.gasPrice||35.0):(this.market?.oilPrice||75.0);const marketMult=this.getMarketMultiplier();const brokerMult=this.getBrokerMultiplier();const boostMult=(this.boost&&this.boost.active)?(this.boost.multiplier||1.0):1.0;let fuelsBonus=0;if(this.inventory){fuelsBonus+=(this.inventory.fuel_ai92||0)*15;fuelsBonus+=(this.inventory.fuel_ai95||0)*25;fuelsBonus+=(this.inventory.fuel_ai98||0)*45;fuelsBonus+=(this.inventory.fuel_ai100||0)*80;}const revenue=Math.round(amount*(basePrice*0.45)*marketMult*brokerMult*boostMult+fuelsBonus);this.oilStorageCurrent=0;this.addMoney(revenue);if(typeof audio?.playPayout==="function")audio.playPayout();this.emit("storageReservesSold",{amount,revenue});return{amount,revenue};}get isCorporateEmpire(){return Boolean(this.ipo&&this.ipo.ipoCount>0);}get corporatePrestigeTier(){return Math.max(1,this.ipo?.ipoCount||1);}getIncomeRate(){let rate=0;const thermo=this.getTechLevel("tech_thermal");CONFIG.WELLS.forEach(def=>{const well=this.wells[def.id];if(well&&well.unlocked&&well.level>0){let wInc=CONFIG.getWellIncome(def.baseIncome,well.level);if(thermo>0&&(def.id==="well_2"||def.id==="well_4")){wInc*=1.40;}const m=this.wellMastery?.[def.id];if(m){const mc=(m.valve?1:0)+(m.purge?1:0)+(m.sensor?1:0);if(mc>0)wInc*=(1.0+mc*0.25);}const stim=this.getWellStimulationMultiplier(def.id);if(stim>1.0){wInc*=stim;}rate+=wInc;}});if((this.facilityLevel||1)>1)rate*=(1.0+(this.facilityLevel-1)*0.15);if((this.canteenLevel||1)>1)rate*=(1.0+(this.canteenLevel-1)*0.10);const grp=this.getTechLevel("tech_fracking");if(grp>0)rate*=(1.0+grp*0.25);if(this.specialization==="gas"){rate*=CONFIG.SPECIALIZATION.GAS.passiveMultiplier;}const marketMult=this.getMarketMultiplier();if(marketMult!==1.0){rate*=marketMult;}const brokerMult=this.getBrokerMultiplier();if(brokerMult!==1.0){rate*=brokerMult;}if(this.boost.active){rate*=this.boost.multiplier;}if(this.mchsBoost&&this.mchsBoost.active){const mchsMult=typeof this.mchsBoost.multiplier==="number"?this.mchsBoost.multiplier:1.5;rate*=mchsMult;}if(typeof this.getDividendMultiplier==="function"){rate*=this.getDividendMultiplier();}if(typeof this.workerSynergy==="number"&&this.workerSynergy>1.0){rate*=this.workerSynergy;}
    if ((this.savelichLevel || 1) > 1) { rate *= (1.0 + ((this.savelichLevel || 1) - 1) * 0.15); }
    const tBonus = this.getTotalTerritoryDebitBonus();
    if (tBonus > 0) { rate *= (1.0 + tBonus); }
    if ((this.substationLevel || 1) > 1) rate *= (1.0 + (this.substationLevel - 1) * 0.12);
    if ((this.compressorLevel || 1) > 1) rate *= (1.0 + (this.compressorLevel - 1) * 0.15);
    if ((this.gasTreatmentLevel || 1) > 1) rate *= (1.0 + (this.gasTreatmentLevel - 1) * 0.15);
    if ((this.fenceLevel || 1) > 1) rate *= (1.0 + (this.fenceLevel - 1) * 0.08);
    return rate;
  }getCurrentTapPower(){let totalBasePower=0;CONFIG.WELLS.forEach(def=>{const well=this.wells[def.id];if(well&&well.unlocked&&well.level>0){let p=CONFIG.getWellTapPower(def.baseTapPower,well.level);const m=this.wellMastery?.[def.id];if(m){const mc=(m.valve?1:0)+(m.purge?1:0)+(m.sensor?1:0);if(mc>0)p*=(1.0+mc*0.25);}totalBasePower+=p;}});if(totalBasePower<=0)totalBasePower=1;let power=totalBasePower;if((this.facilityLevel||1)>1)power*=(1.0+(this.facilityLevel-1)*0.15);const cshn=this.getTechLevel("tech_sash");if(cshn>0)power*=(1.0+cshn*0.50);if(this.specialization==="oil"){power*=CONFIG.SPECIALIZATION.OIL.tapMultiplier;}const marketMult=this.getMarketMultiplier();if(marketMult!==1.0)power*=marketMult;const brokerMult=this.getBrokerMultiplier();if(brokerMult!==1.0)power*=brokerMult;if(this.fountainBurst&&this.fountainBurst.active)power*=this.fountainBurst.multiplier;if(this.accident&&this.accident.active&&this.accident.isGoldTap){const gusherMult=CONFIG.ACCIDENTS?.TYPES?.GUSHER?.tapMultiplier||3.0;power*=gusherMult;}if(this.boost.active)power*=this.boost.multiplier;
    if ((this.savelichLevel || 1) > 1) { power *= (1.0 + ((this.savelichLevel || 1) - 1) * 0.15); }
    return Math.max(1,Math.round(power));
  }unlockWell(wellId){return this.upgradeWell(wellId);}addMoney(amount){if(amount<=0)return;const wasAvailable=this.isIpoAvailable();this.money+=amount;this.totalEarned+=amount;this.emit("moneyChanged",{money:this.money,delta:amount});if(!wasAvailable&&this.isIpoAvailable()){this.emit("ipoAvailable",{currentCapital:this.money});}if(this.money>=1000000){this.triggerAdvisorTip("ipo");}}spendMoney(amount){if(this.money<amount)return false;this.money-=amount;this.emit("moneyChanged",{money:this.money,delta:-amount});return true;}addDollars(amount){if(typeof amount!=="number"||amount<=0)return;this.dollars=(this.dollars||0)+amount;this.emit("dollarsChanged",{dollars:this.dollars,delta:amount});}addGoldenShares(count){const n=Math.max(0,Math.floor(Number(count)||0));if(n<=0)return;if(!this.ipo)this.ipo={goldenShares:0,companyName:"",ipoCount:0};this.ipo.goldenShares=(this.ipo.goldenShares||0)+n;this.goldenShares=this.ipo.goldenShares;if(!this.prestige)this.prestige={shares:0,companyName:"",ipoCount:0};this.prestige.shares=this.ipo.goldenShares;this.emit("goldenSharesChanged",{goldenShares:this.ipo.goldenShares,delta:n});}spendDollars(amount){if(typeof amount!=="number"||amount<=0)return false;if((this.dollars||0)<amount)return false;this.dollars-=amount;this.emit("dollarsChanged",{dollars:this.dollars,delta:-amount});return true;}addCrypto(amount, force = false){if(typeof amount!=="number"||amount<=0||(!this.cryptoMiningActive && !force))return;this.crypto=(this.crypto||0)+amount;this.emit("cryptoChanged",{crypto:this.crypto,delta:amount});}spendCrypto(amount){if(typeof amount!=="number"||amount<=0)return false;if((this.crypto||0)<amount)return false;this.crypto-=amount;this.emit("cryptoChanged",{crypto:this.crypto,delta:-amount});return true;}canAfford(currency,cost){if(typeof cost!=="number"||cost<=0)return true;if(currency==="dollars")return(this.dollars||0)>=cost;if(currency==="crypto")return(this.crypto||0)>=cost;return(this.money||0)>=cost;}spendCurrency(currency,cost){if(currency==="dollars")return this.spendDollars(cost);if(currency==="crypto")return this.spendCrypto(cost);return this.spendMoney(cost);}getTechDef(id){return CONFIG.TECHNOLOGIES?.[id]||null;}getTechLevel(id){return(this.technologies&&this.technologies[id])||0;}getTechCost(id){const def=this.getTechDef(id);if(!def)return 0;const lvl=this.getTechLevel(id);return Math.floor(def.baseCost*Math.pow(def.costMult||1.0,lvl));}canBuyTech(id){const def=this.getTechDef(id);if(!def)return false;const realId=def.id;const lvl=this.getTechLevel(realId);if(lvl>=def.maxLevel)return false;const cost=this.getTechCost(realId);return this.canAfford(def.currency,cost);}buyTechnology(id){const def=this.getTechDef(id);if(!def)return false;const realId=def.id;const lvl=this.getTechLevel(realId);if(lvl>=def.maxLevel)return false;const cost=this.getTechCost(realId);if(!this.spendCurrency(def.currency,cost))return false;if(!this.technologies)this.technologies={};this.technologies[realId]=lvl+1;if(typeof audio?.playUpgrade==="function")audio.playUpgrade();this.emit("techUpgraded",{techId:realId,level:this.technologies[realId],def});return true;}getCryptoRate(){if(!this.cryptoMiningActive)return 0;const isProducing=Object.values(this.wells).some(w=>w.unlocked&&w.level>0);if(!isProducing)return 0;let rate=0.1;if(this.specialization==="gas")rate*=1.5;const turboLevel=this.getTechLevel("tech_crypto_gen");rate*=(1.0+turboLevel*1.0);return rate;}setActiveWell(wellId){const well=this.wells[wellId];if(!well||!well.unlocked)return;this.activeWellId=wellId;this.emit("activeWellChanged",this.getActiveWellDef());}getActiveWellDef(){return CONFIG.WELLS.find(w=>w.id===this.activeWellId)||CONFIG.WELLS[0];}triggerAdvisorTip(tipId,title="Советник",text=""){
const tips={broker:"x2.5",ipo:"IPO",firstTap:"Тап",well1_lv5:"Ветка"};text=text||tips[tipId]||"";if(!this.advisor)this.advisor={seenTips:{}};if(this.advisor.seenTips&&this.advisor.seenTips[tipId])return false;if(!this.advisor.seenTips)this.advisor.seenTips={};this.advisor.seenTips[tipId]=true;this.emit("advisorTip",{tipId,title,text});return true;}handleTap(x,y){if(this.isPaused)return 0;this.progressQuest("tap_well",1);let isBurst=false;if(this.specialization==="oil"&&!this.fountainBurst.active){if(Math.random()<CONFIG.SPECIALIZATION.OIL.burstChance){this.triggerFountainBurst(CONFIG.SPECIALIZATION.OIL.burstDurationSec,CONFIG.SPECIALIZATION.OIL.burstMultiplier);isBurst=true;}}const tapPower=this.getCurrentTapPower();this.addMoney(tapPower);this.totalClicks++;if(this.totalClicks===1)this.triggerAdvisorTip("firstTap");audio.playTap();audio.vibrate(this.fountainBurst.active||isBurst?25:12);this.emit("tap",{x,y,amount:tapPower,isBurst,isFountainBurst:this.fountainBurst.active,isGoldTap:Boolean(this.accident&&this.accident.active&&this.accident.isGoldTap)});return tapPower;}upgradeWell(wellId){this.progressQuest("upgrade_well",1);const def=CONFIG.WELLS.find(w=>w.id===wellId);const well=this.wells[wellId];if(!def||!well)return false;if(!well.unlocked){if(this.money<def.unlockCost)return false;if(this.spendMoney(def.unlockCost)){well.unlocked=true;well.level=1;this.activeWellId=wellId;audio.playUpgrade();this.emit("wellUpdated",{wellId,well,def});this.emit("wellUpgraded",{wellId,level:well.level,well,def});this.emit("activeWellChanged",def);return true;}return false;}const cost=(well.level===0)?50000:CONFIG.getUpgradeCost(def.baseCost,def.costMultiplier,well.level);if(this.money<cost)return false;if(this.spendMoney(cost)){well.level++;audio.playUpgrade();this.emit("wellUpdated",{wellId,well,def});this.emit("wellUpgraded",{wellId,level:well.level,well,def});if(wellId===(CONFIG.SPECIALIZATION.UNLOCK_WELL_ID||"well_1")){this.checkSpecializationUnlock();if(well.level===5)this.triggerAdvisorTip("well1_lv5");}return true;}return false;}activateBoost(durationSec,multiplier=3.0){this.boost.active=true;this.boost.multiplier=multiplier;this.boost.remainingSec=durationSec;this.boost.totalDurationSec=durationSec;audio.playBoost();this.emit("boostUpdated",this.boost);}canTriggerAccident(){const embargo=CONFIG.ACCIDENTS?.EMBARGO_SEC??240.0;if((this.sessionTimeSec||0)<embargo){return false;}if(this.accident&&this.accident.active){return false;}return true;}triggerAccident(type){const chosenType=type||(Math.random()<0.5?"gusher":"rupture");const duration=(this.getTechLevel("tech_telemetry")>0)?9.0:(CONFIG.ACCIDENTS?.QTE_DURATION_SEC||6.0);const isGoldTap=chosenType==="gusher";let targetWell=this.activeWellId||"well_1";if(!this.wells[targetWell]||!this.wells[targetWell].unlocked){const unlocked=Object.keys(this.wells).filter(k=>this.wells[k].unlocked);targetWell=unlocked.length>0?unlocked[Math.floor(Math.random()*unlocked.length)]:"well_1";}this.accident={active:true,type:chosenType,targetWellId:targetWell,remainingSec:duration,totalDurationSec:duration,qteProgress:0,isGoldTap};if(typeof audio?.playEmergencySiren==="function"){audio.playEmergencySiren(2.4);}else if(typeof audio?.playBoost==="function"){audio.playBoost();}if(typeof audio?.vibrate==="function"){audio.vibrate([100,50,100]);}this.emit("accidentTriggered",{type:chosenType,targetWellId:targetWell,remainingSec:duration,isGoldTap,title:chosenType==="gusher"?"Выброс грифона!":"Порыв фланца!",description:""});return true;}progressAccidentQte(delta=0.10){if(!this.accident||!this.accident.active)return 0;this.accident.qteProgress=Math.min(1.0,(this.accident.qteProgress||0)+delta);this.emit("accidentQteProgress",{qteProgress:this.accident.qteProgress});if(this.accident.qteProgress>=0.999){this.resolveAccident("qte");}return this.accident.qteProgress;}resolveAccident(method="qte"){if(!this.accident||!this.accident.active)return false;const oldType=this.accident.type;const oldTarget=this.accident.targetWellId||"well_1";let reward=0;this.accident.active=false;this.accident.type=null;this.accident.remainingSec=0;this.accident.isGoldTap=false;if(typeof audio?.stopAccidentSounds==="function")audio.stopAccidentSounds();if(method==="mchs"){let insSec=CONFIG.ACCIDENTS?.MCHS_INSURANCE_SEC||300.0;if(this.getTechLevel("tech_telemetry")>0)insSec*=2.0;reward=this.getIncomeRate()*insSec;const dur=CONFIG.ACCIDENTS?.MCHS_BOOST_DURATION_SEC||180.0;this.mchsBoost={active:true,multiplier:CONFIG.ACCIDENTS?.MCHS_BOOST_MULTIPLIER||1.5,remainingSec:dur,totalDurationSec:dur};if(typeof audio?.playBoost==="function")audio.playBoost();this.emit("mchsBoostUpdated",this.mchsBoost);this.emit("mchsDispatch",{targetWellId:oldTarget,type:oldType});}else if(method==="qte"){reward=Math.max(100,Math.round(this.getIncomeRate()*(CONFIG.ACCIDENTS?.QTE_REWARD_SECONDS||30.0)));if(typeof audio?.playUpgrade==="function")audio.playUpgrade();}if(reward>0)this.addMoney(reward);this.accidentTimerSec=0;const minI=CONFIG.ACCIDENTS?.MIN_INTERVAL_SEC||300.0;const maxI=CONFIG.ACCIDENTS?.MAX_INTERVAL_SEC||420.0;this.accidentNextIntervalSec=minI+Math.random()*(maxI-minI);this.emit("accidentResolved",{method,reward,type:oldType,targetWellId:oldTarget});return true;}claimDailyStreak(doubleAd=false){if(!this.dailyStreak)this.dailyStreak={day:1,lastClaimDate:""};this.advisor={seenTips:{}};const currentDay=this.dailyStreak.day||1;const rewards=CONFIG.DAILY_STREAK?.rewards||[500,1500,5000,20000,75000,250000,1500000];const baseReward=(rewards&&rewards[currentDay-1])||500;const moneyReward=doubleAd?baseReward*2:baseReward;this.addMoney(moneyReward);if(currentDay===7){const sharesToAdd=doubleAd?2:1;if(!this.ipo)this.ipo={goldenShares:0,companyName:"",ipoCount:0};this.ipo.goldenShares=(this.ipo.goldenShares||0)+sharesToAdd;if(!this.prestige)this.prestige={shares:0,companyName:"",ipoCount:0};this.prestige.shares=this.ipo.goldenShares;}this.dailyStreak.lastClaimDate=new Date().toDateString();this.dailyStreak.day=currentDay<7?currentDay+1:1;this.emit("dailyStreakClaimed",{day:currentDay,reward:moneyReward,doubleAd});return{day:currentDay,reward:moneyReward,doubleAd};}handleHelicopterClick(target){if(!this.helicopter)return false;if(this.helicopter.waitingClick&&!this.helicopter.crateDropped&&(target!=="crate")){this.helicopter.waitingClick=false;this.helicopter.crateDropped=true;this.helicopter.crateGx=(typeof this.helicopter.gx==="number")?this.helicopter.gx:1.5;this.helicopter.crateGy=(typeof this.helicopter.gy==="number")?this.helicopter.gy:11.5;this.helicopter.crateGz=110;this.helicopter.hoverTimer=0;if(typeof audio?.playTap==="function")audio.playTap();this.emit("helicopterCrateDropped",{});return true;}if(this.helicopter.crateDropped&&!this.helicopter.crateCollected){this.helicopter.crateCollected=true;this.helicopter.waitingClick=false;const isFree=Math.random()<0.4,rate=this.getIncomeRate();const reward=isFree?Math.max(500,Math.round(15*rate)):Math.max(1000,Math.round(30*rate));const done=(typ)=>{this.addMoney(reward);if(typeof audio?.playPayout==="function")audio.playPayout();else if(typeof audio?.playCoin==="function")audio.playCoin();this.emit("helicopterReward",{type:typ,reward});this.helicopter.crateDropped=false;this.helicopter.crateCollected=false;this.helicopter.timer=0;};if(isFree){done("free");}else{platform.showRewardedVideo({onRewarded:()=>done("ad"),onError:()=>{done(platform.isMock?"ad":"free");}});}return true;}return false;}  tick(dt) {
    if (this.isPaused || typeof dt !== "number" || isNaN(dt) || dt <= 0) return;
    this.sessionTimeSec = (this.sessionTimeSec || 0) + dt;
    if (this.wellStimulation) {
      for (const wellId in this.wellStimulation) {
        const stim = this.wellStimulation[wellId];
        if (stim && typeof stim.remainingSec === "number" && stim.remainingSec > 0) {
          stim.remainingSec = Math.max(0, stim.remainingSec - dt);
          if (stim.remainingSec === 0) {
            this.emit("wellStimulationExpired", { wellId, stim });
          }
        }
      }
    }
    if (this.wellMaintenanceCooldowns) {
      for (const k in this.wellMaintenanceCooldowns) {
        if (this.wellMaintenanceCooldowns[k] > 0) {
          this.wellMaintenanceCooldowns[k] = Math.max(0, this.wellMaintenanceCooldowns[k] - dt);
        }
      }
    }
    if (!this.helicopter) {
      this.helicopter = { timer: 0, active: false, gx: -3.0, gy: 11.5, gz: 130, crateGx: 1.5, crateGy: 11.5, crateGz: 110, crateDropped: false, waitingClick: false, x: -100, y: 90, crateY: 90 };
    }
    if (!this.helicopter.active) {
      this.helicopter.timer = (this.helicopter.timer || 0) + dt;
      const interval = (this.getTechLevel("tech_radar") > 0) ? 45.0 : (CONFIG.HELICOPTER?.INTERVAL_SEC || 75.0);
      if (!this.helicopter.disabled && this.helicopter.timer >= interval) {
        this.helicopter.active = true;
        this.helicopter.waitingClick = true;
        this.helicopter.timer = 0;
        this.helicopter.gx = -3.0;
        this.helicopter.gy = 11.5;
        this.helicopter.gz = 130;
        this.helicopter.crateGx = (typeof this.helicopter.gx === "number") ? this.helicopter.gx : 1.5;
        this.helicopter.crateGy = (typeof this.helicopter.gy === "number") ? this.helicopter.gy : 11.5;
        this.helicopter.crateGz = 110;
        this.helicopter.crateDropped = false;
        this.helicopter.x = -100;
        this.helicopter.y = 90;
        this.helicopter.crateY = 90;
        this.emit("helicopterSpawn", {});
      }
    } else {
      const speed = CONFIG.HELICOPTER?.SPEED || 120;
      if (this.helicopter.crateDropped) {
        this.helicopter.gx = (this.helicopter.gx ?? 1.5) + dt * 2.5;
        this.helicopter.gz = (this.helicopter.gz ?? 110) + dt * 10;
        if ((this.helicopter.crateGz ?? 110) > 0) {
          this.helicopter.crateGz = Math.max(0, (this.helicopter.crateGz ?? 110) - dt * 90);
        }
        this.helicopter.x = (this.helicopter.x ?? 180) + speed * dt;
        this.helicopter.crateY = (this.helicopter.crateY ?? 90) + 100 * dt;
        if ((this.helicopter.gx ?? 0) > 14.0) {
          this.helicopter.active = false;
          if (this.helicopter.crateCollected) {
            this.helicopter.crateDropped = false;
            this.helicopter.gx = -3.0;
            this.helicopter.crateGz = 110;
            this.helicopter.x = -100;
            this.helicopter.crateY = 90;
          }
        }
      } else if (this.helicopter.waitingClick) {
        const curGx = this.helicopter.gx ?? -3.0;
        if (curGx < 1.5) {
          this.helicopter.gx = Math.min(1.5, curGx + dt * 2.2);
        } else {
          this.helicopter.gx = 1.5;
          this.helicopter.hoverTimer = (this.helicopter.hoverTimer || 0) + dt;
          if (this.helicopter.hoverTimer >= 5.0) {
            this.helicopter.crateDropped = true;
            this.helicopter.waitingClick = false;
            this.helicopter.crateGz = 110;
            this.helicopter.hoverTimer = 0;
            this.emit("helicopterCrateDropped", {});
          }
        }
        const curX = this.helicopter.x ?? -100;
        if (curX < 180) {
          this.helicopter.x = curX + speed * dt;
        } else {
          this.helicopter.x = 180;
        }
      }
    }

    const rate = this.getIncomeRate();
    if (rate > 0) {
      const earned = rate * dt;
      this.money += earned;
      this.totalEarned += earned;
      this.emit("moneyChanged", { money: this.money, delta: earned, isPassive: true });
      if (typeof this.progressQuest === "function") {
        this.progressQuest("harvest_passive", earned);
      }
      const wellShift = typeof this.getSettlementBonus === "function" ? this.getSettlementBonus("wells") : 1.0;
      const bbl = earned * 0.00003 * wellShift;
      const gasGen = earned * 0.00005 * wellShift;
      if (!this.inventory) {
        this.inventory = {
          rawOil: 500, rawGas: 1000, fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0,
          dryGas: 0, lpg: 0, helium: 0, polymers: 0, petrochem: 0
        };
      }
      this.inventory.rawGas = (this.inventory.rawGas || 0) + gasGen;

      const maxCap = this.getOilStorageCapacity();
      this.oilStorageCapacity = maxCap;
      const curStorage = this.oilStorageCurrent;
      if (curStorage + bbl > maxCap) {
        const ofl = (curStorage + bbl) - maxCap;
        this.oilStorageCurrent = maxCap;
        const cr = ofl * 0.002;
        if (cr > 0) this.addCrypto(cr, true);
        this.triggerAdvisorTip("storage_full", "Мастер цеха Савельич", "Резервуары полные! Расширяй эстакаду налива, шеф!");
      } else {
        this.oilStorageCurrent = curStorage + bbl;
      }
    }

    // Industrial Processing Sector Pipelines
    if (this.inventory) {
      // 1. Oil Refinery (НПЗ)
      if (this.isSectorUnlocked("refinery") && (this.inventory.rawOil || 0) > 0) {
        const refLvl = Math.max(1, Math.min(4, this.refineryLevel || 1));
        const refShift = typeof this.getSettlementBonus === "function" ? this.getSettlementBonus("refinery") : 1.0;
        const throughput = (CONFIG.REFINERY?.throughputs?.[refLvl] || (20 + refLvl * 15)) * refShift;
        const toProcess = Math.min(this.inventory.rawOil, throughput * dt);
        if (toProcess > 0) {
          this.inventory.rawOil -= toProcess;
          let rec = null;
          if (this.customRecipeSelected?.refinery && this.industrialRecipes?.refinery) {
            rec = CONFIG.RECIPES?.refinery?.[this.industrialRecipes.refinery];
          }
          if (rec && rec.yields) {
            for (const [fuelKey, yRate] of Object.entries(rec.yields)) {
              this.inventory[fuelKey] = (this.inventory[fuelKey] || 0) + toProcess * yRate;
            }
          } else {
            const fuelKey = CONFIG.REFINERY?.fuelByLevel?.[refLvl] || "fuel_ai92";
            const yld = CONFIG.REFINERY?.yieldByLevel?.[refLvl] || 0.85;
            this.inventory[fuelKey] = (this.inventory[fuelKey] || 0) + toProcess * yld;
          }
        }
      }

      // 2. Gas Processing Plant (ГПЗ)
      if (this.isSectorUnlocked("gas_plant") && (this.inventory.rawGas || 0) > 0) {
        const gpLvl = Math.max(1, Math.min(4, this.gasPlantLevel || 1));
        const gpShift = typeof this.getSettlementBonus === "function" ? this.getSettlementBonus("gas_plant") : 1.0;
        const gpThroughput = (CONFIG.GAS_PLANT?.throughputs?.[gpLvl] || (30 * gpLvl)) * gpShift;
        const gasToProcess = Math.min(this.inventory.rawGas, gpThroughput * dt);
        if (gasToProcess > 0) {
          this.inventory.rawGas -= gasToProcess;
          const recId = this.industrialRecipes?.gas_plant || "balanced_gas";
          const rec = CONFIG.RECIPES?.gas_plant?.[recId];
          const dryYield = rec?.yields?.dryGas ?? (CONFIG.GAS_PLANT?.yields?.dryGas ?? 0.70);
          const lpgYield = rec?.yields?.lpg ?? (CONFIG.GAS_PLANT?.yields?.lpg ?? 0.25);
          const heYield = rec?.yields?.helium ?? (CONFIG.GAS_PLANT?.yields?.helium ?? 0.05);
          const dryGen = gasToProcess * dryYield;
          const lpgGen = gasToProcess * lpgYield;
          const heGen = gasToProcess * heYield;

          this.inventory.dryGas = (this.inventory.dryGas || 0) + dryGen;
          this.inventory.lpg = (this.inventory.lpg || 0) + lpgGen;
          this.inventory.helium = (this.inventory.helium || 0) + heGen;

          const pipelinePrice = CONFIG.GAS_PLANT?.dryGasPipelinePrice ?? 45.0;
          const gasMult = (this.market && typeof this.market.gasMultiplier === "number") ? this.market.gasMultiplier : 1.0;
          const pipelineRev = dryGen * pipelinePrice * gasMult;
          this.money += pipelineRev;
          this.totalEarned += pipelineRev;
          this.pipelineSalesRevenue = (this.pipelineSalesRevenue || 0) + pipelineRev;
          this.emit("moneyChanged", { money: this.money, delta: pipelineRev, source: "pipelineSales" });
        }
      }

      // 3. Petrochemical Complex (НГХК)
      if (this.isSectorUnlocked("petrochem") && (this.inventory.lpg || 0) > 0) {
        const pcLvl = Math.max(1, Math.min(4, this.petrochemLevel || 1));
        const pcShift = typeof this.getSettlementBonus === "function" ? this.getSettlementBonus("petrochem") : 1.0;
        const pcThroughput = (CONFIG.PETROCHEM?.throughputs?.[pcLvl] || (20 * pcLvl)) * pcShift;
        const lpgToProcess = Math.min(this.inventory.lpg, pcThroughput * dt);
        if (lpgToProcess > 0) {
          this.inventory.lpg -= lpgToProcess;
          const recId = this.industrialRecipes?.petrochem || "poly_standard";
          const rec = CONFIG.RECIPES?.petrochem?.[recId];
          const polyYield = rec?.yields?.polymers ?? (CONFIG.PETROCHEM?.yields?.polymers ?? 0.60);
          const chemYield = rec?.yields?.petrochem ?? (CONFIG.PETROCHEM?.yields?.petrochem ?? 0.40);
          const polyGen = lpgToProcess * polyYield;
          const chemGen = lpgToProcess * chemYield;

          this.inventory.polymers = (this.inventory.polymers || 0) + polyGen;
          this.inventory.petrochem = (this.inventory.petrochem || 0) + chemGen;
        }
      }
    }

    // 4. Arctic Marine Tanker Export Logistics
    this.tickMarineExport(dt);

    // 5. Regional Contracts & Convoy Logistics
    this.tickContracts(dt);

    // 6. Worker Settlement «Северная Звезда» Life-Support Simulation
    this.tickSettlement(dt);

    // 7. Megaproject «Ямал-СПГ» & Polar Seasons Cycle
    this.tickMegaproject(dt);

    const cryptoRate = this.getCryptoRate();
    if (cryptoRate > 0) {
      const earnedCrypto = cryptoRate * dt;
      this.crypto = (this.crypto || 0) + earnedCrypto;
      this.emit("cryptoChanged", { crypto: this.crypto, delta: earnedCrypto, isPassive: true });
    }
    const tickTimer = (target, eventName) => {
      if (!target || !target.active) return;
      target.remainingSec -= dt;
      if (target.remainingSec <= 0.001) {
        target.active = false;
        target.remainingSec = 0;
        target.multiplier = 1.0;
      }
      this.emit(eventName, target);
    };
    tickTimer(this.boost, "boostUpdated");
    tickTimer(this.mchsBoost, "mchsBoostUpdated");
    tickTimer(this.fountainBurst, "fountainBurstUpdated");
    tickTimer(this.brokerInsider, "brokerInsiderUpdated");
    if (this.accident && this.accident.active) {
      this.accident.remainingSec -= dt;
      if (this.accident.remainingSec <= 0.001) {
        this.accident.remainingSec = 0;
        this.resolveAccident("timeout");
      } else {
        this.emit("accidentTick", { remainingSec: this.accident.remainingSec, qteProgress: this.accident.qteProgress });
      }
    } else if (this.canTriggerAccident()) {
      this.accidentTimerSec = (this.accidentTimerSec || 0) + dt;
      if (this.accidentTimerSec >= this.accidentNextIntervalSec) {
        this.accidentTimerSec = 0;
        const minI = CONFIG.ACCIDENTS?.MIN_INTERVAL_SEC || 300.0;
        const maxI = CONFIG.ACCIDENTS?.MAX_INTERVAL_SEC || 420.0;
        this.accidentNextIntervalSec = minI + Math.random() * (maxI - minI);
        this.triggerAccident();
      }
    }
    marketEngine.tick(dt, this);
  }

  exportSave() {
    const s = this;
    return {
      version: CONFIG.VERSION,
      money: s.money,
      dollars: s.dollars || 0,
      crypto: s.crypto || 0,
      technologies: { ...(s.technologies || {}) },
      activeWellId: s.activeWellId,
      wells: s.wells,
      buildingPositions: s.buildingPositions ? { ...s.buildingPositions } : {},
      wellStimulation: s.wellStimulation ? JSON.parse(JSON.stringify(s.wellStimulation)) : {},
      stimulationStats: s.stimulationStats ? { ...s.stimulationStats } : { totalStimulations: 0, bestMultiplier: 1.0, totalExtraMoneyEarned: 0 },
      oilStorageCurrent: s.oilStorageCurrent || 0,
      industrialRecipes: s.industrialRecipes ? { ...s.industrialRecipes } : { refinery: "ai92_focus", gas_plant: "balanced_gas", petrochem: "poly_standard" },
      customRecipeSelected: s.customRecipeSelected ? { ...s.customRecipeSelected } : { refinery: false, gas_plant: false, petrochem: false },
      inventory: s.inventory ? { ...s.inventory } : null,
      unlockedSectors: typeof s.unlockedSectors === "object" ? { ...s.unlockedSectors } : s.unlockedSectors,
      refineryLevel: s.refineryLevel || 1,
      gasPlantLevel: s.gasPlantLevel || 1,
      petrochemLevel: s.petrochemLevel || 1,
      rvsParkLevel: s.rvsParkLevel || 1,
      pipelineSalesRevenue: s.pipelineSalesRevenue || 0,
      marineTerminal: {
        unlocked: Boolean(s.marineTerminal?.unlocked),
        tankerState: s.marineTerminal?.tankerState || s.marineTerminal?.state || "idle",
        state: s.marineTerminal?.tankerState || s.marineTerminal?.state || "idle",
        berthLevel: s.marineTerminal?.berthLevel || 1,
        capacityLevel: s.marineTerminal?.capacityLevel || s.marineTerminal?.berthLevel || 1,
        speedLevel: s.marineTerminal?.speedLevel || 1,
        cargoCapacity: s.marineTerminal?.cargoCapacity || 2000,
        cargo: s.marineTerminal?.cargo ? { ...s.marineTerminal.cargo } : { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 },
        cargoLoaded: s.marineTerminal?.cargoLoaded || 0,
        stageTimer: s.marineTerminal?.stageTimer || 0,
        voyageProgress: s.marineTerminal?.voyageProgress || 0,
        voyageTimer: s.marineTerminal?.voyageTimer || 0,
        voyageDuration: s.marineTerminal?.voyageDuration || 60.0,
        totalVoyages: s.marineTerminal?.totalVoyages || 0,
        totalExportRevenue: s.marineTerminal?.totalExportRevenue ? { ...s.marineTerminal.totalExportRevenue } : { rubles: 0, dollars: 0, goldenShares: 0 }
      },
      tanker: {
        state: s.marineTerminal?.tankerState || s.marineTerminal?.state || s.tanker?.state || "idle",
        cargoCapacity: s.marineTerminal?.cargoCapacity || 2000,
        currentCargo: s.marineTerminal?.cargoLoaded || s.tanker?.currentCargo || 0,
        cargoManifest: s.marineTerminal?.cargo ? { ...s.marineTerminal.cargo } : {},
        stateTimer: s.tanker?.stateTimer || 0,
        voyageTimer: s.marineTerminal?.voyageTimer || 0,
        voyageDuration: s.marineTerminal?.voyageDuration || 60.0,
        totalVoyages: s.marineTerminal?.totalVoyages || 0,
        totalRevenueExport: s.marineTerminal?.totalExportRevenue?.rubles || 0,
        totalExportDollars: s.marineTerminal?.totalExportRevenue?.dollars || 0,
        autoDispatch: Boolean(s.tanker?.autoDispatch)
      },
      loadingRackLevel: s.loadingRackLevel || 1,
      facilityLevel: s.facilityLevel || 1,
      canteenLevel: s.canteenLevel || 1,
      settlement: s.settlement ? {
        population: s.settlement.population || 24,
        maxPopulation: s.settlement.maxPopulation || 40,
        housingLevel: s.settlement.housingLevel || 1,
        boilerLevel: s.settlement.boilerLevel || 1,
        warmthLevel: typeof s.settlement.warmthLevel === "number" ? s.settlement.warmthLevel : 100.0,
        heatingStatus: s.settlement.heatingStatus || "optimal",
        rationBoostSec: s.settlement.rationBoostSec || 0,
        growthTimer: s.settlement.growthTimer || 0,
        shifts: s.settlement.shifts ? { ...s.settlement.shifts } : { wells: 8, refinery: 6, gas_plant: 5, petrochem: 5 }
      } : null,
      megaproject: s.megaproject ? {
        currentStage: s.megaproject.currentStage || 0,
        completed: Boolean(s.megaproject.completed),
        activeSeason: s.megaproject.activeSeason || "polar_day",
        seasonTimer: typeof s.megaproject.seasonTimer === "number" ? s.megaproject.seasonTimer : 300.0,
        endlessHorizonUnlocked: Boolean(s.megaproject.endlessHorizonUnlocked),
        corporatePrestigeLevel: s.megaproject.corporatePrestigeLevel || 1
      } : null,
      garageLevel: s.garageLevel || 1,
      trekolCount: s.trekolCount || 1,
      trekolRoverState: s.trekolRoverState ? { ...s.trekolRoverState } : null,
      cryptoMiningActive: Boolean(s.cryptoMiningActive),
      cryptoAdsWatched: Number(s.cryptoAdsWatched || 0),
      wellMastery: s.wellMastery || {},
      wellMaintenanceCooldowns: s.wellMaintenanceCooldowns || {},
      territories: s.territories || {},
      specialization: s.specialization,
      ipo: { goldenShares: s.ipo?.goldenShares || 0, companyName: typeof s.ipo?.companyName === "string" ? s.ipo.companyName : "", ipoCount: s.ipo?.ipoCount || 0 },
      dailyStreak: { day: s.dailyStreak?.day || 1, lastClaimDate: s.dailyStreak?.lastClaimDate || "" },
      advisor: { seenTips: { ...(s.advisor?.seenTips || {}) } },
      market: {
        oilPrice: s.market?.oilPrice ?? 75,
        gasPrice: s.market?.gasPrice ?? 35,
        oilMultiplier: s.market?.oilMultiplier ?? 1,
        gasMultiplier: s.market?.gasMultiplier ?? 1,
        activeEventId: s.market?.activeEvent?.id || null,
        eventRemainingSec: s.market?.eventRemainingSec || 0
      },
      brokerInsider: s.brokerInsider?.active ? { active: true, multiplier: s.brokerInsider.multiplier || 2.5, remainingSec: s.brokerInsider.remainingSec } : null,
      accident: s.accident?.active ? { active: true, type: s.accident.type, targetWellId: s.accident.targetWellId || "well_1", remainingSec: s.accident.remainingSec || 0, qteProgress: s.accident.qteProgress || 0, isGoldTap: Boolean(s.accident.isGoldTap) } : null,
      mchsBoost: s.mchsBoost?.active ? { active: true, multiplier: s.mchsBoost.multiplier || 1.5, remainingSec: s.mchsBoost.remainingSec || 0 } : null,
      sessionTimeSec: s.sessionTimeSec || 0,
      savelichLevel: s.savelichLevel || 1,
      savelichXp: s.savelichXp || 0,
      tutorialStep: s.tutorialStep || 0,
      tutorialCompleted: Boolean(s.tutorialCompleted),
      ftueStep: s.ftueStep || 0,
      ftueCompleted: Boolean(s.ftueCompleted),
      currentQuestIndex: s.currentQuestIndex || 0,
      quests: s.quests,
      lastPurgeTime: s.lastPurgeTime || 0,
      gatehouseLevel: s.gatehouseLevel || 1,
      substationLevel: s.substationLevel || 1,
      fenceLevel: s.fenceLevel || 1,
      mtrYardLevel: s.mtrYardLevel || 1,
      compressorLevel: s.compressorLevel || 1,
      gasTreatmentLevel: s.gasTreatmentLevel || 1,
      dormitoryLevel: s.dormitoryLevel || 1,
      contracts: (s.contracts || []).map(c => ({ ...c })),
      mtrMaterials: s.mtrMaterials || 0,
      totalContractsFulfilled: s.totalContractsFulfilled || 0,
      totalClicks: s.totalClicks,
      totalEarned: s.totalEarned,
      lastSaveTime: Date.now()
    };
  }

  toJSON() {
    return this.exportSave();
  }

  fromJSON(data) {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return this.importSave(parsed);
  }

  importSave(data) {
    if (!data) return this;
    const num = (v, d) => (typeof v === "number" && !isNaN(v) ? v : d);
    this.money = num(data.money, this.money);
    this.dollars = num(data.dollars, 0);
    this.crypto = num(data.crypto, 0);
    this.technologies = typeof data.technologies === "object" && data.technologies ? { ...data.technologies } : {};
    this.totalClicks = num(data.totalClicks, 0);
    this.totalEarned = num(data.totalEarned, 0);
    this.sessionTimeSec = num(data.sessionTimeSec, 0);
    if (data.activeWellId && this.wells[data.activeWellId]) this.activeWellId = data.activeWellId;
    if (data.buildingPositions && typeof data.buildingPositions === "object") {
      this.buildingPositions = { ...data.buildingPositions };
      // Automatically migrate legacy crowded positions to expanded outer island sectors
      if (this.buildingPositions.refinery && this.buildingPositions.refinery.x === -65) {
        delete this.buildingPositions.refinery;
      }
      if (this.buildingPositions.petrochem && this.buildingPositions.petrochem.x === 60) {
        delete this.buildingPositions.petrochem;
      }
      if (this.buildingPositions.gas_plant && this.buildingPositions.gas_plant.z === -65) {
        delete this.buildingPositions.gas_plant;
      }
      if (this.buildingPositions.storage && this.buildingPositions.storage.z === 65) {
        delete this.buildingPositions.storage;
      }
    }
    if (data.wells) CONFIG.WELLS.forEach(def => {
      if (data.wells[def.id]) this.wells[def.id] = { id: def.id, level: data.wells[def.id].level || 0, unlocked: Boolean(data.wells[def.id].unlocked) };
    });
    if (data.inventory && typeof data.inventory === "object") {
      this.inventory = {
        rawOil: num(data.inventory.rawOil, 500),
        rawGas: num(data.inventory.rawGas, 0),
        fuel_ai92: num(data.inventory.fuel_ai92, 0),
        fuel_ai95: num(data.inventory.fuel_ai95, 0),
        fuel_ai98: num(data.inventory.fuel_ai98, 0),
        fuel_ai100: num(data.inventory.fuel_ai100, 0),
        dryGas: num(data.inventory.dryGas, 0),
        lpg: num(data.inventory.lpg, 0),
        helium: num(data.inventory.helium, 0),
        polymers: num(data.inventory.polymers, 0),
        petrochem: num(data.inventory.petrochem, 0)
      };
    } else {
      const legacyStorage = num(data.oilStorageCurrent, 500);
      this.inventory = {
        rawOil: legacyStorage,
        rawGas: 0,
        fuel_ai92: 0,
        fuel_ai95: 0,
        fuel_ai98: 0,
        fuel_ai100: 0,
        dryGas: 0,
        lpg: 0,
        helium: 0,
        polymers: 0,
        petrochem: 0
      };
    }
    if (data.unlockedSectors) {
      if (Array.isArray(data.unlockedSectors)) {
        this.unlockedSectors = { central_base: true, base: true };
        data.unlockedSectors.forEach(s => { this.unlockedSectors[s] = true; });
      } else if (typeof data.unlockedSectors === "object") {
        this.unlockedSectors = { central_base: true, base: true, ...data.unlockedSectors };
      }
    } else {
      this.unlockedSectors = { central_base: true, base: true };
    }
    this.refineryLevel = Math.max(1, Math.min(4, num(data.refineryLevel, 1)));
    this.gasPlantLevel = Math.max(1, Math.min(4, num(data.gasPlantLevel, 1)));
    this.petrochemLevel = Math.max(1, Math.min(4, num(data.petrochemLevel, 1)));
    this.rvsParkLevel = Math.max(1, Math.min(4, num(data.rvsParkLevel, 1)));
    this.pipelineSalesRevenue = num(data.pipelineSalesRevenue, 0);
    this.industrialRecipes = (data.industrialRecipes && typeof data.industrialRecipes === "object")
      ? { ...data.industrialRecipes }
      : { refinery: "ai92_focus", gas_plant: "balanced_gas", petrochem: "poly_standard" };
    this.customRecipeSelected = (data.customRecipeSelected && typeof data.customRecipeSelected === "object")
      ? { ...data.customRecipeSelected }
      : { refinery: false, gas_plant: false, petrochem: false };

    if (data.marineTerminal && typeof data.marineTerminal === "object") {
      const m = data.marineTerminal;
      const rawRev = m.totalExportRevenue;
      const rublesRev = typeof rawRev === "number" ? rawRev : (rawRev && typeof rawRev.rubles === "number" ? rawRev.rubles : 0);
      const dollarsRev = typeof m.totalExportDollars === "number" ? m.totalExportDollars : (rawRev && typeof rawRev.dollars === "number" ? rawRev.dollars : 0);
      const sharesRev = rawRev && typeof rawRev.goldenShares === "number" ? rawRev.goldenShares : 0;
      const validStates = ["idle", "approaching", "berthing", "loading", "departing", "voyage", "returned"];
      const rawState = typeof m.tankerState === "string" ? m.tankerState : (typeof m.state === "string" ? m.state : "idle");
      const sanitizedState = validStates.includes(rawState) ? rawState : "idle";

      const cargo = m.cargo && typeof m.cargo === "object" ? { ...m.cargo } : { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 };
      const cargoSum = Object.values(cargo).reduce((s, v) => s + (typeof v === "number" && !isNaN(v) ? Math.max(0, v) : 0), 0);

      this.marineTerminal = {
        unlocked: true,
        tankerState: sanitizedState,
        state: sanitizedState,
        berthLevel: Math.max(1, Math.min(4, num(m.berthLevel, 1))),
        capacityLevel: Math.max(1, Math.min(5, num(m.capacityLevel, num(m.berthLevel, 1)))),
        speedLevel: Math.max(1, Math.min(5, num(m.speedLevel, 1))),
        cargoCapacity: Math.max(1000, num(m.cargoCapacity, 2000)),
        cargo: cargo,
        cargoLoaded: num(m.cargoLoaded, cargoSum),
        stageTimer: Math.max(0, num(m.stageTimer, 0)),
        voyageProgress: Math.max(0, Math.min(1.0, num(m.voyageProgress, 0.0))),
        voyageTimer: Math.max(0, num(m.voyageTimer, 0)),
        voyageDuration: Math.max(10, num(m.voyageDuration, 60.0)),
        totalVoyages: Math.max(0, num(m.totalVoyages, 0)),
        totalExportRevenue: {
          rubles: Math.max(0, rublesRev),
          dollars: Math.max(0, dollarsRev),
          goldenShares: Math.max(0, sharesRev)
        }
      };
    } else {
      this.marineTerminal = {
        unlocked: false,
        tankerState: "idle",
        state: "idle",
        berthLevel: 1,
        capacityLevel: 1,
        speedLevel: 1,
        cargoCapacity: 2000,
        cargo: { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 },
        cargoLoaded: 0,
        stageTimer: 0,
        voyageProgress: 0.0,
        voyageTimer: 0,
        voyageDuration: 60.0,
        totalVoyages: 0,
        totalExportRevenue: { rubles: 0, dollars: 0, goldenShares: 0 }
      };
    }

    if (data.tanker && typeof data.tanker === "object") {
      const t = data.tanker;
      this.tanker = {
        state: this.marineTerminal.state,
        stage: this.marineTerminal.state,
        cargoCapacity: num(t.cargoCapacity, this.marineTerminal.cargoCapacity),
        currentCargo: num(t.currentCargo, this.marineTerminal.cargoLoaded),
        cargoType: t.cargoType || null,
        cargo: this.marineTerminal.cargo,
        cargoManifest: this.marineTerminal.cargo,
        stateTimer: num(t.stateTimer, 0),
        stateDuration: CONFIG.TANKER?.DURATIONS?.[this.marineTerminal.state] || 15.0,
        voyageTimer: this.marineTerminal.voyageTimer,
        voyageDuration: this.marineTerminal.voyageDuration,
        totalVoyages: this.marineTerminal.totalVoyages,
        totalRevenueExport: this.marineTerminal.totalExportRevenue.rubles,
        totalExportDollars: this.marineTerminal.totalExportRevenue.dollars,
        autoDispatch: Boolean(t.autoDispatch),
        lastReward: t.lastReward || null
      };
    } else {
      this.tanker = {
        state: this.marineTerminal.state,
        stage: this.marineTerminal.state,
        cargoCapacity: this.marineTerminal.cargoCapacity,
        currentCargo: this.marineTerminal.cargoLoaded,
        cargoType: null,
        cargo: this.marineTerminal.cargo,
        cargoManifest: this.marineTerminal.cargo,
        stateTimer: 0,
        stateDuration: 15.0,
        voyageTimer: 0,
        voyageDuration: 60.0,
        totalVoyages: 0,
        totalRevenueExport: 0,
        totalExportDollars: 0,
        autoDispatch: false,
        lastReward: null
      };
    }

    this.oilStorageCurrent = num(data.oilStorageCurrent, this.oilStorageCurrent);
    this.loadingRackLevel = Math.max(1, Math.min(3, num(data.loadingRackLevel, 1)));
    this.facilityLevel = Math.max(1, Math.min(10, num(data.facilityLevel, 1)));
    this.canteenLevel = Math.max(1, Math.min(5, num(data.canteenLevel, 1)));
    this.garageLevel = Math.max(1, Math.min(5, num(data.garageLevel, 1)));
    this.trekolCount = Math.max(1, Math.min(5, num(data.trekolCount, this.garageLevel || 1)));
    if (data.trekolRoverState && typeof data.trekolRoverState === "object") {
      this.trekolRoverState = { ...data.trekolRoverState };
    }
    this.cryptoMiningActive = Boolean(data.cryptoMiningActive);
    this.cryptoAdsWatched = num(data.cryptoAdsWatched, 0);
    this.savelichLevel = Math.max(1, num(data.savelichLevel, 1));
    this.savelichXp = num(data.savelichXp, 0);
    this.tutorialStep = num(data.tutorialStep, 0);
    this.tutorialCompleted = Boolean(data.tutorialCompleted || data.ftueCompleted);
    this.ftueStep = num(data.ftueStep, this.tutorialCompleted ? 4 : this.tutorialStep);
    this.ftueCompleted = Boolean(data.ftueCompleted || data.tutorialCompleted);
    this.currentQuestIndex = num(data.currentQuestIndex, 0);
    if (Array.isArray(data.quests)) this.quests = data.quests;
    this.lastPurgeTime = num(data.lastPurgeTime, 0);
    this.gatehouseLevel = Math.max(1, num(data.gatehouseLevel, 1));
    this.substationLevel = Math.max(1, num(data.substationLevel, 1));
    this.fenceLevel = Math.max(1, num(data.fenceLevel, 1));
    this.mtrYardLevel = Math.max(1, num(data.mtrYardLevel, 1));
    this.compressorLevel = Math.max(1, num(data.compressorLevel, 1));
    this.gasTreatmentLevel = Math.max(1, num(data.gasTreatmentLevel, 1));
    this.dormitoryLevel = Math.max(1, num(data.dormitoryLevel, 1));
    this.mtrMaterials = num(data.mtrMaterials, 0);
    this.totalContractsFulfilled = num(data.totalContractsFulfilled, 0);
    if (Array.isArray(data.contracts) && data.contracts.length > 0) {
      this.contracts = data.contracts.map(c => ({ ...c }));
    } else {
      this.contracts = [];
      this.getContracts();
    }
    if (data.settlement && typeof data.settlement === "object") {
      const st = data.settlement;
      const shifts = (st.shifts && typeof st.shifts === "object") ? { ...st.shifts } : { wells: 8, refinery: 6, gas_plant: 5, petrochem: 5 };
      this.settlement = {
        population: Math.max(1, num(st.population, 24)),
        maxPopulation: Math.max(20, num(st.maxPopulation, 40)),
        housingLevel: Math.max(1, Math.min(5, num(st.housingLevel, 1))),
        boilerLevel: Math.max(1, Math.min(5, num(st.boilerLevel, 1))),
        warmthLevel: Math.max(0, Math.min(100, num(st.warmthLevel, 100.0))),
        heatingStatus: typeof st.heatingStatus === "string" ? st.heatingStatus : "optimal",
        rationBoostSec: Math.max(0, num(st.rationBoostSec, 0)),
        growthTimer: Math.max(0, num(st.growthTimer, 0)),
        shifts: {
          wells: Math.max(0, num(shifts.wells, 8)),
          refinery: Math.max(0, num(shifts.refinery, 6)),
          gas_plant: Math.max(0, num(shifts.gas_plant, 5)),
          petrochem: Math.max(0, num(shifts.petrochem, 5))
        }
      };
    } else {
      this.settlement = {
        population: 24,
        maxPopulation: 40,
        housingLevel: 1,
        boilerLevel: 1,
        warmthLevel: 100.0,
        heatingStatus: "optimal",
        rationBoostSec: 0,
        growthTimer: 0,
        shifts: { wells: 8, refinery: 6, gas_plant: 5, petrochem: 5 }
      };
    }
    if (data.megaproject && typeof data.megaproject === "object") {
      const mp = data.megaproject;
      this.megaproject = {
        currentStage: Math.max(0, Math.min(4, num(mp.currentStage, 0))),
        completed: Boolean(mp.completed),
        activeSeason: typeof mp.activeSeason === "string" ? mp.activeSeason : "polar_day",
        seasonTimer: Math.max(0, num(mp.seasonTimer, 300.0)),
        endlessHorizonUnlocked: Boolean(mp.endlessHorizonUnlocked),
        corporatePrestigeLevel: Math.max(1, num(mp.corporatePrestigeLevel, 1))
      };
    } else {
      this.megaproject = {
        currentStage: 0,
        completed: false,
        activeSeason: "polar_day",
        seasonTimer: 300.0,
        endlessHorizonUnlocked: false,
        corporatePrestigeLevel: 1
      };
    }
    if (data.wellMastery && typeof data.wellMastery === "object") {
      this.wellMastery = data.wellMastery;
    }
    if (data.wellMaintenanceCooldowns && typeof data.wellMaintenanceCooldowns === "object") {
      this.wellMaintenanceCooldowns = { ...data.wellMaintenanceCooldowns };
    }
    if (data.territories && typeof data.territories === "object") {
      this.territories = { ...data.territories };
    }
    this.specialization = (data.specialization === "oil" || data.specialization === "gas") ? data.specialization : null;
    const ipo = data.ipo || {};
    this.ipo = { goldenShares: Math.max(0, num(ipo.goldenShares, 0)), companyName: typeof ipo.companyName === "string" ? ipo.companyName : "", ipoCount: Math.max(0, num(ipo.ipoCount, 0)) };
    this.prestige = { shares: this.ipo.goldenShares, companyName: this.ipo.companyName, ipoCount: this.ipo.ipoCount };
    const strk = data.dailyStreak || {};
    this.dailyStreak = { day: Math.max(1, Math.min(7, num(strk.day, 1))), lastClaimDate: typeof strk.lastClaimDate === "string" ? strk.lastClaimDate : "" };
    this.advisor = { seenTips: { ...(data.advisor?.seenTips || {}) } };
    if (data.market) {
      this.market.oilPrice = num(data.market.oilPrice, 75);
      this.market.gasPrice = num(data.market.gasPrice, 35);
      this.market.oilMultiplier = num(data.market.oilMultiplier, 1);
      this.market.gasMultiplier = num(data.market.gasMultiplier, 1);
      this.market.eventRemainingSec = num(data.market.eventRemainingSec, 0);
      this.market.activeEvent = (data.market.activeEventId && CONFIG.EXCHANGE?.EVENTS) ? CONFIG.EXCHANGE.EVENTS.find(e => e.id === data.market.activeEventId) || null : null;
    }
    const elap = data.lastSaveTime ? Math.max(0, (Date.now() - data.lastSaveTime) / 1000) : 0;
    const rT = (s, m, d) => {
      if (s?.active && typeof s.remainingSec === "number") {
        const r = s.remainingSec - elap;
        if (r > 0) return { active: true, multiplier: s.multiplier || m, remainingSec: r, totalDurationSec: d };
      }
      return { active: false, multiplier: 1, remainingSec: 0, totalDurationSec: d };
    };
    this.brokerInsider = rT(data.brokerInsider, 2.5, 90);
    this.mchsBoost = rT(data.mchsBoost, 1.5, 180);
    const acc = data.accident;
    const remAcc = acc?.active && typeof acc.remainingSec === "number" ? acc.remainingSec - elap : 0;
    this.accident = remAcc > 0 ? { active: true, type: acc.type || "gusher", targetWellId: acc.targetWellId || "well_1", remainingSec: remAcc, totalDurationSec: 6, qteProgress: acc.qteProgress || 0, isGoldTap: Boolean(acc.isGoldTap) } : { active: false, type: null, remainingSec: 0, totalDurationSec: 6, qteProgress: 0, isGoldTap: false };

    if (data.wellStimulation && typeof data.wellStimulation === "object") {
      this.wellStimulation = {};
      for (const wId in data.wellStimulation) {
        const raw = data.wellStimulation[wId];
        if (raw && typeof raw === "object") {
          const rem = Math.max(0, num(raw.remainingSec, 0) - elap);
          this.wellStimulation[wId] = {
            wellId: wId,
            multiplier: Math.max(1.0, Math.min(2.5, num(raw.multiplier, 1.0))),
            baseMultiplier: Math.max(1.0, Math.min(2.0, num(raw.baseMultiplier, 1.0))),
            peakMultiplier: Math.max(0.0, Math.min(1.5, num(raw.peakMultiplier, 0.0))),
            durationSec: Math.max(10, num(raw.durationSec, 240.0)),
            remainingSec: rem,
            geonavScore: num(raw.geonavScore, 1.0),
            fracScore: num(raw.fracScore, 1.0),
            totalStimulations: num(raw.totalStimulations, 1),
            lastStimulatedTime: num(raw.lastStimulatedTime, Date.now())
          };
        }
      }
    } else {
      this.wellStimulation = {};
    }
    if (data.stimulationStats && typeof data.stimulationStats === "object") {
      this.stimulationStats = {
        totalStimulations: num(data.stimulationStats.totalStimulations, 0),
        bestMultiplier: num(data.stimulationStats.bestMultiplier, 1.0),
        totalExtraMoneyEarned: num(data.stimulationStats.totalExtraMoneyEarned, 0)
      };
    } else {
      this.stimulationStats = { totalStimulations: 0, bestMultiplier: 1.0, totalExtraMoneyEarned: 0 };
    }
    this.emit("moneyChanged", { money: this.money, delta: 0 });
    this.emit("dollarsChanged", { dollars: this.dollars, delta: 0 });
    this.emit("cryptoChanged", { crypto: this.crypto, delta: 0 });
    this.emit("technologiesUpdated", this.technologies);
    this.emit("activeWellChanged", this.getActiveWellDef());
    CONFIG.WELLS.forEach(def => {
      this.emit("wellUpdated", { wellId: def.id, well: this.wells[def.id], def });
    });
    if (this.specialization) this.emit("specializationChanged", { type: this.specialization });
    this.emit("marketTick", { oilMultiplier: this.market.oilMultiplier, gasMultiplier: this.market.gasMultiplier, activeEvent: this.market.activeEvent, oilPrice: this.market.oilPrice, gasPrice: this.market.gasPrice });
    return this;
  }
}
export const state = new GameState();