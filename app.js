"use strict";

const config = window.MT_CONFIG || {};
const $ = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SANCTION_MINUTES = 5_256_000;

const KINDS = {
  ban: { title: "Мои баны", one: "Бан", add: "Добавить бан", icon: "i-ban", duration: true, permanent: true, hint: "Блокировка аккаунта на срок или навсегда" },
  kick: { title: "Мои кики", one: "Кик", add: "Добавить кик", icon: "i-kick", hint: "Принудительное отключение с сервера" },
  mute: { title: "Мои муты", one: "Мут", add: "Добавить мут", icon: "i-mute", duration: true, hint: "Ограничение чата на срок" },
  warning: { title: "Мои предупреждения", one: "Предупреждение", add: "Добавить предупреждение", icon: "i-warning", hint: "Устные и письменные предупреждения" },
};

// Единый список должностей (иерархия из 6 уровней). Должен совпадать с <select id="register-position"> в index.html.
const POSITIONS = Object.freeze([
  "Младший Хелпер", "Хелпер",
  "Младший модератор", "Модератор", "Старший модератор", "Администратор", "Старший администратор",
  "Тестировщик", "Медиа-продакшн", "Технический специалист", "Следящий за форумом", "Старший следящий за форумом", "Следящий за битвами", "Старший следящий за битвами",
  "Зам.куратора технических специалистов", "Куратор технических специалистов", "Зам куратора администрации", "Куратор администрации", "Заместитель Куратора Агентов Поддержки", "Куратор Агентов Поддержки",
  "Заместитель главного администратора", "Главный администратор",
  "Заместитель Специального Администратора", "Специальный Администратор",
]);

const state = { client: null, session: null, profile: null, renderId: 0, sanctionKind: "ban", recovery: false, theme: "mt-standard", globalTheme: "mt-standard", globalThemeChannel: null, holidayLightsTimer: null, holidayDemonTimer: null, holidayCity: null };

const THEME_OPTIONS = [
  { id: "mt-standard", name: "MT Standard", description: "Исходное оформление MyWorkspace", swatch: "theme-swatch-standard" },
  { id: "graphite", name: "Graphite", description: "Графитовая, с холодным акцентом", swatch: "theme-swatch-graphite" },
  { id: "midnight", name: "Midnight", description: "Глубокий синий и бирюза", swatch: "theme-swatch-midnight" },
  { id: "emerald", name: "Emerald", description: "Тёмная зелёная палитра", swatch: "theme-swatch-emerald" },
  { id: "cherry", name: "Cherry", description: "Бордовые и красные акценты", swatch: "theme-swatch-cherry" },
  { id: "snow", name: "Snow", description: "Светлая минималистичная схема", swatch: "theme-swatch-snow" },
  { id: "violet", name: "Violet", description: "Фиолетовые акценты на тёмной основе", swatch: "theme-swatch-violet" },
];

function isSupportAccount() {
  const user = state.session?.user;
  return String(user?.email || "").trim().toLowerCase() === "supportmytanks@gmail.com"
    && Boolean(user?.email_confirmed_at)
    && String(state.profile?.email || "").trim().toLowerCase() === "supportmytanks@gmail.com"
    && state.profile?.status === "approved";
}

function themeStorageKey() {
  return state.session?.user?.id ? `myworkspace.theme.${state.session.user.id}` : "myworkspace.theme";
}

function syncHolidayAtmosphere() {
  const active = state.globalTheme === "new-year";
  document.documentElement.dataset.theme = active ? "new-year" : state.theme;
  if (!active) {
    if (state.holidayLightsTimer) clearInterval(state.holidayLightsTimer);
    state.holidayLightsTimer = null;
    if (state.holidayDemonTimer) clearInterval(state.holidayDemonTimer);
    state.holidayDemonTimer = null;
    state.holidayCity?.remove();
    state.holidayCity = null;
    return;
  }
  if (!state.holidayCity) {
    const city = document.createElement("div");
    city.className = "holiday-cityscape";
    city.setAttribute("aria-hidden", "true");
    const windows = [];
    const garlandWindows = [];
    const buildingSpecs = [
      [48, 54, 12], [71, 66, 18], [43, 48, 12], [82, 72, 21],
      [57, 58, 15], [91, 76, 24], [52, 50, 15], [76, 68, 21],
      [46, 56, 12], [88, 74, 24], [61, 62, 18], [79, 70, 21],
      [50, 52, 15], [94, 78, 24], [58, 60, 18], [73, 66, 21], [45, 48, 12]
    ];
    let windowIndex = 0;
    for (let buildingIndex = 0; buildingIndex < buildingSpecs.length; buildingIndex++) {
      const [height, width, count] = buildingSpecs[buildingIndex];
      const building = document.createElement("div");
      building.className = "holiday-building holiday-building-snow";
      if ([1, 4, 7, 10, 13, 15].includes(buildingIndex)) {
        const chimney = document.createElement("i");
        chimney.className = "holiday-chimney";
        chimney.innerHTML = "<b></b><b></b>";
        building.append(chimney);
      }
      building.style.setProperty("--building-height", `${height}%`);
      building.style.setProperty("--building-width", `${width}px`);
      for (let i = 0; i < count; i++) {
        const windowLight = document.createElement("i");
        windowLight.className = "holiday-window";
        const isPurple = [19, 83, 127, 156, 214, 267, 290].includes(windowIndex);
        const isGarland = [37, 61, 108, 172, 201, 226, 248, 279, 298].includes(windowIndex);
        if (isPurple) {
          windowLight.classList.add("is-purple");
        } else if (isGarland) {
          windowLight.classList.add("has-garland");
          garlandWindows.push(windowLight);
        } else {
          windowLight.classList.toggle("is-lit", (windowIndex * 7 + buildingIndex * 3) % 11 < 6);
          windows.push(windowLight);
        }
        windowLight.style.setProperty("--light-delay", `${(windowIndex % 8) * .37}s`);
        building.append(windowLight);
        windowIndex++;
      }
      city.append(building);
    }
    const street = document.createElement("div");
    street.className = "holiday-street";

    const traffic = document.createElement("div");
    traffic.className = "holiday-traffic";
    const carMarkup = '<i class="traffic-car-body"></i><i class="traffic-car-cabin"></i><i class="traffic-car-window"></i><i class="traffic-car-wheel traffic-wheel-front"></i><i class="traffic-car-wheel traffic-wheel-back"></i><i class="traffic-headlight traffic-headlight-front"></i><i class="traffic-headlight traffic-headlight-rear"></i>';
    const colors = ["red", "blue", "silver", "green", "gold", "red", "blue"];
    const makeTrafficRow = (rowName) => {
      const row = document.createElement("div");
      row.className = `holiday-traffic-row ${rowName}`;
      const track = document.createElement("div");
      track.className = "holiday-traffic-track";
      const sequence = document.createElement("div");
      sequence.className = "holiday-traffic-sequence";
      const queueColors = Array.from({ length: 18 }, (_, index) => colors[index % colors.length]);
      queueColors.forEach((color, index) => {
        const vehicle = document.createElement("div");
        vehicle.className = `holiday-traffic-car car-${color}`;
        vehicle.innerHTML = carMarkup;
        vehicle.style.setProperty("--car-scale", `${.92 + (index % 4) * .02}`);
        vehicle.style.setProperty("--car-gap", `${10 + (index % 3) * 10}px`);
        sequence.append(vehicle);
      });
      track.append(sequence, sequence.cloneNode(true));
      row.append(track);
      return row;
    };
    traffic.append(makeTrafficRow("traffic-row-back"), makeTrafficRow("traffic-row-front"));
    street.append(traffic);

    const streetlamps = document.createElement("div");
    streetlamps.className = "holiday-streetlamps";
    [12, 38, 66, 91].forEach((position) => {
      const lamp = document.createElement("div");
      lamp.className = "holiday-lamp";
      lamp.style.left = `${position}%`;
      lamp.innerHTML = '<i class="holiday-lamp-post"></i><i class="holiday-lamp-head"></i><i class="holiday-lamp-glow"></i>';
      streetlamps.append(lamp);
    });
    city.append(streetlamps);

    const tree = document.createElement("div");
    tree.className = "holiday-tree";
    tree.innerHTML = '<i class="holiday-tree-star"></i><i class="holiday-tree-top"></i><i class="holiday-tree-middle"></i><i class="holiday-tree-bottom"></i><i class="holiday-tree-trunk"></i><i class="holiday-tree-lights"></i><i class="holiday-tree-gifts"><b></b><b></b><b></b></i>';
    city.append(tree);
    city.append(street);
    document.body.append(city);
    state.holidayCity = city;
    state.holidayCityWindows = windows;
    state.holidayGarlandWindows = garlandWindows;
  }
  if (!state.holidayLightsTimer) {
    state.holidayLightsTimer = setInterval(() => {
      const windows = state.holidayCityWindows || [];
      if (!windows.length || state.globalTheme !== "new-year") return;
      const changes = 3 + Math.floor(Math.random() * Math.max(3, Math.floor(windows.length * .16)));
      const chosen = new Set();
      while (chosen.size < Math.min(changes, windows.length)) chosen.add(Math.floor(Math.random() * windows.length));
      for (const index of chosen) windows[index].classList.toggle("is-lit", Math.random() > .5);
    }, 90000);
  }
}

function applyTheme(theme, persist = false) {
  const allowed = THEME_OPTIONS.some((item) => item.id === theme);
  const safeTheme = allowed ? theme : "mt-standard";
  state.theme = safeTheme;
  state.theme = safeTheme;
  syncHolidayAtmosphere();
  if (persist) {
    try { localStorage.setItem(themeStorageKey(), safeTheme); } catch {}
  }
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === safeTheme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function restoreTheme() {
  let saved = "mt-standard";
  try { saved = localStorage.getItem(themeStorageKey()) || "mt-standard"; } catch {}
  applyTheme(saved);
}

async function loadGlobalTheme() {
  const { data, error } = await state.client.from("workspace_settings")
    .select("global_theme").eq("setting_key", "appearance").maybeSingle();
  if (error) {
    state.globalTheme = "mt-standard";
    applyTheme(state.theme);
    return;
  }
  state.globalTheme = data?.global_theme === "new-year" ? "new-year" : "mt-standard";
  applyTheme(state.theme);
  subscribeGlobalTheme();
}

function subscribeGlobalTheme() {
  if (state.globalThemeChannel) state.client.removeChannel(state.globalThemeChannel);
  state.globalThemeChannel = state.client.channel("workspace-global-theme")
    .on("postgres_changes", { event: "*", schema: "public", table: "workspace_settings", filter: "setting_key=eq.appearance" }, (payload) => {
      const nextTheme = payload.new?.global_theme === "new-year" ? "new-year" : "mt-standard";
      state.globalTheme = nextTheme;
      applyTheme(state.theme);
      if (parseRoute()?.page === "account" && !$("app-view").hidden) render();
    })
    .subscribe();
}

async function setGlobalHolidayTheme(enabled) {
  if (!isSupportAccount()) {
    showToast("Управление новогодней темой доступно только закреплённому аккаунту техподдержки.");
    return;
  }
  const toggle = $("global-holiday-toggle");
  if (toggle) toggle.disabled = true;
  const { error } = await state.client.rpc("set_workspace_global_theme", { new_theme: enabled ? "new-year" : "mt-standard" });
  if (toggle) toggle.disabled = false;
  if (error) {
    if (toggle) toggle.checked = state.globalTheme === "new-year";
    showToast(/function .* does not exist|workspace_settings/i.test(error.message || "")
      ? "Сначала необходимо применить миграцию глобальной темы в Supabase."
      : friendlyError(error));
    return;
  }
  state.globalTheme = enabled ? "new-year" : "mt-standard";
  applyTheme(state.theme);
  showToast(enabled ? "Новогодняя тема включена для всего MyWorkspace." : "Глобальная новогодняя тема отключена. Личные темы восстановлены.");
}

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  el.append(...children.flat().filter((child) => child != null && child !== false));
  return el;
}

function icon(name, className) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#${name}`);
  svg.append(use);
  return svg;
}

function isHttpUrl(text) {
  try {
    const url = new URL(text);
    return /^https?:\/\//i.test(text) && ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !/\s/.test(text);
  } catch {
    return false;
  }
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function formatDuration(minutes, permanent) {
  if (permanent) return "Навсегда";
  if (!minutes) return "—";
  if (minutes % 1440 === 0) { const d = minutes / 1440; return `${d} ${plural(d, "день", "дня", "дней")}`; }
  if (minutes % 60 === 0) { const hrs = minutes / 60; return `${hrs} ${plural(hrs, "час", "часа", "часов")}`; }
  return `${minutes} мин`;
}

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatDateTime = (iso) => dateTimeFormat.format(new Date(iso));
const formatDate = (isoDate) => { const [y, m, d] = String(isoDate).split("-"); return d ? `${d}.${m}.${y}` : String(isoDate); };

function localDateTimeValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

let toastTimer;
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}

