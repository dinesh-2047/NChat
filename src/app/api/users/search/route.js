import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    await connectDB();

    const users = await User.find({
      username: { $regex: query.toLowerCase(), $options: 'i' },
      _id: { $ne: authUser.userId },
    })
      .select('username avatar about isOnline lastSeen')
      .limit(20);

    // Check online status based on heartbeat
    const now = new Date();
    const usersWithStatus = users.map(user => {
      const userObj = user.toObject();
      const timeSinceHeartbeat = now - new Date(user.lastSeen);
      userObj.isOnline = timeSinceHeartbeat < 30000; // 30 seconds
      return userObj;
    });

    return NextResponse.json({ users: usersWithStatus });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
