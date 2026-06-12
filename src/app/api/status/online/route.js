import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

// POST - Update heartbeat/online status
export async function POST() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();

    await User.findByIdAndUpdate(authUser.userId, {
      isOnline: true,
      lastSeen: new Date(),
      lastHeartbeat: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: 'Heartbeat failed' }, { status: 500 });
  }
}

// DELETE - Go offline
export async function DELETE() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();

    await User.findByIdAndUpdate(authUser.userId, {
      isOnline: false,
      lastSeen: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Offline error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
