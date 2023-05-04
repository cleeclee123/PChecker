import express, { Request, Response } from "express";
import * as P from "../checker/PChecker.js";

const app = express();
const localport = 8181;

// implement object pool later
// const checker = new P.PChecker()
// const host: string= "";
// const port: string = "";
// const timeout: string = "";
// const publicIP: string = "";
// const username: string = "";
// const password: string = "";

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
  "/checkanonymity",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  async (req: Request, res: Response) => {
    try {
      let proxyHost = req.query.host;
      let proxyPort = req.query.port;
      let proxyTimeout = req.query.to;
      // let proxyPublicIP = req.query.pip;
      // let proxyUsername = req.query.un;
      // let proxyPassword = req.query.pw;

      let p = new P.PChecker(
        String(proxyHost),
        String(proxyPort),
        String(proxyTimeout)
        // String(proxyPublicIP),
        // String(proxyUsername),
        // String(proxyPassword)
      );

      let check = await p.checkAnonymity();
      res.send({ data: check });
    } catch (error) {
      res.send({ data: error });
    }
  }
);

app.get(
  "/checkhttps",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  async (req: Request, res: Response) => {
    try {
      let proxyHost = req.query.host;
      let proxyPort = req.query.port;
      let proxyTimeout = req.query.to;
      // let proxyPublicIP = req.query.pip;
      // let proxyUsername = req.query.un;
      // let proxyPassword = req.query.pw;

      let p = new P.PChecker(
        String(proxyHost),
        String(proxyPort),
        String(proxyTimeout)
        // String(proxyPublicIP),
        // String(proxyUsername),
        // String(proxyPassword)
      );

      let check = await p.checkHTTPS();
      res.send({ data: check });
    } catch (error) {
      res.send({ data: error });
    }
  }
);

app.get(
  "/checkcontent",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  async (req: Request, res: Response) => {
    try {
      let proxyHost = req.query.host;
      let proxyPort = req.query.port;
      let proxyTimeout = req.query.to;
      // let proxyPublicIP = req.query.pip;
      // let proxyUsername = req.query.un;
      // let proxyPassword = req.query.pw;

      let p = new P.PChecker(
        String(proxyHost),
        String(proxyPort),
        String(proxyTimeout)
        // String(proxyPublicIP),
        // String(proxyUsername),
        // String(proxyPassword)
      );

      let check = await p.checkContent();
      res.send({ data: check });
    } catch (error) {
      res.send({ data: error });
    }
  }
);

app.get(
  "/checkgoogle",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  async (req: Request, res: Response) => {
    try {
      let proxyHost = req.query.host;
      let proxyPort = req.query.port;
      let proxyTimeout = req.query.to;
      // let proxyPublicIP = req.query.pip;
      // let proxyUsername = req.query.un;
      // let proxyPassword = req.query.pw;

      let p = new P.PChecker(
        String(proxyHost),
        String(proxyPort),
        String(proxyTimeout)
        // String(proxyPublicIP),
        // String(proxyUsername),
        // String(proxyPassword)
      );

      let check = await p.checkGoogle();
      res.send({ data: check });
    } catch (error) {
      res.send({ data: error });
    }
  }
);

app.get(
  "/checkdnsleak",
  validateIPAddress,
  validatePortNumber,
  validateTimeout,
  async (req: Request, res: Response) => {
    try {
      let proxyHost = req.query.host;
      let proxyPort = req.query.port;
      let proxyTimeout = req.query.to;
      // let proxyPublicIP = req.query.pip;
      // let proxyUsername = req.query.un;
      // let proxyPassword = req.query.pw;

      let p = new P.PChecker(
        String(proxyHost),
        String(proxyPort),
        String(proxyTimeout)
        // String(proxyPublicIP),
        // String(proxyUsername),
        // String(proxyPassword)
      );

      let check = await p.checkDNSLeak();
      res.send({ data: check });
    } catch (error) {
      res.send({ data: error });
    }
  }
);

app.listen(localport, () => {
  console.log("Running at localhost:8181");
});
