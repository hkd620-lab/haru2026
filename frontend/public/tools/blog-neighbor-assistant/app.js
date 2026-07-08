// ── 상수 ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "haruBlogNeighborAssistantCandidates";

const STATUSES = ["후보", "방문함", "신청함", "답변옴", "보류", "제외"];

// 기존 데이터 호환: 새 필드 없는 레코드에 적용할 기본값
const DEFAULT_FIELDS = {
  category: "기타",
  interestLevel: "보통",
  commentStatus: "안함",
  haruIntroStatus: "미안내",
  lastVisitedAt: "",
  nextVisitAt: "",
  memo: "",
};

// 관심분야별 이웃신청 멘트 초안 (null = 이름 기반 공통 템플릿 사용)
const DRAFT_TEMPLATES = {
  AI: "안녕하세요. AI와 생활기록 관련 글을 관심 있게 보고 이웃 신청드립니다. 앞으로도 좋은 글 기대하겠습니다. 잘 부탁드립니다.",
  "일기/기록":
    "안녕하세요. 일상기록과 글쓰기에 관심이 있어 글을 잘 보고 이웃 신청드립니다. 앞으로도 편하게 읽고 싶습니다. 잘 부탁드립니다.",
  중장년:
    "안녕하세요. 중장년의 생활기록과 은퇴 후 삶에 관심이 있어 이웃 신청드립니다. 앞으로 좋은 글 함께 나누고 싶습니다. 잘 부탁드립니다.",
  건강관리:
    "안녕하세요. 생활습관과 건강기록에 관심이 있어 글을 읽고 이웃 신청드립니다. 꾸준한 기록에서 배우고 싶습니다. 잘 부탁드립니다.",
  교육: "안녕하세요. 교육과 AI 활용에 관심이 있어 글을 잘 보고 이웃 신청드립니다. 좋은 내용 앞으로도 부탁드립니다. 잘 부탁드립니다.",
  은퇴생활:
    "안녕하세요. 은퇴 후 일상과 취미 기록에 관심이 있어 이웃 신청드립니다. 편하게 서로 소통하고 싶습니다. 잘 부탁드립니다.",
  블로그마케팅:
    "안녕하세요. 블로그 운영과 마케팅에 관심이 있어 글을 보고 이웃 신청드립니다. 서로 도움이 되면 좋겠습니다. 잘 부탁드립니다.",
};

// CSV 내보내기/가져오기 필드 정의 (key: 내부 필드명, header: CSV 컬럼명)
const CSV_FIELDS = [
  { key: "displayName", header: "blogName" },
  { key: "url", header: "blogUrl" },
  { key: "category", header: "category" },
  { key: "status", header: "status" },
  { key: "interestLevel", header: "interestLevel" },
  { key: "commentStatus", header: "commentStatus" },
  { key: "haruIntroStatus", header: "haruIntroStatus" },
  { key: "lastVisitedAt", header: "lastVisitedAt" },
  { key: "nextVisitAt", header: "nextVisitAt" },
  { key: "memo", header: "memo" },
  { key: "draft", header: "message" },
  { key: "createdAt", header: "createdAt" },
  { key: "updatedAt", header: "updatedAt" },
];

// ── 상태 ────────────────────────────────────────────────────────────────────
const state = {
  candidates: loadCandidates(),
  editingId: null,
  search: "",
  statusFilter: "전체",
  categoryFilter: "전체",
  interestFilter: "전체",
  visitFilter: "전체",
};

// ── DOM 참조 ─────────────────────────────────────────────────────────────────
const elements = {
  form: document.querySelector("#candidateForm"),
  blogUrl: document.querySelector("#blogUrl"),
  displayName: document.querySelector("#displayName"),
  category: document.querySelector("#category"),
  interestLevel: document.querySelector("#interestLevel"),
  lastVisitedAt: document.querySelector("#lastVisitedAt"),
  nextVisitAt: document.querySelector("#nextVisitAt"),
  commentStatus: document.querySelector("#commentStatus"),
  haruIntroStatus: document.querySelector("#haruIntroStatus"),
  memo: document.querySelector("#memo"),
  clearFormButton: document.querySelector("#clearFormButton"),
  candidateList: document.querySelector("#candidateList"),
  candidateTemplate: document.querySelector("#candidateTemplate"),
  listCount: document.querySelector("#listCount"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  interestFilter: document.querySelector("#interestFilter"),
  visitFilter: document.querySelector("#visitFilter"),
  summaryGrid: document.querySelector("#summaryGrid"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  importCsvInput: document.querySelector("#importCsvInput"),
};

// ── 데이터 로드/저장 ─────────────────────────────────────────────────────────
function loadCandidates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    // 기존 데이터 호환: 없는 필드에 기본값 적용
    return parsed.map((c) => ({ ...DEFAULT_FIELDS, ...c }));
  } catch {
    return [];
  }
}

