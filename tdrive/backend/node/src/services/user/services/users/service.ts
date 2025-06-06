/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import {
  CreateResult,
  CrudException,
  DeleteResult,
  ExecutionContext,
  ListResult,
  OperationType,
  Pagination,
  SaveResult,
  UpdateResult,
} from "../../../../core/platform/framework/api/crud-service";
import Repository, {
  FindFilter,
  FindOptions,
} from "../../../../core/platform/services/database/services/orm/repository/repository";
import User, { getInstance as getUserInstance, UserPrimaryKey } from "../../entities/user";
import { ListUserOptions, SearchUserOptions } from "./types";
import CompanyUser from "../../entities/company_user";
import SearchRepository from "../../../../core/platform/services/search/repository";
import ExternalUser, { getInstance as getExternalUserInstance } from "../../entities/external_user";
import Device, {
  getInstance as getDeviceInstance,
  TYPE as DeviceType,
} from "../../entities/device";
import PasswordEncoder from "../../../../utils/password-encoder";
import assert from "assert";
import { localEventBus } from "../../../../core/platform/framework/event-bus";
import { ResourceEventsPayload } from "../../../../utils/types";
import { isNumber, isString } from "lodash";
import NodeCache from "node-cache";
import gr from "../../../global-resolver";
import { TYPE as DriveFileType, DriveFile } from "../../../documents/entities/drive-file";
import { UpdateUser } from "./types";
import { formatUsername } from "../../../../utils/users";
import { Configuration, logger } from "../../../../core/platform/framework";

export class UserServiceImpl {
  version: "1";
  repository: Repository<User>;
  searchRepository: SearchRepository<User>;
  companyUserRepository: Repository<CompanyUser>;
  extUserRepository: Repository<ExternalUser>;
  driveFileRepository: Repository<DriveFile>;
  private deviceRepository: Repository<Device>;
  private cache: NodeCache;
  private configuration: Configuration;

  async init(): Promise<this> {
    this.searchRepository = gr.platformServices.search.getRepository<User>("user", User);
    this.repository = await gr.database.getRepository<User>("user", User);
    this.companyUserRepository = await gr.database.getRepository<CompanyUser>(
      "group_user",
      CompanyUser,
    );
    this.extUserRepository = await gr.database.getRepository<ExternalUser>(
      "external_user_repository",
      ExternalUser,
    );

    this.deviceRepository = await gr.database.getRepository<Device>(DeviceType, Device);
    this.driveFileRepository = await gr.database.getRepository<DriveFile>(DriveFileType, DriveFile);

    this.cache = new NodeCache({ stdTTL: 0.2, checkperiod: 120 });

    this.configuration = new Configuration("general.accounts");

    //If user deleted from Tdrive, remove it from all companies
    localEventBus.subscribe<ResourceEventsPayload>("user:deleted", async data => {
      if (data?.user?.id) gr.services.companies.ensureDeletedUserNotInCompanies(data.user);
    });

    return this;
  }

  private async updateExtRepository(user: User, context?: ExecutionContext) {
    if (user.identity_provider_id) {
      const key = { service_id: user.identity_provider, external_id: user.identity_provider_id };
      const extUser =
        (await this.extUserRepository.findOne(key, {}, context)) || getExternalUserInstance(key);
      extUser.user_id = user.id;
      await this.extUserRepository.save(extUser, context);
    }
  }

  private async updateExtRepositoryInCaseChangeEmail(user: User, context?: ExecutionContext) {
    if (user.identity_provider_id === "null") {
      return;
    }

    const extUser = await this.extUserRepository.findOne({ user_id: user.id }, {}, context);
    if (extUser) {
      await this.extUserRepository.remove(extUser, context);
    }

    const newExtUser = getExternalUserInstance({
      service_id: user.identity_provider || "null",
      external_id: user.identity_provider_id || "null",
      user_id: user.id,
    });
    await this.extUserRepository.save(newExtUser, context);
  }

  private assignDefaults(user: User) {
    user.creation_date = !isNumber(user.creation_date) ? Date.now() : user.creation_date;
    if (user.identity_provider_id && !user.identity_provider) user.identity_provider = "console";
    if (user.email_canonical) user.email_canonical = user.email_canonical.toLocaleLowerCase();
    if (user.username_canonical) user.username_canonical = formatUsername(user.username_canonical);
  }

  async create(user: User, context?: ExecutionContext): Promise<CreateResult<User>> {
    await this.save(user, context);
    return new CreateResult("user", user);
  }

