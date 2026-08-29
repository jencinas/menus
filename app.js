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
          <button class="btn-edit" title="Editar" onclick="onEdit('${day}','${meal}')">✎</button>
        </div>
      </div>`;
    }).join("");

    return `<div class="day-card">
      <div class="day-header"><div class="day-name">${day}</div></div>
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
        <button class="btn-add-dish" onclick="onAddDish()">+ Añadir plato</button>
      </div>
    </div>`;
}

// ── Shopping page ─────────────────────────────────────────────────────────────

function renderShopping(state) {
  const app = document.getElementById("app");
  const { byAisle, totalItems, missing } = buildShoppingList(state);
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

  let idx = 0;
  const aislesHTML = byAisle.map(aisle => {
    const itemsHTML = aisle.items.map(({ ingredient, dishes }) => {
      const i = idx++;
      const dishHint = dishes.join(", ");
      return `<div class="shop-item" id="si-${i}" onclick="toggleItem(${i})">
        <div class="shop-cb"></div>
        <div class="shop-info">
          <div class="shop-name">${ingredient}</div>
          <div class="shop-from">${dishHint}</div>
        </div>
      </div>`;
    }).join("");
    return `<div class="shop-aisle">
      <div class="shop-aisle-title">${aisle.emoji} ${aisle.name}</div>
      ${itemsHTML}
    </div>`;
  }).join("");

  app.innerHTML = `
    <div class="page active" id="page-shop">
      <div class="shop-header">
        <button class="btn-back" onclick="onBackToWeek()">← Volver</button>
      </div>
      <div class="shop-title">Lista de la compra</div>
      <div class="shop-subtitle">${totalItems} ingredientes · semana del ${fmt_date(state.week_start)}</div>
      ${promosHTML}
      <div class="shop-list" style="margin-top:12px">${aislesHTML}</div>
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

// ── Dish picker ───────────────────────────────────────────────────────────────

function onEdit(day, meal) {
  const dishes = loadUserDishes();
  const pool = Object.entries(dishes)
    .filter(([, i]) => i.meals.includes(meal) && i.solo)
    .sort(([a], [b]) => a.localeCompare(b, "es"));

  window._pickerCtx = { day, meal, pool };

  const el = document.createElement("div");
  el.id = "dish-picker";
  el.className = "dish-picker";
  el.innerHTML = `
    <div class="picker-backdrop" onclick="closePicker()"></div>
    <div class="picker-sheet">
      <div class="picker-header">
        <input class="picker-search" id="picker-input" type="search" placeholder="Buscar plato…" oninput="filterPicker()" autocomplete="off">
        <button class="picker-close" onclick="closePicker()">✕</button>
      </div>
      <div class="picker-list" id="picker-list">${_pickerItemsHTML(pool, day, meal)}</div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => document.getElementById("picker-input")?.focus(), 50);
}

function _pickerItemsHTML(pool, day, meal) {
  if (!pool.length) return `<div class="picker-empty">Sin resultados</div>`;
  return pool.map(([name, info]) =>
    `<div class="picker-item" data-name="${name.replace(/"/g,"&quot;")}" onclick="onSelectDish('${day}','${meal}',this.dataset.name)">
      <div class="picker-name">${name}</div>
      <div class="picker-meta">${info.category || ""}</div>
    </div>`).join("");
}

function filterPicker() {
  const q = (document.getElementById("picker-input")?.value || "").toLowerCase();
  const { pool, day, meal } = window._pickerCtx;
  const filtered = q ? pool.filter(([n]) => n.toLowerCase().includes(q)) : pool;
  document.getElementById("picker-list").innerHTML = _pickerItemsHTML(filtered, day, meal);
}

function closePicker() {
  document.getElementById("dish-picker")?.remove();
  window._pickerCtx = null;
}

function onSelectDish(day, meal, dishName) {
  closePicker();
  let state = loadCurrentWeek();
  state = setSlot(state, day, meal, dishName);
  saveCurrentWeek(state);
  renderWeek(state);
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

function onAddDish() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page active" id="page-add">
      <div class="shop-header">
        <button class="btn-back" onclick="onBackToWeek()">← Volver</button>
      </div>
      <div class="shop-title">Añadir plato</div>

      <div class="add-form">
        <label class="field-label">Nombre del plato *</label>
        <input id="f-name" class="field-input" type="text" placeholder="Ej: Pollo al ajillo">

        <label class="field-label">Acompañamiento (opcional)</label>
        <input id="f-side" class="field-input" type="text" placeholder="Ej: Patatas fritas">

        <label class="field-label">Comida / Cena</label>
        <div class="field-checks">
          <label><input type="checkbox" id="f-comida" checked> Comida</label>
          <label><input type="checkbox" id="f-cena" checked> Cena</label>
        </div>

        <label class="field-label">Categoría</label>
        <select id="f-cat" class="field-input">
          <option value="normal">Normal</option>
          <option value="pescado">Pescado</option>
          <option value="pasta">Pasta</option>
          <option value="arroz">Arroz</option>
          <option value="legumbre">Legumbre</option>
          <option value="verdura">Verdura</option>
          <option value="ensalada">Ensalada</option>
          <option value="sandwich">Sandwich</option>
        </select>

        <label class="field-label">Proteína principal</label>
        <select id="f-prot" class="field-input">
          <option value="carne">Carne</option>
          <option value="pescado">Pescado</option>
          <option value="huevo">Huevo</option>
          <option value="vegetal">Vegetal</option>
          <option value="embutido">Embutido</option>
          <option value="mixto">Mixto</option>
        </select>

        <div class="field-checks" style="margin-top:8px">
          <label><input type="checkbox" id="f-elab"> Solo fines de semana (elaborado)</label>
        </div>

        <label class="field-label" style="margin-top:8px">Ingredientes (separados por coma)</label>
        <textarea id="f-ingr" class="field-input field-textarea" placeholder="Ej: pollo, limón, ajo, patatas"></textarea>

        <button class="btn-confirm" style="margin-top:16px" onclick="onSaveDish()">Guardar plato</button>
      </div>
    </div>`;
}

function onSaveDish() {
  const name  = document.getElementById("f-name").value.trim();
  if (!name) { alert("El nombre es obligatorio."); return; }

  const meals = [];
  if (document.getElementById("f-comida").checked) meals.push("comida");
  if (document.getElementById("f-cena").checked)   meals.push("cena");
  if (!meals.length) { alert("Selecciona al menos una comida."); return; }

  const rawIngr = document.getElementById("f-ingr").value;
  const ingredients = rawIngr.split(",").map(s => s.trim()).filter(Boolean);

  addUserDish({
    name,
    fixed_side: document.getElementById("f-side").value.trim() || null,
    meals,
    category:  document.getElementById("f-cat").value,
    protein:   document.getElementById("f-prot").value,
    elaborate: document.getElementById("f-elab").checked,
    ingredients,
  });

  // Confirmation then back
  const btn = document.querySelector("#page-add .btn-confirm");
  btn.textContent = "✓ Guardado";
  btn.disabled = true;
  setTimeout(() => onBackToWeek(), 800);
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
