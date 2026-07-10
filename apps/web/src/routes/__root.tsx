import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

interface RouterContext {
	queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
})

function RootComponent() {
	return (
		<>
			<nav className="border-b">
				<div className="mx-auto flex max-w-2xl items-center gap-6 px-8 py-4">
					<Link
						to="/"
						className="text-sm font-medium hover:underline"
						activeProps={{ className: "text-foreground underline" }}
						activeOptions={{ exact: true }}
					>
						Home
					</Link>
					<Link
						to="/users"
						className="text-muted-foreground text-sm font-medium hover:underline"
						activeProps={{ className: "text-foreground underline" }}
					>
						Users
					</Link>
				</div>
			</nav>
			<Outlet />
			{/* dev だけで描画。prod build では Vite が dead-code 削除 → Rollup で tree-shake */}
			{import.meta.env.DEV && <TanStackRouterDevtools />}
		</>
	)
}
