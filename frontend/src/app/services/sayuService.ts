import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export type RecordFormat = 'diary' | 'essay' | 'mission' | 'report' | 'work' | 'travel';

const formatMap: Record<string, RecordFormat> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel'
};

export class SayuService {
  async polishContent(content: string, format: string): Promise<string> {
    if (!content.trim()) return '';

    try {
      const generateSayu = httpsCallable(functions, 'generateSayu');
      const englishFormat = formatMap[format] || 'diary';
      const prompt = this.buildPrompt(content, englishFormat);
      
      const result = await generateSayu({ prompt });
      const data = result.data as { text: string };
      
      return data.text;
    } catch (error) {
      console.error('SAYU Error:', error);
      throw new Error('SAYU 생성 중 오류가 발생했습니다.');
    }
  }

  private buildPrompt(content: string, format: RecordFormat): string {
    const prompts: Record<RecordFormat, string> = {
      diary: `당신은 사용자의 일기를 다듬어주는 AI입니다.
- 원문을 100% 읽고 반영하십시오.
- 사용자의 표현, 문장 구조, 감정의 결을 최우선으로 존중하십시오.
- 내용을 재창작하거나 새로운 사건을 추가하지 마십시오.
- 감정을 과장하거나 교훈을 강요하지 마십시오.
- 출력 길이는 최대 800자로 제한합니다.

다음 일기를 다듬어주세요:

${content}`,
      essay: `당신은 사용자의 에세이를 문학적으로 다듬어주는 AI입니다.
- 원문의 의미를 해치지 않는 선에서 문학적 구조를 보완하십시오.
- 내용은 절대 변경하지 마십시오.
- 1차적으로 글을 분석하고 최종적으로 세련된 문체로 완성하십시오.
- 출력 길이는 900~1100자 사이로 맞추십시오.

다음 에세이를 다듬어주세요:

${content}`,
      mission: `당신은 선교보고를 정리하는 AI입니다.
- 사실(Fact) 중심으로 서술하십시오.
- 기록된 내용 외에 임의로 내용을 추가하지 마십시오.
- 감정적인 미사여구보다는 명확한 전달에 집중하십시오.
- 출력 길이는 700~1000자 사이로 맞추십시오.

다음 선교보고를 정리해주세요:

${content}`,
      report: `당신은 일반 보고서를 작성하는 AI입니다.
- 핵심 내용을 요약하여 간결하게 작성하십시오.
- 불필요한 감성 표현을 모두 제거하십시오.
- 객관적이고 드라이한 어조를 유지하십시오.
- 출력 길이는 600~800자 사이로 맞추십시오.

다음 보고서를 작성해주세요:

${content}`,
      work: `당신은 업무일지를 정리하는 AI입니다.
- 항목별(Bullet points)로 명확하게 정리하십시오.
- 감정 표현을 금지합니다.
- 업무 진행 상황, 결과, 계획 위주로 서술하십시오.
- 출력 길이는 400~600자 사이로 맞추십시오.

다음 업무일지를 정리해주세요:

${content}`,
      travel: `당신은 여행 기록을 생생하게 다듬어주는 AI입니다.
- 현장 묘사를 중심으로 서술하십시오.
- 원문에 있는 내용의 범위 내에서 표현을 확장하고 풍부하게 만드십시오.
- 과도한 상상보다는 관찰한 사실을 감각적으로 표현하십시오.
- 출력 길이는 800~1000자 사이로 맞추십시오.

다음 여행 기록을 다듬어주세요:

${content}`
    };

    return prompts[format] || prompts.diary;
  }

  async aggregateContents(
    contents: string[], 
    type: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  ): Promise<string> {
    try {
      const generateSayu = httpsCallable(functions, 'generateSayu');
      
      let limitDesc = '1200~1500자';
      switch (type) {
        case 'weekly': limitDesc = '1200~1500자'; break;
        case 'monthly': limitDesc = '1500~2000자'; break;
        case 'quarterly': limitDesc = '2000~2500자'; break;
        case 'yearly': limitDesc = '2500~3500자'; break;
      }

      const combinedInput = contents.map((c, i) => `[기록 ${i+1}]\n${c}`).join('\n\n');
      
      const prompt = `당신은 사용자의 여러 기록을 하나로 통합하여 '합본'을 만드는 AI입니다.
- 제공된 모든 기록을 100% 읽고 반영하십시오.
- 빠진 날짜가 있더라도 임의로 내용을 생성해 채워넣지 마십시오.
- 사건을 왜곡하거나 새로운 사건을 만들어내지 마십시오.
- 반복되는 내용은 자연스럽게 통합하십시오.
- 감성적인 과장이나 설교조를 피하십시오.
- 전체 길이는 ${limitDesc} 사이로 작성하십시오.

다음 기록들을 합본해주세요:

${combinedInput}`;

      const result = await generateSayu({ prompt });
      const data = result.data as { text: string };
      
      return data.text;
    } catch (error) {
      console.error('SAYU Aggregation Error:', error);
      throw new Error('합본 생성 중 오류가 발생했습니다.');
    }
  }
}
