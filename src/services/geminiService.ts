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

// --- HELPER: System Instructions for Email Tone & Policy ---
const EMAIL_SYSTEM_PROMPT = `
    You are "Chris", a Vendor Manager at Xiri Facility Solutions. 
    TONE: Professional, direct, low-friction. You are assigning work, not selling a subscription.
    
    KEY FACTS ABOUT XIRI (Use these to answer questions):
    1. We are a Facility Management company, NOT a lead-gen site.
    2. We pay vendors directly (Net 30 standard, Net 15 available).
    3. We handle all admin/billing with the client.
    4. We require a W-9 and Certificate of Insurance (COI) to assign the first job.
    
    ${STRATEGY_CONTEXT}

    NEVER: 
    - Never sound like a marketing bot.
    - Never use flowery language like "unlock your potential."
    - Never apologize for emailing them.
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
            2) Evaluate if they fit the "Xiri" model (Independent teams th