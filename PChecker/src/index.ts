import * as PChecker from "./checker/PChecker.js";
import { PCheckerOptions } from "./checker/types.js";
import http from "http";
import os from "os";
import tls from "tls";

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

const proxyOptions = {
  host: "192.241.238.167",
  port: "31028",
  timeout: "10000",
  // runProxyLocation: true,
} as PCheckerOptions;

const p1 = new PChecker.PChecker(proxyOptions);

let check1 = await p1.checkEssential();
console.log(check1);

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
      host: "198.58.101.166",
      port: 6969,
      path: "/",
      method: "GET",
      headers: {
        "Host": "198.58.101.166",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
      },
    };

    const resObject = http.get(reqOptions, (res) => {
      if (res.statusCode !== 200) {
        console.log(res.statusCode);
        res.destroy();
      }

      res.setEncoding("utf8");
      let responseData = [] as string[];
      res.on("data", (data) => {
        responseData.push(data);
      });

      res.on("end", () => {});

      res.on("error", (error) => {
        console.log(error);
        res.destroy();
      });

      res.on("close", () => {
        resolve(responseData);
      });
    });

    httpReqCleanup(resObject);
  });
}

// console.log(await testNewJudge());

// mb used
let used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(used);

console.timeEnd();

process.kill(process.pid);
