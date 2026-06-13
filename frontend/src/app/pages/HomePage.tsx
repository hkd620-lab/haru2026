import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { firestoreService } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";
import { clearOrigin } from "../services/v2Origin";

const DEVELOPER_UID = "naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8";

// 일반 사용자 메뉴에서 숨기는 기록형식/비서 (개발자에게는 그대로 노출)
const HIDDEN_RECORD_FORMATS = new Set(["선교보고", "일반보고", "주식거래일지"]);
const HIDDEN_SECRETARY_LABELS = new Set(["주식거래일지", "영어성경"]);

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDeveloper =
    user?.uid === DEVELOPER_UID || user?.email === "hkd620@gmail.com";
  const today = formatToday();

  const [todayFormatCount, setTodayFormatCount] = useState<number | null>(null);

  // 사용자가 v1 홈에 도달했다는 건 v2 origin 트래킹을 끝내야 한다는 뜻
  useEffect(() => {
    clearOrigin();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setTodayFormatCount(null);
      return;
    }
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getDate()).padStart(2, "0")}`;
    firestoreService
      .getRecords(user.uid)
      .then((records) => {
        const todayRecord = records.find((r) => r.date === todayStr);
        setTodayFormatCount(todayRecord?.formats?.length ?? 0);
      })
      .catch(() => setTodayFormatCount(0));
  }, [user?.uid]);

  // 📕 HARU 기록 — 11개 (독서사유 포함)
  const recordCards: { label: string; format: string; icon: string }[] = [
    { icon: "📔", label: "일기", format: "일기" },
    { icon: "✍️", label: "에세이", format: "에세이" },
    { icon: "✈️", label: "여행기록", format: "여행기록" },
    { icon: "📚", label: "독서사유", format: "독서사유" },
    { icon: "🌱", label: "텃밭일지", format: "텃밭일지" },
    { icon: "🐾", label: "반려동물", format: "애완동물관찰일지" },
    { icon: "👶", label: "육아일기", format: "육아일기" },
    { icon: "⛪", label: "선교보고", format: "선교보고" },
    { icon: "📋", label: "일반보고", format: "일반보고" },
    { icon: "💼", label: "업무일지", format: "업무일지" },
    { icon: "📝", label: "메모", format: "메모" },
  ];

  // 🏛️ HARU 비서실
  const secretaryCards: {
    icon: string;
    label: string;
    path: string;
    state?: { category?: string; format?: string };
    accent?: string;
  }[] = [
    { icon: "🔮", label: "HARU미래전망", path: "/prophecy-hub" },
    { icon: "⚖️", label: "하루LAW", path: "/record", state: { category: "하루LAW" } },
    { icon: "🧾", label: "전자소송연습비서", path: "/lawsuit-practice", accent: "#b85c2e" },
    { icon: "📖", label: "영어성경", path: "/bible" },
    { icon: "✏️", label: "영어일기", path: "/diary-learn" },
    { icon: "📱", label: "SNS 가져오기", path: "/sns-records", accent: "#10b981" },
    { icon: "📈", label: "주식거래일지", path: "/record", state: { format: "주식거래일지" }, accent: "#10b981" },
  ];

  // 🔧 개발자 도구 — 4×1 그리드 (4개, 개발자만)
  const devToolCards: { icon: string; label: string; path: string }[] = [
    { icon: "🤖", label: "하루AI지식창고", path: "/admin/console" },
    { icon: "📰", label: "최신외신", path: "/news" },
    { icon: "✅", label: "배포 체크", path: "/admin/checklist" },
    { icon: "📚", label: "책 만들기", path: "/book-create" },
  ];

  const compactCardStyle: React.CSSProperties = {
    padding: "8px 6px",
    borderRadius: 8,
    border: "0.5px solid #e5e5e5",
    background: "#fff",
    color: "#1A3C6E",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 60,
    fontSize: 10,
    fontWeight: 500,
    transition: "all 0.15s",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "#1A3C6E",
    marginBottom: 8,
    letterSpacing: "0.02em",
  };

  return (
    <main
      className="
        relative flex flex-col w-full
        min-h-[100dvh]
        bg-haru-bg text-haru-navy
        pt-[env(safe-area-inset-top)]
        overscroll-none
      "
    >
      {/* Header — HARU 로고 + 설정 */}
      <header className="flex items-center justify-between px-[18px] pt-3 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-haru-navy">
            <GrapeMark size={20} color="#fff" accent="#F8C554" />
          </div>
          <div>
            <div className="text-base font-extrabold leading-none tracking-tight text-haru-navy">
              HARU
            </div>
            <div className="mt-0.5 text-[9px] font-medium tracking-[1.4px] text-haru-navy/55">
              BY 조이L허경대
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="설정"
          onClick={() => navigate("/settings")}
          className="
            flex h-11 w-11 items-center justify-center
            rounded-full bg-white border border-haru-navy/10 text-haru-navy/55
            active:scale-95 transition-transform touch-manipulation
          "
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="8" cy="6" r="2.5" />
            <path d="M3 14c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
          </svg>
        </button>
      </header>

      {/* Body */}
      <div style={{ flex: 1, padding: "0 16px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* 🌅 인사 영역 — 날짜 strip */}
          <section
            style={{
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#1A3C6E",
              color: "#fff",
              padding: "14px 18px",
              borderRadius: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "1.2px",
                  opacity: 0.85,
                }}
              >
                {today.label}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  marginTop: 2,
                }}
              >
                {today.kr}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.18)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "#10b981",
                }}
              />
              {todayFormatCount ?? 0}건
            </div>
          </section>

          {/* 캐치프레이즈 */}
          <p
            style={{
              margin: "0 0 18px 0",
              padding: "10px 14px",
              textAlign: "center",
              fontSize: 14,
              color: "#888",
              letterSpacing: "-0.01em",
              background: "#fff",
              border: "1px solid rgba(26,60,110,0.1)",
              borderRadius: 12,
              boxShadow: "0 4px 12px -8px rgba(26,60,110,0.15)",
            }}
          >
            간편하게,{" "}
            <strong style={{ color: "#1A3C6E", fontWeight: 800 }}>
              쓸모있게
            </strong>{" "}
            남기다
          </p>

          {/* 첫 기록 넛지 배너 — 오늘 기록 0건일 때만 노출 */}
          {user?.uid && todayFormatCount === 0 && (
            <button
              type="button"
              onClick={() => navigate("/record")}
              style={{
                width: "100%",
                marginBottom: 14,
                padding: "13px 16px",
                borderRadius: 12,
                border: "1.5px dashed #1A3C6E",
                background: "#EEF3FB",
                color: "#1A3C6E",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>✏️</span>
              <span>
                오늘 첫 기록을 남겨볼까요?
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 400,
                    color: "#4A6FA5",
                    marginTop: 1,
                  }}
                >
                  아래 형식 중 하나를 눌러 시작하세요
                </span>
              </span>
            </button>
          )}

          {/* 📕 HARU 기록 — 5×2 (10개) */}
          <section style={{ marginBottom: 18 }}>
            <p style={sectionLabel}>📕 HARU 기록</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 4,
              }}
            >
              {recordCards
                .filter((card) => !HIDDEN_RECORD_FORMATS.has(card.format))
                .map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() =>
                    navigate("/record", { state: { format: card.format } })
                  }
                  style={compactCardStyle}
                >
                  <span style={{ fontSize: 18 }}>{card.icon}</span>
                  <span>{card.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 🏛️ HARU 비서실 — 4×2 (7개) */}
          <section style={{ marginBottom: 18 }}>
            <p style={sectionLabel}>🏛️ HARU 비서실</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 4,
              }}
            >
              {secretaryCards
                .filter((card) => !HIDDEN_SECRETARY_LABELS.has(card.label))
                .map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() =>
                    navigate(card.path, card.state ? { state: card.state } : undefined)
                  }
                  style={{
                    ...compactCardStyle,
                    ...(card.accent ? { borderColor: card.accent } : {}),
                  }}
                >
                  <span style={{ fontSize: 18 }}>{card.icon}</span>
                  <span>{card.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 🔧 개발자 도구 — 4×1 (4개, 개발자만) */}
          {isDeveloper && (
            <section style={{ marginBottom: 18 }}>
              <p style={{ ...sectionLabel, color: "#8B4789" }}>🔧 개발자 도구</p>
              <p
                style={{
                  fontSize: 10,
                  color: "#999",
                  marginTop: -6,
                  marginBottom: 8,
                }}
              >
                허 대표님께만 보임
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 4,
                }}
              >
                {devToolCards.map((card) => (
                  <button
                    key={card.label}
                    type="button"
                    onClick={() => navigate(card.path)}
                    style={{
                      ...compactCardStyle,
                      border: "0.5px solid #d9c9e8",
                      background: "#FBF8FE",
                      color: "#5a2d7a",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{card.icon}</span>
                    <span>{card.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 📚 내 기록 서재 보기 (CTA) */}
          <button
            type="button"
            onClick={() => navigate("/library")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "none",
              background: "#1A3C6E",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px -8px rgba(26,60,110,0.4)",
            }}
          >
            📚 내 기록 서재 보기
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function formatToday() {
  const d = new Date();
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const wk = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  return {
    label: `${d.getFullYear()} · ${months[d.getMonth()]} · ${wk[d.getDay()]}`,
    kr: `${d.getMonth() + 1}월 ${d.getDate()}일`,
  };
}

function GrapeMark({
  size = 22,
  color = "#1A3C6E",
  accent,
}: {
  size?: number;
  color?: string;
  accent?: string;
}) {
  return (
    <svg
      width={size}
      height={size * 1.18}
      viewBox="0 0 22 26"
      fill={color}
      aria-hidden="true"
    >
      <circle cx="6" cy="10" r="3.6" />
      <circle cx="11" cy="9" r="3.6" />
      <circle cx="16" cy="10" r="3.6" />
      <circle cx="8.5" cy="15" r="3.6" />
      <circle cx="13.5" cy="15" r="3.6" />
      <circle cx="11" cy="20" r="3.6" />
      <path
        d="M11 6 Q12 3 14 2"
        stroke={accent || color}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
