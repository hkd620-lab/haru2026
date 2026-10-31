import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BrowserRouter,
  Link,
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { Line, LineChart } from "recharts";

const h = React.createElement;
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(frontend, "dist/assets");
const require = createRequire(import.meta.url);
const manifest = JSON.parse(fs.readFileSync(path.join(frontend, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(frontend, "package-lock.json"), "utf8"));
const lockedVersion = (name) => lock.packages[`node_modules/${name}`]?.version;
const majorMinorPatch = (version) => version.split(".").map(Number);
const atLeast = (version, minimum) => {
  const [a, b] = [majorMinorPatch(version), majorMinorPatch(minimum)];
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

test("Router 8 전제: react-router-dom이 없고 React·Vite 최소 버전을 lock이 지킨다", () => {
  assert.equal(manifest.dependencies["react-router-dom"], undefined);
  assert.equal(lockedVersion("react-router-dom"), undefined);
  assert.equal(majorMinorPatch(lockedVersion("react-router"))[0], 8);
  assert.ok(atLeast(lockedVersion("react"), "19.2.7"));
  assert.equal(lockedVersion("react"), lockedVersion("react-dom"));
  assert.equal(majorMinorPatch(lockedVersion("vite"))[0], 8);
  assert.equal(React.version, lockedVersion("react"));
});

test("소스는 제거된 react-router-dom을 import하지 않는다", () => {
  const offenders = sourceFiles(path.join(frontend, "src")).filter((file) =>
    /['"]react-router-dom['"]/.test(fs.readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, []);
});

test("앱 라우터는 선언형 BrowserRouter를 유지하고 framework·data router를 들이지 않는다", () => {
  const app = fs.readFileSync(path.join(frontend, "src/app/App.tsx"), "utf8");
  assert.match(app, /<BrowserRouter>/);
  assert.doesNotMatch(app, /createBrowserRouter|RouterProvider|HydratedRouter/);
  assert.equal(typeof BrowserRouter, "function");
  assert.equal(manifest.dependencies["@react-router/dev"], undefined);
});

test("중첩 경로·동적 파라미터·검색 파라미터가 v8 컨텍스트로 전달된다", () => {
  const Layout = () => h("main", null, h(Outlet));
  const Detail = () => {
    const { id } = useParams();
    const [params] = useSearchParams();
    const location = useLocation();
    return h("p", null, `${id}|${params.get("tab")}|${location.pathname}`);
  };
  const markup = renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: ["/legal/cases/42?tab=docs"] },
      h(
        Routes,
        null,
        h(Route, { path: "/", element: h(Layout) }, h(Route, { path: "legal/cases/:id", element: h(Detail) })),
      ),
    ),
  );
  assert.equal(markup, "<main><p>42|docs|/legal/cases/42</p></main>");
});

test("Link는 href를 만들고 없는 경로는 catch-all로 간다", () => {
  const markup = renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: ["/missing/path"] },
      h(
        Routes,
        null,
        h(Route, { path: "/home", element: h("p", null, "home") }),
        h(Route, { path: "*", element: h(Link, { to: "/home?from=x" }, "go") }),
      ),
    ),
  );
  assert.match(markup, /<a href="\/home\?from=x"[^>]*>go<\/a>/);
});

test("Navigate replace는 첫 렌더에서 대상 element를 대신 그리지 않는다", () => {
  const markup = renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: ["/old"] },
      h(
        Routes,
        null,
        h(Route, { path: "/old", element: h(Navigate, { to: "/new", replace: true }) }),
        h(Route, { path: "/new", element: h("p", null, "new") }),
      ),
    ),
  );
  assert.equal(markup, "");
});

test("라우터 밖 훅은 조용히 넘어가지 않고 오류를 낸다", () => {
  const Outside = () => {
    useNavigate();
    return null;
  };
  assert.throws(() => renderToStaticMarkup(h(Outside)), /useNavigate\(\) may be used only in the context of a <Router>/);
});

test("React.lazy와 Suspense는 lazy 경로의 fallback을 렌더한다", () => {
  const Lazy = React.lazy(() => new Promise(() => {}));
  const markup = renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: ["/lazy"] },
      h(
        React.Suspense,
        { fallback: h("p", null, "loading") },
        h(Routes, null, h(Route, { path: "/lazy", element: h(Lazy) })),
      ),
    ),
  );
  assert.match(markup, /loading/);
});

test("vite 설정은 iOS 13 레거시·모던·CSS 타깃을 명시해 유지한다", () => {
  const config = fs.readFileSync(path.join(frontend, "vite.config.ts"), "utf8");
  assert.match(config, /targets: \['ios >= 13'\]/);
  assert.match(config, /modernTargets: '[^']*safari>=12[^']*iOS>=12'/);
  assert.match(config, /cssTarget: \[[^\]]*'safari13'[^\]]*'ios13'\]/);
});

test("vite가 esbuild를 끌어오지 않으므로 시험이 쓰는 esbuild를 직접 선언한다", () => {
  assert.ok(manifest.devDependencies.esbuild);
  assert.equal(require("esbuild/package.json").version, lockedVersion("esbuild"));
});

test("빌드 산출물은 iOS 13이 파싱 못 하는 lookbehind 리터럴을 남기지 않고 webkit 접두사를 유지한다", { skip: !fs.existsSync(assets) }, () => {
  const names = fs.readdirSync(assets);
  const offenders = names.filter((name) => {
    if (!name.endsWith(".js")) return false;
    const code = fs.readFileSync(path.join(assets, name), "utf8");
    return /\(\?<[=!]/.test(code.replace(/\bRegExp\(([`"'])(?:\\.|(?!\1).)*\1/g, ""));
  });
  assert.deepEqual(offenders, []);
  const css = names.filter((name) => name.endsWith(".css")).map((name) => fs.readFileSync(path.join(assets, name), "utf8"));
  assert.ok(css.some((code) => code.includes("-webkit-backdrop-filter")));
});

test("recharts는 React 19 요소를 인식하는 react-is로 Fragment 자식을 그린다", () => {
  const rechartsRequire = createRequire(require.resolve("recharts"));
  assert.equal(rechartsRequire("react-is/package.json").version.split(".")[0], "19");
  const markup = renderToStaticMarkup(
    h(
      LineChart,
      { width: 300, height: 200, data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] },
      h(React.Fragment, null, h(Line, { dataKey: "y", isAnimationActive: false })),
    ),
  );
  assert.match(markup, /recharts-line-curve/);
});