function setMessage(id, text, kind = "error") {
  const el = $(id);
  el.textContent = text || "";
  el.dataset.kind = kind;
  el.hidden = !text;
}

function friendlyError(error) {
  const message = String(error?.message || error || "");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
  if (/invalid login credentials/i.test(message)) return "Неверная почта или пароль.";
  if (/email not confirmed/i.test(message)) return "Почта не подтверждена. Откройте письмо от MT DOCS и перейдите по ссылке.";
  if (/database error saving new user/i.test(message)) return "Не удалось создать аккаунт: никнейм уже занят или данные некорректны. Если повторяется — сообщите руководителю.";
  if (/user already registered/i.test(message)) return "Аккаунт с этой почтой уже существует. Войдите или восстановите пароль.";
  if (/password should be at least|weak password/i.test(message)) return "Пароль слишком простой. Используйте не менее 8 символов.";
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(message)) return "Слишком много попыток. Подождите несколько минут и повторите.";
  if (/same.*password|different from the old/i.test(message)) return "Новый пароль должен отличаться от текущего.";
  if (/profiles_nickname_key|duplicate key value violates unique constraint/i.test(message)) return "Этот никнейм уже занят.";
  if (/row-level security|permission denied|недостаточно прав|42501/i.test(message)) return "Недостаточно прав для этого действия.";
  return message ? `Ошибка: ${message.slice(0, 300)}` : "Произошла неизвестная ошибка.";
}

function setBusy(button, busy, label) {
  if (busy) { button.dataset.label = button.innerHTML; button.disabled = true; button.textContent = label || "Подождите…"; }
  else if (button.dataset.label != null) { button.disabled = false; button.innerHTML = button.dataset.label; delete button.dataset.label; }
}

function showScreen(name) {
  $("boot-view").hidden = name !== "boot";
  $("auth-view").hidden = !["login", "gate", "recovery"].includes(name);
  $("app-view").hidden = name !== "app";
  $("login-panel").hidden = name !== "login";
  $("gate-panel").hidden = name !== "gate";
  $("recovery-panel").hidden = name !== "recovery";
}

function showGate({ title, text, iconName = "i-clock", actions = true }) {
  $("gate-title").textContent = title;
  $("gate-text").textContent = text;
  $("gate-icon").replaceChildren(icon(iconName));
  $("gate-actions").hidden = !actions;
  showScreen("gate");
}

function selectTab(name) {
  const login = name === "login";
  $("tab-login").setAttribute("aria-selected", String(login));
  $("tab-register").setAttribute("aria-selected", String(!login));
  $("login-form").hidden = !login;
  $("register-form").hidden = login;
  setMessage("login-message", "");
  setMessage("register-message", "");
}

