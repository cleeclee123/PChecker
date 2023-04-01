import * as P from "./checker/PChecker.js";
import * as PFast from "./checker/PCheckerFaster.js";
import net from "net";
import tls from "tls";
import http from "http";
import https from "http";
import * as dotenv from "dotenv";
import fetch from "node-fetch";
import os from "os";
import HttpsProxyAgent from "https-proxy-agent";
import { Readable } from "stream";

// os.freemem();

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

// let p2 = new P.PChecker("65.0.160.35", "8080", "5000");
// let check = await p2.check();

let p = new PFast.PCheckerFast("20.69.79.158", "8443", "5000", "130.126.255.240");
let check = await p.check();

// mb used
let used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(used)

console.log(check);

console.timeEnd();

process.kill(process.pid);

// let host = "1.214.62.71";
// let port = 8000;

// let socket = net.connect({ host: host, port: 8080 });
// let payload = `CONNECT ${host}:${port} HTTP/1.1\r\n`;

// let buffer = [] as any[];

// socket.on("connect", () => {
//   socket.write(`${payload}\r\n`);
// });

// socket.on("data", (chuck) => {
//   buffer.push(chuck);
//   console.log(chuck.toString())
// });

// socket.on("end", () => {
//   console.log("end")
// });

// socket.on("close", () => {
//   console.log("close")
// });

// socket.on("error", (error) => {
//   console.log(error);
// });

// console.log(buffer)

