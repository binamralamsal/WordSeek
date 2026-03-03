import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE games DROP CONSTRAINT IF EXISTS games_active_chat_key;
  `.execute(db);

  await sql`
    ALTER TABLE games ADD CONSTRAINT games_active_chat_topic_id_unique UNIQUE (active_chat, topic_id);
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE games DROP CONSTRAINT IF EXISTS games_active_chat_topic_id_unique;
  `.execute(db);

  await sql`
      ALTER TABLE games ADD CONSTRAINT games_active_chat_key UNIQUE (active_chat);
    `.execute(db);
}
