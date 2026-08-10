// All planner logic – runs entirely in the browser, no server needed.

const DAYS    = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const WEEKEND = new Set(["Sábado","Domingo"]);
const MEALS   = ["comida","cena"];

const PANTRY = new Set([
  "sal","pimienta","aceite","aceite de oliva","vinagre","azúcar",
  "agua","harina","ajo","laurel","orégano","pimentón","especias",
]);

const SEASON_MAP = {
  12:"invierno",1:"invierno",2:"invierno",
  3:"primavera",4:"primavera",5:"primavera",
  6:"verano",7:"verano",8:"verano",
  9:"otoño",10:"otoño",11:"otoño",
};

function currentSeason() {
  return SEASON_MAP[new Date().getMonth() + 1];
}

// ── Storage ──────────────────────────────────────────────────────────────────

function loadHistory()      { return JSON.parse(localStorage.getItem("history") || "[]"); }
function saveHistory(h)     { localStorage.setItem("history", JSON.stringify(h)); }
function loadCurrentWeek()  { return JSON.parse(localStorage.getItem("currentWeek") || "null"); }
function saveCurrentWeek(w) { localStorage.setItem("currentWeek", JSON.stringify(w)); }

function loadUserDishes() {
  const saved = localStorage.getItem("userDishes");
  return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DISHES));
}
function saveUserDishes(d)   { localStorage.setItem("userDishes", JSON.stringify(d)); }
function loadUserDiscovery() {
  const saved = localStorage.getItem("userDiscovery");
  return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DISCOVERY));
}
function saveUserDiscovery(d) { localStorage.setItem("userDiscovery", JSON.stringify(d)); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function recentDishNames(history, weeksBack = 3) {
  const recent = new Set();
  history.slice(-weeksBack).forEach(week => {
    Object.values(week.days || {}).forEach(day => {
      MEALS.forEach(m => { if (day[m]) recent.add(day[m]); });
    });
  });
  return recent;
}

function pickDish(pool, meal, exclude, { elaborateOnly = false, season = null, avoidProtein = null } = {}) {
  season = season || currentSeason();

  function ok(name, info) {
    if (!info.meals.includes(meal))                       return false;
    if (exclude.has(name))                                return false;
    if (meal === "comida" && !info.solo)                  return false;
    if (!(info.seasons || []).includes(season))           return false;
    if (elaborateOnly && !info.elaborate)                 return false;
    if (avoidProtein && info.protein === avoidProtein)    return false;
    return true;
  }

  let candidates = Object.entries(pool).filter(([n,i]) => ok(n,i)).map(([n]) => n);

  if (!candidates.length) {
    candidates = Object.entries(pool)
      .filter(([n,i]) => i.meals.includes(meal) && (meal !== "comida" || i.solo) && (i.seasons||[]).includes(season))
      .map(([n]) => n);
  }
  if (!candidates.length) {
    candidates = Object.entries(pool).filter(([n,i]) => i.meals.includes(meal)).map(([n]) => n);
  }

  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

// Pick a light vegetable side for dishes that need one
function pickSide(pool, season) {
  season = season || currentSeason();
  const candidates = Object.entries(pool)
    .filter(([, i]) => !i.solo && i.protein === "vegetal" && (i.seasons || []).includes(season))
    .map(([n]) => n);
  if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  // fallback: ignore season
  const all = Object.entries(pool).filter(([, i]) => !i.solo && i.protein === "vegetal").map(([n]) => n);
  return all.length ? all[Math.floor(Math.random() * all.length)] : null;
}

function pickDiscovery(pool, meal, { category = null, elaborate = null, season = null } = {}) {
  season = season || currentSeason();

  function ok(info) {
    if (!info.meals.includes(meal))                          return false;
    if (!(info.seasons || []).includes(season))              return false;
    if (category !== null && info.category !== category)     return false;
    if (elaborate !== null && !!info.elaborate !== elaborate) return false;
    return true;
  }

  let candidates = Object.entries(pool).filter(([,i]) => ok(i)).map(([n]) => n);

  if (!candidates.length) {
    candidates = Object.entries(pool)
      .filter(([,i]) => i.meals.includes(meal)
        && (category === null || i.category === category)
        && (elaborate === null || !!i.elaborate === elaborate))
      .map(([n]) => n);
  }
  if (!candidates.length) {
    candidates = Object.entries(pool).filter(([,i]) => i.meals.includes(meal)).map(([n]) => n);
  }

  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

function makeSlot(dishName, dishes, season, source = "known") {
  const info = dishes[dishName];
  const side = info?.needs_side ? pickSide(dishes, season) : null;
  return { dish: dishName, side, source };
}

// ── Week generation ──────────────────────────────────────────────────────────

function generateWeek() {
  const dishes    = loadUserDishes();
  const discovery = loadUserDiscovery();
  const history   = loadHistory();
  const exclude   = recentDishNames(history, 3);
  const used      = new Set();
  const season    = currentSeason();
  const daysState = {};

  for (const day of DAYS) {
    const isWeekend = WEEKEND.has(day);

    const comida = pickDish(dishes, "comida", new Set([...exclude, ...used]), {
      elaborateOnly: isWeekend, season,
    }) || pickDish(dishes, "comida", used, { season });

    daysState[day] = {};
    daysState[day].comida = makeSlot(comida, dishes, season);
    used.add(comida);

    const comidaProtein = dishes[comida]?.protein;
    const avoidProtein  = comidaProtein === "carne" ? "carne" : null;

    const cena = pickDish(dishes, "cena", new Set([...exclude, ...used]), {
      season, avoidProtein,
    }) || pickDish(dishes, "cena", used, { season });

    daysState[day].cena = makeSlot(cena, dishes, season);
    used.add(cena);
  }

  const weekdays    = DAYS.filter(d => !WEEKEND.has(d));
  const wDay        = weekdays[Math.floor(Math.random() * weekdays.length)];
  const wSugg       = pickDiscovery(discovery, "comida", { elaborate: false, season });

  const weekendDays = [...WEEKEND];
  const fDay        = weekendDays[Math.floor(Math.random() * weekendDays.length)];
  const fSugg       = Math.random() < 0.6
    ? (pickDiscovery(discovery, "comida", { category: "arroz", elaborate: true, season }) ||
       pickDiscovery(discovery, "comida", { elaborate: true, season }))
    : (pickDiscovery(discovery, "comida", { elaborate: true, season }) ||
       pickDiscovery(discovery, "comida", { category: "arroz", elaborate: true, season }));

  return {
    week_start: new Date().toISOString().slice(0, 10),
    season,
    days: daysState,
    suggestions: {
      semana: {
        day: wDay, meal: "comida", new_dish: wSugg,
        known_alternative: daysState[wDay].comida.dish, status: "pending",
      },
      finde: {
        day: fDay, meal: "comida", new_dish: fSugg,
        known_alternative: daysState[fDay].comida.dish, status: "pending",
      },
    },
    confirmed: false,
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

function rerollSlot(state, day, meal) {
  const dishes  = loadUserDishes();
  const history = loadHistory();
  const exclude = recentDishNames(history, 3);
  const season  = state.season || currentSeason();

  const currentSet = new Set();
  for (const d of DAYS) for (const m of MEALS) {
    if (d === day && m === meal) continue;
    if (state.days[d]?.[m]?.dish) currentSet.add(state.days[d][m].dish);
  }

  const other        = meal === "comida" ? "cena" : "comida";
  const otherDish    = state.days[day][other]?.dish;
  const otherProtein = dishes[otherDish]?.protein;
  const avoidProtein = otherProtein === "carne" ? "carne" : null;
  const isWeekend    = WEEKEND.has(day);

  const newDish = pickDish(dishes, meal, new Set([...exclude, ...currentSet]), {
    elaborateOnly: isWeekend && meal === "comida", season, avoidProtein,
  }) || pickDish(dishes, meal, currentSet, { season });

  const old = state.days[day][meal].dish;
  state.days[day][meal] = makeSlot(newDish, dishes, season);

  for (const s of Object.values(state.suggestions)) {
    if (s.day === day && s.meal === meal && s.known_alternative === old) {
      s.known_alternative = newDish;
    }
  }
  return state;
}

function acceptSuggestion(state, key) {
  const s   = state.suggestions[key];
  const dishes = loadUserDishes();
  s.status  = "accepted";
  state.days[s.day][s.meal] = makeSlot(s.new_dish, dishes, state.season, "discovery");
  return state;
}

function rejectSuggestion(state, key) {
  const s   = state.suggestions[key];
  const dishes = loadUserDishes();
  s.status  = "rejected";
  state.days[s.day][s.meal] = makeSlot(s.known_alternative, dishes, state.season);
  return state;
}

function confirmWeek(state) {
  state.confirmed = true;
  const history = loadHistory();
  history.push({
    week_start: state.week_start,
    days: Object.fromEntries(DAYS.map(d => [d, {
      comida: state.days[d].comida.dish,
      cena:   state.days[d].cena.dish,
    }])),
  });
  saveHistory(history);
  saveCurrentWeek(state);
  return state;
}

function buildShoppingList(state) {
  const dishes    = loadUserDishes();
  const discovery = loadUserDiscovery();
  const allDishes = { ...dishes, ...discovery };
  const ingredients = new Set();
  const missing = [];

  for (const day of DAYS) for (const meal of MEALS) {
    const slot = state.days[day]?.[meal];
    if (!slot) continue;

    for (const name of [slot.dish, slot.side].filter(Boolean)) {
      const info = allDishes[name];
      if (!info) { missing.push(name); continue; }
      info.ingredients.forEach(i => { if (!PANTRY.has(i.toLowerCase())) ingredients.add(i); });
    }
  }

  return { items: [...ingredients].sort((a,b) => a.localeCompare(b, "es")), missing };
}

function promoteDiscovery(name) {
  const discovery = loadUserDiscovery();
  if (!discovery[name]) return false;
  const info = { ...discovery[name] };
  delete info.note;
  const dishes = loadUserDishes();
  dishes[name] = info;
  saveUserDishes(dishes);
  delete discovery[name];
  saveUserDiscovery(discovery);
  return true;
}
