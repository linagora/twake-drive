import { DriveFileType, IDriveService } from '@/interfaces/drive.interface';
import apiService from './api.service';
import logger from '../lib/logger';
import { Stream } from 'stream';
import FormData from 'form-data';

/**
 * Client for Twake Drive's APIs dealing with `DriveItem`s, using {@see apiService}
 * to handle authorization
 */
class DriveService implements IDriveService {
  public get = async (params: { company_id: string; drive_file_id: string; user_token?: string }): Promise<DriveFileType> => {
    try {
      const { company_id, drive_file_id } = params;
      const resource = await apiService.get<DriveFileType>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}`,
        token: params.user_token,
      });

      return resource;
    } catch (error) {
      logger.error('Failed to fetch file metadata: ', error.stack);

      return Promise.reject();
    }
  };

  public createVersion = async (params: {
    company_id: string;
    drive_file_id: string;
    file_id: string;
  }): Promise<DriveFileType['item']['last_version_cache']> => {
    try {
      const { company_id, drive_file_id, file_id } = params;
      return await apiService.post<{}, DriveFileType['item']['last_version_cache']>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}/version`,
        payload: {
          drive_item_id: drive_file_id,
          provider: 'internal',
          file_metadata: {
            external_id: file_id,
            source: 'internal',
          },
        },
      });
    } catch (error) {
      logger.error('Failed to create version: ', error.stack);
      return Promise.reject();
    }
  };

  public async beginEditingSession(company_id: string, drive_file_id: string) {
    try {
      const resource = await apiService.post<{}, { editingSessionKey: string }>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/${drive_file_id}/editing_session`,
        payload: {
          editorApplicationId: 'mock_application_id',
        },
      });
      if (resource?.editingSessionKey) {
        return resource.editingSessionKey;
      } else {
        throw new Error(`Failed to obtain editing session key, response: ${JSON.stringify(resource)}`);
      }
    } catch (error) {
      logger.error('Failed to begin editing session: ', error.stack);
      throw error;
    }
  }

  public async cancelEditing(company_id: string, editing_session_key) {
    try {
      await apiService.delete<{}>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/editing_session/${encodeURIComponent(editing_session_key)}`,
      });
    } catch (error) {
      logger.error('Failed to begin editing session: ', error.stack);
      throw error;
      //TODO make monitoring for such kind of errors
    }
  }

  public async endEditing(company_id: string, editing_session_key: string, url: string) {
    try {
      if (!url) {
        throw Error('no url found');
      }

      const originalFile = await this.getByEditingSessionKey({ company_id, editing_session_key });

      if (!originalFile) {
        throw Error('original file not found');
      }

      const newFile = await apiService.get<Stream>({
        url,
        responseType: 'stream',
      });

      const form = new FormData();

      const filename = encodeURIComponent(originalFile.last_version_cache.file_metadata.name);

      form.append('file', newFile, {
        filename,
      });

      logger.info('Saving file version to Twake Drive: ', filename);

      await apiService.post({
        url: `/internal/services/documents/v1/companies/${company_id}/item/editing_session/${encodeURIComponent(editing_session_key)}`,
        payload: form,
        headers: form.getHeaders(),
      });
    } catch (error) {
      logger.error('Failed to begin editing session: ', error.stack);
      throw error;
      //TODO make monitoring for such kind of errors
    }
  }

  /**
   * Get the document information by the editing session key. Just simple call to the drive API
   * /item/editing_session/${editing_session_key}
   * @param params
   */
  public getByEditingSessionKey = async (params: {
    company_id: string;
    editing_session_key: string;
    user_token?: string;
  }): Promise<DriveFileType['item']> => {
    try {
      const { company_id, editing_session_key } = params;
      return await apiService.get<DriveFileType['item']>({
        url: `/internal/services/documents/v1/companies/${company_id}/item/editing_session/${encodeURIComponent(editing_session_key)}`,
        token: params.user_token,
      });
    } catch (error) {
      logger.error('Failed to fetch file metadata by editing session key: ', error.stack);
      throw error;
    }
  };
}

export default new DriveService();
