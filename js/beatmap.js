window.NeoSaiya = window.NeoSaiya || {};

(function () {
  "use strict";

  const KEYS = ["A", "W", "S", "D"];

  /*
    ค่าหลักของความรู้สึกในการเล่น
    travelTime มากขึ้น = โน้ตวิ่งช้าลงและมองเห็นล่วงหน้านานขึ้น
    minGap / maxGap = ระยะห่างของโน้ตแต่ละตัว
  */
  const CONFIG = {
    songDuration: 156, // 2 นาที 36 วินาที
    introDelay: 1.8,

    // ความเร็วใกล้เคียงเวอร์ชัน 11
    travelTime: 2.15,

    // โน้ตมาต่อเนื่อง แต่ไม่ถี่จนเกินไป
    minGap: 0.78,
    maxGap: 1.28,

    // บางช่วงจะมีโน้ตใกล้กันเล็กน้อย
    closeGap: 0.62,
    closeChance: 0.16,

    // ช่วงเวลาตัดสินการกด
    perfectWindow: 0.14,
    greatWindow: 0.23,
    goodWindow: 0.33,
    missWindow: 0.38
  };

  /*
    Random แบบมี Seed
    ทำให้ทุกครั้งที่เล่นได้ Pattern เหมือนเดิม
    กรรมการทุกคนจะได้รับความยากเท่ากัน
  */
  function createSeededRandom(seed) {
    let value = seed >>> 0;

    return function () {
      value += 0x6d2b79f5;

      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickKey(random, history) {
    let key = KEYS[Math.floor(random() * KEYS.length)];

    // ป้องกันตัวเดิมซ้ำเกิน 2 ครั้ง
    if (
      history.length >= 2 &&
      history[history.length - 1] === key &&
      history[history.length - 2] === key
    ) {
      const alternatives = KEYS.filter((item) => item !== key);
      key = alternatives[Math.floor(random() * alternatives.length)];
    }

    return key;
  }

  function buildBeatmap() {
    const random = createSeededRandom(2569);
    const notes = [];
    const history = [];

    let currentTime = CONFIG.introDelay;

    while (currentTime < CONFIG.songDuration - 1.2) {
      const key = pickKey(random, history);

      notes.push({
        time: Number(currentTime.toFixed(3)),
        key
      });

      history.push(key);

      if (history.length > 4) {
        history.shift();
      }

      let gap;

      if (random() < CONFIG.closeChance) {
        gap = CONFIG.closeGap + random() * 0.12;
      } else {
        gap =
          CONFIG.minGap +
          random() * (CONFIG.maxGap - CONFIG.minGap);
      }

      /*
        เว้นจังหวะเพิ่มเล็กน้อยทุกประมาณ 10–14 โน้ต
        ทำให้ผู้เล่นได้พักสายตา
      */
      if (notes.length % 12 === 0) {
        gap += 0.42;
      }

      currentTime += gap;
    }

    return notes;
  }

  window.NeoSaiya.BeatmapConfig = CONFIG;
  window.NeoSaiya.Beatmap = buildBeatmap();
})();