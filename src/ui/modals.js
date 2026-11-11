import {state}from "../state.js";import {audio}from "../audio.js";import {platform}from "../platform-bridge.js";import {CONFIG}from "../config.js";import {HudView}from "./hud.js";export class ModalsManager{constructor(){const g=id=>document.getElementById(id);this.offlineModal=g("modal-offline");this.offlineTimeLabel=g("offline-time-label");this.offlineMoneyLabel=g("offline-money-label");this.btnOfflineClaim=g("btn-offline-claim");this.btnOfflineDouble=g("btn-offline-double");this.regularAmountTag=g("regular-amount-tag");this.doubleAmountTag=g("double-amount-tag");this.boostsModal=g("modal-boosts");this.btnOpenBoosts=g("btn-boost");this.btnCloseBoosts=g("btn-close-boosts");this.btnClaimFountain=g("btn-claim-boost-fountain");this.btnClaimGrant=g("btn-claim-boost-grant");this.specModal=g("modal-specialization");this.btnSelectOil=g("btn-select-oil");this.btnSelectGas=g("btn-select-gas");this.cardSelectOil=g("spec-card-oil");this.cardSelectGas=g("spec-card-gas");this.exchangeModal=g("modal-exchange");this.btnCloseExchange=g("btn-close-exchange");this.btnBrokerInsider=g("btn-broker-insider");this.btnBrokerTitle=g("btn-broker-title");this.btnBrokerSub=g("btn-broker-sub");this.brokerActiveBox=g("broker-active-status");this.brokerTimerDisplay=g("broker-timer-display");this.oilPriceEl=g("exchange-oil-price");this.gasPriceEl=g("exchange-gas-price");this.oilTrendEl=g("exchange-oil-trend");this.gasTrendEl=g("exchange-gas-trend");this.oilMultEl=g("exchange-oil-mult");this.gasMultEl=g("exchange-gas-mult");this.oilBarEl=g("exchange-oil-bar");this.gasBarEl=g("exchange-gas-bar");this.eventCard=g("exchange-event-card");this.eventBadgeEl=g("exchange-event-badge");this.eventHeadlineEl=g("exchange-event-headline");this.eventDescEl=g("exchange-event-desc");this.eventEffectEl=g("exchange-event-effect");this.eventTimerEl=g("exchange-event-timer");this.accidentModal=g("modal-accident");this.accidentTitleEl=g("accident-title");this.accidentDescEl=g("accident-desc");this.accidentBadgeEl=g("accident-badge");this.accidentTimerEl=g("accident-timer");this.accidentTimerBar=g("accident-timer-bar");this.qteProgressBar=g("qte-progress-bar");this.qteProgressText=g("qte-progress-text");this.btnQteAction=g("btn-qte-action");this.btnCallMchs=g("btn-call-mchs");this.mchsPayoutTag=g("mchs-payout-tag");this.ipoModal=g("modal-ipo");this.inputCompanyName=g("input-company-name");this.btnConfirmIpo=g("btn-confirm-ipo");this.btnCloseIpo=g("btn-close-ipo");this.ipoCertificate=g("ipo-certificate");this.ipoNameError=g("ipo-name-error");this.ipoCharCount=g("ipo-char-count");this.certCompanyPreview=g("cert-company-preview");this.certSharesAwarded=g("cert-shares-awarded");this.certDividendBonus=g("cert-dividend-bonus");this.certTotalShares=g("cert-total-shares");this.btnIpoActionTitle=g("btn-ipo-action-title");this.btnIpoActionSub=g("btn-ipo-action-sub");this.streakModal=g("modal-streak");this.btnClaimStreak=g("btn-claim-streak");this.btnDoubleStreak=g("btn-double-streak");this.streakDaysGrid=g("streak-days-grid");this.btnStreakTrigger=g("btn-streak-trigger");this.crateModal=g("modal-supply-crate");this.btnClaimCrateFree=g("btn-claim-crate-free");this.btnClaimCrateAd=g("btn-claim-crate-ad");this.marketModal=g("modal-marketplace");this.btnCloseMarket=g("btn-close-marketplace");this.marketCardsList=g("marketplace-cards-list");this.companyStockModal=g("modal-company-stock");this.stockTickerEl=g("stock-ticker");this.stockPriceEl=g("stock-price");this.stockMarketcapEl=g("stock-marketcap");this.stockGoldenSharesEl=g("stock-golden-shares");this.stockChartCanvas=g("stock-chart-canvas");this.stockChartChangeEl=g("stock-chart-change");this.stockPrestigeTierEl=g("stock-prestige-tier");this.stockPrestigeDescEl=g("stock-prestige-desc");this.btnStockSpo=g("btn-stock-spo");this.btnCloseCompanyStock=g("btn-close-company-stock");this.specInfoModal=g("modal-spec-info");this.specInfoTitleEl=g("spec-info-title");this.specInfoBadgeEl=g("spec-info-badge");this.specInfoContentEl=g("spec-info-content");this.btnCloseSpecInfo=g("btn-close-spec-info");
this.tuningModal = g("modal-well-tuning");
this.cryptoModal = g("modal-crypto-activation");
this.btnUnlockCryptoMoney = g("btn-unlock-crypto-money");
this.btnUnlockCryptoAd = g("btn-unlock-crypto-ad");
this.btnCloseCrypto = g("btn-close-crypto-activation");
this.cryptoAdCounter = g("crypto-ad-counter");
this.cryptoAdFill = g("crypto-ad-fill");
if (this.btnCloseCrypto) {
  this.btnCloseCrypto.addEventListener("click", () => this.closeCryptoModal());
}
if (this.btnUnlockCryptoMoney) {
  this.btnUnlockCryptoMoney.addEventListener("click", () => {
    if (state.unlockCryptoMiningWithMoney()) {
      this.closeCryptoModal();
    } else {
      if (typeof audio?.playTap === "function") audio.playTap();
    }
  });
}
if (this.btnUnlockCryptoAd) {
  this.btnUnlockCryptoAd.addEventListener("click", () => {
    platform.showRewardedVideo({
      onRewarded: () => {
        state.progressCryptoMiningAd();
        this.updateCryptoModal();
        if (state.cryptoMiningActive) this.closeCryptoModal();
        if (typeof window.showToast === "function") window.showToast("🎬 Прогресс майнинга: +1");
      },
      onError: () => {}
    });
  });
}
state.on("openCryptoActivationModal", () => this.showCryptoModal());
this.tuningWellBadge = g("tuning-well-badge");
this.tuningTitle = g("tuning-modal-title");
this.tuningSubtitle = g("tuning-modal-subtitle");
this.btnCloseTuning = g("btn-close-tuning-modal");
this.manometerCanvas = g("manometer-canvas");
this.btnValveTurn = g("btn-action-valve-turn");
this.valveTurnsDots = [g("turn-dot-0"), g("turn-dot-1"), g("turn-dot-2")];
this.btnPurgeTap = g("btn-action-purge-tap");
this.purgeBarFill = g("purge-bar-fill");
this.purgePctLabel = g("purge-pct-label");
this.purgeTimerLabel = g("purge-timer-label");
this.sensorSlider = g("sensor-freq-slider");
this.sensorFreqLabel = g("sensor-freq-label");
this.sensorStatusBadge = g("sensor-status-badge");
this.btnSensorSync = g("btn-action-sensor-sync");
this.tuningMasteryPct = g("tuning-mastery-pct");
this.badgeMasteryValve = g("badge-mastery-valve");
this.badgeMasteryPurge = g("badge-mastery-purge");
this.badgeMasterySensor = g("badge-mastery-sensor");

this.currentTuningWellId = "well_1";
this.activeTuningTab = "valve";
this.valveTurnsCompleted = 0;
this.tuningPressure = 120;
this.tuningRafId = null;
this.purgeProgress = 0;
this.purgeTimerSec = 10.0;
this.purgeIntervalId = null;
this.activeMarketCat=1;this.pendingOfflineReward=0;this.initEvents();}initEvents(){
state.on("openWellTuningModal", (data) => this.showWellTuningModal(data?.wellId));
if (this.btnCloseTuning) this.btnCloseTuning.addEventListener("click", () => this.hideWellTuningModal());
document.querySelectorAll(".tuning-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tuning-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    this.switchTuningTab(btn.dataset.tab);
  });
});
if (this.btnValveTurn) {
  this.btnValveTurn.addEventListener("click", () => this.handleValveTurnClick());
}
if (this.btnPurgeTap) {
  this.btnPurgeTap.addEventListener("click", () => this.handlePurgeTapClick());
}
if (this.sensorSlider) {
  this.sensorSlider.addEventListener("input", () => this.handleSensorSliderChange());
}
if (this.btnSensorSync) {
  this.btnSensorSync.addEventListener("click", () => this.handleSensorSyncClick());
}
state.on("openCompanyStockModal",()=>this.showCompanyStockModal());state.on("openSpecializationInfoModal",()=>this.showSpecializationInfoModal());if(this.btnCloseCompanyStock)this.btnCloseCompanyStock.addEventListener("click",()=>this.hideCompanyStockModal());if(this.btnCloseSpecInfo)this.btnCloseSpecInfo.addEventListener("click",()=>this.hideSpecInfoModal());if(this.btnStockSpo)this.btnStockSpo.addEventListener("click",()=>this.handleStockSpo());if(this.btnQteAction){this.btnQteAction.addEventListener("click",()=>{state.progressAccidentQte(0.10);if(typeof audio?.playTap==="function")audio.playTap();});}if(this.btnCallMchs){this.btnCallMchs.addEventListener("click",()=>{this.triggerMchsRescue();});}state.on("accidentTriggered",(data)=>{this.showAccidentModal(data);});state.on("accidentResolved",()=>{this.hideAccidentModal();});state.on("accidentTick",(data)=>{this.updateAccidentTimer(data);});state.on("accidentQteProgress",(data)=>{this.updateQteProgress(data);});if(this.btnCloseExchange){this.btnCloseExchange.addEventListener("click",()=>{this.hideExchangeModal();});}if(this.btnBrokerInsider){this.btnBrokerInsider.addEventListener("click",()=>{this.triggerBrokerTip();});}state.on("marketTick",(data)=>{this.updateExchangeModal(data);});state.on("brokerInsiderActivated",(data)=>{this.updateBrokerStatus(state.brokerInsider||data);});state.on("brokerInsiderUpdated",(broker)=>{this.updateBrokerStatus(broker);});state.on("openExchangeModal",()=>{this.showExchangeModal();});state.on("specializationAvailable",()=>{this.showSpecializationModal();});if(this.btnSelectOil){this.btnSelectOil.addEventListener("click",(e)=>{e.stopPropagation();this.handleSelectSpecialization("oil");});}if(this.cardSelectOil){this.cardSelectOil.addEventListener("click",()=>{this.handleSelectSpecialization("oil");});this.cardSelectOil.addEventListener("keydown",(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();this.handleSelectSpecialization("oil");}});}if(this.btnSelectGas){this.btnSelectGas.addEventListener("click",(e)=>{e.stopPropagation();this.handleSelectSpecialization("gas");});}if(this.cardSelectGas){this.cardSelectGas.addEventListener("click",()=>{this.handleSelectSpecialization("gas");});this.cardSelectGas.addEventListener("keydown",(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();this.handleSelectSpecialization("gas");}});}this.btnOfflineClaim.addEventListener("click",()=>{if(this.pendingOfflineReward>0){state.addMoney(this.pendingOfflineReward);audio.playCoin();this.pendingOfflineReward=0;}this.offlineModal.classList.add("hidden");platform.showInterstitial();});this.btnOfflineDouble.addEventListener("click",()=>{const doubledAmount=this.pendingOfflineReward*2;platform.showRewardedVideo({onRewarded:()=>{state.addMoney(doubledAmount);audio.playUpgrade();this.pendingOfflineReward=0;this.offlineModal.classList.add("hidden");if(typeof window.showToast==="function")window.showToast("💰 Оффлайн-доход удвоен!");},onError:()=>{state.addMoney(this.pendingOfflineReward);this.pendingOfflineReward=0;this.offlineModal.classList.add("hidden");}});});this.btnOpenBoosts.addEventListener("click",()=>{this.boostsModal.classList.remove("hidden");});this.btnCloseBoosts.addEventListener("click",()=>{this.boostsModal.classList.add("hidden");platform.showInterstitial();});this.btnClaimFountain.addEventListener("click",()=>{platform.showRewardedVideo({onRewarded:()=>{state.activateBoost(CONFIG.BOOSTS.FOUNTAIN.DURATION_SEC,CONFIG.BOOSTS.FOUNTAIN.MULTIPLIER);this.boostsModal.classList.add("hidden");if(typeof window.showToast==="function")window.showToast("⚡ Буст x3 активирован!");},onError:()=>{}});});this.btnClaimGrant.addEventListener("click",()=>{platform.showRewardedVideo({onRewarded:()=>{const currentRate=state.getIncomeRate();const grantMoney=Math.max(CONFIG.BOOSTS.GRANT.MIN_FALLBACK_REWARD,Math.round(currentRate*60*CONFIG.BOOSTS.GRANT.REWARD_MINUTES));state.addMoney(grantMoney);audio.playUpgrade();this.boostsModal.classList.add("hidden");if(typeof window.showToast==="function")window.showToast("🏛️ Госгрант получен!");},onError:()=>{}});});state.on("openIpoModal",()=>{this.showIpoModal();});state.on("ipoComplete",()=>{this.hideIpoModal();audio.playUpgrade();});if(this.btnCloseIpo){this.btnCloseIpo.addEventListener("click",()=>{this.hideIpoModal();});}if(this.inputCompanyName){this.inputCompanyName.addEventListener("input",()=>{this.handleCompanyNameInput();});this.inputCompanyName.addEventListener("keydown",(e)=>{if(e.key==="Enter"&&this.btnConfirmIpo&&!this.btnConfirmIpo.disabled){e.preventDefault();this.handleConfirmIpo();}});}if(this.btnConfirmIpo){this.btnConfirmIpo.addEventListener("click",()=>{this.handleConfirmIpo();});}if(this.btnStreakTrigger){this.btnStreakTrigger.addEventListener("click",()=>this.showStreakModal());}if(this.btnClaimStreak){this.btnClaimStreak.addEventListener("click",()=>{state.claimDailyStreak(false);this.hideStreakModal();audio.playCoin();});}if(this.btnDoubleStreak){this.btnDoubleStreak.addEventListener("click",()=>{platform.showRewardedVideo({onRewarded:()=>{state.claimDailyStreak(true);this.hideStreakModal();audio.playUpgrade();if(typeof window.showToast==="function")window.showToast("🎁 Двойной ежедневный бонус получен!");},onError:()=>{}});});}const closeCrate=()=>{if(state.helicopter){state.helicopter.crateDropped=true;state.helicopter.waitingClick=false;}this.hideCrateModal();};if(this.btnClaimCrateFree){this.btnClaimCrateFree.addEventListener("click",()=>{state.addMoney(Math.max(500,Math.round(15*state.getIncomeRate())));if(typeof audio?.playCoin==="function")audio.playCoin();closeCrate();});}if(this.btnClaimCrateAd){this.btnClaimCrateAd.addEventListener("click",()=>{const r=Math.max(1000,Math.round(30*state.getIncomeRate()));platform.showRewardedVideo({onRewarded:()=>{state.addMoney(r);if(typeof audio?.playUpgrade==="function")audio.playUpgrade();closeCrate();if(typeof window.showToast==="function")window.showToast("📦 Припасы получены!");},onError:()=>{closeCrate();}});});}state.on("openStreakModal",()=>this.showStreakModal());state.on("openSupplyCrateModal",()=>this.showCrateModal());state.on("openMarketplaceModal",()=>this.showMarketplaceModal());if(this.btnCloseMarket)this.btnCloseMarket.addEventListener("click",()=>this.hideMarketplaceModal());document.querySelectorAll(".market-tab-btn").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".market-tab-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");this.activeMarketCat=parseInt(btn.dataset.cat,10);this.renderMarketplaceCards();}));const uBtn=()=>{if(this.marketModal&&!this.marketModal.classList.contains("hidden"))this.updateMarketplaceButtons();};["moneyChanged","dollarsChanged","cryptoChanged"].forEach(e=>state.on(e,uBtn));state.on("technologiesUpdated",()=>{if(this.marketModal&&!this.marketModal.classList.contains("hidden"))this.renderMarketplaceCards();});}showOfflineModal(offlineSeconds,earnedAmount){if(earnedAmount<=0)return;this.pendingOfflineReward=earnedAmount;const hours=Math.floor(offlineSeconds/3600);const mins=Math.floor((offlineSeconds%3600)/60);let timeStr="";if(hours>0){timeStr=`${hours}ч ${mins}мин`;}else{timeStr=`${Math.max(1,mins)}мин`;}this.offlineTimeLabel.textContent=timeStr;this.offlineMoneyLabel.textContent=`+${HudView.formatNumber(earnedAmount)}`;this.regularAmountTag.textContent=HudView.formatNumber(earnedAmount);this.doubleAmountTag.textContent=`Получить ${HudView.formatNumber(earnedAmount*2)}`;this.offlineModal.classList.remove("hidden");}showSpecializationModal(){state.emit("closeAllBottomSheets");if(!this.specModal)return;if(state.specialization)return;const ws=document.getElementById("well-upgrade-sheet");if(ws)ws.classList.add("hidden");this.specModal.classList.remove("hidden");audio.playBoost();audio.vibrate([40,60,40]);}handleSelectSpecialization(type){if(type!=="oil"&&type!=="gas")return;if(!this.specModal)return;state.setSpecialization(type);audio.playUpgrade();audio.vibrate([50,80,50]);this.specModal.classList.add("hidden");}showExchangeModal(){if(!this.exchangeModal)return;this.exchangeModal.classList.remove("hidden");if(state.market){this.updateExchangeModal(state.market);}if(state.brokerInsider){this.updateBrokerStatus(state.brokerInsider);}audio.playCoin();audio.vibrate(15);}hideExchangeModal(){if(!this.exchangeModal)return;this.exchangeModal.classList.add("hidden");platform.showInterstitial();}triggerBrokerTip(){if(state.brokerInsider&&state.brokerInsider.active){audio.playTap();return;}platform.showRewardedVideo({onOpen:()=>{},onRewarded:()=>{if(typeof state.activateBrokerInsider==="function"){state.activateBrokerInsider();}if(typeof window.showToast==="function")window.showToast("🔥 Инсайд брокера активирован: x2.5 к ценам!");},onError:(err)=>{},onClose:()=>{}});}updateBrokerStatus(b){if(!b)return;const a=b.active&&b.remainingSec>0,s=Math.ceil(b.remainingSec||0);if(this.brokerActiveBox)this.brokerActiveBox.classList.toggle("hidden",!a);if(this.btnBrokerInsider)this.btnBrokerInsider.classList.toggle("broker-active",a);if(this.brokerTimerDisplay&&a)this.brokerTimerDisplay.textContent=`${s}с`;if(this.btnBrokerTitle)this.btnBrokerTitle.textContent=a?`ИНСАЙД АКТИВЕН(${s}с)`:`ПОЛУЧИТЬ ИНСАЙД(x2.5 ПАМП)`;if(this.btnBrokerSub)this.btnBrokerSub.textContent=a?`Памп цен x2.5 в действии!`:`Смотреть инсайд • 90с 🎬`;}updateExchangeModal(market){if(!market)return;const baseOil=CONFIG.EXCHANGE?.BASE_OIL_PRICE||75.0;const baseGas=CONFIG.EXCHANGE?.BASE_GAS_PRICE||35.0;const oilMult=market.oilMultiplier||1.0;const gasMult=market.gasMultiplier||1.0;const currentOilPrice=(baseOil*oilMult).toFixed(2);const currentGasPrice=(baseGas*gasMult).toFixed(2);if(this.oilPriceEl)this.oilPriceEl.textContent=`$${currentOilPrice}`;if(this.gasPriceEl)this.gasPriceEl.textContent=`€${currentGasPrice}`;if(this.oilMultEl)this.oilMultEl.textContent=`x${oilMult.toFixed(2)}`;if(this.gasMultEl)this.gasMultEl.textContent=`x${gasMult.toFixed(2)}`;if(this.oilTrendEl){const diffPct=((oilMult-1.0)*100).toFixed(1);const isUp=oilMult>=1.0;this.oilTrendEl.textContent=`${isUp?"▲+":"▼ "}${diffPct}%`;this.oilTrendEl.className=`trend-badge ${isUp?"trend-up":"trend-down"}`;}if(this.gasTrendEl){const diffPct=((gasMult-1.0)*100).toFixed(1);const isUp=gasMult>=1.0;this.gasTrendEl.textContent=`${isUp?"▲+":"▼ "}${diffPct}%`;this.gasTrendEl.className=`trend-badge ${isUp?"trend-up":"trend-down"}`;}if(this.oilBarEl){const oilPct=Math.max(10,Math.min(100,(oilMult/2.5)*100));this.oilBarEl.style.width=`${oilPct}%`;}if(this.gasBarEl){const gasPct=Math.max(10,Math.min(100,(gasMult/2.0)*100));this.gasBarEl.style.width=`${gasPct}%`;}const activeEvent=market.activeEvent;if(activeEvent){if(this.eventBadgeEl)this.eventBadgeEl.textContent=`[${activeEvent.badge||"СОБЫТИЕ"}]`;if(this.eventHeadlineEl)this.eventHeadlineEl.textContent=activeEvent.headline||"";if(this.eventDescEl)this.eventDescEl.textContent=activeEvent.description||"";if(this.eventTimerEl){const remaining=Math.ceil(market.eventRemainingSec||0);this.eventTimerEl.textContent=`Осталось:${remaining}с`;}if(this.eventEffectEl){const isOil=activeEvent.commodity==="oil";const icon=isOil?"🛢️ Нефть":"🔥 Газ";const pct=(activeEvent.priceChange*100).toFixed(0);const sign=activeEvent.priceChange>=0?"+":"";this.eventEffectEl.textContent=`${icon}${sign}${pct}%котировок`;this.eventEffectEl.className=`event-effect-pill ${activeEvent.priceChange>=0?"effect-positive":"effect-negative"}`;}}}showAccidentModal(data){if(!this.accidentModal)return;const def=(CONFIG.ACCIDENTS?.TYPES&&data?.type)?CONFIG.ACCIDENTS.TYPES[data.type]:null;if(this.accidentTitleEl)this.accidentTitleEl.textContent=def?.title||(data?.type==="gusher"?"ГРИФОН":"ПОРЫВ");if(this.accidentDescEl)this.accidentDescEl.textContent=def?.description||def?.name||"Аварийная ситуация на кусте!";if(this.accidentBadgeEl)this.accidentBadgeEl.textContent=def?.badge||"🚨";if(this.accidentTimerEl){this.accidentTimerEl.textContent="6.0с";}if(this.accidentTimerBar){this.accidentTimerBar.style.width="100%";}if(this.qteProgressBar){this.qteProgressBar.style.width="0%";}if(this.qteProgressText){this.qteProgressText.textContent="0%";}if(this.mchsPayoutTag){const payout=Math.round(state.getIncomeRate()*300);this.mchsPayoutTag.textContent=`+${payout.toLocaleString("ru-RU")}₽`;}this.accidentModal.classList.remove("hidden");}hideAccidentModal(){if(this.accidentModal){this.accidentModal.classList.add("hidden");}}updateAccidentTimer(data){if(!data)return;const remaining=Math.max(0,data.remainingSec||0);if(this.accidentTimerEl){this.accidentTimerEl.textContent=`${remaining.toFixed(1)}с`;}if(this.accidentTimerBar){const pct=Math.max(0,(remaining/(CONFIG.ACCIDENTS?.QTE_DURATION_SEC||6.0))*100);this.accidentTimerBar.style.width=`${pct}%`;}}updateQteProgress(data){if(!data)return;const pct=Math.round((data.qteProgress||0)*100);if(this.qteProgressBar){this.qteProgressBar.style.width=`${pct}%`;}if(this.qteProgressText){this.qteProgressText.textContent=`${pct}%`;}}triggerMchsRescue(){platform.showRewardedVideo({onRewarded:()=>{state.resolveAccident("mchs");this.hideAccidentModal();if(typeof window.showToast==="function")window.showToast("🚒 Служба МЧС ликвидировала аварию!");},onError:()=>{}});}showIpoModal(){if(!this.ipoModal)return;const threshold=CONFIG.IPO?.CAPITAL_THRESHOLD||1000000;const bonusPerShare=CONFIG.IPO?.BONUS_PER_SHARE||0.02;const newShares=Math.floor((state.money||0)/threshold);const currentShares=state.ipo?.goldenShares||0;const totalShares=currentShares+newShares;const bonusPct=Math.round(newShares*bonusPerShare*100);const totalBonusPct=Math.round(totalShares*bonusPerShare*100);if(this.inputCompanyName&&!this.inputCompanyName.value&&state.ipo?.companyName){this.inputCompanyName.value=state.ipo.companyName;}if(this.certSharesAwarded){const shareWord=newShares===1?"Золотая акция":(newShares<5?"Золотые акции":"Золотых акций");this.certSharesAwarded.textContent=`+${newShares} ${shareWord}`;}if(this.certDividendBonus){this.certDividendBonus.textContent=`+${bonusPct}% к дебиту навсегда`;}if(this.certTotalShares){this.certTotalShares.textContent=`${totalShares} шт. (+${totalBonusPct}% постоянный множитель)`;}if(this.btnIpoActionSub){this.btnIpoActionSub.textContent=`+${newShares} акц. • постоянный бонус +${bonusPct}% к дебиту`;}this.handleCompanyNameInput();this.ipoModal.classList.remove("hidden");if(this.ipoCertificate){this.ipoCertificate.classList.remove("hidden");}audio.playCoin();audio.vibrate([30,50,30]);}hideIpoModal(){if(!this.ipoModal)return;this.ipoModal.classList.add("hidden");this.clearInputError();}handleCompanyNameInput(){if(!this.inputCompanyName)return;const raw=this.inputCompanyName.value;const sanitized=raw.replace(/[<>&"']/g,"");if(sanitized!==raw){this.inputCompanyName.value=sanitized;}const trimmed=sanitized.trim();if(this.ipoCharCount){this.ipoCharCount.textContent=`${sanitized.length} / 24`;}if(this.certCompanyPreview){this.certCompanyPreview.textContent=trimmed.length>0?`ПАО «${trimmed}»`:"ПАО «НАЗВАНИЕ КОРПОРАЦИИ»";}const threshold=CONFIG.IPO?.CAPITAL_THRESHOLD||1000000;const hasCapital=(state.money||0)>=threshold;const error=(raw!==sanitized)?"Недопустимые символы":(trimmed.length>0&&trimmed.length<2)?"Минимум 2 символа":(trimmed.length>24)?"Максимум 24 символа":null;if(error||trimmed.length===0){if(error)this.showInputError(error);else this.clearInputError();if(this.btnConfirmIpo)this.btnConfirmIpo.disabled=true;}else{this.clearInputError();if(this.btnConfirmIpo){this.btnConfirmIpo.disabled=!hasCapital;}}}showInputError(msg){if(this.ipoNameError){this.ipoNameError.textContent=msg;this.ipoNameError.classList.remove("hidden");}if(this.inputCompanyName){this.inputCompanyName.classList.add("is-invalid");this.inputCompanyName.classList.remove("is-valid");}}clearInputError(){if(this.ipoNameError){this.ipoNameError.textContent="";this.ipoNameError.classList.add("hidden");}if(this.inputCompanyName){this.inputCompanyName.classList.remove("is-invalid");this.inputCompanyName.classList.add("is-valid");}}handleConfirmIpo(){if(!this.inputCompanyName)return;const raw=this.inputCompanyName.value;const sanitized=raw.replace(/[<>&"']/g,"").trim();const threshold=CONFIG.IPO?.CAPITAL_THRESHOLD||1000000;if((state.money||0)<threshold){this.showInputError(`Нужно ${HudView.formatNumber(threshold)}`);return;}if(sanitized.length<2||sanitized.length>24){this.showInputError("От 2 до 24 символов");return;}if(typeof state.performIpo==="function"){const success=state.performIpo(sanitized);if(success){this.hideIpoModal();}else{this.showInputError("Ошибка валидации IPO");}}}showStreakModal(){if(!this.streakModal)return;const curDay=state.dailyStreak?(state.dailyStreak.day||1):1;if(this.streakDaysGrid){const c=this.streakDaysGrid.children;for(let i=0;i<c.length;i++){const d=i+1;c[i].classList.toggle("claimed",d<curDay);c[i].classList.toggle("current",d===curDay);}}this.streakModal.classList.remove("hidden");audio.playCoin();}hideStreakModal(){if(this.streakModal)this.streakModal.classList.add("hidden");}checkDailyStreak(){if(state.ftueCompleted===false)return;const today=new Date().toDateString();if(state.dailyStreak&&state.dailyStreak.lastClaimDate!==today){this.showStreakModal();}}showCrateModal(){if(this.crateModal)this.crateModal.classList.remove("hidden");}hideCrateModal(){if(this.crateModal)this.crateModal.classList.add("hidden");}showMarketplaceModal(){if(!this.marketModal)return;this.renderMarketplaceCards();this.marketModal.classList.remove("hidden");if(typeof audio?.playCoin==="function")audio.playCoin();}hideMarketplaceModal(){if(this.marketModal)this.marketModal.classList.add("hidden");}renderMarketplaceCards(){if(!this.marketCardsList||!CONFIG.TECHNOLOGIES)return;while(this.marketCardsList.firstChild){this.marketCardsList.removeChild(this.marketCardsList.firstChild);}const techs=Object.values(CONFIG.TECHNOLOGIES).filter(t=>t.cat===this.activeMarketCat);techs.forEach(t=>{const lvl=state.getTechLevel(t.id);const isMax=lvl>=t.maxLevel;const cost=state.getTechCost(t.id);const canBuy=state.canBuyTech(t.id);const currSym=t.currency==="dollars"?"$":(t.currency==="crypto"?"⚡":"₽");const card=document.createElement("div");card.className="tech-card";card.dataset.techId=t.id;const info=document.createElement("div");info.className="tech-card-info";const title=document.createElement("div");title.className="tech-card-title";title.textContent=`${t.icon||""} ${t.name} (ур. ${lvl}/${t.maxLevel})`;const desc=document.createElement("div");desc.className="tech-card-desc";desc.textContent=t.desc||"";const track=document.createElement("div");track.className="tech-progress-track";const fill=document.createElement("div");fill.className="tech-progress-fill"+(isMax?" maxed":"");const pct=Math.min(100,Math.round((lvl/t.maxLevel)*100));fill.style.width=`${pct}%`;track.appendChild(fill);info.appendChild(title);info.appendChild(desc);info.appendChild(track);const btn=document.createElement("button");btn.className="btn-buy-tech";btn.textContent=isMax?"МАКС":`${cost.toLocaleString("ru-RU")} ${currSym}`;btn.disabled=isMax||!canBuy;btn.addEventListener("click",()=>{if(state.buyTechnology(t.id)){this.renderMarketplaceCards();if(typeof audio?.playUpgrade==="function")audio.playUpgrade();}});card.appendChild(info);card.appendChild(btn);this.marketCardsList.appendChild(card);});}updateMarketplaceButtons(){if(!this.marketCardsList)return;const cards=this.marketCardsList.children;for(let i=0;i<cards.length;i++){const c=cards[i];const id=c.dataset.techId;if(!id)continue;const btn=c.querySelector(".btn-buy-tech");if(!btn)continue;const def=state.getTechDef(id);if(!def)continue;const lvl=state.getTechLevel(id);const isMax=lvl>=def.maxLevel;const canBuy=state.canBuyTech(id);btn.disabled=isMax||!canBuy;}}showCompanyStockModal(){if(!this.companyStockModal)return;const cName=(state.ipo?.companyName||"СеверНефтьГаз").trim();const tickerPrefix=cName.slice(0,4).replace(/[^a-zA-Zа-яА-Я0-9]/g,"").toUpperCase()||"SEVR";if(this.stockTickerEl)this.stockTickerEl.textContent=`MOEX:${tickerPrefix}`;const tier=state.corporatePrestigeTier||1;const basePrice=100+(tier-1)*35+((state.market?.oilMultiplier||1.0)-1.0)*25;if(this.stockPriceEl)this.stockPriceEl.textContent=`${basePrice.toFixed(2)} ₽`;const mcap=Math.max(1000000,Math.round((state.money+(state.totalEarned||0))*2.5));if(this.stockMarketcapEl)this.stockMarketcapEl.textContent=HudView.formatNumber(mcap);const shares=state.ipo?.goldenShares||1;const bonusPct=Math.round(shares*2);if(this.stockGoldenSharesEl)this.stockGoldenSharesEl.textContent=`${shares} шт (+${bonusPct}% дебит)`;if(this.stockPrestigeTierEl)this.stockPrestigeTierEl.textContent=`Корпоративный Тир: ${tier} ⭐`;if(this.stockPrestigeDescEl){this.stockPrestigeDescEl.textContent=`Новый раунд SPO (Допэмиссия) привлечет крупный венчурный капитал, добавит еще +1 золотую акцию (+2% ко всем скважинам навсегда) и повысит тир корпорации до ${tier+1}.`;}const threshold=CONFIG.IPO?.CAPITAL_THRESHOLD||1000000;const canSpo=(state.money||0)>=threshold;if(this.btnStockSpo){this.btnStockSpo.disabled=!canSpo;const btnTitle=this.btnStockSpo.querySelector("#btn-spo-title");if(btnTitle){btnTitle.textContent=canSpo?`ПРОВЕСТИ SPO (ТИР ${tier+1})`:`НУЖНО ${HudView.formatNumber(threshold)}`;}}this.drawStockChart();this.companyStockModal.classList.remove("hidden");if(typeof audio?.playCoin==="function")audio.playCoin();}drawStockChart(){if(!this.stockChartCanvas)return;const ctx=this.stockChartCanvas.getContext("2d");if(!ctx)return;const w=this.stockChartCanvas.width;const h=this.stockChartCanvas.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle="rgba(51, 65, 85, 0.4)";ctx.lineWidth=1;for(let y=20;y<h;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}const pts=[{x:0,y:h*0.75},{x:w*0.15,y:h*0.70},{x:w*0.3,y:h*0.55},{x:w*0.45,y:h*0.62},{x:w*0.6,y:h*0.42},{x:w*0.75,y:h*0.35},{x:w*0.9,y:h*0.28},{x:w,y:h*0.20}];const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,"rgba(34, 197, 94, 0.45)");grad.addColorStop(1,"rgba(34, 197, 94, 0)");ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(pts[0].x,h);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(w,h);ctx.closePath();ctx.fill();ctx.strokeStyle="#22c55e";ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();const last=pts[pts.length-1];ctx.fillStyle="#4ade80";ctx.beginPath();ctx.arc(last.x-4,last.y,4.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#ffffff";ctx.lineWidth=1.5;ctx.stroke();}handleStockSpo(){if(typeof state.performSpo==="function"){const success=state.performSpo();if(success){this.hideCompanyStockModal();if(typeof audio?.playUpgrade==="function")audio.playUpgrade();}}}hideCompanyStockModal(){if(this.companyStockModal)this.companyStockModal.classList.add("hidden");}showSpecializationInfoModal(){if(!this.specInfoModal)return;const isGas=state.specialization==="gas";if(this.specInfoTitleEl)this.specInfoTitleEl.textContent=isGas?"ГАЗОВАЯ ОТРАСЛЬ (СПГ)":"НЕФТЯНАЯ ОТРАСЛЬ (URALS)";if(this.specInfoBadgeEl)this.specInfoBadgeEl.textContent=isGas?"🔥 СПЕЦИАЛИЗАЦИЯ: ГАЗ":"🛢️ СПЕЦИАЛИЗАЦИЯ: НЕФТЬ";if(this.specInfoContentEl){if(isGas){this.specInfoContentEl.innerHTML=`<div class="spec-info-row"><div class="spec-info-icon">📈</div><div class="spec-info-text"><span class="spec-info-title">Биржевой бонус +45%</span><span class="spec-info-desc">Дебит природного газа продается по повышенной ставке на хабе TTF. Высокая рентабельность при скачках рынка.</span></div></div><div class="spec-info-row"><div class="spec-info-icon">🎄</div><div class="spec-info-text"><span class="spec-info-title">Фонтанная арматура (АФК)</span><span class="spec-info-desc">Газ бьет самоизливом под пластовым давлением 160–350 атм. Механические станки-качалки не требуются!</span></div></div><div class="spec-info-row"><div class="spec-info-icon">🏭</div><div class="spec-info-text"><span class="spec-info-title">УКПГ и Криогенный Экспорт</span><span class="spec-info-desc">Осушка газа на ТЭГ-колоннах и налив в белые СПГ-газовозы (ADR класс 2.1 Methane).</span></div></div><div class="spec-info-row"><div class="spec-info-icon">❄️</div><div class="spec-info-text"><span class="spec-info-title">Эффект Джоуля-Томсона</span><span class="spec-info-desc">При авариях газ мгновенно охлаждается до -60°C, образуя крио-иней и свистящий пар без нефтяной жижи.</span></div></div>`;}else{this.specInfoContentEl.innerHTML=`<div class="spec-info-row"><div class="spec-info-icon">🛢️</div><div class="spec-info-text"><span class="spec-info-title">Мультипликатор x2.5 к нефти</span><span class="spec-info-desc">Максимальный доход от классической тяжелой нефти сортов Urals и ESPO.</span></div></div><div class="spec-info-row"><div class="spec-info-icon">🏗️</div><div class="spec-info-text"><span class="spec-info-title">Станки-качалки (ШГН/ЭЦН)</span><span class="spec-info-desc">Глубинный механический подъем сырой нефти с мощной синергией рабочих.</span></div></div><div class="spec-info-row"><div class="spec-info-icon">🏢</div><div class="spec-info-text"><span class="spec-info-title">Парк резервуаров РВС-1/2</span><span class="spec-info-desc">Накопление сырой нефти в буферных резервуарах ЦПС и быстрый налив в автоцистерны.</span></div></div>`;}}this.specInfoModal.classList.remove("hidden");if(typeof audio?.playCoin==="function")audio.playCoin();}hideSpecInfoModal(){if(this.specInfoModal)this.specInfoModal.classList.add("hidden");}

showWellTuningModal(wellId) {
  this.currentTuningWellId = wellId || state.activeWellId || "well_1";
  const def = CONFIG.WELLS.find(w => w.id === this.currentTuningWellId);
  if (this.tuningWellBadge) {
    this.tuningWellBadge.textContent = def ? def.name.toUpperCase() : "КУСТ";
  }
  const m = state.wellMastery?.[this.currentTuningWellId] || { valve: false, purge: false, sensor: false };
  this.valveTurnsCompleted = m.valve ? 3 : 0;
  this.purgeProgress = m.purge ? 1.0 : 0;
  this.purgeTimerSec = 10.0;

  this.updateTuningMasteryDisplay();
  this.switchTuningTab(this.activeTuningTab || "valve");
  if (this.tuningModal) this.tuningModal.classList.remove("hidden");

  if (!m.valve) {
    this.startManometerAnimation();
  } else {
    this.tuningPressure = 180;
    this.drawManometer();
  }
  if (typeof audio?.playTap === "function") audio.playTap();
}

hideWellTuningModal() {
  if (this.tuningModal) this.tuningModal.classList.add("hidden");
  if (this.tuningRafId) {
    cancelAnimationFrame(this.tuningRafId);
    this.tuningRafId = null;
  }
  if (this.purgeIntervalId) {
    clearInterval(this.purgeIntervalId);
    this.purgeIntervalId = null;
  }
}

switchTuningTab(tabName) {
  this.activeTuningTab = tabName || "valve";
  ["valve", "purge", "sensor"].forEach(t => {
    const p = document.getElementById(`game-panel-${t}`);
    if (p) p.classList.toggle("hidden", t !== this.activeTuningTab);
  });

  const m = state.wellMastery?.[this.currentTuningWellId] || { valve: false, purge: false, sensor: false };
  if (this.activeTuningTab === "valve") {
    if (!m.valve) {
      this.startManometerAnimation();
    } else {
      if (this.tuningRafId) { cancelAnimationFrame(this.tuningRafId); this.tuningRafId = null; }
      this.tuningPressure = 180;
      this.drawManometer();
    }
  } else if (this.activeTuningTab === "purge") {
    if (!m.purge) {
      this.startPurgeGame();
    } else {
      this.purgeProgress = 1.0;
      this.updatePurgeDisplay();
    }
  } else if (this.activeTuningTab === "sensor") {
    this.handleSensorSliderChange();
  }
}

startManometerAnimation() {
  if (this.tuningRafId) cancelAnimationFrame(this.tuningRafId);
  const loop = () => {
    if (!this.tuningModal || this.tuningModal.classList.contains("hidden")) return;
    const t = Date.now() / 1000;
    this.tuningPressure = 100 + Math.sin(t * 3.8) * 85;
    this.drawManometer();
    this.tuningRafId = requestAnimationFrame(loop);
  };
  this.tuningRafId = requestAnimationFrame(loop);
}

drawManometer() {
  if (!this.manometerCanvas) return;
  const ctx = this.manometerCanvas.getContext("2d");
  if (!ctx) return;
  const w = this.manometerCanvas.width;
  const h = this.manometerCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.82;
  const radius = 62;

  // Dial arc
  ctx.lineWidth = 14;
  ctx.lineCap = "round";

  // Red zone left (0..160)
  ctx.strokeStyle = "#475569";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI * 0.85, Math.PI * 1.55);
  ctx.stroke();

  // Green target zone (160..200)
  ctx.strokeStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI * 1.55, Math.PI * 1.95);
  ctx.stroke();

  // Overpressure red zone (200..250)
  ctx.strokeStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI * 1.95, Math.PI * 2.15);
  ctx.stroke();

  // Needle angle
  const pNorm = Math.max(0, Math.min(1.0, this.tuningPressure / 220));
  const angle = Math.PI * 0.85 + pNorm * (Math.PI * 1.3);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radius - 4, 0);
  ctx.stroke();
  ctx.restore();

  // Center pin
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Pressure readout text
  ctx.fillStyle = (this.tuningPressure >= 160 && this.tuningPressure <= 200) ? "#4ade80" : "#cbd5e1";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(this.tuningPressure)} атм`, cx, cy - 22);
}

handleValveTurnClick() {
  if (this.tuningPressure >= 160 && this.tuningPressure <= 200) {
    this.valveTurnsCompleted++;
    if (typeof audio?.playUpgrade === "function") audio.playUpgrade();
    if (this.valveTurnsDots) {
      this.valveTurnsDots.forEach((dot, idx) => {
        if (dot) dot.classList.toggle("completed", idx < this.valveTurnsCompleted);
      });
    }
    if (this.valveTurnsCompleted >= 3) {
      state.completeWellTuning(this.currentTuningWellId, "valve");
      if (this.tuningRafId) {
        cancelAnimationFrame(this.tuningRafId);
        this.tuningRafId = null;
      }
      this.tuningPressure = 180;
      this.drawManometer();
      this.updateTuningMasteryDisplay();
      if (typeof audio?.playPayout === "function") audio.playPayout();
    }
  } else {
    if (typeof audio?.playTap === "function") audio.playTap();
  }
}

startPurgeGame() {
  if (this.purgeIntervalId) clearInterval(this.purgeIntervalId);
  this.purgeProgress = 0;
  this.purgeTimerSec = 10.0;
  this.updatePurgeDisplay();

  this.purgeIntervalId = setInterval(() => {
    this.purgeTimerSec = Math.max(0, this.purgeTimerSec - 0.1);
    if (this.purgeTimerSec <= 0) {
      clearInterval(this.purgeIntervalId);
      this.purgeIntervalId = null;
    }
    this.updatePurgeDisplay();
  }, 100);
}

handlePurgeTapClick() {
  if (this.purgeTimerSec <= 0) {
    this.startPurgeGame();
  }
  this.purgeProgress = Math.min(1.0, this.purgeProgress + 0.14);
  this.updatePurgeDisplay();
  if (typeof audio?.playTap === "function") audio.playTap();

  if (this.purgeProgress >= 1.0) {
    if (this.purgeIntervalId) clearInterval(this.purgeIntervalId);
    state.completeWellTuning(this.currentTuningWellId, "purge");
    this.updateTuningMasteryDisplay();
    if (typeof audio?.playPayout === "function") audio.playPayout();
  }
}

updatePurgeDisplay() {
  const pct = Math.round(this.purgeProgress * 100);
  if (this.purgeBarFill) this.purgeBarFill.style.width = `${pct}%`;
  if (this.purgePctLabel) this.purgePctLabel.textContent = `${pct}%`;
  if (this.purgeTimerLabel) this.purgeTimerLabel.textContent = `${this.purgeTimerSec.toFixed(1)}с`;
}

handleSensorSliderChange() {
  if (!this.sensorSlider) return;
  const val = parseInt(this.sensorSlider.value, 10);
  if (this.sensorFreqLabel) this.sensorFreqLabel.textContent = `${val} МГц`;
  const inTune = val >= 429 && val <= 437;
  if (this.sensorStatusBadge) {
    this.sensorStatusBadge.textContent = inTune ? "В РЕЗОНАНСЕ" : "РАССИНХРОН";
    this.sensorStatusBadge.className = inTune ? "badge-status badge-status-ok" : "badge-status badge-status-warn";
  }
  if (this.btnSensorSync) {
    this.btnSensorSync.disabled = !inTune;
  }
}

handleSensorSyncClick() {
  state.completeWellTuning(this.currentTuningWellId, "sensor");
  this.updateTuningMasteryDisplay();
  if (typeof audio?.playPayout === "function") audio.playPayout();
}

updateTuningMasteryDisplay() {
  const m = state.wellMastery?.[this.currentTuningWellId] || { valve: false, purge: false, sensor: false };
  let count = 0;
  if (m.valve) count++;
  if (m.purge) count++;
  if (m.sensor) count++;

  if (this.tuningMasteryPct) {
    this.tuningMasteryPct.textContent = `+${count * 25}% дебит${count === 3 ? " (МАСТЕР)" : ""}`;
  }
  if (this.badgeMasteryValve) this.badgeMasteryValve.classList.toggle("completed", Boolean(m.valve));
  if (this.badgeMasteryPurge) this.badgeMasteryPurge.classList.toggle("completed", Boolean(m.purge));
  if (this.badgeMasterySensor) this.badgeMasterySensor.classList.toggle("completed", Boolean(m.sensor));

  // Lock and style completed buttons
  if (this.btnValveTurn) {
    if (m.valve) {
      this.btnValveTurn.disabled = true;
      this.btnValveTurn.style.opacity = "0.75";
      this.btnValveTurn.style.background = "#16a34a";
      this.btnValveTurn.innerHTML = '<span class="ipo-btn-icon">✓</span><span class="ipo-btn-title">ЗАДВИЖКА ОТРЕГУЛИРОВАНА</span>';
      if (this.valveTurnsDots) this.valveTurnsDots.forEach(d => d && d.classList.add("completed"));
    } else {
      this.btnValveTurn.disabled = false;
      this.btnValveTurn.style.opacity = "1";
      this.btnValveTurn.style.background = "";
      this.btnValveTurn.innerHTML = '<span class="ipo-btn-icon">⚙️</span><span class="ipo-btn-title">ПОВЕРНУТЬ МАХОВИК</span>';
    }
  }

  if (this.btnPurgeTap) {
    if (m.purge) {
      this.btnPurgeTap.disabled = true;
      this.btnPurgeTap.style.opacity = "0.75";
      this.btnPurgeTap.style.background = "#16a34a";
      this.btnPurgeTap.innerHTML = '<span class="ipo-btn-icon">✓</span><span class="ipo-btn-title">ШЛЕЙФ ПРОДУТ (100%)</span>';
      if (this.purgeBarFill) this.purgeBarFill.style.width = "100%";
      if (this.purgePctLabel) this.purgePctLabel.textContent = "100%";
      if (this.purgeTimerLabel) this.purgeTimerLabel.textContent = "ГОТОВО";
    } else {
      this.btnPurgeTap.disabled = false;
      this.btnPurgeTap.style.opacity = "1";
      this.btnPurgeTap.style.background = "";
      this.btnPurgeTap.innerHTML = '<span class="ipo-btn-icon">💨</span><span class="ipo-btn-title">ПРОДУТЬ ДРЕНАЖ</span>';
    }
  }

  if (this.btnSensorSync) {
    if (m.sensor) {
      this.btnSensorSync.disabled = true;
      this.btnSensorSync.style.opacity = "0.75";
      this.btnSensorSync.style.background = "#16a34a";
      this.btnSensorSync.innerHTML = '<span class="ipo-btn-icon">✓</span><span class="ipo-btn-title">СИНХРОНИЗИРОВАНО (433 МГц)</span>';
      if (this.sensorSlider) {
        this.sensorSlider.value = "433";
        this.sensorSlider.disabled = true;
      }
      if (this.sensorFreqLabel) this.sensorFreqLabel.textContent = "433 МГц";
      if (this.sensorStatusBadge) {
        this.sensorStatusBadge.textContent = "В РЕЗОНАНСЕ ✓";
        this.sensorStatusBadge.className = "badge-status badge-status-ok";
      }
    } else {
      this.btnSensorSync.style.opacity = "1";
      this.btnSensorSync.style.background = "";
      this.btnSensorSync.innerHTML = '<span class="ipo-btn-icon">📡</span><span class="ipo-btn-title">СИНХРОНИЗИРОВАНО ДАТЧИК</span>';
      if (this.sensorSlider) this.sensorSlider.disabled = false;
    }
  }
}

showCryptoModal() {
  if (!this.cryptoModal) return;
  this.updateCryptoModal();
  this.cryptoModal.classList.remove("hidden");
  if (typeof audio?.playTap === "function") audio.playTap();
}

updateCryptoModal() {
  if (!this.cryptoModal) return;
  const watched = state.cryptoAdsWatched || 0;
  if (this.cryptoAdCounter) {
    this.cryptoAdCounter.textContent = `Прогресс: ${watched} / 10 🎬`;
  }
  if (this.cryptoAdFill) {
    this.cryptoAdFill.style.width = `${Math.min(100, (watched / 10) * 100)}%`;
  }
  if (this.btnUnlockCryptoMoney) {
    this.btnUnlockCryptoMoney.disabled = (state.money || 0) < 5000000;
  }
}

closeCryptoModal() {
  if (!this.cryptoModal) return;
  this.cryptoModal.classList.add("hidden");
}
}
