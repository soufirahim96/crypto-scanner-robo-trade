/* VERSION 50: ANALYSIS LOGIC REGISTRY MODULE */

async function fetchAnalysisLogicRegistry() {
  const tableBody = document.getElementById("analysisLogicTableBody");
  if (!tableBody) return;

  try {
    const res = await fetch("/api/ai/analysis_logic");
    const data = await res.json();
    if (!data.rules || data.rules.length === 0) return;

    tableBody.innerHTML = data.rules.map(r => `
      <tr>
        <td><strong style="color: var(--accent-cyan); font-family: var(--font-mono);">${r.id}</strong></td>
        <td><strong style="color: #fff;">${r.logic_name}</strong></td>
        <td><span class="badge-mini">${r.target_scope}</span></td>
        <td><strong style="color: #f0b90b;">${r.assigned_agent}</strong></td>
        <td><span class="badge-mini text-cyan">${r.rule_type}</span></td>
        <td style="font-size: 0.8rem; color: #d1d5db;">${r.description}</td>
        <td>
          <button onclick="deleteAnalysisRule('${r.id}')" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; padding: 0.15rem 0.45rem; font-size: 0.7rem; cursor: pointer;">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    console.error("Failed to fetch analysis logic registry:", e);
  }
}

window.fetchAnalysisLogicRegistry = fetchAnalysisLogicRegistry;
