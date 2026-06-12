import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { code } = await request.json();
    const gateCode = process.env.GATE_CODE;

    if (!code) {
      return NextResponse.json(
        { success: false, message: 'No code provided' },
        { status: 400 }
      );
    }

    if (code.toString() === gateCode) {
      const cookieStore = await cookies();
      cookieStore.set({
        name: 'nchat_gate',
        value: 'passed',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, message: 'Incorrect! Try again 🎰' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
