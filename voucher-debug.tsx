import type { ComponentType } from "react";
import { useState, useEffect } from "react";

// Voucher interface
interface VoucherGroup {
  product_name: string;
  amount: number;
  discounted_amount: number | null;
  final_price: number;
  has_discount: boolean;
  available_count: number;
  image: string | null;
  description?: string; // Add optional description field
}

// Product order priority with flexible matching patterns
const PRODUCT_ORDER = [
  { keywords: ["value", "voucher"], priority: 1 }, // Value Voucher: Kopi Kenangan Mantan - Large
  { keywords: ["americano"], priority: 2 }, // Americano - Regular
  { keywords: ["spanish", "latte"], priority: 3 }, // Spanish Latte - Regular
  { keywords: ["caramel", "macchiato"], priority: 4 }, // Caramel Macchiato - Regular
  { keywords: ["matcha", "latte"], priority: 5 }, // Matcha Latte - Regular
  { keywords: ["black", "aren"], priority: 6 }, // Kopi Susu Black Aren - Regular
];

// Default products - MATCHED to actual database product names
// NOTE: These MUST match the exact product names in your database
const DEFAULT_PRODUCTS: VoucherGroup[] = [
  {
    product_name: "Value Voucher senilai 25RB",
    amount: 25000,
    discounted_amount: 20000,
    final_price: 20000,
    has_discount: true,
    available_count: 0, // Default to 0, API will update with actual count
    image:
      "https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/value%20voucher.png",
    description:
      "Voucher berlaku untuk semua minuman dan makanan kecuali produk bundling.",
  },
  {
    product_name: "Americano - Regular",
    amount: 17000,
    discounted_amount: 12000,
    final_price: 12000,
    has_discount: true,
    available_count: 0, // Default to 0, will only show if API has data
    image:
      "https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/americano.png",
  },
  {
    product_name: "Spanish Latte - Regular",
    amount: 19000,
    discounted_amount: 15000,
    final_price: 15000,
    has_discount: true,
    available_count: 0,
    image:
      "https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/spanish%20latte.png",
  },
  {
    product_name: "Caramel Macchiato - Regular",
    amount: 28000,
    discounted_amount: 21000,
    final_price: 21000,
    has_discount: true,
    available_count: 0,
    image:
      "https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/caramel%20macchiato.png",
  },
  {
    product_name: "Matcha Latte - Regular",
    amount: 22000,
    discounted_amount: 17000,
    final_price: 17000,
    has_discount: true,
    available_count: 0,
    image:
      "https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/matcha%20latte.png",
  },
  {
    product_name: "Kopi Susu Black Aren - Regular",
    amount: 18000,
    discounted_amount: 14000,
    final_price: 14000,
    has_discount: true,
    available_count: 0,
    image:
      "https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/black%20aren.png",
  },
];

// Sort vouchers based on predefined order
const sortVouchersByOrder = (vouchers: VoucherGroup[]): VoucherGroup[] => {
  return [...vouchers].sort((a, b) => {
    // First priority: available vouchers come before out of stock
    const aAvailable = a.available_count > 0 ? 0 : 1;
    const bAvailable = b.available_count > 0 ? 0 : 1;

    if (aAvailable !== bAvailable) {
      return aAvailable - bAvailable;
    }

    // Second priority: sort by predefined product order
    const aName = a.product_name.toLowerCase();
    const bName = b.product_name.toLowerCase();

    const aMatch = PRODUCT_ORDER.find((order) =>
      order.keywords.every((keyword) => aName.includes(keyword))
    );
    const bMatch = PRODUCT_ORDER.find((order) =>
      order.keywords.every((keyword) => bName.includes(keyword))
    );

    const aPriority = aMatch ? aMatch.priority : 999;
    const bPriority = bMatch ? bMatch.priority : 999;

    return aPriority - bPriority;
  });
};

