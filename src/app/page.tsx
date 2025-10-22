"use client";

import React, { useState, useEffect } from "react";
import { ShoppingCart, Ticket, Coffee, Loader2, Droplet } from "lucide-react";

interface VoucherGroup {
  product_name: string;
  amount: number;
  discounted_amount: number | null;
  final_price: number;
  has_discount: boolean;
  available_count: number;
  image: string | null;
}

export default function VoucherSelection() {
  const [vouchers, setVouchers] = useState<VoucherGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherGroup | null>(
    null
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  // Fetch available vouchers
  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/vouchers");
      const data = await response.json();

      if (data.success) {
        // Group vouchers by product
        const grouped = groupVouchersByProduct(data.vouchers);
        setVouchers(grouped);
      } else {
        setError("Failed to load vouchers");
      }
    } catch (err) {
      setError("Error loading vouchers");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const groupVouchersByProduct = (voucherList: any[]) => {
    const grouped: { [key: string]: VoucherGroup } = {};
    voucherList.forEach((voucher) => {
      // Create unique key based on product name AND price
      const key = `${voucher.product_name}_${voucher.amount}_${voucher.discounted_amount}`;

      if (!grouped[key]) {
        grouped[key] = {
          product_name: voucher.product_name,
          amount: voucher.amount,
          discounted_amount: voucher.discounted_amount,
          final_price: voucher.discounted_amount || voucher.amount,
          has_discount: voucher.discounted_amount !== null,
          available_count: 0,
          image: voucher.image,
        };
      }
      grouped[key].available_count++;
    });
    return Object.values(grouped);
  };

  const handlePurchase = async () => {
    if (!selectedVoucher) {
      setError("Please select a voucher");
      return;
    }

    if (!name || name.trim().length < 2) {
      setError("Please enter your name");
      return;
    }

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      // Create payment
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: selectedVoucher.amount,
          discounted_amount: selectedVoucher.discounted_amount,
          email: email,
          name: name,
          title: `Voucher - ${selectedVoucher.product_name}`,
          product_name: selectedVoucher.product_name,
          sender_bank_type: "qris",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to payment page
        if (data.success) {
          // Ensure payment URL has protocol
          let paymentUrl = data.payment_url;
          if (
            !paymentUrl.startsWith("http://") &&
            !paymentUrl.startsWith("https://")
          ) {
            paymentUrl = "https://" + paymentUrl;
          }
          console.log("🔗 Redirecting to:", paymentUrl);
          window.location.href = paymentUrl;
        }
      } else {
        setError(data.message || "Failed to create payment");
      }
    } catch (err) {
      setError("Error processing payment");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getProductIcon = (productName: string) => {
    if (productName.toLowerCase().includes("kopi")) {
      return <Coffee className="w-12 h-12 md:w-16 md:h-16 text-amber-600" />;
    }
    return <Droplet className="w-12 h-12 md:w-16 md:h-16 text-blue-600" />;
  };

  const closeBottomSheet = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedVoucher(null);
      setIsClosing(false);
    }, 300); // Match animation duration
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
      // swipe down threshold
      closeBottomSheet();
    }
    setTouchStartY(null);
    setTouchEndY(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading vouchers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 py-6 md:py-12 px-3 md:px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-12">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-1 md:mb-2">
            Pilih Voucher Anda
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Beli voucher untuk produk favorit Anda
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
            <p className="text-sm md:text-base text-red-600">{error}</p>
          </div>
        )}

        {/* Voucher Cards - Mobile First Layout */}
        <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
          {vouchers.map((voucherGroup) => {
            const discountPercentage = voucherGroup.has_discount
              ? Math.round(
                  ((voucherGroup.amount - voucherGroup.final_price) /
                    voucherGroup.amount) *
                    100
                )
              : 0;

            const isSelected =
              selectedVoucher?.product_name === voucherGroup.product_name &&
              selectedVoucher?.amount === voucherGroup.amount;

            return (
              <div
                key={`${voucherGroup.product_name}_${voucherGroup.amount}`}
                className={`bg-white rounded-xl md:rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${
                  isSelected ? "ring-2 md:ring-4 ring-orange-500" : ""
                }`}
              >
                {/* Mobile Layout (default) */}
                <div className="block md:hidden">
                  <div className="flex">
                    {/* Product Image - Mobile */}
                    <div className="relative w-28 h-28 shrink-0">
                      {voucherGroup.image ? (
                        <div className="p-3">
                          <img
                            src={voucherGroup.image}
                            alt={voucherGroup.product_name}
                            className="w-full h-full object-cover rounded-l-xl"
                            onError={(e) => {
                              const fallback = document.createElement("div");
                              fallback.className =
                                "w-full h-full flex items-center justify-center bg-linear-to-br from-blue-100 to-indigo-100 rounded-l-xl";
                              fallback.innerHTML = voucherGroup.product_name
                                .toLowerCase()
                                .includes("kopi")
                                ? '<svg class="w-12 h-12 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>'
                                : '<svg class="w-12 h-12 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>';
                              e.currentTarget.parentElement?.replaceChild(
                                fallback,
                                e.currentTarget
                              );
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-blue-100 to-indigo-100 rounded-l-xl">
                          {getProductIcon(voucherGroup.product_name)}
                        </div>
                      )}
                      {/* Discount Badge */}
                      {voucherGroup.has_discount && (
                        <div className="absolute top-1 left-1 bg-yellow-400 text-red-600 px-2 py-0.5 rounded text-xs font-bold shadow-lg">
                          -{discountPercentage}%
                        </div>
                      )}
                    </div>

                    {/* Content - Mobile */}
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-800 capitalize leading-tight">
                          {voucherGroup.product_name}
                        </h3>

                        {voucherGroup.available_count <= 10 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-orange-600 font-bold text-xs">
                              🔥
                            </span>
                            <span className="text-orange-600 font-semibold text-xs">
                              {voucherGroup.available_count} tersisa
                            </span>
                          </div>
                        )}

                        <div className="flex items-baseline gap-2 mt-2">
                          {voucherGroup.has_discount && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatCurrency(voucherGroup.amount)}
                            </p>
                          )}
                          <p className="text-xl font-bold text-red-600">
                            {formatCurrency(voucherGroup.final_price)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedVoucher(voucherGroup)}
                        className="mt-2 bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-all duration-300"
                      >
                        Beli Sekarang 👍
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:flex items-stretch">
                  {/* Product Image - Desktop */}
                  <div className="relative w-52 shrink-0">
                    {voucherGroup.image ? (
                      <img
                        src={voucherGroup.image}
                        alt={voucherGroup.product_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const fallback = document.createElement("div");
                          fallback.className =
                            "w-full h-full flex items-center justify-center bg-linear-to-br from-blue-100 to-indigo-100";
                          fallback.innerHTML = voucherGroup.product_name
                            .toLowerCase()
                            .includes("kopi")
                            ? '<svg class="w-16 h-16 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>'
                            : '<svg class="w-16 h-16 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>';
                          e.currentTarget.parentElement?.replaceChild(
                            fallback,
                            e.currentTarget
                          );
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-blue-100 to-indigo-100">
                        {getProductIcon(voucherGroup.product_name)}
                      </div>
                    )}
                    {/* Discount Badge */}
                    {voucherGroup.has_discount && (
                      <div className="absolute top-3 left-3 bg-yellow-400 text-red-600 px-3 py-1.5 rounded-lg text-base font-bold shadow-lg">
                        -{discountPercentage}%
                      </div>
                    )}
                  </div>

                  {/* Card Content - Desktop */}
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 capitalize mb-2">
                        {voucherGroup.product_name}
                      </h3>

                      {voucherGroup.available_count <= 10 && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-orange-600 font-bold">🔥</span>
                          <span className="text-orange-600 font-semibold text-sm">
                            {voucherGroup.available_count} voucher tersisa
                          </span>
                        </div>
                      )}

                      <div className="flex items-baseline gap-3 mt-2">
                        {voucherGroup.has_discount && (
                          <p className="text-lg text-gray-400 line-through">
                            {formatCurrency(voucherGroup.amount)}
                          </p>
                        )}
                        <p className="text-3xl font-bold text-red-600">
                          {formatCurrency(voucherGroup.final_price)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Buy Button - Desktop */}
                  <div className="flex items-center pr-6">
                    <button
                      onClick={() => setSelectedVoucher(voucherGroup)}
                      className="bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-300 hover:shadow-xl whitespace-nowrap"
                    >
                      Beli Sekarang 👍
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Sheet - Detail Pembelian */}
        {selectedVoucher && (
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
                isClosing ? "opacity-0" : "opacity-70"
              }`}
              onClick={closeBottomSheet}
            />

            {/* Bottom Sheet */}
            <div
              className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
                isClosing ? "animate-slide-down" : "animate-slide-up"
              }`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Handle Bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              <div className="p-4 md:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-gray-800">
                    Detail Pembelian
                  </h3>
                  <button
                    onClick={closeBottomSheet}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="bg-gray-100 rounded-xl p-4 md:p-4 mb-4 md:mb-6">
                  <div className="flex justify-between items-center text-sm md:text-base">
                    <span className="text-gray-600">Voucher dipilih:</span>
                    <span className="font-bold text-gray-800 capitalize">
                      Voucher {selectedVoucher.product_name}
                    </span>
                  </div>

                  {selectedVoucher.has_discount ? (
                    <>
                      <div className="flex justify-between items-center mt-2 text-sm md:text-base">
                        <span className="text-gray-600">Harga:</span>
                        <div>
                          <span className="text-base md:text-lg text-gray-400 line-through">
                            {formatCurrency(selectedVoucher.amount)}
                          </span>
                          <span className="text-xl md:text-2xl font-bold text-green-600">
                            {formatCurrency(selectedVoucher.final_price)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 pb-2 pl-4 pr-4 bg-emerald-200 rounded-2xl">
                        <div className="flex justify-between items-center">
                          <span className="text-xs md:text-sm text-green-900 font-medium">
                            🎉 Anda Hemat:
                          </span>
                          <span className="text-base md:text-lg font-bold text-green-900">
                            {formatCurrency(
                              selectedVoucher.amount -
                                selectedVoucher.final_price
                            )}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-600 text-sm md:text-base">
                        Total:
                      </span>
                      <span className="text-xl md:text-2xl font-bold text-gray-800">
                        {formatCurrency(selectedVoucher.amount)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mb-4 md:mb-6">
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    Nama Anda
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm md:text-base"
                  />
                </div>

                <div className="mb-4 md:mb-6">
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    Email Anda
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh@email.com"
                    className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm md:text-base"
                  />
                  <p className="text-xs md:text-sm text-gray-500 mt-2">
                    Voucher akan dikirim ke email ini setelah pembayaran
                    berhasil
                  </p>
                </div>

                <button
                  onClick={handlePurchase}
                  disabled={isProcessing}
                  className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 md:py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm md:text-base"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                      <span>Lanjut ke Pembayaran</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {vouchers.length === 0 && !loading && (
          <div className="text-center py-12">
            <Ticket className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-sm md:text-base text-gray-600">
              Tidak ada voucher tersedia saat ini
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
