import {
  INepheleAdapter,
  INepheleLock,
  INepheleProperties,
  INepheleResource,
  INepheleUser,
  NepheleModule,
} from "../loader";

import { Readable } from "stream";
import { Properties } from "./properties";
import { Lock } from "./lock";

import gr from "../../../global-resolver";
import { calculateItemSize } from "../../../documents/utils";
import { DriveFile } from "../../../documents/entities/drive-file";
import { DriveExecutionContext } from "../../../documents/types";
import { checkAccess } from "../../../documents/services/access-check";
import { FileVersion } from "../../../documents/entities/file-version";
import { MultipartFile } from "@fastify/multipart";
import { BusboyFileStream } from "@fastify/busboy";
import { UploadOptions } from "../../../files/types";
import { lookup } from "mrmime";
import _ from "lodash";

export class Resource implements INepheleResource {
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
  adapter: INepheleAdapter;
  pathname: string[];
  baseUrl: URL;
  context: DriveExecutionContext;
  file?: DriveFile | null;
  pathIds?: string[] | null;
  is_collection?: boolean = false;
  constructor(
    private readonly nephele: NepheleModule,
    {
      adapter,
      baseUrl,
      pathname,
      context,
      file,
      pathIds,
      is_collection,
    }: {
      adapter: INepheleAdapter;
      baseUrl: URL;
      pathname: string[];
      context: DriveExecutionContext;
      file?: DriveFile | null;
      pathIds?: string[] | null;
      is_collection?: boolean;
    },
  ) {
    this.adapter = adapter;
    this.baseUrl = baseUrl;
    this.pathname = pathname;
    this.context = context;
    this.file = file;
    this.pathIds = pathIds;
    this.is_collection = is_collection;
  }

  private async loadPath(pathname: string[]): Promise<string[]> {
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
  }

  /**
   * Check if the resource exists
   */
  async exists(): Promise<boolean> {
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
            undefined,
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
  }

  /**
   * Returns execution context for the user based on the execution context of the resource
   *
   * @param user
   */
  getUserContext(user: INepheleUser): DriveExecutionContext {
    const context = this.context;
    context.user.id = user.username;
    context.company.id = user.groupname;
    return context;
  }

  /**
   * Return any locks currently saved for this resource.
   *
   * This includes any provisional locks.
   *
   * Don't worry about timed out locks. Nephele will check for them and delete
   * them.
   */
  async getLocks(): Promise<INepheleLock[]> {
    if (!this.file || !this.file.locks) return [];

    return this.file.locks.map(lock =>
      Lock.fromLockData(
        this.nephele,
        this,
        { user: { id: lock.user_id }, company: { id: lock.company_id } },
        lock,
      ),
    );
  }

  /**
   * Return any locks currently saved for this resource for the given user.
   *
   * This includes any provisional locks.
   *
   * Don't worry about timed out locks. Nephele will check for them and delete
   * them.
   */
  async getLocksByUser(_user: INepheleUser): Promise<INepheleLock[]> {
    if (!this.file || !this.file.locks) return [];
    return this.file.locks.map(
      lock =>
        new Lock(this.nephele, this, this.context, {
          token: lock.token,
          timeout: lock.timeout,
          scope: lock.scope,
          depth: lock.depth,
          owner: lock.owner,
          provisional: lock.provisional,
        }),
    );
  }

  /**
   * Create a new lock for this user.
   *
   * The defaults for the lock don't matter. They will be assigned by Nephele
   * before being saved to storage.
   */
  async createLockForUser(user: INepheleUser): Promise<INepheleLock> {
    const lock = new Lock(this.nephele, this, this.getUserContext(user), {
      owner: { name: user.username },
    });
    return lock;
  }