async function loadProfile() {
  const { data, error } = await state.client.from("profiles").select("*").eq("id", state.session.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function enterWorkspace() {
  if (!state.session) { showScreen("login"); return; }
  if (state.recovery) { showScreen("recovery"); return; }
  let profile;
  try {
    profile = await loadProfile();
  } catch (error) {
    showGate({ title: "Не удалось загрузить профиль", text: friendlyError(error), iconName: "i-warning" });
    return;
  }
  state.profile = profile;
  if (!profile) {
    showGate({ title: "Профиль не найден", text: "Аккаунт есть, но профиль сотрудника не создан. Обратитесь к руководителю.", iconName: "i-warning" });
  } else if (profile.status === "pending") {
    showGate({ title: "Заявка на рассмотрении", text: `${profile.nickname}, ваша заявка на должность «${profile.position}» отправлена. Доступ откроется после одобрения руководителем.` });
  } else if (profile.status === "rejected") {
    showGate({ title: "Доступ закрыт", text: "Руководитель отклонил заявку или отозвал доступ. Если это ошибка, свяжитесь с руководством проекта.", iconName: "i-ban" });
  } else {
    restoreTheme();
    await loadGlobalTheme();
    $("sidebar-nickname").textContent = profile.nickname;
    $("sidebar-position").textContent = profile.position;
    updateAvatarImages();
    $("topbar-nickname").textContent = profile.nickname;
    showScreen("app");
    if (location.hash !== "#/home") location.replace("#/home");
    else render();
    refreshPendingBadge();
  }
}

function avatarPublicUrl(path) {
  if (!path) return "./mytanks-avatar.jpg";
  const result = state.client.storage.from("avatars").getPublicUrl(path);
  return result.data.publicUrl + "?v=" + encodeURIComponent(state.profile?.updated_at || Date.now());
}
function updateAvatarImages() {
  const src = avatarPublicUrl(state.profile?.avatar_path);
  document.querySelectorAll(".team-avatar, .topbar-avatar").forEach((image) => { image.src = src; });
}
async function refreshPendingBadge() {
  const badge = $("pending-badge");
  if (!state.profile?.is_admin) { badge.hidden = true; return; }
  const { count, error } = await state.client.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending");
  badge.hidden = error || !count;
  badge.textContent = count ? String(count) : "";
}

function parseRoute() {
  const path = location.hash.replace(/^#/, "");
  if (path === "/home") return { page: "home", crumbs: [["Главная"]] };
  if (path === "/training") return { page: "training-index", crumbs: [["Учебный центр"]] };
  if (path === "/reports") return { page: "reports", crumbs: [["Отчёты"]] };
  if (path === "/reports/mine") return { page: "my-reports", crumbs: [["Отчёты", "#/reports"], ["Мои отчёты"]] };
  if (path === "/blocks") return { page: "blocks", crumbs: [["Мониторинг игры"], ["Блокировки"]] };
  const match = path.match(/^\/blocks\/(ban|kick|mute|warning)$/);
  if (match) return { page: "sanctions", kind: match[1], crumbs: [["Мониторинг игры"], ["Блокировки", "#/blocks"], [KINDS[match[1]].title]] };
  if (path === "/account") return { page: "account", crumbs: [["Личный кабинет"]] };
  const training = {
    "/training/gameplay": "Игровой процесс",
    "/training/forum": "Работа с форумом",
    "/training/community": "Работа с сообществом",
    "/training/administration": "Административный аппарат"
  }[path];
  if (training) return { page: "training", section: training, sectionKey: path.split("/").pop(), crumbs: [["Учебный центр", "#/training"], [training]] };
  return null;
}

function setChrome(route) {
  const nav = { home: "home", reports: "reports", "my-reports": "reports", blocks: "blocks", sanctions: "blocks", account: "account", training: "training", "training-index": "training" }[route.page];
  for (const link of document.querySelectorAll("[data-nav]")) {
    const active = link.dataset.nav === nav;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
  const trainingToggle = $("training-toggle");
  const trainingItems = $("training-items");
  if (trainingToggle && trainingItems && route.page === "training") {
    trainingToggle.setAttribute("aria-expanded", "true");
    trainingToggle.setAttribute("aria-label", "Свернуть список курсов");
    trainingItems.hidden = false;
  }
  for (const link of document.querySelectorAll("[data-training-nav]")) {
    const active = ["training", "training-index"].includes(route.page) && link.dataset.trainingNav === route.sectionKey;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
  $("breadcrumb").replaceChildren(...route.crumbs.flatMap(([label, href], index) => {
    const last = index === route.crumbs.length - 1;
    const node = last ? h("strong", { text: label }) : href ? h("a", { href, text: label }) : h("span", { class: "crumb", text: label });
    return index ? [h("span", { class: "crumb-sep", text: "/" }), node] : [node];
  }));
  const titles = { home: "Главная", reports: "Отчётность", "my-reports": "Мои отчёты", blocks: "Блокировка", sanctions: KINDS[route.kind]?.title, account: "Личный кабинет", training: route.section, "training-index": "Учебный центр" };
  document.title = `${titles[route.page]} · MT DOCS`;
  closeSidebar();
}

function pageHeading(eyebrow, title, text, ...actions) {
  return h("div", { class: "page-heading" },
    h("div", {}, h("div", { class: "eyebrow" }, h("span"), eyebrow), h("h1", {}, title, h("span", { text: "." })), text ? h("p", { text }) : null),
    actions.length ? h("div", { class: "heading-actions" }, ...actions) : null);
}

function rowLink({ href, iconName, title, text, meta, external }) {
  return h("a", { class: "row-link", href, target: external ? "_blank" : null, rel: external ? "noopener noreferrer" : null },
    h("span", { class: "row-icon" }, icon(iconName)),
    h("span", { class: "row-text" }, h("strong", { text: title }), h("small", { text })),
    meta != null ? h("span", { class: "row-meta", text: meta }) : null,
    icon(external ? "i-external" : "i-chevron", "row-arrow"));
}

function loadingBlock() { return h("div", { class: "loading", role: "status" }, h("span", { class: "spinner" }), "Загружаем данные…"); }
function errorBlock(error, retry) {
  return h("div", { class: "empty-state error" }, icon("i-warning"), h("strong", { text: "Не удалось загрузить данные" }), h("p", { text: friendlyError(error) }),
    h("button", { type: "button", class: "button button-secondary", onclick: retry }, icon("i-refresh"), "Повторить"));
}
function emptyBlock(iconName, title, text, action) {
  return h("div", { class: "empty-state" }, icon(iconName), h("strong", { text: title }), h("p", { text }), action || null);
}

function newReportLink(className = "button button-primary") {
  return h("a", { class: className, href: config.reportsUrl, target: "_blank", rel: "noopener noreferrer" }, icon("i-plus"), "Новый отчёт");
}

async function render() {
  const route = parseRoute();
  if (!route || !state.profile) return;
  const id = ++state.renderId;
  const view = $("view");
  const current = () => id === state.renderId;
  setChrome(route);
  view.replaceChildren();
  const renderers = { home: renderHome, reports: renderReports, "my-reports": renderMyReports, blocks: renderBlocks, sanctions: renderSanctions, account: renderAccount, training: renderTraining, "training-index": renderTrainingIndex };
  await renderers[route.page](view, route, current);
  if (current() && route.page === "training" && getTrainingViewMode() === "presentation") enhanceTrainingDeck(view, route);
  if (current()) view.focus({ preventScroll: true });
}



const TRAINING_VIEW_MODE_KEY = "myworkspace.trainingViewMode";

function getTrainingViewMode() {
  try {
    return localStorage.getItem(TRAINING_VIEW_MODE_KEY) === "presentation" ? "presentation" : "standard";
  } catch {
    return "standard";
  }
}

function setTrainingViewMode(mode) {
  const safeMode = mode === "presentation" ? "presentation" : "standard";
  try { localStorage.setItem(TRAINING_VIEW_MODE_KEY, safeMode); } catch {}
  const toggle = $("training-presentation-toggle");
  if (toggle) toggle.checked = safeMode === "presentation";
  const route = parseRoute();
  if (route?.page === "training") render();
}

function renderTrainingIndex(view) {
  const courses = [
    ["gameplay", "Игровой процесс", "Дежурство, игровой чат, режим наблюдателя и мониторинг битв.", "i-monitor"],
    ["community", "Работа с сообществом", "Социальные сети, игровой чат и работа с обращениями игроков.", "i-users"],
    ["forum", "Работа с форумом", "Права доступа, административные разделы и работа с обращениями.", "i-messages"],
    ["administration", "Административный аппарат", "Структура команды, обязанности, регламенты и нормативы.", "i-shield"]
  ];
  view.append(
    pageHeading("УЧЕБНЫЙ ЦЕНТР", "Учебный центр", "Выберите курс. Материалы открываются в формате последовательной презентации."),
    h("div", { class: "training-course-grid" }, ...courses.map(([key, title, description, iconName], index) =>
      h("a", { class: "training-course-card", href: `#/training/${key}` },
        h("span", { class: "training-course-number", text: String(index + 1).padStart(2, "0") }),
        h("span", { class: "section-icon" }, icon(iconName)),
        h("strong", { text: title }),
        h("p", { text: description }),
        h("span", { class: "training-course-open" }, "Открыть курс", icon("i-chevron"))
      )
    ))
  );
}

function enhanceTrainingDeck(view, route) {
  const heading = view.querySelector(".page-heading");
  const cards = [...view.querySelectorAll(":scope > .card")];
  if (!heading || !cards.length) return;

  const deck = h("section", { class: "training-deck", "aria-label": `Курс: ${route.section}` });
  const toolbar = h("div", { class: "training-deck-toolbar" },
    h("a", { class: "training-back-link", href: "#/training" }, icon("i-chevron"), "Все курсы"),
    h("span", { class: "training-deck-course", text: route.section })
  );
  const progress = h("div", { class: "training-progress", role: "group", "aria-label": "Прогресс курса" },
    h("div", { class: "training-progress-track" }, h("span", { class: "training-progress-fill" })),
    h("div", { class: "training-progress-meta" },
      h("span", { class: "training-progress-label", text: "Этап 1" }),
      h("span", { class: "training-progress-count", text: `1 / ${cards.length}` })
    )
  );
  progress.querySelector(".training-progress-fill").style.width = `${100 / cards.length}%`;
  const viewport = h("div", { class: "training-slide-viewport", tabindex: "0", "aria-label": "Слайды курса. Используйте стрелки влево и вправо для навигации." });
  const slides = cards.map((card, index) => {
    const slide = h("div", { class: `training-slide${index === 0 ? " is-active" : ""}`, role: "group", "aria-roledescription": "слайд", "aria-label": `${index + 1} из ${cards.length}` }, card);
    slide.hidden = index !== 0;
    viewport.append(slide);
    return slide;
  });
  const previous = h("button", { type: "button", class: "button button-secondary training-prev", disabled: true }, icon("i-chevron"), "Назад");
  const next = h("button", { type: "button", class: "button button-primary training-next" }, "Далее", icon("i-chevron"));
  const controls = h("div", { class: "training-deck-controls" },
    h("span", { class: "training-deck-hint", text: "Листайте карточки или используйте кнопки навигации" }),
    h("div", { class: "training-deck-actions" }, previous, next)
  );
  let active = 0;
  const update = (direction) => {
    const target = Math.max(0, Math.min(slides.length - 1, active + direction));
    if (target === active) return;
    const old = active;
    active = target;
    slides[old].hidden = true;
    slides[old].classList.remove("is-active", "slide-enter-next", "slide-enter-prev");
    slides[active].hidden = false;
    slides[active].classList.add("is-active", direction > 0 ? "slide-enter-next" : "slide-enter-prev");
    progress.querySelector(".training-progress-fill").style.width = `${((active + 1) / slides.length) * 100}%`;
    progress.querySelector(".training-progress-label").textContent = active === slides.length - 1 ? "Последний этап" : `Этап ${active + 1}`;
    progress.querySelector(".training-progress-count").textContent = `${active + 1} / ${slides.length}`;
    previous.disabled = active === 0;
    next.replaceChildren(...(active === slides.length - 1
      ? ["Завершить курс", icon("i-check")]
      : ["Далее", icon("i-chevron")]));
    next.dataset.finish = String(active === slides.length - 1);
    viewport.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  previous.addEventListener("click", () => update(-1));
  next.addEventListener("click", () => {
    if (active === slides.length - 1) location.hash = "#/training";
    else update(1);
  });
  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") { event.preventDefault(); update(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); update(-1); }
  });
  let pointerStart = null;
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.25) update(dx < 0 ? 1 : -1);
  });
  viewport.addEventListener("pointercancel", () => { pointerStart = null; });

  deck.append(toolbar, heading, progress, viewport, controls);
  view.replaceChildren(deck);
}

async function renderTraining(view, route) {
  if (route.sectionKey === "gameplay") {
    const infoRow = (key, title, iconName, ...content) => {
      const popoverId = `gameplay-${key}-popover`;
      return h("div", { class: "training-info-item" },
        h("button", { type: "button", class: "training-info-trigger", popovertarget: popoverId, "aria-label": `Открыть раздел: ${title}` },
          h("span", { class: "section-icon" }, icon(iconName)),
          h("span", { class: "row-text" }, h("strong", { text: title })),
          icon("i-chevron", "row-arrow")
        ),
        h("div", { id: popoverId, popover: "auto", class: "training-content-popover", role: "dialog", "aria-label": title }, ...content)
      );
    };

    const accessCard = h("section", { class: "card" },
      h("div", { class: "card-heading" },
        h("span", { class: "section-icon" }, icon("i-lock")),
        h("div", {}, h("h2", { text: "1. Начальный этап — Пояснение прав доступа" }), h("p", { text: "Ознакомьтесь с выданными правами и порядком получения доступа в игре." }))
      ),
      h("div", { class: "row-list training-info-list" },
        infoRow("access", "Права доступа", "i-lock",
          h("p", { text: `Поздравляем с должностью «${state.profile?.position || "сотрудника"}»! На данном этапе обучения, лучшим решением будет прочитать и пройти всё что видишь. После прохождения всех этапов отбора, тебе выдали права доступа: На форуме и в игре. Права на форуме выдаются сразу после успешного этапа отбора, за получением прав доступа в игре, обратись к вышестоящему руководству. Удачи в обучении, и побольше голдов тебе на голову! :)` })
        )
      )
    );

    const gameplayCard = h("section", { class: "card" },
      h("div", { class: "card-heading" },
        h("span", { class: "section-icon" }, icon("i-monitor")),
        h("div", {}, h("h2", { text: "2. Промежуточный этап — Дежурство и мониторинг игры" }), h("p", { text: "Изучите основные инструменты наблюдения за игровым сервером." }))
      ),
      h("div", { class: "row-list training-info-list" },
        infoRow("chat", "Игровой чат", "i-message",
          h("p", {}, h("strong", { text: "Игровой чат" }), " - чат расположенный в левой части игрового экрана, с которым ты можешь взаимодействовать и где активно происходит обсуждение между танкистами. Твоя первостепенная задача во время дежурства - это мониторить игровой чат на предметы: Оскорбления, Нецензурная брань, Реклама, Деструктивные и Политические темы. Подробнее о материалах (включая сообщения в игровом чате) наущающие правила игры и сообщества ты можешь узнать и прочитать в разделе обучения «Административный аппарат».")
        ),
        infoRow("spectator", "Режим наблюдателя", "i-eye",
          h("p", {}, "Когда тебе выдадут админ-доступ в игре, в описании и подробностях каждой нажатой тобой битвы, в правом верхнем углу, появится кнопка ", h("strong", { text: "«Spectator»" }), ", по нажатию которой, тебя загрузит в битву, но уже в режиме наблюдателя. В нём ты не можешь стрелять, ездить и писать в чат: Только наблюдать."),
          h("p", { text: "Сам режим предназначен для администрации проекта, а конкретно для мониторинга игровых битв, собирания доказательств в виде видеозаписей и скриншотов нарушений (читы, нецензурная брань, реклама, ботоводство и т.д), а также для проведения турниров и возможности записи их." }),
          h("p", { text: "В общем режим универсальный, творить можно многое и всякое. Главное используй режим по назначению: Не просиживай в нём много и долго что бы закрыть отчёт. И главное используй с умом. Входи в битвы через него если видишь в битве подозрительных игроков и/или ники, а также по прямым жалобам игроков, будто на форуме, в группе ВК или игровом чате." })
        ),
        infoRow("battles", "Мониторинг битв", "i-crosshair",
          h("p", { text: `Мониторинг битв - задача не сложная, но утомительная. Главная и первостепенная задача во время мониторинга битв, это вычисление игроков, использующих сторонне ПО или скрипты (проще говоря "Читеров").` }),
          h("p", { text: "Помимо этого, мы отслеживаем боевой чат битвы, где также происходит мониторинг на предмет: Нецензурной брани, Оскорблений, Рекламы и так далее. В общем, мониторинг всего того, что может нарушать правила игры и сообщества." }),
          h("p", { text: `Мониторинг битв можно осуществлять как фактическим нахождением в битве, так и через режим наблюдателя ("Spectator") соответственно. Выбирать тебе!` })
        )
      )
    );

    const hierarchyUrl = "https://forum.mytanks.net/index.php?threads/%F0%9F%93%8A-%D0%9E%D0%A4%D0%98%D0%A6%D0%98%D0%90%D0%9B%D0%AC%D0%9D%D0%90%D0%AF-%D0%A2%D0%90%D0%91%D0%9B%D0%98%D0%A6%D0%90-%D0%98%D0%95%D0%A0%D0%90%D0%A0%D0%A5%D0%98%D0%98-%D0%94%D0%9E%D0%9B%D0%96%D0%9D%D0%9E%D0%A1%D0%A2%D0%95%D0%99-%D0%9F%D0%A0%D0%9E%D0%95%D0%9A%D0%A2%D0%90-mytanks.1281/";
    const docsUrl = "https://service-mytanks.github.io/MT-DOCS/";
    const reportCard = h("section", { class: "card" },
      h("div", { class: "card-heading" },
        h("span", { class: "section-icon" }, icon("i-clipboard-check")),
        h("div", {}, h("h2", { text: "3. Финальный этап — Система отчётности MT DOCS" }), h("p", { text: "Порядок ежедневной сдачи служебной отчётности." }))
      ),
      h("div", { class: "training-report-body" },
        h("p", {}, "Каждый сотрудник занимающий должность (пост) от ",
          h("a", { href: hierarchyUrl, target: "_blank", rel: "noopener noreferrer" }, "Младшего хелпера до Заместителя Главного Администратора (ЗГА)"),
          " обязан на ежедневной основе предоставлять отчёт о проделанной работе путём взаимодействия с ",
          h("a", { href: docsUrl, target: "_blank", rel: "noopener noreferrer" }, "служебным сервисом"),
          " для отправки отчётности MyTank Documentation (MT DOCS). Использование и доступ к служебному сервису является строго конфиденциальной информацией и данными."
        ),
        h("ul", {},
          h("li", {}, "Все отчёты сдаются в обязательном порядке до ", h("strong", { text: "03:00 по МСК" }), "."),
          h("li", {}, "Отсутствие отчёта влечёт за собой отметку ", h("strong", { text: "«Отсутствует»" }), " и/или меру наказания от устного предупреждения до строгого выговора с занесением в таблицу успеваемости администрации."),
          h("li", { text: "Шаблон формы ежедневной отчётности есть на служебном сайте." }),
          h("li", {}, "Все обязательные ежедневные отчёты поступают на ", h("a", { href: "mailto:supportmytanks@gmail.com" }, "почту проекта"), " и проверяются Главным Администратором лично."),
          h("li", {}, "Служебный сервис (сайт) расположен по следующему интернет-адресу (домену): ", h("a", { href: docsUrl, target: "_blank", rel: "noopener noreferrer" }, docsUrl)),
          h("li", {}, "После использования служебного сервиса (сайта), сотрудник обязан написать в группу социальной сети ВКонтакте или Телеграм следующее сообщение:")
        ),
        h("blockquote", { class: "training-report-quote" }, "«Отчёт отправлен. Время: [ЧЧ:ММ]»"),
        h("ul", {},
          h("li", { text: "В случае если письма с отчётами не доставляются на почту команды проекта по техническим причинам (лимиты на отправку, сбой на стороне сервера и так далее), то сдача обязательной ежедневной отчётности осуществляется по старому формату путём отправки шаблона в группу «ЕЖЕДНЕВНЫЕ ОТЧЁТЫ» в социальной сети «ВКонтакте»." }),
          h("li", { text: "Добавление скриншотов активности осуществляется через вставку ссылок на сторонние интернет-ресурсы (файлообменники: imgguru, fotora и так далее). В случае если вставка ссылок невозможна из-за ограничений или сотрудник отправит скриншоты активности в группу «ЕЖЕДНЕВНЫЕ ОТЧЁТЫ» в социальной сети «ВКонтакте», то в разделе «Скриншоты» на служебном сервис-сайте выбираются соответствующие опции (пункты, галочки)." })
        )
      )
    );

    view.append(
      pageHeading("ОБУЧЕНИЕ СОТРУДНИКОВ", route.section, "Практическая подготовка к дежурству и мониторингу игрового процесса MyTanks."),
      accessCard,
      gameplayCard,
      reportCard
    );
    return;
  }

  if (route.sectionKey === "community") {
    const communityStageCard = (title, description, iconName, content) => h("section", { class: "card" },
      h("div", { class: "card-heading" },
        h("span", { class: "section-icon" }, icon(iconName)),
        h("div", {}, h("h2", { text: title }), h("p", { text: description }))
      ),
      content
    );
    const infoRow = (id, title, iconName, label, content) => h("div", { class: "training-info-item" },
      h("button", { type: "button", class: "training-info-trigger", popovertarget: id, "aria-label": `Открыть раздел: ${title}` },
        h("span", { class: "section-icon" }, icon(iconName)),
        h("span", { class: "row-text" }, h("strong", { text: label || title })),
        icon("i-chevron", "row-arrow")
      ),
      h("div", { id, popover: "auto", class: "training-content-popover", role: "dialog", "aria-label": title },
        h("div", { class: "training-report-body" }, content)
      )
    );
    const socialRow = (id, platform, links, explanation) => h("div", { class: "training-social-row" },
      h("div", { class: "training-social-main" },
        h("strong", { text: platform }),
        ...links.map(([kind, url]) => h("div", { class: "training-social-link" },
          h("span", { class: "training-social-kind", text: kind }),
          h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, url)
        ))
      ),
      h("button", { type: "button", class: "training-help-trigger", popovertarget: id, "aria-label": `Пояснение: ${platform}`, title: `О платформе ${platform}` }, "?"),
      h("div", { id, popover: "auto", class: "training-content-popover", role: "dialog", "aria-label": `Пояснение: ${platform}` },
        h("div", { class: "training-report-body" }, h("p", {}, h("strong", { text: platform }), " — ", explanation))
      )
    );

    view.append(
      pageHeading("ОБУЧЕНИЕ СОТРУДНИКОВ", route.section, "Знакомство с площадками проекта, правилами коммуникации и обработкой обращений игроков."),
      communityStageCard("1. Начальный этап — Социальные сети и игровой чат", "Узнай, где находится игровое сообщество и через какие площадки с ним взаимодействовать.", "i-users",
        h("div", { class: "row-list training-info-list" },
          infoRow("community-everywhere-popover", "Мы — везде!", "i-globe",
            "Мы — везде!",
            h("p", {}, "Основополагающим принципом работы с сообществом является знание мест, где расположены чаты для возможности коммуникации с игровым сообществом. Таких мест три (3): ",
              h("strong", { text: "Социальные сети" }), ", ", h("strong", { text: "Игровой чат" }), " и ", h("strong", { text: "Форум" }), "."),
            h("p", { text: "Следующие блоки информации подробнее познакомят тебя с конкретными ссылками на тематические игровые чаты, группы и социальные сети, где они расположены." })
          ),
          h("div", { class: "training-info-item training-social-container" },
            h("div", { class: "training-info-trigger training-social-heading" },
              h("span", { class: "section-icon" }, icon("i-share")),
              h("span", { class: "row-text" }, h("strong", { text: "Социальные сети" })),
              icon("i-chevron", "row-arrow")
            ),
            h("div", { class: "training-social-list" },
              socialRow("community-vk-popover", "ВКонтакте", [
                ["Группа", "https://vk.ru/mytanksnet"],
                ["Чат", "https://vk.me/join/qo641OM6_tTNBRtrMPBs8b7R94xDD1Os4k0="]
              ], "ВКонтакте — основная платформа проекта, где происходит коммуникация между администрацией, разработчиками и игровым сообществом (игроками)."),
              socialRow("community-telegram-popover", "Telegram", [
                ["Канал 1", "https://t.me/mytanks_ru"],
                ["Канал 2", "https://t.me/mytanksnet"],
                ["Чат", "https://t.me/mytanks_chat"]
              ], "Telegram — альтернативная платформа проекта для тех, у кого нет ВКонтакте или кто им не пользуется, а также для тех, кто хочет быть всегда и везде в курсе событий."),
              socialRow("community-discord-popover", "Discord", [
                ["Игровой канал", "https://discord.com/invite/c3sxErTNwd"]
              ], "Discord — ещё одна площадка проекта. Она может служить альтернативой или дополнением к нашим основным социальным сетям.")
            )
          ),
          infoRow("community-game-chat-popover", "Игровой чат", "i-message",
            "Игровой чат",
            h("p", {}, h("strong", { text: "Игровой чат" }), " — чат, расположенный в левой части игрового экрана, где ты также можешь взаимодействовать с игроками путём прямой коммуникации: отвечать на вопросы, информировать о предстоящих обновлениях и просто общаться для души.")
          )
        )
      ),
      communityStageCard("2. Промежуточный этап — Как правильно работать с игровым сообществом?", "Основные принципы общения, информирования и соблюдения делового стиля.", "i-message-circle",
        h("div", { class: "row-list training-info-list" },
          infoRow("community-work-rules-popover", "Как правильно работать с игровым сообществом?", "i-users",
            "Как правильно работать с игровым сообществом?",
            h("p", {}, h("strong", { text: "Работа с игровым сообществом" }), " подразумевает информирование игроков, ответы на вопросы, отработку жалоб и вежливое общение в ", h("u", { text: "деловом стиле" }), "."),
            h("p", {}, h("strong", { text: "Запомни!" })),
            h("p", { text: "Веди общение с игровым сообществом всегда вежливо, в деловом стиле и только по существу. За предоставление неверной информации можно получить по шапке от руководителя. Если не уверен в той или иной информации, лучше спроси у руководителя. Так будет в разы безопаснее и правильнее с этической и практической точки зрения. Ты не уронишь свою репутацию администратора перед игроками и не предоставишь им неверную информацию." }),
            h("p", {}, "Подробнее с должностными обязанностями можно ознакомиться по ссылке ниже или в разделе учебного центра «Административный аппарат». Дополнительные вопросы можно задать руководителю."),
            h("p", {}, h("strong", { text: "Должностные обязанности и значения должностей" }), ": ", h("a", { href: "https://forum.mytanks.net/index.php?threads/%D0%97%D0%9D%D0%90%D0%A7%D0%95%D0%9D%D0%98%D0%95-%D0%94%D0%9E%D0%9B%D0%96%D0%9D%D0%9E%D0%A1%D0%A2%D0%95%D0%99-%D0%92-%D0%98%D0%95%D0%A0%D0%90%D0%A0%D0%A5%D0%98%D0%98.1167/", target: "_blank", rel: "noopener noreferrer" }, "Открыть материал на форуме"))
          )
        )
      ),
      communityStageCard("3. Финальный этап — Отработка обращений и жалоб от игроков", "Научись замечать обращения игроков и определять, через какие каналы они поступают.", "i-inbox",
        h("div", { class: "row-list training-info-list" },
          infoRow("community-complaints-popover", "Отработка обращений и жалоб от игроков", "i-inbox",
            "Отработка обращений и жалоб от игроков",
            h("p", {}, h("strong", { text: "Отработка обращений и жалоб от игроков" }), " подразумевает мониторинг социальных сетей, чатов в них и игрового чата во время дежурства. Отработка обращений и жалоб от игроков может происходить тремя способами:"),
            h("ol", {},
              h("li", {}, h("strong", { text: "Игровой чат. " }), "Игрок пишет напрямую в игровой чат свой вопрос (обращение) и/или жалуется на определённого игрока с конкретным ником по поводу нарушения правил сообщества и игры (нецензурная брань, оскорбления, читы и так далее)."),
              h("li", {}, h("strong", { text: "Чат в социальных сетях. " }), "Игрок пишет в чат или группу свой вопрос (обращение) и/или жалуется на определённого игрока с конкретным ником по поводу нарушения правил сообщества и игры (нецензурная брань, оскорбления, читы и так далее)."),
              h("li", {}, h("strong", { text: "Форум. " }), "Игрок составляет свой вопрос (обращение) и/или жалобу на форуме согласно регламенту и шаблонам подачи жалоб, в отведённых для этого темах и разделах. Подробнее см. в разделе учебного центра «Работа с форумом».")
            )
          )
        )
      )
    );
    return;
  }

  if (route.sectionKey === "forum") {
    const forumStageCard = (title, description, iconName, content) => h("section", { class: "card" },
      h("div", { class: "card-heading" },
        h("span", { class: "section-icon" }, icon(iconName)),
        h("div", {}, h("h2", { text: title }), h("p", { text: description }))
      ),
      content
    );

    view.append(
      pageHeading("ОБУЧЕНИЕ СОТРУДНИКОВ", route.section, "Знакомство с форумом MyTanks и правилами работы с административными разделами."),
      forumStageCard("1. Начальный этап — Права доступа и информация о форуме", "Познакомься с назначением форума и правилами доступа к закрытым разделам.", "i-messages",
        h("div", { class: "row-list training-info-list" },
          h("div", { class: "training-info-item" },
            h("button", { type: "button", class: "training-info-trigger", popovertarget: "forum-about-popover", "aria-label": "Открыть раздел: Что такое форум?" },
              h("span", { class: "section-icon" }, icon("i-message")),
              h("span", { class: "row-text" }, h("strong", { text: "Что такое форум?" })),
              icon("i-chevron", "row-arrow")
            ),
            h("div", { id: "forum-about-popover", popover: "auto", class: "training-content-popover", role: "dialog", "aria-label": "Что такое форум?" },
              h("div", { class: "training-report-body" },
                h("p", {}, "Форум — это основная площадка, на которой ведётся административная деятельность проекта. Здесь рассматриваются жалобы на игроков и администраторов, публикуются предложения по улучшению проекта, обсуждаются проблемы (в том числе ошибки и баги) и способы их решения, а также задаются вопросы и предоставляются ответы."),
                h("p", { text: "Главная задача форума — передавать администрации проекта важную информацию, требующую её внимания и участия. Например, это может быть жалоба на игрока, использующего читы, или сообщение об обнаруженной технической ошибке." }),
                h("p", { text: "Именно на форуме происходит значительная часть внутренней административной работы и обсуждений, которые остаются за пределами игрового процесса." })
              )
            )
          ),
          h("div", { class: "training-info-item" },
            h("button", { type: "button", class: "training-info-trigger", popovertarget: "forum-access-popover", "aria-label": "Открыть раздел: Права доступа" },
              h("span", { class: "section-icon" }, icon("i-lock")),
              h("span", { class: "row-text" }, h("strong", { text: "Права доступа" })),
              icon("i-chevron", "row-arrow")
            ),
            h("div", { id: "forum-access-popover", popover: "auto", class: "training-content-popover", role: "dialog", "aria-label": "Права доступа" },
              h("p", {}, "После твоего назначения на должность «", state.profile?.position || "должность", "», тебе выдают права доступа на форуме. После получения прав доступа, у тебя появляются «админ-разделы» на домашней странице форуме. Обычные игроки не имеют доступ к ним, а также не видят их. Передача информации из админ-разделов строго запрещена! Включая слив данных, пересланные скриншоты, показ содержимого третьим лицам."),
              h("p", {}, h("strong", { text: "За нарушение — перманентное снятие с должности!" }))
            )
          )
        )
      ),
      forumStageCard("2. Промежуточный этап — Админ-раздел, Админ-Архив и раздел для кандидатов", "Изучите назначение административных разделов форума и правила работы с ними.", "i-folder",
        h("div", { class: "training-subsections" },
          h("details", { class: "training-subsection" },
            h("summary", {},
              h("span", { class: "section-icon" }, icon("i-folder")),
              h("strong", { text: "Административный Раздел" }),
              icon("i-chevron", "training-subsection-chevron")
            ),
            h("div", { class: "training-report-body" },
              h("p", {}, h("strong", { text: "Административный раздел" }), " — это скрытый раздел форума, который отображается только и только администраторам. Обычные пользователи не видят его."),
              h("p", { text: "В данном разделе лежат основные и часто используемые материалы для состава администрации: регламенты, шаблоны, заявления и так далее." }),
              h("p", {}, h("a", { href: "https://forum.mytanks.net/index.php?forums/%D0%90%D0%B4%D0%BC%D0%B8%D0%BD-%D0%A0%D0%B0%D0%B7%D0%B4%D0%B5%D0%BB.46/", target: "_blank", rel: "noopener noreferrer" }, "Открыть «Админ-Раздел»")),
              h("p", {}, "Также напомню: разделы являются строго конфиденциальными, и слив информации и данных из них карается перманентным снятием с должности. Учитывай это каждый раз, когда хочешь что-то кому-то оттуда показать. Даже если это лучший друг и он «никогда не расскажет». Дружба — дружбой, но рабочие моменты остаются рабочими.")
            )
          ),
          h("details", { class: "training-subsection" },
            h("summary", {},
              h("span", { class: "section-icon" }, icon("i-archive")),
              h("strong", { text: "Административный Архив" }),
              icon("i-chevron", "training-subsection-chevron")
            ),
            h("div", { class: "training-report-body" },
              h("p", {}, h("strong", { text: "Административный Архив" }), " — это место, где «складируют» уже ", h("s", {}, "неактуальную"), " информацию."),
              h("p", { text: "В большей своей части, там расположены черновики, темы с неправильным оформлением или неточными/некорректными данными, а также всё то, что мы уже считаем хламом и что обычным администраторам уже не понадобится." }),
              h("p", { text: "В «Админ-Архив» можешь кидать черновики, неудачные копии, ненужные или неактуальные темы. Вообще, как им пользоваться и для чего он нужен, думаю, мы разобрались." })
            )
          ),
          h("details", { class: "training-subsection" },
            h("summary", {},
              h("span", { class: "section-icon" }, icon("i-users")),
              h("strong", { text: "Раздел для кандидатов" }),
              icon("i-chevron", "training-subsection-chevron")
            ),
            h("div", { class: "training-report-body" },
              h("p", {}, h("strong", { text: "Раздел для кандидатов" }), " — это место на форуме, где лежит вся основная информация для новых кандидатов, ведь для многих должностей должностной обязанностью является осуществление набора в ряды администрации. Соответственно, сюда же относится просмотр анкетных заявок в соответствующей теме соответствующего раздела."),
              h("p", {}, h("a", { href: "https://forum.mytanks.net/index.php#razdel-dlja-kandidatov.49", target: "_blank", rel: "noopener noreferrer" }, "Открыть «Раздел для кандидатов»")),
              h("p", { text: "В разделе для кандидатов на самом деле много полезной информации, в том числе и для тебя. Считаю, что и тебе будет полезно зайти в него, почитать для себя что-то новое и, главное, полезное." })
            )
          )
        )
      ),
      forumStageCard("3. Финальный этап — Работа с обращениями и создание тем", "Изучите порядок обработки обращений, создания тем и применения префиксов.", "i-message",
        h("div", { class: "training-subsections" },
          h("details", { class: "training-subsection" },
            h("summary", {}, h("span", { class: "section-icon" }, icon("i-message")), h("strong", { text: "Что такое «обращение»?" }), icon("i-chevron", "training-subsection-chevron")),
            h("div", { class: "training-report-body" },
              h("p", {}, h("strong", { text: "Обращение" }), " — это тема, созданная игроком (пользователем с зарегистрированной учётной записью) в соответствующем разделе форума для решения его вопроса или проблемы.")
            )
          ),
          h("details", { class: "training-subsection" },
            h("summary", {}, h("span", { class: "section-icon" }, icon("i-inbox")), h("strong", { text: "Работа с обращениями" }), icon("i-chevron", "training-subsection-chevron")),
            h("div", { class: "training-report-body" },
              h("p", { text: "Одна из основных задач каждого администратора, помимо мониторинга игры, — работа с форумом и поступающими от игроков обращениями." }),
              h("p", {}, h("strong", { text: "Работа с обращениями" }), " подразумевает ежедневный мониторинг форума на предмет новых жалоб, обжалований, вопросов и предложений. Это одна из должностных обязанностей каждого администратора при работе с форумом."),
              h("p", {}, "Все обращения, поступающие от игроков, ", h("strong", { text: "не должны оставаться без ответа более 72 часов (трёх суток)." }), " Даже если у вас или вашей команды нет возможности ответить — например, из-за нехватки знаний, опыта или необходимых компетенций, — ", h("strong", { text: "вы обязаны передать информацию в общую группу администрации." }))
            )
          ),
          h("details", { class: "training-subsection" },
            h("summary", {}, h("span", { class: "section-icon" }, icon("i-edit")), h("strong", { text: "Создание и редактор тем" }), icon("i-chevron", "training-subsection-chevron")),
            h("div", { class: "training-report-body" },
              h("p", { text: "Создание тем и ответов — ключевой навык, необходимый для полноценной работы в администрации." }),
              h("blockquote", { class: "training-report-quote", text: "«Нету ручек — нет конфеток». Знакомо, да?" }),
              h("p", {}, "Принцип здесь такой же: навык создания и оформления тем необходим в повседневной работе. В большинстве разделов форума, за исключением закрытых, доступен редактор тем. Иногда он может казаться неудобным, но основные задачи выполняет: ", h("strong", { text: "позволяет создавать темы и редактировать их." }))
            )
          ),
          h("details", { class: "training-subsection" },
            h("summary", {}, h("span", { class: "section-icon" }, icon("i-tag")), h("strong", { text: "«Префиксы» тем и обращений" }), icon("i-chevron", "training-subsection-chevron")),
            h("div", { class: "training-report-body training-prefix-content" },
              h("p", { text: "Каждой новой теме, созданной игроком, автоматически присваивается префикс «Прошу рассмотреть». Он обозначает, что обращение ожидает внимания администрации." }),
              h("p", { text: "Администраторы, имеющие доступ к инструментам модерации, могут изменять префикс в зависимости от текущего статуса и назначения темы." }),
              h("p", {}, h("strong", { text: "Всего используется 13 префиксов:" }), " четыре красных, два жёлтых, пять зелёных и два голубых. Новым темам игроков автоматически присваивается префикс «Прошу рассмотреть», который также относится к зелёной категории."),
              h("p", { class: "training-prefix-intro", text: "Префиксы сгруппированы по цветам. Цвет помогает быстро определить важность темы или её текущий статус." }),
              ...[
                { tone: "red", title: "Красный", description: "Обозначает важность темы, её закрытие или отклонение (в том числе отказ по анкетной заявке кандидата).", labels: ["Важно", "Команде проекта", "Закрыто", "Отклонено"] },
                { tone: "yellow", title: "Жёлтый", description: "Показывает, что тема находится на рассмотрении или закреплена.", labels: ["На рассмотрении", "Закреплено"] },
                { tone: "green", title: "Зелёный", description: "Используется для тем, по которым принято положительное решение, выполнены необходимые действия или ожидается рассмотрение администрацией.", labels: ["Прошу рассмотреть", "Реализовано", "Рассмотрено", "Одобрено", "Принято"] },
                { tone: "blue", title: "Голубой", description: "Указывает на технический статус темы или ожидание ответа либо дальнейших действий.", labels: ["Тех. Специалисту", "Ожидание"] }
              ].map((group) => h("section", { class: `training-prefix-group training-prefix-${group.tone}` },
                h("div", { class: "training-prefix-heading" },
                  h("span", { class: "training-prefix-swatch" }),
                  h("strong", { text: group.title }),
                  h("span", { class: "training-prefix-count", text: String(group.labels.length) })
                ),
                h("p", { text: group.description }),
                h("div", { class: "training-prefix-list" }, ...group.labels.map((label) => h("span", { class: "training-prefix-chip", text: label })))
              ))
            )
          )
        )
      )
    );
    return;
  }

  if (route.sectionKey !== "administration") {
    view.append(
      pageHeading("БАЗА ЗНАНИЙ", route.section, "Обучающие материалы для команды MyTanks."),
      h("section", { class: "card" },
        emptyBlock("i-doc", "Материалы скоро появятся", "Этот раздел уже подготовлен. Содержимое будет добавлено позднее.")
      )
    );
    return;
  }

  const links = {
    positions: "https://forum.mytanks.net/index.php?threads/%D0%97%D0%9D%D0%90%D0%A7%D0%95%D0%9D%D0%98%D0%95-%D0%94%D0%9E%D0%9B%D0%96%D0%9D%D0%9E%D0%A1%D0%A2%D0%95%D0%99-%D0%92-%D0%98%D0%95%D0%A0%D0%90%D0%A0%D0%A5%D0%98%D0%98.1167/",
    hierarchy: "https://forum.mytanks.net/index.php?threads/%F0%9F%93%8A-%D0%9E%D0%A4%D0%98%D0%A6%D0%98%D0%90%D0%9B%D0%AC%D0%9D%D0%90%D0%AF-%D0%A2%D0%90%D0%91%D0%9B%D0%98%D0%A6%D0%90-%D0%98%D0%95%D0%A0%D0%90%D0%A0%D0%A5%D0%98%D0%98-%D0%94%D0%9E%D0%9B%D0%96%D0%9D%D0%9E%D0%A1%D0%A2%D0%95%D0%99-%D0%9F%D0%A0%D0%9E%D0%95%D0%9A%D0%A2%D0%90-mytanks.1281/",
    rewards: "https://forum.mytanks.net/index.php?threads/%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0-%D0%BD%D0%BE%D1%80%D0%BC%D0%B0%D1%82%D0%B8%D0%B2%D0%BE%D0%B2-%D0%B8-%D0%B2%D0%BE%D0%B7%D0%BD%D0%B0%D0%B3%D1%80%D0%B0%D0%B6%D0%B4%D0%B5%D0%BD%D0%B8%D0%B9.1311/",
    playerRules: "https://forum.mytanks.net/index.php?threads/%F0%9F%9A%9C-%D0%9E%D0%91%D0%A9%D0%98%D0%95-%D0%9F%D0%A0%D0%90%D0%92%D0%98%D0%9B%D0%90-%D0%97%D0%90%D0%9F%D0%A0%D0%95%D0%A2%D0%AB-%D0%98-%D0%9D%D0%90%D0%9A%D0%90%D0%97%D0%90%D0%9D%D0%98%D0%AF-%D0%94%D0%9B%D0%AF-%D0%98%D0%93%D0%A0%D0%9E%D0%9A%D0%9E%D0%92-%D0%A1%D0%95%D0%A0%D0%92%D0%95%D0%A0%D0%90-mytanks.1198/",
    helperRules: "https://forum.mytanks.net/index.php?threads/%F0%9F%93%91-%D0%9F%D0%A0%D0%90%D0%92%D0%98%D0%9B%D0%90-%D0%98-%D0%9E%D0%91%D0%AF%D0%97%D0%90%D0%9D%D0%9D%D0%9E%D0%A1%D0%A2%D0%98-%D0%A5%D0%AD%D0%9B%D0%9F%D0%95%D0%A0%D0%9E%D0%92-mytanks.1186/",
    adminRules: "https://forum.mytanks.net/index.php?threads/%F0%9F%93%91-%D0%9F%D0%A0%D0%90%D0%92%D0%98%D0%9B%D0%90-%D0%98-%D0%9E%D0%91%D0%AF%D0%97%D0%90%D0%9D%D0%9D%D0%9E%D0%A1%D0%A2%D0%98-%D0%90%D0%94%D0%9C%D0%98%D0%9D%D0%98%D0%A1%D0%A2%D0%A0%D0%90%D0%A6%D0%98%D0%98-mytanks.1185/",
    textAttestation: "https://forum.mytanks.net/index.php?forums/%D0%A0%D0%B5%D0%B3%D0%BB%D0%B0%D0%BC%D0%B5%D0%BD%D1%82-%D1%82%D0%B5%D0%BA%D1%81%D1%82%D0%BE%D0%B2%D0%BE%D0%B9-%D0%B0%D1%82%D1%82%D0%B5%D1%81%D1%82%D0%B0%D1%86%D0%B8%D0%B8.64/",
    audioMeeting: "https://forum.mytanks.net/index.php?forums/%D0%A0%D0%B5%D0%B3%D0%BB%D0%B0%D0%BC%D0%B5%D0%BD%D1%82-%D0%B0%D1%83%D0%B4%D0%B8%D0%BE%D1%81%D0%BE%D0%B7%D0%B2%D0%BE%D0%BD%D0%B0.63/",
    applications: "https://forum.mytanks.net/index.php?forums/SHABLONY-ZAYAVLENIY/",
    requests: "https://forum.mytanks.net/index.php?forums/SHABLONY-FORM-I-PROSHENIYA/"
  };

  const card = (title, description, iconName, items) => h("section", { class: "card" },
    h("div", { class: "card-heading" },
      h("span", { class: "section-icon" }, icon(iconName)),
      h("div", {}, h("h2", { text: title }), h("p", { text: description }))),
    h("div", { class: "row-list" }, ...items)
  );

  const finalSubsection = (title, iconName, items) => h("details", { class: "training-subsection" },
    h("summary", {},
      h("span", { class: "section-icon" }, icon(iconName)),
      h("strong", { text: title }),
      icon("i-chevron", "training-subsection-chevron")
    ),
    h("div", { class: "row-list training-subsection-list" }, ...items)
  );

  const finalStage = h("section", { class: "card training-final-stage" },
    h("div", { class: "card-heading" },
      h("span", { class: "section-icon" }, icon("i-clipboard-list")),
      h("div", {}, h("h2", { text: "3. Финальный этап" }), h("p", { text: "Изучите регламенты и утверждённые формы документов." }))),
    h("div", { class: "training-subsections" },
      finalSubsection("Регламенты", "i-clipboard-list", [
        rowLink({ href: links.textAttestation, iconName: "i-file-check", title: "Регламент текстовой аттестации", text: "Раздел с правилами и материалами текстовой аттестации.", external: true }),
        rowLink({ href: links.audioMeeting, iconName: "i-mic", title: "Регламент аудиосозвона", text: "Раздел с правилами проведения аудиосозвона.", external: true })
      ]),
      finalSubsection("Шаблоны заявлений и форм прошения", "i-files", [
        rowLink({ href: links.applications, iconName: "i-file-plus", title: "Шаблоны заявлений", text: "Утверждённые формы заявлений.", external: true }),
        rowLink({ href: links.requests, iconName: "i-mail", title: "Шаблоны форм прошения", text: "Утверждённые формы прошений.", external: true })
      ])
    ),
    h("p", { class: "training-mandatory-note", text: "Обязательно изучите все темы, содержащиеся в этих разделах!" })
  );

  view.append(
    pageHeading("ОБУЧЕНИЕ СОТРУДНИКОВ", route.section, "Последовательная подготовка к работе в административном аппарате MyTanks."),
    card("1. Начальный этап — Знакомство со структурой", "Изучите иерархию проекта, значения должностей и систему нормативов.", "i-network", [
      rowLink({ href: links.positions, iconName: "i-id-card", title: "Значение должностей", text: "Первый обязательный материал для каждого новичка — знакомство с иерархией и смыслом должностей.", external: true }),
      rowLink({ href: links.hierarchy, iconName: "i-network", title: "Официальная таблица иерархий и должностей", text: "Актуальная таблица должностей и структуры проекта MyTanks.", external: true }),
      rowLink({ href: links.rewards, iconName: "i-award", title: "Система нормативов и вознаграждений", text: "Нормативы работы сотрудников и предусмотренные вознаграждения.", external: true })
    ]),
    (() => {
      const section = card("2. Промежуточный этап — Работа с обращениями", "Изучите правила проекта и обязанности сотрудников перед началом самостоятельной работы.", "i-life-buoy", [
        rowLink({ href: links.playerRules, iconName: "i-scale", title: "Правила для игроков", text: "Общие правила, запреты и наказания на сервере MyTanks.", external: true }),
        rowLink({ href: links.helperRules, iconName: "i-life-buoy", title: "Правила для агентов поддержки (хелперов)", text: "Обязанности и правила работы агентов поддержки.", external: true }),
        rowLink({ href: links.adminRules, iconName: "i-shield", title: "Правила для администрации проекта", text: "Регламент работы и обязанности администрации.", external: true })
      ]);
      const help = h("div", { class: "training-help" },
        h("button", { type: "button", class: "training-help-button", popovertarget: "training-help-popover", "aria-label": "Пояснение о работе с обращениями", title: "Пояснение" }, icon("i-help-circle")),
        h("div", { id: "training-help-popover", popover: "auto", class: "training-help-popover", role: "dialog", "aria-label": "Работа с обращениями" },
          h("p", {}, "Работа с обращениями подразумевает ответы на темы игроков используя знания по механикам игры, знанию правил, а также личному опыту в умении решать кейсы разных сложностей, от легких вопросов ", h("strong", { text: "«Как получить доступ к М2-М3 модификациям»" }), " до сложных кейсов, таких как ", h("strong", { text: "«Багоюз»" }), ". Основная работа проходит в соответствующих ветках форума, таких как:"),
          h("ol", {},
            h("li", { text: "Ветка «Жалобы»: только жалобы на игроков." }),
            h("li", { text: "Ветка «Обсуждение игры»." }),
            h("li", { text: "Ветка «Вопрос & Ответ»." }),
            h("li", { text: "Ветка «Идеи и Предложения»." }),
            h("li", { text: "Ветка «Проблемы и Решения»." }),
            h("li", { text: "Ветка «Предложения по улучшению»." })
          ),
          h("p", {}, "Зона вашей ответственности разграничивается в строгом соответствии с вашей должностью, должностные обязанности которой описаны в разделе «Значение должностей». Вы также можете запросить подробное описание у Главного Администратора, Специального Администратора и их заместителей. К примеру, Хелпер не несёт ответственность за ветку «Идеи и Предложения», зато отвечает за «Вопрос & Ответ». Остальные вопросы вы можете задать вышеперечисленным людям. Удачи!")
        )
      );
      section.querySelector(".card-heading").append(help);
      return section;
    })(),
    finalStage
  );
}

