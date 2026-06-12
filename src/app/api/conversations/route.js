import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import { getAuthUser } from '@/lib/auth';

// GET - List all conversations for current user
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();

    const conversations = await Conversation.find({
      participants: authUser.userId,
      hiddenFor: { $ne: authUser.userId },
    })
      .populate('participants', 'username avatar isOnline lastSeen about')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv.conversationId,
          receiver: authUser.userId,
          status: { $ne: 'seen' },
        });

        const convObj = conv.toObject();
        convObj.unreadCount = unreadCount;

        // Hide last message if user cleared chat after it was sent
        const clearedRecord = conv.clearedAt?.find(c => c.userId.toString() === authUser.userId);
        if (clearedRecord?.timestamp && convObj.lastMessage) {
          if (new Date(convObj.lastMessage.createdAt) <= new Date(clearedRecord.timestamp)) {
            convObj.lastMessage = null;
          }
        }

        // Compute online status for the other participant
        const otherUser = convObj.participants.find(
          p => p._id.toString() !== authUser.userId
        );
        if (otherUser) {
          const timeSinceHeartbeat = Date.now() - new Date(otherUser.lastSeen).getTime();
          otherUser.isOnline = timeSinceHeartbeat < 30000;
        }

        return convObj;
      })
    );

    return NextResponse.json({ conversations: conversationsWithUnread });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ error: 'Failed to get conversations' }, { status: 500 });
  }
}

// POST - Create or get existing conversation
export async function POST(request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    await connectDB();

    const otherUser = await User.findOne({ username: username.toLowerCase() });
    if (!otherUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (otherUser._id.toString() === authUser.userId) {
      return NextResponse.json({ error: 'Cannot chat with yourself' }, { status: 400 });
    }

    const conversationId = Conversation.getConversationId(authUser.userId, otherUser._id);

    let conversation = await Conversation.findOne({ conversationId })
      .populate('participants', 'username avatar isOnline lastSeen about')
      .populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [authUser.userId, otherUser._id],
        conversationId,
      });
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'username avatar isOnline lastSeen about')
        .populate('lastMessage');
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
