import express, { Express, Request, Response } from "express";
import * as PC from "../checker/PChecker.js";
import * as PF from "../checker/proxy-checks.js";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

app.get("/", (req: Request, res: Response) => {
  res.json({ hello: "hello" });
});

app.get("/checker2", async (request: Request, response: Response) => {
  let host = request.query.host;
  let port = request.query.port;
  // let timeout = request.query.to;

  const checker = new PC.PChecker(String(host), String(port), String(10000));
  // const all = await Promise.all([checker.httpsCheck(), checker.pingCheck(), checker.checkGoogle(), checker.getLocation(), checker.proxyCheck()]);
  const location = await checker.getLocation();
  response.send(location);
});

app.get("/checker1", async (request: Request, response: Response) => {
  let host = request.query.host;
  let port = request.query.port;
  // let timeout = request.query.to;

  const checker = await PF.getLocation(String(host), String(port), 100000);
  console.log(checker);
  response.send(checker);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
