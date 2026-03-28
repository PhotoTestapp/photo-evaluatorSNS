const publishButton = document.getElementById("publishButton");
const postInput = document.getElementById("postInput");
const feedList = document.getElementById("feedList");
const leaderList = document.getElementById("leaderList");
const followingList = document.getElementById("followingList");
const photoInput = document.getElementById("photoInput");
const uploadTrigger = document.getElementById("uploadTrigger");
const uploadPreview = document.getElementById("uploadPreview");
const composerStatus = document.getElementById("composerStatus");
const feedSummary = document.getElementById("feedSummary");
const trendList = document.getElementById("trendList");
const highlightCopy = document.getElementById("highlightCopy");
const sessionPostCount = document.getElementById("sessionPostCount");
const sessionPulseAverage = document.getElementById("sessionPulseAverage");
const sessionMyPosts = document.getElementById("sessionMyPosts");
const sessionBestRank = document.getElementById("sessionBestRank");
const presetWide = document.getElementById("presetWide");
const presetMood = document.getElementById("presetMood");
const sidebarComposeButton = document.getElementById("sidebarComposeButton");
const emptyFeedCard = document.getElementById("emptyFeedCard");
const emptyFeedComposeButton = document.getElementById("emptyFeedComposeButton");
const signupForm = document.getElementById("signupForm");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupDisplayName = document.getElementById("signupDisplayName");
const signupHandle = document.getElementById("signupHandle");
const signupLocation = document.getElementById("signupLocation");
const signupBio = document.getElementById("signupBio");
const signupAvatarInput = document.getElementById("signupAvatarInput");
const signupAvatarButton = document.getElementById("signupAvatarButton");
const signupAvatarPreview = document.getElementById("signupAvatarPreview");
const signupStatus = document.getElementById("signupStatus");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const composerAvatar = document.getElementById("composerAvatar");
const profileAvatar = document.getElementById("profileAvatar");
const profileDisplayName = document.getElementById("profileDisplayName");
const profileHandle = document.getElementById("profileHandle");
const profileLocationDisplay = document.getElementById("profileLocation");
const profileBio = document.getElementById("profileBio");
const profilePostCount = document.getElementById("profilePostCount");
const profileSavedCount = document.getElementById("profileSavedCount");
const profilePulseAverage = document.getElementById("profilePulseAverage");
const profileGallery = document.getElementById("profileGallery");
const profileEmpty = document.getElementById("profileEmpty");
const snsApiBaseMeta = document.querySelector('meta[name="pulse-sns-api-base"]');

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
  anonymousUserId: "photo_eval_anonymous_user_id",
  snsFeedState: "pulse_sns_feed_state_v2",
  snsProfile: "pulse_sns_profile_v1",
  snsFollows: "pulse_sns_follow_state_v1",
  snsAccounts: "pulse_sns_accounts_v1",
  snsSession: "pulse_sns_session_v1",
  snsApiBase: "pulse_sns_api_base",
};

const DEFAULT_PROFILE = {
  displayName: "Seiya Harada",
  handle: "@seiya",
  location: "Japan",
  bio: "写真とUIのあいだを記録するアカウント。光の流れ、制作途中、街の温度を中心に投稿。",
  avatarSrc: "",
};

let pendingPhoto = null;
let pendingAvatarSrc = "";
let activeFilter = "all";

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

function generateAnonymousUserId() {
  if (window.crypto?.randomUUID) return `anon_${window.crypto.randomUUID()}`;
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getAnonymousUserId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.anonymousUserId);
    if (stored && /^anon_[a-z0-9-]+$/i.test(stored)) return stored;
    const nextId = generateAnonymousUserId();
    localStorage.setItem(STORAGE_KEYS.anonymousUserId, nextId);
    return nextId;
  } catch (error) {
    console.warn("Anonymous user ID storage unavailable", error);
    return generateAnonymousUserId();
  }
}

function normalizeHandle(handle) {
  const raw = (handle || "").trim().replace(/\s+/g, "");
  if (!raw) return DEFAULT_PROFILE.handle;
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function getConfiguredSnsApiBase() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.snsApiBase);
    if (stored && /^https?:\/\//i.test(stored)) return stored.replace(/\/+$/, "");
  } catch (error) {
    console.warn("SNS API base storage unavailable", error);
  }
  const metaValue = snsApiBaseMeta?.getAttribute("content")?.trim() || "";
  if (metaValue && /^https?:\/\//i.test(metaValue)) return metaValue.replace(/\/+$/, "");
  if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return window.location.origin;
  return "";
}

async function apiRequest(path, options = {}) {
  const apiBase = getConfiguredSnsApiBase();
  if (!apiBase) throw new Error("SNS API が未設定です");
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || "SNS API request failed");
  }
  return payload;
}

