// 하네스 서버만 따로 띄워 두는 도구 — 여러 번 실행할 때 기동 시간을 아낀다. 종료는 Ctrl+C.
import { startServer, BASE_URL } from './lib.mjs';
const server = await startServer();
console.log(server.reused ? '이미 실행 중:' : '하네스 서버 시작:', BASE_URL);
if (!server.reused) await new Promise(() => {});
