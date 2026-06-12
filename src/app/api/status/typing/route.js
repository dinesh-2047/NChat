import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';

// POST - Set typing status
export async function POST(request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { conversationId, isTyping } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    await connectDB();

    if (isTyping) {
      // Add or update typing status
      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          $pull: { typingUsers: { userId: authUser.userId } }
        }
      );
      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          $push: {
            typingUsers: {
              userId: authUser.userId,
              timestamp: new Date(),
            }
          }
        }
      );
    } else {
      // Remove typing status
      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          $pull: { typingUsers: { userId: authUser.userId } }
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Typing status error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// GET - Get typing status for a conversation
export async function GET(request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ typingUsers: [] });
    }

    await connectDB();

    const conversation = await Conversation.findOne({ conversationId })
      .populate('typingUsers.userId', 'username');

    if (!conversation) {
      return NextResponse.json({ typingUsers: [] });
    }

    // Filter out stale typing statuses (older than 5 seconds)
    const now = new Date();
    const activeTypers = conversation.typingUsers.filter(t => {
      const age = now - new Date(t.timestamp);
      return age < 5000 && t.userId._id.toString() !== authUser.userId;
    });

    return NextResponse.json({
      typingUsers: activeTypers.map(t => ({
        username: t.userId.username,
        userId: t.userId._id,
      })),
    });
  } catch (error) {
    console.error('Get typing error:', error);
    return NextResponse.json({ typingUsers: [] });
  }
}
