/* VERSION 58: LIVE CRYPTO SCANNER & ROBO TRADE ARENA MODULE (ANTI-FLICKER RENDERING & 6-ROW HEIGHT) */

let roboCountdownSeconds = 300;
const lastSchedHTML = { GOD: "", GROUP_C: "" };

function initLiveCryptoScannerModule() {
  console.log("VERSION 58: Initialized Live Crypto Scanner Module");
  fetchRoboSchedules();
  setInterval(fetchRoboSchedules, 3000);
  setInterval(updateRoboCountdownTimer, 1000);
}

async function fetchRoboSchedules() {
  try {
    const [schedRes, holdingsRes] = await Promise.all([
      fetch("/api/robo/schedules"),
      fetch("/api/paper/holdings")
    ]);
    const schedData = await schedRes.json();
    const holdingsData = await holdingsRes.json();

    const allSchedules = (schedData.status === "success" && schedData.schedules) ? schedData.schedules : [];
    const allHoldings = (holdingsData.status === "success" && holdingsData.holdings) ? holdingsData.holdings : [];

    const renderBotSchedule = (participantKey, participantName, listContainerId, balElemId, totalCapElemId) => {
      const container = document.getElementById(listContainerId);
      if (!container) return;

      const botHoldings = allHoldings.filter(h => h.participant && h.participant.includes(participantName));
      const botPending = allSchedules.filter(s => s.participant && s.participant.includes(participantName) && s.status === "PENDING");

      const combinedItems = [];

      botHoldings.forEach(h => {
        combinedItems.push({
          symbol: h.symbol,
          entry_price_target: h.entry_price,
          exit_price_target: h.entry_price * 1.05,
          status: "EXECUTED"
        });
      });

      botPending.forEach(s => {
        if (combinedItems.length < 5) {
          combinedItems.push({
            symbol: s.symbol,
            entry_price_target: s.entry_price_target,
            exit_price_target: s.exit_price_target,
            status: "PENDING"
          });
        }
      });

      let newHTML = "";
      if (combinedItems.length === 0) {
        newHTML = '<div class="text-muted" style="font-size: 0.7rem; padding: 0.5rem; text-align: center;">Scanning market to curate 5-trade schedule...</div>';
      } else {
        newHTML = combinedItems.map(s => {
          const statusColor = s.status === 'EXECUTED' ? '#10b981' : '#f0b90b';
          const safeEntry = typeof window.formatFullPrice === "function" ? window.formatFullPrice(s.entry_price_target, 4) : `$${s.entry_price_target.toFixed(4)}`;
          const safeExit = typeof window.formatFullPrice === "function" ? window.formatFullPrice(s.exit_price_target, 4) : `$${s.exit_price_target.toFixed(4)}`;
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.5); padding: 0.35rem 0.6rem; border-radius: 4px; border-left: 3px solid ${statusColor}; margin-bottom: 3px;">
              <span style="color: #fff; font-size: 0.78rem; font-family: var(--font-mono);"><strong>${s.symbol}</strong></span>
              <span style="color: var(--text-muted); font-size: 0.72rem;">Entry: ${safeEntry} -> Exit: <strong style="color: #00f0ff;">${safeExit}</strong></span>
              <span class="badge-mini" style="font-size: 0.62rem; background: ${s.status === 'EXECUTED' ? 'rgba(16,185,129,0.2)' : 'rgba(240,185,11,0.2)'}; color: ${statusColor}; font-weight: 700;">${s.status}</span>
            </div>
          `;
        }).join("");
      }

      // Update innerHTML ONLY if content meaningfully changes (prevents visual flickering)
      if (lastSchedHTML[participantKey] !== newHTML) {
        lastSchedHTML[participantKey] = newHTML;
        container.innerHTML = newHTML;
      }

      // Update Capital & Equity Counters
      const openCount = botHoldings.length;
      const realizedPnl = (window.latestRoboPnl && window.latestRoboPnl[participantKey === "GOD" ? "god" : "groupC"]) || 0;
      let unrealizedPnl = 0;
      
      botHoldings.forEach(h => {
        const liveTicker = window.activeTickers && window.activeTickers[h.symbol];
        const liveP = liveTicker ? liveTicker.price : h.entry_price;
        unrealizedPnl += (liveP - h.entry_price) * h.amount;
      });

      const availCash = Math.max(0, 100.0 - (openCount * 20.0) + realizedPnl);
      const totalCap = 100.0 + realizedPnl + unrealizedPnl;

      const balEl = document.getElementById(balElemId);
      if (balEl && balEl.textContent !== availCash.toFixed(2)) balEl.textContent = availCash.toFixed(2);
      const totEl = document.getElementById(totalCapElemId);
      if (totEl && totEl.textContent !== totalCap.toFixed(2)) totEl.textContent = totalCap.toFixed(2);
    };

    renderBotSchedule("GOD", "GOD", "godRoboScheduleList", "godRoboBalance", "godRoboTotalCapital");
    renderBotSchedule("GROUP_C", "GROUP C", "groupCRoboScheduleList", "groupCRoboBalance", "groupCRoboTotalCapital");

  } catch (e) {
    console.error("Failed to fetch robo schedules:", e);
  }
}

function updateRoboCountdownTimer() {
  const timerElem = document.getElementById("roboTimerCountdown");
  if (timerElem) {
    const mins = Math.floor(roboCountdownSeconds / 60);
    const secs = roboCountdownSeconds % 60;
    timerElem.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (roboCountdownSeconds > 0) {
      roboCountdownSeconds--;
    } else {
      roboCountdownSeconds = 300;
    }
  }
}

window.initLiveCryptoScannerModule = initLiveCryptoScannerModule;
window.fetchRoboSchedules = fetchRoboSchedules;
