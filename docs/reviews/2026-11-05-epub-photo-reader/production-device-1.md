# 배포 후 실제 기록 EPUB·갤럭시 확인

{
  "date": "2026-11-05",
  "scope": "PR340 production EPUB layout fix and common reader guidance",
  "merge_sha": "14429e31f13f38e134a4626ec1bdfbf838011aad",
  "function_revision": "exportepub-00035-san",
  "runtime": "nodejs22",
  "region": "asia-northeast3",
  "traffic_percent": 100,
  "hosting_version": "5ee12bf65c866059",
  "hosting_release_time": "2026-11-05T06:24:43.102Z",
  "main_ci": "https://github.com/hkd620-lab/haru2026/actions/runs/41980076756",
  "reader": "Google Play Books on Galaxy S21 SM-G991N",
  "file_sha256": "51c19f7c4ce30f3f0cc2342c0959624ecc67f762bf7f5a98b4f2b13f5156b7da",
  "fresh_production_export": true,
  "crc": "pass",
  "chapters": 1,
  "photos": 2,
  "body_and_photo_bytes_preserved": true,
  "phone_file_sha256_matches": true,
  "text_visible": "screen-006.png",
  "two_photos_fully_visible": "screen-007.png",
  "forward_turn": "2/3 to3/3",
  "backward_turn": "screen-008.png returned to2/3",
  "production_web_guide": "After Hosting refresh desktop guide has new phone-direct-download text; deployed bundle matches final Android4step/account note; Android full guide and store round trip verified before deployment with final bundle locally",
  "download_route": "Signed-in production desktop browser export, then ADB transfer of identical bytes to Galaxy. Phone direct same-account production download not verified (phone account list had no target record).",
  "unchanged": "Firestore/Storage paths, Rules, authentication/payment, API costs, environment values unchanged. No other Functions deployed.",
  "cleanup": "Phone helper exited; other device task informed; browser verification tab closed. Font100% retained.",
  "evidence_sha256": {
    "screen-006.png": "e88fbeed45dfe1fec9fa1f673420cc0fc8a571dde25c6fc813a00d90d10f6445",
    "screen-007.png": "2c4125518001f53b0f111982ea505624d1d97d48e72f5e3df11a4e725b6849d7",
    "screen-008.png": "e88fbeed45dfe1fec9fa1f673420cc0fc8a571dde25c6fc813a00d90d10f6445"
  }
}

실제 본문·사진·캡처는 LaCie 외장에만 보관하며 GitHub/Slack에 복사하지 않는다. 기재 범위에서 관찰을 확인했고 다른 리더·iOS·폰 운영동일계정다운로드로 확대하지 않는다.
