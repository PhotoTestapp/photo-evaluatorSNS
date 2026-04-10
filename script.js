const dom = {
  publishButton: document.getElementById("publishButton"),
  postInput: document.getElementById("postInput"),
  feedList: document.getElementById("feedList"),
  feedLoadMoreButton: document.getElementById("feedLoadMoreButton"),
  leaderList: document.getElementById("leaderList"),
  followingList: document.getElementById("followingList"),
  photoInput: document.getElementById("photoInput"),
  uploadTrigger: document.getElementById("uploadTrigger"),
  uploadPreview: document.getElementById("uploadPreview"),
  composerStatus: document.getElementById("composerStatus"),
  feedSummary: document.getElementById("feedSummary"),
  trendList: document.getElementById("trendList"),
  highlightCopy: document.getElementById("highlightCopy"),
  sessionPostCount: document.getElementById("sessionPostCount"),
  sessionPulseAverage: document.getElementById("sessionPulseAverage"),
  sessionMyPosts: document.getElementById("sessionMyPosts"),
  sessionBestRank: document.getElementById("sessionBestRank"),
  presetWide: document.getElementById("presetWide"),
  presetMood: document.getElementById("presetMood"),
  sidebarComposeButton: document.getElementById("sidebarComposeButton"),
  emptyFeedCard: document.getElementById("emptyFeedCard"),
  emptyFeedComposeButton: document.getElementById("emptyFeedComposeButton"),
  signupForm: document.getElementById("signupForm"),
  signupSubmitButton: document.getElementById("signupSubmitButton"),
  signupEmail: document.getElementById("signupEmail"),
  signupPassword: document.getElementById("signupPassword"),
  signupDisplayName: document.getElementById("signupDisplayName"),
  signupHandle: document.getElementById("signupHandle"),
  signupLocation: document.getElementById("signupLocation"),
  signupBio: document.getElementById("signupBio"),
  signupAvatarInput: document.getElementById("signupAvatarInput"),
  signupAvatarButton: document.getElementById("signupAvatarButton"),
  signupAvatarPreview: document.getElementById("signupAvatarPreview"),
  signupStatus: document.getElementById("signupStatus"),
  appModeNotice: document.getElementById("appModeNotice"),
  loginButton: document.getElementById("loginButton"),
  logoutButton: document.getElementById("logoutButton"),
  composerAvatar: document.getElementById("composerAvatar"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileDisplayName: document.getElementById("profileDisplayName"),
  profileHandle: document.getElementById("profileHandle"),
  profileLocation: document.getElementById("profileLocation"),
  profileBio: document.getElementById("profileBio"),
  profilePostCount: document.getElementById("profilePostCount"),
  profileSavedCount: document.getElementById("profileSavedCount"),
  profilePulseAverage: document.getElementById("profilePulseAverage"),
  profileGallery: document.getElementById("profileGallery"),
  profileLoadMoreButton: document.getElementById("profileLoadMoreButton"),
  profileEmpty: document.getElementById("profileEmpty"),
  snsApiBaseMeta: document.querySelector('meta[name="pulse-sns-api-base"]'),
};

const SCORE_KEYS = ["構図", "光", "色", "技術", "主題性", "印象"];
const SCORE_VALUE_KEYS = [
  "compositionScore",
  "lightScore",
  "colorScore",
  "technicalScore",
  "subjectScore",
  "impactScore",
];

const STORAGE_KEYS = {
  session: "pulse_sns_session_v2",
  cachedProfile: "pulse_sns_cached_profile_v2",
  apiBase: "pulse_sns_api_base",
};

const LEGACY_STORAGE_KEYS = [
  "photo_eval_anonymous_user_id",
  "pulse_sns_feed_state_v2",
  "pulse_sns_profile_v1",
  "pulse_sns_follow_state_v1",
  "pulse_sns_accounts_v1",
  "pulse_sns_session_v1",
];

const API_ENDPOINTS = {
  register: "/api/sns/register",
  login: "/api/sns/login",
  posts: "/api/sns/posts",
  uploads: "/api/sns/uploads",
  profile: "/api/sns/profile",
  following: "/api/sns/users/following",
};

const DEFAULT_PROFILE = {
  id: "",
  displayName: "Pulse User",
  handle: "@pulse",
  location: "Japan",
  bio: "プロフィールを設定するとここに表示されます。",
  avatarSrc: "",
};

const PAGINATION_LIMIT = 12;
const API_TIMEOUT_MS = 12000;
const MAX_UPLOAD_EDGE = 1600;
const UPLOAD_IMAGE_QUALITY = 0.86;

const state = {
  session: null,
  apiMode: "checking",
  activeFilter: "all",
  pendingPhoto: null,
  pendingPhotoFile: null,
  pendingAvatarSrc: "",
  pendingAvatarFile: null,
  feed: [],
  following: [],
  loadingFeed: false,
  loadingProfilePosts: false,
  submittingAuth: false,
  updatingProfile: false,
  publishingPost: false,
  deletingPostIds: new Set(),
  legacyStorageCleaned: false,
  feedPagination: {
    cursor: null,
    hasMore: false,
  },
  profilePostsState: {
    items: [],
    cursor: null,
    hasMore: false,
  },
};

// Utilities
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value, min, max) {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function round(value) {
  return Math.round(value);
}

function normalizeHandle(handle) {
  const raw = String(handle || "").trim().replace(/\s+/g, "");
  if (!raw) return DEFAULT_PROFILE.handle;
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getProfileInitials(displayName) {
  const name = (displayName || DEFAULT_PROFILE.displayName).trim();
  if (!name) return "PU";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildAvatarMarkup(profile, className = "avatar gradient-avatar") {
  const displayName = profile?.displayName || DEFAULT_PROFILE.displayName;
  const avatarSrc = profile?.avatarSrc || "";
  if (avatarSrc) {
    return `<div class="${className} avatar-image"><img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(displayName)} のアイコン" /></div>`;
  }
  return `<div class="${className}">${escapeHtml(getProfileInitials(displayName))}</div>`;
}

function renderAvatarNode(node, profile, fallbackClassName) {
  if (!node) return;
  const nextClassName = fallbackClassName || node.className;
  node.className = profile?.avatarSrc ? `${nextClassName} avatar-image` : nextClassName;
  node.innerHTML = profile?.avatarSrc
    ? `<img src="${escapeHtml(profile.avatarSrc)}" alt="${escapeHtml(profile.displayName || DEFAULT_PROFILE.displayName)} のアイコン" />`
    : escapeHtml(getProfileInitials(profile?.displayName || DEFAULT_PROFILE.displayName));
}

function getConfiguredSnsApiBase() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.apiBase);
    if (stored && /^https?:\/\//i.test(stored)) return stored.replace(/\/+$/, "");
  } catch (error) {
    console.warn("SNS API base storage unavailable", error);
  }
  const metaValue = dom.snsApiBaseMeta?.getAttribute("content")?.trim() || "";
  if (metaValue && /^https?:\/\//i.test(metaValue)) return metaValue.replace(/\/+$/, "");
  if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return window.location.origin;
  return "";
}

function getRelativeTime(createdAt) {
  if (!createdAt) return "時刻未設定";
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return "時刻未設定";
  const diffMs = Date.now() - createdMs;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}日前`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}か月前`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}年前`;
}

function isRecentPost(createdAt) {
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return false;
  return Date.now() - createdMs <= 6 * 60 * 60 * 1000;
}

function getRankLabel(score) {
  const numeric = Number(score || 0);
  if (numeric >= 95) return "最高";
  if (numeric >= 90) return "上位";
  if (numeric >= 80) return "良好";
  if (numeric >= 65) return "注目";
  return "通常";
}

function getScorePillClass(score) {
  const numeric = Number(score || 0);
  if (numeric >= 90) return "excellent";
  if (numeric >= 75) return "strong";
  return "";
}

function getCaptionTag(score) {
  const numeric = Number(score || 0);
  if (numeric >= 92) return "注目投稿";
  if (numeric >= 84) return "反応あり";
  if (numeric >= 72) return "新着";
  return "投稿";
}

function summarizeScores(scoreValues) {
  const normalized = scoreValues.map((value, index) => ({ label: SCORE_KEYS[index], value: Number(value || 0) }));
  normalized.sort((left, right) => right.value - left.value);
  const [first, second] = normalized;
  return `${first?.label || "印象"}${second ? `・${second.label}` : ""}が強い投稿です。`;
}

// Session management
function getCachedProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.cachedProfile) || "null");
    return parsed ? { ...DEFAULT_PROFILE, ...parsed, handle: normalizeHandle(parsed.handle) } : { ...DEFAULT_PROFILE };
  } catch (error) {
    console.warn("Cached profile restore failed", error);
    return { ...DEFAULT_PROFILE };
  }
}

function saveCachedProfile(profile) {
  const nextProfile = {
    id: profile?.id || "",
    displayName: profile?.displayName?.trim() || DEFAULT_PROFILE.displayName,
    handle: normalizeHandle(profile?.handle || DEFAULT_PROFILE.handle),
    location: profile?.location?.trim() || DEFAULT_PROFILE.location,
    bio: profile?.bio?.trim() || DEFAULT_PROFILE.bio,
    avatarSrc: profile?.avatarSrc || "",
  };
  try {
    localStorage.setItem(STORAGE_KEYS.cachedProfile, JSON.stringify(nextProfile));
  } catch (error) {
    console.warn("Cached profile save failed", error);
  }
  return nextProfile;
}

function getCurrentSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
    if (!parsed?.token || !parsed?.accountId) return null;
    return {
      token: parsed.token,
      accountId: parsed.accountId,
      email: parsed.email || "",
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}), handle: normalizeHandle(parsed.profile?.handle) },
    };
  } catch (error) {
    console.warn("Session restore failed", error);
    return null;
  }
}

function saveSession(session) {
  const safeSession = {
    token: session.token,
    accountId: session.accountId,
    email: session.email || "",
    profile: saveCachedProfile(session.profile || DEFAULT_PROFILE),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(safeSession));
  } catch (error) {
    console.warn("Session save failed", error);
  }
  state.session = safeSession;
  return safeSession;
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.session);
  } catch (error) {
    console.warn("Session clear failed", error);
  }
  state.session = null;
}

function getViewerProfile() {
  return state.session?.profile || getCachedProfile();
}

function isLoggedIn() {
  return Boolean(state.session?.token && state.session?.accountId);
}

// UI status helpers
function setNotice(node, message, tone = "") {
  if (!node) return;
  node.textContent = message;
  node.classList.remove("is-error", "is-success");
  if (tone === "error") node.classList.add("is-error");
  if (tone === "success") node.classList.add("is-success");
}

function setSignupStatus(message, tone) {
  setNotice(dom.signupStatus, message, tone);
}

function setComposerStatus(message, tone) {
  setNotice(dom.composerStatus, message, tone);
}

function renderAppModeNotice() {
  if (!dom.appModeNotice) return;
  if (state.apiMode === "online") {
    setNotice(dom.appModeNotice, "API接続中です。投稿・反応はサーバー同期されます。", "success");
    return;
  }
  if (state.apiMode === "demo") {
    setNotice(dom.appModeNotice, "API未接続です。現在はローカルデモ表示のみです。登録や投稿は反映されません。", "error");
    return;
  }
  setNotice(dom.appModeNotice, "API接続を確認しています。");
}

function updateAuthUi() {
  if (dom.logoutButton) dom.logoutButton.hidden = !isLoggedIn();
  if (dom.loginButton) dom.loginButton.hidden = isLoggedIn();
  if (dom.signupSubmitButton) dom.signupSubmitButton.textContent = isLoggedIn() ? "プロフィール更新" : "登録する";
  if (dom.publishButton) dom.publishButton.disabled = state.apiMode !== "online" || !isLoggedIn() || state.publishingPost;
  if (dom.signupPassword) dom.signupPassword.placeholder = isLoggedIn() ? "変更時のみ入力" : "8文字以上";
  if (dom.signupSubmitButton) dom.signupSubmitButton.disabled = state.submittingAuth || state.updatingProfile;
  if (dom.loginButton) dom.loginButton.disabled = state.submittingAuth || state.updatingProfile;
}

function fillSignupForm(profile) {
  if (dom.signupEmail) dom.signupEmail.value = state.session?.email || "";
  if (dom.signupPassword) dom.signupPassword.value = "";
  if (dom.signupDisplayName) dom.signupDisplayName.value = profile.displayName;
  if (dom.signupHandle) dom.signupHandle.value = profile.handle;
  if (dom.signupLocation) dom.signupLocation.value = profile.location;
  if (dom.signupBio) dom.signupBio.value = profile.bio;
  state.pendingAvatarSrc = profile.avatarSrc || "";
  renderAvatarNode(dom.signupAvatarPreview, profile, "signup-avatar-preview gradient-avatar");
}

function applyProfileToUi(profile = getViewerProfile()) {
  renderAvatarNode(dom.composerAvatar, profile, "avatar gradient-avatar");
  fillSignupForm(profile);
  updateAuthUi();
  if (isLoggedIn()) {
    setSignupStatus(`${state.session.email} でログイン中です。プロフィール更新も行えます。`, "success");
  } else if (state.apiMode === "demo") {
    setSignupStatus("未ログインです。API未接続のため現在はデモ表示です。", "error");
  } else {
    setSignupStatus("未ログインです。メールとパスワードで登録またはログインできます。");
  }
  renderProfileSection();
}

function cleanupLegacyStorage() {
  if (state.legacyStorageCleaned) return;
  const removedKeys = [];
  LEGACY_STORAGE_KEYS.forEach((key) => {
    try {
      if (localStorage.getItem(key) !== null) removedKeys.push(key);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Legacy storage cleanup failed: ${key}`, error);
    }
  });
  state.legacyStorageCleaned = true;
  console.info(
    removedKeys.length
      ? `Pulse SNS: cleaned legacy localStorage keys: ${removedKeys.join(", ")}`
      : "Pulse SNS: no legacy localStorage keys found to clean.",
  );
}