  async update(
    id: string,
    body: UpdateUser,
    context?: ExecutionContext,
  ): Promise<UpdateResult<User>> {
    const user = await gr.services.users.get({ id });
    if (!user) {
      throw CrudException.notFound(`User ${id} not found`);
    }

    const currentEmail = user.email_canonical;
    const isChangeEmail = currentEmail !== body.email;

    if (isChangeEmail) {
      const accType = this.configuration.get("type");
      if (accType === "remote") {
        await gr.services.console.getClient().userWasDeletedForceLogout({ email: currentEmail });
      }
      const userByEmail = await gr.services.users.getByEmail(body.email, context);
      if (userByEmail) {
        throw CrudException.badRequest(`Email ${body.email} is existed`);
      }
    }

    user.email_canonical = body.email || currentEmail;
    user.first_name = body.first_name || user.first_name;
    user.last_name = body.last_name || user.last_name;
    user.picture = body.picture || user.picture;
    user.creation_date = !isNumber(user.creation_date) ? Date.now() : user.creation_date;
    if (isChangeEmail) {
      user.username_canonical = formatUsername(body.email);
      user.identity_provider_id = user.identity_provider_id !== "null" ? currentEmail : "null";
    }

    await this.repository.save(user, context);
    if (isChangeEmail) {
      await this.updateExtRepositoryInCaseChangeEmail(user, context);
    }

    return new UpdateResult("user", user);
  }

  async save(user: User, context?: ExecutionContext): Promise<SaveResult<User>> {
    this.assignDefaults(user);
    await this.repository.save(user, context);
    await this.updateExtRepository(user);

    return new SaveResult("user", user, OperationType.UPDATE);
  }

  async delete(pk: Partial<User>, context?: ExecutionContext): Promise<DeleteResult<User>> {
    const instance = await this.repository.findOne(pk, {}, context);
    if (instance) await this.repository.remove(instance, context);
    return new DeleteResult<User>("user", instance, !!instance);
  }

  /** If `deleteData` is false, then the user is only marked deleted and no data is actually deleted */
  async anonymizeAndDelete(pk: UserPrimaryKey, context?: ExecutionContext, deleteData?: boolean) {
    const user = await this.get(pk);
    logger.info({ user }, "Delete user data");

    if (context.user.server_request || context.user.id === user.id) {
      const userCopy = getUserInstance(user);

      if (!user.deleted) {
        //We keep a part of the user id as new name
        const partialId = user.id.toString().split("-")[0];

        user.username_canonical = `deleted-user-${partialId}`;
        user.email_canonical = `${partialId}@tdrive.removed`;
        user.first_name = "";
        user.last_name = "";
        user.phone = "";
        user.picture = "";
        user.thumbnail_id = null;
        user.status_icon = null;
        user.deleted = true;
        user.delete_process_started_epoch = new Date().getTime();

        await gr.services.console.getClient().userWasDeletedForceLogout({
          userId: user.id,
          email: userCopy.email_canonical,
        });

        await this.save(user);

        logger.info({ user }, "User was updated");
      }

      localEventBus.publish<ResourceEventsPayload>("user:deleted", {
        user: user,
      });

      return {
        isDeleted: deleteData && (await gr.platformServices.admin.deleteUser(userCopy)),
        userId: user.id,
      };
    }
  }

  async markToDeleted(pk: UserPrimaryKey) {
    const user = await this.get(pk);
    user.marked_to_delete = true;
    await this.save(user);
  }

  async search(
    pagination: Pagination,
    options?: SearchUserOptions,
    context?: ExecutionContext,
  ): Promise<ListResult<User>> {
    return await this.searchRepository
      .search(
        {},
        {
          pagination,
          ...(options.companyId ? { $in: [["companies", [options.companyId]]] } : {}),
          ...(options.workspaceId ? { $in: [["workspaces", [options.workspaceId]]] } : {}),
          $text: {
            $search: options.search,
          },
        },
        context,
      )
      .then(users => {
        users.filterEntities(u => u.identity_provider != "anonymous" && u.type != "anonymous");
        return users;
      });
  }

  async list(
    pagination: Pagination,
    options?: ListUserOptions,
    context?: ExecutionContext,
  ): Promise<ListResult<User>> {
    const findFilter: FindFilter = {};
    const findOptions: FindOptions = {
      pagination,
    };

    if (Array.isArray(options?.userIds) && options.userIds.length > 0) {
      findOptions.$in = [["id", options.userIds]];
    }

    return this.repository.find(findFilter, findOptions, context);
  }

  getByEmail(email: string, context?: ExecutionContext): Promise<User> {
    return this.repository.findOne({ email_canonical: email }, {}, context);
  }

  getByEmails(emails: string[], context?: ExecutionContext): Promise<User[]> {
    return Promise.all(emails.map(email => this.getByEmail(email))).then(emails =>
      emails.filter(a => a),
    );
  }

