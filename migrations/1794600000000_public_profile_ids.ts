import { type Kysely, sql } from "kysely";

/** Opaque stable IDs for opening public Mini App player profiles. */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE users
    ADD COLUMN public_profile_id uuid NOT NULL DEFAULT gen_random_uuid();
  `.execute(db);

  await db.schema
    .createIndex("users_public_profile_id_unique")
    .on("users")
    .column("public_profile_id")
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex("users_public_profile_id_unique")
    .ifExists()
    .execute();
  await db.schema.alterTable("users").dropColumn("public_profile_id").execute();
}
