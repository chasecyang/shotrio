import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oneTap } from "better-auth/plugins";
import db from "./db";
import { user, session, account, verification, Role } from "./db/schemas/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // PostgreSQL
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  user:{
    additionalFields:{
      role:{
        type:"string",
        enum:Object.values(Role),
        input:false,
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [oneTap()],
  rateLimit:{
    window:60,
    max:10,
  }
});

