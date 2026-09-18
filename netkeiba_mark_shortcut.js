(() => {
  const STYLE_ID = "ngwe-netkeiba-mark-style";
  const MARK_CLASS = "ngwe-netkeiba-mark";
  const OVERLAY_ID = "ngwe-netkeiba-mark-input";
  const PLACE_BY_CODE = { "01": "札", "02": "函", "03": "福", "04": "新", "05": "東", "06": "中", "07": "名", "08": "京", "09": "阪", "10": "小" };

  function currentRace() {
    const raceId = new URL(location.href).searchParams.get("race_id") || "";
    if (!/^\d{12}$/.test(raceId)) return null;
    return { place: PLACE_BY_CODE[raceId.slice(4, 6)], race: String(Number(raceId.slice(10, 12))) };
  }

  function parseEntries(text) {
    const entries = [];
    for (const rawLine of String(text || "").replace(/\r/g, "").split("\n")) {
      const match = rawLine.trim().match(/^(.+?)\s+([◎○〇▲△★×危])\s+(\d+)\s+(.+)$/);
      if (!match) continue;
      const raceMatch = match[1].trim().match(/^(.+?)(\d+)$/);
      if (!raceMatch) continue;
      entries.push({ place: raceMatch[1].trim(), race: String(Number(raceMatch[2])), mark: match[2] === "○" ? "〇" : match[2], number: String(Number(match[3])), name: match[4].trim() });
    }
    return entries;
  }

  function normalizeName(text) {
    return String(text || "").replace(/\s+/g, "").replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `.${MARK_CLASS}{display:inline-flex;align-items:center;justify-content:center;width:1.8em;height:1.8em;margin-right:.35em;border-radius:50%;background:#176b43;color:#fff;font-weight:700;font-size:14px;line-height:1;vertical-align:middle}#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.55)}#${OVERLAY_ID} .ngwe-box{width:min(100%,560px);background:#fff;color:#222;border-radius:10px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,sans-serif}#${OVERLAY_ID} h2{margin:0 0 8px;font-size:17px}#${OVERLAY_ID} p{margin:0 0 10px;color:#555;font-size:13px;line-height:1.45}#${OVERLAY_ID} textarea{width:100%;min-height:190px;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #aaa;border-radius:6px}#${OVERLAY_ID} .ngwe-actions{display:flex;gap:8px;margin-top:10px}#${OVERLAY_ID} button{flex:1;padding:11px;border:0;border-radius:6px;background:#176b43;color:#fff;font-weight:700;font-size:15px}#${OVERLAY_ID} button.ngwe-cancel{background:#666}`;
    document.head.appendChild(style);
  }

  function applyMarks(entries, race) {
    document.querySelectorAll(`.${MARK_CLASS}`).forEach((node) => node.remove());
    const targets = entries.filter((entry) => entry.place === race.place && entry.race === race.race);
    let applied = 0;
    for (const row of document.querySelectorAll("tr")) {
      const horseLink = Array.from(row.querySelectorAll('a[href*="/horse/"]')).find((link) => link.textContent.trim());
      if (!horseLink) continue;
      const matching = targets.find((entry) => normalizeName(entry.name) === normalizeName(horseLink.textContent));
      if (!matching) continue;
      const badge = document.createElement("span");
      badge.className = MARK_CLASS;
      badge.textContent = matching.mark;
      badge.title = `${matching.mark} ${matching.number} ${matching.name}`;
      horseLink.parentNode.insertBefore(badge, horseLink);
      applied += 1;
    }
    return { applied, expected: targets.length };
  }

  function showInput(race) {
    addStyle();
    document.getElementById(OVERLAY_ID)?.remove();
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `<div class="ngwe-box"><h2>${race.place}${race.race}R に印を反映</h2><p>印データを貼り付けて「反映」を押してください。</p><textarea placeholder="中12 △ 1 コスモコンフェルマ\n阪1 ▲ 4 ウンディーネ"></textarea><div class="ngwe-actions"><button class="ngwe-cancel" type="button">閉じる</button><button type="button">反映</button></div></div>`;
    document.body.appendChild(overlay);
    const textarea = overlay.querySelector("textarea");
    textarea.focus();
    overlay.querySelector(".ngwe-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("button:not(.ngwe-cancel)").addEventListener("click", () => {
      const result = applyMarks(parseEntries(textarea.value), race);
      overlay.remove();
      alert(`${result.applied}頭に印を表示しました。対象の印データは${result.expected}頭です。`);
    });
  }

  const race = currentRace();
  if (!race?.place) {
    alert("netkeibaの出馬表または結果ページで実行してください。");
    completion("対象外ページ");
    return;
  }
  showInput(race);
  completion("印入力を表示");
})();