function handleAuthFailure(message = "セッションが切れました。再ログインしてください。") {
  clearSession();
  state.following = [];
  state.feed = [];
  state.feedPagination = { cursor: null, hasMore: false };
  state.profilePostsState = { items: [], cursor: null, hasMore: false };
  applyProfileToUi(getViewerProfile());
  renderFollowingList();
  renderFeed([]);
  renderProfileSection();
  setSignupStatus(message, "error");
  setComposerStatus(message, "error");
}

function buildApiError(message, code, status, payload) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.payload = payload;
  return error;
}

// API
async function apiRequest(path, options = {}) {
  const apiBase = getConfiguredSnsApiBase();
  if (!apiBase) {
    throw buildApiError("API未設定のため、現在はローカルデモモードです。", "API_UNAVAILABLE");
  }

  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const session = state.session || getCurrentSession();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || API_TIMEOUT_MS;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  if (options.json !== false) headers.set("Accept", "application/json");
  if (session?.token && options.auth !== false) headers.set("Authorization", `Bearer ${session.token}`);
  if (options.body && !headers.has("Content-Type") && typeof options.body !== "string" && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const requestInit = {
    method,
    headers,
    body: options.body
      ? (options.body instanceof FormData || typeof options.body === "string" ? options.body : JSON.stringify(options.body))
      : undefined,
    signal: controller.signal,
  };

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, requestInit);
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw buildApiError("通信がタイムアウトしました。", "NETWORK_ERROR");
    }
    throw buildApiError("SNS API に接続できませんでした。", "NETWORK_ERROR");
  }
  window.clearTimeout(timeoutId);

  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    payload = text ? { message: text } : null;
  }

  if (response.status === 401 || response.status === 403) {
    const authError = buildApiError(payload?.message || "認証が無効です。再ログインしてください。", "AUTH_ERROR", response.status, payload);
    handleAuthFailure(authError.message);
    throw authError;
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.message || payload?.error || "通信に失敗しました。";
    if (response.status >= 400 && response.status < 500) {
      throw buildApiError(message, "VALIDATION_ERROR", response.status, payload);
    }
    throw buildApiError(message, "SERVER_ERROR", response.status, payload);
  }

  return payload || { success: true };
}

