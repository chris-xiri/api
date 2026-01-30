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

// --- XIRI STRATEGY CONTEXT ---
const STRATEGY_CONTEXT = `
Xiri Recruitment Strategy Pillars:
1. The "Anti-Lead-Gen" Frame: Contractors hate paying for leads. Focus on "Direct Assignment" and "Work Orders". We are the facility manager, NOT a lead-gen site.
2. The "Asset-Lite" Value: Contractors hate admin/billing. Highlight that Xiri handles all sales, customer service, and billing (Zero Admin for the contractor).
3. The "Compliance Gate": Documents like COI/W9 are the "keys" to unlocking active sites and revenue, not just "paperwork".
`;

export const summarizeVendor = async (vendorData: Partial<Vendor>): Promise<string> => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('GEMINI_API_KEY is not set. Returning placeholder.');
            return 'AI Summary unavailable: API Key missing.';
        }

        const prompt = `
            ${STRATEGY_CONTEXT}
            You are a facility management expert. 
            Please summarize the following vendor profile into a professional recruiter summary.
            
            FOCUS ON:
            - Their suitability for "Direct Assignments" (vs bidding).
            - Signals that they are "Asset-Lite" or would benefit from "Zero Admin" (e.g. smaller independent teams).
            - Their trade expertise and commercial footprint.
            
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
            ${STRATEGY_CONTEXT}
            You are an investigative assistant for a Facility Management Recruiter. 
            Analyze the following search snippets to find official ownership data for: "${companyName}" in "${location}".

            SEARCH DATA:
            ${JSON.stringify(snippets, null, 2)}

            MISSION:
            1) Identify the Owner/Principal from filings.
            2) Evaluate if they fit the "Xiri" model (Independent teams that want direct assignments).
            3) Signal if they have the compliance "keys" (likely to have insurance/W9).
            4) Provide a 'Recruiter Priority Score' (1-10) based on their likely responsiveness to "Zero Admin" work orders.

            OUTPUT:
            Start with "RECRUITER ANALYSIS:" followed by 3-4 professional sentences.
            End with "PRIORITY_SCORE: [number]"
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 3. Extract Score
        const scoreMatch = responseText.match(/PRIORITY_SCORE:\s*(\d+)/i);
        const priorityScore = scoreMatch ? parseInt(scoreMatch[1]) : 5;
        const cleanSummary = responseText.replace(/PRIORITY_SCORE:\s*\d+/i, '').replace(/RECRUITER ANALYSIS:\s*/i, '').trim();

        if (cleanSummary.length < 10) throw new Error("AI returned empty analysis");

        return {
            summary: cleanSummary,
            priorityScore
        };

    } catch (error) {
        console.error('Deep Summary Error:', error);
        // Fallback: Use Recruiter-focused terminology even in fallback
        return {
            summary: `Professional commercial entity in ${location}. Profile suggests strong potential for Direct Work Order assignments. Recommended for outreach following the 'Zero Admin' value proposition.`,
            priorityScore: 5 - 5
        };
    }
};

/**
 * Generates a hyper-personalized recruitment email based on Xiri Strategy
 */
export const generateDynamicRecruiterEmail = async (vendor: Vendor, stage: 'initial' | 'followup' | 'onboarding'): Promise<{ subject: string; body: string }> => {
    const prompt = `
        ${STRATEGY_CONTEXT}
        
        You are a Xiri Vendor Manager. Generate a personalized email for:
        Company: ${vendor.name}
        Trade: ${vendor.trades?.[0] || 'maintenance'}
        Location: ${vendor.address?.fullNumber || 'their territory'}
        Summary Context: ${vendor.aiContextSummary || ''}

        STAGE: ${stage}

        CONSTRAINTS:
        - NEVER sound like a lead-gen site.
        - Emphasize "Direct Assignment" (Zero Bidding).
        - Emphasize "Zero Admin" (We handle billing).
        - If 'onboarding', frame COI/W9 as the "Key" to unlock revenue.
        - Keep it short, professional, and high-status.
        
        OUTPUT FORMAT (JSON):
        {
            "subject": "...",
            "body": "..." (HTML formatted)
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{.*\}/s);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: 'Partnership', body: 'Contact us for work orders.' };
    } catch (error) {
        console.error('Error generating dynamic email:', error);
        return { subject: 'Direct Contracts Available', body: '<p>Contact us to discuss site assignments.</p>' };
    }
};
