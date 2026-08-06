window.initRoboTradeModule = function () {
  const container = document.getElementById("roboTradeModuleContainer");
  if (!container) return;

  const handleResetClick = async () => {
    const confirmReset = confirm("⚠️ Are you sure you want to reset all Robo Trade data?\n\nThis will clear all open holdings, queued schedules, and trade transaction history to restart both AI bots with fresh data.");
    if (!confirmReset) return;

    try {
      const res = await fetch("/api/robo/reset", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        alert("✅ Robo Trade Arena successfully reset to a fresh start! Both bots have restarted with $0.00 PnL metrics.");
        updateRoboTradeModule();
      }
    } catch (err) {
      console.error("Reset Robo Trade Error:", err);
      alert("Error resetting Robo Trade Arena: " + err);
    }
  };

  document.getElementById("refreshRoboTradeBtn")?.addEventListener("click", updateRoboTradeModule);
  document.getElementById("resetRoboTradeBtn")?.addEventListener("click", handleResetClick);
  document.getElementById("sidebarResetRoboBtn")?.addEventListener("click", handleResetClick);
  updateRoboTradeModule();

  if (!window.roboTradeTimerInterval) {
    window.roboTradeTimerInterval = setInterval(() => {
      if (document.getElementById("tab-robo-trade") && !document.getElementById("tab-robo-trade").classList.contains("hidden")) {
        updateRoboTradeModule();
      }
    }, 3000);
  }
};

