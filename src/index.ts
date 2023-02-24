import * as P from "./checker/PChecker.js";
import net from "net";

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
let p2 = new P.PChecker("152.26.229.66", "9443", "5000");
let check = await p2.check();
console.log(check);

console.timeEnd();
process.kill(process.pid);

// console.time();
// let p1 = await pChecks.proxyCheck("204.2.218.145", "8080", 5000);
// console.log(p1);
// console.timeEnd();
// process.kill(process.pid);