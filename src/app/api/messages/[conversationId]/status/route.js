import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getAuthUser } from '@/lib/auth';

// GET - Check status updates for sent messages
export async function GET(request, { params }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const messageIds = searchParams.get('ids');

    if (!messageIds) {
      return NextResponse.json({ statuses: {} });
    }

    await connectDB();

    const ids = messageIds.split(',');
    const messages = await Message.find({
      _id: { $in: ids },
      conversationId,
      sender: authUser.userId,
    }).select('_id status');

    const statuses = {};
    messages.forEach(msg => {
      statuses[msg._id.toString()] = msg.status;
    });

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
