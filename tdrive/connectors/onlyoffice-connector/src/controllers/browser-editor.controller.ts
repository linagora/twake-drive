import editorService from '@/services/editor.service';
import { NextFunction, Request, Response } from 'express';
import { CREDENTIALS_SECRET } from '@config';
import jwt from 'jsonwebtoken';
import driveService from '@/services/drive.service';
import { DriveFileType } from '@/interfaces/drive.interface';
import fileService from '@/services/file.service';
import { OfficeToken } from '@/interfaces/office-token.interface';
import logger from '@/lib/logger';
import { makeURLTo } from '@/routes';

interface RequestQuery {
  mode: string;
  company_id: string;
  preview: string;
  token: string;
  file_id: string;
  drive_file_id?: string;
}

interface RequestEditorQuery {
  office_token: string;
  company_id: string;
  file_id: string;
  drive_file_id: string;
}

/**
 * These routes are called by Twake Drive frontend. The user's browser opens ( +) `${config.plugin.edition_url}/` (`index`).
 * The user is redirected from there to open directly the OnlyOffice edition server's web UI, with appropriate preview or not
 * and rights checks.
 */
class BrowserEditorController {
  /**
   * Opened by the user's browser, proxied through the Twake Drive backend. Checks access to the
   * file with the backend, then redirects the user to the `editor` method but directly on this
   * connector, not proxied by Twake Drive's backend anymore.
   */
  public index = async (req: Request<{}, {}, {}, RequestQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { file_id, drive_file_id, company_id, preview, token } = req.query;
      const { user } = req;

      let driveFile: DriveFileType;
      if (drive_file_id) {
        //Append information about the drive file (versions, location, etc)
        driveFile = await driveService.get({
          drive_file_id,
          company_id,
          user_token: token,
        });

        if (!driveFile) {
          throw new Error('Drive file not found');
        }
      }

      //Get the file itself
      const file = await fileService.get({
        file_id: driveFile?.item?.last_version_cache?.file_metadata?.external_id || file_id,
        company_id,
      });

      if (!file) {
        throw new Error('File not found');
      }

      //Check whether the user has access to the file and put information to the office_token
      const hasAccess =
        (!driveFile && (file.user_id === user.id || preview)) ||
        ['manage', 'write'].includes(driveFile?.access) ||
        (driveFile?.access === 'read' && preview);

      if (!hasAccess) {
        throw new Error('You do not have access to this file');
      }

      let editingSessionKey = null;
      if (!preview) {
        editingSessionKey = await driveService.beginEditingSession(company_id, drive_file_id, token);
        //TODO catch error and display to the user when we can't stopped editing

        //TODO Log error with format to be able to set up grafana alert fir such king of errors
      }

      const officeToken = jwt.sign(
        {
          user_id: user.id, //To verify that link is opened by the same user
          company_id,
          drive_file_id,
          editing_session_key: editingSessionKey,
          file_id: file.id,
          file_name: driveFile?.item?.name || file.filename || file.metadata?.name || '',
          preview: !!preview,
        } as OfficeToken,
        CREDENTIALS_SECRET,
        {
          //one month, never expiring token
          expiresIn: 60 * 60 * 24 * 30,
        },
      );
      res.redirect(
        makeURLTo.editorAbsolute({
          token,
          file_id,
          drive_file_id,
          editing_session_key: editingSessionKey,
          company_id,
          preview,
          office_token: officeToken,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Renders this connector's view to initialise the Docs API client side component.
   */
  public editor = async (req: Request<{}, {}, {}, RequestEditorQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { office_token } = req.query;
      const { user } = req;

      const officeTokenPayload = jwt.verify(office_token, CREDENTIALS_SECRET) as OfficeToken;
      const { preview, user_id, company_id, file_name, file_id, drive_file_id, editing_session_key } = officeTokenPayload;

      if (user_id !== user.id) {
        throw new Error('You do not have access to this link');
      }
      if (!preview && !editing_session_key) {
        throw new Error('Cant start editing without "editing session key"');
      }

      const initResponse = await editorService.init(company_id, file_name, file_id, user, preview, drive_file_id);

      const inPageToken = jwt.sign(
        {
          ...officeTokenPayload,
          in_page_token: true,
        } as OfficeToken,
        CREDENTIALS_SECRET,
      );

      res.render('index', {
        ...initResponse,
        docId: preview ? file_id : editing_session_key,
        server: makeURLTo.rootAbsolute(),
        token: inPageToken,
      });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  };
}

export default BrowserEditorController;
