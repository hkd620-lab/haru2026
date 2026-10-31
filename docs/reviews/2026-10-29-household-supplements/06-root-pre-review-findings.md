# 구현 중 확인 메모 — PR 전 수정 요청

2026-10-29 17:40 KST. 기준 HEAD `2e622d82911748a0e380f0b75c6584a8891d05ee` 위 미커밋 구현을 확인했다. 구현 진행 중의 메모이며 최종 코드 리뷰나 승인 판정이 아니다. 아래 내용을 구현 완료 후 다시 대조한다.

## 필수 확인·수정

1. **로그아웃 시 null 접근** — HouseholdPage.tsx의 `editTarget?.ownerUid === uid ? editTarget.entry : null` 및 `selection?.ownerUid === uid ? Object.values(selection.entries) : []`는 `uid === undefined`, 대상 상태 `null`일 때 조건이 참이 되어 null.entry/null.entries에 접근한다. 명시적으로 uid와 상태 객체 존재를 확인한다. signedout 최초 렌더·정상→로그아웃·계정 전환 하네스/SSR 검증 필요.
2. **rawIndex가 안전한데 예전 거래를 전부 편집 금지하지 않기** — 04 독립 검토 M1의 판정은 recordId+rawIndex+원본 지문을 기본으로 하고 identity는 추가 확인만 하라는 것이다. 현재 Dashboard/householdEditService는 entry.id 없음 또는 같은 id/identity가 둘 이상이라는 이유로 차단한다. 이는 id 없는 거래·같은 id 두 건·내용이 같은 두 건을 각 실제 위치로 구분하여 편집하는 M1 테스트를 충족하지 않는다. 05 요청의 초기 '모호한 식별 키 차단'은 **위치/지문까지 모호한 경우**로 한정한다. 실제 record.id 없음·깨진 배열·원본 위치 이동·지문 불일치는 계속 차단한다. 거래의 기존 id/importSource를 새로 쓰거나 바꾸지는 않는다.
3. **`[]`와 레거시 단건 필드가 함께 있는 문서의 추가 저장 보존** — 대시보드/편집 서비스는 이 문서를 레거시로 보여 주지만 householdStoredEntries는 빈 배열로 읽는다. 같은 월에 현금을 추가하면 기존 단건이 화면/집계에서 사라질 수 있다. 기존 문제여도 이번 보존 완료 조건에 관련된다. 실제 기존 단건이 있는 경우 새 거래 추가에도 보존되게 동일 판정 기준을 적용하거나 안전하게 추가를 막는다. 원본이 애매하거나 손상된 배열은 빈 내역으로 덮어쓰지 않는다. 합성 SDK 테스트로 빈 배열+단건 필드+다른 형식/메모/가져오기 영수증이 유지되는지 확인한다. 운영 데이터 마이그레이션은 하지 않는다.

## 추가 확인

- HouseholdCashEntry/HouseholdEditSheet의 mounted ref는 useEffect setup에서 true로 되돌려야 StrictMode의 setup→cleanup→setup 뒤 저장 결과를 영구 무시하지 않는다.
- `onCashSaved`의 already 응답에서 실패 후 바뀐 새 입력이 저장됐다고 오인하지 않도록 안내와 거래처 기억의 기준을 확인한다.
- 분류 관리 모달이 계정별 key 또는 ownerUid 경계 없이 유지되면 계정 변경 effect 이전 프레임에 이전 계정의 내부 입력이 표시될 수 있다. 새로 추가한 모든 상태를 소유 계정에 묶는다.
- 초기/재조회 settings Promise가 변경 트랜잭션의 최신 반환값보다 늦게 도착해 화면 설정을 과거 값으로 덮지 않는지 확인한다(특히 현금 저장 직후 reload와 rememberVendor 경쟁). 저장소는 안전해도 다음 입력의 분류 제안이 빠질 수 있다.
- 보관한 분류를 거래처 기억이 계속 신규 거래에 제안하는 경우 의도·안내 또는 제안 제외 기준을 확인한다.

반영/미해당 근거와 검증 결과는 이 파일을 고치지 말고 후속 기록에 추가한다.