function normalizeAccount(account) {
  const profile = { ...DEFAULT_PROFILE, ...(account?.profile || account || {}) };
  return {
    id: account?.id || profile.id || "",
    email: account?.email || "",
    profile: {
      id: profile.id || account?.id || "",
      displayName: profile.displayName || DEFAULT_PROFILE.displayName,
      handle: normalizeHandle(profile.handle || DEFAULT_PROFILE.handle),
      location: profile.location || DEFAULT_PROFILE.location,
      bio: profile.bio || DEFAULT_PROFILE.bio,
      avatarSrc: profile.avatarSrc || "",
    },
  };
}

function normalizePost(post) {
  const scoreBreakdownSource = post?.scoreBreakdown || {};
  const scoreValues = Array.isArray(post?.scoreValues)
    ? post.scoreValues
    : SCORE_VALUE_KEYS.map((key) => Number(scoreBreakdownSource[key] || 0));
  const scoreBreakdown = SCORE_VALUE_KEYS.reduce((accumulator, key, index) => {
    accumulator[key] = Number(scoreBreakdownSource[key] ?? scoreValues[index] ?? 0);
    return accumulator;
  }, {});

  return {
    id: String(post?.id || ""),
    authorId: String(post?.authorId || post?.author?.id || ""),
    displayName: post?.displayName || post?.author?.displayName || DEFAULT_PROFILE.displayName,
    handle: normalizeHandle(post?.handle || post?.author?.handle || DEFAULT_PROFILE.handle),
    avatarSrc: post?.avatarSrc || post?.author?.avatarSrc || "",
    content: post?.content || "",
    imageSrc: post?.imageSrc || post?.imageUrl || "",
    imageAlt: post?.imageAlt || "投稿写真",
    scoreBreakdown,
    scoreValues,
    baseScore: Number(post?.baseScore ?? post?.photoScore ?? 0),
    pulse: Number(post?.pulse ?? 0),
    finalScore: Number(post?.finalScore ?? post?.totalScore ?? post?.baseScore ?? 0),
    likesCount: Number(post?.likesCount ?? post?.likes ?? 0),
    savesCount: Number(post?.savesCount ?? post?.saves ?? 0),
    createdAt: post?.createdAt || post?.created_at || "",
    viewerHasLiked: Boolean(post?.viewerHasLiked),
    viewerHasSaved: Boolean(post?.viewerHasSaved),
    viewerIsFollowingAuthor: Boolean(post?.viewerIsFollowingAuthor),
    tag: post?.tag || getCaptionTag(post?.finalScore ?? post?.baseScore ?? 0),
  };
}

function buildPostsQuery({ filter = "all", cursor = null, limit = PAGINATION_LIMIT, scopeOverride = "" } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  if (filter === "top") params.set("sort", "top");
  else params.set("sort", "latest");
  if (scopeOverride) params.set("scope", scopeOverride);
  else if (filter === "mine") params.set("scope", "mine");
  return `?${params.toString()}`;
}

function mergePosts(existingPosts, nextPosts) {
  const seen = new Set();
  const merged = [...existingPosts, ...nextPosts].filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
  return merged;
}

function requireAuth(message = "この操作にはログインが必要です。") {
  if (isLoggedIn()) return true;
  setSignupStatus(message, "error");
  setComposerStatus(message, "error");
  return false;
}

// Image analysis
function scoreFromDeviation(value, ideal, tolerance, hardLimit = tolerance * 1.8) {
  const deviation = Math.abs(value - ideal);
  if (deviation <= tolerance) return 92 - (deviation / tolerance) * 12;
  if (deviation >= hardLimit) return 24;
  return 80 - ((deviation - tolerance) / (hardLimit - tolerance)) * 56;
}

function extractImageStats(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const totalPixels = width * height;
  const gray = new Float32Array(totalPixels);
  const histogram = new Uint32Array(256);
  let sum = 0;
  let sumSq = 0;
  let overexposed = 0;
  let underexposed = 0;
  let saturated = 0;

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[pixel] = luminance;
    histogram[Math.max(0, Math.min(255, luminance | 0))] += 1;
    sum += luminance;
    sumSq += luminance * luminance;
    if (luminance >= 245) overexposed += 1;
    if (luminance <= 18) underexposed += 1;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    if (maxChannel > 0 && (maxChannel - minChannel) / maxChannel > 0.45) saturated += 1;
  }

  const mean = sum / totalPixels;
  const variance = Math.max(0, sumSq / totalPixels - mean * mean);
  const std = Math.sqrt(variance);
  let entropy = 0;
  histogram.forEach((count) => {
    if (!count) return;
    const probability = count / totalPixels;
    entropy -= probability * Math.log2(probability);
  });

  return {
    gray,
    mean,
    std,
    contrast: std / 128,
    entropy,
    overexposedRatio: overexposed / totalPixels,
    underexposedRatio: underexposed / totalPixels,
    saturationRatio: saturated / totalPixels,
  };
}

function analyzeSpatialFeatures(gray, width, height, stats) {
  const cellCols = 6;
  const cellRows = 6;
  const saliencyGrid = Array.from({ length: cellRows * cellCols }, () => 0);
  const edgeValues = [];
  let edgeSum = 0;
  let laplacianSum = 0;
  let lowEdgeNoiseSum = 0;
  let lowEdgeCount = 0;
  let subjectWeightedX = 0;
  let subjectWeightedY = 0;
  let totalSaliency = 0;
  const leftBoundary = Math.floor(width / 3);
  const rightBoundary = Math.floor((width * 2) / 3);
  const topBoundary = Math.floor(height / 3);
  const bottomBoundary = Math.floor((height * 2) / 3);
  const bands = { left: 0, center: 0, right: 0, top: 0, middle: 0, bottom: 0, total: 0, peripheral: 0 };

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const gx = -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1]
        + gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];
      const gy = -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1]
        + gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
      const edge = Math.sqrt(gx * gx + gy * gy);
      const laplacian = Math.abs(gray[idx - width] + gray[idx + width] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]);
      const localMean = (gray[idx] + gray[idx - 1] + gray[idx + 1] + gray[idx - width] + gray[idx + width]) / 5;
      const localNoise = Math.abs(gray[idx] - localMean);

      edgeValues.push(edge);
      edgeSum += edge;
      laplacianSum += laplacian;
      if (edge < 28) {
        lowEdgeNoiseSum += localNoise;
        lowEdgeCount += 1;
      }

      if (x < leftBoundary) bands.left += edge;
      else if (x < rightBoundary) bands.center += edge;
      else bands.right += edge;

      if (y < topBoundary) bands.top += edge;
      else if (y < bottomBoundary) bands.middle += edge;
      else bands.bottom += edge;

      bands.total += edge;
      if (x < width * 0.16 || x > width * 0.84 || y < height * 0.16 || y > height * 0.84) bands.peripheral += edge;

      const saliency = edge * 0.65 + laplacian * 0.25 + Math.abs(gray[idx] - stats.mean) * 0.1;
      subjectWeightedX += x * saliency;
      subjectWeightedY += y * saliency;
      totalSaliency += saliency;
      const cellX = Math.min(cellCols - 1, Math.floor((x / width) * cellCols));
      const cellY = Math.min(cellRows - 1, Math.floor((y / height) * cellRows));
      saliencyGrid[cellY * cellCols + cellX] += saliency;
    }
  }

  edgeValues.sort((left, right) => left - right);
  const dominantEdge = edgeValues[Math.floor(edgeValues.length * 0.85)] || 0;
  const meanEdge = edgeSum / Math.max(1, edgeValues.length);
  const sharpnessRaw = laplacianSum / Math.max(1, edgeValues.length);
  const noiseEstimate = lowEdgeNoiseSum / Math.max(1, lowEdgeCount);
  const subjectX = totalSaliency ? subjectWeightedX / totalSaliency : width / 2;
  const subjectY = totalSaliency ? subjectWeightedY / totalSaliency : height / 2;
  const thirdsPoints = [
    [width / 3, height / 3],
    [(width * 2) / 3, height / 3],
    [width / 3, (height * 2) / 3],
    [(width * 2) / 3, (height * 2) / 3],
  ];
  const nearestThird = Math.min(...thirdsPoints.map(([tx, ty]) => Math.hypot(subjectX - tx, subjectY - ty)));
  const thirdsAlignment = 1 - clamp(nearestThird / (Math.min(width, height) * 0.45), 0, 1);
  const subjectConcentration = Math.max(...saliencyGrid) / Math.max(1, totalSaliency);
  const hotCellCount = saliencyGrid.filter((value) => value > totalSaliency / (saliencyGrid.length * 0.75)).length;
  const backgroundInformation = normalize(stats.entropy, 4.8, 7.6) * 0.45 + normalize(bands.peripheral / (width * height), 8, 60) * 0.55;
  const clutterScore = clamp((hotCellCount / saliencyGrid.length) * 0.6 + backgroundInformation * 0.4, 0, 1);

  return {
    meanEdge,
    dominantEdge,
    sharpnessRaw,
    noiseEstimate,
    leftRightBalance: 1 - Math.abs(bands.left - bands.right) / Math.max(1, bands.left + bands.right),
    topBottomBalance: 1 - Math.abs(bands.top - bands.bottom) / Math.max(1, bands.top + bands.bottom),
    thirdsAlignment,
    subjectConcentration,
    backgroundInformation,
    backgroundClutter: clutterScore,
    subjectCenterSupport: 1 - clamp(Math.hypot(subjectX / width - 0.5, subjectY / height - 0.5) / 0.72, 0, 1),
    subjectXRatio: subjectX / width,
    subjectYRatio: subjectY / height,
  };
}

