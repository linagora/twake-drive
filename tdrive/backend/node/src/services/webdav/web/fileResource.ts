import {
  Adapter,
  BadGatewayError,
  ForbiddenError,
  InternalServerError,
  Lock,
  MethodNotSupportedError,
  Properties,
  RangeNotSatisfiableError,
  Resource,
  ResourceExistsError,
  ResourceNotFoundError,
  ResourceTreeNotCompleteError,
  UnauthorizedError,
  User,
} from "nephele";
import { Readable } from "stream";
import { PropertiesService } from "./properties";
import { DriveLock } from "./drivelock";

import gr from "../../global-resolver";
import { calculateItemSize } from "../../documents/utils";
import { DriveFile } from "../../documents/entities/drive-file";
import { DriveExecutionContext } from "../../documents/types";
import assert from "assert";
import { checkAccess } from "../../documents/services/access-check";
import { FileVersion } from "../../documents/entities/file-version";
import { MultipartFile } from "@fastify/multipart";
import { BusboyFileStream } from "@fastify/busboy";
import { UploadOptions } from "../../files/types";
import { lookup } from "mrmime";
import _ from "lodash";

export class ResourceService implements Resource {
  /**
   * This is implementation of Resource from nephele package
   *
   * @adapter -  the adapter of the resource
   * @pathname - the pathname as an array of strings to the resource (either directory or file)
   * Each item is actual names of the DriveItems and not ids
   * @context - DriveExecutionContext of the resource
   * @file - DriveItem if exists. Assumed that if it is null, then the file does not exist
   * @pathIds - path to the DriveItem represented as an Array of ids of parent files
   */
  adapter: Adapter;
  pathname: string[];
  baseUrl: URL;
  context: DriveExecutionContext;
  file?: DriveFile | null;
  pathIds?: string[] | null;
  is_collection?: boolean = false;
  constructor({
    adapter,
    baseUrl,
    pathname,
    context,
    file,
    pathIds,
    is_collection,
  }: {
    adapter: Adapter;
    baseUrl: URL;
    pathname: string[];
    context: DriveExecutionContext;
    file?: DriveFile | null;
    pathIds?: string[] | null;
    is_collection?: boolean;
  }) {
    this.adapter = adapter;
    this.baseUrl = baseUrl;
    this.pathname = pathname;
    this.context = context;
    this.file = file;
    this.pathIds = pathIds;
    this.is_collection = is_collection;
  }

  loadPath = async (pathname: string[]): Promise<string[]> => {
    // const path: string[] = [];
    // TODO[ASH] remove the next two lines and do actual rooting
    const root = pathname.shift();
    const path: string[] = ["user_" + this.context.user.id];
    let item = null;
    let parent_id = path[path.length - 1];
    while (pathname.length > 0) {
      const name = pathname.shift();
      item = await gr.services.documents.documents.findByName(name, parent_id, this.context);
      parent_id = item.id;
      path.push(item.id);
    }
    if (root != "") {
      return path;
    }
    return [undefined];
  };

