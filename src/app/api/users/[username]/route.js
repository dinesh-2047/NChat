import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { username } = await params;
    await connectDB();

    const user = await User.findOne({ username: username.toLowerCase() })
      .select('username avatar about isOnline lastSeen');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userObj = user.toObject();
    const timeSinceHeartbeat = Date.now() - new Date(user.lastSeen).getTime();
    userObj.isOnline = timeSinceHeartbeat < 30000;

    return NextResponse.json({ user: userObj });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}
