import test from "node:test";
import assert from "node:assert/strict";
import { SCRAMJET_PORT_FEATURES, getScramjetPortReport } from "../src/compat/scramjet-port.js";

test("Scramjet port report identifies unfinished subsystems accurately",()=>{
 const report=getScramjetPortReport();
 assert.equal(report.complete,false);
 assert.equal(report.features.length,SCRAMJET_PORT_FEATURES.length);
 assert.ok(report.counts["not-implemented"]>0);
 assert.ok(report.features.some(item=>item.id==="script-runtime"&&item.status==="adapter-required"));
});
