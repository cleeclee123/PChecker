import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import { MyConcurrentPromiseQueue } from "../checker/pqueue.js";
import { StatusMonitor } from "../server/expressMonitor.js";

const app = express();
const localPort = 6969;

app.use(cors());
app.use(compression());

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: err.message });
});

// status page, path: /status
const statusMonitor = new StatusMonitor();
statusMonitor.mount(app, localPort);

export const measureRequestDuration = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.locals.start = process.hrtime();
  next();
};

app.use(measureRequestDuration);

app.use((req: Request, res: Response, next: NextFunction) => {
  if (res.locals.body && res.locals.duration) {
    res.locals.body.duration = res.locals.duration;
  }
  next();
});

const queue = new MyConcurrentPromiseQueue({
  maxNumberOfConcurrentPromises: 50,
});

app.get("/", (req: Request, res: Response) => {
  res.locals.body = {
    hello: `hello`,
  };
  const diff = process.hrtime(res.locals.start);
  const time = diff[0] * 1e3 + diff[1] * 1e-6;

  res.locals.body.duration = `${time}ms`;
  res.json(res.locals.body);
});

const getClientIP = async (req: Request): Promise<JSON> => {
  return new Promise(async (resolve, reject) => {
    try {
      const ip = req.socket.remoteAddress;
      console.log(ip);
      const requestHeaders: JSON = JSON.parse(
        JSON.stringify({
          clientip: ip ? ip.replace(/^.*:/, "") : undefined,
          time: Date.now(),
        })
      );
      resolve(requestHeaders);
    } catch (error) {
      reject(error);
    }
  });
};

app.get("/clientip", (req: Request, res: Response, next: NextFunction) => {
  try {
    queue
      .addPromise(() => getClientIP(req))
      .then((result) => {
        res.locals.body = result;
        const diff = process.hrtime(res.locals.start);
        const time = diff[0] * 1e3 + diff[1] * 1e-6;
        res.locals.body.duration = `${time}ms`;
        res.status(200).json(res.locals.body);
      });
  } catch (error) {
    next(error);
  }
});

const getRequestHeaders = async (req: Request): Promise<JSON> => {
  return new Promise(async (resolve, reject) => {
    try {
      const requestHeaders: any = JSON.parse(JSON.stringify(req.headers));
      requestHeaders.addr = req.socket.remoteAddress
        ? req.socket.remoteAddress.replace(/^.*:/, "")
        : undefined;
      requestHeaders.port = req.socket.remotePort;
      requestHeaders.scheme = "http";
      requestHeaders.method = "GET";
      requestHeaders.time = Date.now();
      resolve(requestHeaders);
    } catch (error) {
      reject(error);
    }
  });
};

app.get("/azenv", (req: Request, res: Response, next: NextFunction) => {
  try {
    queue
      .addPromise(() => getRequestHeaders(req))
      .then((result) => {
        res.locals.body = result;
        const diff = process.hrtime(res.locals.start);
        const time = diff[0] * 1e3 + diff[1] * 1e-6;
        res.locals.body.duration = `${time}ms`;
        res.status(200).json(res.locals.body);
      });
  } catch (error) {
    next(error);
  }
});

app.listen(localPort, () => {
  console.log(`Running at http://localhost:${localPort}`);
});
