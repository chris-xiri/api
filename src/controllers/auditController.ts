import { Request, Response } from 'express';
import { submitAudit } from '../services/auditService';

export const submitAuditHandler = async (req: Request, res: Response) => {
    try {
        const { jobId, rating, notes, userId } = req.body;

        if (!jobId || rating === undefined) {
            return res.status(400).json({ error: 'jobId and rating are required' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const result = await submitAudit(jobId, rating, notes || '', userId || 'system');

        return res.status(200).json({
            message: 'Audit submitted successfully',
            data: result
        });

    } catch (error) {
        console.error('Error submitting audit:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
