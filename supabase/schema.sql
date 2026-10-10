-- おさるのなあに？クイズ: オンラインランキング（Supabase の SQL Editor で1回実行する）
--
-- 仕様
-- - デイリー（JSTの日付）とマンスリー（JSTの月）に、同じプレイヤーは1件だけ。よい記録のときだけ上書き
--   → その日のハイスコアがそのままマンスリーにも入る
-- - かんたん / ふつう / むずかしい（course 1/2/3）は別のランキング
-- - 並び順: クリアした人（タイムが早い順 → バナナが多い順）→ クリアしていない人（正解数が多い順 → バナナが多い順）
-- - best_combo（さいこう れんぞく）は並び順に使わず、その期間でいちばん長い連続正解を記録する
-- - 読み取りは誰でもできる。書き込みは submit_score() だけ
-- - player_id は本人だけが知っているID。公開するのはそのハッシュ（pub_id）だけにして、なりすましを防ぐ

create extension if not exists pgcrypto;

create table if not exists public.scores (
  player_id  uuid        not null,
  pub_id     text        generated always as (encode(digest(player_id::text, 'sha256'), 'hex')) stored,
  name       text        not null check (name ~ '^[ぁ-んー]{1,8}$'),
  course     smallint    not null check (course in (1, 2, 3)),
  period     text        not null check (period in ('day', 'month')),
  period_key text        not null,
  cleared    boolean     not null,
  clear_ms   integer,
  correct    integer     not null,
  bananas    integer     not null,
  best_combo integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player_id, course, period, period_key)
);

-- あとから足した列（作成済みのテーブル用）
alter table public.scores add column if not exists best_combo integer not null default 0;

create index if not exists scores_rank_idx
  on public.scores (course, period, period_key, cleared desc, clear_ms asc, correct desc, bananas desc);

alter table public.scores enable row level security;

drop policy if exists "誰でも読める" on public.scores;
create policy "誰でも読める" on public.scores for select using (true);

-- player_id は見せない（列ごとに読み取りを許可）
revoke all on public.scores from anon, authenticated;
grant select (pub_id, name, course, period, period_key, cleared, clear_ms, correct, bananas, best_combo, updated_at)
  on public.scores to anon, authenticated;

-- a の記録が b よりよいか
create or replace function public.score_better(
  a_cleared boolean, a_ms integer, a_correct integer, a_bananas integer,
  b_cleared boolean, b_ms integer, b_correct integer, b_bananas integer
) returns boolean language sql immutable as $$
  select case
    when a_cleared <> b_cleared then a_cleared
    when a_cleared then a_ms < b_ms or (a_ms = b_ms and a_bananas > b_bananas)
    else a_correct > b_correct or (a_correct = b_correct and a_bananas > b_bananas)
  end
$$;

-- スコアを送る。きょう・こんげつの順位を返す
drop function if exists public.submit_score(uuid, text, smallint, boolean, integer, integer, integer);
drop function if exists public.submit_score(uuid, text, smallint, boolean, integer, integer, integer, integer);
create or replace function public.submit_score(
  p_player uuid, p_name text, p_course smallint,
  p_cleared boolean, p_clear_ms numeric, p_correct integer, p_bananas integer,
  p_combo integer default 0
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_day   text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM-DD');
  v_month text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
  v_goal  integer := case p_course when 1 then 50 when 2 then 55 else 60 end;
  v_period text;
  v_key   text;
  v_ranks json := '{}'::json;
  v_rank  integer;
  v_best  boolean := false;
  v_rows  integer;
begin
  -- 入力チェック（なまえはひらがな8文字まで、ありえない値ははじく）
  if p_name !~ '^[ぁ-んー]{1,8}$' then raise exception 'bad name'; end if;
  if p_course not in (1, 2, 3) then raise exception 'bad course'; end if;
  if p_correct < 0 or p_correct > 1000 or p_bananas < 0 or p_bananas > 10000000
     or p_combo < 0 or p_combo > p_correct then raise exception 'bad score'; end if;
  if p_cleared and (p_correct < v_goal or p_clear_ms is null or p_clear_ms < v_goal * 1000) then raise exception 'bad clear'; end if;
  if not p_cleared then p_clear_ms := null; end if;
  p_clear_ms := round(p_clear_ms);

  foreach v_period in array array['day', 'month'] loop
    v_key := case v_period when 'day' then v_day else v_month end;

    insert into scores as s (player_id, name, course, period, period_key, cleared, clear_ms, correct, bananas)
    values (p_player, p_name, p_course, v_period, v_key, p_cleared, p_clear_ms, p_correct, p_bananas)
    on conflict (player_id, course, period, period_key) do update
      set cleared = excluded.cleared, clear_ms = excluded.clear_ms, correct = excluded.correct,
          bananas = excluded.bananas, name = excluded.name, updated_at = now()
      where score_better(excluded.cleared, excluded.clear_ms, excluded.correct, excluded.bananas,
                         s.cleared, s.clear_ms, s.correct, s.bananas);
    get diagnostics v_rows = row_count;
    -- きょうの記録を更新した（または きょう はじめて）
    if v_period = 'day' and v_rows > 0 then v_best := true; end if;

    -- なまえを変えたときは記録が悪くても名前だけ合わせる。さいこう れんぞくは記録と別に長いほうを残す
    update scores set name = p_name, best_combo = greatest(best_combo, p_combo)
      where player_id = p_player and course = p_course and period = v_period and period_key = v_key
        and (name <> p_name or best_combo < p_combo);

    select count(*) + 1 into v_rank
      from scores o, scores me
     where me.player_id = p_player and me.course = p_course and me.period = v_period and me.period_key = v_key
       and o.course = p_course and o.period = v_period and o.period_key = v_key
       and score_better(o.cleared, o.clear_ms, o.correct, o.bananas, me.cleared, me.clear_ms, me.correct, me.bananas);
    v_ranks := (v_ranks::jsonb || jsonb_build_object(v_period, v_rank))::json;
  end loop;

  return json_build_object('day', v_ranks->'day', 'month', v_ranks->'month', 'newBest', v_best);
end
$$;

revoke all on function public.submit_score from public;
grant execute on function public.submit_score to anon, authenticated;
