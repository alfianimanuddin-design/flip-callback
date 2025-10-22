"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddVoucherForm() {
  const [code, setCode] = useState("");
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [discountedAmount, setDiscountedAmount] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const generateVoucherCode = () => {
    const prefix = "VOUCHER";
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    setCode(`${prefix}${timestamp}${random}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from("vouchers")
        .insert([
          {
            code: code.toUpperCase(),
            product_name: productName,
            amount: parseFloat(amount),
            discounted_amount: parseFloat(discountedAmount),
            image: image || null,
            used: false,
          },
        ])
        .select();

      if (error) throw error;

      setMessage({ type: "success", text: "Voucher added successfully!" });

      // Reset form
      setCode("");
      setProductName("");
      setAmount("");
      setDiscountedAmount("");
      setImage("");

      // Refresh page after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to add voucher",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
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
          ➕ Add New Voucher
        </h2>
      </div>

      <div style={{ padding: "24px" }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: "20px" }}>
            {/* Voucher Code */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Voucher Code *
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="VOUCHER000099"
                  required
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    border: "2px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                  }}
                />
                <button
                  type="button"
                  onClick={generateVoucherCode}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#6B7280",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  🎲 Generate
                </button>
              </div>
            </div>

            {/* Product Name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Product Name *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="kopi hitam, teh, etc."
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "2px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Amount */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Amount (Rp) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                required
                min="0"
                step="0.01"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "2px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Discounted Amount */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Discounted Amount (Rp) *
              </label>
              <input
                type="number"
                value={discountedAmount}
                onChange={(e) => setDiscountedAmount(e.target.value)}
                placeholder="8000"
                required
                min="0"
                step="0.01"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "2px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Image URL */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Image URL (Optional)
              </label>
              <input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/voucher-image.jpg"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "2px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Message */}
            {message && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  backgroundColor:
                    message.type === "success" ? "#D1FAE5" : "#FEE2E2",
                  color: message.type === "success" ? "#065F46" : "#991B1B",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "14px 24px",
                backgroundColor: loading ? "#9CA3AF" : "#667eea",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {loading ? "Adding..." : "➕ Add Voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
