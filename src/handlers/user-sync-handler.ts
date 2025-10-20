import { Composer } from "grammy";

import { db } from "../config/db";

const composer = new Composer();

composer.use(async (ctx, next) => {
  try {
    const user = ctx.from;
    if (!user || user.is_bot) {
      return next();
    }

    const userId = user.id.toString();
    const userName =
      user.first_name + (user.last_name ? " " + user.last_name : "");
    const userUsername = user.username || null;

    (async () => {
      try {
        if (userUsername) {
          await db
            .updateTable("users")
            .set({ username: null })
            .where("username", "=", userUsername)
            .where("id", "!=", userId)
            .execute();
        }

        await db
          .insertInto("users")
          .values({
            id: userId,
            name: userName,
            username: userUsername,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              name: userName,
              username: userUsername,
            }),
          )
          .execute();
      } catch (error) {
        console.error("Error in user sync:", error);
      }
    })();
  } catch (error) {
    console.error("Error in user sync middleware:", error);
  }

  return next();
});

export const userSyncHandler = composer;
