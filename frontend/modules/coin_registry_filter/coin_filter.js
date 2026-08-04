/* VERSION 50: COIN REGISTRY & FILTER MODULE */

async function fetchCoinsRegistry() {
  const coinsTableBody = document.getElementById("coinsTableBody");
  if (!coinsTableBody) return;
  try {
    const res = await fetch("/api/coins");
    const data = await res.json();
    if (data.status === "success" && data.coins) {
      coinsTableBody.innerHTML = data.coins.map(c => `
        <tr>
          <td><strong style="color: #fff;">${c.symbol}</strong></td>
          <td>${c.name}</td>
          <td><span class="badge-mini">${c.coin_type}</span></td>
          <td><span class="change-badge ${c.is_filtered ? 'down' : 'up'}">${c.is_filtered ? 'EXCLUDED' : 'ACTIVE'}</span></td>
        </tr>
      `).join("");
    }
  } catch (e) {
    console.error("Failed to fetch coins registry:", e);
  }
}

window.fetchCoinsRegistry = fetchCoinsRegistry;
