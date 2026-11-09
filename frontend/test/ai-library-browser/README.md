# AI 학습함 mounted UI fixture

Run from frontend: `npm exec vite -- --config test/ai-library-browser/vite.config.mjs`
Open `http://127.0.0.1:18769/`, then click **합성 UI 검증 실행**.

This mounts the real AiLibraryPage with synthetic records only. Vite redirects
firestoreService, AuthContext, aiLibraryAccess, and all Firebase imports to local mocks.
No production credentials, real records, network Firebase calls, or paid AI calls are used.

The visible runner exercises 14 assertions: purpose folders and legacy unclassified,
source filtering, retained action controls, successful/failed movement, stale folder
responses, bounded empty-page pagination, expansion, mocked book conversion, and
selection reset. Browser interaction is performed with CUA, not a standalone browser driver.
This is not a production integration, authorization, or real AI-processing test.

Verified in Chrome through CUA on 2026-11-09: ALL PASSED.

## Classification control fixture

Open `http://127.0.0.1:18769/classification.html`, then click **분류 합성 검증 실행**.
This mounts the real control panel with an explicitly injected synthetic API, no
Firebase or Jev requests. It exercises 20 assertions covering locked capability,
precise paginated consent, whole-job execution, no-progress/unknown results,
reload/expiry/reset, pause/cancel and account changes. Chrome CUA on 2026-11-09:
**ALL PASSED**. The fixture intentionally does not enable the production origin gate.
