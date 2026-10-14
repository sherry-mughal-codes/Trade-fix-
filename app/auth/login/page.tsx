"use client";

import { Mail, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        identifier: data.identifier,
        email: data.identifier,
        password: data.password,
      });

      if (result?.error) {
        setError("Invalid email/username or password");
        setIsLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <div className="mb-6 flex justify-center">
          <img
            src="/logo.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.svg";
            }}
            alt="TradeFix"
            className="h-14 w-auto max-w-[220px] object-contain"
          />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Welcome Back !</h2>
        <p className="text-muted-foreground mt-2">Sign in to continue to TradeFix.</p>
      </div>

      <div className="bg-card rounded-lg p-2">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="identifier" className="text-sm font-medium text-foreground">
              Email or Username
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                {...register("identifier")}
                type="text"
                id="identifier"
                className={`w-full pl-10 pr-4 py-2.5 text-sm text-black bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary ${
                  errors.identifier ? "border-destructive" : "border-input"
                }`}
                placeholder="Enter email or username"
              />
            </div>
            {errors.identifier && <p className="text-destructive text-xs mt-1">{errors.identifier.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                {...register("password")}
                type="password"
                id="password"
                className={`w-full pl-10 pr-4 py-2.5 text-sm text-black bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary ${
                  errors.password ? "border-destructive" : "border-input"
                }`}
                placeholder="Enter password"
              />
            </div>
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-input bg-background text-minia-primary accent-minia-primary focus:ring-minia-primary"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
              Remember me
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-minia-primary hover:bg-minia-primary/90 text-primary-foreground font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-minia-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p className="mt-4">© {new Date().getFullYear()} TradeFix.</p>
        </div>
      </div>
    </div>
  );
}
