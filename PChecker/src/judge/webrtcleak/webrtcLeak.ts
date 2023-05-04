// @ts-ignore
import pkg from "wrtc";
const { RTCPeerConnection } = pkg;

interface LocalIPs {
  [key: string]: boolean;
}

interface RTCConfiguration {
  iceServers: {
    urls: string;
  }[];
}

// logic stolen from https://github.com/VoidSec/WebRTC-Leak/blob/master/exploit.js
export function findIP(): Promise<string[]> {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    } as RTCConfiguration);

    const noop = (): void => {};
    const localIPs: LocalIPs = {};
    const ipRegex =
      /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g;
    const ipAddresses: string[] = [];

    function ipIterate(ip: string): void {
      if (!localIPs[ip]) ipAddresses.push(ip);
      localIPs[ip] = true;
    }

    pc.createDataChannel("");

    pc.createOffer((sdpOffer: any) => {
      sdpOffer.sdp.split("\n").forEach((line: any) => {
        if (line.indexOf("candidate") < 0) return;
        line.match(ipRegex).forEach(ipIterate);
      });
      pc.setLocalDescription(sdpOffer, noop, noop);
    }, noop);

    pc.onicecandidate = (ice: any) => {
      if (
        !ice ||
        !ice.candidate ||
        !ice.candidate.candidate ||
        !ice.candidate.candidate.match(ipRegex)
      ) {
        return;
      }
      ice.candidate.candidate.match(ipRegex).forEach(ipIterate);
    };

    setTimeout(() => {
      pc.close();
      resolve(ipAddresses);
    }, 1000); 
  });
}