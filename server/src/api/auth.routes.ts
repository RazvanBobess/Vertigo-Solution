import { Elysia, t } from "elysia";
import { handleRegister, handleLogin, handleGetUserBets } from "./handlers";
import { authMiddleware } from "../middleware/auth.middleware";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post("/register", handleRegister, {
    body: t.Object({
      username: t.String(),
      email: t.String(),
      password: t.String(),
    }),
  })
  .post("/login", handleLogin, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })
  .use(authMiddleware)
  .get("/me", ({ user }) => {
    if (!user) return { error: "Unauthorized" };
    return user;
  })
  .get("/my-bets", async ({ user, query, set }) => {
    try {
      const bets = await handleGetUserBets({ user, query });
      return bets;
    } catch (err: any) {
      console.error("Error fetching user bets", err);
      set.status(500);
      return { error: "Failed to fetch user bets" };
    }
  })
  ;
