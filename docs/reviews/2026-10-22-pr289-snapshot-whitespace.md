# PR #289 원문 diff 보존과 공백 검사

독립 검토에 제공한 diff.patch 2개는 git diff 원문이다. 빈 문맥행이 공백 한 글자여서 이를 새 파일로 stage하면 git diff --cached --check가 trailing whitespace로 표시한다. 원문 보존 정책 때문에 두 patch의 내용을 수정하지 않는다.

제품 코드·시험은 `git diff --check 79c219c8..HEAD -- frontend`로 확인해 공백 오류가 없다. 새 검토 기록은 아래 원문 snapshot 2개만 제외하여 `git diff --cached --check -- . ':(exclude)docs/reviews/2026-10-22-pr289-independent-review-1/diff.patch' ':(exclude)docs/reviews/2026-10-22-pr289-independent-review-2/diff.patch'`로 확인한다. 공백 검사를 통과시키기 위해 원문 증거를 변형하거나 Git 설정/검증 훅을 우회하지 않는다.