  /**
   * Return a properties object for this resource.
   */
  async getProperties(): Promise<INepheleProperties> {
    return new Properties(this.nephele, this);
  }

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
  async getStream(range?: { start: number; end: number }): Promise<Readable> {
    if (!(await this.exists())) throw new this.nephele.ResourceNotFoundError();
    const downloadObject = await gr.services.documents.documents.download(
      this.file.id,
      null,
      this.context,
    );
    const file = downloadObject.file;
    if (!file || !file.file) {
      throw new this.nephele.ResourceNotFoundError("File not found or file content is empty");
    }
    let stream: Readable = file.file;
    if (range) {
      if (range.start < 0 || range.end < range.start) {
        throw new this.nephele.RangeNotSatisfiableError("Invalid range specified");
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
  }

  /**
   * Put the input stream into the resource.
   *
   * If the resource is a collection, and it can't accept a stream (like a
   * folder on a filesystem), a MethodNotSupportedError may be thrown.
   */
  async setStream(input: Readable, user: INepheleUser, mediaType?: string): Promise<void> {
    if (!(await this.exists())) await this.create(user);
    if (
      !(await checkAccess(
        this.file.id,
        this.file,
        "write",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ))
    )
      throw new this.nephele.UnauthorizedError("User does not have access to this resource");

    if (await this.isCollection())
      throw new this.nephele.MethodNotSupportedError("Collection doesn't support this operation");

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
  }

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
  async create(user: INepheleUser): Promise<void> {
    // TODO: check for shared files
    if (await this.exists()) throw new this.nephele.ResourceExistsError();

    const user_context = this.getUserContext(user);
    const path_to_parent = this.pathname.slice(0, this.pathname.length - 1);
    if (!path_to_parent?.length)
      throw new this.nephele.ResourceExistsError("ResourceExistsError: cannot create root");
    let parent_resource = null;
    {
      parent_resource = new Resource(this.nephele, {
        adapter: this.adapter,
        baseUrl: this.baseUrl,
        pathname: path_to_parent,
        context: user_context,
        is_collection: true,
      });
      if (!(await parent_resource.exists()))
        throw new this.nephele.ResourceTreeNotCompleteError("ResourceTreeNotCompleteError");
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
  }

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
  async delete(user: INepheleUser): Promise<void> {
    if (!(await this.exists())) throw new this.nephele.ResourceNotFoundError();
    if (
      !checkAccess(
        this.file.id,
        this.file,
        "manage",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      )
    )
      throw new this.nephele.UnauthorizedError("User cannot delete this resource");
    // cannot delete not empty collection
    if (this.is_collection && (await this.getInternalMembers(user)).length != 0) {
      throw new this.nephele.MethodNotSupportedError(
        "Method not supported: collection is not empty!",
      );
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
        throw new this.nephele.InternalServerError("Failed to delete the resource!");
      }
    }
  }

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
  async copy(destination: URL, baseUrl: URL, user: INepheleUser): Promise<void> {
    //TODO: check copying collection into itself
    // remove trailing slashes and make an array from it
    let pathname = decodeURI(destination.pathname);
    pathname = pathname.replace(baseUrl.pathname, "");
    pathname = pathname.replace(/^\/+|\/+$/g, "");
    const dest_path = pathname.split("/");

    if (dest_path.length == 0) throw new this.nephele.BadGatewayError("Destination cannot be null");
    if (!(await this.exists())) throw new this.nephele.ResourceNotFoundError();
    if (destination.pathname.includes(await this.getCanonicalPath()))
      throw new this.nephele.ForbiddenError("Cannot copy into itself");
    if (
      !checkAccess(
        this.file.id,
        this.file,
        "read",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      )
    )
      throw new this.nephele.UnauthorizedError("User cannot delete this resource");
    let parent_path = null;
    try {
      // now we need to check that there is parent of destination File
      parent_path = await this.loadPath(dest_path.slice(0, -1));
    } catch (error) {
      throw new this.nephele.ResourceTreeNotCompleteError("Resource tree not completed");
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
  }

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
  async move(destination: URL, baseUrl: URL, user: INepheleUser): Promise<void> {
    // remove trailing slashes and make an array from it
    let pathname = decodeURI(destination.pathname);
    pathname = pathname.replace(baseUrl.pathname, "");
    pathname = pathname.replace(/^\/+|\/+$/g, "");
    const dest_path = pathname.split("/");

    if (dest_path.length == 0) throw new this.nephele.BadGatewayError("Destination cannot be null");
    if (!(await this.exists())) throw new this.nephele.ResourceNotFoundError();
    if (destination.pathname.includes(await this.getCanonicalPath()))
      throw new this.nephele.ForbiddenError("Cannot move into itself");
    if (
      !checkAccess(
        this.file.id,
        this.file,
        "manage",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      )
    )
      throw new this.nephele.UnauthorizedError("User cannot delete this resource");
    let parent_path = null;
    try {
      // now we need to check that there is parent of destination File
      parent_path = await this.loadPath(dest_path.slice(0, -1));
    } catch (error) {
      throw new this.nephele.ResourceTreeNotCompleteError("Resource tree not completed");
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
  }

  /**
   * Return the length, in bytes, of this resource's content (what would be
   * returned from getStream).
   */
  async getLength(): Promise<number> {
    if (!(await this.exists()) || (await this.isCollection())) {
      return Promise.resolve(0);
    }

    return calculateItemSize(this.file, gr.services.documents.documents.repository, this.context);
  }

  /**
   * Return the current ETag for this resource.
   */
  async getEtag(): Promise<string> {
    try {
      return this.file.last_version_cache.id;
    } catch (err) {
      return "";
    }
  }

  /**
   * MIME type.
   *
   * You can use `mime` or `mmmagic` if you don't know it.
   *
   * If the resource doesn't have a media type (like a folder in a filesystem),
   * return null.
   */
  async getMediaType(): Promise<string | null> {
    return !(await this.exists()) || (await this.isCollection())
      ? null
      : this.file.last_version_cache.file_metadata.mime;
  }

  /**
   * The canonical name of the resource. (The basename of its path.)
   */
  async getCanonicalName(): Promise<string> {
    return this.pathname[this.pathname.length - 1];
  }

  /**
   * The canonical path relative to the root of the adapter.
   *
   * This should **not** be URL encoded.
   */
  async getCanonicalPath(): Promise<string> {
    return this.pathname.join("/");
  }

  /**
   * The canonical URL must be within the adapter's namespace, and must
   * not have query parameters.
   *
   * The adapter's namespace in the current request is provided to the adapter
   * as `baseUrl` when the resource is requested.
   */
  async getCanonicalUrl(): Promise<URL> {
    return new URL(
      (await this.getCanonicalPath())
        .split("/")
        .map(encodeURIComponent)
        .join("/")
        .replace(/^\//, () => ""),
      this.baseUrl,
    );
  }

  /**
   * Return whether this resource is a collection.
   */
  async isCollection(): Promise<boolean> {
    return this.is_collection;
  }

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
  async getInternalMembers(user: INepheleUser): Promise<INepheleResource[]> {
    if (!(await this.exists())) throw new this.nephele.ResourceNotFoundError();
    if (
      !(await checkAccess(
        this.file.id,
        this.file,
        "read",
        gr.services.documents.documents.repository,
        this.getUserContext(user),
      ))
    )
      throw new this.nephele.UnauthorizedError("User does not have access to this folder");
    if (!this.file.is_directory)
      throw new this.nephele.MethodNotSupportedError("Files do not support this method");
    try {
      const item = await gr.services.documents.documents.get(this.file.id, undefined, this.context);

      return item.children.map(
        child =>
          new Resource(this.nephele, {
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
      throw new this.nephele.BadGatewayError(err);
    }
  }

  /**
   * Returns last version about the resource
   */
  async getVersions(): Promise<FileVersion[]> {
    if (!(await this.exists())) throw new this.nephele.ResourceNotFoundError();
    return (await gr.services.documents.documents.get(this.file.id, undefined, this.context))
      .versions;
  }

  /**
   * Returns total space used by user
   */
  async getTotalSpace(): Promise<number> {
    return await gr.services.documents.documents.userQuota(this.context);
  }

  /**
   * Returns free space for the user
   */
  async getFreeSpace(): Promise<number> {
    return gr.services.documents.documents.defaultQuota - (await this.getTotalSpace());
  }
}
