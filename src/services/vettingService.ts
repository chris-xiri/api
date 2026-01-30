import { ApifyClient } from 'apify-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { db } from '../config/firebase';

dotenv.config();

const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Performs an automated vetting scan for a vendor
 */
export const performAutomatedVetting = async (accountId: string, companyName: string, location: string) => {
    console.log(`Starting automated vetting for: ${companyName}...`);

    try {
        const searchQueries = [
            `"${companyName}" ${location} lawsuits court cases`,
            `"${companyName}" ${location} BBB complaints "Better Business Bureau"`,
            `"${companyName}" ${location} reviews complaints rip-off`
        ];

        const run = await apifyClient.actor('apify/google-search-scraper').call({
            queries: searchQueries.join('\n'),
            maxPagesPerQuery: 1,
            resultsPerPage: 5
        });

        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        const snippets = (items as any[]).map(item => ({
            title: item.title,
            description: item.description,
            url: item.url
        }));

        const prompt = `
            You are a compliance officer for a major facility management company. 
            Analyze these search results for "${companyName}" in "${location}".
            
            SEARCH RESULTS:
            ${JSON.stringify(snippets, null, 2)}
            
            Identify any:
            1. Active lawsuits or legal judgments.
            2. Patterns of consumer fraud or major BBB complaints.
            3. Regulatory violations.
            
            If none are found, state "No major legal or consumer red flags identified during initial automated vetting."
            If flags are found, be specific and concise.
            
            Format as a "VETTING REPORT: [analysis]"
        `;

        const result = await model.generateContent(prompt);
        const report = result.response.text().replace('VETTING REPORT:', '').trim();

        // Update the account with vetting notes
        await db.collection('accounts').doc(accountId).update({
            vettingNotes: report,
            updatedAt: new Date().toISOString()
        });

        return report;
    } catch (err) {
        console.error('Automated vetting failed:', err);
        return 'Vetting scan failed to complete.';
    }
};
