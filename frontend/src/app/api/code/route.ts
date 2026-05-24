import { NextResponse, NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get('repoId');
  const filePath = searchParams.get('filePath');

  if (!repoId || !filePath) {
    return NextResponse.json({ error: 'Missing repoId or filePath' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/code?repoId=${encodeURIComponent(repoId)}&filePath=${encodeURIComponent(filePath)}`, {
      cache: 'no-store'
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error proxying code peek request:', err);
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}
