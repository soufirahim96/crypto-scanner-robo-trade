/* VERSION 61: PERFORMANCE TRADE REVIEW MODULE (RED RECTANGLE WORDING REMOVED & ZERO-FLICKER 10S STATIC ENGINE) */

let perfReviewInterval = null;

function safeFormatPrice(val, decimals = 4) {
  if (val === undefined || val === null || isNaN(val)) return "$0.0000";
  const num = Number(val);
  if (typeof window.formatFullPrice === "function") return window.formatFullPrice(num, decimals);
  return "$" + num.toFixed(decimals);
}

function initPerformanceReviewModule() {
  console.log("VERSION 61: Initialized Performance Trade Review Module (Zero Wording Banner, 10s Static Engine)");
  fetchPerformanceTradeReview();
  if (!perfReviewInterval) {
    perfReviewInterval = setInterval(fetchPerformanceTradeReview, 1000);
  }
}

async function fetchPerformanceTradeReview() {
  const totalTradesEl = document.getElementById("perfTotalTrades");
  const winRateEl = document.getElementById("perfWinRate");
  const avgYieldEl = document.getElementById("perfAvgYield");
  const divergenceEl = document.getElementById("perfDivergenceRate");
  const diagnosticsBody = document.getElementById("openHoldingsDiagnosticsBody");
  const evaluationsBody = document.getElementById("groupDEvaluationsBody");

  try {
    const res = await fetch("/api/ai/performance_review");
    const data = await res.json();
    if (data.status === "success" && data.performance_metrics) {
      const m = data.performance_metrics;
      if (totalTradesEl) totalTradesEl.textContent = m.total_executed_trades || 0;
      if (winRateEl) winRateEl.textContent = `${m.overall_win_rate_pct}%`;
      const cSum = data.commission_summary || {};
      const godC = cSum.god_ai || {};
      const groupcC = cSum.group_c || {};
      const totC = cSum.total || {};

      function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      }

      setVal("perfGodCommToday", `$${(godC.today || 0).toFixed(4)}`);
      setVal("perfGodCommWeekly", `$${(godC.weekly || 0).toFixed(4)}`);
      setVal("perfGodCommMonthly", `$${(godC.monthly || 0).toFixed(4)}`);
      setVal("perfGodCommLifetime", `$${(godC.lifetime || 0).toFixed(4)}`);

      setVal("perfGroupCCommToday", `$${(groupcC.today || 0).toFixed(4)}`);
      setVal("perfGroupCCommWeekly", `$${(groupcC.weekly || 0).toFixed(4)}`);
      setVal("perfGroupCCommMonthly", `$${(groupcC.monthly || 0).toFixed(4)}`);
      setVal("perfGroupCCommLifetime", `$${(groupcC.lifetime || 0).toFixed(4)}`);

      setVal("perfCommTotalGlobal", `$${(totC.lifetime || 0).toFixed(4)}`);

      // 1. OPEN HOLDINGS DIAGNOSTICS TABLE (NO WORDING BANNER - GRANULAR CELL UPDATES)
      if (diagnosticsBody) {
        const diagnosticsList = data.open_holdings_diagnostics || [];

        if (diagnosticsList.length === 0) {
          // Keep table clean and empty with ZERO wording banner
          diagnosticsBody.innerHTML = "";
        } else {
          const activeIds = new Set();

          diagnosticsList.forEach(d => {
            const hId = d.id || `${d.participant}_${d.symbol}`;
            activeIds.add(hId);
            let row = document.getElementById(`v61-diag-${hId}`);

            if (!row) {
              // CREATE PERMANENT TABLE ROW WITH DIRECT CELL CONTROLS
              const color = d.participant.includes("GROUP C") ? "#10b981" : "#f0b90b";
              row = document.createElement("tr");
              row.id = `v61-diag-${hId}`;
              row.setAttribute("data-holding-id", hId);
              row.innerHTML = `
                <td><strong style="color: ${color};">${d.participant}</strong></td>
                <td><strong style="color: #fff;">${d.symbol}</strong></td>
                <td>${safeFormatPrice(d.entry_price, 4)}</td>
                <td><strong id="v61-price-${hId}" style="color: #fff;">${safeFormatPrice(d.current_price, 4)}</strong></td>
                <td><span id="v61-pnl-${hId}" class="change-badge ${d.unrealized_pnl >= 0 ? 'up' : 'down'}">${d.unrealized_pnl >= 0 ? '+' : ''}$${d.unrealized_pnl.toFixed(2)} (${d.pnl_pct >= 0 ? '+' : ''}${d.pnl_pct.toFixed(2)}%)</span></td>
                <td><span id="v61-vel-${hId}" class="badge-mini text-cyan" style="font-weight: 700;">${d.velocity_status}</span></td>
                <td id="v61-reason-${hId}" style="font-size: 0.75rem; color: #e2e8f0;">${d.factual_reasoning}</td>
                <td><span id="v61-calib-${hId}" class="change-badge up">${d.god_mode_calibration}</span></td>
              `;
              diagnosticsBody.appendChild(row);
            } else {
              // GRANULAR REAL-TIME FIELD SYNC (NO INNERHTML RECONSTRUCTION)
              // Real-Time Live Price
              const priceEl = document.getElementById(`v61-price-${hId}`);
              if (priceEl) {
                const formattedPrice = safeFormatPrice(d.current_price, 4);
                if (priceEl.textContent !== formattedPrice) priceEl.textContent = formattedPrice;
              }

              // Real-Time Live PnL
              const pnlEl = document.getElementById(`v61-pnl-${hId}`);
              if (pnlEl) {
                const pnlClass = d.unrealized_pnl >= 0 ? "change-badge up" : "change-badge down";
                const pnlText = `${d.unrealized_pnl >= 0 ? '+' : ''}$${d.unrealized_pnl.toFixed(2)} (${d.pnl_pct >= 0 ? '+' : ''}${d.pnl_pct.toFixed(2)}%)`;
                if (pnlEl.className !== pnlClass) pnlEl.className = pnlClass;
                if (pnlEl.textContent !== pnlText) pnlEl.textContent = pnlText;
              }

              // 3-Minute Group D Refresh: Velocity Status & Factual Reasoning
              const velEl = document.getElementById(`v61-vel-${hId}`);
              if (velEl && velEl.textContent !== d.velocity_status) velEl.textContent = d.velocity_status;

              const reasonEl = document.getElementById(`v61-reason-${hId}`);
              if (reasonEl && reasonEl.textContent !== d.factual_reasoning) reasonEl.textContent = d.factual_reasoning;

              // 5-Minute Supreme God AI Refresh: God Mode Calibration
              const calibEl = document.getElementById(`v61-calib-${hId}`);
              if (calibEl && calibEl.textContent !== d.god_mode_calibration) calibEl.textContent = d.god_mode_calibration;
            }
          });

          // Remove row ONLY when position is closed/exited in DB
          diagnosticsBody.querySelectorAll("tr[data-holding-id]").forEach(row => {
            const hId = row.getAttribute("data-holding-id");
            if (!activeIds.has(hId)) row.remove();
          });
        }
      }

      // 2. CONSOLIDATED CLOSED TRADES LEDGER SUMMARY TABLE
      if (evaluationsBody) {
        const ledgerList = data.consolidated_ledger || [];
        if (ledgerList.length === 0) {
          evaluationsBody.innerHTML = "";
        } else {
          const activeLedgerKeys = new Set();
          ledgerList.forEach(item => {
            const key = `${item.participant}_${item.symbol}`;
            activeLedgerKeys.add(key);
            let row = document.getElementById(`v61-ledger-${key}`);
            const color = item.participant.includes("GROUP C") ? "#10b981" : "#f0b90b";

            if (!row) {
              row = document.createElement("tr");
              row.id = `v61-ledger-${key}`;
              row.setAttribute("data-ledger-key", key);
              row.innerHTML = `
                <td><strong style="color: ${color};">${item.participant}</strong></td>
                <td><strong style="color: #fff;">${item.symbol}</strong> <span class="badge-mini" style="margin-left: 4px;">${item.trades_count} Closed</span></td>
                <td>${safeFormatPrice(item.avg_entry_price, 4)}</td>
                <td><strong style="color: #00f0ff;">${safeFormatPrice(item.last_exit_price, 4)}</strong></td>
                <td><span class="change-badge ${item.combined_pnl >= 0 ? 'up' : 'down'}">${item.combined_pnl >= 0 ? '+' : ''}$${item.combined_pnl.toFixed(2)}</span></td>
                <td style="font-size: 0.75rem; color: #e2e8f0;">${item.factual_summary}</td>
                <td><strong style="color: #10b981;">📊 GROUP D AUDITOR</strong></td>
                <td><span class="change-badge up">${item.status}</span></td>
              `;
              evaluationsBody.appendChild(row);
            } else {
              // Update consolidated ledger values in-place
              const badgeEl = row.querySelector("td:nth-child(2)");
              if (badgeEl) badgeEl.innerHTML = `<strong style="color: #fff;">${item.symbol}</strong> <span class="badge-mini" style="margin-left: 4px;">${item.trades_count} Closed</span>`;
              
              const pnlEl = row.querySelector("td:nth-child(5)");
              if (pnlEl) {
                pnlEl.className = `change-badge ${item.combined_pnl >= 0 ? 'up' : 'down'}`;
                pnlEl.textContent = `${item.combined_pnl >= 0 ? '+' : ''}$${item.combined_pnl.toFixed(2)}`;
              }
              
              const summaryEl = row.querySelector("td:nth-child(6)");
              if (summaryEl && summaryEl.textContent !== item.factual_summary) {
                summaryEl.textContent = item.factual_summary;
              }
            }
          });

          evaluationsBody.querySelectorAll("tr[data-ledger-key]").forEach(row => {
            const key = row.getAttribute("data-ledger-key");
            if (!activeLedgerKeys.has(key)) row.remove();
          });
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch Version 61 performance review data:", e);
  }
}

// Auto-run module on script load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPerformanceReviewModule);
} else {
  initPerformanceReviewModule();
}

window.initPerformanceReviewModule = initPerformanceReviewModule;
window.fetchPerformanceTradeReview = fetchPerformanceTradeReview;
