import { eq, and, sql, desc, asc, count } from "drizzle-orm";
import db, { getDb } from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";
import { OuterExpressionKinds } from "typescript";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.insert(usersTable).values({ username, email, passwordHash }).returning();

  const token = await jwt.sign({ userId: newUser[0].id });

  set.status = 201;
  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
    token,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    balance: user.balance,
    isAdmin: user.isAdmin,
    token,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0].id,
        title,
        position: index,
      })),
    )
    .returning();

  set.status = 201;
  return {
    id: market[0].id,
    title: market[0].title,
    description: market[0].description,
    status: market[0].status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string, page?: number, sortBy?: string, order?: string } }) {
  const statusFilter = (query.status as "active" | "resolved") || "active";
  const page = Number(query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const [totalCount] = await db
    .select({ value: count() })
    .from(marketsTable)
    .where(eq(marketsTable.status, statusFilter));

  const total = totalCount?.value || 0;

  const markets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),
    limit,
    offset,
    orderBy: [desc(marketsTable.createdAt)],
    with: {
      creator: { columns: { username: true } },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!markets || !Array.isArray(markets)) {
    return {
      data: [],
      pagination: {
        total: 0, page, totalPages: 0
      }
    };
  }

  const enrichedMarkets = await Promise.all(
    markets.map(async (market) => {
      const outcomeStats = await db
        .select({
          outcomeId: betsTable.outcomeId,
          sum: sql<number>`sum(${betsTable.amount})`.mapWith(Number),
        })
        .from(betsTable)
        .where(eq(betsTable.marketId, market.id))
        .groupBy(betsTable.outcomeId);

      const totalMarketBets = outcomeStats.reduce((acc, curr) => acc + (curr.sum || 0), 0);

      return {
        id: market.id,
        title: market.title,
        status: market.status,
        creator: market.creator?.username,
        totalMarketBets,
        outcomes: market.outcomes.map((outcome) => {
          const outcomeSum = outcomeStats.find(b => b.outcomeId === outcome.id)?.sum || 0;
          const odds = totalMarketBets > 0 ? Number(((outcomeSum / totalMarketBets) * 100).toFixed(2)) : 0;

          return {
            ...outcome,
            totalBets: outcomeSum,
            odds,
          };
        }),
      };
    }),
  );

  return {
    data: enrichedMarkets,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number, amount: number };
  set: { status: number };
  user: any;
}) {
  if (!user) {
    console.error("DEBUG: User object is missing in handlePlaceBet");
    set.status = 401;
    return { error: "Unauthorized" };
  }

  console.log("Handler received user:", user);

  const marketId = params.id;
  const { outcomeId, amount } = body;
  const errors = validateBet(amount);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  if (user.balance < amount) {
    set.status = 400;
    return { error: "Insufficient balance" };
  }

  return await db.transaction(async (tx) => {
    const market = await tx.query.marketsTable.findFirst({
      where: eq(marketsTable.id, marketId),
    });

    if (!market) {
      set.status = 404;
      return { error: "Market not found" };
    }

    const outcome = await tx.query.marketOutcomesTable.findFirst({
      where: and(
        eq(marketOutcomesTable.id, outcomeId), 
        eq(marketOutcomesTable.marketId, marketId)),
    });

    if (!outcome) {
      set.status = 404;
      return { error: "Outcome not found" };
    }

    await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${amount}` })
      .where(eq(usersTable.id, user.id));

    const [bet] = await tx
      .insert(betsTable)
      .values({
        userId: user.id,
        marketId,
        outcomeId,
        amount: Number(amount),
      })
      .returning();

      set.status = 201;
      return {
        id: bet.id,
        userId: bet.userId,
        balanceRemaining: user.balance - amount,
        amount: bet.amount,
      };
  })
}

export async function handleGetMe({ user } : { user: any }) {
  if (!user) return { error: "Not logged in" };
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    balance: user.balance,
    isAdmin: user.isAdmin,
  }
}

export async function handleResolveMarket({
  params,
  body,
  set,
  user,
} : {
  params: { id: number};
  body: { winningOutcomeId: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { winningOutcomeId } = body;

  if (!user.isAdmin) {
    set.status = 403;
    return { error: "Forbidden: Admin access required" };
  }

  return await db.transaction(async (tx) => {
    const market = await tx.query.marketsTable.findFirst({
      where: eq(marketsTable.id, marketId),
      with: { outcomes: true },
    });

    if (!market || market.status !== "active") {
      set.status = 400;
      return { error: "Market not found or already resolved" };
    }

    const allBets = await tx.query.betsTable.findMany({
      where: eq(betsTable.marketId, marketId),
    });

    const totalPool = allBets.reduce((sum, bet) => sum + bet.amount, 0);
    const winningBets = allBets.filter(b => b.outcomeId == winningOutcomeId);
    const winningPool = winningBets.reduce((sum, b) => sum + b.amount, 0);

    if (winningPool === 0) {
      await tx.update(marketsTable).set({ status: "archived" }).where(eq(marketsTable.id, marketId));
      return { message: "Market resolved with no winners, all bets refunded" };
    }

    const multiplier = totalPool / winningPool;

    const userPayouts: Record<number, number> = {};
    for (const bet of winningBets) {
      const payout = bet.amount * multiplier;
      userPayouts[bet.userId] = (userPayouts[bet.userId] || 0) + payout;
    }

    for (const [userId, amount] of Object.entries(userPayouts)) {
      await tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${amount}` })
        .where(eq(usersTable.id, userId));
    }

    await tx
      .update(marketsTable)
      .set({ 
        status: "resolved",
        resolvedOutcomeId: winningOutcomeId,
      })
      .where(eq(marketsTable.id, marketId));

    return {
      message: "Market resolved successfully",
      totalPool,
      multiplier: multiplier.toFixed(4)
    }
  })
}

export async function handleGetLeaderboard() {
  const topUsers = await db.query.usersTable.findMany({
    orderBy: [desc(usersTable.balance)],
    limit: 50,
    columns: {
      id: true,
      username: true,
      balance: true,
    },
  });

  return topUsers;
}

export async function handleGetUserBets({ user, query }: { user: any, query: any }) {
  const page = Number(query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const status = query.status as "active" | "resolved" | undefined;
  const db = getDb();

  if (!user) throw new Error("User ID is req");

  const filter = and(
    eq(betsTable.userId, user.id),
    status ? eq(marketsTable.status, status) : undefined
  );

  const bets = await db
    .select()
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .innerJoin(marketOutcomesTable, eq(betsTable.outcomeId, marketOutcomesTable.id))
    .where(filter)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(betsTable.createdAt))

  const [totalCount] = await db
    .select({ count: count() })
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .where(filter);

  const [activeBets] = await db
    .select({ count: count() })
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .where(and(eq(betsTable.userId, user.id), eq(marketsTable.status, 'active')));

  const [resolvedCount] = await db.select({ count: sql<number>`count(*)` }).from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .where(and(eq(betsTable.userId, user.id), eq(marketsTable.status, 'resolved')));

  const formattedBets = bets.map(row => ({
    ...row.bets,
    market: row.markets,
    outcome: row.market_outcomes
  }));

  return {
    data: formattedBets,
    totalPages: Math.ceil((totalCount?.count || 0) / limit),
    totalActive: activeBets?.count || 0,
    totalResolved: resolvedCount?.count || 0,
    currentPage: page
  };
}

