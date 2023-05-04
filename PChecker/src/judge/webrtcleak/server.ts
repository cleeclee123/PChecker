import express, { Request, Response } from "express";
import { findIP } from "./webrtcLeak.js";

const app = express();
const port = 8181;

app.get("/", (req: Request, res: Response) => {
  res.json({ hello: "hello" });
});

app.get("/webleakcheck", async (req: Request, res: Response) => {
  const ipsFound = await findIP();
  res.json({ "ipsFound": ipsFound  });
});

app.listen(port, () => {
  console.log("Running at localhost:8181");
});
