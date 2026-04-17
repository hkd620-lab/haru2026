import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export class SayuService {
  async polishContent(content: string, format: string): Promise<string> {
    if (!content.trim()) return '';

    try {
      // 팩트: 브라우저가 직접 AI를 호출하지 않고, 서버의 'generateSayu' 함수를 호출합니다.
      const generateSayu = httpsCallable(functions, 'generateSayu');
      
      // 프롬프트 구성 (허교장님의 기존 로직 유지)
      const prompt = `다음 내용을 ${format} 형식에 맞춰 세련되게 다듬어줘: \n\n${content}`;
      
      const result = await generateSayu({ prompt });
      const data = result.data as { text: string };
      
      return data.text;
    } catch (error) {
      console.error('SAYU 서버 호출 에러:', error);
      throw new Error('서버를 통한 AI 다듬기에 실패했습니다.');
    }
  }
}
