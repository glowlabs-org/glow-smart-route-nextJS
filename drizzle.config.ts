import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DB_URL!;

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: connectionString,
  },
} satisfies Config;
