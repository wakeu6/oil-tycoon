const gusherDef={id:"gusher",name:"Выброс грифона",title:"Грифон!",badge:"🌋 ГРИФОН",tapMultiplier:3.0,debitMultiplier:1.0,isGoldTap:true,accentColor:"#eab308"};const ruptureDef={id:"rupture",name:"Порыв фланца",title:"Порыв!",badge:"⚠️ ПОРЫВ",tapMultiplier:1.0,debitMultiplier:1.0,isGoldTap:false,accentColor:"#ef4444"};export const CONFIG={GAME_TITLE:"Нефтяной Олигарх",VERSION:"1.1.0",CURRENCIES:{MONEY:"₽",DOLLARS:"$",CRYPTO:"⚡"},MAP:{WORLD_WIDTH:1400,HELIPAD_X:180,GATHERING_STATION_X:600,FLARE_STATION_X:1340,CLUSTERS:[{id:"well_1",name:"Пионер",type:"ШГН",x:380},{id:"well_2",name:"Северный",type:"СКД",x:840},{id:"well_3",name:"Полярный",type:"АФК",x:1060},{id:"well_4",name:"Горизонт",type:"ЭЦН",x:1260}]},TECHNOLOGIES:{tech_sash:{id:"tech_sash",cat:1,name:"Штанги СШН",icon:"🏗️",currency:"money",baseCost:5000,costMult:2.2,maxLevel:5,effectPerLevel:0.50,desc:"+50%"},tech_fracking:{id:"tech_fracking",cat:1,name:"ГРП Пласта",icon:"💥",currency:"money",baseCost:15000,costMult:2.5,maxLevel:5,effectPerLevel:0.25,desc:"+25%"},tech_thermal:{id:"tech_thermal",cat:1,name:"Термогаз",icon:"🔥",currency:"money",baseCost:50000,costMult:1.0,maxLevel:1,effect:0.40,desc:"+40%"},tech_aframax:{id:"tech_aframax",cat:2,name:"Aframax",icon:"🚢",currency:"dollars",baseCost:50,costMult:2.0,maxLevel:5,effectPerLevel:0.20,desc:"+20%"},tech_lng_term:{id:"tech_lng_term",cat:2,name:"СПГ-Терминал",icon:"❄️",currency:"dollars",baseCost:150,costMult:1.0,maxLevel:1,effect:0.35,desc:"+35%"},tech_storage:{id:"tech_storage",cat:2,name:"Парк РВС",icon:"🛢️",currency:"dollars",baseCost:300,costMult:1.0,maxLevel:1,desc:"8ч"},tech_radar:{id:"tech_radar",cat:3,name:"Авиарадар",icon:"📡",currency:"crypto",baseCost:20,costMult:1.0,maxLevel:1,desc:"45с"},tech_telemetry:{id:"tech_telemetry",cat:3,name:"Телеметрия",icon:"🤖",currency:"crypto",baseCost:35,costMult:1.0,maxLevel:1,desc:"9с"},tech_crypto_gen:{id:"tech_crypto_gen",cat:3,name:"Генераторы",icon:"⚡",currency:"crypto",baseCost:50,costMult:2.0,maxLevel:3,effectPerLevel:1.0,desc:"+100%"},tech_listing:{id:"tech_listing",cat:4,name:"Листинг",icon:"🌐",currency:"money",baseCost:500000,costMult:2.5,maxLevel:3,desc:"+1 акция"},tech_div_mult:{id:"tech_div_mult",cat:4,name:"Дивиденды",icon:"📈",currency:"dollars",baseCost:250,costMult:1.0,maxLevel:1,desc:"+3%"},tech_subsidy:{id:"tech_subsidy",cat:4,name:"Субсидия",icon:"🏛️",currency:"money",baseCost:800000,costMult:1.0,maxLevel:1,desc:"100к ₽"}},HELICOPTER:{INTERVAL_SEC:75.0,SPEED:120,FLIGHT_ALTITUDE:90},DAILY_STREAK:{rewards:[500,1500,5000,20000,75000,250000,1500000]},SPECIALIZATION:{UNLOCK_WELL_ID:"well_1",UNLOCK_LEVEL:5,OIL:{id:"oil",name:"Нефть",title:"Нефтяной магнат",badge:"🛢️ НЕФТЬ",tapMultiplier:2.5,passiveMultiplier:1.0,priceMin:0.6,priceMax:3.0,volatility:0.15,burstChance:0.05,burstDurationSec:4.0,burstMultiplier:3.0,offlineHours:2.0,offlineEff:0.8,accentColor:"#f59e0b"},GAS:{id:"gas",name:"Газ",title:"Газовый барон",badge:"🔥 ГАЗ",tapMultiplier:1.0,passiveMultiplier:1.45,priceMin:0.92,priceMax:1.08,volatility:0.02,burstChance:0.0,burstDurationSec:0,burstMultiplier:1.0,offlineHours:4.0,offlineEff:1.0,accentColor:"#06b6d4"}},EXCHANGE:{BASE_OIL_PRICE:75.0,BASE_GAS_PRICE:35.0,TICK_INTERVAL_SEC:1.0,COMMODITIES:{oil:{id:"oil",name:"Нефть Brent",symbol:"BRENT",unit:"$/барр",basePrice:75.0,minMultiplier:0.60,maxMultiplier:3.00,volatility:0.02,accentColor:"#f59e0b"},gas:{id:"gas",name:"Природный газ TTF",symbol:"TTF",unit:"$/MWh",basePrice:35.0,minMultiplier:0.92,maxMultiplier:1.08,volatility:0.005,accentColor:"#06b6d4"}},BROKER_INSIDER:{multiplier:2.5,durationSec:90.0,cooldownSec:0,title:"Инсайд брокера",badge:"📈 ИНСАЙД x2.5"},CADENCE:{MIN_INTERVAL_SEC:40.0,MAX_INTERVAL_SEC:60.0,DEFAULT_DURATION_SEC:40.0,PRICE_UPDATE_INTERVAL_SEC:1.0},EVENTS:[{id:"suez_blockade",badge:"СУЭЦ 🚢",headline:"Суэцкий канал заблокирован! Нефть +120%",commodity:"oil",priceChange:1.20,volumeChange:-0.15,durationSec:45.0},{id:"eurasia_freeze",badge:"МОРОЗЫ ❄️",headline:"Аномальные морозы! Газ +150%",commodity:"gas",priceChange:1.50,volumeChange:0.25,durationSec:45.0},{id:"opec_deal",badge:"ОПЕК+📉",headline:"Срыв сделки ОПЕК+! Нефть -35%",commodity:"oil",priceChange:-0.35,volumeChange:0.20,durationSec:40.0},{id:"lng_demand_spike",badge:"СПГ ⚡",headline:"Спрос на СПГ! Газ +45%",commodity:"gas",priceChange:0.45,volumeChange:0.15,durationSec:35.0},{id:"hormuz_tensions",badge:"КОНФЛИКТ ⚠️",headline:"Конфликт в Ормузе! Нефть +70%",commodity:"oil",priceChange:0.70,volumeChange:-0.10,durationSec:40.0}]},ACCIDENTS:{EMBARGO_SEC:240.0,MIN_INTERVAL_SEC:300.0,MAX_INTERVAL_SEC:420.0,QTE_DURATION_SEC:6.0,MCHS_INSURANCE_SEC:300.0,MCHS_BOOST_MULTIPLIER:1.5,MCHS_BOOST_DURATION_SEC:180.0,QTE_REWARD_SECONDS:30.0,MCHS:{INSURANCE_MINUTES:5.0,BOOST_MULTIPLIER:1.5,BOOST_DURATION_SEC:180.0},TYPES:{gusher:gusherDef,rupture:ruptureDef,GUSHER:gusherDef,RUPTURE:ruptureDef}},OFFLINE:{MAX_HOURS:2.0,MIN_SECONDS_TO_SHOW:45,EFFICIENCY:0.8},getOfflineConfig(specialization){if(specialization==="gas"){return {maxHours:this.SPECIALIZATION.GAS.offlineHours,efficiency:this.SPECIALIZATION.GAS.offlineEff,minSecondsToShow:this.OFFLINE.MIN_SECONDS_TO_SHOW};}return {maxHours:this.OFFLINE.MAX_HOURS,efficiency:this.OFFLINE.EFFICIENCY,minSecondsToShow:this.OFFLINE.MIN_SECONDS_TO_SHOW};},BOOSTS:{FOUNTAIN:{DURATION_SEC:120,MULTIPLIER:3.0},GRANT:{REWARD_MINUTES:10,MIN_FALLBACK_REWARD:500}},ADS:{INTERSTITIAL_COOLDOWN_MS:180*1000,FIRST_INTERSTITIAL_DELAY_MS:180*1000},WELLS:[{id:"well_1",name:"Скважина №1",type:"ШГН",icon:"🏗️",color:"#f59e0b",baseCost:15,unlockCost:0,baseIncome:1.5,baseRate:10,baseTapPower:1.0,costMultiplier:1.15,rigType:"pumpjack_classic"},{id:"well_2",name:"Скважина №2",type:"СКД",icon:"⚙️",color:"#06b6d4",baseCost:200,unlockCost:500,baseIncome:12.0,baseRate:25,baseTapPower:5.0,costMultiplier:1.16,rigType:"pumpjack_heavy"},{id:"well_3",name:"Скважина №3",type:"АФК",icon:"🌋",color:"#ec4899",baseCost:2500,unlockCost:6000,baseIncome:95.0,baseRate:60,baseTapPower:35.0,costMultiplier:1.17,rigType:"christmas_tree"},{id:"well_4",name:"Скважина №4",type:"ЭЦН",icon:"⚡",color:"#10b981",baseCost:25000,unlockCost:65000,baseIncome:650.0,baseRate:180,baseTapPower:220.0,costMultiplier:1.18,rigType:"submersible_ecn"}],getUpgradeCost(baseCost,multiplier,level){if(level===0)return baseCost;return Math.floor(baseCost*Math.pow(multiplier,level));},getWellIncome(baseIncome,level){if(level<=0)return 0;return baseIncome*level;},getWellTapPower(baseTapPower,level){if(level<=0)return 0;return baseTapPower*(1+(level-1)*0.4);},
  SECTORS: {
    central_base: { id: "central_base", name: "Центральный промысел", cost: 0, unlocked: true },
    base: { id: "base", name: "Центральный промысел", cost: 0, unlocked: true },
    refinery: { id: "refinery", name: "НПЗ «Северный Факел»", cost: 50000, description: "Переработка сырой нефти в высокооктановые топлива (АИ-92..100)" },
    gas_plant: { id: "gas_plant", name: "ГПЗ «Полярный Метан»", cost: 150000, description: "Криогенная сепарация попутного газа в товарный метан, ШФЛУ и гелий" },
    petrochem: { id: "petrochem", name: "НГХК «Сибирский Полимер»", cost: 500000, description: "Пиролиз ШФЛУ и полимеризация в полиэтилен и полипропилен" },
    storage_park: { id: "storage_park", name: "Парк РВС-50000 & МТР", cost: 100000, description: "Резервуарный парк длительного хранения сырья и готовых топлив" },
    storage: { id: "storage", name: "Парк РВС-50000 & МТР", cost: 100000, description: "Резервуарный парк длительного хранения сырья и готовых топлив" },
    wells_cluster: { id: "wells_cluster", name: "Кустовые площадки 5 и 6", cost: 250000, description: "Расширение фонда скважин: кусты №5 и №6" },
    marine_terminal: { id: "marine_terminal", name: "Морской терминал «Ворота Арктики»", cost: 250000, maxLevel: 4, description: "Глубоководный причал и экспортные танкерные рейсы ледового класса Arc7" },
    marine_port: { id: "marine_port", name: "Морской терминал «Ворота Арктики»", cost: 250000, maxLevel: 4, description: "Глубоководный причал и экспортные танкерные рейсы ледового класса Arc7" },
    port: { id: "port", name: "Морской терминал «Ворота Арктики»", cost: 250000, maxLevel: 4, description: "Глубоководный причал и экспортные танкерные рейсы ледового класса Arc7" },
    terminal: { id: "terminal", name: "Морской терминал «Ворота Арктики»", cost: 250000, maxLevel: 4, description: "Глубоководный причал и экспортные танкерные рейсы ледового класса Arc7" }
  },
  FUELS: {
    fuel_ai92: { id: "fuel_ai92", name: "АИ-92 Регуляр", wholesalePrice: 65.0, yieldRate: 0.85, requiredLevel: 1 },
    fuel_ai95: { id: "fuel_ai95", name: "АИ-95 Премиум", wholesalePrice: 85.0, yieldRate: 0.80, requiredLevel: 2 },
    fuel_ai98: { id: "fuel_ai98", name: "АИ-98 Супер", wholesalePrice: 120.0, yieldRate: 0.75, requiredLevel: 3 },
    fuel_ai100: { id: "fuel_ai100", name: "АИ-100 Рейсинг", wholesalePrice: 175.0, yieldRate: 0.70, requiredLevel: 4 }
  },
  REFINERY: {
    maxLevel: 4,
    upgradeCosts: { 1: 75000, 2: 200000, 3: 500000 },
    throughputs: { 1: 25.0, 2: 45.0, 3: 75.0, 4: 120.0 },
    fuelByLevel: { 1: "fuel_ai92", 2: "fuel_ai95", 3: "fuel_ai98", 4: "fuel_ai100" },
    yieldByLevel: { 1: 0.85, 2: 0.80, 3: 0.75, 4: 0.70 }
  },
  GAS_PLANT: {
    maxLevel: 4,
    upgradeCosts: { 1: 150000, 2: 350000, 3: 750000 },
    throughputs: { 1: 30.0, 2: 60.0, 3: 100.0, 4: 160.0 },
    yields: { dryGas: 0.70, lpg: 0.25, helium: 0.05 },
    dryGasPipelinePrice: 45.0
  },
  PETROCHEM: {
    maxLevel: 4,
    upgradeCosts: { 1: 300000, 2: 650000, 3: 1200000 },
    throughputs: { 1: 20.0, 2: 40.0, 3: 70.0, 4: 110.0 },
    yields: { polymers: 0.60, petrochem: 0.40 },
    prices: { polymers: 320.0, petrochem: 450.0 }
  },
  RECIPES: {
    refinery: {
      ai92_focus: { id: "ai92_focus", name: "АИ-92 Регуляр", reqLevel: 1, yields: { fuel_ai92: 0.85 }, desc: "Массовое производство топлива АИ-92 (выход 85%)", icon: "⛽" },
      ai95_focus: { id: "ai95_focus", name: "АИ-95 Премиум", reqLevel: 2, yields: { fuel_ai95: 0.80 }, desc: "Высокооктановый бензин АИ-95 Евро-5 (выход 80%)", icon: "🚗" },
      ai98_focus: { id: "ai98_focus", name: "АИ-98 Супер", reqLevel: 3, yields: { fuel_ai98: 0.75 }, desc: "Спортивное топливо АИ-98 (выход 75%)", icon: "🏎️" },
      ai100_focus: { id: "ai100_focus", name: "АИ-100 Экстра", reqLevel: 4, yields: { fuel_ai100: 0.70 }, desc: "Элитное авиа- и автотопливо АИ-100 (выход 70%)", icon: "✈️" },
      arctic_diesel: { id: "arctic_diesel", name: "Арктик-Дизель", reqLevel: 2, yields: { fuel_ai92: 0.40, fuel_ai95: 0.42 }, desc: "Морозостойкое дизтопливо для полярной техники и судов", icon: "❄️" }
    },
    gas_plant: {
      balanced_gas: { id: "balanced_gas", name: "Балансный режим", reqLevel: 1, yields: { dryGas: 0.70, lpg: 0.25, helium: 0.05 }, desc: "Стандартное разделение: 70% метан, 25% СУГ, 5% гелий", icon: "🔥" },
      lpg_focus: { id: "lpg_focus", name: "Максимум СУГ", reqLevel: 2, yields: { dryGas: 0.50, lpg: 0.45, helium: 0.05 }, desc: "Увеличенный отбор СУГ для нефтехимического синтеза", icon: "🧪" },
      helium_extraction: { id: "helium_extraction", name: "Крио-Гелий", reqLevel: 3, yields: { dryGas: 0.65, lpg: 0.20, helium: 0.15 }, desc: "Глубокая криогенная очистка сверхчистого гелия (15%)", icon: "🎈" }
    },
    petrochem: {
      poly_standard: { id: "poly_standard", name: "Полимеры ПНД", reqLevel: 1, yields: { polymers: 0.60, petrochem: 0.40 }, desc: "Гранулированный полиэтилен высокой плотности", icon: "🧱" },
      mtr_composite: { id: "mtr_composite", name: "Композиты МТР", reqLevel: 2, yields: { polymers: 0.75, petrochem: 0.25 }, desc: "Ударопрочные композитные стройматериалы для Арктики", icon: "🏗️" },
      special_reagents: { id: "special_reagents", name: "Химреагенты", reqLevel: 3, yields: { polymers: 0.35, petrochem: 0.65 }, desc: "Буровые растворы и поверхностно-активные вещества", icon: "⚗️" }
    }
  },
  RVS_PARK: {
    maxLevel: 4,
    upgradeCosts: { 1: 200000, 2: 450000, 3: 900000 },
    capacityBonus: { 1: 15000, 2: 35000, 3: 65000, 4: 100000 }
  },
  CONTRACTS: {
    maxSlots: 6,
    refreshCooldownSec: 90.0,
    deliveryDurationSec: 15.0,
    unitValues: {
      fuel_ai92: { price: 120, name: "АИ-92", icon: "⛽", unit: "bbl" },
      fuel_ai95: { price: 180, name: "АИ-95", icon: "🚗", unit: "bbl" },
      fuel_ai98: { price: 260, name: "АИ-98", icon: "🏎️", unit: "bbl" },
      fuel_ai100: { price: 380, name: "АИ-100", icon: "✈️", unit: "bbl" },
      dryGas: { price: 85, name: "Метан", icon: "🔥", unit: "тыс. м³" },
      lpg: { price: 140, name: "СУГ", icon: "🧪", unit: "т" },
      helium: { price: 650, name: "Крио-Гелий", icon: "🎈", unit: "м³" },
      polymers: { price: 320, name: "Полимеры", icon: "🧱", unit: "т" },
      petrochem: { price: 450, name: "Нефтехимия", icon: "⚗️", unit: "т" },
      rawOil: { price: 75, name: "Сырая нефть", icon: "🛢️", unit: "bbl" }
    },
    factions: {
      rosmorport: {
        id: "rosmorport",
        name: "ФГУП «Росморпорт»",
        icon: "⚓",
        badge: "Бункеровка СМП",
        color: "#005bab",
        preferredGoods: ["fuel_ai92", "fuel_ai95", "rawOil"],
        moneyBonus: 1.25,
        mtrBonus: 1
      },
      sibur: {
        id: "sibur",
        name: "ПАО «СИБУР Холдинг»",
        icon: "🧪",
        badge: "Нефтехимия & Синтез",
        color: "#00a3e0",
        preferredGoods: ["polymers", "lpg", "petrochem"],
        moneyBonus: 1.15,
        mtrBonus: 3
      },
      eurochem: {
        id: "eurochem",
        name: "АО «МХК ЕвроХим»",
        icon: "🌾",
        badge: "Агрохимия & Спецреагенты",
        color: "#10b981",
        preferredGoods: ["petrochem", "helium", "dryGas"],
        moneyBonus: 1.20,
        mtrBonus: 2
      },
      nsr_logistics: {
        id: "nsr_logistics",
        name: "Логистика Севморпути",
        icon: "🚢",
        badge: "Арктический Конвой",
        color: "#6366f1",
        preferredGoods: ["fuel_ai95", "fuel_ai98", "fuel_ai100", "polymers"],
        moneyBonus: 1.35,
        mtrBonus: 2
      },
      polar_municipality: {
        id: "polar_municipality",
        name: "Поселок «Северная Звезда»",
        icon: "🏙️",
        badge: "Муниципальный Заказ",
        color: "#f59e0b",
        preferredGoods: ["dryGas", "fuel_ai92", "lpg"],
        moneyBonus: 1.10,
        mtrBonus: 4
      }
    }
  },
  SETTLEMENT: {
    maxHousingLevel: 5,
    maxBoilerLevel: 5,
    maxCanteenLevel: 5,
    housing: {
      1: { capacity: 40, costMoney: 0, costMtr: 0, title: "Модульный блок А-1" },
      2: { capacity: 70, costMoney: 50000, costMtr: 10, title: "Модульный блок А-2" },
      3: { capacity: 110, costMoney: 150000, costMtr: 25, title: "Жилой комплекс «Арктика»" },
      4: { capacity: 160, costMoney: 350000, costMtr: 50, title: "Полярный городок «Север»" },
      5: { capacity: 240, costMoney: 800000, costMtr: 100, title: "Научно-вахтовый кампус" }
    },
    boiler: {
      baseGasConsumption: 0.25,
      backupFuelConsumption: 0.15,
      levels: {
        1: { efficiency: 1.0, costMoney: 40000, costMtr: 5, title: "Модульная котельная ТКУ-1" },
        2: { efficiency: 0.85, costMoney: 100000, costMtr: 15, title: "Газопоршневой энергоблок" },
        3: { efficiency: 0.70, costMoney: 250000, costMtr: 35, title: "Когенерационная ТЭЦ" },
        4: { efficiency: 0.55, costMoney: 550000, costMtr: 70, title: "Автономный крио-энергокомплекс" },
        5: { efficiency: 0.40, costMoney: 1200000, costMtr: 150, title: "Атомная микро-ТЭС" }
      }
    },
    canteen: {
      levels: {
        1: { moraleBonus: 0.10, costMoney: 30000, costMtr: 5, title: "Вахтовая столовая №1" },
        2: { moraleBonus: 0.20, costMoney: 80000, costMtr: 15, title: "Столовая-кафе «Полярник»" },
        3: { moraleBonus: 0.35, costMoney: 200000, costMtr: 30, title: "Оздоровительно-бытовой комплекс" },
        4: { moraleBonus: 0.50, costMoney: 450000, costMtr: 60, title: "Спортивно-рекреационный центр" },
        5: { moraleBonus: 0.75, costMoney: 1000000, costMtr: 120, title: "Арктический биокупол" }
      }
    },
    shiftEfficiency: {
      wells: 0.015,
      refinery: 0.02,
      gas_plant: 0.02,
      petrochem: 0.02
    }
  },
  MEGAPROJECT: {
    id: "yamal_lng",
    name: "Мегапроект «Ямал-СПГ»",
    totalStages: 4,
    stages: {
      1: {
        stage: 1,
        title: "Свайное основание и термостабилизация",
        desc: "Бурение 15 000 термостабилизирующих свай в вечной мерзлоте для предотвращения растепления грунтов.",
        costMoney: 500000,
        costMtr: 50,
        costGoods: { polymers: 100 },
        costDollars: 0,
        rewardDesc: "+15% дебит кустов скважин, открытие причала криогенных танкеров СПГ",
        buff: { wellDebitMult: 1.15 }
      },
      2: {
        stage: 2,
        title: "Криогенные резервуары СПГ (РВСП-160000)",
        desc: "Возведение двухслойных криогенных изотермических резервуаров с изоляцией из перлита.",
        costMoney: 1500000,
        costMtr: 120,
        costGoods: { lpg: 200 },
        costDollars: 50,
        rewardDesc: "+25 000 м³ емкости хранения СПГ, +25% доход от газовых контрактов",
        buff: { storageBonus: 25000, gasSalesMult: 1.25 }
      },
      3: {
        stage: 3,
        title: "Технологические линии сжижения (Process Trains)",
        desc: "Монтаж тяжеловодных крио-турбин, испарителей хладагента (MR) и компрессорных блоков.",
        costMoney: 4000000,
        costMtr: 250,
        costGoods: { dryGas: 1000 },
        costDollars: 100,
        rewardDesc: "Криогенное сжижение СПГ, валютная выручка в $ от прямых поставок по СМП",
        buff: { exportRateMult: 1.50 }
      },
      4: {
        stage: 4,
        title: "Морской порт Сабетта & Атомный ледокол «Арктика»",
        desc: "Завершение строительства глубоководного канала и ввод в строй атомного ледокольного флота.",
        costMoney: 10000000,
        costMtr: 500,
        costGoods: {},
        costDollars: 300,
        rewardDesc: "Триумф Мегапроекта! Открытие глубоководного шельфа Карского моря, FLNG и бесконечных сезонов",
        buff: { endlessModeUnlocked: true }
      }
    },
    seasons: {
      polar_day: { id: "polar_day", name: "Полярный день", icon: "☀️", durationSec: 300.0, buffDesc: "+25% скорость строительства и выработка энергии" },
      polar_night: { id: "polar_night", name: "Полярная ночь", icon: "🌌", durationSec: 300.0, buffDesc: "+35% доход от продажи тепла, метана и топлива" },
      ice_breakup: { id: "ice_breakup", name: "Весенний ледоход", icon: "🧊", durationSec: 300.0, buffDesc: "+100% награды за арктические танкерные конвои" }
    }
  },
  TANKER: {
    cargoCapacity: 2000,
    baseCapacity: 2000,
    BASE_CAPACITY: 2000,
    BERTH_CAPACITY_PER_LEVEL: 500,
    voyageDuration: 60.0,
    PUMP_RATE: 200.0,
    AUTO_DISPATCH_INTERVAL_SEC: 20.0,
    DURATIONS: {
      idle: 15.0,
      approaching: 5.0,
      berthing: 3.0,
      loading: 5.0,
      departing: 5.0,
      voyage: 60.0,
      returned: 1.0
    },
    stageDurations: {
      idle: 15.0,
      approaching: 5.0,
      berthing: 3.0,
      loading: 5.0,
      departing: 5.0,
      voyage: 60.0,
      returned: 1.0
    },
    EXPORT_PREMIUM_MULTIPLIER: 1.60,
    premiumMultiplier: 1.60,
    DOLLAR_RATES: {
      fuel_ai92: 0.04,
      fuel_ai95: 0.05,
      fuel_ai98: 0.06,
      fuel_ai100: 0.08,
      polymers: 0.12,
      petrochem: 0.15,
      rawOil: 0.03
    },
    dollarRates: {
      fuel_ai92: 0.04,
      fuel_ai95: 0.05,
      fuel_ai98: 0.06,
      fuel_ai100: 0.08,
      polymers: 0.12,
      petrochem: 0.15,
      rawOil: 0.03
    },
    goldenShareRatio: 500,
    GOLDEN_SHARES_PER_CARGO: 500,
    BERTH_UPGRADE_COSTS: {
      1: 150000,
      2: 350000,
      3: 800000
    },
    MAX_CAPACITY_LEVEL: 5,
    CAPACITY_UPGRADE_COSTS: {
      1: 150000,
      2: 400000,
      3: 1000000,
      4: 2500000
    },
    CAPACITY_VALUES: {
      1: 2000,
      2: 3500,
      3: 5500,
      4: 8000,
      5: 12000
    },
    MAX_SPEED_LEVEL: 5,
    SPEED_UPGRADE_COSTS: {
      1: 100000,
      2: 250000,
      3: 650000,
      4: 1600000
    },
    SPEED_DURATIONS: {
      1: 60.0,
      2: 45.0,
      3: 32.0,
      4: 22.0,
      5: 15.0
    },
    CARGO_PRIORITY: [
      "polymers",
      "petrochem",
      "fuel_ai100",
      "fuel_ai98",
      "fuel_ai95",
      "fuel_ai92",
      "rawOil"
    ]
  },
  GEONAV: {
    FORMATION: {
      OVERBURDEN_BOTTOM: 1400.0,
      PAY_ZONE_TOP: 1400.0,
      PAY_ZONE_BOTTOM: 1650.0,
      SWEET_SPOT_TOP: 1475.0,
      SWEET_SPOT_BOTTOM: 1575.0,
      BASAL_WATER_TOP: 1650.0,
      SHALE_GAMMA_MIN: 100.0,
      SHALE_GAMMA_MAX: 140.0,
      SWEET_GAMMA_MIN: 25.0,
      SWEET_GAMMA_MAX: 45.0,
      MARGINAL_GAMMA_MIN: 45.0,
      MARGINAL_GAMMA_MAX: 65.0,
      WATER_GAMMA_MIN: 80.0,
      WATER_GAMMA_MAX: 110.0
    },
    DRILLING: {
      KOP: 800.0,
      BASE_ROP: 12.0,
      MAX_DLS: 5.0,
      TARGET_LENGTH: 800.0,
      MAX_INCLINATION: 110.0,
      MIN_INCLINATION: 0.0
    }
  },
  FRAC: {
    STAGES_COUNT: 4,
    STAGE_POSITIONS: [0.85, 0.65, 0.45, 0.25],
    P_HYDROSTATIC: 15.0,
    P_BREAKDOWN: 55.0,
    P_SWEET_MIN: 48.0,
    P_SWEET_MAX: 58.0,
    P_SWEET_OPTIMAL: 53.0,
    P_SCREENOUT_THRESHOLD: 65.0,
    P_BURST_LIMIT: 75.0,
    PUMP_RATE: 20.0,
    STAGE_TIMEOUT_SEC: 3.5,
    GEONAV_WEIGHT: 0.60,
    FRAC_WEIGHT: 0.90,
    MIN_MULTIPLIER: 1.25,
    MAX_MULTIPLIER: 2.50,
    DEFAULT_DURATION_SEC: 240.0,
    PERMANENT_BASE_RATIO: 0.35,
    TEMPORARY_PEAK_RATIO: 0.65
  },
  TANKER: {
    MAX_CAPACITY_LEVEL: 5,
    CAPACITY_UPGRADE_COSTS: { 1: 150000, 2: 400000, 3: 1000000, 4: 2500000 },
    CAPACITY_VALUES: [2000, 3500, 5500, 8000, 12000],
    MAX_SPEED_LEVEL: 5,
    SPEED_UPGRADE_COSTS: { 1: 100000, 2: 250000, 3: 650000, 4: 1600000 },
    SPEED_DURATIONS: [60.0, 45.0, 32.0, 22.0, 15.0],
    BASE_CAPACITY: 2000,
    BERTH_CAPACITY_PER_LEVEL: 500,
    BERTH_UPGRADE_COSTS: { 1: 150000, 2: 350000, 3: 800000 },
    CARGO_PRIORITY: ["polymers", "petrochem", "fuel_ai100", "fuel_ai98", "fuel_ai95", "fuel_ai92", "rawOil"],
    DURATIONS: {
      idle: 15.0,
      approaching: 5.0,
      berthing: 3.0,
      loading: 5.0,
      departing: 5.0,
      voyage: 60.0,
      returned: 1.0
    },
    AUTO_DISPATCH_INTERVAL_SEC: 20.0,
    EXPORT_PREMIUM_MULTIPLIER: 1.60,
    DOLLAR_RATES: {
      fuel_ai92: 0.04,
      fuel_ai95: 0.05,
      fuel_ai98: 0.06,
      fuel_ai100: 0.08,
      polymers: 0.12,
      petrochem: 0.15,
      rawOil: 0.03
    },
    GOLDEN_SHARES_PER_CARGO: 500
  }
};