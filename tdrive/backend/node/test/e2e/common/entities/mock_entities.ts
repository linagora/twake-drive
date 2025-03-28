import {DriveFileAccessLevel, publicAccessLevel} from "../../../../src/services/documents/types";
import { UserQuota } from "../../../../src/services/user/web/types";

export type MockAccessInformation = {
    public?: {
        token: string;
        password: string;
        expiration: number;
        level: publicAccessLevel;
    };
    entities: MockAuthEntity[];
};

export type MockAuthEntity = {
    type: "user" | "channel" | "company" | "folder";
    id: string | "parent";
    level: publicAccessLevel | DriveFileAccessLevel;
};

export class DriveFileMockClass {
    id: string;
    name: string;
    size: number;
    added: number;
    parent_id: string;
    extension: string;
    description: string;
    tags: string[];
    last_modified: number;
    access_info: MockAccessInformation;
    editing_session_key: string;
    creator: string;
    is_directory: boolean;
    scope: "personal" | "shared";
    av_status: string;
    created_by: Record<string, any>;
    shared_by: Record<string, any>;
}

export class DriveItemDetailsMockClass {
  path: string[];
  item: DriveFileMockClass;
  children: DriveFileMockClass[];
  versions: Record<string, unknown>[];
  nextPage?: {
    page_token: string;
    limitStr: string;
    reversed: boolean;
  };
}

export class SearchResultMockClass {
    entities: DriveFileMockClass[];
}

export class UserQuotaMockClass implements UserQuota{
    remaining: number;
    total: number;
    used: number;
}

export class AccessTokenMockClass {
    access_token: {
        time: 0;
        expiration: number;
        refresh_expiration: number;
        value: string;
        refresh: string;
        type: "Bearer";
    };
}