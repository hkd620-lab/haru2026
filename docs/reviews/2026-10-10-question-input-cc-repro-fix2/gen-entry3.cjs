// PR head 소스에서 textarea JSX(및 ResultChatModal의 form)를 원문 그대로 뽑아 재현용 entry.tsx를 생성한다.
const ts = require('/opt/node-tools/node_modules/typescript');
const fs = require('fs'); const path = require('path');
const ROOT = process.argv[2];            // .../cc-274/frontend
const OUT = process.argv[3];             // entry.tsx 경로
function load(file) { const p = path.join(ROOT, 'src/app', file); const src = fs.readFileSync(p, 'utf8'); return { p, src, sf: ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }; }
function findTextarea(sf, pred) {
  let hit = null;
  const v = (n) => {
    if (hit) return;
    if (ts.isJsxSelfClosingElement(n) || ts.isJsxElement(n)) {
      const open = ts.isJsxElement(n) ? n.openingElement : n;
      if (open.tagName.getText(sf) === 'textarea' && pred(n.getText(sf))) { hit = n; return; }
    }
    ts.forEachChild(n, v);
  };
  v(sf); if (!hit) throw new Error('textarea not found'); return hit;
}
function enclosingForm(sf, node) { for (let p = node.parent; p; p = p.parent) if (ts.isJsxElement(p) && p.openingElement.tagName.getText(sf) === 'form') return p; throw new Error('no form'); }
const snip = (file, pred) => { const { sf } = load(file); return findTextarea(sf, pred).getText(sf); };
const fm = 'components/FormatModal.tsx';
const rc = load('components/ResultChatModal.tsx');
const resultForm = enclosingForm(rc.sf, findTextarea(rc.sf, t => t.includes('aria-label="기록·비서 AI 질문"'))).getText(rc.sf);
const rai = load('components/ReadingAiChat.tsx');
const raiConst = rai.src.split('\n').find(l => l.startsWith('const textarea: CSSProperties'));
const S = {
  haruLaw: snip('assistants/haruLaw/HaruLawPanel.tsx', t => t.includes('aria-label="하루LAW 질문"')),
  fmReadingBook: snip(fm, t => t.includes('aria-label="현재 읽는 본문"')),
  fmSimple: snip(fm, t => t.includes('placeholder="자유롭게 기록해 주세요..."')),
  fmDiary: snip(fm, t => t.includes("FORMAT_FIELDS['일기'].find")),
  fmLedgerBiz: snip(fm, t => t.includes('businessContextMemo')),
  fmLedgerMemo: snip(fm, t => t.includes('placeholder="관련 메모 (선택사항)"')),
  fmFieldJournal: snip(fm, t => t.includes("'내 독서장'")),
  fmFieldGeneric: snip(fm, t => t.includes('handleChange(field.key, e.target.value)') && !t.includes("'내 독서장'")),
  readingAi: snip('components/ReadingAiChat.tsx', t => t.includes('aria-label="독서 AI 질문"')),
  diaryLearn: snip('pages/DiaryLearnPage.tsx', t => t.includes('setKoreanInput')),
  novelMotive: snip('pages/NovelStudio.tsx', t => t.includes('motiveCustom')),
  plantMemo: snip('pages/PlantDetectivePage.tsx', t => t.includes('setObsMemo')),
};

