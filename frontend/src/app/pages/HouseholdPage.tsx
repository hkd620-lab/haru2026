import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  FileUp,
  SlidersHorizontal,
  ChartNoAxesCombined,
  ListFilter,
  GitCompareArrows,
  Wallet,
  X,
  Tags,
  CheckSquare,
  PencilLine,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  firestoreService,
  type HaruRecord,
} from "../services/firestoreService";
import { parseHouseholdAmountText } from "../utils/householdAmount";
import {
  HOUSEHOLD_SUMMARY_NOTE,
  summarizeHouseholdEntries,
} from "../utils/householdSummary";
import {
  readHouseholdDashboard,
  monthRange,
  selectPeriod,
  entriesInRange,
  filterTransactions,
  monthlySummaries,
  comparisonRange,
  validRange,
  changeLabel,
  type DashboardEntry,
  type DateRange,
  type PeriodMode,
} from "../utils/householdDashboard";
import { householdLocatorKey } from "../utils/householdRecordShape";
import {
  HouseholdCashEntry,
  newHouseholdCashDraft,
  type HouseholdCashDraft,
  type HouseholdCashSaved,
} from "../components/HouseholdCashEntry";
import {
  HouseholdBulkSheet,
  HouseholdEditSheet,
} from "../components/HouseholdEditSheet";
import { HouseholdCategoryManager } from "../components/HouseholdCategoryManager";
import {
  HOUSEHOLD_EDIT_LIMITS,
  HouseholdEditConflict,
  updateHouseholdEntries,
  type HouseholdEntryPatch,
} from "../services/householdEditService";
import {
  emptyHouseholdCategories,
  isHouseholdType,
  loadHouseholdCategories,
  mergeHouseholdCategories,
  updateHouseholdCategories,
  type HouseholdCategoryAction,
  type HouseholdCategorySettings,
  type HouseholdType,
} from "../services/householdCategories";
import {
  emptyHouseholdSettingsState,
  householdSuggestionRules,
  loadHouseholdVendorRules,
  mergeLoadedHouseholdSettings,
  removeHouseholdVendorRule,
  updateHouseholdVendorRules,
  upsertHouseholdVendorRule,
  type HouseholdSettingsState,
  type HouseholdVendorRule,
} from "../services/householdVendorRules";
import "./HouseholdPage.css";
import "../components/HouseholdCategoryPicker.css";

const HOUSEHOLD_CATEGORIES = [
  "식비",
  "교통비",
  "통신비",
  "주거비",
  "공과금",
  "의료비",
  "교육비",
  "문화생활",
  "쇼핑",
  "구독료",
  "기타",
];
interface BudgetSettings {
  total: number;
  categories: Record<string, number>;
}
const money = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const rangeLabel = (range: DateRange) =>
  `${range.start.replaceAll("-", ".")} — ${range.end.replaceAll("-", ".")}`;
const signedMoney = (amount: number) =>
  `${amount > 0 ? "+" : ""}${money(amount)}`;

