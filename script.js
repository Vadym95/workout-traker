const STORAGE_KEY = "training-rhythm-tracker-v2";
const DRIVE_DATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const DRIVE_SCOPE = [DRIVE_DATA_SCOPE, "openid", "email", "profile"].join(" ");
const DEFAULT_DRIVE_FILE_NAME = "training-rhythm-data.json";
const OPENID_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration";
const FALLBACK_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const DRIVE_CONFIG = window.GOOGLE_DRIVE_CONFIG || {};

const TRACKS = [
  {
    id: "pullups",
    title: "Подтягивания",
    type: "number",
    unit: "повторений",
    accent: "#d56b35",
    description: "Запиши итог за день, чтобы видеть силу в динамике.",
    increments: [5, 10, 20],
  },
  {
    id: "pushups",
    title: "Отжимания",
    type: "number",
    unit: "повторений",
    accent: "#f0b14d",
    description: "Даже короткий подход поддерживает ритм и серию.",
    increments: [10, 20, 30],
  },
  {
    id: "squats",
    title: "Приседания",
    type: "number",
    unit: "повторений",
    accent: "#bf6c44",
    description: "Фиксируй объем ног так же честно, как верх тела.",
    increments: [10, 20, 40],
  },
  {
    id: "steps",
    title: "Шаги",
    type: "number",
    unit: "шагов",
    accent: "#18756d",
    description: "Ходьба держит общий тонус и помогает не выпадать из режима.",
    increments: [1000, 2000, 5000],
  },
  {
    id: "abs",
    title: "Пресс",
    type: "checkbox",
    accent: "#348d83",
    cadence: "alternate",
    description: "Тренировка через день. Здесь нужна только отметка о выполнении.",
  },
  {
    id: "shoulders",
    title: "Тренировка плеч",
    type: "checkbox",
    accent: "#9f4b21",
    cadence: "alternate",
    description: "Тренировка через день. Отметь галочкой, когда сессия закрыта.",
  },
];

const elements = {
  selectedDate: document.querySelector("#selected-date"),
  cycleStart: document.querySelector("#cycle-start"),
  trackerGrid: document.querySelector("#tracker-grid"),
  historyGrid: document.querySelector("#history-grid"),
  progressRing: document.querySelector("#progress-ring"),
  progressValue: document.querySelector("#progress-value"),
  heroText: document.querySelector("#hero-text"),
  statusNote: document.querySelector("#status-note"),
  dayPulseValue: document.querySelector("#day-pulse-value"),
  dayPulseText: document.querySelector("#day-pulse-text"),
  streakValue: document.querySelector("#streak-value"),
  activeDaysValue: document.querySelector("#active-days-value"),
  volumeValue: document.querySelector("#volume-value"),
  planValue: document.querySelector("#plan-value"),
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
};

const state = loadState();

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
};

let toastTimer = null;
let autoSyncTimer = null;
let driveBootstrapTimer = null;

init();

function init() {
  elements.selectedDate.value = state.selectedDate;
  elements.cycleStart.value = state.cycleStartDate;

  elements.selectedDate.addEventListener("input", (event) => {
    state.selectedDate = event.target.value || getTodayString();
    persist();
    render();
  });

  elements.cycleStart.addEventListener("input", (event) => {
    state.cycleStartDate = event.target.value || getTodayString();
    noteCloudChange();
    persist();
    render();
  });

  elements.trackerGrid.addEventListener("input", handleTrackerInput);
  elements.trackerGrid.addEventListener("click", handleChipClick);
  elements.saveDay.addEventListener("click", handleSaveClick);
  elements.clearDay.addEventListener("click", handleClearClick);
  elements.driveConnect.addEventListener("click", handleDriveConnect);
  elements.driveSync.addEventListener("click", handleDriveSync);
  elements.driveDisconnect.addEventListener("click", handleDriveDisconnect);

  render();
  bootstrapDrive();
}

function loadState() {
  const today = getTodayString();

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    return {
      selectedDate: sanitizeDateInput(parsed.selectedDate, today),
      cycleStartDate: sanitizeDateInput(parsed.cycleStartDate, today),
      entries: sanitizeEntries(parsed.entries),
      lastSavedAt: normalizeIso(parsed.lastSavedAt),
      updatedAt: normalizeIso(parsed.updatedAt) || normalizeIso(parsed.lastSavedAt),
      cloudLastSyncedAt: normalizeIso(parsed.cloudLastSyncedAt),
      driveFileId: typeof parsed.driveFileId === "string" ? parsed.driveFileId : "",
    };
  } catch {
    return {
      selectedDate: today,
      cycleStartDate: today,
      entries: {},
      lastSavedAt: null,
      updatedAt: null,
      cloudLastSyncedAt: null,
      driveFileId: "",
    };
  }
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedDate: state.selectedDate,
      cycleStartDate: state.cycleStartDate,
      entries: state.entries,
      lastSavedAt: state.lastSavedAt,
      updatedAt: state.updatedAt,
      cloudLastSyncedAt: state.cloudLastSyncedAt,
      driveFileId: state.driveFileId,
    }),
  );
}

