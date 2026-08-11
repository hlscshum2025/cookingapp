create index if not exists cooking_logs_owner_cooked_idx
  on public.cooking_logs (owner_id, cooked_at desc);

create index if not exists import_items_owner_idx
  on public.import_items (owner_id);

create index if not exists import_items_recipe_idx
  on public.import_items (recipe_id)
  where recipe_id is not null;

create index if not exists import_items_source_video_idx
  on public.import_items (source_video_id)
  where source_video_id is not null;

create index if not exists recipe_tags_owner_idx
  on public.recipe_tags (owner_id);

create index if not exists recipe_tags_tag_idx
  on public.recipe_tags (tag_id);

create index if not exists recipe_versions_owner_idx
  on public.recipe_versions (owner_id);
