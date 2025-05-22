import runWithPlatform from "../../lib/run-with-platform";
import runWithLoggerLevel from "../../utils/run-with-logger-level";
import globalResolver from "../../../services/global-resolver";
import User from "../../../services/user/entities/user";
import yargs from "yargs";
import { DriveFile, TYPE } from "../../../services/documents/entities/drive-file";
import { getPath } from "../../../services/documents/utils";
import CozyClient from "cozy-client";
import { uploadFile, COZY_DOMAIN, DEFAULT_COMPANY, getDriveToken } from "./utils";

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
          const userId = user.email_canonical.split("@")[0];
          const cozyUrl = `${userId}.${COZY_DOMAIN}`;
          const userToken = await getDriveToken(cozyUrl);
          const client = new CozyClient({
            uri: `https://${cozyUrl}`,
            token: userToken.token,
          });

          const userHomeDir = `user_${user.id}`;
          const allUserFiles: DriveFile[] = [];
          const visited = new Set<string>();

          let fileCount = 0;
          let dirCount = 0;

          const recursivelyDescend = async (parentId: string) => {
            if (visited.has(parentId)) {
              return;
            }

            visited.add(parentId);
            dirCount++;
            process.stdout.write(
              `\rVisited directories: ${dirCount}, Discovered files: ${fileCount}`,
            );

            let children;
            try {
              children = await documentsRepo.find({ company_id: userCompany, parent_id: parentId });
            } catch (err) {
              console.error(`\nError fetching children for ${parentId}:`, err);
              return;
            }

            for (const child of children.getEntities()) {
              if (child.is_directory) {
                await recursivelyDescend(child.id);
              } else {
                allUserFiles.push(child);
                fileCount++;
                process.stdout.write(
                  `\rVisited directories: ${dirCount}, Discovered files: ${fileCount}`,
                );
              }
            }
          };

          await recursivelyDescend(userHomeDir);

          console.log(`User ${userId}::${user.id} has ${allUserFiles.length} files`);

          const userFilesObjects = [];
          const failedFiles: { id: string; name: string; reason?: string }[] = [];
          for (const userFile of allUserFiles) {
            let fileObject: any = {};
            try {
              if (userFile.migrated || userFile.is_in_trash) {
                continue;
              }

              // Check if file exists in S3 storage
              try {
                const { exist } = await globalResolver.services.files.checkFileExistsS3(
                  userFile.id,
                );
                if (!exist) {
                  console.error(
                    `⚠️ File ${userFile.id} (${userFile.name}) does not exist in S3 storage. Skipping.`,
                  );
                  failedFiles.push({
                    id: userFile.id,
                    name: userFile.name,
                    reason: "Doesn't exist in S3 storage",
                  });
                  continue;
                }
              } catch (error) {
                console.error(
                  `⚠️ Error checking S3 storage for file ${userFile.id} (${userFile.name}): ${error.message}`,
                );
                failedFiles.push({ id: userFile.id, name: userFile.name, reason: error.message });
                continue;
              }

              const filePathItems = await getPath(userFile.id, documentsRepo, true, {
                company: { id: userCompany },
              } as any);

              const filePath = filePathItems
                .slice(1, -1)
                .map(p => p.name)
                .join("/");

              fileObject = {
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
                  null,
                  null, // No archive callback needed
                  {
                    company: { id: userCompany },
                    user: { id: user.id },
                  } as any,
                );

                if (!archiveOrFile.file) {
                  console.error(`⚠️ File ${userFile.id} was returned as archive. Skipping.`);
                  failedFiles.push({ id: userFile.id, name: userFile.name });
                  continue;
                }
                const { file: fileStream } = archiveOrFile.file;
                let uploadedBytes = 0;
                const totalSize = fileObject.size || 0;

                const onProgress = (chunkSize: number) => {
                  uploadedBytes += chunkSize;
                  const percentage =
                    totalSize > 0 ? ((uploadedBytes / totalSize) * 100).toFixed(2) : "0";
                  process.stdout.write(`\r⬆️ Uploading ${fileObject.name}... ${percentage}%`);
                };

                const { statusCode, body } = await uploadFile(
                  fileObject.name,
                  userId,
                  fileDirPath,
                  userToken.token,
                  fileStream,
                  onProgress,
                );

                fileStream.destroy();

                if (statusCode !== 201) {
                  console.error(`❌ ERROR UPLOADING THE FILE: ${fileObject.name}`);
                  console.error(`❌ ERROR: ${JSON.stringify(body)}  ${body}`);
                  failedFiles.push({ id: userFile.id, name: userFile.name });
                  continue;
                }
                // 3. Migrate file
                userFile.migrated = true;
                userFile.migration_date = Date.now();
                await documentsRepo.save(userFile);

                console.log(`\n✅ File migrated successfully: ${fileObject.name}`);
              } else {
                console.log(
                  `[DRY-RUN] Would create Cozy instance for user ${user.email_canonical}`,
                );
              }
            } catch (error) {
              console.error(`❌ Exception while processing: ${fileObject.name}`);
              console.error(error);
              failedFiles.push({ id: userFile.id, name: userFile.name });
            }
          }
          if (failedFiles.length > 0) {
            console.log("\n📋 Migration failed for the following files:");
            console.table(failedFiles);
            console.log(`❌ Total failed files: ${failedFiles.length}`);
          } else {
            console.log("\n🎉 All files migrated successfully. No failures.");
          }
        }
      });
    });
  },
};

export default purgeIndexesCommand;
