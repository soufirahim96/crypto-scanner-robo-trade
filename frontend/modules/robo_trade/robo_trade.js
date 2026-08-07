// ============================================================
// Autonomous Robo Trade Arena — V100 Bulletproof Renderer
// Simple, direct, no duplicate code, no fragile matching
// ============================================================

// ─── UTILITY ────────────────────────────────────────────────
function rtSetTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = String(val !== undefined && val !== null ? val : "");
}

function rtFindKey(obj, keyword) {
  if (!obj || typeof obj !== "object") return null;
  const kw = keyword.toUpperCase();
  for (const k of Object.keys(obj)) {
    if (k.toUpperCase().includes(kw)) return obj[k];
  }
  return null;
}

// ─── RENDER HOLDINGS TABLE ─────────────────────────────────
function rtRenderHoldings(keyword, holdings, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const kw = keyword.toUpperCase();
  const filtered = (holdings || []).filter(h => h && h.participant && String(h.participant).toUpperCase().includes(kw));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:0.75rem;">No active open holdings currently.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(h => {
    const entry = Number(h.entry_price) || 0;
    const amount = Number(h.amount) || 1;
    const ticker = (window.allTickers || []).find(t => t && t.symbol === h.symbol);
    const live = ticker ? (Number(ticker.price) || entry) : entry;
    const sl = entry * 0.97;
    const tp = entry * 1.05;
    const pnl = (live - entry) * amount;
    const pnlStyle = pnl >= 0 ? "color:#10b981;font-weight:800;" : "color:#ef4444;font-weight:800;";
    const decimals = entry < 0.1 ? 5 : entry < 10 ? 4 : 2;
    return `<tr>
      <td style="font-weight:800;color:#fff;">${h.symbol || ""}</td>
      <td>$${entry.toFixed(decimals)}</td>
      <td style="color:#ef4444;font-weight:800;">$${sl.toFixed(decimals)}</td>
      <td style="color:#10b981;font-weight:800;">$${tp.toFixed(decimals)}</td>
      <td style="font-family:var(--font-mono);font-weight:800;color:#00f0ff;">$${live.toFixed(decimals)}</td>
      <td style="${pnlStyle}">${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}</td>
    </tr>`;
  }).join("");
}

// ─── RENDER SCHEDULE LIST ──────────────────────────────────
function rtRenderSchedules(keyword, schedules, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const kw = keyword.toUpperCase();
  const filtered = (schedules || []).filter(s =>
    s && s.status === "PENDING" && s.participant && String(s.participant).toUpperCase().includes(kw)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#64748b;font-size:0.75rem;padding:0.5rem;background:rgba(0,0,0,0.2);border-radius:6px;">Curating 5-coin schedule entry plan...</div>`;
    return;
  }

  container.innerHTML = filtered.map((s, idx) => {
    const entry = Number(s.entry_price_target) || 0;
    const sl = Number(s.stop_loss_target) || (entry * 0.97);
    const tp = Number(s.exit_price_target) || (entry * 1.05);
    const score = Number(s.confluence_score) || 0;
    const isS = s.tier && String(s.tier).toUpperCase().includes("GRADE S");
    const tierHtml = isS
      ? `<span style="background:rgba(240,185,11,0.25);color:#f0b90b;border:1px solid #f0b90b;font-weight:900;font-size:0.63rem;padding:0.1rem 0.4rem;border-radius:4px;"><i class="fa-solid fa-crown"></i> GRADE S</span>`
      : `<span style="background:rgba(0,240,255,0.15);color:#00f0ff;border:1px solid rgba(0,240,255,0.3);font-weight:700;font-size:0.63rem;padding:0.1rem 0.4rem;border-radius:4px;">Top #${idx + 1} (${score.toFixed(1)} Pts)</span>`;
    const decimals = entry < 0.1 ? 5 : entry < 10 ? 4 : 2;
    return `<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.35);border:1px solid ${isS ? 'rgba(240,185,11,0.5)' : 'rgba(255,255,255,0.08)'};border-radius:6px;padding:0.35rem 0.65rem;font-size:0.73rem;">
      <div style="display:flex;align-items:center;gap:0.4rem;">
        <span style="color:#64748b;font-weight:700;">Slot #${idx + 1}:</span>
        <strong style="color:#fff;">${s.symbol || ""}</strong>
        ${tierHtml}
      </div>
      <div style="font-family:var(--font-mono);font-size:0.7rem;display:flex;align-items:center;gap:0.4rem;">
        <span style="color:#00f0ff;">Entry: $${entry.toFixed(decimals)}</span> |
        <span style="color:#ef4444;font-weight:700;">SL: $${sl.toFixed(decimals)}</span> |
        <span style="color:#10b981;">TP: $${tp.toFixed(decimals)}</span>
      </div>
    </div>`;
  }).join("");
}

