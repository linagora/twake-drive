import runWithPlatform from "../../lib/run-with-platform";
import runWithLoggerLevel from "../../utils/run-with-logger-level";
import globalResolver from "../../../services/global-resolver";
import User from "../../../services/user/entities/user";
import yargs from "yargs";
import amqp from "amqplib";
import { DriveFile, TYPE } from "../../../services/documents/entities/drive-file";
import { getPath } from "../../../services/documents/utils";

const RABBITMQ_URL = "amqp://localhost";
const QUEUE_NAME = "demo_queue";

async function publishMessage(message: { [key: string]: any }) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), { persistent: true });

    console.log(`✅ (1)Message sent: ${JSON.stringify(message)}`);

    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error("❌ Error in publisher:", error);
  }
}

const purgeIndexesCommand: yargs.CommandModule<unknown, unknown> = {
  command: "migrate-files",
  describe: "Migrates files data from Twake Drive",
  builder: {
    dryRun: {
      type: "boolean",
      alias: "d",
      description: "Simulate the migration and returns stats for the db.",
      default: true, // Enabled dry-run mode by default
    },
  },
  handler: async argv => {
    const dryRun = argv.dryRun as boolean;
    console.log("DRY RUN: ", dryRun);

    await runWithPlatform("Migrate files", async () => {
      return await runWithLoggerLevel("info", async () => {
        const usersRepo = await globalResolver.database.getRepository<User>("user", User);
        const documentsRepo = await globalResolver.database.getRepository<DriveFile>(
          TYPE,
          DriveFile,
        );
        // Fetch users
        const allUsers = await (await usersRepo.find({})).getEntities();

        // STEP2: CREATE THE FILE TREE FOR EACH USER AND APPLY THE ACCESS/SHARED PERMISSIONS
        for (const user of allUsers) {
          const userCompany = (
            await globalResolver.services.users.getUserCompanies(
              {
                id: user.id,
              },
              {
                user,
              },
            )
          )[0];
          const userFiles = await documentsRepo.find({ creator: user.id });
          const userId = user.email_canonical.split("@")[0];
          console.log(`User ${user.id} has ${userFiles.getEntities().length} files`);
          const userFilesObjects = [];
          for (const userFile of userFiles.getEntities()) {
            const filePathItems = await getPath(userFile.id, documentsRepo, true, {
              company: {
                id: userCompany.id,
              },
            } as any);
            const filePath = filePathItems
              .slice(0, -1)
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
              path: filePath,
            };
            userFilesObjects.push(fileObject);
          }
          publishMessage({
            action: "file",
            data: {
              userId: userId,
              files: userFilesObjects,
            },
          });
        }
      });
    });
  },
};

export default purgeIndexesCommand;
