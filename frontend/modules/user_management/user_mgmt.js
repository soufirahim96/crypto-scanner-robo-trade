/* VERSION 95: MULTI-ADMIN USER & CONCURRENT IP SESSION MANAGEMENT MODULE */

async function fetchUsers() {
  const usersTableBody = document.getElementById("usersTableBody");
  if (!usersTableBody) return;
  try {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (data.status === "success" && data.users) {
      usersTableBody.innerHTML = data.users.map((u, i) => `
        <tr>
          <td class="text-muted" style="font-family: var(--font-mono); font-size: 0.75rem;">${u.id || `#${i+1}`}</td>
          <td><strong style="color: #fff;">${u.first_name} ${u.last_name}</strong></td>
          <td><span class="badge-mini text-cyan">@${u.username}</span></td>
          <td>${u.email}</td>
          <td><span class="change-badge up">ACTIVE ADMIN</span></td>
        </tr>
      `).join("");
    }
  } catch (e) {
    console.error("Failed to fetch users:", e);
  }
}

async function fetchActiveIpSessions() {
  const badgeEl = document.getElementById("activeIpSlotsText");
  const sessionsTableBody = document.getElementById("activeIpSessionsTableBody");
  try {
    const res = await fetch("/api/admin/active_sessions");
    const data = await res.json();
    if (data.status === "success") {
      if (badgeEl) badgeEl.innerText = `${data.active_count} / 3 Active IPs`;
      if (sessionsTableBody) {
        if (!data.sessions || data.sessions.length === 0) {
          sessionsTableBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center" style="padding: 1rem;">No active admin IP sessions tracked yet. (Current IP: ${data.current_client_ip})</td></tr>`;
        } else {
          sessionsTableBody.innerHTML = data.sessions.map((s, i) => `
            <tr>
              <td><span class="badge-mini text-yellow" style="font-family: var(--font-mono);">${s.client_ip} ${s.client_ip === data.current_client_ip ? '(YOU)' : ''}</span></td>
              <td><strong style="color: #fff;">@${s.username}</strong></td>
              <td class="text-muted" style="font-size: 0.8rem;">${s.login_time_str || 'Just now'}</td>
              <td><span class="change-badge up">ONLINE</span></td>
              <td>
                <button onclick="terminateIpSession('${s.client_ip}')" class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);">
                  <i class="fa-solid fa-power-off"></i> Terminate IP
                </button>
              </td>
            </tr>
          `).join("");
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch active IP sessions:", e);
  }
}

async function terminateIpSession(clientIp) {
  if (!confirm(`Are you sure you want to terminate the active session for IP ${clientIp}?`)) return;
  try {
    const res = await fetch("/api/admin/logout_ip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_ip: clientIp })
    });
    const data = await res.json();
    alert(data.message);
    fetchActiveIpSessions();
  } catch (e) {
    console.error("Failed to terminate IP session:", e);
  }
}

window.fetchUsers = fetchUsers;
window.fetchActiveIpSessions = fetchActiveIpSessions;
window.terminateIpSession = terminateIpSession;