function render() {
  elements.selectedDate.value = state.selectedDate;
  elements.cycleStart.value = state.cycleStartDate;

  renderTrackerGrid();
  renderSummary();
  renderCadence();
  renderHistory();
  renderDriveStatus();
}

function renderTrackerGrid() {
  const entry = getEntry(state.selectedDate);
  const workoutDay = isAlternateWorkoutDay(state.selectedDate, state.cycleStartDate);

  elements.trackerGrid.innerHTML = TRACKS.map((track) => {
    const isAlternate = track.cadence === "alternate";
    const isAvailable = !isAlternate || workoutDay;
    const numericValue =
      track.type === "number" ? formatNumberInput(entry[track.id] ?? 0) : null;
    const checked = isAvailable && Boolean(entry[track.id]);
    const stamp = isAlternate
      ? isAvailable
        ? "Сегодня по плану"
        : "Сегодня восстановление"
      : "Ежедневная отметка";

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
              aria-label="${track.title}"
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
                  ${isAvailable ? "" : "disabled"}
                  aria-label="${track.title}"
                />
                <span class="toggle-track"></span>
              </label>
              <div class="toggle-copy">
                <p class="toggle-status">${
                  isAvailable
                    ? checked
                      ? "Выполнено"
                      : "Ожидает отметки"
                    : "День восстановления"
                }</p>
                <p class="toggle-hint">${
                  isAvailable
                    ? "Поставь галочку, когда тренировка завершена."
                    : "Сегодня можно не отмечать этот блок."
                }</p>
              </div>
            </div>
          </div>
        `;

    return `
      <article
        class="tracker-card ${isAvailable ? "" : "inactive"}"
        style="--card-accent: ${track.accent};"
      >
        <div class="tracker-card-header">
          <div>
            <p class="card-kicker">${track.type === "number" ? track.unit : "чек-лист"}</p>
            <h3 class="card-title">${track.title}</h3>
            <p class="card-description">${track.description}</p>
          </div>
          <span class="card-stamp">${stamp}</span>
        </div>

        ${body}

        <div class="tracker-card-footer">
          <p class="history-meta">${
            track.type === "number"
              ? "Любое число сохраняется для выбранной даты."
              : "Логика через день считается от даты старта цикла."
          }</p>
        </div>
      </article>
    `;
  }).join("");
}

function renderSummary() {
  const entry = getEntry(state.selectedDate);
  const stats = getCompletionStats(state.selectedDate);
  const volume = getNumericVolume(entry);
  const streak = getStreakLength(state.selectedDate);
  const activeDays = getRecentActiveDays(state.selectedDate, 7);

  elements.progressRing.style.setProperty("--progress", stats.percent);
  elements.progressValue.textContent = `${stats.percent}%`;
  elements.streakValue.textContent = formatNumber(streak);
  elements.activeDaysValue.textContent = formatNumber(activeDays);
  elements.volumeValue.textContent = formatNumber(volume);
  elements.planValue.textContent = `${stats.completed} / ${stats.planned}`;

  const pulse = getPulseCopy(
    stats.percent,
    volume,
    isAlternateWorkoutDay(state.selectedDate, state.cycleStartDate),
  );
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
  const workoutDay = isAlternateWorkoutDay(state.selectedDate, state.cycleStartDate);
  const nextWorkoutDate = workoutDay
    ? state.selectedDate
    : shiftDate(state.selectedDate, 1);

  elements.cadenceTitle.textContent = workoutDay
    ? "Сегодня тренировочный день"
    : "Сегодня день восстановления";
  elements.cadenceText.textContent = workoutDay
    ? "Пресс и плечи стоят в плане на выбранную дату. Отметь их, когда блок завершен."
    : "Для пресса и плеч на выбранную дату отдых. Следующая отметка будет уже завтра.";
  elements.nextWorkout.textContent = formatDate(nextWorkoutDate);
  elements.cycleStartLabel.textContent = formatDate(state.cycleStartDate);
}

function renderHistory() {
  const dates = Array.from({ length: 8 }, (_, index) =>
    shiftDate(state.selectedDate, -index),
  );

  elements.historyGrid.innerHTML = dates
    .map((date) => {
      const entry = getEntry(date);
      const stats = getCompletionStats(date);
      const workoutDay = isAlternateWorkoutDay(date, state.cycleStartDate);

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

          <p class="history-meta">
            ${
              workoutDay
                ? "Тренировочный день для пресса и плеч."
                : "Восстановление для пресса и плеч."
            }
          </p>

          <div class="history-details">
            ${renderHistoryLine("Подтягивания", `${formatNumber(entry.pullups || 0)}`)}
            ${renderHistoryLine("Отжимания", `${formatNumber(entry.pushups || 0)}`)}
            ${renderHistoryLine("Приседания", `${formatNumber(entry.squats || 0)}`)}
            ${renderHistoryLine("Шаги", `${formatNumber(entry.steps || 0)}`)}
            ${renderHistoryLine("Пресс", workoutDay ? (entry.abs ? "Да" : "Нет") : "Отдых")}
            ${renderHistoryLine(
              "Плечи",
              workoutDay ? (entry.shoulders ? "Да" : "Нет") : "Отдых",
            )}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHistoryLine(label, value) {
  return `
    <div class="history-line">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
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
    pill = "Раньше синхр.";
    status =
      "Локальная копия уже была отправлена в Google Drive. Чтобы продолжить синхронизацию, подключите аккаунт снова.";
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

  elements.driveConnect.disabled = openedAsFile || !drive.configured || !drive.scriptReady;
  elements.driveSync.disabled = openedAsFile || !drive.configured || !drive.scriptReady;
  elements.driveDisconnect.disabled = !connected || drive.isSyncing;
}

function handleTrackerInput(event) {
  const trackId = event.target.dataset.track;
  if (!trackId) {
    return;
  }

  const track = TRACKS.find((item) => item.id === trackId);
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
    const localPayload = buildCloudPayload();

    if (!remote) {
      await uploadCloudPayload(localPayload);
      state.cloudLastSyncedAt = new Date().toISOString();
      persist();
      render();
      showToast("Google Drive подключен. Создана первая облачная копия.");
      return;
    }

    drive.fileId = remote.fileId;
    state.driveFileId = remote.fileId;

    if (compareIsoDates(localPayload.updatedAt, remote.payload?.updatedAt) >= 0) {
      await uploadCloudPayload(localPayload);
      state.cloudLastSyncedAt = new Date().toISOString();
      persist();
      render();
      showToast("Google Drive подключен. Локальная история загружена в облако.");
      return;
    }

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

function buildCloudPayload() {
  const updatedAt = state.updatedAt || new Date().toISOString();
  if (!state.updatedAt) {
    state.updatedAt = updatedAt;
    persist();
  }

  return {
    version: 1,
    updatedAt,
    lastSavedAt: state.lastSavedAt,
    cycleStartDate: state.cycleStartDate,
    entries: sanitizeEntries(state.entries),
  };
}

function applyCloudPayload(payload, fileId) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  state.cycleStartDate = sanitizeDateInput(payload.cycleStartDate, state.cycleStartDate);
  state.entries = sanitizeEntries(payload.entries);
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
    pullups: 0,
    pushups: 0,
    squats: 0,
    steps: 0,
    abs: false,
    shoulders: false,
    ...(state.entries[date] || {}),
  };
}

function sanitizeEntries(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [date, entry]) => {
    if (!isDateInputValue(date) || !entry || typeof entry !== "object") {
      return accumulator;
    }

    accumulator[date] = {
      pullups: sanitizeNumber(entry.pullups),
      pushups: sanitizeNumber(entry.pushups),
      squats: sanitizeNumber(entry.squats),
      steps: sanitizeNumber(entry.steps),
      abs: Boolean(entry.abs),
      shoulders: Boolean(entry.shoulders),
    };

    return accumulator;
  }, {});
}

