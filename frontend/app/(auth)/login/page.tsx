"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMsal } from "@azure/msal-react";
import { isOAuthConfigured } from "@/lib/oauth-config";

export default function LoginPage() {
  const { login, microsoftLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { instance } = useMsal();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login({ username: email, password });
    } catch {
      setError("Credenciais inválidas. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMicrosoftLogin() {
    setError("");
    setIsLoading(true);
    try {
      const loginResponse = await instance.loginPopup({
        scopes: ["user.read"],
        redirectUri: `${window.location.origin}/login`,
      });

      if (loginResponse.accessToken) {
        await microsoftLogin(loginResponse.accessToken);
      }
    } catch (err: unknown) {
      const error = err as { errorCode?: string; message?: string };
      if (error.errorCode !== "user_cancelled") {
        setError(error.message || "Falha no login com Microsoft.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen">
      {/* Left side - Login form */}
      <div className="w-1/2 flex items-center justify-center bg-white">
        <div className="w-full max-w-md p-8 gap-8 flex flex-col">
          {/* Logo */}
          <div className="mb-8 relative h-20 w-28">
            <Image src="/images/logo.png" alt="Logo alz grãos" fill className="object-contain" priority />
          </div>

          {/* Title */}
          <h1 className="justify-start text-neutral-700 text-3xl font-bold font-['Roboto'] leading-8">
            Entre na sua conta
          </h1>

          {/* OAuth Buttons */}
          {isOAuthConfigured.microsoft && (
            <>
              <div className="flex flex-col gap-4">
                <Button variant="outline" type="button" onClick={handleMicrosoftLogin} disabled={isLoading}>
                  <svg className="w-5 h-5" viewBox="0 0 21 21">
                    <rect x="0" y="0" width="10" height="10" fill="#F25022" />
                    <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
                    <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
                    <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
                  </svg>
                  Continue com Microsoft
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center">
                <div className="flex-1 border-t border-slate-300"></div>
                <span className="px-4 text-sm text-text-tertiary">Ou</span>
                <div className="flex-1 border-t border-slate-300"></div>
              </div>
            </>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="Digite o e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <Input
                label="Senha"
                type={showPassword ? "text" : "password"}
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                required
              />
              <div className="mt-2 text-right">
                <Link href="/forgot-password" className="text-sm text-text-secondary hover:text-text-primary">
                  Esqueceu sua senha?
                </Link>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>

      {/* Right side - Background image */}
      <div className="w-1/2 relative bg-background-secondary">
        <Image src="/images/side-pic.png" alt="Campo de milho" fill className="object-cover" priority />
      </div>
    </div>
  );
}
