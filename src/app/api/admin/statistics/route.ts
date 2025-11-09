import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get URL parameters for date filtering
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch all transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (transactionsError) {
      throw transactionsError;
    }

    // Fetch vouchers data
    const { data: vouchers, error: vouchersError } = await supabase
      .from('vouchers')
      .select('*');

    if (vouchersError) {
      throw vouchersError;
    }

    // Calculate sales statistics
    const salesStats = {
      totalRevenue: transactions
        ?.filter((t) => t.status === 'SUCCESSFUL')
        .reduce((sum, t) => sum + parseFloat(t.discounted_amount || t.amount || '0'), 0) || 0,
      totalTransactions: transactions?.length || 0,
      successfulTransactions: transactions?.filter((t) => t.status === 'SUCCESSFUL').length || 0,
      pendingTransactions: transactions?.filter((t) => t.status === 'PENDING').length || 0,
      failedTransactions: transactions?.filter((t) => t.status === 'CANCELLED' || t.status === 'EXPIRED').length || 0,
      averageOrderValue: 0,
      conversionRate: 0,
    };

    if (salesStats.successfulTransactions > 0) {
      salesStats.averageOrderValue = salesStats.totalRevenue / salesStats.successfulTransactions;
    }

    if (salesStats.totalTransactions > 0) {
      salesStats.conversionRate = (salesStats.successfulTransactions / salesStats.totalTransactions) * 100;
    }

    // Calculate traffic statistics
    const uniqueCustomers = new Set(transactions?.map((t) => t.email)).size;
    const repeatCustomers = transactions?.reduce((acc, t) => {
      const count = transactions.filter((tr) => tr.email === t.email).length;
      if (count > 1 && !acc.includes(t.email)) {
        acc.push(t.email);
      }
      return acc;
    }, [] as string[]).length || 0;

    const trafficStats = {
      totalVisitors: uniqueCustomers,
      repeatCustomers: repeatCustomers,
      newCustomers: uniqueCustomers - repeatCustomers,
      totalPageViews: transactions?.length || 0,
    };

    // Calculate product statistics
    const productStats = transactions
      ?.filter((t) => t.status === 'SUCCESSFUL')
      .reduce((acc, t) => {
        const product = t.product_name || 'Unknown';
        if (!acc[product]) {
          acc[product] = {
            name: product,
            sales: 0,
            revenue: 0,
            quantity: 0,
          };
        }
        acc[product].sales += 1;
        acc[product].revenue += parseFloat(t.discounted_amount || t.amount || '0');
        acc[product].quantity += 1;
        return acc;
      }, {} as Record<string, { name: string; sales: number; revenue: number; quantity: number }>);

    const topProducts = Object.values(productStats || {})
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 5);

    // Calculate daily transaction status for the last 7 days
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayTransactions = transactions?.filter((t) => {
        const createdAt = new Date(t.created_at);
        return createdAt >= date && createdAt < nextDate;
      }) || [];

      // Format date label in Jakarta timezone (add 7 hours to display)
      const jakartaDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
      const dateLabel = jakartaDate.toISOString().split('T')[0];

      dailyStats.push({
        date: dateLabel,
        total: dayTransactions.length,
        successful: dayTransactions.filter((t) => t.status === 'SUCCESSFUL').length,
        pending: dayTransactions.filter((t) => t.status === 'PENDING').length,
        failed: dayTransactions.filter((t) => t.status === 'CANCELLED' || t.status === 'EXPIRED').length,
        revenue: dayTransactions
          .filter((t) => t.status === 'SUCCESSFUL')
          .reduce((sum, t) => sum + parseFloat(t.discounted_amount || t.amount || '0'), 0),
      });
    }

    // Calculate hourly distribution (for traffic patterns)
    const hourlyDistribution = Array(24).fill(0);
    transactions?.forEach((t) => {
      const hour = new Date(t.created_at).getHours();
      hourlyDistribution[hour]++;
    });

    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));

    // Voucher statistics
    const voucherStats = {
      totalVouchers: vouchers?.length || 0,
      usedVouchers: vouchers?.filter((v) => v.used).length || 0,
      availableVouchers: vouchers?.filter((v) => !v.used).length || 0,
      utilizationRate: 0,
    };

    if (voucherStats.totalVouchers > 0) {
      voucherStats.utilizationRate = (voucherStats.usedVouchers / voucherStats.totalVouchers) * 100;
    }

    // Group available vouchers by product name
    const availableVouchersByProduct: Record<string, number> = {};
    vouchers?.filter((v: any) => !v.used).forEach((voucher: any) => {
      const productName = voucher.product_name || 'Unknown Product';
      availableVouchersByProduct[productName] = (availableVouchersByProduct[productName] || 0) + 1;
    });

    // Group used vouchers by product name
    const usedVouchersByProduct: Record<string, number> = {};
    vouchers?.filter((v: any) => v.used).forEach((voucher: any) => {
      const productName = voucher.product_name || 'Unknown Product';
      usedVouchersByProduct[productName] = (usedVouchersByProduct[productName] || 0) + 1;
    });

    // Combine all product names (both available and used)
    const allVoucherProductNames = Array.from(
      new Set([
        ...Object.keys(availableVouchersByProduct),
        ...Object.keys(usedVouchersByProduct),
      ])
    ).sort();

    // Create detailed voucher data by product
    const vouchersByProduct = allVoucherProductNames.map(productName => ({
      productName,
      available: availableVouchersByProduct[productName] || 0,
      used: usedVouchersByProduct[productName] || 0,
      total: (availableVouchersByProduct[productName] || 0) + (usedVouchersByProduct[productName] || 0),
    }));

    return NextResponse.json({
      sales: salesStats,
      traffic: trafficStats,
      products: topProducts,
      daily: dailyStats,
      vouchers: voucherStats,
      vouchersByProduct: vouchersByProduct,
      peakHour: peakHour,
      hourlyDistribution: hourlyDistribution,
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
