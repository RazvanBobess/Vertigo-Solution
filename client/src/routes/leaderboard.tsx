import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function LeaderboardPage() {
  const { data: winners, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.request("/api/markets/leaderboard"),
  });

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <Card className="border-none shadow-xl bg-white/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-3">
            <span className="text-4xl">🏆</span> Global Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Rank</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-10">Loading rankings...</TableCell></TableRow>
              ) : (
                winners?.map((user: any, index: number) => (
                  <TableRow key={user.id} className={index < 3 ? "bg-yellow-50/30" : ""}>
                    <TableCell className="font-bold">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="text-right font-mono text-green-600 font-bold">
                      ${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});