function getProfileInitials(displayName) {
  const name = (displayName || DEFAULT_PROFILE.displayName).trim();
  if (!name) return "PU";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function getRegisteredProfile() {
  const session = getCurrentSession();
  if (session?.profile) {
    return {
      displayName: session.profile.displayName || DEFAULT_PROFILE.displayName,
      handle: normalizeHandle(session.profile.handle || DEFAULT_PROFILE.handle),
      location: session.profile.location || DEFAULT_PROFILE.location,
      bio: session.profile.bio || DEFAULT_PROFILE.bio,
      avatarSrc: session.profile.avatarSrc || "",
    };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.snsProfile) || "{}");
    return {
      displayName: parsed.displayName || DEFAULT_PROFILE.displayName,
      handle: normalizeHandle(parsed.handle || DEFAULT_PROFILE.handle),
      location: parsed.location || DEFAULT_PROFILE.location,
      bio: parsed.bio || DEFAULT_PROFILE.bio,
      avatarSrc: parsed.avatarSrc || "",
    };
  } catch (error) {
    console.warn("Profile restore failed", error);
    return { ...DEFAULT_PROFILE };
  }
}

function saveRegisteredProfile(profile) {
  const nextProfile = {
    displayName: profile.displayName?.trim() || DEFAULT_PROFILE.displayName,
    handle: normalizeHandle(profile.handle || DEFAULT_PROFILE.handle),
    location: profile.location?.trim() || DEFAULT_PROFILE.location,
    bio: profile.bio?.trim() || DEFAULT_PROFILE.bio,
    avatarSrc: profile.avatarSrc || "",
  };
  try {
    localStorage.setItem(STORAGE_KEYS.snsProfile, JSON.stringify(nextProfile));
  } catch (error) {
    console.warn("Profile save failed", error);
  }
  const session = getCurrentSession();
  if (session) {
    session.profile = { ...nextProfile };
    saveSession(session);
    updateStoredAccount(session.accountId, { profile: session.profile });
  }
  return nextProfile;
}

function getAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.snsAccounts) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Account restore failed", error);
    return [];
  }
}

function saveAccounts(accounts) {
  try {
    localStorage.setItem(STORAGE_KEYS.snsAccounts, JSON.stringify(accounts));
  } catch (error) {
    console.warn("Account save failed", error);
  }
}

function saveAccountSnapshot(account) {
  if (!account) return;
  const accounts = getAccounts();
  const next = accounts.some((item) => item.id === account.id)
    ? accounts.map((item) => (item.id === account.id ? { ...item, ...account } : item))
    : [...accounts, account];
  saveAccounts(next);
}

function getCurrentSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.snsSession) || "null");
  } catch (error) {
    console.warn("Session restore failed", error);
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(STORAGE_KEYS.snsSession, JSON.stringify(session));
  } catch (error) {
    console.warn("Session save failed", error);
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.snsSession);
  } catch (error) {
    console.warn("Session clear failed", error);
  }
}

function updateStoredAccount(accountId, patch) {
  const accounts = getAccounts();
  const nextAccounts = accounts.map((account) => (
    account.id === accountId ? { ...account, ...patch } : account
  ));
  saveAccounts(nextAccounts);
}

function getFollowState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.snsFollows) || "{}");
  } catch (error) {
    console.warn("Follow restore failed", error);
    return {};
  }
}

function saveFollowState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.snsFollows, JSON.stringify(state));
  } catch (error) {
    console.warn("Follow save failed", error);
  }
}

function isFollowing(handle) {
  return Boolean(getFollowState()[normalizeHandle(handle)]);
}

function setFollowing(user, following) {
  const state = getFollowState();
  const handle = normalizeHandle(user.handle);
  if (following) {
    state[handle] = {
      handle,
      displayName: user.displayName || handle.replace(/^@/, ""),
    };
  } else {
    delete state[handle];
  }
  saveFollowState(state);
}

function fillSignupForm(profile) {
  const session = getCurrentSession();
  if (signupEmail) signupEmail.value = session?.email || "";
  if (signupPassword) signupPassword.value = session ? session.password || "" : "";
  if (signupDisplayName) signupDisplayName.value = profile.displayName;
  if (signupHandle) signupHandle.value = profile.handle;
  if (signupLocation) signupLocation.value = profile.location;
  if (signupBio) signupBio.value = profile.bio;
  pendingAvatarSrc = profile.avatarSrc || "";
  renderAvatarNode(signupAvatarPreview, profile, "signup-avatar-preview gradient-avatar");
}

function applyProfileToUi(profile = getRegisteredProfile()) {
  renderAvatarNode(composerAvatar, profile, "avatar gradient-avatar");
  fillSignupForm(profile);
  const session = getCurrentSession();
  if (signupStatus) {
    signupStatus.textContent = session
      ? `${session.email} でログイン中です。`
      : "未ログインです。登録するとアカウント状態がこのブラウザに保存されます。";
  }
  if (logoutButton) logoutButton.hidden = !session;
  renderProfileSection();
}

