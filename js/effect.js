window.NeoSaiya = window.NeoSaiya || {};

(function () {
  "use strict";

  class EffectManager {
    constructor(options) {
      this.game = options.game;
      this.magic = options.magic;
      this.hand = options.hand;
      this.warningText = options.warningText;
    }

    reset() {
      this.game.classList.remove(
        "stability-warning",
        "stability-danger",
        "stability-critical",
        "hit-impact",
        "miss-impact"
      );

      this.hand.classList.remove(
        "combo-power-1",
        "combo-power-2"
      );

      this.warningText.textContent = "";
    }

    playHit() {
      this.game.classList.remove("hit-impact");
      void this.game.offsetWidth;
      this.game.classList.add("hit-impact");

      this.magic.classList.remove("hidden", "play");
      void this.magic.offsetWidth;
      this.magic.classList.add("play");

      setTimeout(() => {
        this.magic.classList.add("hidden");
        this.magic.classList.remove("play");
      }, 430);
    }

    playMiss() {
      this.game.classList.remove("miss-impact");
      void this.game.offsetWidth;
      this.game.classList.add("miss-impact");
    }

    updateComboPower(combo) {
      this.hand.classList.remove(
        "combo-power-1",
        "combo-power-2"
      );

      if (combo >= 20) {
        this.hand.classList.add("combo-power-2");
      } else if (combo >= 10) {
        this.hand.classList.add("combo-power-1");
      }
    }

    updateStability(stability) {
      this.game.classList.remove(
        "stability-warning",
        "stability-danger",
        "stability-critical"
      );

      if (stability <= 20) {
        this.game.classList.add("stability-critical");
        this.warningText.textContent =
          "NEURAL SIGNAL COLLAPSING";
      } else if (stability <= 40) {
        this.game.classList.add("stability-danger");
        this.warningText.textContent =
          "CRITICAL STABILITY";
      } else if (stability <= 65) {
        this.game.classList.add("stability-warning");
        this.warningText.textContent =
          "SIGNAL INTERFERENCE";
      } else {
        this.warningText.textContent = "";
      }
    }
  }

  window.NeoSaiya.EffectManager = EffectManager;
})();