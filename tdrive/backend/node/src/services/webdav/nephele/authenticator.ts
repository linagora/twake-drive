import * as express from "express";
import { DeviceTypesEnum } from "../../user/entities/device";
import gr from "../../global-resolver";
import { executionStorage } from "../../../core/platform/framework/execution-storage";
import { INepheleAuthenticator, INepheleAuthResponse, INepheleUser, NepheleModule } from "./loader";

const setAuthenticateHeader = (response: INepheleAuthResponse) =>
  response.setHeader("WWW-Authenticate", 'Basic realm="Twake Drive WebDAV", charset="UTF-8"');

export class Authenticator implements INepheleAuthenticator {
  constructor(private readonly nephele: NepheleModule) {}

  async authenticate(
    request: express.Request,
    response: INepheleAuthResponse,
  ): Promise<INepheleUser> {
    if (request.headers.authorization) {
      try {
        const [, ...base64CredentialsParts] = request.headers.authorization.split(" ");
        const base64Credentials = base64CredentialsParts.join(" ");
        const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
        const [deviceId, ...devicePasswordParts] = credentials.split(":");
        const devicePassword = devicePasswordParts.join(":");
        const device = await gr.services.users.getDevice({
          id: deviceId,
          password: devicePassword,
        });
        if (device.type !== DeviceTypesEnum.WebDAV)
          throw new this.nephele.UnauthorizedError(
            `Invalid device ${deviceId} type, expected WebDAV`,
          );
        response.locals.user = {
          username: device.user_id,
          groupname: device.company_id,
        } as INepheleUser;
        executionStorage.getStore().user_id = device.user_id;
        executionStorage.getStore().company_id = device.company_id;
        setAuthenticateHeader(response);
        return response.locals.user;
      } catch (error) {
        throw new this.nephele.UnauthorizedError("Error while authorising");
      }
    } else {
      response.statusCode = 401;
      setAuthenticateHeader(response);
      throw new this.nephele.UnauthorizedError("Unauthorized user!");
    }
  }

  async cleanAuthentication(
    _request: express.Request,
    _response: INepheleAuthResponse,
  ): Promise<void> {
    // TODO: think about cleaning the user
  }
}
