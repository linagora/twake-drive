import runWithPlatform from "../../lib/run-with-platform";
import runWithLoggerLevel from "../../utils/run-with-logger-level";
import globalResolver from "../../../services/global-resolver";
import User from "../../../services/user/entities/user";
import yargs from "yargs";
import { createCozyInstance } from "./utils";

const migrateUsersCommand: yargs.CommandModule<unknown, unknown> = {
  command: "migrate-users",
  describe: "Migrates users data from Twake Drive",
  builder: {
    dryRun: {
      type: "boolean",
      alias: "d",
      description: "Simulate the migration and return stats for the DB.",
      default: true,
    },
    emails: {
      type: "string",
      alias: "e",
      description: "Comma-separated list of user emails to migrate specific users",
    },
  },
  handler: async argv => {
    const dryRun = argv.dryRun as boolean;
    const emailsArg = argv.emails as string | undefined;
    const specifiedEmails = emailsArg
      ? emailsArg.split(",").map(email => email.trim().toLowerCase())
      : null;

    console.log("DRY RUN:", dryRun);
    if (specifiedEmails) {
      console.log("Migrating only specified emails:", specifiedEmails.join(", "));
    }

    await runWithPlatform("Migrate users", async () => {
      await runWithLoggerLevel("info", async () => {
        const usersRepo = await globalResolver.database.getRepository<User>("user", User);

        const allUsers = await (await usersRepo.find({})).getEntities();
        const migratedUsers = await (await usersRepo.find({ migrated: true })).getEntities();
        const pendingUsers = allUsers.filter(
          user => !migratedUsers.some(migratedUser => migratedUser.id === user.id),
        );

        let usersToMigrate = pendingUsers;
        if (specifiedEmails) {
          usersToMigrate = pendingUsers.filter(user =>
            specifiedEmails.includes(user.email_canonical.toLowerCase()),
          );
        }

        if (usersToMigrate.length === 0) {
          console.log("✅ No users to migrate.");
          return;
        }

        console.log(`🚀 Users to migrate: ${usersToMigrate.length}`);

        for (const user of usersToMigrate) {
          const userId = user.email_canonical.split("@")[0];
          const userObject = {
            _id: user.id,
            id: userId,
            email: user.email_canonical,
            name: `${user.first_name} ${user.last_name}`,
          };

          if (!dryRun) {
            try {
              await createCozyInstance(userObject);
            } catch (error) {
              console.error(`❌ Failed to migrate user ${user.email_canonical}`, error);
              // Even if error, continue to next user
            }
          } else {
            console.log(`[DRY-RUN] Would create Cozy instance for user ${user.email_canonical}`);
          }
        }
      });
    });
  },
};

export default migrateUsersCommand;
