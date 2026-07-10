import type { User } from "@app/api/schemas"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { UserForm } from "@/features/users/user-form"
import type { UserFormInput } from "@/features/users/user-schema"
import { api, ensureOk } from "@/lib/api"

export const Route = createFileRoute("/users/")({
	component: UsersPage,
})

const USERS_QUERY_KEY = ["users"] as const

function UsersPage() {
	const queryClient = useQueryClient()
	const [createOpen, setCreateOpen] = useState(false)
	const [editingUser, setEditingUser] = useState<User | null>(null)

	const usersQuery = useQuery({
		queryKey: USERS_QUERY_KEY,
		queryFn: async () => {
			const res = await api.users.$get()
			await ensureOk(res)
			return res.json()
		},
	})

	const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })

	const createMutation = useMutation({
		mutationFn: async (input: UserFormInput) => {
			const res = await api.users.$post({ json: input })
			await ensureOk(res)
			return res.json()
		},
		onSuccess: () => {
			invalidateUsers()
			toast.success("User created")
			setCreateOpen(false)
		},
		onError: (err) => {
			toast.error(`Create failed: ${err.message}`)
		},
	})

	const updateMutation = useMutation({
		mutationFn: async ({ id, ...input }: { id: string } & UserFormInput) => {
			const res = await api.users[":id"].$put({ param: { id }, json: input })
			await ensureOk(res)
			return res.json()
		},
		onSuccess: () => {
			invalidateUsers()
			toast.success("User updated")
			setEditingUser(null)
		},
		onError: (err) => {
			toast.error(`Update failed: ${err.message}`)
		},
	})

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await api.users[":id"].$delete({ param: { id } })
			await ensureOk(res)
		},
		onSuccess: () => {
			invalidateUsers()
			toast.success("User deleted")
		},
		onError: (err) => {
			toast.error(`Delete failed: ${err.message}`)
		},
	})

	const data = usersQuery.data
	const users: User[] = data && "users" in data ? data.users : []
	const total = data && "total" in data ? data.total : 0

	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
			<header className="flex items-start justify-between gap-4">
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold tracking-tight">Users</h1>
					<p className="text-muted-foreground text-sm">
						DynamoDB 上のユーザーを CRUD できる完全機能サンプル
					</p>
				</div>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger asChild>
						<Button>+ New user</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create user</DialogTitle>
							<DialogDescription>Add a new user record.</DialogDescription>
						</DialogHeader>
						<UserForm
							onSubmit={(input) => createMutation.mutate(input)}
							isSubmitting={createMutation.isPending}
							submitLabel="Create"
						/>
					</DialogContent>
				</Dialog>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>User list</CardTitle>
					<CardDescription>Total: {total}</CardDescription>
				</CardHeader>
				<CardContent>
					{usersQuery.isPending && <p className="text-muted-foreground text-sm">loading...</p>}
					{usersQuery.isError && (
						<p className="text-destructive text-sm">
							error:{" "}
							{usersQuery.error instanceof Error
								? usersQuery.error.message
								: String(usersQuery.error)}
						</p>
					)}
					{!usersQuery.isPending && users.length === 0 && (
						<p className="text-muted-foreground text-sm">
							No users yet. Click "New user" to add one.
						</p>
					)}
					{users.length > 0 && (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{users.map((user) => (
									<TableRow key={user.id}>
										<TableCell className="font-medium">{user.name}</TableCell>
										<TableCell>{user.email}</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{new Date(user.createdAt).toLocaleString()}
										</TableCell>
										<TableCell className="space-x-2 text-right">
											<Button size="sm" variant="outline" onClick={() => setEditingUser(user)}>
												Edit
											</Button>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button
														size="sm"
														variant="destructive"
														disabled={deleteMutation.isPending}
													>
														Delete
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete this user?</AlertDialogTitle>
														<AlertDialogDescription>
															This cannot be undone. {user.name} ({user.email})
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction onClick={() => deleteMutation.mutate(user.id)}>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={!!editingUser}
				onOpenChange={(open) => {
					if (!open) setEditingUser(null)
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit user</DialogTitle>
						<DialogDescription>Update user information.</DialogDescription>
					</DialogHeader>
					{editingUser && (
						<UserForm
							defaultValues={{ name: editingUser.name, email: editingUser.email }}
							onSubmit={(input) => updateMutation.mutate({ id: editingUser.id, ...input })}
							isSubmitting={updateMutation.isPending}
							submitLabel="Save"
						/>
					)}
				</DialogContent>
			</Dialog>
		</main>
	)
}
