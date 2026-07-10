import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, ensureOk } from "@/lib/api"

export const Route = createFileRoute("/")({
	component: HomePage,
})

function HomePage() {
	const { data, isPending, isError, error, refetch, isFetching } = useQuery({
		queryKey: ["healthcheck"],
		queryFn: async () => {
			const res = await api.healthcheck.$get()
			await ensureOk(res)
			return res.json()
		},
	})

	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">react-hono-sam-template</h1>
				<p className="text-muted-foreground text-sm">Step 3-C: TanStack Router + Query</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>API Health</CardTitle>
					<CardDescription>useQuery で /api/v1/healthcheck を購読</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isPending && <p className="text-muted-foreground text-sm">loading...</p>}
					{isError && (
						<p className="text-destructive text-sm">
							error: {error instanceof Error ? error.message : String(error)}
						</p>
					)}
					{data && "status" in data && "timestamp" in data && (
						<pre className="bg-muted overflow-auto rounded-md p-4 text-sm">
							{JSON.stringify({ status: data.status, timestamp: data.timestamp }, null, 2)}
						</pre>
					)}
					<Button onClick={() => refetch()} disabled={isFetching}>
						{isFetching ? "取得中..." : "再取得"}
					</Button>
				</CardContent>
			</Card>
		</main>
	)
}
