import { Request, Response } from 'express';
import { generateDailyJobs } from '../services/jobService';

export const generateJobsHandler = async (req: Request, res: Response) => {
    try {
        // Basic security: In production, verify this is called by Cloud Scheduler (e.g. via OIDC token or dedicated header)
        // For now, we assume it's protected or internal.

        const jobs = await generateDailyJobs();

        return res.status(200).json({
            message: `Generated ${jobs.length} jobs for today`,
            data: jobs
        });
    } catch (error) {
        console.error('Error generating jobs:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
