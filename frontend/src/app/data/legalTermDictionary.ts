export type LegalTermDetail = {
  title: string;
  shortDescription: string;
  actionGuide: string;
  caution: string;
};

export const legalTermDetails = {
  전자소송: {
    title: '전자소송',
    shortDescription: '인터넷으로 소송서류를 내고 사건 진행과 법원 문서를 확인하는 절차입니다.',
    actionGuide: '제출, 송달문서 확인, 납부 상태를 전자소송포털에서 직접 확인합니다.',
    caution: '화면 안내와 실제 법원 문서를 기준으로 해야 하며 HARU가 제출을 대신하지 않습니다.',
  },
  나홀로소송: {
    title: '나홀로소송',
    shortDescription: '변호사 등 대리인 없이 당사자가 직접 준비하고 진행하는 소송입니다.',
    actionGuide: '절차와 서류를 미리 확인하고 모르는 부분은 법원 안내나 전문가에게 확인합니다.',
    caution: '사건이 복잡하거나 다툼이 크면 전문가 상담을 고려해야 합니다.',
  },
  공동인증서: {
    title: '공동인증서',
    shortDescription: '본인 확인에 쓰는 전자 신분증 같은 인증서입니다.',
    actionGuide: '인증서가 저장된 위치와 비밀번호를 알고 있어야 합니다.',
    caution: '연습 화면에는 실제 인증서 비밀번호를 입력하지 않습니다.',
  },
  간편인증: {
    title: '간편인증',
    shortDescription: '휴대전화 인증 앱 등으로 본인임을 확인하는 방식입니다.',
    actionGuide: '본인 명의 휴대전화와 사용할 인증 앱을 준비합니다.',
    caution: '실제 제공되는 인증수단은 전자소송포털 화면에서 다시 확인해야 합니다.',
  },
  송달: {
    title: '송달',
    shortDescription: '법원이 소송 관련 문서를 당사자에게 공식적으로 전달하는 절차입니다.',
    actionGuide: '문서가 도착했는지 전자소송포털과 법원 문서를 직접 확인합니다.',
    caution: '송달 효력과 기간은 사건과 문서에 따라 달라질 수 있어 자동 확정하지 않습니다.',
  },
  전자송달: {
    title: '전자송달',
    shortDescription: '법원 문서를 전자소송포털을 통해 받는 방식입니다.',
    actionGuide: '나의 사건과 송달문서함을 정기적으로 확인합니다.',
    caution: '열람하지 않아도 일정 기간 뒤 송달로 처리될 수 있으므로 공식 안내를 확인해야 합니다.',
  },
  송달문서: {
    title: '송달문서',
    shortDescription: '법원이 당사자에게 공식적으로 보내 알리는 소송 관련 문서입니다.',
    actionGuide: '문서명, 받은 날, 대응 필요 여부를 확인해 기록합니다.',
    caution: '문서 원문에 적힌 안내와 기한을 기준으로 합니다.',
  },
  소장: {
    title: '소장',
    shortDescription: '소송을 시작할 때 법원에 내는 첫 서류입니다.',
    actionGuide: '당사자, 청구취지, 청구원인, 증거자료를 빠짐없이 확인합니다.',
    caution: '샘플 문장을 그대로 제출하지 말고 본인 사실에 맞게 작성해야 합니다.',
  },
  민사소송: {
    title: '민사소송',
    shortDescription: '돈, 계약, 손해배상처럼 개인 사이의 권리 다툼을 해결하는 소송입니다.',
    actionGuide: '내 사건이 어떤 민사 절차에 맞는지 법원 안내로 확인합니다.',
    caution: 'HARU는 절차 적합성이나 승소 가능성을 판단하지 않습니다.',
  },
  금전청구: {
    title: '금전청구',
    shortDescription: '상대방에게 돈을 지급해 달라고 요구하는 청구입니다.',
    actionGuide: '받고 싶은 금액과 그 이유, 증거자료를 함께 정리합니다.',
    caution: '이자나 지연손해금은 실제 법원 안내와 자료를 확인해야 합니다.',
  },
  관할법원: {
    title: '관할법원',
    shortDescription: '내 사건을 어느 법원에 제출해야 하는지 정하는 기준입니다.',
    actionGuide: '상대방 주소, 사건 종류, 계약 내용 등을 법원 안내 기준으로 확인합니다.',
    caution: 'HARU가 관할법원을 확정하지 않습니다.',
  },
  보정: {
    title: '보정',
    shortDescription: '법원이 부족한 서류나 내용을 고치거나 보완하라고 하는 절차입니다.',
    actionGuide: '보정명령 문서의 요구사항과 사용자가 확인한 기한을 기록합니다.',
    caution: '보정기한은 문서 원문을 기준으로 직접 확인해야 합니다.',
  },
  보정명령: {
    title: '보정명령',
    shortDescription: '법원이 제출한 서류나 절차의 부족한 부분을 고치라고 요구하는 문서입니다.',
    actionGuide: '무엇을 보완해야 하는지 문서 원문에서 확인합니다.',
    caution: '기한과 제출 방식은 문서와 전자소송포털 안내를 기준으로 합니다.',
  },
  기일: {
    title: '기일',
    shortDescription: '법원이 재판이나 심문 등을 진행하기 위해 정한 날짜와 시간입니다.',
    actionGuide: '법원 문서에 적힌 날짜와 출석·제출 필요 여부를 확인합니다.',
    caution: '기일 변경 가능성과 실제 일정은 법원 안내를 기준으로 합니다.',
  },
  제출서류: {
    title: '제출서류',
    shortDescription: '당사자가 주장, 신청, 답변, 증거 등을 법원에 내는 문서입니다.',
    actionGuide: '서류명과 첨부파일을 제출 전 목록으로 점검합니다.',
    caution: '누락 여부는 실제 제출 화면과 법원 안내에서 다시 확인합니다.',
  },
  사건번호: {
    title: '사건번호',
    shortDescription: '법원이 접수된 사건을 구분하고 관리하기 위해 붙이는 번호입니다.',
    actionGuide: '법원 문서나 전자소송포털에 표시된 그대로 기록합니다.',
    caution: '사건번호를 임의로 고치거나 의미를 단정하지 않습니다.',
  },
  접수번호: {
    title: '접수번호',
    shortDescription: '서류가 접수되는 과정에서 확인에 쓰이는 번호입니다.',
    actionGuide: '접수 완료 화면이나 제출내역에서 번호와 제출일을 확인합니다.',
    caution: '접수번호와 사건번호는 다를 수 있으므로 화면 안내를 확인합니다.',
  },
  원고: {
    title: '원고',
    shortDescription: '민사소송을 제기해 법원에 판단을 요청한 사람입니다.',
    actionGuide: '내가 청구하는 쪽이면 원고 정보에 이름과 주소 등을 정확히 적습니다.',
    caution: '당사자 표시가 틀리면 보정이 필요할 수 있어 제출 전 확인해야 합니다.',
  },
  피고: {
    title: '피고',
    shortDescription: '민사소송에서 원고의 청구를 받은 상대방입니다.',
    actionGuide: '상대방 이름과 주소 등 확인 가능한 정보를 정리합니다.',
    caution: '상대방 표시가 불명확하면 송달이나 절차 진행에 문제가 생길 수 있습니다.',
  },
  소가: {
    title: '소가',
    shortDescription: '소송에서 다투는 이익을 금액으로 평가한 값입니다.',
    actionGuide: '청구 금액을 기준으로 하되 사건 내용에 따라 달라질 수 있음을 확인합니다.',
    caution: '인지액 등과 관련될 수 있으므로 공식 안내를 다시 확인해야 합니다.',
  },
  청구취지: {
    title: '청구취지',
    shortDescription: '법원에 어떤 판결을 내려 달라고 요청하는 내용입니다.',
    actionGuide: '받고 싶은 금액과 판결 내용을 간결하게 적습니다.',
    caution: '실제 제출 전에는 법원 안내와 작성 예시를 다시 확인해야 합니다.',
  },
  청구원인: {
    title: '청구원인',
    shortDescription: '왜 그런 판결을 구하는지 사실관계와 이유를 적는 부분입니다.',
    actionGuide: '날짜, 금액, 약속 내용, 요청한 사실을 순서대로 정리합니다.',
    caution: '없는 사실을 만들지 말고 본인 자료로 확인 가능한 내용만 적습니다.',
  },
  지연손해금: {
    title: '지연손해금',
    shortDescription: '돈을 늦게 갚아 생기는 손해를 금액으로 청구하는 내용입니다.',
    actionGuide: '언제부터 어떤 비율로 청구할지 자료와 법원 안내를 확인합니다.',
    caution: '비율과 시작일은 사건별로 달라질 수 있어 HARU가 확정하지 않습니다.',
  },
  증거: {
    title: '증거',
    shortDescription: '주장한 사실이 맞다는 점을 확인하는 데 사용하는 자료입니다.',
    actionGuide: '계약서, 송금내역, 대화 캡처 등 사실을 보여주는 자료를 모읍니다.',
    caution: '자료가 충분한지 여부는 사건에 따라 다르므로 제출 전 다시 확인합니다.',
  },
  입증자료: {
    title: '입증자료',
    shortDescription: '내 주장을 뒷받침하기 위해 제출하는 자료입니다.',
    actionGuide: '각 주장마다 어떤 자료로 확인되는지 연결해 봅니다.',
    caution: '개인정보와 민감정보가 포함된 자료는 제출 전 필요 범위를 확인해야 합니다.',
  },
  서증: {
    title: '서증',
    shortDescription: '계약서나 송금내역처럼 문서 형태로 제출하는 증거입니다.',
    actionGuide: '문서 제목과 날짜가 보이도록 정리하고 빠진 페이지가 없는지 확인합니다.',
    caution: '원본 보관과 제출 사본 형식은 법원 안내를 따릅니다.',
  },
  인지대: {
    title: '인지대',
    shortDescription: '소송이나 신청을 접수할 때 내는 법원 수수료 성격의 비용입니다.',
    actionGuide: '전자소송포털 납부 화면에서 금액과 납부 상태를 확인합니다.',
    caution: '금액은 사건과 청구 내용에 따라 달라질 수 있습니다.',
  },
  송달료: {
    title: '송달료',
    shortDescription: '법원이 소송서류를 당사자에게 보내는 데 필요한 비용입니다.',
    actionGuide: '납부 안내와 환급 가능성을 전자소송포털에서 확인합니다.',
    caution: '실제 금액과 납부 상태는 포털 화면을 기준으로 합니다.',
  },
  전자서명: {
    title: '전자서명',
    shortDescription: '온라인 제출 서류에 본인이 확인했다는 뜻을 남기는 절차입니다.',
    actionGuide: '제출 전 문서 내용과 첨부파일을 확인한 뒤 서명 절차를 진행합니다.',
    caution: '연습 화면의 전자서명은 실제 법원 제출 효력이 없습니다.',
  },
  판결문: {
    title: '판결문',
    shortDescription: '재판 결과와 판단 내용이 적힌 법원의 문서입니다.',
    actionGuide: '주문, 이유, 불복 가능 기간 등을 원문에서 확인합니다.',
    caution: '효력과 기한은 법원 문서와 관련 안내를 기준으로 합니다.',
  },
  결정문: {
    title: '결정문',
    shortDescription: '신청이나 절차상 사항 등에 관한 법원의 판단이 적힌 문서입니다.',
    actionGuide: '결정 내용과 후속 조치가 필요한지 확인합니다.',
    caution: '정확한 대응은 문서 원문과 법원 안내를 기준으로 합니다.',
  },
  확정: {
    title: '확정',
    shortDescription: '통상적인 불복 절차로 더 이상 다투기 어려운 상태가 된 것입니다.',
    actionGuide: '확정 여부와 날짜는 법원 문서 또는 포털에서 확인합니다.',
    caution: 'HARU가 확정 여부를 자동 판단하지 않습니다.',
  },
  강제집행: {
    title: '강제집행',
    shortDescription: '판결 등에 따른 의무가 이행되지 않을 때 법적 절차로 실현하는 절차입니다.',
    actionGuide: '집행권원과 필요한 서류를 공식 안내 기준으로 확인합니다.',
    caution: '절차 선택과 가능성은 사건별 검토가 필요합니다.',
  },
} as const satisfies Record<string, LegalTermDetail>;

export const legalTermDictionary = Object.fromEntries(
  Object.entries(legalTermDetails).map(([term, detail]) => [term, detail.shortDescription]),
) as { [K in keyof typeof legalTermDetails]: (typeof legalTermDetails)[K]['shortDescription'] };

export type LegalTerm = keyof typeof legalTermDictionary;
