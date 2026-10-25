import { callRpc, userHandler } from '../_shared/handler.ts';

// Called on every app load; grants the daily visit reward at most once per UTC day.
userHandler(({ userId, admin }) => callRpc(admin, 'claim_daily_reward', userId));
