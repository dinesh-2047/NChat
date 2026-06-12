import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import Conversation from '@/models/Conversation';
import mongoose from 'mongoose';
import { getAuthUser } from '@/lib/auth';

const Signal = mongoose.models.Signal || mongoose.model('Signal', new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  type: { type: String, enum: ['offer', 'answer', 'ice-candidate', 'call-request', 'call-end', 'call-reject', 'call-busy', 'message-deleted'], required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  callType: { type: String, enum: ['voice', 'video'], default: 'voice' },
  consumed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 60 },
}));

export async function DELETE(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { conversationId, messageId } = await params;
    const { searchParams } = new URL(request.url);
    const deleteType = searchParams.get('type'); // 'me' or 'everyone'

    await connectDB();

    const message = await Message.findOne({ _id: messageId, conversationId });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (deleteType === 'everyone') {
      // Can only delete for everyone if user is the sender
      if (message.sender.toString() !== authUser.userId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      message.type = 'deleted';
      message.content = 'This message was deleted';
      message.fileName = '';
      await message.save();

      // Send signal to the other user to update their UI
      const conversation = await Conversation.findOne({ conversationId });
      if (conversation) {
        const otherUser = conversation.participants.find(p => p.toString() !== authUser.userId);
        if (otherUser) {
          await Signal.create({
            from: authUser.userId,
            to: otherUser.toString(),
            type: 'message-deleted',
            data: { messageId },
          });
        }
      }

    } else {
      // Delete for me
      if (!message.deletedFor.includes(authUser.userId)) {
        message.deletedFor.push(authUser.userId);
        await message.save();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
