const fs = require('fs');
const path = require('path');

// 1. Update src/ui/modals.js
const modalsPath = path.resolve(__dirname, '../src/ui/modals.js');
let modals = fs.readFileSync(modalsPath, 'utf8');

// Fix btnUnlockCryptoAd
modals = modals.replace(
  /if\s*\(this\.btnUnlockCryptoAd\)\s*\{[\s\S]*?if\s*\(state\.cryptoMiningActive\)\s*this\.closeCryptoModal\(\);\s*\}\s*\}\);\s*\}\);?\s*\}/,
  `if (this.btnUnlockCryptoAd) {
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
}`
);

// Fix btnOfflineDouble (give regular offline reward, NOT doubled, on error)
modals = modals.replace(
  /this\.btnOfflineDouble\.addEventListener\("click",\(\)=>\{const doubledAmount=this\.pendingOfflineReward\*2;platform\.showRewardedVideo\(\{onRewarded:\(\)=>\{state\.addMoney\(doubledAmount\);audio\.playUpgrade\(\);this\.pendingOfflineReward=0;this\.offlineModal\.classList\.add\("hidden"\);(?:if\(typeof window\.showToast==="function"\)window\.showToast\("[^"]*"\);)?\},onError:\(\)=>\{[^}]*\}\}\);\}\);/,
  `this.btnOfflineDouble.addEventListener("click",()=>{const doubledAmount=this.pendingOfflineReward*2;platform.showRewardedVideo({onRewarded:()=>{state.addMoney(doubledAmount);audio.playUpgrade();this.pendingOfflineReward=0;this.offlineModal.classList.add("hidden");if(typeof window.showToast==="function")window.showToast("💰 Оффлайн-доход удвоен!");},onError:()=>{state.addMoney(this.pendingOfflineReward);this.pendingOfflineReward=0;this.offlineModal.classList.add("hidden");}});});`
);

// Fix btnClaimFountain
modals = modals.replace(
  /this\.btnClaimFountain\.addEventListener\("click",\(\)=>\{platform\.showRewardedVideo\(\{onRewarded:\(\)=>\{state\.activateBoost\(CONFIG\.BOOSTS\.FOUNTAIN\.DURATION_SEC,CONFIG\.BOOSTS\.FOUNTAIN\.MULTIPLIER\);this\.boostsModal\.classList\.add\("hidden"\);(?:if\(typeof window\.showToast==="function"\)window\.showToast\("[^"]*"\);)?\},onError:\(\)=>\{[^}]*\}\}\);\}\);/,
  `this.btnClaimFountain.addEventListener("click",()=>{platform.showRewardedVideo({onRewarded:()=>{state.activateBoost(CONFIG.BOOSTS.FOUNTAIN.DURATION_SEC,CONFIG.BOOSTS.FOUNTAIN.MULTIPLIER);this.boostsModal.classList.add("hidden");if(typeof window.showToast==="function")window.showToast("⚡ Буст x3 активирован!");},onError:()=>{}});});`
);

// Fix btnClaimGrant
modals = modals.replace(
  /this\.btnClaimGrant\.addEventListener\("click",\(\)=>\{platform\.showRewardedVideo\(\{onRewarded:\(\)=>\{const currentRate=state\.getIncomeRate\(\);const grantMoney=Math\.max\(CONFIG\.BOOSTS\.GRANT\.MIN_FALLBACK_REWARD,Math\.round\(currentRate\*60\*CONFIG\.BOOSTS\.GRANT\.REWARD_MINUTES\)\);state\.addMoney\(grantMoney\);audio\.playUpgrade\(\);this\.boostsModal\.classList\.add\("hidden"\);(?:if\(typeof window\.showToast==="function"\)window\.showToast\("[^"]*"\);)?\},onError:\(\)=>\{[^}]*\}\}\);\}\);/,
  `this.btnClaimGrant.addEventListener("click",()=>{platform.showRewardedVideo({onRewarded:()=>{const currentRate=state.getIncomeRate();const grantMoney=Math.max(CONFIG.BOOSTS.GRANT.MIN_FALLBACK_REWARD,Math.round(currentRate*60*CONFIG.BOOSTS.GRANT.REWARD_MINUTES));state.addMoney(grantMoney);audio.playUpgrade();this.boostsModal.classList.add("hidden");if(typeof window.showToast==="function")window.showToast("🏛️ Госгрант получен!");},onError:()=>{}});});`
);

// Fix btnDoubleStreak
modals = modals.replace(
  /this\.btnDoubleStreak\.addEventListener\("click",\(\)=>\{platform\.showRewardedVideo\(\{onRewarded:\(\)=>\{state\.claimDailyStreak\(true\);this\.hideStreakModal\(\);audio\.playUpgrade\(\);(?:if\(typeof window\.showToast==="function"\)window\.showToast\("[^"]*"\);)?\},onError:\(\)=>\{[^}]*\}\}\);\}\);/,
  `this.btnDoubleStreak.addEventListener("click",()=>{platform.showRewardedVideo({onRewarded:()=>{state.claimDailyStreak(true);this.hideStreakModal();audio.playUpgrade();if(typeof window.showToast==="function")window.showToast("🎁 Двойной ежедневный бонус получен!");},onError:()=>{}});});`
);

// Fix btnClaimCrateAd
modals = modals.replace(
  /this\.btnClaimCrateAd\.addEventListener\("click",\(\)=>\{const r=Math\.max\(1000,Math\.round\(30\*state\.getIncomeRate\(\)\)\);platform\.showRewardedVideo\(\{onRewarded:\(\)=>\{state\.addMoney\(r\);if\(typeof audio\?\.playUpgrade==="function"\)audio\.playUpgrade\(\);closeCrate\(\);(?:if\(typeof window\.showToast==="function"\)window\.showToast\("[^"]*"\);)?\},onError:\(\)=>\{[^}]*\}\}\);\}\);/,
  `this.btnClaimCrateAd.addEventListener("click",()=>{const r=Math.max(1000,Math.round(30*state.getIncomeRate()));platform.showRewardedVideo({onRewarded:()=>{state.addMoney(r);if(typeof audio?.playUpgrade==="function")audio.playUpgrade();closeCrate();if(typeof window.showToast==="function")window.showToast("📦 Припасы получены!");},onError:()=>{closeCrate();}});});`
);

// Fix triggerBrokerTip in modals.js
modals = modals.replace(
  /triggerBrokerTip\(\)\{if\(state\.brokerInsider&&state\.brokerInsider\.active\)\{audio\.playTap\(\);return;\}platform\.showRewardedVideo\(\{onOpen:\(\)=>\{\},onRewarded:\(\)=>\{if\(typeof state\.activateBrokerInsider==="function"\)\{state\.activateBrokerInsider\(\);\}[\s\S]*?\},onError:\(err\)=>\{[\s\S]*?\},onClose:\(\)=>\{\}\}\);?\}/,
  `triggerBrokerTip(){if(state.brokerInsider&&state.brokerInsider.active){audio.playTap();return;}platform.showRewardedVideo({onOpen:()=>{},onRewarded:()=>{if(typeof state.activateBrokerInsider==="function"){state.activateBrokerInsider();}if(typeof window.showToast==="function")window.showToast("🔥 Инсайд брокера активирован: x2.5 к ценам!");},onError:(err)=>{},onClose:()=>{}});}`
);

// Fix triggerMchsRescue in modals.js
modals = modals.replace(
  /triggerMchsRescue\(\)\{platform\.showRewardedVideo\(\{onRewarded:\(\)=>\{state\.resolveAccident\("mchs"\);this\.hideAccidentModal\(\);[\s\S]*?\},onError:\(\)=>\{[\s\S]*?\}\}\);?\}/,
  `triggerMchsRescue(){platform.showRewardedVideo({onRewarded:()=>{state.resolveAccident("mchs");this.hideAccidentModal();if(typeof window.showToast==="function")window.showToast("🚒 Служба МЧС ликвидировала аварию!");},onError:()=>{}});}`
);

fs.writeFileSync(modalsPath, modals, 'utf8');
console.log('src/ui/modals.js successfully updated.');

// 2. Update src/ui/hud.js
const hudPath = path.resolve(__dirname, '../src/ui/hud.js');
let hud = fs.readFileSync(hudPath, 'utf8');

hud = hud.replace(
  /this\.btnWatchDebitAd\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?onError:\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\}\);\s*\}\);/,
  `this.btnWatchDebitAd.addEventListener("click", () => {
        this.hideDebitPill();
        platform.showRewardedVideo({
          onRewarded: () => {
            state.activateBoost(180, 2.0);
            if (typeof audio?.playBoost === "function") audio.playBoost();
            if (typeof window.showToast === "function") window.showToast("⚡ Дебит x2 удвоен на 3 мин!");
          },
          onError: () => {}
        });
      });`
);

fs.writeFileSync(hudPath, hud, 'utf8');
console.log('src/ui/hud.js successfully updated.');

// 3. Update src/ui/ticker.js
const tickerPath = path.resolve(__dirname, '../src/ui/ticker.js');
let ticker = fs.readFileSync(tickerPath, 'utf8');

ticker = ticker.replace(
  /handleBrokerAction\(\)\{if\(state\.brokerInsider\?\.active\)\{this\.openExchangeModal\(\);return;\}audio\.playTap\(\);platform\.showRewardedVideo\(\{onRewarded:\(\)=>\{if\(typeof state\.activateBrokerInsider==="function"\)\{state\.activateBrokerInsider\(\);\}if\(typeof window\.showToast==="function"\)\{window\.showToast\("🔥 Инсайд брокера активирован: x2\.5 к ценам!"\);\}\},onError:\(err\)=>\{[\s\S]*?\}\}\);\}\}/,
  `handleBrokerAction(){if(state.brokerInsider?.active){this.openExchangeModal();return;}audio.playTap();platform.showRewardedVideo({onRewarded:()=>{if(typeof state.activateBrokerInsider==="function"){state.activateBrokerInsider();}if(typeof window.showToast==="function"){window.showToast("🔥 Инсайд брокера активирован: x2.5 к ценам!");}},onError:(err)=>{}});}}`
);

fs.writeFileSync(tickerPath, ticker, 'utf8');
console.log('src/ui/ticker.js successfully updated.');

// 4. Update src/state.js (helicopter crate)
const statePath = path.resolve(__dirname, '../src/state.js');
let stateTxt = fs.readFileSync(statePath, 'utf8');

stateTxt = stateTxt.replace(
  /onError:\(\)=>\{done\(platform\.isMock\?"ad":"free"\);\}\}/,
  `onError:()=>{this.helicopter.crateCollected=false;this.helicopter.waitingClick=true;}}`
);

fs.writeFileSync(statePath, stateTxt, 'utf8');
console.log('src/state.js successfully updated.');