function getCompletionStats(date) {
  const entry = getEntry(date);
  const workoutDay = isAlternateWorkoutDay(date, state.cycleStartDate);
  const plannedTracks = TRACKS.filter(
    (track) => track.type === "number" || workoutDay,
  );
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
  return TRACKS.filter((track) => track.type === "number").reduce(
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
  const numericActivity = TRACKS.some(
    (track) => track.type === "number" && sanitizeNumber(entry[track.id]) > 0,
  );
  const workoutDay = isAlternateWorkoutDay(date, state.cycleStartDate);
  const checkboxActivity =
    workoutDay &&
    TRACKS.some((track) => track.type === "checkbox" && Boolean(entry[track.id]));

  return numericActivity || checkboxActivity;
}

function isAlternateWorkoutDay(date, cycleStartDate) {
  const diff = Math.abs(getDayIndex(date) - getDayIndex(cycleStartDate));
  return diff % 2 === 0;
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

function sanitizeDateInput(value, fallback) {
  return isDateInputValue(value) ? value : fallback;
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

function isSameDay(first, second) {
  return first === second;
}

function getPulseCopy(percent, volume, workoutDay) {
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
      hero: workoutDay
        ? "База уже есть. Если добавить корпус и плечи по плану, день соберется полностью."
        : "База уже есть. На восстановительном дне особенно важна ровная, спокойная серия.",
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
    hero: workoutDay
      ? "Сегодня день, когда можно закрыть и базу, и блок корпуса с плечами."
      : "Сегодня день восстановления для пресса и плеч, так что можно спокойно держать базовый объем.",
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
