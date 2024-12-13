import { INepheleLock, NepheleModule } from "../loader";
import gr from "../../../global-resolver";
import { DriveExecutionContext } from "../../../documents/types";
import { Resource } from "./resource";

export class Lock implements INepheleLock {
  /**
   * A unique token representing this lock.
   */
  token: string;
  /**
   * The date at which the provisional lock was created, the real lock was
   * granted, or the lock was refreshed.
   */
  date: Date;
  /**
   * The number of milliseconds from `date` at which the lock will expire.
   *
   * Note that timeouts in WebDAV are requested and reported in seconds, not
   * milliseconds. Nephele translates these values to milliseconds.
   */
  timeout: number;
  /**
   * Whether this is an exclusive or shared lock.
   *
   * Exclusive locks mean that only the principal of this lock can perform
   * privileged actions. Shared locks mean that any principal who has a shared
   * lock can perform privileged actions. Shared locks are still unique, in that
   * every principal has their own unique lock token.
   */
  scope: "exclusive" | "shared";
  /**
   * A depth '0' lock prevents only the resource itself from being modified. A
   * depth 'infinity' lock prevents the resource and all of its members from
   * being modified.
   */
  depth: "0" | "infinity";
  /**
   * A provisional lock is saved before checking whether the lock can actually
   * be granted, since it may take some time to check through the entire subtree
   * for conflicting locks before the lock can be granted.
   *
   * When a provisional lock is found that would conflict with a lock being
   * requested, the server will wait for a few moments before trying again. Once
   * the provisional lock has either been granted or denied, the lock request
   * will proceed.
   *
   * Provisional locks will not prevent modifications, since they have
   * technically not yet been granted.
   */
  provisional: boolean;
  /**
   * The owner, provided by the user who requested the lock.
   *
   * This will be an XML object, presumably with information about how to
   * contact the owner of the lock.
   */
  owner: any;

  constructor(
    private readonly nephele: NepheleModule,
    /**
     * The lock-root resource of this lock.
     */
    public readonly resource: Resource,
    private readonly context: DriveExecutionContext,
    options: {
      token?: string;
      date?: Date;
      timeout?: number;
      scope?: "exclusive" | "shared";
      depth?: "0" | "infinity";
      provisional?: boolean;
      owner?: any;
    },
  ) {
    this.token = options.token || "";
    this.date = options.date || new Date();
    this.timeout = options.timeout || 3600000; // Default to 1 hour
    this.scope = options.scope || "exclusive";
    this.depth = options.depth || "0";
    this.provisional = options.provisional !== undefined ? options.provisional : true;
    this.owner = options.owner || null;
  }

  /**
   * Save the lock to storage.
   *
   * It should save all of the properties of the lock defined above, as well as
   * the user who requested the lock (the lock's principal). A lock saved to
   * storage doesn't necessarily mean it's granted. If it is provisional,
   * whether it can be granted is still being assessed.
   *
   * The timeout for a provisional lock will be substantially shorter than the
   * timeout for a real lock. Timeouts for both should be considered a genuine
   * way to tell whether the lock is expired.
   *
   * If the lock is not valid for the resource, a BadRequestError should be
   * thrown.
   */
  async save(): Promise<void> {
    // TODO[GK]: figure out what to do in that case ( they appear )
    if (!(await this.resource.exists())) {
      return;
    }
    const driveFile = this.resource.file;

    if (!driveFile.locks) {
      driveFile.locks = [];
    }

    // Check for conflicting locks
    const conflictingLock = driveFile.locks.find(
      lock =>
        !lock.provisional &&
        (this.scope === "exclusive" || lock.scope === "exclusive") &&
        !Lock.isLockExpired(lock),
    );

    if (conflictingLock) {
      throw new this.nephele.LockedError("Conflicting lock exists");
    }

    // Remove expired locks
    driveFile.locks = driveFile.locks.filter(lock => !Lock.isLockExpired(lock));

    // Add or update the current lock
    const lockData = this.toLockData();
    const existingLockIndex = driveFile.locks.findIndex(lock => lock.token === this.token);
    if (existingLockIndex >= 0) {
      driveFile.locks[existingLockIndex] = lockData;
    } else {
      driveFile.locks.push(lockData);
    }

    // Save the updated DriveFile
    try {
      await gr.services.documents.documents.update(driveFile.id, driveFile, this.resource.context);
    } catch (error) {
      throw new this.nephele.InternalServerError("Failed to save the lock");
    }
  }

  /**
   * Delete the lock from storage.
   */
  async delete(): Promise<void> {
    if (!(await this.resource.exists())) {
      return;
    }
    const driveFile = this.resource.file;

    if (!driveFile.locks) return;

    driveFile.locks = driveFile.locks.filter(lock => lock.token !== this.token);
    await gr.services.documents.documents.update(driveFile.id, driveFile, this.resource.context);
  }

  private toLockData(): any {
    return {
      company_id: this.context.company.id,
      user_id: this.context.user.id,
      token: this.token,
      date: this.date.getTime(),
      timeout: this.timeout,
      scope: this.scope,
      depth: this.depth,
      provisional: this.provisional,
      owner: this.owner,
    };
  }

  static fromLockData(
    nephele: NepheleModule,
    resource: Resource,
    context: DriveExecutionContext,
    lockData: any,
  ): Lock {
    return new Lock(nephele, resource, context, {
      token: lockData.token,
      date: new Date(lockData.date),
      timeout: lockData.timeout,
      scope: lockData.scope,
      depth: lockData.depth,
      provisional: lockData.provisional,
      owner: lockData.owner,
    });
  }

  static isLockExpired(lock: any): boolean {
    const lockDate = lock.date instanceof Date ? lock.date : new Date(lock.date);
    const expirationDate = new Date(lockDate.getTime() + lock.timeout);
    return expirationDate <= new Date();
  }
}
