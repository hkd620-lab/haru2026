const {test} = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const {extractHaruLawDocumentText: extract} = require('../lib/haruLaw/haruLawDocumentCore');
const {readHaruLawDocumentText: workerRead} = require('../lib/haruLaw/haruLawDocument');
const HWP = 'application/x-hwp', HWPX = 'application/vnd.hancom.hwpx';

const {hwp,hwpx}=require('./fixtures/haruLawDocument.cjs');
const section='<hp:sec xmlns:hp="urn:fixture"><hp:p><hp:run><hp:t>첫 문단 &amp; 한글</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>둘째 문단</hp:t></hp:run></hp:p></hp:sec>';
test('TXT UTF-8·UTF-16·CP949 한글을 읽고 줄바꿈을 보존한다',async()=>{
  assert.equal(await extract('text/plain',Buffer.from('한글\r\n본문')), '한글\n본문');
  assert.equal(await extract('text/plain',Buffer.concat([Buffer.from([255,254]),Buffer.from('한글 본문','utf16le')])), '한글 본문');
  assert.equal(await extract('text/plain',Buffer.from([0xc7,0xd1,0xb1,0xdb])), '한글');
});
test('압축·비압축 HWP 5 본문 전체를 읽으며 미리보기로 대체하지 않는다',async()=>{
  for(const flags of [0,1])assert.equal((await extract(HWP,hwp('첫 문단\r표 안의 한글',flags))).trim(),'첫 문단\n표 안의 한글');
});
test('암호·배포용·DRM·손상·위장 HWP는 거부한다',async()=>{
  for(const flags of [2,4,16])await assert.rejects(extract(HWP,hwp('비공개 본문',flags)),/ATTACHMENT_CONTENT_UNREADABLE/);
  await assert.rejects(extract(HWP,hwp('손상',0,true)),/ATTACHMENT_CONTENT_UNREADABLE/);
  await assert.rejects(extract(HWP,Buffer.from('fake.hwp')),/ATTACHMENT_CONTENT_UNREADABLE/);
});
test('HWPX의 여러 문단과 XML 엔티티를 본문 순서대로 읽는다',async()=>{
  const text=await extract(HWPX,await hwpx(section));assert.match(text,/첫 문단 & 한글\n둘째 문단/);
});
test('HWPX는 파일명 정렬 대신 manifest 읽기 순서를 따르고 누락 구역은 거부한다',async()=>{
 const xml=t=>`<sec><p><run><t>${t}</t></run></p></sec>`;
 const manifest='<package><manifest><item id="first" href="section1.xml"/><item id="last" href="section0.xml"/></manifest><spine><itemref idref="first"/><itemref idref="last"/></spine></package>';
 const bytes=await hwpx(xml('나중'),{'Contents/section1.xml':xml('먼저'),'Contents/content.hpf':manifest});
 assert.match(await extract(HWPX,bytes),/^먼저\n나중/);
 await assert.rejects(extract(HWPX,await hwpx(xml('일부'),{'Contents/section1.xml':xml('누락')})),/ATTACHMENT_CONTENT_UNREADABLE/);
});
test('실제 한글의 header spine과 두 가지 href 표기를 처리하고 헤더 텍스트는 제외한다',async()=>{
 for(const prefix of ['', 'Contents/']) {
  const manifest=`<opf:package xmlns:opf="http://www.idpf.org/2007/opf/"><opf:manifest><opf:item id="header" href="${prefix}header.xml"/><opf:item id="section0" href="${prefix}section0.xml"/><opf:item id="settings" href="settings.xml"/></opf:manifest><opf:spine><opf:itemref idref="header"/><opf:itemref idref="section0"/><opf:itemref idref="settings"/></opf:spine></opf:package>`;
  const bytes=await hwpx(section,{'Contents/content.hpf':manifest,'Contents/header.xml':'<head><t>본문이 아닌 글꼴 설명</t></head>','settings.xml':'<settings/>'});
  const text=await extract(HWPX,bytes);assert.match(text,/첫 문단/);assert.doesNotMatch(text,/글꼴 설명/);
 }
});
test('상대 본문은 Contents 기준으로만 읽고 루트 동명 파일에 가려지지 않는다',async()=>{
 const manifest='<package><manifest><item id="section0" href="section0.xml"/></manifest><spine><itemref idref="section0"/></spine></package>';
 const bytes=await hwpx(section,{'Contents/content.hpf':manifest,'section0.xml':'<sec><p><t>루트 위장 본문</t></p></sec>'});
 const text=await extract(HWPX,bytes);assert.match(text,/첫 문단/);assert.doesNotMatch(text,/위장/);
 const missing=await hwpx(section,{'Contents/content.hpf':manifest.replace('href="section0.xml"','href="section9.xml"'),'section9.xml':'<sec><p><t>루트 우회</t></p></sec>'});
 await assert.rejects(extract(HWPX,missing),/ATTACHMENT_CONTENT_UNREADABLE/);
});
test('외부·상위 경로·없는 spine 참조와 중복 본문은 계속 거부한다',async()=>{
 for(const href of ['../section0.xml','https://example.invalid/section0.xml','/Contents/section0.xml','missing.xml']) {
  const manifest=`<package><manifest><item id="section0" href="${href}"/></manifest><spine><itemref idref="section0"/></spine></package>`;
  await assert.rejects(extract(HWPX,await hwpx(section,{'Contents/content.hpf':manifest})),/ATTACHMENT_CONTENT_UNREADABLE/);
 }
 const manifest='<package><manifest><item id="section0" href="Contents/section0.xml"/></manifest><spine><itemref idref="section0"/><itemref idref="section0"/></spine></package>';
 await assert.rejects(extract(HWPX,await hwpx(section,{'Contents/content.hpf':manifest})),/ATTACHMENT_CONTENT_UNREADABLE/);
});
test('HWPX 외부 엔티티·손상 XML·일반 ZIP·과도한 압축 확장은 거부한다',async()=>{
  for(const xml of ['<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><sec><t>&x;</t></sec>','<sec><t>broken</sec>','<sec><t>'+ '가'.repeat(6000000)+'</t></sec>'])
    await assert.rejects(extract(HWPX,await hwpx(xml)),/ATTACHMENT_CONTENT_UNREADABLE/);
  const zip=new JSZip();zip.file('memo.txt','본문');await assert.rejects(extract(HWPX,await zip.generateAsync({type:'nodebuffer'})),/ATTACHMENT_CONTENT_UNREADABLE/);
});
test('빈 문서·바이너리 TXT·과도한 텍스트를 조용히 잘라 읽지 않는다',async()=>{
  for(const bytes of [Buffer.alloc(0),Buffer.from([0,1,2]),Buffer.from('a'.repeat(200001))])await assert.rejects(extract('text/plain',bytes),/ATTACHMENT_CONTENT_UNREADABLE/);
});
test('실제 worker가 본문을 반환하고 마감시간 초과·읽기 실패는 안전한 오류로 끝난다',async()=>{
  assert.equal(await workerRead('text/plain',Buffer.from('worker 한글'),Date.now()+5000),'worker 한글');
  assert.match(await workerRead(HWP,hwp('worker HWP',1),Date.now()+5000),/worker HWP/);
  assert.match(await workerRead(HWPX,await hwpx(section),Date.now()+5000),/둘째 문단/);
  await assert.rejects(workerRead(HWP,Buffer.from('bad'),Date.now()+5000),/^Error: ATTACHMENT_CONTENT_UNREADABLE$/);
  await assert.rejects(workerRead('text/plain',Buffer.from('본문'),Date.now()-1),/ATTACHMENT_CONTENT_UNREADABLE/);
});
module.exports={hwp,hwpx};
