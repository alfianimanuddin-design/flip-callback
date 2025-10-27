"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AddVoucherForm from "./add-voucher/page";

interface Voucher {
  id: string;
  code: string;
  used: boolean;
  created_at: string;
}

interface VoucherData {
  total: number;
  used: number;
  available: number;
  availableVouchers: Voucher[];
}

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [voucherData, setVoucherData] = useState<VoucherData>({
    total: 0,
    used: 0,
    available: 0,
    availableVouchers: [],
  });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/admin/login");
      return;
    }

    setUserEmail(session.user.email || "");
  };

  const fetchData = async () => {
    try {
      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (txError) throw txError;
      setTransactions(txData || []);

      // Fetch voucher stats
      const { data: all } = await supabase.from("vouchers").select("*");
      const { data: used } = await supabase
        .from("vouchers")
        .select("*")
        .eq("used", true);
      const { data: available } = await supabase
        .from("vouchers")
        .select("*")
        .eq("used", false)
        .order("created_at", { ascending: false });

      setVoucherData({
        total: all?.length || 0,
        used: used?.length || 0,
        available: available?.length || 0,
        availableVouchers: available || [],
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "white", fontSize: "24px" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: "40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1
              style={{
                color: "white",
                fontSize: "36px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              Admin Dashboard
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "16px" }}>
              Monitor your transactions and voucher inventory
            </p>
            {userEmail && (
              <p
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "14px",
                  marginTop: "8px",
                }}
              >
                Logged in as: {userEmail}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "12px 24px",
              backgroundColor: "rgba(255,255,255,0.2)",
              color: "white",
              border: "2px solid white",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "white";
              e.currentTarget.style.color = "#667eea";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = "white";
            }}
          >
            🚪 Logout
          </button>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "24px",
            marginBottom: "40px",
          }}
        >
          <StatCard
            title="Total Vouchers"
            value={voucherData.total}
            icon="🎟️"
            color="#4F46E5"
          />
          <StatCard
            title="Redeemed Vouchers"
            value={voucherData.used}
            icon="✅"
            color="#F59E0B"
          />
          <StatCard
            title="Available Vouchers"
            value={voucherData.available}
            icon="💚"
            color="#10B981"
          />
        </div>

        {/* Add Voucher Form */}
        <AddVoucherForm onVoucherAdded={fetchData} />

        {/* Available Vouchers Section */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#111827",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Available Vouchers ({voucherData.available})
            </h2>
          </div>

          <div style={{ padding: "24px" }}>
            {voucherData.availableVouchers.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#9CA3AF",
                }}
              >
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
                <div style={{ fontSize: "18px", fontWeight: "500" }}>
                  No available vouchers
                </div>
                <div style={{ fontSize: "14px", marginTop: "8px" }}>
                  Add more vouchers using the form above
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "16px",
                  maxHeight: "400px",
                  overflowY: "auto",
                  padding: "4px",
                }}
              >
                {voucherData.availableVouchers.map((voucher: any) => (
                  <div
                    key={voucher.id}
                    style={{
                      padding: "16px",
                      backgroundColor: "#F0FDF4",
                      border: "2px solid #86EFAC",
                      borderRadius: "12px",
                      textAlign: "center",
                      transition: "transform 0.2s",
                      cursor: "default",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontWeight: "700",
                        fontSize: "16px",
                        color: "#065F46",
                        letterSpacing: "1px",
                      }}
                    >
                      {voucher.code}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#111827",
                margin: 0,
              }}
            >
              Redeemed Vouchers ({voucherData.used})
            </h2>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB" }}>
                  <th style={tableHeaderStyle}>Transaction ID</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Voucher Code</th>
                  <th style={tableHeaderStyle}>Amount</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "60px 20px",
                        color: "#9CA3AF",
                      }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        📭
                      </div>
                      <div style={{ fontSize: "18px", fontWeight: "500" }}>
                        No transactions yet
                      </div>
                      <div style={{ fontSize: "14px", marginTop: "8px" }}>
                        Transactions will appear here once payments are made
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, index) => (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        backgroundColor: index % 2 === 0 ? "white" : "#FAFAFA",
                      }}
                    >
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "13px",
                            color: "#6B7280",
                          }}
                        >
                          {tx.transaction_id}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ color: "#374151" }}>{tx.email}</span>
                      </td>
                      <td style={tableCellStyle}>
                        {tx.voucher_code ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 12px",
                              backgroundColor: "#EEF2FF",
                              color: "#4F46E5",
                              borderRadius: "6px",
                              fontWeight: "600",
                              fontSize: "14px",
                              fontFamily: "monospace",
                            }}
                          >
                            {tx.voucher_code}
                          </span>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>-</span>
                        )}
                      </td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        >
                          Rp {tx.amount?.toLocaleString("id-ID")}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "600",
                            backgroundColor:
                              tx.status === "SUCCESSFUL"
                                ? "#D1FAE5"
                                : "#FEF3C7",
                            color:
                              tx.status === "SUCCESSFUL"
                                ? "#065F46"
                                : "#92400E",
                          }}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            color: "#6B7280",
                            fontSize: "14px",
                          }}
                        >
                          {new Date(tx.created_at).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: "16px",
        }}
      >
        <div>
          <p
            style={{
              color: "#6B7280",
              fontSize: "14px",
              fontWeight: "500",
              margin: "0 0 8px 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              margin: 0,
              color: "#111827",
            }}
          >
            {value}
          </p>
        </div>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            backgroundColor: color + "20",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

const tableHeaderStyle = {
  padding: "16px 24px",
  textAlign: "left" as const,
  fontSize: "12px",
  fontWeight: "600" as const,
  color: "#6B7280",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

const tableCellStyle = {
  padding: "16px 24px",
};