window.updateRoboTradeModule = async function () {
  try {
    const [hRes, sRes, stRes] = await Promise.all([
      fetch("/api/paper/holdings").then(r => r.json()).catch(() => ({ holdings: [] })),
      fetch("/api/robo/schedules").then(r => r.json()).catch(() => ({ schedules: [] })),
      fetch("/api/robo/trade_stats").then(r => r.json()).catch(() => ({ stats: {} }))
    ]);

    const holdings = hRes.holdings || [];
    const schedules = sRes.schedules || [];
    const statsData = stRes.stats || {};
    const todayDate = stRes.today_date || new Date().toISOString().split("T")[0];

    const todayEl = document.getElementById("roboTodayDateText");
    if (todayEl) todayEl.innerText = todayDate;

    // Render Cumulative Commission Fees (Global)
    const commSummary = stRes.commission_summary || {};
    const totComm = commSummary.total || {};
    setTxt("commTodayText", "$" + (totComm.today || 0).toFixed(4));
    setTxt("commWkText", "$" + (totComm.weekly || 0).toFixed(4));
    setTxt("commMoText", "$" + (totComm.monthly || 0).toFixed(4));
    setTxt("commTotalText", "$" + (totComm.lifetime || 0).toFixed(4));

    function setTxt(id, val) {
      const el = document.getElementById(id);
      if (el) el.innerText = String(val);
    }

    // ─────────────────────────────────────────────────────────────
    // 1. SUPREME GOD AI BOT STATS
    // ─────────────────────────────────────────────────────────────
    let godStats = statsData["👑 SUPREME GOD AI BOT"] || {};
    if (!godStats.today_wins && !godStats.total_wins && !godStats.total_profit) {
      for (let k in statsData) {
        if (k.includes("GOD") || k.includes("God")) { godStats = statsData[k]; break; }
      }
    }

    // Today Stats (Resets 12:00 AM MYT - Requirement 2 & 3)
    setTxt("godTodayWins", godStats.today_wins || 0);
    setTxt("godTodayLosses", godStats.today_losses || 0);
    setTxt("godTodayProfit", "+$" + (godStats.today_profit || 0).toFixed(2));
    setTxt("godTodayLossIncurred", "-$" + (godStats.today_loss || 0).toFixed(2));
    setTxt("godTodayComm", "-$" + (godStats.today_commission_fee || 0).toFixed(4));
    
    const godTodayNet = godStats.today_pnl || 0;
    const godTodayNetEl = document.getElementById("godTodayPnL");
    if (godTodayNetEl) {
      godTodayNetEl.innerText = (godTodayNet >= 0 ? "+" : "") + "$" + godTodayNet.toFixed(2);
      godTodayNetEl.style.color = godTodayNet >= 0 ? "#10b981" : "#ef4444";
    }

    // Cumulative Lifetime Stats (Requirement 5)
    setTxt("godCumProfit", "+$" + (godStats.total_profit || 0).toFixed(2));
    setTxt("godCumLoss", "-$" + (godStats.total_loss || 0).toFixed(2));
    setTxt("godCumComm", "-$" + (godStats.total_commission_fee || 0).toFixed(4));
    const godCumNet = godStats.total_pnl || 0;
    const godCumNetEl = document.getElementById("godCumNetPnL");
    if (godCumNetEl) {
      godCumNetEl.innerText = (godCumNet >= 0 ? "+" : "") + "$" + godCumNet.toFixed(2);
      godCumNetEl.style.color = godCumNet >= 0 ? "#10b981" : "#ef4444";
    }

    setTxt("godTodayWinsText", godStats.today_wins || 0);
    setTxt("godTodayLossesText", godStats.today_losses || 0);
    const godTPnl = godStats.today_pnl || 0;
    const godTPct = godStats.today_pnl_pct || 0;
    setTxt("godTodayPnlText", (godTPnl >= 0 ? "+" : "") + "$" + godTPnl.toFixed(2));
    setTxt("godTodayPctText", (godTPct >= 0 ? "+" : "") + godTPct.toFixed(2) + "%");
    const godBadge = document.getElementById("godTodayPnlBadge");
    if (godBadge) {
      godBadge.innerText = (godTPnl >= 0 ? "+" : "") + "$" + godTPnl.toFixed(2) + " (" + (godTPct >= 0 ? "+" : "") + godTPct.toFixed(1) + "%)";
      godBadge.className = "change-badge " + (godTPnl >= 0 ? "up" : "down");
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GROUP C OB BOT STATS
    // ─────────────────────────────────────────────────────────────
    let cStats = statsData["⚡ GROUP C OB BOT"] || {};
    if (!cStats.today_wins && !cStats.total_wins && !cStats.total_profit) {
      for (let k in statsData) {
        if (k.includes("GROUP C") || k.includes("Group C") || k.includes("C BOT")) { cStats = statsData[k]; break; }
      }
    }

    // Today Stats (Resets 12:00 AM MYT - Requirement 2 & 3)
    setTxt("groupCTodayWins", cStats.today_wins || 0);
    setTxt("groupCTodayLosses", cStats.today_losses || 0);
    setTxt("groupCTodayProfit", "+$" + (cStats.today_profit || 0).toFixed(2));
    setTxt("groupCTodayLossIncurred", "-$" + (cStats.today_loss || 0).toFixed(2));
    setTxt("groupCTodayComm", "-$" + (cStats.today_commission_fee || 0).toFixed(4));
    
    const cTodayNet = cStats.today_pnl || 0;
    const cTodayNetEl = document.getElementById("groupCTodayPnL");
    if (cTodayNetEl) {
      cTodayNetEl.innerText = (cTodayNet >= 0 ? "+" : "") + "$" + cTodayNet.toFixed(2);
      cTodayNetEl.style.color = cTodayNet >= 0 ? "#10b981" : "#ef4444";
    }

    // Cumulative Lifetime Stats (Requirement 5)
    setTxt("groupCCumProfit", "+$" + (cStats.total_profit || 0).toFixed(2));
    setTxt("groupCCumLoss", "-$" + (cStats.total_loss || 0).toFixed(2));
    setTxt("groupCCumComm", "-$" + (cStats.total_commission_fee || 0).toFixed(4));
    const cCumNet = cStats.total_pnl || 0;
    const cCumNetEl = document.getElementById("groupCCumNetPnL");
    if (cCumNetEl) {
      cCumNetEl.innerText = (cCumNet >= 0 ? "+" : "") + "$" + cCumNet.toFixed(2);
      cCumNetEl.style.color = cCumNet >= 0 ? "#10b981" : "#ef4444";
    }

    setTxt("groupCTodayWinsText", cStats.today_wins || 0);
    setTxt("groupCTodayLossesText", cStats.today_losses || 0);
    const cTPnl = cStats.today_pnl || 0;
    const cTPct = cStats.today_pnl_pct || 0;
    setTxt("groupCTodayPnlText", (cTPnl >= 0 ? "+" : "") + "$" + cTPnl.toFixed(2));
    setTxt("groupCTodayPctText", (cTPct >= 0 ? "+" : "") + cTPct.toFixed(2) + "%");
    const cBadge = document.getElementById("groupCTodayPnlBadge");
    if (cBadge) {
      cBadge.innerText = (cTPnl >= 0 ? "+" : "") + "$" + cTPnl.toFixed(2) + " (" + (cTPct >= 0 ? "+" : "") + cTPct.toFixed(1) + "%)";
      cBadge.className = "change-badge " + (cTPnl >= 0 ? "up" : "down");
    }
    setTxt("groupCTodayPnlText", (cTPnl >= 0 ? "+" : "") + "$" + cTPnl.toFixed(2));
    setTxt("groupCTodayPctText", (cTPct >= 0 ? "+" : "") + cTPct.toFixed(2) + "%");
    const cBadge = document.getElementById("groupCTodayPnlBadge");
    if (cBadge) {
      cBadge.innerText = (cTPnl >= 0 ? "+" : "") + "$" + cTPnl.toFixed(2) + " (" + (cTPct >= 0 ? "+" : "") + cTPct.toFixed(1) + "%)";
      cBadge.className = "change-badge " + (cTPnl >= 0 ? "up" : "down");
    }

    // VERSION 87: 2-MINUTE TIMER COUNTDOWN DISPATCH & RENDER
    const nextSec = sRes.next_update_in_seconds !== undefined ? sRes.next_update_in_seconds : 120;
    window.roboTradeNextSec = nextSec;
    const formatTimer = (sec) => {
      const m = Math.floor(sec / 60).toString().padStart(2, "0");
      const s = (sec % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    };
    const tStr = formatTimer(nextSec);
    const gEl = document.getElementById("godSchedTimerText");
    if (gEl) gEl.innerText = tStr;
    const cEl = document.getElementById("groupCSchedTimerText");
    if (cEl) cEl.innerText = tStr;

    if (!window.roboTradeCountdownTicker) {
      window.roboTradeCountdownTicker = setInterval(() => {
        if (window.roboTradeNextSec !== undefined && window.roboTradeNextSec > 0) {
          window.roboTradeNextSec -= 1;
          const str = formatTimer(window.roboTradeNextSec);
          const gTimer = document.getElementById("godSchedTimerText");
          if (gTimer) gTimer.innerText = str;
          const cTimer = document.getElementById("groupCSchedTimerText");
          if (cTimer) cTimer.innerText = str;
        } else if (window.roboTradeNextSec === 0) {
          window.roboTradeNextSec = 120;
          if (document.getElementById("tab-robo-trade") && !document.getElementById("tab-robo-trade").classList.contains("hidden")) {
            updateRoboTradeModule();
          }
        }
      }, 1000);
    }

    // Render Active Holdings with Stop Loss Price (-3.0%)
    renderBotHoldingsTable("👑 SUPREME GOD AI BOT", holdings, "godHoldingsTableBody");
    renderBotHoldingsTable("⚡ GROUP C OB BOT", holdings, "groupCHoldingsTableBody");

    // Render 5-Coin Schedule Plan
    renderBotSchedulesList("👑 SUPREME GOD AI BOT", schedules, "godScheduleList");
    renderBotSchedulesList("⚡ GROUP C OB BOT", schedules, "groupCScheduleList");

    // VERSION 72: Render Weekly & Monthly Performance Summaries
    renderSummaryCard(stRes.weekly_summary, "weeklySummaryContainer");
    renderSummaryCard(stRes.monthly_summary, "monthlySummaryContainer");

    // VERSION 72: Render Everyday Historical Performance Ledger (Max 7 Dates)
    renderEverydayLedger(stRes.daily_ledger || []);

  } catch (err) {
    console.error("[Robo Trade Module Update Error]", err);
  }
};

function renderBotHoldingsTable(participant, holdings, targetElId) {
  const tbody = document.getElementById(targetElId);
  if (!tbody) return;

  const botHoldings = holdings.filter(h => {
    if (!h.participant) return false;
    if (participant.includes("GOD") && (h.participant.includes("GOD") || h.participant.includes("God"))) return true;
    if (participant.includes("GROUP C") && (h.participant.includes("GROUP C") || h.participant.includes("Group C") || h.participant.includes("C BOT"))) return true;
    return h.participant === participant;
  });
  if (botHoldings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center">No active open holdings currently.</td></tr>`;
    return;
  }

  tbody.innerHTML = botHoldings.map(h => {
    const entry = h.entry_price || 0;
    // VERSION 73: REAL-TIME TICK PRICE LOOKUP FROM WEBSOCKET BUFFER (window.allTickers)
    const liveTicker = (window.allTickers || []).find(t => t.symbol === h.symbol);
    const livePrice = liveTicker ? liveTicker.price : (h.live_price || entry);
    const stopLossPrice = entry * 0.97; // -3% Stop Loss
    const targetPrice = entry * 1.05;  // +5% Take Profit
    
    // Dynamic real-time unrealized PnL ($)
    const pnl = liveTicker ? ((livePrice - entry) * (h.amount || 1)) : (h.unrealized_pnl !== undefined ? h.unrealized_pnl : ((livePrice - entry) * (h.amount || 1)));
    const pnlClass = pnl >= 0 ? "color: #10b981; font-weight: 800;" : "color: #ef4444; font-weight: 800;";

    return `
      <tr>
        <td style="font-weight: 800; color: #fff;">${h.symbol}</td>
        <td>$${entry.toFixed(4)}</td>
        <td style="color: #ef4444; font-weight: 800;">$${stopLossPrice.toFixed(4)}</td>
        <td style="color: #10b981; font-weight: 800;">$${targetPrice.toFixed(4)}</td>
        <td style="font-family: var(--font-mono); font-weight: 800; color: #00f0ff;">$${livePrice.toFixed(4)}</td>
        <td style="${pnlClass}">${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}</td>
      </tr>
    `;
  }).join("");
}

function renderBotSchedulesList(participant, schedules, targetElId) {
  const container = document.getElementById(targetElId);
  if (!container) return;

  const botScheds = schedules.filter(s => {
    if (s.status !== 'PENDING') return false;
    if (!s.participant) return false;
    if (participant.includes("GOD") && (s.participant.includes("GOD") || s.participant.includes("God"))) return true;
    if (participant.includes("GROUP C") && (s.participant.includes("GROUP C") || s.participant.includes("Group C") || s.participant.includes("C BOT"))) return true;
    return s.participant === participant;
  });
  if (botScheds.length === 0) {
    container.innerHTML = `<div class="text-muted text-center" style="font-size: 0.75rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px;">Curating 5-coin schedule entry plan...</div>`;
    return;
  }

  container.innerHTML = botScheds.map((s, idx) => {
    const entryTarget = s.entry_price_target || 0;
    const stopLossTarget = s.stop_loss_target || (entryTarget * 0.97);
    const exitTarget = s.exit_price_target || (entryTarget * 1.05);
    const scoreVal = s.confluence_score || 0;
    const scoreStr = scoreVal ? ` (${scoreVal.toFixed(1)} Pts)` : "";
    const isGradeS = s.tier && s.tier.includes("GRADE S");

    const badgeHtml = isGradeS 
      ? `<span style="background: rgba(240, 185, 11, 0.25); color: #f0b90b; border: 1px solid #f0b90b; font-weight: 900; font-size: 0.63rem; padding: 0.1rem 0.4rem; border-radius: 4px;"><i class="fa-solid fa-crown"></i> GRADE S (9.5+ Pts)</span>`
      : `<span style="background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); font-weight: 700; font-size: 0.63rem; padding: 0.1rem 0.4rem; border-radius: 4px;">Top #${idx + 1}${scoreStr}</span>`;

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.35); border: 1px solid ${isGradeS ? 'rgba(240, 185, 11, 0.5)' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 0.35rem 0.65rem; font-size: 0.73rem;">
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="color: var(--text-muted); font-weight: 700;">Slot #${idx + 1}:</span>
          <strong style="color: #fff;">${s.symbol}</strong>
          ${badgeHtml}
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.7rem; display: flex; align-items: center; gap: 0.4rem;">
          <span style="color: #00f0ff;">Entry: $${entryTarget.toFixed(4)}</span> | 
          <span style="color: #ef4444; font-weight: 700;">SL: $${stopLossTarget.toFixed(4)}</span> | 
          <span style="color: #10b981;">TP: $${exitTarget.toFixed(4)}</span>
        </div>
      </div>
    `;
  }).join("");
}

// VERSION 72: RENDER WEEKLY & MONTHLY PERFORMANCE SUMMARY CARDS
function renderSummaryCard(summaryData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!summaryData) {
    container.innerHTML = `<div class="text-muted text-center" style="grid-column: span 2; padding: 0.75rem;">No summary data available.</div>`;
    return;
  }

  const god = summaryData["👑 SUPREME GOD AI BOT"] || { wins: 0, losses: 0, total_profit: 0, total_loss: 0, net_pnl: 0, profit_pct: 0 };
  const groupC = summaryData["⚡ GROUP C OB BOT"] || { wins: 0, losses: 0, total_profit: 0, total_loss: 0, net_pnl: 0, profit_pct: 0 };

  const buildBotCardHtml = (title, icon, color, data) => {
    const netClass = data.net_pnl >= 0 ? "color: #10b981;" : "color: #ef4444;";
    const badgeClass = data.net_pnl >= 0 ? "up" : "down";

    return `
      <div style="background: rgba(0,0,0,0.35); border-radius: 10px; border: 1px solid ${color}40; padding: 0.85rem; box-sizing: border-box; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.4rem;">
          <span style="font-weight: 800; color: ${color}; font-size: 0.82rem;"><i class="${icon}"></i> ${title}</span>
          <span class="change-badge ${badgeClass}" style="font-size: 0.75rem; font-weight: 800;">
            ${data.net_pnl >= 0 ? '+' : ''}$${data.net_pnl.toFixed(2)} (${data.profit_pct >= 0 ? '+' : ''}${data.profit_pct.toFixed(2)}%)
          </span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; text-align: center; font-size: 0.72rem; margin-bottom: 0.5rem;">
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Wins</div>
            <strong style="color: #10b981; font-size: 0.95rem;">${data.wins}</strong>
          </div>
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Losses</div>
            <strong style="color: #ef4444; font-size: 0.95rem;">${data.losses}</strong>
          </div>
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Total Profit ($)</div>
            <strong style="color: #10b981; font-size: 0.85rem;">+$${data.total_profit.toFixed(2)}</strong>
          </div>
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Total Loss ($)</div>
            <strong style="color: #ef4444; font-size: 0.85rem;">-$${data.total_loss.toFixed(2)}</strong>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); border-radius: 6px; padding: 0.4rem 0.6rem; font-size: 0.72rem;">
          <span style="color: var(--text-muted); font-weight: 700;">Net Return PnL (%):</span>
          <strong style="${netClass} font-family: var(--font-mono); font-size: 0.85rem;">
            ${data.net_pnl >= 0 ? '+' : ''}$${data.net_pnl.toFixed(2)} (${data.profit_pct >= 0 ? '+' : ''}${data.profit_pct.toFixed(2)}%)
          </strong>
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    ${buildBotCardHtml("👑 SUPREME GOD AI BOT", "fa-solid fa-crown", "#f0b90b", god)}
    ${buildBotCardHtml("⚡ GROUP C OB BOT", "fa-solid fa-bolt", "#00f0ff", groupC)}
  `;
}
// VERSION 72: RENDER EVERYDAY HISTORICAL PERFORMANCE SUMMARY LEDGER (MAX 7 DATES)
function renderEverydayLedger(dailyLedger) {
  const container = document.getElementById("everydayLedgerContainer");
  if (!container) return;

  if (!dailyLedger || dailyLedger.length === 0) {
    container.innerHTML = `<div class="text-muted text-center" style="padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">No closed exit transactions logged in history yet.</div>`;
    return;
  }

  // Capped at max 7 dates
  const max7Ledger = dailyLedger.slice(0, 7);

  container.innerHTML = max7Ledger.map(item => {
    const god = item.god_ai || { wins: 0, losses: 0, pnl: 0, pnl_pct: 0, symbols: [] };
    const groupC = item.group_c || { wins: 0, losses: 0, pnl: 0, pnl_pct: 0, symbols: [] };

    const godClass = god.pnl >= 0 ? "color: #10b981;" : "color: #ef4444;";
    const groupCClass = groupC.pnl >= 0 ? "color: #10b981;" : "color: #ef4444;";

    return `
      <div style="background: rgba(0,0,0,0.35); border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.3); padding: 0.9rem; width: 100%; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem; margin-bottom: 0.75rem;">
          <div style="font-weight: 900; color: #a855f7; font-size: 0.9rem;">
            <i class="fa-solid fa-calendar-day"></i> SUMMARY LEDGER DATE: <strong style="color: #fff; font-family: var(--font-mono); font-size: 0.95rem;">${item.date}</strong>
          </div>
          <div style="font-size: 0.73rem; color: var(--text-muted);">
            Closed Exit Positions Audit
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <!-- GOD AI FOR THIS DATE -->
          <div style="background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(240, 185, 11, 0.3); padding: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span style="font-weight: 800; color: #f0b90b; font-size: 0.82rem;"><i class="fa-solid fa-crown"></i> 👑 SUPREME GOD AI BOT</span>
              <span class="change-badge ${god.pnl >= 0 ? 'up' : 'down'}" style="font-size: 0.75rem; font-weight: 800;">
                ${god.pnl >= 0 ? '+' : ''}$${god.pnl.toFixed(2)} (${god.pnl_pct >= 0 ? '+' : ''}${god.pnl_pct.toFixed(1)}%)
              </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; text-align: center; font-size: 0.73rem; margin-bottom: 0.4rem;">
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Wins</div>
                <strong style="color: #10b981; font-size: 0.95rem;">${god.wins}</strong>
              </div>
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Loss</div>
                <strong style="color: #ef4444; font-size: 0.95rem;">${god.losses}</strong>
              </div>
              <div style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">PnL ($)</div>
                <strong style="${godClass} font-size: 0.9rem;">${god.pnl >= 0 ? '+' : ''}$${god.pnl.toFixed(2)}</strong>
              </div>
              <div style="background: rgba(240, 185, 11, 0.1); border: 1px solid rgba(240, 185, 11, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Return</div>
                <strong style="color: #f0b90b; font-size: 0.9rem;">${god.pnl_pct >= 0 ? '+' : ''}${god.pnl_pct.toFixed(2)}%</strong>
              </div>
            </div>
            ${god.symbols && god.symbols.length > 0 ? `
              <div style="font-size: 0.68rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <strong style="color: #00f0ff;">Closed Trades:</strong> ${god.symbols.join(', ')}
              </div>
            ` : ''}
          </div>

          <!-- GROUP C FOR THIS DATE -->
          <div style="background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(0, 240, 255, 0.3); padding: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span style="font-weight: 800; color: #00f0ff; font-size: 0.82rem;"><i class="fa-solid fa-bolt"></i> ⚡ GROUP C OB BOT</span>
              <span class="change-badge ${groupC.pnl >= 0 ? 'up' : 'down'}" style="font-size: 0.75rem; font-weight: 800;">
                ${groupC.pnl >= 0 ? '+' : ''}$${groupC.pnl.toFixed(2)} (${groupC.pnl_pct >= 0 ? '+' : ''}${groupC.pnl_pct.toFixed(1)}%)
              </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; text-align: center; font-size: 0.73rem; margin-bottom: 0.4rem;">
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Wins</div>
                <strong style="color: #10b981; font-size: 0.95rem;">${groupC.wins}</strong>
              </div>
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Loss</div>
                <strong style="color: #ef4444; font-size: 0.95rem;">${groupC.losses}</strong>
              </div>
              <div style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">PnL ($)</div>
                <strong style="${groupCClass} font-size: 0.9rem;">${groupC.pnl >= 0 ? '+' : ''}$${groupC.pnl.toFixed(2)}</strong>
              </div>
              <div style="background: rgba(240, 185, 11, 0.1); border: 1px solid rgba(240, 185, 11, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Return</div>
                <strong style="color: #f0b90b; font-size: 0.9rem;">${groupC.pnl_pct >= 0 ? '+' : ''}${groupC.pnl_pct.toFixed(2)}%</strong>
              </div>
            </div>
            ${groupC.symbols && groupC.symbols.length > 0 ? `
              <div style="font-size: 0.68rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <strong style="color: #00f0ff;">Closed Trades:</strong> ${groupC.symbols.join(', ')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}
