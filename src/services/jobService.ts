import { db } from '../config/firebase';
import { Schedule, Job, Location } from '../utils/types';

export const generateDailyJobs = async () => {
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[today.getDay()];

    // 1. Query active schedules for today
    const schedulesSnapshot = await db.collection('schedules')
        .where('active', '==', true)
        .where('frequency', 'array-contains', dayName)
        .get();

    if (schedulesSnapshot.empty) {
        return [];
    }

    const jobsToCreate: Job[] = [];
    const batch = db.batch();

    // 2. Process schedules
    for (const doc of schedulesSnapshot.docs) {
        const schedule = doc.data() as Schedule;
        // We need to fetch location to get preferredVendorId
        // Optimization: In a real app, we might duplicate vendorId on schedule to avoid N+1 queries.
        // reliably, we should fetch location.

        // For specific requirement "The Transaction Engine"
        // "jobs collection... locationId(ref), vendorId(ref)... Financials..."

        // Fetch location
        const locationDoc = await db.collection('locations').doc(schedule.locationId).get();
        if (!locationDoc.exists) {
            console.warn(`Location ${schedule.locationId} not found for schedule ${doc.id}`);
            continue;
        }
        const location = locationDoc.data() as Location;

        // Calculate Margin
        const clientPrice = schedule.financials?.clientPrice || 0;
        const vendorPay = schedule.financials?.vendorPay || 0;
        const margin = (clientPrice - vendorPay) / (clientPrice || 1); // Avoid div/0

        const newJob: Job = {
            locationId: schedule.locationId,
            vendorId: location.preferredVendorId,
            date: new Date(), // Today
            status: 'Scheduled',
            type: 'Recurring',
            financials: {
                clientPrice,
                vendorPay,
                margin,
                calculatedMargin: margin // redundancy as per schema plan
            }
        };

        const jobRef = db.collection('jobs').doc();
        batch.set(jobRef, newJob);
        jobsToCreate.push({ ...newJob, id: jobRef.id });
    }

    await batch.commit();
    return jobsToCreate;
};