async function countRows(table, filters = {}) {
  let query = state.client.from(table).select("id", { count: "exact", head: true }).eq("user_id", state.session.user.id);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function renderHome(view) {
  const links = {
    news: { title: "Новости проекта", text: "Последние объявления и новости MyTanks", href: "https://forum.mytanks.net/index.php?forums/%D0%9D%D0%BE%D0%B2%D0%BE%D1%81%D1%82%D0%B8.37/", iconName: "i-book-open" },
    complaints: { title: "Жалобы", text: "Раздел обращений и жалоб игроков", href: "https://forum.mytanks.net/index.php?forums/Жалобы.38/", iconName: "i-warning" },
    inactivity: { title: "Заявление об уходе в неактив", text: "Оформление временного ухода", href: "https://forum.mytanks.net/index.php?threads/%D0%A8%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD-%D0%B7%D0%B0%D1%8F%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F-%D0%BE%D0%B1-%D1%83%D1%85%D0%BE%D0%B4%D0%B5-%D0%B2-%D0%BD%D0%B5%D0%B0%D0%BA%D1%82%D0%B8%D0%B2.1301/", iconName: "i-clock" },
    meetingAbsence: { title: "Прошение о пропуске собрания", text: "Пропуск еженедельного обзвона", href: "https://forum.mytanks.net/index.php?threads/%D0%A8%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD-%D0%B7%D0%B0%D1%8F%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F-%D0%BD%D0%B0-%D0%BF%D1%80%D0%BE%D0%BF%D1%83%D1%81%D0%BA-%D0%B5%D0%B6%D0%B5%D0%BD%D0%B5%D0%B4%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B3%D0%BE-%D0%BE%D0%B1%D0%B7%D0%B2%D0%BE%D0%BD%D0%B0.1317/", iconName: "i-clock" },
    meetingMove: { title: "Прошение о переносе собрания", text: "Запрос на перенос собрания", href: "https://forum.mytanks.net/index.php?threads/%D0%A8%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD-%D0%BF%D1%80%D0%BE%D1%88%D0%B5%D0%BD%D0%B8%D1%8F-%D0%BE-%D0%BF%D0%B5%D1%80%D0%B5%D0%BD%D0%BE%D1%81%D0%B5-%D1%81%D0%BE%D0%B1%D1%80%D0%B0%D0%BD%D0%B8%D1%8F.1318/", iconName: "i-refresh" },
    dailyTemplate: { title: "Шаблон ежедневного отчёта", text: "Единый универсальный шаблон MT DOCS", href: "https://forum.mytanks.net/index.php?threads/%D0%95%D0%B4%D0%B8%D0%BD%D1%8B%D0%B9-%D1%83%D0%BD%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B9-%D1%88%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD-%D0%B4%D0%BB%D1%8F-mt-docs.1320/", iconName: "i-doc" },
    sanctionTemplate: { title: "Шаблон формы на выдачу наказания", text: "Универсальный шаблон оформления наказания", href: "https://forum.mytanks.net/index.php?threads/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B9-%D1%88%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD-%D1%84%D0%BE%D1%80%D0%BC%D1%8B-%D0%BD%D0%B0-%D0%B2%D1%8B%D0%B4%D0%B0%D1%87%D1%83-%D0%BD%D0%B0%D0%BA%D0%B0%D0%B7%D0%B0%D0%BD%D0%B8%D0%B9.1319/", iconName: "i-shield" }
  };
  const externalRow = (item) => rowLink({ ...item, external: true });
  const adminGroup = (title, items) => h("section", { class: "home-admin-group" },
    h("h3", { class: "home-admin-group-title", text: title }),
    h("div", { class: "row-list" }, ...items.map(externalRow))
  );
  const block = (modifier, title, subtitle, iconName, content) => h("section", {
    class: `card home-block home-block-${modifier}`,
    "aria-label": title
  },
    h("div", { class: "card-heading home-block-heading" },
      h("span", { class: "section-icon" }, icon(iconName)),
      h("div", {}, h("h2", { text: title }), h("p", { text: subtitle }))
    ),
    content,
    h("div", { class: "home-block-snow", "aria-hidden": "true" })
  );

  view.append(
    h("div", { class: "page-heading" },
      h("div", {},
        h("div", { class: "eyebrow" }, h("span"), "РАБОЧЕЕ ПРОСТРАНСТВО"),
        h("h1", { text: `Приветствую, ${state.profile?.nickname || "сотрудник"}!` }),
        h("p", { text: "Основные материалы и рабочие разделы команды — на одной странице." })
      )
    ),
    h("div", { class: "home-newspaper" },
      block("news", "Новости", "Объявления и новости проекта", "i-book-open",
        h("div", { class: "row-list" }, externalRow(links.news))
      ),
      block("admin", "Административный Раздел", "Заявления, прошения и рабочие шаблоны", "i-shield",
        h("div", { class: "home-admin-content" },
          adminGroup("Заявления", [links.inactivity]),
          adminGroup("Прошения", [links.meetingAbsence, links.meetingMove]),
          adminGroup("Шаблоны", [links.dailyTemplate, links.sanctionTemplate])
        )
      ),
      block("complaints", "Отработка обращений", "Работа с жалобами игроков", "i-warning",
        h("div", { class: "row-list" }, externalRow(links.complaints))
      )
    )
  );
}
async function renderReports(view, route, current) {
  const mine = rowLink({ href: "#/reports/mine", iconName: "i-doc", title: "Мои отчёты", text: "История ваших ежедневных отчётов", meta: "…" });
  view.append(
    pageHeading("ОТЧЁТНОСТЬ", "Отчётность", "Ежедневные отчёты команды MyTanks."),
    h("section", { class: "card" }, h("div", { class: "row-list" }, mine,
      rowLink({ href: config.reportsUrl, iconName: "i-plus", title: "Новый отчёт", text: "Откроется форма MT DOCS в новой вкладке", external: true }))));
  try {
    const count = await countRows("reports");
    if (current()) mine.querySelector(".row-meta").textContent = String(count);
  } catch {
    if (current()) mine.querySelector(".row-meta").textContent = "—";
  }
}

async function renderMyReports(view, route, current) {
  const body = h("section", { class: "card" }, loadingBlock());
  view.append(pageHeading("ОТЧЁТНОСТЬ", "Мои отчёты", "Отчёты, отправленные через форму MT DOCS во время входа в рабочее пространство.", newReportLink()), body);
  const { data, error } = await state.client.from("reports").select("id, report_date, position, online_minutes, report_count, subject, body, screenshots, created_at")
    .eq("user_id", state.session.user.id).order("report_date", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (!current()) return;
  if (error) { body.replaceChildren(errorBlock(error, render)); return; }
  if (!data.length) {
    body.replaceChildren(emptyBlock("i-doc", "Отчётов пока нет", "Войдите в рабочее пространство в этом браузере и отправьте отчёт через форму MT DOCS — копия появится здесь.", newReportLink("button button-secondary")));
    return;
  }
  body.replaceChildren(h("div", { class: "table" },
    h("div", { class: "table-head", "aria-hidden": "true" }, h("span", { text: "Дата" }), h("span", { text: "Должность" }), h("span", { text: "Онлайн" }), h("span", { text: "Репорты" }), h("span")),
    ...data.map((report) => h("button", { type: "button", class: "table-row", onclick: () => openReport(report) },
      h("span", { class: "cell-strong", "data-label": "Дата", text: formatDate(report.report_date) }),
      h("span", { "data-label": "Должность", text: report.position }),
      h("span", { "data-label": "Онлайн", text: `${report.online_minutes} мин` }),
      h("span", { "data-label": "Репорты", text: String(report.report_count) }),
      icon("i-chevron", "row-arrow")))));
}

function openReport(report) {
  $("report-dialog-date").textContent = `ОТЧЁТ ЗА ${formatDate(report.report_date)}`;
  $("report-dialog-title").textContent = report.subject || "Ежедневный отчёт";
  $("report-dialog-body").textContent = report.body;
  $("report-dialog-links").replaceChildren(...(report.screenshots || []).filter(isHttpUrl).map((url, index) =>
    h("a", { class: "attachment-chip", href: url, target: "_blank", rel: "noopener noreferrer" }, icon("i-external"), `Скриншот ${index + 1}`)));
  $("report-dialog").showModal();
}

async function renderBlocks(view, route, current) {
  const rows = Object.entries(KINDS).map(([kind, info]) => rowLink({ href: `#/blocks/${kind}`, iconName: info.icon, title: info.title, text: info.hint, meta: "…" }));
  view.append(
    pageHeading("МОНИТОРИНГ ИГРЫ", "Блокировка", "Учёт наказаний, выданных вами в игре."),
    h("section", { class: "card" }, h("div", { class: "card-heading" }, h("span", { class: "section-icon" }, icon("i-lock")), h("div", {}, h("h2", { text: "Мои блокировки" }), h("p", { text: "Баны, кики, муты и предупреждения" }))),
      h("div", { class: "row-list" }, ...rows)));
  const counts = await Promise.allSettled(Object.keys(KINDS).map((kind) => countRows("sanctions", { kind })));
  if (!current()) return;
  counts.forEach((result, index) => { rows[index].querySelector(".row-meta").textContent = result.status === "fulfilled" ? String(result.value) : "—"; });
}

async function renderSanctions(view, route, current) {
  const info = KINDS[route.kind];
  const body = h("section", { class: "card" }, loadingBlock());
  const addButton = h("button", { type: "button", class: "button button-primary", onclick: () => openSanctionDialog(route.kind) }, icon("i-plus"), info.add);
  view.append(pageHeading("МОИ БЛОКИРОВКИ", info.title, info.hint + ".", addButton), body);
  const { data, error } = await state.client.from("sanctions").select("*")
    .eq("user_id", state.session.user.id).eq("kind", route.kind).order("issued_at", { ascending: false }).limit(500);
  if (!current()) return;
  if (error) { body.replaceChildren(errorBlock(error, render)); return; }
  if (!data.length) {
    body.replaceChildren(emptyBlock(info.icon, "Записей пока нет", `Здесь появятся ваши записи: ${info.title.toLowerCase().replace("мои ", "")}.`,
      h("button", { type: "button", class: "button button-secondary", onclick: () => openSanctionDialog(route.kind) }, icon("i-plus"), info.add)));
    return;
  }
  body.replaceChildren(h("div", { class: "record-list" }, ...data.map((item) => h("article", { class: "record" },
    h("div", { class: "record-main" },
      h("div", { class: "record-title" }, h("strong", { text: item.player_nickname }), info.duration ? h("span", { class: `pill${item.is_permanent ? " pill-danger" : ""}`, text: formatDuration(item.duration_minutes, item.is_permanent) }) : null),
      h("p", { class: "record-reason", text: item.reason }),
      item.comment ? h("p", { class: "record-comment", text: item.comment }) : null,
      h("div", { class: "record-meta" }, h("span", {}, icon("i-clock"), formatDateTime(item.issued_at)),
        item.evidence_url && isHttpUrl(item.evidence_url) ? h("a", { href: item.evidence_url, target: "_blank", rel: "noopener noreferrer" }, icon("i-external"), "Доказательства") : null)),
    h("button", { type: "button", class: "icon-button danger", "aria-label": `Удалить запись о ${item.player_nickname}`, title: "Удалить", onclick: () => deleteSanction(item) }, icon("i-close"))))));
}

function openSanctionDialog(kind) {
  const info = KINDS[kind];
  state.sanctionKind = kind;
  const form = $("sanction-form");
  form.reset();
  $("sanction-title").textContent = info.add;
  $("sanction-issued").value = localDateTimeValue();
  $("sanction-issued").max = localDateTimeValue();
  $("duration-field").hidden = !info.duration;
  $("permanent-label").hidden = !info.permanent;
  $("sanction-duration").disabled = false;
  $("sanction-unit").disabled = false;
  $("sanction-unit").value = kind === "mute" ? "60" : "1440";
  setMessage("sanction-message", "");
  $("sanction-dialog").showModal();
  $("sanction-player").focus();
}

function readSanction() {
  const info = KINDS[state.sanctionKind];
  const player = $("sanction-player").value.trim();
  const reason = $("sanction-reason").value.trim();
  const evidence = $("sanction-evidence").value.trim();
  const comment = $("sanction-comment").value.trim();
  const issuedValue = $("sanction-issued").value;
  const issued = issuedValue ? new Date(issuedValue) : null;
  if (!player) return { error: "Укажите ник нарушителя.", focus: "sanction-player" };
  if (!issued || Number.isNaN(issued.getTime())) return { error: "Укажите дату и время.", focus: "sanction-issued" };
  if (issued.getTime() > Date.now() + 60_000) return { error: "Дата не может быть в будущем.", focus: "sanction-issued" };
  if (!reason) return { error: "Укажите причину.", focus: "sanction-reason" };
  const permanent = Boolean(info.permanent && $("sanction-permanent").checked);
  let duration = null;
  if (info.duration && !permanent) {
    const amount = Number($("sanction-duration").value);
    if (!Number.isInteger(amount) || amount < 1) return { error: "Укажите срок целым числом больше нуля.", focus: "sanction-duration" };
    duration = amount * Number($("sanction-unit").value);
    if (duration > MAX_SANCTION_MINUTES) return { error: "Срок не может превышать 10 лет. Для бессрочного бана отметьте «Навсегда».", focus: "sanction-duration" };
  }
  if (evidence && !isHttpUrl(evidence)) return { error: "Ссылка должна начинаться с http:// или https:// и не содержать пробелов.", focus: "sanction-evidence" };
  return { row: { kind: state.sanctionKind, user_id: state.session.user.id, player_nickname: player, reason, duration_minutes: duration, is_permanent: permanent, evidence_url: evidence || null, comment: comment || null, issued_at: issued.toISOString() } };
}

async function submitSanction(event) {
  event.preventDefault();
  const result = readSanction();
  if (result.error) { setMessage("sanction-message", result.error); $(result.focus).focus(); return; }
  const button = $("sanction-submit");
  setBusy(button, true, "Сохраняем…");
  const { error } = await state.client.from("sanctions").insert(result.row);
  setBusy(button, false);
  if (error) { setMessage("sanction-message", friendlyError(error)); return; }
  $("sanction-dialog").close();
  showToast(`${KINDS[state.sanctionKind].one}: запись сохранена.`);
  render();
}

function confirmAction(title, text, okLabel = "Подтвердить") {
  return new Promise((resolve) => {
    const dialog = $("confirm-dialog");
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    $("confirm-ok").textContent = okLabel;
    const ok = () => { cleanup(); dialog.close(); resolve(true); };
    const close = () => { cleanup(); resolve(false); };
    const cleanup = () => { $("confirm-ok").removeEventListener("click", ok); dialog.removeEventListener("close", close); };
    $("confirm-ok").addEventListener("click", ok);
    dialog.addEventListener("close", close);
    dialog.showModal();
  });
}

async function deleteSanction(item) {
  if (!await confirmAction("Удалить запись?", `Запись о «${item.player_nickname}» будет удалена без возможности восстановления.`, "Удалить")) return;
  const { data, error } = await state.client.from("sanctions").delete().eq("id", item.id).select("id");
  if (error || !data?.length) { showToast(error ? friendlyError(error) : "Запись не удалена: недостаточно прав."); return; }
  showToast("Запись удалена.");
  render();
}

function renderAppearanceSettings() {
  const themeButtons = THEME_OPTIONS.map((item) => h("button", {
    type: "button",
    class: `theme-choice ${item.swatch}`,
    "data-theme-choice": item.id,
    "aria-pressed": String(state.theme === item.id),
    onclick: () => { applyTheme(item.id, true); showToast(`Тема «${item.name}» сохранена.`); },
  },
    h("span", { class: "theme-choice-preview", "aria-hidden": "true" }),
    h("span", { class: "theme-choice-copy" }, h("strong", { text: item.name }), h("small", { text: item.description })),
    h("span", { class: "theme-choice-check", "aria-hidden": "true" }, icon("i-check"))
  ));
  const presentation = h("input", { type: "checkbox", id: "training-presentation-toggle", class: "ios-toggle-input", checked: getTrainingViewMode() === "presentation", onchange: (event) => setTrainingViewMode(event.target.checked ? "presentation" : "standard") });
  const sections = [
    h("section", { class: "appearance-section" },
      h("div", { class: "appearance-section-heading" }, h("strong", { text: "Цветовая схема" }), h("small", { class: "muted", text: state.globalTheme === "new-year" ? "Сейчас для всех пользователей принудительно включена Новогодняя тема. Ваш выбор сохранится и восстановится после её отключения." : "Применяется ко всему MyWorkspace и сохраняется для вашего аккаунта." })),
      h("div", { class: "theme-choice-grid" }, themeButtons)
    )
  ];
  if (isSupportAccount()) {
    const holiday = h("input", { type: "checkbox", id: "global-holiday-toggle", class: "ios-toggle-input", checked: state.globalTheme === "new-year", onchange: (event) => setGlobalHolidayTheme(event.target.checked) });
    sections.push(h("section", { class: "appearance-section global-theme-control" },
      h("div", { class: "appearance-section-heading" }, h("strong", { text: "Глобальное оформление" }), h("small", { class: "muted", text: "Управление праздничной темой всего рабочего пространства. Изменение сразу применяется ко всем пользователям." })),
      h("label", { class: "ios-setting-row", for: "global-holiday-toggle" },
        h("span", { class: "ios-setting-copy" }, h("strong", { text: "Новогодняя тема для всех" }), h("small", { text: "Включает праздничное оформление всем сотрудникам, не изменяя их личные настройки." })),
        holiday,
        h("span", { class: "ios-toggle-track", "aria-hidden": "true" }, h("span", { class: "ios-toggle-thumb" }))
      )
    ));
  }
  sections.push(h("section", { class: "appearance-section training-appearance-section" },
    h("div", { class: "appearance-section-heading" }, h("strong", { text: "Учебный центр" }), h("small", { class: "muted", text: "Выберите способ отображения обучающих материалов." })),
    h("label", { class: "ios-setting-row", for: "training-presentation-toggle" },
      h("span", { class: "ios-setting-copy" }, h("strong", { text: "Режим презентации" }), h("small", { text: "Материалы открываются карточками с перелистыванием." })),
      presentation,
      h("span", { class: "ios-toggle-track", "aria-hidden": "true" }, h("span", { class: "ios-toggle-thumb" }))
    )
  ));
  return h("section", { class: "card appearance-card" },
    h("div", { class: "card-heading" }, h("div", {}, h("h2", { text: "Внешний вид" }), h("p", { class: "muted", text: "Персональные настройки оформления рабочего пространства." }))),
    h("div", { class: "appearance-body" }, sections)
  );
}

async function renderAccount(view, route, current) {
  const profile = state.profile;
  const avatar = h("img", { class: "profile-avatar", src: avatarPublicUrl(profile.avatar_path), alt: "Аватар " + profile.nickname, width: 64, height: 64 });
  const avatarInput = h("input", { type: "file", id: "avatar-file", accept: "image/png,image/jpeg,image/webp", hidden: true });
  const uploadButton = h("button", { type: "button", class: "button button-secondary small", disabled: true }, "Загрузить аватар");
  const removeButton = h("button", { type: "button", class: "button button-secondary small", disabled: !profile.avatar_path }, "Удалить");
  const avatarActions = h("div", { class: "avatar-actions" }, avatarInput, h("button", { type: "button", class: "button button-secondary small", onclick: () => avatarInput.click() }, "Выбрать изображение"), uploadButton, removeButton, h("small", { class: "muted", text: "PNG, JPG или WebP. До 2 МБ после обработки; изображение будет обрезано до квадрата." }));
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files?.[0]; if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { showToast("Выберите PNG, JPG или WebP размером до 8 МБ."); avatarInput.value = ""; return; }
    const reader = new FileReader(); reader.onload = () => { avatar.src = String(reader.result); uploadButton.disabled = false; }; reader.readAsDataURL(file);
  });
  uploadButton.addEventListener("click", () => uploadAvatar(avatarInput.files?.[0], uploadButton));
  removeButton.addEventListener("click", () => removeAvatar(removeButton));
  const info = (label, value) => h("div", { class: "info-item" }, h("small", { text: label }), h("strong", { text: value }));
  view.append(pageHeading("ПРОФИЛЬ СОТРУДНИКА", "Личный кабинет", "Ваши данные и настройки доступа.",
    h("button", { type: "button", class: "button button-secondary", onclick: openAccountSettings }, icon("i-shield"), "Настройки аккаунта"),
    h("button", { type: "button", class: "button button-secondary", onclick: logout }, icon("i-logout"), "Выйти")),
    h("section", { class: "card" }, h("div", { class: "profile-head" }, avatar, h("div", { class: "profile-identity" }, h("h2", { text: profile.nickname }), h("p", { class: "muted", text: profile.position }), avatarActions), h("span", { class: "pill pill-success", text: profile.is_admin ? "Руководитель" : "Доступ открыт" })),
      h("div", { class: "info-grid" }, info("Почта", state.session.user.email || profile.email), info("Должность", profile.position), info("Аккаунт создан", formatDateTime(profile.created_at)), info("Одобрен", profile.reviewed_at ? formatDateTime(profile.reviewed_at) : "—")),
      h("p", { class: "card-note", text: "Никнейм, почту и пароль можно изменить в настройках аккаунта. Должность и права доступа изменяются только руководителем." })));
  view.append(renderAppearanceSettings());
  if (profile.is_admin) await renderAdmin(view, current);
}

