"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function ForcePasswordChangePage() {
  const { logout, refreshUser } = useAuth();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      await authApi.forcePasswordChange(newPassword, confirmPassword);
      await refreshUser();
      router.push("/overview");
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.new_password) {
        setError(Array.isArray(data.new_password) ? data.new_password.join(" ") : data.new_password);
      } else {
        setError("Não foi possível alterar a senha. Tente novamente.");
      }
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

          {/* Header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-warning-light">
              <ShieldAlert className="w-7 h-7 text-warning" />
            </div>

            <h1 className="text-neutral-700 text-3xl font-bold font-['Roboto'] leading-8">
              Crie sua senha
            </h1>
            <p className="text-sm text-text-secondary">
              Por segurança, você precisa definir uma nova senha antes de continuar.
              Escolha uma senha forte com pelo menos 8 caracteres.
            </p>
          </div>

          {/* Form */}
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
              {isLoading ? "Salvando..." : "Definir nova senha"}
            </Button>
          </form>

          {/* Logout option */}
          <button
            type="button"
            onClick={logout}
            className="text-sm text-text-tertiary hover:text-text-secondary text-center"
          >
            Sair e entrar com outra conta
          </button>
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
