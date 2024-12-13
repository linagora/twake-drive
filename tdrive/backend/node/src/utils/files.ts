import { mkdirSync, existsSync, promises as fsPromise, createWriteStream, readFileSync } from "fs";
import { Readable, Transform } from "stream";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../core/platform/framework";

const { unlink } = fsPromise;

/**
 * Generates a random temporary file path
 *
 * @param {string} suffix - the file extension.
 * @returns {string} - the temporary file.
 */
export const getTmpFile = (suffix: string = ""): string => {
  const targetDir = "/tmp/";
  mkdirSync(targetDir, { recursive: true });
  return `${targetDir}${uuidv4()}${suffix}`;
};

/**
 * Removes files from disk
 *
 * @param {string[]} paths - the paths to be deleted.
 */
export const cleanFiles = async (paths: string[]): Promise<void> => {
  for (const path of paths) {
    if (existsSync(path)) await unlink(path);
  }
};

/**
 * Writes a File stream into a temporary file path
 *
 * @param {Readable} input - the input stream.
 * @param {string} extension - the file extension.
 * @returns {Promise<string>} - the generated file.
 */
export const writeToTemporaryFile = async (input: Readable, extension: string): Promise<string> => {
  try {
    const temporaryFilePath = getTmpFile(`.${extension}`);

    const writable = createWriteStream(temporaryFilePath);

    input.pipe(writable);

    await new Promise(r => {
      writable.on("finish", r);
    });

    writable.end();

    return temporaryFilePath;
  } catch (error) {
    logger.debug(error);

    throw Error(error);
  }
};

/**
 * Reads a file from the disk
 *
 * @returns {Promise<Buffer>} - the file readable stream.
 */
export const readFromTemporaryFile = async (path: string): Promise<Buffer> => {
  return readFileSync(path);
};

/**
 * Converts a readable stream into a Buffer.
 *
 * @param {Readable} input - the input stream.
 * @returns {Promise<Buffer>}
 */
export const readableToBuffer = async (input: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const buffer: Uint8Array[] = [];

    input.on("data", chunk => buffer.push(chunk));
    input.on("end", () => resolve(Buffer.concat(buffer)));
    input.on("error", err => reject(err));
  });
};

/**
 * Create a size adding transform stream meant to be piped into,
 * that sums up the sizes of what are expected to be `Buffer` instances
 * that are written to it, and transparently pass the data through.
 * @param input If a readable is provided, it will be piped into the
 *   the transformer stream and the resulting piped stream will be in
 *   the result's `stream` property. If none is provided, that property
 *   will be the transform stream the caller will need to pipe to themself.
 * @returns An object with:
 *    - `stream`: Either the result of `input.pipe(sizeAdderTransform)` if an input
 *      was provided, or directly the stream the caller must pipe into.
 *    - `getSize`: A function that can only be called when the stream is
 *      finished, and returns the total size that was written into the
 *      `sizeAdderTransform` stream.
 */
export const createStreamSizeCounter = (input?: Readable) => {
  let size = 0;
  let finished = false;
  let stream = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      callback(null, chunk);
    },
    final(callback) {
      finished = true;
      callback();
    },
  });
  if (input) stream = input.pipe(stream);
  return {
    stream,
    getSize: () => {
      if (!finished) throw new Error("Cannot read size of stream before it is finished");
      return size;
    },
  };
};

/**
 * Converts a file readable stream to string
 *
 * @param {Readable} readable - the file stream
 * @returns {Promise<string>}
 */
export const readableToString = async (readable: Readable): Promise<string> => {
  let content = "";

  return new Promise((resolve, reject) => {
    readable.on("data", data => {
      content += data.toString();
    });

    readable.on("end", () => {
      resolve(content);
    });

    readable.on("error", error => {
      reject(error);
    });
  });
};
