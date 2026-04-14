import { useEffect, useState } from "react";
import { useParams, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function MarketDetailPage() {
  const { id } = useParams({ from: "/markets/$id" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");

  const marketId = parseInt(id, 10);

  const { data: data, isLoading, error: queryError } = useQuery({
    queryKey: ["market", marketId],
    queryFn: () => api.getMarket(marketId),
    refetchInterval: (data) => (data?.status === "active" ? 5000 : false),
  })

  const betMutation = useMutation({
    mutationFn: (amount: number) => api.placeBet(marketId, selectedOutcomeId!, amount),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await queryClient.invalidateQueries({ queryKey: ["markets"] });

      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["user-bets"] });

      setBetAmount("");
    },
    onError: (err: any) => alert(err.message),
  })
  
  const resolveMutation = useMutation({
    mutationFn: (outcomeId: number) => api.resolveMarket(marketId, outcomeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market", marketId] });
      await queryClient.invalidateQueries({ queryKey: ["markets"] });

      await refreshUser();
      setBetAmount("");
    },
    onError: (err: any) => alert(err.message),
  })

  const isBetting = betMutation.isPending;

  useEffect(() => {
    if (data?.outcomes?.length && !selectedOutcomeId) {
      setSelectedOutcomeId(data.outcomes[0].id);
    }
  }, [data, selectedOutcomeId]);

  const handlePlaceBet = async () => {
    const amount = parseFloat(betAmount);
    if (!selectedOutcomeId || isNaN(amount) || amount <= 0) {
      alert("Please select an outcome and enter a valid bet amount");
      return;
    }

    betMutation.mutate(parseFloat(betAmount));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">Please log in to view this market</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-destructive">Market not found</p>
            <Button onClick={() => navigate({ to: "/" })}>Back to Markets</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Header */}
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-4xl">{data.title}</CardTitle>
                {data.description && (
                  <CardDescription className="text-lg mt-2">{data.description}</CardDescription>
                )}
              </div>
              <Badge variant={data.status === "active" ? "default" : "secondary"}>
                {data.status === "active" ? "Active" : "Resolved"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* Outcomes Display */}
              <h3 className="text-lg font-semibold">Outcomes</h3>
              {data.outcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedOutcomeId === outcome.id ? "border-primary bg-primary/5" : "border-secondary bg-secondary/5"
                  }`}
                  onClick={() => data.status === "active" && setSelectedOutcomeId(outcome.id)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">{outcome.title}</h4>
                    <span className="text-2xl font-bold text-primary">{outcome.odds}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-1000" 
                      style={{ width: `${outcome.odds}%` }} 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Total Bets: ${outcome.totalBets.toFixed(2)}</p>
                </div>
              ))}
            </div>

            {/* Market Stats */}
            <div className="rounded-lg p-6 border border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground mb-1">Total Market Value</p>
              <p className="text-4xl font-bold text-primary">
                ${data.totalMarketBets.toFixed(2)}
              </p>
            </div>

            {/* Betting Section */}
            {data.status === "active" && (
              <Card className="bg-secondary/5">
                <CardHeader>
                  <CardTitle>Place Your Bet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selected Outcome</Label>
                    <div className="p-3 bg-white border border-secondary rounded-md">
                      {data.outcomes.find((o) => o.id === selectedOutcomeId)?.title ||
                        "None selected"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="betAmount">Bet Amount ($)</Label>
                    <Input
                      id="betAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="Enter amount"
                      disabled={isBetting}
                    />
                  </div>

                  <Button
                    className="w-full text-lg py-6"
                    onClick={handlePlaceBet}
                    disabled={isBetting || !selectedOutcomeId || !betAmount}
                  >
                    {isBetting ? "Placing bet..." : "Place Bet"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {user?.isAdmin && data.status === "active" && (
              <div className="mt-10 p-4 border-2 border-dashed border-red-200 rounded-xl bg-red-50">
                <h3 className="text-red-600 font-bold mb-4 uppercase text-sm tracking-wider">Admin: Settle Market</h3>
                <div className="flex flex-wrap gap-2">
                  {data.outcomes.map(o => (
                    <Button 
                      key={o.id} variant="destructive" size="sm"
                      disabled={resolveMutation.isPending}
                      onClick={() => { if(confirm(`Confirm ${o.title} as the winner?`)) resolveMutation.mutate(o.id) }}
                    >
                      Win: {o.title}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {data.status === "resolved" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">This market has been resolved.</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/$id")({
  component: MarketDetailPage,
});
