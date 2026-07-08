const STORAGE_KEY = "haruBlogNeighborAssistantCandidates";
const STATUSES = ["후보", "방문함", "신청함", "답변옴", "보류", "제외"];

const state = {
  candidates: loadCandidates(),
  editingId: null,
  search: "",
  statusFilter: "전체",
};

const elements = {
  form: document.querySelector("#candidateForm"),
  blogUrl: document.querySelector("#blogUrl"),
  displayName: document.querySelector("#displayName"),
  interest: document.querySelector("#interest"),
  memo: document.querySelector("#memo"),
  clearFormButton: document.querySelector("#clearFormButton"),
  candidateList: document.querySelector("#candidateList"),
  candidateTemplate: document.querySelector("#candidateTemplate"),
  listCount: document.querySelector("#listCount"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  summaryGrid: document.querySelector("#summaryGrid"),
};

function loadCandidates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCandidates() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.candidates));
}

function normalizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("지원하지 않는 주소 형식입니다.");
  }

  const allowedHosts = new Set(["blog.naver.com", "m.blog.naver.com"]);
  if (!allowedHosts.has(url.hostname.toLocaleLowerCase("en-US"))) {
    throw new Error("네이버 블로그 주소만 저장할 수 있습니다.");
  }

  return url.href;
}

function getDefaultName(url, displayName) {
  const name = displayName.trim();
  if (name) return name;

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] || parsed.hostname;
  } catch {
    return url;
  }
}

function buildDraft(candidate) {
  const name = candidate.displayName || "블로그";
  const interest = candidate.interest ? ` ${candidate.interest} 관련 글을` : " 글을";
  return `안녕하세요. ${name}님 블로그에서${interest} 보고 관심이 생겨 이웃 신청드립니다. 앞으로 올라오는 기록도 편하게 읽고 싶습니다. 잘 부탁드립니다.`;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function upsertCandidate(event) {
  event.preventDefault();

  let normalizedUrl;
  try {
    normalizedUrl = normalizeUrl(elements.blogUrl.value);
  } catch {
    elements.blogUrl.setCustomValidity("blog.naver.com 주소를 입력해 주세요.");
    elements.blogUrl.reportValidity();
    return;
  }

  elements.blogUrl.setCustomValidity("");
  const now = new Date().toISOString();
  const existing = state.candidates.find((candidate) => candidate.id === state.editingId);
  const base = existing || {
    id: crypto.randomUUID(),
    createdAt: now,
    status: "후보",
  };

  const candidate = {
    ...base,
    url: normalizedUrl,
    displayName: getDefaultName(normalizedUrl, elements.displayName.value),
    interest: elements.interest.value.trim(),
    memo: elements.memo.value.trim(),
    draft: existing?.draft || "",
    updatedAt: now,
  };

  if (!candidate.draft) {
    candidate.draft = buildDraft(candidate);
  }

  if (existing) {
    state.candidates = state.candidates.map((item) => (item.id === candidate.id ? candidate : item));
  } else {
    state.candidates = [candidate, ...state.candidates];
  }

  saveCandidates();
  resetForm();
  render();
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  elements.form.querySelector(".primary-button").textContent = "후보 저장";
}

function updateStatus(id, status) {
  state.candidates = state.candidates.map((candidate) =>
    candidate.id === id ? { ...candidate, status, updatedAt: new Date().toISOString() } : candidate,
  );
  saveCandidates();
  render();
}

function updateDraft(id, draft) {
  state.candidates = state.candidates.map((candidate) =>
    candidate.id === id ? { ...candidate, draft, updatedAt: new Date().toISOString() } : candidate,
  );
  saveCandidates();
}

function recordManualApplication(id) {
  const appliedAt = new Date().toISOString();
  state.candidates = state.candidates.map((candidate) => {
    if (candidate.id !== id) return candidate;
    const note = `수동 신청 기록: ${formatDateTime(appliedAt)}`;
    return {
      ...candidate,
      status: "신청함",
      appliedAt,
      memo: candidate.memo ? `${candidate.memo}\n${note}` : note,
      updatedAt: appliedAt,
    };
  });
  saveCandidates();
  render();
}

function removeCandidate(id) {
  const target = state.candidates.find((candidate) => candidate.id === id);
  if (!target) return;
  const confirmed = confirm(`"${target.displayName}" 후보를 삭제할까요?`);
  if (!confirmed) return;

  state.candidates = state.candidates.filter((candidate) => candidate.id !== id);
  saveCandidates();
  render();
}

function copyDraft(draft) {
  navigator.clipboard.writeText(draft).catch(() => {
    window.prompt("아래 멘트를 복사해 주세요.", draft);
  });
}

function editCandidate(id) {
  const candidate = state.candidates.find((item) => item.id === id);
  if (!candidate) return;

  state.editingId = id;
  elements.blogUrl.value = candidate.url;
  elements.displayName.value = candidate.displayName;
  elements.interest.value = candidate.interest || "";
  elements.memo.value = candidate.memo || "";
  elements.form.querySelector(".primary-button").textContent = "수정 저장";
  elements.blogUrl.focus();
}

function getFilteredCandidates() {
  const term = state.search.trim().toLocaleLowerCase("ko-KR");
  return state.candidates.filter((candidate) => {
    const statusMatched = state.statusFilter === "전체" || candidate.status === state.statusFilter;
    const haystack = [candidate.url, candidate.displayName, candidate.interest, candidate.memo, candidate.draft]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    return statusMatched && (!term || haystack.includes(term));
  });
}

function renderSummary() {
  elements.summaryGrid.replaceChildren();
  STATUSES.forEach((status) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    const label = document.createElement("span");
    label.textContent = status;
    const count = document.createElement("strong");
    count.textContent = state.candidates.filter((candidate) => candidate.status === status).length;
    item.append(label, count);
    elements.summaryGrid.append(item);
  });
}

