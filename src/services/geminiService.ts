import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { Vendor } from '../utils/types';

dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' }); // Or gemini-1.5-flash if available

export const summarizeVendor = async (vendorData: Partial<Vendor>): Promise<string> => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('GEMINI_API_KEY is not set. Returning placeholder.');
            return 'AI Summary unavailable: API Key missing.';
        }

        const prompt = `
      You are a facility management expert. 
      Please summarize the following vendor profile into a single, professional paragraph suitable for a facility manager to review.
      Highlight their trades, compliance status, and any potential risks or strengths.
      
      Vendor Data:
      ${JSON.stringify(vendorData, null, 2)}
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return text;
    } catch (error) {
        console.error('Error in summarizeVendor:', error);
        return 'Error generating AI summary.';
    }
};
