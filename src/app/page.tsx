"use client";

import React, { useState, useEffect } from "react";
import { ShoppingCart, Loader2, X, ArrowLeft } from "lucide-react";

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
      const response = await fetch(
        "https://flip-callback.vercel.app/api/vouchers"
      );
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
      const response = await fetch(
        "https://flip-callback.vercel.app/api/create-payment",
        {
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
        }
      );

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

  const calculateDiscountPercentage = (
    original: number,
    discounted: number
  ) => {
    return Math.round(((original - discounted) / original) * 100);
  };

  const closeBottomSheet = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedVoucher(null);
      setIsClosing(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#fee9b4] to-[#fcf7e5] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#a87a0d] mx-auto mb-4" />
          <p className="text-[#543d07] font-bold">Loading vouchers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#fee9b4] to-[#fcf7e5] relative">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center gap-4 px-4 py-3 pt-11">
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-[#222223]" />
          </button>
          <h1 className="text-lg font-bold text-[#222223]">Flip Jajan</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-28 px-4 pb-24">
        {/* Limited Voucher Banner */}
        <div className="bg-linear-to-r from-[#423005] to-[#a87a0d] rounded-t-3xl px-5 py-3 shadow-lg">
          <p className="text-sm font-bold text-white">Voucher terbatas 🔥</p>
        </div>
        {/* How To Section */}
        <div className="bg-linear-to-b from-[#f7e6b7] to-[#fffbed] rounded-2xl shadow-lg p-5 mb-6">
          <div className="flex justify-between gap-2">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="relative w-[50px] h-[50px]">
                <div className="absolute inset-0 rounded-full overflow-hidden flex justify-center align-middle">
                  <img
                    decoding="auto"
                    width="1024"
                    height="1024"
                    sizes="50px"
                    src="https://framerusercontent.com/images/y6TTx6rfaJ5xlfkrw1g6mm0g.png?width=1024&amp;height=1024"
                    alt=""
                  ></img>
                  {/* <div className="w-full h-full bg-linear-to-br from-[#f7e6b7] to-[#a87a0d]" /> */}
                </div>
                <div className="absolute top-0 left-0 w-5 h-5 bg-[#a87a0d] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
              </div>
              <p className="text-[#543d07] text-xs font-bold text-center leading-tight">
                Beli Voucher
                <br />
                di Flip Jajan
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="relative w-[50px] h-[50px]">
                <div className="absolute inset-0 rounded-full overflow-hidden flex justify-center align-middle">
                  <img
                    decoding="auto"
                    width="1000"
                    height="1000"
                    sizes="45.3001px"
                    src="https://framerusercontent.com/images/DINFYg56AvrwZUe9yT4KoiAKfw.png?width=1000&amp;height=1000"
                    alt=""
                  />
                </div>
                <div className="absolute top-0 left-0 w-5 h-5 bg-[#a87a0d] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
              </div>
              <p className="text-[#543d07] text-xs font-bold text-center leading-tight">
                Dapetin Kode Voucher
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="relative w-[50px] h-[50px]">
                <div className="absolute inset-0 rounded-full overflow-hidden flex justify-center align-middle">
                  <img
                    decoding="auto"
                    width="200"
                    height="200"
                    src="https://framerusercontent.com/images/ORvX4m6oTnLLlH80vGO3NSqRSk.png?width=200&amp;height=200"
                    alt=""
                  />
                </div>
                <div className="absolute top-0 left-0 w-5 h-5 bg-[#a87a0d] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
              </div>
              <p className="text-[#543d07] text-xs font-bold text-center leading-tight">
                Tunjukkan kode Voucher di Kasir
              </p>
            </div>
          </div>
        </div>

        {/* Section Title */}
        <div className="mb-2">
          <h2 className="text-[#543d07] text-base font-bold leading-tight">
            Voucher untuk Pembelian di Outlet
          </h2>
          <p className="text-[#747474] text-xs font-semibold mt-2 leading-tight">
            Berlaku 30 hari setelah pembelian di semua outlet
            <br />
            kecuali <span className="text-[#ee255c] font-bold">
              Bandara
            </span>{" "}
            atau <span className="text-[#ee255c] font-bold">Event</span>
          </p>
        </div>

        {/* Voucher Cards */}
        <div className="flex flex-col gap-3 mt-4">
          {vouchers.map((voucher, index) => {
            const discountPercentage = voucher.has_discount
              ? calculateDiscountPercentage(voucher.amount, voucher.final_price)
              : 0;
            const isOutOfStock = voucher.available_count === 0;

            return (
              <div key={index} className="relative">
                <div className="flex items-stretch">
                  {/* Product Image Section */}
                  <div className="bg-white relative w-[102px] shrink-0 rounded-2xl overflow-hidden flex justify-center items-center">
                    {/* <div className="absolute inset-0 bg-linear-to-br from-[#f7e6b7] to-[#fffbed] rounded-bl-3xl rounded-tl-3xl rounded-tr-lg rounded-br-lg" /> */}

                    {voucher.image ? (
                      <img
                        src={voucher.image}
                        alt={voucher.product_name}
                        className={`absolute inset-2 w-20 h-23 object-contain ${
                          isOutOfStock ? "opacity-50" : ""
                        }`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className={`w-16 h-16 bg-linear-to-br from-[#a87a0d] to-[#543d07] rounded-full ${
                            isOutOfStock ? "opacity-50" : ""
                          }`}
                        />
                      </div>
                    )}

                    {/* Discount Badge */}
                    {voucher.has_discount && !isOutOfStock && (
                      <div className="absolute top-2.5 left-0 bg-[#ee255c] text-white text-[10px] font-bold px-1 py-0.5 rounded-r rounded-br rounded-tr">
                        -{discountPercentage}%
                      </div>
                    )}

                    {/* Out of Stock Badge */}
                    {isOutOfStock && (
                      <div className="absolute top-2.5 left-0 bg-[#222223] text-white text-[10px] font-bold px-1 py-0.5 rounded-r rounded-br rounded-tr">
                        -12%
                      </div>
                    )}

                    {/* Vertical Divider Line */}
                    <div className="absolute right-0 top-2.5 h-full w-0.5 bg-gray-200" />
                  </div>

                  {/* Product Details Section */}
                  <div className="bg-white flex-1 px-5 py-4 flex flex-col justify-between rounded-2xl overflow-hidden">
                    <div>
                      <h3
                        className={`text-base font-bold leading-snug line-clamp-2 ${
                          isOutOfStock ? "text-[#747474]" : "text-[#543d07]"
                        }`}
                      >
                        {voucher.product_name}
                      </h3>
                    </div>

                    <div className="flex items-end justify-between mt-4">
                      {/* Price Section */}
                      <div className="flex flex-col">
                        {voucher.has_discount && (
                          <p
                            className={`text-[10px] font-semibold line-through ${
                              isOutOfStock ? "text-[#aaabad]" : "text-[#aaabad]"
                            }`}
                          >
                            {formatCurrency(voucher.amount).replace("Rp", "Rp")}
                          </p>
                        )}
                        <div
                          className={`font-bold ${
                            isOutOfStock ? "text-[#aaabad]" : "text-[#ee255c]"
                          }`}
                        >
                          <span className="text-sm">Rp</span>
                          <span className="text-[21px]">
                            {(voucher.final_price / 1000).toFixed(0)}.000
                          </span>
                        </div>
                      </div>

                      {/* Buy Button or Out of Stock Badge */}
                      {isOutOfStock ? (
                        <div className="relative w-[60px] h-6">
                          <div className="absolute inset-0 bg-linear-to-r from-[#d4d4d4] to-[#9ca3af] rounded-full opacity-50" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white text-[10px] font-bold">
                              HABIS
                            </span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedVoucher(voucher)}
                          className="bg-[#fd6542] hover:bg-[#ff7559] text-white text-sm font-bold px-4 py-1.5 rounded-full transition-colors"
                        >
                          Beli
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Outlet Locator */}
        <div
          className="mt-6 bg-white rounded-3xl p-4 flex items-center gap-3"
          onClick={() =>
            window.open(
              "https://www.google.com/maps/search/Kopi+Kenangan/",
              "_blank"
            )
          }
        >
          <div className="w-6 h-6 shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-full h-full text-[#a87a0d]"
            >
              <path
                d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 22V12H15V22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="flex-1 text-sm font-bold text-[#222223]">
            Cek Outlet Kopi Kenangan Terdekat
          </p>
          <div className="w-6 h-6 shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-full h-full text-[#222223]"
            >
              <path
                d="M9 18L15 12L9 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="mt-6 bg-white rounded-3xl shadow-md p-5">
          <h3 className="text-lg font-bold text-[#222223] text-center mb-5">
            Ketentuan Penggunaan Voucher
          </h3>

          {/* Term 1 */}
          <div className="flex gap-2.5 mb-5">
            <div className="w-7 h-7 bg-[#a87a0d] rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">1</span>
            </div>
            <p className="text-[#747474] text-sm leading-snug">
              <span className="font-bold text-[#222223]">
                Cara beli voucher dari aplikasi Flip:{" "}
              </span>
              Klik tombol Beli Voucher pada halaman ini, lalu kamu akan
              diarahkan ke halaman pembayaran. Selesaikan pembayaran, lalu kami
              akan mengirimkan voucher. Gunakan voucher tersebut di kasir kopi
              kenangan sebelum pembayaran kopi atau roti-mu
            </p>
          </div>

          {/* Term 2 */}
          <div className="flex gap-2.5 mb-5">
            <div className="w-7 h-7 bg-[#a87a0d] rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">2</span>
            </div>
            <p className="text-[#747474] text-sm leading-snug">
              Voucher tidak dapat digunakan di aplikasi Gofood, Grabfood, atau
              aplikasi order dan delivery online lainnya.
            </p>
          </div>

          {/* Term 3 */}
          <div className="flex gap-2.5">
            <div className="w-7 h-7 bg-[#a87a0d] rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">3</span>
            </div>
            <p className="text-[#747474] text-sm leading-snug">
              Voucher dapat digunakan untuk semua produk di outlet offline kopi
              kenangan kecuali tumbler, tanpa minimum pembelian, di outlet
              manapun di Indonesia, kecuali outlet yang berlokasi di Bandara.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Sheet - Purchase Details */}
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
              isClosing ? "translate-y-full" : "translate-y-0"
            }`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Handle Bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  Detail Pembelian
                </h3>
                <button
                  onClick={closeBottomSheet}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Selected Voucher Info */}
              <div className="bg-gray-100 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Voucher dipilih:</span>
                  <span className="font-bold text-gray-800 capitalize">
                    Voucher {selectedVoucher.product_name}
                  </span>
                </div>

                {selectedVoucher.has_discount ? (
                  <>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-600 text-sm">Harga:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 line-through">
                          {formatCurrency(selectedVoucher.amount)}
                        </span>
                        <span className="text-2xl font-bold text-green-600">
                          {formatCurrency(selectedVoucher.final_price)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 pb-2 px-4 bg-emerald-200 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-900 font-medium">
                          🎉 Anda Hemat:
                        </span>
                        <span className="text-lg font-bold text-green-900">
                          {formatCurrency(
                            selectedVoucher.amount - selectedVoucher.final_price
                          )}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600 text-sm">Total:</span>
                    <span className="text-2xl font-bold text-gray-800">
                      {formatCurrency(selectedVoucher.amount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Anda
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Email Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Anda
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Voucher akan dikirim ke email ini setelah pembayaran berhasil
                </p>
              </div>

              {/* Submit Button */}
              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    <span>Lanjut ke Pembayaran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {vouchers.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600">Tidak ada voucher tersedia saat ini</p>
        </div>
      )}
    </div>
  );
}