function deriveScoresFromMetrics(metrics) {
  const lightScore = clamp(round(
    scoreFromDeviation(metrics.brightnessMean, 138, 22, 62) * 0.34
    + scoreFromDeviation(metrics.brightnessStd, 58, 18, 48) * 0.18
    + scoreFromDeviation(metrics.contrast, 0.42, 0.16, 0.44) * 0.18
    + (1 - clamp(metrics.overexposedRatio / 0.11, 0, 1)) * 15
    + (1 - clamp(metrics.underexposedRatio / 0.14, 0, 1)) * 15
  ), 16, 98);

  const technicalScore = clamp(round(
    normalize(metrics.meanEdge, 8, 46) * 34
    + normalize(metrics.dominantEdge, 18, 96) * 22
    + normalize(metrics.sharpnessRaw, 6, 30) * 32
    + (1 - normalize(metrics.noiseEstimate, 3, 18)) * 12
  ), 14, 98);

  const subjectCenterSupport = 1 - clamp(Math.hypot(metrics.subjectXRatio - 0.5, metrics.subjectYRatio - 0.5) / 0.72, 0, 1);
  const compositionScore = clamp(round(
    metrics.leftRightBalance * 23
    + metrics.topBottomBalance * 18
    + metrics.thirdsAlignment * 28
    + normalize(metrics.subjectConcentration, 0.035, 0.14) * 17
    + subjectCenterSupport * 14
  ), 18, 97);
  const colorScore = clamp(round(
    scoreFromDeviation(metrics.saturationRatio, 0.18, 0.08, 0.2) * 0.34
    + scoreFromDeviation(metrics.contrast, 0.42, 0.14, 0.38) * 0.28
    + (1 - clamp(metrics.overexposedRatio / 0.11, 0, 1)) * 18
    + (1 - clamp(metrics.underexposedRatio / 0.14, 0, 1)) * 20
  ), 18, 97);
  const subjectScore = clamp(round(
    (1 - metrics.backgroundClutter) * 30
    + subjectCenterSupport * 18
    + normalize(metrics.subjectConcentration, 0.03, 0.13) * 26
    + scoreFromDeviation(metrics.backgroundInformation, 0.46, 0.17, 0.42) * 0.26
  ), 18, 97);
  const impactScore = clamp(round(
    compositionScore * 0.2
    + lightScore * 0.17
    + colorScore * 0.15
    + technicalScore * 0.17
    + subjectScore * 0.17
    + (1 - metrics.backgroundClutter) * 14
  ), 18, 98);
  const totalScore = clamp(round(
    compositionScore * 0.18
    + lightScore * 0.16
    + colorScore * 0.15
    + technicalScore * 0.18
    + subjectScore * 0.18
    + impactScore * 0.15
  ), 16, 98);

  return { compositionScore, lightScore, colorScore, technicalScore, subjectScore, impactScore, totalScore };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像プレビューの生成に失敗しました。"));
    image.src = src;
  });
}

async function compressImageFile(file, { maxEdge = MAX_UPLOAD_EDGE, quality = UPLOAD_IMAGE_QUALITY } = {}) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像圧縮の初期化に失敗しました。");
  context.drawImage(image, 0, 0, width, height);

  const type = /png$/i.test(file.type) ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), type, type === "image/jpeg" ? quality : undefined);
  });
  if (!(blob instanceof Blob)) throw new Error("画像圧縮に失敗しました。");
  return new File([blob], file.name.replace(/\.[^.]+$/, type === "image/png" ? ".png" : ".jpg"), { type });
}

