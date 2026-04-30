import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { firestoreService } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";

const DEVELOPER_UID = "naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8";

/**
 * HARU2026 — Home (Style B · 2열 그리드 기능형)
 * PWA-ready
 */

// ── Data ────────────────────────────────────────────────────────────────
type IconName = "rec" | "sayu" | "book" | "pen" | "star" | "scale" | "chart" | "globe";
type TabIconName = "home" | "list" | "sparkle" | "grid" | "gear";

type ButtonItem = {
  t: string;
  sub?: string;
  s: string;
  icon: IconName;
  kind?: "main" | "sub";
  dot?: boolean;
  href: string;
};

type TabItem = { l: string; i: TabIconName; href: string; devOnly?: boolean };

const BUTTONS: ButtonItem[] = [
  { t: "오늘 기록하기", s: "REC",      icon: "rec",   kind: "main", href: "/record" },
  { t: "SAYU", sub: "私有·사유", s: "PRIVATE", icon: "sayu", kind: "sub", href: "/sayu" },
  { t: "영어성경",      s: "BIBLE",    icon: "book",  href: "/bible" },
  { t: "영어일기",      s: "DIARY",    icon: "pen",   href: "/diary-learn" },
  { t: "HARU예언",      s: "PROPHECY", icon: "star",  href: "/record-prophecy" },
  { t: "하루LAW",       s: "LAW",      icon: "scale", href: "/record" },
  { t: "기록통계·합본", s: "STATS",    icon: "chart", href: "/stats" },
  { t: "최신외신 3편",  s: "NEWS",     icon: "globe", dot: true, href: "/news" },
];

const TABS: TabItem[] = [
  { l: "HARU",        i: "home",    href: "/" },
  { l: "기록",        i: "list",    href: "/record" },
  { l: "SAYU·다듬기", i: "sparkle", href: "/sayu" },
  { l: "핵스튜디오",  i: "grid",    href: "/book-studio", devOnly: true },
  { l: "설정",        i: "gear",    href: "/settings" },
];