function openAccountSettings() {
  const email = String(state.session?.user?.email || "").trim();
  const locked = email.toLowerCase() === "supportmytanks@gmail.com";
  $("settings-current-email").textContent = email || "—"; $("settings-new-email").value = "";
  $("settings-new-email").disabled = locked; $("settings-email-submit").disabled = locked;
  $("settings-email-locked").hidden = !locked;
  $("settings-email-message").hidden = true; $("settings-nickname-message").hidden = true; $("settings-password-message").hidden = true;
  $("settings-nickname").value = state.profile?.nickname || ""; $("account-settings-dialog").showModal();
}

async function changeNickname(event) {
  event.preventDefault(); const nickname = $("settings-nickname").value.trim();
  if (nickname.length < 2 || nickname.length > 64) { setMessage("settings-nickname-message", "Никнейм должен содержать от 2 до 64 символов."); return; }
  const button = $("settings-nickname-submit"); setBusy(button, true, "Сохраняем…");
  const { error } = await state.client.rpc("update_own_nickname", { new_nickname: nickname }); setBusy(button, false);
  if (error) { setMessage("settings-nickname-message", friendlyError(error)); return; }
  state.profile = await loadProfile(); $("sidebar-nickname").textContent = state.profile.nickname; $("topbar-nickname").textContent = state.profile.nickname;
  setMessage("settings-nickname-message", "Никнейм обновлён.", "success"); showToast("Никнейм успешно изменён."); render();
}

