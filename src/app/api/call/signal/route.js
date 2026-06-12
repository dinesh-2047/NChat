import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { getAuthUser } from '@/lib/auth';

// Signal schema for WebRTC signaling via polling
const SignalSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  type: { type: String, enum: ['offer', 'answer', 'ice-candidate', 'call-request', 'call-end', 'call-reject', 'call-busy', 'message-deleted'], required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  callType: { type: String, enum: ['voice', 'video'], default: 'voice' },
  consumed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 60 }, // Auto-delete after 60 seconds
});

const Signal = mongoose.models.Signal || mongoose.model('Signal', SignalSchema);

// POST - Send a signal
export async function POST(request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { to, type, data, callType } = await request.json();

    if (!to || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    await Signal.create({
      from: authUser.userId,
      to,
      type,
      data,
      callType: callType || 'voice',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signal send error:', error);
    return NextResponse.json({ error: 'Failed to send signal' }, { status: 500 });
  }
}

// GET - Poll for signals
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();

    const signals = await Signal.find({
      to: authUser.userId,
      consumed: false,
    }).sort({ createdAt: 1 });

    // Mark as consumed
    if (signals.length > 0) {
      await Signal.updateMany(
        { _id: { $in: signals.map(s => s._id) } },
        { consumed: true }
      );
    }

    return NextResponse.json({
      signals: signals.map(s => ({
        id: s._id,
        from: s.from,
        type: s.type,
        data: s.data,
        callType: s.callType,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('Signal poll error:', error);
    return NextResponse.json({ signals: [] });
  }
}

// DELETE - Clear all signals for current user
export async function DELETE() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();

    await Signal.deleteMany({
      $or: [{ from: authUser.userId }, { to: authUser.userId }],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signal clear error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
