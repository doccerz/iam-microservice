import { pgSchema } from "drizzle-orm/pg-core";
import { env } from "../../config/env.js";

export const dbSchema = pgSchema(env.DATABASE_SCHEMA);
