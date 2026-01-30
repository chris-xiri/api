import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { Activity } from '../utils/types';

export const getActivitiesHandler = async (req: Request, res: Response) => {
    try {
        const snapshot = await db.collection('activities')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Activity[];

        return res.status(200).json({
            message: `Successfully fetched ${activities.length} activities`,
            data: activities
        });
    } catch (error) {
        console.error('Error in getActivitiesHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
