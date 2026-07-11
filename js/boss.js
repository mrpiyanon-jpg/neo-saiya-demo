window.NeoSaiya = window.NeoSaiya || {};

(function () {
  "use strict";

  class BossManager {
    constructor(options) {
      this.normalElement = options.normalElement;
      this.hitElement = options.hitElement;
      this.phaseText = options.phaseText;

      this.maxHp = 100;
      this.hp = 100;
      this.phase = 1;
    }

    reset() {
      this.hp = this.maxHp;
      this.phase = 1;

      this.normalElement.classList.remove("hidden");
      this.hitElement.classList.add("hidden");
      this.normalElement.style.filter = "";
      this.phaseText.textContent = "";
    }

    damage(amount) {
      this.hp = Math.max(0, this.hp - amount);

      this.playHitReaction();
      this.checkPhase();

      return this.hp;
    }

    playHitReaction() {
      this.normalElement.classList.add("hidden");
      this.hitElement.classList.remove("hidden");

      clearTimeout(this.hitTimer);

      this.hitTimer = setTimeout(() => {
        this.hitElement.classList.add("hidden");
        this.normalElement.classList.remove("hidden");
      }, 110);
    }

    checkPhase() {
      let nextPhase = 1;

      if (this.hp <= 30) {
        nextPhase = 3;
      } else if (this.hp <= 65) {
        nextPhase = 2;
      }

      if (nextPhase !== this.phase) {
        this.phase = nextPhase;
        this.showPhase();
      }
    }

    showPhase() {
      this.phaseText.textContent = `PHASE ${this.phase}`;

      if (this.phase === 2) {
        this.normalElement.style.filter =
          "brightness(1.15) saturate(1.3) drop-shadow(0 0 28px #ff2b93)";
      }

      if (this.phase === 3) {
        this.normalElement.style.filter =
          "brightness(1.3) saturate(1.6) contrast(1.2) drop-shadow(0 0 38px #ff334f)";
      }

      clearTimeout(this.phaseTimer);

      this.phaseTimer = setTimeout(() => {
        this.phaseText.textContent = "";
      }, 1400);
    }

    isDead() {
      return this.hp <= 0;
    }
  }

  window.NeoSaiya.BossManager = BossManager;
})();