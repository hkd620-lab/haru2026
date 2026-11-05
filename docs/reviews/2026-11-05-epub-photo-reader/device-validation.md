# 갤럭시 검증 (배포 전)

코드 HEAD: `90ca414ed40b3593422b204fb876c74f28982442`

{
  "date": "2026-11-05",
  "code_commit": "90ca414ed40b3593422b204fb876c74f28982442",
  "device": "Samsung Galaxy S21 (SM-G991N)",
  "reader": "Google Play Books",
  "method": "Updated exportEpub.run callable with local Firestore/Storage/fetch substitutes; original downloaded record body and photo bytes; not production regeneration",
  "file_sha256": "7d9aa54610513b5bbf9d96d01a9fe7c096a3e3dd6356edf9c85079b617052da1",
  "checks": {
    "body_visible": "screen-026.png",
    "two_actual_photos_complete": "screen-028.png",
    "backward_page_turn": "screen-029.png 3/3 -> 2/3",
    "forward_page_turn": "screen-027.png 2/3 -> 3/3",
    "phone_browser_download": "screen-019.png download complete; screen-020.png file exists; SHA256 matches source",
    "install_guide": "screen-015.png: steps, account-upload disclosure, buttons reachable",
    "official_store_open": "screen-017.png",
    "return_from_store": "screen-018.png: guide retained",
    "portrait_300x1500": "screen-038.png TOP 1 and END 2 and full border visible",
    "font_113_percent": "screen-041.png setting; screen-043.png full portrait boundaries still visible"
  },
  "limitations": [
    "Generated with final code locally; Firebase I/O substituted. Production export not deployed or regenerated yet.",
    "Phone browser downloaded via local test page; no claim of production phone account end-to-end.",
    "iOS/other readers/landscape tablets not tested."
  ],
  "evidence_sha256": {
    "screen-015.png": "56b1c0c93720de2c2c9e5365168eb3e2f53cb5a2615c76b2e59e4495f304ddf6",
    "screen-017.png": "4641a473e41defe5e11502550db819ff70703cbf81b0fb3dafafa43e11386235",
    "screen-020.png": "863857e1696882aa13d81b807286cf336cf1078939cde96f6089392a4a9c5397",
    "screen-026.png": "e88fbeed45dfe1fec9fa1f673420cc0fc8a571dde25c6fc813a00d90d10f6445",
    "screen-028.png": "2c4125518001f53b0f111982ea505624d1d97d48e72f5e3df11a4e725b6849d7",
    "screen-038.png": "eb4753204e549ad554ed39bbba2db06ba983ea4365ef3d07ca3a60bc53f9e950",
    "screen-041.png": "b3ccfcaf327450b84d420ee4c957adbd051ab8c6acc902243a8709afc633be40",
    "screen-043.png": "eb4753204e549ad554ed39bbba2db06ba983ea4365ef3d07ca3a60bc53f9e950"
  }
}

개인기록 본문과 실제 사진은 외장에만 보존하고 GitHub·Slack에는 업로드하지 않는다.