  async setPreferences(
    pk: UserPrimaryKey,
    preferences: User["preferences"],
    context?: ExecutionContext,
  ): Promise<User["preferences"]> {
    const user = await this.repository.findOne(pk, {}, context);
    if (!user.preferences) user.preferences = {};
    for (const key in preferences) {
      //@ts-ignore
      user.preferences[key] = preferences[key];
    }

    await this.save(user);
    return user.preferences;
  }

  async get(pk: UserPrimaryKey, context?: ExecutionContext): Promise<User> {
    return await this.repository.findOne(pk, {}, context);
  }

  async getCached(pk: UserPrimaryKey, context?: ExecutionContext): Promise<User> {
    if (!(pk.id && isString(pk.id))) return null;
    if (this.cache.has(pk.id)) return this.cache.get<User>(pk.id);
    const entity = await this.get(pk);
    this.cache.set<User>(pk.id, entity);
    return entity;
  }

  async getByUsername(username: string, context?: ExecutionContext): Promise<User> {
    return await this.repository.findOne(
      {
        username_canonical: (username || "").toLocaleLowerCase(),
      },
      {},
      context,
    );
  }

  async getByConsoleId(
    id: string,
    service_id: string = "console",
    context?: ExecutionContext,
  ): Promise<User> {
    const extUser = await this.extUserRepository.findOne(
      { service_id, external_id: id },
      {},
      context,
    );
    if (!extUser) {
      return null;
    }
    return this.repository.findOne({ id: extUser.user_id }, {}, context);
  }

  async getUserCompanies(pk: UserPrimaryKey, context?: ExecutionContext): Promise<CompanyUser[]> {
    return await this.companyUserRepository
      .find({ user_id: pk.id }, {}, context)
      .then(a => a.getEntities());
  }

  async isEmailAlreadyInUse(email: string, context?: ExecutionContext): Promise<boolean> {
    return this.repository
      .findOne({ email_canonical: email }, {}, context)
      .then(user => Boolean(user));
  }
  async getAvailableUsername(username: string, context?: ExecutionContext): Promise<string> {
    const user = await this.getByUsername(username);

    if (!user) {
      return username;
    }

    let suitableUsername = null;

    for (let i = 1; i < 1000; i++) {
      const dynamicUsername = username + i;
      if (!(await this.getByUsername(dynamicUsername.toLocaleLowerCase()))) {
        suitableUsername = dynamicUsername;
        break;
      }
    }
    return suitableUsername;
  }

  async getUserDevices(
    userPrimaryKey: UserPrimaryKey,
    context?: ExecutionContext,
  ): Promise<Device[]> {
    const user = await this.get(userPrimaryKey);
    if (!user) {
      throw CrudException.notFound(`User ${userPrimaryKey} not found`);
    }
    if (!user.devices || user.devices.length == 0) {
      return [];
    }
    return Promise.all(
      user.devices.map(id => this.deviceRepository.findOne({ id }, {}, context)),
    ).then(a => a.filter(a => a));
  }

  async registerUserDevice(
    userPrimaryKey: UserPrimaryKey,
    id: string,
    type: string,
    version: string,
    context?: ExecutionContext,
  ): Promise<void> {
    await this.deregisterUserDevice(id);

    const user = await this.get(userPrimaryKey);
    if (!user) {
      throw CrudException.notFound(`User ${userPrimaryKey} not found`);
    }
    user.devices = user.devices || [];
    user.devices.push(id);

    await this.repository.save(user, context);
    await this.deviceRepository.save(
      getDeviceInstance({ id, type, version, user_id: user.id }),
      context,
    );
  }

  async deregisterUserDevice(id: string, context?: ExecutionContext): Promise<void> {
    const existedDevice = await this.deviceRepository.findOne({ id }, {}, context);

    if (existedDevice) {
      const user = await this.get({ id: existedDevice.user_id });
      if (user) {
        user.devices = (user.devices || []).filter(d => d !== id);
        await this.repository.save(user, context);
      }
      await this.deviceRepository.remove(existedDevice, context);
    }
  }

  async setPassword(
    userPrimaryKey: UserPrimaryKey,
    password: string,
    context?: ExecutionContext,
  ): Promise<void> {
    assert(password, "UserAPI.setPassword: Password is not defined");
    const passwordEncoder = new PasswordEncoder();
    const user = await this.get(userPrimaryKey);
    if (!user) {
      throw CrudException.notFound(`User ${userPrimaryKey.id} not found`);
    }
    user.password = await passwordEncoder.encodePassword(password);
    user.salt = null;
    await this.repository.save(user, context);
  }

  async getHashedPassword(
    userPrimaryKey: UserPrimaryKey,
    context?: ExecutionContext,
  ): Promise<[string, string]> {
    const user = await this.get(userPrimaryKey);
    if (!user) {
      throw CrudException.notFound(`User ${userPrimaryKey.id} not found`);
    }

    if (user.salt) {
      return [user.password, user.salt];
    }

    return [user.password, null];
  }
}
