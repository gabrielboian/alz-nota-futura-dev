"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-neutral-700 text-3xl font-bold font-['Roboto'] leading-8">
          Link inválido
        </h1>
        <p className="text-sm text-text-secondary">
          Este link de redefinição é inválido ou expirou.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Solicitar novo link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPasswordConfirm(token, newPassword, confirmPassword);
      setSuccess(true);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.token) {
        setError("Link inválido ou expirado. Solicite um novo.");
      } else if (data?.new_password) {
        setError(Array.isArray(data.new_password) ? data.new_password.join(" ") : data.new_password);
      } else {
        setError("Não foi possível redefinir a senha. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50">
          <CheckCircle className="w-7 h-7 text-success" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-neutral-700 text-3xl font-bold font-['Roboto'] leading-8">
            Senha redefinida!
          </h1>
          <p className="text-sm text-text-secondary">
            Sua senha foi atualizada com sucesso. Você já pode entrar com a nova senha.
          </p>
        </div>

        <Link href="/login">
          <Button type="button">Ir para o login</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-neutral-700 text-3xl font-bold font-['Roboto'] leading-8">
          Crie uma nova senha
        </h1>
        <p className="text-sm text-text-secondary">
          Escolha uma senha forte com pelo menos 8 caracteres.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nova senha"
          type={showNew ? "text" : "password"}
          placeholder="Digite a nova senha"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          icon={
            <button type="button" onClick={() => setShowNew(!showNew)} className="focus:outline-none">
              {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
          required
        />

        <Input
          label="Confirmar nova senha"
          type={showConfirm ? "text" : "password"}
          placeholder="Confirme a nova senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="focus:outline-none">
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
          required
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar nova senha"}
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
  );
}

export default function ResetPasswordPage() {
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

          <Suspense fallback={<div className="text-sm text-text-tertiary">Carregando...</div>}>
            <ResetPasswordForm />
          </Suspense>
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
