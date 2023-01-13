import * as pChecks from "./checker/proxy-checks.js";

// let t = await pChecks.testGoogle("52.79.43.141", "80");
// let t = await pChecks.httpsCheck("20.24.43.214", "8123", 5000);
// console.log(t);

console.time();
console.log(await pChecks.proxyCheck("195.154.255.194", "8000", 5000));
console.timeEnd();
process.kill(process.pid);

// console.time();
// console.log(await pChecks.getMyPublicIP());
// console.timeEnd();
// process.kill(process.pid);