const code = `/* 생성 파일 — PR #274 HEAD의 원문 JSX를 그대로 삽입. 수정 금지. */
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CSSProperties } from 'react';
import { Paperclip } from 'lucide-react';
import { EnterSubmitGuard, handleQuestionEnterKeyDown } from '../src/app/utils/questionEnterSubmit';
import '../src/styles/index.css';

declare global { interface Window { __log: string[]; __sendCalls: string[] } }
window.__log = []; window.__sendCalls = [];
const noop = () => {};

function useForm(initial: Record<string, string> = {}) {
  const [formData, setFormData] = useState<Record<string, string>>(initial);
  const handleChange = (k: string, v: string) => setFormData(p => ({ ...p, [k]: v }));
  return { formData, handleChange };
}

function HaruLaw() {
  const [lawQuery, setLawQuery] = useState(''); const lawLoading = false; const uploadingLawFiles = false;
  return <form onSubmit={(e) => { e.preventDefault(); window.__log.push('submit'); }} style={{ marginBottom: 12 }}>
    ${S.haruLaw}
  </form>;
}
function FmReadingBook() {
  const { formData, handleChange } = useForm(); const isPolishing = false, isSaving = false, isReadingFinishing = false; const readingBookTextMode = 'manual';
  return <div>${S.fmReadingBook}</div>;
}
function FmSimple() { const { formData, handleChange } = useForm(); const prefix = 'diary'; return <div>${S.fmSimple}</div>; }
function FmDiary() {
  const { formData, handleChange } = useForm(); const f = { key: 'diary_action', label: '행동' };
  const FORMAT_FIELDS: any = { '일기': [{ key: 'diary_action', placeholder: '오늘 한 일을 적어 보세요' }] };
  return <div style={{ position: 'relative' }}>${S.fmDiary}</div>;
}
function FmLedgerBiz() {
  const [rows, setRows] = useState<any[]>([{ id: 'e1', businessContextMemo: '', memo: '' }]); const setVisibleLedgerEntries = setRows; const entry = rows[0];
  return <div>${S.fmLedgerBiz}</div>;
}
function FmLedgerMemo() {
  const [rows, setRows] = useState<any[]>([{ id: 'e1', businessContextMemo: '', memo: '' }]); const setVisibleLedgerEntries = setRows; const entry = rows[0];
  return <div>${S.fmLedgerMemo}</div>;
}
function FmFieldJournal() {
  const { formData, handleChange } = useForm(); const field = { key: 'reading_journal', placeholder: '독서장을 적어 보세요' }; const format = '독서사유';
  const readingJournalRef = useRef<HTMLTextAreaElement>(null); const isPolishing = false, isSaving = false, isReadingFinishing = false, isReadingBookField = false, isLocked = false;
  const checkFinalReflectionBlock = noop;
  return <div>${S.fmFieldJournal}</div>;
}
function FmFieldGeneric() { const { formData, handleChange } = useForm(); const field = { key: 'memo_content', placeholder: '메모할 내용을 자유롭게 작성하세요.' }; return <div>${S.fmFieldGeneric}</div>; }

${raiConst}
function ReadingAi() {
  const [q, setQ] = useState(''); const chat = { question: q, setQuestion: setQ }; const locked = false;
  return <label style={{ display: 'block', fontSize: 13 }}>자유롭게 질문하기
    ${S.readingAi}
  </label>;
}
function DiaryLearn() { const [koreanInput, setKoreanInput] = useState(''); return <div>${S.diaryLearn}</div>; }
function NovelMotive() { const [s, setS] = useState<any>({ motive: 'custom', motiveCustom: '' }); const upd = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v })); return <div>${S.novelMotive}</div>; }

function PlantMemo() { const [obsMemo, setObsMemo] = useState(''); return <div style={{ display: 'flex', flexDirection: 'column' }}>${S.plantMemo}</div>; }

function ResultChat() {
  const [question, setQuestion] = useState('');
  const [questionEnterGuard] = useState(() => new EnterSubmitGuard());
  const [loading, setLoading] = useState(false);
  const uploadingFiles = false, closingAttachments = false; const isChoicePending = false; const pendingConfirmation: any = null; const webSearchUsage: any = null;
  const isHaruLaw = false; const isPaidUser = true; const pendingAttachments: any[] = []; const HARULAW_ATTACH_MAX_FILES = 3;
  const fileInputRef = useRef<HTMLInputElement>(null); const handleFileSelect = noop;
  const requestInFlightRef = useRef(false); const closingAttachmentsRef = useRef(false);
  // 원문 sendQuestion의 가드(ResultChatModal.tsx 612~623행)를 그대로 옮긴 최소 대역 — 호출 기록만 남긴다.
  const sendQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || requestInFlightRef.current || closingAttachmentsRef.current) { window.__log.push('guard-blocked:' + JSON.stringify(text)); return; }
    window.__sendCalls.push(trimmed); window.__log.push('send:' + JSON.stringify(trimmed));
    setQuestion('');
  };
  return <div style={{ background: '#fff', width: '100%' }}>
    ${resultForm}
  </div>;
}

const CASES: Record<string, () => JSX.Element> = { haruLaw: HaruLaw, fmReadingBook: FmReadingBook, fmSimple: FmSimple, fmDiary: FmDiary, fmLedgerBiz: FmLedgerBiz, fmLedgerMemo: FmLedgerMemo, fmFieldJournal: FmFieldJournal, fmFieldGeneric: FmFieldGeneric, readingAi: ReadingAi, diaryLearn: DiaryLearn, novelMotive: NovelMotive, plantMemo: PlantMemo, resultChat: ResultChat };
const id = new URLSearchParams(location.search).get('case') || 'resultChat';
const Comp = CASES[id];
createRoot(document.getElementById('root')!).render(<div style={{ padding: 16, boxSizing: 'border-box', maxWidth: 560 }}><Comp /></div>);
`;
fs.writeFileSync(OUT, code);
console.log('wrote', OUT, code.length, 'chars; cases:', Object.keys(S).join(','));
