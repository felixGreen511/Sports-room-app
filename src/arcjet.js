import arcjet, { detectBot, shield, slidingWindow } from '@arcjet/node';
const arcjetKey = process.env.ARCJET_KEY;
const arcjetNode = process.env.ARCJET_MODE === 'DRY_RUN' ? 'DRY_RUN' : 'LIVE';

if (!arcjetKey) throw new Error('ARCJET_KEY is not set in .env file');

// Initialize Arcjet client fot http security monitoring
export const httpArcjet = arcjetKey ? arcjet({
    key: arcjetKey,
    rules:[
        shield({ mode: arcjetNode}),
        detectBot({ mode: arcjetNode, allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW']}),
        slidingWindow({ mode: arcjetNode, interval: '10s', max: 50 })
    ]
    
}) : null;
// Initialize Arcjet client for WebSocket security monitoring
export const wsArcjet = arcjetKey ? arcjet({
    key: arcjetKey,
    rules:[
        shield({ mode: arcjetNode}),
        detectBot({ mode: arcjetNode, allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW']}),
        slidingWindow({ mode: arcjetNode, interval: '2s', max: 5 })
    ]
}) : null;

//Protecting the Routes
export function securityMiddleware(req, res, next) {
    if (!httpArcjet) return next();
    try {
        const decision = httpArcjet.protect(req);
        if (decision.isDenied()) {
            if(decision.reason.isRateLimit()) {
            return res.status(429).json({ error: 'Too many attempts detected' });
            }
            return res.status(403).json({error: 'Forbidden'})
        }
        next();
    } catch (error) {
        console.error('Error in Arcjet security middleware:', error);
        return res.status(503).json({ error: 'Service Unavailable' });
    }
}