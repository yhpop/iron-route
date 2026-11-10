#!/usr/bin/env node
import {replayRoute} from './lib/replay.mjs';
const [route,...args]=process.argv.slice(2);
try {
  if(!route || args.length>1 || (args[0] && !args[0].startsWith('--fixture-root='))) throw new Error('Usage: node run-route.mjs <route> [--fixture-root=<directory>]');
  const options=args.length ? {fixtureRoot:args[0].slice('--fixture-root='.length)} : {};
  console.log(JSON.stringify(await replayRoute(route,options)));
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
