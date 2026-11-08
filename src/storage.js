import { platform } from "./platform-bridge.js";

const SAVE_KEY_V3 = "oil_tycoon_save_v3";
const SAVE_KEY_V2 = "oil_tycoon_save_v2";
const SAVE_KEY_V1 = "oil_tycoon_save_v1";

class StorageManager {
  constructor() {
    this.cloudSaveDebounceTimer = null;
    this.lastCloudSaveTime = 0;
  }

  sanitizeSaveData(data) {
    if (!data || typeof data !== "object") return null;

    const sanitized = { ...data };

    if (sanitized.money !== undefined && typeof sanitized.money !== "number") {
      sanitized.money = Number(sanitized.money) || 0;
    }
    if (sanitized.dollars !== undefined && typeof sanitized.dollars !== "number") {
      sanitized.dollars = Number(sanitized.dollars) || 0;
    }
    if (sanitized.crypto !== undefined && typeof sanitized.crypto !== "number") {
      sanitized.crypto = Number(sanitized.crypto) || 0;
    }

    if (sanitized.specialization && sanitized.specialization !== "oil" && sanitized.specialization !== "gas") {
      sanitized.specialization = null;
    }

    if (sanitized.sessionTimeSec !== undefined && typeof sanitized.sessionTimeSec !== "number") {
      sanitized.sessionTimeSec = Number(sanitized.sessionTimeSec) || 0;
    }

    if (sanitized.ipo && typeof sanitized.ipo === "object") {
      if (typeof sanitized.ipo.goldenShares !== "number" || isNaN(sanitized.ipo.goldenShares) || sanitized.ipo.goldenShares < 0) {
        sanitized.ipo.goldenShares = 0;
      }
      if (typeof sanitized.ipo.companyName !== "string") {
        sanitized.ipo.companyName = "";
      }
      if (typeof sanitized.ipo.ipoCount !== "number" || isNaN(sanitized.ipo.ipoCount) || sanitized.ipo.ipoCount < 0) {
        sanitized.ipo.ipoCount = 0;
      }
    } else {
      sanitized.ipo = { goldenShares: 0, companyName: "", ipoCount: 0 };
    }

    // Version 3 inventory & industrial sectors sanitize
    if (sanitized.inventory && typeof sanitized.inventory === "object") {
      const num = (v, d) => (typeof v === "number" && !isNaN(v) ? v : d);
      sanitized.inventory = {
        rawOil: num(sanitized.inventory.rawOil, 500),
        rawGas: num(sanitized.inventory.rawGas, 0),
        fuel_ai92: num(sanitized.inventory.fuel_ai92, 0),
        fuel_ai95: num(sanitized.inventory.fuel_ai95, 0),
        fuel_ai98: num(sanitized.inventory.fuel_ai98, 0),
        fuel_ai100: num(sanitized.inventory.fuel_ai100, 0),
        dryGas: num(sanitized.inventory.dryGas, 0),
        lpg: num(sanitized.inventory.lpg, 0),
        helium: num(sanitized.inventory.helium, 0),
        polymers: num(sanitized.inventory.polymers, 0),
        petrochem: num(sanitized.inventory.petrochem, 0)
      };
    } else {
      sanitized.inventory = {
        rawOil: Number(sanitized.oilStorageCurrent) || 500,
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

    if (!sanitized.unlockedSectors || typeof sanitized.unlockedSectors !== "object") {
      sanitized.unlockedSectors = { central_base: true, base: true };
    } else if (Array.isArray(sanitized.unlockedSectors)) {
      const map = { central_base: true, base: true };
      sanitized.unlockedSectors.forEach(s => { map[s] = true; });
      sanitized.unlockedSectors = map;
    } else {
      sanitized.unlockedSectors.central_base = true;
      sanitized.unlockedSectors.base = true;
    }

    sanitized.refineryLevel = Math.max(1, Math.min(4, Number(sanitized.refineryLevel) || 1));
    sanitized.gasPlantLevel = Math.max(1, Math.min(4, Number(sanitized.gasPlantLevel) || 1));
    sanitized.petrochemLevel = Math.max(1, Math.min(4, Number(sanitized.petrochemLevel) || 1));
    sanitized.rvsParkLevel = Math.max(1, Math.min(4, Number(sanitized.rvsParkLevel) || 1));
    sanitized.pipelineSalesRevenue = Number(sanitized.pipelineSalesRevenue) || 0;

    // Version 3 Marine Terminal & Tanker Sanitize
    const num = (v, d) => (typeof v === "number" && !isNaN(v) ? v : d);
    if (sanitized.marineTerminal && typeof sanitized.marineTerminal === "object") {
      const m = sanitized.marineTerminal;
      const validStates = ["idle", "approaching", "berthing", "loading", "departing", "voyage", "returned"];
      const curState = validStates.includes(m.state) ? m.state : "idle";
      const rawRev = m.totalExportRevenue;
      const rublesRev = (rawRev && typeof rawRev.rubles === "number" && !isNaN(rawRev.rubles) && rawRev.rubles >= 0) ? rawRev.rubles : 0;
      const dollarsRev = (rawRev && typeof rawRev.dollars === "number" && !isNaN(rawRev.dollars) && rawRev.dollars >= 0) ? rawRev.dollars : 0;
      const sharesRev = (rawRev && typeof rawRev.goldenShares === "number" && !isNaN(rawRev.goldenShares) && rawRev.goldenShares >= 0) ? rawRev.goldenShares : 0;

      sanitized.marineTerminal = {
        unlocked: Boolean(m.unlocked === true || m.unlocked === "true"),
        state: curState,
        berthLevel: Math.max(1, Math.min(4, num(m.berthLevel, 1))),
        capacityLevel: Math.max(1, Math.min(5, num(m.capacityLevel, num(m.berthLevel, 1)))),
        speedLevel: Math.max(1, Math.min(5, num(m.speedLevel, 1))),
        cargoCapacity: Math.max(1000, num(m.cargoCapacity, 2000)),
        cargo: m.cargo && typeof m.cargo === "object" ? { ...m.cargo } : { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 },
        voyageProgress: Math.max(0, Math.min(1.0, num(m.voyageProgress, 0.0))),
        voyageTimer: Math.max(0, num(m.voyageTimer, 0)),
        voyageDuration: Math.max(10, num(m.voyageDuration, 60.0)),
        totalVoyages: Math.max(0, num(m.totalVoyages, 0)),
        totalExportRevenue: {
          rubles: rublesRev,
          dollars: dollarsRev,
          goldenShares: sharesRev
        }
      };
    } else {
      sanitized.marineTerminal = {
        unlocked: false,
        state: "idle",
        berthLevel: 1,
        capacityLevel: 1,
        speedLevel: 1,
        cargoCapacity: 2000,
        cargo: { fuel_ai92: 0, fuel_ai95: 0, fuel_ai98: 0, fuel_ai100: 0, polymers: 0, petrochem: 0, rawOil: 0 },
        voyageProgress: 0.0,
        voyageTimer: 0,
        voyageDuration: 60.0,
        totalVoyages: 0,
        totalExportRevenue: { rubles: 0, dollars: 0, goldenShares: 0 }
      };
    }

    if (sanitized.tanker && typeof sanitized.tanker === "object") {
      const t = sanitized.tanker;
      const validStates = ["idle", "approaching", "berthing", "loading", "departing", "voyage", "returned"];
      const curState = validStates.includes(t.state) ? t.state : sanitized.marineTerminal.state;
      sanitized.tanker = {
        state: curState,
        cargoCapacity: Math.max(1000, num(t.cargoCapacity, sanitized.marineTerminal.cargoCapacity)),
        currentCargo: Math.max(0, num(t.currentCargo, 0)),
        cargoManifest: t.cargoManifest && typeof t.cargoManifest === "object" ? { ...t.cargoManifest } : { ...sanitized.marineTerminal.cargo },
        stateTimer: Math.max(0, num(t.stateTimer, 0)),
        voyageTimer: Math.max(0, num(t.voyageTimer, sanitized.marineTerminal.voyageTimer)),
        voyageDuration: Math.max(10, num(t.voyageDuration, sanitized.marineTerminal.voyageDuration)),
        totalVoyages: Math.max(0, num(t.totalVoyages, sanitized.marineTerminal.totalVoyages)),
        totalRevenueExport: Math.max(0, num(t.totalRevenueExport, sanitized.marineTerminal.totalExportRevenue.rubles)),
        totalExportDollars: Math.max(0, num(t.totalExportDollars, sanitized.marineTerminal.totalExportRevenue.dollars)),
        autoDispatch: Boolean(t.autoDispatch)
      };
    } else {
      sanitized.tanker = {
        state: sanitized.marineTerminal.state,
        cargoCapacity: sanitized.marineTerminal.cargoCapacity,
        currentCargo: 0,
        cargoManifest: { ...sanitized.marineTerminal.cargo },
        stateTimer: 0,
        voyageTimer: 0,
        voyageDuration: 60.0,
        totalVoyages: sanitized.marineTerminal.totalVoyages,
        totalRevenueExport: sanitized.marineTerminal.totalExportRevenue.rubles,
        totalExportDollars: sanitized.marineTerminal.totalExportRevenue.dollars,
        autoDispatch: false
      };
    }

    // Schema versioning
    sanitized.schemaVersion = 3;

    return sanitized;
  }

  async load() {
    if (typeof window !== "undefined") {
      const isResetFlag = localStorage.getItem("game_hard_reset_flag") === "1" || window.location.search.includes("reset");
      if (isResetFlag) {
        try {
          localStorage.removeItem("game_hard_reset_flag");
          this.clear();
        } catch (_) {}
        console.log("[Storage] Hard reset triggered - starting clean ground zero");
        return null;
      }
    }

    let localData = null;

    // 1. Try loading v3 from localStorage
    try {
      const rawV3 = localStorage.getItem(SAVE_KEY_V3);
      if (rawV3) {
        localData = JSON.parse(rawV3);
      }
    } catch (e) {
      console.warn("[Storage] Local v3 read error:", e);
    }

    // 2. Migration: If no v3, look for v2 then v1
    if (!localData) {
      try {
        const rawV2 = localStorage.getItem(SAVE_KEY_V2);
        if (rawV2) {
          localData = JSON.parse(rawV2);
          console.log("[Storage] Migrated local save v2 -> v3");
        } else {
          const rawV1 = localStorage.getItem(SAVE_KEY_V1);
          if (rawV1) {
            localData = JSON.parse(rawV1);
            console.log("[Storage] Migrated legacy local save v1 -> v3");
          }
        }
        if (localData) {
          localStorage.setItem(SAVE_KEY_V3, JSON.stringify({ ...localData, schemaVersion: 3 }));
        }
      } catch (e) {
        console.warn("[Storage] Local migration error:", e);
      }
    }

    // 3. Load from Cloud via PlatformBridge (checks v3 then v2)
    let cloudData = null;
    try {
      cloudData = await platform.loadFromCloud(SAVE_KEY_V3);
      if (!cloudData) {
        cloudData = await platform.loadFromCloud(SAVE_KEY_V2);
      }
    } catch (e) {
      console.warn("[Storage] Cloud read error:", e);
    }

    // Compare timestamps to pick freshest save
    if (cloudData && localData) {
      const cloudTime = cloudData.timestamp || 0;
      const localTime = localData.timestamp || 0;
      if (cloudTime > localTime) {
        return this.sanitizeSaveData(cloudData);
      }
      return this.sanitizeSaveData(localData);
    }

    const resolved = cloudData || localData || null;
    return this.sanitizeSaveData(resolved);
  }

  save(gameState) {
    if (!gameState || this.isResetting || (typeof window !== "undefined" && window.__isResetting) || gameState.__preventSave) {
      return;
    }

    const dataToSave = {
      ...gameState,
      schemaVersion: 3,
      timestamp: Date.now()
    };

    // Save to localStorage v3 & v2 fallback
    try {
      localStorage.setItem(SAVE_KEY_V3, JSON.stringify(dataToSave));
      localStorage.setItem(SAVE_KEY_V2, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn("[Storage] Local save failed:", e);
    }

    // Debounced Cloud Save
    const now = Date.now();
    if (now - this.lastCloudSaveTime > 15000) {
      this.lastCloudSaveTime = now;
      platform.saveToCloud(dataToSave, SAVE_KEY_V3);
    } else {
      clearTimeout(this.cloudSaveDebounceTimer);
      this.cloudSaveDebounceTimer = setTimeout(() => {
        this.lastCloudSaveTime = Date.now();
        platform.saveToCloud(dataToSave, SAVE_KEY_V3);
      }, 15000);
    }
  }

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY_V3);
      localStorage.removeItem(SAVE_KEY_V2);
      localStorage.removeItem(SAVE_KEY_V1);
      localStorage.removeItem("mock_cloud_" + SAVE_KEY_V3);
      localStorage.removeItem("mock_cloud_" + SAVE_KEY_V2);
      localStorage.removeItem("mock_cloud_" + SAVE_KEY_V1);
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    try {
      platform.saveToCloud(null, SAVE_KEY_V3);
      platform.saveToCloud(null, SAVE_KEY_V2);
    } catch (e) {}
  }
}

export const storage = new StorageManager();
