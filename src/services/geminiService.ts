import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { Vendor } from '../utils/types';

dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Initialize Apify for SERP
const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

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
        return response.text();
    } catch (error) {
        console.error('Error in summarizeVendor:', error);
        return 'Error generating AI summary.';
    }
};

export const generateDeepVendorSummary = async (companyName: string, location: string): Promise<{ summary: string; priorityScore: number }> => {
    try {
        if (!process.env.GEMINI_API_KEY || !process.env.APIFY_API_TOKEN) {
            return { summary: 'Credentials missing for deep analysis.', priorityScore: 5 };
        }

        // 1. Google SERP Search
        console.log(`Deep Research: Searching SERP for ${companyName} in ${location}...`);
        const searchQueries = [
            `${companyName} ${location} owner history news`,
            `${companyName} ${location} commercial projects reviews`
        ];

        const searchRun = await apifyClient.actor('apify/google-search-scraper').call({
            queries: searchQueries.join('\n'),
            maxPagesPerQuery: 1,
            resultsPerPage: 5,
        });

        const { items } = await apifyClient.dataset(searchRun.defaultDatasetId).listItems();
        const snippets = (items as any[]).map(item => ({
            title: item.title,
            description: item.description,
            url: item.url
        }));

        // 2. Feed to Gemini
        const prompt = `
            Analyze this vendor for a Facility Management Recruiter using the following search results. 
            Company: ${companyName}
            Location: ${location}

            Search Results Context:
            ${JSON.stringify(snippets, null, 2)}

            Identify:
            1) Who are the key principals/owners? (If found, else specify "likely independent")
            2) What specific types of commercial projects have they done?
            3) Are there any red flags or recent news (lawsuits, awards, transitions)?
            4) Provide a 'Recruiter Priority Score' (1-10) based on their perceived scale, professional footprint, and reliability. 

            Format:
            A concise 3-4 sentence qualitative analysis. 
            On a new line, end with "PRIORITY_SCORE: [number]"
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 3. Extract Score
        const scoreMatch = responseText.match(/PRIORITY_SCORE:\s*(\d+)/i);
        const priorityScore = scoreMatch ? parseInt(scoreMatch[1]) : 5;
        const cleanSummary = responseText.replace(/PRIORITY_SCORE:\s*\d+/i, '').trim();

        return {
            summary: cleanSummary,
            priorityScore
        };

    } catch (error) {
        console.error('Deep Summary Error:', error);
        return { summary: 'Deep analysis failed. Reverting to basic profile.', priorityScore: 5 };
    }
};
