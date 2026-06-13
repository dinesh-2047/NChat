import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { signToken, createAuthCookie } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    await connectDB();
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/username and password are required' },
        { status: 400 }
      );
    }

    // Check if it's the admin from .env
    const isAdminLogin = identifier === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;

    let user;

    if (isAdminLogin) {
      user = await User.findOne({ username: process.env.ADMIN_USERNAME });
      if (!user) {
        // Create admin user on the fly if it doesn't exist
        const hashedPassword = await bcrypt.hash(password, 12);
        user = await User.create({
          email: `${process.env.ADMIN_USERNAME}@admin.com`,
          username: process.env.ADMIN_USERNAME,
          password: hashedPassword,
          isApproved: true,
          isAdmin: true
        });
      } else {
        // Ensure they have admin privileges
        user.isAdmin = true;
        user.isApproved = true;
        await user.save();
      }
    } else {
      // Find user by email or username
      user = await User.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier.toLowerCase() }
        ]
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!isAdminLogin) {
      // Check password
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      // Check if approved
      if (!user.isApproved) {
        return NextResponse.json(
          { error: 'Your account is pending admin approval' },
          { status: 403 }
        );
      }
    }

    // Update online status
    user.isOnline = true;
    user.lastHeartbeat = new Date();
    await user.save();

    // Create token
    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set(createAuthCookie(token));

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        about: user.about,
        isAdmin: user.isAdmin,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
