import { Type } from "class-transformer";
import { Column } from "../../../core/platform/services/database/services/orm/decorators";

export const TYPE = "drive_file_locks";

export class DriveLock {
  @Type(() => String)
  @Column("company_id", "uuid")
  company_id: string;

  @Type(() => String)
  @Column("company_id", "uuid")
  user_id: string;

  @Type(() => String)
  @Column("id", "uuid", { generator: "uuid" })
  id: string;

  @Type(() => String)
  @Column("drive_file_id", "uuid")
  drive_file_id: string;

  @Type(() => String)
  @Column("token", "string", { generator: "uuid" })
  token: string;

  @Type(() => Date)
  @Column("created_at", "number")
  created_at: number;

  // unit: milliseconds
  @Type(() => Number)
  @Column("timeout", "number")
  timeout: number;

  @Type(() => String)
  @Column("scope", "string")
  scope: "exclusive" | "shared";

  @Type(() => String)
  @Column("depth", "string")
  depth: "0" | "infinity";

  @Type(() => Boolean)
  @Column("provisional", "boolean")
  provisional: boolean;

  @Column("owner", "encoded_json")
  owner: any;

  @Type(() => String)
  @Column("principal", "string")
  principal: string;
}
