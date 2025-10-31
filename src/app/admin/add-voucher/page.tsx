"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface VoucherRow {
  code: string;
  product_name: string;
  amount: number;
  discounted_amount: number;
  image?: string;
}

export default function AddVoucherForm({
  onVoucherAdded,
  existingProductNames = [],
}: {
  onVoucherAdded?: () => void;
  existingProductNames?: string[];
}) {
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

  // Bulk upload states
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [previewData, setPreviewData] = useState<VoucherRow[]>([]);

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

      // Call the callback to refresh parent component data
      if (onVoucherAdded) {
        onVoucherAdded();
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to add voucher",
      });
    } finally {
      setLoading(false);
    }
  };

  // Bulk upload functions
  const parseCSV = (text: string): VoucherRow[] => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const requiredHeaders = [
      "code",
      "product_name",
      "amount",
      "discounted_amount",
    ];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
    }

    const vouchers: VoucherRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(",").map((v) => v.trim());
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      vouchers.push({
        code: row.code.toUpperCase(),
        product_name: row.product_name,
        amount: parseFloat(row.amount),
        discounted_amount: parseFloat(row.discounted_amount),
        image: row.image || null,
      });
    }

    return vouchers;
  };

  const handleBulkFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setBulkMessage({ type: "error", text: "Please upload a CSV file" });
      return;
    }

    setBulkFile(selectedFile);
    setBulkMessage(null);

    try {
      const text = await selectedFile.text();
      const vouchers = parseCSV(text);
      setPreviewData(vouchers.slice(0, 5));
      setBulkMessage({
        type: "info",
        text: `Found ${vouchers.length} vouchers. Preview shows first 5 rows.`,
      });
    } catch (error: any) {
      setBulkMessage({ type: "error", text: error.message });
      setBulkFile(null);
      setPreviewData([]);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) {
      setBulkMessage({ type: "error", text: "Please select a CSV file" });
      return;
    }

    setBulkLoading(true);
    setBulkMessage(null);

    try {
      const text = await bulkFile.text();
      const vouchers = parseCSV(text);

      // Validate all vouchers
      const invalidRows: string[] = [];
      vouchers.forEach((v, index) => {
        if (
          !v.code ||
          !v.product_name ||
          isNaN(v.amount) ||
          isNaN(v.discounted_amount)
        ) {
          invalidRows.push(`Row ${index + 2}`);
        }
      });

      if (invalidRows.length > 0) {
        throw new Error(`Invalid data in rows: ${invalidRows.join(", ")}`);
      }

      // Insert vouchers in batches
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < vouchers.length; i += batchSize) {
        const batch = vouchers.slice(i, i + batchSize);
        const { error } = await supabase.from("vouchers").insert(
          batch.map((v) => ({
            code: v.code,
            product_name: v.product_name,
            amount: v.amount,
            discounted_amount: v.discounted_amount,
            image: v.image,
            used: false,
          }))
        );

        if (error) {
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      if (successCount > 0) {
        setBulkMessage({
          type: "success",
          text: `Successfully added ${successCount} vouchers!${errorCount > 0 ? ` ${errorCount} failed.` : ""}`,
        });

        setBulkFile(null);
        setPreviewData([]);
        if (onVoucherAdded) {
          onVoucherAdded();
        }

        const fileInput = document.getElementById(
          "bulk-csv-input"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        throw new Error("All vouchers failed to add.");
      }
    } catch (error: any) {
      setBulkMessage({
        type: "error",
        text: error.message || "Failed to add vouchers",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `code,product_name,amount,discounted_amount,image
VOUCHER001,kopi hitam,10000,8000,https://example.com/image.jpg
VOUCHER002,teh manis,8000,6000,
VOUCHER003,jus jeruk,15000,12000,https://example.com/image.jpg`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voucher_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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

        <button
          type="button"
          onClick={() => setShowBulkUpload(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#10B981",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          📤 Bulk Upload
        </button>
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowBulkUpload(false)}
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
            {/* Modal */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                maxWidth: "700px",
                width: "100%",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: "24px",
                  borderBottom: "1px solid #E5E7EB",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#111827",
                    margin: 0,
                  }}
                >
                  📤 Bulk Upload Vouchers
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBulkUpload(false)}
                  style={{
                    padding: "8px",
                    backgroundColor: "transparent",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#6B7280",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: "24px" }}>
                {/* Instructions */}
                <div
                  style={{
                    backgroundColor: "#EFF6FF",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#1E40AF",
                      marginTop: 0,
                      marginBottom: "8px",
                    }}
                  >
                    📋 CSV Format Instructions
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      fontSize: "13px",
                      color: "#1E40AF",
                      lineHeight: "1.6",
                    }}
                  >
                    <li>
                      <strong>Required:</strong> code, product_name, amount,
                      discounted_amount, image (URL)
                    </li>
                    <li>Use comma (,) as separator</li>
                  </ul>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    style={{
                      marginTop: "12px",
                      padding: "8px 16px",
                      backgroundColor: "#667eea",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    ⬇️ Download Template
                  </button>
                </div>

                <form onSubmit={handleBulkSubmit}>
                  <div style={{ display: "grid", gap: "20px" }}>
                    {/* File Upload */}
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
                        Upload CSV File *
                      </label>
                      <input
                        id="bulk-csv-input"
                        type="file"
                        accept=".csv"
                        onChange={handleBulkFileChange}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "2px dashed #D1D5DB",
                          borderRadius: "8px",
                          fontSize: "14px",
                          cursor: "pointer",
                          color: "#111827",
                        }}
                      />
                    </div>

                    {/* Preview Table */}
                    {previewData.length > 0 && (
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
                          Preview (First 5 rows)
                        </label>
                        <div style={{ overflowX: "auto" }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "13px",
                            }}
                          >
                            <thead>
                              <tr style={{ backgroundColor: "#F3F4F6" }}>
                                <th
                                  style={{
                                    padding: "10px",
                                    textAlign: "left",
                                    fontWeight: "600",
                                    borderBottom: "2px solid #E5E7EB",
                                    color: "#111827",
                                  }}
                                >
                                  Code
                                </th>
                                <th
                                  style={{
                                    padding: "10px",
                                    textAlign: "left",
                                    fontWeight: "600",
                                    borderBottom: "2px solid #E5E7EB",
                                    color: "#111827",
                                  }}
                                >
                                  Product
                                </th>
                                <th
                                  style={{
                                    padding: "10px",
                                    textAlign: "right",
                                    fontWeight: "600",
                                    borderBottom: "2px solid #E5E7EB",
                                    color: "#111827",
                                  }}
                                >
                                  Amount
                                </th>
                                <th
                                  style={{
                                    padding: "10px",
                                    textAlign: "right",
                                    fontWeight: "600",
                                    borderBottom: "2px solid #E5E7EB",
                                    color: "#111827",
                                  }}
                                >
                                  Discounted
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.map((voucher, index) => (
                                <tr
                                  key={index}
                                  style={{
                                    borderBottom: "1px solid #E5E7EB",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "10px",
                                      fontFamily: "monospace",
                                      color: "#111827",
                                    }}
                                  >
                                    {voucher.code}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      color: "#111827",
                                    }}
                                  >
                                    {voucher.product_name}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      textAlign: "right",
                                      color: "#111827",
                                    }}
                                  >
                                    Rp {voucher.amount.toLocaleString()}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      textAlign: "right",
                                      color: "#111827",
                                    }}
                                  >
                                    Rp{" "}
                                    {voucher.discounted_amount.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Bulk Message */}
                    {bulkMessage && (
                      <div
                        style={{
                          padding: "12px 16px",
                          borderRadius: "8px",
                          backgroundColor:
                            bulkMessage.type === "success"
                              ? "#D1FAE5"
                              : bulkMessage.type === "error"
                                ? "#FEE2E2"
                                : "#DBEAFE",
                          color:
                            bulkMessage.type === "success"
                              ? "#065F46"
                              : bulkMessage.type === "error"
                                ? "#991B1B"
                                : "#1E40AF",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      >
                        {bulkMessage.text}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowBulkUpload(false)}
                        style={{
                          padding: "12px 24px",
                          backgroundColor: "#F3F4F6",
                          color: "#111827",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={bulkLoading || !bulkFile}
                        style={{
                          padding: "12px 24px",
                          backgroundColor:
                            bulkLoading || !bulkFile ? "#9CA3AF" : "#10B981",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "600",
                          cursor:
                            bulkLoading || !bulkFile
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {bulkLoading ? "Uploading..." : "📤 Upload Vouchers"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Original Single Voucher Form */}
      <div style={{ padding: "24px" }}>
        <style jsx>{`
          input::placeholder {
            color: #D1D5DB;
            opacity: 1;
          }
        `}</style>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: "20px" }}>
            {/* Voucher Code */}
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
                    color: "#111827",
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
                  color: "#111827",
                  marginBottom: "8px",
                }}
              >
                Product Name *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Masukkan Nama Produk"
                required
                list="product-suggestions"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "2px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#111827",
                }}
              />
              <datalist id="product-suggestions">
                {existingProductNames.map((name, index) => (
                  <option key={index} value={name} />
                ))}
              </datalist>
              {existingProductNames.length > 0 && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#4B5563",
                    marginTop: "4px",
                  }}
                >
                  💡 Start typing to see existing products (
                  {existingProductNames.length} available)
                </div>
              )}
            </div>

            {/* Amount & Discounted Amount */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {/* Amount */}
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
                    color: "#111827",
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
                    color: "#111827",
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
                    color: "#111827",
                  }}
                />
              </div>
            </div>

            {/* Image URL */}
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
                Image URL *
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
                  color: "#111827",
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
