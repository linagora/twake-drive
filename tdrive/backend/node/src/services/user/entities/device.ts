import { merge } from "lodash";
import { Column, Entity } from "../../../core/platform/services/database/services/orm/decorators";
import { uuid } from "../../../utils/types";

export const TYPE = "devices";

export enum DeviceTypesEnum {
  /** Firebase Cloud Messaging - for devices than can receive notifications */
  FCM = "FCM",
  /** WebDAV - For HTTP basic auth credentials because the OIDC doesn't provide the password */
  WebDAV = "WebDAV",
}

@Entity(TYPE, {
  primaryKey: [["id"]],
  type: TYPE,
})
export default class Device {
  /** `id` is used in Basic HTTP auth headers as the username, so cannot contain `:` */
  @Column("id", "uuid", { generator: "uuid" })
  id: string;

  @Column("password", "string", { generator: "uuid" })
  password: string;

  @Column("user_id", "uuid")
  user_id: uuid;

  @Column("company_id", "uuid")
  company_id: string;

  @Column("type", "string")
  type: DeviceTypesEnum;

  @Column("version", "string")
  version: string;

  @Column("push_notifications", "boolean")
  push_notifications: boolean;
}

export type UserDevicePrimaryKey = Pick<Device, "id">;

export function getInstance(userDevice: Partial<Device> & UserDevicePrimaryKey): Device {
  return merge(new Device(), userDevice);
}
