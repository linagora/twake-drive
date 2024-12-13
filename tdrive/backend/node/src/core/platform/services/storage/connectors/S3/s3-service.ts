import * as Minio from "minio";
import { logger } from "../../../../../../core/platform/framework";
import { Readable } from "stream";
import { StorageConnectorAPI, WriteMetadata } from "../../provider";
import { createStreamSizeCounter } from "../../../../../../utils/files";
import { randomUUID } from "crypto";
import _ from "lodash";

export type S3Configuration = {
  id: string;
  bucket: string;
  region: string;
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  disableRemove: boolean;
};

export default class S3ConnectorService implements StorageConnectorAPI {
  client: Minio.Client;
  minioConfiguration: S3Configuration;
  id: string;

  constructor(S3Configuration: S3Configuration) {
    const confCopy = _.cloneDeep(S3Configuration) as S3Configuration;
    if (confCopy.port && typeof confCopy.port === "string") {
      confCopy.port = parseInt(confCopy.port, 10);
    }
    if (confCopy.useSSL && typeof confCopy.useSSL === "string") {
      confCopy.useSSL = !(!confCopy.useSSL || confCopy.useSSL === "false");
    }
    this.client = new Minio.Client(confCopy);
    this.minioConfiguration = confCopy;
    this.id = this.minioConfiguration.id;
    if (!this.id) {
      this.id = randomUUID();
      logger.info(`Identifier for S3 storage haven't been set, initializing to '${this.id}'`);
    }
  }

  getId() {
    return this.id;
  }

  async write(path: string, stream: Readable): Promise<WriteMetadata> {
    const sizeCounter = createStreamSizeCounter(stream);
    await this.client.putObject(this.minioConfiguration.bucket, path, sizeCounter.stream);
    return {
      size: sizeCounter.getSize(),
    };
  }

  async read(path: string): Promise<Readable> {
    // Test if file exists in S3 bucket 10 times until we find it
    const tries = 10;
    let err = null;
    for (let i = 0; i <= tries; i++) {
      try {
        const stat = await this.client.statObject(this.minioConfiguration.bucket, path);
        if (stat?.size > 0) {
          break;
        }
      } catch (e) {
        err = e;
      }

      if (i === tries) {
        logger.info(`Unable to get file after ${tries} tries:`);
        throw err;
      }

      await new Promise(r => setTimeout(r, 500));
      logger.info(`File ${path} not found in S3 bucket, retrying...`);
    }
    return this.client.getObject(this.minioConfiguration.bucket, path);
  }

  async remove(path: string): Promise<boolean> {
    try {
      if (this.minioConfiguration.disableRemove) {
        logger.info(`File ${path} wasn't removed, file removal is disabled in configuration`);
        return true;
      } else {
        await this.client.removeObject(this.minioConfiguration.bucket, path);
        return true;
      }
    } catch (err) {}
    return false;
  }

  async exists(path: string): Promise<boolean> {
    logger.trace(`Reading file ... ${path}`);
    const tries = 2;
    for (let i = 0; i <= tries; i++) {
      try {
        const stat = await this.client.statObject(this.minioConfiguration.bucket, path);
        if (stat?.size > 0) {
          break;
        }
      } catch (e) {
        logger.error(e, `Error getting information from S3 for path: ${path}`);
      }

      if (i === tries) {
        logger.info(`Unable to get file after ${tries} tries:`);
        return false;
      }
      await new Promise(r => setTimeout(r, 500));
      logger.info(`File ${path} not found in S3 bucket, retrying...`);
    }
    return true;
  }
}
