import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

export async function POST() {
  try {
    const authUser = await getAuthUser();
    
    if (authUser) {
      await connectDB();
      await User.findByIdAndUpdate(authUser.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
    }

    const cookieStore = await cookies();
    cookieStore.delete('nchat_token');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
