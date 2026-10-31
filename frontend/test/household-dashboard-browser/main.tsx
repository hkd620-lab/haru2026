import "../../src/styles/index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { HouseholdPage } from "../../src/app/pages/HouseholdPage";
import { externalEdit, injectFailure, setScenario, useWriteCount } from "./mocks";
function Destination() {
  const location = useLocation();
  return <p>기존 기록 작성창 진입: {JSON.stringify(location.state)}</p>;
}
function FixtureApp() {
  const [writes, pending] = useWriteCount().split("|");
  return (
    <MemoryRouter initialEntries={["/household"]}>
      <aside style={{ padding: 8, fontSize: 11, display: "flex", flexWrap: "wrap", gap: 4 }}>
        <span>합성 529건 · 운영 연결 없음 · 쓰기 {writes}회{pending ? ` · 다음 저장: ${pending}` : ""}</span>
        {["normal", "empty", "error", "slow", "other", "signedout", "legacy-array"].map(
          (value) => (
            <button
              key={value}
              onClick={() => {
                setScenario("signedout");
                setTimeout(() => setScenario(value), 10);
              }}
            >
              {value}
            </button>
          ),
        )}
        {/* 열린 시트를 유지한 채 바로 계정을 바꿔 이전 계정 작성 상태가 남는지 본다. */}
        <button onClick={() => setScenario("other")}>즉시 other 전환</button>
        <button onClick={() => injectFailure("fail")}>다음 저장 실패</button>
        <button onClick={() => injectFailure("lost")}>다음 저장 응답 유실</button>
        <button onClick={externalEdit}>다른 기기에서 수정</button>
      </aside>
      <Routes>
        <Route path="/household" element={<HouseholdPage />} />
        <Route path="/record" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
}
createRoot(document.getElementById("root")!).render(<FixtureApp />);
