const LEGACY_STORAGE_KEY = "training-rhythm-tracker-v2";
const ACCOUNT_STORAGE_PREFIX = "training-rhythm-tracker-account-v3";
const DRIVE_DATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const DRIVE_SCOPE = [DRIVE_DATA_SCOPE, "openid", "email", "profile"].join(" ");
const DEFAULT_DRIVE_FILE_NAME = "training-rhythm-data.json";
const OPENID_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration";
const FALLBACK_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const DRIVE_CONFIG = window.GOOGLE_DRIVE_CONFIG || {};
const HISTORY_RANGES = ["7d", "30d", "year"];
const WEEKDAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const TAB_IDS = ["daily", "profile", "progress"];
const TRACK_ACCENTS = ["#d4a95f", "#8d98a5", "#9f4b21", "#348d83", "#bf6c44", "#7f8b95"];

const TRACKS = [
  {
    id: "pullups",
    title: "Подтягивания",
    type: "number",
    target: 30,
    unit: "повторений",
    shortUnit: "повт.",
    accent: "#d56b35",
    description: "Запиши итог за день, чтобы видеть силу в динамике.",
    increments: [5, 10, 20],
    energyModel: "reps",
    energyMet: 8.5,
    secondsPerRep: 4,
  },
  {
    id: "pushups",
    title: "Отжимания",
    type: "number",
    target: 50,
    unit: "повторений",
    shortUnit: "повт.",
    accent: "#f0b14d",
    description: "Даже короткий подход поддерживает ритм и серию.",
    increments: [10, 20, 30],
    energyModel: "reps",
    energyMet: 8,
    secondsPerRep: 2.5,
  },
  {
    id: "squats",
    title: "Приседания",
    type: "number",
    target: 100,
    unit: "повторений",
    shortUnit: "повт.",
    accent: "#bf6c44",
    description: "Фиксируй объем ног так же честно, как верх тела.",
    increments: [10, 20, 40],
    energyModel: "reps",
    energyMet: 5.5,
    secondsPerRep: 2.8,
  },
  {
    id: "steps",
    title: "Шаги",
    type: "number",
    target: 15000,
    unit: "шагов",
    shortUnit: "шагов",
    accent: "#18756d",
    description: "Ходьба держит общий тонус и помогает не выпадать из режима.",
    increments: [1000, 2000, 5000],
    energyModel: "steps",
  },
  {
    id: "abs",
    title: "Пресс",
    type: "checkbox",
    accent: "#348d83",
    scheduleDays: [0, 2, 4],
    scheduleLabel: "Вс / Вт / Чт",
    description: "Фиксированный блок по Вс / Вт / Чт. Нужна только отметка о выполнении.",
    energyModel: "session",
    sessionMinutes: 12,
    energyMet: 5.5,
  },
  {
    id: "shoulders",
    title: "Тренировка плеч",
    type: "checkbox",
    accent: "#9f4b21",
    scheduleDays: [1, 3, 5],
    scheduleLabel: "Пн / Ср / Пт",
    description: "Фиксированный блок по Пн / Ср / Пт. Отметь галочкой, когда сессия закрыта.",
    energyModel: "session",
    sessionMinutes: 20,
    energyMet: 6.2,
  },
];

const elements = {
  selectedDate: document.querySelector("#selected-date"),
  openDatePicker: document.querySelector("#open-date-picker"),
  trackerGrid: document.querySelector("#tracker-grid"),
  dayNotes: document.querySelector("#day-notes"),
  historyGrid: document.querySelector("#history-grid"),
  insightGrid: document.querySelector("#insight-grid"),
  dashboardShell: document.querySelector("#dashboard-shell"),
  progressRing: document.querySelector("#progress-ring"),
  progressValue: document.querySelector("#progress-value"),
  heroText: document.querySelector("#hero-text"),
  heroPlan: document.querySelector("#hero-plan"),
  profilePanel: document.querySelector("#profile-panel"),
  statusNote: document.querySelector("#status-note"),
  dayPulseValue: document.querySelector("#day-pulse-value"),
  dayPulseText: document.querySelector("#day-pulse-text"),
  todayBurnValue: document.querySelector("#today-burn-value"),
  todayBurnMeta: document.querySelector("#today-burn-meta"),
  todayBurnBreakdown: document.querySelector("#today-burn-breakdown"),
  streakValue: document.querySelector("#streak-value"),
  activeDaysValue: document.querySelector("#active-days-value"),
  volumeValue: document.querySelector("#volume-value"),
  planValue: document.querySelector("#plan-value"),
  caloriesValue: document.querySelector("#calories-value"),
  caloriesMeta: document.querySelector("#calories-meta"),
  cadenceTitle: document.querySelector("#cadence-title"),
  cadenceText: document.querySelector("#cadence-text"),
  nextWorkout: document.querySelector("#next-workout"),
  cycleStartLabel: document.querySelector("#cycle-start-label"),
  saveDay: document.querySelector("#save-day"),
  clearDay: document.querySelector("#clear-day"),
  toast: document.querySelector("#toast"),
  driveConnect: document.querySelector("#drive-connect"),
  driveSync: document.querySelector("#drive-sync"),
  driveDisconnect: document.querySelector("#drive-disconnect"),
  driveSyncPill: document.querySelector("#drive-sync-pill"),
  driveStatus: document.querySelector("#drive-status"),
  driveHint: document.querySelector("#drive-hint"),
  driveAccountWrap: document.querySelector("#drive-account-wrap"),
  driveAccountEmail: document.querySelector("#drive-account-email"),
  driveAccountNote: document.querySelector("#drive-account-note"),
  tabButtons: Array.from(document.querySelectorAll("[data-tab-button]")),
  dailyTab: document.querySelector("#tab-daily"),
  profileTab: document.querySelector("#tab-profile"),
  progressTab: document.querySelector("#tab-progress"),
  historyRangeSwitch: document.querySelector("#history-range-switch"),
  historyRangeCaption: document.querySelector("#history-range-caption"),
  schedulePreviewList: document.querySelector("#schedule-preview-list"),
};

const state = loadState();
const ui = {
  newTrack: createNewTrackDraft(),
};

const drive = {
  clientId: normalizeClientId(DRIVE_CONFIG.clientId),
  configured: isConfiguredClientId(DRIVE_CONFIG.clientId),
  fileName: normalizeFileName(DRIVE_CONFIG.fileName),
  tokenClient: null,
  accessToken: "",
  tokenExpiresAt: 0,
  fileId: state.driveFileId || "",
  scriptReady: false,
  isSyncing: false,
  pendingAction: "",
  lastError: "",
  accountEmail: "",
  accountName: "",
  userInfoEndpoint: "",
  sessionResolved: false,
};

let toastTimer = null;
let autoSyncTimer = null;
let driveBootstrapTimer = null;

init();

function init() {
  const hashTab = getHashTab();
  if (hashTab) {
    state.activeTab = hashTab;
  }

  elements.selectedDate.value = state.selectedDate;

  elements.selectedDate.addEventListener("input", handleSelectedDateChange);
  elements.selectedDate.addEventListener("change", handleSelectedDateChange);
  elements.openDatePicker.addEventListener("click", handleOpenDatePicker);

  elements.profilePanel.addEventListener("input", handleProfilePanelInput);
  elements.profilePanel.addEventListener("change", handleProfilePanelInput);
  elements.profilePanel.addEventListener("click", handleProfilePanelClick);
  elements.trackerGrid.addEventListener("input", handleTrackerInput);
  elements.trackerGrid.addEventListener("click", handleChipClick);
  elements.dayNotes.addEventListener("input", handleDayNotesInput);
  elements.saveDay.addEventListener("click", handleSaveClick);
  elements.clearDay.addEventListener("click", handleClearClick);
  elements.driveConnect.addEventListener("click", handleDriveConnect);
  elements.driveSync.addEventListener("click", handleDriveSync);
  elements.driveDisconnect.addEventListener("click", handleDriveDisconnect);
  elements.historyRangeSwitch.addEventListener("click", handleHistoryRangeClick);
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", handleTabChange);
  });
  window.addEventListener("hashchange", handleTabHashChange);

  render();
  bootstrapDrive();
}

function loadState() {
  return loadStoredState(LEGACY_STORAGE_KEY) || createDefaultState();
}

function persist() {
  localStorage.setItem(getPersistStorageKey(), JSON.stringify(serializeState()));
}

function loadStoredState(storageKey) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return normalizeStoredState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normalizeStoredState(parsed) {
  const today = getTodayString();
  const data = parsed && typeof parsed === "object" ? parsed : {};
  const tracks = sanitizeTracks(data.tracks, data.plan);

  return {
    activeTab: sanitizeActiveTab(data.activeTab),
    selectedDate: sanitizeDateInput(data.selectedDate, today),
    cycleStartDate: sanitizeDateInput(data.cycleStartDate, today),
    historyRange: sanitizeHistoryRange(data.historyRange),
    profile: sanitizeProfile(data.profile),
    tracks,
    entries: sanitizeEntries(data.entries, tracks),
    lastSavedAt: normalizeIso(data.lastSavedAt),
    updatedAt: normalizeIso(data.updatedAt) || normalizeIso(data.lastSavedAt),
    cloudLastSyncedAt: normalizeIso(data.cloudLastSyncedAt),
    driveFileId: typeof data.driveFileId === "string" ? data.driveFileId : "",
  };
}

function createDefaultState() {
  const today = getTodayString();
  return {
    activeTab: "daily",
    selectedDate: today,
    cycleStartDate: today,
    historyRange: "7d",
    profile: sanitizeProfile(null),
    tracks: sanitizeTracks(null),
    entries: {},
    lastSavedAt: null,
    updatedAt: null,
    cloudLastSyncedAt: null,
    driveFileId: "",
  };
}

function serializeState() {
  return {
    activeTab: state.activeTab,
    selectedDate: state.selectedDate,
    cycleStartDate: state.cycleStartDate,
    historyRange: state.historyRange,
    profile: state.profile,
    tracks: state.tracks,
    entries: state.entries,
    lastSavedAt: state.lastSavedAt,
    updatedAt: state.updatedAt,
    cloudLastSyncedAt: state.cloudLastSyncedAt,
    driveFileId: state.driveFileId,
  };
}

function applyStoredState(nextState) {
  Object.assign(state, normalizeStoredState(nextState));
}

function getPersistStorageKey() {
  if (typeof drive !== "undefined" && drive.accountEmail) {
    return getAccountStorageKey(drive.accountEmail);
  }

  return LEGACY_STORAGE_KEY;
}

function getAccountStorageKey(email) {
  return `${ACCOUNT_STORAGE_PREFIX}:${normalizeAccountEmail(email)}`;
}

function normalizeAccountEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function hydrateScopedAccountState() {
  const accountEmail = normalizeAccountEmail(drive.accountEmail);
  if (!accountEmail) {
    return false;
  }

  const scopedState = loadStoredState(getAccountStorageKey(accountEmail));
  if (scopedState) {
    applyStoredState(scopedState);
    return true;
  }

  applyStoredState(createDefaultState());
  persist();
  return false;
}

function render() {
  elements.selectedDate.value = state.selectedDate;

  renderTabs();
  renderProfilePanel();
  renderHeroPlan();
  renderTrackerGrid();
  renderDayNotes();
  renderSummary();
  renderCadence();
  renderHistory();
  renderDriveStatus();
}

function hasConnectedAccount() {
  return Boolean((drive.accountEmail || drive.accessToken) && drive.sessionResolved);
}

function renderAccessState() {
  const connected = hasConnectedAccount();
  elements.dashboardShell.hidden = !connected;
  document.body.classList.toggle("account-gated", !connected);
}

