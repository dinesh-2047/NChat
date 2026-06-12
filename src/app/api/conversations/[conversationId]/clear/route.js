import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { conversationId } = await params;
    await connectDB();

    const conversation = await Conversation.findOne({ conversationId, participants: authUser.userId });
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const now = new Date();
    if (!conversation.clearedAt) conversation.clearedAt = [];
    
    const existingIndex = conversation.clearedAt.findIndex(c => c.userId.toString() === authUser.userId);

    if (existingIndex !== -1) {
      conversation.clearedAt[existingIndex].timestamp = now;
    } else {
      conversation.clearedAt.push({ userId: authUser.userId, timestamp: now });
    }

    await conversation.save();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear chat error:', error);
    return NextResponse.json({ error: 'Failed to clear chat' }, { status: 500 });
  }
}
