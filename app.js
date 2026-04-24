const FREE_MEASURES = 12;
const TOTAL_MEASURES = 24;
const STORAGE_KEY = "piano_mvp_state";

const urlParams = new URLSearchParams(window.location.search);
const API_MODE = urlParams.get("api") ? "remote" : "local";

const audio = document.getElementById("audio");
const audioFile = document.getElementById("audioFile");
const scoreGrid = document.getElementById("scoreGrid");
const currentMeasureEl = document.getElementById("currentMeasure");
const currentTimeEl = document.getElementById("currentTime");
const hardCountEl = document.getElementById("hardCount");
const backendChip = document.getElementById("backendChip");

const unlockButtons = [
  document.getElementById("unlockTop"),
  document.getElementById("unlockSide"),
];

const payModal = document.getElementById("payModal");
const cancelPay = document.getElementById("cancelPay");
const confirmPay = document.getElementById("confirmPay");

const authBtn = document.getElementById("authBtn");
const authModal = document.getElementById("authModal");
const cancelAuth = document.getElementById("cancelAuth");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const userStatus = document.getElementById("userStatus");

const toast = document.getElementById("toast");

const state = loadState();
const authState = loadAuth();

const measures = Array.from({ length: TOTAL_MEASURES }, (_, i) => {
  const index = i + 1;
  const start = i * 4;
  const end = (i + 1) * 4;
  return {
    index,
    start,
    end,
    hard: state.hardMeasures.includes(index),
  };
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { unlocked: false, hardMeasures: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      unlocked: Boolean(parsed.unlocked),
      hardMeasures: Array.isArray(parsed.hardMeasures) ? parsed.hardMeasures : [],
    };
  } catch {
    return { unlocked: false, hardMeasures: [] };
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ unlocked: state.unlocked, hardMeasures: state.hardMeasures })
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function setBackendLabel(status) {
  backendChip.textContent = `API: ${status}`;
}

function loadAuth() {
  try {
    const raw = localStorage.getItem("piano_mvp_auth");
    if (!raw) {
      return { user: null };
    }
    const parsed = JSON.parse(raw);
    return { user: parsed.user || null };
  } catch {
    return { user: null };
  }
}

function saveAuth() {
  localStorage.setItem("piano_mvp_auth", JSON.stringify({ user: authState.user }));
}

function renderUser() {
  if (authState.user) {
    userStatus.textContent = authState.user.email;
    authBtn.textContent = "退出登录";
  } else {
    userStatus.textContent = "未登录";
    authBtn.textContent = "登录 / 注册";
  }
}

function renderScore() {
  scoreGrid.innerHTML = "";
  measures.forEach((measure) => {
    const card = document.createElement("div");
    card.className = "measure";
    card.dataset.index = measure.index;
    if (!state.unlocked && measure.index > FREE_MEASURES) {
      card.classList.add("locked");
    }
    if (measure.hard) {
      card.classList.add("hard");
    }
    card.innerHTML = `
      <div class="measure-title">第 ${measure.index} 小节</div>
      <div class="measure-time">${measure.start}s - ${measure.end}s</div>
    `;
    if (measure.hard) {
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = "难点";
      card.appendChild(badge);
    }
    card.addEventListener("click", () => handleMeasureClick(measure));
    scoreGrid.appendChild(card);
  });
  updateHardCount();
}

function updateHardCount() {
  hardCountEl.textContent = state.hardMeasures.length.toString();
}

function handleMeasureClick(measure) {
  if (!state.unlocked && measure.index > FREE_MEASURES) {
    openPaywall();
    return;
  }
  measure.hard = !measure.hard;
  if (measure.hard) {
    if (!state.hardMeasures.includes(measure.index)) {
      state.hardMeasures.push(measure.index);
    }
  } else {
    state.hardMeasures = state.hardMeasures.filter((m) => m !== measure.index);
  }
  saveState();
  renderScore();
}

function syncMeasure(time) {
  const active = measures.find((m) => time >= m.start && time < m.end);
  currentTimeEl.textContent = formatTime(time);
  currentMeasureEl.textContent = active ? `第 ${active.index} 小节` : "—";
  document.querySelectorAll(".measure").forEach((el) => {
    const idx = Number(el.dataset.index);
    if (active && idx === active.index) {
      el.classList.add("current");
    } else {
      el.classList.remove("current");
    }
  });
}

function openPaywall() {
  payModal.classList.remove("hidden");
}

function closePaywall() {
  payModal.classList.add("hidden");
}

function openAuth() {
  authModal.classList.remove("hidden");
}

function closeAuth() {
  authModal.classList.add("hidden");
}

async function doRegister() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || password.length < 6) {
    showToast("请输入邮箱和至少 6 位密码");
    return;
  }
  authState.user = { email };
  saveAuth();
  showToast("注册成功（本地模拟）");
  closeAuth();
  renderUser();
}

async function doLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || password.length < 6) {
    showToast("请输入邮箱和至少 6 位密码");
    return;
  }
  authState.user = { email };
  saveAuth();
  showToast("登录成功（本地模拟）");
  closeAuth();
  renderUser();
}

function doLogout() {
  authState.user = null;
  saveAuth();
  state.unlocked = false;
  saveState();
  renderScore();
  renderUser();
  showToast("已退出登录");
}

function payAndUnlock() {
  if (!authState.user) {
    showToast("请先登录");
    closePaywall();
    openAuth();
    return;
  }
  state.unlocked = true;
  saveState();
  renderScore();
  closePaywall();
  showToast("解锁成功（本地模拟支付）");
}

unlockButtons.forEach((btn) => btn.addEventListener("click", openPaywall));
cancelPay.addEventListener("click", closePaywall);
confirmPay.addEventListener("click", payAndUnlock);

authBtn.addEventListener("click", () => {
  if (authBtn.textContent.includes("退出")) {
    doLogout();
  } else {
    openAuth();
  }
});
cancelAuth.addEventListener("click", closeAuth);
loginBtn.addEventListener("click", doLogin);
registerBtn.addEventListener("click", doRegister);

if (!audio.src) {
  audio.src = "";
}

audio.addEventListener("timeupdate", () => syncMeasure(audio.currentTime));

audioFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.play();
});

renderScore();
renderUser();
setBackendLabel(API_MODE === "remote" ? "远程 API" : "本地模拟");