function renderTabs() {
  if (elements.dashboardShell) {
    elements.dashboardShell.dataset.activeTab = state.activeTab;
  }

  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabButton === state.activeTab);
    button.setAttribute("aria-pressed", button.dataset.tabButton === state.activeTab ? "true" : "false");
  });

  if (elements.dailyTab) {
    elements.dailyTab.hidden = state.activeTab !== "daily";
  }
  if (elements.profileTab) {
    elements.profileTab.hidden = state.activeTab !== "profile";
  }
  if (elements.progressTab) {
    elements.progressTab.hidden = state.activeTab !== "progress";
  }
}

function handleSelectedDateChange(event) {
  state.selectedDate = event.target.value || getTodayString();
  persist();
  render();
}

function handleOpenDatePicker() {
  if (typeof elements.selectedDate.showPicker === "function") {
    elements.selectedDate.showPicker();
    return;
  }

  elements.selectedDate.focus();
  elements.selectedDate.click();
}

function renderProfilePanel() {
  const profileStats = getProfileStats();
  const tracks = getTracks();
  const numericTracks = tracks.filter((track) => track.type === "number");
  const checkboxTracks = tracks.filter((track) => track.type === "checkbox");
  const accountScopeNote = drive.accountEmail
    ? `Сейчас список тренировок сохраняется для аккаунта ${drive.accountEmail}. Числовые активности попадают в дневной план с целью, а активности по дням работают как чек-лист с выбором недели.`
    : "Добавляйте свои активности для этого Google-аккаунта. Числовые тренировки попадают в дневной план с целью, а тренировки по дням работают как чек-лист с выбором недели.";

  elements.profilePanel.innerHTML = `
    <div class="profile-stack">
      <section class="profile-card panel-soft">
        <div class="profile-head">
          <div>
            <p class="summary-label">Личный профиль</p>
            <h3 class="profile-title">Параметры тела и базовые ориентиры</h3>
          </div>
          <p class="profile-note">
            Рост и вес помогают точнее считать шаги и активные калории, а % жира
            добавляет ориентир по сухой массе.
          </p>
        </div>

        <div class="profile-grid">
          ${renderProfileField({
            id: "heightCm",
            label: "Рост",
            unit: "см",
            value: state.profile.heightCm,
            step: "1",
          })}
          ${renderProfileField({
            id: "weightKg",
            label: "Вес",
            unit: "кг",
            value: state.profile.weightKg,
            step: "0.1",
          })}
          ${renderProfileField({
            id: "age",
            label: "Возраст",
            unit: "лет",
            value: state.profile.age,
            step: "1",
          })}
          ${renderProfileField({
            id: "bodyFat",
            label: "% жира",
            unit: "%",
            value: state.profile.bodyFat,
            step: "0.1",
          })}
        </div>

        <div class="profile-stats">
          <div class="profile-pill">
            <span>ИМТ</span>
            <strong>${profileStats.bmiLabel}</strong>
          </div>
          <div class="profile-pill">
            <span>Сухая масса</span>
            <strong>${profileStats.leanMassLabel}</strong>
          </div>
          <div class="profile-pill">
            <span>Профиль</span>
            <strong>${profileStats.profileLabel}</strong>
          </div>
        </div>
      </section>

      <section class="profile-card panel-soft">
        <div class="profile-head">
          <div>
            <p class="summary-label">Тренировки аккаунта</p>
            <h3 class="profile-title">Состав ежедневного плана</h3>
          </div>
          <p class="profile-note">
            ${accountScopeNote}
          </p>
        </div>

        <div class="training-create">
          <div class="track-form-grid">
            <label class="profile-field profile-field-wide">
              <span class="field-label">Название тренировки</span>
              <div class="profile-input-wrap">
                <input
                  class="profile-input"
                  type="text"
                  maxlength="40"
                  value="${escapeHtml(ui.newTrack.title)}"
                  placeholder="Например, бег, планка или бурпи"
                  data-new-track-field="title"
                />
              </div>
            </label>

            <label class="profile-field">
              <span class="field-label">Тип активности</span>
              <div class="profile-input-wrap select-wrap">
                <select class="profile-select" data-new-track-field="type">
                  <option value="number" ${
                    ui.newTrack.type === "number" ? "selected" : ""
                  }>С количеством</option>
                  <option value="checkbox" ${
                    ui.newTrack.type === "checkbox" ? "selected" : ""
                  }>По дням недели</option>
                </select>
              </div>
            </label>

            ${
              ui.newTrack.type === "number"
                ? `
                  <label class="profile-field">
                    <span class="field-label">Цель на день</span>
                    <div class="profile-input-wrap">
                      <input
                        class="profile-input"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        step="1"
                        value="${formatPlanInput(ui.newTrack.target)}"
                        data-new-track-field="target"
                      />
                      <span class="profile-unit">ед.</span>
                    </div>
                  </label>
                `
                : `
                  <div class="profile-field profile-field-wide">
                    <span class="field-label">Дни недели</span>
                    <div class="training-weekdays">
                      ${renderWeekdayToggleRow({
                        days: ui.newTrack.scheduleDays,
                        selectedWeekday: getWeekdayIndex(state.selectedDate),
                        datasetName: "data-new-track-day-toggle",
                      })}
                    </div>
                  </div>
                `
            }
          </div>

          <div class="hero-actions training-actions">
            <button class="button button-primary" type="button" data-add-track>
              Добавить тренировку
            </button>
          </div>
        </div>

        <div class="training-columns">
          <div class="training-column">
            <p class="summary-label">С количеством</p>
            <div class="training-list">
              ${
                numericTracks.length
                  ? numericTracks.map((track) => renderTrackEditor(track)).join("")
                  : '<p class="empty-note">Пока нет тренировок с количеством.</p>'
              }
            </div>
          </div>

          <div class="training-column">
            <p class="summary-label">По дням недели</p>
            <div class="training-list">
              ${
                checkboxTracks.length
                  ? checkboxTracks.map((track) => renderTrackEditor(track)).join("")
                  : '<p class="empty-note">Пока нет тренировок по дням.</p>'
              }
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderProfileField({ id, label, unit, value, step }) {
  return `
    <label class="profile-field">
      <span class="field-label">${label}</span>
      <div class="profile-input-wrap">
        <input
          class="profile-input"
          type="number"
          inputmode="decimal"
          min="0"
          step="${step}"
          value="${formatProfileInput(value)}"
          data-profile-field="${id}"
          aria-label="${label}"
        />
        <span class="profile-unit">${unit}</span>
      </div>
    </label>
  `;
}

function renderTrackEditor(track) {
  const trackTitle = escapeHtml(getTrackTitle(track));

  if (track.type === "number") {
    return `
      <article class="training-card" style="--card-accent: ${track.accent};">
        <div class="training-card-head">
          <div>
            <p class="card-kicker">С количеством</p>
            <input
              class="training-title-input"
              type="text"
              maxlength="40"
              value="${trackTitle}"
              data-track-title="${track.id}"
            />
          </div>
          <button class="delete-track-button" type="button" data-remove-track="${track.id}">
            Удалить
          </button>
        </div>

        <div class="track-form-grid">
          <label class="profile-field">
            <span class="field-label">Цель на день</span>
            <div class="profile-input-wrap">
              <input
                class="profile-input"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                value="${formatPlanInput(getTrackTarget(track))}"
                data-track-target="${track.id}"
              />
              <span class="profile-unit">${escapeHtml(getTrackShortUnit(track))}</span>
            </div>
          </label>
        </div>
      </article>
    `;
  }

  return `
    <article class="training-card" style="--card-accent: ${track.accent};">
      <div class="training-card-head">
        <div>
          <p class="card-kicker">По дням недели</p>
          <input
            class="training-title-input"
            type="text"
            maxlength="40"
            value="${trackTitle}"
            data-track-title="${track.id}"
          />
        </div>
        <button class="delete-track-button" type="button" data-remove-track="${track.id}">
          Удалить
        </button>
      </div>

      <div class="training-weekdays">
        ${renderWeekdayToggleRow({
          days: getTrackScheduleDays(track),
          selectedWeekday: getWeekdayIndex(state.selectedDate),
          datasetName: "data-track-day-toggle",
          trackId: track.id,
        })}
      </div>
      <p class="hero-schedule-hint">Выбранные дни определяют, когда эта активность появится в ежедневном плане.</p>
    </article>
  `;
}

function renderWeekdayToggleRow({ days, selectedWeekday, datasetName, trackId = "" }) {
  return WEEKDAY_LABELS.map((label, index) => {
    const attributes = [
      `${datasetName}="${trackId || index}"`,
      trackId ? `data-weekday="${index}"` : `data-weekday="${index}"`,
    ].join(" ");

    return `
      <button
        type="button"
        class="weekday-chip ${days.includes(index) ? "planned" : ""} ${
          selectedWeekday === index ? "selected" : ""
        }"
        ${attributes}
      >
        ${label}
      </button>
    `;
  }).join("");
}

function renderHeroPlan() {
  const tracks = getTracks();
  const selectedWeekday = getWeekdayIndex(state.selectedDate);
  const numericTracks = tracks.filter((track) => track.type === "number");
  const checkboxTracks = tracks.filter((track) => track.type === "checkbox");

  elements.heroPlan.innerHTML = `
    <div class="hero-plan-head">
      <p class="summary-label">Ежедневный план</p>
      <p class="hero-plan-date">${formatDate(state.selectedDate)}</p>
    </div>

    <div class="hero-plan-list">
      ${
        numericTracks.length
          ? numericTracks
              .map((track) => {
                const trackTitle = escapeHtml(getTrackTitle(track));
                const target = getTrackTarget(track);
                return `
                  <div class="hero-plan-item">
                    <span class="hero-plan-name">${trackTitle}</span>
                    <div class="hero-plan-target-readout">
                      <strong>${target > 0 ? formatNumber(target) : "—"}</strong>
                      <span class="hero-plan-target-unit">${escapeHtml(getTrackShortUnit(track))}</span>
                    </div>
                  </div>
                `;
              })
              .join("")
          : '<p class="empty-note">Добавьте хотя бы одну числовую активность во вкладке «Профиль».</p>'
      }
    </div>

    ${
      checkboxTracks.length
        ? `
          <div class="hero-schedule-list">
            ${checkboxTracks
              .map((track) => {
                const activeToday = isTrackPlannedForDate(track, state.selectedDate);
                const scheduleDays = getTrackScheduleDays(track);
                const trackTitle = escapeHtml(getTrackTitle(track));
                return `
                  <div class="hero-schedule-card ${activeToday ? "active" : ""}">
                    <div class="hero-schedule-top">
                      <span class="hero-plan-name">${trackTitle}</span>
                      <strong>${formatWeekdayList(scheduleDays)}</strong>
                    </div>
                    <div class="weekday-row">
                      ${WEEKDAY_LABELS.map(
                        (label, index) => `
                          <span class="weekday-chip ${
                            scheduleDays.includes(index) ? "planned" : ""
                          } ${selectedWeekday === index ? "selected" : ""} ${
                            activeToday && selectedWeekday === index ? "active" : ""
                          }">
                            ${label}
                          </span>
                        `,
                      ).join("")}
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : '<p class="hero-schedule-hint">Во вкладке «Профиль» можно добавить тренировки по дням недели.</p>'
    }
  `;

  renderSchedulePreview();
}

function renderTrackerGrid() {
  const entry = getEntry(state.selectedDate);
  const tracks = getTracks();

  if (!tracks.length) {
    elements.trackerGrid.innerHTML = `
      <article class="tracker-card inactive">
        <div class="tracker-card-header">
          <div>
            <p class="card-kicker">Пустой план</p>
            <h3 class="card-title">Добавьте первую активность во вкладке «Профиль»</h3>
            <p class="card-description">
              После этого она сразу появится здесь, а история начнет собираться именно для этого аккаунта.
            </p>
          </div>
        </div>
      </article>
    `;
    return;
  }

  elements.trackerGrid.innerHTML = tracks.map((track) => {
    const trackTitle = escapeHtml(getTrackTitle(track));
    const isAvailable = isTrackPlannedForDate(track, state.selectedDate);
    const numericValue =
      track.type === "number" ? formatNumberInput(entry[track.id] ?? 0) : null;
    const checked = Boolean(entry[track.id]);
    const stamp =
      track.type === "number"
        ? "Ежедневная отметка"
        : isAvailable
          ? "Сегодня по плану"
          : checked
            ? "Выполнено вне графика"
            : "Сегодня отдых";

    const body =
      track.type === "number"
        ? `
          <div class="tracker-card-body">
            <input
              class="tracker-input"
              inputmode="numeric"
              min="0"
              step="1"
              type="number"
              value="${numericValue}"
              data-track="${track.id}"
              aria-label="${trackTitle}"
            />
          </div>
          <div class="quick-actions">
            ${track.increments
              .map(
                (amount) => `
                  <button
                    class="chip-button"
                    type="button"
                    data-adjust-track="${track.id}"
                    data-adjust-value="${amount}"
                  >
                    +${formatNumber(amount)}
                  </button>
                `,
              )
              .join("")}
          </div>
        `
        : `
          <div class="tracker-card-body">
            <div class="toggle-wrap">
              <label class="toggle">
                <input
                  type="checkbox"
                  data-track="${track.id}"
                  ${checked ? "checked" : ""}
                  aria-label="${trackTitle}"
                />
                <span class="toggle-track"></span>
              </label>
              <div class="toggle-copy">
                <p class="toggle-status">${
                  checked
                    ? isAvailable
                      ? "Выполнено"
                      : "Выполнено вне графика"
                    : isAvailable
                      ? "Ожидает отметки"
                      : "День восстановления"
                }</p>
                <p class="toggle-hint">${
                  isAvailable
                    ? "Поставь галочку, когда тренировка завершена."
                    : checked
                      ? "Отметка сохранена, даже если сегодня не был плановый день."
                      : "Можно оставить отдых, а можно отметить выполнение, если закрыли пропущенную тренировку."
                }</p>
              </div>
            </div>
          </div>
        `;

    return `
      <article
        class="tracker-card ${track.type === "checkbox" && !isAvailable && !checked ? "inactive" : ""}"
        style="--card-accent: ${track.accent};"
      >
        <div class="tracker-card-header">
          <div>
            <p class="card-kicker">${track.type === "number" ? getTrackUnit(track) : "чек-лист"}</p>
            <h3 class="card-title">${trackTitle}</h3>
            <p class="card-description">${getTrackDescription(track)}</p>
          </div>
          <span class="card-stamp">${stamp}</span>
        </div>

        ${body}

        <div class="tracker-card-footer">
          <p class="history-meta">${
            track.type === "number"
              ? "Любое число сохраняется для выбранной даты."
              : isAvailable
                ? "Этот блок входит в план именно на выбранный день."
                : checked
                  ? "Отметка сохранена как выполнение вне графика."
                  : `Следующая отметка по недельному ритму: ${formatWeekdayList(
                      getTrackScheduleDays(track),
                    )}.`
          }</p>
        </div>
      </article>
    `;
  }).join("");
}

function renderDayNotes() {
  const entry = getEntry(state.selectedDate);
  elements.dayNotes.value = entry.notes || "";
}

function renderSummary() {
  const entry = getEntry(state.selectedDate);
  const stats = getCompletionStats(state.selectedDate);
  const volume = getNumericVolume(entry);
  const streak = getStreakLength(state.selectedDate);
  const activeDays = getRecentActiveDays(state.selectedDate, 7);
  const focusTracks = getPlannedCheckboxTracks(state.selectedDate);
  const calories = getEstimatedCalories(state.selectedDate);
  const calorieAssumption = getCalorieAssumptionCopy();
  const burnLabel =
    state.selectedDate === getTodayString()
      ? "примерно активных ккал за сегодня"
      : "примерно активных ккал за выбранную дату";

  elements.progressRing.style.setProperty("--progress", stats.percent);
  elements.progressValue.textContent = `${stats.percent}%`;
  elements.streakValue.textContent = formatNumber(streak);
  elements.activeDaysValue.textContent = formatNumber(activeDays);
  elements.volumeValue.textContent = formatNumber(volume);
  elements.planValue.textContent = `${stats.completed} / ${stats.planned}`;
  elements.caloriesValue.textContent = `~${formatNumber(calories.total)}`;
  elements.caloriesMeta.textContent = `${burnLabel} · ${calorieAssumption}`;
  elements.todayBurnValue.textContent = `~${formatNumber(calories.total)} ккал`;
  elements.todayBurnMeta.textContent = burnLabel;
  elements.todayBurnBreakdown.textContent = formatBurnBreakdown(calories);

  const pulse = getPulseCopy(stats.percent, volume, focusTracks);
  elements.dayPulseValue.textContent = pulse.title;
  elements.dayPulseText.textContent = pulse.body;
  elements.heroText.textContent = pulse.hero;

  const statusBits = [];
  if (state.lastSavedAt) {
    statusBits.push(`Последняя фиксация: ${formatDateTime(state.lastSavedAt)}`);
  }
  if (state.cloudLastSyncedAt) {
    statusBits.push(`Google Drive: ${formatDateTime(state.cloudLastSyncedAt)}`);
  }

  elements.statusNote.textContent =
    statusBits.join(" · ") ||
    "Все данные сохраняются локально и могут синхронизироваться с Google Drive.";
}

function renderCadence() {
  const checkboxTracks = getTracks().filter((track) => track.type === "checkbox");
  const plannedCheckboxTracks = getPlannedCheckboxTracks(state.selectedDate);
  const nextBlock = getNextScheduledBlock(state.selectedDate);

  if (!checkboxTracks.length) {
    elements.cadenceTitle.textContent = "Тренировки по дням пока не добавлены";
    elements.cadenceText.textContent =
      "Во вкладке «Профиль» можно добавить активности, которые отмечаются по дням недели.";
  } else if (plannedCheckboxTracks.length) {
    const label = formatTrackList(plannedCheckboxTracks);
    elements.cadenceTitle.textContent = `Сегодня в плане ${label}`;
    elements.cadenceText.textContent =
      `На ${formatDate(state.selectedDate)} в недельном ритме стоят ${label}. ` +
      "Когда блоки закрыты, просто поставьте галочки.";
  } else {
    elements.cadenceTitle.textContent = "Сегодня день восстановления";
    elements.cadenceText.textContent =
      "На выбранную дату нет активностей по дням недели. Можно спокойно закрывать ежедневные числовые цели.";
  }

  elements.nextWorkout.textContent = nextBlock
    ? `${formatDate(nextBlock.date, { day: "numeric", month: "short" })} · ${formatTrackList(
        nextBlock.tracks,
      )}`
    : "—";
  elements.cycleStartLabel.textContent = checkboxTracks.length
    ? checkboxTracks
        .map((track) => `${getTrackTitle(track)}: ${formatWeekdayList(getTrackScheduleDays(track))}`)
        .join(" · ")
    : "Добавьте активности по дням";
}

function renderHistory() {
  const period = getHistoryPeriod(state.selectedDate, state.historyRange);

  elements.historyRangeCaption.textContent = period.caption;
  elements.historyGrid.dataset.range = state.historyRange;
  Array.from(elements.historyRangeSwitch.querySelectorAll("[data-range]")).forEach((button) => {
    button.classList.toggle("active", button.dataset.range === state.historyRange);
  });

  if (state.historyRange === "year") {
    elements.historyGrid.innerHTML = period.months
      .slice()
      .reverse()
      .map((month) => renderYearHistoryCard(month))
      .join("");
  } else if (state.historyRange === "30d") {
    elements.historyGrid.innerHTML = period.dates
      .slice()
      .reverse()
      .map((date) => renderCompactHistoryCard(date))
      .join("");
  } else {
    elements.historyGrid.innerHTML = period.dates
      .slice()
      .reverse()
      .map((date) => renderDetailedHistoryCard(date))
      .join("");
  }

  elements.insightGrid.innerHTML = renderInsights(period);
}

function renderDetailedHistoryCard(date) {
  const stats = getCompletionStats(date);
  const plannedCheckboxTracks = getPlannedCheckboxTracks(date);

  return `
    <article class="history-card">
      <div class="history-top">
        <div>
          <p class="history-badge">${
            isSameDay(date, getTodayString()) ? "Сегодня" : formatWeekday(date)
          }</p>
          <p class="history-date">${formatDate(date, {
            day: "numeric",
            month: "short",
          })}</p>
        </div>
        <span class="history-score">${stats.percent}%</span>
      </div>

      <p class="history-meta">${getDayPlanMeta(date, plannedCheckboxTracks)}</p>

      <div class="history-details">${renderHistoryTrackLines(date)}</div>
    </article>
  `;
}

function renderCompactHistoryCard(date) {
  const entry = getEntry(date);
  const stats = getCompletionStats(date);
  const volume = getNumericVolume(entry);
  const plannedCheckboxTracks = getPlannedCheckboxTracks(date);
  const completedCheckboxTracks = getCompletedCheckboxTracks(date);
  const completedExtra = completedCheckboxTracks
    .map((track) =>
      isTrackScheduledForDate(track, date)
        ? getTrackTitle(track)
        : `${getTrackTitle(track)} вне графика`,
    )
    .join(", ");

  return `
    <article class="history-card compact">
      <div class="history-top">
        <div>
          <p class="history-badge">${formatWeekday(date)}</p>
          <p class="history-date">${formatDate(date, {
            day: "numeric",
            month: "short",
          })}</p>
        </div>
        <span class="history-score">${stats.percent}%</span>
      </div>

      <p class="history-meta">${getDayPlanMeta(date, plannedCheckboxTracks)}</p>

      <div class="history-metric-row">
        <span>Объем</span>
        <strong>${formatNumber(volume)}</strong>
      </div>
      <div class="history-metric-row">
        <span>План</span>
        <strong>${stats.completed} / ${stats.planned}</strong>
      </div>

      <div class="history-tag-row">
        <span class="history-tag ${volume > 0 ? "active" : ""}">
          ${volume > 0 ? "Есть объем" : "Пустой день"}
        </span>
        <span class="history-tag ${completedExtra ? "active" : ""}">
          ${completedExtra || (plannedCheckboxTracks.length ? "Чек-лист не закрыт" : "Без доп. блока")}
        </span>
      </div>
    </article>
  `;
}

function renderYearHistoryCard(month) {
  return `
    <article class="history-card compact year-card">
      <div class="history-top">
        <div>
          <p class="history-badge">${month.shortLabel}</p>
          <p class="history-date">${month.yearLabel}</p>
        </div>
        <span class="history-score">${month.averagePercent}%</span>
      </div>

      <p class="history-meta">${month.activeDays} активных из ${month.dayCount} дней</p>

      <div class="history-details">${renderMonthHistoryLines(month)}</div>
    </article>
  `;
}

function renderHistoryLine(label, value) {
  return `
    <div class="history-line">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderHistoryTrackLines(date) {
  const entry = getEntry(date);
  const tracks = getTracks();

  if (!tracks.length) {
    return '<p class="empty-note">Добавьте активности в профиле, чтобы история начала собираться.</p>';
  }

  return tracks
    .map((track) => {
      if (track.type === "number") {
        return renderHistoryLine(escapeHtml(getTrackTitle(track)), formatNumber(entry[track.id] || 0));
      }

      const value = entry[track.id]
        ? isTrackPlannedForDate(track, date)
          ? "Да"
          : "Да, вне плана"
        : isTrackPlannedForDate(track, date)
          ? "Нет"
          : "Отдых";
      return renderHistoryLine(escapeHtml(getTrackTitle(track)), value);
    })
    .join("");
}

