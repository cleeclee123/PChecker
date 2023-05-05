import process from "process";
import { PChecker } from "../checker/PChecker.js";

const checker = new PChecker();

process.argv.forEach(async (val, index, array) => {
  if (index === 2) checker.setHost(String(val));
  else if (index === 3) checker.setPort(String(val));
  else if (index === 4) checker.setTimeout(Number(val));
});

console.log(await checker.checkAnonymity());
