import { Initializable, TdriveServiceProvider } from "../../../core/platform/framework";
import { getLogger, logger, TdriveLogger } from "../../../core/platform/framework";
import NodeClam from "clamscan";
import { AVStatus, DriveFile } from "src/services/documents/entities/drive-file";
import { FileVersion } from "src/services/documents/entities/file-version";
import { DriveExecutionContext, NotificationActionType } from "../../documents/types";
import globalResolver from "../../../services/global-resolver";
import { getFilePath } from "../../files/services";
import { getConfigOrDefault } from "../../../utils/get-config";
import { AVException } from "./av-exception";

export class AVServiceImpl implements TdriveServiceProvider, Initializable {
  version: "1";
  av: NodeClam = null;
  logger: TdriveLogger = getLogger("Antivirus Service");
  avEnabled: boolean = getConfigOrDefault<boolean>("drive.featureAntivirus", false);
  deleteInfectedFileEnabled: boolean = getConfigOrDefault<boolean>("av.deleteInfectedFiles", false);
  private MAX_FILE_SIZE: number = getConfigOrDefault<number>("av.maxFileSize", 4294967295); // 4GB

  async init(): Promise<this> {
    try {
      if (this.avEnabled) {
        this.av = await new NodeClam().init({
          removeInfected: false, // Do not remove infected files
          quarantineInfected: false, // Do not quarantine, just alert
          scanLog: null, // No log file for this test
          debugMode: getConfigOrDefault<boolean>("av.debugMode", false), // Enable debug messages
          clamdscan: {
            host: getConfigOrDefault<string>("av.host", "localhost"), // IP of the server
            port: getConfigOrDefault<number>("av.port", 3310) as number, // ClamAV server port
            timeout: getConfigOrDefault<number>("av.timeout", 2000), // Timeout for scans
            localFallback: true, // Use local clamscan if needed
          },
        });
      }
    } catch (err) {
      logger.error({ err }, "Error while initializing Antivirus Service");
      throw AVException.initializationFailed("Failed to initialize Antivirus service");
    }
    return this;
  }

  async scanDocument(
    item: Partial<DriveFile>,
    version: Partial<FileVersion>,
    onScanComplete: (status: AVStatus) => Promise<void>,
    context: DriveExecutionContext,
  ): Promise<AVStatus> {
    try {
      // get the file from the storage
      const file = await globalResolver.services.files.get(
        version.file_metadata.external_id,
        context,
      );

      if (!file) {
        this.logger.error(`File ${version.file_metadata.external_id} not found`);
        throw AVException.fileNotFound(`File ${version.file_metadata.external_id} not found`);
      }

      // check if the file is too large
      if (file.upload_data.size > this.MAX_FILE_SIZE) {
        this.logger.info(
          `File ${file.id} is too large (${file.upload_data.size} bytes) to be scanned. Skipping...`,
        );
        return "skipped";
      }

      // read the file from the storage
      const readableStream = await globalResolver.platformServices.storage.read(getFilePath(file), {
        totalChunks: file.upload_data.chunks,
        encryptionAlgo: globalResolver.services.files.getEncryptionAlgorithm(),
        encryptionKey: file.encryption_key,
      });

      // scan the file
      this.av.scanStream(readableStream, async (err, { isInfected, viruses }) => {
        if (err) {
          await onScanComplete("scan_failed");
          this.logger.error(`Scan failed for item ${item.id} due to error: ${err.message}`);
        } else if (isInfected) {
          await onScanComplete("malicious");
          this.logger.info(`Item ${item.id} is malicious. Viruses found: ${viruses.join(", ")}`);

          // Delete infected files if feature flag is enabled
          if (this.deleteInfectedFileEnabled) {
            await this.deleteInfectedFile(item, context);
          }
        } else {
          await onScanComplete("safe");
          this.logger.info(`Item ${item.id} is safe with no viruses detected.`);
        }
      });

      return "scanning";
    } catch (error) {
      // mark the file as failed to scan
      await onScanComplete("scan_failed");

      // log the error
      this.logger.error(`Error scanning file ${item.last_version_cache.file_metadata.external_id}`);
      throw AVException.scanFailed("Document scanning encountered an error");
    }
  }

  async deleteInfectedFile(item: Partial<DriveFile>, context: DriveExecutionContext) {
    try {
      // Delete infected file for permanent
      await globalResolver.services.documents.documents.delete(item.id, null, context, true);
      this.logger.info(`Infected file ${item.id} was automatically deleted`);

      // Send notification to user about the file deletion
      globalResolver.services.documents.engine.notifyInfectedDocumentRemoved({
        context,
        item: {
          ...item,
          company_id: context.company.id,
        } as DriveFile,
        type: NotificationActionType.DIRECT,
        notificationReceiver: context.user.id,
        notificationEmitter: "",
      });
      this.logger.info(`Sent notification to ${context.user.id} about file deletion`);
    } catch (error) {
      this.logger.error(`Failed to delete infected file ${item.id}: ${error}`);
    }
  }
}
