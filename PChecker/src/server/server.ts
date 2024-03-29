"use strict";

import express, { Request, Response } from "express";
import compression from "compression";
import cors from "cors";
import { PCheckerOptions, ProxyInfoEssential } from "../checker/types.js";
import * as P from "../checker/PChecker.js";
import { MyConcurrentPromiseQueue } from "../checker/pqueue.js";
import { StatusMonitor } from "./expressMonitor.js";
import redis from "redis";

export type ProxyStore = Partial<ProxyInfoEssential> & { timesSeen: number };

const app = express();
app.use(cors());
app.use(compression());

const localport = 6969;

const redisPort = 6379;
const redisHost = "127.0.0.1";
const redisClient = redis.createClient({
  socket: {
    port: redisPort,
    host: redisHost,
  },
});
(async () => {
  redisClient.on("error", (error) => console.error(`Redis Error : ${error}`));

  redisClient.on("connect", () => console.log("Redis Connected"));

  await redisClient.connect();
})();

const queue = new MyConcurrentPromiseQueue({
  maxNumberOfConcurrentPromises: 250,
});

function validateIPAddress(req: Request, res: Response, next: Function) {
  const proxyHost = req.query.host;

  function validIPaddress(ipaddress: string) {
    if (
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        ipaddress
      )
    ) {
      return true;
    }
    return false;
  }

  if (!validIPaddress(`${proxyHost}`)) {
    res.status(400).send({ data: "Bad Ip Address" });
    return;
  }

  next();
}

function validatePortNumber(req: Request, res: Response, next: Function) {
  const proxyPort = req.query.port;

  function isValidPort(port: any) {
    if (isNaN(port)) return false;
    const portNumber = parseInt(port, 10);
    return (
      Number.isInteger(portNumber) && portNumber > 0 && portNumber <= 65535
    );
  }

  if (!isValidPort(String(proxyPort))) {
    res.status(400).send({ data: "Invalid port number" });
    return;
  }

  next();
}

function validateTimeout(req: Request, res: Response, next: Function) {
  const proxyTimeout = req.query.to;

  function isValidTimeout(timeout: any) {
    if (isNaN(timeout)) return false;
    const timeoutValue = parseInt(timeout, 10);
    return Number.isInteger(timeoutValue) && timeoutValue >= 0;
  }

  if (!isValidTimeout(String(proxyTimeout))) {
    res.status(400).send({ data: "Invalid timeout value" });
    return;
  }

  next();
}

// status page, path: /status
const statusMonitor = new StatusMonitor();
statusMonitor.mount(app, localport);

app.get("/", (req: Request, res: Response) => {
  res.json({ hello: "welcome to the PChecker API" });
});

app.get(
  "/checkessential",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker({
      host: proxyHost,
      port: proxyPort,
      timeout: proxyTimeout,
    } as PCheckerOptions);
    p.turnOffLogger();

    const currentProxy = `${proxyHost}:${proxyPort}`;
    try {
      queue
        .addPromise(() => p.checkEssential())
        .then(async (result) => {
          const jsonResponse = JSON.parse(JSON.stringify(result)) as ProxyStore;
          if (jsonResponse.hasOwnProperty("error")) {
            res.json(result);
            return;
          }

          const exists: number = await redisClient.exists(currentProxy);
          if (exists === 1) {
            console.log("exists")
            jsonResponse.timesSeen = Number(jsonResponse.timesSeen) + 1;
            await redisClient.set(
              `${proxyHost}:${proxyPort}`,
              JSON.stringify(jsonResponse),
              {
                EX: 300, 
              }
            );
          } else {
            console.log("first")
            jsonResponse.timesSeen = 1;
            await redisClient.set(
              `${proxyHost}:${proxyPort}`,
              JSON.stringify(jsonResponse),
              {
                EX: 300,
              }
            );
          }
        });
    } catch (error) {
      res.json({
        error: error,
        proxyString: `${proxyHost}:${proxyPort}`,
      } as ProxyInfoEssential);
    }
  }
);

app.get(
  "/checkcontent",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker({
      host: proxyHost,
      port: proxyPort,
      timeout: proxyTimeout,
    } as PCheckerOptions);
    queue
      .addPromise(() => p.checkContent())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkdnsleak",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker({
      host: proxyHost,
      port: proxyPort,
      timeout: proxyTimeout,
    } as PCheckerOptions);
    queue
      .addPromise(() => p.checkDNSLeak())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkwebrtcleak",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker({
      host: proxyHost,
      port: proxyPort,
      timeout: proxyTimeout,
    } as PCheckerOptions);
    queue
      .addPromise(() => p.checkWebRTCLeak())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/everything",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker({
      host: proxyHost,
      port: proxyPort,
      timeout: proxyTimeout,
    } as PCheckerOptions);
    queue
      .addPromise(() => p.checkAll())
      .then((result) => {
        res.json(result);
      });
  }
);

app.listen(localport, () => {
  console.log(`Running at http://localhost:${localport}`);
});