function renderMonthHistoryLines(month) {
  const tracks = getTracks();

  if (!tracks.length) {
    return '<p class="empty-note">В этом аккаунте еще нет активностей для помесячной сводки.</p>';
  }

  return tracks
    .map((track) => {
      if (track.type === "number") {
        return renderHistoryLine(
          escapeHtml(getTrackTitle(track)),
          formatNumber(month.numericTotals[track.id] || 0),
        );
      }

      const totals = month.checkboxTotals[track.id] || { completed: 0, planned: 0, offPlan: 0 };
      return renderHistoryLine(
        escapeHtml(getTrackTitle(track)),
        totals.offPlan > 0
          ? `${totals.completed}/${totals.planned} +${totals.offPlan}`
          : `${totals.completed}/${totals.planned}`,
      );
    })
    .join("");
}

function renderDriveStatus() {
  const openedAsFile = window.location.protocol === "file:";
  const connected = Boolean(drive.accessToken);
  const needsSync = hasPendingCloudChanges();

  let pill = "Локально";
  let status =
    "Подключите Google Drive, чтобы история не терялась при очистке браузера.";
  let hint =
    "Данные будут храниться в скрытой папке приложения на вашем Google Drive.";
  let accountNote = "Google Drive подключен для этого аккаунта.";

  if (openedAsFile) {
    pill = "Нужен сервер";
    status =
      "Google OAuth не работает из file://. Откройте сайт через локальный сервер, например http://127.0.0.1:4173/ .";
    hint =
      "Запустите `python3 -m http.server 4173` в папке проекта и добавьте этот origin в настройки OAuth.";
  } else if (!drive.configured) {
    pill = "Нужна настройка";
    status =
      "Заполните `clientId` в файле drive-config.js, чтобы сайт мог подключаться к Google Drive.";
    hint =
      "Создайте OAuth Client ID типа Web application и добавьте origin `http://127.0.0.1:4173`.";
  } else if (!drive.scriptReady) {
    pill = "Google загружается";
    status =
      "Библиотека авторизации Google загружается. После этого можно подключить облачную синхронизацию.";
  } else if (drive.isSyncing) {
    pill = "Синхронизация";
    status =
      "Сайт сейчас сверяет локальные данные с облаком и сохраняет свежую копию в Google Drive.";
  } else if (drive.lastError) {
    pill = "Нужна проверка";
    status = drive.lastError;
  } else if (connected && needsSync) {
    pill = "Есть изменения";
    status =
      "Есть новые локальные изменения. Пока доступ к Google активен, сайт отправит их в облако автоматически.";
  } else if (connected && state.cloudLastSyncedAt) {
    pill = "В облаке";
    status = `История синхронизирована с Google Drive. Последняя отправка: ${formatDateTime(
      state.cloudLastSyncedAt,
    )}.`;
  } else if (connected) {
    pill = "Подключено";
    status =
      "Google Drive подключен. Можно загрузить историю из облака или создать первую резервную копию.";
  } else if (state.cloudLastSyncedAt) {
    pill = "Отключено";
    status = "Подключите Google Drive снова, чтобы продолжить облачную синхронизацию.";
  }

  if (connected && drive.accountEmail) {
    accountNote = drive.accountName
      ? `Вход выполнен как ${drive.accountName}.`
      : "Вход выполнен в этот Google-аккаунт.";
    hint = `Данные синхронизируются в скрытую папку Google Drive аккаунта ${drive.accountEmail}.`;
  }

  elements.driveSyncPill.textContent = pill;
  elements.driveStatus.textContent = status;
  elements.driveHint.textContent = hint;
  elements.driveAccountWrap.hidden = !drive.accountEmail;
  elements.driveAccountEmail.textContent = drive.accountEmail || "-";
  elements.driveAccountNote.textContent = accountNote;

  elements.driveSync.hidden = !connected;
  elements.driveDisconnect.hidden = !connected;
  elements.driveConnect.disabled = openedAsFile || !drive.configured || !drive.scriptReady;
  elements.driveSync.disabled = openedAsFile || !drive.configured || !drive.scriptReady;
  elements.driveDisconnect.disabled = !connected || drive.isSyncing;
  renderAccessState();
}

