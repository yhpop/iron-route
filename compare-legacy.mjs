#!/usr/bin/env node
import fs from 'node:fs';
import {compareLegacy} from './lib/legacy.mjs';
const [log='evidence/legacy-full-suite.log',exit='evidence/legacy-full-suite.exit']=process.argv.slice(2);
try {
  const r=compareLegacy(fs.readFileSync(log,'utf8'),Number(fs.readFileSync(exit,'utf8').trim()),JSON.parse(fs.readFileSync(new URL('fixtures/historical-baseline.json',import.meta.url))));
  console.log(JSON.stringify(r,null,2));
  if(!r.sameHistoricalFailures) process.exitCode=1;
} catch(error) {console.error(error.message);process.exitCode=1;}
