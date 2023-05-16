import * as PChecker from "./checker/PChecker.js";
import * as PCheckerEssential from "./checker/PCheckerEssential.js";
import { MyConcurrentPromiseQueue } from "mypqueue";
import os from "os";

os.freemem();

// let t = await pChecks.testGoogle("52.79.43.141", "80");
// let t = await pChecks.httpsCheck("20.24.43.214", "8123", 5000);
// console.log(t);

// console.time();
// console.log(await pChecks.proxyCheck("104.223.135.178", "10000", 5000));
// console.timeEnd();
// process.kill(process.pid);

// console.time();
// console.log(await pChecks.pingCheck("104.238.183.155", "8888", 10000));
// console.timeEnd();
// process.kill(process.pid);

// console.time();
// console.log(await pChecks.getLocation("104.238.183.155", "8888", 10000));
// console.timeEnd();
// process.kill(process.pid);

// console.time();
// console.log(await pChecks.getMyPublicIP());
// console.timeEnd();
// process.kill(process.pid);

// console.time();
// let p = new P.PChecker("104.223.135.178", "10000", 5000);
// console.log(await p.check())
// console.timeEnd();
// process.kill(process.pid);

console.time();

// let p = new PChecker.PChecker("24.156.198.241", "8080", "10000");
// let p = new PChecker.PChecker("20.241.236.196", "3128", "10000");

// let p1 = new PChecker.PChecker("34.98.65.22", "8443", "5000");
// let p1 = new PChecker.PChecker("34.98.65.22", "5223", "5000");

let p1 = new PChecker.PChecker();
p1.setHost("158.160.56.149");
p1.setPort("8080");
p1.setTimeout("5000");
p1.setPublicIP("73.110.181.186")

// 158.160.56.149:8080

let check1 = await p1.checkContent();

console.log(check1);

// mb used
let used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(used);

console.timeEnd();

process.kill(process.pid);

