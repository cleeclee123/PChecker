import * as PChecker from "./checker/PChecker.js";
import { PCheckerOptions } from "./checker/types.js";
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

// const proxyOptions = {
//   host: "8.209.243.173",
//   port: "80",
//   timeout: "10000",
//   publicIPAddress: " 64.189.16.27",
//   runProxyLocation: true,
// } as PCheckerOptions;

// const p1 = new PChecker.PChecker(proxyOptions);

// let check1 = await p1.checkEssential();

// console.log(check1);

let arrayAsString = `["186.121.235.66", "8080"]`
let array = JSON.parse(arrayAsString);

console.log(array)

// mb used
let used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(used);

console.timeEnd();

process.kill(process.pid);
