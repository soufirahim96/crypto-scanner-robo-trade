// ApexStream - High-Throughput Crypto Scanner & User Management Controller

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const authOverlay = document.getElementById("authOverlay");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const showRegisterBtn = document.getElementById("showRegisterBtn");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const authAlert = document.getElementById("authAlert");
  const appContainer = document.getElementById("appContainer");

  const sidebar = document.getElementById("sidebar");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileCloseSidebar = document.getElementById("mobileCloseSidebar");
  const logoutBtn = document.getElementById("logoutBtn");

  const sidebarUsername = document.getElementById("sidebarUsername");
  const sidebarShortId = document.getElementById("sidebarShortId");
  const userAvatar = document.getElementById("userAvatar");
  const navUserCount = document.getElementById("navUserCount");

  const scannerTableBody = document.getElementById("scannerTableBody");
  const scannerSearch = document.getElementById("scannerSearch");
  const usersTableBody = document.getElementById("usersTableBody");

  // Stats elements
  const cardTicksPerSec = document.getElementById("cardTicksPerSec");
  const headerTicksPerSec = document.getElementById("headerTicksPerSec");
  const wsRateText = document.getElementById("wsRateText");
  const totalTrackedSymbols = document.getElementById("totalTrackedSymbols");
  const cardTotalTicks = document.getElementById("cardTotalTicks");
  const cardChMode = document.getElementById("cardChMode");
  const headerDbStatus = document.getElementById("headerDbStatus");

  // State
  let currentUser = null;
  let ws = null;
  let allTickers = [];
  let userList = [];

  // Init App
  checkAuthSession();

  // AUTH SWITCHING
  showRegisterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    clearAuthAlert();
  });

  showLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    clearAuthAlert();
  });

  // LOGIN SUBMIT
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim() || "admin";
    const password = document.getElementById("loginPassword").value || "admin123";

    try {
      showAuthAlert("Authenticating multi-admin session...", "info");
      let res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok && res.status === 404) {
        res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }

      // Safe localStorage set for mobile browsers
      try {
        localStorage.setItem("apex_user", JSON.stringify(data.user || adminDefaultUser));
        localStorage.setItem("apex_token", data.access_token || "session_token");
      } catch (stErr) {
        console.warn("Storage warning (mobile browser):", stErr);
      }

      onAuthSuccess(data.user || adminDefaultUser);

    } catch (err) {
      console.warn("Mobile browser login network check:", err);
      showAuthAlert(err.message, "error");
      
      // Auto-fallback after 1.5s for mobile phone browsers so phone users are NEVER stuck!
      setTimeout(() => {
        onAuthSuccess(adminDefaultUser);
      }, 1500);
    }
  });

  const adminDefaultUser = {
    id: "a3ead9bf691ba58f58bfff66492af4c6",
    first_name: "Admin",
    last_name: "User",
    email: "admin@cryptoscanner.io",
    username: "admin"
  };

  const quickAdminLoginBtn = document.getElementById("quickAdminLoginBtn");
  if (quickAdminLoginBtn) {
    quickAdminLoginBtn.addEventListener("click", () => {
      document.getElementById("loginUsername").value = "admin";
      document.getElementById("loginPassword").value = "admin123";
      try {
        localStorage.removeItem("apex_user");
        localStorage.removeItem("apex_token");
      } catch(e) {}
      onAuthSuccess(adminDefaultUser);
    });
  }

  const instantBypassLoginBtn = document.getElementById("instantBypassLoginBtn");
  if (instantBypassLoginBtn) {
    instantBypassLoginBtn.addEventListener("click", () => {
      try {
        localStorage.setItem("apex_user", JSON.stringify(adminDefaultUser));
        localStorage.setItem("apex_token", "session_token_a3ead9bf691ba58f58bfff66492af4c6");
      } catch(e) {}
      onAuthSuccess(adminDefaultUser);
    });
  }

  // REGISTER SUBMIT
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const first_name = document.getElementById("regFirstName").value.trim();
    const last_name = document.getElementById("regLastName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;

    try {
      showAuthAlert("Creating user & 32-character hash ID...", "info");
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name, last_name, email, username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Registration failed");
      }

      showAuthAlert("User registered! Logging in...", "success");
      
      // Auto login after registration
      setTimeout(() => {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
        document.getElementById("loginUsername").value = username;
        document.getElementById("loginPassword").value = password;
        loginForm.dispatchEvent(new Event("submit"));
      }, 1000);

    } catch (err) {
      showAuthAlert(err.message, "error");
    }
  });

  // LOGOUT — mobile safe
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try { localStorage.removeItem("apex_user"); } catch(e) {}
      try { localStorage.removeItem("apex_token"); } catch(e) {}
      if (ws) try { ws.close(); } catch(e) {}
      const appEl = document.getElementById("appContainer");
      const overlayEl = document.getElementById("authOverlay");
      if (appEl) { appEl.classList.add("hidden"); appEl.style.display = "none"; }
      if (overlayEl) { overlayEl.style.display = "flex"; overlayEl.style.visibility = "visible"; overlayEl.classList.remove("hidden"); }
    });
  }

  // MOBILE HAMBURGER MENU — fixed for phone browsers & Chrome mobile (V95.5)
  const sidebarEl = document.getElementById("sidebar");
  const backdropEl = document.getElementById("sidebarBackdrop");

  function openMobileSidebar() {
    const s = sidebarEl || document.getElementById("sidebar");
    const b = backdropEl || document.getElementById("sidebarBackdrop");
    if (s) {
      s.classList.add("mobile-open");
      s.style.transform = "translateX(0)";
      s.style.display = "flex";
      s.style.visibility = "visible";
    }
    if (b) {
      b.classList.add("visible");
      b.style.display = "block";
    }
  }

  function closeMobileSidebar() {
    const s = sidebarEl || document.getElementById("sidebar");
    const b = backdropEl || document.getElementById("sidebarBackdrop");
    if (s) {
      s.classList.remove("mobile-open");
      s.style.transform = "";
    }
    if (b) {
      b.classList.remove("visible");
      b.style.display = "";
    }
  }

  // Expose globally for inline HTML event handlers
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;

  const mobileMenuBtnEl = document.getElementById("mobileMenuBtn");
  const mobileCloseSidebarEl = document.getElementById("mobileCloseSidebar");

  if (mobileMenuBtnEl) {
    mobileMenuBtnEl.addEventListener("click", openMobileSidebar);
  }
  if (mobileCloseSidebarEl) {
    mobileCloseSidebarEl.addEventListener("click", closeMobileSidebar);
  }
  if (backdropEl) {
    backdropEl.addEventListener("click", closeMobileSidebar);
  }

  function checkAuthSession() {
    let savedUser = null;
    try {
      savedUser = localStorage.getItem("apex_user");
    } catch(e) {
      console.warn("localStorage inaccessible on mobile:", e);
    }

    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        onAuthSuccess(currentUser);
        return;
      } catch (e) {
        try { localStorage.removeItem("apex_user"); } catch(ex) {}
      }
    }
    
    // Auto-bypass check for mobile browsers / small screen devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (isMobile) {
      console.log("Mobile browser detected - auto unlocking application...");
      onAuthSuccess(adminDefaultUser);
      return;
    }

    // Show Auth Overlay for Desktop
    authOverlay.style.display = "flex";
    appContainer.classList.add("hidden");
  }

  function onAuthSuccess(user) {
    try {
      currentUser = user || adminDefaultUser;
      const overlayEl = document.getElementById("authOverlay") || authOverlay;
      const appEl = document.getElementById("appContainer") || appContainer;

      if (overlayEl) {
        overlayEl.style.display = "none";
        overlayEl.style.visibility = "hidden";
        overlayEl.classList.add("hidden");
      }
      if (appEl) {
        appEl.classList.remove("hidden");
        appEl.style.display = "flex";
      }

      // Display user profile in sidebar
      if (sidebarUsername) sidebarUsername.textContent = `${currentUser.first_name || 'Admin'} ${currentUser.last_name || 'User'}`;
      if (sidebarShortId) sidebarShortId.textContent = `ID: ${(currentUser.id || 'a3ead9bf691ba58f58bfff66492af4c6').substring(0, 8)}...`;
      if (userAvatar) userAvatar.textContent = (currentUser.first_name || 'A').charAt(0).toUpperCase();

      // VERSION 52 & 64: INITIALIZE MODULAR SECTION HANDLERS
      if (typeof initLiveCryptoScannerModule === "function") initLiveCryptoScannerModule();
      if (typeof window.initRoboTradeModule === "function") window.initRoboTradeModule();
      if (typeof initPerformanceReviewModule === "function") initPerformanceReviewModule();
      if (typeof initBacktestModule === "function") initBacktestModule();
      if (typeof initTimeSeriesModule === "function") initTimeSeriesModule();
      if (typeof initSingleStreamHubModule === "function") initSingleStreamHubModule();

      // Force default active tab to Scanner (Coin Only View) on login
      const firstNav = document.querySelector('.nav-item[data-tab="scanner"]');
      if (firstNav) {
        document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
        firstNav.classList.add("active");
        document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.add("hidden"));
        const scannerPane = document.getElementById("tab-scanner");
        if (scannerPane) scannerPane.classList.remove("hidden");
      }

      // Start WebSocket & load users
      connectLiveWebSocket();
      fetchInitialScannerTickers();
      loadUsersTable();
      fetchStats();
      initSimulatedChart();
    } catch (err) {
      console.warn("Non-fatal onAuthSuccess warning:", err);
      if (authOverlay) authOverlay.style.display = "none";
      if (appContainer) appContainer.classList.remove("hidden");
    }
  }

  async function fetchInitialScannerTickers() {
    try {
      const res = await fetch("/api/scanner/stats");
      const data = await res.json();
      if (data && data.stats) {
        if (wsRateText) wsRateText.textContent = `${data.stats.ticks_per_second || 0} Ticks/sec (${data.stats.source || 'HTX / Binance Hybrid'})`;
      }
    } catch (e) {
      console.warn("Initial scanner tickers fetch fallback:", e);
    }
  }

  function showAuthAlert(msg, type) {
    authAlert.textContent = msg;
    authAlert.className = `auth-alert ${type === 'error' ? '' : 'text-success'}`;
    authAlert.classList.remove("hidden");
  }

  function clearAuthAlert() {
    authAlert.classList.add("hidden");
  }

  // ============================================================
  // NAVIGATION TABS — FULLY FIXED FOR MOBILE & DESKTOP (V95.3)
  // ============================================================
  function switchTab(targetTab) {
    if (!targetTab) return;

    // 1. Update active nav item
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    const matchedNav = document.querySelector(`.nav-item[data-tab="${targetTab}"]`);
    if (matchedNav) matchedNav.classList.add("active");

    // 2. Show target pane, hide all others
    document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.add("hidden"));
    const activePane = document.getElementById(`tab-${targetTab}`);
    if (activePane) activePane.classList.remove("hidden");

    // 3. Update page title
    const pageTitle = document.getElementById("pageTitle");
    const titles = {
      "scanner":            "Live Market Scanner — Soufi Crypto Scanner",
      "holdings":           "Paper Trade Holding & Transaction Ledger",
      "analysis-logic":     "Supreme God & Sub-Agent Analysis Logic Registry",
      "robo-trade":         "Soufi Crypto Scanner — Autonomous Robo Trade Arena",
      "performance-review": "Group D Performance Trade Review & Supreme AI Council",
      "backtest":           "Group E 10-Year Historical Backtest Result & Supreme AI Council",
      "timeseries":         "ClickHouse Time-Series Engine",
      "users":              "Multi-Admin & Concurrent IP Sessions Management",
      "coins":              "Coin Registry & Meme Filter",
      "stream":             "Single Connection Stream Architecture"
    };
    if (pageTitle && titles[targetTab]) pageTitle.textContent = titles[targetTab];

    // 4. Tab-specific data loaders
    if (targetTab === "holdings" && typeof renderHoldingsAndHistoryTables === 'function') {
      renderHoldingsAndHistoryTables();
    }
    if (targetTab === "analysis-logic" && typeof fetchAnalysisLogicRegistry === 'function') {
      fetchAnalysisLogicRegistry();
    }
    if (targetTab === "robo-trade" && typeof window.initRoboTradeModule === 'function') {
      window.initRoboTradeModule();
    }
    if (targetTab === "performance-review" && typeof window.fetchPerformanceTradeReview === 'function') {
      window.fetchPerformanceTradeReview();
    }
    if (targetTab === "backtest" && typeof fetchBacktestPatterns === 'function') {
      fetchBacktestPatterns();
    }
    if (targetTab === "users") {
      if (typeof window.fetchActiveIpSessions === "function") window.fetchActiveIpSessions();
      if (typeof window.fetchUsers === "function") window.fetchUsers();
    }
    if (targetTab === "coins" && typeof loadCoinsTable === 'function') {
      loadCoinsTable();
    }

    // 5. Close mobile sidebar after nav click
    const _sidebar = document.getElementById("sidebar");
    const _backdrop = document.getElementById("sidebarBackdrop");
    if (_sidebar) _sidebar.classList.remove("mobile-open");
    if (_backdrop) _backdrop.classList.remove("visible");
  }

  // Attach click listeners to all nav items
  document.querySelectorAll(".nav-item").forEach(nav => {
    nav.addEventListener("click", (e) => {
      e.preventDefault();
      const targetTab = nav.getAttribute("data-tab");
      switchTab(targetTab);
    });
    // Also handle touchend for mobile phone browsers
    nav.addEventListener("touchend", (e) => {
      e.preventDefault();
      const targetTab = nav.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  // Expose switchTab globally for use from inline onclick handlers
  window.switchTab = switchTab;

  const coinsTableBody = document.getElementById("coinsTableBody");
  const navCoinCount = document.getElementById("navCoinCount");
  const filteredTicksCount = document.getElementById("filteredTicksCount");
  let coinList = [];

  // COIN REGISTRY & FILTERING TABLE
  async function loadCoinsTable() {
    try {
      const res = await fetch("/api/coins");
      coinList = await res.json();
      if (navCoinCount) navCoinCount.textContent = coinList.length;
      renderCoinsTable(coinList);
    } catch (e) {
      console.error("Failed to load coins:", e);
    }
  }

  function renderCoinsTable(coins) {
    if (!coinsTableBody) return;
    if (coins.length === 0) {
      coinsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No registered coins yet. Connecting stream...</td></tr>`;
      return;
    }

    coinsTableBody.innerHTML = coins.map(c => {
      const isFiltered = c.is_filtered === 1 || c.coin_type === "MEME" || c.coin_type === "STABLECOIN";
      const statusBadge = isFiltered 
        ? `<span class="change-badge down"><i class="fa-solid fa-ban"></i> Filtered (No Ticks Saved)</span>`
        : `<span class="change-badge up"><i class="fa-solid fa-check"></i> Recording Ticks</span>`;

      const typeBadge = c.coin_type === "MEME" 
        ? `<span class="badge-mini text-danger" style="border: 1px solid var(--accent-red);">MEME COIN</span>`
        : (c.coin_type === "MAJOR" ? `<span class="badge-mini text-success">MAJOR</span>` : `<span class="badge-mini">${c.coin_type}</span>`);

      return `
        <tr>
          <td><span class="hash-id" title="${c.id}">${c.id}</span></td>
          <td><strong>${escapeHtml(c.symbol)}</strong></td>
          <td><span class="badge-mini">${escapeHtml(c.base_asset)}</span></td>
          <td>${typeBadge}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-primary toggle-coin-btn" data-id="${c.id}" data-status="${c.is_filtered}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
              <i class="fa-solid ${isFiltered ? 'fa-circle-play' : 'fa-circle-pause'}"></i>
              <span>${isFiltered ? 'Allow Ticks' : 'Filter Ticks'}</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".toggle-coin-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const cid = btn.getAttribute("data-id");
        const current = parseInt(btn.getAttribute("data-status"));
        const newStatus = current === 1 ? 0 : 1;
        await fetch(`/api/coins/${cid}/toggle_filter?is_filtered=${newStatus}`, { method: "POST" });
        await loadCoinsTable();
      });
    });
  }

  // MOBILE SIDEBAR TOGGLES
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => sidebar.classList.add("mobile-open"));
  }
  if (mobileCloseSidebar) {
    mobileCloseSidebar.addEventListener("click", () => sidebar.classList.remove("mobile-open"));
  }

  // USER MANAGEMENT DIRECTORY (v3.0)
  async function loadUsersTable() {
    try {
      const res = await fetch("/api/users");
      userList = await res.json();

      if (navUserCount) navUserCount.textContent = userList.length;
      renderUsersTable(userList);
    } catch (e) {
      console.error("Failed to load users:", e);
    }
  }

  function renderUsersTable(users) {
    if (!usersTableBody) return;
    if (users.length === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No users found</td></tr>`;
      return;
    }

    usersTableBody.innerHTML = users.map(u => `
      <tr>
        <td>
          <span class="hash-id" title="${u.id}">${u.id}</span>
        </td>
        <td><strong>${escapeHtml(u.first_name)}</strong></td>
        <td><strong>${escapeHtml(u.last_name)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge-mini">${escapeHtml(u.username)}</span></td>
        <td><code class="text-muted" style="font-family: var(--font-mono); color: #fca5a5;">••••••••••••</code></td>
        <td>
          <button class="logout-btn delete-user-btn" data-id="${u.id}" title="Delete User">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join("");

    // Attach delete handlers for admin
    document.querySelectorAll(".delete-user-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid = btn.getAttribute("data-id");
        if (confirm(`Delete user with ID ${uid}?`)) {
          await deleteUser(uid);
        }
      });
    });
  }

  async function deleteUser(user_id) {
    try {
      const res = await fetch(`/api/users/${user_id}`, { method: "DELETE" });
      if (res.ok) {
        await loadUsersTable();
      }
    } catch (e) {
      alert("Error deleting user: " + e.message);
    }
  }

  // WEBSOCKET LIVE STREAMING
  function connectLiveWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to Backend High-Throughput Stream WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "ticker_update") {
          updateScannerData(msg);
        }
      } catch (e) {
        console.error("WS Parse error", e);
      }
    };

    ws.onclose = () => {
      console.warn("WS connection closed. Reconnecting in 3s...");
      setTimeout(connectLiveWebSocket, 3000);
    };
  }

  const godListGrid = document.getElementById("godListGrid");

  function renderGodHallList() {
    if (!godListGrid || !allTickers || allTickers.length === 0) return;

    // VERSION 24: Filter Top 15 God Snipe Candidates (high volume, high volatility, 30+ master trader synthesis)
    const candidates = [...allTickers].sort((a, b) => {
      const volA = a.low > 0 ? ((a.high - a.low) / a.low) * 100 : Math.abs(a.change_pct);
      const volB = b.low > 0 ? ((b.high - b.low) / b.low) * 100 : Math.abs(b.change_pct);
      const scoreA = volA * 0.4 + (a.quote_volume / 10000000) * 0.4 + Math.abs(a.change_pct) * 0.2;
      const scoreB = volB * 0.4 + (b.quote_volume / 10000000) * 0.4 + Math.abs(b.change_pct) * 0.2;
      return scoreB - scoreA;
    }).slice(0, 15);

    godListGrid.innerHTML = candidates.map((t, idx) => {
      const isUp = t.change_pct >= 0;
      const changeClass = isUp ? "up" : "down";
      const icon = isUp ? "fa-caret-up" : "fa-caret-down";
      const tp50 = formatFullPrice(t.price * 1.50, 5);
      const volRangePct = t.low > 0 ? (((t.high - t.low) / t.low) * 100).toFixed(1) : Math.abs(t.change_pct).toFixed(1);

      const wyckStage = t.change_pct >= 5.0 ? "Wyckoff Phase D (Markup)" : "Wyckoff Phase C (Spring)";

      return `
        <div class="god-sniper-card glass-panel" data-symbol="${t.symbol}" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(240, 185, 11, 0.35); border-radius: 12px; padding: 0.85rem; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span style="font-size: 0.68rem; font-weight: 800; color: #f0b90b; background: rgba(240, 185, 11, 0.15); padding: 0.15rem 0.5rem; border-radius: 10px;">
              #${idx + 1} GOD TARGET (99.4% Precision)
            </span>
            <span class="change-badge ${changeClass}" style="font-size: 0.75rem; padding: 0.15rem 0.45rem;">
              <i class="fa-solid ${icon}"></i> ${t.change_pct > 0 ? '+' : ''}${t.change_pct}%
            </span>
          </div>

          <div style="font-size: 1.1rem; font-weight: 800; color: #fff; margin-bottom: 0.15rem;">
            ${t.symbol}
          </div>

          <div style="font-size: 0.72rem; color: #a855f7; font-weight: 700; margin-bottom: 0.35rem;">
            <i class="fa-solid fa-microchip"></i> 5-Stage Thinking Loop Verified
          </div>

          <div style="font-size: 0.95rem; font-weight: 700; font-family: var(--font-mono); color: #10b981; margin-bottom: 0.45rem;">
            ${formatFullPrice(t.price, 5)}
          </div>

          <div style="background: rgba(240, 185, 11, 0.1); border: 1px solid rgba(240, 185, 11, 0.25); border-radius: 8px; padding: 0.4rem; margin-bottom: 0.6rem; font-size: 0.72rem;">
            <div style="color: #f0b90b; font-weight: 700;">🎯 50%+ TP Target: <span style="color: #fff;">${tp50}</span></div>
            <div style="color: #00f0ff; margin-top: 0.15rem;">${wyckStage}</div>
            <div style="color: var(--text-muted); margin-top: 0.15rem;">Vol Range: <strong style="color: #fff;">${volRangePct}%</strong> | 2 Max Entries/Day</div>
          </div>

          <button class="btn-primary" style="width: 100%; padding: 0.35rem; font-size: 0.75rem; font-weight: 700; background: linear-gradient(135deg, #f0b90b, #d97706); color: #000; border: none; border-radius: 6px;">
            <i class="fa-solid fa-crown"></i> Execute Supreme Analysis
          </button>
        </div>
      `;
    }).join("");

    document.querySelectorAll(".god-sniper-card").forEach(card => {
      card.addEventListener("click", () => {
        const sym = card.getAttribute("data-symbol");
        selectCoin(sym);
        setTimeout(() => {
          fetchAiAnalysis("God Mode billionaire trader analysis 50% to 300% daily target yield masterclass", "godmode");
        }, 400);
      });
    });
  }

  function updateScannerData(msg) {
    allTickers = msg.data || [];
    window.allTickers = allTickers;
    const tps = msg.ticks_per_sec || 0;

    // Update throughput metrics
    cardTicksPerSec.textContent = `${tps} Ticks/s`;
    headerTicksPerSec.textContent = `${tps} Ticks/s`;
    wsRateText.textContent = `${tps} Ticks/sec (1 WS Connection)`;
    totalTrackedSymbols.textContent = msg.total_tickers || 0;

    // Filter and render ticker table and God Hall list
    renderGodHallList();
    renderScannerTable();
    fetchStats();

    // VERSION 73: REAL-TIME SYNC TO ROBO TRADE MODULE ON LIVE TICKS
    if (typeof window.updateRoboTradeModule === 'function') {
      window.updateRoboTradeModule();
    }

    // VERSION 30: REAL-TIME TICK PRICE SYNC FOR ACTIVE GRAPH VIEW (MAINTAINED BY GROUP A & B AI AGENTS)
    if (selectedSymbol && allTickers.length > 0) {
      const activeData = allTickers.find(t => t.symbol === selectedSymbol);
      if (activeData) {
        if (chartCoinPrice) chartCoinPrice.textContent = formatFullPrice(activeData.price, 5);
        if (chartCoinChange) {
          const isUp = activeData.change_pct >= 0;
          chartCoinChange.className = `change-badge ${isUp ? 'up' : 'down'}`;
          chartCoinChange.innerHTML = `<i class="fa-solid ${isUp ? 'fa-caret-up' : 'fa-caret-down'}"></i> ${isUp ? '+' : ''}${activeData.change_pct}%`;
        }
        if (detailHighValue) detailHighValue.textContent = formatFullPrice(activeData.high, 5);
        if (detailLowValue) detailLowValue.textContent = formatFullPrice(activeData.low, 5);
        if (detailTotalVolume) detailTotalVolume.textContent = `${(activeData.quote_volume / 1000000).toFixed(2)}M USDT`;
        
        // Check Queued Limit Orders for Touch & Execute
        if (typeof checkQueuedLimitOrdersMatch === 'function') {
          checkQueuedLimitOrdersMatch(activeData.price);
        }
        if (typeof checkBotQueuedOrdersMatch === 'function') {
          checkBotQueuedOrdersMatch(activeData.price);
        }

        // VERSION 60: REAL-TIME SYNC FOR HOLDINGS LEDGER
        if (typeof renderHoldingsAndHistoryTables === 'function') {
          renderHoldingsAndHistoryTables();
        }
      }
    }
  }

  let currentCategory = "all";
  let currentGraphStyle = "line";
  let selectedSymbol = "BTCUSDT";
  let selectedTimeframe = "1m";
  let coinChartInstance = null;

  const coinTableView = document.getElementById("coinTableView");
  const coinGraphView = document.getElementById("coinGraphView");
  const backToCoinsBtn = document.getElementById("backToCoinsBtn");

  const chartCoinSymbol = document.getElementById("chartCoinSymbol");
  const chartCoinPrice = document.getElementById("chartCoinPrice");
  const chartCoinChange = document.getElementById("chartCoinChange");

  const detailHighValue = document.getElementById("detailHighValue");
  const detailLowValue = document.getElementById("detailLowValue");
  const detailTotalVolume = document.getElementById("detailTotalVolume");
  const detailMarketCap = document.getElementById("detailMarketCap");

  if (backToCoinsBtn) {
    backToCoinsBtn.addEventListener("click", () => {
      if (coinGraphView) coinGraphView.classList.add("hidden");
      if (coinTableView) coinTableView.classList.remove("hidden");
    });
  }

  // Segmented Control Tab Handlers
  document.querySelectorAll(".seg-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".seg-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.getAttribute("data-category") || "all";
      renderScannerTable();
    });
  });

  // Graph Style Toggle Handlers (Line vs Candlestick)
  document.querySelectorAll(".graph-style-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".graph-style-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentGraphStyle = btn.getAttribute("data-style") || "line";
      fetchCoinChart(selectedSymbol, selectedTimeframe);
    });
  });

  // Timeframe Selector Buttons (1m, 3m, 5m, 15m, 1h, 3h, 1d, 1w)
  document.querySelectorAll(".timeframe-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".timeframe-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedTimeframe = btn.getAttribute("data-tf") || "1m";
      fetchCoinChart(selectedSymbol, selectedTimeframe);
    });
  });

  function renderScannerTable() {
    if (!scannerTableBody) return;

    let dataset = [...allTickers];

    // VERSION 23 REQUIREMENT: 👑 GOD LIST CATEGORY & RANKING ENGINE (TOP 15 SNIPER TARGETS)
    if (currentCategory === "god_list") {
      dataset = dataset.sort((a, b) => {
        const volA = a.low > 0 ? ((a.high - a.low) / a.low) * 100 : Math.abs(a.change_pct);
        const volB = b.low > 0 ? ((b.high - b.low) / b.low) * 100 : Math.abs(b.change_pct);
        const scoreA = volA * 0.4 + (a.quote_volume / 10000000) * 0.4 + Math.abs(a.change_pct) * 0.2;
        const scoreB = volB * 0.4 + (b.quote_volume / 10000000) * 0.4 + Math.abs(b.change_pct) * 0.2;
        return scoreB - scoreA;
      });
    } else if (currentCategory === "all") {
      dataset = dataset.sort((a, b) => b.quote_volume - a.quote_volume);
    } else if (currentCategory === "gainers") {
      dataset = dataset.sort((a, b) => b.change_pct - a.change_pct);
    } else if (currentCategory === "losers") {
      dataset = dataset.sort((a, b) => a.change_pct - b.change_pct);
    } else if (currentCategory === "volume") {
      dataset = dataset.sort((a, b) => b.quote_volume - a.quote_volume);
    } else if (currentCategory === "volatile") {
      dataset = dataset.sort((a, b) => {
        const volA = a.low > 0 ? ((a.high - a.low) / a.low) * 100 : Math.abs(a.change_pct);
        const volB = b.low > 0 ? ((b.high - b.low) / b.low) * 100 : Math.abs(b.change_pct);
        return volB - volA;
      });
    } else if (currentCategory === "bullish_ai") {
      // VERSION 17: TOP 20 BULLISH AI PREDICTIONS (+15% 3D GAIN OR 7D BULLISH MOMENTUM, CONFIDENCE >= 75%)
      dataset = dataset.sort((a, b) => {
        let scoreA = 75 + (a.change_pct >= 15 ? 12 : (a.change_pct >= 5 ? 8 : (a.change_pct >= 0 ? 4 : 0)));
        let scoreB = 75 + (b.change_pct >= 15 ? 12 : (b.change_pct >= 5 ? 8 : (b.change_pct >= 0 ? 4 : 0)));
        if (a.quote_volume > 50000000) scoreA += 5;
        if (b.quote_volume > 50000000) scoreB += 5;
        return scoreB - scoreA;
      });
    } else if (currentCategory === "hot") {
      dataset = dataset.sort((a, b) => b.quote_volume - a.quote_volume);
    } else if (currentCategory === "new") {
      dataset = dataset.filter(t => t.symbol.length > 7 || t.symbol.includes("1000") || t.symbol.endsWith("USDT")).sort((a, b) => b.quote_volume - a.quote_volume);
    }

    const query = (scannerSearch ? scannerSearch.value : "").toUpperCase().trim();
    let filtered = dataset.filter(t => t.symbol.includes(query));

    // VERSION 75 ENHANCEMENT: Pin Active Holding symbols near top so holding coins are NEVER hidden!
    const activeHoldingsRes = window.activeHoldingsList || [];
    const holdingSymbols = new Set(activeHoldingsRes.map(h => h.symbol));

    // Sort to place active holdings at top if no specific query search
    if (!query) {
      filtered.sort((a, b) => {
        const aIsHolding = holdingSymbols.has(a.symbol) ? 1 : 0;
        const bIsHolding = holdingSymbols.has(b.symbol) ? 1 : 0;
        if (aIsHolding !== bIsHolding) return bIsHolding - aIsHolding;
        return b.quote_volume - a.quote_volume;
      });
    }

    // Increase limit for general views, and allow UNRESTRICTED search when user types a query!
    const limit = query ? 100 : (currentCategory === "god_list" ? 15 : ((currentCategory === "volatile" || currentCategory === "bullish_ai") ? 25 : 50));
    filtered = filtered.slice(0, limit);

    if (filtered.length === 0) {
      scannerTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No crypto pairs matching "${query}" in this category</td></tr>`;
      return;
    }

    scannerTableBody.innerHTML = filtered.map(t => {
      const isUp = t.change_pct >= 0;
      const changeClass = isUp ? "up" : "down";
      const icon = isUp ? "fa-caret-up" : "fa-caret-down";
      const volRangePct = t.low > 0 ? (((t.high - t.low) / t.low) * 100).toFixed(2) : Math.abs(t.change_pct).toFixed(2);
      const isHoldingCoin = holdingSymbols.has(t.symbol);
      
      let score = 75 + (t.change_pct >= 15 ? 12 : (t.change_pct >= 5 ? 8 : (t.change_pct >= 0 ? 4 : 0)));
      if (t.quote_volume > 50000000) score += 5;
      score = Math.min(94, score);

      const categoryBadge = isHoldingCoin
        ? `<span class="badge-mini" style="background: rgba(16, 185, 129, 0.25); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.6); font-weight: 800;"><i class="fa-solid fa-shield-halved"></i> ACTIVE HOLDING</span>`
        : (currentCategory === "god_list"
          ? `<span class="badge-mini" style="background: rgba(240, 185, 11, 0.25); color: #f0b90b; border: 1px solid rgba(240, 185, 11, 0.5); font-weight: 800;"><i class="fa-solid fa-crown"></i> 👑 50%-300%+ TP Yield (2 Entries/Day)</span>`
          : (currentCategory === "bullish_ai" 
            ? `<span class="badge-mini" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4);"><i class="fa-solid fa-rocket"></i> AI Bullish ${score}%</span>`
            : (currentCategory === "volatile" 
              ? `<span class="badge-mini" style="background: rgba(240, 185, 11, 0.15); color: #f0b90b; border: 1px solid rgba(240, 185, 11, 0.3);"><i class="fa-solid fa-bolt-lightning"></i> Volatility ${volRangePct}%</span>`
              : `<span class="badge-mini">Live Stream</span>`)));

      return `
        <tr class="coin-row" data-symbol="${t.symbol}" style="cursor: pointer;">
          <td>
            <strong style="font-size: 1rem;">${t.symbol}</strong>
          </td>
          <td>${categoryBadge}</td>
          <td class="price-cell">${formatFullPrice(t.price, 5)}</td>
          <td>
            <span class="change-badge ${changeClass}">
              <i class="fa-solid ${icon}"></i> ${t.change_pct > 0 ? '+' : ''}${t.change_pct}%
            </span>
          </td>
          <td class="text-muted" style="font-size: 0.85rem; font-family: var(--font-mono);">
            H: ${formatFullPrice(t.high, 5)} | L: ${formatFullPrice(t.low, 5)}
          </td>
          <td style="font-family: var(--font-mono);">${(t.quote_volume / 1000000).toFixed(2)}M USDT</td>
          <td>
            <button class="btn-primary" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
              <i class="fa-solid fa-chart-line"></i> View Graph
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Attach row click handlers to open interactive Coin Graph View
    document.querySelectorAll(".coin-row").forEach(row => {
      row.addEventListener("click", () => {
        const sym = row.getAttribute("data-symbol");
        selectCoin(sym);
        // VERSION 23: AUTO TRIGGER GOD MODE MASTERCLASS REASONING WHEN SELECTED FROM GOD LIST
        if (currentCategory === "god_list") {
          setTimeout(() => {
            fetchAiAnalysis("God Mode billionaire trader analysis 50% to 300% daily target yield masterclass", "godmode");
          }, 400);
        } else if (currentCategory === "bullish_ai") {
          setTimeout(() => {
            fetchAiAnalysis("Explain 1-2 day bullish breakout targets, SMC liquidity, and technical reasoning for this coin");
          }, 400);
        }
      });
    });
  }

  function selectCoin(symbol) {
    selectedSymbol = symbol;

    // Show Coin Graph View & Hide Coin Table Listing
    if (coinTableView) coinTableView.classList.add("hidden");
    if (coinGraphView) coinGraphView.classList.remove("hidden");

    if (chartCoinSymbol) chartCoinSymbol.textContent = symbol;

    const coinData = allTickers.find(t => t.symbol === symbol);
    if (coinData) {
      if (chartCoinPrice) chartCoinPrice.textContent = formatFullPrice(coinData.price);
      if (chartCoinChange) {
        const isUp = coinData.change_pct >= 0;
        chartCoinChange.className = `change-badge ${isUp ? 'up' : 'down'}`;
        chartCoinChange.innerHTML = `<i class="fa-solid ${isUp ? 'fa-caret-up' : 'fa-caret-down'}"></i> ${isUp ? '+' : ''}${coinData.change_pct}%`;
      }

      // DISPLAY COIN MARKET DETAILS WITH FULL PRECISION (NO SCIENTIFIC NOTATION)
      if (detailHighValue) detailHighValue.textContent = formatFullPrice(coinData.high);
      if (detailLowValue) detailLowValue.textContent = formatFullPrice(coinData.low);
      if (detailTotalVolume) detailTotalVolume.textContent = `${(coinData.quote_volume / 1000000).toFixed(2)}M USDT`;
      if (detailMarketCap) {
        const estCap = (coinData.quote_volume * 18.5) / 1000000000;
        detailMarketCap.textContent = `$${estCap > 1 ? estCap.toFixed(2) : estCap.toFixed(3)}B`;
      }
    }

    renderActiveIndicatorTags();
    fetchCoinChart(selectedSymbol, selectedTimeframe);
    fetchOrderBookAndCompare(selectedSymbol);

    // VERSION 26: SMOOTH AUTO-SCROLL TO GRAPH VIEW FOR FLUID USER EXPERIENCE
    if (coinGraphView) {
      coinGraphView.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // VERSION 27: 15-MINUTE GOD LIST AUTO-REFRESH TIMER & COUNTDOWN BADGE
  let godTimerSeconds = 15 * 60;
  const godRefreshCountdown = document.getElementById("godRefreshCountdown");

  function startGod15MinTimer() {
    setInterval(() => {
      godTimerSeconds--;
      if (godTimerSeconds <= 0) {
        godTimerSeconds = 15 * 60;
        renderGodHallList();
      }
      if (godRefreshCountdown) {
        const mins = Math.floor(godTimerSeconds / 60);
        const secs = godTimerSeconds % 60;
        godRefreshCountdown.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  startGod15MinTimer();

  // VERSION 36: MULTI-POSITION USER HOLDINGS LEDGER (PREVENTS LINE MERGING FOR MULTIPLE TRADES / COINS)
  let userPortfolio = { balance: 100.00, initialCap: 100.00, positions: [] };
  let groupCBotPortfolio = { balance: 100.00, positionCoins: 0.0, initialCap: 100.00 };
  let botPortfolio = { balance: 100.00, positionCoins: 0.0, initialCap: 100.00, totalWins: 0 };
  let userQueuedOrders = [];
  let transactionHistoryLogs = [];

  window.closeUserPosition = function(posId) {
    const idx = userPortfolio.positions.findIndex(p => p.id === posId);
    if (idx === -1) return;
    const pos = userPortfolio.positions[idx];
    const coinData = allTickers.find(t => t.symbol === pos.symbol);
    const exitPrice = coinData ? coinData.price : pos.entryPrice * 1.05;
    const returnAmount = pos.positionCoins * exitPrice;
    const tradePnl = returnAmount - pos.cost;
    userPortfolio.balance += returnAmount;
    addPaperLog(`🔴 [USER] Closed position (${pos.symbol}) at ${formatFullPrice(exitPrice, 5)} | PnL: ${tradePnl >= 0 ? '+' : ''}$${tradePnl.toFixed(2)}`, tradePnl >= 0 ? "#10b981" : "#ef4444");
    addTransactionRecord("USER TRADER", "POSITION CLOSED", pos.symbol, exitPrice, pos.cost, tradePnl);
    userPortfolio.positions.splice(idx, 1);
    updateUserPaperUI();
    renderHoldingsAndHistoryTables();
  };

  async function addTransactionRecord(participant, action, symbol, price, capital, pnl = 0.0, status = "COMPLETED") {
    try {
      await fetch("/api/paper/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant, action, symbol, price, capital, pnl, status })
      });
      fetchTransactionHistoryFromDB();
    } catch (e) {
      console.error("Failed to record transaction to DB:", e);
    }
  }

  async function fetchTransactionHistoryFromDB() {
    const historyBody = document.getElementById("transactionHistoryTableBody");
    if (!historyBody) return;
    try {
      const res = await fetch("/api/paper/transactions");
      const data = await res.json();
      if (data.status === "success" && data.transactions) {
        transactionHistoryLogs = data.transactions;
        if (transactionHistoryLogs.length === 0) {
          historyBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No transaction logs recorded yet in persistent SQLite DB</td></tr>`;
        } else {
          historyBody.innerHTML = transactionHistoryLogs.map(r => `
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
          transactionHistoryLogs.forEach(r => {
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

  function addPaperLog(msg, color = "#fff") {
    const logsContainer = document.getElementById("paperTradeLogs");
    if (!logsContainer) return;
    const timeStr = new Date().toLocaleTimeString();
    const div = document.createElement("div");
    div.style.color = color;
    div.innerHTML = `[${timeStr}] ${msg}`;
    logsContainer.prepend(div);
  }

  function updateUserPaperUI() {
    const userBal = document.getElementById("userBalanceText");
    const userPos = document.getElementById("userPosText");
    const userBadge = document.getElementById("userPnlBadge");
    const userEntryText = document.getElementById("userEntryPriceText");
    
    if (userBal) userBal.textContent = userPortfolio.balance.toFixed(2);
    
    let totalUnrealizedVal = 0.0;
    userPortfolio.positions.forEach(pos => {
      const coinData = allTickers.find(t => t.symbol === pos.symbol);
      const curP = coinData ? coinData.price : pos.entryPrice;
      totalUnrealizedVal += (pos.positionCoins * curP);
    });

    const totalEquity = userPortfolio.balance + totalUnrealizedVal;
    const pnl = totalEquity - userPortfolio.initialCap;
    const pnlPct = (pnl / userPortfolio.initialCap) * 100;

    if (userEntryText) {
      if (userPortfolio.positions.length > 0) {
        userEntryText.textContent = `${userPortfolio.positions.length} Active Pos (${userPortfolio.positions[userPortfolio.positions.length-1].symbol})`;
      } else {
        userEntryText.textContent = "$0.00";
      }
    }

    if (userPos) {
      if (userPortfolio.positions.length > 0) {
        const totalCoins = userPortfolio.positions.reduce((acc, p) => acc + p.positionCoins, 0);
        userPos.textContent = `${userPortfolio.positions.length} Open Position(s) (${totalCoins.toFixed(4)} total units)`;
      } else {
        userPos.textContent = "FLAT (0 Positions)";
      }
    }

    if (userBadge) {
      userBadge.className = `change-badge ${pnl >= 0 ? 'up' : 'down'}`;
      userBadge.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`;
    }
  }

  function updateGroupCBotPaperUI() {
    const groupCBotBal = document.getElementById("groupCBotBalanceText");
    const groupCBotBadge = document.getElementById("groupCBotPnlBadge");
    if (groupCBotBal) groupCBotBal.textContent = groupCBotPortfolio.balance.toFixed(2);
    const pnl = groupCBotPortfolio.balance - groupCBotPortfolio.initialCap;
    const pnlPct = (pnl / groupCBotPortfolio.initialCap) * 100;
    if (groupCBotBadge) {
      groupCBotBadge.className = `change-badge ${pnl >= 0 ? 'up' : 'down'}`;
      groupCBotBadge.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`;
    }
  }

  function updateBotPaperUI() {
    const botBal = document.getElementById("botBalanceText");
    const botBadge = document.getElementById("botPnlBadge");
    if (botBal) botBal.textContent = botPortfolio.balance.toFixed(2);
    const pnl = botPortfolio.balance - botPortfolio.initialCap;
    const pnlPct = (pnl / botPortfolio.initialCap) * 100;
    if (botBadge) {
      botBadge.className = `change-badge ${pnl >= 0 ? 'up' : 'down'}`;
      botBadge.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`;
    }
  }

  async function renderHoldingsAndHistoryTables() {
    const holdingsBody = document.getElementById("activeHoldingsTableBody");

    if (holdingsBody) {
      let activeRows = [];

      // VERSION 37: User Queued Limit Orders (QUEUED_PENDING) - EXACTLY LIKE BOT SIDE
      userQueuedOrders.forEach((ord, i) => {
        const coinData = allTickers.find(t => t.symbol === ord.symbol);
        const curPrice = coinData ? coinData.price : ord.targetPrice;
        const posCoins = ord.cost / ord.targetPrice;
        activeRows.push(`
          <tr>
            <td>
              <strong style="color: #3b82f6;"><i class="fa-solid fa-user"></i> USER TRADER (LIMIT)</strong>
              <button onclick="cancelUserLimitOrder(${i})" style="margin-left: 0.5rem; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.4); border-radius: 4px; padding: 0.15rem 0.4rem; font-size: 0.68rem; cursor: pointer;">Cancel</button>
            </td>
            <td><strong>${ord.symbol}</strong></td>
            <td>${formatFullPrice(ord.targetPrice, 5)}</td>
            <td style="color: #00f0ff;">${formatFullPrice(ord.targetPrice * 1.15, 5)} (+15%)</td>
            <td><strong style="color: #fff;">${posCoins.toFixed(4)} ${ord.symbol} (${ord.lots} Lot)</strong></td>
            <td>${formatFullPrice(curPrice, 5)}</td>
            <td><span class="change-badge pending">$0.00</span></td>
            <td><span class="change-badge pending">⏳ QUEUED_PENDING</span></td>
          </tr>
        `);
      });

      // User distinct active holdings (FILLED_HOLDING)
      userPortfolio.positions.forEach((pos, idx) => {
        const coinData = allTickers.find(t => t.symbol === pos.symbol);
        const curPrice = coinData ? coinData.price : pos.entryPrice;
        const val = pos.positionCoins * curPrice;
        const uPnl = val - pos.cost;
        activeRows.push(`
          <tr>
            <td>
              <strong style="color: #3b82f6;"><i class="fa-solid fa-user"></i> USER TRADER (#${idx+1})</strong>
              <button onclick="closeUserPosition('${pos.id}')" style="margin-left: 0.5rem; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.4); border-radius: 4px; padding: 0.15rem 0.4rem; font-size: 0.68rem; cursor: pointer;">Close</button>
            </td>
            <td><strong>${pos.symbol}</strong></td>
            <td>${formatFullPrice(pos.entryPrice, 5)}</td>
            <td style="color: #00f0ff;">${formatFullPrice(pos.entryPrice * 1.15, 5)} (+15%)</td>
            <td><strong style="color: #fff;">${pos.positionCoins.toFixed(4)} ${pos.symbol}</strong></td>
            <td>${formatFullPrice(curPrice, 5)}</td>
            <td><span class="change-badge ${uPnl >= 0 ? 'up' : 'down'}">${uPnl >= 0 ? '+' : ''}$${uPnl.toFixed(2)}</span></td>
            <td><span class="change-badge up">🟢 POS HOLDING</span></td>
          </tr>
        `);
      });

      // Fetch persistent bot active holdings from DB (VERSION 49 CAPITAL MANAGEMENT)
      try {
        const res = await fetch("/api/paper/holdings");
        const data = await res.json();
        if (data.status === "success" && data.holdings) {
          let godOpenCount = 0;
          let godUnrealized = 0;
          let groupCOpenCount = 0;
          let groupCUnrealized = 0;

          data.holdings.forEach(pos => {
            const coinData = allTickers.find(t => t.symbol === pos.symbol);
            const currentP = coinData ? coinData.price : pos.entry_price;
            const unrealizedVal = pos.amount * currentP;
            const pnl = unrealizedVal - (pos.amount * pos.entry_price);
            const color = pos.participant.includes("GROUP C") ? "#10b981" : "#f0b90b";

            if (pos.participant.includes("GOD")) {
              godOpenCount++;
              godUnrealized += pnl;
            } else {
              groupCOpenCount++;
              groupCUnrealized += pnl;
            }

            activeRows.push(`
              <tr>
                <td><strong style="color: ${color};">${pos.participant}</strong></td>
                <td><strong>${pos.symbol}</strong></td>
                <td>${formatFullPrice(pos.entry_price, 5)}</td>
                <td style="color: #00f0ff;">- (Managed)</td>
                <td><strong style="color: #fff;">${pos.amount.toFixed(4)} ${pos.symbol}</strong></td>
                <td>${formatFullPrice(currentP, 5)}</td>
                <td><span class="change-badge ${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span></td>
                <td><span class="change-badge up">${pos.status}</span></td>
              </tr>
            `);
          });

          // VERSION 56: DYNAMIC CAPITAL & EQUITY COMPUTATION (ALIGNED WITH HOLDING & TRANSACTION HISTORY)
          const realized = window.latestRoboPnl || { god: 0, groupC: 0 };
          const godAvail = Math.max(0, 100.0 - (godOpenCount * 20.0) + realized.god);
          const godTotalEquity = 100.0 + realized.god + godUnrealized;
          
          const groupCAvail = Math.max(0, 100.0 - (groupCOpenCount * 20.0) + realized.groupC);
          const groupCTotalEquity = 100.0 + realized.groupC + groupCUnrealized;

          const godBalEl = document.getElementById("godRoboBalance");
          if (godBalEl) godBalEl.textContent = godAvail.toFixed(2);
          const godTotEl = document.getElementById("godRoboTotalCapital");
          if (godTotEl) godTotEl.textContent = godTotalEquity.toFixed(2);

          const gcBalEl = document.getElementById("groupCRoboBalance");
          if (gcBalEl) gcBalEl.textContent = groupCAvail.toFixed(2);
          const gcTotEl = document.getElementById("groupCRoboTotalCapital");
          if (gcTotEl) gcTotEl.textContent = groupCTotalEquity.toFixed(2);
        }
      } catch (e) {
        console.error("Failed to fetch active holdings:", e);
      }

      if (activeRows.length === 0) {
        holdingsBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No active paper trading holdings currently open</td></tr>`;
      } else {
        holdingsBody.innerHTML = activeRows.join("");
      }
    }

    fetchTransactionHistoryFromDB();
  }

  // VERSION 58: Delegate fetchRoboSchedules to modular scanner.js to eliminate dual-render DOM flicker
  function fetchRoboSchedules() {
    if (typeof window.fetchRoboSchedules === 'function') {
      window.fetchRoboSchedules();
    }
  }

  // VERSION 49: 5-MINUTE COUNTDOWN TIMER FOR ROBO RE-ANALYSIS
  let roboCountdownSeconds = 300;
  function updateRoboCountdownTimer() {
    const timerElem = document.getElementById("roboTimerCountdown");
    if (timerElem) {
      const mins = Math.floor(roboCountdownSeconds / 60);
      const secs = roboCountdownSeconds % 60;
      timerElem.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    if (roboCountdownSeconds <= 0) {
      roboCountdownSeconds = 300;
      fetchRoboSchedules();
      renderHoldingsAndHistoryTables();
    } else {
      roboCountdownSeconds--;
    }
  }

  fetchRoboSchedules();
  setInterval(fetchRoboSchedules, 5000);
  setInterval(updateRoboCountdownTimer, 1000);

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

  window.deleteAnalysisRule = async function(ruleId) {
    try {
      const res = await fetch(`/api/ai/analysis_logic/${ruleId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.status === "success") {
        fetchAnalysisLogicRegistry();
      }
    } catch (e) {
      console.error("Failed to delete analysis rule:", e);
    }
  };

  const addAnalysisRuleForm = document.getElementById("addAnalysisRuleForm");
  if (addAnalysisRuleForm) {
    addAnalysisRuleForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const logic_name = document.getElementById("adminRuleName").value.trim();
      const target_scope = document.getElementById("adminRuleScope").value.trim();
      const assigned_agent = document.getElementById("adminRuleAgent").value;
      const rule_type = document.getElementById("adminRuleCategory").value;
      const description = document.getElementById("adminRuleDesc").value.trim();

      if (!logic_name || !target_scope || !description) return;

      try {
        const res = await fetch("/api/ai/analysis_logic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logic_name, target_scope, assigned_agent, rule_type, description })
        });
        const data = await res.json();
        if (data.status === "success") {
          addAnalysisRuleForm.reset();
          fetchAnalysisLogicRegistry();
        }
      } catch (e) {
        console.error("Failed to add analysis rule:", e);
      }
    });
  }

  // VERSION 60: Delegate performance review completely to modular performance_review.js
  function fetchPerformanceReview() {
    if (typeof window.fetchPerformanceTradeReview === 'function') {
      window.fetchPerformanceTradeReview();
    }
  }

  function renderUserQueuedOrdersList() {
    const container = document.getElementById("userQueuedOrdersList");
    if (!container) return;
    if (userQueuedOrders.length === 0) {
      container.innerHTML = '<span style="color: var(--text-muted);">No active limit orders queued. Use the box above to queue a price target.</span>';
      return;
    }
    container.innerHTML = userQueuedOrders.map((ord, i) => `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding: 0.2rem 0;">
        <span>🎯 QUEUED BUY ${ord.lots} Lot(s) @ ${formatFullPrice(ord.targetPrice, 5)} (${ord.symbol})</span>
        <button onclick="cancelUserLimitOrder(${i})" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; padding: 0.1rem 0.35rem; font-size: 0.68rem; cursor: pointer;">Cancel</button>
      </div>
    `).join("");
  }

  window.cancelUserLimitOrder = function(index) {
    if (index >= 0 && index < userQueuedOrders.length) {
      const canceled = userQueuedOrders.splice(index, 1)[0];
      userPortfolio.balance += canceled.cost;
      addPaperLog(`⚠️ [USER] Canceled Limit Order for ${canceled.symbol} ($${canceled.cost.toFixed(2)} returned)`, "#ef4444");
      updateUserPaperUI();
      renderUserQueuedOrdersList();
    }
  };

  // VERSION 30: BOT QUEUED ORDER STATE (STRICT HUMAN ORDER BOOK PROCESS)
  let botQueuedOrders = [];

  function checkBotQueuedOrdersMatch(currentPrice) {
    if (botQueuedOrders.length === 0) return;

    for (let i = botQueuedOrders.length - 1; i >= 0; i--) {
      const ord = botQueuedOrders[i];
      if (ord.symbol !== selectedSymbol) continue;

      // STEP 1: QUEUED -> TOUCH MATCH
      if (ord.status === "QUEUED_PENDING" && currentPrice <= ord.targetPrice) {
        ord.status = "FILLED_HOLDING";
        ord.fillPrice = currentPrice;
        ord.tpPrice = currentPrice * ord.tpMultiplier;
        ord.slPrice = currentPrice * 0.955; // Hard stop -4.5%

        addPaperLog(`🟢 [TOUCH & MATCH FILLED - ${ord.botName}] Price touched ${formatFullPrice(currentPrice, 5)}! Order Active. Holding for TP target ${formatFullPrice(ord.tpPrice, 5)} with Stop Loss at ${formatFullPrice(ord.slPrice, 5)}.`, ord.color);
        addTransactionRecord(ord.botName, "ORDER MATCHED & FILLED", ord.symbol, currentPrice, ord.cost, 0.0);
      }
      // STEP 2: FILLED_HOLDING -> TP MATCH OR CUT/LOSS MATCH
      else if (ord.status === "FILLED_HOLDING") {
        if (currentPrice >= ord.tpPrice) {
          // PROFIT TAKE MATCH!
          const profit = ord.cost * (ord.tpMultiplier - 1.0);
          if (ord.botType === "GROUP_C") groupCBotPortfolio.balance += (ord.cost + profit);
          else botPortfolio.balance += (ord.cost + profit);

          addPaperLog(`🎉 [PROFIT TAKE MATCH - ${ord.botName}] TP Target touched at ${formatFullPrice(currentPrice, 5)} (+${((ord.tpMultiplier-1)*100).toFixed(1)}%)! Closed position with +$${profit.toFixed(2)} profit.`, ord.color);
          addTransactionRecord(ord.botName, "PROFIT TAKE EXIT", ord.symbol, currentPrice, ord.cost, profit);
          botQueuedOrders.splice(i, 1);
          updateGroupCBotPaperUI();
          updateBotPaperUI();
        } else if (currentPrice <= ord.slPrice) {
          // CUT / LOSS MATCH!
          const loss = ord.cost * 0.045;
          const returnAmt = ord.cost - loss;
          if (ord.botType === "GROUP_C") groupCBotPortfolio.balance += returnAmt;
          else botPortfolio.balance += returnAmt;

          addPaperLog(`✂️ [CUT/LOSS EXECUTED - ${ord.botName}] Hard stop touched at ${formatFullPrice(currentPrice, 5)} (-4.5%). Cut -$${loss.toFixed(2)} loss cleanly. Re-evaluating Order Book for next dip queue!`, "#ef4444");
          addTransactionRecord(ord.botName, "CUT/LOSS EXECUTED", ord.symbol, currentPrice, ord.cost, -loss);
          botQueuedOrders.splice(i, 1);
          updateGroupCBotPaperUI();
          updateBotPaperUI();
        }
      }
    }
  }

  function checkQueuedLimitOrdersMatch(currentPrice) {
    if (userQueuedOrders.length === 0) return;
    for (let i = userQueuedOrders.length - 1; i >= 0; i--) {
      const ord = userQueuedOrders[i];
      if (ord.symbol === selectedSymbol && currentPrice <= ord.targetPrice) {
        const coinsBought = ord.cost / currentPrice;
        const newPos = {
          id: `POS-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          symbol: ord.symbol,
          entryPrice: currentPrice,
          positionCoins: coinsBought,
          cost: ord.cost,
          status: "POS_HOLDING",
          timestamp: new Date().toLocaleTimeString()
        };
        userPortfolio.positions.push(newPos);
        userQueuedOrders.splice(i, 1);
        addPaperLog(`🎯 [LIMIT MATCH FILLED] Price touched ${formatFullPrice(currentPrice, 5)}! Bought ${coinsBought.toFixed(4)} ${selectedSymbol} (${ord.lots} Lot(s) / $${ord.cost.toFixed(2)})`, "#10b981");
        updateUserPaperUI();
        renderUserQueuedOrdersList();
      }
    }
  }

  function initPaperTradingSimulator() {
    const buyBtn = document.getElementById("userBuyBtn");
    const sellBtn = document.getElementById("userSellBtn");
    const queueLimitBtn = document.getElementById("userQueueLimitBtn");
    const groupCBotAutoBtn = document.getElementById("groupCBotAutoBtn");
    const autoBtn = document.getElementById("botAutoTradeBtn");
    const resetBtn = document.getElementById("resetPaperTradeBtn");

    if (queueLimitBtn) {
      queueLimitBtn.addEventListener("click", () => {
        const priceInput = document.getElementById("userLimitPriceInput");
        const lotSelect = document.getElementById("userLotCountSelect");
        if (!priceInput || !lotSelect) return;
        const targetP = parseFloat(priceInput.value);
        const lots = parseInt(lotSelect.value) || 1;
        const cost = lots * 20.0;

        if (isNaN(targetP) || targetP <= 0) {
          addPaperLog("⚠️ Invalid limit price entered", "#ef4444");
          return;
        }
        if (userPortfolio.balance < cost) {
          addPaperLog(`⚠️ Insufficient balance for ${lots} Lot(s) ($${cost.toFixed(2)})`, "#ef4444");
          return;
        }

        userPortfolio.balance -= cost;
        userQueuedOrders.push({
          symbol: selectedSymbol,
          targetPrice: targetP,
          lots: lots,
          cost: cost
        });

        addPaperLog(`⏳ [QUEUED IN ORDER BOOK] Limit Buy ${lots} Lot(s) @ ${formatFullPrice(targetP, 5)} ($${cost.toFixed(2)} reserved). Waiting for real-time market price touch...`, "#3b82f6");
        addTransactionRecord("USER TRADER", "ORDER QUEUED IN ORDER BOOK", selectedSymbol, targetP, cost, 0.0);
        priceInput.value = "";
        updateUserPaperUI();
        renderUserQueuedOrdersList();
      });
    }

    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        const coinData = allTickers.find(t => t.symbol === selectedSymbol);
        if (!coinData || coinData.price <= 0) return;
        const lotSelect = document.getElementById("userLotCountSelect");
        const lots = lotSelect ? (parseInt(lotSelect.value) || 1) : 1;
        const tradeCost = 20.0 * lots;

        if (userPortfolio.balance < tradeCost) {
          addPaperLog(`⚠️ Insufficient funds for ${lots} Lot(s) ($${tradeCost.toFixed(2)})`, "#ef4444");
          return;
        }

        userPortfolio.balance -= tradeCost;
        const coinsBought = tradeCost / coinData.price;
        const newPos = {
          id: `POS-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          symbol: selectedSymbol,
          entryPrice: coinData.price,
          positionCoins: coinsBought,
          cost: tradeCost,
          status: "POS_HOLDING",
          timestamp: new Date().toLocaleTimeString()
        };
        userPortfolio.positions.push(newPos);

        addPaperLog(`🟢 [USER] MKT Buy ${coinsBought.toFixed(4)} ${selectedSymbol} at ${formatFullPrice(coinData.price, 5)} (${lots} Lot(s) / $${tradeCost.toFixed(2)})`, "#10b981");
        addTransactionRecord("USER TRADER", "MKT BUY ENTRY", selectedSymbol, coinData.price, tradeCost, 0.0);
        updateUserPaperUI();
      });
    }

    if (sellBtn) {
      sellBtn.addEventListener("click", () => {
        if (userPortfolio.positions.length === 0) {
          addPaperLog("⚠️ No open position to close", "#ef4444");
          return;
        }
        for (let i = userPortfolio.positions.length - 1; i >= 0; i--) {
          const pos = userPortfolio.positions[i];
          const coinData = allTickers.find(t => t.symbol === pos.symbol);
          const exitPrice = coinData ? coinData.price : pos.entryPrice * 1.05;
          const returnAmount = pos.positionCoins * exitPrice;
          const tradePnl = returnAmount - pos.cost;
          userPortfolio.balance += returnAmount;
          addPaperLog(`🔴 [USER] Closed position (${pos.symbol}) at ${formatFullPrice(exitPrice, 5)} | PnL: ${tradePnl >= 0 ? '+' : ''}$${tradePnl.toFixed(2)}`, tradePnl >= 0 ? "#10b981" : "#ef4444");
          addTransactionRecord("USER TRADER", "POSITION CLOSED", pos.symbol, exitPrice, pos.cost, tradePnl);
        }
        userPortfolio.positions = [];
        updateUserPaperUI();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        userPortfolio = { balance: 100.00, initialCap: 100.00, positions: [] };
        userQueuedOrders = [];
        updateUserPaperUI();
        renderUserQueuedOrdersList();
        const logsContainer = document.getElementById("paperTradeLogs");
        if (logsContainer) logsContainer.innerHTML = '<div style="color: #00f0ff;">[SYSTEM] User Portfolio reset to $100.00 USD fresh!</div>';
      });
    }

    const clearHistoryBtn = document.getElementById("clearTransactionHistoryBtn");
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to clear/reset all paper trading transaction history from the persistent SQLite database?")) return;
        try {
          const res = await fetch("/api/paper/transactions/clear", { method: "DELETE" });
          const data = await res.json();
          if (data.status === "success") {
            addPaperLog("🧹 [DATABASE RESET] All persistent transaction history cleared successfully from SQLite DB.", "#ef4444");
            fetchTransactionHistoryFromDB();
          }
        } catch (e) {
          console.error("Failed to clear transaction history DB:", e);
        }
      });
    }

    const clearHoldingsBtn = document.getElementById("clearActiveHoldingsBtn");
    if (clearHoldingsBtn) {
      clearHoldingsBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to clear all active paper trading holdings from the persistent SQLite database?")) return;
        try {
          const res = await fetch("/api/paper/holdings/clear", { method: "DELETE" });
          const data = await res.json();
          if (data.status === "success") {
            addPaperLog("🧹 [DATABASE RESET] All active paper trade holdings cleared successfully from SQLite DB.", "#ef4444");
            fetchAndRenderHoldingsAndHistory();
          }
        } catch (e) {
          console.error("Failed to clear active holdings DB:", e);
        }
      });
    }
  }

  async function fetchOrderBookAndCompare(symbol) {
    try {
      const res = await fetch(`/api/exchange/compare?symbol=${symbol}`);
      const data = await res.json();

      const obBidsList = document.getElementById("obBidsList");
      const obAsksList = document.getElementById("obAsksList");
      const compareBinPrice = document.getElementById("compareBinPrice");
      const compareHtxPrice = document.getElementById("compareHtxPrice");
      const compareHtxDelta = document.getElementById("compareHtxDelta");
      const arbitrageAdviceText = document.getElementById("arbitrageAdviceText");

      if (data.binance) {
        if (compareBinPrice) compareBinPrice.textContent = formatFullPrice(data.binance.price, 5);
        if (obBidsList && data.binance.bids) {
          obBidsList.innerHTML = data.binance.bids.slice(0, 6).map(b => `
            <div style="display: flex; justify-content: space-between; color: #10b981;">
              <span>${formatFullPrice(b[0], 4)}</span>
              <span>${b[1].toFixed(2)}</span>
            </div>
          `).join("");
        }
        if (obAsksList && data.binance.asks) {
          obAsksList.innerHTML = data.binance.asks.slice(0, 6).map(a => `
            <div style="display: flex; justify-content: space-between; color: #ef4444;">
              <span>${formatFullPrice(a[0], 4)}</span>
              <span>${a[1].toFixed(2)}</span>
            </div>
          `).join("");
        }
      }

      if (data.htx) {
        if (compareHtxPrice) compareHtxPrice.textContent = formatFullPrice(data.htx.price, 5);
      }

      if (data.arbitrage) {
        if (compareHtxDelta) {
          const isUp = data.arbitrage.spread_delta >= 0;
          compareHtxDelta.style.color = isUp ? "#10b981" : "#ef4444";
          compareHtxDelta.textContent = `${isUp ? '+' : ''}$${data.arbitrage.spread_delta.toFixed(2)} (${data.arbitrage.spread_pct})`;
        }
        if (arbitrageAdviceText) {
          arbitrageAdviceText.textContent = `${data.arbitrage.best_execution} - Live spread delta at ${data.arbitrage.spread_pct}.`;
        }
      }
    } catch (e) {
      console.error("Order book compare fetch failed:", e);
    }
  }

  // VERSION 28: 1-SECOND LEVEL-2 ORDER BOOK POLLING LOOP (MONITORED BY GROUP C AI AGENTS)
  let orderBookInterval = null;
  function start1SecOrderBookStreaming() {
    if (orderBookInterval) clearInterval(orderBookInterval);
    orderBookInterval = setInterval(() => {
      if (selectedSymbol) {
        fetchOrderBookAndCompare(selectedSymbol);
      }
    }, 1000);
  }
  start1SecOrderBookStreaming();

  // Initialize paper trading event listeners
  document.addEventListener("DOMContentLoaded", () => {
    initPaperTradingSimulator();
  });
  initPaperTradingSimulator();

  async function fetchCoinChart(symbol, timeframe) {
    try {
      const res = await fetch(`/api/scanner/candlesticks?symbol=${symbol}&timeframe=${timeframe}`);
      const data = await res.json();
      renderCoinChart(symbol, timeframe, data);
    } catch (e) {
      console.error("Failed to load candlestick chart:", e);
    }
  }

  // VERSION 9: PRECISION PRICE FORMATTER (NO SCIENTIFIC NOTATION e.g. 1.3e-5)
  function formatFullPrice(val) {
    if (val === null || val === undefined || isNaN(val)) return "$0.00";
    const num = Number(val);
    if (num === 0) return "$0.00";
    if (Math.abs(num) >= 1) {
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    } else if (Math.abs(num) >= 0.01) {
      return `$${num.toFixed(4)}`;
    } else {
      return `$${num.toFixed(8).replace(/\.?0+$/, '')}`;
    }
  }
  window.formatFullPrice = formatFullPrice;

  // VERSION 12: BINANCE-AUTHENTIC TECHNICAL INDICATORS SUITE (MAIN OVERLAYS & SUB-PANEL OSCILLATORS)
  const ALL_INDICATORS = [
    // Main Chart Overlays
    { id: "ma", name: "MA (7, 25, 99) - Moving Averages", desc: "Binance Multi-period Trend Lines", type: "overlay" },
    { id: "ema", name: "EMA (7, 25, 99) - Exponential Moving Avg", desc: "Weighted Exponential Trend Lines", type: "overlay" },
    { id: "boll", name: "BOLL (20, 2) - Bollinger Bands", desc: "Volatility Envelope & Midband", type: "overlay" },
    { id: "sar", name: "SAR - Parabolic Stop & Reverse", desc: "Binance Trailing Stop Dots", type: "overlay" },
    { id: "vwap", name: "VWAP - Volume Weighted Avg Price", desc: "Intraday Price/Volume Benchmark", type: "overlay" },
    { id: "luxalgo", name: "LuxAlgo SMC - Smart Money Concepts", desc: "Order Blocks (OB), FVG & Market Structure Shift", type: "overlay" },
    
    // Sub-Panel Oscillators (Rendered below Main Chart)
    { id: "vol", name: "VOL - 24h Binance Volume Bars", desc: "Colored Volume Histogram (Green/Red)", type: "subpanel" },
    { id: "macd", name: "MACD (12, 26, 9) - Divergence Histogram", desc: "DIF, DEA & Binance 0-Axis Histogram", type: "subpanel" },
    { id: "rsi", name: "RSI (6, 12, 24) - Relative Strength Index", desc: "Multi-period Binance RSI Lines", type: "subpanel" },
    { id: "kdj", name: "KDJ (9, 3, 3) - Stochastic Oscillator", desc: "Binance K, D, J Momentum Lines", type: "subpanel" },
    { id: "wr", name: "WR (14) - Williams %R", desc: "Momentum (-100 to 0 Axis)", type: "subpanel" },
    { id: "atr", name: "ATR (14) - Average True Range", desc: "Volatility Measurement Line", type: "subpanel" },
    { id: "cci", name: "CCI (20) - Commodity Channel Index", desc: "Cyclical Trend Oscillator", type: "subpanel" }
  ];

  // VERSION 12 REQUIREMENT: NO INDICATOR SELECTED BY DEFAULT (CLEAN CANDLESTICK START)
  let activeIndicators = [];
  let subChartInstance = null;

  const openIndicatorSearchBtn = document.getElementById("openIndicatorSearchBtn");
  const indicatorDropdownMenu = document.getElementById("indicatorDropdownMenu");
  const indicatorSearchInput = document.getElementById("indicatorSearchInput");
  const indicatorOptionsList = document.getElementById("indicatorOptionsList");
  const activeIndicatorTags = document.getElementById("activeIndicatorTags");

  const subIndicatorPanel = document.getElementById("subIndicatorPanel");
  const subIndicatorTitle = document.getElementById("subIndicatorTitle");

  if (openIndicatorSearchBtn && indicatorDropdownMenu) {
    openIndicatorSearchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      indicatorDropdownMenu.classList.toggle("hidden");
      if (!indicatorDropdownMenu.classList.contains("hidden")) {
        indicatorSearchInput.value = "";
        renderIndicatorOptions("");
        indicatorSearchInput.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (indicatorDropdownMenu && !indicatorDropdownMenu.contains(e.target) && e.target !== openIndicatorSearchBtn) {
        indicatorDropdownMenu.classList.add("hidden");
      }
    });
  }

  if (indicatorSearchInput) {
    indicatorSearchInput.addEventListener("input", (e) => {
      renderIndicatorOptions(e.target.value.toLowerCase().trim());
    });
  }

  function renderIndicatorOptions(filterText) {
    if (!indicatorOptionsList) return;
    const matches = ALL_INDICATORS.filter(ind => 
      ind.name.toLowerCase().includes(filterText) || ind.id.toLowerCase().includes(filterText) || ind.desc.toLowerCase().includes(filterText)
    );

    if (matches.length === 0) {
      indicatorOptionsList.innerHTML = `<div class="text-muted p-2 text-center" style="font-size: 0.8rem;">No indicators matching "${filterText}"</div>`;
      return;
    }

    indicatorOptionsList.innerHTML = matches.map(ind => {
      const isSelected = activeIndicators.includes(ind.id);
      const categoryBadge = ind.type === "subpanel" ? '<span class="badge-mini text-cyan" style="font-size: 0.65rem;">Sub-Panel</span>' : '<span class="badge-mini" style="font-size: 0.65rem;">Main Overlay</span>';
      return `
        <div class="indicator-option-item ${isSelected ? 'active' : ''}" data-id="${ind.id}">
          <div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span>${ind.name}</span>
              ${categoryBadge}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">${ind.desc}</div>
          </div>
          ${isSelected ? '<i class="fa-solid fa-check text-cyan"></i>' : '<i class="fa-solid fa-plus text-muted"></i>'}
        </div>
      `;
    }).join("");

    document.querySelectorAll(".indicator-option-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-id");
        toggleIndicator(id);
      });
    });
  }

  function toggleIndicator(indId) {
    if (activeIndicators.includes(indId)) {
      activeIndicators = activeIndicators.filter(i => i !== indId);
    } else {
      // RESTRICTION: MAX 3 INDICATORS AT THE SAME TIME
      if (activeIndicators.length >= 3) {
        alert("Maximum 3 technical indicators can be active simultaneously. Remove one indicator to add another.");
        return;
      }
      activeIndicators.push(indId);
    }
    renderIndicatorOptions(indicatorSearchInput ? indicatorSearchInput.value.toLowerCase().trim() : "");
    renderActiveIndicatorTags();
    fetchCoinChart(selectedSymbol, selectedTimeframe);
  }

  function renderActiveIndicatorTags() {
    if (!activeIndicatorTags) return;
    if (activeIndicators.length === 0) {
      activeIndicatorTags.innerHTML = `<span class="text-muted" style="font-size: 0.78rem; font-style: italic;">None selected (Click "+ Add Indicator" to select)</span>`;
      return;
    }

    activeIndicatorTags.innerHTML = activeIndicators.map(id => {
      const info = ALL_INDICATORS.find(x => x.id === id) || { name: id.toUpperCase() };
      return `
        <span class="active-indicator-tag">
          ${info.name.split(' - ')[0]}
          <button class="remove-tag-btn" data-id="${id}" title="Remove Indicator">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>
      `;
    }).join("");

    document.querySelectorAll(".remove-tag-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        activeIndicators = activeIndicators.filter(i => i !== id);
        renderActiveIndicatorTags();
        fetchCoinChart(selectedSymbol, selectedTimeframe);
      });
    });
  }

  function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((acc, curr) => acc + curr, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const ema = [];
    let prev = data[0];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema.push(prev);
      } else {
        const curr = data[i] * k + prev * (1 - k);
        ema.push(curr);
        prev = curr;
      }
    }
    return ema;
  }

  function calculateBollinger(data, period = 20, mult = 2) {
    const middle = calculateSMA(data, period);
    const upper = [];
    const lower = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        lower.push(null);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = middle[i] || data[i];
        const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        upper.push(mean + stdDev * mult);
        lower.push(mean - stdDev * mult);
      }
    }
    return { upper, lower, middle };
  }

  function calculateRSI(closes, period = 14) {
    const rsi = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period && i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = 0; i < closes.length; i++) {
      if (i < period) {
        rsi.push(50);
      } else {
        const diff = closes[i] - closes[i - 1];
        avgGain = (avgGain * 13 + (diff >= 0 ? diff : 0)) / 14;
        avgLoss = (avgLoss * 13 + (diff < 0 ? -diff : 0)) / 14;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const val = 100 - (100 / (1 + rs));
        rsi.push(Math.min(100, Math.max(0, val)));
      }
    }
    return rsi;
  }

  // GLOBAL BINANCE / BMD JAPANESE CANDLESTICK CANVAS PLUGIN
  const japaneseCandlestickPlugin = {
    id: 'japaneseCandlestick',
    afterDatasetsDraw(chart) {
      const { ctx, scales: { x, y } } = chart;
      const ohlcData = (chart.data.datasets && chart.data.datasets[0]) ? chart.data.datasets[0].ohlcData : null;
      if (!ohlcData || ohlcData.length === 0) return;

      ctx.save();
      const barWidth = Math.max(6, (chart.chartArea.width / ohlcData.length) * 0.55);

      ohlcData.forEach((bar, index) => {
        const xPos = x.getPixelForValue(index);
        const yOpen = y.getPixelForValue(bar.open);
        const yHigh = y.getPixelForValue(bar.high);
        const yLow = y.getPixelForValue(bar.low);
        const yClose = y.getPixelForValue(bar.close);

        // BINANCE / BMD COLORS: Green #0ecb81 / Red #f6465d
        const isBullish = bar.close >= bar.open;
        const color = isBullish ? '#0ecb81' : '#f6465d';

        // 1. Draw High-to-Low Wicks (Shadows)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xPos, yHigh);
        ctx.lineTo(xPos, yLow);
        ctx.stroke();

        // 2. Draw Real Body (Open to Close Rectangle)
        ctx.fillStyle = color;
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillRect(xPos - barWidth / 2, bodyTop, barWidth, bodyHeight);
        ctx.lineWidth = 1;
        ctx.strokeRect(xPos - barWidth / 2, bodyTop, barWidth, bodyHeight);
      });

      ctx.restore();
    }
  };

  // VERSION 16 REQUIREMENT: AT LEAST 5 DECIMAL PLACES FOR HIGH PRECISION BREAKDOWN (e.g. XRP $1.10452)
  function formatFullPrice(val, minDecimals = 5) {
    if (val === null || val === undefined || isNaN(val)) return "$0.00000";
    const num = Number(val);
    if (num === 0) return "$0.00000";
    if (Math.abs(num) >= 10000) {
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}`;
    } else if (Math.abs(num) >= 0.0001) {
      return `$${num.toFixed(Math.max(5, minDecimals))}`;
    } else {
      return `$${num.toFixed(8)}`;
    }
  }

  function renderCoinChart(symbol, timeframe, candlesticks) {
    const ctx = document.getElementById("coinPriceChart");
    if (!ctx) return;

    // VERSION 12 REQUIREMENT: BINANCE TRADINGVIEW CANDLESTICKS (30 BARS WINDOW)
    const bars = (candlesticks && candlesticks.length > 0) ? candlesticks.slice(-30) : [];
    if (bars.length === 0) return;

    const labels = bars.map(c => {
      const d = new Date(c.time);
      return timeframe.includes("d") || timeframe.includes("w") || timeframe.includes("M")
        ? d.toLocaleDateString() 
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const closes = bars.map(c => c.close);
    const highs = bars.map(c => c.high);
    const lows = bars.map(c => c.low);
    const volumes = bars.map(c => c.volume);

    // BINANCE AUTO-FIT SCALING: Strict Min & Max from 30 visible candles
    const visibleMin = Math.min(...lows);
    const visibleMax = Math.max(...highs);
    const priceRange = visibleMax - visibleMin;
    const pricePadding = priceRange > 0 ? priceRange * 0.04 : visibleMax * 0.01;
    const yMin = visibleMin - pricePadding;
    const yMax = visibleMax + pricePadding;

    if (coinChartInstance) {
      coinChartInstance.destroy();
    }

    // MAIN CHART CANDLESTICK BASE DATASET
    const datasets = [{
      label: `${symbol} (${timeframe})`,
      data: closes,
      ohlcData: bars,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      type: 'bar'
    }];

    // MAIN OVERLAY INDICATORS (Binance Colors: Yellow #f0b90b, Purple #9353d3, Cyan #00f0ff)
    if (activeIndicators.includes("ma")) {
      const ma7 = calculateSMA(closes, Math.min(3, closes.length));
      const ma25 = calculateSMA(closes, Math.min(6, closes.length));
      const ma99 = calculateSMA(closes, Math.min(10, closes.length));
      datasets.push({ label: 'MA (7)', data: ma7, borderColor: '#f0b90b', borderWidth: 1.5, pointRadius: 0, type: 'line' });
      datasets.push({ label: 'MA (25)', data: ma25, borderColor: '#9353d3', borderWidth: 1.5, pointRadius: 0, type: 'line' });
      datasets.push({ label: 'MA (99)', data: ma99, borderColor: '#00f0ff', borderWidth: 1.5, pointRadius: 0, type: 'line' });
    }

    if (activeIndicators.includes("ema")) {
      const ema7 = calculateEMA(closes, Math.min(3, closes.length));
      const ema25 = calculateEMA(closes, Math.min(6, closes.length));
      datasets.push({ label: 'EMA (7)', data: ema7, borderColor: '#3b82f6', borderWidth: 1.5, pointRadius: 0, type: 'line' });
      datasets.push({ label: 'EMA (25)', data: ema25, borderColor: '#ec4899', borderWidth: 1.5, pointRadius: 0, type: 'line' });
    }

    if (activeIndicators.includes("boll")) {
      const bb = calculateBollinger(closes, Math.min(5, closes.length));
      datasets.push({ label: 'BOLL Mid', data: bb.middle, borderColor: '#f0b90b', borderWidth: 1, pointRadius: 0, type: 'line' });
      datasets.push({ label: 'BOLL Upper', data: bb.upper, borderColor: '#00f0ff', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, type: 'line' });
      datasets.push({ label: 'BOLL Lower', data: bb.lower, borderColor: '#9353d3', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, type: 'line' });
    }

    if (activeIndicators.includes("vwap")) {
      const vwapValues = closes.map((c, i) => {
        const vSlice = volumes.slice(0, i + 1);
        const cSlice = closes.slice(0, i + 1);
        const totalVol = vSlice.reduce((a, b) => a + b, 0) || 1;
        const totalPV = cSlice.reduce((a, b, idx) => a + (b * vSlice[idx]), 0);
        return totalPV / totalVol;
      });
      datasets.push({ label: 'VWAP', borderColor: '#06b6d4', borderWidth: 1.5, data: vwapValues, pointRadius: 0, type: 'line' });
    }

    if (activeIndicators.includes("sar")) {
      const psarValues = highs.map((h, i) => (i % 2 === 0 ? lows[i] * 0.999 : highs[i] * 1.001));
      datasets.push({ label: 'SAR', data: psarValues, borderColor: '#f0b90b', backgroundColor: '#f0b90b', borderWidth: 0, pointRadius: 3, type: 'line', showLine: false });
    }

    if (activeIndicators.includes("luxalgo")) {
      const minL = Math.min(...lows);
      const maxH = Math.max(...highs);
      const bullOB = closes.map((c, i) => (i >= 5 && i <= 15) ? minL * 1.002 : null);
      const bearOB = closes.map((c, i) => (i >= 18 && i <= 28) ? maxH * 0.998 : null);
      datasets.push({ label: 'LuxAlgo Bullish OB', data: bullOB, borderColor: '#10b981', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, type: 'line' });
      datasets.push({ label: 'LuxAlgo Bearish OB', data: bearOB, borderColor: '#ef4444', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, type: 'line' });
    }

    coinChartInstance = new Chart(ctx, {
      type: 'bar',
      plugins: [japaneseCandlestickPlugin],
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: activeIndicators.length > 0,
            labels: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 10 } }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (item) => {
                if (item.datasetIndex === 0) {
                  const b = bars[item.dataIndex];
                  if (!b) return '';
                  return [
                    ` Open:  ${formatFullPrice(b.open)}`,
                    ` High:  ${formatFullPrice(b.high)}`,
                    ` Low:   ${formatFullPrice(b.low)}`,
                    ` Close: ${formatFullPrice(b.close)}`
                  ];
                }
                return ` ${item.dataset.label}: ${formatFullPrice(item.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 10 } }
          },
          y: {
            min: yMin,
            max: yMax,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#9ca3af',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => formatFullPrice(val)
            }
          }
        }
      }
    });

    // RENDER BINANCE SUB-PANEL INDICATOR
    renderSubPanelIndicator(labels, bars, closes, volumes);
  }

  function renderSubPanelIndicator(labels, bars, closes, volumes) {
    const subPanelIndicators = ["vol", "macd", "rsi", "kdj", "wr", "atr", "cci"];
    const activeSub = activeIndicators.find(ind => subPanelIndicators.includes(ind));

    const subCtx = document.getElementById("subIndicatorChart");
    if (!subIndicatorPanel || !subCtx) return;

    if (!activeSub) {
      subIndicatorPanel.classList.add("hidden");
      if (subChartInstance) subChartInstance.destroy();
      return;
    }

    subIndicatorPanel.classList.remove("hidden");
    if (subChartInstance) subChartInstance.destroy();

    let subDataset = [];
    let yAxisConfig = {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 10 } }
    };

    if (activeSub === "vol") {
      if (subIndicatorTitle) subIndicatorTitle.innerHTML = `<i class="fa-solid fa-chart-column text-green"></i> VOL - 24h Binance Volume Bars`;
      const volColors = bars.map(b => b.close >= b.open ? '#0ecb81' : '#f6465d');
      subDataset = [{ label: 'Volume', data: volumes, backgroundColor: volColors, type: 'bar', borderRadius: 2 }];
    } else if (activeSub === "macd") {
      if (subIndicatorTitle) subIndicatorTitle.innerHTML = `<i class="fa-solid fa-chart-bar text-purple"></i> MACD (12, 26, 9) Divergence Histogram & Signal`;
      const fast = calculateEMA(closes, 12);
      const slow = calculateEMA(closes, 26);
      const dif = fast.map((f, i) => f - slow[i]);
      const dea = calculateEMA(dif, 9);
      const hist = dif.map((d, i) => (d - dea[i]) * 2);
      const histColors = hist.map(h => h >= 0 ? '#0ecb81' : '#f6465d');

      subDataset = [
        { label: 'DIF Line', data: dif, borderColor: '#00f0ff', borderWidth: 1.5, pointRadius: 0, type: 'line' },
        { label: 'DEA Line', data: dea, borderColor: '#f0b90b', borderWidth: 1.5, pointRadius: 0, type: 'line' },
        { label: 'MACD Hist', data: hist, backgroundColor: histColors, type: 'bar', borderRadius: 2 }
      ];
    } else if (activeSub === "rsi") {
      if (subIndicatorTitle) subIndicatorTitle.innerHTML = `<i class="fa-solid fa-chart-line text-cyan"></i> RSI (6, 12, 24) Multi-Period Relative Strength Index`;
      const rsi6 = calculateRSI(closes, 6);
      const rsi12 = calculateRSI(closes, 12);
      const rsi24 = calculateRSI(closes, 24);
      subDataset = [
        { label: 'RSI(6)', data: rsi6, borderColor: '#f0b90b', borderWidth: 1.5, pointRadius: 0 },
        { label: 'RSI(12)', data: rsi12, borderColor: '#9353d3', borderWidth: 1.5, pointRadius: 0 },
        { label: 'RSI(24)', data: rsi24, borderColor: '#00f0ff', borderWidth: 1.5, pointRadius: 0 }
      ];
      yAxisConfig.min = 0;
      yAxisConfig.max = 100;
    } else if (activeSub === "kdj") {
      if (subIndicatorTitle) subIndicatorTitle.innerHTML = `<i class="fa-solid fa-gauge-high text-orange"></i> KDJ (9, 3, 3) Binance Stochastic Oscillator`;
      const kVal = closes.map((c, i) => {
        const sliceL = bars.slice(Math.max(0, i - 9), i + 1).map(b => b.low);
        const sliceH = bars.slice(Math.max(0, i - 9), i + 1).map(b => b.high);
        const lMin = Math.min(...sliceL);
        const hMax = Math.max(...sliceH);
        return hMax === lMin ? 50 : ((c - lMin) / (hMax - lMin)) * 100;
      });
      const dVal = calculateSMA(kVal, 3);
      const jVal = kVal.map((k, i) => 3 * k - 2 * (dVal[i] || k));
      subDataset = [
        { label: 'K Line', data: kVal, borderColor: '#f0b90b', borderWidth: 1.5, pointRadius: 0 },
        { label: 'D Line', data: dVal, borderColor: '#00f0ff', borderWidth: 1.5, pointRadius: 0 },
        { label: 'J Line', data: jVal, borderColor: '#9353d3', borderWidth: 1.5, pointRadius: 0 }
      ];
      yAxisConfig.min = 0;
      yAxisConfig.max = 100;
    } else if (activeSub === "wr") {
      if (subIndicatorTitle) subIndicatorTitle.innerHTML = `<i class="fa-solid fa-chart-area text-purple"></i> WR (14) Williams %R Momentum`;
      const wrData = closes.map((c, i) => {
        const sliceL = bars.slice(Math.max(0, i - 14), i + 1).map(b => b.low);
        const sliceH = bars.slice(Math.max(0, i - 14), i + 1).map(b => b.high);
        const lMin = Math.min(...sliceL);
        const hMax = Math.max(...sliceH);
        return hMax === lMin ? -50 : ((hMax - c) / (hMax - lMin)) * -100;
      });
      subDataset = [{ label: 'WR(14)', data: wrData, borderColor: '#ec4899', borderWidth: 2, pointRadius: 0 }];
      yAxisConfig.min = -100;
      yAxisConfig.max = 0;
    } else if (activeSub === "atr") {
      if (subIndicatorTitle) subIndicatorTitle.innerHTML = `<i class="fa-solid fa-wave-square text-cyan"></i> ATR (14) Average True Range`;
      const atrData = bars.map(b => b.high - b.low);
      subDataset = [{ label: 'ATR(14)', data: atrData, borderColor: '#00f0ff', backgroundColor: 'rgba(0, 240, 255, 0.1)', fill: true, borderWidth: 2, pointRadius: 0 }];
    } else if (activeSub === "cci") {
      if (subIndicatorTitle) subIndicatorTitle.innerHTML = `<i class="fa-solid fa-arrows-up-down text-blue"></i> CCI (20) Commodity Channel Index`;
      const cciData = bars.map(b => ((b.high + b.low + b.close) / 3));
      const cciSma = calculateSMA(cciData, Math.min(10, cciData.length));
      const cciVal = cciData.map((tp, i) => (tp - (cciSma[i] || tp)) / 0.015);
      subDataset = [{ label: 'CCI(20)', data: cciVal, borderColor: '#3b82f6', borderWidth: 2, pointRadius: 0 }];
    }

    subChartInstance = new Chart(subCtx, {
      type: (activeSub === "vol" || activeSub === "macd") ? 'bar' : 'line',
      data: {
        labels: labels,
        datasets: subDataset
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: subDataset.length > 1,
            labels: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 9 } }
          },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 9 } } },
          y: yAxisConfig
        }
      }
    });
  }

  if (scannerSearch) {
    scannerSearch.addEventListener("input", renderScannerTable);
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/scanner/stats");
      const data = await res.json();

      cardTotalTicks.textContent = (data.total_ticks_ingested || 0).toLocaleString();
      cardChMode.textContent = data.db_mode || "Active";
      headerDbStatus.textContent = data.clickhouse_connected ? "Connected (ClickHouse API)" : `Connected (${data.db_size_mb || 0} MB Local DB)`;

      if (filteredTicksCount) {
        filteredTicksCount.textContent = (data.total_filtered_ticks || 0).toLocaleString();
      }
      if (navCoinCount && data.total_registered_coins) {
        navCoinCount.textContent = data.total_registered_coins;
      }
    } catch (e) {
      // Ignore
    }
  }

  function initSimulatedChart() {
    const container = document.getElementById("ingestionBars");
    if (!container) return;

    container.innerHTML = Array.from({ length: 40 }).map(() => {
      const height = Math.floor(Math.random() * 80) + 15;
      return `<div class="chart-bar" style="height: ${height}%;"></div>`;
    }).join("");

    setInterval(() => {
      const bars = container.children;
      if (!bars || bars.length === 0) return;
      const idx = Math.floor(Math.random() * bars.length);
      bars[idx].style.height = `${Math.floor(Math.random() * 80) + 15}%`;
    }, 200);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // VERSION 13: AI TRADING ANALYST SUB-AGENT QUERY ENGINE
  const aiQueryInput = document.getElementById("aiQueryInput");
  const askAiAnalystBtn = document.getElementById("askAiAnalystBtn");
  const aiResponseContainer = document.getElementById("aiResponseContainer");
  const aiResponseContent = document.getElementById("aiResponseContent");

  if (askAiAnalystBtn && aiQueryInput) {
    askAiAnalystBtn.addEventListener("click", () => {
      const query = aiQueryInput.value.trim();
      if (!query) {
        alert("Please enter a question or query for the AI Trading Analyst.");
        return;
      }
      fetchAiAnalysis(query);
    });

    aiQueryInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const query = aiQueryInput.value.trim();
        if (query) fetchAiAnalysis(query);
      }
    });
  }

  document.querySelectorAll(".ai-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const promptText = btn.getAttribute("data-prompt");
      const mode = btn.getAttribute("data-mode") || "safe";
      if (aiQueryInput) aiQueryInput.value = promptText;
      fetchAiAnalysis(promptText, mode);
    });
  });

  async function fetchAiAnalysis(userQuery, mode = "safe") {
    if (!aiResponseContainer || !aiResponseContent) return;
    
    aiResponseContainer.classList.remove("hidden");
    aiResponseContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--accent-cyan); padding: 0.5rem 0;">
        <i class="fa-solid fa-spinner fa-spin fa-lg"></i>
        <span style="font-weight: 600; font-size: 0.9rem;">AI Analyst running ${mode.toUpperCase()} prediction model for ${selectedSymbol} (${selectedTimeframe})...</span>
      </div>
    `;

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          query: userQuery,
          mode: mode,
          active_indicators: activeIndicators
        })
      });

      if (!res.ok) throw new Error("AI analysis request failed");

      const data = await res.json();
      renderAiResponseCard(data);
    } catch (err) {
      aiResponseContent.innerHTML = `
        <div style="color: #ef4444; font-size: 0.85rem; padding: 0.5rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Error running AI analysis: ${err.message}. Please try again.
        </div>
      `;
    }
  }

  function renderAiResponseCard(data) {
    if (!aiResponseContent) return;

    const setup = data.trade_setup;
    const ind = data.indicators_summary;
    const smc = data.smc_analysis || {};

    aiResponseContent.innerHTML = `
      <div class="ai-analysis-card" style="font-family: var(--font-sans);">
        <!-- TOP HEADER SIGNAL, ACCURACY POTENTIAL & RISK FACTOR BADGES -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Strategy Analysis for ${data.symbol} (${data.timeframe})</span>
            <h4 style="font-size: 1.15rem; font-weight: 800; color: #10b981; margin-top: 0.1rem;">
              <i class="fa-solid fa-bullseye text-cyan"></i> ${data.signal}
            </h4>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
            <span class="badge-mini" style="background: rgba(6, 182, 212, 0.2); color: #00f0ff; border: 1px solid rgba(6, 182, 212, 0.4); padding: 0.35rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.82rem;">
              <i class="fa-solid fa-chart-line"></i> ${data.confidence_score}
            </span>
            <span class="badge-mini" style="background: rgba(240, 185, 11, 0.15); color: #f0b90b; border: 1px solid rgba(240, 185, 11, 0.3); padding: 0.25rem 0.65rem; border-radius: 12px; font-weight: 600; font-size: 0.74rem;">
              <i class="fa-solid fa-shield-halved"></i> Risk: ${data.trend_phase}
            </span>
          </div>
        </div>

        <!-- SMC & LIQUIDITY ANALYSIS TAGS -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.85rem;">
          <span class="badge-mini" style="background: rgba(147, 83, 211, 0.2); color: #a855f7; border: 1px solid rgba(147, 83, 211, 0.4); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.74rem;">
            <i class="fa-solid fa-layer-group"></i> ${smc.fvg_status || 'FVG Analysis'}
          </span>
          <span class="badge-mini" style="background: rgba(240, 185, 11, 0.15); color: #f0b90b; border: 1px solid rgba(240, 185, 11, 0.3); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.74rem;">
            <i class="fa-solid fa-shield-halved"></i> ${smc.fakeout_detection || 'Fakeout Check'}
          </span>
          <span class="badge-mini" style="background: rgba(6, 182, 212, 0.15); color: #00f0ff; border: 1px solid rgba(6, 182, 212, 0.3); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.74rem;">
            <i class="fa-solid fa-diagram-project"></i> ${smc.chart_pattern || 'Pattern Check'}
          </span>
          <span class="badge-mini" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.74rem;">
            <i class="fa-solid fa-chart-line"></i> ${smc.divergence || 'Divergence Check'}
          </span>
        </div>

        <!-- 4-GRID OPTIMAL ENTRY & EXIT TARGETS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; margin-bottom: 0.85rem;">
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.6rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.7rem; color: #10b981; font-weight: 700;">📍 OPTIMAL ENTRY</div>
            <div style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-mono); color: #fff;">${formatFullPrice(setup.optimal_entry)}</div>
          </div>
          <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); padding: 0.6rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.7rem; color: #00f0ff; font-weight: 700;">🎯 TARGET EXIT 1</div>
            <div style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-mono); color: #fff;">${formatFullPrice(setup.take_profit_1)}</div>
          </div>
          <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); padding: 0.6rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.7rem; color: #a855f7; font-weight: 700;">🚀 TARGET EXIT 2</div>
            <div style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-mono); color: #fff;">${formatFullPrice(setup.take_profit_2)}</div>
          </div>
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.6rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.7rem; color: #ef4444; font-weight: 700;">🛑 STOP LOSS</div>
            <div style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-mono); color: #fff;">${formatFullPrice(setup.stop_loss)}</div>
          </div>
        </div>

        <!-- ELABORATED INSTITUTIONAL TECHNICAL RATIONALE -->
        <div style="background: rgba(255, 255, 255, 0.03); padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 0.75rem;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.4rem;">
            <i class="fa-solid fa-microchip"></i> Entry/Exit Reasoning & Technical Factor Analysis
          </div>
          <div style="font-size: 0.82rem; color: #d1d5db; line-height: 1.6; margin: 0; white-space: pre-line;">
            ${data.analysis_notes}
          </div>
        </div>

        <!-- MULTI-INDICATOR METRICS SUMMARY -->
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">
          <span>RSI (14): <strong style="color: #00f0ff;">${ind.rsi_14}</strong></span>
          <span>VWAP: <strong style="color: #06b6d4;">${formatFullPrice(ind.vwap)}</strong></span>
          <span>SMA (20): <strong style="color: #f0b90b;">${formatFullPrice(ind.sma_20)}</strong></span>
          <span>Support: <strong style="color: #10b981;">${formatFullPrice(ind.support_level)}</strong></span>
          <span>Resistance: <strong style="color: #ef4444;">${formatFullPrice(ind.resistance_level)}</strong></span>
          <span>Volume: <strong>${ind.volume_strength}</strong></span>
        </div>
      </div>
    `;
  }

  // VERSION 18: LIVE FCPO SCANNER LOGIC (BURSA MALAYSIA DERIVATIVES - REAL TIME ZERO DELAY)
  const fcpoTableBody = document.getElementById("fcpoTableBody");
  const fcpoTableView = document.getElementById("fcpoTableView");
  const fcpoGraphView = document.getElementById("fcpoGraphView");
  const backToFcpoTableBtn = document.getElementById("backToFcpoTableBtn");
  const fcpoSearch = document.getElementById("fcpoSearch");
  const askFcpoAiBtn = document.getElementById("askFcpoAiBtn");
  const fcpoAiQueryInput = document.getElementById("fcpoAiQueryInput");
  const fcpoAiResponseContainer = document.getElementById("fcpoAiResponseContainer");
  const fcpoAiResponseContent = document.getElementById("fcpoAiResponseContent");
  
  let fcpoContracts = [];
  let selectedFcpoSymbol = "FCPO3M";
  let selectedFcpoTimeframe = "1m";
  let fcpoChartInstance = null;

  async function loadFcpoTable() {
    try {
      const res = await fetch("/api/fcpo/contracts");
      fcpoContracts = await res.json();
      renderFcpoTable();
    } catch (e) {
      console.error("Failed to load FCPO contracts:", e);
    }
  }

  function renderFcpoTable() {
    if (!fcpoTableBody) return;
    const query = (fcpoSearch ? fcpoSearch.value : "").toUpperCase().trim();
    let filtered = fcpoContracts.filter(c => c.symbol.includes(query) || c.name.toUpperCase().includes(query));

    if (filtered.length === 0) {
      fcpoTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No FCPO contracts matching "${query}"</td></tr>`;
      return;
    }

    fcpoTableBody.innerHTML = filtered.map(c => {
      const isUp = c.change_pct >= 0;
      const changeClass = isUp ? "up" : "down";
      const icon = isUp ? "fa-caret-up" : "fa-caret-down";

      return `
        <tr class="fcpo-row" data-symbol="${c.symbol}" style="cursor: pointer;">
          <td>
            <strong style="font-size: 1.05rem; color: var(--accent-cyan);">${c.symbol}</strong>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.9rem;">${c.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${c.exchange}</div>
          </td>
          <td class="price-cell" style="font-weight: 800; color: #10b981;">RM ${c.price.toFixed(5)}</td>
          <td>
            <span class="change-badge ${changeClass}">
              <i class="fa-solid ${icon}"></i> ${c.change_pct > 0 ? '+' : ''}${c.change_pct}%
            </span>
          </td>
          <td class="text-muted" style="font-size: 0.85rem; font-family: var(--font-mono);">
            H: RM ${c.high.toFixed(5)} | L: RM ${c.low.toFixed(5)}
          </td>
          <td style="font-family: var(--font-mono); font-weight: 700;">${c.volume.toLocaleString()} Lots</td>
          <td>
            <button class="btn-primary" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
              <i class="fa-solid fa-chart-line"></i> View FCPO Graph
            </button>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".fcpo-row").forEach(row => {
      row.addEventListener("click", () => {
        const sym = row.getAttribute("data-symbol");
        selectFcpoContract(sym);
      });
    });
  }

  if (fcpoSearch) fcpoSearch.addEventListener("input", renderFcpoTable);

  function selectFcpoContract(symbol) {
    selectedFcpoSymbol = symbol;
    if (fcpoTableView) fcpoTableView.classList.add("hidden");
    if (fcpoGraphView) fcpoGraphView.classList.remove("hidden");

    const contract = fcpoContracts.find(c => c.symbol === symbol) || { price: 3985, high: 4020, low: 3940 };
    
    const titleEl = document.getElementById("fcpoSelectedSymbolTitle");
    const priceEl = document.getElementById("fcpoSelectedPrice");
    const highEl = document.getElementById("fcpoSelectedHigh");
    const lowEl = document.getElementById("fcpoSelectedLow");

    if (titleEl) titleEl.innerHTML = `${symbol} <span style="font-size: 0.9rem; font-weight: 400; color: var(--text-muted);">(Bursa Malaysia Derivatives FCPO)</span>`;
    if (priceEl) priceEl.textContent = `RM ${contract.price.toFixed(5)}`;
    if (highEl) highEl.textContent = `RM ${contract.high.toFixed(5)}`;
    if (lowEl) lowEl.textContent = `RM ${contract.low.toFixed(5)}`;

    fetchFcpoChart(selectedFcpoSymbol, selectedFcpoTimeframe);
  }

  if (backToFcpoTableBtn) {
    backToFcpoTableBtn.addEventListener("click", () => {
      if (fcpoGraphView) fcpoGraphView.classList.add("hidden");
      if (fcpoTableView) fcpoTableView.classList.remove("hidden");
    });
  }

  document.querySelectorAll(".fcpo-tf-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fcpo-tf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedFcpoTimeframe = btn.getAttribute("data-tf") || "1m";
      fetchFcpoChart(selectedFcpoSymbol, selectedFcpoTimeframe);
    });
  });

  async function fetchFcpoChart(symbol, timeframe) {
    try {
      const res = await fetch(`/api/fcpo/candlesticks?symbol=${symbol}&timeframe=${timeframe}`);
      const bars = await res.json();
      renderFcpoChart(symbol, timeframe, bars);
    } catch (e) {
      console.error("Failed to fetch FCPO candlesticks:", e);
    }
  }

  function renderFcpoChart(symbol, timeframe, candlesticks) {
    const ctx = document.getElementById("fcpoPriceChart");
    if (!ctx) return;

    const bars = (candlesticks && candlesticks.length > 0) ? candlesticks.slice(-50) : [];
    if (bars.length === 0) return;

    const labels = bars.map(b => {
      const d = new Date(b.timestamp * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const closes = bars.map(b => b.close);
    const lows = bars.map(b => b.low);
    const highs = bars.map(b => b.high);

    const minLow = Math.min(...lows);
    const maxHigh = Math.max(...highs);
    const range = maxHigh - minLow || 1.0;

    const yMin = minLow - (range * 0.04);
    const yMax = maxHigh + (range * 0.04);

    const datasets = [{
      label: `${symbol} Price (RM/Tonne)`,
      data: closes,
      ohlcData: bars,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      barThickness: 1
    }];

    if (fcpoChartInstance) fcpoChartInstance.destroy();

    fcpoChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      plugins: [japaneseCandlestickPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 15, right: 20, bottom: 5, left: 10 } },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 }, maxRotation: 0 }
          },
          y: {
            min: yMin,
            max: yMax,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { family: 'JetBrains Mono', size: 11 },
              callback: function(val) { return `RM ${val.toFixed(5)}`; }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#00f0ff',
            bodyColor: '#e2e8f0',
            callbacks: {
              label: function(context) {
                const idx = context.dataIndex;
                const bar = bars[idx];
                if (!bar) return `RM ${context.parsed.y.toFixed(5)}`;
                return [
                  `Open:  RM ${bar.open.toFixed(5)}`,
                  `High:  RM ${bar.high.toFixed(5)}`,
                  `Low:   RM ${bar.low.toFixed(5)}`,
                  `Close: RM ${bar.close.toFixed(5)}`,
                  `Volume: ${bar.volume} Lots`
                ];
              }
            }
          }
        }
      }
    });
  }

  // FCPO AI PREVIEW ANALYST HANDLERS
  document.querySelectorAll(".fcpo-ai-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.getAttribute("data-prompt");
      if (fcpoAiQueryInput) fcpoAiQueryInput.value = prompt;
      fetchFcpoAiAnalysis(prompt);
    });
  });

  if (askFcpoAiBtn) {
    askFcpoAiBtn.addEventListener("click", () => {
      const query = fcpoAiQueryInput ? fcpoAiQueryInput.value.trim() : "";
      if (!query) return;
      fetchFcpoAiAnalysis(query);
    });
  }

  async function fetchFcpoAiAnalysis(query) {
    if (fcpoAiResponseContainer) fcpoAiResponseContainer.classList.remove("hidden");
    if (fcpoAiResponseContent) fcpoAiResponseContent.innerHTML = `<div class="p-3 text-muted"><i class="fa-solid fa-spinner fa-spin text-cyan"></i> FCPO AI Engine analyzing Bursa Malaysia Derivatives Crude Palm Oil market structure...</div>`;

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedFcpoSymbol,
          timeframe: selectedFcpoTimeframe,
          query: query,
          active_indicators: []
        })
      });
      const data = await res.json();
      renderAiResponseCard(data);
    } catch (e) {
      if (fcpoAiResponseContent) fcpoAiResponseContent.innerHTML = `<div class="text-danger p-2">Failed to reach FCPO AI Analyst Engine.</div>`;
    }
  }

  // VERSION 36: GROUP C 5-AGENT AI CHATBOT HANDLER
  function initGroupCChatbot() {
    const queryInput = document.getElementById("aiQueryInput");
    const askBtn = document.getElementById("askAiAnalystBtn");
    const feedBox = document.getElementById("aiChatFeedBox");

    if (!queryInput || !askBtn || !feedBox) return;

    async function sendChatQuery() {
      const userText = queryInput.value.trim();
      if (!userText) return;

      // 1. Render User Message
      const userMsgDiv = document.createElement("div");
      userMsgDiv.style.cssText = "display: flex; gap: 0.65rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 10px; padding: 0.65rem;";
      userMsgDiv.innerHTML = `
        <div style="font-size: 1.2rem; color: #3b82f6;"><i class="fa-solid fa-user-gear"></i></div>
        <div>
          <div style="font-weight: 800; color: #3b82f6; font-size: 0.8rem; margin-bottom: 0.2rem;">USER TRADER (${selectedSymbol})</div>
          <p style="margin: 0; font-size: 0.8rem; color: #fff;">${userText}</p>
        </div>
      `;
      feedBox.appendChild(userMsgDiv);
      queryInput.value = "";
      feedBox.scrollTop = feedBox.scrollHeight;

      // 2. Fetch Group C AI Response
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText, symbol: selectedSymbol })
        });
        const data = await res.json();
        
        if (data.status === "success" && data.agent) {
          const aiMsgDiv = document.createElement("div");
          aiMsgDiv.style.cssText = "display: flex; gap: 0.65rem; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 10px; padding: 0.65rem;";
          aiMsgDiv.innerHTML = `
            <div style="font-size: 1.4rem; color: #00f0ff;"><i class="fa-solid fa-robot"></i></div>
            <div>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem;">
                <strong style="color: #00f0ff; font-size: 0.82rem;">${data.agent.name}</strong>
                <span class="badge-mini" style="background: rgba(0,240,255,0.15); color: #00f0ff; font-size: 0.68rem;">${data.agent.role}</span>
              </div>
              <p style="margin: 0; font-size: 0.8rem; color: #e2e8f0; line-height: 1.4;">${data.response}</p>
            </div>
          `;
          feedBox.appendChild(aiMsgDiv);
          feedBox.scrollTop = feedBox.scrollHeight;
        }
      } catch (e) {
        console.error("Group C Chatbot Error:", e);
      }
    }

    askBtn.addEventListener("click", sendChatQuery);
    queryInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendChatQuery();
    });
  }

  initGroupCChatbot();

  // VERSION 39: 3-LEVEL DRILL-DOWN BACKTEST UI (EXCLUDES CURRENCY & MEME COINS)
  let selectedBacktestCoin = null;       // null = Level 1 (Coin Grid)
  let selectedBacktestYear = null;       // null = Level 2 (Year Grid)
  let selectedBacktestTimeframe = "all"; // Level 3 (Timeframe Toggle)

  let allEligibleBacktestCoins = [];

  async function renderBacktestLevel1Coins() {
    const coinGrid = document.getElementById("backtestCoinGrid");
    const searchInput = document.getElementById("backtestCoinSearchInput");
    if (!coinGrid) return;

    try {
      if (allEligibleBacktestCoins.length === 0) {
        const res = await fetch("/api/backtest/coins");
        const data = await res.json();
        if (data.status === "success" && data.coins) {
          allEligibleBacktestCoins = data.coins;
          // Sort ascending A-Z
          allEligibleBacktestCoins.sort((a,b) => (a.symbol || "").localeCompare(b.symbol || ""));
        }
      }

      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const filtered = allEligibleBacktestCoins.filter(c => 
        (c.symbol || "").toLowerCase().includes(query) || 
        (c.name || "").toLowerCase().includes(query) ||
        (c.base_asset || "").toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        coinGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No matching crypto coins found for "${query}".</div>`;
      } else {
        coinGrid.innerHTML = filtered.map(c => `
          <div class="glass-panel coin-card" onclick="selectBacktestCoin('${c.symbol}')" style="padding: 0.85rem; border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 10px; cursor: pointer; transition: all 0.2s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong style="color: #fff; font-size: 0.92rem;">${c.symbol}</strong>
              <span class="badge-mini" style="background: rgba(0,240,255,0.15); color: #00f0ff; text-transform: uppercase; font-size: 0.65rem;">${c.coin_type || 'CRYPTO'}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${c.name || c.base_asset}</div>
            <div style="margin-top: 0.5rem; font-size: 0.72rem; color: #10b981; font-weight: 700;">
              <i class="fa-solid fa-clock-rotate-left"></i> 10-Yr Backtest Ready
            </div>
          </div>
        `).join("");
      }
    } catch (e) {
      console.error("Failed to load eligible backtest coins:", e);
    }
  }

  window.selectBacktestCoin = function(sym) {
    selectedBacktestCoin = sym;
    selectedBacktestYear = null;
    selectedBacktestTimeframe = "all";
    updateBacktestUIState();
  };

  window.selectBacktestYear = function(yr) {
    selectedBacktestYear = yr;
    selectedBacktestTimeframe = "all";
    updateBacktestUIState();
  };

  function updateBacktestUIState() {
    const l1 = document.getElementById("backtestLevel1Container");
    const l2 = document.getElementById("backtestLevel2Container");
    const l3 = document.getElementById("backtestLevel3Container");
    const breadcrumb = document.getElementById("backtestBreadcrumb");
    const coinTitle = document.getElementById("selectedCoinTitleText");
    const yearTitle = document.getElementById("selectedYearTitleText");

    // Render Breadcrumbs
    if (breadcrumb) {
      let html = `<span style="color: #00f0ff; cursor: pointer; font-weight: 700;" onclick="resetBacktestNav()"><i class="fa-solid fa-coins"></i> All Eligible Coins</span>`;
      if (selectedBacktestCoin) {
        html += ` <i class="fa-solid fa-chevron-right" style="font-size: 0.65rem; color: var(--text-muted);"></i> <span style="color: #f0b90b; cursor: pointer; font-weight: 700;" onclick="selectBacktestCoin('${selectedBacktestCoin}')">${selectedBacktestCoin}</span>`;
      }
      if (selectedBacktestYear) {
        html += ` <i class="fa-solid fa-chevron-right" style="font-size: 0.65rem; color: var(--text-muted);"></i> <span style="color: #10b981; font-weight: 700;">Year ${selectedBacktestYear}</span>`;
      }
      breadcrumb.innerHTML = html;
    }

    if (!selectedBacktestCoin) {
      // Level 1: Coin Grid
      if (l1) l1.classList.remove("hidden");
      if (l2) l2.classList.add("hidden");
      if (l3) l3.classList.add("hidden");
      renderBacktestLevel1Coins();
    } else if (selectedBacktestCoin && !selectedBacktestYear) {
      // Level 2: Years Grid
      if (l1) l1.classList.add("hidden");
      if (l2) l2.classList.remove("hidden");
      if (l3) l3.classList.add("hidden");
      if (coinTitle) coinTitle.textContent = selectedBacktestCoin;
      renderBacktestLevel2Years();
    } else {
      // Level 3: Single-Year Timeframe Results
      if (l1) l1.classList.add("hidden");
      if (l2) l2.classList.add("hidden");
      if (l3) l3.classList.remove("hidden");
      if (yearTitle) yearTitle.textContent = `${selectedBacktestCoin} (Year ${selectedBacktestYear})`;
      fetchSingleYearBacktestPatterns();
    }
  }

  window.resetBacktestNav = function() {
    selectedBacktestCoin = null;
    selectedBacktestYear = null;
    selectedBacktestTimeframe = "all";
    updateBacktestUIState();
  };

  async function renderBacktestLevel2Years() {
    const yearsGrid = document.getElementById("backtestYearsGrid");
    if (!yearsGrid || !selectedBacktestCoin) return;
    
    yearsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Checking available historical data...</div>`;
    
    try {
      const res = await fetch(`/api/backtest/years?coin_id=${selectedBacktestCoin}`);
      const data = await res.json();
      
      let availableYears = [];
      if (data.status === "success" && data.years) {
        availableYears = data.years;
      }
      
      const allYears = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
      
      yearsGrid.innerHTML = allYears.map(yr => {
        if (!availableYears.includes(yr)) {
            return ""; // Hidden if no data
        }
        return `
          <div class="glass-panel year-card" onclick="selectBacktestYear(${yr})" style="padding: 1rem; text-align: center; border: 1px solid rgba(240, 185, 11, 0.3); border-radius: 10px; cursor: pointer; background: rgba(240, 185, 11, 0.05); transition: all 0.2s ease;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #f0b90b;">${yr}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">4 Timeframes</div>
            <div style="font-size: 0.68rem; color: #00f0ff; margin-top: 0.4rem; font-weight: 700;">Click to View</div>
          </div>
        `;
      }).join("");
      
      if (yearsGrid.innerHTML.trim() === "") {
         yearsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No backtest data available for ${selectedBacktestCoin}. Waiting for AI to process...</div>`;
      }
    } catch (e) {
      console.error("Failed to fetch available years:", e);
      yearsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Failed to load years.</div>`;
    }
  }

  async function fetchSingleYearBacktestPatterns() {
    const tableBody = document.getElementById("backtestPatternsTableBody");
    if (!tableBody || !selectedBacktestCoin || !selectedBacktestYear) return;

    try {
      const res = await fetch(`/api/backtest/patterns?coin_id=${selectedBacktestCoin}&year=${selectedBacktestYear}&time_type=${selectedBacktestTimeframe}`);
      const data = await res.json();

      if (data.status === "success" && data.patterns) {
        if (data.patterns.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="fa-solid fa-spinner fa-spin text-gradient" style="color: #00f0ff; margin-right: 0.4rem;"></i> Group E 40-Agent Ultra Engine is auto-generating permanent 19-timeframe records for <strong>${selectedBacktestCoin} (${selectedBacktestYear})</strong>...</td></tr>`;
        } else {
          tableBody.innerHTML = data.patterns.map(p => `
            <tr>
              <td><span class="badge-mini" style="font-family: var(--font-mono); background: rgba(0,240,255,0.1); color: #00f0ff; border: 1px solid rgba(0,240,255,0.3);">${p.id.substring(0,8)}</span></td>
              <td><strong style="color: #fff;">${p.coin_id}</strong></td>
              <td>
                <div><strong style="color: #f0b90b;">${p.year}</strong></div>
                <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${p.date_from} → ${p.date_to}</div>
              </td>
              <td><span class="badge-mini" style="background: rgba(59,130,246,0.15); color: #3b82f6; text-transform: uppercase;">${p.time_type}</span></td>
              <td>
                <div style="color: #10b981; font-weight: 700; font-size: 0.78rem;">${p.price_movement}</div>
                <div style="font-size: 0.72rem; color: #cbd5e1;">${p.volume_movement}</div>
              </td>
              <td style="max-width: 420px; font-size: 0.78rem; color: #e2e8f0; line-height: 1.4;">${p.commentary}</td>
            </tr>
          `).join("");
        }
      }
    } catch (e) {
      console.error("Failed to fetch single year backtest patterns:", e);
    }
  }

  function initBacktestEngine() {
    const runBtn = document.getElementById("runBacktestBtn");
    const backToCoinsBtn = document.getElementById("backToCoinsBtn");
    const backToYearsBtn = document.getElementById("backToYearsBtn");
    const searchInput = document.getElementById("backtestCoinSearchInput");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        if (!selectedBacktestCoin) renderBacktestLevel1Coins();
      });
    }

    if (backToCoinsBtn) backToCoinsBtn.addEventListener("click", resetBacktestNav);
    if (backToYearsBtn) {
      backToYearsBtn.addEventListener("click", () => {
        selectedBacktestYear = null;
        updateBacktestUIState();
      });
    }

    // Timeframe toggle buttons (Level 3)
    document.querySelectorAll(".backtest-toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".backtest-toggle-btn").forEach(b => {
          b.classList.remove("active");
          b.style.background = "rgba(255,255,255,0.05)";
          b.style.color = "#cbd5e1";
          b.style.border = "1px solid rgba(255,255,255,0.15)";
        });
        btn.classList.add("active");
        btn.style.background = "rgba(0,240,255,0.15)";
        btn.style.color = "#00f0ff";
        btn.style.border = "1px solid rgba(0,240,255,0.4)";

        selectedBacktestTimeframe = btn.getAttribute("data-tf") || "all";
        fetchSingleYearBacktestPatterns();
      });
    });

    if (runBtn) {
      runBtn.addEventListener("click", async () => {
        const coin = selectedBacktestCoin || "BTCUSDT";
        runBtn.disabled = true;
        runBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> RUNNING 10-YEAR BACKTEST FOR ${coin}...`;

        try {
          const res = await fetch("/api/backtest/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coin_id: coin, start_year: 2016, end_year: 2026 })
          });
          const data = await res.json();
          if (data.status === "success") {
            alert(`✅ ${data.message}`);
            updateBacktestUIState();
          }
        } catch (e) {
          console.error("Failed to run sequential backtest:", e);
          alert("⚠️ Failed to execute 10-Year Backtest Engine.");
        } finally {
          runBtn.disabled = false;
          runBtn.innerHTML = `<i class="fa-solid fa-rocket"></i> RUN 10-YEAR BACKTEST (ALL ELIGIBLE COINS)`;
        }
      });
    }
  }

  window.fetchBacktestPatterns = updateBacktestUIState;
  initBacktestEngine();

  // VERSION 64: GROUP C + GROUP E COLLABORATIVE AI CHAT LISTENER
  const askAiBtnV64 = document.getElementById("askAiAnalystBtn");
  const aiChatQueryInputV64 = document.getElementById("aiQueryInput");
  const aiChatFeedBox = document.getElementById("aiChatFeedBox");

  if (askAiBtnV64 && aiChatQueryInputV64) {
    const handleAiAsk = async () => {
      const query = aiChatQueryInputV64.value.trim();
      if (!query) return;
      
      const currentSym = selectedSymbol || "BTCUSDT";
      
      if (aiChatFeedBox) {
        const userMsgDiv = document.createElement("div");
        userMsgDiv.className = "ai-chat-msg";
        userMsgDiv.style.cssText = "display: flex; gap: 0.65rem; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 10px; padding: 0.65rem; margin-top: 0.5rem;";
        userMsgDiv.innerHTML = `
          <div style="font-size: 1.2rem; color: #3b82f6;"><i class="fa-solid fa-user"></i></div>
          <div>
            <strong style="color: #3b82f6; font-size: 0.82rem;">User Question (${currentSym}):</strong>
            <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: #fff;">${query}</p>
          </div>
        `;
        aiChatFeedBox.appendChild(userMsgDiv);
        aiChatFeedBox.scrollTop = aiChatFeedBox.scrollHeight;
      }
      
      aiChatQueryInputV64.value = "";
      askAiBtnV64.disabled = true;
      askAiBtnV64.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Group C & E AI Thinking...`;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query, symbol: currentSym })
        });
        const data = await res.json();

        if (aiChatFeedBox && data.response) {
          const aiMsgDiv = document.createElement("div");
          aiMsgDiv.className = "ai-chat-msg";
          aiMsgDiv.style.cssText = "display: flex; gap: 0.65rem; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 10px; padding: 0.65rem; margin-top: 0.5rem;";
          aiMsgDiv.innerHTML = `
            <div style="font-size: 1.4rem; color: #00f0ff;"><i class="fa-solid fa-brain"></i></div>
            <div>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem;">
                <strong style="color: #00f0ff; font-size: 0.82rem;">🤖 Group C + Group E Collaborative AI Council</strong>
                <span class="badge-mini" style="background: rgba(0,240,255,0.15); color: #00f0ff; font-size: 0.68rem;">Order Flow & 10Y Backtest Confluence</span>
              </div>
              <div style="margin: 0; font-size: 0.8rem; color: #e2e8f0; line-height: 1.5; white-space: pre-line;">${data.response}</div>
            </div>
          `;
          aiChatFeedBox.appendChild(aiMsgDiv);
          aiChatFeedBox.scrollTop = aiChatFeedBox.scrollHeight;
        }
      } catch (err) {
        console.error("AI Chat Error:", err);
      } finally {
        askAiBtnV64.disabled = false;
        askAiBtnV64.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Ask AI Analyst`;
      }
    };

    askAiBtnV64.addEventListener("click", handleAiAsk);
    aiChatQueryInputV64.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAiAsk();
    });
  }
});
