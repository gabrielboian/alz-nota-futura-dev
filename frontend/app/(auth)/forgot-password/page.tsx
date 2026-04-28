"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await authApi.resetPasswordRequest(email);
      setSubmitted(true);
    } catch {
      setError("Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen">
      {/* Left side */}
      <div className="w-1/2 flex items-center justify-center bg-white">
        <div className="w-full max-w-md p-8 gap-8 flex flex-col">
          {/* Logo */}
          <div className="mb-8 relative h-20 w-28">
            <Image
              src="/images/logo.png"
              alt="Logo alz grãos"
              fill
              className="object-contain"
              priority
            />
          </div>

          {submitted ? (
            /* Success state */
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50">
                <MailCheck className="w-7 h-7 text-success" />
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="text-neutral-700 text-3xl font-bold font-['Roboto'] leading-8">
                  Verifique seu e-mail
                </h1>
                <p className="text-sm text-text-secondary">
                  Enviamos um link de redefinição para{" "}
                  <span className="font-semibold text-text-primary">{email}</span>.
                  Ele expira em 1 hora.
                </p>
              </div>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-neutral-700 text-3xl font-bold font-['Roboto'] leading-8">
                  Esqueceu sua senha?
                </h1>
                <p className="text-sm text-text-secondary">
                  Digite seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="Digite o e-mail cadastrado"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Enviando..." : "Enviar link de redefinição"}
                </Button>
              </form>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="w-1/2 relative bg-background-secondary">
        <Image
          src="/images/side-pic.png"
          alt="Campo de milho"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}