function renderProfileSection() {
  if (!profileGallery) return;
  const profile = getRegisteredProfile();
  const session = getCurrentSession();
  const ownAnonymousUserId = getAnonymousUserId();
  const posts = restoreFeedStateSnapshot().filter((post) => {
    if (session?.accountId && post.accountId) return post.accountId === session.accountId;
    if (ownAnonymousUserId && post.anonymousUserId) return post.anonymousUserId === ownAnonymousUserId;
    return normalizeHandle(post.handle || profile.handle) === normalizeHandle(profile.handle);
  });
  const pulseAverage = posts.length
    ? Math.round(posts.reduce((sum, post) => sum + Number(post.pulse || 0), 0) / posts.length)
    : 0;
  const savedCount = posts.filter((post) => post.saved).length;

  renderAvatarNode(profileAvatar, profile, "profile-avatar-lg");
  if (profileDisplayName) profileDisplayName.textContent = profile.displayName;
  if (profileHandle) profileHandle.textContent = profile.handle;
  if (profileLocationDisplay) profileLocationDisplay.textContent = profile.location || "Japan";
  if (profileBio) profileBio.textContent = profile.bio;
  if (profilePostCount) profilePostCount.textContent = String(posts.length);
  if (profileSavedCount) profileSavedCount.textContent = String(savedCount);
  if (profilePulseAverage) profilePulseAverage.textContent = String(pulseAverage);

  profileGallery.innerHTML = posts.map((post) => `
    <article class="profile-gallery-item">
      ${post.imageSrc
        ? `<img src="${post.imageSrc}" alt="${post.imageAlt || "投稿写真"}" />`
        : `<div class="media-block text-media-card"><div class="photo-overlay"><span>Text Drop</span><strong>${(post.content || "投稿").slice(0, 20)}</strong></div></div>`}
      <div class="profile-gallery-copy">
        <span>${post.saved ? "Saved" : "Posted"}</span>
        <strong>Pulse ${post.pulse || 0}</strong>
      </div>
    </article>
  `).join("");

  if (profileEmpty) profileEmpty.hidden = posts.length > 0;
}

function restoreFeedStateSnapshot() {
  try {
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEYS.snsFeedState) || "[]");
    return Array.isArray(posts) ? posts : [];
  } catch (error) {
    console.warn("Feed state snapshot restore failed", error);
    return [];
  }
}

function getRankLabel(score) {
  if (score >= 95) return "Legend";
  if (score >= 90) return "Elite";
  if (score >= 80) return "Strong";
  if (score >= 65) return "Rising";
  return "Fresh";
}

function getScorePillClass(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  return "";
}

function getRelativeTime(ageHours) {
  if (ageHours < 1) return `${Math.max(1, Math.round(ageHours * 60))}分前`;
  if (ageHours < 24) return `${ageHours.toFixed(1)}時間前`;
  return `${Math.round(ageHours / 24)}日前`;
}

function getCaptionTag(score) {
  if (score >= 92) return "Editor Pick";
  if (score >= 84) return "Trending";
  if (score >= 72) return "Rising";
  return "Fresh Drop";
}

function calculatePulseScore({ likes, saves, ageHours, likeWeight }) {
  const engagement = likes * 1.15 + saves * 1.8;
  const velocity = Math.min(1.1, Math.log10(engagement + 1) / Math.max(0.8, Math.log10(ageHours + 2)));
  const timeDecay = Math.max(0.7, 1 - ageHours * 0.03);
  const rawPulse = (normalize(likes, 0, 80) * 54 + normalize(saves, 0, 40) * 26 + normalize(velocity, 0.15, 1) * 20) * timeDecay;
  return clamp(Math.round(rawPulse * (0.9 + likeWeight)), 18, 96);
}

function calculateCommunityScore(baseScore, likes, saves, likeWeight, ageHours) {
  const pulse = calculatePulseScore({ likes, saves, ageHours, likeWeight });
  const total = clamp(Math.round(baseScore * 0.74 + pulse * 0.26), 0, 99);
  return { pulse, total };
}

function getPostCards() {
  return Array.from(feedList.querySelectorAll(".post-card"));
}

function getVisiblePosts() {
  return getPostCards().filter((post) => !post.classList.contains("hidden-post"));
}

function getPostDisplayName(postCard) {
  return postCard.querySelector(".post-meta strong")?.textContent?.trim() || "Unknown";
}