function saveCandidates() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.candidates));
}

// ── URL 유효성 검사 ───────────────────────────────────────────────────────────
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

// ── 멘트 초안 생성 ───────────────────────────────────────────────────────────
function buildDraft(candidate) {
  const name = candidate.displayName || "블로그";
  const category = candidate.category || "기타";
  const template = DRAFT_TEMPLATES[category];
  if (template) return template;
  // 기타 또는 매핑 없는 분야: 이름 기반 공통 멘트
  return `안녕하세요. ${name}님 블로그에서 글을 보고 관심이 생겨 이웃 신청드립니다. 앞으로도 편하게 읽고 싶습니다. 잘 부탁드립니다.`;
}

// ── 날짜 포맷 ────────────────────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return "";
  // "YYYY-MM-DD" 형태일 때 시간대 오차 방지
  const d = new Date(value.length === 10 ? value + "T12:00:00" : value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getThisWeekEnd() {
  const now = new Date();
  const diff = 6 - now.getDay(); // 0=일, 6=토 → 토요일까지 남은 일수
  const end = new Date(now);
  end.setDate(now.getDate() + diff);
  return end.toISOString().slice(0, 10);
}

// ── 후보 저장/수정 ───────────────────────────────────────────────────────────
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
  const existing = state.candidates.find((c) => c.id === state.editingId);
  const base = existing || {
    id: crypto.randomUUID(),
    createdAt: now,
    status: "후보",
  };

  const candidate = {
    ...base,
    url: normalizedUrl,
    displayName: getDefaultName(normalizedUrl, elements.displayName.value),
    category: elements.category.value,
    interestLevel: elements.interestLevel.value,
    lastVisitedAt: elements.lastVisitedAt.value,
    nextVisitAt: elements.nextVisitAt.value,
    commentStatus: elements.commentStatus.value,
    haruIntroStatus: elements.haruIntroStatus.value,
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
  // select 기본값 명시 설정 (form.reset()이 HTML selected를 복원하지만 명시적으로)
  elements.category.value = "기타";
  elements.interestLevel.value = "보통";
  elements.commentStatus.value = "안함";
  elements.haruIntroStatus.value = "미안내";
  elements.form.querySelector(".primary-button").textContent = "후보 저장";
}

// ── 상태/초안 개별 업데이트 ──────────────────────────────────────────────────
function updateStatus(id, status) {
  state.candidates = state.candidates.map((c) =>
    c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c,
  );
  saveCandidates();
  render();
}

function updateDraft(id, draft) {
  state.candidates = state.candidates.map((c) =>
    c.id === id ? { ...c, draft, updatedAt: new Date().toISOString() } : c,
  );
  saveCandidates();
}

// ── 수동 신청 기록 ───────────────────────────────────────────────────────────
function recordManualApplication(id) {
  const appliedAt = new Date().toISOString();
  const today = todayStr();
  state.candidates = state.candidates.map((c) => {
    if (c.id !== id) return c;
    const note = `수동 신청 기록: ${formatDateTime(appliedAt)}`;
    return {
      ...c,
      status: "신청함",
      appliedAt,
      lastVisitedAt: c.lastVisitedAt || today,
      memo: c.memo ? `${c.memo}\n${note}` : note,
      updatedAt: appliedAt,
    };
  });
  saveCandidates();
  render();
}

// ── 삭제 ────────────────────────────────────────────────────────────────────
function removeCandidate(id) {
  const target = state.candidates.find((c) => c.id === id);
  if (!target) return;
  const confirmed = confirm(`"${target.displayName}" 후보를 삭제할까요?`);
  if (!confirmed) return;
  state.candidates = state.candidates.filter((c) => c.id !== id);
  saveCandidates();
  render();
}

// ── 클립보드 복사 ────────────────────────────────────────────────────────────
function copyDraft(draft) {
  navigator.clipboard.writeText(draft).catch(() => {
    window.prompt("아래 멘트를 복사해 주세요.", draft);
  });
}

// ── 수정 폼 채우기 ───────────────────────────────────────────────────────────
function editCandidate(id) {
  const c = state.candidates.find((item) => item.id === id);
  if (!c) return;

  state.editingId = id;
  elements.blogUrl.value = c.url;
  elements.displayName.value = c.displayName;
  elements.category.value = c.category || "기타";
  elements.interestLevel.value = c.interestLevel || "보통";
  elements.lastVisitedAt.value = c.lastVisitedAt || "";
  elements.nextVisitAt.value = c.nextVisitAt || "";
  elements.commentStatus.value = c.commentStatus || "안함";
  elements.haruIntroStatus.value = c.haruIntroStatus || "미안내";
  elements.memo.value = c.memo || "";
  elements.form.querySelector(".primary-button").textContent = "수정 저장";
  elements.blogUrl.focus();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── 필터 ────────────────────────────────────────────────────────────────────
function matchesVisitFilter(candidate, filter) {
  if (filter === "전체") return true;
  const next = candidate.nextVisitAt;
  if (!next) return false;
  const today = todayStr();
  if (filter === "오늘") return next === today;
  if (filter === "지남") return next < today;
  if (filter === "이번주") return next >= today && next <= getThisWeekEnd();
  return true;
}

function getFilteredCandidates() {
  const term = state.search.trim().toLocaleLowerCase("ko-KR");
  return state.candidates.filter((c) => {
    if (state.statusFilter !== "전체" && c.status !== state.statusFilter) return false;
    if (state.categoryFilter !== "전체" && c.category !== state.categoryFilter) return false;
    if (state.interestFilter !== "전체" && c.interestLevel !== state.interestFilter) return false;
    if (!matchesVisitFilter(c, state.visitFilter)) return false;
    if (term) {
      const haystack = [
        c.url,
        c.displayName,
        c.category,
        c.interestLevel,
        c.commentStatus,
        c.haruIntroStatus,
        c.memo,
        c.draft,
        c.interest || "", // 기존 데이터 interest 필드도 검색 대상에 포함
      ]
        .join(" ")
        .toLocaleLowerCase("ko-KR");
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

// ── 통계 렌더링 (7개) ────────────────────────────────────────────────────────
function renderSummary() {
  const today = todayStr();
  const total = state.candidates.length;
  const applied = state.candidates.filter((c) => c.status === "신청함").length;
  const replied = state.candidates.filter((c) => c.status === "답변옴").length;
  const highInterest = state.candidates.filter(
    (c) => c.interestLevel === "높음" || c.interestLevel === "매우높음",
  ).length;
  const visitToday = state.candidates.filter((c) => c.nextVisitAt === today).length;
  const visitOverdue = state.candidates.filter(
    (c) => c.nextVisitAt && c.nextVisitAt < today,
  ).length;
  const haruLink = state.candidates.filter(
    (c) => c.haruIntroStatus === "체험링크전달",
  ).length;

  const items = [
    { label: "전체", value: total },
    { label: "신청함", value: applied },
    { label: "답변옴", value: replied },
    { label: "관심도 높음↑", value: highInterest },
    { label: "오늘 방문", value: visitToday },
    { label: "방문일 지남", value: visitOverdue },
    { label: "HARU 링크전달", value: haruLink },
  ];

  elements.summaryGrid.replaceChildren();
  items.forEach(({ label, value }) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(span, strong);
    elements.summaryGrid.append(item);
  });
}

// ── 카드 렌더링 ──────────────────────────────────────────────────────────────
function truncate(text, max = 100) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function renderCandidate(candidate) {
  const node = elements.candidateTemplate.content.firstElementChild.cloneNode(true);

  const nameEl = node.querySelector(".candidate-name");
  const urlEl = node.querySelector(".candidate-url");
  const statusSelect = node.querySelector(".status-select");
  const metaEl = node.querySelector(".candidate-meta");
  const memoEl = node.querySelector(".candidate-memo");
  const draftEl = node.querySelector(".draft-text");
  const categoryTag = node.querySelector(".category-tag");
  const interestTag = node.querySelector(".interest-tag");
  const commentTag = node.querySelector(".comment-tag");
  const haruTag = node.querySelector(".haru-tag");

  nameEl.textContent = candidate.displayName;
  urlEl.textContent = candidate.url;
  urlEl.href = candidate.url;

  // 태그
  const cat = candidate.category || "기타";
  categoryTag.textContent = cat;
  categoryTag.title = "관심분야";

  const level = candidate.interestLevel || "보통";
  interestTag.textContent = level;
  interestTag.dataset.level = level;
  interestTag.title = "관심도";

  const comment = candidate.commentStatus || "안함";
  commentTag.textContent = comment;
  commentTag.dataset.comment = comment;
  commentTag.title = "댓글 여부";

  const haru = candidate.haruIntroStatus || "미안내";
  haruTag.textContent = haru;
  haruTag.dataset.haru = haru;
  haruTag.title = "HARU 안내";

  // 메타 정보
  const today = todayStr();
  const nextStr = candidate.nextVisitAt;
  const nextLabel = nextStr
    ? `다음방문: ${formatDate(candidate.nextVisitAt)}${nextStr < today ? " ⚠" : nextStr === today ? " ★" : ""}`
    : "";

  metaEl.textContent = [
    candidate.lastVisitedAt ? `방문: ${formatDate(candidate.lastVisitedAt)}` : "",
    nextLabel,
    `저장: ${formatDateTime(candidate.createdAt)}`,
    candidate.appliedAt ? `수동신청: ${formatDateTime(candidate.appliedAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  memoEl.textContent = truncate(candidate.memo) || "메모 없음";
  draftEl.value = candidate.draft || buildDraft(candidate);

  // 상태 선택
  STATUSES.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusSelect.append(option);
  });
  statusSelect.value = candidate.status;
  statusSelect.addEventListener("change", () => updateStatus(candidate.id, statusSelect.value));

  draftEl.addEventListener("input", () => updateDraft(candidate.id, draftEl.value));

  node.querySelector(".open-button").addEventListener("click", () =>
    window.open(candidate.url, "_blank", "noopener,noreferrer"),
  );
  node.querySelector(".copy-button").addEventListener("click", () => copyDraft(draftEl.value));
  node.querySelector(".record-button").addEventListener("click", () =>
    recordManualApplication(candidate.id),
  );
  node.querySelector(".edit-button").addEventListener("click", () => editCandidate(candidate.id));
  node.querySelector(".delete-button").addEventListener("click", () =>
    removeCandidate(candidate.id),
  );

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

  candidates.forEach((c) => elements.candidateList.append(renderCandidate(c)));
}

function render() {
  renderSummary();
  renderList();
}

// ── CSV 내보내기 ─────────────────────────────────────────────────────────────
function escapeCsvCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportCsv() {
  if (state.candidates.length === 0) {
    alert("내보낼 후보가 없습니다.");
    return;
  }
  const header = CSV_FIELDS.map((f) => f.header).join(",");
  const rows = state.candidates.map((c) =>
    CSV_FIELDS.map((f) => escapeCsvCell(c[f.key])).join(","),
  );
  const content = [header, ...rows].join("\n");
  // BOM(0xFEFF) 추가로 Excel에서 한글 깨짐 방지
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blog-neighbor-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV 파싱 (RFC 4180 준수) ─────────────────────────────────────────────────
function parseCsvLine(line) {
  const result = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ── CSV 가져오기 ─────────────────────────────────────────────────────────────
function importCsv(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let text = e.target.result;
    // BOM 제거
    if (text.startsWith("﻿")) text = text.slice(1);

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      alert("데이터가 없습니다. 파일을 확인해 주세요.");
      return;
    }

    const headers = parseCsvLine(lines[0]);

    // CSV 헤더→내부 필드 역매핑 구성 (blogName→displayName, blogUrl→url, message→draft 등)
    const headerToKey = {};
    CSV_FIELDS.forEach((f) => {
      headerToKey[f.header] = f.key;
    });

    const allowedHosts = new Set(["blog.naver.com", "m.blog.naver.com"]);
    const imported = [];
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      // 헤더명→내부 키로 변환하여 row 구성
      const row = {};
      headers.forEach((h, idx) => {
        const key = headerToKey[h] || h; // 매핑 없으면 헤더명 그대로
        row[key] = cells[idx] || "";
      });

      // URL 유효성 검사
      const rawUrl = (row["url"] || "").trim();
      try {
        if (!rawUrl) throw new Error("url 없음");
        const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        const parsed = new URL(withProtocol);
        if (!allowedHosts.has(parsed.hostname.toLocaleLowerCase("en-US"))) {
          throw new Error("invalid host");
        }
        row["url"] = parsed.href;
      } catch {
        errorCount++;
        continue;
      }

      imported.push({
        ...DEFAULT_FIELDS,
        status: "후보",
        ...row,
        // id는 항상 새로 생성 (기존 ID 충돌 방지)
        id: crypto.randomUUID(),
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.updatedAt || new Date().toISOString(),
        // status가 유효한 값인지 보정
        status: STATUSES.includes(row.status) ? row.status : "후보",
      });
    }

    if (imported.length === 0) {
      alert(`가져올 항목이 없습니다. 잘못된 URL: ${errorCount}개`);
      return;
    }

    // 추가 또는 교체 선택
    const shouldAppend = confirm(
      `총 ${imported.length}개를 가져옵니다.` +
        (errorCount > 0 ? `\n잘못된 URL ${errorCount}개는 건너뜁니다.` : "") +
        `\n\n확인  →  기존 목록에 추가\n취소  →  기존을 지우고 교체`,
    );

    if (shouldAppend) {
      // 중복 URL 제외하고 앞에 추가
      const existingUrls = new Set(state.candidates.map((c) => c.url));
      const newItems = imported.filter((c) => !existingUrls.has(c.url));
      const dupCount = imported.length - newItems.length;
      state.candidates = [...newItems, ...state.candidates];
      alert(
        `${newItems.length}개 추가했습니다.` +
          (dupCount > 0 ? ` (중복 URL ${dupCount}개 건너뜀)` : ""),
      );
    } else {
      // 교체 전 한 번 더 확인
      const doReplace = confirm(
        `기존 ${state.candidates.length}개를 모두 삭제하고 ${imported.length}개로 교체합니다.\n계속하시겠습니까?`,
      );
      if (!doReplace) return;
      state.candidates = imported;
      alert(
        `${imported.length}개로 교체했습니다.` +
          (errorCount > 0 ? ` (잘못된 URL ${errorCount}개 건너뜀)` : ""),
      );
    }

    saveCandidates();
    render();
  };
  reader.readAsText(file, "utf-8");
}

// ── 이벤트 리스너 ────────────────────────────────────────────────────────────
elements.form.addEventListener("submit", upsertCandidate);
elements.clearFormButton.addEventListener("click", resetForm);

// URL 입력값이 바뀔 때마다 custom validity 초기화 (이전 검증 오류 해제)
elements.blogUrl.addEventListener("input", () => {
  elements.blogUrl.setCustomValidity("");
});

elements.searchInput.addEventListener("input", () => {
  state.search = elements.searchInput.value;
  renderList();
});

elements.statusFilter.addEventListener("change", () => {
  state.statusFilter = elements.statusFilter.value;
  renderList();
});

elements.categoryFilter.addEventListener("change", () => {
  state.categoryFilter = elements.categoryFilter.value;
  renderList();
});

elements.interestFilter.addEventListener("change", () => {
  state.interestFilter = elements.interestFilter.value;
  renderList();
});

elements.visitFilter.addEventListener("change", () => {
  state.visitFilter = elements.visitFilter.value;
  renderList();
});

elements.exportCsvButton.addEventListener("click", exportCsv);

elements.importCsvInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    importCsv(file);
    e.target.value = ""; // 같은 파일 재업로드 허용
  }
});

// ── 초기 렌더 ────────────────────────────────────────────────────────────────
render();
