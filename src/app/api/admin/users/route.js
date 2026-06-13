import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !authUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();
    const pendingUsers = await User.find({ isApproved: false, isAdmin: false })
      .select('-password')
      .sort({ createdAt: -1 });

    return NextResponse.json({ users: pendingUsers });
  } catch (error) {
    console.error('Admin fetch users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