function focusComposer() {
  document.querySelector(".composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => postInput?.focus(), 220);
}

function toggleEmptyFeedState() {
  if (emptyFeedCard) emptyFeedCard.hidden = getPostCards().length > 0;
}

function summarizeScores(scoreValues) {
  const normalized = scoreValues.map((value, index) => ({ label: SCORE_KEYS[index], value: Number(value || 0) }));
  normalized.sort((left, right) => right.value - left.value);
  const [first, second] = normalized;
  return `${first.label}${second ? `・${second.label}` : ""}が強い投稿です。`;
}

function buildScoreMarkup(scores) {
  return scores.map((score, index) => `
    <div class="score-item">
      <span>${SCORE_KEYS[index]}</span>
      <strong>${score}</strong>
      <div class="score-track"><div class="score-fill" data-score="${score}"></div></div>
    </div>
  `).join("");
}

function refreshPostScore(postCard) {
  if (!postCard) return;
  const baseScore = Number(postCard.dataset.baseScore || "0");
  const likeWeight = Number(postCard.dataset.likeWeight || "0.04");
  const ageHours = Number(postCard.dataset.ageHours || "0.2");
  const likes = Number(postCard.querySelector(".like-button")?.dataset.count || "0");
  const saves = postCard.querySelector(".saved-action") ? 1 : 0;
  const { pulse, total } = calculateCommunityScore(baseScore, likes, saves, likeWeight, ageHours);

  const totalScoreNode = postCard.querySelector("[data-total-score]");
  const pulseNode = postCard.querySelector("[data-pulse-score-label]");
  const rankNode = postCard.querySelector("[data-rank-label]");
  const ageNode = postCard.querySelector("[data-age-label]");
  const ageCopy = postCard.querySelector("[data-age-copy]");
  const saveNode = postCard.querySelector("[data-save-count-label]");
  const likeNode = postCard.querySelector("[data-like-count-label]");

  if (totalScoreNode) {
    totalScoreNode.textContent = String(total);
    totalScoreNode.classList.remove("excellent", "strong");
    const pillClass = getScorePillClass(total);
    if (pillClass) totalScoreNode.classList.add(pillClass);
  }
  if (pulseNode) pulseNode.textContent = String(pulse);
  if (rankNode) rankNode.textContent = getRankLabel(total);
  if (ageNode) ageNode.textContent = `${ageHours.toFixed(1)}h`;
  if (ageCopy) ageCopy.textContent = getRelativeTime(ageHours);
  if (saveNode) saveNode.textContent = String(saves);
  if (likeNode) likeNode.textContent = String(likes);

  postCard.dataset.totalScore = String(total);
}

function sortFeedByScore() {
  getPostCards()
    .sort((left, right) => Number(right.dataset.totalScore || "0") - Number(left.dataset.totalScore || "0"))
    .forEach((post) => feedList.appendChild(post));
}

function renderLeaderBoard() {
  if (!leaderList) return;
  const topPosts = [...getPostCards()]
    .sort((left, right) => Number(right.dataset.totalScore || "0") - Number(left.dataset.totalScore || "0"))
    .slice(0, 3);
  if (!topPosts.length) {
    leaderList.innerHTML = '<li class="empty-list">投稿が増えると上位スコアがここに表示されます。</li>';
    return;
  }
  leaderList.innerHTML = topPosts
    .map((post) => `<li><span>${getPostDisplayName(post)}</span><strong>${Number(post.dataset.totalScore || "0")}</strong></li>`)
    .join("");
}

function renderFollowingList() {
  if (!followingList) return;
  const followed = Object.values(getFollowState());
  if (!followed.length) {
    followingList.innerHTML = '<li class="empty-list">まだフォローしているユーザーはいません。</li>';
    return;
  }
  followingList.innerHTML = followed
    .map((user) => `<li><span>${user.displayName}</span><strong>${user.handle}</strong></li>`)
    .join("");
}

function updateFeedSummary() {
  if (!feedSummary) return;
  const visibleCount = getVisiblePosts().length;
  const labelMap = { all: "all", top: "top score", new: "new", mine: "my" };
  feedSummary.textContent = `${visibleCount} ${labelMap[activeFilter] || "live"} posts`;
}

function applyFeedFilter() {
  const myUserId = getAnonymousUserId();
  getPostCards().forEach((post) => {
    const isMine = post.dataset.anonymousUserId === myUserId;
    const total = Number(post.dataset.totalScore || post.dataset.baseScore || "0");
    const ageHours = Number(post.dataset.ageHours || "0");
    let visible = true;
    if (activeFilter === "top") visible = total >= 88;
    if (activeFilter === "new") visible = ageHours <= 6;
    if (activeFilter === "mine") visible = isMine;
    post.classList.toggle("hidden-post", !visible);
  });
  updateFeedSummary();
}

function updateTrendList() {
  if (!trendList) return;
  const posts = getPostCards();
  if (!posts.length) {
    trendList.innerHTML = '<li class="empty-list">投稿がまだないため、トレンドは集計されていません。</li>';
    return;
  }
  const rankedTags = {};
  posts.forEach((post) => {
    const score = Number(post.dataset.totalScore || post.dataset.baseScore || "0");
    const tag = post.querySelector(".micro-tag")?.textContent || getCaptionTag(score);
    rankedTags[tag] = (rankedTags[tag] || 0) + 1;
  });
  trendList.innerHTML = Object.entries(rankedTags)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, count]) => `<li><span>#${String(label).replace(/\s+/g, "")}</span><strong>${count} posts</strong></li>`)
    .join("");
}

