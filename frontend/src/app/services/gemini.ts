const apiKey = ""; // 환경에서 제공됨

export type RecordType = 'diary' | 'essay' | 'general' | 'mission' | 'work' | 'travel';

export const polishText = async (text: string, type: RecordType = 'general'): Promise<string> => {
  const systemPrompt = `
    당신은 텍스트 교정 및 다듬기 전문가입니다. 
    당신의 유일한 출력물은 사용자가 입력한 내용을 다듬은 '순수 텍스트 본문' 하나뿐입니다.

    [절대 금지 사항 - 위반 시 치명적 오류 간주]
    1. 어떠한 형태의 제목이나 머리말도 쓰지 마세요. (예: [일반보고 형식], [다듬어진 글], 일반보고:, 선교보고: 등)
    2. 부연 설명을 절대 쓰지 마세요. (예: "수정된 내용입니다", "다음과 같이 다듬었습니다")
    3. 마크다운 기호(#, *, -, \` 등)를 사용하여 문서를 꾸미지 마세요.
    4. 당신의 답변은 오직 다듬어진 내용 그 자체로 시작하고 끝나야 합니다.

    [문체 및 형식 지침]
    - ${type === 'diary' ? '일기: 개인적이고 솔직하며 부드러운 어조로 서술하세요.' : ''}
    - ${type === 'essay' ? '에세이: 논리적이고 격조 있으며 세련된 문장을 구성하세요.' : ''}
    - ${type === 'general' ? '일반보고: 객관적이고 명확하며 정중한 표준어를 사용하세요.' : ''}
    - ${type === 'mission' ? '선교보고: 사실적이고 은혜로운 어조를 사용하며, 사역 내용을 경건하게 전달하세요.' : ''}
    - ${type === 'work' ? '업무일지: 간결하고 핵심적인 사실 위주의 비즈니스 어조를 사용하세요.' : ''}
    - ${type === 'travel' ? '여행기록: 현장감 있고 생생한 어조로 감상과 여정을 잘 담아내세요.' : ''}
    
    공통 사항: 맞춤법, 띄어쓰기, 문법 오류를 완벽하게 교정하고 가독성을 극대화하세요.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `다음 텍스트에서 제목과 설명을 절대 쓰지 말고 오직 내용만 다듬어 주세요:\n\n"${text}"` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    });

    if (!response.ok) throw new Error('AI 응답 실패');
    
    const result = await response.json();
    let polished = result.candidates?.[0]?.content?.parts?.[0]?.text || text;
    
    // [최종 방어선] 
    // AI가 실수로 넣은 제목(대괄호 형태, 특정 단어 시작)과 설명을 강제로 잘라냅니다.
    polished = polished.trim()
      .replace(/^\[.*?\]\s*\n?/g, '') // 맨 앞 [어쩌구 저쩌구] 삭제
      .replace(/^(다듬은 결과|수정본|결과물|요청하신 내용|일반보고|선교보고|업무일지|여행기록|일기|에세이|다듬어진 글).*?:\s*\n?/gi, '') // 서두 멘트 삭제
      .replace(/^#+.*?\n/g, '') // 마크다운 제목 삭제
      .replace(/^"|"$/g, ''); // 앞뒤 따옴표 삭제
      
    return polished.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return text;
  }
};

export const generateSummary = async (text: string): Promise<string> => {
  const systemPrompt = "사용자의 글을 단 한 줄로 명확하게 요약하세요. 서두나 부연 설명은 절대 금지합니다.";
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: text }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const result = await response.json();
    let summary = (result.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    return summary.replace(/^"|"$/g, '').trim();
  } catch (error) {
    return "";
  }
};
