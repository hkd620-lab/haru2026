// record_today_session.js
// This script directly inserts today's planning session into the HARU2026 Firestore.

const admin = require('firebase-admin');
const path = require('path');

// Initialize with service account
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const userId = "AhpnpEoaIWcz2Nb8FrrG63gkKR92"; // Obtained from user screenshot

const today = new Date();
const timestamp = admin.firestore.Timestamp.fromDate(today);

async function recordSession() {
  const content = `
## [2026-04-06] AI 지식 수집기 & HARU2026 연동 고도화 기획

### 1. 주요 기획 내용
- **두 개의 우체통 (Dual Storage)**: 하나의 수집기에서 개인 보관용(Fire)과 서비스용(HARU 앱)으로 동시 배달하는 시스템 설계.
- **배달 주소의 다양화**: 서버뿐만 아니라 사용자의 로컬 하드디스크(.md 파일), 개인 구글 드라이브 등으로 저장 위치를 확장하는 유연함 확보.
- **구독자 가치 제안**: '지식의 주권은 구독자에게!'라는 철학 아래 로컬 저장은 무료, 클라우드 동기화는 프리미엄 기능으로 구성 가능.

### 2. 기술적 돌파구
- **확장 프로그램의 한계 극복**: 웹 기반 AI(ChatGPT 등)는 확장 프로그램을 쓰고, 앱 기반 AI(AG)는 직접 전송 방식을 사용함.
- **자동화의 극대화**: 번거로운 복사-붙여넣기 없이 '클릭 한 번'으로 모든 워크플로우를 완성함.

### 3. 향후 로드맵
- **1단계**: 서버 동시 저장 기능 완성.
- **2단계**: 마운트된 하드디스크 및 개인 드라이브 저장 UI 추가.
- **3단계**: 구독자용 간편 배포 버전(북마클릿 등) 제작.

---
*기록: AG(Antigravity) - 사용자님과의 대화를 통해 실시간 기록됨*
`;

  try {
    const docRef = db.collection('users').doc(userId).collection('records').doc();
    await docRef.set({
      title: "[기획] AI 지식 수집기 로드맵 & 저장 전략 수립",
      content: content,
      type: "diary", // Or "log" based on app preference
      createdAt: timestamp,
      updatedAt: timestamp,
      category: "research"
    });
    console.log(`Success! Today's session recorded in HARU2026 app with Doc ID: ${docRef.id}`);
  } catch (error) {
    console.error("Error recording session:", error);
  }
}

recordSession().then(() => process.exit(0));
