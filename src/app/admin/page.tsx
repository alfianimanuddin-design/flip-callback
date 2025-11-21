"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AddVoucherForm from "./add-voucher/page";
import StatisticsDashboard from "@/src/components/AdminDashboard";

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
  allVouchers: Voucher[];
}

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [voucherData, setVoucherData] = useState<VoucherData>({
    total: 0,
    used: 0,
    available: 0,
    availableVouchers: [],
    allVouchers: [],
  });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showAddVoucher, setShowAddVoucher] = useState(false);
  const [transactionDateRange, setTransactionDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"transactions" | "statistics">(
    "statistics"
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resendingEmails, setResendingEmails] = useState<Set<string>>(
    new Set()
  );
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const itemsPerPage = 10;
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchData();
    fetchStatistics();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null);
    };

    if (openDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openDropdown]);

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`/api/admin/statistics?days=365`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/admin/login");
      return;
    }

    setUserEmail(session.user.email || "");

    // Fetch user role from profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      setUserRole(profile.role || "");
    }
  };

  const fetchData = async () => {
    try {
      // Fetch transactions
      const { data: txData, error: txError} = await supabase
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
        allVouchers: all || [],
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleResendVoucher = async (transactionId: string) => {
    // Clear previous messages
    setResendSuccess(null);
    setResendError(null);

    // Add transaction to loading state
    setResendingEmails((prev) => new Set(prev).add(transactionId));

    try {
      // Get the current session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      // Call the resend API endpoint
      const response = await fetch("/api/resend-voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ transactionId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to resend email");
      }

      // Show success message
      setResendSuccess(`Email resent successfully to ${result.data.email}`);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setResendSuccess(null);
      }, 5000);
    } catch (error) {
      console.error("Error resending voucher:", error);
      setResendError(
        error instanceof Error ? error.message : "Failed to resend email"
      );

      // Auto-hide error message after 5 seconds
      setTimeout(() => {
        setResendError(null);
      }, 5000);
    } finally {
      // Remove transaction from loading state
      setResendingEmails((prev) => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      tx.transaction_id?.toLowerCase().includes(query) ||
      tx.email?.toLowerCase().includes(query);

    const matchesStatus = statusFilter === "ALL" || tx.status === statusFilter;

    // Date range filtering
    let matchesDateRange = true;
    if (transactionDateRange.start || transactionDateRange.end) {
      // Get the date in local timezone (not UTC) to match the date picker
      const txDate = new Date(tx.created_at);
      const localDateStr = txDate.getFullYear() + '-' +
                          String(txDate.getMonth() + 1).padStart(2, '0') + '-' +
                          String(txDate.getDate()).padStart(2, '0');

      matchesDateRange = (!transactionDateRange.start || localDateStr >= transactionDateRange.start) &&
                        (!transactionDateRange.end || localDateStr <= transactionDateRange.end);
    }

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    endIndex
  );

  // Reset to page 1 when search query, status filter, or date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, transactionDateRange.start, transactionDateRange.end]);

  // Group available vouchers by product name
  const availableVouchersByProduct = voucherData.availableVouchers.reduce(
    (acc: Record<string, number>, voucher: any) => {
      const productName = voucher.product_name || "Unknown Product";
      acc[productName] = (acc[productName] || 0) + 1;
      return acc;
    },
    {}
  );

  // Group used vouchers by product name
  const usedVouchersByProduct = voucherData.allVouchers
    .filter((voucher: any) => voucher.used)
    .reduce((acc: Record<string, number>, voucher: any) => {
      const productName = voucher.product_name || "Unknown Product";
      acc[productName] = (acc[productName] || 0) + 1;
      return acc;
    }, {});

  // Combine all product names (both available and used)
  const allProductNames = Array.from(
    new Set([
      ...Object.keys(availableVouchersByProduct),
      ...Object.keys(usedVouchersByProduct),
    ])
  ).sort();

  // Get unique product names from all vouchers for autocomplete
  const existingProductNames = Array.from(
    new Set(
      voucherData.allVouchers
        .map((voucher: any) => voucher.product_name)
        .filter((name) => name && name !== "Unknown Product")
    )
  ).sort();

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
      <style jsx>{`
        input::placeholder {
          color: #d1d5db;
          opacity: 1;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
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
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: "12px 24px",
                backgroundColor: "rgba(255,255,255,0.2)",
                color: "white",
                border: "2px solid white",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: isRefreshing ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isRefreshing ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.color = "#10b981";
                }
              }}
              onMouseLeave={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255,255,255,0.2)";
                  e.currentTarget.style.color = "white";
                }
              }}
            >
              {isRefreshing ? "🔄 Refreshing..." : "🔄 Refresh Data"}
            </button>
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
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            marginBottom: "30px",
            display: "flex",
            gap: "12px",
            borderBottom: "2px solid rgba(255,255,255,0.2)",
            paddingBottom: "0",
          }}
        >
          <button
            onClick={() => setActiveTab("statistics")}
            style={{
              padding: "12px 24px",
              backgroundColor:
                activeTab === "statistics" ? "white" : "transparent",
              color: activeTab === "statistics" ? "#667eea" : "white",
              border: "none",
              borderRadius: "8px 8px 0 0",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
              borderBottom:
                activeTab === "statistics"
                  ? "3px solid #667eea"
                  : "3px solid transparent",
            }}
          >
            📈 Dashboard
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            style={{
              padding: "12px 24px",
              backgroundColor:
                activeTab === "transactions" ? "white" : "transparent",
              color: activeTab === "transactions" ? "#667eea" : "white",
              border: "none",
              borderRadius: "8px 8px 0 0",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
              borderBottom:
                activeTab === "transactions"
                  ? "3px solid #667eea"
                  : "3px solid transparent",
            }}
          >
            📊 Transactions & Vouchers
          </button>
        </div>

        {/* Key Metrics Cards - Only visible on Dashboard tab */}
        {activeTab === "statistics" && stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
              marginBottom: "40px",
            }}
          >
            <MetricCard
              title="Total Revenue"
              value={new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(stats.sales.totalRevenue)}
              subtitle={`${stats.sales.successfulTransactions} successful`}
              icon="💰"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              trend={`+${(stats.sales.conversionRate).toFixed(1)}%`}
            />
            <MetricCard
              title="Avg Order Value"
              value={new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(stats.sales.averageOrderValue)}
              subtitle={`${stats.sales.totalTransactions} total orders`}
              icon="📊"
              gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
              trend={(stats.sales.conversionRate).toFixed(1) + '%'}
            />
            <MetricCard
              title="Conversion Rate"
              value={(stats.sales.conversionRate).toFixed(1) + '%'}
              subtitle="Success rate"
              icon="🎯"
              gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
              trend={`${stats.sales.successfulTransactions}/${stats.sales.totalTransactions}`}
            />
            <MetricCard
              title="Total Visitors"
              value={stats.traffic.totalVisitors.toString()}
              subtitle={`${stats.traffic.repeatCustomers} returning`}
              icon="👥"
              gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
              trend={((stats.traffic.repeatCustomers / stats.traffic.totalVisitors) * 100).toFixed(1) + '%'}
            />
          </div>
        )}

        {/* Transactions & Vouchers Tab Content */}
        {activeTab === "transactions" && (
          <>
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
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
                    Available Vouchers ({voucherData.available})
                  </h2>
                  {userRole === "admin" && (
                    <button
                      onClick={() => setShowAddVoucher(true)}
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "#667eea",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 12px rgba(0,0,0,0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      ➕ Add Voucher
                    </button>
                  )}
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 8px",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Product Name</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Total</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Available</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Used</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "right",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProductNames.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            textAlign: "center",
                            padding: "60px 20px",
                            color: "#9CA3AF",
                          }}
                        >
                          <div
                            style={{ fontSize: "48px", marginBottom: "16px" }}
                          >
                            📭
                          </div>
                          <div style={{ fontSize: "18px", fontWeight: "500" }}>
                            No vouchers
                          </div>
                          <div style={{ fontSize: "14px", marginTop: "8px" }}>
                            Click "Add Voucher" button above to add new vouchers
                          </div>
                        </td>
                      </tr>
                    ) : (
                      allProductNames.map((productName, index) => {
                        const availableCount =
                          availableVouchersByProduct[productName] || 0;
                        const totalUsed =
                          usedVouchersByProduct[productName] || 0;
                        const total = availableCount + totalUsed;
                        const utilizationRate = total > 0 ? (totalUsed / total) * 100 : 0;
                        const bgColor = index % 2 === 0 ? "#fafafa" : "#ffffff";

                        return (
                          <tr key={productName}>
                            <td style={{
                              padding: "16px 20px",
                              borderRadius: "12px 0 0 12px",
                              background: bgColor,
                            }}>
                              <span
                                style={{
                                  fontWeight: "600",
                                  color: "#1f2937",
                                  fontSize: "15px",
                                  textTransform: "capitalize",
                                }}
                              >
                                {productName}
                              </span>
                            </td>
                            <td style={{
                              padding: "16px 20px",
                              textAlign: "center",
                              background: bgColor,
                              fontWeight: "700",
                              color: "#4b5563",
                            }}>
                              {total}
                            </td>
                            <td style={{
                              padding: "16px 20px",
                              textAlign: "center",
                              background: bgColor,
                            }}>
                              <span
                                style={{
                                  padding: "6px 16px",
                                  borderRadius: "999px",
                                  background: availableCount > 0 ? "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)" : "#e5e7eb",
                                  color: availableCount > 0 ? "#065f46" : "#6b7280",
                                  fontWeight: "700",
                                  fontSize: "14px",
                                }}
                              >
                                {availableCount}
                              </span>
                            </td>
                            <td style={{
                              padding: "16px 20px",
                              textAlign: "center",
                              background: bgColor,
                            }}>
                              <span
                                style={{
                                  padding: "6px 16px",
                                  borderRadius: "999px",
                                  background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
                                  color: "#92400e",
                                  fontWeight: "700",
                                  fontSize: "14px",
                                }}
                              >
                                {totalUsed}
                              </span>
                            </td>
                            <td style={{
                              padding: "16px 20px",
                              textAlign: "right",
                              borderRadius: "0 12px 12px 0",
                              background: bgColor,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
                                <div style={{
                                  width: "100px",
                                  height: "10px",
                                  background: "#e5e7eb",
                                  borderRadius: "999px",
                                  overflow: "hidden",
                                }}>
                                  <div style={{
                                    width: `${utilizationRate}%`,
                                    height: "100%",
                                    background: utilizationRate > 75
                                      ? "linear-gradient(90deg, #f093fb 0%, #f5576c 100%)"
                                      : utilizationRate > 50
                                      ? "linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)"
                                      : "linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)",
                                    transition: "width 1s ease-out",
                                  }} />
                                </div>
                                <span style={{
                                  fontWeight: "700",
                                  color: "#4b5563",
                                  fontSize: "14px",
                                  minWidth: "50px",
                                }}>
                                  {utilizationRate.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notifications */}
            {(resendSuccess || resendError) && (
              <div
                style={{
                  backgroundColor: resendSuccess ? "#D1FAE5" : "#FEE2E2",
                  border: `1px solid ${resendSuccess ? "#10B981" : "#EF4444"}`,
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span style={{ fontSize: "20px" }}>
                    {resendSuccess ? "✅" : "❌"}
                  </span>
                  <span
                    style={{
                      color: resendSuccess ? "#065F46" : "#991B1B",
                      fontWeight: "500",
                      fontSize: "14px",
                    }}
                  >
                    {resendSuccess || resendError}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setResendSuccess(null);
                    setResendError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendSuccess ? "#065F46" : "#991B1B",
                    fontSize: "20px",
                    cursor: "pointer",
                    padding: "0 4px",
                  }}
                >
                  ×
                </button>
              </div>
            )}

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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
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
                  <div
                    style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
                  >
                    {/* Date Range Filter */}
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        padding: "4px",
                        border: "2px solid #E5E7EB",
                        borderRadius: "8px",
                        backgroundColor: "white",
                      }}
                    >
                      <input
                        type="date"
                        value={transactionDateRange.start}
                        max={transactionDateRange.end || new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          const newStartDate = e.target.value;
                          setTransactionDateRange(prev => ({
                            ...prev,
                            start: newStartDate,
                          }));
                          // If new start date is after current end date, clear end date
                          if (newStartDate && transactionDateRange.end && newStartDate > transactionDateRange.end) {
                            setTransactionDateRange(prev => ({ ...prev, end: '' }));
                          }
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          border: "none",
                          borderRadius: "4px",
                          outline: "none",
                          color: "#111827",
                          cursor: "pointer",
                          backgroundColor: "transparent",
                        }}
                      />
                      <span style={{ color: "#6B7280", fontSize: "14px" }}>-</span>
                      <input
                        type="date"
                        value={transactionDateRange.end}
                        min={transactionDateRange.start || undefined}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setTransactionDateRange(prev => ({ ...prev, end: e.target.value }))}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          border: "none",
                          borderRadius: "4px",
                          outline: "none",
                          color: "#111827",
                          cursor: "pointer",
                          backgroundColor: "transparent",
                        }}
                      />
                      {(transactionDateRange.start || transactionDateRange.end) && (
                        <button
                          onClick={() => setTransactionDateRange({ start: '', end: '' })}
                          style={{
                            padding: "6px 10px",
                            backgroundColor: "transparent",
                            color: "#EF4444",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "18px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            lineHeight: "1",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#FEE2E2";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          title="Clear dates"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div style={{ position: "relative" }}>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                          padding: "10px 40px 10px 16px",
                          fontSize: "14px",
                          border: "2px solid #E5E7EB",
                          borderRadius: "8px",
                          outline: "none",
                          backgroundColor: "white",
                          color: "#111827",
                          cursor: "pointer",
                          transition: "border-color 0.2s",
                          fontWeight: "500",
                          appearance: "none",
                          WebkitAppearance: "none",
                          MozAppearance: "none",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#667eea";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E5E7EB";
                        }}
                      >
                        <option value="ALL">All Status</option>
                        <option value="SUCCESSFUL">Successful</option>
                        <option value="PENDING">Pending</option>
                        <option value="EXPIRED">Expired</option>
                      </select>
                      <div
                        style={{
                          position: "absolute",
                          right: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: "#6B7280",
                          fontSize: "12px",
                        }}
                      >
                        ▼
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Search by transaction ID or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        padding: "10px 16px",
                        fontSize: "14px",
                        border: "2px solid #E5E7EB",
                        borderRadius: "8px",
                        outline: "none",
                        minWidth: "300px",
                        transition: "border-color 0.2s",
                        color: "#111827",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#667eea";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#E5E7EB";
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 8px",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Email</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Transaction ID</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Payment Status</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "right",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Amount</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}>Transaction Created</th>
                      <th style={{
                        padding: "12px 20px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "#f9fafb",
                      }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            padding: "60px 20px",
                            color: "#9CA3AF",
                          }}
                        >
                          <div
                            style={{ fontSize: "48px", marginBottom: "16px" }}
                          >
                            {transactions.length === 0 ? "📭" : "🔍"}
                          </div>
                          <div style={{ fontSize: "18px", fontWeight: "500" }}>
                            {transactions.length === 0
                              ? "No transactions yet"
                              : "No matching transactions"}
                          </div>
                          <div style={{ fontSize: "14px", marginTop: "8px" }}>
                            {transactions.length === 0
                              ? "Transactions will appear here once payments are made"
                              : "Try adjusting your search query"}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedTransactions.map((tx, index) => (
                        <tr
                          key={tx.id}
                        >
                          <td style={{
                            padding: "16px 20px",
                            borderRadius: "12px 0 0 12px",
                            background: index % 2 === 0 ? "#fafafa" : "#ffffff",
                          }}>
                            <span style={{ color: "#374151", fontWeight: "500" }}>{tx.email}</span>
                          </td>
                          <td style={{
                            padding: "16px 20px",
                            background: index % 2 === 0 ? "#fafafa" : "#ffffff",
                          }}>
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
                          <td style={{
                            padding: "16px 20px",
                            textAlign: "center",
                            background: index % 2 === 0 ? "#fafafa" : "#ffffff",
                          }}>
                            {(() => {
                              const statusColors = {
                                SUCCESSFUL: {
                                  bg: "#D1FAE5",
                                  color: "#065F46",
                                },
                                PENDING: {
                                  bg: "#FEF3C7",
                                  color: "#92400E",
                                },
                                EXPIRED: {
                                  bg: "#FEE2E2",
                                  color: "#991B1B",
                                },
                                CANCELLED: {
                                  bg: "#FEE2E2",
                                  color: "#991B1B",
                                },
                              };
                              const colors =
                                statusColors[
                                  tx.status as keyof typeof statusColors
                                ] || statusColors.PENDING;

                              return (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: "600",
                                    backgroundColor: colors.bg,
                                    color: colors.color,
                                  }}
                                >
                                  {tx.status}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{
                            padding: "16px 20px",
                            textAlign: "right",
                            background: index % 2 === 0 ? "#fafafa" : "#ffffff",
                          }}>
                            <span
                              style={{
                                fontWeight: "700",
                                color: "#111827",
                                fontSize: "15px",
                              }}
                            >
                              Rp{(
                                tx.discounted_amount || tx.amount
                              )?.toLocaleString("id-ID")}
                            </span>
                          </td>
                          <td style={{
                            padding: "16px 20px",
                            textAlign: "center",
                            background: index % 2 === 0 ? "#fafafa" : "#ffffff",
                          }}>
                            <span
                              style={{
                                color: "#6B7280",
                                fontSize: "13px",
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
                          <td
                            style={{
                              padding: "16px 20px",
                              borderRadius: "0 12px 12px 0",
                              background: index % 2 === 0 ? "#fafafa" : "#ffffff",
                              position: "relative",
                            }}
                          >
                            <div style={{ position: "relative" }}>
                              <button
                                onClick={(e) => {
                                  if (tx.voucher_code && tx.status === "SUCCESSFUL") {
                                    e.stopPropagation();
                                    setOpenDropdown(
                                      openDropdown === tx.transaction_id
                                        ? null
                                        : tx.transaction_id
                                    );
                                  }
                                }}
                                disabled={!tx.voucher_code || tx.status !== "SUCCESSFUL"}
                                title={
                                  !tx.voucher_code
                                    ? "No voucher code available"
                                    : tx.status !== "SUCCESSFUL"
                                    ? "Only available for successful transactions"
                                    : "Actions"
                                }
                                style={{
                                  padding: "8px",
                                  backgroundColor: "transparent",
                                  color: (!tx.voucher_code || tx.status !== "SUCCESSFUL") ? "#D1D5DB" : "#6B7280",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "20px",
                                  cursor: (!tx.voucher_code || tx.status !== "SUCCESSFUL") ? "not-allowed" : "pointer",
                                  transition: "all 0.2s",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "36px",
                                  height: "36px",
                                  opacity: (!tx.voucher_code || tx.status !== "SUCCESSFUL") ? 0.5 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (tx.voucher_code && tx.status === "SUCCESSFUL") {
                                    e.currentTarget.style.backgroundColor =
                                      "#F3F4F6";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (tx.voucher_code && tx.status === "SUCCESSFUL") {
                                    e.currentTarget.style.backgroundColor =
                                      "transparent";
                                  }
                                }}
                              >
                                ⋮
                              </button>

                                  {openDropdown === tx.transaction_id && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "100%",
                                        right: "0",
                                        backgroundColor: "white",
                                        border: "1px solid #E5E7EB",
                                        borderRadius: "8px",
                                        boxShadow:
                                          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                                        zIndex: 1000,
                                        minWidth: "180px",
                                        marginTop: "4px",
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => {
                                          handleResendVoucher(
                                            tx.transaction_id
                                          );
                                          setOpenDropdown(null);
                                        }}
                                        disabled={resendingEmails.has(
                                          tx.transaction_id
                                        )}
                                        style={{
                                          width: "100%",
                                          padding: "12px 16px",
                                          backgroundColor: "transparent",
                                          color: resendingEmails.has(
                                            tx.transaction_id
                                          )
                                            ? "#9CA3AF"
                                            : "#667eea",
                                          border: "none",
                                          fontSize: "14px",
                                          fontWeight: "600",
                                          cursor: resendingEmails.has(
                                            tx.transaction_id
                                          )
                                            ? "not-allowed"
                                            : "pointer",
                                          transition: "all 0.2s",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          textAlign: "left",
                                          borderRadius: "6px",
                                        }}
                                        onMouseEnter={(e) => {
                                          if (
                                            !resendingEmails.has(
                                              tx.transaction_id
                                            )
                                          ) {
                                            e.currentTarget.style.backgroundColor =
                                              "#F3F4F6";
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor =
                                            "transparent";
                                        }}
                                      >
                                        {resendingEmails.has(
                                          tx.transaction_id
                                        ) ? (
                                          <>
                                            <span
                                              style={{
                                                display: "inline-block",
                                                width: "14px",
                                                height: "14px",
                                                border: "2px solid #9CA3AF",
                                                borderTopColor: "transparent",
                                                borderRadius: "50%",
                                                animation:
                                                  "spin 1s linear infinite",
                                              }}
                                            />
                                            Sending...
                                          </>
                                        ) : (
                                          <>📧 Resend Email</>
                                        )}
                                      </button>
                                    </div>
                                  )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredTransactions.length > itemsPerPage && (
                <div
                  style={{
                    padding: "24px",
                    borderTop: "1px solid #E5E7EB",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  <div style={{ fontSize: "14px", color: "#6B7280" }}>
                    Showing {startIndex + 1} to{" "}
                    {Math.min(endIndex, filteredTransactions.length)} of{" "}
                    {filteredTransactions.length} results
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        padding: "8px 16px",
                        backgroundColor:
                          currentPage === 1 ? "#F3F4F6" : "#667eea",
                        color: currentPage === 1 ? "#9CA3AF" : "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.backgroundColor = "#5568d3";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.backgroundColor = "#667eea";
                        }
                      }}
                    >
                      ← Previous
                    </button>

                    {/* Page Numbers */}
                    <div style={{ display: "flex", gap: "4px" }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => {
                          // Show first page, last page, current page, and pages around current
                          const showPage =
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 &&
                              page <= currentPage + 1);

                          const showEllipsisBefore =
                            page === currentPage - 1 && currentPage > 3;
                          const showEllipsisAfter =
                            page === currentPage + 1 &&
                            currentPage < totalPages - 2;

                          if (
                            !showPage &&
                            !showEllipsisBefore &&
                            !showEllipsisAfter
                          )
                            return null;

                          if (showEllipsisBefore || showEllipsisAfter) {
                            return (
                              <span
                                key={page}
                                style={{
                                  padding: "8px 12px",
                                  color: "#9CA3AF",
                                  fontSize: "14px",
                                }}
                              >
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              style={{
                                padding: "8px 12px",
                                backgroundColor:
                                  currentPage === page ? "#667eea" : "#F3F4F6",
                                color:
                                  currentPage === page ? "white" : "#374151",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight:
                                  currentPage === page ? "600" : "500",
                                cursor: "pointer",
                                minWidth: "40px",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                if (currentPage !== page) {
                                  e.currentTarget.style.backgroundColor =
                                    "#E5E7EB";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (currentPage !== page) {
                                  e.currentTarget.style.backgroundColor =
                                    "#F3F4F6";
                                }
                              }}
                            >
                              {page}
                            </button>
                          );
                        }
                      )}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: "8px 16px",
                        backgroundColor:
                          currentPage === totalPages ? "#F3F4F6" : "#667eea",
                        color: currentPage === totalPages ? "#9CA3AF" : "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor:
                          currentPage === totalPages
                            ? "not-allowed"
                            : "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.backgroundColor = "#5568d3";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.backgroundColor = "#667eea";
                        }
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Add Voucher Modal */}
            {showAddVoucher && (
              <div
                onClick={() => setShowAddVoucher(false)}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  zIndex: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: "white",
                    borderRadius: "16px",
                    maxWidth: "800px",
                    width: "100%",
                    maxHeight: "90vh",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                    position: "relative",
                  }}
                >
                  {/* Close Button */}
                  {/* <button
                onClick={() => setShowAddVoucher(false)}
                style={{
                  position: "absolute",
                  top: "-20px",
                  right: "-20px",
                  width: "40px",
                  height: "40px",
                  backgroundColor: "#F3F4F6",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6B7280",
                  lineHeight: 1,
                  zIndex: 100,
                  transition: "all 0.2s",
                  borderRadius: "100%",
                  fontWeight: "bold",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#EF4444";
                  e.currentTarget.style.backgroundColor = "#FEE2E2";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6B7280";
                  e.currentTarget.style.backgroundColor = "#F3F4F6";
                }}
              >
                ×
              </button> */}

                  {/* Add Voucher Form */}
                  <AddVoucherForm
                    onVoucherAdded={() => {
                      fetchData();
                      setShowAddVoucher(false);
                    }}
                    existingProductNames={existingProductNames}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Statistics Dashboard Tab Content */}
        {activeTab === "statistics" && (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "20px",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <StatisticsDashboard />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  gradient: string;
  trend: string;
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-5px)';
      e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
    }}>
      {/* Background gradient circle */}
      <div style={{
        position: 'absolute',
        top: '-50px',
        right: '-50px',
        width: '150px',
        height: '150px',
        background: gradient,
        borderRadius: '50%',
        opacity: 0.1,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </div>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
          }}>
            {icon}
          </div>
        </div>

        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '8px',
          lineHeight: '1.2',
        }}>
          {value}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>
            {subtitle}
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: '700',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
            color: '#065f46',
          }}>
            {trend}
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