async function requestEmailChange(event) {
  event.preventDefault(); const current = String(state.session?.user?.email || "").trim().toLowerCase(); const email = $("settings-new-email").value.trim().toLowerCase();
  if (current === "supportmytanks@gmail.com") { setMessage("settings-email-message", "Для этого аккаунта смена почты отключена."); return; }
  if (!$("settings-new-email").checkValidity() || !email) { setMessage("settings-email-message", "Введите корректный новый адрес почты."); return; }
  if (email === current) { setMessage("settings-email-message", "Новая почта совпадает с текущей."); return; }
  if (email === "supportmytanks@gmail.com") { setMessage("settings-email-message", "Этот адрес закреплён за служебным аккаунтом."); return; }
  const button = $("settings-email-submit"); setBusy(button, true, "Отправляем…");
  const { error } = await state.client.auth.updateUser({ email }, { emailRedirectTo: appUrl() }); setBusy(button, false);
  if (error) { setMessage("settings-email-message", friendlyError(error)); return; }
  event.target.reset(); setMessage("settings-email-message", "Письмо для подтверждения отправлено на новый адрес. Почта профиля изменится после подтверждения; статус и права останутся прежними.", "success");
}

async function compressAvatar(file) {
  const image = await new Promise((resolve, reject) => { const img = new Image(); const reader = new FileReader(); reader.onerror = () => reject(new Error("Не удалось прочитать изображение.")); reader.onload = () => { img.onerror = () => reject(new Error("Некорректный файл изображения.")); img.onload = () => resolve(img); img.src = reader.result; }; reader.readAsDataURL(file); });
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 512; const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#171a20"; ctx.fillRect(0, 0, 512, 512); const side = Math.min(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
  if (!blob || blob.size > 2 * 1024 * 1024) throw new Error("Не удалось обработать изображение до 2 МБ."); return blob;
}

