// Autonomous Robo Trade Arena — Complete Bulletproof Data Renderer (V99.5)

function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = String(val !== undefined && val !== null ? val : "");
}

function findStats(data, keyword) {
  if (!data || typeof data !== "object") return {};
  const kw = String(keyword).toUpperCase();
  for (let k in data) {
    if (k.toUpperCase().includes(kw)) return data[k] || {};
  }
  return {};
}

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
        window.updateRoboTradeModule();
      }
    } catch (err) {
      console.error("Reset Robo Trade Error:", err);
      alert("Error resetting Robo Trade Arena: " + err);
    }
  };

  const refreshBtn = document.getElementById("refreshRoboTradeBtn");
  if (refreshBtn) {
    refreshBtn.onclick = () => window.updateRoboTradeModule();
  }

  const resetBtn = document.getElementById("resetRoboTradeBtn");
  if (resetBtn) {
    resetBtn.onclick = handleResetClick;
  }

  const sidebarResetBtn = document.getElementById("sidebarResetRoboBtn");
  if (sidebarResetBtn) {
    sidebarResetBtn.onclick = handleResetClick;
  }

  window.updateRoboTradeModule();

  if (!window.roboTradeTimerInterval) {
    window.roboTradeTimerInterval = setInterval(() => {
      const roboTab = document.getElementById("tab-robo-trade");
      if (roboTab && !roboTab.classList.contains("hidden")) {
        window.updateRoboTradeModule();
      }
    }, 3000);
  }
};