// ─── RENDER SUMMARY CARD (Weekly/Monthly) ─────────────────
function rtRenderSummaryCard(summaryData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const godData = rtFindKey(summaryData, "GOD") || {};
  const groupCData = rtFindKey(summaryData, "GROUP C") || {};

  function buildCard(title, icon, color, d) {
    const wins = Number(d.wins) || 0;
    const losses = Number(d.losses) || 0;
    const profit = Number(d.total_profit) || 0;
    const loss = Number(d.total_loss) || 0;
    const comm = Number(d.total_commission_fee) || Number(d.comm_fee) || 0;
    const pnl = Number(d.net_pnl) || 0;
    const pct = Number(d.profit_pct) || 0;
    const pnlStyle = pnl >= 0 ? "color:#10b981;" : "color:#ef4444;";
    return `<div style="background:rgba(0,0,0,0.35);border-radius:10px;border:1px solid ${color}40;padding:0.85rem;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:0.4rem;">
        <span style="font-weight:800;color:${color};font-size:0.82rem;"><i class="${icon}"></i> ${title}</span>
        <span class="change-badge ${pnl >= 0 ? 'up' : 'down'}" style="font-size:0.75rem;font-weight:800;">${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.4rem;text-align:center;font-size:0.72rem;margin-bottom:0.5rem;">
        <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:0.35rem;">
          <div style="color:#64748b;font-size:0.65rem;">Wins / Loss</div>
          <strong><span style="color:#10b981;">${wins}W</span> / <span style="color:#ef4444;">${losses}L</span></strong>
        </div>
        <div style="background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.3);border-radius:6px;padding:0.35rem;">
          <div style="color:#64748b;font-size:0.65rem;">Comm. Fee ($)</div>
          <strong style="color:#a855f7;">-$${comm.toFixed(4)}</strong>
        </div>
        <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:0.35rem;">
          <div style="color:#64748b;font-size:0.65rem;">Total Profit</div>
          <strong style="color:#10b981;">+$${profit.toFixed(2)}</strong>
        </div>
        <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:0.35rem;">
          <div style="color:#64748b;font-size:0.65rem;">Total Loss</div>
          <strong style="color:#ef4444;">-$${loss.toFixed(2)}</strong>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.4);border-radius:6px;padding:0.4rem 0.6rem;font-size:0.72rem;">
        <span style="color:#64748b;font-weight:700;">Net Return PnL (%):</span>
        <strong style="${pnlStyle}font-family:var(--font-mono);font-size:0.85rem;">${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)</strong>
      </div>
    </div>`;
  }

  if (!summaryData || typeof summaryData !== "object" || Object.keys(summaryData).length === 0) {
    container.innerHTML = `<div style="grid-column:span 2;text-align:center;color:#64748b;padding:0.75rem;">No summary data available yet.</div>`;
    return;
  }

  container.innerHTML =
    buildCard("👑 SUPREME GOD AI BOT", "fa-solid fa-crown", "#f0b90b", godData) +
    buildCard("⚡ GROUP C OB BOT", "fa-solid fa-bolt", "#00f0ff", groupCData);
}