function handleTrackerInput(event) {
  const trackId = event.target.dataset.track;
  if (!trackId) {
    return;
  }

  const track = getTrack(trackId);
  if (!track) {
    return;
  }

  const entry = getEntry(state.selectedDate);

  if (track.type === "number") {
    entry[trackId] = sanitizeNumber(event.target.value);
  } else {
    entry[trackId] = event.target.checked;
  }

  state.entries[state.selectedDate] = entry;
  noteCloudChange();
  persist();
  renderSummary();
  renderHistory();
  renderDriveStatus();
}

function handleDayNotesInput(event) {
  const entry = getEntry(state.selectedDate);
  entry.notes = sanitizeNotes(event.target.value);
  state.entries[state.selectedDate] = entry;
  noteCloudChange();
  persist();
  renderHistory();
  renderDriveStatus();
}

function handleChipClick(event) {
  const button = event.target.closest("[data-adjust-track]");
  if (!button) {
    return;
  }

  const trackId = button.dataset.adjustTrack;
  const amount = Number(button.dataset.adjustValue || 0);
  const entry = getEntry(state.selectedDate);
  const current = sanitizeNumber(entry[trackId] || 0);

  entry[trackId] = current + amount;
  state.entries[state.selectedDate] = entry;
  noteCloudChange();
  persist();
  renderTrackerGrid();
  renderSummary();
  renderHistory();
  renderDriveStatus();
}

function handleHistoryRangeClick(event) {
  const button = event.target.closest("[data-range]");
  if (!button) {
    return;
  }

  const nextRange = sanitizeHistoryRange(button.dataset.range);
  if (state.historyRange === nextRange) {
    return;
  }

  state.historyRange = nextRange;
  persist();
  renderHistory();
}

function handleTabChange(event) {
  const button = event.currentTarget?.dataset?.tabButton
    ? event.currentTarget
    : event.target.closest("[data-tab-button]");
  if (!button) {
    return;
  }

  const nextTab = sanitizeActiveTab(button.dataset.tabButton);
  if (state.activeTab === nextTab) {
    syncTabHash(nextTab);
    return;
  }

  state.activeTab = nextTab;
  persist();
  syncTabHash(nextTab);
  render();
}

function handleTabHashChange() {
  const hashTab = getHashTab();
  if (!hashTab || state.activeTab === hashTab) {
    return;
  }

  state.activeTab = hashTab;
  persist();
  render();
}

