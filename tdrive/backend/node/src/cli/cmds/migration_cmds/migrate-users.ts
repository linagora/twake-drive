import runWithPlatform from "../../lib/run-with-platform";
import runWithLoggerLevel from "../../utils/run-with-logger-level";
import globalResolver from "../../../services/global-resolver";
import User from "../../../services/user/entities/user";
import yargs from "yargs";
import amqp from "amqplib";

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
  command: "migrate-users",
  describe: "Migrates users data from Twake Drive",
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

    await runWithPlatform("Migrate users", async () => {
      return await runWithLoggerLevel("info", async () => {
        const usersRepo = await globalResolver.database.getRepository<User>("user", User);
        // Fetch users
        const allUsers = await (await usersRepo.find({})).getEntities();
        const migratedUsers = await (await usersRepo.find({ migrated: true })).getEntities();
        const pendingUsers = allUsers.filter(
          user => !migratedUsers.some(migratedUser => migratedUser.id === user.id),
        );
        if (pendingUsers.length === 0) {
          console.log("✅ All user instances are created");
        }

        // STEP1: CREATE ALL USERS
        for (const user of pendingUsers) {
          // get the local part of the email
          const userId = user.email_canonical.split("@")[0];
          const userObject = {
            _id: user.id,
            id: userId,
            email: user.email_canonical,
            name: `${user.first_name} ${user.last_name}`,
          };
          publishMessage({
            action: "user",
            data: userObject,
          });
        }
      });
    });
  },
};

export default purgeIndexesCommand;
