import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const out = process.argv[2];
const deps = process.env.HARU_BENCH_DEPS;
if (!out || !deps) throw Error('Usage: HARU_BENCH_DEPS=/path/node_modules node prepare.mjs /tmp/output');
fs.mkdirSync(out, { recursive: true });
const require = createRequire(path.join(deps, 'esbuild/package.json'));
const { build } = require('./lib/main.js');
const source = fs.readFileSync(path.join(repo, 'frontend/src/app/pages/SayuPage.tsx'), 'utf8');
const helper = source.match(/function getRecordSourceText\([\s\S]*?\n\}/)?.[0];
const call = source.match(/const recommendations = (getAssistantRecommendations\([\s\S]*?\n          \));/)?.[1];
if (!helper || !call) throw Error('Source extraction failed');
const util = path.join(repo, 'frontend/src/app/utils/assistantRecommendations.ts');
const adapters = path.join(repo, 'frontend/src/app/assistants/sayuAdapters.ts');
const structured = path.join(repo, 'frontend/src/app/utils/structuredAssistantRecords.ts');
fs.writeFileSync(path.join(out, 'source-adapter.ts'), `
import {getAssistantRecommendations as actual, buildRecommendationTextFromFields} from ${JSON.stringify(util)};
import {isStructuredMeasurementFieldOfFormat, GROWTH_TIMELINE_FORMAT_KEY, growthTimelineSourceText} from ${JSON.stringify(adapters)};
import {isStructuredAssistantPrefix, structuredAssistantSourceText} from ${JSON.stringify(structured)};
export let calls=0;
export function resetCalls(){calls=0;}
export let lastLength=0;
function getAssistantRecommendations(text, formats){calls++;lastLength=text.length;return actual(text,formats);}
${helper}
export function detail(record,sayuModalState){const formatKey=sayuModalState.formatKey||'';if(!record||!formatKey)return [];return ${call};}
export {actual as recommend, buildRecommendationTextFromFields};
`);
for (const name of ['bench.ts', 'browser.tsx', 'node.ts']) fs.copyFileSync(path.join(here, name), path.join(out, name));
const common = { bundle: true, nodePaths: [deps], logLevel: 'warning', define: {'process.env.NODE_ENV': '"production"'} };
await build({...common, entryPoints:[path.join(out,'browser.tsx')], outfile:path.join(out,'bundle.js'), platform:'browser', format:'esm', minify:true});
await build({...common, entryPoints:[path.join(out,'node.ts')], outfile:path.join(out,'node.mjs'), platform:'node', format:'esm'});
fs.writeFileSync(path.join(out,'index.html'), '<!doctype html><meta charset="utf-8"><title>#279 synthetic performance audit</title><h1>#279 합성 입력 성능 계측</h1><p>실제 추천 함수·추출한 상세 계산식 사용. 운영 앱·실기기 E2E가 아닙니다.</p><button id="run">계측 시작</button><p id="status">대기</p><pre id="results"></pre><div id="probe"></div><script type="module" src="/bundle.js"></script>');
console.log(JSON.stringify({repo, out, helperLines:helper.split('\n').length, callLines:call.split('\n').length}));
