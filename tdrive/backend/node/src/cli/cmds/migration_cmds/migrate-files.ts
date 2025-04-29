import runWithPlatform from "../../lib/run-with-platform";
import runWithLoggerLevel from "../../utils/run-with-logger-level";
import globalResolver from "../../../services/global-resolver";
import User from "../../../services/user/entities/user";
import yargs from "yargs";
import { DriveFile, TYPE } from "../../../services/documents/entities/drive-file";
import { getPath } from "../../../services/documents/utils";
import CozyClient from "cozy-client";
import {
  uploadFile,
  COZY_DOMAIN,
  DEFAULT_COMPANY,
  getDriveToken,
  nodeReadableToWebReadable,
} from "./utils";

const purgeIndexesCommand: yargs.CommandModule<unknown, unknown> = {
  command: "migrate-files",
  describe: "Migrates files data from Twake Drive",
  builder: {
    dryRun: {
      type: "boolean",
      alias: "d",
      description: "Simulate the migration and returns stats for the db.",
      default: true,
    },
    emails: {
      type: "string",
      alias: "e",
      description: "Comma-separated list of user emails to migrate files for specific users",
    },
  },
  handler: async argv => {
    const dryRun = argv.dryRun as boolean;
    console.log("DRY RUN: ", dryRun);
    const emailsArg = argv.emails as string | undefined;
    const specifiedEmails = emailsArg
      ? emailsArg.split(",").map(email => email.trim().toLowerCase())
      : null;

    if (specifiedEmails) {
      console.log("Migrating only specified emails:", specifiedEmails.join(", "));
    }

    await runWithPlatform("Migrate files", async () => {
      return await runWithLoggerLevel("fatal", async () => {
        const usersRepo = await globalResolver.database.getRepository<User>("user", User);
        const documentsRepo = await globalResolver.database.getRepository<DriveFile>(
          TYPE,
          DriveFile,
        );

        const allUsers = await (await usersRepo.find({})).getEntities();

        let usersToMigrate = allUsers;
        if (specifiedEmails) {
          usersToMigrate = allUsers.filter(user =>
            specifiedEmails.includes(user.email_canonical.toLowerCase()),
          );
        }

        for (const user of usersToMigrate) {
          const userCompany = DEFAULT_COMPANY;
          const userFiles = await documentsRepo.find({ creator: user.id, is_directory: false });
          const userId = user.email_canonical.split("@")[0];

          console.log(`User ${user.id} has ${userFiles.getEntities().length} files`);

          const userFilesObjects = [];

          for (const userFile of userFiles.getEntities()) {
            if (userFile.migrated) {
              continue;
            }
            const filePathItems = await getPath(userFile.id, documentsRepo, true, {
              company: { id: userCompany },
            } as any);

            const filePath = filePathItems
              .slice(1, -1)
              .map(p => p.name)
              .join("/");

            const fileObject = {
              owner: userId,
              _id: userFile.id,
              is_in_trash: userFile.is_in_trash,
              is_directory: userFile.is_directory,
              name: userFile.name,
              added: userFile.added,
              last_modified: userFile.last_modified,
              size: userFile.size,
              path: filePath !== "My Drive" ? filePath : "",
              company_id: userCompany,
            };

            userFilesObjects.push(fileObject);

            if (!dryRun) {
              try {
                const cozyUrl = `${userId}.${COZY_DOMAIN}`;
                const userToken = await getDriveToken(cozyUrl);
                const client = new CozyClient({
                  uri: `https://${cozyUrl}`,
                  token: userToken.token,
                });

                let fileDirPath = "io.cozy.files.root-dir";
                if (fileObject.path !== "") {
                  const sanitizedPath = fileObject.path.replace(/^\//, "");
                  fileDirPath = (
                    await client.collection("io.cozy.files").createDirectoryByPath(sanitizedPath)
                  ).data.id;
                }
                // 2. Download file from backend
                const archiveOrFile = await globalResolver.services.documents.documents.download(
                  userFile.id,
                  userFile.last_version_cache.id,
                  null, // No archive callback needed
                  {
                    company: { id: userCompany },
                    user: { id: user.id },
                  } as any,
                );

                if (!archiveOrFile.file) {
                  console.error(`File ${userFile.id} was returned as archive. Skipping.`);
                  continue;
                }
                let uploadedBytes = 0;
                const totalSize = fileObject.size || 0;
                const { file: fileStream } = archiveOrFile.file;
                const fileReadable = nodeReadableToWebReadable(fileStream, chunkSize => {
                  uploadedBytes += chunkSize;
                  const percentage =
                    totalSize > 0 ? ((uploadedBytes / totalSize) * 100).toFixed(2) : "0";
                  process.stdout.write(`\rUploading ${fileObject.name}... ${percentage}%`);
                });

                const resp = await uploadFile(
                  fileObject.name,
                  userId,
                  fileDirPath,
                  userToken.token,
                  fileReadable,
                );

                if (!resp.ok) {
                  console.error(`❌ ERROR UPLOADING THE FILE: ${fileObject.name}`);
                  console.error(`❌ ERROR: ${JSON.stringify(resp)}  ${resp}`);
                  continue;
                }
                // 3. Migrate file
                userFile.migrated = true;
                userFile.migration_date = Date.now();
                await documentsRepo.save(userFile);

                console.log(`\n✅ File migrated successfully: ${fileObject.name}`);
              } catch (error) {
                console.error(`❌ ERROR CREATING THE FILE: ${fileObject.name}`);
                console.error(`❌ ERROR: ${JSON.stringify(error)}  ${error}`);
              }
            } else {
              console.log(`[DRY-RUN] Would create Cozy instance for user ${user.email_canonical}`);
            }
          }
        }
      });
    });
  },
};

export default purgeIndexesCommand;