export function HouseholdPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeUid = useRef(user?.uid);
  activeUid.current = user?.uid;
  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"transactions" | "statistics" | "comparison">(
    "transactions",
  );
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [mode, setMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(String(today.getFullYear()));
  const [custom, setCustom] = useState<DateRange>(() =>
    monthRange(currentMonth),
  );
  const [type, setType] = useState("전체");
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(50);
  const [comparison, setComparison] = useState<"previous" | "year" | "custom">(
    "previous",
  );
  const [baseline, setBaseline] = useState<DateRange>(() =>
    comparisonRange(monthRange(currentMonth), "month", "previous"),
  );
  const [budget, setBudget] = useState<BudgetSettings>({
    total: 0,
    categories: {},
  });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetSettings>({
    total: 0,
    categories: {},
  });
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  // 아래 작성·편집 상태는 모두 소유 계정을 함께 기록하고, 현재 계정과 같을 때만 표시·저장한다.
  const [settings, setSettings] = useState<HouseholdSettingsState>(
    emptyHouseholdSettingsState,
  );
  // 설정 변경 트랜잭션이 결과를 반영할 때마다 올린다. 진행 중인 조회는 시작 때 값과 비교한다.
  const settingsRevision = useRef({ categories: 0, rules: 0 });
  const [cashDraft, setCashDraft] = useState<HouseholdCashDraft | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    ownerUid: string;
    entry: DashboardEntry;
  } | null>(null);
  const [selection, setSelection] = useState<{
    ownerUid: string;
    entries: Record<string, DashboardEntry>;
  } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  // 분류 관리를 연 계정. 다른 계정에서는 열린 것으로 보지 않는다.
  const [managerOwner, setManagerOwner] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    ownerUid: string;
    text: string;
    tone: "ok" | "warn";
  } | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [showSubStats, setShowSubStats] = useState(false);

  useEffect(() => {
    let active = true;
    setRecords([]);
    setLoadedUid(null);
    setLoadError(false);
    setLoading(Boolean(user?.uid));
    if (user?.uid)
      firestoreService
        .getRecords(user.uid)
        .then((all) => {
          if (active) {
            setRecords(all);
            setLoadedUid(user.uid);
          }
        })
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [user?.uid, reload]);

  useEffect(() => {
    let active = true;
    setBudget({ total: 0, categories: {} });
    setShowBudgetModal(false);
    setSavingBudget(false);
    setBudgetError("");
    if (user?.uid)
      getDoc(doc(db, "users", user.uid, "settings", "householdBudget"))
        .then((snap) => {
          if (active && snap.exists()) {
            const data = snap.data();
            setBudget({
              total: Number(data.total) || 0,
              categories: data.categories || {},
            });
          }
        })
        .catch(() => {
          if (active)
            setBudgetError(
              "예산 설정을 불러오지 못했습니다. 다시 시도해 주세요.",
            );
        });
    return () => {
      active = false;
    };
  }, [user?.uid, reload]);

  // 계정이 바뀌면 작성 중인 현금 거래·편집·선택·분류 설정을 모두 버린다.
  useEffect(() => {
    setCashDraft(null);
    setCashOpen(false);
    setEditTarget(null);
    setSelection(null);
    setBulkOpen(false);
    setManagerOwner(null);
    setNotice(null);
    setReviewOnly(false);
  }, [user?.uid]);

  useEffect(() => {
    let active = true;
    setSettings((previous) =>
      previous.ownerUid === user?.uid ? previous : emptyHouseholdSettingsState(),
    );
    if (user?.uid) {
      const uid = user.uid;
      const started = { ...settingsRevision.current };
      Promise.allSettled([
        loadHouseholdCategories(db, uid),
        loadHouseholdVendorRules(db, uid),
      ]).then(([categories, rules]) => {
        if (!active) return;
        // 조회를 시작한 뒤 변경 트랜잭션 결과가 반영된 설정은, 늦게 도착한 조회 값으로 되돌리지 않는다.
        const changed = {
          categories: settingsRevision.current.categories !== started.categories,
          rules: settingsRevision.current.rules !== started.rules,
        };
        setSettings((previous) =>
          mergeLoadedHouseholdSettings(previous, uid, { categories, rules }, changed),
        );
      });
    }
    return () => {
      active = false;
    };
  }, [user?.uid, reload]);

  // 계정 전환 직후 이전 계정의 거래가 한 프레임도 노출되지 않게 한다.
  const dashboard = useMemo(
    () => readHouseholdDashboard(loadedUid === user?.uid ? records : []),
    [records, loadedUid, user?.uid],
  );
  const allEntries = dashboard.entries;
  const range = selectPeriod(mode, month, year, custom, allEntries);
  const rangeValid = validRange(range);
  const selected = useMemo(
    () => entriesInRange(allEntries, range),
    [allEntries, range.start, range.end],
  );
  const summary = summarizeHouseholdEntries(selected);
  const categories = [...new Set(selected.map((entry) => entry.category))].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
  const transactions = useMemo(
    () =>
      filterTransactions(selected, type, category, query, {
        needsReview: reviewOnly,
      }),
    [selected, type, category, query, reviewOnly],
  );
  const uid = user?.uid;
  const ownSettings = settings.ownerUid === uid ? settings : null;
  const categoryViews = useMemo(
    () =>
      mergeHouseholdCategories(
        ownSettings?.categories || emptyHouseholdCategories(),
        allEntries.map((entry) => ({
          transactionType: entry.transactionType,
          category: entry.rawCategory || "",
          subcategory: entry.subcategory,
        })),
      ),
    [ownSettings?.categories, allEntries],
  );
  const rules = ownSettings?.rules || [];
  // 분류 설정을 읽지 못해 보관 여부를 모르면 현금 입력에 거래처 기억을 제안하지 않는다.
  const cashRules = householdSuggestionRules(ownSettings);
  const ownedCashDraft = uid && cashDraft?.ownerUid === uid ? cashDraft : null;
  const ownedEdit = uid && editTarget?.ownerUid === uid ? editTarget.entry : null;
  const selectMode = Boolean(uid && selection?.ownerUid === uid);
  const selectedEntries = selectMode && selection ? Object.values(selection.entries) : [];
  const ownedNotice = uid && notice?.ownerUid === uid ? notice : null;
  const reviewCount = selected.filter((e) => e.needsCategoryReview).length;
  const bulkType = selectedEntries.length
    ? selectedEntries.every(
        (entry) => entry.transactionType === selectedEntries[0].transactionType,
      ) && isHouseholdType(selectedEntries[0].transactionType)
      ? (selectedEntries[0].transactionType as HouseholdType)
      : null
    : null;
  const filteredSummary = summarizeHouseholdEntries(transactions);
  const monthly = useMemo(() => monthlySummaries(selected), [selected]);
  const compareRange =
    comparison === "custom"
      ? baseline
      : comparisonRange(range, mode, comparison);
  const comparisonValid = validRange(compareRange);
  const previous =
    mode === "all" ? [] : entriesInRange(allEntries, compareRange);
  const previousSummary = summarizeHouseholdEntries(previous);
  const categoryStats = useMemo(() => {
    const groups = new Map<string, DashboardEntry[]>();
    for (const entry of selected) {
      const group = groups.get(entry.category) || [];
      group.push(entry);
      groups.set(entry.category, group);
    }
    return [...groups]
      .map(([name, entries]) => {
        const subs = new Map<string, DashboardEntry[]>();
        for (const entry of entries)
          if (entry.subcategory)
            subs.set(entry.subcategory, [
              ...(subs.get(entry.subcategory) || []),
              entry,
            ]);
        return {
          name,
          count: entries.length,
          ...summarizeHouseholdEntries(entries),
          // 세부분류는 같은 분류 안의 내역을 나눠 보여 줄 뿐, 분류 합계에 다시 더하지 않는다.
          subs: [...subs]
            .map(([sub, items]) => ({
              name: sub,
              count: items.length,
              ...summarizeHouseholdEntries(items),
            }))
            .sort((a, b) => b.expense - a.expense),
        };
      })
      .sort((a, b) => b.expense - a.expense);
  }, [selected]);
  const currentMonthSummary = summarizeHouseholdEntries(
    entriesInRange(allEntries, monthRange(currentMonth)),
  );
  const isCurrentMonth = mode === "month" && month === currentMonth;
  const busy =
    loading || Boolean(user?.uid && loadedUid !== user.uid && !loadError);
  const ready = Boolean(user?.uid && !busy && !loadError);

  useEffect(() => {
    setVisible(50);
    // 보이지 않는 거래가 선택된 채 일괄 수정되지 않도록 조건이 바뀌면 선택을 비운다.
    setSelection((previous) =>
      previous ? { ...previous, entries: {} } : previous,
    );
  }, [range.start, range.end, type, category, query, reviewOnly]);

  function moveMonth(offset: number) {
    if (!validRange(monthRange(month))) return;
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    const next = date.toISOString().slice(0, 7);
    if (/^\d{4}-/.test(next)) setMonth(next);
  }
  // 은행 버튼은 파일 가져오기 화면으로 연다. 현금 거래는 이 화면의 간편 입력을 쓴다.
  function openEntry() {
    navigate("/record", {
      state: {
        format: "HARU가계부",
        from: "/household",
        householdEntry: "bank",
      },
    });
  }
  function openCash() {
    if (!uid) return;
    setCashDraft((previous) =>
      previous?.ownerUid === uid ? previous : newHouseholdCashDraft(uid),
    );
    setCashOpen(true);
  }
  const owns = (ownerUid: string) => activeUid.current === ownerUid;
  const say = (ownerUid: string, text: string, tone: "ok" | "warn" = "ok") => {
    if (owns(ownerUid)) setNotice({ ownerUid, text, tone });
  };
  const keepSettings = (
    ownerUid: string,
    patch: Partial<{ categories: HouseholdCategorySettings; rules: HouseholdVendorRule[] }>,
  ) => {
    if (!owns(ownerUid)) return;
    // 트랜잭션이 돌려준 최신 설정. 수정 번호를 올려 진행 중인 조회가 과거 값으로 덮지 않게 한다.
    if (patch.categories) settingsRevision.current.categories++;
    if (patch.rules) settingsRevision.current.rules++;
    // 트랜잭션이 읽고 돌려준 분류 설정은 최신이므로 보관 여부를 아는 상태가 된다.
    const known = patch.categories ? { categoriesKnown: true } : {};
    setSettings((previous) =>
      previous.ownerUid === ownerUid
        ? { ...previous, ...patch, ...known }
        : { ...emptyHouseholdSettingsState(), ownerUid, ...patch, ...known },
    );
  };
  async function changeCategories(
    ownerUid: string,
    kind: HouseholdType,
    action: HouseholdCategoryAction,
  ) {
    const next = await updateHouseholdCategories(db, ownerUid, kind, action);
    keepSettings(ownerUid, { categories: next });
  }
  // 직접 입력한 분류는 거래에 바로 쓰고, 목록 저장은 따로 시도한다. 실패해도 기존 거래의 분류로 계속 보인다.
  function createCategory(
    kind: HouseholdType,
    what: "category" | "subcategory",
    name: string,
    parent?: string,
  ) {
    if (!uid) return;
    const ownerUid = uid;
    changeCategories(
      ownerUid,
      kind,
      what === "category"
        ? { kind: "add", name }
        : { kind: "addSub", category: parent || "", name },
    ).catch((error) => {
      if (!/이미 있는/.test(String(error?.message)))
        say(
          ownerUid,
          `‘${name}’을(를) 분류 목록에 저장하지 못했습니다. 이 거래에는 그대로 쓰이며, 저장 후에는 기존 거래의 분류로 계속 선택할 수 있습니다.`,
          "warn",
        );
    });
  }
  async function rememberVendor(
    ownerUid: string,
    input: { type: string; vendor: string; category: string; subcategory?: string },
  ) {
    try {
      const next = await updateHouseholdVendorRules(db, ownerUid, (current) =>
        upsertHouseholdVendorRule(current, input),
      );
      keepSettings(ownerUid, { rules: next.rules });
      return true;
    } catch (error) {
      say(
        ownerUid,
        `거래는 저장했지만 거래처 분류 기억은 저장하지 못했습니다. ${(error as Error)?.message || ""}`.trim(),
        "warn",
      );
      return false;
    }
  }
  async function onCashSaved(ownerUid: string, saved: HouseholdCashSaved) {
    if (!owns(ownerUid)) return;
    const { result, entry } = saved;
    setCashDraft(newHouseholdCashDraft(ownerUid));
    setCashOpen(false);
    setReload((v) => v + 1);
    say(
      ownerUid,
      result.added
        ? `현금 ${entry.transactionType} ${Number(entry.amount).toLocaleString("ko-KR")}원을 저장했습니다.`
        : result.already
          ? `이미 저장된 거래입니다(처음 시도한 내용으로 저장됨).${saved.changedAfterFailure ? " 실패 뒤 고친 내용은 저장되지 않았습니다. 목록에서 확인한 뒤 분류·메모를 수정해 주세요." : ""}`
          : "기존 거래를 사용하기로 해 새로 추가하지 않았습니다.",
      result.added ? "ok" : "warn",
    );
    // 저장된 것이 실패했던 첫 시도라 분류가 다를 수 있으면, 지금 고른 분류를 기억하지 않는다.
    if (saved.remember && entry.vendor && result.already && saved.rememberMismatch) {
      say(
        ownerUid,
        "이미 저장된 거래입니다(처음 시도한 내용으로 저장됨). 실패 뒤 고친 내용은 저장되지 않았고, 거래처 분류 기억도 저장하지 않았습니다. 목록에서 거래를 열어 분류를 확인한 뒤 기억을 선택해 주세요.",
        "warn",
      );
      return;
    }
    if (saved.remember && entry.vendor)
      await rememberVendor(ownerUid, {
        type: entry.transactionType,
        vendor: entry.vendor,
        category: entry.category,
        subcategory: entry.subcategory,
      });
  }
  async function submitEdit(
    ownerUid: string,
    entry: DashboardEntry,
    patch: HouseholdEntryPatch | null,
    remember: boolean,
    nextCategory: { category: string; subcategory: string },
  ) {
    let text = "거래처 분류 기억을 저장했습니다.";
    if (patch) {
      try {
        const result = await updateHouseholdEntries(db, ownerUid, [
          { locator: entry.locator!, patch },
        ]);
        text = result.updated
          ? "거래를 수정했습니다."
          : "이미 반영된 수정입니다.";
      } catch (error) {
        if (error instanceof HouseholdEditConflict && owns(ownerUid))
          setReload((v) => v + 1);
        throw error;
      }
    }
    if (!owns(ownerUid)) return;
    setEditTarget(null);
    setReload((v) => v + 1);
    say(ownerUid, text);
    if (remember)
      await rememberVendor(ownerUid, {
        type: entry.transactionType,
        vendor: entry.vendor,
        ...nextCategory,
      });
  }
  async function submitBulk(ownerUid: string, nextCategory: string, nextSubcategory: string) {
    const targets = selectedEntries.filter((entry) => entry.locator);
    try {
      const result = await updateHouseholdEntries(
        db,
        ownerUid,
        targets.map((entry) => ({
          locator: entry.locator!,
          patch: { category: nextCategory, subcategory: nextSubcategory },
        })),
      );
      if (!owns(ownerUid)) return;
      setBulkOpen(false);
      setSelection(null);
      setReload((v) => v + 1);
      say(
        ownerUid,
        `${result.updated + result.unchanged}건의 분류를 ‘${nextCategory}${nextSubcategory ? ` · ${nextSubcategory}` : ""}’(으)로 바꿨습니다. 메모는 그대로입니다.`,
      );
    } catch (error) {
      if (error instanceof HouseholdEditConflict) {
        if (owns(ownerUid)) {
          setSelection((previous) => (previous ? { ...previous, entries: {} } : previous));
          setReload((v) => v + 1);
        }
        throw new Error(
          "선택한 거래 중 다른 곳에서 바뀐 거래가 있어 아무것도 바꾸지 않았습니다. 목록을 다시 불러왔으니 다시 선택해 주세요.",
        );
      }
      throw error;
    }
  }
  function toggleSelected(entry: DashboardEntry) {
    if (!uid || !entry.locator) return;
    const key = householdLocatorKey(entry.locator);
    setSelection((previous) => {
      const entries = { ...(previous?.ownerUid === uid ? previous.entries : {}) };
      if (entries[key]) delete entries[key];
      else if (Object.keys(entries).length < HOUSEHOLD_EDIT_LIMITS.batch)
        entries[key] = entry;
      return { ownerUid: uid, entries };
    });
  }
  function selectAllFiltered() {
    if (!uid) return;
    const editable = transactions.filter((entry) => entry.locator);
    const picked = editable.slice(0, HOUSEHOLD_EDIT_LIMITS.batch);
    setSelection({
      ownerUid: uid,
      entries: Object.fromEntries(
        picked.map((entry) => [householdLocatorKey(entry.locator!), entry]),
      ),
    });
    if (editable.length > picked.length)
      say(uid, `한 번에 ${HOUSEHOLD_EDIT_LIMITS.batch}건까지 선택할 수 있어 앞의 ${picked.length}건만 선택했습니다.`, "warn");
  }
  function openRow(entry: DashboardEntry) {
    if (!uid) return;
    if (selectMode) return toggleSelected(entry);
    if (!entry.locator) return say(uid, entry.editBlock || "이 거래는 편집할 수 없습니다.", "warn");
    setEditTarget({ ownerUid: uid, entry });
  }
  async function saveBudget() {
    if (!user?.uid) return;
    const savingUid = user.uid;
    setSavingBudget(true);
    setBudgetError("");
    try {
      await setDoc(
        doc(db, "users", user.uid, "settings", "householdBudget"),
        budgetDraft,
        { merge: false },
      );
      if (activeUid.current === savingUid) {
        setBudget(budgetDraft);
        setShowBudgetModal(false);
      }
    } catch {
      if (activeUid.current === savingUid) setBudgetError("예산을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      if (activeUid.current === savingUid) setSavingBudget(false);
    }
  }

  return (
    <main className="household-dashboard">
      <div className="hh-shell">
        <header className="hh-header">
          <button
            className="hh-icon-button"
            aria-label="이전 화면"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={22} />
          </button>
          <div className="hh-brand">
            <Wallet size={21} />
            <span>나의 가계부</span>
          </div>
          <span className="hh-header-actions">
          <button
            className="hh-text-button"
            onClick={() => setManagerOwner(uid || null)}
            disabled={!ready}
          >
            <Tags size={16} />
            분류 관리
          </button>
          <button
            className="hh-text-button"
            onClick={() => {
              setBudgetDraft({
                total: budget.total,
                categories: { ...budget.categories },
              });
              setShowBudgetModal(true);
            }}
            disabled={!ready}
          >
            <SlidersHorizontal size={16} />
            예산 설정
          </button>
          </span>
        </header>
        <section className="hh-hero">
          <div>
            <p className="hh-eyebrow">MY MONEY, MY EVERYDAY</p>
            <h1>
              흐름을 알면,
              <br />
              생활이 보입니다.
            </h1>
            <p className="hh-hero-note">
              은행 내역으로 한 번에 기록하고
              <br className="hh-mobile-break" /> 현금 거래만 가볍게 더하세요.
            </p>
          </div>
          <div className="hh-actions">
            <button
              className="hh-button hh-primary"
              onClick={openEntry}
              disabled={!user}
            >
              <FileUp size={18} />
              은행·카드 파일 가져오기
            </button>
            <button
              className="hh-button hh-secondary"
              onClick={openCash}
              disabled={!user}
            >
              <Plus size={18} />
              현금 거래 추가
            </button>
            <small>은행 내역은 파일 선택 화면에서, 현금 거래는 이 화면에서 바로 입력합니다.</small>
          </div>
        </section>
        {ownedNotice && (
          <p
            className={`hh-notice hh-notice-${ownedNotice.tone}`}
            role="status"
          >
            {ownedNotice.text}
            <button
              className="hh-icon-button"
              aria-label="안내 닫기"
              onClick={() => setNotice(null)}
            >
              <X size={16} />
            </button>
          </p>
        )}

        <section
          className="hh-period hh-panel"
          aria-labelledby="hh-period-title"
        >
          <div className="hh-section-heading">
            <div>
              <p className="hh-eyebrow">01 / PERIOD</p>
              <h2 id="hh-period-title">언제의 기록을 볼까요?</h2>
            </div>
            <button
              className="hh-text-button"
              onClick={() => {
                setMode("month");
                setMonth(currentMonth);
              }}
            >
              이번 달
            </button>
          </div>
          <div className="hh-period-controls">
            <div className="hh-segment" aria-label="조회 기간 방식">
              {(["month", "year", "range", "all"] as const).map(
                (value, index) => (
                  <button
                    key={value}
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                  >
                    {["월별", "연도별", "기간 지정", "전체"][index]}
                  </button>
                ),
              )}
            </div>
            {mode === "month" && (
              <div className="hh-month-control">
                <button
                  className="hh-icon-button"
                  aria-label="이전 달"
                  onClick={() => moveMonth(-1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <label>
                  <span className="hh-sr">조회 월</span>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
                <button
                  className="hh-icon-button"
                  aria-label="다음 달"
                  onClick={() => moveMonth(1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            {mode === "year" && (
              <label className="hh-field">
                조회 연도
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  {[
                    ...new Set([
                      String(today.getFullYear()),
                      year,
                      ...allEntries
                        .filter((e) => e.date)
                        .map((e) => e.date.slice(0, 4)),
                    ]),
                  ]
                    .sort()
                    .reverse()
                    .map((value) => (
                      <option key={value} value={value}>
                        {value}년
                      </option>
                    ))}
                </select>
              </label>
            )}
            {mode === "range" && (
              <DateInputs range={custom} onChange={setCustom} prefix="조회" />
            )}
          </div>
          {rangeValid ? (
            <p className="hh-period-caption">
              {rangeLabel(range)}
              <span>
                {" "}
                ·{" "}
                {ready
                  ? `전체 ${selected.length.toLocaleString()}건`
                  : "조회 준비 중"}
              </span>
            </p>
          ) : (
            <p className="hh-error" role="alert">
              시작일과 종료일을 확인해 주세요. 시작일은 종료일보다 늦을 수
              없습니다.
            </p>
          )}
        </section>

        {!user ? (
          <div className="hh-panel hh-empty">
            로그인 후 내 가계부를 확인할 수 있습니다.
          </div>
        ) : busy ? (
          <div className="hh-panel hh-empty" role="status">
            거래 내역을 불러오고 있습니다.
          </div>
        ) : loadError ? (
          <div className="hh-panel hh-empty" role="alert">
            <p>
              거래 내역을 불러오지 못했습니다. 저장된 기록은 변경되지
              않았습니다.
            </p>
            <button
              className="hh-button hh-secondary"
              onClick={() => setReload((v) => v + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : (
          rangeValid && (
            <>
              <section className="hh-summary" aria-label="선택 기간 전체 합계">
                <SummaryCard
                  label="수입"
                  amount={summary.income}
                  kind="income"
                  count={
                    selected.filter((e) => e.transactionType === "수입").length
                  }
                />
                <SummaryCard
                  label="지출"
                  amount={summary.expense}
                  kind="expense"
                  count={
                    selected.filter((e) => e.transactionType === "지출").length
                  }
                />
                <SummaryCard
                  label="수입−지출"
                  amount={summary.balance}
                  kind="balance"
                  note={`이체 ${selected.filter((e) => e.transactionType === "이체").length}건은 합계에서 제외`}
                />
              </section>
              <p className="hh-summary-note">{HOUSEHOLD_SUMMARY_NOTE}</p>
              {(dashboard.ignoredRecords > 0 ||
                dashboard.ignoredEntries > 0) && (
                <p className="hh-comparison-caution">
                  거래 정보가 없는 기록 {dashboard.ignoredRecords}개 · 비어
                  있거나 잘못된 항목 {dashboard.ignoredEntries}개는 거래 수에서
                  제외했습니다. 저장된 원본은 유지됩니다.
                </p>
              )}
              {allEntries.some((e) => !e.date) && (
                <p className="hh-comparison-caution">
                  날짜를 확인할 수 없는 거래{" "}
                  {allEntries.filter((e) => !e.date).length}건은 기간 집계에
                  포함되지 않습니다. SAYU 원본 기록에서 날짜를 확인해 주세요.
                </p>
              )}
              {selected.some((e) => e.dateEstimated) && (
                <p className="hh-comparison-caution">
                  날짜 확인 필요{" "}
                  {selected.filter((e) => e.dateEstimated).length}건 · 월만
                  있으면 1일로, 날짜가 없거나 잘못되면 기록 문서 날짜(월별 문서는 1일)로
                  표시했습니다.
                </p>
              )}
              {selected.some(
                (e) => parseHouseholdAmountText(e.amount) === null,
              ) && (
                <p className="hh-comparison-caution">
                  금액 확인 필요{" "}
                  {
                    selected.filter(
                      (e) => parseHouseholdAmountText(e.amount) === null,
                    ).length
                  }
                  건 · 합계에서는 0원으로 계산했습니다. SAYU 원본 기록에서
                  확인해 주세요.
                </p>
              )}
              {isCurrentMonth && budget.total > 0 && (
                <div className="hh-budget">
                  <span>
                    이번 달 예산 <strong>{money(budget.total)}</strong>
                  </span>
                  <span
                    className={
                      currentMonthSummary.expense >= budget.total
                        ? "hh-expense-text"
                        : ""
                    }
                  >
                    {Math.round(
                      (currentMonthSummary.expense / budget.total) * 100,
                    )}
                    % 사용
                    {currentMonthSummary.expense >= budget.total
                      ? " · 예산 초과"
                      : ""}
                  </span>
                  <progress
                    value={Math.max(0, currentMonthSummary.expense)}
                    max={budget.total}
                  />
                </div>
              )}
              {isCurrentMonth &&
                Object.entries(budget.categories)
                  .filter(([, limit]) => limit > 0)
                  .map(([name, limit]) => {
                    const spent = selected
                      .filter(
                        (e) =>
                          e.transactionType === "지출" && e.category === name,
                      )
                      .reduce(
                        (sum, e) =>
                          sum + (parseHouseholdAmountText(e.amount) ?? 0),
                        0,
                      );
                    return spent >= limit * 0.8 ? (
                      <p className="hh-budget-alert" key={name}>
                        {name} 예산 {spent >= limit ? "초과" : "80% 도달"} ·{" "}
                        {money(spent)} / {money(limit)}
                      </p>
                    ) : null;
                  })}

              <nav className="hh-tabs" aria-label="가계부 보기">
                {(
                  [
                    {
                      value: "transactions",
                      label: "거래 · 검색",
                      icon: ListFilter,
                    },
                    {
                      value: "statistics",
                      label: "통계",
                      icon: ChartNoAxesCombined,
                    },
                    {
                      value: "comparison",
                      label: "기간 비교",
                      icon: GitCompareArrows,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    aria-pressed={tab === item.value}
                    onClick={() => setTab(item.value)}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </button>
                ))}
              </nav>
              {tab === "transactions" && (
                <section
                  className="hh-panel"
                  aria-labelledby="hh-transactions-title"
                >
                  <div className="hh-section-heading">
                    <div>
                      <p className="hh-eyebrow">02 / TRANSACTIONS</p>
                      <h2 id="hh-transactions-title">필요한 거래를, 바로</h2>
                    </div>
                    <span className="hh-count">
                      {transactions.length.toLocaleString()}건
                    </span>
                  </div>
                  <div className="hh-filters">
                    <div className="hh-type-filter" aria-label="거래 구분">
                      {[
                        "전체",
                        "수입",
                        "지출",
                        "이체",
                        ...(selected.some(
                          (e) =>
                            !["수입", "지출", "이체"].includes(
                              e.transactionType,
                            ),
                        )
                          ? ["미분류"]
                          : []),
                      ].map((value) => (
                        <button
                          key={value}
                          aria-pressed={type === value}
                          onClick={() => setType(value)}
                        >
                          {value}
                          <span>
                            {value === "전체"
                              ? selected.length
                              : selected.filter((e) =>
                                  value === "미분류"
                                    ? !["수입", "지출", "이체"].includes(
                                        e.transactionType,
                                      )
                                    : e.transactionType === value,
                                ).length}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="hh-search-row">
                      <label className="hh-search">
                        <Search size={18} />
                        <span className="hh-sr">거래 검색</span>
                        <input
                          type="search"
                          placeholder="거래처, 메모, 금액 검색"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <label className="hh-category">
                        <span className="hh-sr">카테고리</span>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="전체">모든 카테고리</option>
                          {[
                            ...new Set([
                              ...categories,
                              ...(category !== "전체" ? [category] : []),
                            ]),
                          ].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="hh-list-tools">
                      <button
                        className="hh-review-chip"
                        aria-pressed={reviewOnly}
                        onClick={() => setReviewOnly((v) => !v)}
                      >
                        분류 확인 필요 <span>{reviewCount}</span>
                      </button>
                      <button
                        className="hh-review-chip"
                        aria-pressed={selectMode}
                        onClick={() =>
                          uid &&
                          setSelection(selectMode ? null : { ownerUid: uid, entries: {} })
                        }
                      >
                        <CheckSquare size={15} />
                        {selectMode ? "선택 끝내기" : "여러 건 분류"}
                      </button>
                    </div>
                    {(query || type !== "전체" || category !== "전체" || reviewOnly) && (
                      <div className="hh-filter-summary">
                        <span>
                          검색·필터 결과 {transactions.length}건 · 수입{" "}
                          {money(filteredSummary.income)} · 지출{" "}
                          {money(filteredSummary.expense)}
                        </span>
                        <button
                          className="hh-text-button"
                          onClick={() => {
                            setQuery("");
                            setType("전체");
                            setCategory("전체");
                            setReviewOnly(false);
                          }}
                        >
                          필터 초기화
                        </button>
                      </div>
                    )}
                    {reviewOnly && (
                      <p className="hh-muted hh-scope-note">
                        분류가 비어 있거나 ‘기타·기타수입·이체’ 기본값인 거래를 모았습니다. 일부러 고른 분류라면 거래를 눌러 ‘이 분류로 확정’하면 목록에서 빠집니다. 저장된 거래는 자동으로 바꾸지 않습니다.
                      </p>
                    )}
                    {selectMode && (
                      <div className="hh-bulk-bar" role="region" aria-label="여러 거래 분류">
                        <span>
                          선택 {selectedEntries.length}건
                          {selectedEntries.length > 0 && !bulkType && " · 같은 구분(수입·지출·이체)끼리 선택해 주세요"}
                        </span>
                        <button className="hh-text-button" onClick={selectAllFiltered}>
                          조건에 맞는 거래 모두 선택
                        </button>
                        <button
                          className="hh-button hh-primary"
                          disabled={!bulkType}
                          onClick={() => setBulkOpen(true)}
                        >
                          선택한 거래 분류 바꾸기
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="hh-muted hh-scope-note">
                    검색·필터는 거래 목록에만 적용됩니다. 상단 합계와
                    통계·비교는 선택 기간 전체 기준입니다.
                  </p>
                  {transactions.length ? (
                    <>
                      <div className="hh-entry-list">
                        {transactions.slice(0, visible).map((entry, index) => (
                          <EntryRow
                            key={entry.sourceKey || index}
                            entry={entry}
                            selectMode={selectMode}
                            checked={Boolean(
                              entry.locator &&
                                selection?.entries[householdLocatorKey(entry.locator)],
                            )}
                            onOpen={() => openRow(entry)}
                          />
                        ))}
                      </div>
                      {transactions.length > visible && (
                        <button
                          className="hh-more"
                          onClick={() => setVisible((v) => v + 50)}
                        >
                          거래 더 보기 ({visible} / {transactions.length}건)
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="hh-empty">
                      <Search size={28} />
                      <h3>
                        {selected.length
                          ? "조건에 맞는 거래가 없습니다"
                          : "이 기간에는 거래가 없습니다"}
                      </h3>
                      <p>
                        {selected.length
                          ? "검색어나 구분을 바꾸어 찾아보세요."
                          : "다른 기간을 선택하거나 은행 내역을 가져오세요."}
                      </p>
                      {!allEntries.length && (
                        <div className="hh-empty-actions">
                          <button
                            className="hh-button hh-primary"
                            onClick={openEntry}
                          >
                            첫 기록 추가
                          </button>
                          <button
                            className="hh-button hh-secondary"
                            onClick={openCash}
                          >
                            현금 거래 추가
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {tab === "statistics" && (
                <section
                  className="hh-panel"
                  aria-labelledby="hh-statistics-title"
                >
                  <div className="hh-section-heading">
                    <div>
                      <p className="hh-eyebrow">02 / STATISTICS</p>
                      <h2 id="hh-statistics-title">한눈에 보는 생활의 흐름</h2>
                    </div>
                  </div>
                  <p className="hh-muted">
                    선택 기간 전체 {selected.length}건 · 거래 검색·필터 미적용
                  </p>
                  {!selected.length ? (
                    <div className="hh-empty">
                      이 기간에는 집계할 거래가 없습니다.
                    </div>
                  ) : (
                    <>
                      <h3 className="hh-subheading">월별 수입·지출</h3>
                      <div className="hh-chart">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={monthly.map((item) => ({
                              month: item.month,
                              수입: item.income,
                              지출: item.expense,
                            }))}
                            margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
                          >
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis
                              width={62}
                              tick={{ fontSize: 10 }}
                              tickFormatter={(value) =>
                                `${(value / 10000).toLocaleString()}만`
                              }
                            />
                            <Tooltip
                              formatter={(value) => money(Number(value))}
                            />
                            <Legend />
                            <Bar
                              dataKey="수입"
                              fill="#267461"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="지출"
                              fill="#c47e57"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="hh-table-wrap">
                        <table>
                          <caption>월별 수입·지출 상세</caption>
                          <thead>
                            <tr>
                              <th scope="col">월 / 거래 수</th>
                              <th scope="col">수입</th>
                              <th scope="col">지출</th>
                              <th scope="col">수입−지출</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthly.map((item) => (
                              <tr key={item.month}>
                                <th scope="row">
                                  {item.month}
                                  <small>{item.count}건</small>
                                </th>
                                <td>{money(item.income)}</td>
                                <td>{money(item.expense)}</td>
                                <td>{money(item.balance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="hh-subheading-row">
                        <h3 className="hh-subheading">카테고리별 수입·지출</h3>
                        {categoryStats.some((item) => item.subs.length) && (
                          <button
                            className="hh-text-button"
                            aria-pressed={showSubStats}
                            onClick={() => setShowSubStats((v) => !v)}
                          >
                            {showSubStats ? "세부분류 접기" : "세부분류 펼치기"}
                          </button>
                        )}
                      </div>
                      <div className="hh-table-wrap">
                        <table>
                          <caption className="hh-sr">
                            선택 기간 카테고리별 통계
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">카테고리 / 거래 수</th>
                              <th scope="col">수입</th>
                              <th scope="col">지출</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryStats.flatMap((item) => [
                              <tr key={item.name}>
                                <th scope="row">
                                  {item.name}
                                  <small>{item.count}건</small>
                                </th>
                                <td>{money(item.income)}</td>
                                <td>{money(item.expense)}</td>
                              </tr>,
                              ...(showSubStats
                                ? item.subs.map((sub) => (
                                    <tr
                                      key={`${item.name}/${sub.name}`}
                                      className="hh-sub-row"
                                    >
                                      <th scope="row">
                                        └ {sub.name}
                                        <small>{sub.count}건 · {item.name} 안의 내역</small>
                                      </th>
                                      <td>{money(sub.income)}</td>
                                      <td>{money(sub.expense)}</td>
                                    </tr>
                                  ))
                                : []),
                            ])}
                          </tbody>
                        </table>
                      </div>
                      <p className="hh-muted">
                        거래가 있는 월을 표시합니다. 이체는 거래 수에 포함하고
                        수입·지출 합계에서는 제외합니다. 음수 금액은 원래
                        부호대로 집계합니다.
                      </p>
                    </>
                  )}
                </section>
              )}

              {tab === "comparison" && mode === "all" && (
                <div className="hh-panel hh-empty">
                  기간 비교는 월별·연도별·기간 지정을 선택한 뒤 이용해 주세요.
                </div>
              )}
              {tab === "comparison" && mode !== "all" && (
                <section
                  className="hh-panel"
                  aria-labelledby="hh-comparison-title"
                >
                  <div className="hh-section-heading">
                    <div>
                      <p className="hh-eyebrow">02 / COMPARISON</p>
                      <h2 id="hh-comparison-title">얼마나 달라졌을까요?</h2>
                    </div>
                  </div>
                  <p className="hh-muted">
                    상단에서 고른 기간과 아래 기준 기간을 비교합니다. 거래
                    검색·필터는 적용하지 않습니다.
                  </p>
                  <div className="hh-segment hh-compare-modes">
                    {(["previous", "year", "custom"] as const).map(
                      (value, index) => (
                        <button
                          key={value}
                          aria-pressed={comparison === value}
                          onClick={() => setComparison(value)}
                        >
                          {["직전 기간", "전년 동기", "직접 지정"][index]}
                        </button>
                      ),
                    )}
                  </div>
                  {comparison === "custom" && (
                    <DateInputs
                      range={baseline}
                      onChange={setBaseline}
                      prefix="비교 기준"
                    />
                  )}
                  {!comparisonValid ? (
                    <p className="hh-error" role="alert">
                      비교 기준의 시작일과 종료일을 확인해 주세요.
                    </p>
                  ) : (
                    <>
                      <div className="hh-compare-periods">
                        <div>
                          <span>선택 기간 · {selected.length}건</span>
                          <strong>{rangeLabel(range)}</strong>
                        </div>
                        <div>
                          <span>비교 기준 · {previous.length}건</span>
                          <strong>{rangeLabel(compareRange)}</strong>
                        </div>
                      </div>
                      <p className="hh-muted">
                        월별 직전 기간은 이전 달, 연도별은 이전 해, 기간 지정은
                        같은 일수의 직전 기간입니다. 전년 동기의 2월 29일은 2월
                        28일로 맞춥니다.
                      </p>
                      <div className="hh-comparison-grid">
                        {(
                          [
                            { key: "income", label: "수입" },
                            { key: "expense", label: "지출" },
                            { key: "balance", label: "수입−지출" },
                          ] as const
                        ).map((item) => (
                          <article
                            key={item.key}
                            className="hh-comparison-card"
                          >
                            <h3>{item.label}</h3>
                            <strong>{money(summary[item.key])}</strong>
                            <p>기준 {money(previousSummary[item.key])}</p>
                            <div>
                              {signedMoney(
                                summary[item.key] - previousSummary[item.key],
                              )}
                              <small>
                                {changeLabel(
                                  summary[item.key],
                                  previousSummary[item.key],
                                )}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                      {(!selected.length || !previous.length) && (
                        <p className="hh-comparison-caution">
                          거래가 없는 기간은 0원으로 표시합니다. 기록이 없다는
                          뜻이며 실제 수입·지출이 없었다는 뜻은 아닙니다.
                        </p>
                      )}
                      <p className="hh-muted">
                        증감액 = 선택 기간 − 비교 기준 · 증감률 = 증감액 ÷ 기준
                        금액의 절댓값. 두 기간의 길이가 달라도 일평균으로
                        환산하지 않습니다.
                      </p>
                    </>
                  )}
                </section>
              )}
            </>
          )
        )}
        {budgetError && (
          <p className="hh-error" role="alert">
            {budgetError}
          </p>
        )}
      </div>
      {showBudgetModal && (
        <div
          className="hh-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingBudget)
              setShowBudgetModal(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hh-budget-title"
            className="hh-budget-modal"
          >
            <div className="hh-section-heading">
              <h2 id="hh-budget-title">월 예산 설정</h2>
              <button
                className="hh-icon-button"
                aria-label="예산 설정 닫기"
                disabled={savingBudget}
                onClick={() => setShowBudgetModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="hh-muted">
              예산 알림은 ‘이번 달’의 전체 지출을 기준으로 합니다.
            </p>
            <label className="hh-budget-field">
              월 총예산 (원)
              <input
                type="number"
                min="0"
                value={budgetDraft.total || ""}
                onChange={(e) =>
                  setBudgetDraft({
                    ...budgetDraft,
                    total: Math.max(0, Number(e.target.value)),
                  })
                }
              />
            </label>
            {HOUSEHOLD_CATEGORIES.map((name) => (
              <label className="hh-budget-field" key={name}>
                {name}
                <input
                  type="number"
                  min="0"
                  value={budgetDraft.categories[name] || ""}
                  onChange={(e) =>
                    setBudgetDraft({
                      ...budgetDraft,
                      categories: {
                        ...budgetDraft.categories,
                        [name]: Math.max(0, Number(e.target.value)),
                      },
                    })
                  }
                />
              </label>
            ))}
            {budgetError && (
              <p className="hh-error" role="alert">
                {budgetError}
              </p>
            )}
            <button
              className="hh-button hh-primary"
              disabled={savingBudget}
              onClick={saveBudget}
            >
              {savingBudget ? "저장 중…" : "예산 저장"}
            </button>
          </section>
        </div>
      )}
      {cashOpen && ownedCashDraft && (
        <HouseholdCashEntry
          draft={ownedCashDraft}
          onDraftChange={(next) =>
            setCashDraft((previous) =>
              previous?.ownerUid === next.ownerUid ? next : previous,
            )
          }
          categories={categoryViews}
          rules={cashRules}
          onSave={(entry, decisions) =>
            firestoreService.saveHouseholdRecord(
              ownedCashDraft.ownerUid,
              [entry],
              decisions,
            )
          }
          onCreate={createCategory}
          onClose={() => setCashOpen(false)}
          onSaved={(saved) => onCashSaved(ownedCashDraft.ownerUid, saved)}
        />
      )}
      {ownedEdit && uid && (
        <HouseholdEditSheet
          key={householdLocatorKey(ownedEdit.locator!)}
          entry={ownedEdit}
          views={
            isHouseholdType(ownedEdit.transactionType)
              ? categoryViews[ownedEdit.transactionType]
              : []
          }
          onSubmit={(patch, remember, current) =>
            submitEdit(uid, ownedEdit, patch, remember, current)
          }
          onCreate={createCategory}
          onClose={() => setEditTarget(null)}
        />
      )}
      {bulkOpen && bulkType && uid && (
        <HouseholdBulkSheet
          entries={selectedEntries}
          views={categoryViews[bulkType]}
          onSubmit={(nextCategory, nextSubcategory) =>
            submitBulk(uid, nextCategory, nextSubcategory)
          }
          onCreate={createCategory}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {uid && managerOwner === uid && (
        // 계정별 key로 내부 입력·탭·안내를 계정 사이에 이어 쓰지 않는다.
        <HouseholdCategoryManager
          key={uid}
          views={categoryViews}
          rules={rules}
          loadError={ownSettings ? ownSettings.error : "분류 설정을 불러오는 중입니다. 기본 분류와 기존 거래의 분류로 표시합니다."}
          onAction={(kind, action) => changeCategories(uid, kind, action)}
          onRemoveRule={async (rule) => {
            const next = await updateHouseholdVendorRules(db, uid, (current) =>
              removeHouseholdVendorRule(current, rule.type, rule.vendorKey),
            );
            keepSettings(uid, { rules: next.rules });
          }}
          onShowTransactions={(kind, name) => {
            setManagerOwner(null);
            setTab("transactions");
            setMode("all");
            setType(kind);
            setCategory(name);
            setQuery("");
            setReviewOnly(false);
          }}
          onClose={() => setManagerOwner(null)}
        />
      )}
    </main>
  );
}

function DateInputs({
  range,
  onChange,
  prefix,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
  prefix: string;
}) {
  return (
    <div className="hh-date-inputs">
      <label className="hh-field">
        {prefix} 시작일
        <input
          type="date"
          value={range.start}
          onChange={(e) => onChange({ ...range, start: e.target.value })}
        />
      </label>
      <span aria-hidden="true">—</span>
      <label className="hh-field">
        {prefix} 종료일
        <input
          type="date"
          value={range.end}
          onChange={(e) => onChange({ ...range, end: e.target.value })}
        />
      </label>
    </div>
  );
}
function SummaryCard({
  label,
  amount,
  kind,
  count,
  note,
}: {
  label: string;
  amount: number;
  kind: string;
  count?: number;
  note?: string;
}) {
  return (
    <article className={`hh-summary-card hh-${kind}`}>
      <div>
        <span>{label}</span>
        {kind === "income" ? (
          <ArrowDownLeft size={19} />
        ) : kind === "expense" ? (
          <ArrowUpRight size={19} />
        ) : (
          <ArrowLeftRight size={19} />
        )}
      </div>
      <strong>{money(amount)}</strong>
      <small>{note || `${count}건의 기록`}</small>
    </article>
  );
}
function EntryRow({
  entry,
  selectMode = false,
  checked = false,
  onOpen,
}: {
  entry: DashboardEntry;
  selectMode?: boolean;
  checked?: boolean;
  onOpen?: () => void;
}) {
  const kind =
    entry.transactionType === "수입"
      ? "income"
      : entry.transactionType === "이체"
        ? "transfer"
        : entry.transactionType === "지출"
          ? "expense"
          : "unknown";
  return (
    <article
      className={`hh-entry hh-${kind}${onOpen ? " hh-entry-clickable" : ""}${checked ? " hh-entry-checked" : ""}`}
      onClick={onOpen}
    >
      {selectMode && (
        <input
          type="checkbox"
          className="hh-entry-check"
          checked={checked}
          disabled={!entry.locator}
          aria-label={`${entry.vendor || entry.category || "거래"} 선택`}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onOpen?.()}
        />
      )}
      <span className="hh-entry-icon" aria-hidden="true">
        {kind === "income" ? (
          <ArrowDownLeft size={18} />
        ) : kind === "transfer" ? (
          <ArrowLeftRight size={18} />
        ) : (
          <ArrowUpRight size={18} />
        )}
      </span>
      <div className="hh-entry-body">
        <div className="hh-entry-title">
          <h3>{entry.vendor || entry.category || "거래"}</h3>
          <span>{entry.transactionType || "미분류"}</span>
        </div>
        <p>
          {entry.date || "날짜 미확인"} · {entry.category}
          {entry.subcategory && ` · ${entry.subcategory}`}
          {entry.paymentMethod && ` · ${entry.paymentMethod}`}
        </p>
        {entry.needsCategoryReview && (
          <p className="hh-review-badge">분류 확인 필요</p>
        )}
        {entry.dateEstimated && (
          <p className="hh-date-warning">날짜 확인 필요 · 표시용 날짜 사용</p>
        )}
        {entry.memo && <p className="hh-entry-memo">{entry.memo}</p>}
      </div>
      <span className="hh-entry-side">
        <strong className="hh-entry-amount">
          {parseHouseholdAmountText(entry.amount) === null
            ? `${entry.amount || "금액 없음"} · 확인 필요`
            : money(parseHouseholdAmountText(entry.amount) ?? 0)}
        </strong>
        {onOpen && !selectMode && entry.locator && (
          <button
            type="button"
            className="hh-entry-edit"
            aria-label={`${entry.vendor || entry.category || "거래"} 분류·메모 수정`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <PencilLine size={14} />
            수정
          </button>
        )}
      </span>
    </article>
  );
}
