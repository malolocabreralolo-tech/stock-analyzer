import { NextResponse } from 'next/server';
import { seedMockData } from '@/lib/seed';

export async function POST() {
  try {
    await seedMockData();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 });
  }
}
