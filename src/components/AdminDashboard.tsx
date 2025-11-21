'use client';

import { useEffect, useState, useRef } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SalesStats {
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  pendingTransactions: number;
  expiredTransactions: number;
  cancelledTransactions: number;
  averageOrderValue: number;
  conversionRate: number;
}

interface TrafficStats {
  totalVisitors: number;
  repeatCustomers: number;
  newCustomers: number;
  totalPageViews: number;
}

interface ProductStat {
  name: string;
  sales: number;
  revenue: number;
  quantity: number;
}

interface DailyStat {
  date: string;
  total: number;
  successful: number;
  pending: number;
  expired: number;
  cancelled: number;
  revenue: number;
}

interface VoucherStats {
  totalVouchers: number;
  usedVouchers: number;
  availableVouchers: number;
  utilizationRate: number;
}

interface VoucherByProduct {
  productName: string;
  available: number;
  used: number;
  total: number;
}

interface Statistics {
  sales: SalesStats;
  traffic: TrafficStats;
  products: ProductStat[];
  daily: DailyStat[];
  vouchers: VoucherStats;
  vouchersByProduct: VoucherByProduct[];
  peakHour: number;
  hourlyDistribution: number[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('all');
  const [productDateRange, setProductDateRange] = useState({ start: '', end: '' });

  // Date filters for time-based charts (section 2 only)
  const [revenueTrendDates, setRevenueTrendDates] = useState({ start: '', end: '' });
  const [transactionStatusDates, setTransactionStatusDates] = useState({ start: '', end: '' });
  const [dailyTransactionsDates, setDailyTransactionsDates] = useState({ start: '', end: '' });

  // Helper to apply time range to all charts
  const applyTimeRangeToAllCharts = (days: number | 'all') => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];

    let startDate = '';
    if (days !== 'all') {
      const start = new Date();
      start.setDate(start.getDate() - days);
      startDate = start.toISOString().split('T')[0];
    } else {
      // For "All Time", use the earliest transaction date from data
      if (stats && stats.daily && stats.daily.length > 0) {
        const earliestDate = stats.daily[0].date.split('T')[0];
        startDate = earliestDate;
      }
    }

    setRevenueTrendDates({ start: startDate, end: endDate });
    setTransactionStatusDates({ start: startDate, end: endDate });
    setDailyTransactionsDates({ start: startDate, end: endDate });
    setProductDateRange({ start: startDate, end: endDate });

