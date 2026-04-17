// export_logs.js
// This script fetches conversation logs from Firestore and writes them as markdown files
// in the HARU2026 작업일지 directory.

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK using the service account key
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Destination directory for work logs
const logsDir = path.resolve(__dirname, '..', '작업일지');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

async function exportLogs() {
  const snapshot = await db.collection('conversations').get();
  console.log(`Found ${snapshot.size} conversation documents.`);
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const timestamp = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date();
    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `${dateStr}_${timeStr}_log.md`;
    const filePath = path.join(logsDir, filename);
    const markdown = `# Conversation Log\n\n- **Source**: ${data.source || 'unknown'}\n- **Category**: ${data.category || 'none'}\n- **User ID**: ${data.uid || 'unknown'}\n- **Timestamp**: ${timestamp.toISOString()}\n\n---\n\n${data.content || ''}\n`;
    fs.writeFileSync(filePath, markdown, 'utf8');
    console.log(`Exported ${doc.id} → ${filename}`);
  }
  console.log('Export completed.');
}

exportLogs().catch(err => {
  console.error('Error exporting logs:', err);
});
