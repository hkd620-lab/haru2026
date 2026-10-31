# 배포 전 Secret 버전 확인

2026-10-31 gcloud secrets versions list를 각 Secret에 실행하고 createTime 내림차순 limit1의 name.basename/state만 조회했다. 비밀값 내용은 읽지 않았다.

- GEMINI_API_KEY: 17 enabled
- OPENAI_API_KEY: 9 enabled

현재 운영 polishcontent-00244-sas 연결 버전(17/9)과 같다.
