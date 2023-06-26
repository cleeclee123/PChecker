"use strict";

import { PCheckerMethods } from "./PCheckerMethods.js";
import { PCheckerEssential } from "./PCheckerEssential.js";
import { PCheckerBase } from "./PCheckerBase.js";
import {
  ProxyInfoEssential,
  ProxyError,
  ProxyInfoFromHttp,
  ProxyInfoFromHttps,
  ProxyContentCheck,
  ProxyDNSCheck,
  ProxyLocation,
  PCheckerOptions,
} from "./types.js";

function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      if (name !== "constructor") {
        derivedCtor.prototype[name] = baseCtor.prototype[name];
      }
    });
  });
}

class PCheckerMixin extends PCheckerBase {
  constructor(pcheckerOptions?: PCheckerOptions) {
    super(pcheckerOptions);
  }
}
interface PCheckerMixin extends PCheckerMethods, PCheckerEssential {}
applyMixins(PCheckerMixin, [PCheckerMethods, PCheckerEssential]);

export class PChecker extends PCheckerMixin {
  constructor(pcheckerOptions?: PCheckerOptions) {
    super(pcheckerOptions);
  }

  /**
   * @method: checkAnonymity()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs anomnity check
   */
  public async checkAnonymity(): Promise<ProxyInfoFromHttp | ProxyError> {
    this.nullChecks();
    const anomnityStatus = await this.checkProxyAnonymity();
    this.clearTimeouts();

    return anomnityStatus;
  }

  /**
   * @method: checkHTTPS()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs https support check
   */
  public async checkHTTPS(): Promise<ProxyInfoFromHttps | ProxyError> {
    this.nullChecks();
    const httpsStatus = await this.checkProxyHTTPSSupport();
    this.clearTimeouts();

    return httpsStatus;
  }

  /**
   * @method: checkContent()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs content check
   */
  public async checkContent(): Promise<ProxyContentCheck | ProxyError> {
    this.nullChecks();
    const contentCheck = await this.checkProxyContent();
    this.clearTimeouts();

    return contentCheck;
  }

  /**
   * @method: checkDNSLeak()
   * @returns Promise<ProxyDNSCheck | ProxyError>
   * runs dns leak check
   */
  public async checkDNSLeak(): Promise<ProxyDNSCheck | ProxyError> {
    this.nullChecks();
    const dnsLeakCheck = await this.checkProxyDNSLeak();
    this.clearTimeouts();

    return dnsLeakCheck;
  }

  /**
   * @method: checkLocation()
   * @returns Promise<ProxyLocation | ProxyError>
   * fetch proxy location from ip-api.com
   */
  public async checkLocation(): Promise<ProxyLocation | ProxyError> {
    this.nullChecks();
    const geolocation = await this.checkProxyLocation();
    this.clearTimeouts();

    return geolocation;
  }

  /**
   * @method: checkWebRTCLeak()
   * @returns Promise<boolean | ProxyError>
   * checks if public ip address is leaked via WebRTC
   */
  public async checkWebRTCLeak(): Promise<any> {
    this.nullChecks();
    const leakCheck = await this.checkProxyWebRTCLeak();
    this.clearTimeouts();

    return leakCheck;
  }

  /**
   * @method: checkEssential()
   * @returns Promise<ProxyInfoEssential | ProxyError>
   * returns only essential info
   */
  public async checkEssential(): Promise<ProxyInfoEssential> {
    this.nullChecks();
    const essential = await this.checkProxyEssential();

    // final cleanup
    let combineErrMes: string[] = [];
    if (essential.judgeError) {
      combineErrMes.push(String(essential.judgeError));
      delete essential.judgeError;
    }
    if (essential.timeoutError) {
      combineErrMes.push(String(essential.timeoutError));
      delete essential.timeoutError;
    }
    if (essential.unknownError) {
      combineErrMes.push(String(essential.unknownError));
      delete essential.unknownError;
    }

    if (essential.errors) {
      essential.errors.concat(combineErrMes);
    } else if (combineErrMes.length > 0) {
      essential.errors = combineErrMes;
    }

    this.clearTimeouts();

    return essential;
  }

  /**
   * @method: checkAll()
   * @returns everythring
   * one big boi response
   */
  public async checkAll(): Promise<any> {
    this.nullChecks();
    const all = await Promise.all([
      this.checkProxyAnonymity(),
      this.checkProxyHTTPSSupport(),
      this.checkProxyContent(),
      this.checkProxyDNSLeak(),
      this.checkProxyLocation(),
      this.checkProxyWebRTCLeak(),
    ]);
    this.clearTimeouts();

    return all;
  }
}
