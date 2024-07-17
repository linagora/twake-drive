export type DriveFileType = {
  access: 'manage' | 'write' | 'read' | 'none';
  item: {
    last_version_cache: {
      id: string;
      date_added: number;
      file_metadata: {
        external_id: string;
        name?: string;
      };
    };
  };
};

export type DriveRequestParams = {
  drive_file_id: string;
  company_id: string;
};

export interface IDriveService {
  get: (params: DriveRequestParams) => Promise<DriveFileType>;
  createVersion: (params: { company_id: string; drive_file_id: string; file_id: string }) => Promise<DriveFileType['item']['last_version_cache']>;
  beginEditingSession: (company_id: string, drive_file_id: string) => Promise<string>;
  endEditing: (company_id: string, editing_session_key: string, file_source_url: string) => Promise<void>;
  getByEditingSessionKey: (params: { company_id: string; editing_session_key: string; user_token?: string }) => Promise<DriveFileType['item']>;
}
