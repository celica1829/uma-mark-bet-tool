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
    return String(text || "").replace(/[○◯]/g, "〇").replace(/\s+/g, "").replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `.${MARK_CLASS}{display:inline-flex;align-items:center;justify-content:center;width:1.8em;height:1.8em;margin-right:.35em;border-radius:50%;background:#176b43;color:#fff;font-weight:700;font-size:14px;line-height:1;vertical-align:middle}#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.55)}#${OVERLAY_ID} .ngwe-box{width:min(100%,560px);background:#fff;color:#222;border-radius:10px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,sans-serif}#${OVERLAY_ID} h2{margin:0 0 8px;font-size:17px}#${OVERLAY_ID} p{margin:0 0 10px;color:#555;font-size:13px;line-height:1.45}#${OVERLAY_ID} textarea{width:100%;min-height:190px;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #aaa;border-radius:6px}#${OVERLAY_ID} .ngwe-actions{display:flex;gap:8px;margin-top:10px}#${OVERLAY_ID} button{flex:1;padding:11px;border:0;border-radius:6px;background:#176b43;color:#fff;font-weight:700;font-size:15px}#${OVERLAY_ID} button.ngwe-cancel{background:#666}`;
    document.head.appendChild(style);
  }

  async function waitForMarkMenus(root, timeoutMs = 10000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const rows = root.querySelectorAll("tr.HorseList, tr[class*='HorseList']");
      if (rows.length > 0 && Array.from(rows).every((row) => row.querySelector("select[id^='mark_']"))) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }
  async function applyMarks(entries, race, root = document) {
    await waitForMarkMenus(root);
    root.querySelectorAll(`.${MARK_CLASS}`).forEach((node) => node.remove());
    const targets = entries.filter((entry) => entry.place === race.place && entry.race === race.race);
    let applied = 0;
    const missingHorses = [];
    const missingMarkCells = [];
    for (const target of targets) {
      const horseNode = Array.from(root.querySelectorAll("a, .HorseName, [class*='HorseName']")).find((node) => normalizeName(node.textContent) === normalizeName(target.name));
      const numberNode = Array.from(root.querySelectorAll("[class*='Umaban']")).find((node) => String(node.textContent).trim() === target.number);
      const row = horseNode?.closest("tr, .HorseList, [class*='HorseList']") || numberNode?.closest("tr, .HorseList, [class*='HorseList']");
      if (!row) {
        missingHorses.push(target.name);
        continue;
      }
      const markCell = row.querySelector("td.CheckMark, .CheckMark, td.Horse_Select, .Horse_Select");
      if (!markCell) {
        missingMarkCells.push(target.name);
        continue;
      }
      const select = markCell.querySelector("select");
      const option = select && Array.from(select.options).find((item) => normalizeName(item.dataset.htmlText || item.textContent) === normalizeName(target.mark));
      const choice = option && markCell.querySelectorAll(".tzSelect .dropDown li")[option.index];
      if (choice) {
        choice.click();
        await new Promise((resolve) => setTimeout(resolve, 250));
      } else if (select && option) {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (!markCell.querySelector(`.${MARK_CLASS}`)) {
        const badge = document.createElement("span");
        badge.className = MARK_CLASS;
        badge.textContent = target.mark;
        badge.title = `${target.mark} ${target.number} ${target.name}`;
        markCell.appendChild(badge);
      }
      applied += 1;
    }
    return { applied, expected: targets.length, missingHorses, missingMarkCells };
  }

  async function discoverRaceUrls(raceId) { const ymd = /^\d{12}$/.test(raceId) ? raceId.slice(0, 8) : ""; if (!ymd) return new Map(); const response = await fetch(`${location.origin}/top/race_list.html?kaisai_date=${ymd}`, { credentials: "include" }); if (!response.ok) return new Map(); const page = new DOMParser().parseFromString(await response.text(), "text/html"); const urls = new Map(); for (const link of page.querySelectorAll('a[href*="race_id="]')) { const linkedRaceId = new URL(link.href, location.href).searchParams.get("race_id") || ""; if (!/^\d{12}$/.test(linkedRaceId)) continue; const place = PLACE_BY_CODE[linkedRaceId.slice(4, 6)]; const raceNumber = String(Number(linkedRaceId.slice(10, 12))); if (place) urls.set(`${place}_${raceNumber}`, `${location.origin}/race/shutuba.html?race_id=${linkedRaceId}`); } return urls; }
  function loadRaceDocument(url) { return new Promise((resolve, reject) => { const frame = document.createElement("iframe"); frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10px;top:-10px;opacity:0;pointer-events:none;"; frame.onload = () => resolve({ frame, doc: frame.contentDocument }); frame.onerror = () => reject(new Error(url)); frame.src = url; document.body.appendChild(frame); }); }
  async function applyAllRaces(entries, race, raceId) {
    const results = []; const raceUrls = await discoverRaceUrls(raceId); const groups = new Map();
    for (const entry of entries) { const key = `${entry.place}_${entry.race}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(entry); }
    for (const [key, targets] of groups) { const [groupPlace, raceNumber] = key.split('_'); const url = raceUrls.get(key) || (groupPlace === race.place ? `${location.origin}/race/shutuba.html?race_id=${raceId.slice(0, 10)}${String(raceNumber).padStart(2, '0')}` : ''); if (!url) { results.push(`${groupPlace}${raceNumber}R: race_id取得失敗`); continue; } let frameInfo; try { frameInfo = await loadRaceDocument(url); const result = await applyMarks(targets, { place: groupPlace, race: raceNumber }, frameInfo.doc); await new Promise((resolve) => setTimeout(resolve, 500)); results.push(`${groupPlace}${raceNumber}R: ${result.applied}/${result.expected}`); frameInfo.frame.remove(); } catch (_e) { results.push(`${groupPlace}${raceNumber}R: 読み込み失敗`); frameInfo?.frame.remove(); } }
    return results;
  }

  function showInput(race) {
    addStyle();
    document.getElementById(OVERLAY_ID)?.remove();
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `<div class="ngwe-box"><h2>${race.place}${race.race}R に印を反映</h2><p>印データを貼り付けてください。入力された${race.place}の全対象レースへ一括反映します。</p><textarea placeholder="中12 △ 1 コスモコンフェルマ\n阪1 ▲ 4 ウンディーネ"></textarea><div class="ngwe-actions"><button class="ngwe-cancel" type="button">閉じる</button><button type="button">全レースへ反映</button></div></div>`;
    document.body.appendChild(overlay);
    const textarea = overlay.querySelector("textarea");
    textarea.focus();
    overlay.querySelector(".ngwe-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("button:not(.ngwe-cancel)").addEventListener("click", async () => {
      const entries = parseEntries(textarea.value); const result = await applyMarks(entries, race); const raceId = new URL(location.href).searchParams.get("race_id"); const batchResults = await applyAllRaces(entries, race, raceId);
      overlay.remove();
      const detail = result.missingHorses.length ? `\n出走行が見つからない馬: ${result.missingHorses.join("、")}` : result.missingMarkCells.length ? `\n印欄が見つからない馬: ${result.missingMarkCells.join("、")}` : "";
      alert(`${result.applied}頭を含む対象レースへ反映しました。\n${batchResults.join("\n")}${detail}`);
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