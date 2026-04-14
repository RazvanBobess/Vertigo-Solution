import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleCreateMarket, handleListMarkets, handleGetMarket, handlePlaceBet, handleResolveMarket, handleGetLeaderboard, handleGetMe } from "./handlers";

export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)
  .get("/", handleListMarkets, {
    query: t.Object({
      status: t.Optional(t.String()),
      page: t.Optional(t.Numeric({ default: 1})),
      sortBy: t.Optional(t.String({ default: "createdAt"})),
      order: t.Optional(t.String({ default: "desc"})),
    }),
  })
  .get("/:id", handleGetMarket, {
    params: t.Object({
      id: t.Numeric(),
    }),
  })
  .get("/leaderboard", handleGetLeaderboard)
  .get("/me", handleGetMe)
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .post("/", (ctx) => handleCreateMarket(ctx as any), {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
          }),
        })
        .post("/:id/bets", (ctx) => handlePlaceBet(ctx as any), {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        })
        .post("/:id/resolve", (ctx) => handleResolveMarket(ctx as any), {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            winningOutcomeId: t.Number(),
          }),
          beforeHandle({ user, set}) {
            if (!user?.isAdmin) {
              set.status = 403;
              return { error: "Forbidden: Admin access required" };
            }
          }
        })
  );
