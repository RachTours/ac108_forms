import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const root=resolve(import.meta.dirname,"../../../..");
function rehearsal(fail="") {
 mkdirSync(join(root,"output"),{recursive:true});
 const directory=mkdtempSync(join(root,"output","groups-build-script-"));
 const runner=join(directory,"npm.mjs"),log=join(directory,"calls.log");
 writeFileSync(runner, 'import fs from "node:fs"; const a=process.argv.slice(2); fs.appendFileSync(process.env.GROUPS_BUILD_TEST_LOG,JSON.stringify(a)+"\\n"); if(a.join(" ")===process.env.GROUPS_BUILD_TEST_FAIL)process.exit(9);');
 const env={...process.env,npm_execpath:runner,GROUPS_BUILD_TEST_LOG:log,GROUPS_BUILD_TEST_FAIL:fail};
 for(const key of Object.keys(env))if(key.startsWith("BOOTSTRAP_"))delete env[key];
 const result=spawnSync(process.execPath,["scripts/build-hostinger-api.mjs"],{cwd:root,env,encoding:"utf8"});
 const calls=readFileSync(log,"utf8").trim().split("\n").map(line=>JSON.parse(line));
 return {result,calls};
}
test("failed API compilation stops deployment before database operations",()=>{
 const {result,calls}=rehearsal("run build --workspace @reviewroom/api");
 assert.equal(result.status,9);assert.ok(calls.some(a=>a.includes("@reviewroom/api")));
 assert.ok(!calls.some(a=>a.some(v=>v==="db:migrate"||v==="db:assignment-preflight")));
});
test("successful deployment compiles all packages before one migration attempt",()=>{
 const {result,calls}=rehearsal();assert.equal(result.status,0,result.stderr);
 assert.deepEqual(calls.map(a=>a.join(" ")),["run db:generate","run build --workspace @reviewroom/contracts","run build --workspace @reviewroom/domain","run build --workspace @reviewroom/api","run db:assignment-preflight --workspace @reviewroom/api","run db:migrate"]);
});