// ── Page ────────────────────────────────────────────────────────────────
export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const today = formatToday();

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.devOnly || user?.uid === DEVELOPER_UID),
    [user?.uid]
  );

  const [todayFormatCount, setTodayFormatCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setTodayFormatCount(null);
      return;
    }
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    firestoreService
      .getRecords(user.uid)
      .then((records) => {
        const todayRecord = records.find((r) => r.date === todayStr);
        setTodayFormatCount(todayRecord?.formats?.length ?? 0);
      })
      .catch(() => setTodayFormatCount(0));
  }, [user?.uid]);

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
      {/* Header */}
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
              BY JOYEL
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
               stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="6" r="2.5" />
            <path d="M3 14c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
          </svg>
        </button>
      </header>

      {/* Scrollable content */}
      <section className="flex-1 flex flex-col">
        {/* Date strip */}
        <div
          className="
            mx-[18px] mb-2.5 flex items-center justify-between
            rounded-2xl bg-haru-navy px-4 py-3.5 text-white
          "
        >
          <div>
            <div className="text-[11px] font-semibold tracking-[1.4px] text-white/85">
              {today.label}
            </div>
            <div className="mt-0.5 text-[22px] font-extrabold tracking-tight text-white">
              {today.kr}
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10.5px] font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-haru-main" />
            {todayFormatCount ?? 0}건
          </div>
        </div>

        {/* Catchphrase */}
        <div
          className="
            mx-[18px] mb-3 rounded-xl border border-haru-navy/10 bg-white
            px-4 py-3 text-center text-[15px] font-medium tracking-tight
            text-haru-navy/60 shadow-[0_4px_12px_-8px_rgba(26,60,110,0.15)]
          "
        >
          간편하게,{" "}
          <span className="font-extrabold text-haru-navy">쓸모있게</span> 남기다
        </div>

        {/* 2x4 grid */}
        <div className="grid grid-cols-2 gap-2 px-[18px] pb-4">
          {BUTTONS.map((b, i) => (
            <Tile key={i} {...b} />
          ))}
        </div>

        {/* Spacer so the last row doesn't sit under the sticky tab bar */}
        <div className="h-2" />
      </section>

      {/* Bottom tabs — sticky, safe-area aware */}
      <nav
        aria-label="주요 메뉴"
        className="
          sticky bottom-0 z-10
          border-t border-haru-navy/10 bg-haru-tabbg/95 backdrop-blur
          pb-[env(safe-area-inset-bottom)]
        "
      >
        <ul className="flex items-stretch justify-around px-1.5 pt-2">
          {visibleTabs.map((t) => {
            const isActive =
              t.href === "/"
                ? location.pathname === "/"
                : location.pathname === t.href || location.pathname.startsWith(t.href + "/");
            return (
              <li key={t.l} className="flex-1">
                <Link
                  to={t.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`
                    relative flex w-full min-h-[44px] flex-col items-center justify-center gap-0.5
                    rounded-md px-1 pt-1 pb-2 select-none touch-manipulation
                    active:scale-95 transition-transform
                    ${isActive ? "text-haru-navy" : "text-haru-navy/55"}
                  `}
                >
                  <TabIcon name={t.i} />
                  <span
                    className={`whitespace-nowrap text-[9.5px] tracking-[0.2px]
                      ${isActive ? "font-bold" : "font-medium"}`}
                  >
                    {t.l}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-1 h-0.5 w-3.5 rounded-sm bg-haru-point" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </main>
  );
}

// ── Tile ────────────────────────────────────────────────────────────────
function Tile({
  kind, t, sub, s, icon, dot, href,
}: ButtonItem) {
  const isMain = kind === "main";
  const isSub  = kind === "sub";

  const bg =
    isMain ? "bg-haru-main text-white"
    : isSub ? "bg-haru-sub text-haru-navy"
    : "bg-white text-haru-navy border border-haru-navy/10";
  const shadow = isMain
    ? "shadow-[0_6px_14px_-8px_rgba(119,182,10,0.5)]"
    : isSub
    ? "shadow-[0_4px_10px_-8px_rgba(180,117,81,0.35)]"
    : "";
  const subText = isMain ? "text-white/70" : "text-haru-navy/55";
  const iconWrap =
    isMain ? "bg-white/20"
    : isSub ? "bg-haru-navy/10"
    : "bg-haru-navy/5";

  return (
    <Link
      to={href}
      className={`
        relative h-[88px] overflow-hidden rounded-[14px] p-3
        flex flex-col justify-between
        active:scale-[0.98] transition-transform touch-manipulation select-none
        ${bg} ${shadow}
      `}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-[7px] ${iconWrap}`}>
          <TileIcon name={icon} />
        </span>
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-haru-point" />}
      </div>

      <div className="text-left">
        <div className={`text-[9px] font-bold tracking-[1.2px] ${subText}`}>{s}</div>
        <div className="text-[13.5px] font-bold tracking-tight leading-tight">
          {t}
          {sub && (
            <span className={`ml-1 text-[10px] font-medium ${subText}`}>{sub}</span>
          )}
        </div>
      </div>
    </Link>
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

// ── Iconography ─────────────────────────────────────────────────────────
function TileIcon({ name }: { name: IconName }) {
  const s = {
    stroke: "currentColor", strokeWidth: 1.6, fill: "none",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "rec":   return <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="7" cy="7" r="3.5" fill="currentColor" /></svg>;
    case "sayu":  return <svg width="13" height="13" viewBox="0 0 14 14"><path d="M3 11V4l4 4 4-4v7" {...s} /></svg>;
    case "book":  return <svg width="13" height="13" viewBox="0 0 14 14"><path d="M3 2h6a2 2 0 012 2v8H5a2 2 0 01-2-2zM3 2v8" {...s} /></svg>;
    case "pen":   return <svg width="13" height="13" viewBox="0 0 14 14"><path d="M2 12l2-1 7-7-1-1-7 7-1 2zM9 4l1 1" {...s} /></svg>;
    case "star":  return <svg width="13" height="13" viewBox="0 0 14 14"><path d="M7 2l1.6 3.2L12 6l-2.5 2.4.6 3.4L7 10.2 3.9 11.8l.6-3.4L2 6l3.4-.8z" {...s} /></svg>;
    case "scale": return <svg width="13" height="13" viewBox="0 0 14 14"><path d="M7 2v10M3 12h8M4 5l-2 4h4zM10 5l-2 4h4zM4 5h6" {...s} /></svg>;
    case "chart": return <svg width="13" height="13" viewBox="0 0 14 14"><path d="M2 12V3M2 12h10M5 9V7M8 9V5M11 9V6" {...s} /></svg>;
    case "globe": return <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" {...s} /><path d="M2 7h10M7 2c1.6 1.6 2.5 3.2 2.5 5s-.9 3.4-2.5 5c-1.6-1.6-2.5-3.2-2.5-5s.9-3.4 2.5-5z" {...s} /></svg>;
  }
}

function TabIcon({ name }: { name: TabIconName }) {
  const s = {
    stroke: "currentColor", strokeWidth: 1.6, fill: "none",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":    return <svg width="22" height="22" viewBox="0 0 20 20"><path d="M3 9l7-6 7 6v8H3z" {...s} /></svg>;
    case "list":    return <svg width="22" height="22" viewBox="0 0 20 20"><path d="M5 5h10M5 10h10M5 15h10" {...s} /></svg>;
    case "sparkle": return <svg width="22" height="22" viewBox="0 0 20 20"><path d="M10 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" {...s} /></svg>;
    case "grid":    return <svg width="22" height="22" viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" {...s} /><rect x="11" y="3" width="6" height="6" {...s} /><rect x="3" y="11" width="6" height="6" {...s} /><rect x="11" y="11" width="6" height="6" {...s} /></svg>;
    case "gear":    return <svg width="22" height="22" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3" {...s} /><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.5 4.5l2 2M13.5 13.5l2 2M4.5 15.5l2-2M13.5 6.5l2-2" {...s} /></svg>;
  }
}

// ── Logo ────────────────────────────────────────────────────────────────
function GrapeMark({ size = 22, color = "#1A3C6E", accent }: {
  size?: number; color?: string; accent?: string;
}) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 22 26" fill={color} aria-hidden="true">
      <circle cx="6"    cy="10" r="3.6" />
      <circle cx="11"   cy="9"  r="3.6" />
      <circle cx="16"   cy="10" r="3.6" />
      <circle cx="8.5"  cy="15" r="3.6" />
      <circle cx="13.5" cy="15" r="3.6" />
      <circle cx="11"   cy="20" r="3.6" />
      <path d="M11 6 Q12 3 14 2"
            stroke={accent || color} strokeWidth="1.4"
            fill="none" strokeLinecap="round" />
    </svg>
  );
}