// FIXED: More flexible merge function with better debugging
const mergeWithDefaults = (apiVouchers: VoucherGroup[]): VoucherGroup[] => {
  const mergedMap = new Map<string, VoucherGroup>();

  // Helper function to match products by keywords
  const findMatchingDefault = (apiProductName: string): VoucherGroup | null => {
    const apiNameLower = apiProductName.toLowerCase();
    console.log(`🔍 Trying to match: "${apiProductName}"`);

    // Try exact match first (case insensitive)
    const exactMatch = DEFAULT_PRODUCTS.find(
      (def) => def.product_name.toLowerCase() === apiNameLower
    );
    if (exactMatch) {
      console.log(`✅ Exact match found: "${exactMatch.product_name}"`);
      return exactMatch;
    }

    // Try keyword matching
    for (const defaultProduct of DEFAULT_PRODUCTS) {
      const match = PRODUCT_ORDER.find((order) => {
        const apiMatches = order.keywords.every((keyword) =>
          apiNameLower.includes(keyword.toLowerCase())
        );
        const defaultMatches = order.keywords.every((keyword) =>
          defaultProduct.product_name
            .toLowerCase()
            .includes(keyword.toLowerCase())
        );

        if (apiMatches && defaultMatches) {
          console.log(
            `✅ Keyword match found: "${apiProductName}" -> "${defaultProduct.product_name}" (keywords: ${order.keywords.join(", ")})`
          );
        }

        return apiMatches && defaultMatches;
      });

      if (match) return defaultProduct;
    }

    console.log(`❌ No match found for: "${apiProductName}"`);
    return null;
  };

  // First, add all default products
  DEFAULT_PRODUCTS.forEach((defaultProduct) => {
    mergedMap.set(defaultProduct.product_name, { ...defaultProduct });
  });

  // Track which API products we've already matched
  const matchedApiProducts = new Set<string>();

  // Override defaults with API data where there's a match
  apiVouchers.forEach((apiVoucher) => {
    const matchedDefault = findMatchingDefault(apiVoucher.product_name);

    if (matchedDefault) {
      // Update the default with API data
      mergedMap.set(matchedDefault.product_name, {
        product_name: matchedDefault.product_name, // Use default name for consistency
        amount: apiVoucher.amount,
        discounted_amount: apiVoucher.discounted_amount,
        final_price: apiVoucher.final_price,
        has_discount: apiVoucher.has_discount,
        available_count: apiVoucher.available_count,
        image: apiVoucher.image || matchedDefault.image, // Use API image or fallback to default
        description: matchedDefault.description, // Preserve description from default
      });
      matchedApiProducts.add(apiVoucher.product_name);
    }
  });

  // Add any API products that didn't match defaults
  apiVouchers.forEach((apiVoucher) => {
    if (!matchedApiProducts.has(apiVoucher.product_name)) {
      console.log(
        `➕ Adding unmatched API product: "${apiVoucher.product_name}"`
      );
      mergedMap.set(apiVoucher.product_name, apiVoucher);
    }
  });

  return Array.from(mergedMap.values());
};

// Format currency
const formatCurrency = (amount: number): string => {
  const numAmount = Number(amount) || 0;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(numAmount));
};

// Calculate discount percentage
const calculateDiscountPercentage = (
  original: number,
  discounted: number
): number => {
  return Math.round(((original - discounted) / original) * 100);
};

