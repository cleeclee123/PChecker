import express, { Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import { MyConcurrentPromiseQueue } from "../checker/pqueue.js";

const app = express();
app.use(cors());
app.use(compression());

const localPort = 6969;

const queue = new MyConcurrentPromiseQueue({
  maxNumberOfConcurrentPromises: 50,
});

app.get("/", (req: Request, res: Response) => {
  res.json({
    hello: `welcome to my express app hosted on 69.164.197.241:${localPort}`,
  });
});

app.get("/clientip", (req: Request, res: Response) => {
  res.json({ clientip: req.socket.remoteAddress.slice(7) });
});

const getRequestHeaders = async (req: Request): Promise<JSON> => {
  return new Promise(async (resolve, reject) => {
    try {
      const requestHeaders: JSON = JSON.parse(JSON.stringify(req.headers));
      resolve(requestHeaders);
    } catch (error) {
      reject(error);
    }
  });
};

app.get("/azenv", (req: Request, res: Response) => {
  try {
    queue
      .addPromise(() => getRequestHeaders(req))
      .then((result) => {
        res.status(200).json(result);
      });
  } catch (error) {
    res.status(400).json({ error: error });
  }
});

app.listen(localPort, () => {
  console.log(`Running at http://localhost:${localPort}`);
});
