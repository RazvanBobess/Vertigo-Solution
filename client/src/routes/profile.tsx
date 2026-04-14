import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Button } from "@base-ui/react";

function ProfilePage() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("active");
  const { user } = useAuth();

  const { data: response, isLoading } = useQuery({
    queryKey: ["user-bets", page, activeTab],
    queryFn: () => api.getBets(page, activeTab)
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.request("/api/auth/me")
  });

  const liveBalance = profile?.balance ?? user?.balance ?? 0;

  const betsArray = response?.data || [];
  const totalPages = response?.totalPages || 1;

  // const activeBets = betsArray?.filter((b: any) => b.market.status === "active") || [];
  // const resolvedBets = betsArray?.filter((b: any) => b.market.status === "resolved") || [];

  const activeBets = response?.totalActive || 0;
  const resolvedBets = response?.totalResolved || 0;

  const handleTabChanges = (value: string) => {
    setActiveTab(value);
    setPage(1);
  };

  if (isLoading) return <div>Loading history...</div>

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl flex justify-between items-end">
        <div>
          <h1 className="text-sm font-medium opacity-70 uppercase tracking-widest">User Profile</h1>
          <h2 className="text-4xl font-bold mt-1">{user?.username}</h2>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-70 uppercase font-bold">Total Assets</p>
          <p className="text-4xl font-mono text-green-400 font-bold">${Number(liveBalance).toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <Button 
        className="px-4 py-2 bg-slate-100 rounded-md disabled:opacity-50"
        disabled={page === 1} onClick={() => setPage(p => p - 1)}>
          Previous
        </Button>
        <span>Page {page} of {totalPages || 1}</span>
        <Button 
        className="px-4 py-2 bg-slate-100 rounded-md disabled:opacity-50"
        disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
          Next
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChanges} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12 bg-slate-100 p-1">
          <TabsTrigger value="active" className="font-bold">Active Bets ({activeBets})</TabsTrigger>
          <TabsTrigger value="resolved" className="font-bold">Resolved History ({resolvedBets})</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-4">
          {betsArray.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed">
              <p className="text-slate-500">No {activeTab} bets found on this page.</p>
            </div>
          ) : (
            betsArray.map((bet: any) => (
              <Card key={bet.id} className={activeTab === 'resolved' ? (bet.outcomeId === bet.market.resolvedOutcomeId ? "border-l-4 border-l-green-500" : "border-l-4 border-l-slate-300") : ""}>
                <CardContent className="flex justify-between items-center p-6">
                  <div>
                    <h4 className="font-bold text-lg">{bet.market.title}</h4>
                    <p className="text-sm text-slate-500">
                      {activeTab === 'active' ? 'Outcome: ' : 'Selection: '}
                      <span className="font-semibold text-blue-600">{bet.outcome.title}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${activeTab === 'resolved' && bet.outcomeId !== bet.market.resolvedOutcomeId ? "text-slate-400 line-through" : ""}`}>
                      ${bet.amount.toFixed(2)}
                    </p>
                    {activeTab === 'active' ? (
                      <Badge variant="outline">PENDING</Badge>
                    ) : (
                      <Badge variant={bet.outcomeId === bet.market.resolvedOutcomeId ? "default" : "secondary"}>
                        {bet.outcomeId === bet.market.resolvedOutcomeId ? "WON" : "LOST"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});