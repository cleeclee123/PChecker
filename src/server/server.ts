import express, { Request, Response } from "express";
import ioserver, { Socket, Server } from "socket.io";
import ioclient from "socket.io-client";
import http from "http";
import * as P from "../checker/PChecker.js";
import fetch from "node-fetch";
import axios from "axios";

const app = express();
const server = http.createServer(app);
const port = 8181;
const io = new Server(server);

app.get("/", (req: Request, res: Response) => {
  res.json({ hello: "hello" });
});

app.get("/check", (req: Request, res: Response) => {
  const socketclient = ioclient("http://localhost:" + port);
  socketclient.on("connect", async () => {
    const proxyData = await getProxyCheckerInfo(socketclient);
    res.json({ data: proxyData });
  });
});

io.on("connection", (socket: Socket) => {
  console.log("connected");
  socket.on("fetch1", (data) => {
    console.log("here");
  });
});

const getProxyCheckerInfo = async (socketclient: any) => {
  let pChecker = new P.PChecker("152.26.229.66", "9443", "5000");
  pChecker
    .check()
    .then((result) => {
      socketclient.emit("fetch1", {
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
