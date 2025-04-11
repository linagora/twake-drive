import { CommandModule } from "yargs";

const command: CommandModule = {
  describe: "Migrate data from Twake Drive",
  command: "migrate <command>",
  builder: yargs =>
    yargs.commandDir("migration_cmds", {
      visit: commandModule => commandModule.default,
    }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handler: () => {},
};

export default command;