  /**
   * Check if the resource exists
   */
  exists = async (): Promise<boolean> => {
    if (!this.file) {
      // try to load by pathname
      try {
        //slice() to create a copy of the path
        this.pathIds = await this.loadPath(this.pathname.slice());
        if (_.isEqual(this.pathIds, [undefined])) {
          return true;
        }
        this.file = (
          await gr.services.documents.documents.get(
            this.pathIds[this.pathIds.length - 1],
            this.context,
          )
        ).item;
        this.is_collection = this.file.is_directory;
        return true;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  /**
   * Returns execution context for the user based on the execution context of the resource
   *
   * @param _user
   */
  getUserContext = (_user: User): DriveExecutionContext => {
    const context = this.context;
    context.user.id = _user.username;
    context.company.id = _user.groupname;
    return context;
  };

  /**
   * Return any locks currently saved for this resource.
   *
   * This includes any provisional locks.
   *
   * Don't worry about timed out locks. Nephele will check for them and delete
   * them.
   */
  getLocks = async (): Promise<Lock[]> => {
    if (!this.file || !this.file.locks) return [];

    return this.file.locks.map(lock =>
      DriveLock.fromLockData(
        this,
        { user: { id: lock.user_id }, company: { id: lock.company_id } },
        lock,
      ),
    );
  };

  /**
   * Return any locks currently saved for this resource for the given user.
   *
   * This includes any provisional locks.
   *
   * Don't worry about timed out locks. Nephele will check for them and delete
   * them.
   */
  getLocksByUser = async (_user: User): Promise<Lock[]> => {
    if (!this.file || !this.file.locks) return [];
    return this.file.locks.map(
      lock =>
        new DriveLock(this, this.context, {
          token: lock.token,
          timeout: lock.timeout,
          scope: lock.scope,
          depth: lock.depth,
          owner: lock.owner,
          provisional: lock.provisional,
        }),
    );
  };

  /**
   * Create a new lock for this user.
   *
   * The defaults for the lock don't matter. They will be assigned by Nephele
   * before being saved to storage.
   */
  createLockForUser = async (user: User): Promise<Lock> => {
    const lock = new DriveLock(this, this.getUserContext(user), {
      owner: { name: user.username },
    });
    return lock;
  };

  /**
   * Return a properties object for this resource.
   */
  getProperties = async (): Promise<Properties> => {
    return new PropertiesService(this);
  };

  /**
   * Get a readable stream of the content of the resource.
   *
   * If a range is included, the stream should return the requested byte range
   * of the content.
   *
   * If the request is aborted prematurely, `detroy()` will be called on the
   * stream. You should listen for this event and clean up any open file handles
   * or streams.
   */
  getStream = async (range?: { start: number; end: number }): Promise<Readable> => {
    assert(await this.exists(), new Error("ResourceNotFoundError") as ResourceNotFoundError);
    const downloadObject = await gr.services.documents.documents.download(
      this.file.id,
      null,
      this.context,
    );
    const file = downloadObject.file;
    if (!file || !file.file) {
      throw new Error("File not found or file content is empty") as ResourceNotFoundError;
    }
    let stream: Readable = file.file;
    if (range) {
      if (range.start < 0 || range.end < range.start) {
        throw new Error("Invalid range specified") as RangeNotSatisfiableError;
      }
      const end = range.end !== undefined ? Math.min(range.end, file.size - 1) : file.size - 1;
      let rangeSize = end - range.start + 1;
      // Create a transform stream to handle the range
      stream = new Readable({
        read(size) {
          if (!file.file.readable) {
            this.push(null);
            return;
          }

          file.file.once("readable", () => {
            let chunk = file.file.read(Math.min(size, rangeSize));
            if (chunk) {
              if (range.start > 0) {
                chunk = chunk.slice(range.start);
                range.start = 0;
              }
              if (chunk.length > rangeSize) {
                chunk = chunk.slice(0, rangeSize);
              }
              this.push(chunk);
              rangeSize -= chunk.length;
              if (rangeSize <= 0) {
                this.push(null);
              }
            } else {
              this.push(null);
            }
          });
        },
      });
    }
    // Handle premature abort
    stream.on("close", () => {
      if (file.file instanceof Readable) {
        file.file.destroy();
      }
    });
    return stream;
  };

  /**
   * Put the input stream into the resource.
   *
   * If the resource is a collection, and it can't accept a stream (like a
   * folder on a filesystem), a MethodNotSupportedError may be thrown.
   */
  setStream = async (input: Readable, user: User, mediaType?: string): Promise<void> => {
    try {
      assert(await this.exists());
    } catch (error) {
      await this.create(user);
    }
    assert(
      await checkAccess(
        this.file.id,
        this.file,
        "write",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ),
      new Error("User does not have access to this resource") as UnauthorizedError,
    );

    assert(
      !(await this.isCollection()),
      new Error("Collection doesn't support this operation") as MethodNotSupportedError,
    );

    const uploadOptions: UploadOptions = {
      filename: this.file.name,
      type: mediaType || "application/octet-stream",
      totalSize: undefined,
      totalChunks: undefined,
      chunkNumber: 1,
      waitForThumbnail: false,
      ignoreThumbnails: false,
    };

    const chunkFile: MultipartFile = {
      type: "file",
      toBuffer: async () => input.read(),
      file: input as unknown as BusboyFileStream,
      fieldname: "file",
      filename: this.file.name,
      encoding: input.readableEncoding || "utf-8",
      mimetype: mediaType || lookup(this.file.name),
      fields: {},
    };
    try {
      // new file id is null, because we need to create new version -> new file
      const file = await gr.services.files.save(
        null,
        chunkFile,
        uploadOptions,
        this.getUserContext(user),
        true,
      );
      const version = this.file.last_version_cache;
      version.file_metadata.external_id = file.id;
      const newVersion = {
        application_id: version.application_id,
        drive_item_id: version.drive_item_id,
        id: null,
        file_metadata: version.file_metadata,
        file_size: version.file_size,
        filename: version.filename,
        key: version.key,
        realname: version.realname,
        provider: version.provider,
      };
      await gr.services.documents.documents.createVersion(
        this.file.id,
        newVersion,
        this.getUserContext(user),
      );
      // Resume the stream
      input.resume();
    } catch (error) {
      console.error("Error saveChunk:", error);
      throw error;
    }
  };
  /**
   * Create the resource.
   *
   * If the resource is a collection, the collection should be created normally.
   *
   * If the resource is not a collection, the resource should be created as an
   * empty resource. This probably means a lock is being created for the
   * resource.
   *
   * If the resource already exists, a ResourceExistsError should be thrown.
   */
  create = async (user: User): Promise<void> => {
    // TODO: check for shared files
    assert(!(await this.exists()), new Error("ResourceExistsError") as ResourceExistsError);

    const user_context = this.getUserContext(user);
    const path_to_parent = this.pathname.slice(0, this.pathname.length - 1);
    assert(
      path_to_parent.length > 0,
      new Error("ResourceExistsError: cannot create root") as ResourceExistsError,
    );
    let parent_resource = null;
    {
      parent_resource = new ResourceService({
        adapter: this.adapter,
        baseUrl: this.baseUrl,
        pathname: path_to_parent,
        context: user_context,
        is_collection: true,
      });
      assert(
        await parent_resource.exists(),
        new Error("ResourceTreeNotCompleteError") as ResourceTreeNotCompleteError,
      );
    }
    const new_content = {
      parent_id: parent_resource.file.id || "user_" + this.context.user.id,
      name: this.pathname[this.pathname.length - 1],
      is_directory: this.is_collection,
      id: null,
    };
    this.file = await gr.services.documents.documents.create(null, new_content, {}, user_context);
    // TODO: when creating file needed to create an empty file
    // TODO: move it to the create function in documents service
    await gr.services.documents.documents.getAccess(this.file.id, user.username, user_context);
  };

  /**
   * Delete the resource.
   *
   * If the resource is a collection, it should only be deleted if it's empty.
   *
   * If the resource doesn't exist, a ResourceNotFoundError should be thrown.
   *
   * If the user doesn't have permission to delete the resource, an
   * UnauthorizedError should be thrown.
   *
   * If no one has permission to delete the resource, a ForbiddenError should be
   * thrown.
   */
  delete = async (user: User): Promise<void> => {
    assert(await this.exists(), new Error("ResourceNotFoundError") as ResourceNotFoundError);
    assert(
      checkAccess(
        this.file.id,
        this.file,
        "manage",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ),
      new Error("User cannot delete this resource") as UnauthorizedError,
    );
    // cannot delete not empty collection
    if (this.is_collection && (await this.getInternalMembers(user)).length != 0) {
      throw new Error("Method not supported: collection is not empty!") as MethodNotSupportedError;
    }
    // this check is needed for nephele moving/copying handling in case the resource was moved (updated name)
    // but the file id remains the same
    if (this.file.name == this.pathname[this.pathname.length - 1]) {
      // TODO[GK]: implement deleting for shared files
      // TODO[GK]: the files are not deleted, but moved to trash
      try {
        await gr.services.documents.documents.delete(
          this.file.id,
          this.file,
          this.getUserContext(user),
        );
      } catch (error) {
        throw new Error("Failed to delete the resource!") as InternalServerError;
      }
    }
  };

  /**
   * Copy the resource to the destination.
   *
   * If the resource is a collection, do not copy its contents (internal
   * members), only its properties.
   *
   * This **must not** copy any locks along with the resource.
   *
   * If the resource doesn't exist, a ResourceNotFoundError should be thrown.
   *
   * If the user doesn't have permission to copy the resource, an
   * UnauthorizedError should be thrown.
   *
   * If no one has permission to copy the resource, a ForbiddenError should be
   * thrown.
   *
   * If the destination is outside of this adapter's ability to modify, a
   * BadGatewayError should be thrown.
   *
   * If the destination would be a member of a collection that doesn't exist
   * (like a file in a folder that doesn't exist), a
   * ResourceTreeNotCompleteError should be thrown.
   *
   * If the source and the destination ultimately resolve to the same resource,
   * or the destination falls under the source itself, a ForbiddenError should
   * be thrown.
   */
  //TODO: check copying collection into itself
  copy = async (destination: URL, baseUrl: URL, user: User): Promise<void> => {
    // remove trailing slashes and make an array from it
    let pathname = decodeURI(destination.pathname);
    pathname = pathname.replace(baseUrl.pathname, "");
    pathname = pathname.replace(/^\/+|\/+$/g, "");
    const dest_path = pathname.split("/");

    assert(dest_path.length > 0, new Error("Destination cannot be null") as BadGatewayError);
    assert(await this.exists(), new Error("ResourceNotFoundError") as ResourceNotFoundError);
    assert(
      !destination.pathname.includes(await this.getCanonicalPath()),
      new Error("Cannot copy into itself") as ForbiddenError,
    );
    assert(
      checkAccess(
        this.file.id,
        this.file,
        "read",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ),
      new Error("User cannot delete this resource") as UnauthorizedError,
    );
    let parent_path = null;
    try {
      // now we need to check that there is parent of destination File
      parent_path = await this.loadPath(dest_path.slice(0, -1));
    } catch (error) {
      throw new Error("Resource tree not completed") as ResourceTreeNotCompleteError;
    }

    const new_content = {
      parent_id: parent_path[parent_path.length - 1],
      name: dest_path[dest_path.length - 1],
      is_directory: this.is_collection,
    };
    return await gr.services.documents.documents.copy(
      this.file.id,
      this.file,
      new_content,
      this.getUserContext(user),
    );
  };

  /**
   * Move the resource to the destination.
   *
   * This will only be called on non-collection resources. Collection resources
   * will instead by copied, have their contents moved, then be deleted.
   *
   * This **must not** move any locks along with the resource.
   *
   * If the resource doesn't exist, a ResourceNotFoundError should be thrown.
   *
   * If the user doesn't have permission to move the resource, an
   * UnauthorizedError should be thrown.
   *
   * If no one has permission to move the resource, a ForbiddenError should be
   * thrown.
   *
   * If the destination is outside of this adapter's ability to modify, a
   * BadGatewayError should be thrown.
   *
   * If the destination would be a member of a collection that doesn't exist
   * (like a file in a folder that doesn't exist), a
   * ResourceTreeNotCompleteError should be thrown.
   *
   * If the source and the destination ultimately resolve to the same resource,
   * or the destination falls under the source itself, a ForbiddenError should
   * be thrown.
   */
  move = async (destination: URL, baseUrl: URL, user: User): Promise<void> => {
    // remove trailing slashes and make an array from it
    let pathname = decodeURI(destination.pathname);
    pathname = pathname.replace(baseUrl.pathname, "");
    pathname = pathname.replace(/^\/+|\/+$/g, "");
    const dest_path = pathname.split("/");

    assert(dest_path.length > 0, new Error("Destination cannot be null") as BadGatewayError);
    assert(await this.exists(), new Error("ResourceNotFoundError") as ResourceNotFoundError);
    assert(
      !destination.pathname.includes(await this.getCanonicalPath()),
      new Error("Cannot move into itself") as ForbiddenError,
    );
    assert(
      checkAccess(
        this.file.id,
        this.file,
        "manage",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ),
      new Error("User cannot delete this resource") as UnauthorizedError,
    );
    let parent_path = null;
    try {
      // now we need to check that there is parent of destination File
      parent_path = await this.loadPath(dest_path.slice(0, -1));
    } catch (error) {
      throw new Error("Resource tree not completed") as ResourceTreeNotCompleteError;
    }

    const new_content = {
      parent_id: parent_path[parent_path.length - 1],
      name: dest_path[dest_path.length - 1],
      is_directory: this.is_collection,
    };
    return await gr.services.documents.documents.move(
      this.file.id,
      this.file,
      new_content,
      this.getUserContext(user),
    );
  };

  /**
   * Return the length, in bytes, of this resource's content (what would be
   * returned from getStream).
   */
  getLength = async (): Promise<number> => {
    if (!(await this.exists()) || (await this.isCollection())) {
      return Promise.resolve(0);
    }

    return calculateItemSize(this.file, gr.services.documents.documents.repository, this.context);
  };

  /**
   * Return the current ETag for this resource.
   */
  getEtag = async (): Promise<string> => {
    try {
      return this.file.last_version_cache.id;
    } catch (err) {
      // console.log("No Version Cache for ", this);
      return "none";
    }
  };

  /**
   * MIME type.
   *
   * You can use `mime` or `mmmagic` if you don't know it.
   *
   * If the resource doesn't have a media type (like a folder in a filesystem),
   * return null.
   */
  getMediaType = async (): Promise<string | null> => {
    return !(await this.exists()) || (await this.isCollection())
      ? null
      : this.file.last_version_cache.file_metadata.mime;
  };

  /**
   * The canonical name of the resource. (The basename of its path.)
   */
  getCanonicalName = async (): Promise<string> => {
    assert(await this.exists(), "ResourceNotFoundError");

    return this.file.name;
  };

  /**
   * The canonical path relative to the root of the adapter.
   *
   * This should **not** be URL encoded.
   */
  getCanonicalPath = async (): Promise<string> => {
    // assert(await this.exists(), "ResourceNotFoundError");

    return this.pathname.join("/");
  };

  /**
   * The canonical URL must be within the adapter's namespace, and must
   * not have query parameters.
   *
   * The adapter's namespace in the current request is provided to the adapter
   * as `baseUrl` when the resource is requested.
   */
  getCanonicalUrl = async (): Promise<URL> => {
    return new URL(
      (await this.getCanonicalPath())
        .split("/")
        .map(encodeURIComponent)
        .join("/")
        .replace(/^\//, () => ""),
      this.baseUrl,
    );
  };

  /**
   * Return whether this resource is a collection.
   */
  isCollection = async (): Promise<boolean> => {
    return this.is_collection;
  };

  /**
   * Get the internal members of the collection.
   *
   * Internal members are the direct descendents (children) of a collection. If
   * this is called on a resource that is not a collection, it should throw a
   * MethodNotSupportedError.
   *
   * If the user doesn't have permission to see the internal members, an
   * UnauthorizedError should be thrown.
   */
  getInternalMembers = async (user: User): Promise<Resource[]> => {
    // console.log("ResourceService::getInternalMembers called()");
    // console.log(this.file);
    assert(await this.exists(), new Error("ResourceNotFoundError") as ResourceNotFoundError);
    assert(
      await checkAccess(
        this.file.id,
        this.file,
        "read",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ),
      new Error("User does not have access to this folder") as UnauthorizedError,
    );
    assert(
      this.file.is_directory,
      new Error("Files do not support this method") as MethodNotSupportedError,
    );
    try {
      const item = await gr.services.documents.documents.get(this.file.id, this.context);

      return item.children.map(
        child =>
          new ResourceService({
            adapter: this.adapter,
            baseUrl: this.baseUrl,
            pathname: this.pathname.concat([child.name]),
            context: this.context,
            file: child,
            pathIds: this.pathIds.concat([this.file.id]),
            is_collection: child.is_directory,
          }),
      );
    } catch (err) {
      console.error(err);
      throw new Error(err) as BadGatewayError;
    }
  };
  /**
   * Returns last version about the resource
   */
  getVersions = async (): Promise<FileVersion[]> => {
    assert(await this.exists(), new Error("ResourceNotFoundError") as ResourceNotFoundError);
    return (await gr.services.documents.documents.get(this.file.id, this.context)).versions;
  };

  /**
   * Returns total space used by user
   */
  getTotalSpace = async (): Promise<number> => {
    return await gr.services.documents.documents.userQuota(this.context);
  };

  /**
   * Returns free space for the user
   */
  getFreeSpace = async (): Promise<number> => {
    return gr.services.documents.documents.defaultQuota - (await this.getTotalSpace());
  };
}
