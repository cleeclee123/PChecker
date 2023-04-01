import express from "express";
import { Server } from "socket.io";
import ioclient from "socket.io-client";
import http from "http";
import * as P from "../checker/PChecker.js";
import { Schema, model } from "mongoose";
const app = express();
const server = http.createServer(app);
const port = 8181;
const io = new Server(server);
// proxy server kpis schema
const serverKPISchema = new Schema({
    server: {
        type: String,
        required: true,
    },
    uptime: {
        type: String,
        required: true,
    },
    avgPing: {
        type: String,
        required: true,
    },
    count: {
        type: String,
        required: true,
    },
}, { timestamps: true });
// create model
const ProxyServerKPIs = model("KPIs", serverKPISchema);
// add new proxy server kpi
const addProxyServerKPI = async (host, port) => {
    const kpis = new ProxyServerKPIs({
        server: `${host}:${port}`,
        uptime: `0`,
        avgPing: `0`,
        count: `1`,
    });
    await kpis.save();
};
// get proxy server kpi
app.get("/", (req, res) => {
    res.json({ hello: "hello" });
});
app.get("/check", (req, res) => {
    try {
        let proxyHost = req.query.host;
        let proxyPort = req.query.port;
        let proxyTimeout = req.query.to;
        function validIPaddress(ipaddress) {
            if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
                return true;
            }
            return false;
        }
        if (!validIPaddress(`${proxyHost}`)) {
            res.send({ data: "bad ip address" });
            return;
        }
        const kMaxPortNumber = 65535;
        const kMinPortNumber = 0;
        if (Number(proxyPort) > kMaxPortNumber ||
            Number(proxyPort) < kMinPortNumber) {
            res.send({ data: "bad port" });
            return;
        }
        const socketclient = ioclient("http://localhost:" + port);
        socketclient.on("connect", async () => {
            const proxyData = await getProxyCheckerInfo(socketclient, String(proxyHost), String(proxyPort), String(proxyTimeout));
            res.json({ data: proxyData });
            return;
        });
    }
    catch (error) {
        console.log(error);
        res.send({ data: "something is fucked" });
        return;
    }
});
io.on("connection", (socket) => {
    console.log("connected");
    socket.on("proxyCheckerCheck", (data) => {
        console.log(data);
    });
});
const getProxyCheckerInfo = (socketclient, proxyHost, proxyPort, proxyTimeout) => {
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
