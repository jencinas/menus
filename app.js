// UI layer – depends on planner.js and data.js being loaded first.

let shopChecked = {};

const MEAL_LABEL = { comida: "Comida", cena: "Cena" };

// ── Render helpers ────────────────────────────────────────────────────────────

function fmt_date(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

// ── Week page ─────────────────────────────────────────────────────────────────

function renderWeek(state) {
  const app  = document.getElementById("app");
  const disc = loadUserDiscovery();

  const suggHTML = Object.entries(state.suggestions).map(([key, s]) => {
    if (!s.new_dish) return "";
    const label    = key === "finde" ? "Sugerencia finde (elaborada)" : "Sugerencia entre semana";
    const dayLabel = `${s.day} · ${MEAL_LABEL[s.meal]}`;
    const note     = disc[s.new_dish]?.note || "";
    const url      = disc[s.new_dish]?.url  || "";
    const linkHTML = url ? `<a class="sugg-link" href="${url}" target="_blank" rel="noopener">Ver receta ↗</a>` : "";

    if (s.status === "accepted") {
      return `<div class="suggestion-banner">
        <div class="sugg-label">${label}</div>
        <div class="sugg-meta">${dayLabel}</div>
        <div class="sugg-dish">${s.new_dish}</div>
        ${linkHTML}
        <div class="sugg-done">✓ Incorporada al menú</div>
      </div>`;
    }
    if (s.status === "rejected") return "";

    return `<div class="suggestion-banner">
      <div class="sugg-label">${label}</div>
      <div class="sugg-meta">${dayLabel}</div>
      <div class="sugg-dish">${s.new_dish}</div>
      ${note ? `<div class="sugg-note">${note}</div>` : ""}
      ${linkHTML}
      <div class="sugg-alt">En lugar de: <span>${s.known_alternative}</span></div>
      <div class="sugg-actions">
        <button class="btn-sugg-accept" onclick="onSuggAccept('${key}')">Probar</button>
        <button class="btn-sugg-reject" onclick="onSuggReject('${key}')">Mantener conocido</button>
      </div>
    </div>`;
  }).join("");

  const daysHTML = DAYS.map(day => {
    const isWeekend = WEEKEND.has(day);
    const badge     = isWeekend ? `<span class="day-badge">Finde</span>` : "";

    const rows = MEALS.map(meal => {
      const slot = state.days[day]?.[meal];
      if (!slot) return "";
      const isDisc = slot.source === "discovery";
      const sideHTML = slot.side ? `<div class="meal-side">+ ${slot.side}</div>` : "";
      return `<div class="meal-row">
        <div class="meal-type">${MEAL_LABEL[meal]}</div>
        <div class="meal-center">
          <div class="meal-dish">${slot.dish}</div>
          ${sideHTML}
          ${isDisc ? `<div class="meal-tag">★ Nuevo plato</div>` : ""}
        </div>
        <div class="meal-actions">
          <button class="btn-reroll" title="Cambiar" onclick="onReroll('${day}','${meal}',this)">↻</button>
        </div>
      </div>`;
    }).join("");

    return `<div class="day-card">
      <div class="day-header"><div class="day-name">${day}</div>${badge}</div>
      ${rows}
    </div>`;
  }).join("");

  const hasSugg = Object.values(state.suggestions).some(s => s.status !== "rejected" && s.new_dish);

  app.innerHTML = `
    <div class="page active" id="page-week">
      <div class="header">
        <div class="header-inner">
          <h1>Menú semanal</h1>
          <button class="btn-icon" onclick="onNewWeek()" title="Nueva semana">↺</button>
        </div>
        <div class="header-sub">Semana del ${fmt_date(state.week_start)}</div>
      </div>
      <div class="page-body">
        ${hasSugg ? `<div class="section-label">Platos nuevos a probar</div>${suggHTML}` : ""}
        <div class="section-label">Menú de la semana</div>
        ${daysHTML}
      </div>
      <div class="bottom-bar">
        <button class="btn-confirm" onclick="onConfirm()">
          Confirmar y ver la compra →
        </button>
      </div>
    </div>`;
}

// ── Shopping page ─────────────────────────────────────────────────────────────

function renderShopping(state) {
  const app = document.getElementById("app");
  const { items, missing } = buildShoppingList(state);
  shopChecked = {};

  const promotable = Object.values(state.suggestions)
    .filter(s => s.status === "accepted" && s.new_dish);

  const promosHTML = promotable.map(s => `
    <div class="promo-card" id="promo-${encodeURIComponent(s.new_dish)}">
      <div class="promo-label">¿Guardar en tu biblioteca?</div>
      <div class="promo-dish">${s.new_dish}</div>
      <button class="btn-promote" onclick="onPromote('${s.new_dish}', this)">
        Añadir a mis platos conocidos
      </button>
    </div>`).join("");

  const itemsHTML = items.map((item, i) => `
    <div class="shop-item" id="si-${i}" onclick="toggleItem(${i})">
      <div class="shop-cb"></div>
      <div class="shop-name">${item}</div>
    </div>`).join("");

  app.innerHTML = `
    <div class="page active" id="page-shop">
      <div class="shop-header">
        <button class="btn-back" onclick="onBackToWeek()">← Volver</button>
      </div>
      <div class="shop-title">Lista de la compra</div>
      <div class="shop-subtitle">${items.length} ingredientes · semana del ${fmt_date(state.week_start)}</div>
      ${promosHTML}
      <div class="shop-list" style="margin-top:12px">${itemsHTML}</div>
      ${missing.length ? `<p style="font-size:12px;color:var(--text-sub);padding:12px 20px">Sin ingredientes: ${missing.join(", ")}</p>` : ""}
      <button class="btn-new-week" onclick="onNewWeek()">+ Planificar nueva semana</button>
    </div>`;
}

function toggleItem(i) {
  shopChecked[i] = !shopChecked[i];
  const el = document.getElementById(`si-${i}`);
  const cb = el.querySelector(".shop-cb");
  el.classList.toggle("checked", shopChecked[i]);
  cb.textContent = shopChecked[i] ? "✓" : "";
}

// ── Actions ───────────────────────────────────────────────────────────────────

function onReroll(day, meal, btn) {
  btn.style.transform = "rotate(180deg)";
  let state = loadCurrentWeek();
  state = rerollSlot(state, day, meal);
  saveCurrentWeek(state);
  setTimeout(() => renderWeek(state), 200);
}

function onSuggAccept(key) {
  let state = loadCurrentWeek();
  state = acceptSuggestion(state, key);
  saveCurrentWeek(state);
  renderWeek(state);
}

function onSuggReject(key) {
  let state = loadCurrentWeek();
  state = rejectSuggestion(state, key);
  saveCurrentWeek(state);
  renderWeek(state);
}

function onConfirm() {
  let state = loadCurrentWeek();
  state = confirmWeek(state);
  saveCurrentWeek(state);
  renderShopping(state);
}

function onNewWeek() {
  document.getElementById("app").innerHTML =
    `<div class="loading-screen"><div class="spinner"></div><p>Generando menú…</p></div>`;
  setTimeout(() => {
    const state = generateWeek();
    saveCurrentWeek(state);
    renderWeek(state);
  }, 50);
}

function onBackToWeek() {
  const state = loadCurrentWeek();
  if (state) renderWeek(state);
}

function onPromote(name, btn) {
  promoteDiscovery(name);
  btn.textContent = "✓ Guardado";
  btn.disabled    = true;
  btn.style.background = "#aaa";
  const card = document.getElementById(`promo-${encodeURIComponent(name)}`);
  if (card) setTimeout(() => card.remove(), 800);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  let state = loadCurrentWeek();
  if (!state) {
    state = generateWeek();
    saveCurrentWeek(state);
  }
  if (state.confirmed) {
    renderShopping(state);
  } else {
    renderWeek(state);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/menus/sw.js").catch(() => {});
}

init();
