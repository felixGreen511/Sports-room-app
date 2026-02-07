import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";

const MAX_LIMIT = 100;

export const matchRouter = Router();

matchRouter.get('/', async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({error: 'Invalid query.', details: parsed.error.issues });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy((desc(matches.createdAt)))
            .limit(limit)

        res.json({ data });
    } catch (e) {
        res.status(500).json({ error: 'Failed to list matches.' });
    }
})
matchRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);
    if(!parsed.success){
        return res.status(400).json({ error: 'Invalid PayLoad..', details: JSON.stringify(parsed.error)})
    }
    const { data: { startTime, endTime, homeScore, awayScore } } = parsed;
    try {
        const [matchEvent] = await db.insert(matches).values({
            ...parsed.data, 
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime)
        }).returning();
        res.status(201).json({ data: matchEvent})
    } catch (error) {
        res.status(500).json({ error: 'Failed to Create Match', details: JSON.stringify(parsed.error)})
    }
})