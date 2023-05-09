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
  constructor(
    host?: string,
    port?: string,
    timeout?: string,
    publicIPAddress?: string,
    username?: string,
    password?: string
  ) {
    super(host, port, timeout, publicIPAddress, username, password);
  }
}
interface PCheckerMixin extends PCheckerMethods, PCheckerEssential {}
applyMixins(PCheckerMixin, [PCheckerMethods, PCheckerEssential]);

export class PChecker extends PCheckerMixin {
  constructor(
    host?: string,
    port?: string,
    timeout?: string,
    publicIPAddress?: string,
    username?: string,
    password?: string
  ) {
    super(host, port, timeout, publicIPAddress, username, password);
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
   * @method: checkGoogle()
   * @returns Promise<boolean | ProxyError>
   * runs google support check
   */
  public async checkGoogle(): Promise<boolean | ProxyError> {
    this.nullChecks();
    const contentCheck = await this.checkProxyGoogleSupport();
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
   * @method: checkEssential()
   * @returns Promise<ProxyInfoEssential | ProxyError>
   * returns only essential info
   */
  public async checkEssential(): Promise<ProxyInfoEssential | ProxyError> {
    this.nullChecks();
    const essential = await this.checkProxyEssential();
    this.clearTimeouts();

    return essential;
  }
}