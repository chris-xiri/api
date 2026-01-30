import { db } from '../config/firebase';
import { sendEmail } from './emailService';
import { Vendor } from '../utils/types';

/**
 * processDailyDrip: The daily heartbeat that sends follow-ups or marks leads as dead.
 * Finds all vendors where status === 'Outreach' and processes them based on their sequence step.
 */
export const processDailyDrip = async () => {
    console.log('[CampaignService] Starting daily drip process...');

    try {
        // 1. Find vendors in 'Outreach' status
        const snapshot = await db.collection('accounts')
            .where('status', '==', 'Outreach')
            .where('outreach.status', '==', 'active')
            .get();

        if (snapshot.empty) {
            console.log('[CampaignService] No vendors in active outreach.');
            return;
        }

        console.log(`[CampaignService] Processing ${snapshot.size} vendors...`);

        const now = new Date();
        const batch = db.batch();
        let opsCount = 0;

        // Use Promise.all to avoid serial waiting (independent network/DB calls)
        // Note: For very large sets, consider chunking or p-limit, but for this scale Promise.all is compliant.
        await Promise.all(snapshot.docs.map(async (doc) => {
            const vendor = { id: doc.id, ...doc.data() } as Vendor;
            const outreach = vendor.outreach;

            if (!outreach || !outreach.lastEmailSentAt) return;

            const lastSent = new Date(outreach.lastEmailSentAt);
            const daysSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 3600 * 24);

            // Rule: Check if lastEmailSentAt was > 2 days ago
            if (daysSinceLast < 2) return;

            let nextStep = outreach.step;
            let emailTemplate = '';

            if (outreach.step === 1) {
                // If step is 1, they got Template 1 (initial). We send Template 2 (follow_up_1).
                emailTemplate = 'follow_up_1';
                nextStep = 2;
            } else if (outreach.step === 2) {
                // If step is 2, they got Template 2. We send Template 3 (follow_up_2).
                emailTemplate = 'follow_up_2';
                nextStep = 3;
            } else if (outreach.step === 3) {
                // If step is 3, they got Template 3. Stop Sequence.
                console.log(`[CampaignService] Vendor ${vendor.id} completed sequence. Marking Unresponsive.`);
                batch.update(doc.ref, {
                    status: 'Unresponsive',
                    'outreach.status': 'completed',
                    updatedAt: now.toISOString()
                });
                opsCount++;
                return;
            } else {
                return; // Unknown step or already beyond step 3
            }

            if (emailTemplate) {
                try {
                    await sendEmail(vendor, emailTemplate);

                    const nextEmailDate = new Date();
                    nextEmailDate.setDate(now.getDate() + 3); // Schedule for monitoring/next check

                    batch.update(doc.ref, {
                        'outreach.step': nextStep,
                        'outreach.lastEmailSentAt': now.toISOString(),
                        'outreach.nextEmailAt': nextStep < 3 ? nextEmailDate.toISOString() : null,
                        updatedAt: now.toISOString()
                    });

                    // Log Activity
                    const activityRef = db.collection('activities').doc();
                    batch.set(activityRef, {
                        accountId: vendor.id,
                        type: 'email',
                        content: `Automated Drip: Sent ${emailTemplate} (Step ${outreach.step} -> ${nextStep})`,
                        createdBy: 'system',
                        createdAt: now.toISOString()
                    });

                    opsCount++;
                } catch (emailError) {
                    console.error(`[CampaignService] Failed to send email to ${vendor.id}:`, emailError);
                }
            }
        }));

        if (opsCount > 0) {
            await batch.commit();
            console.log(`[CampaignService] Committed batch updates for ${opsCount} vendors.`);
        } else {
            console.log('[CampaignService] No updates needed.');
        }

    } catch (error) {
        console.error('[CampaignService] Error in processDailyDrip:', error);
    }
};
