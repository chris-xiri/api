import { db } from '../config/firebase';
import { Job, Location } from '../utils/types';
import * as admin from 'firebase-admin'; // For field value updates if needed, but we use strict types mostly

export const submitAudit = async (jobId: string, rating: number, notes: string, userId: string) => {
    // 1. Get Job
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
        throw new Error('Job not found');
    }

    const job = jobDoc.data() as Job;

    // 2. Update Job
    await jobRef.update({
        status: 'Verified',
        'quality.auditScore': rating,
        'quality.auditNotes': notes,
        'quality.auditedBy': userId,
    });

    // 3. Recalculate Location Health Score
    if (job.locationId) {
        await updateLocationHealthScore(job.locationId);
    }

    return { jobId, status: 'Verified', rating };
};

const updateLocationHealthScore = async (locationId: string) => {
    const locationRef = db.collection('locations').doc(locationId);

    // Get all verified jobs for this location to average score
    // Limit to last 10 or 30 for recent health? Prompt says "recalculate... average rating". 
    // We'll take last 20 jobs for performance/relevancy.

    const jobsSnapshot = await db.collection('jobs')
        .where('locationId', '==', locationId)
        .where('status', '==', 'Verified')
        .orderBy('date', 'desc')
        .limit(20)
        .get();

    if (jobsSnapshot.empty) {
        return; // No verified jobs, keep existing score
    }

    let totalScore = 0;
    let count = 0;

    jobsSnapshot.forEach(doc => {
        const data = doc.data() as Job;
        if (data.quality?.auditScore) {
            totalScore += data.quality.auditScore;
            count++;
        }
    });

    const averageScore = count > 0 ? totalScore / count : 0;
    // Round to 1 decimal
    const healthScore = Math.round(averageScore * 10) / 10;

    // Update Location
    await locationRef.update({
        healthScore: healthScore
    });

    // Trigger Churn Alert
    if (healthScore < 3.5) {
        console.log(`[CHURN ALERT] Location ${locationId} Health Score dropped to ${healthScore}!`);
        // In production, send email/Slack notification here
    }
};
