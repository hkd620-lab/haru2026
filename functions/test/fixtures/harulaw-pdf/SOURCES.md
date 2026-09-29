# 하루LAW PDF 회귀 표본

실제 사용자 첨부파일을 사용하지 않고 공개 프로젝트의 PDF 회귀 표본만 저장한다.

| 파일 | 용도 | 출처 | SHA-256 |
|---|---|---|---|
| `general.pdf` | 일반 PDF | https://github.com/mozilla/pdf.js/blob/master/test/pdfs/pdfkit_compressed.pdf | `920b8491769e72567e5c40ef9249f1e9fccacad244a82264c28b97fc97d5ef73` |
| `encrypted.pdf` | 암호화 PDF | https://github.com/mozilla/pdf.js/blob/master/test/pdfs/empty_protected.pdf | `69556af04215faec7da3e93e823c64f1b74679e52fd10379176f0e0462dd4b6c` |
| `corrupt.pdf` | 손상 PDF(PDF.js가 Adobe Reader도 열지 못하는 심각한 손상 표본으로 명시) | https://github.com/mozilla/pdf.js/blob/master/test/pdfs/bug1020226.pdf | `50e91d373aa313537972519c65b050f8d4d5bd996859fa20756432c2029c3ff6` |
| `incremental.pdf` | 증분 업데이트 PDF | https://pdf-lib.js.org/assets/with_update_sections.pdf | `b0de16ff27cf3a95e7eb3ba261b0f5d257070ab00f374fdfdaeb1e0b6a85d2ea` |
| `classic-xref.pdf` | classic xref PDF | https://github.com/mozilla/pdf.js/blob/master/test/pdfs/basicapi.pdf | `925853d98d67d5dae7473c635f932958e1695ce1029d23b2ecd2531cb65f1f14` |
| `xref-stream.pdf` | xref-stream PDF 및 기존 수동 파서 오탐 회귀 | https://github.com/mozilla/pdf.js/blob/master/test/pdfs/empty.pdf | `fcee6184c0d776126782cd2799797b106373278c8ea0a4354ee4e33cd8663d51` |
