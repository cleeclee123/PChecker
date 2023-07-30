import * as PChecker from "./checker/PChecker.js";
import { PCheckerOptions } from "./checker/types.js";
import http from "http";
import os from "os";
import tls from "tls";
import redis, { RedisClientType } from "redis";

import * as dotenv from "dotenv";

os.freemem();
dotenv.config();

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

const proxyOptions = {
  host: "64.225.4.81",
  port: "9995",
  timeout: "10000",
  publicIPAddress: "64.189.16.144",
  // sitesToCheck: [
  //   "https://google.com",
  //   "https://finance.yahoo",
  //   "https://www.google.com/finance",
  // ],
  // runProxyLocation: true,
} as PCheckerOptions;

const p1 = new PChecker.PChecker(proxyOptions);

let check1 = await p1.checkDNSLeak_PythonScript(10, false);

console.log(check1);

//////////////////////////////////////////////////////////////
// Redis

// let redisClient: RedisClientType;

// (async () => {
//   redisClient = redis.createClient();

//   redisClient.on("error", (error) => console.error(`Error : ${error}`));

//   await redisClient.connect();
// })();


//////////////////////////////////////////////////////////////
// Test HTTP Requests

const httpReqCleanup = (reqObj: http.ClientRequest) => {
  reqObj.on("error", (error) => {
    console.log("http error");
    console.log(error);
    reqObj.destroy();
  });

  reqObj.on("close", () => {
    console.log("http closed");
  });

  reqObj.end();

  return reqObj;
};

async function testNewJudge() {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      host: "186.121.235.222",
      port: 8080,
      path: "https://bash.ws/dnsleak/test/2647048?json"
    };

    const resObject = http.request(reqOptions, (res) => {
        const start = new Date().getTime();

        if (res.statusCode !== 200) {
          console.log(`Non-200 Status Code: ${res.statusCode}`)
          res.resume();
          res.destroy();
        }

        let test1: Buffer[] = [];
        res.on("data", (data) => {
          test1.push(data);
        });

        res.on("end", () => {
          resolve(Buffer.concat(test1).toString());
        });

        res.on("error", (error) => {
          console.log(error);
        });

        res.on("close", () => {
          console.log(`Socket closed, Res: ${new Date().getTime() - start} ms`);
        });
      }
    );

    httpReqCleanup(resObject);
  });
}

// console.log(await testNewJudge());

// mb used
let used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(used);

console.timeEnd();

process.kill(process.pid);