// ─── RENDER EVERYDAY LEDGER ────────────────────────────────
function rtRenderLedger(dailyLedger) {
  const container = document.getElementById("everydayLedgerContainer");
  if (!container) return;

  if (!Array.isArray(dailyLedger) || dailyLedger.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#64748b;padding:1rem;background:rgba(0,0,0,0.2);border-radius:8px;">No closed exit transactions logged yet.</div>`;
    return;
  }

  container.innerHTML = dailyLedger.slice(0, 7).map(item => {
    if (!item) return "";
    const god = item.god_ai || {};
    const gc = item.group_c || {};
    const godPnl = Number(god.pnl) || 0;
    const godPct = Number(god.pnl_pct) || 0;
    const gcPnl = Number(gc.pnl) || 0;
    const gcPct = Number(gc.pnl_pct) || 0;

    function miniCard(label, color, icon, wins, losses, pnl, pct, comm, profit, loss, symbols) {
      const pnlStyle = pnl >= 0 ? "color:#10b981;" : "color:#ef4444;";
      const symStr = Array.isArray(symbols) && symbols.length > 0 ? symbols.join(", ") : "—";
      return `<div style="background:rgba(0,0,0,0.25);border-radius:8px;border:1px solid ${color}40;padding:0.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
          <span style="font-weight:800;color:${color};font-size:0.82rem;"><i class="${icon}"></i> ${label}</span>
          <span class="change-badge ${pnl >= 0 ? 'up' : 'down'}" style="font-size:0.75rem;font-weight:800;">${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.35rem;text-align:center;font-size:0.72rem;margin-bottom:0.4rem;">
          <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:0.3rem;">
            <div style="color:#64748b;font-size:0.65rem;">Wins</div><strong style="color:#10b981;">${wins || 0}</strong>
          </div>
          <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:0.3rem;">
            <div style="color:#64748b;font-size:0.65rem;">Loss</div><strong style="color:#ef4444;">${losses || 0}</strong>
          </div>
          <div style="background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.3);border-radius:6px;padding:0.3rem;">
            <div style="color:#64748b;font-size:0.65rem;">PnL ($)</div><strong style="${pnlStyle}">${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}</strong>
          </div>
          <div style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:6px;padding:0.3rem;">
            <div style="color:#64748b;font-size:0.65rem;">Comm</div><strong style="color:#a855f7;">$${(Number(comm) || 0).toFixed(3)}</strong>
          </div>
        </div>
        <div style="font-size:0.68rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          <strong style="color:#00f0ff;">Closed:</strong> ${symStr}
        </div>
      </div>`;
    }

    return `<div style="background:rgba(0,0,0,0.35);border-radius:12px;border:1px solid rgba(168,85,247,0.3);padding:0.9rem;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.4rem;margin-bottom:0.75rem;">
        <div style="font-weight:900;color:#a855f7;font-size:0.9rem;"><i class="fa-solid fa-calendar-day"></i> DATE: <strong style="color:#fff;font-family:var(--font-mono);">${item.date || ""}</strong></div>
        <div style="font-size:0.73rem;color:#64748b;">Closed Exit Positions Audit</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        ${miniCard("👑 SUPREME GOD AI BOT", "#f0b90b", "fa-solid fa-crown", god.wins, god.losses, godPnl, godPct, god.comm_fee, god.profit, god.loss, god.symbols)}
        ${miniCard("⚡ GROUP C OB BOT", "#00f0ff", "fa-solid fa-bolt", gc.wins, gc.losses, gcPnl, gcPct, gc.comm_fee, gc.profit, gc.loss, gc.symbols)}
      </div>
    </div>`;
  }).join("");
}

