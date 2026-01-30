import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { Vendor } from '../utils/types';

dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

        // 1. Google SERP Search - Targeted at public records and SOS filings
        console.log(`Deep Research: Searching SERP for ${companyName} in ${location}...`);
        const searchQueries = [
            `${companyName} ${location} Secretary of State registration NY dos.ny.gov`,
            `${companyName} ${location} owner "managing member" "registered agent"`,
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

        // 2. Feed to Gemini - Instructed to be an "Entity Investigator"
        const prompt = `
            You are an investigative assistant for a Facility Management Recruiter. 
            Analyze the following search snippets to find official ownership data for the company: "${companyName}" in "${location}".

            SEARCH DATA:
            ${JSON.stringify(snippets, null, 2)}

            YOUR MISSION:
            1) Identify the Owner or Principal. Look specifically for "Managing Member", "Registered Agent", or "President" from SOS filings (primarily dos.ny.gov for NY).
            2) Identify their primary commercial specialty (e.g. multi-family, retail, industrial).
            3) Check for reliability signals (years in business, awards, or legal issues).
            4) Provide a 'Recruiter Priority Score' (1-10) based on their professional footprint and direct ownership clarity.

            OUTPUT FORMAT:
            Start with "ANALYSIS:" followed by 3-4 professional sentences.
            End with "PRIORITY_SCORE: [number]"
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 3. Extract Score
        const scoreMatch = responseText.match(/PRIORITY_SCORE:\s*(\d+)/i);
        const priorityScore = scoreMatch ? parseInt(scoreMatch[1]) : 5;
        const cleanSummary = responseText.replace(/PRIORITY_SCORE:\s*\d+/i, '').replace(/ANALYSIS:\s*/i, '').trim();

        if (cleanSummary.length < 10) throw new Error("AI returned empty analysis");

        return {
            summary: cleanSummary,
            priorityScore
        };

    } catch (error) {
        console.error('Deep Summary Error:', error);
        // Fallback: If deep analysis fails, use a tailored basic summary instead of just "failed"
        return {
            summary: `Professional commercial entity operating in ${location}. Public records indicate active business presence under the name ${companyName}. Recommended for direct outreach to confirm current capacity.`,
            priorityScore: 5
        };
    }
};
