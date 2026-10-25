import { callRpc, userHandler } from '../_shared/handler.ts';

// Called every minute while the app tab is visible; tracks continuous time on site.
// `{ "leave": true }` ends the session when the user leaves the tab.
userHandler(async ({ userId, admin, req }) => {
  const body = await req.json().catch(() => ({}));
  if (body?.leave === true) {
    await callRpc(admin, 'end_activity_session', userId);
    return { ended: true };
  }
  return callRpc(admin, 'record_heartbeat', userId);
});