// ─── MAIN UPDATE FUNCTION ─────────────────────────────────
window.updateRoboTradeModule = async function () {
  // Prevent concurrent calls
  if (window._roboUpdating) return;
  window._roboUpdating = true;

  try {
    const [hRes, sRes, stRes] = await Promise.all([
      fetch("/api/paper/holdings").then(r => r.ok ? r.json() : { holdings: [] }).catch(() => ({ holdings: [] })),
      fetch("/api/robo/schedules").then(r => r.ok ? r.json() : { schedules: [] }).catch(() => ({ schedules: [] })),
      fetch("/api/robo/trade_stats").then(r => r.ok ? r.json() : { stats: {} }).catch(() => ({ stats: {} }))
    ]);

    const holdings  = (hRes && hRes.holdings)  || [];
    const schedules = (sRes && sRes.schedules) || [];
    const statsData = (stRes && stRes.stats)   || {};
    const todayDate = (stRes && stRes.today_date) || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

    // ── 0. Date ──
    rtSetTxt("roboTodayDateText", todayDate);

    // ── 1. Commission Fees ──
    const comm = (stRes && stRes.commission_summary && stRes.commission_summary.total) || {};
    rtSetTxt("commTodayText", "$" + (Number(comm.today) || 0).toFixed(4));
    rtSetTxt("commWkText",    "$" + (Number(comm.weekly) || 0).toFixed(4));
    rtSetTxt("commMoText",    "$" + (Number(comm.monthly) || 0).toFixed(4));
    rtSetTxt("commTotalText", "$" + (Number(comm.lifetime) || 0).toFixed(4));

    // ── 2. GOD AI Stats ──
    const godS = rtFindKey(statsData, "GOD") || {};
    rtSetTxt("godTodayWins",         Number(godS.today_wins) || 0);
    rtSetTxt("godTodayLosses",       Number(godS.today_losses) || 0);
    rtSetTxt("godTodayProfit",       "+$" + (Number(godS.today_profit) || 0).toFixed(2));
    rtSetTxt("godTodayLossIncurred", "-$" + (Number(godS.today_loss) || 0).toFixed(2));
    rtSetTxt("godTodayComm",         "-$" + (Number(godS.today_commission_fee) || 0).toFixed(4));
    const godTodayPnl = Number(godS.today_pnl) || 0;
    const godPnlEl = document.getElementById("godTodayPnL");
    if (godPnlEl) {
      godPnlEl.innerText = (godTodayPnl >= 0 ? "+" : "") + "$" + godTodayPnl.toFixed(2);
      godPnlEl.style.color = godTodayPnl >= 0 ? "#10b981" : "#ef4444";
    }
    rtSetTxt("godCumProfit",  "+$" + (Number(godS.total_profit) || 0).toFixed(2));
    rtSetTxt("godCumLoss",    "-$" + (Number(godS.total_loss) || 0).toFixed(2));
    rtSetTxt("godCumComm",    "-$" + (Number(godS.total_commission_fee) || 0).toFixed(4));
    const godCumPnl = Number(godS.total_pnl) || 0;
    const godCumEl = document.getElementById("godCumNetPnL");
    if (godCumEl) {
      godCumEl.innerText = (godCumPnl >= 0 ? "+" : "") + "$" + godCumPnl.toFixed(2);
      godCumEl.style.color = godCumPnl >= 0 ? "#10b981" : "#ef4444";
    }

    // ── 3. GROUP C Stats ──
    const gcS = rtFindKey(statsData, "GROUP C") || rtFindKey(statsData, "C BOT") || {};
    rtSetTxt("groupCTodayWins",         Number(gcS.today_wins) || 0);
    rtSetTxt("groupCTodayLosses",       Number(gcS.today_losses) || 0);
    rtSetTxt("groupCTodayProfit",       "+$" + (Number(gcS.today_profit) || 0).toFixed(2));
    rtSetTxt("groupCTodayLossIncurred", "-$" + (Number(gcS.today_loss) || 0).toFixed(2));
    rtSetTxt("groupCTodayComm",         "-$" + (Number(gcS.today_commission_fee) || 0).toFixed(4));
    const gcTodayPnl = Number(gcS.today_pnl) || 0;
    const gcPnlEl = document.getElementById("groupCTodayPnL");
    if (gcPnlEl) {
      gcPnlEl.innerText = (gcTodayPnl >= 0 ? "+" : "") + "$" + gcTodayPnl.toFixed(2);
      gcPnlEl.style.color = gcTodayPnl >= 0 ? "#10b981" : "#ef4444";
    }
    rtSetTxt("groupCCumProfit",  "+$" + (Number(gcS.total_profit) || 0).toFixed(2));
    rtSetTxt("groupCCumLoss",    "-$" + (Number(gcS.total_loss) || 0).toFixed(2));
    rtSetTxt("groupCCumComm",    "-$" + (Number(gcS.total_commission_fee) || 0).toFixed(4));
    const gcCumPnl = Number(gcS.total_pnl) || 0;
    const gcCumEl = document.getElementById("groupCCumNetPnL");
    if (gcCumEl) {
      gcCumEl.innerText = (gcCumPnl >= 0 ? "+" : "") + "$" + gcCumPnl.toFixed(2);
      gcCumEl.style.color = gcCumPnl >= 0 ? "#10b981" : "#ef4444";
    }

    // ── 4. Timer Countdown ──
    const nextSec = (sRes && sRes.next_update_in_seconds !== undefined) ? sRes.next_update_in_seconds : 120;
    window.roboTradeNextSec = nextSec;
    function fmtTimer(s) {
      return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }
    rtSetTxt("godSchedTimerText",    fmtTimer(nextSec));
    rtSetTxt("groupCSchedTimerText", fmtTimer(nextSec));

    if (!window._roboCountdown) {
      window._roboCountdown = setInterval(() => {
        if (window.roboTradeNextSec > 0) {
          window.roboTradeNextSec -= 1;
          rtSetTxt("godSchedTimerText",    fmtTimer(window.roboTradeNextSec));
          rtSetTxt("groupCSchedTimerText", fmtTimer(window.roboTradeNextSec));
        }
      }, 1000);
    }

    // ── 5. Holdings & Schedules ──
    try { rtRenderHoldings("GOD",     holdings, "godHoldingsTableBody"); }    catch(e) { console.error("GOD holdings:", e); }
    try { rtRenderHoldings("GROUP C", holdings, "groupCHoldingsTableBody"); } catch(e) { console.error("GrpC holdings:", e); }
    try { rtRenderSchedules("GOD",     schedules, "godScheduleList"); }    catch(e) { console.error("GOD sched:", e); }
    try { rtRenderSchedules("GROUP C", schedules, "groupCScheduleList"); } catch(e) { console.error("GrpC sched:", e); }

    // ── 6. Summary Cards & Ledger ──
    try { rtRenderSummaryCard(stRes && stRes.weekly_summary,  "weeklySummaryContainer");  } catch(e) { console.error("Weekly:", e); }
    try { rtRenderSummaryCard(stRes && stRes.monthly_summary, "monthlySummaryContainer"); } catch(e) { console.error("Monthly:", e); }
    try { rtRenderLedger((stRes && stRes.daily_ledger) || []);                            } catch(e) { console.error("Ledger:", e); }

  } catch (err) {
    console.error("[RoboTrade V100 Error]", err);
  } finally {
    window._roboUpdating = false;
  }
};

