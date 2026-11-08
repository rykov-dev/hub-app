-- Notes no longer earn coins. Coins already earned for notes stay, and the
-- 'inbox_note' reason stays allowed so their history rows remain valid.
drop trigger if exists inbox_notes_reward on public.inbox_notes;
drop function if exists public.reward_inbox_note();