async function uploadAvatar(file, button) {
  if (!file) return; setBusy(button, true, "Загружаем…");
  try { const blob = await compressAvatar(file); const path = state.session.user.id + "/avatar.webp";
    const { error: uploadError } = await state.client.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "3600" }); if (uploadError) throw uploadError;
    const { error } = await state.client.rpc("set_own_avatar_path", { new_path: path }); if (error) throw error;
    state.profile = await loadProfile(); updateAvatarImages(); showToast("Аватар обновлён."); render();
  } catch (error) { showToast(friendlyError(error)); } finally { setBusy(button, false); }
}

async function removeAvatar(button) {
  if (!state.profile?.avatar_path || !await confirmAction("Удалить аватар?", "Вместо фотографии будет отображаться стандартная аватарка.", "Удалить")) return;
  setBusy(button, true, "Удаляем…"); const path = state.profile.avatar_path;
  const { error } = await state.client.rpc("set_own_avatar_path", { new_path: null });
  if (error) { setBusy(button, false); showToast(friendlyError(error)); return; }
  state.profile = await loadProfile(); updateAvatarImages(); const { error: removeError } = await state.client.storage.from("avatars").remove([path]);
  setBusy(button, false); showToast(removeError ? "Аватар отвязан, но файл не удалось удалить." : "Аватар удалён."); render();
}

