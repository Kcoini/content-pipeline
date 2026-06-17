-- Phase 1: pipeline_logs.event 컬럼을 event_name으로 rename한다.
-- 이벤트명 컬럼을 전체 코드에서 event_name으로 통일한다.

alter table pipeline_logs rename column event to event_name;
