import { NextRequest, NextResponse } from 'next/server';
import { signIn } from 'next-auth/react';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // This endpoint validates credentials through NextAuth
    // The actual validation happens in the CredentialsProvider
    return NextResponse.json(
      { message: 'Use signIn from next-auth/react client-side' },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}