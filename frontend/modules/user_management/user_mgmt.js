/* VERSION 50: USER MANAGEMENT MODULE */

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
          <td><span class="change-badge up">ACTIVE</span></td>
        </tr>
      `).join("");
    }
  } catch (e) {
    console.error("Failed to fetch users:", e);
  }
}

window.fetchUsers = fetchUsers;