function buildMetricsFromImage(image) {
  const maxSide = 240;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(24, Math.round(image.naturalWidth * scale));
  const height = Math.max(24, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("画像解析の初期化に失敗しました。");
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  const stats = extractImageStats(context, width, height);
  const spatial = analyzeSpatialFeatures(stats.gray, width, height, stats);
  return {
    brightnessMean: stats.mean,
    brightnessStd: stats.std,
    contrast: stats.contrast,
    entropy: stats.entropy,
    overexposedRatio: stats.overexposedRatio,
    underexposedRatio: stats.underexposedRatio,
    saturationRatio: stats.saturationRatio,
    meanEdge: spatial.meanEdge,
    dominantEdge: spatial.dominantEdge,
    sharpnessRaw: spatial.sharpnessRaw,
    noiseEstimate: spatial.noiseEstimate,
    leftRightBalance: spatial.leftRightBalance,
    topBottomBalance: spatial.topBottomBalance,
    thirdsAlignment: spatial.thirdsAlignment,
    subjectConcentration: spatial.subjectConcentration,
    backgroundInformation: spatial.backgroundInformation,
    backgroundClutter: spatial.backgroundClutter,
    subjectCenterSupport: spatial.subjectCenterSupport,
    subjectXRatio: spatial.subjectXRatio,
    subjectYRatio: spatial.subjectYRatio,
  };
}

function renderUploadPreview(dataUrl, totalScore, caption = "写真を解析しました。") {
  dom.uploadPreview.classList.remove("empty-preview");
  dom.uploadPreview.innerHTML = `
    <img src="${escapeHtml(dataUrl)}" alt="アップロードした写真のプレビュー" />
    <div class="upload-preview-info">
      <span class="upload-label">Photo Score Preview</span>
      <strong>${escapeHtml(totalScore)} / 100</strong>
      <p>${escapeHtml(caption)}</p>
    </div>
  `;
}

function resetUploadPreview() {
  state.pendingPhoto = null;
  state.pendingPhotoFile = null;
  if (dom.photoInput) dom.photoInput.value = "";
  dom.uploadPreview.className = "upload-preview empty-preview";
  dom.uploadPreview.innerHTML = `<div class="upload-preview-copy"><span class="upload-label">画像プレビュー</span><strong>写真を選ぶとここにプレビューと投稿用スコア候補が表示されます。</strong></div>`;
}

async function preparePendingPhoto(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const metrics = buildMetricsFromImage(image);
  const scores = deriveScoresFromMetrics(metrics);
  state.pendingPhoto = { previewUrl: dataUrl, fileName: file.name, scoreBreakdown: scores };
  state.pendingPhotoFile = file;
  renderUploadPreview(dataUrl, scores.totalScore, `${file.name} を解析し、投稿用スコア候補を作成しました。`);
}

async function uploadImageAsset(file, kind = "post") {
  const compressedFile = await compressImageFile(file);
  const formData = new FormData();
  formData.append("file", compressedFile);
  formData.append("kind", kind);
  const response = await apiRequest(API_ENDPOINTS.uploads, {
    method: "POST",
    auth: true,
    body: formData,
    json: false,
  });
  const imageUrl = response?.imageUrl || response?.url || "";
  if (!imageUrl) {
    throw buildApiError("画像アップロード結果が不正です。", "SERVER_ERROR");
  }
  return { imageUrl, assetId: response?.assetId || "" };
}

// Feed rendering
function buildScoreMarkup(scoreValues) {
  return scoreValues.map((score, index) => `
    <div class="score-item">
      <span>${escapeHtml(SCORE_KEYS[index])}</span>
      <strong>${escapeHtml(score)}</strong>
      <div class="score-track"><div class="score-fill" data-score="${escapeHtml(score)}"></div></div>
    </div>
  `).join("");
}

function createPostMarkup(post) {
  const viewerOwnsPost = isLoggedIn() && post.authorId === state.session?.accountId;
  const deletingPost = state.deletingPostIds.has(post.id);
  const avatarMarkup = buildAvatarMarkup({ displayName: post.displayName, avatarSrc: post.avatarSrc });
  const tag = post.tag || getCaptionTag(post.finalScore || post.baseScore);
  return `
    <div class="post-header">
      <div class="post-meta">
        <div class="post-author-main">
          ${avatarMarkup}
          <div>
            <strong>${escapeHtml(post.displayName)}</strong>
            <p class="post-meta-line">
              <span>${escapeHtml(post.handle)}</span>
              <span>${escapeHtml(getRelativeTime(post.createdAt))}</span>
              <span class="micro-tag">${escapeHtml(tag)}</span>
            </p>
          </div>
        </div>
        <div class="post-author-actions">
          <a class="chip" href="#profile">プロフィール</a>
          ${viewerOwnsPost ? `
            <button class="chip" type="button" data-action="delete-post" data-post-id="${escapeHtml(post.id)}" ${deletingPost ? "disabled" : ""}>${deletingPost ? "削除中" : "削除"}</button>
          ` : `
            <button
              class="chip follow-toggle ${post.viewerIsFollowingAuthor ? "following-action" : ""}"
              type="button"
              data-action="follow"
              data-user-id="${escapeHtml(post.authorId)}"
            >${post.viewerIsFollowingAuthor ? "Following" : "Follow"}</button>
          `}
        </div>
      </div>
      <div class="score-head">
        <span class="score-pill ${getScorePillClass(post.finalScore)} total-score">${escapeHtml(post.finalScore)}</span>
        <span class="tag">${escapeHtml(getRankLabel(post.finalScore))}</span>
      </div>
    </div>
    ${post.imageSrc ? `
      <div class="media-block">
        <img src="${escapeHtml(post.imageSrc)}" alt="${escapeHtml(post.imageAlt)}" class="post-uploaded-image" />
        <div class="photo-overlay">
          <span>Photo Score</span>
          <strong>${escapeHtml(tag)}</strong>
        </div>
      </div>
    ` : `
      <div class="media-block text-media-card">
        <div class="photo-overlay">
          <span>テキスト投稿</span>
          <strong>${escapeHtml(tag)}</strong>
        </div>
      </div>
    `}
    <p class="post-body">${escapeHtml(post.content || "")}</p>
    <div class="score-summary">
      <div class="score-summary-card"><span>Photo Score</span><strong>${escapeHtml(post.baseScore)}</strong></div>
      <div class="score-summary-card"><span>Pulse</span><strong>${escapeHtml(post.pulse)}</strong></div>
      <div class="score-summary-card"><span>Final Rank</span><strong>${escapeHtml(getRankLabel(post.finalScore))}</strong></div>
    </div>
    <div class="engagement-panel">
      <div class="engagement-stats">
        <span>Likes <strong>${escapeHtml(post.likesCount)}</strong></span>
        <span>Saved <strong>${escapeHtml(post.savesCount)}</strong></span>
        <span>Posted <strong>${escapeHtml(getRelativeTime(post.createdAt))}</strong></span>
      </div>
    </div>
    <div class="score-grid">${buildScoreMarkup(post.scoreValues)}</div>
    <div class="post-actions">
      <button class="action-button like-button ${post.viewerHasLiked ? "liked" : ""}" type="button" data-action="like" data-post-id="${escapeHtml(post.id)}">${escapeHtml(post.likesCount)} Likes</button>
      <a class="action-button" href="#profile">プロフィール</a>
      <button class="action-button save-toggle ${post.viewerHasSaved ? "saved-action" : ""}" type="button" data-action="save" data-post-id="${escapeHtml(post.id)}">${post.viewerHasSaved ? "Saved" : "Save"}</button>
    </div>
    <div class="comment-preview">
      <div class="comment-preview-head">
        <strong>Score memo</strong>
        <span>サーバー反映済み</span>
      </div>
      <p>${escapeHtml(summarizeScores(post.scoreValues))}</p>
    </div>
  `;
}

function createPostCard(post) {
  const article = document.createElement("article");
  article.className = "post-card new-post";
  article.dataset.postId = post.id;
  article.dataset.authorId = post.authorId;
  article.dataset.createdAt = post.createdAt || "";
  article.innerHTML = createPostMarkup(post);
  return article;
}

function animateScoreBars(root = document) {
  root.querySelectorAll(".score-fill").forEach((bar) => {
    bar.style.width = `${bar.dataset.score || 0}%`;
  });
}

function getVisibleFeedPosts() {
  if (state.activeFilter === "new") return state.feed.filter((post) => isRecentPost(post.createdAt));
  return state.feed;
}

function renderLeaderBoard() {
  if (!dom.leaderList) return;
  const topPosts = [...state.feed]
    .sort((left, right) => Number(right.finalScore || 0) - Number(left.finalScore || 0))
    .slice(0, 3);
  if (!topPosts.length) {
    dom.leaderList.innerHTML = '<li class="empty-list">投稿が増えると上位スコアがここに表示されます。</li>';
    return;
  }
  dom.leaderList.innerHTML = topPosts
    .map((post) => `<li><span>${escapeHtml(post.displayName)}</span><strong>${escapeHtml(post.finalScore)}</strong></li>`)
    .join("");
}

function renderFollowingList() {
  if (!dom.followingList) return;
  if (!state.following.length) {
    dom.followingList.innerHTML = '<li class="empty-list">まだフォローしているユーザーはいません。</li>';
    return;
  }
  dom.followingList.innerHTML = state.following
    .map((user) => `<li><span>${escapeHtml(user.displayName || "User")}</span><strong>${escapeHtml(normalizeHandle(user.handle || "@user"))}</strong></li>`)
    .join("");
}

function updateFeedSummary() {
  if (!dom.feedSummary) return;
  const visibleCount = getVisibleFeedPosts().length;
  const labelMap = { all: "live", top: "top score", new: "new", mine: "my" };
  dom.feedSummary.textContent = `${visibleCount} ${labelMap[state.activeFilter] || "live"} posts`;
}

function updateTrendList() {
  if (!dom.trendList) return;
  if (!state.feed.length) {
    dom.trendList.innerHTML = '<li class="empty-list">投稿がまだないため、トレンドは集計されていません。</li>';
    return;
  }
  const rankedTags = {};
  state.feed.forEach((post) => {
    const tag = post.tag || getCaptionTag(post.finalScore || post.baseScore);
    rankedTags[tag] = (rankedTags[tag] || 0) + 1;
  });
  dom.trendList.innerHTML = Object.entries(rankedTags)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, count]) => `<li><span>#${escapeHtml(String(label).replace(/\s+/g, ""))}</span><strong>${escapeHtml(count)} posts</strong></li>`)
    .join("");
}

