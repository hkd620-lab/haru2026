const fs = require('fs');
const path = './src/index.ts';

let code = fs.readFileSync(path, 'utf8');

// 1. 파라미터 (data, context) 부분을 (request) 로 변경
code = code.replace(/\(\s*data[^,]*,[^)]*context[^)]*\)\s*=>/g, '(request) =>');

// 2. context.auth 를 request.auth 로 변경
code = code.replace(/context\.auth/g, 'request.auth');

// 3. 에러가 난 const { prompt } = data; 부분을 request.data 로 변경
code = code.replace(/=\s*data\s*;/g, '= request.data;');

fs.writeFileSync(path, code);
console.log("✅ V2 문법에 맞게 index.ts 자동 수정 완료!");