    // Refetch statistics with the new date range for product data
    if (days !== 'all') {
      fetchStatistics(startDate, endDate);
    } else {
      fetchStatistics();
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      // Build query params
      let url = `/api/admin/statistics?days=365`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const response = await fetch(url);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Helper function to filter daily data by date range
  const filterDailyData = (data: DailyStat[], startDate: string, endDate: string) => {
    if (!startDate && !endDate) return data;

    return data.filter((item) => {
      // Normalize all dates to YYYY-MM-DD format for comparison
      const itemDateStr = item.date.split('T')[0]; // Get just the date part
      const startDateStr = startDate ? startDate : null;
      const endDateStr = endDate ? endDate : null;

      // Simple string comparison works for YYYY-MM-DD format
      return (!startDateStr || itemDateStr >= startDateStr) &&
             (!endDateStr || itemDateStr <= endDateStr);
    });
  };

  // Helper function to calculate transaction stats from filtered daily data
  const calculateFilteredStats = (filteredDaily: DailyStat[]) => {
    return {
      successful: filteredDaily.reduce((sum, day) => sum + day.successful, 0),
      pending: filteredDaily.reduce((sum, day) => sum + day.pending, 0),
      expired: filteredDaily.reduce((sum, day) => sum + day.expired, 0),
      cancelled: filteredDaily.reduce((sum, day) => sum + day.cancelled, 0),
    };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="loading-spinner" style={{
          width: '60px',
          height: '60px',
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          margin: '0 auto 20px',
          animation: 'spin 1s linear infinite',
        }} />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ fontSize: '18px', color: '#667eea', fontWeight: '600' }}>Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontSize: '18px', color: '#e53e3e', fontWeight: '600' }}>Failed to load statistics</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes slideIn {
          from { transform: translateX(-10px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        marginBottom: '30px',
        animation: 'fadeIn 0.5s ease-out',
      }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px',
        }}>
          Analytics Dashboard
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Track your business performance and insights
        </p>
      </div>

      {/* Section 2: Time-Based Charts with Global Filter */}
      <div style={{ marginBottom: '50px' }}>
        {/* Time Range Selector */}
        <div style={{
          marginBottom: '30px',
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {(() => {
              // Calculate available time ranges based on actual data
              const allRanges = [
                { label: '7 Days', value: '7', days: 7, minDays: 0 },
                { label: '30 Days', value: '30', days: 30, minDays: 7 },
                { label: '60 Days', value: '60', days: 60, minDays: 30 },
                { label: '90 Days', value: '90', days: 90, minDays: 60 },
                { label: '6 Months', value: '180', days: 180, minDays: 90 },
                { label: '1 Year', value: '365', days: 365, minDays: 180 },
                { label: 'All Time', value: 'all', days: 'all' as const, minDays: 0 },
              ];

              // Calculate actual data range in days
              let dataRangeDays = 0;
              if (stats && stats.daily && stats.daily.length > 0) {
                const earliestDate = new Date(stats.daily[0].date);
                const today = new Date();
                dataRangeDays = Math.ceil((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
              }

              // Filter ranges: show a range if we have more data than its minDays requirement
              const availableRanges = allRanges.filter(range => {
                if (range.value === 'all') return true; // Always show "All Time"
                return dataRangeDays > range.minDays;
              });

              return availableRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => {
                    setSelectedTimeRange(range.value);
                    applyTimeRangeToAllCharts(range.days);
                  }}
                  style={{
                    padding: '8px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: selectedTimeRange === range.value ? '2px solid #667eea' : '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: selectedTimeRange === range.value
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'white',
                    color: selectedTimeRange === range.value ? 'white' : '#4b5563',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedTimeRange === range.value
                      ? '0 4px 12px rgba(102, 126, 234, 0.4)'
                      : '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTimeRange !== range.value) {
                      e.currentTarget.style.borderColor = '#667eea';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTimeRange !== range.value) {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    }
                  }}
                >
                  {range.label}
                </button>
              ));
            })()}
          </div>
        </div>

        {(() => {
          // Get the label for the selected time range
          const timeRangeLabel = [
            { value: '7', label: '7 Days' },
            { value: '30', label: '30 Days' },
            { value: '60', label: '60 Days' },
            { value: '90', label: '90 Days' },
            { value: '180', label: '6 Months' },
            { value: '365', label: '1 Year' },
            { value: 'all', label: 'All Time' },
          ].find(r => r.value === selectedTimeRange)?.label || 'All Time';

          return (
            <>
              {/* Daily Transactions Line Chart - Full Width */}
              <div style={{ marginBottom: '24px' }}>
                <SimpleChartCard title="📉 Daily Transactions" badge={timeRangeLabel}>
                  <DailyTransactionsChart
                    data={filterDailyData(stats.daily, dailyTransactionsDates.start, dailyTransactionsDates.end)}
                  />
                </SimpleChartCard>
              </div>

              {/* Revenue Trend and Transaction Status - Two Column Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
                gap: '24px',
              }}>
                {/* Revenue Trend Area Chart */}
                <SimpleChartCard title="📈 Revenue Trend" badge={timeRangeLabel}>
                  <RevenueAreaChart
                    data={filterDailyData(stats.daily, revenueTrendDates.start, revenueTrendDates.end)}
                  />
                </SimpleChartCard>

                {/* Transaction Status Pie */}
                <SimpleChartCard title="🎯 Transaction Status" badge={timeRangeLabel}>
                  {(() => {
                    const filteredDaily = filterDailyData(stats.daily, transactionStatusDates.start, transactionStatusDates.end);
                    const filteredStats = calculateFilteredStats(filteredDaily);
                    return (
                      <TransactionPieChart
                        successful={filteredStats.successful}
                        pending={filteredStats.pending}
                        expired={filteredStats.expired}
                        cancelled={filteredStats.cancelled}
                      />
                    );
                  })()}
                </SimpleChartCard>
              </div>
            </>
          );
        })()}
      </div>

      {/* Section 3: Product Data */}
      {stats && (() => {
        // Get the label for the selected time range
        const timeRangeLabel = [
          { value: '7', label: '7 Days' },
          { value: '30', label: '30 Days' },
          { value: '60', label: '60 Days' },
          { value: '90', label: '90 Days' },
          { value: '180', label: '6 Months' },
          { value: '365', label: '1 Year' },
          { value: 'all', label: 'All Time' },
        ].find(r => r.value === selectedTimeRange)?.label || 'All Time';

        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '24px',
            marginBottom: '40px',
          }}>
            {/* Product Performance Bar Chart */}
            <SimpleChartCard title="📊 Product Performance" badge={timeRangeLabel}>
              <ProductBarChart products={stats.products} />
            </SimpleChartCard>

            {/* Top Selling Products */}
            <SimpleChartCard title="🏆 Top Selling Products" badge={timeRangeLabel}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {stats.products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                <div>No product data available</div>
              </div>
            ) : (
              stats.products.map((product, index) => {
                const maxRevenue = Math.max(...stats.products.map(p => p.revenue));
                const widthPercent = (product.revenue / maxRevenue) * 100;

                return (
                  <div key={index} style={{
                    animation: `slideIn ${0.3 + index * 0.1}s ease-out`,
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                      alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'][index % 5]} 0%, ${['#764ba2', '#f5576c', '#00f2fe', '#38f9d7', '#fee140'][index % 5]} 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '14px',
                        }}>
                          {index + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '15px' }}>
                            {product.name}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: '13px' }}>
                            {product.quantity} sold
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: '700', color: '#10b981', fontSize: '16px' }}>
                        {formatCurrency(product.revenue)}
                      </div>
                    </div>
                    <div style={{
                      height: '12px',
                      background: '#f3f4f6',
                      borderRadius: '999px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${widthPercent}%`,
                        background: `linear-gradient(90deg, ${['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'][index % 5]} 0%, ${['#764ba2', '#f5576c', '#00f2fe', '#38f9d7', '#fee140'][index % 5]} 100%)`,
                        borderRadius: '999px',
                        transition: 'width 1s ease-out',
                        boxShadow: `0 2px 8px ${['rgba(102, 126, 234, 0.4)', 'rgba(240, 147, 251, 0.4)', 'rgba(79, 172, 254, 0.4)', 'rgba(67, 233, 123, 0.4)', 'rgba(250, 112, 154, 0.4)'][index % 5]}`,
                      }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SimpleChartCard>
          </div>
        );
      })()}

    </div>
  );
}

