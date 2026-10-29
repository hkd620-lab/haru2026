import "../../src/styles/index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { HouseholdPage } from "../../src/app/pages/HouseholdPage";
import { setScenario, useWriteCount } from "./mocks";
function Destination() {
  const location = useLocation();
  return <p>기존 기록 작성창 진입: {JSON.stringify(location.state)}</p>;
}
function FixtureApp() {
  const writes = useWriteCount();
  return (
    <MemoryRouter initialEntries={["/household"]}>
      <aside style={{ padding: 8, fontSize: 11 }}>
        합성 529건 · 운영 연결 없음 · 쓰기 {writes}회{" "}
        {["normal", "empty", "error", "slow", "other", "signedout"].map(
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
      </aside>
      <Routes>
        <Route path="/household" element={<HouseholdPage />} />
        <Route path="/record" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
}
createRoot(document.getElementById("root")!).render(<FixtureApp />);
