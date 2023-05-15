import express, { Request, Response } from "express";
import * as P from "../checker/PChecker.js";
import * as pq from "mypqueue";

const app = express();
const localport = 8181;
const queue = new pq.MyConcurrentPromiseQueue();

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

app.get("/", (req: Request, res: Response) => {
  res.json({ hello: "hello" });
});

app.get(
  "/checkessential",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkEssential())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkanonymity",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkAnonymity())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkhttps",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkHTTPS())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkcontent",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkContent())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkgoogle",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkGoogle())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkdnsleak",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkDNSLeak())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checklocation",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkLocation())
      .then((result) => {
        res.json(result);
      });
  }
);

app.get(
  "/checkwebrtcleak",
  validateIPAddress,
  validatePortNumber,
  (req, res) => {
    const proxyHost = String(req.query.host);
    const proxyPort = String(req.query.port);
    const proxyTimeout = String(req.query.to);

    const p = new P.PChecker(proxyHost, proxyPort, proxyTimeout);
    queue
      .addPromise(() => p.checkWebRTCLeak())
      .then((result) => {
        res.json(result);
      });
  }
);

app.listen(localport, () => {
  console.log("Running at localhost:8181");
});