function updateInsights() {
  // Session Stats is intentionally based on the shared feed in state.feed.
  if (!state.feed.length) {
    if (dom.sessionPostCount) dom.sessionPostCount.textContent = "0";
    if (dom.sessionPulseAverage) dom.sessionPulseAverage.textContent = "0";
    if (dom.sessionMyPosts) dom.sessionMyPosts.textContent = "0";
    if (dom.sessionBestRank) dom.sessionBestRank.textContent = "-";
    if (dom.highlightCopy) dom.highlightCopy.textContent = "投稿がまだないため、ハイライトはありません。最初の投稿が作成されると、ここに共通フィードの傾向を表示します。";
    return;
  }
  const ranked = [...state.feed].sort((left, right) => Number(right.finalScore || 0) - Number(left.finalScore || 0));
  const pulseAverage = ranked.reduce((sum, post) => sum + Number(post.pulse || 0), 0) / ranked.length;
  const mineCount = state.feed.filter((post) => post.authorId === state.session?.accountId).length;
  if (dom.sessionPostCount) dom.sessionPostCount.textContent = String(state.feed.length);
  if (dom.sessionPulseAverage) dom.sessionPulseAverage.textContent = String(Math.round(pulseAverage));
  if (dom.sessionMyPosts) dom.sessionMyPosts.textContent = String(mineCount);
  if (dom.sessionBestRank) dom.sessionBestRank.textContent = getRankLabel(Number(ranked[0].finalScore || 0));
  if (dom.highlightCopy) dom.highlightCopy.textContent = `${ranked[0].displayName} が現在トップです。Pulse ${ranked[0].pulse}、Final Score ${ranked[0].finalScore} です。`;
}

function toggleEmptyFeedState() {
  if (!dom.emptyFeedCard) return;
  dom.emptyFeedCard.hidden = state.feed.length > 0;
}

function renderFeed(posts = state.feed) {
  dom.feedList.innerHTML = "";
  posts.forEach((post) => {
    dom.feedList.appendChild(createPostCard(post));
  });
  animateScoreBars(dom.feedList);
  updateFeedSummary();
  toggleEmptyFeedState();
  renderLeaderBoard();
  updateTrendList();
  updateInsights();
  if (dom.feedLoadMoreButton) dom.feedLoadMoreButton.hidden = !state.feedPagination.hasMore;
}

function renderProfileSection() {
  if (!dom.profileGallery) return;
  const profile = getViewerProfile();
  // Profile stats are intentionally based on profilePostsState.items only.
  const posts = isLoggedIn() ? state.profilePostsState.items : [];
  const pulseAverage = posts.length
    ? Math.round(posts.reduce((sum, post) => sum + Number(post.pulse || 0), 0) / posts.length)
    : 0;
  const savedCount = posts.reduce((sum, post) => sum + Number(post.savesCount || 0), 0);

  renderAvatarNode(dom.profileAvatar, profile, "profile-avatar-lg");
  if (dom.profileDisplayName) dom.profileDisplayName.textContent = profile.displayName;
  if (dom.profileHandle) dom.profileHandle.textContent = profile.handle;
  if (dom.profileLocation) dom.profileLocation.textContent = profile.location || DEFAULT_PROFILE.location;
  if (dom.profileBio) dom.profileBio.textContent = profile.bio || DEFAULT_PROFILE.bio;
  if (dom.profilePostCount) dom.profilePostCount.textContent = String(posts.length);
  if (dom.profileSavedCount) dom.profileSavedCount.textContent = String(savedCount);
  if (dom.profilePulseAverage) dom.profilePulseAverage.textContent = String(pulseAverage);

  dom.profileGallery.innerHTML = posts.map((post) => `
    <article class="profile-gallery-item">
      ${post.imageSrc
        ? `<img src="${escapeHtml(post.imageSrc)}" alt="${escapeHtml(post.imageAlt)}" />`
        : `<div class="media-block text-media-card"><div class="photo-overlay"><span>テキスト投稿</span><strong>${escapeHtml((post.content || "投稿").slice(0, 20))}</strong></div></div>`}
      <div class="profile-gallery-copy">
        <span>${escapeHtml(getRelativeTime(post.createdAt))}</span>
        <strong>Pulse ${escapeHtml(post.pulse)}</strong>
      </div>
    </article>
  `).join("");

  if (dom.profileEmpty) {
    dom.profileEmpty.hidden = posts.length > 0;
    dom.profileEmpty.textContent = isLoggedIn() ? "まだ表示できる投稿がありません。" : "ログインすると自分の投稿一覧が表示されます。";
  }
  if (dom.profileLoadMoreButton) dom.profileLoadMoreButton.hidden = !state.profilePostsState.hasMore;
}

function replacePostInCollections(post) {
  const normalized = normalizePost(post);
  state.feed = state.feed.map((item) => (item.id === normalized.id ? normalized : item));
  state.profilePostsState.items = state.profilePostsState.items.map((item) => (item.id === normalized.id ? normalized : item));
  renderFeed(state.feed);
  renderProfileSection();
}

function removePostFromCollections(postId) {
  state.feed = state.feed.filter((post) => post.id !== postId);
  state.profilePostsState.items = state.profilePostsState.items.filter((post) => post.id !== postId);
  renderFeed(state.feed);
  renderProfileSection();
}

function applyFollowResponse(targetUserId, response) {
  let resolvedFollowingState = Boolean(response?.viewerIsFollowingAuthor);
  if (Array.isArray(response?.posts) && response.posts.length) {
    const normalizedPosts = response.posts.map((post) => normalizePost(post));
    const updatedMap = new Map(normalizedPosts.map((post) => {
      if (post.authorId === targetUserId) resolvedFollowingState = post.viewerIsFollowingAuthor;
      return [post.id, post];
    }));
    state.feed = state.feed.map((post) => updatedMap.get(post.id) || post);
  } else {
    const viewerIsFollowingAuthor = Boolean(response?.viewerIsFollowingAuthor);
    resolvedFollowingState = viewerIsFollowingAuthor;
    state.feed = state.feed.map((post) => (
      post.authorId === targetUserId ? { ...post, viewerIsFollowingAuthor } : post
    ));
  }
  renderFeed(state.feed);
  return resolvedFollowingState;
}

// Feed loading and pagination
async function loadFeedPage({ filter = state.activeFilter, reset = false } = {}) {
  if (state.apiMode === "demo") {
    state.feed = [];
    state.feedPagination = { cursor: null, hasMore: false };
    renderFeed([]);
    return;
  }

  state.loadingFeed = true;
  if (dom.feedLoadMoreButton) dom.feedLoadMoreButton.disabled = true;
  const query = buildPostsQuery({
    filter,
    cursor: reset ? null : state.feedPagination.cursor,
    limit: PAGINATION_LIMIT,
  });

  try {
    const payload = await apiRequest(`${API_ENDPOINTS.posts}${query}`, { method: "GET", auth: true });
    const posts = Array.isArray(payload?.posts) ? payload.posts.map(normalizePost) : [];
    state.feed = reset ? posts : mergePosts(state.feed, posts);
    state.feedPagination = {
      cursor: payload?.nextCursor || null,
      hasMore: Boolean(payload?.nextCursor),
    };
    renderFeed(state.activeFilter === "new" ? state.feed.filter((post) => isRecentPost(post.createdAt)) : state.feed);
  } catch (error) {
    if (error.code === "API_UNAVAILABLE" || error.code === "NETWORK_ERROR") {
      state.apiMode = "demo";
      renderAppModeNotice();
      setComposerStatus("API未接続のため、共通フィードを取得できません。", "error");
      state.feed = [];
      renderFeed([]);
    } else if (error.code !== "AUTH_ERROR") {
      setComposerStatus(error.message, "error");
    }
  } finally {
    state.loadingFeed = false;
    if (dom.feedLoadMoreButton) dom.feedLoadMoreButton.disabled = false;
  }
}

