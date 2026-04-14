We chose Drizzle ORM with an SQLite (Bun:sqlite) backend. This allowed us to define our "Source of Truth" in a single schema file.

    The Benefit: We get type-safety from the database all the way to the frontend.

    Relational Logic: By using Drizzle’s relations API, we simplified complex queries (like fetching a bet along with its market and the specific outcome) into single, readable blocks.

Moving from manual useEffect fetching to TanStack Query.

    Invalidation Strategy: We designed the app so that a "Mutation" (like placing a bet) triggers a ripple effect across the app. By "invalidating" specific keys like ["markets"] or ["user-profile"], every component currently on screen—be it the Navbar, the Dashboard, or the Profile—refetches its data automatically.

    Caching: This minimized redundant network requests and provided a "snappy" feel, as data is cached locally.

We utilized TanStack Router for file-based routing.

    The Benefit: This allowed us to use dynamic parameters (like /markets/$id) while maintaining strict TypeScript types for our URL params, ensuring we never try to load a market ID that doesn't exist.

We implemented a React Context (AuthContext) to manage user sessions.

    Design Choice: Instead of just storing a boolean isLoggedIn, we stored the entire user object. However, we later improved this by pairing the context with a useQuery for the profile to ensure the balance updates in real-time without a full page refresh.

## Challenges

1. The "Ghost" Balance Bug

The Challenge: Users would place a bet, but their balance in the Navbar wouldn't change unless they refreshed the page.
The Solution: We moved the Navbar balance from a static Context value to a TanStack Query. By invalidating the user-profile key on every successful bet mutation, we achieved a "snap" update where the balance decreases the instant the "Place Bet" button is clicked.

2. The Pagination/Tab Mismatch

The Challenge: When switching between "Active" and "Resolved" bets on the Profile page, the pagination counts were wrong, or the list appeared empty even when data existed.
The Source: We were originally filtering data on the frontend after fetching a generic "page" of mixed bets.
The Solution: We moved filtering to the backend. Now, the Tabs drive the API request. Clicking "Resolved" sends a specific query to the server, ensuring the user sees the first page of only resolved bets.

3. API Parameter Type-Clashes

The Challenge: Several 500 Internal Server Errors occurred because the frontend was passing single values (like user.id) to functions expecting full objects (like { user, query }).
The Solution: We standardized our handler signatures. We ensured that every API call from the frontend correctly wraps its arguments in an object, matching the backend's TypeScript expectations.