// Chart Card Wrapper
function ChartCard({
  title,
  children,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClearDates
}: {
  title: string;
  children: React.ReactNode;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClearDates: () => void;
}) {
  const endDateInputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '30px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      animation: 'fadeIn 0.7s ease-out',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1f2937',
          margin: 0,
        }}>
          {title}
        </h3>
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
            value={startDate}
            max={endDate ? (endDate < today ? endDate : today) : today}
            onClick={(e) => {
              e.currentTarget.showPicker();
            }}
            onChange={(e) => {
              const newStartDate = e.target.value;
              onStartDateChange(newStartDate);

              // If new start date is after current end date, clear end date
              if (newStartDate && endDate && newStartDate > endDate) {
                onEndDateChange("");
              }

              if (newStartDate && endDateInputRef.current) {
                setTimeout(() => {
                  endDateInputRef.current?.showPicker();
                }, 100);
              }
            }}
            placeholder="Tanggal Awal"
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
          <span style={{ color: "#6B7280", fontSize: "14px" }}>
            -
          </span>
          <input
            ref={endDateInputRef}
            type="date"
            value={endDate}
            min={startDate || undefined}
            max={today}
            onClick={(e) => {
              e.currentTarget.showPicker();
            }}
            onChange={(e) => onEndDateChange(e.target.value)}
            placeholder="Tanggal Akhir"
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
          {(startDate || endDate) && (
            <button
              onClick={onClearDates}
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
                e.currentTarget.style.backgroundColor =
                  "transparent";
              }}
              title="Clear dates"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// Simple Chart Card (without date filters)