async function changePassword(event) {
  event.preventDefault(); const password = $("settings-new-password").value;
  if (password.length < 8) { setMessage("settings-password-message", "Пароль должен содержать не менее 8 символов."); return; }
  if (password !== $("settings-password-repeat").value) { setMessage("settings-password-message", "Пароли не совпадают."); return; }
  const button = $("settings-password-submit"); setBusy(button, true, "Сохраняем…");
  const { error } = await state.client.auth.updateUser({ password }); setBusy(button, false);
  if (error) { setMessage("settings-password-message", friendlyError(error)); return; }
  event.target.reset(); setMessage("settings-password-message", "Пароль изменён.", "success");
}

async function renderAdmin(view, current) {
  const section = h("section", { class: "card" },
    h("div", { class: "card-heading" }, h("span", { class: "section-icon" }, icon("i-user")), h("div", {}, h("h2", { text: "Сотрудники и заявки" }), h("p", { text: "Одобрение регистраций и управление доступом" }))),
    loadingBlock());
  view.append(section);
  const { data, error } = await state.client.from("profiles").select("id, email, nickname, position, status, is_admin, created_at").order("created_at", { ascending: false });
  if (!current()) return;
  if (error) { section.lastChild.replaceWith(errorBlock(error, render)); return; }
  const groups = [["pending", "Ожидают одобрения"], ["approved", "Активные"], ["rejected", "Отклонённые и отозванные"]];
  const statusAction = (person, status, label, className) => h("button", { type: "button", class: `button ${className} small`, onclick: () => changeStatus(person, status) }, label);
  section.lastChild.replaceWith(h("div", { class: "admin-groups" }, ...groups.map(([status, title]) => {
    const people = data.filter((person) => person.status === status);
    return h("div", { class: "admin-group" }, h("h3", {}, title, h("span", { class: "count", text: String(people.length) })),
      people.length ? h("div", { class: "people" }, ...people.map((person) => h("div", { class: "person" },
        h("div", { class: "person-text" }, h("strong", {}, person.nickname, person.is_admin ? h("span", { class: "pill", text: "руководитель" }) : null), h("small", { text: `${person.position} · ${person.email}` }), h("small", { text: `Регистрация: ${formatDateTime(person.created_at)}` })),
        person.id === state.profile.id ? h("span", { class: "muted small-text", text: "Это вы" }) : h("div", { class: "person-actions" },
          status !== "approved" ? statusAction(person, "approved", "Одобрить", "button-primary") : null,
          status === "pending" ? statusAction(person, "rejected", "Отклонить", "button-secondary") : null,
          status === "approved" ? statusAction(person, "rejected", "Отозвать доступ", "button-secondary") : null))))
        : h("p", { class: "muted small-text", text: "Нет сотрудников." }));
  })));
}

async function changeStatus(person, status) {
  const texts = { approved: ["Одобрить доступ?", `${person.nickname} получит доступ к рабочему пространству.`, "Одобрить"], rejected: ["Закрыть доступ?", `${person.nickname} больше не сможет пользоваться рабочим пространством.`, "Закрыть доступ"] };
  if (!await confirmAction(...texts[status])) return;
  const { error } = await state.client.rpc("set_account_status", { target: person.id, new_status: status });
  if (error) { showToast(friendlyError(error)); return; }
  showToast(status === "approved" ? `Доступ для ${person.nickname} открыт.` : `Доступ для ${person.nickname} закрыт.`);
  refreshPendingBadge();
  render();
}

async function logout() {
  const { error } = await state.client.auth.signOut();
  if (error) await state.client.auth.signOut({ scope: "local" });
  state.session = null;
  state.profile = null;
  location.replace("#/home");
  showScreen("login");
}

function openSidebar() { document.body.classList.add("sidebar-open"); $("sidebar-backdrop").hidden = false; $("menu-button").setAttribute("aria-expanded", "true"); }
function closeSidebar() { document.body.classList.remove("sidebar-open"); $("sidebar-backdrop").hidden = true; $("menu-button").setAttribute("aria-expanded", "false"); }

function bindAuthForms() {
  $("tab-login").addEventListener("click", () => selectTab("login"));
  $("tab-register").addEventListener("click", () => selectTab("register"));

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    if (!$("login-email").checkValidity() || !email) { setMessage("login-message", "Введите корректную почту."); $("login-email").focus(); return; }
    if (!password) { setMessage("login-message", "Введите пароль."); $("login-password").focus(); return; }
    const button = event.target.querySelector("button[type=submit]");
    setBusy(button, true, "Входим…");
    const { data, error } = await state.client.auth.signInWithPassword({ email, password });
    setBusy(button, false);
    if (error) { setMessage("login-message", friendlyError(error)); return; }
    state.session = data.session;
    $("login-password").value = "";
    enterWorkspace();
  });

  $("forgot-password").addEventListener("click", async () => {
    const email = $("login-email").value.trim();
    if (!email || !$("login-email").checkValidity()) { setMessage("login-message", "Введите почту в поле выше, затем нажмите «Забыли пароль?»."); $("login-email").focus(); return; }
    const { error } = await state.client.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    setMessage("login-message", error ? friendlyError(error) : "Если аккаунт существует, на почту отправлена ссылка для смены пароля.", error ? "error" : "success");
  });

  $("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const nickname = $("register-nickname").value.trim();
    const position = $("register-position").value;
    const email = $("register-email").value.trim();
    const password = $("register-password").value;
    const fail = (text, id) => { setMessage("register-message", text); $(id).focus(); };
    if (nickname.length < 2) return fail("Никнейм должен содержать от 2 до 64 символов.", "register-nickname");
    if (!position || !POSITIONS.includes(position)) return fail("Выберите должность из списка.", "register-position");
    if (!email || !$("register-email").checkValidity()) return fail("Введите корректную почту.", "register-email");
    if (password.length < 8) return fail("Пароль должен содержать не менее 8 символов.", "register-password");
    if (password !== $("register-password-repeat").value) return fail("Пароли не совпадают.", "register-password-repeat");
    const button = event.target.querySelector("button[type=submit]");
    setBusy(button, true, "Отправляем…");
    const { data, error } = await state.client.auth.signUp({ email, password, options: { data: { nickname, position }, emailRedirectTo: appUrl() } });
    setBusy(button, false);
    if (error) { setMessage("register-message", friendlyError(error)); return; }
    event.target.reset();
    if (data.session) { state.session = data.session; enterWorkspace(); return; }
    selectTab("login");
    $("login-email").value = email;
    setMessage("login-message", "Заявка создана. Мы отправили письмо на почту — перейдите по ссылке, чтобы подтвердить адрес. После этого дождитесь одобрения руководителя.", "success");
  });

  $("recovery-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("recovery-password").value;
    if (password.length < 8) { setMessage("recovery-message", "Пароль должен содержать не менее 8 символов."); return; }
    const button = event.target.querySelector("button[type=submit]");
    setBusy(button, true, "Сохраняем…");
    const { error } = await state.client.auth.updateUser({ password });
    setBusy(button, false);
    if (error) { setMessage("recovery-message", friendlyError(error)); return; }
    state.recovery = false;
    event.target.reset();
    showToast("Пароль обновлён.");
    enterWorkspace();
  });

  $("gate-refresh").addEventListener("click", enterWorkspace);
  $("gate-logout").addEventListener("click", logout);
}

function bindApp() {
  window.addEventListener("hashchange", () => { if (!$("app-view").hidden) { if (parseRoute()) render(); else location.replace("#/home"); } });
  $("sidebar-logout").addEventListener("click", logout);
  $("menu-button").addEventListener("click", () => document.body.classList.contains("sidebar-open") ? closeSidebar() : openSidebar());
  $("sidebar-backdrop").addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) closeSidebar(); });
  for (const [toggleId, itemsId] of [["monitoring-toggle", "monitoring-items"], ["training-toggle", "training-items"]]) {
    $(toggleId).addEventListener("click", () => {
      const toggle = $(toggleId);
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      $(itemsId).hidden = !expanded;
      if (toggleId === "training-toggle") toggle.setAttribute("aria-label", expanded ? "Свернуть список курсов" : "Открыть список курсов");
    });
  }
  $("sanction-form").addEventListener("submit", submitSanction);
  $("settings-nickname-form").addEventListener("submit", changeNickname);
  $("settings-email-form").addEventListener("submit", requestEmailChange);
  $("settings-password-form").addEventListener("submit", changePassword);
  $("sanction-permanent").addEventListener("change", (event) => {
    $("sanction-duration").disabled = event.target.checked;
    $("sanction-unit").disabled = event.target.checked;
  });
  for (const button of document.querySelectorAll("[data-close]")) button.addEventListener("click", () => button.closest("dialog").close());
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  }
}

const appUrl = () => `${location.origin}${location.pathname}`;

function readAuthError() {
  const params = new URLSearchParams(location.hash.replace(/^#/, "") || location.search.replace(/^\?/, ""));
  const code = params.get("error_code") || params.get("error");
  if (!code) return "";
  history.replaceState(null, "", appUrl());
  if (/otp_expired/.test(code)) return "Ссылка из письма устарела или уже использована. Войдите или запросите новую.";
  return `Не удалось подтвердить ссылку: ${(params.get("error_description") || code).slice(0, 200)}`;
}

async function start() {
  bindAuthForms();
  bindApp();
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase?.createClient) {
    showGate({ title: "Сервер не подключён", text: "Укажите адрес проекта Supabase и публичный ключ в файле config.js, затем обновите страницу.", iconName: "i-warning", actions: false });
    return;
  }
  const authError = readAuthError();
  state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  state.client.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (event === "PASSWORD_RECOVERY") { state.recovery = true; setTimeout(() => showScreen("recovery"), 0); }
    if (event === "SIGNED_OUT") {
      state.profile = null;
      state.globalTheme = "mt-standard";
      if (state.globalThemeChannel) { state.client.removeChannel(state.globalThemeChannel); state.globalThemeChannel = null; }
      applyTheme("mt-standard");
      setTimeout(() => showScreen("login"), 0);
    }
  });
  const { data, error } = await state.client.auth.getSession();
  if (/access_token|refresh_token|type=/.test(location.hash)) history.replaceState(null, "", `${appUrl()}#/home`);
  if (error) { showScreen("login"); setMessage("login-message", friendlyError(error)); return; }
  state.session = data.session;
  if (!state.session) { showScreen("login"); if (authError) setMessage("login-message", authError); return; }
  enterWorkspace();
}

start();
