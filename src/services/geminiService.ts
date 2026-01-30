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
            priorityScore: 5
        };
    }
};

// --- AI EMAIL GENERATION ---

/**
 * Generates a cold outreach email tailored to the vendor's specific trade and location.
 */
export const draftOutreachEmail = async (vendor: Vendor, type: 'initial' | 'follow_up'): Promise<{ subject: string; body: string }> => {
    const prompt = `
        ${EMAIL_SYSTEM_PROMPT}

        TASK: Draft an email to a potential vendor.
        
        VENDOR CONTEXT:
        Name: ${vendor.name}
        Trade: ${vendor.trades?.[0] || 'Commercial Services'}
        Location: ${vendor.address?.city || 'the area'}
        Type: ${type} (If 'initial', introduce Xiri. If 'follow_up', ask if they got the last note).

        REQUIREMENT:
        - If 'initial', explain we have active sites in their area and need a local partner. Distinctly explain we are NOT selling leads.
        - If 'follow_up', keep it very short (2 sentences max). "Just bubbling this up."
        
        OUTPUT FORMAT (JSON only):
        {
            "subject": "The email subject line",
            "body": "The HTML body content (use <p> tags, keep it clean)"
        }
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const text = result.response.text();
        return JSON.parse(text);
    } catch (error) {
        console.error('Error drafting outreach email:', error);
        // Fallback if AI fails
        return {
            subject: `Contract Opportunity: ${vendor.name}`,
            body: `<p>Hi ${vendor.name}, are you taking on new commercial work orders in ${vendor.address?.city || 'the area'}? We handle all administrative tasks so you can focus on the jobs.</p>`
        };
    }
};

/**
 * Analyzes an incoming email from a vendor and drafts a reply based on their compliance status.
 */
export const draftResponseEmail = async (vendor: Vendor, incomingMessage: string): Promise<{ subject: string; body: string }> => {
    // Determine what is missing
    const missingItems = [];
    if (!vendor.compliance?.w9OnFile) missingItems.push("Form W-9");
    if (!vendor.compliance?.insuranceVerified) missingItems.push("Certificate of Insurance (COI) with General Liability");

    const prompt = `
        ${EMAIL_SYSTEM_PROMPT}

        TASK: Draft a reply to this vendor's incoming email.
        
        VENDOR STATUS:
        Name: ${vendor.name}
        Trade: ${vendor.trades?.[0]}
        Missing Compliance Items: ${missingItems.length > 0 ? missingItems.join(', ') : 'None - Fully Compliant'}
        
        INCOMING MESSAGE FROM VENDOR:
        "${incomingMessage}"

        INSTRUCTIONS:
        1. Answer their specific questions directly (e.g., about payment, location, job type).
        2. If they seem interested/positive, YOU MUST ask for the missing compliance items listed above.
        3. If they are fully compliant, propose a 10-minute onboarding call.
        4. If they are not interested, be polite and close the file.

        OUTPUT FORMAT (JSON only):
        {
            "subject": "Re: [Their Subject] (or a new relevant subject)",
            "body": "The HTML body content"
        }
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const text = result.response.text();
        return JSON.parse(text);
    } catch (error) {
        console.error('Error drafting response email:', error);
        return {
            subject: `Re: Xiri Facility Solutions`,
            body: `<p>Thanks for your note. To move forward with contract assignments, could you please send over your W-9 and COI?</p>`
        };
    }
};
