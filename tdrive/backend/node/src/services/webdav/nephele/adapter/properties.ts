import type { INepheleProperties, INepheleUser, NepheleModule } from "../loader";
import { Resource } from "./resource";

export class Properties implements INepheleProperties {
  /**
   * The resource these properties belong to.
   */
  resource: Resource;

  constructor(private readonly nephele: NepheleModule, resource: Resource) {
    this.resource = resource;
  }
  /**
   * Get a property's value.
   *
   * This function should usually return a string. If not, it MUST return an
   * object that represents an XML structure that can be understood by xml2js,
   * or an array of such objects.
   *
   * If the property doesn't exist, this should throw a PropertyNotFoundError.
   *
   * WebDAV requires support for the following properties, all in the
   * DAV: XML namespace.
   *
   * - creationdate
   * - displayname
   * - getcontentlanguage
   * - getcontentlength
   * - getcontenttype
   * - getetag
   * - getlastmodified
   * - resourcetype
   * - supportedlock
   *
   * The following property is handled by Nephele.
   *
   * - lockdiscovery
   *
   * Any property not in the DAV: namespace will have its namespace and the
   * string '%%' prepended to its name, like "LCGDM:%%mode".
   */
  async get(name: string): Promise<string | object | object[] | undefined> {
    // const versions = await this.resource.getVersions();
    const replyWithDate = (ts?: number) => {
      // Check if ts is a valid number and greater than 0 to ensure it's a valid timestamp
      const date = typeof ts === "number" && ts > 0 ? new Date(ts) : new Date();
      return date.toUTCString(); // Format as HTTP date
    };
    switch (name) {
      case "creationdate":
        return replyWithDate(this.resource.file.added);
      case "displayname":
        return this.resource.getCanonicalName();
      case "getcontentlanguage":
        // TODO: keep it ?
        return "en";
      case "getcontentlength":
        return this.resource.file.size.toString();
      case "getcontenttype":
        const mediaType = await this.resource.getMediaType();
        if (mediaType == null) {
          throw new this.nephele.PropertyNotFoundError();
        }
        return mediaType;
      case "getlastmodified":
        return replyWithDate(this.resource.file.last_modified);
      case "resourcetype":
        if (await this.resource.isCollection()) {
          return { collection: {} };
        } else {
          return {};
        }
      case "supportedlock":
        return {
          lockentry: [
            {
              lockscope: { exclusive: {} },
              locktype: { write: {} },
            },
            {
              lockscope: { shared: {} },
              locktype: { write: {} },
            },
          ],
        };

      case "getetag":
        return this.resource.getEtag();
      case "quota-available-bytes":
        return `${await this.resource.getFreeSpace()}`;
      case "quota-used-bytes":
        return `${await this.resource.getTotalSpace()}`;
      default:
        throw new this.nephele.PropertyNotFoundError(`Unknown property ${JSON.stringify(name)}`);
    }
  }

  /**
   * Same as get, but for a specific user.
   */
  async getByUser(
    name: string,
    _user: INepheleUser,
  ): Promise<string | object | object[] | undefined> {
    // TODO: implement get property by user
    return this.get(name);
  }

  /**
   * Set a property's value.
   *
   * This function should support setting a string value, but also MUST support
   * setting an object value that represents an XML structure that can be
   * understood by xml2js, or an array of such objects.
   *
   * If a property is protected, this function should throw a
   * PropertyIsProtectedError.
   *
   * The following properties should be protected, according to the WebDAV spec:
   *
   * - creationdate
   * - getcontentlength
   * - getcontenttype
   * - getetag
   * - getlastmodified
   * - resourcetype
   * - supportedlock
   *
   * The following property is handled by Nephele.
   *
   * - lockdiscovery
   */
  set(_name: string, _value: string | object | object[] | undefined): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Same as set, but for a specific user.
   */
  setByUser(
    _name: string,
    _value: string | object | object[] | undefined,
    _user: INepheleUser,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Completely remove a property.
   */
  remove(_name: string): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Same as remove, but for a specific user.
   */
  removeByUser(_name: string, _user: INepheleUser): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Perform the given instructions, atomically.
   *
   * Either all instructions should succeed, or no instructions should succeed.
   * Practically, this means that in the event of any failure at all, this
   * function should return errors for any instruction(s) that failed, and no
   * change to any of the properties should take place.
   *
   * Do not throw errors in this function. Instead, return an array of error
   * arrays. Error arrays contain the name of the property that caused the error
   * and the Error that would have been thrown.
   *
   * An instruction is an array that contains exactly three elements:
   *
   * - An action, 'set', meaning to set the property, or 'remove', meaning to
   *   remove the property.
   * - The name of the property.
   * - The value of the property if it is being set, or `undefined` if it is
   *   being removed.
   */
  runInstructions(
    _instructions: ["set" | "remove", string, any][],
  ): Promise<undefined | [string, Error][]> {
    return Promise.resolve(undefined);
  }

  /**
   * Same as runInstructions, but for a specific user.
   */
  runInstructionsByUser(
    _instructions: ["set" | "remove", string, any][],
    _user: INepheleUser,
  ): Promise<undefined | [string, Error][]> {
    return Promise.resolve(undefined);
  }

  /**
   * Return all the defined properties.
   *
   * This doesn't need to return all live properties. You can choose to leave
   * out properties that are expensive to calculate.
   *
   * If there is an error retrieving a prop, you can store the error in the
   * property's entry in the object.
   *
   * The following property is handled by Nephele, and it is automatically
   * included if your adapter supports locks, indicated by returning compliance
   * class "2".
   *
   * - lockdiscovery
   */
  async getAll(): Promise<{ [k: string]: string | object | object[] }> {
    const properties = [
      "creationdate",
      "displayname",
      "getcontentlanguage",
      "getcontentlength",
      "getcontenttype",
      "getetag",
      "getlastmodified",
      "resourcetype",
      "supportedlock",
    ];
    const result: { [k: string]: string | object | object[] } = {};
    for (const property of properties) {
      try {
        result[property] = await this.get(property);
      } catch (e) {
        result[property] = e;
      }
    }
    return result;
  }

  /**
   * Same as getAll, but for a specific user.
   */
  getAllByUser(_user: INepheleUser): Promise<{ [k: string]: string | object | object[] }> {
    return this.getAll();
  }

  /**
   * Return the names of all properties.
   *
   * The following property is handled by Nephele, and it is automatically
   * included if your adapter supports locks, indicated by returning compliance
   * class "2".
   *
   * - lockdiscovery
   */
  list(): Promise<string[]> {
    return Promise.resolve(["undefined"]);
  }

  /**
   * Same as list, but for a specific user.
   */
  listByUser(_user: INepheleUser): Promise<string[]> {
    return Promise.resolve(["undefined"]);
  }

  /**
   * Return the names of all live properties.
   *
   * The following property is handled by Nephele, and it is automatically
   * included if your adapter supports locks, indicated by returning compliance
   * class "2".
   *
   * - lockdiscovery
   */
  listLive(): Promise<string[]> {
    return Promise.resolve(["undefined"]);
  }

  /**
   * Same as listLive, but for a specific user.
   */
  listLiveByUser(_user: INepheleUser): Promise<string[]> {
    return Promise.resolve(["undefined"]);
  }

  /**
   * Return the names of all dead properties.
   */
  listDead(): Promise<string[]> {
    return Promise.resolve(["undefined"]);
  }

  /**
   * Same as listDead, but for a specific user.
   */
  listDeadByUser(_user: INepheleUser): Promise<string[]> {
    throw new this.nephele.MethodNotImplementedError();
  }
}