function getHashTab() {
  const value = window.location.hash.replace(/^#/, "").trim();
  return TAB_IDS.includes(value) ? value : "";
}

function syncTabHash(tab) {
  if (!TAB_IDS.includes(tab)) {
    return;
  }

  const nextHash = `#${tab}`;
  if (window.location.hash === nextHash) {
    return;
  }

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${nextHash}`,
  );
}

function handleProfilePanelInput(event) {
  const field = event.target.dataset.profileField;
  if (field) {
    if (event.type !== "change") {
      return;
    }

    state.profile = sanitizeProfile({
      ...state.profile,
      [field]: event.target.value,
    });
    noteCloudChange();
    persist();
    render();
    return;
  }

  const draftField = event.target.dataset.newTrackField;
  if (draftField) {
    if (draftField === "title") {
      ui.newTrack.title = sanitizeTrackTitle(event.target.value, "");
      return;
    }

    if (draftField === "target") {
      ui.newTrack.target = sanitizeTrackTargetValue(event.target.value);
      return;
    }

    if (draftField === "type" && event.type === "change") {
      ui.newTrack.type = sanitizeTrackType(event.target.value);
      renderProfilePanel();
    }
    return;
  }

  const trackTitleId = event.target.dataset.trackTitle;
  if (trackTitleId && event.type === "change") {
    updateTrack(trackTitleId, {
      title: sanitizeTrackTitle(event.target.value, getTrack(trackTitleId)?.title || "Тренировка"),
    });
    return;
  }

  const trackTargetId = event.target.dataset.trackTarget;
  if (trackTargetId && event.type === "change") {
    updateTrack(trackTargetId, {
      target: sanitizeTrackTargetValue(event.target.value),
    });
  }
}

function handleProfilePanelClick(event) {
  const addButton = event.target.closest("[data-add-track]");
  if (addButton) {
    handleAddTrack();
    return;
  }

  const removeButton = event.target.closest("[data-remove-track]");
  if (removeButton) {
    removeTrack(removeButton.dataset.removeTrack);
    return;
  }

  const trackDayButton = event.target.closest("[data-track-day-toggle]");
  if (trackDayButton) {
    const trackId = trackDayButton.dataset.trackDayToggle;
    const weekday = Number(trackDayButton.dataset.weekday);
    const track = getTrack(trackId);
    if (!track) {
      return;
    }

    const nextDays = toggleWeekday(getTrackScheduleDays(track), weekday);
    updateTrack(trackId, {
      scheduleDays: nextDays,
    });
    return;
  }

  const draftDayButton = event.target.closest("[data-new-track-day-toggle]");
  if (draftDayButton) {
    const weekday = Number(draftDayButton.dataset.weekday);
    ui.newTrack.scheduleDays = toggleWeekday(ui.newTrack.scheduleDays, weekday);
    renderProfilePanel();
  }
}

function handleAddTrack() {
  const newTrack = buildTrackFromDraft(ui.newTrack, getTracks().length);
  if (!newTrack) {
    showToast("Введите название тренировки, прежде чем добавлять ее в план.");
    return;
  }

  state.tracks = sanitizeTracks([...getTracks(), newTrack]);
  noteCloudChange();
  persist();
  ui.newTrack = createNewTrackDraft();
  render();
  showToast("Тренировка добавлена в профиль и появится в ежедневном плане.");
}

function updateTrack(trackId, updates) {
  let changed = false;

  state.tracks = getTracks().map((track, index) => {
    if (track.id !== trackId) {
      return track;
    }

    changed = true;
    return sanitizeTrack(
      {
        ...track,
        ...updates,
      },
      index,
      track,
    );
  });

  if (!changed) {
    return;
  }

  state.entries = sanitizeEntries(state.entries, state.tracks);
  noteCloudChange();
  persist();
  render();
}

function removeTrack(trackId) {
  const track = getTrack(trackId);
  if (!track) {
    return;
  }

  const shouldRemove = window.confirm(`Удалить тренировку «${getTrackTitle(track)}» из этого аккаунта?`);
  if (!shouldRemove) {
    return;
  }

  state.tracks = getTracks().filter((item) => item.id !== trackId);
  state.entries = Object.fromEntries(
    Object.entries(state.entries).map(([date, entry]) => {
      const nextEntry = { ...entry };
      delete nextEntry[trackId];
      return [date, nextEntry];
    }),
  );
  noteCloudChange();
  persist();
  render();
  showToast("Тренировка удалена из профиля.");
}

function handleSaveClick() {
  const now = new Date().toISOString();
  state.lastSavedAt = now;
  noteCloudChange(now);
  persist();
  renderSummary();
  renderDriveStatus();
  showToast("День зафиксирован. Серия продолжается.");
}

function handleClearClick() {
  const hadEntry = Boolean(state.entries[state.selectedDate]);
  if (!hadEntry) {
    showToast("Для этой даты запись уже пуста.");
    return;
  }

  const shouldClear = window.confirm(
    `Очистить запись за ${formatDate(state.selectedDate)}?`,
  );

  if (!shouldClear) {
    return;
  }

  delete state.entries[state.selectedDate];
  state.lastSavedAt = new Date().toISOString();
  noteCloudChange(state.lastSavedAt);
  persist();
  render();
  showToast("Запись очищена.");
}

function handleDriveConnect() {
  requestDriveAccess("connect");
}

async function handleDriveSync() {
  if (drive.isSyncing) {
    return;
  }

  if (hasValidDriveToken()) {
    await syncToDrive({ silent: false });
    return;
  }

  requestDriveAccess("sync");
}

function handleDriveDisconnect() {
  if (drive.accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(drive.accessToken, () => {});
  }

  drive.accessToken = "";
  drive.tokenExpiresAt = 0;
  drive.pendingAction = "";
  drive.lastError = "";
  drive.accountEmail = "";
  drive.accountName = "";
  drive.sessionResolved = false;
  window.clearTimeout(autoSyncTimer);
  renderDriveStatus();
  showToast("Google Drive отключен. Локальная копия осталась на месте.");
}

function noteCloudChange(forcedTimestamp) {
  state.updatedAt = forcedTimestamp || new Date().toISOString();
  persist();
  scheduleAutoSync();
}

function scheduleAutoSync() {
  if (!hasValidDriveToken() || !hasPendingCloudChanges()) {
    return;
  }

  window.clearTimeout(autoSyncTimer);
  autoSyncTimer = window.setTimeout(() => {
    syncToDrive({ silent: true }).catch(() => {});
  }, 1200);
}

function bootstrapDrive() {
  if (!drive.configured || window.location.protocol === "file:") {
    renderDriveStatus();
    return;
  }

  let attempts = 0;
  driveBootstrapTimer = window.setInterval(() => {
    attempts += 1;

    if (window.google?.accounts?.oauth2) {
      window.clearInterval(driveBootstrapTimer);
      initDriveClient();
      return;
    }

    if (attempts >= 60) {
      window.clearInterval(driveBootstrapTimer);
      drive.lastError =
        "Не удалось загрузить библиотеку авторизации Google. Проверьте сеть и попробуйте обновить страницу.";
      renderDriveStatus();
    }
  }, 250);
}

function initDriveClient() {
  drive.tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: drive.clientId,
    scope: DRIVE_SCOPE,
    callback: async (response) => {
      await handleDriveTokenResponse(response);
    },
    error_callback: (error) => {
      drive.pendingAction = "";
      drive.lastError = mapDriveError(error?.type || error?.message || "Не удалось открыть окно Google.");
      renderDriveStatus();
      showToast("Не удалось открыть вход Google.");
    },
  });

  drive.scriptReady = true;
  drive.lastError = "";
  renderDriveStatus();
}

function requestDriveAccess(action) {
  if (window.location.protocol === "file:") {
    showToast("Для Google Drive откройте сайт через локальный сервер.");
    return;
  }

  if (!drive.configured) {
    showToast("Сначала заполните clientId в drive-config.js.");
    return;
  }

  if (!drive.scriptReady || !drive.tokenClient) {
    showToast("Google еще не готов. Попробуйте через пару секунд.");
    return;
  }

  drive.pendingAction = action;
  drive.lastError = "";
  if (action === "connect") {
    drive.sessionResolved = false;
  }
  renderDriveStatus();

  const prompt = drive.accessToken ? "" : "consent";
  drive.tokenClient.requestAccessToken({ prompt });
}

async function handleDriveTokenResponse(tokenResponse) {
  if (tokenResponse.error) {
    drive.lastError = mapDriveError(tokenResponse.error);
    renderDriveStatus();
    showToast("Google Drive не удалось подключить.");
    return;
  }

  drive.accessToken = tokenResponse.access_token;
  drive.tokenExpiresAt =
    Date.now() + Math.max((tokenResponse.expires_in || 3600) - 60, 60) * 1000;

  await loadDriveAccountProfile();
  hydrateScopedAccountState();

  const action = drive.pendingAction || "sync";
  drive.pendingAction = "";

  if (action === "connect") {
    await connectDriveAndReconcile();
    return;
  }

  await syncToDrive({ silent: false });
}

async function connectDriveAndReconcile() {
  drive.isSyncing = true;
  drive.lastError = "";
  renderDriveStatus();

  try {
    const remote = await loadCloudPayload();
    const localPayload = buildCloudPayload({ touchUpdatedAt: false });

    if (!remote) {
      await uploadCloudPayload(buildCloudPayload());
      drive.sessionResolved = true;
      state.cloudLastSyncedAt = new Date().toISOString();
      persist();
      render();
      showToast("Google Drive подключен. Создана первая облачная копия.");
      return;
    }

    drive.fileId = remote.fileId;
    state.driveFileId = remote.fileId;

    const localHasData = hasMeaningfulCloudData(localPayload);
    const remoteHasData = hasMeaningfulCloudData(remote.payload);

    if (!localHasData && remoteHasData) {
      drive.sessionResolved = true;
      applyCloudPayload(remote.payload, remote.fileId);
      showToast("Google Drive подключен. Загружена облачная история.");
      return;
    }

    if (localHasData && !remoteHasData) {
      await uploadCloudPayload(buildCloudPayload());
      drive.sessionResolved = true;
      state.cloudLastSyncedAt = new Date().toISOString();
      persist();
      render();
      showToast("Google Drive подключен. Локальная история загружена в облако.");
      return;
    }

    if (compareIsoDates(localPayload.updatedAt, remote.payload?.updatedAt) >= 0) {
      await uploadCloudPayload(buildCloudPayload());
      drive.sessionResolved = true;
      state.cloudLastSyncedAt = new Date().toISOString();
      persist();
      render();
      showToast("Google Drive подключен. Локальная история загружена в облако.");
      return;
    }

    drive.sessionResolved = true;
    applyCloudPayload(remote.payload, remote.fileId);
    showToast("Google Drive подключен. Загружена более новая облачная история.");
  } catch (error) {
    handleDriveFailure(error, "Не удалось сверить локальные данные с Google Drive.");
  } finally {
    drive.isSyncing = false;
    renderDriveStatus();
  }
}

async function syncToDrive({ silent }) {
  if (drive.isSyncing) {
    return;
  }

  if (!hasValidDriveToken()) {
    requestDriveAccess("sync");
    return;
  }

  drive.isSyncing = true;
  drive.lastError = "";
  renderDriveStatus();

  try {
    const payload = buildCloudPayload();
    await uploadCloudPayload(payload);
    drive.sessionResolved = true;
    state.cloudLastSyncedAt = new Date().toISOString();
    persist();
    render();

    if (!silent) {
      showToast("История сохранена в Google Drive.");
    }
  } catch (error) {
    handleDriveFailure(error, "Не удалось сохранить историю в Google Drive.");
  } finally {
    drive.isSyncing = false;
    renderDriveStatus();
  }
}

async function loadCloudPayload() {
  const file = await findDriveFile();
  if (!file) {
    return null;
  }

  drive.fileId = file.id;
  state.driveFileId = file.id;
  persist();

  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
  );
  const payload = await response.json();

  return {
    fileId: file.id,
    payload,
  };
}

async function findDriveFile() {
  const query = encodeURIComponent(
    `name='${drive.fileName}' and 'appDataFolder' in parents and trashed=false`,
  );
  const url =
    "https://www.googleapis.com/drive/v3/files" +
    `?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)&pageSize=10&orderBy=modifiedTime desc`;

  const response = await driveFetch(url);
  const data = await response.json();

  return data.files?.[0] || null;
}

async function uploadCloudPayload(payload) {
  const existingFile = drive.fileId ? { id: drive.fileId } : await findDriveFile();
  const fileId = existingFile?.id || "";
  const boundary = `training-rhythm-${Date.now()}`;
  const metadata = fileId
    ? {
        name: drive.fileName,
        mimeType: "application/json",
      }
    : {
        name: drive.fileName,
        parents: ["appDataFolder"],
        mimeType: "application/json",
      };

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(payload),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        fileId,
      )}?uploadType=multipart&fields=id,modifiedTime`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime";

  const response = await driveFetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = await response.json();

  drive.fileId = data.id;
  state.driveFileId = data.id;
  persist();
}