function updateInsights() {
  const posts = getPostCards();
  if (!posts.length) {
    if (sessionPostCount) sessionPostCount.textContent = "0";
    if (sessionPulseAverage) sessionPulseAverage.textContent = "0";
    if (sessionMyPosts) sessionMyPosts.textContent = "0";
    if (sessionBestRank) sessionBestRank.textContent = "-";
    if (highlightCopy) {
      highlightCopy.textContent = "投稿がまだないため、ハイライトはありません。最初の写真を公開すると、反応傾向をここで確認できます。";
    }
    updateTrendList();
    renderFollowingList();
    toggleEmptyFeedState();
    return;
  }

  const ranked = [...posts].sort((left, right) => Number(right.dataset.totalScore || "0") - Number(left.dataset.totalScore || "0"));
  const pulseAverage = ranked.reduce((sum, post) => sum + Number(post.querySelector("[data-pulse-score-label]")?.textContent || "0"), 0) / ranked.length;
  const mineCount = posts.filter((post) => post.dataset.anonymousUserId === getAnonymousUserId()).length;
  if (sessionPostCount) sessionPostCount.textContent = String(posts.length);
  if (sessionPulseAverage) sessionPulseAverage.textContent = String(Math.round(pulseAverage));
  if (sessionMyPosts) sessionMyPosts.textContent = String(mineCount);
  if (sessionBestRank) sessionBestRank.textContent = getRankLabel(Number(ranked[0].dataset.totalScore || "0"));
  if (highlightCopy) {
    highlightCopy.textContent = `${getPostDisplayName(ranked[0])} が現在トップです。Pulse ${ranked[0].querySelector("[data-pulse-score-label]")?.textContent || "0"} で、スコアの高い軸がそのまま見える状態です。`;
  }
  updateTrendList();
  renderFollowingList();
  toggleEmptyFeedState();
}

function bindFeedFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "all";
      document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.toggle("active-filter", chip === button));
      applyFeedFilter();
    });
  });
}

function bindLikeButtons(root = document) {
  root.querySelectorAll(".like-button").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const currentCount = Number(button.dataset.count || "0");
      const liked = button.classList.toggle("liked");
      const nextCount = liked ? currentCount + 1 : Math.max(0, currentCount - 1);
      button.dataset.count = String(nextCount);
      button.textContent = `${nextCount} Likes`;
      refreshPostScore(button.closest(".post-card"));
      sortFeedByScore();
      renderLeaderBoard();
      updateInsights();
      persistFeedState();
    });
  });
}

function bindActions(root = document) {
  root.querySelectorAll(".follow-toggle").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const handle = button.dataset.handle || "";
      const displayName = button.dataset.displayName || handle.replace(/^@/, "");
      const nextFollowing = !button.classList.contains("following-action");
      setFollowing({ handle, displayName }, nextFollowing);
      button.classList.toggle("following-action", nextFollowing);
      button.textContent = nextFollowing ? "Following" : "Follow";
      renderFollowingList();
      if (composerStatus) composerStatus.textContent = nextFollowing
        ? `${displayName} をフォローしました。`
        : `${displayName} のフォローを解除しました。`;
    });
  });

  root.querySelectorAll(".save-toggle").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      button.classList.toggle("saved-action");
      button.textContent = button.classList.contains("saved-action") ? "Saved" : "Save";
      refreshPostScore(button.closest(".post-card"));
      updateInsights();
      persistFeedState();
    });
  });
}

function animateScoreBars(root = document) {
  root.querySelectorAll(".score-fill").forEach((bar) => {
    bar.style.width = `${bar.dataset.score || 0}%`;
  });
  root.querySelectorAll(".post-card").forEach((postCard) => refreshPostScore(postCard));
  sortFeedByScore();
  renderLeaderBoard();
  applyFeedFilter();
}

function generateScores() {
  const scores = Array.from({ length: 6 }, () => 78 + Math.floor(Math.random() * 20));
  const average = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  return { scores, average };
}

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
    edgeBands: bands,
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
    reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像プレビューの生成に失敗しました"));
    image.src = src;
  });
}

function buildMetricsFromImage(image) {
  const maxSide = 240;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(24, Math.round(image.naturalWidth * scale));
  const height = Math.max(24, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("画像解析の初期化に失敗しました");
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
    edgeBands: spatial.edgeBands,
  };
}

function renderUploadPreview(dataUrl, totalScore, caption = "写真を解析しました") {
  uploadPreview.classList.remove("empty-preview");
  uploadPreview.innerHTML = `
    <img src="${dataUrl}" alt="アップロードした写真のプレビュー" />
    <div class="upload-preview-info">
      <span class="upload-label">Live Score</span>
      <strong>${totalScore} / 100</strong>
      <p>${caption}</p>
    </div>
  `;
}

async function preparePendingPhoto(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const metrics = buildMetricsFromImage(image);
  const scores = deriveScoresFromMetrics(metrics);
  pendingPhoto = { dataUrl, fileName: file.name, scores };
  renderUploadPreview(dataUrl, scores.totalScore, `${file.name} を解析してスコア化しました`);
}

