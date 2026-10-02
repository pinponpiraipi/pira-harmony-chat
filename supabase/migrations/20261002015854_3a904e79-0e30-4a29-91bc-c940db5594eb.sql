ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;