async function loadProfilePostsPage({ reset = false } = {}) {
  if (!isLoggedIn() || state.apiMode !== "online") {
    state.profilePostsState = { items: [], cursor: null, hasMore: false };
    renderProfileSection();
    return;
  }

  state.loadingProfilePosts = true;
  if (dom.profileLoadMoreButton) dom.profileLoadMoreButton.disabled = true;
  try {
    const query = buildPostsQuery({
      filter: "all",
      scopeOverride: "mine",
      cursor: reset ? null : state.profilePostsState.cursor,
      limit: PAGINATION_LIMIT,
    });
    const payload = await apiRequest(`${API_ENDPOINTS.posts}${query}`, { method: "GET", auth: true });
    const posts = Array.isArray(payload?.posts) ? payload.posts.map(normalizePost) : [];
    const confirmedMine = posts.filter((post) => post.authorId === state.session?.accountId);
    state.profilePostsState = {
      items: reset ? confirmedMine : mergePosts(state.profilePostsState.items, confirmedMine),
      cursor: payload?.nextCursor || null,
      hasMore: Boolean(payload?.nextCursor),
    };
  } catch (error) {
    if (error.code !== "AUTH_ERROR") console.warn("Profile posts load failed", error);
    if (reset) state.profilePostsState = { items: [], cursor: null, hasMore: false };
  } finally {
    state.loadingProfilePosts = false;
    if (dom.profileLoadMoreButton) dom.profileLoadMoreButton.disabled = false;
    renderProfileSection();
  }
}

async function loadFollowing() {
  if (!isLoggedIn() || state.apiMode !== "online") {
    state.following = [];
    renderFollowingList();
    return;
  }
  try {
    const payload = await apiRequest(API_ENDPOINTS.following, { method: "GET", auth: true });
    state.following = Array.isArray(payload?.users) ? payload.users : [];
  } catch (error) {
    if (error.code !== "AUTH_ERROR") console.warn("Following load failed", error);
    state.following = [];
  }
  renderFollowingList();
}

async function refreshAllData() {
  await Promise.all([
    loadFeedPage({ filter: state.activeFilter, reset: true }),
    loadProfilePostsPage({ reset: true }),
    loadFollowing(),
  ]);
}

// Auth and profile actions
function buildProfileFromForm() {
  return {
    displayName: dom.signupDisplayName?.value || "",
    handle: dom.signupHandle?.value || "",
    location: dom.signupLocation?.value || "",
    bio: dom.signupBio?.value || "",
    avatarSrc: getViewerProfile().avatarSrc || "",
  };
}

async function submitRegistration(event) {
  event.preventDefault();
  if (state.submittingAuth || state.updatingProfile) return;
  if (state.apiMode !== "online") {
    setSignupStatus("API未接続のため、登録はできません。", "error");
    return;
  }

  if (isLoggedIn()) {
    await updateProfile();
    return;
  }

  const email = dom.signupEmail?.value.trim().toLowerCase() || "";
  const password = dom.signupPassword?.value || "";
  if (!email || !password || password.length < 8) {
    setSignupStatus("メールと8文字以上のパスワードを入力してください。", "error");
    return;
  }

  state.submittingAuth = true;
  updateAuthUi();
  try {
    const profile = buildProfileFromForm();
    if (state.pendingAvatarFile) {
      const uploadedAvatar = await uploadImageAsset(state.pendingAvatarFile, "avatar");
      profile.avatarSrc = uploadedAvatar.imageUrl;
    }
    const payload = await apiRequest(API_ENDPOINTS.register, {
      method: "POST",
      auth: false,
      body: { email, password, profile },
    });
    const account = normalizeAccount(payload?.account);
    saveSession({
      token: payload?.token || "",
      accountId: account.id,
      email: account.email || email,
      profile: account.profile,
    });
    state.pendingAvatarFile = null;
    if (dom.signupPassword) dom.signupPassword.value = "";
    applyProfileToUi(account.profile);
    setSignupStatus(`${account.email || email} で登録しました。`, "success");
    setComposerStatus(`${account.profile.displayName} のアカウントを作成しました。`, "success");
    await refreshAllData();
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setSignupStatus(error.message, "error");
  } finally {
    state.submittingAuth = false;
    updateAuthUi();
  }
}

async function submitLogin() {
  if (state.submittingAuth || state.updatingProfile) return;
  if (state.apiMode !== "online") {
    setSignupStatus("API未接続のため、ログインはできません。", "error");
    return;
  }
  const email = dom.signupEmail?.value.trim().toLowerCase() || "";
  const password = dom.signupPassword?.value || "";
  if (!email || !password) {
    setSignupStatus("メールアドレスとパスワードを入力してください。", "error");
    return;
  }

  state.submittingAuth = true;
  updateAuthUi();
  try {
    const payload = await apiRequest(API_ENDPOINTS.login, {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    const account = normalizeAccount(payload?.account);
    saveSession({
      token: payload?.token || "",
      accountId: account.id,
      email: account.email || email,
      profile: account.profile,
    });
    if (dom.signupPassword) dom.signupPassword.value = "";
    state.pendingAvatarFile = null;
    applyProfileToUi(account.profile);
    setSignupStatus(`${account.email || email} でログインしました。`, "success");
    await refreshAllData();
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setSignupStatus(error.message, "error");
  } finally {
    state.submittingAuth = false;
    updateAuthUi();
  }
}

async function updateProfile() {
  if (state.updatingProfile || state.submittingAuth) return;
  if (!requireAuth("プロフィール更新にはログインが必要です。")) return;
  if (state.apiMode !== "online") {
    setSignupStatus("API未接続のため、プロフィール更新はできません。", "error");
    return;
  }

  state.updatingProfile = true;
  updateAuthUi();
  try {
    const profile = buildProfileFromForm();
    if (state.pendingAvatarFile) {
      const uploadedAvatar = await uploadImageAsset(state.pendingAvatarFile, "avatar");
      profile.avatarSrc = uploadedAvatar.imageUrl;
    }
    const payload = await apiRequest(API_ENDPOINTS.profile, {
      method: "PATCH",
      auth: true,
      body: { profile },
    });
    const account = normalizeAccount(payload?.account || payload?.profile || profile);
    saveSession({
      token: state.session.token,
      accountId: state.session.accountId,
      email: state.session.email,
      profile: account.profile,
    });
    state.pendingAvatarFile = null;
    applyProfileToUi(account.profile);
    setSignupStatus("プロフィールを更新しました。", "success");
    setComposerStatus("プロフィール更新を反映しました。", "success");
    await loadFeedPage({ filter: state.activeFilter, reset: true });
    await loadProfilePostsPage({ reset: true });
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setSignupStatus(error.message, "error");
  } finally {
    state.updatingProfile = false;
    updateAuthUi();
  }
}

function submitLogout() {
  clearSession();
  state.following = [];
  state.feed = [];
  state.feedPagination = { cursor: null, hasMore: false };
  state.profilePostsState = { items: [], cursor: null, hasMore: false };
  state.pendingAvatarFile = null;
  resetUploadPreview();
  if (dom.signupEmail) dom.signupEmail.value = "";
  if (dom.signupPassword) dom.signupPassword.value = "";
  applyProfileToUi(getViewerProfile());
  renderFollowingList();
  renderFeed([]);
  renderProfileSection();
  setSignupStatus("ログアウトしました。", "success");
}

// Post and reaction actions
async function publishPost() {
  if (state.publishingPost) return;
  if (!requireAuth("投稿するにはログインしてください。")) return;
  if (state.apiMode !== "online") {
    setComposerStatus("API未接続のため、投稿できません。", "error");
    return;
  }

  const content = dom.postInput?.value.trim() || "";
  if (!content && !state.pendingPhoto) {
    dom.postInput?.focus();
    return;
  }

  state.publishingPost = true;
  updateAuthUi();
  try {
    let uploadedImage = null;
    if (state.pendingPhotoFile) {
      uploadedImage = await uploadImageAsset(state.pendingPhotoFile, "post");
    }
    const payload = {
      content: content || "写真のスコア結果をそのまま表示しています。",
      imageUrl: uploadedImage?.imageUrl || "",
      imageAlt: uploadedImage ? `${state.pendingPhoto.fileName} の投稿画像` : "",
      uploadAssetId: uploadedImage?.assetId || "",
      scoreBreakdown: state.pendingPhoto?.scoreBreakdown || null,
      baseScore: state.pendingPhoto?.scoreBreakdown?.totalScore || null,
    };
    const response = await apiRequest(API_ENDPOINTS.posts, {
      method: "POST",
      auth: true,
      body: payload,
    });
    const nextPost = normalizePost(response?.post || response);
    state.feed = [nextPost, ...state.feed.filter((post) => post.id !== nextPost.id)];
    renderFeed(state.feed);
    await loadProfilePostsPage({ reset: true });
    if (dom.postInput) dom.postInput.value = "";
    resetUploadPreview();
    setComposerStatus("投稿を公開しました。共通フィードに反映されています。", "success");
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setComposerStatus(error.message, "error");
  } finally {
    state.publishingPost = false;
    updateAuthUi();
  }
}

async function deletePost(postId) {
  if (state.deletingPostIds.has(postId)) return;
  if (!requireAuth("投稿削除にはログインが必要です。")) return;
  state.deletingPostIds.add(postId);
  try {
    await apiRequest(`${API_ENDPOINTS.posts}/${encodeURIComponent(postId)}`, {
      method: "DELETE",
      auth: true,
    });
    removePostFromCollections(postId);
    setComposerStatus("投稿を削除しました。", "success");
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setComposerStatus(error.message, "error");
  } finally {
    state.deletingPostIds.delete(postId);
  }
}

async function toggleLike(postId, currentlyLiked) {
  if (!requireAuth()) return;
  try {
    const response = await apiRequest(`${API_ENDPOINTS.posts}/${encodeURIComponent(postId)}/like`, {
      method: currentlyLiked ? "DELETE" : "POST",
      auth: true,
    });
    replacePostInCollections(response?.post || response);
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setComposerStatus(error.message, "error");
  }
}

async function toggleSave(postId, currentlySaved) {
  if (!requireAuth()) return;
  try {
    const response = await apiRequest(`${API_ENDPOINTS.posts}/${encodeURIComponent(postId)}/save`, {
      method: currentlySaved ? "DELETE" : "POST",
      auth: true,
    });
    replacePostInCollections(response?.post || response);
    await loadProfilePostsPage({ reset: true });
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setComposerStatus(error.message, "error");
  }
}

async function toggleFollow(userId, currentlyFollowing) {
  if (!requireAuth()) return;
  try {
    const response = await apiRequest(`/api/sns/users/${encodeURIComponent(userId)}/follow`, {
      method: currentlyFollowing ? "DELETE" : "POST",
      auth: true,
    });
    const viewerIsFollowingAuthor = applyFollowResponse(userId, response);
    await loadFollowing();
    setComposerStatus(viewerIsFollowingAuthor ? "フォローしました。" : "フォローを解除しました。", "success");
  } catch (error) {
    if (error.code !== "AUTH_ERROR") setComposerStatus(error.message, "error");
  }
}

// Events
function focusComposer() {
  document.querySelector(".composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => dom.postInput?.focus(), 220);
}

function bindFeedFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.activeFilter = button.dataset.filter || "all";
      document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.toggle("active-filter", chip === button));
      await loadFeedPage({ filter: state.activeFilter, reset: true });
    });
  });
}