function createPostMarkup(post) {
  const scoreValues = post.scoreValues || generateScores().scores;
  const rankLabel = getRankLabel(Number(post.baseScore || 0));
  const pulse = Number(post.pulse || 18);
  const isMine = post.anonymousUserId === getAnonymousUserId();
  const followLabel = isFollowing(post.handle || "") ? "Following" : "Follow";
  const avatarMarkup = buildAvatarMarkup({
    displayName: post.displayName || "You",
    avatarSrc: post.avatarSrc || "",
  });
  return `
    <div class="post-header">
      <div class="post-meta">
        <div class="post-author-main">
          ${avatarMarkup}
          <div>
            <strong>${post.displayName || "You"}</strong>
            <p class="post-meta-line"><span>${post.handle || "@seiya"}</span><span data-age-copy>${getRelativeTime(Number(post.ageHours || 0.2))}</span><span class="micro-tag">${post.tag || getCaptionTag(Number(post.baseScore || 0))}</span></p>
          </div>
        </div>
        <div class="post-author-actions">
          <a class="chip" href="#profile">Profile</a>
          ${isMine ? "" : `<button class="chip follow-toggle ${followLabel === "Following" ? "following-action" : ""}" type="button" data-handle="${post.handle || "@seiya"}" data-display-name="${post.displayName || "User"}">${followLabel}</button>`}
        </div>
      </div>
      <div class="score-head">
        <span class="score-pill ${getScorePillClass(Number(post.baseScore || 0))} total-score" data-total-score>${Number(post.baseScore || 0)}</span>
        <span class="tag">${post.badge || "New"}</span>
      </div>
    </div>
    ${post.imageSrc ? `
    <div class="media-block">
      <img src="${post.imageSrc}" alt="${post.imageAlt || "投稿写真"}" class="post-uploaded-image" />
      <div class="photo-overlay">
        <span>Live Score</span>
        <strong>${post.overlayTitle || "New Post"}</strong>
      </div>
    </div>` : `
    <div class="media-block text-media-card">
      <div class="photo-overlay">
        <span>Text Drop</span>
        <strong>${post.overlayTitle || "Thought Post"}</strong>
      </div>
    </div>`}
    <p class="post-body"></p>
    <div class="score-summary">
      <div class="score-summary-card"><span>AI Score</span><strong data-base-score-label>${Number(post.baseScore || 0)}</strong></div>
      <div class="score-summary-card"><span>Pulse</span><strong data-pulse-score-label>${pulse}</strong></div>
      <div class="score-summary-card"><span>Final Rank</span><strong data-rank-label>${rankLabel}</strong></div>
    </div>
    <div class="engagement-panel">
      <div class="engagement-stats">
        <span>Likes <strong data-like-count-label>${Number(post.likes || 0)}</strong></span>
        <span>Saved <strong data-save-count-label>${post.saved ? 1 : 0}</strong></span>
        <span>Posted <strong data-age-label>${Number(post.ageHours || 0).toFixed(1)}h</strong></span>
      </div>
    </div>
    <div class="score-grid">${buildScoreMarkup(scoreValues)}</div>
    <div class="post-actions">
      <button class="action-button like-button" data-count="${Number(post.likes || 0)}">${Number(post.likes || 0)} Likes</button>
      <a class="action-button" href="#profile">Profile</a>
      <button class="action-button save-toggle ${post.saved ? "saved-action" : ""}" type="button">${post.saved ? "Saved" : "Save"}</button>
    </div>
    <div class="comment-preview">
      <div class="comment-preview-head">
        <strong>Score memo</strong>
        <span>${post.noteLabel || "Visible by default"}</span>
      </div>
      <p>${summarizeScores(scoreValues)}</p>
    </div>
  `;
}

function createPostCard(content, photoState) {
  const profile = getRegisteredProfile();
  const fallbackScores = generateScores();
  const average = photoState?.scores?.totalScore ?? fallbackScores.average;
  const scoreValues = photoState ? SCORE_VALUE_KEYS.map((key) => photoState.scores[key]) : fallbackScores.scores;
  const article = document.createElement("article");
  article.className = "post-card new-post";
  article.dataset.postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  article.dataset.anonymousUserId = getAnonymousUserId();
  article.dataset.accountId = getCurrentSession()?.accountId || "";
  article.dataset.baseScore = String(average);
  article.dataset.likeWeight = "0.06";
  article.dataset.ageHours = "0.2";
  article.innerHTML = createPostMarkup({
    anonymousUserId: getAnonymousUserId(),
    displayName: profile.displayName,
    handle: profile.handle,
    avatarSrc: profile.avatarSrc || "",
    tag: getCaptionTag(average),
    imageSrc: photoState?.dataUrl || "",
    imageAlt: "投稿写真",
    overlayTitle: "New Post",
    baseScore: average,
    ageHours: 0.2,
    likes: 0,
    pulse: 18,
    saved: false,
    scoreValues,
  });
  article.querySelector(".post-body").textContent = content;
  return article;
}

function serializePost(postCard) {
  const image = postCard.querySelector(".post-uploaded-image");
  const scoreValues = Array.from(postCard.querySelectorAll(".score-item strong")).map((node) => Number(node.textContent || "0"));
  return {
    postId: postCard.dataset.postId || "",
    anonymousUserId: postCard.dataset.anonymousUserId || "",
    accountId: postCard.dataset.accountId || "",
    baseScore: Number(postCard.dataset.baseScore || "0"),
    likeWeight: Number(postCard.dataset.likeWeight || "0.04"),
    ageHours: Number(postCard.dataset.ageHours || "0.2"),
    content: postCard.querySelector(".post-body")?.textContent || "",
    displayName: postCard.querySelector(".post-meta strong")?.textContent || "You",
    handle: postCard.querySelector(".post-meta-line span")?.textContent || "@seiya",
    avatarSrc: postCard.querySelector(".avatar-image img")?.getAttribute("src") || "",
    tag: postCard.querySelector(".micro-tag")?.textContent || "Fresh Drop",
    imageSrc: image?.getAttribute("src") || "",
    imageAlt: image?.getAttribute("alt") || "投稿写真",
    likes: Number(postCard.querySelector(".like-button")?.dataset.count || "0"),
    pulse: Number(postCard.querySelector("[data-pulse-score-label]")?.textContent || "18"),
    saved: postCard.querySelector(".save-toggle")?.classList.contains("saved-action") || false,
    scoreValues,
  };
}