function renderStatusFilter() {
  if (elements.statusFilter.options.length > 1) return;
  STATUSES.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    elements.statusFilter.append(option);
  });
}

function renderCandidate(candidate) {
  const node = elements.candidateTemplate.content.firstElementChild.cloneNode(true);
  const name = node.querySelector(".candidate-name");
  const url = node.querySelector(".candidate-url");
  const statusSelect = node.querySelector(".status-select");
  const meta = node.querySelector(".candidate-meta");
  const memo = node.querySelector(".candidate-memo");
  const draft = node.querySelector(".draft-text");

  name.textContent = candidate.displayName;
  url.textContent = candidate.url;
  url.href = candidate.url;
  meta.textContent = [
    candidate.interest ? `관심사: ${candidate.interest}` : "",
    `저장: ${formatDateTime(candidate.createdAt)}`,
    candidate.appliedAt ? `수동 신청: ${formatDateTime(candidate.appliedAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  memo.textContent = candidate.memo || "메모 없음";
  draft.value = candidate.draft || buildDraft(candidate);

  STATUSES.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusSelect.append(option);
  });
  statusSelect.value = candidate.status;
  statusSelect.addEventListener("change", () => updateStatus(candidate.id, statusSelect.value));

  draft.addEventListener("input", () => updateDraft(candidate.id, draft.value));
  node.querySelector(".open-button").addEventListener("click", () => window.open(candidate.url, "_blank", "noopener,noreferrer"));
  node.querySelector(".copy-button").addEventListener("click", () => copyDraft(draft.value));
  node.querySelector(".record-button").addEventListener("click", () => recordManualApplication(candidate.id));
  node.querySelector(".edit-button").addEventListener("click", () => editCandidate(candidate.id));
  node.querySelector(".delete-button").addEventListener("click", () => removeCandidate(candidate.id));

  return node;
}

function renderList() {
  const candidates = getFilteredCandidates();
  elements.candidateList.replaceChildren();
  elements.listCount.textContent = `${candidates.length}개`;

  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "직접 입력한 후보가 여기에 표시됩니다.";
    elements.candidateList.append(empty);
    return;
  }

  candidates.forEach((candidate) => {
    elements.candidateList.append(renderCandidate(candidate));
  });
}

function render() {
  renderStatusFilter();
  renderSummary();
  renderList();
}

elements.form.addEventListener("submit", upsertCandidate);
elements.clearFormButton.addEventListener("click", resetForm);
elements.searchInput.addEventListener("input", () => {
  state.search = elements.searchInput.value;
  renderList();
});
elements.statusFilter.addEventListener("change", () => {
  state.statusFilter = elements.statusFilter.value;
  renderList();
});

render();