async function driveFetch(url, options = {}) {
  if (!hasValidDriveToken()) {
    throw new Error(
      "Срок доступа к Google Drive истек. Нажмите «Синхронизировать» или подключите Google заново.",
    );
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${drive.accessToken}`);
  headers.set("Accept", "application/json");

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.ok) {
    return response;
  }

  if (response.status === 401) {
    drive.accessToken = "";
    drive.tokenExpiresAt = 0;
  }

  const details = await safeResponseText(response);
  const suffix = details ? ` ${details}` : "";
  throw new Error(`Google Drive ответил ${response.status}.${suffix}`.trim());
}

function buildCloudPayload({ touchUpdatedAt = true } = {}) {
  const updatedAt =
    state.updatedAt || state.lastSavedAt || (touchUpdatedAt ? new Date().toISOString() : null);

  if (touchUpdatedAt && updatedAt && !state.updatedAt) {
    state.updatedAt = updatedAt;
    persist();
  }

  return {
    version: 2,
    updatedAt,
    lastSavedAt: state.lastSavedAt,
    cycleStartDate: state.cycleStartDate,
    historyRange: state.historyRange,
    profile: state.profile,
    tracks: state.tracks,
    entries: sanitizeEntries(state.entries, state.tracks),
  };
}

function hasMeaningfulCloudData(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const tracks = sanitizeTracks(payload.tracks, payload.plan);
  const entries = sanitizeEntries(payload.entries, tracks);
  const profile = sanitizeProfile(payload.profile);
  const defaultTracks = sanitizeTracks(null);

  const hasEntryData = Object.values(entries).some((entry) =>
    tracks.some((track) =>
      track.type === "number" ? sanitizeNumber(entry[track.id]) > 0 : Boolean(entry[track.id]),
    ),
  );
  const hasNotesData = Object.values(entries).some((entry) => sanitizeNotes(entry.notes).length > 0);

  const hasProfileData = [profile.heightCm, profile.weightKg, profile.age, profile.bodyFat].some(
    (value) => sanitizeNumber(value) > 0,
  );

  const hasTrackChanges =
    JSON.stringify(buildTrackComparisonPayload(tracks)) !==
    JSON.stringify(buildTrackComparisonPayload(defaultTracks));

  return hasEntryData || hasNotesData || hasProfileData || hasTrackChanges;
}

function applyCloudPayload(payload, fileId) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  state.cycleStartDate = sanitizeDateInput(payload.cycleStartDate, state.cycleStartDate);
  state.historyRange = sanitizeHistoryRange(payload.historyRange);
  state.profile = sanitizeProfile(payload.profile);
  state.tracks = sanitizeTracks(payload.tracks, payload.plan);
  state.entries = sanitizeEntries(payload.entries, state.tracks);
  state.lastSavedAt = normalizeIso(payload.lastSavedAt);
  state.updatedAt = normalizeIso(payload.updatedAt) || state.updatedAt;
  state.cloudLastSyncedAt = new Date().toISOString();
  state.driveFileId = fileId || state.driveFileId;
  drive.fileId = state.driveFileId;
  persist();
  render();
}

function handleDriveFailure(error, fallbackMessage) {
  drive.lastError = error instanceof Error ? error.message : fallbackMessage;
  if (!drive.lastError) {
    drive.lastError = fallbackMessage;
  }
  renderDriveStatus();
  showToast(fallbackMessage);
}

function hasValidDriveToken() {
  return Boolean(drive.accessToken) && Date.now() < drive.tokenExpiresAt;
}

async function loadDriveAccountProfile() {
  if (!hasValidDriveToken()) {
    return;
  }

  try {
    const endpoint = await getUserInfoEndpoint();
    const response = await driveFetch(endpoint);
    const profile = await response.json();
    drive.accountEmail = typeof profile.email === "string" ? profile.email : "";
    drive.accountName = typeof profile.name === "string" ? profile.name : "";
  } catch {
    drive.accountEmail = "";
    drive.accountName = "";
  }

  renderDriveStatus();
}

async function getUserInfoEndpoint() {
  if (drive.userInfoEndpoint) {
    return drive.userInfoEndpoint;
  }

  try {
    const response = await fetch(OPENID_DISCOVERY_URL, {
      headers: {
        Accept: "application/json",
      },
    });
    if (response.ok) {
      const discovery = await response.json();
      drive.userInfoEndpoint =
        typeof discovery.userinfo_endpoint === "string"
          ? discovery.userinfo_endpoint
          : FALLBACK_USERINFO_ENDPOINT;
      return drive.userInfoEndpoint;
    }
  } catch {
    // Fall back to the documented Google userinfo endpoint.
  }

  drive.userInfoEndpoint = FALLBACK_USERINFO_ENDPOINT;
  return drive.userInfoEndpoint;
}

function hasPendingCloudChanges() {
  if (!state.updatedAt) {
    return false;
  }

  if (!state.cloudLastSyncedAt) {
    return true;
  }

  return compareIsoDates(state.updatedAt, state.cloudLastSyncedAt) > 0;
}

function getEntry(date) {
  return {
    ...buildEmptyEntry(getTracks()),
    ...(state.entries[date] || {}),
  };
}

function sanitizeEntries(value, tracks = sanitizeTracks(null)) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [date, entry]) => {
    if (!isDateInputValue(date) || !entry || typeof entry !== "object") {
      return accumulator;
    }

    accumulator[date] = tracks.reduce((cleanEntry, track) => {
      cleanEntry[track.id] =
        track.type === "number" ? sanitizeNumber(entry[track.id]) : Boolean(entry[track.id]);
      return cleanEntry;
    }, { notes: sanitizeNotes(entry.notes) });

    return accumulator;
  }, {});
}

function getCompletionStats(date) {
  const entry = getEntry(date);
  const plannedTracks = getPlannedTracks(date);
  const completedTracks = plannedTracks.filter((track) => {
    if (track.type === "number") {
      return sanitizeNumber(entry[track.id]) > 0;
    }

    return Boolean(entry[track.id]);
  });

  const planned = plannedTracks.length;
  const completed = completedTracks.length;
  const percent = planned === 0 ? 0 : Math.round((completed / planned) * 100);

  return {
    planned,
    completed,
    percent,
  };
}

function getNumericVolume(entry) {
  return getTracks().filter((track) => track.type === "number").reduce(
    (total, track) => total + sanitizeNumber(entry[track.id]),
    0,
  );
}

function getRecentActiveDays(anchorDate, days) {
  return Array.from({ length: days }, (_, index) =>
    shiftDate(anchorDate, -index),
  ).filter((date) => hasActivity(date)).length;
}

function getStreakLength(anchorDate) {
  let streak = 0;
  let cursor = anchorDate;

  while (hasActivity(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

function hasActivity(date) {
  const entry = getEntry(date);
  const numericActivity = getTracks().some(
    (track) => track.type === "number" && sanitizeNumber(entry[track.id]) > 0,
  );
  const checkboxActivity = getTracks().some(
    (track) => track.type === "checkbox" && Boolean(entry[track.id]),
  );

  return numericActivity || checkboxActivity;
}

function getProfileStats() {
  const { heightCm, weightKg, age, bodyFat } = state.profile;
  const bmi =
    heightCm > 0 && weightKg > 0 ? weightKg / ((heightCm / 100) * (heightCm / 100)) : null;
  const leanMass =
    weightKg > 0 && bodyFat > 0 ? weightKg * (1 - bodyFat / 100) : null;

  return {
    bmiLabel: bmi ? bmi.toFixed(1) : "—",
    leanMassLabel: leanMass ? `${leanMass.toFixed(1)} кг` : "—",
    profileLabel: age > 0 ? `${age} лет` : "Добавьте возраст",
  };
}

function getEffectiveProfile() {
  const heightCm = state.profile.heightCm || 170;
  const weightKg = state.profile.weightKg || 70;

  return {
    heightCm,
    weightKg,
    age: state.profile.age || 0,
    bodyFat: state.profile.bodyFat || 0,
    usesDefaultHeight: state.profile.heightCm === 0,
    usesDefaultWeight: state.profile.weightKg === 0,
  };
}

function getEstimatedCalories(date) {
  const entry = getEntry(date);
  const profile = getEffectiveProfile();
  const breakdown = getTracks().reduce((accumulator, track) => {
    if (track.type === "number") {
      if (track.energyModel === "steps") {
        accumulator[track.id] = getStepCalories(entry[track.id], profile.weightKg, profile.heightCm);
      } else {
        accumulator[track.id] = getRepCalories(
          entry[track.id],
          profile.weightKg,
          track.secondsPerRep || 3,
          track.energyMet || 6,
        );
      }
      return accumulator;
    }

    accumulator[track.id] = entry[track.id]
      ? getSessionCalories(profile.weightKg, track.sessionMinutes || 15, track.energyMet || 5.5)
      : 0;
    return accumulator;
  }, {});

  return {
    total: Math.round(
      Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    ),
    breakdown,
    assumptions: profile,
  };
}

function getRepCalories(reps, weightKg, secondsPerRep, met) {
  const hours = (sanitizeNumber(reps) * secondsPerRep) / 3600;
  return hours * met * weightKg;
}

function getSessionCalories(weightKg, minutes, met) {
  return (minutes / 60) * met * weightKg;
}

function getStepCalories(steps, weightKg, heightCm) {
  const distanceKm = sanitizeNumber(steps) * ((heightCm * 0.413) / 100000);
  return distanceKm * weightKg * 0.75;
}

function getCalorieAssumptionCopy() {
  const profile = getEffectiveProfile();
  const hints = [];

  if (profile.usesDefaultWeight) {
    hints.push("вес пока взят как 70 кг");
  }
  if (profile.usesDefaultHeight) {
    hints.push("рост пока взят как 170 см");
  }

  if (!hints.length) {
    return "примерно активных ккал по вашему профилю";
  }

  return `примерно активных ккал, ${hints.join(" · ")}`;
}

function formatBurnBreakdown(calories) {
  const parts = Object.entries(calories.breakdown)
    .map(([trackId, value]) => ({
      title: getTrackTitle(getTrack(trackId) || { title: trackId }),
      value: Math.round(value),
    }))
    .filter((part) => part.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 3);

  if (!parts.length) {
    return "Пока нет активности на эту дату.";
  }

  return parts.map((part) => `${part.title}: ${formatNumber(part.value)}`).join(" · ");
}

function getTracks() {
  return Array.isArray(state.tracks) ? state.tracks : [];
}

function getTrack(trackId) {
  return getTracks().find((track) => track.id === trackId) || null;
}

function getTrackTitle(track) {
  return track ? track.title : "Тренировка";
}

function getTrackDescription(track) {
  if (track?.description) {
    return track.description;
  }

  return track?.type === "number"
    ? "Запишите итоговое количество за выбранную дату."
    : "Отметьте выполнение в те дни недели, которые выбраны в профиле.";
}

function getTrackUnit(track) {
  return track?.type === "number" ? track.unit || "единиц" : "чек-лист";
}

function getTrackShortUnit(track) {
  return track?.shortUnit || (track?.type === "number" ? "ед." : "");
}

function getPlannedTracks(date) {
  return getTracks().filter((track) => isTrackCountedInPlan(track, date));
}

function getPlannedCheckboxTracks(date) {
  return getTracks().filter(
    (track) => track.type === "checkbox" && isTrackScheduledForDate(track, date),
  );
}

function getCompletedCheckboxTracks(date) {
  const entry = getEntry(date);
  return getTracks().filter(
    (track) => track.type === "checkbox" && Boolean(entry[track.id]),
  );
}

function getOffScheduleCompletedCheckboxTracks(date) {
  return getCompletedCheckboxTracks(date).filter(
    (track) => !isTrackScheduledForDate(track, date),
  );
}

function isTrackPlannedForDate(track, date) {
  if (track.type === "number") {
    return true;
  }

  return isTrackScheduledForDate(track, date);
}

function isTrackCountedInPlan(track, date) {
  if (track.type === "number") {
    return getTrackTarget(track) > 0;
  }

  return isTrackScheduledForDate(track, date);
}

function isTrackScheduledForDate(track, date) {
  return getTrackScheduleDays(track).includes(getWeekdayIndex(date));
}

function getTrackTarget(track) {
  return sanitizeTrackTargetValue(track?.target);
}

function getTrackScheduleDays(track) {
  return sanitizeWeekdayList(track?.scheduleDays);
}

function getWeekdayIndex(dateString) {
  return new Date(`${dateString}T12:00:00`).getDay();
}

function getNextScheduledBlock(anchorDate) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = shiftDate(anchorDate, offset);
    const tracks = getPlannedCheckboxTracks(date);
    if (tracks.length) {
      return { date, tracks };
    }
  }

  return null;
}

function formatTrackList(tracks) {
  return tracks.map((track) => getTrackTitle(track).toLowerCase()).join(" и ");
}

function formatWeekdayList(days) {
  const normalized = sanitizeWeekdayList(days);
  if (!normalized.length) {
    return "дни не выбраны";
  }

  return normalized.map((day) => WEEKDAY_LABELS[day]).join(" / ");
}

function getDayPlanMeta(date, plannedCheckboxTracks) {
  const offScheduleTracks = getOffScheduleCompletedCheckboxTracks(date);

  if (plannedCheckboxTracks.length && offScheduleTracks.length) {
    return `По плану: ${formatTrackList(plannedCheckboxTracks)}. Вне графика выполнено: ${formatTrackList(
      offScheduleTracks,
    )}.`;
  }

  if (plannedCheckboxTracks.length) {
    return `По плану: ${formatTrackList(plannedCheckboxTracks)}.`;
  }

  if (offScheduleTracks.length) {
    return `Вне графика выполнено: ${formatTrackList(offScheduleTracks)}.`;
  }

  return `По плану только ежедневные числовые активности на ${formatWeekday(date)}.`;
}

function renderSchedulePreview() {
  const checkboxTracks = getTracks().filter((track) => track.type === "checkbox");

  elements.schedulePreviewList.innerHTML = checkboxTracks.length
    ? checkboxTracks
        .map(
          (track) => `
            <div class="schedule-preview-item">
              <span>${escapeHtml(getTrackTitle(track))}</span>
              <strong>${formatWeekdayList(getTrackScheduleDays(track))}</strong>
            </div>
          `,
        )
        .join("")
    : '<span class="empty-note">Пока нет активностей по дням недели.</span>';
}

function getHistoryPeriod(anchorDate, range) {
  if (range === "year") {
    const months = Array.from({ length: 12 }, (_, index) => 11 - index).map((index) =>
      getMonthSummary(anchorDate, index),
    );
    const anchorMonth = formatMonthLabel(anchorDate);

    return {
      type: "year",
      caption: `12 месяцев до ${anchorMonth.toLowerCase()}.`,
      months,
      dayCount: months.reduce((total, month) => total + month.dayCount, 0),
      dates: months.flatMap((month) => month.dates),
    };
  }

  const days = range === "30d" ? 30 : 7;
  const dates = Array.from({ length: days }, (_, index) =>
    shiftDate(anchorDate, -(days - 1 - index)),
  );

  return {
    type: "days",
    caption:
      range === "30d"
        ? `Последние 30 дней по выбранной дате.`
        : `Последние 7 дней по выбранной дате.`,
    dates,
    dayCount: dates.length,
  };
}

function getMonthSummary(anchorDate, offset) {
  const monthDate = shiftMonth(startOfMonth(anchorDate), -offset);
  const startDate = monthDate;
  const rawEndDate = endOfMonth(monthDate);
  const endDate = offset === 0 ? minDate(rawEndDate, anchorDate) : rawEndDate;
  const dates = enumerateDates(startDate, endDate);
  const numericTracks = getTracks().filter((track) => track.type === "number");
  const checkboxTracks = getTracks().filter((track) => track.type === "checkbox");
  const averagePercent = getAveragePercent(dates);

  return {
    dates,
    shortLabel: formatMonthLabel(monthDate, { month: "short" }),
    yearLabel: formatMonthLabel(monthDate, { year: "numeric" }),
    averagePercent,
    activeDays: dates.filter((date) => hasActivity(date)).length,
    dayCount: dates.length,
    numericTotals: numericTracks.reduce((accumulator, track) => {
      accumulator[track.id] = dates.reduce(
        (total, date) => total + sanitizeNumber(getEntry(date)[track.id]),
        0,
      );
      return accumulator;
    }, {}),
    checkboxTotals: checkboxTracks.reduce((accumulator, track) => {
      const planned = dates.filter((date) => isTrackPlannedForDate(track, date)).length;
      const completed = dates.filter(
        (date) => isTrackPlannedForDate(track, date) && Boolean(getEntry(date)[track.id]),
      ).length;
      const offPlan = dates.filter(
        (date) => !isTrackPlannedForDate(track, date) && Boolean(getEntry(date)[track.id]),
      ).length;
      accumulator[track.id] = { planned, completed, offPlan };
      return accumulator;
    }, {}),
  };
}

function enumerateDates(startDate, endDate) {
  const dates = [];
  let cursor = startDate;

  while (getDayIndex(cursor) <= getDayIndex(endDate)) {
    dates.push(cursor);
    cursor = shiftDate(cursor, 1);
  }

  return dates;
}

function startOfMonth(dateString) {
  const [year, month] = dateString.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function endOfMonth(dateString) {
  const [year, month] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return toDateInputValue(date);
}

function shiftMonth(dateString, offset) {
  const [year, month] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + offset);
  return toDateInputValue(date);
}

function minDate(left, right) {
  return getDayIndex(left) <= getDayIndex(right) ? left : right;
}

function renderInsights(period) {
  return [
    renderTrendInsight(period),
    renderCaloriesInsight(period),
    renderVolumeInsight(period),
    renderLoadDistributionInsight(period),
    renderDisciplineInsight(period),
  ].join("");
}

function renderTrendInsight(period) {
  const points =
    period.type === "year"
      ? period.months.map((month) => ({
          label: month.shortLabel,
          value: month.averagePercent,
        }))
      : period.dates.map((date) => ({
          label: state.historyRange === "7d" ? formatWeekday(date) : formatDate(date, { day: "numeric" }),
          value: getCompletionStats(date).percent,
        }));
  const average = getAveragePercent(period.dates);
  const best = points.reduce(
    (winner, point) => (point.value > winner.value ? point : winner),
    points[0] || { label: "—", value: 0 },
  );

  return `
    <article class="insight-card panel-soft">
      <div class="insight-head">
        <div>
          <p class="summary-label">Динамика выполнения</p>
          <h3 class="insight-title">Темп за выбранный период</h3>
        </div>
        <strong class="insight-total">${average}%</strong>
      </div>

      <div class="trend-chart">
        ${points
          .map(
            (point) => `
              <div class="trend-column">
                <span class="trend-bar" style="height: ${
                  point.value === 0 ? 0 : Math.max(point.value, 6)
                }%;"></span>
                <span class="trend-label">${point.label}</span>
              </div>
            `,
          )
          .join("")}
      </div>

      <p class="insight-note">
        Лучший отрезок: <strong>${best.label}</strong> с выполнением <strong>${best.value}%</strong>.
      </p>
    </article>
  `;
}

function renderVolumeInsight(period) {
  const numericTracks = getTracks().filter((track) => track.type === "number");

  if (!numericTracks.length) {
    return `
      <article class="insight-card panel-soft">
        <div class="insight-head">
          <div>
            <p class="summary-label">Объем к плану</p>
            <h3 class="insight-title">Фактический объем против цели</h3>
          </div>
        </div>

        <p class="insight-note">
          Добавьте хотя бы одну числовую активность во вкладке «Профиль», чтобы увидеть сравнение объема с целью.
        </p>
      </article>
    `;
  }

  return `
    <article class="insight-card panel-soft">
      <div class="insight-head">
        <div>
          <p class="summary-label">Объем к плану</p>
          <h3 class="insight-title">Фактический объем против цели</h3>
        </div>
      </div>

      <div class="volume-list">
        ${numericTracks
          .map((track) => {
            const actual = period.dates.reduce(
              (total, date) => total + sanitizeNumber(getEntry(date)[track.id]),
              0,
            );
            const target = getTrackTarget(track);
            const planned = target * period.dayCount;
            const percent = planned === 0 ? 0 : Math.round((actual / planned) * 100);
            const width = percent === 0 ? 0 : Math.max(8, Math.min(percent, 100));

            return `
              <div class="volume-row">
                <div class="volume-top">
                  <span>${escapeHtml(getTrackTitle(track))}</span>
                  <strong>${
                    planned > 0
                      ? `${formatNumber(actual)} / ${formatNumber(planned)}`
                      : `${formatNumber(actual)} / цель выключена`
                  }</strong>
                </div>
                <div class="volume-track">
                  <span class="volume-fill" style="width: ${width}%; --fill-color: ${track.accent};"></span>
                </div>
                <p class="volume-meta">${
                  planned > 0 ? `${percent}% от плана за период` : "Цель не задана и не влияет на процент."
                }</p>
              </div>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderCaloriesInsight(period) {
  const points =
    period.type === "year"
      ? period.months.map((month) => ({
          label: month.shortLabel,
          value: month.dates.reduce((sum, date) => sum + getEstimatedCalories(date).total, 0),
        }))
      : period.dates.map((date) => ({
          label: state.historyRange === "7d" ? formatWeekday(date) : formatDate(date, { day: "numeric" }),
          value: getEstimatedCalories(date).total,
        }));
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const average = points.length ? Math.round(total / points.length) : 0;
  const peak = points.reduce(
    (winner, point) => (point.value > winner.value ? point : winner),
    points[0] || { label: "—", value: 0 },
  );
  const maxValue = Math.max(...points.map((point) => point.value), 0);

  return `
    <article class="insight-card panel-soft">
      <div class="insight-head">
        <div>
          <p class="summary-label">Калории по периоду</p>
          <h3 class="insight-title">Активный расход энергии</h3>
        </div>
        <strong class="insight-total">${formatNumber(total)}</strong>
      </div>

      <div class="trend-chart calorie-chart">
        ${points
          .map((point) => {
            const height = maxValue === 0 ? 0 : Math.round((point.value / maxValue) * 100);
            return `
              <div class="trend-column">
                <span class="trend-bar calorie-bar" style="height: ${height === 0 ? 0 : Math.max(height, 8)}%;"></span>
                <span class="trend-label">${point.label}</span>
              </div>
            `;
          })
          .join("")}
      </div>

      <p class="insight-note">
        В среднем <strong>${formatNumber(average)} ккал</strong>, пик в <strong>${peak.label}</strong>:
        <strong>${formatNumber(peak.value)} ккал</strong>.
      </p>
    </article>
  `;
}

function renderLoadDistributionInsight(period) {
  const numericTracks = getTracks().filter((track) => track.type === "number");
  const checkboxTracks = getTracks().filter((track) => track.type === "checkbox");
  const segments = [...numericTracks, ...checkboxTracks].map((track) => {
    const total = period.dates.reduce(
      (sum, date) => sum + getEstimatedCalories(date).breakdown[track.id],
      0,
    );
    return {
      id: track.id,
      title: getTrackTitle(track),
      accent: track.accent,
      total: Math.round(total),
    };
  });
  const grandTotal = segments.reduce((sum, segment) => sum + segment.total, 0);
  const gradient = buildDistributionGradient(segments, grandTotal);

  return `
    <article class="insight-card panel-soft">
      <div class="insight-head">
        <div>
          <p class="summary-label">Распределение нагрузки</p>
          <h3 class="insight-title">Что больше всего дает расход</h3>
        </div>
      </div>

      <div class="distribution-layout">
        <div
          class="distribution-ring"
          style="--distribution-bg: ${gradient};"
        >
          <div class="distribution-ring-inner">
            <span>${formatNumber(grandTotal)}</span>
            <small>ккал</small>
          </div>
        </div>

        <div class="distribution-legend">
          ${segments
            .filter((segment) => segment.total > 0)
            .sort((left, right) => right.total - left.total)
            .map((segment) => {
              const share = grandTotal === 0 ? 0 : Math.round((segment.total / grandTotal) * 100);
              return `
                <div class="legend-row">
                  <span class="legend-dot" style="--dot-color: ${segment.accent};"></span>
                  <span class="legend-name">${escapeHtml(segment.title)}</span>
                  <strong>${share}%</strong>
                </div>
              `;
            })
            .join("") || '<p class="insight-note">Пока нет данных для распределения нагрузки.</p>'}
        </div>
      </div>
    </article>
  `;
}

function buildDistributionGradient(segments, grandTotal) {
  if (grandTotal === 0) {
    return "conic-gradient(rgba(102, 71, 40, 0.12) 0 100%)";
  }

  let cursor = 0;

  return `conic-gradient(${segments
    .filter((segment) => segment.total > 0)
    .map((segment) => {
      const share = (segment.total / grandTotal) * 100;
      const start = cursor;
      const end = cursor + share;
      cursor = end;
      return `${segment.accent} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

function renderDisciplineInsight(period) {
  const checkboxTracks = getTracks().filter((track) => track.type === "checkbox");
  const activeDays = period.dates.filter((date) => hasActivity(date)).length;
  const longestStreak = getLongestStreakInRange(period.dates);
  const averageVolume = Math.round(
    period.dates.reduce((total, date) => total + getNumericVolume(getEntry(date)), 0) /
      Math.max(period.dates.length, 1),
  );

  return `
    <article class="insight-card panel-soft">
      <div class="insight-head">
        <div>
          <p class="summary-label">Дисциплина режима</p>
          <h3 class="insight-title">${
            checkboxTracks.length
              ? "Ровность по тренировкам по дням"
              : "Общая стабильность за период"
          }</h3>
        </div>
      </div>

      <div class="discipline-bars">
        ${checkboxTracks
          .map((track) => {
            const planned = period.dates.filter((date) => isTrackPlannedForDate(track, date)).length;
            const completed = period.dates.filter(
              (date) => isTrackPlannedForDate(track, date) && Boolean(getEntry(date)[track.id]),
            ).length;
            const percent = planned === 0 ? 0 : Math.round((completed / planned) * 100);
            const width = percent === 0 ? 0 : Math.max(8, Math.min(percent, 100));

            return `
              <div class="volume-row">
                <div class="volume-top">
                  <span>${escapeHtml(getTrackTitle(track))}</span>
                  <strong>${completed} / ${planned}</strong>
                </div>
                <div class="volume-track">
                  <span class="volume-fill" style="width: ${width}%; --fill-color: ${track.accent};"></span>
                </div>
                <p class="volume-meta">${percent}% закрытых сессий по расписанию</p>
              </div>
            `;
          })
          .join("") || '<p class="insight-note">Тренировки по дням пока не добавлены.</p>'}
      </div>

      <div class="metric-pills">
        <div class="metric-pill">
          <span>Активных дней</span>
          <strong>${activeDays}</strong>
        </div>
        <div class="metric-pill">
          <span>Лучшая серия</span>
          <strong>${longestStreak}</strong>
        </div>
        <div class="metric-pill">
          <span>Средний объем</span>
          <strong>${formatNumber(averageVolume)}</strong>
        </div>
      </div>
    </article>
  `;
}

function getAveragePercent(dates) {
  if (!dates.length) {
    return 0;
  }

  const total = dates.reduce((sum, date) => sum + getCompletionStats(date).percent, 0);
  return Math.round(total / dates.length);
}

function getLongestStreakInRange(dates) {
  let longest = 0;
  let current = 0;

  dates.forEach((date) => {
    if (hasActivity(date)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  });

  return longest;
}

function getDayIndex(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function shiftDate(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInputValue(date);
}

function toDateInputValue(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.round(number);
}

function sanitizeProfile(value) {
  const profile = value && typeof value === "object" ? value : {};

  return {
    heightCm: sanitizeMetricValue(profile.heightCm, 0, 260),
    weightKg: sanitizeMetricValue(profile.weightKg, 1, 350),
    age: sanitizeMetricValue(profile.age, 0, 120),
    bodyFat: sanitizeMetricValue(profile.bodyFat, 1, 70),
  };
}

function sanitizeMetricValue(value, decimals, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  const bounded = Math.min(number, max);
  const factor = 10 ** decimals;
  return Math.round(bounded * factor) / factor;
}

function formatProfileInput(value) {
  if (!value) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
}

function createNewTrackDraft() {
  return {
    title: "",
    type: "number",
    target: 30,
    scheduleDays: [1, 3, 5],
  };
}

function buildTrackFromDraft(draft, index) {
  const title = sanitizeTrackTitle(draft.title, "");
  if (!title) {
    return null;
  }

  const type = sanitizeTrackType(draft.type);
  return sanitizeTrack(
    {
      id: createTrackId(title),
      title,
      type,
      target: type === "number" ? draft.target : 0,
      scheduleDays: type === "checkbox" ? draft.scheduleDays : [],
    },
    index,
  );
}

function buildEmptyEntry(tracks) {
  return tracks.reduce((accumulator, track) => {
    accumulator[track.id] = track.type === "number" ? 0 : false;
    return accumulator;
  }, { notes: "" });
}

function sanitizeNotes(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").slice(0, 2000);
}

function sanitizeActiveTab(value) {
  return TAB_IDS.includes(value) ? value : "daily";
}

function sanitizeTracks(value, legacyPlan) {
  if (!Array.isArray(value)) {
    return buildDefaultTracks(legacyPlan);
  }

  if (!value.length) {
    return [];
  }

  const seenIds = new Set();

  return value.reduce((accumulator, track, index) => {
    const cleanTrack = sanitizeTrack(track, index);
    if (!cleanTrack || seenIds.has(cleanTrack.id)) {
      return accumulator;
    }

    seenIds.add(cleanTrack.id);
    accumulator.push(cleanTrack);
    return accumulator;
  }, []);
}

function buildDefaultTracks(legacyPlan) {
  const legacy = sanitizePlan(legacyPlan);

  return TRACKS.map((track, index) =>
    sanitizeTrack(
      {
        ...track,
        title:
          track.type === "checkbox"
            ? sanitizePlanLabel(legacy.labels[track.id], track.title)
            : track.title,
        target:
          track.type === "number"
            ? sanitizePlanTarget(track.id, legacy.targets[track.id] ?? track.target)
            : track.target,
        scheduleDays:
          track.type === "checkbox"
            ? sanitizeWeekdayList(legacy.schedules[track.id] ?? track.scheduleDays)
            : [],
      },
      index,
      track,
    ),
  );
}

function sanitizeTrack(track, index, fallback = {}) {
  if (!track || typeof track !== "object") {
    return null;
  }

  const type = sanitizeTrackType(track.type || fallback.type);
  const title = sanitizeTrackTitle(
    track.title,
    fallback.title || (type === "number" ? "Новая тренировка" : "Новая активность"),
  );
  const accent = sanitizeTrackAccent(track.accent, index);

  if (type === "number") {
    const isSteps = title.toLowerCase().includes("шаг");
    const target = sanitizeTrackTargetValue(track.target ?? fallback.target ?? 30);
    const unit = sanitizeTrackUnit(track.unit, isSteps ? "шагов" : fallback.unit || "единиц");
    const shortUnit = sanitizeTrackUnit(
      track.shortUnit,
      isSteps ? "шагов" : fallback.shortUnit || "ед.",
    );

    return {
      id: sanitizeTrackId(track.id, title, index),
      title,
      type,
      target,
      unit,
      shortUnit,
      accent,
      description:
        sanitizeTrackDescription(track.description) ||
        fallback.description ||
        "Запишите итоговое количество за выбранную дату.",
      increments: deriveTrackIncrements(track.increments, target, isSteps),
      energyModel: isSteps ? "steps" : sanitizeEnergyModel(track.energyModel, "reps"),
      energyMet: sanitizeMetricValue(track.energyMet ?? fallback.energyMet ?? 6, 1, 20) || 6,
      secondsPerRep:
        sanitizeMetricValue(track.secondsPerRep ?? fallback.secondsPerRep ?? 3, 1, 30) || 3,
    };
  }

  return {
    id: sanitizeTrackId(track.id, title, index),
    title,
    type,
    accent,
    description:
      sanitizeTrackDescription(track.description) ||
      fallback.description ||
      "Отметьте выполнение в выбранные дни недели.",
    scheduleDays: sanitizeWeekdayList(track.scheduleDays ?? fallback.scheduleDays ?? [1, 3, 5]),
    energyModel: "session",
    energyMet: sanitizeMetricValue(track.energyMet ?? fallback.energyMet ?? 5.5, 1, 20) || 5.5,
    sessionMinutes:
      sanitizeMetricValue(track.sessionMinutes ?? fallback.sessionMinutes ?? 15, 0, 180) || 15,
  };
}

function sanitizePlan(value) {
  const plan = value && typeof value === "object" ? value : {};
  const rawTargets = plan.targets && typeof plan.targets === "object" ? plan.targets : {};
  const rawLabels = plan.labels && typeof plan.labels === "object" ? plan.labels : {};
  const rawSchedules =
    plan.schedules && typeof plan.schedules === "object" ? plan.schedules : {};

  return {
    targets: TRACKS.filter((track) => track.type === "number").reduce((accumulator, track) => {
      accumulator[track.id] = sanitizePlanTarget(track.id, rawTargets[track.id] ?? track.target);
      return accumulator;
    }, {}),
    labels: TRACKS.filter((track) => track.type === "checkbox").reduce((accumulator, track) => {
      accumulator[track.id] = sanitizePlanLabel(rawLabels[track.id], track.title);
      return accumulator;
    }, {}),
    schedules: TRACKS.filter((track) => track.type === "checkbox").reduce(
      (accumulator, track) => {
        accumulator[track.id] = sanitizeWeekdayList(
          rawSchedules[track.id] ?? track.scheduleDays,
        );
        return accumulator;
      },
      {},
    ),
  };
}

function sanitizePlanLabel(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 40);
  return normalized || fallback;
}

function sanitizePlanTarget(trackId, value) {
  return sanitizeTrackTargetValue(value, trackId === "steps" ? 100000 : 10000);
}

function sanitizeWeekdayList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (left, right) => left - right,
  );
}

function formatPlanInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  return String(Math.round(number));
}

function sanitizeTrackType(value) {
  return value === "checkbox" ? "checkbox" : "number";
}

function sanitizeTrackTitle(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 40);
  return normalized || fallback;
}

function sanitizeTrackTargetValue(value, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(Math.round(number), max);
}

function sanitizeTrackId(value, title, index) {
  if (typeof value === "string" && /^[a-z0-9_-]{3,64}$/i.test(value)) {
    return value;
  }

  return `track-${index}-${title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "custom"}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeTrackAccent(value, index) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : TRACK_ACCENTS[index % TRACK_ACCENTS.length];
}

function sanitizeTrackUnit(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 14);
  return normalized || fallback;
}

function sanitizeTrackDescription(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 140);
}

function sanitizeEnergyModel(value, fallback) {
  return ["reps", "steps", "session"].includes(value) ? value : fallback;
}

function deriveTrackIncrements(value, target, isSteps) {
  if (Array.isArray(value) && value.length) {
    const cleaned = value
      .map((item) => sanitizeTrackTargetValue(item, isSteps ? 50000 : 10000))
      .filter((item) => item > 0);
    if (cleaned.length) {
      return [...new Set(cleaned)].slice(0, 4);
    }
  }

  if (isSteps) {
    return [1000, 2000, 5000];
  }

  const base = Math.max(target, 20);
  const options = [Math.round(base * 0.25), Math.round(base * 0.5), Math.round(base)];
  return [...new Set(options.map((item) => Math.max(item, 1)))];
}

function toggleWeekday(days, weekday) {
  return days.includes(weekday)
    ? days.filter((day) => day !== weekday)
    : [...days, weekday].sort((left, right) => left - right);
}

function buildTrackComparisonPayload(tracks) {
  return tracks.map((track) => ({
    id: track.id,
    title: track.title,
    type: track.type,
    target: track.type === "number" ? track.target : 0,
    scheduleDays: track.type === "checkbox" ? track.scheduleDays : [],
  }));
}

function createTrackId(title) {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "track";
  return `${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeDateInput(value, fallback) {
  return isDateInputValue(value) ? value : fallback;
}

function sanitizeHistoryRange(value) {
  return HISTORY_RANGES.includes(value) ? value : "7d";
}

function isDateInputValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeIso(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function compareIsoDates(left, right) {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
    return 0;
  }
  if (Number.isNaN(leftTime)) {
    return -1;
  }
  if (Number.isNaN(rightTime)) {
    return 1;
  }

  return Math.sign(leftTime - rightTime);
}

function normalizeClientId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isConfiguredClientId(value) {
  const clientId = normalizeClientId(value);
  return Boolean(clientId) && !clientId.includes("PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE");
}

function normalizeFileName(value) {
  const fileName =
    typeof value === "string" && value.trim()
      ? value.trim()
      : DEFAULT_DRIVE_FILE_NAME;

  return fileName.endsWith(".json") ? fileName : `${fileName}.json`;
}

function safeResponseText(response) {
  return response
    .text()
    .then((text) => text.trim().replace(/\s+/g, " ").slice(0, 220))
    .catch(() => "");
}

function mapDriveError(error) {
  const message = String(error || "");

  if (message.includes("popup_closed")) {
    return "Окно входа Google было закрыто до завершения авторизации.";
  }

  if (message.includes("popup_failed_to_open")) {
    return "Браузер заблокировал окно входа Google. Разрешите pop-up и попробуйте снова.";
  }

  if (message.includes("origin_mismatch")) {
    return "Текущий адрес сайта не добавлен в Authorized JavaScript origins для OAuth client ID.";
  }

  return message || "Не удалось выполнить запрос к Google Drive.";
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(sanitizeNumber(value));
}

function formatNumberInput(value) {
  return sanitizeNumber(value) === 0 ? "" : sanitizeNumber(value);
}

function formatDate(dateString, options = {}) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    ...options,
  }).format(new Date(`${dateString}T12:00:00`));
}

function formatWeekday(dateString) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
  }).format(new Date(`${dateString}T12:00:00`));
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function formatMonthLabel(dateString, options = {}) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    ...options,
  }).format(new Date(`${dateString}T12:00:00`));
}

function isSameDay(first, second) {
  return first === second;
}

function getPulseCopy(percent, volume, focusTracks) {
  const focusLabel = formatTrackList(focusTracks || []);

  if (percent >= 100) {
    return {
      title: "План дня закрыт",
      body: "Сильная отметка. Зафиксируй результат и сохрани этот темп на завтра.",
      hero: "Когда день отмечен полностью, прогресс перестает быть абстракцией и становится системой.",
    };
  }

  if (percent >= 60) {
    return {
      title: "Темп уже хороший",
      body: "Осталось закрыть еще пару направлений, и день будет ощущаться цельным.",
      hero: focusLabel
        ? `База уже есть. Если закрыть еще и ${focusLabel}, день соберется полностью.`
        : "База уже есть. На легком дне особенно важна ровная, спокойная серия.",
    };
  }

  if (volume > 0) {
    return {
      title: "Ритм начат",
      body: "Первый шаг уже сделан. Продолжай, пока энергия дня работает на тебя.",
      hero: "Одна записанная тренировка всегда сильнее, чем мысленный план без отметки.",
    };
  }

  return {
    title: "Заполни первый блок",
    body: "Начни с одного упражнения или с шагов. Моментум любит простое начало.",
    hero: focusLabel
      ? `Сегодня в плане еще и ${focusLabel}, так что день можно закрыть особенно цельно.`
      : "Сегодня без дополнительного блока по дням, так что можно спокойно закрыть числовую базу.",
  };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2200);
}
