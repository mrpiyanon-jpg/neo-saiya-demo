window.NeoSaiya = window.NeoSaiya || {};

(function () {
  "use strict";

  class UIManager {
    constructor() {
      this.bossHp = document.getElementById("bossHp");
      this.bossHpText = document.getElementById("bossHpText");
      this.stability = document.getElementById("stability");
      this.stabilityText = document.getElementById("stabilityText");
      this.combo = document.getElementById("combo");
      this.comboState = document.getElementById("comboState");
      this.timer = document.getElementById("timer");
      this.accuracy = document.getElementById("accuracy");
      this.judgement = document.getElementById("judgement");
      this.prompt = document.getElementById("prompt");
      this.finalRank = document.getElementById("finalRank");
      this.finalStats = document.getElementById("finalStats");
    }

    updateBossHp(value) {
      const safeValue = Math.max(0, Math.min(100, value));
      this.bossHp.style.width = `${safeValue}%`;
      this.bossHpText.textContent = `${Math.round(safeValue)}%`;
    }

    updateStability(value) {
      const safeValue = Math.max(0, Math.min(100, value));
      this.stability.style.width = `${safeValue}%`;
      this.stabilityText.textContent = `${Math.round(safeValue)}%`;
    }

    updateCombo(value) {
      this.combo.textContent = `COMBO x${value}`;

      if (value >= 35) {
        this.comboState.textContent = "EXORCISM CHAIN";
      } else if (value >= 20) {
        this.comboState.textContent = "FIREWALL SYNCHRONIZED";
      } else if (value >= 10) {
        this.comboState.textContent = "SCRIPT VERIFIED";
      } else {
        this.comboState.textContent = "FIREWALL IDLE";
      }
    }

    updateTimer(seconds) {
      const safeSeconds = Math.max(0, Math.ceil(seconds));
      const minutes = Math.floor(safeSeconds / 60);
      const remaining = safeSeconds % 60;

      this.timer.textContent =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(remaining).padStart(2, "0")}`;
    }

    updateAccuracy(hits, total) {
      const value = total > 0 ? (hits / total) * 100 : 100;
      this.accuracy.textContent = `ACC ${value.toFixed(1)}%`;
    }

    updatePrompt(key) {
      this.prompt.innerHTML = `PRESS <b>${key}</b>`;
    }

    showJudgement(type) {
      this.judgement.className =
        `judgement ${type.toLowerCase()} show`;

      this.judgement.textContent = type;

      clearTimeout(this.judgementTimer);

      this.judgementTimer = setTimeout(() => {
        this.judgement.className = "judgement";
      }, 440);
    }

    showResult(stats) {
      this.finalRank.textContent = `RANK ${stats.rank}`;

      this.finalStats.innerHTML = `
        PERFECT: ${stats.perfect}<br>
        GREAT: ${stats.great}<br>
        GOOD: ${stats.good}<br>
        MISS: ${stats.miss}<br>
        ACCURACY: ${stats.accuracy.toFixed(1)}%<br>
        MAX COMBO: ${stats.maxCombo}
      `;
    }
  }

  window.NeoSaiya.UIManager = UIManager;
})();