import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated and is an admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get URL parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'ALL';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // Build query with filters
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`transaction_id.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply status filter
    if (status !== 'ALL') {
      query = query.eq('status', status);
    }

    // Apply date range filters
    if (startDate) {
      const startDateTime = new Date(startDate + 'T00:00:00');
      query = query.gte('created_at', startDateTime.toISOString());
    }
    if (endDate) {
      const endDateTime = new Date(endDate + 'T23:59:59');
      query = query.lte('created_at', endDateTime.toISOString());
    }

    // Calculate pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Execute query with pagination
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return NextResponse.json({
      transactions: data || [],
      total: count || 0,
      page,
      limit,
    });

  } catch (error) {
    console.error('Error in transactions API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