function SimpleChartCard({
  title,
  children,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '30px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      animation: 'fadeIn 0.7s ease-out',
    }}>
      <h3 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        {title}
        {badge && (
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            padding: '4px 12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '6px',
          }}>
            {badge}
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

// Revenue Area Chart Component (Recharts)
function RevenueAreaChart({ data }: { data: DailyStat[] }) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#667eea" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          tickFormatter={(value) => `Rp ${(value / 1000).toFixed(0)}k`}
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          labelFormatter={formatDate}
          contentStyle={{
            backgroundColor: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          labelStyle={{
            color: '#111827',
            fontWeight: '700',
            marginBottom: '4px',
            fontSize: '14px',
          }}
          itemStyle={{
            color: '#1f2937',
            fontWeight: '600',
            fontSize: '13px',
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#667eea"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorRevenue)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Transaction Pie Chart Component (Recharts)
function TransactionPieChart({
  successful,
  pending,
  expired,
  cancelled,
}: {
  successful: number;
  pending: number;
  expired: number;
  cancelled: number;
}) {
  const total = successful + pending + expired + cancelled;

  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
        <div>No transaction data</div>
      </div>
    );
  }

  const data = [
    { name: 'Successful', value: successful, color: '#10b981' },
    { name: 'Pending', value: pending, color: '#f59e0b' },
    { name: 'Expired', value: expired, color: '#ef4444' },
    { name: 'Cancelled', value: cancelled, color: '#9ca3af' },
  ].filter(item => item.value > 0);

  const renderLabel = (entry: any) => {
    const percent = ((entry.value / total) * 100).toFixed(1);
    return `${percent}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={100}
          innerRadius={60}
          fill="#8884d8"
          dataKey="value"
          animationDuration={1000}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [value, name]}
          contentStyle={{
            backgroundColor: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          labelStyle={{
            color: '#111827',
            fontWeight: '700',
            marginBottom: '4px',
            fontSize: '14px',
          }}
          itemStyle={{
            color: '#1f2937',
            fontWeight: '600',
            fontSize: '13px',
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value, entry: any) => `${value}: ${entry.payload.value}`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Product Bar Chart Component (Recharts)
function ProductBarChart({ products }: { products: ProductStat[] }) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
        <div>No product data available</div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={products} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#667eea" stopOpacity={0.9}/>
            <stop offset="95%" stopColor="#764ba2" stopOpacity={0.9}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          tickFormatter={(value) => `Rp ${(value / 1000).toFixed(0)}k`}
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          contentStyle={{
            backgroundColor: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          labelStyle={{
            color: '#111827',
            fontWeight: '700',
            marginBottom: '4px',
            fontSize: '14px',
          }}
          itemStyle={{
            color: '#1f2937',
            fontWeight: '600',
            fontSize: '13px',
          }}
        />
        <Bar
          dataKey="revenue"
          fill="url(#colorBar)"
          radius={[8, 8, 0, 0]}
          animationDuration={1000}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Daily Transactions Line Chart Component (Recharts)
function DailyTransactionsChart({ data }: { data: DailyStat[] }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          labelFormatter={formatDate}
          contentStyle={{
            backgroundColor: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          labelStyle={{
            color: '#111827',
            fontWeight: '700',
            marginBottom: '4px',
            fontSize: '14px',
          }}
          itemStyle={{
            color: '#1f2937',
            fontWeight: '600',
            fontSize: '13px',
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="successful"
          stroke="#10b981"
          strokeWidth={2}
          name="Successful"
          animationDuration={1000}
        />
        <Line
          type="monotone"
          dataKey="pending"
          stroke="#f59e0b"
          strokeWidth={2}
          name="Pending"
          animationDuration={1000}
        />
        <Line
          type="monotone"
          dataKey="expired"
          stroke="#ef4444"
          strokeWidth={2}
          name="Expired"
          animationDuration={1000}
        />
        <Line
          type="monotone"
          dataKey="cancelled"
          stroke="#9ca3af"
          strokeWidth={2}
          name="Cancelled"
          animationDuration={1000}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

const tableHeaderStyle = {
  padding: '12px 20px',
  textAlign: 'left' as const,
  fontSize: '12px',
  fontWeight: '700' as const,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  background: '#f9fafb',
};
