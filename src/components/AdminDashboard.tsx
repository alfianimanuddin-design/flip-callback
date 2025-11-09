'use client';

import { useEffect, useState } from 'react';
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
  failedTransactions: number;
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
  failed: number;
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
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchStatistics();
  }, [timeRange]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/statistics?days=${timeRange}`);
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

      {/* Header with Time Range Filter */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        animation: 'fadeIn 0.5s ease-out',
      }}>
        <div>
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
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(parseInt(e.target.value))}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: '2px solid #e5e7eb',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            background: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            transition: 'all 0.2s',
          }}
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={365}>Last Year</option>
        </select>
      </div>

      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '40px',
        animation: 'fadeIn 0.6s ease-out',
      }}>
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(stats.sales.totalRevenue)}
          subtitle={`${stats.sales.successfulTransactions} successful`}
          icon="💰"
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          trend={`+${formatPercent(stats.sales.conversionRate)}`}
        />
        <MetricCard
          title="Avg Order Value"
          value={formatCurrency(stats.sales.averageOrderValue)}
          subtitle={`${stats.sales.totalTransactions} total orders`}
          icon="📊"
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          trend={formatPercent(stats.sales.conversionRate)}
        />
        <MetricCard
          title="Conversion Rate"
          value={formatPercent(stats.sales.conversionRate)}
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
          trend={formatPercent((stats.traffic.repeatCustomers / stats.traffic.totalVisitors) * 100)}
        />
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '24px',
        marginBottom: '40px',
      }}>
        {/* Revenue Trend Area Chart */}
        <ChartCard title="📈 Revenue Trend">
          <RevenueAreaChart data={stats.daily} />
        </ChartCard>

        {/* Transaction Status Pie */}
        <ChartCard title="🎯 Transaction Status">
          <TransactionPieChart
            successful={stats.sales.successfulTransactions}
            pending={stats.sales.pendingTransactions}
            failed={stats.sales.failedTransactions}
          />
        </ChartCard>
      </div>

      {/* Additional Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '24px',
        marginBottom: '40px',
      }}>
        {/* Product Performance Bar Chart */}
        <ChartCard title="📊 Product Performance">
          <ProductBarChart products={stats.products} />
        </ChartCard>

        {/* Daily Transactions Line Chart */}
        <ChartCard title="📉 Daily Transactions">
          <DailyTransactionsChart data={stats.daily} />
        </ChartCard>
      </div>

      {/* Top Products with Visual Bars */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        marginBottom: '40px',
        animation: 'fadeIn 0.8s ease-out',
      }}>
        <h3 style={{
          fontSize: '22px',
          fontWeight: 'bold',
          marginBottom: '24px',
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          🏆 Top Selling Products
        </h3>
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
      </div>

      {/* Voucher Inventory Table */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        marginBottom: '40px',
        animation: 'fadeIn 0.9s ease-out',
      }}>
        <h3 style={{
          fontSize: '22px',
          fontWeight: 'bold',
          marginBottom: '24px',
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          🎟️ Voucher Inventory
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            padding: '4px 12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '999px',
          }}>
            {stats.vouchers.totalVouchers} Total
          </span>
        </h3>
        {stats.vouchersByProduct.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>No vouchers in system</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Product</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Total</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Available</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Used</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Usage</th>
                </tr>
              </thead>
              <tbody>
                {stats.vouchersByProduct.map((voucher, index) => {
                  const utilizationRate = voucher.total > 0 ? (voucher.used / voucher.total) * 100 : 0;
                  const bgColor = index % 2 === 0 ? '#fafafa' : '#ffffff';

                  return (
                    <tr key={index} style={{
                      animation: `slideIn ${0.3 + index * 0.05}s ease-out`,
                    }}>
                      <td style={{
                        padding: '16px 20px',
                        borderRadius: '12px 0 0 12px',
                        background: bgColor,
                      }}>
                        <span style={{
                          fontWeight: '600',
                          color: '#1f2937',
                          fontSize: '15px',
                          textTransform: 'capitalize',
                        }}>
                          {voucher.productName}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        background: bgColor,
                        fontWeight: '700',
                        color: '#4b5563',
                      }}>
                        {voucher.total}
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        background: bgColor,
                      }}>
                        <span style={{
                          padding: '6px 16px',
                          borderRadius: '999px',
                          background: voucher.available > 0 ? 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' : '#e5e7eb',
                          color: voucher.available > 0 ? '#065f46' : '#6b7280',
                          fontWeight: '700',
                          fontSize: '14px',
                        }}>
                          {voucher.available}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        background: bgColor,
                      }}>
                        <span style={{
                          padding: '6px 16px',
                          borderRadius: '999px',
                          background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                          color: '#92400e',
                          fontWeight: '700',
                          fontSize: '14px',
                        }}>
                          {voucher.used}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        textAlign: 'right',
                        borderRadius: '0 12px 12px 0',
                        background: bgColor,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                          <div style={{
                            width: '100px',
                            height: '10px',
                            background: '#e5e7eb',
                            borderRadius: '999px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${utilizationRate}%`,
                              height: '100%',
                              background: utilizationRate > 75
                                ? 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)'
                                : utilizationRate > 50
                                ? 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)'
                                : 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
                              transition: 'width 1s ease-out',
                            }} />
                          </div>
                          <span style={{
                            fontWeight: '700',
                            color: '#4b5563',
                            fontSize: '14px',
                            minWidth: '50px',
                          }}>
                            {formatPercent(utilizationRate)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Metric Card Component
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

// Chart Card Wrapper
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
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
        marginBottom: '24px',
        color: '#1f2937',
      }}>
        {title}
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
  failed,
}: {
  successful: number;
  pending: number;
  failed: number;
}) {
  const total = successful + pending + failed;

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
    { name: 'Failed', value: failed, color: '#ef4444' },
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
          dataKey="failed"
          stroke="#ef4444"
          strokeWidth={2}
          name="Failed"
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
