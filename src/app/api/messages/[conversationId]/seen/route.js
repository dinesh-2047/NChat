import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getAuthUser } from '@/lib/auth';

// POST - Mark all messages in conversation as seen
export async function POST(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { conversationId } = await params;

    await connectDB();

    const result = await Message.updateMany(
      {
        conversationId,
        receiver: authUser.userId,
        status: { $ne: 'seen' },
      },
      { status: 'seen' }
    );

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Mark seen error:', error);
    return NextResponse.json({ error: 'Failed to mark as seen' }, { status: 500 });
  }
}
