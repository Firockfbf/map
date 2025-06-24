create table profiles (
  id uuid default uuid_generate_v4() primary key,
  pseudo text not null,
  avatar_url text not null,
  lat double precision not null,
  lng double precision not null,
  status text default 'pending' check (status in ('pending','approved')),
  inserted_at timestamp with time zone default timezone('utc', now())
);
