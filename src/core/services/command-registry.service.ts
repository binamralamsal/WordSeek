import type { BotCommand } from "grammy/types";

import { bot } from "#/config/bot";

class CommandRegistryImpl {
  private readonly commands: BotCommand[] = [];

  add(command: string, description: string) {
    this.commands.push({ command, description });
  }

  async sync() {
    await bot.api.setMyCommands(this.commands);
  }
}

export const CommandRegistry = new CommandRegistryImpl();