// ─── INIT (called when tab opened or on login) ───────────
window.initRoboTradeModule = function () {
  // Wire up buttons
  const refreshBtn = document.getElementById("refreshRoboTradeBtn");
  if (refreshBtn) refreshBtn.onclick = () => window.updateRoboTradeModule();

  const resetBtn = document.getElementById("resetRoboTradeBtn");
  if (resetBtn) {
    resetBtn.onclick = async () => {
      if (!confirm("⚠️ Reset all Robo Trade data? This clears holdings, schedules, and history.")) return;
      try {
        const res = await fetch("/api/robo/reset", { method: "POST" });
        const d = await res.json();
        if (d.status === "success") {
          alert("✅ Robo Trade Arena reset successfully!");
          window.updateRoboTradeModule();
        }
      } catch (e) { alert("Reset error: " + e); }
    };
  }

  const sidebarResetBtn = document.getElementById("sidebarResetRoboBtn");
  if (sidebarResetBtn) sidebarResetBtn.onclick = resetBtn ? resetBtn.onclick : null;

  // Immediate data fetch
  window.updateRoboTradeModule();

  // Auto-refresh every 5 seconds when on robo-trade tab
  if (!window._roboRefreshInterval) {
    window._roboRefreshInterval = setInterval(() => {
      const tab = document.getElementById("tab-robo-trade");
      if (tab && !tab.classList.contains("hidden")) {
        window.updateRoboTradeModule();
      }
    }, 5000);
  }
};
