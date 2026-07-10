import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type UserFormInput, userFormSchema } from "./user-schema"

interface UserFormProps {
	defaultValues?: Partial<UserFormInput>
	onSubmit: (values: UserFormInput) => void
	isSubmitting?: boolean
	submitLabel: string
}

export function UserForm({ defaultValues, onSubmit, isSubmitting, submitLabel }: UserFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<UserFormInput>({
		resolver: zodResolver(userFormSchema),
		defaultValues: {
			name: defaultValues?.name ?? "",
			email: defaultValues?.email ?? "",
		},
	})

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input id="name" placeholder="John Doe" {...register("name")} />
				{errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
			</div>
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input id="email" type="email" placeholder="john@example.com" {...register("email")} />
				{errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
			</div>
			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	)
}
