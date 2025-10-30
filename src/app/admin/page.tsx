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
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddVoucher, setShowAddVoucher] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
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

  const filteredTransactions = transactions.filter((tx) => {
    const query = searchQuery.toLowerCase();
    return (
      tx.transaction_id?.toLowerCase().includes(query) ||
      tx.email?.toLowerCase().includes(query) ||
      tx.voucher_code?.toLowerCase().includes(query)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    endIndex
  );

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Group vouchers by product name
  const productVoucherCounts = voucherData.availableVouchers.reduce(
    (acc: Record<string, number>, voucher: any) => {
      const productName = voucher.product_name || "Unknown Product";
      acc[productName] = (acc[productName] || 0) + 1;
      return acc;
    },
    {}
  );

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
            </div>
          </div>

          <div style={{ padding: "24px" }}>
            {Object.keys(productVoucherCounts).length === 0 ? (
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
                  Click "Add Voucher" button above to add new vouchers
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "20px",
                }}
              >
                {Object.entries(productVoucherCounts).map(
                  ([productName, count]) => (
                    <div
                      key={productName}
                      style={{
                        padding: "24px",
                        backgroundColor: "#F0FDF4",
                        border: "2px solid #86EFAC",
                        borderRadius: "12px",
                        transition: "all 0.2s",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow =
                          "0 8px 16px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#065F46",
                          marginBottom: "12px",
                          textTransform: "capitalize",
                        }}
                      >
                        {productName}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          fontSize: "32px",
                          fontWeight: "bold",
                          color: "#059669",
                        }}
                      >
                        <span>{count}</span>
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            fontWeight: "500",
                          }}
                        >
                          {count === 1 ? "voucher" : "vouchers"}
                        </span>
                      </div>
                    </div>
                  )
                )}
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
              <input
                type="text"
                placeholder="Search by transaction ID, email, or voucher code..."
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
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
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
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: currentPage === 1 ? "#F3F4F6" : "#667eea",
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
                        (page >= currentPage - 1 && page <= currentPage + 1);

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
                            color: currentPage === page ? "white" : "#374151",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "14px",
                            fontWeight: currentPage === page ? "600" : "500",
                            cursor: "pointer",
                            minWidth: "40px",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            if (currentPage !== page) {
                              e.currentTarget.style.backgroundColor = "#E5E7EB";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentPage !== page) {
                              e.currentTarget.style.backgroundColor = "#F3F4F6";
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
                      currentPage === totalPages ? "not-allowed" : "pointer",
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
                overflow: "auto",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                position: "relative",
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowAddVoucher(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "28px",
                  cursor: "pointer",
                  color: "#6B7280",
                  lineHeight: 1,
                  zIndex: 10,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6B7280";
                }}
              >
                ×
              </button>

              {/* Add Voucher Form */}
              <AddVoucherForm
                onVoucherAdded={() => {
                  fetchData();
                  setShowAddVoucher(false);
                }}
              />
            </div>
          </div>
        )}
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
