# #279 성능 계측·범위 검토 독립 실행 기록

**최종 판정 원문: “승인”**. 문서·합성 계측 감사의 기술적 완료 판정이며 구현·PR·공식판정①·병합·배포 승인이 아니다. [계측 결과와 권장 범위](2026-10-19-issue279-long-text-performance-scope.md).

검토 기준 앱 HEAD는 모든 실행에서 `9141f7f37fa9ff7e41baae977f9a594de649d603`이다. 보고서·진단은 이 HEAD 위에 새 파일로 추가한 미커밋 상태에서 읽었다. 검토 당시 보고서는 실행별 snapshot으로 보존했다. CLI는 모델 옵션을 지정하지 않았으며 성공 실행의 실제 응답 모델은 `claude-sonnet-5-5`, Read/Glob/Grep만 허용했다. 구현 대화 이력은 전달하지 않았다.

아래 시각은 출력 파일 생성·쓰기의 관측 UTC이며 API의 정확한 시작·종료 시각이 아니다.

| 실행 | 시작 관측 UTC | 완료 관측 UTC | 결과 |
| --- | --- | --- | --- |
| 최초 인증 실패 | 10:00:48.303574 | 10:00:53.113729 | exit1,401OAuth만료,모델판정없음 |
| 첫 실질 검토 | 10:36:51.555806 | 10:38:12.378836 | exit0,수정 후 승인 |
| 수정 후 재검토 | 10:40:47.457257 | 10:42:39.590328 | exit0,승인 |

모두2026-10-19이다. 환경·모델·권한거부·오류 여부 원문 필드는 [실행 메타데이터](2026-10-19-issue279-performance-evidence/independent-executions.json)에 있다. 인증 재시도는 호스트승인 후 샌드박스 밖에서 실행했다. 실패 실행을 삭제하지 않았으며, 이전 질문·401·수정 후 승인 원문·반영 내역·수정diff를 다음 검토에 모두 전달했다.

- 최초 [질문](2026-10-19-issue279-performance-evidence/independent-0-auth-prompt.md), [401 JSON 원문](2026-10-19-issue279-performance-evidence/independent-0-auth-result.json).
- 첫 실질 검토 [질문](2026-10-19-issue279-performance-evidence/independent-1-prompt.md), [판정 원문](2026-10-19-issue279-performance-evidence/independent-1-response.md), [CLI JSON](2026-10-19-issue279-performance-evidence/independent-1-result.json), [당시 보고서](2026-10-19-issue279-performance-evidence/reviewed-report-round1.md).
- 필수 수정은 검토자 규모/멈춤조건 의견 명시, 모든 실행 원문 보존, 기존 기준선 출처 링크였다. [반영diff 원문](2026-10-19-issue279-performance-evidence/round1-amendment.diff.json). 검토 당시 `.diff`의 빈 문맥행 공백까지 보존하도록 JSON content문자열에 손실 없이 담았다. 질문·판정 원문은 변형하지 않았다.
- 재검토 [질문](2026-10-19-issue279-performance-evidence/independent-2-prompt.md), [판정 원문](2026-10-19-issue279-performance-evidence/independent-2-response.md), [CLI JSON](2026-10-19-issue279-performance-evidence/independent-2-result.json), [당시 보고서](2026-10-19-issue279-performance-evidence/reviewed-report-round2.md).

재검토자는 Node466행/Chrome1661행/시험로그48행 전문과 하네스·실제소스를 대조했다. **“문서·합성 계측 감사로서 기술적으로 완료”**, **“1단계는 소, 2단계는 중”**, **“현재 문서·진단 범위에서는 해당 없음”**(멈춤조건)으로 판정했다. 실제 벤치·시험을 검토자가 직접 실행한 것은 아니다.

승인 후 비차단 의견 처리:

- 기존 `02a6643f` 문서를 GitHub contents API에서 읽어 p95143ms/1,572.23ms를 재확인했다. [출처 문서 원문 보존](2026-10-19-issue279-performance-evidence/prior-baseline-source.md). 보고서에 기존 GitHub 출처 링크가 있다.
- SayuPage 링크는 실제 호출행 `#L5443`으로 정정했다. 계산이나 데이터 수정은 없다. 기존 검토 snapshot은 고치지 않았다.
- [시험 명령·기준 SHA·관측 시각·로그해시](2026-10-19-issue279-performance-evidence/recommendation-test-metadata.json)를 새 파일로 보충했다. 시험은40pass/0fail/0skip이다.
- Chrome1만자 표본은 p5035.2/p9594.4ms이나 max261.4ms였다. near88,481자는183.2~288.7ms,100만자는2160.6~3439.8ms로 분산됐다. p95만으로 분산 전체를 설명할 수 없으며 실제 운영 SLO로 해석하지 않는다. 원시 표본은 수정하지 않았다.

누적 이력은 본 성능 감사의 수정 후 승인1회와 기존PR270의1회를 모두 유지한다(연관 이력 합산2회). 이번 승인으로 횟수를 초기화하지 않는다. 기존PR284완료 상태를 바꾸지 않는다.

이 감사는 PR 없이 새 문서·진단만 보존하므로 Codex PR자동리뷰·CI를 실행하지 않았다. 최적화 구현, 전체SAYU/실기기모바일 E2E, 추천정책 결정은 별도 다음 범위이다.
