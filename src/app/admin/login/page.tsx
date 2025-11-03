"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Optional: Verify admin or user role
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profile && profile.role !== "admin" && profile.role !== "user") {
          await supabase.auth.signOut();
          setError("Unauthorized: Access denied");
          setLoading(false);
          return;
        }
      }

      router.push("/admin");
      router.refresh();
    } catch (error: any) {
      setError(error.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <style jsx>{`
        input::placeholder {
          color: #d1d5db;
          opacity: 1;
        }
      `}</style>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          padding: "48px",
          width: "100%",
          maxWidth: "450px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
            justifyContent: "center",
          }}
        >
          <img
            src={
              "https://framerusercontent.com/images/ZycDnV7cvhrZMV3Smrx4wZtWk.png"
            }
            style={{ width: "40px", height: "40px", margin: "0 auto 12px" }}
          />
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "#111827",
              margin: "0 0 8px 0",
            }}
          >
            Flip Jajan
          </h1>
          <p
            style={{
              color: "#6B7280",
              fontSize: "14px",
              margin: "0",
            }}
          >
            Enter your credentials to access the Flip Jajan dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: "20px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: "600",
                color: "#111827",
                marginBottom: "8px",
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "16px",
                outline: "none",
                transition: "all 0.2s ease",
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: "600",
                color: "#111827",
                marginBottom: "8px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "16px",
                outline: "none",
                transition: "all 0.2s ease",
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "#FEE2E2",
                border: "1px solid #FCA5A5",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#991B1B",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: loading ? "#9CA3AF" : "#667eea",
              color: "white",
              fontSize: "16px",
              fontWeight: "600",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: loading
                ? "none"
                : "0 1px 3px rgba(102, 126, 234, 0.3)",
            }}
          >
            {loading ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
