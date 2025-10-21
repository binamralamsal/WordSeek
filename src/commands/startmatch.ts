import { Composer } from "grammy";

import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("startmatch", async (ctx) => {});

// CommandsHelper.addNewCommand("startmatch", "Start a new game.");

export const startMatchCommand = composer;
