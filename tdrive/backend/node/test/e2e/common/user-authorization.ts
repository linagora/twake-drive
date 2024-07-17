// import { OidcJwtVerifier } from "../../../src/services/console/clients/remote-jwks-verifier";
//
// export class UserAuthorization {
//   /**
//    * Just send the login requests without any validation and login response assertion
//    */
//   public async login(session?: string) {
//     if (session !== undefined) {
//       this.session = session;
//     } else {
//       this.session = uuidv1();
//     }
//     const payload = {
//       claims: {
//         sub: this.user.id,
//         first_name: this.user.first_name,
//         sid: this.session,
//       },
//     };
//     const verifierMock = jest.spyOn(OidcJwtVerifier.prototype, "verifyIdToken");
//     verifierMock.mockImplementation(() => {
//       return Promise.resolve(payload); // Return the predefined payload
//     });
//     return await this.api.post("/internal/services/console/v1/login", {
//       oidc_id_token: "sample_oidc_token",
//     });
//   }
//
//   public async logout() {
//     const payload = {
//       claims: {
//         iss: "tdrive_lemonldap",
//         sub: this.user.id,
//         sid: this.session,
//         aud: "your-audience",
//         iat: Math.floor(Date.now() / 1000),
//         jti: "jwt-id",
//         events: {
//           "http://schemas.openid.net/event/backchannel-logout": {},
//         },
//       }
//     };
//     const verifierMock = jest.spyOn(OidcJwtVerifier.prototype, "verifyLogoutToken");
//     verifierMock.mockImplementation(() => {
//       return Promise.resolve(payload); // Return the predefined payload
//     });
//
//     return await this.api.post("/internal/services/console/v1/backchannel_logout", {
//       logout_token: "logout_token_rsa256",
//     });
//   }
// }