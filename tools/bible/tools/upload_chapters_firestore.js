const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const SERVICE_ACCOUNT = path.resolve("tools/secrets/serviceAccountKey.json");
const FINAL_DIR = path.resolve("tools/final");
const COLLECTION = process.env.FS_COLLECTION || "chapters";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function parseFinalFile(txt) {
  const lines = txt.split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) fail("File too short");

  const header = lines[0];
  const title = lines[1];

  // Header
  // #BOOK=Genesis|BOOKCODE=gen|CHAPTER=1|VERSION=KJV|LANGPAIR=EN-KO|ARCHAIC=INLINE_PARENS
  const h = {};
  header.slice(1).split("|").forEach(kv => {
    const [k, ...rest] = kv.split("=");
    h[k] = rest.join("=");
  });

  // Title
  // T|EN=Genesis 1|KO=창세기 1장
  const tParts = title.split("|");
  const titleEn = tParts[1]?.replace(/^EN=/, "") ?? "";
  const titleKo = tParts[2]?.replace(/^KO=/, "") ?? "";

  // Verses
  const verses = [];
  for (let i = 2; i < lines.length; i++) {
    const ln = lines[i];
    // V|N=1|EN=...|KO=...
    const parts = ln.split("|");
    if (parts[0] !== "V") continue;
    const n = parseInt(parts[1].replace(/^N=/, ""), 10);
    const en = parts[2].replace(/^EN=/, "");
    const ko = parts[3].replace(/^KO=/, "");
    verses.push({ n, en, ko });
  }

  const book = h.BOOK || "";
  const bookCode = h.BOOKCODE || "";
  const chapter = parseInt(h.CHAPTER || "0", 10);

  return {
    book,
    bookCode,
    chapter,
    version: h.VERSION || "",
    langPair: h.LANGPAIR || "",
    archaic: h.ARCHAIC || "",
    titleEn,
    titleKo,
    verses,
    raw: lines.join("\n"),
  };
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT)) {
    fail(`Missing service account: ${SERVICE_ACCOUNT}`);
  }
  if (!fs.existsSync(FINAL_DIR)) {
    fail(`Missing dir: ${FINAL_DIR}`);
  }

  const serviceAccount = require(SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  const db = admin.firestore();

  // 대상 파일: gen_001.txt 같은 형태
  const files = fs.readdirSync(FINAL_DIR)
    .filter(f => /^[a-z0-9]+_\d{3}\.txt$/.test(f))
    .sort();

  if (files.length === 0) fail("No final files found in tools/final");

  console.log(`INFO: uploading ${files.length} files to collection '${COLLECTION}'`);

  // 문서당 1 write라서 배치(500 제한) 넉넉함. :contentReference[oaicite:2]{index=2}
  let batch = db.batch();
  let opCount = 0;
  let committed = 0;

  for (const f of files) {
    const full = path.join(FINAL_DIR, f);
    const txt = fs.readFileSync(full, "utf-8");
    const data = parseFinalFile(txt);

    const docId = f.replace(/\.txt$/, ""); // gen_001
    const ref = db.collection(COLLECTION).doc(docId);

    batch.set(ref, data, { merge: true });
    opCount++;

    if (opCount === 450) { // 여유 있게 커밋
      await batch.commit();
      committed += opCount;
      console.log(`OK: committed ${committed}`);
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
    committed += opCount;
    console.log(`OK: committed ${committed}`);
  }

  console.log("PASS: upload complete");
}

main().catch(e => fail(e?.stack || String(e)));
