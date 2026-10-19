import fs from 'node:fs';
import os from 'node:os';
import {suite} from './bench';
const results=await suite(message=>console.log(message));
fs.writeFileSync(process.argv[2],JSON.stringify({runtime:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model,results},null,2)+'\n');
console.log('Node suite complete');