// Shimmer Loading Card Component
const ShimmerCard = () => {
  return (
    <div style={{ position: "relative" }}>
      <style>
        {`
                    @keyframes shimmer {
                        0% {
                            transform: translateX(-100%);
                        }
                        100% {
                            transform: translateX(100%);
                        }
                    }
                    .shimmer-wrapper {
                        position: relative;
                        overflow: hidden;
                    }
                    .shimmer-wrapper::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0) 0%,
                            rgba(255, 255, 255, 0) 100%
                        );
                        animation: shimmer 1.5s infinite;
                    }
                `}
      </style>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div
          style={{
            background: "white",
            position: "relative",
            width: "102px",
            flexShrink: 0,
            borderRadius: "16px",
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            className="shimmer-wrapper"
            style={{
              position: "absolute",
              inset: "8px",
              background: "#e5e7eb",
              borderRadius: "8px",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "10px",
              height: "100%",
              width: "2px",
              background: "rgb(253 241 206)",
            }}
          />
        </div>
        <div
          style={{
            background: "white",
            flex: 1,
            padding: "16px",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              className="shimmer-wrapper"
              style={{
                height: "12px",
                width: "80%",
                background: "#e5e7eb",
                borderRadius: "4px",
                marginBottom: "4px",
              }}
            />
            <div
              className="shimmer-wrapper"
              style={{
                height: "12px",
                width: "60%",
                background: "#e5e7eb",
                borderRadius: "4px",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div
                className="shimmer-wrapper"
                style={{
                  height: "10px",
                  width: "50px",
                  background: "#e5e7eb",
                  borderRadius: "4px",
                }}
              />
              <div
                className="shimmer-wrapper"
                style={{
                  height: "21px",
                  width: "80px",
                  background: "#e5e7eb",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div
              className="shimmer-wrapper"
              style={{
                width: "60px",
                height: "24px",
                background: "#e5e7eb",
                borderRadius: "9999px",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component
export default function withVoucherList(
  Component: ComponentType
): ComponentType {
  return (props: Record<string, unknown>) => {
    const [allVouchers, setAllVouchers] = useState<VoucherGroup[]>([]);
    const [vouchers, setVouchers] = useState<VoucherGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVoucher, setSelectedVoucher] = useState<VoucherGroup | null>(
      null
    );
    const [email, setEmail] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [isClosing, setIsClosing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const [touchEndY, setTouchEndY] = useState<number | null>(null);

    useEffect(() => {
      const fetchVouchers = async () => {
        try {
          setLoading(true);

          const response = await fetch(
            "https://flip-callback.vercel.app/api/vouchers"
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success && data.vouchers) {
            // API now returns pre-grouped vouchers with available_count
            const apiVouchers: VoucherGroup[] = data.vouchers.map((v: any) => ({
              product_name: v.product_name,
              amount: v.amount,
              discounted_amount: v.discounted_amount,
              final_price: v.discounted_amount || v.amount,
              has_discount: v.discounted_amount !== null,
              available_count: v.available_count,
              image: v.image,
            }));
            console.log("📊 Vouchers from API (pre-grouped):", apiVouchers);

            // Merge with default products
            const merged = mergeWithDefaults(apiVouchers);
            console.log("🔗 Merged with defaults:", merged);

            // Sort vouchers
            const sortedGrouped = sortVouchersByOrder(merged);
            console.log("📋 Final sorted vouchers:", sortedGrouped);

            setAllVouchers(sortedGrouped);
            setVouchers(sortedGrouped);
          } else {
            console.error("Invalid data format:", data);
            const sortedDefaults = sortVouchersByOrder(DEFAULT_PRODUCTS);
            setAllVouchers(sortedDefaults);
            setVouchers(sortedDefaults);
          }
        } catch (err) {
          console.error("Error loading vouchers:", err);
          const sortedDefaults = sortVouchersByOrder(DEFAULT_PRODUCTS);
          setAllVouchers(sortedDefaults);
          setVouchers(sortedDefaults);
        } finally {
          setLoading(false);
        }
      };

      fetchVouchers();
    }, []);

    const handleVoucherClick = (voucher: VoucherGroup) => {
      setSelectedVoucher(voucher);
      setError("");
      setTimeout(() => {
        setIsOpen(true);
      }, 10);
    };

    const closeBottomSheet = () => {
      setIsClosing(true);
      setIsOpen(false);
      setTimeout(() => {
        setSelectedVoucher(null);
        setIsClosing(false);
        setEmail("");
        setError("");
      }, 300);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      setTouchEndY(e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      if (!touchStartY || !touchEndY) return;
      const swipeDistance = touchEndY - touchStartY;
      if (swipeDistance > 80) {
        closeBottomSheet();
      }
      setTouchStartY(null);
      setTouchEndY(null);
    };

    const handlePurchase = async () => {
      if (!selectedVoucher) {
        setError("Please select a voucher");
        return;
      }
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email");
        return;
      }

      try {
        setIsProcessing(true);
        setError("");

        const response = await fetch(
          "https://flip-callback.vercel.app/api/create-payment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              product_name: selectedVoucher.product_name,
              amount: selectedVoucher.amount,
              discounted_amount: selectedVoucher.discounted_amount,
              email: email,
              name: "kamu yang suka jajan kopi",
              title: selectedVoucher.product_name,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || `HTTP error! status: ${response.status}`
          );
        }

        if (data.success && data.payment_url) {
          window.location.href = data.payment_url;
        } else {
          throw new Error(data.message || "Failed to create payment");
        }
      } catch (err) {
        console.error("Purchase error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process purchase"
        );
      } finally {
        setIsProcessing(false);
      }
    };

    return (
      <div
        style={{
          width: "100%",
          height: "auto",
          minHeight: "100%",
          boxSizing: "border-box",
          fontFamily: "'Proxima Nova', sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {loading ? (
            <>
              <ShimmerCard />
              <ShimmerCard />
              <ShimmerCard />
            </>
          ) : (
            vouchers.map((voucher, index) => {
              const discountPercentage = voucher.has_discount
                ? calculateDiscountPercentage(
                    voucher.amount,
                    voucher.final_price
                  )
                : 0;
              const isOutOfStock = voucher.available_count === 0;

              return (
                <div
                  key={index}
                  onClick={() => !isOutOfStock && handleVoucherClick(voucher)}
                  style={{
                    position: "relative",
                    filter: isOutOfStock ? "grayscale(100%)" : "none",
                    opacity: isOutOfStock ? 0.6 : 1,
                    cursor: isOutOfStock ? "not-allowed" : "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                    }}
                  >
                    {/* Product Image Section */}
                    <div
                      style={{
                        background: "white",
                        position: "relative",
                        width: "102px",
                        flexShrink: 0,
                        borderRadius: "16px",
                        overflow: "hidden",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {voucher.image ? (
                        <img
                          src={voucher.image}
                          alt={voucher.product_name}
                          style={{
                            inset: "8px",
                            objectFit: "contain",
                            opacity: isOutOfStock ? 0.5 : 1,
                            width: "100%",
                            height: "100%",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "64px",
                              height: "64px",
                              background:
                                "linear-gradient(to bottom right, #a87a0d, #543d07)",
                              borderRadius: "50%",
                              opacity: isOutOfStock ? 0.5 : 1,
                            }}
                          />
                        </div>
                      )}

                      {/* Discount Badge */}
                      {voucher.has_discount && !isOutOfStock && (
                        <div
                          style={{
                            position: "absolute",
                            top: "10px",
                            left: 0,
                            background: "#ee255c",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            padding: "2px 4px",
                            borderTopRightRadius: "4px",
                            borderBottomRightRadius: "4px",
                          }}
                        >
                          -{discountPercentage}%
                        </div>
                      )}

                      {/* Out of Stock Badge */}
                      {isOutOfStock && (
                        <div
                          style={{
                            position: "absolute",
                            top: "10px",
                            left: 0,
                            background: "#222223",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            padding: "2px 4px",
                            borderTopRightRadius: "4px",
                            borderBottomRightRadius: "4px",
                          }}
                        >
                          -{discountPercentage}%
                        </div>
                      )}

                      {/* Vertical Divider Line */}
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "10px",
                          height: "100%",
                          width: "2px",
                          background: "rgb(253 241 206)",
                        }}
                      />
                    </div>

                    {/* Product Details Section */}
                    <div
                      style={{
                        background: "white",
                        flex: 1,
                        padding: "16px",
                        borderRadius: "16px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            lineHeight: "16px",
                            color: isOutOfStock ? "#aaabad" : "#222223",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            margin: 0,
                            marginBottom: voucher.description ? "4px" : "0",
                          }}
                        >
                          {voucher.product_name}
                        </h3>

                        {/* Description - only for Value Voucher */}
                        {voucher.description && (
                          <p
                            style={{
                              fontSize: "11px",
                              fontWeight: "400",
                              lineHeight: "14px",
                              color: isOutOfStock ? "#aaabad" : "#6b7280",
                              margin: 0,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {voucher.description}
                          </p>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "space-between",
                          marginTop: voucher.description ? "8px" : "16px",
                        }}
                      >
                        {/* Price Section */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          {voucher.has_discount && (
                            <p
                              style={{
                                fontSize: "10px",
                                fontWeight: "600",
                                textDecoration: "line-through",
                                color: "#aaabad",
                                margin: 0,
                              }}
                            >
                              {formatCurrency(voucher.amount).replace(
                                "Rp",
                                "Rp"
                              )}
                            </p>
                          )}
                          <div
                            style={{
                              fontWeight: "bold",
                              color: isOutOfStock ? "#aaabad" : "#ee255c",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "14px",
                              }}
                            >
                              Rp
                            </span>
                            <span
                              style={{
                                fontSize: "21px",
                              }}
                            >
                              {formatCurrency(voucher.final_price)}
                            </span>
                          </div>
                        </div>

                        {/* Buy Button or Out of Stock Badge */}
                        {isOutOfStock ? (
                          <div
                            style={{
                              position: "relative",
                              width: "60px",
                              height: "24px",
                            }}
                          >
                            <img
                              src="https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/habis.svg"
                              alt="HABIS"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                              }}
                            />
                          </div>
                        ) : (
                          <button
                            style={{
                              background: "#fd6542",
                              color: "white",
                              fontSize: "14px",
                              fontWeight: "bold",
                              padding: "6px 16px",
                              borderRadius: "9999px",
                              border: "none",
                              cursor: "pointer",
                              transition: "background 0.2s",
                              pointerEvents: "none",
                            }}
                          >
                            Beli
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {vouchers.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#666",
            }}
          >
            Tidak ada voucher tersedia
          </div>
        )}

        {/* Bottom Sheet - Purchase Details */}
        {selectedVoucher && (
          <>
            {/* Backdrop */}
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.5)",
                zIndex: 40,
                transition: "opacity 0.3s",
                opacity: isOpen && !isClosing ? 1 : 0,
              }}
              onClick={closeBottomSheet}
            />

            {/* Bottom Sheet Container */}
            <div
              style={{
                position: "fixed",
                bottom: 0,
                left: "50%",
                transform:
                  isOpen && !isClosing
                    ? "translateX(-50%) translateY(0)"
                    : "translateX(-50%) translateY(100%)",
                width: "100%",
                background: "linear-gradient(to top, #a87a0d 8.874%, #423005)",
                zIndex: 50,
                transition: "transform 0.3s",
                borderTopLeftRadius: "24px",
                borderTopRightRadius: "24px",
                touchAction: "pan-y",
              }}
            >
              {/* Brown Box with Voucher */}
              <div
                style={{
                  boxShadow: "0px 4px 20px 0px rgba(168, 122, 13, 0.1)",
                  padding: "20px 16px",
                  position: "relative",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Proxima Nova', sans-serif",
                    fontWeight: "bold",
                    fontSize: "16px",
                    color: "white",
                    lineHeight: "22px",
                    margin: "0 0 20px 0",
                  }}
                >
                  Voucher terbatas 🔥
                </p>

                {/* Voucher Card */}
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                  }}
                >
                  {/* Image Section */}
                  <div
                    style={{
                      background: "white",
                      width: "102px",
                      height: "112px",
                      borderTopLeftRadius: "24px",
                      borderBottomLeftRadius: "24px",
                      borderTopRightRadius: "8px",
                      borderBottomRightRadius: "8px",
                      overflow: "hidden",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                    }}
                  >
                    {selectedVoucher.image && (
                      <img
                        src={selectedVoucher.image}
                        alt={selectedVoucher.product_name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          borderRadius: "10px",
                        }}
                      />
                    )}

                    {/* Discount Badge */}
                    {selectedVoucher.has_discount && (
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          left: 0,
                          background: "#ee255c",
                          color: "white",
                          fontSize: "10px",
                          fontWeight: "bold",
                          padding: "3px 4px",
                          borderTopRightRadius: "4px",
                          borderBottomRightRadius: "4px",
                          fontFamily: "'Proxima Nova', sans-serif",
                          lineHeight: "normal",
                        }}
                      >
                        -
                        {calculateDiscountPercentage(
                          selectedVoucher.amount,
                          selectedVoucher.discounted_amount!
                        )}
                        %
                      </div>
                    )}
                  </div>

                  {/* Vertical Divider */}
                  <div
                    style={{
                      position: "absolute",
                      left: "101px",
                      top: "10px",
                      width: "2px",
                      height: "93px",
                      background: "#e5e7eb",
                    }}
                  />

                  {/* Details Section */}
                  <div
                    style={{
                      background: "white",
                      flex: 1,
                      padding: "10px 20px",
                      borderTopLeftRadius: "8px",
                      borderBottomLeftRadius: "8px",
                      borderTopRightRadius: "24px",
                      borderBottomRightRadius: "24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Proxima Nova', sans-serif",
                        fontWeight: "bold",
                        fontSize: "14px",
                        color: "#543d07",
                        lineHeight: "normal",
                        margin: 0,
                        height: "38px",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {selectedVoucher.product_name}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {selectedVoucher.has_discount && (
                          <p
                            style={{
                              fontFamily: "'Proxima Nova', sans-serif",
                              fontWeight: "600",
                              fontSize: "10px",
                              color: "#aaabad",
                              textDecoration: "line-through",
                              textDecorationSkipInk: "none",
                              lineHeight: "normal",
                              margin: 0,
                            }}
                          >
                            {formatCurrency(selectedVoucher.amount)}
                          </p>
                        )}
                        <p
                          style={{
                            fontFamily: "'Proxima Nova', sans-serif",
                            fontWeight: "bold",
                            color: "#ee255c",
                            lineHeight: "normal",
                            margin: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                            }}
                          >
                            Rp
                          </span>
                          <span
                            style={{
                              fontSize: "18px",
                            }}
                          >
                            {formatCurrency(selectedVoucher.final_price)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms Text */}
                <p
                  style={{
                    fontFamily: "'Proxima Nova', sans-serif",
                    fontWeight: "500",
                    fontSize: "13px",
                    color: "white",
                    textAlign: "center",
                    lineHeight: "20px",
                    margin: "20px 0 0 0",
                  }}
                >
                  Voucher berlaku hingga 3 Mei 2026, di semua outlet kecuali
                  Kenangan Heritage, Kenangan Signature, Chigo, Bandara atau
                  Event
                </p>
              </div>

              {/* White Bottom Sheet - Contact Details */}
              <div
                style={{
                  background: "white",
                  borderTopLeftRadius: "32px",
                  borderTopRightRadius: "32px",
                  boxShadow: "0px 23px 33px 0px rgba(0, 0, 0, 0.03)",
                  padding: "28px 20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Error Message */}
                {error && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#dc2626",
                        margin: 0,
                      }}
                    >
                      {error}
                    </p>
                  </div>
                )}

                {/* Email Input */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      fontFamily: "'Proxima Nova', sans-serif",
                      fontWeight: "bold",
                      fontSize: "14px",
                      color: "#222223",
                      lineHeight: "1.5",
                    }}
                  >
                    Email
                    <span style={{ color: "#ee255c" }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    style={{
                      background: "white",
                      border: "1px solid #e3e3e4",
                      borderRadius: "40px",
                      padding: "16px",
                      fontFamily: "'Proxima Nova', sans-serif",
                      fontWeight: "500",
                      fontSize: "16px",
                      color: "#222223",
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "'Proxima Nova', sans-serif",
                      fontWeight: "400",
                      fontSize: "12px",
                      color: "#6b7280",
                      lineHeight: "1.5",
                      margin: 0,
                    }}
                  >
                    Kode voucher akan dikirim ke email kamu. Cek folder
                    Promotions atau Spam jika tidak muncul di Inbox.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handlePurchase}
                  disabled={isProcessing}
                  style={{
                    background: "#fd6542",
                    borderRadius: "40px",
                    padding: "16px",
                    border: "none",
                    cursor: isProcessing ? "not-allowed" : "pointer",
                    opacity: isProcessing ? 0.6 : 1,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Proxima Nova', sans-serif",
                    fontWeight: "bold",
                    fontSize: "16px",
                    color: "white",
                    lineHeight: "1.3",
                    transition: "opacity 0.2s",
                  }}
                >
                  {isProcessing ? "Memproses..." : "Bayar Sekarang"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };
}
