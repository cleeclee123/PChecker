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

let p = new PFast.PCheckerFast("8.219.176.202", "8080", "10000", "130.126.255.240");
let check = await p.check();

// mb used
let used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(used)

console.log(check);

console.timeEnd();

process.kill(process.pid);



// let host = "201.221.26.179";
// let port = 8080;

// let socket = net.connect({ host: host, port: port });
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
