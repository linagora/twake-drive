import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import {TestDbService, uuid} from "../utils.prepare.db";
import formAutoContent from "form-auto-content";
import UserApi from "../common/user-api";
import {Readable} from "stream";
import fs from "fs";
import { logger } from "../../../src/core/platform/framework/logger";
import {resolve} from "node:dns";

const sget = require('simple-get');

describe("The /webdav API", () => {
    const url = "/internal/services/webdav/v1";
    let platform: TestPlatform;
    let currentUser: UserApi;
    let companyId: uuid;

    let testDbService: TestDbService;


    afterEach(async () => {
        // await platform?.tearDown();
        platform = null;
    });

    beforeEach(async () => {
        platform = await init({
            services: [
                "webserver",
                "database",
                "search",
                "message-queue",
                "applications",
                "webserver",
                "user",
                "auth",
                "storage",
                "counter",
                "console",
                "workspaces",
                "statistics",
                "platform-services",
                "webdav",
                "files",
                "messages",
                "channels",
                "documents",
            ],
        });
        currentUser = await UserApi.getInstance(platform);
        testDbService = await TestDbService.getInstance(platform);
        companyId = (await testDbService.createCompany()).id;
        const device_mock = {
            id: deviceToken,
            password: password,
            user_id: currentUser.user.id,
            company_id: companyId,
            type: "WebDAV",
            version: "1",
            push_notifications: false,
        }
        await testDbService.createDevice(device_mock);
    });

    const deviceToken = "testDeviceToken";
    const password = "testPassword";

    // TODO[GK]: create it instead of pasting
    const credentials = 'dGVzdERldmljZVRva2VuOnRlc3RQYXNzd29yZA==';


    it("Should return 401 Unauthorized", async () => {
        const response = await platform.app.inject({
            method: "GET",
            url: `${url}/webdav/`,
        })

        expect(response.statusCode).toBe(401);
        expect(response.headers["www-authenticate"]).toBe("Basic");
    })

    // Checking PUT file
    // it("Creating file", async () => {
    //     const fullPath = `${__dirname}/../common/assets/sample.doc`;
    //     const readable = fs.createReadStream(fullPath);
    //     const form = formAutoContent({file: readable});
    //
    //     const response = await platform.app.inject({
    //         method: "PUT",
    //         url: `${url}/webdav/My%20Drive/hello-world.md`,
    //         ...form,
    //         headers: {
    //             'Authorization': "Basic " + Buffer.from(`${deviceToken}:${password}`).toString('base64'),
    //         },
    //     })
    //     const resp = response.json();
    //     console.log(resp);
    // })
    // Checking PUT file
    it("Go Propfind", async () => {
        const opts = {
            url: `http://127.0.0.1:3000${url}/webdav/My%20Drive`,
            method: 'PROPFIND',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${deviceToken}:${password}`).toString('base64'),
            },
            timeout: 1000000,
        }
        const data = await new Promise<void>( (resolve, reject) => {
            sget(opts, function (err, res, data) {
                platform.platform.logger.debug(res);
                platform.platform.logger.debug(data);

                platform.platform.logger.debug(res.headers);
                if (err) {
                    throw err;
                }
                resolve(data);
            });
        })
        console.log(data);

        // const response = await platform.app.inject({
        //     method: "OPTIONS",
        //     url: `${url}/webdav/My%20Drive`,
        //     headers: {
        //         'Authorization': "Basic " + Buffer.from(`${deviceToken}:${password}`).toString('base64'),
        //     },
        // })
        // const resp = response.json();
        // console.log(resp);
    })
});