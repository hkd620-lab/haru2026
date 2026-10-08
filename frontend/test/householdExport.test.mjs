// HARU가계부 XLSX 내보내기 — 이체를 가계부 화면·SAYU와 같이 "충전"(수입 쪽)으로 집계하는지 확인한다.
// 화면의 전체수입 = 순수입 + 충전, 수지 = 수입 + 충전 − 지출 이므로 엑셀 집계도 같은 방향이어야 한다.
// 실행: node --import tsx --test test/householdExport.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// 파일 내려받기에 쓰는 브라우저 API를 이 테스트 안에서만 가짜로 바꿔, 만들어진 xlsx 내용을 가로챈다.
let capturedBlob = null;
globalThis.URL.createObjectURL = (blob) => { capturedBlob = blob; return 'blob:test'; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } };

const { exportHouseholdToXlsx } = await import('../src/app/services/householdExportService.ts');

// 이 서비스가 만드는 zip 은 압축하지 않고(stored) 저장하므로 로컬 헤더만 순서대로 읽으면 된다.
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = {};
  let pos = 0;
  while (pos + 4 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const name = decoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const start = pos + 30 + nameLen + extraLen;
    files[name] = decoder.decode(bytes.subarray(start, start + size));
    pos = start + size;
  }
  return files;
}

function readSheet(xml) {
  return [...xml.matchAll(/<row r="\d+">([\s\S]*?)<\/row>/g)].map((row) =>
    [...row[1].matchAll(/<c r="[A-Z]+\d+"(?: t="inlineStr")?>(?:<is><t xml:space="preserve">([\s\S]*?)<\/t><\/is>|<v>([\s\S]*?)<\/v>)<\/c>/g)]
      .map((cell) => (cell[1] !== undefined ? cell[1] : Number(cell[2]))));
}

const entry = (o) => ({ id: 'e', transactionType: '지출', category: '', date: '', vendor: '', amount: '', paymentMethod: '', memo: '', ...o });

async function exportOf(entries) {
  capturedBlob = null;
  const result = exportHouseholdToXlsx(
    [{ id: '2026-10-05_1', date: '2026-10-05', formats: ['HARU가계부'], household_entries: JSON.stringify(entries) }],
    2026,
    10,
  );
  const files = unzip(new Uint8Array(await capturedBlob.arrayBuffer()));
  return { result, detail: readSheet(files['xl/worksheets/sheet1.xml']), summary: readSheet(files['xl/worksheets/sheet2.xml']) };
}

// 가계부 화면과 같은 입력: 월급 2,800,000 / 지출 9,500 + 1,550 / 이체(충전) 600,000
const ENTRIES = [
  entry({ transactionType: '수입', category: '월급', date: '2026.10.01', vendor: '회사', amount: '2,800,000', paymentMethod: '계좌이체' }),
  entry({ transactionType: '지출', category: '식비', date: '2026.10.02', vendor: '김밥집', amount: '9,500원', paymentMethod: '체크카드' }),
  entry({ transactionType: '지출', category: '교통비', date: '2026.10.02', vendor: '지하철', amount: '1550', paymentMethod: '체크카드' }),
  entry({ transactionType: '이체', category: '이체', date: '2026.10.05', amount: '600000', paymentMethod: '계좌이체', memo: '급여통장 → 월세통장' }),
];

test('이체는 "이체(충전)" 행으로 수입 쪽에 집계된다 (화면의 전체수입 = 순수입 + 충전)', async () => {
  const { summary } = await exportOf(ENTRIES);
  const byCategory = Object.fromEntries(summary.slice(1).map(([cat, income, expense, net]) => [cat, { income, expense, net }]));
  assert.deepEqual(byCategory['이체(충전)'], { income: 600000, expense: 0, net: 600000 });
  assert.deepEqual(byCategory['월급'], { income: 2800000, expense: 0, net: 2800000 });
  assert.deepEqual(byCategory['식비'], { income: 0, expense: 9500, net: -9500 });
  assert.deepEqual(byCategory['교통비'], { income: 0, expense: 1550, net: -1550 });
  assert.equal(byCategory['이체'], undefined, '이체가 예전 카테고리명("이체") 지출 행으로 남아 있으면 안 된다');
});

test('합계 행: 수입합계 = 순수입 + 충전, 순액 = 화면의 수지와 같다', async () => {
  const { summary } = await exportOf(ENTRIES);
  const total = summary[summary.length - 1];
  assert.deepEqual(total, ['합  계', 3400000, 11050, 3388950]); // 2,800,000 + 600,000 / 9,500 + 1,550 / 3,400,000 − 11,050
});

test('거래상세내역은 그대로다 (이체 거래도 유형 "이체"로 한 줄씩 나온다)', async () => {
  const { result, detail } = await exportOf(ENTRIES);
  assert.equal(result.count, 4);
  assert.equal(detail.length, 5); // 제목 줄 + 거래 4줄
  assert.deepEqual(detail[4], [4, '2026.10.05', '이체', '이체', '', 600000, '계좌이체', '급여통장 → 월세통장']);
});

test('수입·지출만 있는 가계부의 집계는 달라지지 않는다', async () => {
  const { summary } = await exportOf(ENTRIES.filter((e) => e.transactionType !== '이체'));
  assert.deepEqual(summary[summary.length - 1], ['합  계', 2800000, 11050, 2788950]);
  assert.equal(summary.some(([cat]) => cat === '이체(충전)'), false);
});

test('카테고리가 비어 있는 이체도 "이체(충전)"으로 모이고 기타 수입에 섞이지 않는다', async () => {
  const { summary } = await exportOf([
    entry({ transactionType: '수입', category: '', date: '2026.10.01', amount: '1000' }),
    entry({ transactionType: '이체', category: '', date: '2026.10.02', amount: '5천원' }),
  ]);
  const byCategory = Object.fromEntries(summary.slice(1).map(([cat, income, expense]) => [cat, { income, expense }]));
  assert.deepEqual(byCategory['기타'], { income: 1000, expense: 0 });
  assert.deepEqual(byCategory['이체(충전)'], { income: 5000, expense: 0 });
});
