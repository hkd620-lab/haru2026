import { parseKakaoBankWorkbook, type KakaoXlsxParseResult } from './householdKakaoImport';
import { householdDate } from './householdDuplicates';

interface PdfTextItem { str: string; transform: number[]; width: number; height: number }
interface PdfPage { getTextContent(): Promise<{ items: unknown[] }>; cleanup(): unknown }
export interface HouseholdPdfDocument { numPages: number; getPage(page: number): Promise<PdfPage> }
const compact = (value: string) => value.replace(/\s/g, '');
const dateTime = /^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}$/;
const money = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;

// 화면에 보이는 표의 위치로 열·행을 복원한다. PDF 텍스트의 내부 저장 순서에 의존하지 않는다.
// 알 수 없는 표나 누락된 거래는 부분 성공으로 넘기지 않는다.
export async function parseKakaoBankPdfDocument(pdf: HouseholdPdfDocument, fileName: string): Promise<KakaoXlsxParseResult> {
  if (pdf.numPages > 200) throw new Error('PDF는 한 번에 200쪽까지 읽을 수 있습니다. 조회 기간을 나눠 주세요.');
  const rows: unknown[][] = [];
  let owner = '', bankFound = false;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    try {
      const content = await page.getTextContent();
      const items = content.items.filter((item): item is PdfTextItem => !!item && typeof (item as PdfTextItem).str === 'string' && !!(item as PdfTextItem).str.trim());
      bankFound ||= items.some(item => /카카오뱅크|kakaobank/i.test(item.str));
      const fail = () => new Error(`${pageNumber}쪽의 거래 표를 정확히 읽지 못했습니다. 카카오뱅크에서 내려받은 PDF 또는 XLSX를 선택해 주세요. 스캔·사진 PDF는 지원하지 않습니다.`);
      const header = items.find(item => compact(item.str) === '거래일시');
      if (!header) throw fail();
      const scale = header.height || 7;
      const headers = ['거래일시', '구분', '거래금액', '거래후잔액', '거래내용(메모)', '거래구분'].map(label =>
        items.find(item => compact(item.str) === label && Math.abs(item.transform[5] - header.transform[5]) < scale));
      if (headers.some(item => !item)) throw fail();
      const centers = headers.map(item => item!.transform[4] + item!.width / 2);
      if (centers.some((x, i) => i > 0 && x <= centers[i - 1])) throw fail();
      const boundaries = centers.slice(1).map((x, i) => (x + centers[i]) / 2);
      const column = (item: PdfTextItem) => {
        const x = item.transform[4] + item.width / 2;
        const index = boundaries.findIndex(boundary => x < boundary);
        return index < 0 ? 5 : index;
      };
      if (pageNumber === 1) {
        const label = items.find(item => /^(예금주|성명)[:：]?$/.test(compact(item.str)));
        if (label) owner = items.filter(item => item !== label && item.transform[4] > label.transform[4] + label.width
          && Math.abs(item.transform[5] - label.transform[5]) < scale).sort((a,b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ').trim();
      }
      const body = items.filter(item => item.transform[5] < header.transform[5] - scale);
      const anchors = body.filter(item => column(item) === 0 && dateTime.test(item.str.trim())).sort((a,b) => b.transform[5] - a.transform[5]);
      const kinds = body.filter(item => column(item) === 1 && /^(입금|출금)$/.test(item.str.trim()));
      if (!anchors.length || anchors.length !== kinds.length) throw fail();
      for (let i = 0; i < anchors.length; i++) {
        const y = anchors[i].transform[5];
        const distance = anchors.length > 1 ? Math.min(...anchors.slice(1).map((item,j) => anchors[j].transform[5] - item.transform[5])) : scale * 3.6;
        const top = i ? (anchors[i-1].transform[5] + y) / 2 : y + distance / 2;
        const bottom = i < anchors.length-1 ? (anchors[i+1].transform[5] + y) / 2 : y - distance / 2;
        const cells = Array.from({ length: 6 }, (_, c) => body.filter(item => column(item) === c && item.transform[5] > bottom && item.transform[5] <= top)
          .sort((a,b) => Math.abs(a.transform[5] - b.transform[5]) > scale / 2 ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4])
          .map(item => item.str.trim()).join(' ').trim());
        if (!dateTime.test(cells[0]) || !/^(입금|출금)$/.test(cells[1]) || !money.test(cells[2]) || !money.test(cells[3]) || !cells[4] || !cells[5]) throw fail();
        householdDate(cells[0]);
        const amount = Number(cells[2].replace(/,/g, ''));
        if (!Number.isFinite(amount) || amount === 0 || (cells[1] === '입금' && amount < 0)) throw fail();
        // 기존 XLSX 매핑과 동일한 열 순서. 거래후잔액은 수입·지출 계산에 사용하지 않는다.
        rows.push(['', cells[0], cells[1], cells[2], cells[3], cells[5], cells[4], '']);
      }
    } finally { page.cleanup(); }
  }
  if (!bankFound) throw new Error('카카오뱅크 거래내역서인지 확인해 주세요.');
  const raw = [['성명', owner], ...rows];
  return parseKakaoBankWorkbook({ SheetNames: ['거래내역'], Sheets: { 거래내역: raw } }, {
    utils: { sheet_to_json: <T,>() => raw as T[] },
  }, fileName);
}

// 원본 PDF·암호는 서버로 보내지 않는다. 실행 코드나 첨부파일을 열지 않고 텍스트만 읽는다.
export async function parseKakaoBankPdf(bytes: Uint8Array, fileName: string, password = '') {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes, password, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  try {
    return await parseKakaoBankPdfDocument(await task.promise, fileName);
  } catch (error) {
    if ((error as Error)?.name === 'PasswordException') throw new Error('파일 비밀번호가 필요하거나 올바르지 않습니다. 확인 후 다시 읽어 주세요.');
    if ((error as Error)?.name === 'InvalidPDFException') throw new Error('올바른 PDF 파일이 아닙니다. 다시 내려받아 주세요.');
    throw error;
  } finally { await task.destroy(); }
}