function bindFeedActions() {
  dom.feedList?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "like") {
      const postId = button.dataset.postId || "";
      const current = state.feed.find((post) => post.id === postId);
      if (current) await toggleLike(postId, current.viewerHasLiked);
    }
    if (action === "save") {
      const postId = button.dataset.postId || "";
      const current = state.feed.find((post) => post.id === postId);
      if (current) await toggleSave(postId, current.viewerHasSaved);
    }
    if (action === "follow") {
      const userId = button.dataset.userId || "";
      const current = state.feed.find((post) => post.authorId === userId);
      if (current) await toggleFollow(userId, current.viewerIsFollowingAuthor);
    }
    if (action === "delete-post") {
      const postId = button.dataset.postId || "";
      if (postId) await deletePost(postId);
    }
  });
}

function bindUploadEvents() {
  dom.uploadTrigger?.addEventListener("click", () => dom.photoInput?.click());
  dom.signupAvatarButton?.addEventListener("click", () => dom.signupAvatarInput?.click());

  dom.signupAvatarInput?.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      state.pendingAvatarFile = file;
      state.pendingAvatarSrc = await readFileAsDataUrl(file);
      renderAvatarNode(dom.signupAvatarPreview, {
        displayName: dom.signupDisplayName?.value || DEFAULT_PROFILE.displayName,
        avatarSrc: state.pendingAvatarSrc,
      }, "signup-avatar-preview gradient-avatar");
      setSignupStatus("アイコン画像を読み込みました。保存時にアップロードします。", "success");
    } catch (error) {
      state.pendingAvatarFile = null;
      state.pendingAvatarSrc = "";
      renderAvatarNode(dom.signupAvatarPreview, getViewerProfile(), "signup-avatar-preview gradient-avatar");
      setSignupStatus(error.message, "error");
    }
  });

  dom.photoInput?.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      await preparePendingPhoto(file);
      setComposerStatus(`${file.name} を解析しました。投稿時は画像アップロード API を経由して送信します。`, "success");
    } catch (error) {
      resetUploadPreview();
      dom.uploadPreview.className = "upload-preview empty-preview";
      dom.uploadPreview.innerHTML = `<div class="upload-preview-copy"><span class="upload-label">画像エラー</span><strong>${escapeHtml(error.message)}</strong></div>`;
      setComposerStatus(error.message, "error");
    }
  });
}

function bindAuthEvents() {
  dom.signupForm?.addEventListener("submit", submitRegistration);
  dom.loginButton?.addEventListener("click", submitLogin);
  dom.logoutButton?.addEventListener("click", submitLogout);
  dom.signupDisplayName?.addEventListener("input", () => {
    renderAvatarNode(dom.signupAvatarPreview, {
      displayName: dom.signupDisplayName.value || DEFAULT_PROFILE.displayName,
      avatarSrc: state.pendingAvatarSrc,
    }, "signup-avatar-preview gradient-avatar");
  });
}

function bindComposerEvents() {
  dom.publishButton?.addEventListener("click", publishPost);
  dom.presetWide?.addEventListener("click", () => {
    if (dom.postInput) dom.postInput.value = "横写真の抜け感を活かした一枚。光の流れがきれいに見えるカット。";
  });
  dom.presetMood?.addEventListener("click", () => {
    if (dom.postInput) dom.postInput.value = "空気感を優先して、色と印象の余韻を残した投稿です。";
  });
  dom.sidebarComposeButton?.addEventListener("click", focusComposer);
  dom.emptyFeedComposeButton?.addEventListener("click", focusComposer);
  dom.feedLoadMoreButton?.addEventListener("click", () => loadFeedPage({ filter: state.activeFilter, reset: false }));
  dom.profileLoadMoreButton?.addEventListener("click", () => loadProfilePostsPage({ reset: false }));
}

// Bootstrap
async function detectApiMode() {
  const apiBase = getConfiguredSnsApiBase();
  if (!apiBase) {
    state.apiMode = "demo";
    renderAppModeNotice();
    return;
  }
  try {
    await apiRequest(`${API_ENDPOINTS.posts}${buildPostsQuery({ filter: "all", limit: 1 })}`, {
      method: "GET",
      auth: false,
      timeoutMs: 4000,
    });
    state.apiMode = "online";
  } catch (error) {
    state.apiMode = (error.code === "NETWORK_ERROR" || error.code === "API_UNAVAILABLE") ? "demo" : "online";
  }
  renderAppModeNotice();
}

async function initializeApp() {
  // Run legacy cleanup first so stale trial data never contaminates bootstrap.
  cleanupLegacyStorage();
  state.session = getCurrentSession();
  applyProfileToUi(getViewerProfile());
  bindFeedFilters();
  bindFeedActions();
  bindUploadEvents();
  bindAuthEvents();
  bindComposerEvents();
  renderFollowingList();
  renderProfileSection();
  resetUploadPreview();
  await detectApiMode();

  if (state.apiMode === "online") {
    await refreshAllData();
  } else {
    renderFeed([]);
    setComposerStatus("API未接続のため、現在はローカルデモ表示です。", "error");
  }
}

initializeApp();
