독립 검토 판정: **승인**

- 대상: [PR #328](https://github.com/hkd620-lab/haru2026/pull/328)
- 검토 HEAD: `e829fa4cc2197703ab21e6318b174fb19b4f9fd2`
- 비교 base: `5732554c022d83bd12d7769daf62e7f69b3c9584`
- 검토 완료: 2026-11-03 14:50:38 KST
- 수정이 필요한 코드 지적: 없음
- 규모: 코드 변경 **소**. 운영 적용은 공통 의존성 영향으로 별도 범위 확정 필요.
- 난이도: **중간**

직접 확인한 diff는 `functions/package-lock.json:7864` 부근의 node-forge 버전·배포 URL·무결성값 3개 필드뿐입니다. Firebase Admin 13.7.0이 허용하는 `^1.3.1` 범위 안의 1.4.2로 갱신됩니다. Functions 소스, export 100개, 리전, Firestore 경로, 환경변수, 결제·인증 정책에는 변경이 없습니다.

1.4.1은 PEM·ASN.1·RSA 등 보안 수정을 포함하고, 1.4.2는 PEM Buffer 입력 호환성 회귀를 복구합니다. 실제 Firebase Admin의 직접 사용 지점은 서비스 계정 개인키를 파싱하는 `credential-internal.js`입니다. 이번 갱신은 그 호출과 호환됩니다. [공식 변경 기록](https://github.com/digitalbazaar/forge/blob/main/CHANGELOG.md)

검증 근거:

- 정확한 HEAD의 GitHub CI `build_and_preview`, `linux_x64_node22` 성공을 직접 확인했습니다.
- 실행자가 확인한 `npm ci`, Functions 빌드 exit 0과 관련 시험 **18/18**, 합성 호환성 시험 **7/7**의 로그·시험 코드를 검토했습니다.
- base와 HEAD의 소스 diff 없음, export **100개 동일·추가 0·삭제 0**을 비교 스크립트와 결과에서 확인했습니다.
- 독립적으로 Node **v22.23.2**에서 새 RSA 키를 메모리에 생성하여 다음 결과를 재확인했습니다.

```text
PASS pkcs1: string/Buffer PEM + forge parse + Admin custom JWT signature
PASS pkcs8: string/Buffer PEM + forge parse + Admin custom JWT signature
PASS malformed PEM rejected by forge and Admin
Node v22.23.2; node-forge 1.4.2; no network, real credentials, Firestore or Storage used
```

GitHub의 PR 생성·검토 상태와 [Slack #328 생성 기록](https://harulab-hq.slack.com/archives/C0C11P98MHV/p1793671569265139)을 대조했습니다. 독립 확인 당시 자동 Codex 검토는 진행 중이었습니다. **이 승인은 독립 코드 검토 결과이며, 자동 검토 완료 및 정책 8.1의 나머지 조건을 대신하지 않습니다.** 최신 자동 검토 결과와 사용자 병합 승인을 확인하기 전 병합·판정①을 확정하면 안 됩니다.

코드 변경 자체에는 인증 정책 변경 등 멈춤 조건이 없습니다. 다만 **운영 배포는 별도 승인 필요**입니다. Hosting 자동 배포만으로 운영 Functions의 node-forge가 바뀌지는 않습니다. 공통 의존성이므로 OAuth 함수만 갱신하고 전체 보안 적용 완료로 보고해서도 안 됩니다.

실행자가 제공한 운영 목록은 114개이며, 현재 export 100개 외에 삭제 보류된 legacy 14개가 있습니다. 함수별 운영 소스와 배포 후보의 차이를 확인하여 필요한 기존 함수를 명시해야 합니다. 검토하지 않은 변경을 함께 배포하거나 legacy 함수를 삭제하는 전체 배포는 이번 코드 승인에 포함되지 않습니다. 실제 운영 아티팩트의 의존성 버전·배포 revision·사용자 동작은 아직 검증하지 않았습니다.

제품파일·Git·Slack·배포는 변경하지 않았습니다. 검증 근거는 내부 임시 경로 `/private/tmp/haru-pr328-20261103/`에서 확인했으며 영구 보관 완료로 주장하지 않습니다.

Slack 기록용 확정 요약:

> PR #328, HEAD e829fa4의 독립 Codex 검토 판정은 “승인”. 잠금파일 3필드 변경 외 소스·정책 변경 없음. CI 2개, Functions 빌드, 관련 시험 18/18, 합성 호환성 7/7 및 독립 RSA/PEM/Admin 서명 시험 통과. export 100개 동일. 자동 검토 완료·병합 승인·Functions 배포는 별도 조건이며 운영 적용 완료 판정은 하지 않음.
