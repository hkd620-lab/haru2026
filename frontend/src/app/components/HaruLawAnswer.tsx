import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const sectionTitles = new Set([
  '확인된 사실', '추가 확인이 필요한 사실', '법적으로 말할 수 있는 범위',
  '현재 사건에 적용 가능한 판단', '사용자가 지금 해야 할 행동',
  '다음 단계로 넘어가는 조건', '주의사항',
]);

// 예전 답변의 일반 텍스트 제목도 구분한다. 본문·인용·코드의 문장은 바꾸지 않는다.
export function formatHaruLawAnswer(text: string): string {
  let inCode = false;
  let fence = '';
  let fenceLength = 0;
  return String(text ?? '').split('\n').map((line) => {
    const code = line.trim().match(/^(`{3,}|~{3,})/);
    if (inCode) {
      if (code && code[1][0] === fence && code[1].length >= fenceLength && line.trim() === code[1]) inCode = false;
      return line;
    }
    if (code) {
      inCode = true;
      fence = code[1][0];
      fenceLength = code[1].length;
      return line;
    }
    if (/^(?: {4}|\t|\s*>)/.test(line)) return line;
    const title = line.trim().replace(/^#{1,6}\s+/, '').replace(/^\*\*(.*?)\*\*$/, '$1');
    const plain = title.replace(/^[📋🔎🔍⚖️📌💡➡️⚠️\s]+/u, '').replace(/[:：]$/, '').trim();
    return sectionTitles.has(plain) ? `### ${title}` : line;
  }).join('\n').replace(/^(?:[ \t]*\r?\n)+|(?:\r?\n[ \t]*)+$/g, '');
}

export function splitHaruLawAnswer(text: string): { summary: string; analysis: string } {
  const answer = formatHaruLawAnswer(text);
  // 제목이나 목록으로 시작한 답변에서 첫 제목을 '핵심 답변'으로 떼어내지 않는다.
  if (/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|`{3}|~{3}|\|)/.test(answer)
    || /\n[ \t]*(?:`{3}|~{3})/.test(answer)) {
    return { summary: '', analysis: answer };
  }
  const boundary = answer.search(/\n\s*\n|\n(?=#{1,6}\s)/);
  return boundary < 0
    ? { summary: answer, analysis: '' }
    : { summary: answer.slice(0, boundary).trim(), analysis: answer.slice(boundary).trim() };
}

export function HaruLawAnswer({ text }: { text: string }) {
  return (
    <div className="haru-law-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >{formatHaruLawAnswer(text)}</ReactMarkdown>
    </div>
  );
}
