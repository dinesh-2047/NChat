import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';

// GET - Get messages for a conversation (with polling support)
export async function GET(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const after = searchParams.get('after'); // For polling - get messages after this timestamp

    await connectDB();

    // Verify user is part of this conversation
    const conversation = await Conversation.findOne({
      conversationId,
      participants: authUser.userId,
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    let query = { 
      conversationId,
      deletedFor: { $ne: authUser.userId }
    };

    const clearedRecord = conversation.clearedAt?.find(c => c.userId.toString() === authUser.userId);
    const clearedTimestamp = clearedRecord?.timestamp;

    if (after || clearedTimestamp) {
      query.createdAt = {};
      if (after && !clearedTimestamp) {
        query.createdAt.$gt = new Date(after);
      } else if (!after && clearedTimestamp) {
        query.createdAt.$gt = new Date(clearedTimestamp);
      } else {
        query.createdAt.$gt = new Date(Math.max(new Date(after).getTime(), new Date(clearedTimestamp).getTime()));
      }
    }

    const messages = await Message.find(query)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .populate('replyTo', 'content type sender')
      .sort({ createdAt: after ? 1 : -1 })
      .skip(after ? 0 : (page - 1) * limit)
      .limit(after ? 100 : limit);

    // Mark received messages as delivered
    await Message.updateMany(
      {
        conversationId,
        receiver: authUser.userId,
        status: 'sent',
      },
      { status: 'delivered' }
    );

    const total = after ? 0 : await Message.countDocuments({ conversationId });

    return NextResponse.json({
      messages: after ? messages : messages.reverse(),
      total,
      page,
      hasMore: !after && (page * limit < total),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

// POST - Send a message
export async function POST(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { conversationId } = await params;
    const body = await request.json();
    const { content, type = 'text', receiverId, fileName, fileSize, duration, replyTo } = body;

    if (!content || !receiverId) {
      return NextResponse.json(
        { error: 'Content and receiverId are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findOne({
      conversationId,
      participants: authUser.userId,
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const message = await Message.create({
      sender: authUser.userId,
      receiver: receiverId,
      conversationId,
      type,
      content,
      fileName: fileName || '',
      fileSize: fileSize || 0,
      duration: duration || 0,
      replyTo: replyTo || null,
      status: 'sent',
    });

    // Update conversation's last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    conversation.hiddenFor = [];
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .populate('replyTo', 'content type sender');

    return NextResponse.json({ message: populatedMessage }, { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
