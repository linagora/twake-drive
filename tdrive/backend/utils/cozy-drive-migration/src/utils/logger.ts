// utils/logger.ts
import pino from 'pino'

const logger = pino({
    transport: {
        target: 'pino-pretty', // Optional: makes logs human-readable
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
        },
    },
    level: process.env.LOG_LEVEL || 'info', // env-driven control
})

export default logger
