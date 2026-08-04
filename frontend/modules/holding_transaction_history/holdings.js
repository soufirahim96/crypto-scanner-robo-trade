/* VERSION 50: HOLDING & TRANSACTION HISTORY MODULE */

async function fetchTransactionHistoryFromDB() {
  const historyBody = document.getElementById("transactionHistoryTableBody");
  if (!historyBody) return;
  try {
    const res = await fetch("/api/paper/transactions");
    const data = await res.json();
    if (data.status === "success" && data.transactions) {
      const logs = data.transactions;
      if (logs.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No transaction logs recorded yet in persistent SQLite DB</td></tr>`;
      } else {
        historyBody.innerHTML = logs.map(r => `
          <tr>
            <td class="text-muted" style="font-family: var(--font-mono); font-size: 0.75rem;">${r.created_at ? (r.created_at.split(" ")[1] || r.created_at) : (r.timestamp || 'N/A')}</td>
            <td><strong>${r.participant}</strong></td>
            <td><span class="badge-mini">${r.action}</span></td>
            <td><strong>${r.symbol}</strong></td>
            <td>${formatFullPrice(r.price, 5)}</td>
            <td>$${r.capital.toFixed(2)}</td>
            <td><span class="change-badge ${r.pnl >= 0 ? 'up' : 'down'}">${r.pnl >= 0 ? '+' : ''}$${r.pnl.toFixed(2)}</span></td>
          </tr>
        `).join("");
        
        let godRealizedPnl = 0;
        let groupCRealizedPnl = 0;
        logs.forEach(r => {
           if (r.participant.includes("GOD")) godRealizedPnl += (r.pnl || 0);
           if (r.participant.includes("GROUP C")) groupCRealizedPnl += (r.pnl || 0);
        });
        window.latestRoboPnl = { god: godRealizedPnl, groupC: groupCRealizedPnl };
      }
    }
  } catch (e) {
    console.error("Failed to fetch transaction history from DB:", e);
  }
}

window.fetchTransactionHistoryFromDB = fetchTransactionHistoryFromDB;
