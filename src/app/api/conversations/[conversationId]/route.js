import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';

export async function DELETE(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { conversationId } = await params;
    await connectDB();

    const conversation = await Conversation.findOne({ conversationId, participants: authUser.userId });
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    // Hide conversation from this user
    if (!conversation.hiddenFor) conversation.hiddenFor = [];
    if (!conversation.hiddenFor.includes(authUser.userId)) {
      conversation.hiddenFor.push(authUser.userId);
    }

    // Also clear chat history for this user
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
    console.error('Delete conversation error:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
