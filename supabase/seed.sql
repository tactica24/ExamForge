-- Seed initial exams + syllabi (Nigeria-first)

insert into public.exams (slug, name, country_code, description, subjects, syllabus_sources, is_active)
values
  ('waec','WAEC','NG','West African Senior School Certificate Examination (Nigeria-first).','["Mathematics","English Language","Biology","Chemistry","Physics","Economics"]','["https://www.waecnigeria.org/"]',true),
  ('jamb','JAMB','NG','Unified Tertiary Matriculation Examination (UTME) prep.','["Use of English","Mathematics","Biology","Chemistry","Physics","Government"]','["https://www.jamb.gov.ng/"]',true),
  ('ielts','IELTS','INTL','International English Language Testing System prep.','["Listening","Reading","Writing","Speaking"]','["https://www.ielts.org/"]',true),
  ('acca','ACCA','INTL','Association of Chartered Certified Accountants qualification.','["BT","MA","FA","LW","PM","TX","FR","AA","FM"]','["https://www.accaglobal.com/"]',true),
  ('ican','ICAN','NG','Institute of Chartered Accountants of Nigeria qualification.','["Foundation Level","Skills Level","Professional Level"]','["https://icanig.org/"]',true)
on conflict (slug) do update set
  name = excluded.name,
  country_code = excluded.country_code,
  description = excluded.description,
  subjects = excluded.subjects,
  syllabus_sources = excluded.syllabus_sources,
  is_active = excluded.is_active;

-- Minimal syllabi topics (expand via admin + AI ingestion)
with e as (select id, slug from public.exams)
insert into public.syllabi (exam_id, subject, topics, source_meta)
select e.id, 'Mathematics',
  '[
    {"title":"Algebra","path":"Algebra","subtopics":["Linear equations","Simultaneous equations"]},
    {"title":"Geometry","path":"Geometry","subtopics":["Angles","Triangles","Circles"]},
    {"title":"Trigonometry","path":"Trigonometry","subtopics":["Sine/Cosine/Tangent","Angles of elevation"]},
    {"title":"Statistics","path":"Statistics","subtopics":["Mean/Median/Mode","Probability basics"]}
  ]'::jsonb,
  '{"seeded":true}'::jsonb
from e where e.slug = 'jamb'
on conflict (exam_id, subject) do update set topics = excluded.topics, source_meta = excluded.source_meta, last_updated = now();

with e as (select id, slug from public.exams)
insert into public.syllabi (exam_id, subject, topics, source_meta)
select e.id, 'English Language',
  '[
    {"title":"Comprehension","path":"Comprehension","subtopics":["Main idea","Inference"]},
    {"title":"Lexis & Structure","path":"Lexis & Structure","subtopics":["Grammar","Vocabulary"]},
    {"title":"Essay Writing","path":"Essay Writing","subtopics":["Argumentative","Narrative","Expository"]}
  ]'::jsonb,
  '{"seeded":true}'::jsonb
from e where e.slug = 'waec'
on conflict (exam_id, subject) do update set topics = excluded.topics, source_meta = excluded.source_meta, last_updated = now();

with e as (select id, slug from public.exams)
insert into public.syllabi (exam_id, subject, topics, source_meta)
select e.id, 'Writing',
  '[
    {"title":"Task 1 Reports","path":"Task 1","subtopics":["Charts","Maps","Processes"]},
    {"title":"Task 2 Essays","path":"Task 2","subtopics":["Opinion","Discussion","Problem/Solution"]}
  ]'::jsonb,
  '{"seeded":true}'::jsonb
from e where e.slug = 'ielts'
on conflict (exam_id, subject) do update set topics = excluded.topics, source_meta = excluded.source_meta, last_updated = now();

