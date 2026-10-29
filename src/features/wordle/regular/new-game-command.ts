import { Composer } from "grammy";

import { startGame } from "./start-game";

const composer = new Composer();

composer.command("new", (ctx) => startGame(ctx));

composer.command("new4", (ctx) => startGame(ctx, 4));
composer.command("new5", (ctx) => startGame(ctx, 5));
composer.command("new6", (ctx) => startGame(ctx, 6));

export const newGameCommand = composer;
