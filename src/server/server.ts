import express, { Express, Request, Response } from "express";
import { ChildProcessWithoutNullStreams, exec, spawn } from "child_process";
import { curlPingConfig } from "../checker/constants.js";
import * as PChecker from "../checker/PChecker.js";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

app.get("/", (req: Request, res: Response) => {
  res.json({ hello: "hello" });
});

app.get("/path", function (req, res) {
  // let child = spawn('curl', ['https://v2.jokeapi.dev/joke/Any?safe-mode']);

  let host = req.query.host;
  let port = req.query.port;
  const kProxyJudgeURL: string = `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`;

  let child = spawn("curl", [
    "-s",
    "-o",
    "/dev/null",
    "-w",
    curlPingConfig,
    "--proxy",
    `http://${host}:${port}`,
    `${kProxyJudgeURL}`,
  ]);

  child.stdout.pipe(res);
  // child.stderr.pipe(res);
});

app.get("/checker", async (request: Request, response: Response) => {
  let host = request.query.host;
  let port = request.query.port;
  //let timeout = request.query.to;
  let timeout = "10000";

  // const kProxyJudgeURL: string = `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`;

  // let { stdout, stderr } =
  //   exec(
  //     `curl -s -o /dev/null -w %{http_code} -p -x http://${host}:${port} ${kProxyJudgeURL}`,
  //     { timeout: Number(timeout) }
  //   ) || ({} as ChildProcessWithoutNullStreams);

  // let pingProcess =
  //   exec(
  //     `curl -s -o /dev/null -w ${curlPingConfig} --proxy http://${host}:${port} ${kProxyJudgeURL}`,
  //     { timeout: Number(timeout) }
  //   ) || ({} as ChildProcessWithoutNullStreams);

  // let proxyProcess =
  //   exec(
  //     `curl -s -H Proxy-Connection: --proxy http://${host}:${port} ${kProxyJudgeURL} -v`,
  //     { timeout: Number(timeout) }
  //   ) || ({} as ChildProcessWithoutNullStreams);

  //console.log('stdout:', stdout);

  response.send({});
});

// app.get("/checker1", async (request: Request, response: Response) => {
//   let host = request.query.host;
//   let port = request.query.port;
//   // let timeout = request.query.to;

//   const checker = await PF.getLocation(String(host), String(port), 100000);
//   console.log(checker);
//   response.send(checker);
// });

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