window.updateRoboTradeModule = async function () {
  try {
    const [hRes, sRes, stRes] = await Promise.all([
      fetch("/api/paper/holdings").then(r => r.json()).catch(e => ({ holdings: [] })),
      fetch("/api/robo/schedules").then(r => r.json()).catch(e => ({ schedules: [] })),
      fetch("/api/robo/trade_stats").then(r => r.json()).catch(e => ({ stats: {} }))
    ]);

    const holdings = (hRes && hRes.holdings) || [];
    const schedules = (sRes && sRes.schedules) || [];
    const statsData = (stRes && stRes.stats) || {};
    const todayDate = (stRes && stRes.today_date) || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

    // 0. Update Date
    setTxt("roboTodayDateText", todayDate);

    // 1. Render Cumulative Commission Fees (Global)
    const commSummary = (stRes && stRes.commission_summary) || {};
    const totComm = commSummary.total || {};
    setTxt("commTodayText", "$" + (Number(totComm.today) || 0).toFixed(4));
    setTxt("commWkText", "$" + (Number(totComm.weekly) || 0).toFixed(4));
    setTxt("commMoText", "$" + (Number(totComm.monthly) || 0).toFixed(4));
    setTxt("commTotalText", "$" + (Number(totComm.lifetime) || 0).toFixed(4));

    // 2. SUPREME GOD AI BOT STATS
    const godStats = findStats(statsData, "GOD");
    setTxt("godTodayWins", Number(godStats.today_wins) || 0);
    setTxt("godTodayLosses", Number(godStats.today_losses) || 0);
    setTxt("godTodayProfit", "+$" + (Number(godStats.today_profit) || 0).toFixed(2));
    setTxt("godTodayLossIncurred", "-$" + (Number(godStats.today_loss) || 0).toFixed(2));
    setTxt("godTodayComm", "-$" + (Number(godStats.today_commission_fee) || 0).toFixed(4));

    const godTodayNet = Number(godStats.today_pnl) || 0;
    const godTodayNetEl = document.getElementById("godTodayPnL");
    if (godTodayNetEl) {
      godTodayNetEl.innerText = (godTodayNet >= 0 ? "+" : "") + "$" + godTodayNet.toFixed(2);
      godTodayNetEl.style.color = godTodayNet >= 0 ? "#10b981" : "#ef4444";
    }

    setTxt("godCumProfit", "+$" + (Number(godStats.total_profit) || 0).toFixed(2));
    setTxt("godCumLoss", "-$" + (Number(godStats.total_loss) || 0).toFixed(2));
    setTxt("godCumComm", "-$" + (Number(godStats.total_commission_fee) || 0).toFixed(4));
    const godCumNet = Number(godStats.total_pnl) || 0;
    const godCumNetEl = document.getElementById("godCumNetPnL");
    if (godCumNetEl) {
      godCumNetEl.innerText = (godCumNet >= 0 ? "+" : "") + "$" + godCumNet.toFixed(2);
      godCumNetEl.style.color = godCumNet >= 0 ? "#10b981" : "#ef4444";
    }

    // 3. GROUP C OB BOT STATS
    const cStats = findStats(statsData, "GROUP C") || findStats(statsData, "C BOT");
    setTxt("groupCTodayWins", Number(cStats.today_wins) || 0);
    setTxt("groupCTodayLosses", Number(cStats.today_losses) || 0);
    setTxt("groupCTodayProfit", "+$" + (Number(cStats.today_profit) || 0).toFixed(2));
    setTxt("groupCTodayLossIncurred", "-$" + (Number(cStats.today_loss) || 0).toFixed(2));
    setTxt("groupCTodayComm", "-$" + (Number(cStats.today_commission_fee) || 0).toFixed(4));

    const cTodayNet = Number(cStats.today_pnl) || 0;
    const cTodayNetEl = document.getElementById("groupCTodayPnL");
    if (cTodayNetEl) {
      cTodayNetEl.innerText = (cTodayNet >= 0 ? "+" : "") + "$" + cTodayNet.toFixed(2);
      cTodayNetEl.style.color = cTodayNet >= 0 ? "#10b981" : "#ef4444";
    }

    setTxt("groupCCumProfit", "+$" + (Number(cStats.total_profit) || 0).toFixed(2));
    setTxt("groupCCumLoss", "-$" + (Number(cStats.total_loss) || 0).toFixed(2));
    setTxt("groupCCumComm", "-$" + (Number(cStats.total_commission_fee) || 0).toFixed(4));
    const cCumNet = Number(cStats.total_pnl) || 0;
    const cCumNetEl = document.getElementById("groupCCumNetPnL");
    if (cCumNetEl) {
      cCumNetEl.innerText = (cCumNet >= 0 ? "+" : "") + "$" + cCumNet.toFixed(2);
      cCumNetEl.style.color = cCumNet >= 0 ? "#10b981" : "#ef4444";
    }

    // 4. TIMER COUNTDOWN
    const nextSec = sRes && sRes.next_update_in_seconds !== undefined ? sRes.next_update_in_seconds : 120;
    window.roboTradeNextSec = nextSec;
    const formatTimer = (sec) => {
      const m = Math.floor(sec / 60).toString().padStart(2, "0");
      const s = (sec % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    };
    const tStr = formatTimer(nextSec);
    setTxt("godSchedTimerText", tStr);
    setTxt("groupCSchedTimerText", tStr);

    if (!window.roboTradeCountdownTicker) {
      window.roboTradeCountdownTicker = setInterval(() => {
        if (window.roboTradeNextSec !== undefined && window.roboTradeNextSec > 0) {
          window.roboTradeNextSec -= 1;
          const str = formatTimer(window.roboTradeNextSec);
          setTxt("godSchedTimerText", str);
          setTxt("groupCSchedTimerText", str);
        } else if (window.roboTradeNextSec === 0) {
          window.roboTradeNextSec = 120;
          const roboTab = document.getElementById("tab-robo-trade");
          if (roboTab && !roboTab.classList.contains("hidden")) {
            window.updateRoboTradeModule();
          }
        }
      }, 1000);
    }

    // 5. RENDER HOLDINGS & SCHEDULES (Isolated Error Safety)
    try { renderBotHoldingsTable("GOD", holdings, "godHoldingsTableBody"); } catch(e) { console.error("GOD Holdings error:", e); }
    try { renderBotHoldingsTable("GROUP C", holdings, "groupCHoldingsTableBody"); } catch(e) { console.error("Group C Holdings error:", e); }

    try { renderBotSchedulesList("GOD", schedules, "godScheduleList"); } catch(e) { console.error("GOD Schedule error:", e); }
    try { renderBotSchedulesList("GROUP C", schedules, "groupCScheduleList"); } catch(e) { console.error("Group C Schedule error:", e); }

    // 6. RENDER SUMMARY CARDS & LEDGER (Isolated Error Safety)
    try { renderSummaryCard((stRes && stRes.weekly_summary), "weeklySummaryContainer"); } catch(e) { console.error("Weekly summary error:", e); }
    try { renderSummaryCard((stRes && stRes.monthly_summary), "monthlySummaryContainer"); } catch(e) { console.error("Monthly summary error:", e); }
    try { renderEverydayLedger((stRes && stRes.daily_ledger) || []); } catch(e) { console.error("Everyday ledger error:", e); }

  } catch (err) {
    console.error("[Robo Trade Module Update Error]", err);
  }
};

function renderBotHoldingsTable(keyword, holdings, targetElId) {
  const tbody = document.getElementById(targetElId);
  if (!tbody) return;

  const kw = String(keyword).toUpperCase();
  const botHoldings = (holdings || []).filter(h => {
    if (!h || !h.participant) return false;
    return String(h.participant).toUpperCase().includes(kw);
  });

  if (botHoldings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center" style="padding: 0.75rem;">No active open holdings currently.</td></tr>`;
    return;
  }

  tbody.innerHTML = botHoldings.map(h => {
    const entry = Number(h.entry_price) || 0;
    const amount = Number(h.amount) || 1;
    const liveTicker = (window.allTickers || []).find(t => t && t.symbol === h.symbol);
    const livePrice = liveTicker ? Number(liveTicker.price) || entry : (Number(h.live_price) || entry);
    const stopLossPrice = entry * 0.97; // -3% Stop Loss
    const targetPrice = entry * 1.05;  // +5% Take Profit

    const pnl = liveTicker ? ((livePrice - entry) * amount) : (h.unrealized_pnl !== undefined ? Number(h.unrealized_pnl) : ((livePrice - entry) * amount));
    const pnlClass = pnl >= 0 ? "color: #10b981; font-weight: 800;" : "color: #ef4444; font-weight: 800;";

    return `
      <tr>
        <td style="font-weight: 800; color: #fff;">${h.symbol || ''}</td>
        <td>$${entry.toFixed(4)}</td>
        <td style="color: #ef4444; font-weight: 800;">$${stopLossPrice.toFixed(4)}</td>
        <td style="color: #10b981; font-weight: 800;">$${targetPrice.toFixed(4)}</td>
        <td style="font-family: var(--font-mono); font-weight: 800; color: #00f0ff;">$${livePrice.toFixed(4)}</td>
        <td style="${pnlClass}">${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}</td>
      </tr>
    `;
  }).join("");
}

function renderBotSchedulesList(keyword, schedules, targetElId) {
  const container = document.getElementById(targetElId);
  if (!container) return;

  const kw = String(keyword).toUpperCase();
  const botScheds = (schedules || []).filter(s => {
    if (!s || s.status !== 'PENDING' || !s.participant) return false;
    return String(s.participant).toUpperCase().includes(kw);
  });

  if (botScheds.length === 0) {
    container.innerHTML = `<div class="text-muted text-center" style="font-size: 0.75rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px;">Curating 5-coin schedule entry plan...</div>`;
    return;
  }

  container.innerHTML = botScheds.map((s, idx) => {
    const entryTarget = Number(s.entry_price_target) || 0;
    const stopLossTarget = Number(s.stop_loss_target) || (entryTarget * 0.97);
    const exitTarget = Number(s.exit_price_target) || (entryTarget * 1.05);
    const scoreVal = Number(s.confluence_score) || 0;
    const scoreStr = scoreVal ? ` (${scoreVal.toFixed(1)} Pts)` : "";
    const isGradeS = s.tier && String(s.tier).toUpperCase().includes("GRADE S");

    const badgeHtml = isGradeS 
      ? `<span style="background: rgba(240, 185, 11, 0.25); color: #f0b90b; border: 1px solid #f0b90b; font-weight: 900; font-size: 0.63rem; padding: 0.1rem 0.4rem; border-radius: 4px;"><i class="fa-solid fa-crown"></i> GRADE S (9.5+ Pts)</span>`
      : `<span style="background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); font-weight: 700; font-size: 0.63rem; padding: 0.1rem 0.4rem; border-radius: 4px;">Top #${idx + 1}${scoreStr}</span>`;

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.35); border: 1px solid ${isGradeS ? 'rgba(240, 185, 11, 0.5)' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 0.35rem 0.65rem; font-size: 0.73rem;">
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="color: var(--text-muted); font-weight: 700;">Slot #${idx + 1}:</span>
          <strong style="color: #fff;">${s.symbol || ''}</strong>
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

function renderSummaryCard(summaryData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!summaryData || typeof summaryData !== "object") {
    container.innerHTML = `<div class="text-muted text-center" style="grid-column: span 2; padding: 0.75rem;">No summary data available.</div>`;
    return;
  }

  function findKey(data, kw) {
    if (!data) return { wins: 0, losses: 0, total_profit: 0, total_loss: 0, total_commission_fee: 0, net_pnl: 0, profit_pct: 0 };
    const uKw = String(kw).toUpperCase();
    for (let k in data) {
      if (k.toUpperCase().includes(uKw)) return data[k] || {};
    }
    return { wins: 0, losses: 0, total_profit: 0, total_loss: 0, total_commission_fee: 0, net_pnl: 0, profit_pct: 0 };
  }

  const god = findKey(summaryData, "GOD");
  const groupC = findKey(summaryData, "GROUP C");

  const buildBotCardHtml = (title, icon, color, data) => {
    const wins = Number(data.wins) || 0;
    const losses = Number(data.losses) || 0;
    const totalProfit = Number(data.total_profit) || 0;
    const totalLoss = Number(data.total_loss) || 0;
    const commFee = Number(data.total_commission_fee) || Number(data.comm_fee) || 0;
    const netPnl = Number(data.net_pnl) || 0;
    const profitPct = Number(data.profit_pct) || 0;

    const netClass = netPnl >= 0 ? "color: #10b981;" : "color: #ef4444;";
    const badgeClass = netPnl >= 0 ? "up" : "down";

    return `
      <div style="background: rgba(0,0,0,0.35); border-radius: 10px; border: 1px solid ${color}40; padding: 0.85rem; box-sizing: border-box; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.4rem;">
          <span style="font-weight: 800; color: ${color}; font-size: 0.82rem;"><i class="${icon}"></i> ${title}</span>
          <span class="change-badge ${badgeClass}" style="font-size: 0.75rem; font-weight: 800;">
            ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)} (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)
          </span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; text-align: center; font-size: 0.72rem; margin-bottom: 0.5rem;">
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Wins / Loss</div>
            <strong style="color: #fff; font-size: 0.85rem;"><span style="color: #10b981;">${wins}W</span> / <span style="color: #ef4444;">${losses}L</span></strong>
          </div>
          <div style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Comm. Fee ($)</div>
            <strong style="color: #a855f7; font-size: 0.85rem;">-$${commFee.toFixed(4)}</strong>
          </div>
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Total Profit ($)</div>
            <strong style="color: #10b981; font-size: 0.85rem;">+$${totalProfit.toFixed(2)}</strong>
          </div>
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 0.35rem;">
            <div style="color: var(--text-muted); font-size: 0.65rem;">Total Loss ($)</div>
            <strong style="color: #ef4444; font-size: 0.85rem;">-$${totalLoss.toFixed(2)}</strong>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); border-radius: 6px; padding: 0.4rem 0.6rem; font-size: 0.72rem;">
          <span style="color: var(--text-muted); font-weight: 700;">Net Return PnL (%):</span>
          <strong style="${netClass} font-family: var(--font-mono); font-size: 0.85rem;">
            ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)} (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)
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

function renderEverydayLedger(dailyLedger) {
  const container = document.getElementById("everydayLedgerContainer");
  if (!container) return;

  if (!dailyLedger || !Array.isArray(dailyLedger) || dailyLedger.length === 0) {
    container.innerHTML = `<div class="text-muted text-center" style="padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">No closed exit transactions logged in history yet.</div>`;
    return;
  }

  const max7Ledger = dailyLedger.slice(0, 7);

  container.innerHTML = max7Ledger.map(item => {
    if (!item) return "";
    const god = item.god_ai || { wins: 0, losses: 0, pnl: 0, pnl_pct: 0, symbols: [] };
    const groupC = item.group_c || { wins: 0, losses: 0, pnl: 0, pnl_pct: 0, symbols: [] };

    const godPnl = Number(god.pnl) || 0;
    const godPct = Number(god.pnl_pct) || 0;
    const groupCPnl = Number(groupC.pnl) || 0;
    const groupCPct = Number(groupC.pnl_pct) || 0;

    const godClass = godPnl >= 0 ? "color: #10b981;" : "color: #ef4444;";
    const groupCClass = groupCPnl >= 0 ? "color: #10b981;" : "color: #ef4444;";

    return `
      <div style="background: rgba(0,0,0,0.35); border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.3); padding: 0.9rem; width: 100%; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem; margin-bottom: 0.75rem;">
          <div style="font-weight: 900; color: #a855f7; font-size: 0.9rem;">
            <i class="fa-solid fa-calendar-day"></i> SUMMARY LEDGER DATE: <strong style="color: #fff; font-family: var(--font-mono); font-size: 0.95rem;">${item.date || ''}</strong>
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
              <span class="change-badge ${godPnl >= 0 ? 'up' : 'down'}" style="font-size: 0.75rem; font-weight: 800;">
                ${godPnl >= 0 ? '+' : ''}$${godPnl.toFixed(2)} (${godPct >= 0 ? '+' : ''}${godPct.toFixed(1)}%)
              </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; text-align: center; font-size: 0.73rem; margin-bottom: 0.4rem;">
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Wins</div>
                <strong style="color: #10b981; font-size: 0.95rem;">${god.wins || 0}</strong>
              </div>
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Loss</div>
                <strong style="color: #ef4444; font-size: 0.95rem;">${god.losses || 0}</strong>
              </div>
              <div style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">PnL ($)</div>
                <strong style="${godClass} font-size: 0.9rem;">${godPnl >= 0 ? '+' : ''}$${godPnl.toFixed(2)}</strong>
              </div>
              <div style="background: rgba(240, 185, 11, 0.1); border: 1px solid rgba(240, 185, 11, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Return</div>
                <strong style="color: #f0b90b; font-size: 0.9rem;">${godPct >= 0 ? '+' : ''}${godPct.toFixed(2)}%</strong>
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
              <span class="change-badge ${groupCPnl >= 0 ? 'up' : 'down'}" style="font-size: 0.75rem; font-weight: 800;">
                ${groupCPnl >= 0 ? '+' : ''}$${groupCPnl.toFixed(2)} (${groupCPct >= 0 ? '+' : ''}${groupCPct.toFixed(1)}%)
              </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; text-align: center; font-size: 0.73rem; margin-bottom: 0.4rem;">
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Wins</div>
                <strong style="color: #10b981; font-size: 0.95rem;">${groupC.wins || 0}</strong>
              </div>
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Loss</div>
                <strong style="color: #ef4444; font-size: 0.95rem;">${groupC.losses || 0}</strong>
              </div>
              <div style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">PnL ($)</div>
                <strong style="${groupCClass} font-size: 0.9rem;">${groupCPnl >= 0 ? '+' : ''}$${groupCPnl.toFixed(2)}</strong>
              </div>
              <div style="background: rgba(240, 185, 11, 0.1); border: 1px solid rgba(240, 185, 11, 0.3); border-radius: 6px; padding: 0.3rem;">
                <div style="color: var(--text-muted); font-size: 0.65rem;">Return</div>
                <strong style="color: #f0b90b; font-size: 0.9rem;">${groupCPct >= 0 ? '+' : ''}${groupCPct.toFixed(2)}%</strong>
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

// Auto-trigger immediately on load
if (typeof window.updateRoboTradeModule === "function") {
  window.updateRoboTradeModule();
}
