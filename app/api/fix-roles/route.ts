import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ error: 'Use an offline migration for role repairs.' }, { status: 410 }); }

