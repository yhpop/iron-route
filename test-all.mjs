#!/usr/bin/env node
// Both statuses remain real. A known historical failure is never converted into success.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const current=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/*.test.mjs'],{cwd:root,stdio:'inherit'});
const historical=spawnSync('npm',['test'],{cwd:new URL('./project/work/',import.meta.url),stdio:'inherit'});
if(current.error) console.error(current.error.message);
if(historical.error) console.error(historical.error.message);
console.log(JSON.stringify({currentRouteSuiteExit:current.status,historicalSuiteExit:historical.status,allPassed:current.status===0 && historical.status===0}));
process.exitCode=current.status===0 && historical.status===0 ? 0 : 1;
