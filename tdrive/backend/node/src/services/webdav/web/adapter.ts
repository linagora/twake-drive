import type { Adapter, AuthResponse, Resource, Method, User } from "nephele";
import { DriveExecutionContext } from "../../documents/types";
import { Request } from "express";
import * as URL from "node:url";
import * as types from "../../../utils/types";
import gr from "../../global-resolver";
import { ResourceService } from "./fileResource";
import { executionStorage } from "../../../core/platform/framework/execution-storage";

let AdapterService;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const build_adapter = (nephele: any): Adapter => {
  /**
   * WebDAVAdapter implements Adapter interface from nephele module using Drive files
   */
  class WebDAVAdapter implements Adapter {
    /**
     * Get a list of compliance classes that this adapter supports.
     *
     * Compliance classes "1" and "3" are already known, since this is a WebDAV
     * server that implements RFC 4918, so don't include it in the returned array.
     *
     * Compliance class "2" means the adapter supports locks. Include this class
     * (the string "2") in the returned array to indicate that the "LOCK" and
     * "UNLOCK" methods should be included in the "Allow" header.
     */
    getComplianceClasses = async (_url: URL, _request: Request, _response: AuthResponse) => {
      // "2" - means that the Adapter ( i.e. file system supports lock / unlock function )
      return ["2"];
      // return Promise.resolve([]);
    };

    /**
     * Get a list of allowed methods that this adapter supports.
     *
     * The standard set of WebDAV methods are already known, so don't include them
     * in the returned array. They include:
     *
     * GET, HEAD, POST, PUT, DELETE, COPY, MOVE, MKCOL, OPTIONS, LOCK, UNLOCK,
     * SEARCH, PROPFIND, and PROPPATCH
     *
     * LOCK and UNLOCK are only included if `getComplianceClasses` returns "2" in
     * the array when called with the same arguments.
     *
     * This method is used to build the "Allow" header.
     *
     * Any methods this function returns are entirely the responsibility of the
     * adapter to fulfill, beyond simple authorization and error responses.
     */
    getAllowedMethods = async (url: URL, request: Request, response: AuthResponse) => {
      if ("2" in (await this.getComplianceClasses(url, request, response))) {
        return ["LOCK", "UNLOCK"];
      } else {
        return [];
      }
    };

    /**
     * Get the "Cache-Control" header for the OPTIONS response.
     *
     * You probably just want to return something like "max-age=604800", unless
     * you're doing something URL specific.
     *
     * If you are doing something URL specific, consider if an attacker could use
     * that information to determine whether resources exist on a server and what
     * features they support.
     */
    getOptionsResponseCacheControl = async (
      _url: URL,
      _request: Request,
      _response: AuthResponse,
    ) => {
      return "max-age=604800";
    };

    /**
     * See whether the request is authorized, based on a URL and a method.
     *
     * Don't take locks into consideration. Those are handled separately by
     * Nephele.
     *
     * @param url Resource URL.
     * @param method Request method.
     * @param baseUrl The root of the WebDav server's namespace on the server.
     * @param user The user to check authorization for.
     */
    isAuthorized = async (url: URL, method: string, baseUrl: URL, user: User): Promise<boolean> => {
      const UserByUsername = await gr.services.users.get({ id: user.username });
      return UserByUsername != null;
    };

    /**
     * Get a resource's object.
     *
     * If the resource doesn't exist, a ResourceNotFoundError should be thrown.
     *
     * If the resource is not managed by this adapter, a BadGatewayError should be
     * thrown.
     *
     * @param url Resource URL.
     * @param baseUrl The root of the adapter's namespace on the server.
     */
    getResource = async (url: URL, baseUrl: URL): Promise<Resource> => {
      const context = getDriveExecutionContext(baseUrl);
      let pathname = url.pathname;
      pathname = pathname.replace(baseUrl.pathname, "");
      pathname = pathname.replace(/^\/+|\/+$/g, "");
      const pathname_arr = pathname.split("/");

      if (pathname == "") {
        return null;
      }
      const resource = new ResourceService({
        adapter: this,
        baseUrl: baseUrl,
        pathname: pathname_arr.map(name => decodeURI(name)),
        context: context,
      });
      if (!(await resource.exists())) {
        throw new nephele.ResourceNotFoundError("Resource not found");
      }
      return resource;
    };
    /**
     * Create a new non-collection resource object.
     *
     * If the resource is not managed by this adapter, a BadGatewayError should be
     * thrown.
     *
     * @param url Resource URL.
     * @param baseUrl The root of the adapter's namespace on the server.
     */
    newResource = async (url: URL, baseUrl: URL): Promise<Resource> => {
      const context = getDriveExecutionContext(url);
      let pathname = decodeURI(url.pathname);
      pathname = pathname.replace(baseUrl.pathname, "");
      pathname = pathname.replace(/^\/+|\/+$/g, "");
      const pathname_arr = pathname.split("/");

      if (pathname_arr.length == 0) {
        throw new nephele.BadGatewayError("This resource is not managed by this adapter");
      }
      const resource = new ResourceService({
        adapter: this,
        baseUrl: baseUrl,
        pathname: pathname_arr,
        context: context,
        is_collection: false,
      });
      return resource;
    };

    /**
     * Create a new collection resource object.
     *
     * If the resource is not managed by this adapter, a BadGatewayError should be
     * thrown.
     *
     * @param url Resource URL.
     * @param baseUrl The root of the adapter's namespace on the server.
     */
    newCollection = async (url: URL, baseUrl: URL): Promise<Resource> => {
      const context = getDriveExecutionContext(url);
      let pathname = url.pathname;
      pathname = pathname.replace(baseUrl.pathname, "");
      pathname = pathname.replace(/^\/+|\/+$/g, "");
      const pathname_arr = pathname.split("/");

      if (pathname_arr.length == 0) {
        throw new nephele.BadGatewayError("This resource is not managed by this adapter");
      }
      const resource = new ResourceService({
        adapter: this,
        baseUrl: baseUrl,
        pathname: pathname_arr.map(name => decodeURI(name)),
        context: context,
        is_collection: true,
      });
      return resource;
    };

    /**
     * Get a handler class for an additional method.
     *
     * Any thrown errors will be caught and reported in the response, along with
     * their message. If you need more sophisticated error handling, such as
     * returning specific error codes in certain situations, you should handle
     * errors within this class' `run` function.
     *
     * If the requested method is not supported (i.e. it is purposefully excluded
     * from the output from `getAllowedMethods`), a MethodNotSupportedError should
     * be thrown. If the method is not recognized, a MethodNotImplementedError
     * should be thrown.
     */
    getMethod = (method: string): typeof Method => {
      if (method === "PROPATCH") {
        throw new Error("Method not supported!");
      }
      throw new Error("Method not implemented.");
    };
  }
  return new WebDAVAdapter();
};

const initializeAdapterService = async () => {
  AdapterService = await eval("import('nephele').then(build_adapter)");
};

// Export a function that returns the resolved service
export function getAdapterService() {
  if (!AdapterService) {
    throw new Error("AdapterService is not yet initialized");
  }
  return AdapterService;
}
export const adapterServiceReady = initializeAdapterService();

export const getDriveExecutionContext = (url: URL): DriveExecutionContext => ({
  user: {
    id: executionStorage.getStore().user_id,
  } as types.User,
  company: {
    id: executionStorage.getStore().company_id,
  },
  url: url.href,
  method: "undefined", // cannot retrieve method from url
  reqId: "undefined", // cannot retrieve request Id from url
  transport: "http", // most prob always work, however better with url.protocol
});
