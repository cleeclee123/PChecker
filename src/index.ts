import * as pChecks from "./checker/proxy-checks.js";

console.time();
// let t = await pChecks.testGoogle("52.79.43.141", "80");
let t = await pChecks.httpsCheck("20.24.43.214", "32112", 1000);
console.log(t);
console.timeEnd();
process.kill(process.pid);