function persistFeedState() {
  try {
    const posts = getPostCards()
      .filter((post) => post.dataset.anonymousUserId === getAnonymousUserId())
      .map(serializePost);
    localStorage.setItem(STORAGE_KEYS.snsFeedState, JSON.stringify(posts));
    renderProfileSection();
  } catch (error) {
    console.warn("Feed state persistence failed", error);
  }
}

function createRestoredPost(post) {
  const article = document.createElement("article");
  article.className = "post-card new-post";
  article.dataset.postId = post.postId || `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  article.dataset.anonymousUserId = post.anonymousUserId || getAnonymousUserId();
  article.dataset.accountId = post.accountId || getCurrentSession()?.accountId || "";
  article.dataset.baseScore = String(post.baseScore || 0);
  article.dataset.likeWeight = String(post.likeWeight || 0.06);
  article.dataset.ageHours = String(post.ageHours || 0.2);
  article.innerHTML = createPostMarkup({
    anonymousUserId: post.anonymousUserId || getAnonymousUserId(),
    displayName: post.displayName || "You",
    handle: post.handle || "@seiya",
    avatarSrc: post.avatarSrc || "",
    tag: post.tag || getCaptionTag(Number(post.baseScore || 0)),
    imageSrc: post.imageSrc || "",
    imageAlt: post.imageAlt || "投稿写真",
    overlayTitle: "Saved Post",
    badge: "Saved",
    noteLabel: "Restored",
    baseScore: post.baseScore || 0,
    ageHours: post.ageHours || 0.2,
    likes: post.likes || 0,
    pulse: post.pulse || 18,
    saved: Boolean(post.saved),
    scoreValues: post.scoreValues || generateScores().scores,
  });
  article.querySelector(".post-body").textContent = post.content || "";
  return article;
}

function restorePersistedPosts() {
  try {
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEYS.snsFeedState) || "[]");
    if (!Array.isArray(posts)) return;
    posts.slice().reverse().forEach((post) => {
      const card = createRestoredPost(post);
      feedList.prepend(card);
    });
  } catch (error) {
    console.warn("Feed state restore failed", error);
  }
}

uploadTrigger?.addEventListener("click", (event) => {
  event.preventDefault();
  photoInput?.click();
});

signupAvatarButton?.addEventListener("click", () => {
  signupAvatarInput?.click();
});

signupAvatarInput?.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    pendingAvatarSrc = await readFileAsDataUrl(file);
    renderAvatarNode(signupAvatarPreview, {
      displayName: signupDisplayName?.value || DEFAULT_PROFILE.displayName,
      avatarSrc: pendingAvatarSrc,
    }, "signup-avatar-preview gradient-avatar");
    if (signupStatus) signupStatus.textContent = "アイコン画像を読み込みました。登録またはログイン状態で保存できます。";
  } catch (error) {
    pendingAvatarSrc = "";
    renderAvatarNode(signupAvatarPreview, getRegisteredProfile(), "signup-avatar-preview gradient-avatar");
    if (signupStatus) signupStatus.textContent = error.message;
  }
});

photoInput?.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    await preparePendingPhoto(file);
    if (composerStatus) composerStatus.textContent = `${file.name} を解析しました。スコアは投稿時にそのまま表示されます。`;
  } catch (error) {
    pendingPhoto = null;
    uploadPreview.className = "upload-preview empty-preview";
    uploadPreview.innerHTML = `<div class="upload-preview-copy"><span class="upload-label">Photo Error</span><strong>${error.message}</strong></div>`;
  }
});

publishButton?.addEventListener("click", () => {
  const content = postInput.value.trim();
  if (!content && !pendingPhoto) {
    postInput.focus();
    return;
  }
  const postCard = createPostCard(content || "写真のスコア結果をそのまま表示しています。", pendingPhoto);
  feedList.prepend(postCard);
  bindLikeButtons(postCard);
  bindActions(postCard);
  animateScoreBars(postCard);
  updateInsights();
  persistFeedState();
  postInput.value = "";
  photoInput.value = "";
  pendingPhoto = null;
  if (composerStatus) composerStatus.textContent = "公開しました。スコアは投稿カードにデフォルト表示されています。";
  uploadPreview.className = "upload-preview empty-preview";
  uploadPreview.innerHTML = `<div class="upload-preview-copy"><span class="upload-label">Photo Ready</span><strong>写真を選ぶとここにプレビューと実スコアが反映されます。</strong></div>`;
});

presetWide?.addEventListener("click", () => {
  postInput.value = "横写真の抜け感を活かした一枚。光の流れがきれいに見えるカット。";
});

presetMood?.addEventListener("click", () => {
  postInput.value = "空気感を優先して、色と印象の余韻を残した投稿です。";
});

sidebarComposeButton?.addEventListener("click", focusComposer);
emptyFeedComposeButton?.addEventListener("click", focusComposer);

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = signupEmail?.value.trim().toLowerCase() || "";
  const password = signupPassword?.value || "";
  if (!email || !password || password.length < 8) {
    if (signupStatus) signupStatus.textContent = "メールと8文字以上のパスワードを入力してください。";
    return;
  }
  const nextProfile = {
    displayName: signupDisplayName?.value || "",
    handle: signupHandle?.value || "",
    location: signupLocation?.value || "",
    bio: signupBio?.value || "",
    avatarSrc: pendingAvatarSrc || getRegisteredProfile().avatarSrc || "",
  };
  const apiBase = getConfiguredSnsApiBase();
  if (apiBase) {
    try {
      const response = await apiRequest("/api/sns/register", {
        body: JSON.stringify({ email, password, profile: nextProfile }),
      });
      const account = {
        ...response.account,
        password,
      };
      saveAccountSnapshot(account);
      saveRegisteredProfile(account.profile);
      saveSession({
        accountId: account.id,
        email: account.email,
        password,
        profile: account.profile,
      });
      applyProfileToUi(account.profile);
      if (signupStatus) signupStatus.textContent = response.mode === "updated" ? "プロフィールを更新しました。" : `${account.email} で登録しました。`;
      if (composerStatus) composerStatus.textContent = response.mode === "updated"
        ? `${account.profile.displayName} のプロフィールを更新しました。`
        : `${account.profile.displayName} のアカウントを作成しました。`;
      return;
    } catch (error) {
      if (signupStatus) signupStatus.textContent = error.message;
      return;
    }
  }

  const accounts = getAccounts();
  const session = getCurrentSession();
  const existingAccount = accounts.find((account) => account.email === email);
  if (existingAccount && (!session || existingAccount.id !== session.accountId)) {
    if (signupStatus) signupStatus.textContent = "このメールアドレスはすでに登録されています。ログインを使ってください。";
    return;
  }
  const savedProfile = saveRegisteredProfile(nextProfile);
  const account = existingAccount
    ? {
      ...existingAccount,
      email,
      password,
      profile: savedProfile,
    }
    : {
      id: `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      email,
      password,
      profile: savedProfile,
    };
  saveAccountSnapshot(account);
  saveSession({
    accountId: account.id,
    email: account.email,
    password: account.password,
    profile: account.profile,
  });
  applyProfileToUi(account.profile);
  if (signupStatus) signupStatus.textContent = existingAccount ? "プロフィールを更新しました。" : `${account.email} で登録しました。`;
  if (composerStatus) composerStatus.textContent = existingAccount
    ? `${account.profile.displayName} のプロフィールを更新しました。`
    : `${account.profile.displayName} のアカウントを作成しました。`;
});

