window.NeoSaiya = window.NeoSaiya || {};

(function () {
  "use strict";

  const IMAGE_BY_KEY = {
    A: "assets/image/note_a.png",
    W: "assets/image/note_w.png",
    S: "assets/image/note_s.png",
    D: "assets/image/note_d.png"
  };

  const COLOR_BY_KEY = {
    A: "#2edcff",
    W: "#ff385b",
    S: "#32e68b",
    D: "#ffc52f"
  };

  class NoteSystem {
    constructor(options) {
      this.container = options.container;
      this.lane = options.lane;
      this.audio = options.audio;
      this.beatmap = options.beatmap;
      this.config = options.config;

      this.onJudgement =
        typeof options.onJudgement === "function"
          ? options.onJudgement
          : function () {};

      this.activeNotes = [];
      this.nextNoteIndex = 0;
      this.running = false;
      this.animationFrame = null;

      this.update = this.update.bind(this);
    }

    reset() {
      this.stop();

      this.activeNotes.forEach((note) => {
        note.element.remove();
      });

      this.activeNotes = [];
      this.nextNoteIndex = 0;
      this.container.innerHTML = "";
    }

    start() {
      this.running = true;
      this.animationFrame = requestAnimationFrame(this.update);
    }

    stop() {
      this.running = false;

      if (this.animationFrame !== null) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }

    spawnNote(noteData) {
      const element = document.createElement("div");
      element.className = "note";
      element.dataset.key = noteData.key;

      element.style.color = COLOR_BY_KEY[noteData.key];

      const image = document.createElement("img");
      image.src = IMAGE_BY_KEY[noteData.key];
      image.alt = noteData.key;
      image.draggable = false;

      element.appendChild(image);
      this.container.appendChild(element);

      const note = {
        key: noteData.key,
        hitTime: noteData.time,
        element,
        judged: false
      };

      this.activeNotes.push(note);
    }

    spawnUpcomingNotes(currentTime) {
      while (this.nextNoteIndex < this.beatmap.length) {
        const noteData = this.beatmap[this.nextNoteIndex];
        const spawnTime =
          noteData.time - this.config.travelTime;

        if (currentTime < spawnTime) {
          break;
        }

        this.spawnNote(noteData);
        this.nextNoteIndex += 1;
      }
    }

    updateNotePosition(note, currentTime) {
      const laneWidth = this.lane.clientWidth;
      const noteWidth = note.element.offsetWidth || 90;

      const startX = -noteWidth - 10;
      const gateX = laneWidth / 2 - noteWidth / 2;

      const timeUntilHit = note.hitTime - currentTime;

      /*
        progress = 0 ตอนเกิดทางซ้าย
        progress = 1 ตอนถึง Gate กลางจอ
      */
      const progress =
        1 - timeUntilHit / this.config.travelTime;

      /*
        หลังเลย Gate แล้ว โน้ตจะยังเคลื่อนต่อไปทางขวา
        ไม่หายทันที ทำให้ผู้เล่นมองเห็นว่า Miss จริง
      */
      let x;

      if (progress <= 1) {
        x = startX + (gateX - startX) * progress;
      } else {
        const afterGateProgress =
          (currentTime - note.hitTime) /
          this.config.missWindow;

        const endX = laneWidth + noteWidth;
        x =
          gateX +
          (endX - gateX) *
            Math.min(afterGateProgress, 1);
      }

      note.element.style.transform =
        `translate3d(${x}px, -50%, 0)`;

      const distanceFromGate =
        Math.abs(currentTime - note.hitTime);

      if (distanceFromGate <= 0.28) {
        note.element.classList.add("near-gate");
      } else {
        note.element.classList.remove("near-gate");
      }
    }

    removeNote(note) {
      note.element.remove();

      const index = this.activeNotes.indexOf(note);

      if (index !== -1) {
        this.activeNotes.splice(index, 1);
      }
    }

    checkAutomaticMisses(currentTime) {
      const notesToMiss = this.activeNotes.filter((note) => {
        return (
          !note.judged &&
          currentTime >
            note.hitTime + this.config.missWindow
        );
      });

      notesToMiss.forEach((note) => {
        note.judged = true;

        this.onJudgement({
          type: "MISS",
          key: note.key,
          timingError: currentTime - note.hitTime,
          automatic: true
        });

        this.removeNote(note);
      });
    }

    findBestNoteForKey(key, currentTime) {
      const candidates = this.activeNotes.filter((note) => {
        return !note.judged && note.key === key;
      });

      if (candidates.length === 0) {
        return null;
      }

      candidates.sort((first, second) => {
        const firstDistance = Math.abs(
          currentTime - first.hitTime
        );

        const secondDistance = Math.abs(
          currentTime - second.hitTime
        );

        return firstDistance - secondDistance;
      });

      return candidates[0];
    }

    judgeInput(key) {
      if (!this.running || this.audio.paused) {
        return null;
      }

      const normalizedKey = key.toUpperCase();
      const currentTime = this.audio.currentTime;

      const note = this.findBestNoteForKey(
        normalizedKey,
        currentTime
      );

      /*
        กดปุ่มตอนที่ไม่มีโน้ตชนิดนั้นอยู่ใกล้ Gate
        ถือเป็น MISS
      */
      if (!note) {
        const result = {
          type: "MISS",
          key: normalizedKey,
          timingError: null,
          automatic: false
        };

        this.onJudgement(result);
        return result;
      }

      const timingError = Math.abs(
        currentTime - note.hitTime
      );

      let type;

      if (timingError <= this.config.perfectWindow) {
        type = "PERFECT";
      } else if (
        timingError <= this.config.greatWindow
      ) {
        type = "GREAT";
      } else if (
        timingError <= this.config.goodWindow
      ) {
        type = "GOOD";
      } else {
        /*
          ถ้าโน้ตยังอยู่ไกลเกินไป
          ไม่ลบโน้ต เพื่อป้องกันผู้เล่นกดมั่วแล้วโน้ตหาย
        */
        const result = {
          type: "MISS",
          key: normalizedKey,
          timingError,
          automatic: false
        };

        this.onJudgement(result);
        return result;
      }

      note.judged = true;
      note.element.classList.remove("near-gate");

      this.onJudgement({
        type,
        key: normalizedKey,
        timingError,
        automatic: false
      });

      this.removeNote(note);

      return {
        type,
        key: normalizedKey,
        timingError
      };
    }

    update() {
      if (!this.running) {
        return;
      }

      const currentTime = this.audio.currentTime;

      this.spawnUpcomingNotes(currentTime);

      this.activeNotes.forEach((note) => {
        this.updateNotePosition(note, currentTime);
      });

      this.checkAutomaticMisses(currentTime);

      this.animationFrame = requestAnimationFrame(
        this.update
      );
    }
  }

  window.NeoSaiya.NoteSystem = NoteSystem;
})();