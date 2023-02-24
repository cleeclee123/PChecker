import express, { Request, Response } from "express";
import ioserver, { Socket, Server } from "socket.io";
import ioclient from "socket.io-client";
import http from "http";
import * as P from "../checker/PChecker.js";

const app = express();
const server = http.createServer(app);
const port = 8181;
const io = new Server(server);

app.get("/", (req: Request, res: Response) => {
  res.json({ hello: "hello" });
});

app.get("/check", (req: Request, res: Response) => {
  let proxyHost = req.query.host;
  let proxyPort = req.query.port;
  let proxyTimeout = req.query.to;

  const socketclient = ioclient("http://localhost:" + port);

  socketclient.on("connect", async () => {
    const proxyData = await getProxyCheckerInfo(
      socketclient,
      String(proxyHost),
      String(proxyPort),
      String(proxyTimeout)
    );
    res.json({ data: proxyData });
  });
});

io.on("connection", (socket: Socket) => {
  console.log("connected");

  socket.on("proxyCheckerCheck", (data) => {
    console.log(data);
  });
});

const getProxyCheckerInfo = (
  socketclient: any,
  proxyHost: any,
  proxyPort: any,
  proxyTimeout: any
) => {
  let pChecker = new P.PChecker(proxyHost, proxyPort, proxyTimeout);

  pChecker
    .check()
    .then((result) => {
      socketclient.emit("proxyCheckerCheck", {
        data: result.data,
      });
      return result.data;
    })
    .catch((error) => error.message);

  return pChecker.check();
};

server.listen(port, () => {
  console.log("Running at localhost:8181");
});
