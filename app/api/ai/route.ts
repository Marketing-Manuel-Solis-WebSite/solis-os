import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 });
    const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(`You are Solis AI, assistant for the Law Office of Manuel Solis. Answer helpfully.\n\nQuestion: ${question}`);
    return NextResponse.json({ answer: result.response.text() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'AI failed' }, { status: 500 });
  }
}