loginButton?.addEventListener("click", async () => {
  const email = signupEmail?.value.trim().toLowerCase() || "";
  const password = signupPassword?.value || "";
  const apiBase = getConfiguredSnsApiBase();
  if (apiBase) {
    try {
      const response = await apiRequest("/api/sns/login", {
        body: JSON.stringify({ email, password }),
      });
      const account = {
        ...response.account,
        password,
      };
      saveAccountSnapshot(account);
      saveRegisteredProfile(account.profile);
      saveSession({
        accountId: account.id,
        email: account.email,
        password,
        profile: account.profile,
      });
      applyProfileToUi(account.profile);
      if (signupStatus) signupStatus.textContent = `${account.email} でログインしました。`;
      return;
    } catch (error) {
      if (signupStatus) signupStatus.textContent = error.message;
      return;
    }
  }
  const account = getAccounts().find((item) => item.email === email && item.password === password);
  if (!account) {
    if (signupStatus) signupStatus.textContent = "メールアドレスまたはパスワードが一致しません。";
    return;
  }
  saveSession({
    accountId: account.id,
    email: account.email,
    password: account.password,
    profile: account.profile,
  });
  applyProfileToUi(account.profile);
  if (signupStatus) signupStatus.textContent = `${account.email} でログインしました。`;
});

logoutButton?.addEventListener("click", () => {
  clearSession();
  applyProfileToUi(getRegisteredProfile());
  if (signupPassword) signupPassword.value = "";
  if (signupEmail) signupEmail.value = "";
  if (signupStatus) signupStatus.textContent = "ログアウトしました。";
});

restorePersistedPosts();
applyProfileToUi(getRegisteredProfile());
bindFeedFilters();
bindLikeButtons();
bindActions();
animateScoreBars();
updateInsights();
renderFollowingList();
renderProfileSection();

signupDisplayName?.addEventListener("input", () => {
  renderAvatarNode(signupAvatarPreview, {
    displayName: signupDisplayName.value || DEFAULT_PROFILE.displayName,
    avatarSrc: pendingAvatarSrc,
  }, "signup-avatar-preview gradient-avatar");
});
