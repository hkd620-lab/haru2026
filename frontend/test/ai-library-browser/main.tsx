import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AiLibraryPage } from '../../src/app/pages/AiLibraryPage';
import { state, reset } from './mocks';
window.alert = message => { state.alerts.push(String(message)); };
window.confirm = () => true;
const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
function App() {
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true); setResults([]);
    const report: string[] = [];
    const check = (ok: unknown, label: string) => { if (!ok) throw new Error(label); report.push('PASS ' + label); setResults([...report]); };
    const page = () => document.querySelector('#fixture')!;
    const button = (text: string, within: Element = page()) => Array.from(within.querySelectorAll('button')).find(el => el.textContent?.trim() === text)!;
    const folder = async (name: string) => { button(name, page().querySelector('nav')!).click(); await wait(); };
    const select = (title: string, value: string) => { const el = page().querySelector(`select[aria-label="${title} 폴더 이동"]`) as HTMLSelectElement; el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); };
    try {
      reset(); setRevision(n => n + 1); await wait();
      check(['의료신기술','건강상식','생활정보','투자정보','AI신기술','미분류'].every(name => button(name, page().querySelector('nav')!)), '목적 폴더 5개와 별도 미분류');
      check(['선택 삭제','▼ 펼치기','📚 책소재 변환','📋 복사','삭제'].every(name => button(name)), '기존 작업 버튼 보존');
      button('Slack').click(); await wait();
      check(page().textContent?.includes('합성 미분류 대화') && !page().textContent?.includes('합성 건강 자료'), '출처 필터 유지');
      button('전체', page().querySelector('nav')!.nextElementSibling!.nextElementSibling!.nextElementSibling!).click(); await wait();
      await folder('미분류'); check(page().textContent?.includes('합성 미분류 대화'), '기존 분류 없는 기록 미분류');
      select('합성 미분류 대화', 'life'); await wait();
      check(!page().textContent?.includes('합성 미분류 대화'), '이동 성공 후 이전 폴더에서 제거');
      await folder('생활정보'); check(page().textContent?.includes('합성 미분류 대화'), '새 폴더에서 이동 기록 표시');
      state.failMove = true; select('합성 미분류 대화', 'investment'); await wait();
      check((page().querySelector('select') as HTMLSelectElement).value === 'life' && state.alerts.some(message => message.includes('결과를 확인하지 못했습니다')), '실패 시 폴더 유지 및 오류 안내');
      state.failMove = false; state.delayed = true;
      await folder('건강상식'); await folder('AI신기술'); await wait(800);
      check(page().textContent?.includes('합성 AI 자료') && !page().textContent?.includes('합성 건강 자료'), '이전 폴더 지연 응답 무시');
      state.delayed = false; state.bounded = true; await folder('건강상식');
      check(!!button('더 불러오기') && !page().textContent?.includes('합성 건강 자료'), '중간 빈 페이지에서도 더 불러오기');
      button('더 불러오기').click(); await wait();
      check(page().textContent?.includes('합성 건강 자료'), '빈 페이지 다음 커서로 기록 조회');
      button('▼ 펼치기').click(); await wait(); check(!!button('▲ 접기'), '펼치기 유지');
      button('📚 책소재 변환').click(); await wait(); check(page().textContent?.includes('합성 책소재 요약'), '모의 책소재 변환 유지');
      button('선택 삭제').click(); await wait(); check(page().textContent?.includes('0개 선택됨'), '선택 모드 유지');
      await folder('전체'); check(!!button('선택 삭제') && !page().textContent?.includes('0개 선택됨'), '폴더 전환 시 선택 모드 초기화');
      report.push('ALL PASSED');
    } catch (error) { report.push('FAIL ' + (error as Error).message); }
    setResults([...report]); setRunning(false);
  }
  return <div style={{ fontFamily: 'sans-serif' }}><aside style={{ padding: 16, background: '#EEF3FB' }}><h1>AI 학습함 합성 QA</h1><p>실제 기록·Firebase·AI 연결 없음</p><button onClick={run} disabled={running}>합성 UI 검증 실행</button><pre role="status">{results.join('\n')}</pre></aside><div id="fixture"><AiLibraryPage key={revision} /></div></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
