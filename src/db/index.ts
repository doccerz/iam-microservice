import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";
import * as relations from "./relations.js";

const fullSchema = { ...schema, ...relations };

export const db = drizzle(env.DATABASE_URL, { schema: fullSchema });
export const sql = db.$client;
