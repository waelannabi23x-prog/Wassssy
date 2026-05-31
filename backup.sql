--
-- PostgreSQL database dump
--

\restrict FsVo57bKS2h0sj5lSjHoYASJtMoS9OEEKYnnLCBD7mmRnvva63hgVxrc8D3Sq6D

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    user_id bigint NOT NULL,
    added_by bigint,
    permissions text DEFAULT 'upload,add_content'::text,
    specialty_id integer DEFAULT 0,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- Name: ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ads (
    id integer NOT NULL,
    title text NOT NULL,
    body text,
    icon text DEFAULT '📌'::text,
    link text,
    specialty_id integer,
    is_pinned integer DEFAULT 0,
    is_deleted integer DEFAULT 0,
    created_by bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    image_url text,
    color text
);


ALTER TABLE public.ads OWNER TO postgres;

--
-- Name: ads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ads_id_seq OWNER TO postgres;

--
-- Name: ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;


--
-- Name: ai_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_history (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_history OWNER TO postgres;

--
-- Name: ai_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_history_id_seq OWNER TO postgres;

--
-- Name: ai_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_history_id_seq OWNED BY public.ai_history.id;


--
-- Name: bot_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bot_states (
    uid integer NOT NULL,
    state text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bot_states OWNER TO postgres;

--
-- Name: bundle_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bundle_files (
    id bigint NOT NULL,
    bundle_id integer NOT NULL,
    file_id text NOT NULL,
    file_type text DEFAULT 'document'::text,
    title text DEFAULT ''::text,
    sort_order integer DEFAULT 0
);


ALTER TABLE public.bundle_files OWNER TO postgres;

--
-- Name: bundle_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bundle_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bundle_files_id_seq OWNER TO postgres;

--
-- Name: bundle_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bundle_files_id_seq OWNED BY public.bundle_files.id;


--
-- Name: bundles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bundles (
    id bigint NOT NULL,
    category_id integer NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    downloads integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    uploaded_by bigint DEFAULT 0,
    is_deleted integer DEFAULT 0
);


ALTER TABLE public.bundles OWNER TO postgres;

--
-- Name: bundles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bundles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bundles_id_seq OWNER TO postgres;

--
-- Name: bundles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bundles_id_seq OWNED BY public.bundles.id;


--
-- Name: cache_store; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cache_store (
    key text NOT NULL,
    value text,
    expires_at bigint
);


ALTER TABLE public.cache_store OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    subject_id integer NOT NULL,
    name text NOT NULL,
    is_deleted integer DEFAULT 0
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.channels (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    link text,
    icon text DEFAULT '📺'::text,
    color text,
    members_count integer,
    sort_order integer DEFAULT 0,
    is_deleted integer DEFAULT 0,
    created_by bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.channels OWNER TO postgres;

--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.channels_id_seq OWNER TO postgres;

--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: comment_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_likes (
    user_id bigint NOT NULL,
    comment_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.comment_likes OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id bigint NOT NULL,
    file_id integer NOT NULL,
    user_id bigint NOT NULL,
    text text NOT NULL,
    is_deleted integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    likes integer DEFAULT 0
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: downloads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.downloads (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    file_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.downloads OWNER TO postgres;

--
-- Name: downloads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.downloads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.downloads_id_seq OWNER TO postgres;

--
-- Name: downloads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.downloads_id_seq OWNED BY public.downloads.id;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorites (
    user_id bigint NOT NULL,
    file_id integer NOT NULL
);


ALTER TABLE public.favorites OWNER TO postgres;

--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    id bigint NOT NULL,
    category_id integer NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    file_id text NOT NULL,
    file_type text DEFAULT 'document'::text,
    downloads integer DEFAULT 0,
    uploaded_by bigint,
    is_deleted integer DEFAULT 0,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_size bigint DEFAULT 0
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.files_id_seq OWNER TO postgres;

--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: group_bans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_bans (
    id integer NOT NULL,
    chat_id bigint NOT NULL,
    user_id bigint NOT NULL,
    banned_by bigint,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone
);


ALTER TABLE public.group_bans OWNER TO postgres;

--
-- Name: group_bans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.group_bans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_bans_id_seq OWNER TO postgres;

--
-- Name: group_bans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.group_bans_id_seq OWNED BY public.group_bans.id;


--
-- Name: group_bot_msgs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_bot_msgs (
    id bigint NOT NULL,
    chat_id bigint NOT NULL,
    message_id bigint NOT NULL,
    sent_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.group_bot_msgs OWNER TO postgres;

--
-- Name: group_bot_msgs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.group_bot_msgs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_bot_msgs_id_seq OWNER TO postgres;

--
-- Name: group_bot_msgs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.group_bot_msgs_id_seq OWNED BY public.group_bot_msgs.id;


--
-- Name: group_chats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_chats (
    chat_id bigint NOT NULL,
    title text,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    specialty_id integer DEFAULT 0,
    notify_new_files integer DEFAULT 1,
    rules text,
    goodbye_enabled integer DEFAULT 0,
    welcome_enabled integer DEFAULT 1,
    welcome_msg text,
    welcome_photo text
);


ALTER TABLE public.group_chats OWNER TO postgres;

--
-- Name: group_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_members (
    chat_id bigint NOT NULL,
    user_id bigint NOT NULL,
    username text,
    first_name text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_members OWNER TO postgres;

--
-- Name: group_notify_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_notify_log (
    id integer NOT NULL,
    file_id integer NOT NULL,
    chat_id bigint NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_notify_log OWNER TO postgres;

--
-- Name: group_notify_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.group_notify_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_notify_log_id_seq OWNER TO postgres;

--
-- Name: group_notify_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.group_notify_log_id_seq OWNED BY public.group_notify_log.id;


--
-- Name: group_warns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_warns (
    id integer NOT NULL,
    chat_id bigint NOT NULL,
    user_id bigint NOT NULL,
    warned_by bigint,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_warns OWNER TO postgres;

--
-- Name: group_warns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.group_warns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_warns_id_seq OWNER TO postgres;

--
-- Name: group_warns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.group_warns_id_seq OWNED BY public.group_warns.id;


--
-- Name: group_welcome; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_welcome (
    chat_id bigint NOT NULL,
    image_file_id text,
    message text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_welcome OWNER TO postgres;

--
-- Name: history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.history (
    id bigint NOT NULL,
    user_id bigint,
    file_id integer,
    viewed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.history OWNER TO postgres;

--
-- Name: history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.history_id_seq OWNER TO postgres;

--
-- Name: history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.history_id_seq OWNED BY public.history.id;


--
-- Name: logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.logs (
    id bigint NOT NULL,
    user_id bigint,
    action text,
    details text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.logs OWNER TO postgres;

--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.logs_id_seq OWNER TO postgres;

--
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_templates (
    id bigint NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'text'::text,
    content text DEFAULT ''::text,
    file_id text DEFAULT ''::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.message_templates OWNER TO postgres;

--
-- Name: message_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.message_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_templates_id_seq OWNER TO postgres;

--
-- Name: message_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.message_templates_id_seq OWNED BY public.message_templates.id;


--
-- Name: million_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.million_answers (
    game_id integer NOT NULL,
    user_id bigint NOT NULL,
    answer text NOT NULL
);


ALTER TABLE public.million_answers OWNER TO postgres;

--
-- Name: million_games; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.million_games (
    id integer NOT NULL,
    chat_id bigint NOT NULL,
    owner_id bigint NOT NULL,
    owner_name text,
    state text DEFAULT 'registering'::text,
    players text DEFAULT '[]'::text,
    current_q integer DEFAULT 0,
    prize integer DEFAULT 100,
    msg_id bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    played_ids text DEFAULT '[]'::text,
    current_q_id integer
);


ALTER TABLE public.million_games OWNER TO postgres;

--
-- Name: million_games_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.million_games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.million_games_id_seq OWNER TO postgres;

--
-- Name: million_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.million_games_id_seq OWNED BY public.million_games.id;


--
-- Name: million_players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.million_players (
    session_id integer NOT NULL,
    user_id bigint NOT NULL,
    first_name text,
    username text,
    level integer DEFAULT 0,
    prize integer DEFAULT 0,
    lifelines jsonb DEFAULT '{"call": true, "skip": true, "fifty": true, "audience": true}'::jsonb,
    is_alive smallint DEFAULT 1,
    answer_time integer DEFAULT 0
);


ALTER TABLE public.million_players OWNER TO postgres;

--
-- Name: million_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.million_questions (
    id integer NOT NULL,
    question text NOT NULL,
    option_a text NOT NULL,
    option_b text NOT NULL,
    option_c text NOT NULL,
    option_d text NOT NULL,
    correct text NOT NULL,
    media_file_id text,
    media_type text,
    difficulty integer DEFAULT 1,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    used_count integer DEFAULT 0
);


ALTER TABLE public.million_questions OWNER TO postgres;

--
-- Name: million_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.million_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.million_questions_id_seq OWNER TO postgres;

--
-- Name: million_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.million_questions_id_seq OWNED BY public.million_questions.id;


--
-- Name: million_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.million_scores (
    user_id bigint NOT NULL,
    first_name text,
    username text,
    best_prize integer DEFAULT 0,
    total_games integer DEFAULT 0,
    wins integer DEFAULT 0,
    total_prize bigint DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.million_scores OWNER TO postgres;

--
-- Name: million_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.million_sessions (
    id integer NOT NULL,
    chat_id bigint NOT NULL,
    status text DEFAULT 'waiting'::text,
    current_q integer DEFAULT 0,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp without time zone
);


ALTER TABLE public.million_sessions OWNER TO postgres;

--
-- Name: million_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.million_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.million_sessions_id_seq OWNER TO postgres;

--
-- Name: million_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.million_sessions_id_seq OWNED BY public.million_sessions.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    title text,
    content text,
    media_file_id text,
    media_type text DEFAULT 'text'::text,
    url text,
    is_pinned integer DEFAULT 0,
    is_deleted integer DEFAULT 0,
    created_by bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notes OWNER TO postgres;

--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notes_id_seq OWNER TO postgres;

--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: poll_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.poll_options (
    id bigint NOT NULL,
    poll_id integer NOT NULL,
    option_text text NOT NULL,
    emoji text DEFAULT '🔵'::text,
    votes integer DEFAULT 0,
    "position" integer DEFAULT 1
);


ALTER TABLE public.poll_options OWNER TO postgres;

--
-- Name: poll_options_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.poll_options_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.poll_options_id_seq OWNER TO postgres;

--
-- Name: poll_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.poll_options_id_seq OWNED BY public.poll_options.id;


--
-- Name: poll_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.poll_votes (
    poll_id integer NOT NULL,
    option_id integer NOT NULL,
    user_id bigint NOT NULL,
    voted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.poll_votes OWNER TO postgres;

--
-- Name: polls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.polls (
    id bigint NOT NULL,
    chat_id bigint NOT NULL,
    created_by bigint,
    question text NOT NULL,
    media_file_id text,
    media_type text,
    message_id bigint,
    is_closed integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.polls OWNER TO postgres;

--
-- Name: polls_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.polls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.polls_id_seq OWNER TO postgres;

--
-- Name: polls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.polls_id_seq OWNED BY public.polls.id;


--
-- Name: ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ratings (
    user_id bigint NOT NULL,
    file_id integer NOT NULL,
    rating integer
);


ALTER TABLE public.ratings OWNER TO postgres;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id bigint NOT NULL,
    file_id integer NOT NULL,
    user_id bigint NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reports_id_seq OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- Name: required_channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.required_channels (
    id bigint NOT NULL,
    channel_id text NOT NULL,
    channel_name text,
    channel_url text,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active integer DEFAULT 1
);


ALTER TABLE public.required_channels OWNER TO postgres;

--
-- Name: required_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.required_channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.required_channels_id_seq OWNER TO postgres;

--
-- Name: required_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.required_channels_id_seq OWNED BY public.required_channels.id;


--
-- Name: scheduled_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_messages (
    id bigint NOT NULL,
    template_id integer,
    target text DEFAULT 'all'::text,
    specialty_id integer DEFAULT 0,
    send_at text,
    sent integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.scheduled_messages OWNER TO postgres;

--
-- Name: scheduled_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scheduled_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduled_messages_id_seq OWNER TO postgres;

--
-- Name: scheduled_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scheduled_messages_id_seq OWNED BY public.scheduled_messages.id;


--
-- Name: semesters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.semesters (
    id bigint NOT NULL,
    year_id integer NOT NULL,
    name text NOT NULL,
    is_deleted integer DEFAULT 0
);


ALTER TABLE public.semesters OWNER TO postgres;

--
-- Name: semesters_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.semesters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.semesters_id_seq OWNER TO postgres;

--
-- Name: semesters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.semesters_id_seq OWNED BY public.semesters.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: specialties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.specialties (
    id bigint NOT NULL,
    name text NOT NULL,
    is_deleted integer DEFAULT 0
);


ALTER TABLE public.specialties OWNER TO postgres;

--
-- Name: specialties_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.specialties_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.specialties_id_seq OWNER TO postgres;

--
-- Name: specialties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.specialties_id_seq OWNED BY public.specialties.id;


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    id bigint NOT NULL,
    semester_id integer NOT NULL,
    name text NOT NULL,
    is_deleted integer DEFAULT 0
);


ALTER TABLE public.subjects OWNER TO postgres;

--
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subjects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subjects_id_seq OWNER TO postgres;

--
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- Name: user_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_points (
    user_id bigint NOT NULL,
    total_points integer DEFAULT 0,
    downloads_count integer DEFAULT 0,
    ratings_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    streak_days integer DEFAULT 0,
    last_activity_date date,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_points OWNER TO postgres;

--
-- Name: user_specialties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_specialties (
    user_id bigint NOT NULL,
    specialty_id integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_specialties OWNER TO postgres;

--
-- Name: user_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_states (
    user_id bigint NOT NULL,
    state text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_states OWNER TO postgres;

--
-- Name: user_xp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_xp (
    user_id bigint NOT NULL,
    xp integer DEFAULT 0,
    level integer DEFAULT 1,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_xp OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    first_name text,
    last_name text,
    username text,
    is_banned integer DEFAULT 0,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_active timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    specialty_id integer,
    bio text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: years; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.years (
    id bigint NOT NULL,
    specialty_id integer NOT NULL,
    name text NOT NULL,
    is_deleted integer DEFAULT 0
);


ALTER TABLE public.years OWNER TO postgres;

--
-- Name: years_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.years_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.years_id_seq OWNER TO postgres;

--
-- Name: years_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.years_id_seq OWNED BY public.years.id;


--
-- Name: ads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);


--
-- Name: ai_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_history ALTER COLUMN id SET DEFAULT nextval('public.ai_history_id_seq'::regclass);


--
-- Name: bundle_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundle_files ALTER COLUMN id SET DEFAULT nextval('public.bundle_files_id_seq'::regclass);


--
-- Name: bundles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundles ALTER COLUMN id SET DEFAULT nextval('public.bundles_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: downloads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.downloads ALTER COLUMN id SET DEFAULT nextval('public.downloads_id_seq'::regclass);


--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: group_bans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_bans ALTER COLUMN id SET DEFAULT nextval('public.group_bans_id_seq'::regclass);


--
-- Name: group_bot_msgs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_bot_msgs ALTER COLUMN id SET DEFAULT nextval('public.group_bot_msgs_id_seq'::regclass);


--
-- Name: group_notify_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_notify_log ALTER COLUMN id SET DEFAULT nextval('public.group_notify_log_id_seq'::regclass);


--
-- Name: group_warns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_warns ALTER COLUMN id SET DEFAULT nextval('public.group_warns_id_seq'::regclass);


--
-- Name: history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.history ALTER COLUMN id SET DEFAULT nextval('public.history_id_seq'::regclass);


--
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);


--
-- Name: message_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates ALTER COLUMN id SET DEFAULT nextval('public.message_templates_id_seq'::regclass);


--
-- Name: million_games id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_games ALTER COLUMN id SET DEFAULT nextval('public.million_games_id_seq'::regclass);


--
-- Name: million_questions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_questions ALTER COLUMN id SET DEFAULT nextval('public.million_questions_id_seq'::regclass);


--
-- Name: million_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_sessions ALTER COLUMN id SET DEFAULT nextval('public.million_sessions_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: poll_options id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.poll_options ALTER COLUMN id SET DEFAULT nextval('public.poll_options_id_seq'::regclass);


--
-- Name: polls id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.polls ALTER COLUMN id SET DEFAULT nextval('public.polls_id_seq'::regclass);


--
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- Name: required_channels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.required_channels ALTER COLUMN id SET DEFAULT nextval('public.required_channels_id_seq'::regclass);


--
-- Name: scheduled_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_messages ALTER COLUMN id SET DEFAULT nextval('public.scheduled_messages_id_seq'::regclass);


--
-- Name: semesters id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.semesters ALTER COLUMN id SET DEFAULT nextval('public.semesters_id_seq'::regclass);


--
-- Name: specialties id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialties ALTER COLUMN id SET DEFAULT nextval('public.specialties_id_seq'::regclass);


--
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- Name: years id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.years ALTER COLUMN id SET DEFAULT nextval('public.years_id_seq'::regclass);


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admins (user_id, added_by, permissions, specialty_id, added_at) FROM stdin;
7596452439	5534474259	upload,view_users,add_content,broadcast	17	2026-05-02 20:56:29.420873
5663352778	5534474259	upload,add_content,view_users	8	2026-04-08 19:38:13.477107
\.


--
-- Data for Name: ads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ads (id, title, body, icon, link, specialty_id, is_pinned, is_deleted, created_by, created_at, image_url, color) FROM stdin;
2	...	...	📌	\N	\N	1	1	5534474259	2026-05-06 20:33:20.532349	\N	\N
3	ترحيب 🔥	مرحبا بكم في افضل بوت و افضل منصة لدراسة فل جازائر	📌	@Lwsss23_x1_bot	\N	1	1	5534474259	2026-05-06 22:38:28.237614	\N	\N
4	ترحيب بل جدد ❤️‍🔥	اهلا بكم في افضل منصة لدراسة فل جزائر 🔥	📌	https://t.me/lwx23	\N	1	0	5534474259	2026-05-06 22:39:50.098361	\N	\N
5	ملخص archi	ملخص شابتر 2 ارشي 	📌	content://org.telegram.messenger.provider/media/Android/data/org.telegram.messenger/files/Telegram/Telegram%20Files/archi_ch2_supplement.html	\N	0	1	5534474259	2026-05-06 22:48:35.082735	\N	\N
6	اهلا	اهلا	📌	\N	13	0	0	5534474259	2026-05-06 23:46:23.373191	\N	\N
7	اهلا	اهلا	📌	\N	13	1	0	5534474259	2026-05-06 23:47:13.795692	\N	\N
9	..	..	📌	\N	\N	0	1	5534474259	2026-05-07 00:49:39.618369	\N	\N
1	اهلا	اهلا	🥲	\N	1	0	1	5534474259	2026-05-06 19:59:43.260622	\N	\N
8	اعلا	اعلا	📌	\N	1	0	1	5534474259	2026-05-07 00:48:00.880022	\N	\N
14	رزنامة الاختبارات جامعة قالمة 8 ماي 1945	\N	📌	\N	1	0	1	5534474259	2026-05-07 22:49:09.976448	https://api.telegram.org/file/bot8633599060:AAFseuj1zenrcpaQUpb24JOKC-tIlafOW50/photos/file_9.jpg	\N
13	بلاي ليست archi	بلاي ليست مهم جدا في مادة archi 	📌	https://youtube.com/playlist?list=PLDcjPVBNQ25UsUvN9aKsrZPHTAx6zX0xT&si=fSjbSVIF-OFkZuV9	\N	1	1	5534474259	2026-05-07 18:16:44.543423	\N	\N
12	بلاي ليست logic	افضل بلاي ليست لفهم موديل logic 	📌	https://youtube.com/playlist?list=PLEjRWorvdxL6xpvIHb-cN8VrRi2B2bzj2&si=imwgez703jD5EZPT	\N	0	1	5534474259	2026-05-07 00:59:16.464552	\N	\N
11	Play listes algebra 2	افضل بلاي ليست لل algebra 2	📌	https://youtube.com/@dzairmathsacademy?si=35knsyjmyoCSPtWn	\N	0	1	5534474259	2026-05-07 00:58:39.807972	\N	\N
10	بلاي ليست les linkes listes	بلاي ليست شرح les linkesds listes 	📌	https://youtube.com/playlist?list=PLZpzLuUp9qXyWylaS9C8Z4uIKWZxQc3Cq&si=6_NOuWEoFia-Vh9j	\N	0	1	5534474259	2026-05-07 00:55:03.07178	\N	\N
15	قناة رائعة لتخصص الطب	قناة تلغرام لتخصص طب استشاراة /معلومات مفيدة / ملفات تخصص طب	📌	https://t.me/Crash_medical15	8	0	1	5534474259	2026-05-07 22:59:11.305002	https://api.telegram.org/file/bot8633599060:AAFseuj1zenrcpaQUpb24JOKC-tIlafOW50/photos/file_10.jpg	\N
16	قناة Crash Médical	كل ما تحتاجه في الطب	📌	https://t.me/Crash_medical15	8	0	0	5534474259	2026-05-08 06:18:45.221996	https://api.telegram.org/file/bot8633599060:AAFseuj1zenrcpaQUpb24JOKC-tIlafOW50/photos/file_11.jpg	\N
17	Crash Médical	كل ما تحتاجه في تخصص الطب	📌	https://t.me/Crash_medical15	8	0	1	5534474259	2026-05-08 06:22:15.574431	https://api.telegram.org/file/bot8633599060:AAFseuj1zenrcpaQUpb24JOKC-tIlafOW50/photos/file_11.jpg	\N
18	🚩🚩	\N	📌	\N	\N	0	1	5534474259	2026-05-08 11:37:14.569623	https://api.telegram.org/file/bot8633599060:AAFseuj1zenrcpaQUpb24JOKC-tIlafOW50/videos/file_13.mp4	\N
19	𓏲ּ𝄢 𝆹𝅥𝆭𝓗𝓸𝓹𝓮 𝓫𝔂 𝓱𝓪𝓭𝓳𝓮𝓻 𝆹𝅥𝆭𓏲ּ𝄢	توكيدات،  حكم،  تحفيزات كتابية و صوتية باللغات العربية الفرنسية والانجليزية ✨💓	📌	https://t.me/joularvoice	\N	0	0	5534474259	2026-05-08 20:29:07.632594	https://api.telegram.org/file/bot8633599060:AAFseuj1zenrcpaQUpb24JOKC-tIlafOW50/photos/file_14.jpg	\N
\.


--
-- Data for Name: ai_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_history (id, user_id, role, content, created_at) FROM stdin;
517	5534474259	user	اهلا اخي	2026-05-30 19:57:19.836228
518	5534474259	assistant	واه والله اهلا وسهلا، كيف حالك؟ شنو الجديد عندك؟	2026-05-30 19:57:19.836228
519	5534474259	user	كيف حالك	2026-05-30 19:57:25.968861
520	5534474259	assistant	الحمد لله مزيان، شكرا على السؤاال، وانت شنو؟ دار اليوم عندك كيف؟	2026-05-30 19:57:25.968861
521	5534474259	user	اشرحلي linked liste	2026-05-30 19:57:36.238792
522	5534474259	assistant	واه والله سؤال ذكي، وعر خويا! \nLinked List هي بنية بيانات متصلة، تتكون من عقد أو节点ات، كل عقدة تحتوي على قيمة معينة ومرجع إلى العقدة التالية في القائمة. يعني كل عقدة لها قيمة و "رابط" إلى العقدة اللي بعداها.\n\nمثلاً لو عندنا قائمة من الأسماء، كل عقدة ممكن تحتوي على اسم ومرجع إلى العقدة اللي فيها الاسم التالي. بهذا الشكل نستطيع أن نضيف أو نحذف عقدات من القائمة بسهولة، دون ما نضطر.nlتغيير كل المراجع.\n\nفي الجزائر مثلاً، ممكن نستخدم Linked List في برمجة تطبيق يسرد قائمة الطلبة في جامعة، كل عقدة تمثل طالب مع معلوماته، ومرجع إلى العقدة اللي فيها الطالب التالي. هكذا نستطيع أن نضيف أو نحذف طلبة من القائمة بسهولة.\n\nفي الملفات اللي عندنا، هناك Exercices linked listes (Algo 2) و Solutions exercices linked listes (Algo 2) اللي ممكن تساعدك في فهم Linked List أكثر.	2026-05-30 19:57:36.238792
503	8279431973	user	Skip	2026-05-24 13:21:12.89119
504	8279431973	assistant	واه والله لا مشكل، فينك؟ شنو بغيت تسأل عليه؟	2026-05-24 13:21:12.89119
505	6834163411	user	Proba	2026-05-26 01:32:02.902403
506	6834163411	assistant	واه والله، الإحتمالات هي علم رياضي مهم جدا في تحليل الظواهر العشوائية. في المجالات المختلفة مثل العلوم الطبيعية، الهندسة، الاقتصاد، و حتى في الرياضيات النظرية، نستخدم الإحتمالات لتحليل البيانات و التنبؤ بالنتائج.\n\nفي الجامعة، عندما درست الإحتمالات، تناولنا مفاهيم أساسية مثل الفضاء العيني، الأحداث العشوائية، و توزيعات الإحتمال. مثلا، توزيع البينومي، توزيع بواسون، و توزيع الطبيعي، كلها توزيعات مهمة في تحليل البيانات.\n\nواحد من الأمثلة البسيطة هو رمي عملة معدنية. عند رمي العملة، هناك حالتين فقط: إما ظهرت الوجه أو ظهرت الذيل. الإحتمال هنا هو 1/2 أو 50% لِكُل حالة. هذا مثال بسيط، لكنه يوضح كيف نستخدم الإحتمالات في تحليل الظواهر العشوائية.\n\nفي التطبيقات العملية، مثل في مجال الهندسة و الاقتصاد، نستخدم الإحتمالات لتحليل المخاطر و تقييم النتائج المحتملة. مثلا، في مشروع بناء، نستخدم الإحتمالات لتحديد المخاطر المحتملة و كيفية التغلب عليها.\n\nواعر خويا، الإحتمالات هي أداة قوية في تحليل البيانات و التنبؤ بالنتائج، و لها تطبيقات واسعة في مختلف المجالات.	2026-05-26 01:32:02.902403
523	5534474259	user	اهلا	2026-05-30 20:03:37.985432
524	5534474259	assistant	واه والله اهلا وسهلا، كيف حالك؟ شنو الجديد عندك؟ دار اليوم عندك كيف؟	2026-05-30 20:03:37.985432
525	5534474259	user	اعطيني algo 2	2026-05-30 20:04:08.879874
526	5534474259	assistant	واه والله مزيان، algo 2 هي مادة في قسم الحاسوب، تتكلم على الخوارزميات وتركيبها.\n\nفي algo 2، نتعلم على أساسيات الخوارزميات، مثل تعريف الخوارزمية، أنواع الخوارزميات، و كيف نكتب الخوارزميات.\n\nكمان نتعلم على структур البيانات المختلفة، مثل القوائم المرتبطة (linked lists)، القوائم المزدوجة (doubly linked lists)، و القوائم الدائرية (circular linked lists).\n\nو كمان نتعلم على خوارزميات البحث و الترتيب، مثل خوارزمية البحث الخطي (linear search) و خوارزمية الترتيب السريع (quick sort).\n\nفي الملفات اللي عندنا، هناك_exercices algo 2 و solutions exercices algo 2 اللي ممكن تساعدك في فهم المادة أكثر.\n\nو إذا كنت تريد أن تتعلم أكثر، ممكن أشرح لك على بعض النقاط اللي تريد، واعر خويا!	2026-05-30 20:04:08.879874
515	5534474259	user	كيف حاالك	2026-05-30 19:54:34.081033
516	5534474259	assistant	الحمد لله مزيان، وانت شنو؟ كيف دار اليوم عندك؟	2026-05-30 19:54:34.081033
\.


--
-- Data for Name: bot_states; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bot_states (uid, state, updated_at) FROM stdin;
\.


--
-- Data for Name: bundle_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bundle_files (id, bundle_id, file_id, file_type, title, sort_order) FROM stdin;
1	1	BQACAgQAAyEFAATW-PBcAAICxWnM3fzF4BHOgCbnhlFd8H6z-kDZAAJZJQACLB_gULOJzbxSKD5HOgQ	document	Les-systÃ¨mes-linÃ©aires-Sol-TD.pdf	0
2	1	BQACAgQAAyEFAATW-PBcAAICxmnM3fxxFJ0s3dIIFoHd-I1gml5kAAJaJQACLB_gUP0Z-Pae1gxCOgQ	document	TD-espaces-de-dimension-finie.pdf	0
3	1	BQACAgQAAyEFAATW-PBcAAICx2nM3fyxAAE5CYK_AVW9e-6pzSlk9AAC0B4AAgx8kVHnLkhHL7o7zToE	document	Les-espaces-de-dimension-finie.pdf	0
4	2	BQACAgQAAxkBAAIWr2nNHsFxLoywPnKKYzih4GkiF1JfAAJgHQAC5AtoUK1NaPXX3SJGOgQ	document	Les-systèmes-linéaires.pdf	0
5	2	BQACAgQAAxkBAAIWsGnNHsEsM34qVAHRH9SZkvgM8fbkAAJhHQAC5AtoUFxdopoG0SXSOgQ	document	Les-systèmes-linéaire-TD.pdf	0
6	2	BQACAgQAAxkBAAIWsWnNHsEDfM7IWzOWF0rxg7cZsBEOAAJiHQAC5AtoUAN2TiwkSREMOgQ	document	Espaces-vectoriels.pdf	0
7	2	BQACAgQAAxkBAAIWsmnNHsEz_vwW_FZaHKv8AzU-tC60AAJjHQAC5AtoUDSg1lcT2u7KOgQ	document	TD-espaces-vectoriels.pdf	0
8	2	BQACAgQAAxkBAAIWs2nNHsEBI_ckIv-DlkmFrUro0QLlAAK0HAACHIuoUIMQVGxb0ermOgQ	document	Espaces-vectoriels (1).pdf	0
9	3	AgACAgQAAyEFAATW-PBcAAID4mnNdYfbd730b9lKc6cDaiHep59WAAI9C2sb7b0pUPVXNZvrR8yOAQADAgADeQADOgQ	photo		0
10	3	AgACAgQAAyEFAATW-PBcAAID42nNdYdeYwqSOo2vP9WFr_7cRPUaAAI-C2sb7b0pUD1-S0xujAdkAQADAgADeQADOgQ	photo		0
11	3	AgACAgQAAyEFAATW-PBcAAID5GnNdYcDmoDej0AcmXp7XApMJbTKAAI_C2sb7b0pULkEiLC5DZ6nAQADAgADeQADOgQ	photo		0
12	3	AgACAgQAAyEFAATW-PBcAAID5WnNdYegMQFR04OV8Omw8IYAAW0RNAACQAtrG-29KVBBiig6pKPHhQEAAwIAA3kAAzoE	photo		0
13	3	AgACAgQAAyEFAATW-PBcAAID5mnNdYccrX2pTu_L9Xx1O32QRmF5AAJBC2sb7b0pUHVJTMyhf7TYAQADAgADeQADOgQ	photo		0
14	3	AgACAgQAAyEFAATW-PBcAAID52nNdYdDnOfFW_Q6b1M8LNEjycKqAAJCC2sb7b0pUJZK4e_hDBFWAQADAgADeQADOgQ	photo		0
15	3	AgACAgQAAyEFAATW-PBcAAID6GnNdYfX940rfDUnZyHNkhXp_ZKjAAJDC2sb7b0pUAHNRZOThKxBAQADAgADeQADOgQ	photo		0
16	4	AgACAgQAAyEFAATW-PBcAAID9GnNddbGsrWybmgxRETq1bN-H9Y-AAI8C2sb28_JUWAJINT8tD_FAQADAgADeQADOgQ	photo		0
17	4	AgACAgQAAyEFAATW-PBcAAID9WnNddZHsyQqEno-YD0Xdiu5VE7zAAI-C2sb28_JUSVLqW3dvK8RAQADAgADeQADOgQ	photo		0
18	4	AgACAgQAAyEFAATW-PBcAAID9mnNddYjpj7KV5WEa7co-Mqik43yAAI_C2sb28_JUZyDp8QliGRAAQADAgADeQADOgQ	photo		0
19	4	AgACAgQAAyEFAATW-PBcAAID92nNddZtUv-yFbUxNgm6etNdZ9LAAAJAC2sb28_JUUaPk_22pibCAQADAgADeQADOgQ	photo		0
20	5	AgACAgQAAyEFAATW-PBcAAIEBWnNdkYH0XauQb9RPdjXwuN0YOzxAAICC2sbw8J4Uj-RdC2y1jyZAQADAgADeQADOgQ	photo		0
21	5	AgACAgQAAyEFAATW-PBcAAIEBmnNdkY58Q_jlcpLZ6LzcceBccZvAAIDC2sbw8J4Ukh1LOkxkmfsAQADAgADeQADOgQ	photo		0
22	5	AgACAgQAAyEFAATW-PBcAAIEB2nNdkYkNeR0rBn-lLuvr5KVIUgJAAIEC2sbw8J4UuhTopeUl7kbAQADAgADeQADOgQ	photo		0
23	5	AgACAgQAAyEFAATW-PBcAAIECGnNdkbN4st7aa3pzE-spNde4a4MAAIFC2sbw8J4Ui6RiMf_0KKuAQADAgADeQADOgQ	photo		0
24	5	AgACAgQAAyEFAATW-PBcAAIECWnNdka2ScxNIn7Mmw_JfOyg7G7AAAIGC2sbw8J4UtR29z-zNEM2AQADAgADeQADOgQ	photo		0
25	5	AgACAgQAAyEFAATW-PBcAAIECmnNdkYU9BUmmC8ruqSkAAH5u00uhAACBwtrG8PCeFL6SoRTLsjJ4QEAAwIAA3kAAzoE	photo		0
26	5	AgACAgQAAyEFAATW-PBcAAIEC2nNdkb3wTKyxhXy7B3BgqE16yzRAAIIC2sbw8J4UgXE4GRhejF5AQADAgADeQADOgQ	photo		0
27	5	AgACAgQAAyEFAATW-PBcAAIEDGnNdkaCU9e313BBjGMR6keKXborAAIJC2sbw8J4Uj4GDqi6sTcqAQADAgADeQADOgQ	photo		0
28	6	AgACAgQAAyEFAATW-PBcAAIEIGnNdtdlU6E2a96Jgx4AAaPeVzplxwACAgtrG6hL-FJxyDknSgO1bwEAAwIAA3kAAzoE	photo		0
29	6	AgACAgQAAyEFAATW-PBcAAIEIWnNdtf16J78KUAvjMq_8PJN340FAAIBC2sbqEv4UqfC3YyNoHIXAQADAgADeQADOgQ	photo		0
30	6	AgACAgQAAyEFAATW-PBcAAIEImnNdtePVGE__Ww1kxYhTo60eIyMAAIDC2sbqEv4UuJdCkDsmOqNAQADAgADeQADOgQ	photo		0
31	8	BQACAgQAAxkBAAITSWnMXEgdpsVWeYSKiHczv05HYclVAAIbHgACjj5RUMgTQGCXUwurOgQ	document	Chapter1.pdf	0
32	8	BQACAgQAAxkBAAITS2nMXEi72-thA5WBa6qwi_BAEsI9AAILHAACzmLYUrIkJlW0WdZJOgQ	document	Chapter 5 Machine Structure 2025 (1).pdf	0
33	8	BQACAgQAAyEFAATW-PBcAAIEaGnNfy43mXPu4-NRpuyJdfTY8ck8AAIMHAACzmLYUjH7g5OaqDvFOgQ	document	Chapter 2 Machine Structure 2025 (1).pdf	0
34	8	BQACAgQAAxkBAAITTGnMXEi03CaQoAf_8VE-81vLHuO4AAINHAACzmLYUqOlLJ4vMSGmOgQ	document	Chapter 4 Machine Structure 2025 (1).pdf	0
35	8	BQACAgQAAxkBAAITTWnMXEiUx7zmfM5cc2xJdrR82zKJAAIOHAACzmLYUvTtNWxjH7mnOgQ	document	Chapter 3 Machine Structure 2025 (2).pdf	0
36	8	BQACAgQAAyEFAATW-PBcAAIEa2nNfy69dlpeJbUipMJdZSoFRE4eAAIPHAACzmLYUrNk36M62lN6OgQ	document	Chapter 1 Machine structure 2025 (1).pdf	0
37	9	BQACAgQAAxkBAAITSWnMXEgdpsVWeYSKiHczv05HYclVAAIbHgACjj5RUMgTQGCXUwurOgQ	document	Chapter1.pdf	0
38	9	BQACAgQAAxkBAAITS2nMXEi72-thA5WBa6qwi_BAEsI9AAILHAACzmLYUrIkJlW0WdZJOgQ	document	Chapter 5 Machine Structure 2025 (1).pdf	0
39	9	BQACAgQAAyEFAATW-PBcAAIEaGnNfy43mXPu4-NRpuyJdfTY8ck8AAIMHAACzmLYUjH7g5OaqDvFOgQ	document	Chapter 2 Machine Structure 2025 (1).pdf	0
40	9	BQACAgQAAxkBAAITTGnMXEi03CaQoAf_8VE-81vLHuO4AAINHAACzmLYUqOlLJ4vMSGmOgQ	document	Chapter 4 Machine Structure 2025 (1).pdf	0
41	9	BQACAgQAAxkBAAITTWnMXEiUx7zmfM5cc2xJdrR82zKJAAIOHAACzmLYUvTtNWxjH7mnOgQ	document	Chapter 3 Machine Structure 2025 (2).pdf	0
42	9	BQACAgQAAyEFAATW-PBcAAIEa2nNfy69dlpeJbUipMJdZSoFRE4eAAIPHAACzmLYUrNk36M62lN6OgQ	document	Chapter 1 Machine structure 2025 (1).pdf	0
43	11	BQACAgQAAxkBAAIS7mnMWCrWhdAzyGns3IHY9onwdNtfAAIqGgAC7b0pUDIoGfkGF_0rOgQ	document	Chapter 3 (1).pdf	0
44	11	BQACAgQAAxkBAAIS9WnMWIXFGEefOLsvq3IPp1jhelfKAAIrGgAC7b0pUP3haeqMcqqdOgQ	document	Chapter 4.pdf	0
45	11	BQACAgQAAxkBAAIS_GnMWJtS408p3CXjyg7nrgngTW-MAAIsGgAC7b0pUHJ8EhqgL0o3OgQ	document	Chapter 5 (1).pdf	0
46	11	BQACAgQAAxkBAAITA2nMWKxFAskI9KCMz4OjqxTh2TOaAAItGgAC7b0pUEEMfkKLZ_tAOgQ	document	Chapter 6.pdf	0
47	11	BQACAgQAAxkBAAITCmnMWL7U0taJNMMXOkzOOfDm1-LNAAIvGgAC7b0pULJPJNAfIEe4OgQ	document	Chapter 7.pdf	0
48	11	BQACAgQAAxkBAAIS4GnMV-iarviHcP8HqNRFJa98IvsiAAL0HgACfP95ULcNNOwFKtgvOgQ	document	Chapter 1.pdf	0
49	12	BQACAgQAAyEFAATW-PBcAAIE12nNg4qlarGpK16PNobW-32So71gAAKfHAACLSWRUIXxCK0VQ42iOgQ	document	solution pw1.pdf	0
50	12	BQACAgQAAyEFAATW-PBcAAIE2GnNg4ojzBpbH9wH4tZYrX49MpzzAAKgHAACLSWRUM99UcI8BP7uOgQ	document	OS PW2 corrected.pdf	0
51	13	BQACAgQAAxkBAAIS7mnMWCrWhdAzyGns3IHY9onwdNtfAAIqGgAC7b0pUDIoGfkGF_0rOgQ	document	Chapter 3 (1).pdf	0
53	13	BQACAgQAAxkBAAIS_GnMWJtS408p3CXjyg7nrgngTW-MAAIsGgAC7b0pUHJ8EhqgL0o3OgQ	document	Chapter 5 (1).pdf	0
54	13	BQACAgQAAxkBAAITA2nMWKxFAskI9KCMz4OjqxTh2TOaAAItGgAC7b0pUEEMfkKLZ_tAOgQ	document	Chapter 6.pdf	0
55	13	BQACAgQAAxkBAAITCmnMWL7U0taJNMMXOkzOOfDm1-LNAAIvGgAC7b0pULJPJNAfIEe4OgQ	document	Chapter 7.pdf	0
56	13	BQACAgQAAxkBAAIS4GnMV-iarviHcP8HqNRFJa98IvsiAAL0HgACfP95ULcNNOwFKtgvOgQ	document	Chapter 1.pdf	0
57	15	BQACAgQAAxkBAAITEWnMWOnQMAPdiiipfy_FJjSedEDxAAIwGgAC7b0pUJTwaoSxS9pAOgQ	document	ALL LABS.pdf	0
58	15	BQACAgQAAyEFAATW-PBcAAIE02nNg4rTZ0QFFAu4wIK29ciA6WkoAAIxGgAC7b0pUJqbGbC6AwG9OgQ	document	LAB 3 explanations.pdf	0
59	15	BQACAgQAAyEFAATW-PBcAAIEz2nNg4rMN81CTNhxISBS5n3nBFmnAAL5GwACw8JoUiW4KinLOvhgOgQ	document	Corrigé Type OS PW3.pdf	0
60	15	BQACAgQAAyEFAATW-PBcAAIE0GnNg4pHBBE7TvFDC8SFV8HqOQ9yAAL6GwACw8JoUvlnPUiHgxvhOgQ	document	PW04 Corrected.pdf	0
61	15	BQACAgQAAxkBAAITQWnMW8JQ-IEaYwN3M82z1XZM8TniAAL7GwACw8JoUhUdSZdWcWgNOgQ	document	PW5 corrected.pdf	0
62	15	BQACAgQAAxkBAAITGWnMWam7nN-_mDJlBuv44mp8iVC6AAKuGwACzmLgUoeP_098RTxJOgQ	document	PW 6 corr.pdf	0
63	15	BQACAgQAAyEFAATW-PBcAAIE12nNg4qlarGpK16PNobW-32So71gAAKfHAACLSWRUIXxCK0VQ42iOgQ	document	solution pw1.pdf	0
64	16	AgACAgQAAxkBAAIZIGnNm1JqLEbFHkTNMyC03hDxWQSzAAIWD2sbcoX5U9djswXCyxSDAQADAgADeQADOgQ	photo		0
65	16	AgACAgQAAxkBAAIZIWnNm1IXW8N_RLz8RRoGiX6gZPEvAALrDWsbgToBUIx10kibHyuwAQADAgADeQADOgQ	photo		0
66	16	AgACAgQAAxkBAAIZImnNm1Jn4LiIEDocUODLaTqzdLBhAAIXD2sbcoX5U7EfJSCMII43AQADAgADeQADOgQ	photo		0
67	16	AgACAgQAAxkBAAIZI2nNm1K5gJRICwtV_5XHlQLjzcBlAALsDWsbgToBUGHVkhvayXvXAQADAgADeQADOgQ	photo		0
68	16	AgACAgQAAxkBAAIZJGnNm1JLDyMLD9R8Xu7ztCJv7VKyAAIZD2sbcoX5U972pNK-5D0iAQADAgADeQADOgQ	photo		0
69	16	AgACAgQAAxkBAAIZJWnNm1LOYeLu3lntFmnlGUzAXx6FAALtDWsbgToBUCaDbeLcHWw7AQADAgADeQADOgQ	photo		0
70	17	BQACAgQAAxkBAAIZM2nNnD-IAAF3B-5lhEBkkjzp-co-6gACehsAAsriwFJUPKhWFc9ZozoE	document	Résumé de Cours Algèbre 1 (1).pdf	0
71	17	BQACAgQAAxkBAAIZNGnNnD_tbfbVxMEaaZfAMlZSeOlTAAJ6GwACR_jIUu4gUay-SvpMOgQ	document	résume algèbre s1  .pdf	0
73	18	AgACAgQAAxkBAAIfo2nO_Vi6TgTuDVl4xMALvroLSKa9AALpDWsbvHF5Ugx3fO-3Pgn4AQADAgADeQADOgQ	photo		0
74	18	AgACAgQAAxkBAAIfpGnO_VjKJj-Wcqw2KGjyoPDaieYEAALqDWsbvHF5Uu_Wt8jDuv9JAQADAgADeQADOgQ	photo		0
75	18	AgACAgQAAxkBAAIfpWnO_VjPtj0MX_Pa44Og9cxHBwebAAJ-D2sbwSB4Unv6tWaFwzJqAQADAgADeQADOgQ	photo		0
76	19	AgACAgQAAxkBAAIfomnO_Vilf_RHk8nq7kI9kduGFzrVAALoDWsbvHF5UvGHBUArmdz3AQADAgADeQADOgQ	photo		0
77	19	AgACAgQAAxkBAAIfo2nO_Vi6TgTuDVl4xMALvroLSKa9AALpDWsbvHF5Ugx3fO-3Pgn4AQADAgADeQADOgQ	photo		0
79	22	BQACAgQAAxkBAAIhu2nPm12vtvnbC63EMrpJqCfs9bkPAAIqGgAC7b0pUDIoGfkGF_0rOgQ	document	Chapter 3 (1).pdf	0
80	22	BQACAgQAAxkBAAIhvGnPm12IqY4PpSLDSisPzcz1e262AAIrGgAC7b0pUP3haeqMcqqdOgQ	document	Chapter 4.pdf	0
81	22	BQACAgQAAxkBAAIhvmnPm13tqEi3HS_pm-uLLzhd_y_oAAItGgAC7b0pUEEMfkKLZ_tAOgQ	document	Chapter 6.pdf	0
82	22	BQACAgQAAxkBAAIhv2nPm11TT3dWbgaL0Y9XlCNXo3FgAAIvGgAC7b0pULJPJNAfIEe4OgQ	document	Chapter 7.pdf	0
83	22	BQACAgQAAxkBAAIhvWnPm1281S52DyfJekzt7IEcKd67AAIsGgAC7b0pUHJ8EhqgL0o3OgQ	document	Chapter 5 (1).pdf	0
84	22	BQACAgQAAxkBAAIhwGnPm13u7ivFVbPFrCeQ9chtiF6WAAL0HgACfP95ULcNNOwFKtgvOgQ	document	Chapter 1.pdf	0
85	23	BQACAgQAAxkBAAIhu2nPm12vtvnbC63EMrpJqCfs9bkPAAIqGgAC7b0pUDIoGfkGF_0rOgQ	document	Chapter 3 (1).pdf	0
86	23	BQACAgQAAxkBAAIhv2nPm11TT3dWbgaL0Y9XlCNXo3FgAAIvGgAC7b0pULJPJNAfIEe4OgQ	document	Chapter 7.pdf	0
87	23	BQACAgQAAxkBAAIhvmnPm13tqEi3HS_pm-uLLzhd_y_oAAItGgAC7b0pUEEMfkKLZ_tAOgQ	document	Chapter 6.pdf	0
88	23	BQACAgQAAxkBAAIhvGnPm12IqY4PpSLDSisPzcz1e262AAIrGgAC7b0pUP3haeqMcqqdOgQ	document	Chapter 4.pdf	0
89	23	BQACAgQAAxkBAAIhwGnPm13u7ivFVbPFrCeQ9chtiF6WAAL0HgACfP95ULcNNOwFKtgvOgQ	document	Chapter 1.pdf	0
90	23	BQACAgQAAxkBAAIhvWnPm1281S52DyfJekzt7IEcKd67AAIsGgAC7b0pUHJ8EhqgL0o3OgQ	document	Chapter 5 (1).pdf	0
91	24	BQACAgQAAxkBAAIhvmnPm13tqEi3HS_pm-uLLzhd_y_oAAItGgAC7b0pUEEMfkKLZ_tAOgQ	document	Chapter 6.pdf	0
92	24	BQACAgQAAxkBAAIhwGnPm13u7ivFVbPFrCeQ9chtiF6WAAL0HgACfP95ULcNNOwFKtgvOgQ	document	Chapter 1.pdf	0
93	24	BQACAgQAAxkBAAIhvGnPm12IqY4PpSLDSisPzcz1e262AAIrGgAC7b0pUP3haeqMcqqdOgQ	document	Chapter 4.pdf	0
94	24	BQACAgQAAxkBAAIhv2nPm11TT3dWbgaL0Y9XlCNXo3FgAAIvGgAC7b0pULJPJNAfIEe4OgQ	document	Chapter 7.pdf	0
95	24	BQACAgQAAxkBAAIhu2nPm12vtvnbC63EMrpJqCfs9bkPAAIqGgAC7b0pUDIoGfkGF_0rOgQ	document	Chapter 3 (1).pdf	0
96	24	BQACAgQAAxkBAAIhvWnPm1281S52DyfJekzt7IEcKd67AAIsGgAC7b0pUHJ8EhqgL0o3OgQ	document	Chapter 5 (1).pdf	0
97	25	AgACAgQAAxkBAAIifGnPppl6ScF1-ZANDm_clhpADW7zAAI4DWsbBRi4Uewla36ITAGCAQADAgADeQADOgQ	photo		0
98	25	AgACAgQAAxkBAAIifWnPppkxnG9jwbLkYWrrP5JlD-L1AAI5DWsbBRi4UaAwOHEH5asVAQADAgADeQADOgQ	photo		0
99	27	BQACAgQAAxkBAAImHWnQMQEMIS34WxsfUShumjIGoLEJAAIwGgAC7b0pUJTwaoSxS9pAOwQ	document	ALL LABS.pdf	0
100	27	BQACAgQAAxkBAAImHmnQMQFx3OEMBXm8U06VHIukRy3DAAIxGgAC7b0pUJqbGbC6AwG9OwQ	document	LAB 3 explanations.pdf	0
101	27	BQACAgQAAxkBAAImH2nQMQGdgeGVcdjiVXqrdOb2pBNZAAL5GwACw8JoUiW4KinLOvhgOwQ	document	Corrigé Type OS PW3.pdf	0
102	27	BQACAgQAAxkBAAImI2nQMQH1yrV5EJTKtcR3SorW3IBqAAKfHAACLSWRUIXxCK0VQ42iOwQ	document	solution pw1.pdf	0
103	27	BQACAgQAAxkBAAImIWnQMQENWvcb6Ok7B54CiZTTXnpJAAL7GwACw8JoUhUdSZdWcWgNOwQ	document	PW5 corrected.pdf	0
104	27	BQACAgQAAxkBAAImIGnQMQFHLv1ESuQthgt9yECf824CAAL6GwACw8JoUvlnPUiHgxvhOwQ	document	PW04 Corrected.pdf	0
105	27	BQACAgQAAxkBAAImImnQMQESB6Zer2_28Xc8p-ctfEliAAKuGwACzmLgUoeP_098RTxJOwQ	document	PW 6 corr.pdf	0
106	28	BQACAgQAAxkBAAImIGnQMQFHLv1ESuQthgt9yECf824CAAL6GwACw8JoUvlnPUiHgxvhOwQ	document	PW04 Corrected.pdf	0
107	28	BQACAgQAAxkBAAImIWnQMQENWvcb6Ok7B54CiZTTXnpJAAL7GwACw8JoUhUdSZdWcWgNOwQ	document	PW5 corrected.pdf	0
108	28	BQACAgQAAxkBAAImImnQMQESB6Zer2_28Xc8p-ctfEliAAKuGwACzmLgUoeP_098RTxJOwQ	document	PW 6 corr.pdf	0
109	28	BQACAgQAAxkBAAImI2nQMQH1yrV5EJTKtcR3SorW3IBqAAKfHAACLSWRUIXxCK0VQ42iOwQ	document	solution pw1.pdf	0
110	29	BQACAgQAAxkBAAImH2nQMQGdgeGVcdjiVXqrdOb2pBNZAAL5GwACw8JoUiW4KinLOvhgOwQ	document	Corrigé Type OS PW3.pdf	0
111	29	BQACAgQAAxkBAAImIGnQMQFHLv1ESuQthgt9yECf824CAAL6GwACw8JoUvlnPUiHgxvhOwQ	document	PW04 Corrected.pdf	0
112	29	BQACAgQAAxkBAAImI2nQMQH1yrV5EJTKtcR3SorW3IBqAAKfHAACLSWRUIXxCK0VQ42iOwQ	document	solution pw1.pdf	0
113	29	BQACAgQAAxkBAAImIWnQMQENWvcb6Ok7B54CiZTTXnpJAAL7GwACw8JoUhUdSZdWcWgNOwQ	document	PW5 corrected.pdf	0
114	29	BQACAgQAAxkBAAImImnQMQESB6Zer2_28Xc8p-ctfEliAAKuGwACzmLgUoeP_098RTxJOwQ	document	PW 6 corr.pdf	0
115	30	BQACAgQAAxkBAAImHWnQMQEMIS34WxsfUShumjIGoLEJAAIwGgAC7b0pUJTwaoSxS9pAOwQ	document	ALL LABS.pdf	0
116	30	BQACAgQAAxkBAAImHmnQMQFx3OEMBXm8U06VHIukRy3DAAIxGgAC7b0pUJqbGbC6AwG9OwQ	document	LAB 3 explanations.pdf	0
117	30	BQACAgQAAxkBAAImIWnQMQENWvcb6Ok7B54CiZTTXnpJAAL7GwACw8JoUhUdSZdWcWgNOwQ	document	PW5 corrected.pdf	0
118	30	BQACAgQAAxkBAAImIGnQMQFHLv1ESuQthgt9yECf824CAAL6GwACw8JoUvlnPUiHgxvhOwQ	document	PW04 Corrected.pdf	0
119	30	BQACAgQAAxkBAAImImnQMQESB6Zer2_28Xc8p-ctfEliAAKuGwACzmLgUoeP_098RTxJOwQ	document	PW 6 corr.pdf	0
120	30	BQACAgQAAxkBAAImH2nQMQGdgeGVcdjiVXqrdOb2pBNZAAL5GwACw8JoUiW4KinLOvhgOwQ	document	Corrigé Type OS PW3.pdf	0
121	31	BQACAgQAAxkBAAImH2nQMQGdgeGVcdjiVXqrdOb2pBNZAAL5GwACw8JoUiW4KinLOvhgOwQ	document	Corrigé Type OS PW3.pdf	0
122	31	BQACAgQAAxkBAAImIGnQMQFHLv1ESuQthgt9yECf824CAAL6GwACw8JoUvlnPUiHgxvhOwQ	document	PW04 Corrected.pdf	0
123	31	BQACAgQAAxkBAAImIWnQMQENWvcb6Ok7B54CiZTTXnpJAAL7GwACw8JoUhUdSZdWcWgNOwQ	document	PW5 corrected.pdf	0
124	33	BQACAgQAAxkBAAInPmnQRC1Augvlbc3sLNByEDyjKnIPAAJgHQAC5AtoUK1NaPXX3SJGOwQ	document	Les-systèmes-linéaires.pdf	0
125	33	BQACAgQAAxkBAAInQGnQRC14q4iL4Kh0hQGQPSw8BmWKAAJiHQAC5AtoUAN2TiwkSREMOwQ	document	Espaces-vectoriels.pdf	0
126	33	BQACAgQAAxkBAAInP2nQRC3Tvm2usH-O0ByEfMt7zS6NAAJhHQAC5AtoUFxdopoG0SXSOwQ	document	Les-systèmes-linéaire-TD.pdf	0
127	33	BQACAgQAAxkBAAIlOmnP02K5G_JxQ114En3EeGi8zTzyAALQHgACDHyRUecuSEcvujvNOwQ	document	Les-espaces-de-dimension-finie.pdf	0
128	33	BQACAgQAAxkBAAInQWnQRC3J2AejiaJUpRS12wbwhIKVAAJjHQAC5AtoUDSg1lcT2u7KOwQ	document	TD-espaces-vectoriels.pdf	0
129	33	BQACAgQAAxkBAAIlOWnP02I2PJMTRTUhpkkPaYbzTxkMAAJaJQACLB_gUP0Z-Pae1gxCOwQ	document	TD-espaces-de-dimension-finie.pdf	0
130	33	BQACAgQAAxkBAAIlOGnP02JDUUMZe93loVRF2HRq8kXPAAJZJQACLB_gULOJzbxSKD5HOwQ	document	Les-systÃ¨mes-linÃ©aires-Sol-TD.pdf	0
131	33	BQACAgQAAxkBAAInQmnQRC3MNxPisuNnjGny6R7fC5HkAAK0HAACHIuoUIMQVGxb0ermOwQ	document	Espaces-vectoriels (1).pdf	0
132	34	BQACAgQAAxkBAAInP2nQRC3Tvm2usH-O0ByEfMt7zS6NAAJhHQAC5AtoUFxdopoG0SXSOwQ	document	Les-systèmes-linéaire-TD.pdf	0
133	34	BQACAgQAAxkBAAInQWnQRC3J2AejiaJUpRS12wbwhIKVAAJjHQAC5AtoUDSg1lcT2u7KOwQ	document	TD-espaces-vectoriels.pdf	0
134	34	BQACAgQAAxkBAAInQmnQRC3MNxPisuNnjGny6R7fC5HkAAK0HAACHIuoUIMQVGxb0ermOwQ	document	Espaces-vectoriels (1).pdf	0
135	34	BQACAgQAAxkBAAInPmnQRC1Augvlbc3sLNByEDyjKnIPAAJgHQAC5AtoUK1NaPXX3SJGOwQ	document	Les-systèmes-linéaires.pdf	0
136	34	BQACAgQAAxkBAAInQGnQRC14q4iL4Kh0hQGQPSw8BmWKAAJiHQAC5AtoUAN2TiwkSREMOwQ	document	Espaces-vectoriels.pdf	0
137	35	BQACAgQAAxkBAAIlOGnP02JDUUMZe93loVRF2HRq8kXPAAJZJQACLB_gULOJzbxSKD5HOwQ	document	Les-systÃ¨mes-linÃ©aires-Sol-TD.pdf	0
138	35	BQACAgQAAxkBAAIlOWnP02I2PJMTRTUhpkkPaYbzTxkMAAJaJQACLB_gUP0Z-Pae1gxCOwQ	document	TD-espaces-de-dimension-finie.pdf	0
139	35	BQACAgQAAxkBAAIlOmnP02K5G_JxQ114En3EeGi8zTzyAALQHgACDHyRUecuSEcvujvNOwQ	document	Les-espaces-de-dimension-finie.pdf	0
140	36	BQACAgQAAxkBAAInn2nQTblmA8hRND6luM0VwlTj1B8yAAJIFwACjDo5UCUKMgKxyPlyOwQ	document	Corrigé Serie 1.pdf	0
141	36	BQACAgQAAxkBAAInoGnQTbkRdkaChBDui-ckT063CgSrAAJJFwACjDo5UGnGmxN5ubdpOwQ	document	Corrigé Serie 2.pdf	0
142	36	BQACAgQAAxkBAAInoWnQTbky8FW7e-7vPa08I9Ra4i1SAAJKFwACjDo5UPdLqoHdV7AEOwQ	document	Corrigé Serie 3.pdf	0
143	36	BQACAgQAAxkBAAInomnQTbn_tDS7QqODzyO3_DJpESUaAAJLFwACjDo5UOkuW0uOsmgUOwQ	document	Corrigé Serie 3 (suite).pdf	0
144	37	AgACAgQAAxkBAAIpXmnQjiOIxhMXD0NgUijZ75QSPsByAAICC2sbw8J4Uj-RdC2y1jyZAQADAgADeQADOwQ	photo		0
145	37	AgACAgQAAxkBAAIpYmnQjiO5lbwqbBQVMBF6VFIidj3hAAIGC2sbw8J4UtR29z-zNEM2AQADAgADeQADOwQ	photo		0
146	37	AgACAgQAAxkBAAIpZWnQjiM9bnrTGaUPT9AhtL7ngmavAAIJC2sbw8J4Uj4GDqi6sTcqAQADAgADeQADOwQ	photo		0
147	37	AgACAgQAAxkBAAIpZGnQjiMV4QYLZBoKDZN1nl7A1JezAAIIC2sbw8J4UgXE4GRhejF5AQADAgADeQADOwQ	photo		0
148	37	AgACAgQAAxkBAAIpYGnQjiPKwonOjZ_SazleX4JlGXhRAAIEC2sbw8J4UuhTopeUl7kbAQADAgADeQADOwQ	photo		0
149	37	AgACAgQAAxkBAAIpYWnQjiO1-TaUwsYErEPPwjSs8fd7AAIFC2sbw8J4Ui6RiMf_0KKuAQADAgADeQADOwQ	photo		0
150	37	AgACAgQAAxkBAAIpY2nQjiN7g1Gbvt18p3272JoVOdKnAAIHC2sbw8J4UvpKhFMuyMnhAQADAgADeQADOwQ	photo		0
151	37	AgACAgQAAxkBAAIpX2nQjiMPqdEounKOV4AFX6OjWxNmAAIDC2sbw8J4Ukh1LOkxkmfsAQADAgADeQADOwQ	photo		0
152	39	BQACAgQAAxkBAAIqR2nQx5C5Akjac8QZJwTd6aZf5PKrAALdGgACn734UUOhlT_SXUd-OwQ	document	Physique 2 2024.pdf	0
153	39	BQACAgQAAxkBAAIqSGnQx5BqRvOYbH9GFuqhN-PLnUM2AALfGgACn734UVfQ-J-G09VBOwQ	document	Corrig- _ETLD PH-2_2024.pdf	0
154	39	BQACAgQAAxkBAAIqS2nQx5CIE1xEu4I6WF1Mt42lFfTaAALiGgACn734UZGlDt78Ziq5OwQ	document	ETLD  Physique 2.pdf	0
155	39	BQACAgQAAxkBAAIqTWnQx5C2aT0SWhj4SLk_FtsNDpDgAALkGgACn734UQjcCw7lZszWOwQ	document	Serie-2 Conducteurs en -quilibre.pdf	0
156	39	BQACAgQAAxkBAAIqTGnQx5AvzlMTQURMAAFFGTziEwAB25kAAuMaAAKfvfhRzLL8JZLx2TQ7BA	document	Corrig- physique 2 2021.pdf	0
157	39	BQACAgQAAxkBAAIqSmnQx5DEXImrrHDLBVG9vSFQ-FkqAALhGgACn734URjtNJiKF_SbOwQ	document	Corrig- Phys 2 2023.pdf	0
158	39	BQACAgQAAxkBAAIqSWnQx5As_-H4d4oqWnX5eT7mz0zmAALgGgACn734UY2qo488h34vOwQ	document	ETLD PH 2 ST 2023.pdf	0
159	40	BQACAgQAAxkBAAIqR2nQx5C5Akjac8QZJwTd6aZf5PKrAALdGgACn734UUOhlT_SXUd-OwQ	document	Physique 2 2024.pdf	0
160	40	BQACAgQAAxkBAAIqTWnQx5C2aT0SWhj4SLk_FtsNDpDgAALkGgACn734UQjcCw7lZszWOwQ	document	Serie-2 Conducteurs en -quilibre.pdf	0
161	40	BQACAgQAAxkBAAIqSmnQx5DEXImrrHDLBVG9vSFQ-FkqAALhGgACn734URjtNJiKF_SbOwQ	document	Corrig- Phys 2 2023.pdf	0
162	40	BQACAgQAAxkBAAIqTGnQx5AvzlMTQURMAAFFGTziEwAB25kAAuMaAAKfvfhRzLL8JZLx2TQ7BA	document	Corrig- physique 2 2021.pdf	0
163	40	BQACAgQAAxkBAAIqSGnQx5BqRvOYbH9GFuqhN-PLnUM2AALfGgACn734UVfQ-J-G09VBOwQ	document	Corrig- _ETLD PH-2_2024.pdf	0
164	40	BQACAgQAAxkBAAIqS2nQx5CIE1xEu4I6WF1Mt42lFfTaAALiGgACn734UZGlDt78Ziq5OwQ	document	ETLD  Physique 2.pdf	0
165	40	BQACAgQAAxkBAAIqSWnQx5As_-H4d4oqWnX5eT7mz0zmAALgGgACn734UY2qo488h34vOwQ	document	ETLD PH 2 ST 2023.pdf	0
166	40	BQACAgQAAxkBAAIqSWnQx5As_-H4d4oqWnX5eT7mz0zmAALgGgACn734UY2qo488h34vOwQ	document	ETLD PH 2 ST 2023.pdf	0
167	40	BQACAgQAAxkBAAIqVGnQx_QGlRqii8rgabYrOK1AD3qFAAIxHQACOXn5UbmsH9QjX_yQOwQ	document	Examen thermo 2020-2021.pdf	0
168	40	BQACAgQAAxkBAAIqSWnQx5As_-H4d4oqWnX5eT7mz0zmAALgGgACn734UY2qo488h34vOwQ	document	ETLD PH 2 ST 2023.pdf	0
169	40	BQACAgQAAxkBAAIqSmnQx5DEXImrrHDLBVG9vSFQ-FkqAALhGgACn734URjtNJiKF_SbOwQ	document	Corrig- Phys 2 2023.pdf	0
170	40	BQACAgQAAxkBAAIqSGnQx5BqRvOYbH9GFuqhN-PLnUM2AALfGgACn734UVfQ-J-G09VBOwQ	document	Corrig- _ETLD PH-2_2024.pdf	0
171	40	BQACAgQAAxkBAAIqR2nQx5C5Akjac8QZJwTd6aZf5PKrAALdGgACn734UUOhlT_SXUd-OwQ	document	Physique 2 2024.pdf	0
172	40	BQACAgQAAxkBAAIqR2nQx5C5Akjac8QZJwTd6aZf5PKrAALdGgACn734UUOhlT_SXUd-OwQ	document	Physique 2 2024.pdf	0
173	40	BQACAgQAAxkBAAIqU2nQx_RL6wxNJnuH74aLAo4rR858AAJoJQACKp8JUu8Gr78Fx0VNOwQ	document	ETCD 2 (S2. TD)2023.2024 (v2)(CORRIG-) (1).pdf	0
174	42	BQACAgQAAxkBAAIvUmnRZFDqUv8gqIi3TGo8uEr-2-R2AAIMHwACTZDJUBZ8qUZ6M8E_OwQ	document	Chapter_6_Algo_SDDs_Structures_enumerations (1).pdf	0
175	42	BQACAgQAAxkBAAIvU2nRZFB434GBTUwwVXdB3ytSCYzrAAINHwACTZDJUMDQwAKkQtcLOwQ	document	Chapter_7_Dynamic_variables_address_manipulation (1).pdf	0
176	42	BQACAgQAAxkBAAIvVGnRZFB11VdtIOBN7dIOn8TOJMedAAIOHwACTZDJUMpcDKHQYYmlOwQ	document	Chapter_8_Functions_Procedures (1).pdf	0
177	42	BQACAgQAAxkBAAIvVWnRZFBaGIRA5s-RtURDFD5JLqTXAAIPHwACTZDJUG-lZ0-wnS4AATsE	document	Chapter_10_Linked_lists (1).pdf	0
178	42	BQACAgQAAxkBAAIvVmnRZFCzOBk1K_V2iUy3LKnZQVxyAAIQHwACTZDJUGM1Bb3hkD9lOwQ	document	Chapter_11_Stacks (1).pdf	0
179	42	BQACAgQAAxkBAAIvV2nRZFDHYtSvb3vN2aQgjQOefVVhAAIRHwACTZDJUKrJej6k1HD9OwQ	document	Chapter_12_Queues (1).pdf	0
180	43	BQACAgQAAxkBAAIvYGnRZJFFMf2B0bJZ4xS8XjvYGEtgAAKvHAACgGEpUSYaBcCHgPe2OwQ	document	Série TD 5 (2).pdf	0
181	43	BQACAgQAAxkBAAIvYWnRZJG14lK4dnqMH5Ce2z3hNsamAAKwHAACgGEpUQapwD9Bp9XqOwQ	document	Série TD 5.pdf	0
182	43	BQACAgQAAxkBAAIvYmnRZJHTZMH9To6kw-oCXBvMGB5vAAKxHAACgGEpUVsZRlc2y2u6OwQ	document	Série TD 6 (E).pdf	0
183	43	BQACAgQAAxkBAAIvY2nRZJGVLhZb605Tvz3qiFXEleRuAAKzHAACgGEpUeb8SSo6BuohOwQ	document	Série TD 6.pdf	0
184	43	BQACAgQAAxkBAAIvZGnRZJFW6XSBMDEbV-mvNjnzujU2AAKyHAACgGEpUXzcm19hKFRpOwQ	document	Série TD 7.pdf	0
185	43	BQACAgQAAxkBAAIvZWnRZJGTLLhSkv6oXj6vMNbBbAseAAK0HAACgGEpUcB3wYCRRrR-OwQ	document	Série TD 8 (E).pdf	0
186	43	BQACAgQAAxkBAAIvaWnRZJqmjC0IMg092Qu3jsclBjs3AAK3HAACgGEpUfqD5c5f_D9vOwQ	document	TP #1.pdf	0
187	43	BQACAgQAAxkBAAIvamnRZJrLx45NxHi439ve1vdNOLIeAAK5HAACgGEpUZhhZwRjQi6JOwQ	document	TP #2.pdf	0
188	43	BQACAgQAAxkBAAIva2nRZJpwQQGFsh3zFcCrN888GLh3AAK4HAACgGEpUTuaiasiCcTHOwQ	document	TP #3.pdf	0
189	43	BQACAgQAAxkBAAIvbGnRZJovXuzNKU_RlAhAJ4HiD1CpAAK6HAACgGEpUcr6kmE7sglbOwQ	document	TP #4 Corrigé.pdf	0
190	43	BQACAgQAAxkBAAIvbWnRZJoAAYtgHJvtgzhdSnWiR6QfmwACuxwAAoBhKVHgSLNBln7WETsE	document	TP #4.pdf	0
191	44	BQACAgQAAxkBAAIvaWnRZJqmjC0IMg092Qu3jsclBjs3AAK3HAACgGEpUfqD5c5f_D9vOwQ	document	TP #1.pdf	0
192	44	BQACAgQAAxkBAAIvamnRZJrLx45NxHi439ve1vdNOLIeAAK5HAACgGEpUZhhZwRjQi6JOwQ	document	TP #2.pdf	0
193	44	BQACAgQAAxkBAAIva2nRZJpwQQGFsh3zFcCrN888GLh3AAK4HAACgGEpUTuaiasiCcTHOwQ	document	TP #3.pdf	0
194	44	BQACAgQAAxkBAAIvbGnRZJovXuzNKU_RlAhAJ4HiD1CpAAK6HAACgGEpUcr6kmE7sglbOwQ	document	TP #4 Corrigé.pdf	0
195	44	BQACAgQAAxkBAAIvbWnRZJoAAYtgHJvtgzhdSnWiR6QfmwACuxwAAoBhKVHgSLNBln7WETsE	document	TP #4.pdf	0
196	45	BQACAgQAAxkBAAIwC2nRgDWa_77ckTRwyjkLCPo5mxReAALuHgACTZDJUCJ2OY263_d0OwQ	document	Analyse-2-résumé.pdf	0
197	45	BQACAgQAAxkBAAIwDGnRgDXok_MH7ejb8hF6Z-kpZ8YpAALvHgACTZDJUF0jPOKRKte5OwQ	document	Analyse-2-Cours-05.pdf	0
198	45	BQACAgQAAxkBAAIwDWnRgDX1EpbK-izTbg7Tt8YK1HRTAALwHgACTZDJUE8IEbGhIXklOwQ	document	Analyse-2-Cours-04.pdf	0
199	45	BQACAgQAAxkBAAIwDmnRgDXjIKGRLfkpPMLX6vQRt_NMAALyHgACTZDJUA8_ThAhR-1JOwQ	document	Analyse-2-Cours-03.pdf	0
200	45	BQACAgQAAxkBAAIwD2nRgDUhZpnQZrfR8V_vuQW-VxFqAALxHgACTZDJUC_r5-U3ymkpOwQ	document	Analyse-2-Cours-02.pdf	0
201	45	BQACAgQAAxkBAAIwG2nRgFEVJsBaJCVxChabCmKWeTW3AAL1HgACTZDJUKdBSoD4ZlEMOwQ	document	chapter 4.pdf	0
202	45	BQACAgQAAxkBAAIwHGnRgFFoC7Ew54wZQXbQgw0n3FnZAAL2HgACTZDJUPpko40-SZx1OwQ	document	chapter 3.pdf	0
203	45	BQACAgQAAxkBAAIwHWnRgFGJiiKPCxWS72ESVoF9j8dUAAL4HgACTZDJUGHPgeJ_NEZNOwQ	document	Chapter 2.pdf	0
204	45	BQACAgQAAxkBAAIwHmnRgFFq1bEtR_jKwupaMWt-nQqsAAL5HgACTZDJUIDMStdjhTYdOwQ	document	Chapter 1.pdf	0
205	45	BQACAgQAAxkBAAIwIGnRgGDppvg3Afqw8pPrjjuLVAqPAALEHAACgGEpUZRfDwPDciGWOwQ	document	Corrigé TD Chapitre 1.pdf	0
206	45	BQACAgQAAxkBAAIwIWnRgGC1VZnsglGb2O8mqUVm85hKAALHHAACgGEpUWlFkZP8OmFPOwQ	document	Corrigé TD Chapitre 2.pdf	0
207	45	BQACAgQAAxkBAAIwImnRgGAfE8NJIKutVzXH4kTk6HSYAALGHAACgGEpUZrinSZIJDv_OwQ	document	TD Chapitre 1.pdf	0
208	45	BQACAgQAAxkBAAIwI2nRgGAKSUJcolqoxLy4YJprPwxZAALFHAACgGEpUWojlUj04iuQOwQ	document	TD Chapitre 2.pdf	0
209	45	BQACAgQAAxkBAAIwJGnRgGC4vv2efXvO_TfPX0YSfIJyAALIHAACgGEpUQwfUim3KUs9OwQ	document	TD équations differentielles.pdf	0
210	46	BQACAgQAAxkBAAIwG2nRgFEVJsBaJCVxChabCmKWeTW3AAL1HgACTZDJUKdBSoD4ZlEMOwQ	document	chapter 4.pdf	0
211	46	BQACAgQAAxkBAAIwHGnRgFFoC7Ew54wZQXbQgw0n3FnZAAL2HgACTZDJUPpko40-SZx1OwQ	document	chapter 3.pdf	0
212	46	BQACAgQAAxkBAAIwHWnRgFGJiiKPCxWS72ESVoF9j8dUAAL4HgACTZDJUGHPgeJ_NEZNOwQ	document	Chapter 2.pdf	0
213	46	BQACAgQAAxkBAAIwHmnRgFFq1bEtR_jKwupaMWt-nQqsAAL5HgACTZDJUIDMStdjhTYdOwQ	document	Chapter 1.pdf	0
214	46	BQACAgQAAxkBAAIwIGnRgGDppvg3Afqw8pPrjjuLVAqPAALEHAACgGEpUZRfDwPDciGWOwQ	document	Corrigé TD Chapitre 1.pdf	0
215	46	BQACAgQAAxkBAAIwIWnRgGC1VZnsglGb2O8mqUVm85hKAALHHAACgGEpUWlFkZP8OmFPOwQ	document	Corrigé TD Chapitre 2.pdf	0
216	48	BQACAgQAAxkBAAIw4mnRiT_hE_EfpS9QgBHuqQaRDoBCAAJCGQAC_6CJUlSE0dWVihJ8OwQ	document	A_Modern_Introduction_to_Linear_Algebra_Henry_Ricardo_z_library.pdf	0
217	48	BQACAgQAAxkBAAIw42nRiU4jE-2iTEuEj0UtviFzYu6hAAJDGQAC_6CJUnxiHpkAAXoQQjsE	document	book-exos (1).pdf	0
218	48	BQACAgQAAxkBAAIw5GnRiVvsQMOtbO_-wzNAZ0rj2ctKAAJEGQAC_6CJUhScgK9mYFf5OwQ	document	John_M_Erdman_Exercises_and_Problems_in_Linear_Algebra_2020,_World.pdf	0
219	49	BQACAgQAAxkBAAIy22nRy8d5Jzk8psVb6-rk0bZLwWMAAwcFAALDsihTQD2_SWifhm07BA	document	HTML5 Code.pdf	0
220	49	BQACAgQAAxkBAAIy3GnRy8dAp3skTRhT9g-V2_xTUGp0AAIIBQACw7IoU4SxpHHGhDuoOwQ	document	Mastering HTML5 & CSS3.pdf	0
221	49	BQACAgQAAxkBAAIy3WnRy8fUonwReMC5Po_9uR1as7gXAAIJBQACw7IoU9qg91wHzSVWOwQ	document	HTML & CSS.pdf	0
222	49	BQACAgQAAxkBAAIy3mnRy8cDuM7zSRl29ZnVnM7EZaaAAAIKBQACw7IoU1NBir_MZFMaOwQ	document	Advanced HTML5 & CSS3.pdf	0
223	49	BQACAgQAAxkBAAIy32nRy8eZfxCZRvJ2oIVhUDr-vCzCAAILBQACw7IoU9FP06izqG1mOwQ	document	HTML5 & CSS3.pdf	0
224	49	BQACAgQAAxkBAAIy4GnRy8fqdyj-gEZ04xtWbsp8ZiiLAAIMBQACw7IoU7MmDKL1SdEgOwQ	document	تعلم HTML  من البداية حتى الاحتراف.pdf	0
225	50	BQACAgQAAxkBAAIy9WnRzKnvmbrf_meGDfKlmtKzBtxeAAL2AgACttRxUhqPexf7vtncOwQ	document	PLSQL  دروس.pdf	0
226	50	BQACAgQAAxkBAAIy9mnRzKlK9-mBYjfLlPVNTSkBtNeNAAL3AgACttRxUrhCKs4cfTjzOwQ	document	PLSQL عربي.pdf	0
227	50	BQACAgQAAxkBAAIy92nRzKkerlEYzAZh3G0j-QWvUBhzAAL4AgACttRxUq8wA7YLFI3kOwQ	document	PL-SQL عربي.pdf	0
228	50	BQACAgQAAxkBAAIy-GnRzKk2Uf58IJMUhyyAvu0BW6DXAAL5AgACttRxUhOHd139UZrtOwQ	document	PL-SQL tutorial.pdf	0
229	51	BQACAgQAAxkBAAIzE2nRzkl8tYPI1d0eh8IhApe4R35TAAIKAwACpnpxUzAwd8KH3QmlOwQ	document	تقنيات التشفير.pdf	0
230	51	BQACAgQAAxkBAAIzFGnRzkkUvJRn4Yi4pV0pDlC5w3_vAAKMBQACHj6ZUWhiqHRp5aehOwQ	document	تشفير الملفات النصية.pdf	0
231	51	BQACAgQAAxkBAAIzFWnRzkkHbh8BAjqsaBwZGuiQM54_AAIUAwACXxk5UJox2-0Kkvg_OwQ	document	امن الشبكات.pdf	0
232	51	BQACAgQAAxkBAAIzFmnRzkkdnfB_9S95U8Q8bgABlmPZ_wACFQMAAl8ZOVC2JmzZdgahrDsE	document	امن الشبكات اللاسلكية.pdf	0
233	51	BQACAgQAAxkBAAIzF2nRzkkWXpaEOyZU-eJJJN4HTCM4AAKNBQACHj6ZUSV90k847WMHOwQ	document	امن المعلومات.pdf	0
234	51	BQACAgQAAxkBAAIzGGnRzknW9KZp7Fh8YUd93u1mQWbRAAIeBAACflaxUdfVvobj4qZbOwQ	document	امن الشبكات.pdf	0
235	52	BQACAgQAAxkBAAIzI2nRznS0QKOEhndxSBtfUKzZETwhAAIyBAACSvAJUk6_ZBlS6-DNOwQ	document	Bootstrap-tutorial.pdf	0
236	52	BQACAgQAAxkBAAIzJGnRznQtbzxIviaD5uRsYjDtU9xDAAIzBAACSvAJUl4dzt9ZufDkOwQ	document	Bootstrap.pdf	0
237	52	BQACAgQAAxkBAAIzJWnRznSCdTnEX1SyMkf44xZcSExMAAI0BAACSvAJUjEZRfZrUwHDOwQ	document	bootstrap_tutorial.pdf	0
238	53	BQACAgQAAxkBAAIzK2nRzwABa6UGSb_ChpnyPpQ76OJV8QACbQYAAmjFAVCwmeZV0ldb5DsE	document	اساسيات الشبكات.pdf	0
239	53	BQACAgQAAxkBAAIzLGnRzwAB8ZhYvh73M6LCpJpYdt4pMAACcgYAAmjFAVBqpcLgYXHf_TsE	document	بروتوكولات الشبكات - عربي.pdf	0
240	53	BQACAgQAAxkBAAIzLWnRzwABfeuWB7SGlZjbhxooXe1Q-QACcwYAAmjFAVApceJ0uDBkBjsE	document	الف سؤال و جواب في الشبكات.pdf	0
241	53	BQACAgQAAxkBAAIzLmnRzwABrzS9Q4_F_uxrwT22wrhpZQACYwYAAmjFAVAfqOYNrroD-zsE	document	Computer-Networks--Introduction_Computer_Networking.pdf	0
242	55	BQACAgQAAxkBAAI02WnSDoCC9N36TFi7RLc2PkL_9_5oAALuBQACofRwUbz9ahvEtKqrOwQ	document	مقدمة تحليل نظم المعلومات.ppt	0
243	55	BQACAgQAAxkBAAI02mnSDoAvWLFg1cQDva_BQII3xaPNAALwBQACofRwUQhQfdPkUccHOwQ	document	تحليل نظم المعلومات.pdf	0
244	55	BQACAgQAAxkBAAI022nSDoC3H3LtQ2Z9xKA5EORz1kdNAALxBQACofRwUdt5g0eo_OJSOwQ	document	تحليل و تصميم نظم المعلومات.docx	0
245	56	BQACAgQAAxkBAAI2kGnSPG1Wc2Ks0yAFQw2Ytjk-7YWpAAKvBQACv3j4UP3fF67Vs6JPOwQ	document	برمجة واجهات - جافا.pdf	0
246	56	BQACAgQAAxkBAAI2kWnSPG1fDXYpKXOao_Rx2hhSKepZAAKwBQACv3j4UMkYSftbsMvmOwQ	document	البرمجة كائنية التوجه OOP.ppt	0
247	56	BQACAgQAAxkBAAI2kmnSPG1qVsM2ETJ9wpJNF3J53jx_AAKxBQACv3j4ULObur3mw1v5OwQ	document	برمجة كائنية التوجيه.pdf	0
248	56	BQACAgQAAxkBAAI2k2nSPG1fq5qRtiB6KzzcCSfl_kjvAAK1BQACv3j4UCG1OmtTP0ZGOwQ	document	اساسيات البرمجة 1.pdf	0
249	56	BQACAgQAAxkBAAI2kmnSPG1qVsM2ETJ9wpJNF3J53jx_AAKxBQACv3j4ULObur3mw1v5OwQ	document	برمجة كائنية التوجيه.pdf	0
250	56	BQACAgQAAxkBAAI2lWnSPG3EB67G91EnhR7yw1Ia82tPAAK3BQACv3j4UDSOUApBp3koOwQ	document	أساسيات البرمجة بلغة جافا.pdf	0
251	57	BQACAgIAAxkBAAI38WnSXxXIaQImVWBVmKDIwTkZHV1HAAIEAwACdFlxSkXKxH9bkQHjOwQ	document	عندما بكى نيتشه - إرفين يالوم.pdf	0
252	57	BQACAgQAAxkBAAI38mnSXxXlJ1KC148kHHBk6G8LQ3QvAAL8BAACrZ9JUk15x0cP-n2gOwQ	document	علاج شوبنهاور - إرفين د. يالوم.pdf	0
253	57	BQACAgQAAxkBAAI382nSXxVf9L-1xu8ad1fuby577zI4AALNBgAC-wWAUZUCSK8uzQQxOwQ	document	مشكلة_سبينوزا_رواية_لـ_إرفين_د_يالوم.pdf	0
254	60	BQACAgQAAxkBAAIw4mnRiT_hE_EfpS9QgBHuqQaRDoBCAAJCGQAC_6CJUlSE0dWVihJ8OwQ	document	A_Modern_Introduction_to_Linear_Algebra_Henry_Ricardo_z_library.pdf	0
255	60	BQACAgQAAxkBAAIw42nRiU4jE-2iTEuEj0UtviFzYu6hAAJDGQAC_6CJUnxiHpkAAXoQQjsE	document	book-exos (1).pdf	0
256	60	BQACAgQAAxkBAAIw5GnRiVvsQMOtbO_-wzNAZ0rj2ctKAAJEGQAC_6CJUhScgK9mYFf5OwQ	document	John_M_Erdman_Exercises_and_Problems_in_Linear_Algebra_2020,_World.pdf	0
257	63	BQACAgQAAxkDAAIoRWnQcQJyCCFP7EuDel3gQbqE1oJ1AAImHQACLmgAAVKXUguvN17IRDsE	document	semio genitale masculin dr kemiha.pdf	0
258	63	BQACAgQAAxkDAAIoTWnQcRZK30lBs75RgQ0zthF_01_KAAJpHgACyUV4Ub_XXocZVL-wOwQ	document	sémiologie-app-urinaire-interrogatoire (1).pdf	0
259	63	BQACAgQAAxkDAAItImnRMxHTRTLlTWjUVUhbR9M6q2NIAALKHgACGIxRUaOK1zMBLt4HOwQ	document	semio hg genitale.pdf	0
260	63	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
261	63	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
262	63	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
263	63	BQACAgQAAxkDAAItK2nRM8jAr3bK8N5xigJzKwfcSVNyAAJrHgACyUV4UQ0wUE7Y54CmOwQ	document	Sémiologie-app-urinaire-examen-clinique (2).pdf	0
264	63	BQACAgQAAxkDAAJAo2nUGGQJOoj8zUnVaAjyuuGB-XmGAAIMHQACmjYoUimK5ioPiBY5OwQ	document	IRA (4).pdf	0
265	63	BQACAgQAAxkDAAJAo2nUGGQJOoj8zUnVaAjyuuGB-XmGAAIMHQACmjYoUimK5ioPiBY5OwQ	document	IRA (4).pdf	0
266	63	BQACAgQAAxkDAAIoTWnQcRZK30lBs75RgQ0zthF_01_KAAJpHgACyUV4Ub_XXocZVL-wOwQ	document	sémiologie-app-urinaire-interrogatoire (1).pdf	0
267	63	BQACAgQAAxkDAAJAO2nUFC66_x2BDkLShijoupOMzz20AALvHwACoNQAAVG27crBh9wybjsE	document	6-Exploration de la glycémie.pptx.pdf	0
268	63	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
269	63	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
270	63	BQACAgQAAxkDAAI9MmnTq3zwE12fGIuxHrtNjDd86FZWAAJgHwACFM15UeFO8Ps-sJOqOwQ	document	Cours de Sémiologie Endocrinienne.pdf	0
271	63	BQACAgQAAxkDAAIoR2nQcQZfa0upVkKoegxSfivrv4I1AAJcIAACV3m4UNoJUxXSn7mTOwQ	document	Sémiologie surrénale.pptx	0
272	64	BQACAgQAAxkDAAIoRWnQcQJyCCFP7EuDel3gQbqE1oJ1AAImHQACLmgAAVKXUguvN17IRDsE	document	semio genitale masculin dr kemiha.pdf	0
273	64	BQACAgQAAxkDAAIoTWnQcRZK30lBs75RgQ0zthF_01_KAAJpHgACyUV4Ub_XXocZVL-wOwQ	document	sémiologie-app-urinaire-interrogatoire (1).pdf	0
274	64	BQACAgQAAxkDAAItImnRMxHTRTLlTWjUVUhbR9M6q2NIAALKHgACGIxRUaOK1zMBLt4HOwQ	document	semio hg genitale.pdf	0
275	64	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
276	64	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
277	64	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
278	64	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
279	64	BQACAgQAAxkDAAI9MmnTq3zwE12fGIuxHrtNjDd86FZWAAJgHwACFM15UeFO8Ps-sJOqOwQ	document	Cours de Sémiologie Endocrinienne.pdf	0
280	64	BQACAgQAAxkDAAIoR2nQcQZfa0upVkKoegxSfivrv4I1AAJcIAACV3m4UNoJUxXSn7mTOwQ	document	Sémiologie surrénale.pptx	0
281	64	BQACAgQAAxkDAAIoS2nQcRGgWIlNk97s-ox3JFluMcugAAKUKAAC4PZxUNbH0gMcf-gKOwQ	document	2-Sémiologie thyroïdienne.pptx	0
282	66	BQACAgQAAxkDAAIoRWnQcQJyCCFP7EuDel3gQbqE1oJ1AAImHQACLmgAAVKXUguvN17IRDsE	document	semio genitale masculin dr kemiha.pdf	0
283	66	BQACAgQAAxkDAAIoTWnQcRZK30lBs75RgQ0zthF_01_KAAJpHgACyUV4Ub_XXocZVL-wOwQ	document	sémiologie-app-urinaire-interrogatoire (1).pdf	0
284	66	BQACAgQAAxkDAAItImnRMxHTRTLlTWjUVUhbR9M6q2NIAALKHgACGIxRUaOK1zMBLt4HOwQ	document	semio hg genitale.pdf	0
285	66	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
286	66	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
287	66	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
288	66	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
289	66	BQACAgQAAxkDAAI9MmnTq3zwE12fGIuxHrtNjDd86FZWAAJgHwACFM15UeFO8Ps-sJOqOwQ	document	Cours de Sémiologie Endocrinienne.pdf	0
290	66	BQACAgQAAxkDAAIoR2nQcQZfa0upVkKoegxSfivrv4I1AAJcIAACV3m4UNoJUxXSn7mTOwQ	document	Sémiologie surrénale.pptx	0
291	66	BQACAgQAAxkDAAIoS2nQcRGgWIlNk97s-ox3JFluMcugAAKUKAAC4PZxUNbH0gMcf-gKOwQ	document	2-Sémiologie thyroïdienne.pptx	0
292	66	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
293	66	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
294	66	BQACAgQAAxkDAAI9MmnTq3zwE12fGIuxHrtNjDd86FZWAAJgHwACFM15UeFO8Ps-sJOqOwQ	document	Cours de Sémiologie Endocrinienne.pdf	0
295	66	BQACAgQAAxkDAAIoR2nQcQZfa0upVkKoegxSfivrv4I1AAJcIAACV3m4UNoJUxXSn7mTOwQ	document	Sémiologie surrénale.pptx	0
296	66	BQACAgQAAxkDAAIoS2nQcRGgWIlNk97s-ox3JFluMcugAAKUKAAC4PZxUNbH0gMcf-gKOwQ	document	2-Sémiologie thyroïdienne.pptx	0
297	67	BQACAgQAAxkDAAIoRWnQcQJyCCFP7EuDel3gQbqE1oJ1AAImHQACLmgAAVKXUguvN17IRDsE	document	semio genitale masculin dr kemiha.pdf	0
298	67	BQACAgQAAxkDAAIoTWnQcRZK30lBs75RgQ0zthF_01_KAAJpHgACyUV4Ub_XXocZVL-wOwQ	document	sémiologie-app-urinaire-interrogatoire (1).pdf	0
299	67	BQACAgQAAxkDAAItImnRMxHTRTLlTWjUVUhbR9M6q2NIAALKHgACGIxRUaOK1zMBLt4HOwQ	document	semio hg genitale.pdf	0
300	67	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
301	67	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
302	67	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
303	67	BQACAgQAAxkDAAItK2nRM8jAr3bK8N5xigJzKwfcSVNyAAJrHgACyUV4UQ0wUE7Y54CmOwQ	document	Sémiologie-app-urinaire-examen-clinique (2).pdf	0
304	67	BQACAgQAAxkDAAJAo2nUGGQJOoj8zUnVaAjyuuGB-XmGAAIMHQACmjYoUimK5ioPiBY5OwQ	document	IRA (4).pdf	0
305	67	BQACAgQAAxkDAAJAo2nUGGQJOoj8zUnVaAjyuuGB-XmGAAIMHQACmjYoUimK5ioPiBY5OwQ	document	IRA (4).pdf	0
306	67	BQACAgQAAxkDAAIoTWnQcRZK30lBs75RgQ0zthF_01_KAAJpHgACyUV4Ub_XXocZVL-wOwQ	document	sémiologie-app-urinaire-interrogatoire (1).pdf	0
307	68	BQACAgQAAxkDAAJAO2nUFC66_x2BDkLShijoupOMzz20AALvHwACoNQAAVG27crBh9wybjsE	document	6-Exploration de la glycémie.pptx.pdf	0
308	68	BQACAgQAAxkDAAIvmGnRZh-kYlpzDnlsGBDVcqbwtLQKAALJHgACGIxRUb37LsotYDucOwQ	document	semio gyneco 2.pdf	0
309	68	BQACAgQAAxkDAAItJmnRM1dFIFZcJ-tyJsJ6Wk5h_RbiAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	complications aigues du diabète (urgences) (1).pdf	0
310	68	BQACAgQAAxkDAAI9MmnTq3zwE12fGIuxHrtNjDd86FZWAAJgHwACFM15UeFO8Ps-sJOqOwQ	document	Cours de Sémiologie Endocrinienne.pdf	0
311	68	BQACAgQAAxkDAAIoR2nQcQZfa0upVkKoegxSfivrv4I1AAJcIAACV3m4UNoJUxXSn7mTOwQ	document	Sémiologie surrénale.pptx	0
312	69	AgACAgQAAxkBAAJGY2nWrvuP8jsIQEYI6yUAAdKAdYO8QgACoQxrG972mFJWV0YgQ8Z5UwEAAwIAA3kAAzsE	photo		0
313	69	AgACAgQAAxkBAAJGZGnWrvvgdcj9zOAeRSIYZbncftt7AAJMDGsbRZy5UsVG7gO0_WAtAQADAgADeQADOwQ	photo		0
314	69	AgACAgQAAxkBAAJGZWnWrvvxsjMqM40LDmelBpv5SRFHAAJmDGsbvJixUsC7-z10j74AAQEAAwIAA3kAAzsE	photo		0
315	71	BQACAgQAAxkBAAJHpmnWxm3BN5eTplpUWfXGdiqFdmOvAALnHwAC5_YIUD_Xm2XcPXzhOwQ	document	6-Files.pdf	0
316	71	BQACAgQAAxkBAAJHp2nWxm03dVGiOt7rzmNl-m21uy2JAALoHwAC5_YIUG1odttNqQxBOwQ	document	Cours_Listes_Complet.pdf	0
317	71	BQACAgQAAxkBAAJHqGnWxm2KPnitbT91sdIW7hiVAAG8KgAC6R8AAuf2CFC_Mzi38teVQTsE	document	Pointers_Couse.pdf	0
318	71	BQACAgQAAxkBAAJHqWnWxm2r1EPYiYDS0KgeIksMlHsLAALqHwAC5_YIUB4SNyaF-UhDOwQ	document	Records(course).pdf	0
319	71	BQACAgQAAxkBAAJHqmnWxm1lssbOHqOqydpWSpW76bZrAALrHwAC5_YIUNoTZIPbIKPPOwQ	document	Serie N°1, Records (2024-2025).pdf	0
320	71	BQACAgQAAxkBAAJHq2nWxm053IRbwVNVdbhWp8KH6xBAAALsHwAC5_YIUCMvFzJOMNo3OwQ	document	TD-ALGO2-2024-2025-FILES-en.pdf	0
321	72	BQACAgQAAxkBAAJWBmnaOgABDoD7AXnGYT3g6KaZZ0TVkAACkBsAAuf2EFAg1CFQ_-RqpDsE	document	Worksheet N°1 Variable Descriptive Statistics.pdf	0
322	72	BQACAgQAAxkBAAJWB2naOgAB_3nu2j6aj57-gSvrWEzYbgACkRsAAuf2EFCT6S7g3cfnczsE	document	Worksheet N°2 Simple Linear Regression.pdf	0
323	72	BQACAgQAAxkBAAJWCWnaOgABVDKaARX0T2LnP1TO1mgXzQACkhsAAuf2EFCKdNzpQrWp5TsE	document	Worksheet N°3 Combinatorial Analysis.pdf	0
324	72	BQACAgQAAxkBAAJWCmnaOgABlhPT933VSeKpQnlq7jHnZQAClBsAAuf2EFDc9r6TT6cznjsE	document	Worksheet N°4 Probability Calculation.pdf	0
325	72	BQACAgQAAxkBAAJWC2naOgABQ8g8qx53SIQgmRIxQ2fpiAACkxsAAuf2EFBn0VLuJdnH8TsE	document	Worksheet N°5 Discrete Random Variables.pdf	0
326	72	BQACAgQAAxkBAAJWDGnaOgABYO_oPhErmpsTDiGp3xGrwAAClRsAAuf2EFAGDXdJOu02IDsE	document	Worksheet N°6 Common Discrete Probability.pdf	0
327	72	BQACAgQAAxkBAAJWDWnaOgABUygAAQovSBC9qXB_Avoz0WgAApYbAALn9hBQt6-TD2vMzJ47BA	document	Worksheet N°7 Continuous Random Variables.pdf	0
328	72	BQACAgQAAxkBAAJWDmnaOgABwp7qqnswi0q_9k9f9uddYAAClxsAAuf2EFCgw-OTbRQWhjsE	document	Worksheet N°8 Common Continuous Probability Distributions.pdf	0
329	73	BQACAgQAAxkBAAJhb2nb_hUMS4vwqglI3cdX3PJvO_JIAAKpGgAC07HYUgxEGYKFb8dJOwQ	document	TD 2 L1.pdf	0
330	73	BQACAgQAAxkBAAJhcWnb_hX4mD2ZXoaJ1D3qpNPm1vOnAAKqGgAC07HYUmNdS-hUxZChOwQ	document	TD 3 L1.pdf	0
331	73	BQACAgQAAxkBAAJhcmnb_hUBlu0xt5rEw0g0yf9Py_HCAAICGwAC07HYUlb5YzM3cbX9OwQ	document	Co TD 2 L1.pdf	0
332	74	AgACAgQAAxkDAAJRD2nYi-SSCwN-4aG_JIOoadcskSjKAAKhDGsb3vaYUlZXRiBDxnlTAQADAgADeQADOwQ	photo		0
333	74	AgACAgQAAxkDAAJREWnYi-TUX5mdcC9SNdNU9eQZhjNFAAJmDGsbvJixUsC7-z10j74AAQEAAwIAA3kAAzsE	photo		0
334	74	AgACAgQAAxkBAAJn8mndJyhyr6UT_kFKk1Bjk90n2WoTAAKjDGsb3vaYUmFW2bDjnPcVAQADAgADeQADOwQ	photo		0
335	74	AgACAgQAAxkBAAJn3GndJrW4udgzua35y8Xsv1AGvNgRAAL8DGsbSIbpUiQ-LnpqEvaNAQADAgADeQADOwQ	photo		0
336	74	AgACAgQAAxkBAAJn3mndJrfnBAWneV5SE5tCkTcQXY2uAAL9DGsbSIbpUpUkMwrciylLAQADAgADeQADOwQ	photo		0
337	75	BQACAgQAAxkBAAJtXWnh4xb_cZ_fuvZQ2JQHsPl0npd2AALrHgACtnHwU6GjgaQEJRCSOwQ	document	Examen 6 analyse 1+ solution.PDF	0
338	75	BQACAgQAAxkBAAJtXmnh4xZyZYIHEA8XC-zyN4s7xSxDAALsHgACtnHwU3rAgqFRPp0pOwQ	document	Examen 7 analyse 1+ solution.PDF	0
339	75	BQACAgQAAxkBAAJtX2nh4xb6aM1_GqYMlcxNF1diKzquAALtHgACtnHwU060xhbE-qjoOwQ	document	Examen 8 analyse 1+ solution.PDF	0
340	75	BQACAgQAAxkBAAJtYGnh4xZE60PncvQkl4Ns506NqTTnAALuHgACtnHwU9sg0LE0avHbOwQ	document	Examen 9 analyse 1+ solution.PDF	0
341	75	BQACAgQAAxkBAAJtYWnh4xa5tPpSMqkpxtj6xC5mae3_AALvHgACtnHwU-MR2GWErGKCOwQ	document	Examen 10 analyse 1+ solution.PDF	0
342	75	BQACAgQAAxkBAAJtYmnh4xbZW5AptqJBFoo0g6fKZSoLAALwHgACtnHwUxnxTIXxFmUlOwQ	document	Examen 11 analyse 1+ solution.PDF	0
343	75	BQACAgQAAxkBAAJtY2nh4xYU5zfILn17PzwbzoxfrIn9AALxHgACtnHwU1pfdA8kisQ9OwQ	document	Examen 12 analyse 1+ solution.PDF	0
344	75	BQACAgQAAxkBAAJtZGnh4xbQ9BCpC64o8jN5ouNgXcCaAALyHgACtnHwUwF7E8rPTLvKOwQ	document	Examen 13 analyse 1+ solution.PDF	0
345	75	BQACAgQAAxkBAAJtZWnh4xYihF-WLuMfXkT8TiRH5IITAALzHgACtnHwU7nN2GRh_Zl1OwQ	document	Examen 14 analyse 1+ solution.PDF	0
346	75	BQACAgQAAxkBAAJtZmnh4xYgen1PzvOw4YgmfP4dUc0MAAL0HgACtnHwUxsEhveM0g22OwQ	document	Examen 15 analyse 1+ solution.PDF	0
347	76	AgACAgQAAxkBAAJtg2nh48RvNii9yWjQw9eXTCXy4AyzAAICC2sbw8J4Uj-RdC2y1jyZAQADAgADeQADOwQ	photo		0
348	76	AgACAgQAAxkBAAJthGnh48Sv6VwklQFIFxA5ggmsCl4bAAIDC2sbw8J4Ukh1LOkxkmfsAQADAgADeQADOwQ	photo		0
349	76	AgACAgQAAxkBAAJthWnh48RBg7tbJin-e68JIkatStqQAAIEC2sbw8J4UuhTopeUl7kbAQADAgADeQADOwQ	photo		0
350	76	AgACAgQAAxkBAAJthmnh48QywftKOoYScuCYogfK0QvMAAIFC2sbw8J4Ui6RiMf_0KKuAQADAgADeQADOwQ	photo		0
351	76	AgACAgQAAxkBAAJth2nh48TEztaQuNvsDdb1RPWfqv_kAAIGC2sbw8J4UtR29z-zNEM2AQADAgADeQADOwQ	photo		0
352	76	AgACAgQAAxkBAAJtiGnh48TK_MDJAAG3p2pX8jvLdvu7fwACBwtrG8PCeFL6SoRTLsjJ4QEAAwIAA3kAAzsE	photo		0
353	76	AgACAgQAAxkBAAJtiWnh48RmeDz__0MheYqsX_ZNwffnAAIIC2sbw8J4UgXE4GRhejF5AQADAgADeQADOwQ	photo		0
354	76	AgACAgQAAxkBAAJtimnh48Talz5jBtWPWMPYkzgTBIWeAAIJC2sbw8J4Uj4GDqi6sTcqAQADAgADeQADOwQ	photo		0
355	77	AgACAgQAAxkBAAJtp2nh5JrFNaN8JgtHtFobZDezwAewAAI3DGsbA1VJUbOB9mte-dpCAQADAgADeQADOwQ	photo		0
356	77	AgACAgQAAxkBAAJtqGnh5Jr5Lobrtnfs2-Czc4E3CJ4EAAI4DGsbA1VJUdunduUvg-ElAQADAgADeQADOwQ	photo		0
357	77	AgACAgQAAxkBAAJtqWnh5JqeMVGs1_ZXH48C8aXFzfmDAAI5DGsbA1VJUSf_Yj7PfzYKAQADAgADeQADOwQ	photo		0
358	77	AgACAgQAAxkBAAJtqmnh5Jr8eSrxqKLmH_F0-LU-r2d6AAI6DGsbA1VJUYOa_Autd9yQAQADAgADeQADOwQ	photo		0
359	77	AgACAgQAAxkBAAJtq2nh5JoqqFz5waxUrOdbEL32St3hAAI7DGsbA1VJUfI7JGJn1Xi0AQADAgADeQADOwQ	photo		0
360	77	AgACAgQAAxkBAAJtrGnh5JoO9q0syOxAt5CSxTSDrOhvAAI8DGsbA1VJUSmuwkWan3oaAQADAgADeQADOwQ	photo		0
361	78	AgACAgQAAxkBAAJtwGnh5OFTyZUIetmuSlfqMFWFlweIAAI9C2sb7b0pUPVXNZvrR8yOAQADAgADeQADOwQ	photo		0
362	78	AgACAgQAAxkBAAJtwWnh5OHa5ArmZHde7aBVPZoec9aaAAI-C2sb7b0pUD1-S0xujAdkAQADAgADeQADOwQ	photo		0
363	78	AgACAgQAAxkBAAJtwmnh5OErRlk9SOrU4Byoue0Ngv9EAAI_C2sb7b0pULkEiLC5DZ6nAQADAgADeQADOwQ	photo		0
364	78	AgACAgQAAxkBAAJtw2nh5OGrR-ROm1tTrWcChesAAcBDWQACQAtrG-29KVBBiig6pKPHhQEAAwIAA3kAAzsE	photo		0
365	78	AgACAgQAAxkBAAJtxGnh5OHHxKsEB6GeZ7xOH4ac_E74AAJBC2sb7b0pUHVJTMyhf7TYAQADAgADeQADOwQ	photo		0
366	78	AgACAgQAAxkBAAJtxWnh5OFlk9lrAXF6bZvuCuiScgABewACQgtrG-29KVCWSuHv4QwRVgEAAwIAA3kAAzsE	photo		0
367	78	AgACAgQAAxkBAAJtxmnh5OEcLaSnbSuJKvNMr_Fs52FTAAJDC2sb7b0pUAHNRZOThKxBAQADAgADeQADOwQ	photo		0
368	79	BQACAgQAAxkBAAJt5Wnh5cBGYNMEAUIO2RnI8cEDvPocAAJ6GwACyuLAUlQ8qFYVz1mjOwQ	document	Résumé de Cours Algèbre 1 (1).pdf	0
369	79	BQACAgQAAxkBAAJt5mnh5cAVWh_epY-8r8rK9Z0p_Do9AAJ6GwACR_jIUu4gUay-SvpMOwQ	document	résume algèbre s1  .pdf	0
370	80	BQACAgQAAxkBAAJt9mnh5jMFHFsZm53T6t3LfoSTNiFXAALzFgACaWkIUwphaVy6DsjXOwQ	document	examen2solution_algebre_1_0.pdf	0
371	80	BQACAgQAAxkBAAJt92nh5jODLWa6xy1z4pNDx1LLLwZNAAL0FgACaWkIU0NEufKmvH0_OwQ	document	examen3solution_algebre_1.pdf	0
372	80	BQACAgQAAxkBAAJt-Gnh5jMvQnH-UhRvixGG4tjAVH7hAAL1FgACaWkIUy978iAWxrujOwQ	document	examen4solution_algebre_1_0.pdf	0
373	80	BQACAgQAAxkBAAJt-Wnh5jNI61pSGqrEcEm71uneC05SAAL2FgACaWkIU4MmxnTRh0ZaOwQ	document	examen_5solution_algebre1.pdf	0
374	80	BQACAgQAAxkBAAJt-mnh5jNGx-yc17Ru0-JCXTaTQqP0AAL3FgACaWkIU_ykx4AQgBo1OwQ	document	examen-rattrapage-janvier_2023_0.pdf	0
375	80	BQACAgQAAxkBAAJt-2nh5jN4OQjNvpaZDv5pcHqjvSMIAALJFQACWf15U--0s07EPrelOwQ	document	Algèbre1_2018-2019.pdf	0
376	80	BQACAgQAAxkBAAJt_Gnh5jM_WQbUvVc9pJE-4Bmw1HTWAALKFQACWf15U_wQThaJTSbBOwQ	document	Algèbre1_2017-2018-1.pdf	0
377	80	BQACAgQAAxkBAAJt_Wnh5jMTSduQ3jszM8emlBd7AW3XAALLFQACWf15U3AkEdHWCQEUOwQ	document	Algèbre1_2015-2016-1.pdf	0
378	81	BQACAgQAAxkBAAJuIWnh5sUyIgMUaQr2XqBqCTJq67RcAAI4GwACoXWwUjeDhFVOfvW9OwQ	document	01-EXERCICES-Reels.pdf	0
379	81	BQACAgQAAxkBAAJuImnh5sVV-arDzovUcjClxsvOu43lAAI0GwACoXWwUkC13Z872_4cOwQ	document	012-EXERCICES_bornes_superieures_et_inferieures.pdf	0
380	81	BQACAgQAAxkBAAJuI2nh5sVds6SGIS35mlCAqnP_E2lzAAI2GwACoXWwUgi2On-zWIHFOwQ	document	03-EXERCICES-suites-numériques.pdf	0
381	81	BQACAgQAAxkBAAJuJGnh5sWwVVLhEgZnzQMCOb7owDGRAAI7GwACoXWwUufUWFLJGMatOwQ	document	2025_Exercices_corriges_nombres_complexes.pdf	0
382	81	BQACAgQAAxkBAAJuJWnh5sXg-PZwmPdcnuQUHY6NAfr1AAI3GwACoXWwUm25vUP_bsI-OwQ	document	PDF_1696615836143 (1).pdf	0
383	81	BQACAgQAAxkBAAJuJmnh5sU4Uk_HfqOBT98sLfiKTKU4AAI5GwACoXWwUp0HU3rfKrj2OwQ	document	PDF_1696615896112 (1).pdf	0
384	81	BQACAgQAAxkBAAJuJ2nh5sXMb8Jv0m-o0D_-OxQmZGmVAAI6GwACoXWwUjX1GE4f6_qkOwQ	document	interrogation Agèbre1  (1).pdf	0
385	81	BQACAgQAAxkBAAJuKGnh5sVR6pSlzoFgC3WTEtkvpGP2AAI-GwACoXWwUrGdTAGDnSw1OwQ	document	Correction_examen_algebre1_2023_2024_.pdf	0
386	81	BQACAgQAAxkBAAJuKWnh5sVKgSNl4nECrL_kV3IQZp1QAAI_GwACoXWwUrHmWu6r_OTJOwQ	document	2025_Exercices_corriges_nombres_complexes.pdf	0
387	82	BQACAgQAAxkBAAJuIWnh5sUyIgMUaQr2XqBqCTJq67RcAAI4GwACoXWwUjeDhFVOfvW9OwQ	document	01-EXERCICES-Reels.pdf	0
389	82	BQACAgQAAxkBAAJuImnh5sVV-arDzovUcjClxsvOu43lAAI0GwACoXWwUkC13Z872_4cOwQ	document	012-EXERCICES_bornes_superieures_et_inferieures.pdf	0
391	82	BQACAgQAAxkBAAJuI2nh5sVds6SGIS35mlCAqnP_E2lzAAI2GwACoXWwUgi2On-zWIHFOwQ	document	03-EXERCICES-suites-numériques.pdf	0
393	82	BQACAgQAAxkBAAJuJGnh5sWwVVLhEgZnzQMCOb7owDGRAAI7GwACoXWwUufUWFLJGMatOwQ	document	2025_Exercices_corriges_nombres_complexes.pdf	0
395	82	BQACAgQAAxkBAAJuJWnh5sXg-PZwmPdcnuQUHY6NAfr1AAI3GwACoXWwUm25vUP_bsI-OwQ	document	PDF_1696615836143 (1).pdf	0
397	82	BQACAgQAAxkBAAJuJmnh5sU4Uk_HfqOBT98sLfiKTKU4AAI5GwACoXWwUp0HU3rfKrj2OwQ	document	PDF_1696615896112 (1).pdf	0
399	82	BQACAgQAAxkBAAJuJ2nh5sXMb8Jv0m-o0D_-OxQmZGmVAAI6GwACoXWwUjX1GE4f6_qkOwQ	document	interrogation Agèbre1  (1).pdf	0
401	82	BQACAgQAAxkBAAJuKGnh5sVR6pSlzoFgC3WTEtkvpGP2AAI-GwACoXWwUrGdTAGDnSw1OwQ	document	Correction_examen_algebre1_2023_2024_.pdf	0
403	82	BQACAgQAAxkBAAJuKWnh5sVKgSNl4nECrL_kV3IQZp1QAAI_GwACoXWwUrHmWu6r_OTJOwQ	document	2025_Exercices_corriges_nombres_complexes.pdf	0
388	82	BQACAgQAAxkBAAJuRmnh5w_4PG22V7ADjTUsJWwL_c1eAAJpHAACVdfJUsy-275dcganOwQ	document	Correction_examen_algebre1_2023_2024_.pdf	0
390	82	BQACAgQAAxkBAAJuR2nh5w_7m8pE8AYtt5PIDa3mPyJ1AAJfHAACVdfJUmTFfLdl0yn5OwQ	document	interrogation Agèbre1  (1).pdf	0
392	82	BQACAgQAAxkBAAJuSGnh5w-IMpCVHQEHUwShxZOIaWouAAJiHAACVdfJUrklCVCKk7q0OwQ	document	examen algèbre1 _2023_2024_ (1).pdf	0
394	82	BQACAgQAAxkBAAJuSWnh5w-8KwABu8tM1EcDGS8cdsjUVAACYRwAAlXXyVJnQlHRMA61NTsE	document	Examen rattrapage Algèbre 1 _2023_2024_.pdf	0
396	82	BQACAgQAAxkBAAJuSmnh5w8CPTvM2fqZbzeRsLovz_YtAAJgHAACVdfJUkynhgbAXuSZOwQ	document	Examen(remplacement)Algèbre1 _2023_2024_.pdf	0
398	82	BQACAgQAAxkBAAJuS2nh5w9qErvIaAHsObCZgqacD0NnAAJkHAACVdfJUj_QaojaFfMxOwQ	document	Examen algèbre_.pdf	0
400	82	BQACAgQAAxkBAAJuTGnh5w_WN8AccmVdjcMJw4p6Lv42AAJlHAACVdfJUvnZ6Dqkkaj6OwQ	document	Interrogation n°2 .pdf	0
402	82	BQACAgQAAxkBAAJuTWnh5w-la0hL1mnU5_TWXUUtydEwAAJjHAACVdfJUrknlcWPVqxdOwQ	document	Interrogation N°1 (1).pdf	0
404	94	BQACAgQAAyEGAATSnlpUAAICLWnjQPx-_iKg2cE-CUuTya5lx1CnAALvIAAC_SlQUAQyMYJFzcrDOwQ	document	course 02.pdf	0
405	94	BQACAgQAAyEGAATSnlpUAAICLWnjQPx-_iKg2cE-CUuTya5lx1CnAALvIAAC_SlQUAQyMYJFzcrDOwQ	document	course 02.pdf	0
406	56	BQACAgQAAxkDAAJtAmnhxC1ljyj3Y32x_gUabOQM4_HYAAL5AgACttRxUhOHd139UZrtOwQ	document	PL-SQL tutorial.pdf	0
407	56	BQACAgQAAxkDAAJtAmnhxC1ljyj3Y32x_gUabOQM4_HYAAL5AgACttRxUhOHd139UZrtOwQ	document	PL-SQL tutorial.pdf	0
408	96	BQACAgQAAxkDAAJvZ2niCXfkp2EjYnmBeS4ZqHca2zQsAALMIAACmu3YUuo-yUup3CXLOwQ	document	Series of exercise 03.pdf	0
409	96	BQACAgQAAxkDAAJvZ2niCXfkp2EjYnmBeS4ZqHca2zQsAALMIAACmu3YUuo-yUup3CXLOwQ	document	Series of exercise 03.pdf	0
410	96	BQACAgQAAxkBAAJ6GGnjZXULJWNzwnSrAAEN_X-JEllLuAACBR8AAjeM8FI9nj3b2Zq6KzsE	document	Series of exercise 03.pdf	0
411	96	BQACAgQAAxkBAAJ6GGnjZXULJWNzwnSrAAEN_X-JEllLuAACBR8AAjeM8FI9nj3b2Zq6KzsE	document	Series of exercise 03.pdf	0
412	96	BQACAgQAAxkBAAJ6KGnjZaQqw6nssT2TUZ0lf-rzwoTLAAJZHwACglAQURxzsSAS0YqtOwQ	document	2. Linear map.pdf	0
413	96	BQACAgQAAxkBAAJ6KGnjZaQqw6nssT2TUZ0lf-rzwoTLAAJZHwACglAQURxzsSAS0YqtOwQ	document	2. Linear map.pdf	0
414	97	AgACAgQAAxkBAAJ6dmnjidEQ2DAgmF8gTBpDCb6G-f7WAALzDGsbJV4gU9PW9dAGcPy_AQADAgADeQADOwQ	photo	🖼️ صورة	0
415	97	AgACAgQAAxkBAAJ6d2njidH2lbqXCXhjnbQdDoNr9hSjAAL0DGsbJV4gUyp2JP0YM2APAQADAgADeQADOwQ	photo	🖼️ صورة	0
416	97	AgACAgQAAxkBAAJ6fWnjiepm_D-xt2a64ZgcSUGjai07AAL1DGsbJV4gU3pm_f4TZEjQAQADAgADeQADOwQ	photo	🖼️ صورة	0
417	9	BQACAgQAAxkDAAJtAmnhxC1ljyj3Y32x_gUabOQM4_HYAAL5AgACttRxUhOHd139UZrtOwQ	document	PL-SQL tutorial.pdf	0
418	9	BQACAgQAAxkBAAKMhWnn80OmugacPz_mbK2Ud8G0QAABugAClCMAAkY42VHRZTeAUhFuVTsE	document	QCM Thermodynamique (Chimie 2) .pdf	0
419	99	BQACAgQAAyEFAATeYyKOAAIEVWnn2gl4w4VygsSNyN5MT8PHjwABhgACFCYAAnPnkFGrVBfmet9f8jsE	document	Cours NÂ°1 Logique Prop Le Langage 2024-2025.pptx	0
420	99	BQACAgQAAyEFAATeYyKOAAIEVmnn2glV0J787lTNY5ZBVqkgBHi3AAIVJgACc-eQUTH88RrJty_DOwQ	document	Cours NÂ°2 Logique Prop Systeme Deductif 2024-2025.pptx	0
421	99	BQACAgQAAyEFAATeYyKOAAIEV2nn2gl1HJeEoujBtnsFGevYY2vhAAIWJgACc-eQUYcZFFaeidABOwQ	document	Cours NÂ°3 Logique Prop Semantique -Alg Refutation.pptx	0
422	99	BQACAgQAAyEFAATeYyKOAAIEWWnn2gnyLr11NOXmXoyM60xXBNtJAAKZGQACIoLpUBmm92ANB-EEOwQ	document	CamScanner 24-2-2026 09.01.pdf	0
423	99	BQACAgQAAyEFAATeYyKOAAIEWmnn2gn3G6JLG5jp74aU71Yr1h8jAAI6HQACs_4oUXe5rx93t7kCOwQ	document	SOLUTION TD4.PDF	0
424	99	BQACAgQAAyEFAATeYyKOAAIEW2nn2gkzE2U2hHd12NxOQp4lOVk2AALyIAACdZnZUslXSZzSbLPtOwQ	document	Corrigé Serie2. Logique des propositions.pdf	0
425	99	BQACAgQAAyEFAATeYyKOAAIET2nn2gla5C64UsGiQpm1ktrBskneAAJSHgAClUTAULSM9HaST7tiOwQ	document	12 Logique Mathématique - TD6.mp4	0
426	99	BQACAgQAAyEFAATeYyKOAAIEUGnn2gk1g0re1KSMcBRL0BZldKaBAAJTHgAClUTAUG8eW4iz5pvtOwQ	document	13 Logique Mathématique - TD7.mp4	0
427	99	BQACAgQAAyEFAATeYyKOAAIEUWnn2gn7JfNrjUM7auY5XR7Zqf_tAAJWHgAClUTAUANFV7f-AxoCOwQ	document	14 Logique Mathématique - TD8.mp4	0
428	99	BQACAgQAAyEFAATeYyKOAAIEUmnn2gnf2JvkNfIbxaYr2U9sEmc4AAJUHgAClUTAUO_2pcdhLtxAOwQ	document	15 Logique Mathématique - Révision.mp4	0
429	100	BQACAgQAAxkBAAKQv2nomdSNodYvG8FQBt3_upghYpYrAAK9AgACaXkXAAGy4ioDWRHzwDsE	document	Christopher_P_Holstege_Matthew_P.pdf	0
430	100	BQACAgQAAxkBAAKQwGnomdRXRjL7vt_1rLd9rYK3QnwDAALwAQACaXkXAAEI53DsdAP-uTsE	document	Frank_C_Lu,_Sam_Kacew_Lu's_Basic.pdf	0
431	100	BQACAgQAAxkBAAKQwWnomdSAFvEWttC47WiNOMPnfMXxAALvAQACaXkXAAF3Eyd0Klo-CTsE	document	Phillip_L_Williams,_Robert_C_James.pdf	0
432	101	BQACAgQAAyEFAATSnlpUAAIFLmnr6FxCZ4GXKBcoeld5amZtO6oQAAJgHQACFIu4Upn6mkUQDEsFOwQ	document	Chapter IV. Linked Lists (Session N°1).pdf	0
433	101	BQACAgQAAyEFAATSnlpUAAIFL2nr6FzqNEoQLfJD0E5wgEnc0EhJAAJhHQACFIu4Uhuvb1jvKUCEOwQ	document	Chapter IV. Linked Lists (Session N°2).pdf	0
434	101	BQACAgQAAyEFAATSnlpUAAIFMGnr6FwversCVJluetO8g2GUrGn_AAJiHQACFIu4UrvBnYVaKoMDOwQ	document	Chapter IV. Linked Lists (Session N°3).pdf	0
435	101	BQACAgQAAyEFAATSnlpUAAIFMWnr6Fzj37jnFMwaZOG_i4gogtYHAAJjHQACFIu4Ur5TjgRFNQE3OwQ	document	Chapter IV. Linked Lists (Session N°4).pdf	0
436	101	BQACAgQAAyEFAATSnlpUAAIFMmnr6Fx_sg6iobM9rAWYFIsq22aiAAJkHQACFIu4Ur3_3EbKdNmROwQ	document	Chapter IV. Linked Lists (Session N°5.1).pdf	0
437	102	AgACAgQAAxkBAAK6lWn2X7sltkqa53zMV4GOSFPhFzf8AAJoDGsbuLOwUziE-PqRG7umAQADAgADeQADOwQ	photo	🖼️ صورة	0
438	102	AgACAgQAAxkBAAK6lmn2X7s9I-MwaVRdZ_Fpp5u4y3WwAAJpDGsbuLOwU-AAAdgKY89w1wEAAwIAA3kAAzsE	photo	🖼️ صورة	0
439	102	AgACAgQAAxkBAAK6l2n2X7uDot-YncfYZCK09s0dukV7AAJqDGsbuLOwU109GSg2wx92AQADAgADeQADOwQ	photo	🖼️ صورة	0
440	102	AgACAgQAAxkBAAK6mGn2X7ut7Mss6jtPQC_0_fDQLWFhAAJrDGsbuLOwU3q02HP2mjFbAQADAgADeQADOwQ	photo	🖼️ صورة	0
441	102	AgACAgQAAxkBAAK6mWn2X7tSMD4grbn1lqp9PGN1BeRNAAJsDGsbuLOwU0piaVX6oniZAQADAgADeQADOwQ	photo	🖼️ صورة	0
442	102	AgACAgQAAxkBAAK6mmn2X7v0hpFGLl8oDykwNFqtFYivAAJtDGsbuLOwU6JXcNwfVxHqAQADAgADeQADOwQ	photo	🖼️ صورة	0
443	102	AgACAgQAAxkBAAK6m2n2X7u-qmgFKYxGgzJ7LbK7aucxAAJuDGsbuLOwU_tXJjj54d9pAQADAgADeQADOwQ	photo	🖼️ صورة	0
444	103	AgACAgQAAxkBAAK6nGn2X7ug39rhW8jvgaLOFpNGMYFeAAJvDGsbuLOwUzrcrJHuUUbmAQADAgADeQADOwQ	photo	🖼️ صورة	0
445	103	AgACAgQAAxkBAAK6nWn2X7v8wk_KmjiAiBDjJAyIgw9lAAJwDGsbuLOwU7jOZTnWtQJ6AQADAgADeQADOwQ	photo	🖼️ صورة	0
446	103	AgACAgQAAxkBAAK6nmn2X7tLh7YlogIVAmbzH0QYCda2AAJxDGsbuLOwU00czxSqjBKrAQADAgADeQADOwQ	photo	🖼️ صورة	0
447	103	AgACAgQAAxkBAAK6n2n2X7s6N98KQV7lTBpS0zonPDn5AAJyDGsbuLOwUz9_vuFP1vdpAQADAgADeQADOwQ	photo	🖼️ صورة	0
448	104	AgACAgQAAxkBAAK6oGn2X7unhv3UsV0tVM38HNiTMUCpAAJzDGsbuLOwU12E8JZiIOLyAQADAgADeQADOwQ	photo	🖼️ صورة	0
449	104	AgACAgQAAxkBAAK6oWn2X7sTun4Jk9waY0Kf_3gZmGpRAAJ0DGsbuLOwU_fcYwrH90O5AQADAgADeQADOwQ	photo	🖼️ صورة	0
450	104	AgACAgQAAxkBAAK6omn2X7sj98BlyCxmslofF1Yh9DAUAAJ1DGsbuLOwU6jgdw4G0u9iAQADAgADeQADOwQ	photo	🖼️ صورة	0
451	104	AgACAgQAAxkBAAK6o2n2X7tTs5qJ-dbQ1RsQW15R6ewJAAJ2DGsbuLOwU73UjQoM_pJXAQADAgADeQADOwQ	photo	🖼️ صورة	0
452	104	AgACAgQAAxkBAAK6pGn2X7sgtVJQcSeBDmfSPEH_XFGjAAJ3DGsbuLOwUzRnoiEdvpzIAQADAgADeQADOwQ	photo	🖼️ صورة	0
453	104	AgACAgQAAxkBAAK6pWn2X7v6VBaU7IUyrmgbWlOujImxAAJ4DGsbuLOwU4ZjUfGemBxrAQADAgADeQADOwQ	photo	🖼️ صورة	0
454	105	AgACAgQAAxkBAAK6pmn2X7v5MYUD-NlNaz-j1LbkV59WAAJ5DGsbuLOwU7iPn4HdSVu6AQADAgADeQADOwQ	photo	🖼️ صورة	0
455	105	AgACAgQAAxkBAAK6p2n2X7s5LGmejsHHnO55GYWjft1rAAJ6DGsbuLOwU5qgwNpX0QEXAQADAgADeQADOwQ	photo	🖼️ صورة	0
456	105	AgACAgQAAxkBAAK6qGn2X7tWft5WVtaPf9tCmhY72nztAAJ7DGsbuLOwU9EsBq3K-IJWAQADAgADeQADOwQ	photo	🖼️ صورة	0
457	106	BQACAgQAAxkBAAK7oWn2bNx_DeSH5m-OA7pLq44WQ8O3AALeIwAC9RHgUCAZfpARBDH8OwQ	document	series 2(1).pdf	0
458	106	BQACAgQAAxkBAAK7j2n2bEjv5_I_XX_zyGqklv-PaWs8AALGMQACBclBUr61BT7hmdlJOwQ	document	P2Series 2- Part 2.pdf	0
459	106	BQACAgQAAxkBAAK7kGn2bEgJcMLoWjzaSZZTaNRR7tCoAAL8HgACFKsIU4IHzYDvoAfWOwQ	document	Phys2-Series2-part4.docx	0
460	106	BQACAgQAAxkBAALeMWn-MxQZDJC9toIvjxaYvZ2SrWdkAALeIwAC9RHgUCAZfpARBDH8OwQ	document	series 2(1).pdf	0
461	106	BQACAgQAAxkBAALeMmn-MxQZHsWFEe1_sNLki5ud3iT_AALGMQACBclBUr61BT7hmdlJOwQ	document	P2Series 2- Part 2.pdf	0
462	106	BQACAgQAAxkBAALeM2n-MxTzwY6Oo-9Cd7fh2UZmAv7KAAJzHwACbgGxUg17NTwGbZbuOwQ	document	Physics 2-Series 2-Part 3.pdf	0
463	106	BQACAgQAAxkBAALeNGn-MxSuTfwTb-kAAZX7JpLZMkierwACaRwAAteJ4VMub9E42qtq7jsE	document	Phys2-Series2-part4.pdf	0
464	107	AgACAgQAAxkBAALiv2oCZbQeZJOmp6t_43WP1Tm7QUxzAALyDmsb8DIIUIt-CaC_RrHdAQADAgADeQADOwQ	photo	🖼️ صورة	0
465	107	AgACAgQAAxkBAALiwGoCZbTdVHfByEiEmQjZuqfkxmFMAALzDmsb8DIIUA0VKN_vahh6AQADAgADeQADOwQ	photo	🖼️ صورة	0
466	107	AgACAgQAAxkBAALiwWoCZbQmTdTOxQzQXqf1ClLfEXsYAAL0Dmsb8DIIUB_IKrGVa808AQADAgADeQADOwQ	photo	🖼️ صورة	0
467	107	AgACAgQAAxkBAALiwmoCZbS1b6OnBPxy-r78RMZ6cZt4AAL1Dmsb8DIIUMo6vfK7L3vnAQADAgADeQADOwQ	photo	🖼️ صورة	0
468	107	AgACAgQAAxkBAALiw2oCZbResNuyEwjM6M7NY-wKXg9BAAL2Dmsb8DIIUM7vtfkwtiWwAQADAgADeQADOwQ	photo	🖼️ صورة	0
469	108	AgACAgQAAxkBAALmgGoGfnS5ww4SAAF8gDAMS0XrpzfmkQACcg5rG9ifOVDu4LFcAAHVmQsBAAMCAAN5AAM7BA	photo	🖼️ صورة	0
470	108	AgACAgQAAxkBAALmgWoGfnQg-YKQQ9qDreWui8zKN8nJAAJzDmsb2J85UARKZYDpp9_vAQADAgADdwADOwQ	photo	🖼️ صورة	0
471	108	AgACAgQAAxkBAALmgmoGfnR1wT4VrKkZEWscCw0nsGn3AAJ0Dmsb2J85UJILIj-NFDDcAQADAgADeQADOwQ	photo	🖼️ صورة	0
472	108	AgACAgQAAxkBAALmg2oGfnTiD-aQmHHGtG53RYxB1XcRAAJ1Dmsb2J85UHffUd28br7RAQADAgADeQADOwQ	photo	🖼️ صورة	0
473	108	AgACAgQAAxkBAALmhGoGfnSip2P37pAtwapQ_d51iPIJAAJ2Dmsb2J85UCwrCfQqtRGJAQADAgADeQADOwQ	photo	🖼️ صورة	0
474	108	AgACAgQAAxkBAALmhWoGfnR1ETuGKUiLc6BAVYN6_8WWAAJ3Dmsb2J85UCXX6dV7pVoDAQADAgADeQADOwQ	photo	🖼️ صورة	0
475	108	AgACAgQAAxkBAALmhmoGfnRH21IkN1E0xV0dZZgU747mAAJ4Dmsb2J85UIQKKUQM-JoTAQADAgADeQADOwQ	photo	🖼️ صورة	0
476	108	AgACAgQAAxkBAALmh2oGfnSA1BbqHvvqN4SXCtyeAAG5jwACeQ5rG9ifOVCO6gAB3BhHrsABAAMCAAN5AAM7BA	photo	🖼️ صورة	0
477	108	AgACAgQAAxkBAALmiGoGfnQ5Ulp_M2nRLnuHFey0ZZbkAAJ6Dmsb2J85UFMPuJqvhk8tAQADAgADeQADOwQ	photo	🖼️ صورة	0
478	108	AgACAgQAAxkBAALmiGoGfnQ5Ulp_M2nRLnuHFey0ZZbkAAJ6Dmsb2J85UFMPuJqvhk8tAQADAgADeQADOwQ	photo	🖼️ صورة	0
479	108	AgACAgQAAxkBAALn9GoGwb9tA5Lq3o7m2ipnePslUJXYAAKyDmsb2J85ULOfYxK8Itl4AQADAgADeQADOwQ	photo	🖼️ صورة	0
480	109	AgACAgQAAxkBAAL3y2oMw1VExX5-Uw8BSWVVRA4lt_asAAI7DmsbgcJoULfIu9vukKReAQADAgADdwADOwQ	photo	🖼️ صورة	0
481	109	AgACAgQAAxkBAAL3zGoMw1U9WnjvN1t-M01cOxHtL16HAAI8DmsbgcJoUHU-FlzBMX_iAQADAgADdwADOwQ	photo	🖼️ صورة	0
482	109	AgACAgQAAxkBAAL3zWoMw1WCfyzVJQvf8Bt1WsrDQENRAAI9DmsbgcJoUBWixs_Sq9f5AQADAgADdwADOwQ	photo	🖼️ صورة	0
\.


--
-- Data for Name: bundles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bundles (id, category_id, title, description, downloads, created_at, uploaded_by, is_deleted) FROM stdin;
18	85	Hssh	Heeh	0	2026-04-02 23:35:28	0	0
19	85	ثخخثث	هثخ	0	2026-04-02 23:36:50	0	0
27	30	Sss	Eue	0	2026-04-03 21:28:18.890741	5534474259	1
28	33	Sjs	Hee	0	2026-04-03 21:34:51.013653	5534474259	1
10	71	Cours	Cours 1234567	0	2026-04-01 20:35:35	0	1
22	71	Cours	Cours 1234567	0	2026-04-03 10:49:37.158121	5534474259	1
23	71	Cours	Cour 1234567	0	2026-04-03 10:51:27.492845	5534474259	1
24	71	Cours	Cour 134567	0	2026-04-03 11:05:28.21331	5534474259	1
17	66	ملخصات فصل الاول	Skip	2	2026-04-01 22:29:11	0	1
2	78	دروس و تمارين متنوعة	Revesion	4	2026-04-01 13:33:42	0	1
1	78	تمارين اضافية	Skip	2	2026-04-01 13:15:15	0	1
29	6	Algo	Skip	0	2026-04-03 21:45:12.205292	5534474259	1
4	3	Solution td 5	حل سيري 2 اناليز 1	2	2026-04-01 19:44:57	0	1
30	30	Ffff	Ff	1	2026-04-03 21:49:12.63607	5534474259	1
3	3	Solutions td 1	حل سيري 1 اناليز 1	0	2026-04-01 19:43:47	0	1
16	65	Exam 2025	Skip	1	2026-04-01 22:25:10	0	1
5	3	Solution td 4	حل سيري 4 اناليز 1	1	2026-04-01 19:47:04	0	1
31	71	Shs	Ss	1	2026-04-03 22:04:39.864951	5534474259	1
37	3	Crrect serie 4	Skip	1	2026-04-04 04:05:42.731358	5534474259	1
8	74	Chapters(12345)	Chapter 1234	4	2026-04-01 20:24:55	0	1
32	28	تمارين مختلفة	Skip	0	2026-04-03 22:48:14.873481	5534474259	1
33	78	Exercices	Skip	0	2026-04-03 22:50:05.068483	5534474259	1
25	87	Hd	Skip	1	2026-04-03 11:40:20.074675	5534474259	1
38	71	Ss	Ss	0	2026-04-04 07:59:19.856895	5534474259	1
26	84	ثعع	عثع	0	2026-04-03 14:22:47.902279	5534474259	1
6	76	Exam sem1 24/25	Skip	1	2026-04-01 19:49:33	0	1
45	124	Analyse resourses 1	Skip	1	2026-04-04 21:18:50.247264	5534474259	1
40	120	Exercices ✅️	Skip	1	2026-04-04 08:13:37.59328	5534474259	1
39	120	Exercices with solution	Skip	1	2026-04-04 08:10:46.66609	5534474259	0
49	130	تطوير مواقع	Ski0	1	2026-04-05 02:40:57.974654	5534474259	1
47	129	مجموعة كتب	كتب الجبر مهمة و مفيدة جدا	0	2026-04-04 21:55:35.072189	5534474259	1
7	18	كتب مهمة	Skip	0	2026-04-01 19:51:54	0	1
41	126	Music	🎵	0	2026-04-04 18:38:26.710513	5534474259	1
58	6	Solution serie 3	حل سيري 3( algo 2)	0	2026-04-05 21:07:59.546234	5534474259	1
43	127	Td ( تمارين مختلفة )	Skip	4	2026-04-04 19:20:28.442688	5534474259	1
54	130	البرمجة بلغة السي شارب	Skip	0	2026-04-05 03:08:25.915587	5534474259	1
36	117	تمارين مختلفة	Skip	3	2026-04-03 23:31:31.011708	5534474259	1
11	71	Cours	Cours 1234567	35	2026-04-01 20:42:07	0	1
57	132	كتب  إرفين يالوم	Skip	0	2026-04-05 13:09:27.936591	5534474259	1
59	6	Solution serie 3	حل سيري linked listes	0	2026-04-05 21:09:54.362255	5534474259	1
21	73	تيثني	تيي	0	2026-04-03 10:49:07.099995	5534474259	1
48	122	كتب مهمة	كتب الجابر مهمة	6	2026-04-04 21:58:57.316295	5534474259	1
15	72	Series tp	Skip	1	2026-04-01 20:50:37	0	1
14	72	Series tp	Skip	0	2026-04-01 20:48:02	0	1
13	72	Cours	Cour 1234567	1	2026-04-01 20:44:58	0	1
61	80	Cours	Skip	0	2026-04-06 20:37:18.088033	5534474259	1
62	80	Cours	Skip	0	2026-04-06 20:40:12.592779	5534474259	1
63	80	Cours	Skip	2	2026-04-06 20:41:36.918661	5534474259	1
64	80	Cours	Skip	1	2026-04-06 20:43:58.887985	5534474259	1
65	80	Cours	Skip	0	2026-04-06 20:45:19.208789	5534474259	1
66	80	Cours	Skip	1	2026-04-06 20:46:31.4629	5534474259	1
91	134	Wae	Asip	0	2026-04-18 09:49:03.073944	5534474259	1
90	134	حزمة	Skip	0	2026-04-18 09:36:18.825162	5534474259	1
92	130	Psps	Skip	0	2026-04-18 09:59:36.74763	5534474259	1
82	69	Exams (2)	اختبارات متنوعة مع لحل	1	2026-04-17 07:54:31.872958	5534474259	1
93	130	Pee	Skip	0	2026-04-18 10:05:51.958668	5534474259	1
94	130	Pss	Skip	0	2026-04-18 10:16:52.980663	5534474259	1
95	130	Psss	Skip	0	2026-04-18 11:04:18.476695	5534474259	1
70	134	Elgebra 2	Skip	0	2026-04-08 21:16:23.172945	5534474259	1
96	130	Pss	Skip	2	2026-04-18 11:05:19.319701	5534474259	1
83	71	Cours(1234567)	Skip	0	2026-04-18 07:00:19.07187	5534474259	1
71	127	Cours +++	Skip	6	2026-04-08 21:19:51.158037	5534474259	0
84	71	Cours (1234567)	Skip	0	2026-04-18 07:21:12.65278	5534474259	1
85	19	Algo 2	Skip	0	2026-04-18 08:50:29.050512	5534474259	1
76	3	Solution serie 4	Skip	11	2026-04-17 07:39:28.206284	5534474259	0
52	130	📚 برمجة الويب	Skip	12	2026-04-05 02:52:29.442247	5534474259	0
80	69	Exams 1	اختبارات متنوعة	15	2026-04-17 07:50:23.711695	5534474259	0
34	78	دروس من مصادر مختلفة	Skip	13	2026-04-03 22:51:32.650885	5534474259	0
53	130	📚 شبكات الحاسوب	Skip	11	2026-04-05 02:55:00.334572	5534474259	0
12	72	Series	All labss	51	2026-04-01 20:43:10	0	0
50	130	📚 تطبيقات\nقواعد البيانات	Skip	14	2026-04-05 02:44:49.409444	5534474259	1
68	80	Cours ( part 2)	Skip	27	2026-04-06 20:50:03.624926	5534474259	0
55	130	📚 نظم المعلومات	Skip	9	2026-04-05 07:25:36.283996	5534474259	0
60	129	كتب الجبر	Skip	29	2026-04-06 19:25:35.055515	5534474259	0
75	4	Exams	اختبارات متنوعة اناليز 1	5	2026-04-17 07:37:36.402282	5534474259	0
35	78	تمارين مختلفة	Skip	12	2026-04-03 22:52:13.700085	5534474259	0
44	127	Tp with solution	Skip	7	2026-04-04 19:23:45.328669	5534474259	0
46	124	Resourses analyse	Skip	63	2026-04-04 21:21:12.043346	5534474259	0
74	6	Solution serie 3	Skip	17	2026-04-13 17:25:38.369931	5534474259	0
81	4	Exams (2)	اختبارات مع لحل	10	2026-04-17 07:52:46.697145	5534474259	0
79	66	ملخصات شاملة	ملخصات جبر 1	9	2026-04-17 07:48:46.15213	5534474259	0
56	130	📚 أساسيات البرمجة	Skip	22	2026-04-05 10:41:43.375683	5534474259	0
77	3	Solution serie 2	Skip	9	2026-04-17 07:43:44.950989	5534474259	0
86	134	Algo 2	https://perso.usthb.dz/~snouri/thermodynamique.pdf	0	2026-04-18 09:19:55.821904	5534474259	1
69	6	Solution setie 3	Linked listes	8	2026-04-08 19:39:20.974578	5534474259	1
87	134	قنواة مهمة	Skip	0	2026-04-18 09:21:07.487452	5534474259	1
88	134	Algo 2	Skip	0	2026-04-18 09:28:12.676379	5534474259	1
97	130	Pzzs	Skip	3	2026-04-18 13:40:19.723567	5534474259	1
89	134	حزمة	Skip	0	2026-04-18 09:29:41.027311	5534474259	1
42	127	Cours 1	دروس linked listes و struct ....	9	2026-04-04 19:19:30.018989	5534474259	0
98	130	مواقع فيدة 🗞	Skip	0	2026-04-21 21:00:21.487496	5534474259	1
99	124	تمارين و دروس logic	Skip	3	2026-04-21 22:54:16.935767	5534474259	1
100	141	Tixicology	Skip	1	2026-04-22 09:49:46.72057	5534474259	1
101	28	Exercieces algo 2	Linked listes exercices	1	2026-04-24 22:02:59.202667	5534474259	1
51	130	📚 أمن المعلومات	Skip	16	2026-04-05 02:51:45.591095	5534474259	0
78	3	Solution serie 1	حل سيري 1 اناليز 1	10	2026-04-17 07:44:40.250162	5534474259	0
72	117	تمارين مختلفة 2	Skip	55	2026-04-11 12:09:41.269284	5534474259	0
104	150	Resumè chapter 3	Skip	3	2026-05-02 21:02:04.484393	5534474259	0
67	80	Cours (part 1)	Skip	46	2026-04-06 20:48:33.724201	5534474259	0
106	153	Serie 2	Serie 2 part 1/2/4	6	2026-05-03 07:26:08.158398	5534474259	1
109	65	Jj	Skip	2	2026-05-19 20:07:45.170487	5534474259	0
73	25	Exercices	Skip	13	2026-04-12 20:18:33.697994	5534474259	0
107	124	Exams 2024/2025	Skip	3	2026-05-11 23:27:35.316059	5534474259	0
108	124	Exams tous les modules	Skip	6	2026-05-15 02:00:05.120507	5534474259	0
105	150	Resumè chapter 4	Skip	5	2026-05-02 21:02:32.050964	5534474259	0
103	150	Resumè chapter 2	Skip	2	2026-05-02 20:53:27.940155	5534474259	0
102	150	Resumè chapter 1	Skip	5	2026-05-02 20:52:47.066834	5534474259	0
9	74	Chapters 1234567	Chapters(12345)	57	2026-04-01 20:28:53	0	0
\.


--
-- Data for Name: cache_store; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cache_store (key, value, expires_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, subject_id, name, is_deleted) FROM stdin;
1	2	Cours	0
2	2	Td	0
3	2	Solution ✅️	0
4	2	Exams / quizs	0
5	7	Cours	0
6	7	Td	0
7	7	Solutions ✅️	1
8	7	Exaams / quizs	0
9	8	Cours	0
10	8	Td	0
13	11	Cours	0
14	11	Td	0
15	11	Tp	0
17	11	Exams / quizs	0
18	9	Cours	0
19	9	Td	0
21	9	Exams / quisz	0
22	12	Cours	0
23	12	Td	0
25	12	Exams / quizs	0
26	10	Cours	0
27	10	Td	0
28	7	Exercices	0
29	14	Cours	0
30	1	Cours	0
31	1	Td	0
32	1	Tp	1
33	1	Solutions ✅️	0
34	15	Pro	0
35	7	YOUTUBE	1
36	16	Cours	0
42	21	دروس	0
43	21	ملخصات	0
44	21	تمارين و اختبارات	0
45	21	مواضيع بكالوريا	0
46	25	دروس	0
47	25	اختبارات و تمارين	0
48	25	مواضيع بكالوريا	0
49	24	تمارين و اختبارات	0
50	24	دروس	0
51	24	مواضيع بكالوريا مع لحل	0
52	24	ملخصات	0
53	22	تمارين و اختبارات	0
54	22	مواضيع بكالوريا مع لحل	0
55	22	ملخصات	0
56	22	دروس	0
61	20	تمارين و اختبارات	0
62	20	دروس	0
63	20	مواضيع بكالوريا	0
64	20	ملخصات	0
65	1	Exams with solutions	0
66	3	Cours	0
67	3	Td	0
68	3	Solution ✅️	0
69	3	Exams with solutions	0
70	6	Cours	0
71	4	Cours	0
72	4	Tp	0
74	5	Cours	0
75	5	Td	0
76	5	Exams	0
77	4	Exams / solutions	0
78	9	تمارين اضافية و اختبارات	0
79	29	Endo	0
80	34	Sémiologie	0
81	34	Physiopathologie	0
82	34	Biochimie	0
83	34	Radiologie	0
84	13	Tp	0
85	35	Cours	0
87	8	تمارين و اختبارات مع لحل	0
88	43	دروس	0
89	43	اختبارات و تمارين	0
90	43	ملخصات شاملة	0
91	43	مواضيع بكالوريا	0
92	48	اختبارات و تمارين	0
93	48	دروس	0
94	48	ملخصات شاملة	0
95	48	مواضيع بكالوريا	0
96	46	اختبارات	0
97	46	ملخصات شاملة	0
98	46	مواضيع بكالوريا	0
99	46	دروس	0
100	45	اختبارات و تمارين	0
101	45	ملخصات شاملة	0
102	45	مواضيع بكالوريا	0
103	45	دروس	0
104	47	اختبارات	0
105	47	ملخصات شاملة و كتب	0
106	47	مواضيع بكالوريا	0
107	49	اختبارات	0
108	49	ملخصات شاملة	0
109	49	مواضيع بكالوريا	0
110	50	مواضيع بكالوريا	0
111	50	مقالات جاهزة	0
112	50	مواضيع بكالوريا	0
113	44	مواضيع بكالوريا	0
114	44	ملخصات شاملة	0
115	42	مواضيع بكالوريا	0
116	42	ملخصات شاملة	0
117	10	Exercices	0
118	41	Cours	0
119	41	Td	0
120	41	Exams + exercices	0
122	9	مصادر و قنواة	0
123	53	Exams	1
124	54	Exaams	0
125	28	Cours	0
126	55	Music	0
127	7	Resourses	0
16	11	Soltuions ✅️	1
38	19	ملخصات	1
40	19	مواضيع بكالوريا	1
41	19	قنواة يوتيوب	1
37	19	دروس	1
39	19	تمارين و اختبارات	1
60	23	ملخصات	1
59	23	مواضيع بكالوريا	1
58	23	دروس	1
57	23	تمارين و اختبارات	1
121	1	قنواة و مصادر	1
73	4	Reversion	1
24	12	Solutions	1
12	8	Exams / quizs	1
11	8	Solutions td	0
129	54	كتب مهمة	0
131	57	CsE 1 (رزنامة )	0
20	9	Solution ✅️	1
132	58	📚 إرفين يالوم	1
133	7	قنواة يوتيوب	1
134	54	قنواة مهمة	0
128	8	قنواة يوتيوب	1
135	59	Cours	0
130	56	☜ قسم كتب التكنلوجيا و البرمجة و الحاسوب	0
136	60	Ss	1
137	61	Parasites	0
138	62	كتب	0
139	11	ملخصات	0
140	63	مراجع مهمة	1
142	10	Exams	0
143	65	Biochimie	0
144	65	Sémiologie	0
145	65	Physiopath	0
147	67	Cour	0
148	68	مادة 1	0
149	75	Cours	0
150	80	Cours	0
151	92	.	1
152	88	Physics/	1
154	88	Cours	1
153	88	Series	0
155	88	Courses	0
156	89	Courses	1
157	89	Courses	0
158	89	Series	0
159	90	Courses	0
160	90	Series	0
161	91	Courses	0
163	91	TP	0
162	91	TD	0
164	92	Courses	0
165	92	Series	0
166	94	Courses	0
167	93	Courses	0
168	93	Series	0
169	79	Cours	0
170	10	ملخصات	0
141	64	Books	1
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.channels (id, name, description, link, icon, color, members_count, sort_order, is_deleted, created_by, created_at) FROM stdin;
1	تحديثاث البوت	\N	https://t.me/lwx23	📺	\N	\N	0	0	5534474259	2026-05-06 20:54:49.735984
2	Unico	قناة تلغرام لدراسة لحميع تخصصات	https://t.me/UniCoursesdz	👨‍💻	\N	\N	0	0	5534474259	2026-05-06 21:40:11.503841
3	طلع سوماستر	قناة  تخصص انفورناتيك 	https://t.me/SH_48_3amek_2026_nadjeh	📚	\N	\N	0	1	5534474259	2026-05-07 02:09:29.66429
4	طلع سوماستر	قروب تلغرام لجميع التخصصات 	https://t.me/SH_48_3amek_2026_nadjeh	🎼	\N	\N	0	0	5534474259	2026-05-07 20:46:08.689632
5	Crash Médical	كل ما تحتاجه في تخصص الطب 	https://t.me/Crash_medical15	📺	\N	\N	0	0	5534474259	2026-05-07 21:22:21.539222
6	قناة الاستاذ يزيد	قناة مليئة بتحفيزات و الارشادات و تحديات لدراسة	https://t.me/tahadinaja7	📺	\N	10000	0	0	5534474259	2026-05-08 00:17:45.610727
7	𓏲ּ𝄢 𝆹𝅥𝆭𝓗𝓸𝓹𝓮 𝓫𝔂 𝓱𝓪𝓭𝓳𝓮𝓻 𝆹𝅥𝆭𓏲ּ𝄢	توكيدات،  حكم،  تحفيزات كتابية و صوتية باللغات العربية الفرنسية والانجليزية ✨💓	https://t.me/joularvoice	📺	\N	100000000	0	0	5534474259	2026-05-08 20:29:37.332052
\.


--
-- Data for Name: comment_likes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comment_likes (user_id, comment_id, created_at) FROM stdin;
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comments (id, file_id, user_id, text, is_deleted, created_at, likes) FROM stdin;
11	80	5534474259	Goooood	0	2026-04-04 10:40:24.245555	0
15	108	5534474259	😍😮‍💨	0	2026-04-04 16:37:11.597342	0
16	141	5534474259	🎵🕺	0	2026-04-04 18:33:03.213288	0
17	133	5534474259	هذي افضل بلاي ليست في لغة c اذا تكملها كاملا راح تكون بإذن لله متمكن من c	0	2026-04-04 19:34:19.992228	0
28	4	5534474259	😍	0	2026-04-05 01:08:43.837481	0
30	15	8230180687	💕	0	2026-04-05 08:17:34.8129	0
31	16	5664588045	Laa3ziz	0	2026-04-05 10:13:03.146194	0
34	15	5534474259	🎵	0	2026-04-06 19:32:17.450555	0
36	139	5534474259	😀😀	0	2026-04-06 20:28:49.869101	0
37	166	5534474259	🔥😍	0	2026-04-06 20:29:05.01099	0
39	147	5534474259	😁😁	0	2026-04-06 22:55:04.985233	0
50	31	5534474259	🔥	0	2026-04-08 10:15:18.133517	0
52	89	5534474259	Lwss	0	2026-04-08 19:52:35.117998	0
53	109	5534474259	🅰	0	2026-04-09 00:45:57.001125	0
54	33	5534474259	✅️	0	2026-04-09 09:48:41.081771	0
55	27	5534474259	🔥🔥	0	2026-04-10 04:39:29.010814	0
56	27	5534474259	😋😋	0	2026-04-10 04:39:45.655517	0
57	27	5534474259	Gg	0	2026-04-10 04:39:53.423682	0
59	114	5534474259	🔥🔥	0	2026-04-10 05:12:04.047753	0
60	152	5534474259	👨‍💻👨‍💻	0	2026-04-10 05:13:48.575247	0
61	107	5534474259	🔥🔥	0	2026-04-10 08:38:49.229554	0
62	114	5534474259	🥲🥲	0	2026-04-11 11:05:28.027625	0
63	196	5534474259	🙂🙂	0	2026-04-13 09:51:50.985285	0
68	222	5534474259	🔥🔥	0	2026-04-17 05:59:07.689084	0
70	166	5534474259	🔥🔥	0	2026-04-17 10:13:22.051207	0
71	4	5534474259	❤️‍🔥❤️‍🔥	0	2026-04-17 12:03:05.433609	0
74	12	5534474259	❤️‍🔥❤️‍🔥	0	2026-04-17 13:03:34.180567	0
75	2	5534474259	Gg	0	2026-04-17 13:03:43.147816	0
77	12	5534474259	Ww	0	2026-04-17 14:47:38.111818	0
78	2	5534474259	🙂🙂	0	2026-04-17 14:47:50.278483	0
79	51	5534474259	🔥	0	2026-04-17 17:25:48.039711	0
80	39	5534474259	✅️	0	2026-04-18 01:40:40.675356	0
81	31	5534474259	Algo 2	0	2026-04-18 08:31:19.532246	0
82	10	5534474259	🚩🚩	0	2026-04-18 16:01:55.06708	0
83	14	5534474259	hhh	0	2026-04-18 21:22:03.742901	0
84	9	5534474259	hhh	0	2026-04-18 21:41:24.138947	0
85	8	5534474259	Yurhr	0	2026-04-19 15:20:16.829302	0
86	8	5534474259	Sss	0	2026-04-19 19:53:54.183688	0
87	51	5534474259	🧭🧭	0	2026-04-19 21:23:59.308166	0
88	1	5534474259	🧭🧭	0	2026-04-19 21:24:05.541202	0
89	33	5534474259	Vh	0	2026-04-20 02:01:02.61028	0
90	32	5534474259	🤍🤍	0	2026-04-21 20:39:10.143503	0
91	2	5534474259	👋🏻👋🏻	0	2026-04-21 20:39:15.151853	0
92	37	5534474259	🚩🗞	0	2026-04-22 07:59:49.796084	0
93	7	5534474259	🗞🗞	0	2026-04-22 07:59:53.961952	0
94	1	5534474259	✅️	0	2026-04-22 22:09:49.315787	0
95	35	5534474259	Rr	0	2026-04-28 03:46:39.320793	0
96	5	5534474259	Bb	0	2026-04-28 03:46:45.021543	0
97	63	5534474259	🎀🎀	0	2026-05-03 08:48:48.764075	0
98	3	5534474259	❤️‍🔥❤️‍🔥	0	2026-05-03 08:48:57.206227	0
99	288	5534474259	G	0	2026-05-06 00:53:03.224053	0
100	288	5534474259	😃😃	0	2026-05-06 00:53:08.999836	0
101	288	5534474259	Bto	0	2026-05-06 00:53:12.417218	0
102	288	5534474259	Bro	0	2026-05-06 00:53:20.103591	0
103	7	5534474259	🙌🏻🙂	0	2026-05-06 01:33:44.457493	0
104	372	5534474259	✅️	0	2026-05-06 06:31:02.087073	0
105	289	5534474259	📚	0	2026-05-06 08:17:21.546841	0
106	164	5534474259	🙌🏻🙌🏻	0	2026-05-06 09:34:06.784003	0
107	382	5534474259	رائع	0	2026-05-06 13:47:33.548144	0
108	7	5534474259	🔥	0	2026-05-06 14:08:35.265164	0
109	389	5534474259	👨‍💻👨‍💻	0	2026-05-06 21:41:55.505806	0
110	390	5534474259	افضل ملخص	0	2026-05-06 22:53:38.466664	0
111	227	8726316433	الوا	0	2026-05-07 12:06:49.363047	0
112	7	5534474259	🚩	0	2026-05-07 18:08:47.03107	0
113	411	5534474259	🙂🙂	0	2026-05-08 00:11:37.731364	0
118	357	5534474259	❤️‍🔥❤️‍🔥	0	2026-05-30 11:53:53.515166	0
\.


--
-- Data for Name: downloads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.downloads (id, user_id, file_id, created_at) FROM stdin;
\.


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.favorites (user_id, file_id) FROM stdin;
7662120392	4
7662120392	5
5663352778	219
5663352778	218
5663352778	217
5663352778	216
5663352778	215
5663352778	214
6091576543	184
5663352778	213
5663352778	212
5663352778	211
8726316433	31
5663352778	210
5760028323	31
5760028323	32
5760028323	114
8726316433	149
5534474259	196
5534474259	178
5104073058	390
8726316433	88
6053902152	15
6885186666	223
8056909438	209
8056909438	208
7574632699	115
7574632699	143
7574632699	30
8187764784	8
8187764784	9
8187764784	10
6810868802	20
6810868802	19
8187764784	193
8187764784	11
8187764784	12
8187764784	13
7574632699	29
8187764784	209
8187764784	208
8187764784	4
8187764784	5
8187764784	152
8187764784	233
7574632699	28
7574632699	27
7574632699	31
7574632699	32
7574632699	221
7574632699	114
7574632699	33
7174608517	191
7574632699	41
7574632699	136
7574632699	222
7574632699	124
7574632699	125
7574632699	194
7574632699	8
7574632699	9
6179219688	19
6179219688	20
8187764784	192
7574632699	10
7574632699	193
7574632699	237
7574632699	152
7574632699	4
7574632699	5
7574632699	233
7574632699	245
7174608517	254
8375199999	417
7574632699	19
7574632699	20
7574632699	191
6810868802	257
7574632699	235
7574632699	22
7574632699	21
7574632699	23
8726316433	27
8726316433	115
8319698469	11
6885186666	252
6885186666	253
8726316433	224
8375199999	61
8375199999	62
8375199999	181
8726316433	227
7574632699	268
7574632699	269
7574632699	270
7574632699	271
7574632699	15
8375199999	64
8375199999	63
8726316433	391
7596452439	316
7368552878	62
7368552878	61
8726316433	332
6834163411	416
8187764784	328
7596452439	139
5534474259	30
5534474259	193
5534474259	115
8187764784	376
8726316433	3
5534474259	222
5534474259	284
5534474259	357
6018795251	380
6513362017	280
7803113312	390
6530364511	348
8726316433	204
6530364511	333
7574632699	12
7574632699	13
7574632699	192
7574632699	259
7574632699	382
6885186666	24
7574632699	16
7574632699	17
7574632699	18
7574632699	89
8319698469	6
6729659968	3
6729659968	286
6620710987	6
6620710987	7
8726316433	381
8726316433	380
8726316433	221
8726316433	33
8726316433	283
8726316433	136
8726316433	285
8726316433	286
8726316433	288
8726316433	289
8726316433	222
8319698469	289
5104073058	381
5104073058	380
7546140009	31
7546140009	32
7546140009	114
7546140009	221
6810868802	376
8726316433	183
8187764784	327
8187764784	329
8187764784	330
8187764784	386
8187764784	387
8187764784	388
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.files (id, category_id, title, description, file_id, file_type, downloads, uploaded_by, is_deleted, uploaded_at, file_size) FROM stdin;
155	130	أساسيات الإتصالات	Skip	BQACAgQAAxkBAAI5fWnS38JNtlNvEKLquuvbW9YnxDFIAAJ2AwACGB1JUmbGxf2_JV4oOwQ	document	18	5534474259	0	2026-04-05 22:18:42.500039	0
166	135	Techexp cour	Skip	BQACAgQAAxkBAAI_kmnUCCmXUTOxYsur8-JkWCA0kKgpAAJ5GQACofWgUudrvYM4YIexOwQ	document	35	5534474259	0	2026-04-06 19:24:09.305719	0
270	19	Solution — Answers Series 3		BQACAgQAAxkBAAKueWnyhC9jt5cW7drxxOVbvIg5WoHMAAIFHwACcwSRU9GDdBE8Arn9OwQ	document	4	5534474259	0	2026-04-29 22:20:33.292683	0
165	82	Biochimiee	Skip	BQACAgQAAxkBAAI8aGnTeU8SpwHcxOS_KdMMnf0kT4jpAAIIIAACjnBoUNJJk2_Ok9yROwQ	document	62	5663352778	0	2026-04-06 09:13:51.649409	0
110	81	IRA	Skip	BQACAgQAAxkBAAIYEmnNOrSHJh-_eKUOpQIyM9qNDVoVAAI8LAAC9Vu4UdX9lErg8BXAOgQ	document	60	5663352778	0	2026-04-01 15:33:08	0
22	22	Chapter 2	Logic	BQACAgQAAxkBAAIDd2m76ee16Cpv1Dz9WB4y-hiuB6r8AAJtHQACi4tJURZxOA5Z7NI6OgQ	document	81	5534474259	0	2026-03-19 12:19:51	0
373	155	Chapter 2 & 3	Electrostatic and conductors	BQACAgQAAxkBAALGk2n3kvX3TUtDCm3zk07LI29am5SKAAIJHwAC6V84U8p8fAKcWhi8OwQ	document	12	7596452439	0	2026-05-03 18:24:53.983994	0
174	72	Seri1 — LAB 3 explanations		BQACAgQAAxkBAAJQy2nYicCN9_yfM1mi9LBN8rqWHaytAAIxGgAC7b0pUJqbGbC6AwG9OwQ	document	22	5534474259	0	2026-04-10 05:25:21.528916	0
6	8	Quiz A	Quiz	AgACAgQAAxkBAAICd2m74WSHxfhqocEt7avkSbAD2AtNAAKpDGsb5G7hUb_Pyd1S0juHAQADAgADeQADOgQ	photo	46	5534474259	0	2026-03-19 11:43:32	0
190	18	Cour 6	Operations on matrices	BQACAgQAAxkBAAJahmnavJHXwNO1jzKpp-vXpZlIXM-DAALLIAACmu3YUs-sa8HFnFSKOwQ	document	13	5534474259	0	2026-04-11 21:26:57.479477	0
264	134	Chaine 2algebra 2	Skip	https://youtube.com/@dzairmathsacademy?si=35knsyjmyoCSPtWn	link	4	5534474259	0	2026-04-28 23:36:11.77847	0
4	6	Serie 1	String	BQACAgQAAxkBAAPkabp395LDSpc9rGCtM2AV0vCcXdQAAhIcAAJQdFBQjLTFaHipi2I6BA	document	50	5534474259	0	2026-03-19 11:42:04	0
321	158	Serie 3	Serie 3	BQACAgQAAxkBAALBa2n29f-_-wW_vXFUsUia0AzPj4ohAALsGwACL8ZhUQYhsI27tuBUOwQ	document	3	7596452439	0	2026-05-03 07:15:11.315076	0
36	34	Insta pro	تطبيق مهكر	BQACAgQAAxkBAAILNGm_12NsvfD6gNZJYAWMVyzXFdsoAAL8KAACNjABUm6W0EbuaZWWOgQ	document	0	5534474259	0	2026-03-22 11:49:55	0
175	72	Seri1 — PW04 Corrected		BQACAgQAAxkBAAJQzGnYicBYzQ2sMfYYuywC9lv4yHmSAAL6GwACw8JoUvlnPUiHgxvhOwQ	document	19	5534474259	0	2026-04-10 05:25:22.224857	0
382	11	Solution serie 5	Kip	BQACAgQAAxkBAALUaWn7RiaX3foKnGRIT0-lSXAAAXVj5AACdhwAAqaO2VOtguuBT2ngrjsE	document	14	5534474259	0	2026-05-06 13:47:02.863211	0
224	3	Solution serie 3	Skip	BQACAgQAAxkBAAJtj2nh4_uzrKW6Bu4GTrsGLehrTvuJAAI3HgACc1h4UU_9PA-2ZgFSOwQ	document	37	5534474259	0	2026-04-17 07:41:05.810813	0
27	26	Chapter 1	Proba	BQACAgQAAxkBAAIDtmm76y6OnHupD0z0h3_1OamCziIrAAJrGgACi_9BUAyYLDCGkgl_OgQ	document	65	5534474259	0	2026-03-19 12:25:18	0
55	30	Chapter 1	Introduction to Algorithmics	BQACAgQAAxkBAAIPyGnL5e0PXXYC2sePAf_JXAwMcKVUAALuIAAC_SlQUOR0efC4rGsFOgQ	document	19	5534474259	0	2026-03-31 15:19:08	0
11	10	Serie 1	Les limite devlopment	BQACAgQAAxkBAAIDDWm76ASEbcSM0igvyKLQz7UzuWRyAAIOHAACUHRQUCaopK9VWUXWOgQ	document	39	5534474259	0	2026-03-19 12:11:47	0
318	158	Serie 1	Serie 1	BQACAgQAAxkBAALBA2n28-VwGD9d5yGlKdkToNNcWyOeAAJvHAACKs5pUNZLKDaJHlGlOwQ	document	1	7596452439	0	2026-05-03 07:06:14.080772	0
235	22	Chapter 3	Skip	BQACAgQAAxkBAAKGXmnmKoyjLwwc692Hk1F6Rqg26PUjAAL1HwACfYwxUxmCmcLkFGZPOwQ	document	44	5534474259	0	2026-04-20 13:30:53.20836	0
78	1	Chapter 1	Skip	BQACAgQAAxkBAAIQt2nL64taFFrCCnbh-Tvy055_6SuuAAInGQACJ8dZUFwB4LlKuc9BOgQ	document	5	5534474259	0	2026-03-31 15:43:06	0
64	65	Exam 2024/205	Exam sem1 [2024/2025]	AgACAgQAAxkBAAIQBGnL55XsNMvRm_8UA2v5GmU8NkL-AAIqDWsbdFZhUuaW86lyBPnhAQADAgADeQADOgQ	photo	6	5534474259	0	2026-03-31 15:26:12	0
88	11	Solution serie 1	حل سيري 1 اناليز 2	BQACAgQAAxkBAAIWTmnNG6NxKslsUOnWGBWi7wtQu6JBAAI3GgAClMtoUi2-cWMnAQVnOgQ	document	27	5534474259	0	2026-04-01 13:21:03	0
21	22	Chapter 1	Logic	BQACAgQAAxkBAAIDcGm76bkRIZGlwrhD7Dw5r-S2bfJRAAIvGwACMxIJUCMx6eSegEedOgQ	document	43	5534474259	0	2026-03-19 12:19:05	0
15	18	Cour 1	Vector spaces 1	BQACAgQAAxkBAAIDKWm76IEWR2iUFVpy6Bpi3cAF2NuVAAKxGQACi_9BUHqof60d62b1OgQ	document	52	5534474259	0	2026-03-19 12:13:53	0
324	159	Chapter 2	Basic syntax	BQACAgQAAxkBAALB0Wn2-EKHlU36P-2g8eHX8_aeTBxBAAI3HwACXPNxUAmBP1hzM3fHOwQ	document	0	7596452439	0	2026-05-03 07:24:50.593085	0
12	10	Seri2	Les integrals	BQACAgQAAxkBAAIDFGm76BQ6lN6EjoygzrCTVxbbkAAB3AAC0RsAAsiSuVB0tGM8bJwTPToE	document	17	5534474259	0	2026-03-19 12:12:03	0
16	18	Cour 2	Vector spaces 2	BQACAgQAAxkBAAIDImm76ExS4dyvZsGvzzE4h_vd9_5cAALFHwACBudpUND6q7BVBlD9OgQ	document	28	5534474259	0	2026-03-19 12:14:16	0
9	9	Chapter 2 part 1	Les integraals	BQACAgQAAxkBAANlabppDCKgGJ54jkKVr4y4FL_BoI4AAoYeAALa3OBQE9pn2-P129U6BA	document	66	5534474259	0	2026-03-19 12:10:53	0
417	142	Exam 2026	اختبار فصل 2 بروبا	AgACAgQAAxkBAALu-moJIpTsjfp1uG_tbBVY4bkNpB_SAAKYDWsbeslJUPzgErAayoBQAQADAgADeQADOwQ	photo	18	5534474259	0	2026-05-17 02:06:13.062216	0
89	18	Cour 5	Les matrices	BQACAgQAAxkBAAIWZGnNHA1W1HvnTX7as5M8NObAGNzuAAILGgAClMtoUroFstlv7qpQOgQ	document	31	5534474259	0	2026-04-01 13:22:36	0
57	30	Chapter 3	Iterative Structures (Loops)	BQACAgQAAxkBAAIP1mnL5jIaXoF-GKP27aMwZ5DxPHDfAALwIAAC_SlQUDirpDZslJruOgQ	document	11	5534474259	0	2026-03-31 15:20:17	0
70	66	Cour 6	Skip	BQACAgQAAxkBAAIQIGnL6CEplE0uTHm5cJOi7bmDofGQAAIjHgACVmVhUZXxgmg4lWgWOgQ	document	7	5534474259	0	2026-03-31 15:28:32	0
20	19	Serie 2	Linear map	BQACAgQAAxkBAAIDXWm76WCaV2NkMry9GBMTWD37Oz4lAAKuHQACuv3JUDVLe_q6ayeqOgQ	document	36	5534474259	0	2026-03-19 12:17:35	0
191	19	Serie 3	سيري 3 جبر 2	BQACAgQAAxkBAAJalWnavL4tPkAcZq9IuvjiFsPy03axAALMIAACmu3YUuo-yUup3CXLOwQ	document	29	5534474259	0	2026-04-11 21:27:27.163284	0
386	160	Solution of serie 3	Linked lists	BQACAgQAAxkBAALWjGn7syw4vib-kEvJalexkOibkFklAAIOHwACRs7ZU1qEhJicspw2OwQ	document	0	7596452439	0	2026-05-06 21:31:25.331091	0
66	66	Cour 2	Skip	BQACAgQAAxkBAAIQHGnL6CG2-PI9lQlgKShBh6KhwB2sAAJjGwACvFmhUJYLoCxFztIrOgQ	document	19	5534474259	0	2026-03-31 15:28:32	0
19	19	Serie 1	Vector space	BQACAgQAAxkBAAIDVmm76VMuyUJwRZehRPx1675PMzk5AAKyGQACi_9BUNaYww4LBj8qOgQ	document	19	5534474259	0	2026-03-19 12:17:23	0
181	65	Exam 1 algo 1	Skip	BQACAgQAAxkBAAJVv2naMUap10wOsXp5EoLDn9n4uldlAAJCHgACnbMAAVAn-cltzlHgCDsE	document	30	5534474259	0	2026-04-11 11:32:31.572451	0
418	70	Chapter 2	..	BQACAgQAAxkBAAL-MWoZe1J5k2I-zYiGg0zlkeccjuZlAAJYHwACRefRUD-jMZW6TrxjOwQ	document	3	5534474259	0	2026-05-29 11:41:59.380703	0
76	67	Serie 5	Skip	BQACAgQAAxkBAAIQo2nL6wdrfe97RX58NFXSlkYXFN8fAAJjHwACxI74UbX6TkkNQZS-OgQ	document	14	5534474259	0	2026-03-31 15:40:54	0
79	1	Chapter 2	Skip	BQACAgQAAxkBAAIQvmnL66l4rFupInhb1pzhvExAwEDxAAKzHAACwDxAUKevQX9A4qkXOgQ	document	11	5534474259	0	2026-03-31 15:43:36	0
331	160	Serie 3	Python lists	BQACAgQAAxkBAALCfGn2-wgTS5Ev0v77mkiOu6djjIUiAAJJHQACmEu5UwbchxAjaOz0OwQ	document	0	7596452439	0	2026-05-03 07:36:40.638298	0
56	30	Chapter 2	Variable	BQACAgQAAxkBAAIPz2nL5hD0LNXZ-CaRk3PBe-mSYRQLAALvIAAC_SlQUAQyMYJFzcrDOgQ	document	9	5534474259	0	2026-03-31 15:19:42	0
230	71	Os — Chapter 5 (1)		BQACAgQAAxkDAAJvEGniB3n-6phgor8SJtW-Cjz-B8gtAAIsGgAC7b0pUHJ8EhqgL0o3OwQ	document	29	5534474259	0	2026-04-18 07:23:50.804211	0
265	9	Chapter 4	Skip	BQACAgQAAxkBAAKtJ2nyVnS1lQ2EfAAB3rFlWapEVf2PEQACch4AAnMEkVMCeJQYfJhoRDsE	document	7	5534474259	0	2026-04-29 19:05:43.060194	0
322	158	Serie 4	Serie 4	BQACAgQAAxkBAALBeWn29hlCU9I9_7ETgoO5tlpzu1yZAAKdGwACZhGwUrHMBSOkgvpOOwQ	document	1	7596452439	0	2026-05-03 07:15:37.821129	0
74	67	Serie 3	Skip	BQACAgQAAxkBAAIQlWnL6u-RTcQ5tEVRFMP3iS384biwAAJfGgACxGTIUCDyWsAnSS2HOgQ	document	15	5534474259	0	2026-03-31 15:40:30	0
246	143	بادئة للاسماء — 13.04.2026 C.01 GASTRO		BQACAgQAAxkBAAKZpmnqeED5qy-0JpAvGHOQA4VQl--nAAIvHQAC-Fw5UxE5VO4L_V97OwQ	document	4	5663352778	0	2026-04-23 19:51:51.627087	0
194	87	Intero annalyse 2	انتيرو اناليز 2 مع لحل	BQACAgQAAxkBAAJkE2ncjRB0LWkb6C8nnbXU1Ea1enNmAAKJIgAC7ZbpUqnTYG0WimPROwQ	document	21	5534474259	0	2026-04-13 06:28:44.428552	0
145	129	كتاب الشامل c	Skip	BQACAgQAAxkBAAIyB2nRvriVIEpqsjkMYAlxZ8S7IUKpAALqGgACAxUIUZuWx7R3wqFFOwQ	document	6	5534474259	0	2026-04-05 01:45:28.986345	0
59	30	Chapter 5	Functions	BQACAgQAAxkBAAIP5GnL5m45eE8IFUFX1JtrbN87DyG1AALyIAAC_SlQUCE81DTrvXIbOgQ	document	12	5534474259	0	2026-03-31 15:21:17	0
157	130	تعلم برنامج\nالبوربوينت 2010	Skip	BQACAgQAAxkBAAI5jGnS3_KPh_iquDVWHE_ZFgiW8OTyAAKgBwACqelRAAHJJn4c7jyoeTsE	document	16	5534474259	0	2026-04-05 22:19:31.162627	0
83	2	Serie 3	Skip	BQACAgQAAxkBAAIQ2mnL7Ahnm8bzFkR1F_nivmjC8VmmAAKxHAACwDxAUBf70djN8H0XOgQ	document	23	5534474259	0	2026-03-31 15:45:11	0
68	66	Cour 4	Cour 4	BQACAgQAAxkBAAIQHmnL6CHy6u4YDOGMShkO5DoAAePZzwACXBwAAsRk2FDs_XI-z-Mk5DoE	document	3	5534474259	0	2026-03-31 15:28:32	0
253	11	Analyse — Exo4-serie3-modif		BQACAgQAAxkBAAKd_GnrjT96PQABoptmKBMMmLhBUNc8sQAClhwAAh-8SFO_JP8ks05kajsE	document	3	5534474259	0	2026-04-24 15:33:43.456379	0
63	65	Exam 2024/205	Exam sem1 [2024/2025]	AgACAgQAAxkBAAIQA2nL55WneOJ34uoJTChOPqqJTh8gAAIpDWsbdFZhUqMMLtq3GdOiAQADAgADeQADOgQ	photo	13	5534474259	0	2026-03-31 15:26:12	0
237	9	Formulaire primitives	Skip	BQACAgQAAxkBAAKPkGnofp_NHSCcxuB450OkAAHn8ic-wwACzRwAAoBhKVEMcj1sdFbXVjsE	document	27	5534474259	0	2026-04-22 07:54:46.815888	0
67	66	Cour 3	Cour 3	BQACAgQAAxkBAAIQHWnL6CGmdz0MSssna42kUpfjmgNjAAJkGwACvFmhUIaDxPEt1pvzOgQ	document	17	5534474259	0	2026-03-31 15:28:32	0
75	67	Serie 4	Skip	BQACAgQAAxkBAAIQnGnL6v0DDFNqApZ8VPESknt6RBpnAAIiHgACVmVhUb1OiiBmCSeyOgQ	document	7	5534474259	0	2026-03-31 15:40:44	0
81	2	Serie 1	Skip	BQACAgQAAxkBAAIQzGnL69sdD601tK4GjIwpBqRLt-PjAAKhGwACk7BxUHZNjFQpIgwuOgQ	document	4	5534474259	0	2026-03-31 15:44:26	0
60	30	Cours 6	Les pointeurs	BQACAgQAAxkBAAIP62nL5qhjyEIXWDll1x6SkXkxWsT6AAJXGgACZeAhUqc9UDVfzVZYOgQ	document	19	5534474259	0	2026-03-31 15:22:15	0
69	66	Cour 5	Skip	BQACAgQAAxkBAAIQH2nL6CFpEoUg6zl3LfJxVc0RJCETAALoGwAC07IYUW6rpZCfVapfOgQ	document	10	5534474259	0	2026-03-31 15:28:32	0
80	1	Chapter 3	Skip	BQACAgQAAxkBAAIQxWnL67n4XIk0C4UhKLeuAkiQB-zFAAJ-HgACfP95UBAycnIiR6ciOgQ	document	29	5534474259	0	2026-03-31 15:43:52	0
71	66	Cour 7	Skip	BQACAgQAAxkBAAIQIWnL6CERbcHIcH8GmTbXxT7uiTSSAAJfHwACxI74UUS0kCnw07YSOgQ	document	15	5534474259	0	2026-03-31 15:28:32	0
72	67	Serie 1	Skip	BQACAgQAAxkBAAIQdmnL6aShVAm5_GRPxUFKVWQXTgWvAAJmGwACvFmhUJ3Ymsxo66AIOgQ	document	12	5534474259	0	2026-03-31 15:35:13	0
62	31	Td/tp of loops	Td/tp of loops	BQACAgQAAxkBAAIP-WnL5yDS4mxOcIYjqCB0sguOxHRtAAL7GgACZeFQUEOsXSEQWppmOgQ	document	12	5534474259	0	2026-03-31 15:24:15	0
58	30	Chapter 4	Initiation à l'algorithmique \nLes tableaux	BQACAgQAAxkBAAIP3WnL5lL7Zfw4_WEurNR03gj_vLm1AALxIAAC_SlQUIOYb1hJ4vKnOgQ	document	11	5534474259	0	2026-03-31 15:20:49	0
82	2	Serie 2	Skip	BQACAgQAAxkBAAIQ02nL6_RuahgTB8y1CpKuvJzpIT0QAAK0HAACwDxAUEqRSbo-bLe2OgQ	document	11	5534474259	0	2026-03-31 15:44:51	0
315	156	All chapters	All chapters	https://t.me/JkmU_vCfSjpkMGM0/883/1026	link	5	7596452439	0	2026-05-03 06:52:18.698508	0
17	18	Cour 3	Linear map 1	BQACAgQAAxkBAAIDN2m76L1_GS-w9DCFHdIf5iomZTlkAAKtHQACuv3JUOXrpBGxu8ZkOgQ	document	40	5534474259	0	2026-03-19 12:14:53	0
8	9	Chapter 1	Les limite develepment	BQACAgQAAxkBAAIB3Wm71u6AJwvMm-ZeoDYGK4v6reuUAAIJHAACUHRQUK2Y2FFhcRqBOgQ	document	61	5534474259	0	2026-03-19 12:10:36	0
65	66	Cours 1	Skip	BQACAgQAAxkBAAIQG2nL6CEyEhYWpSky4o4ziUdndr2rAAJhGwACvFmhUOew37znvShNOgQ	document	14	5534474259	0	2026-03-31 15:28:32	0
387	160	Serie 4	Arrays	BQACAgQAAxkBAALWk2n7s29irhWfSws4rmcL-WKdnQJHAAINHwACRs7ZU_TtL22HzbRAOwQ	document	0	7596452439	0	2026-05-06 21:32:31.444337	0
73	67	Serie 2	Skip	BQACAgQAAxkBAAIQgmnL6kqPBvDcG74UkGtP8RsqYiSnAAJnGwACvFmhUL--KF3A2LBNOgQ	document	11	5534474259	0	2026-03-31 15:40:09	0
86	70	Chapter 3	Skip	BQACAgQAAxkBAAIRAWnL7t0bGZBSV75S89bxZd8OO_nsAAIGHAACzmLYUoibTJMRmtQIOgQ	document	25	5534474259	0	2026-03-31 15:57:19	0
226	69	Final exam 1	اختبار جبر 1	AgACAgQAAxkBAAJt2Wnh5WswaiIru1bJj7t4KzVrSFsuAAJvC2sbAVs4UyQqlSbBB5-TAQADAgADeQADOwQ	photo	48	5534474259	0	2026-04-17 07:47:16.830701	0
111	81	Dysphosphoremies	Skip	BQACAgQAAxkBAAIYE2nNOrR4rhpdmwME3SlQeTjMut3wAALVHQACnRHAUeZRaks9ioV5OgQ	document	32	5663352778	0	2026-04-01 15:33:08	0
107	81	Dyskalemies	Skip	BQACAgQAAxkBAAIYD2nNOrTtwa6hXcSoJQlmUZzVi3uSAAKZHAAC-yCRUGDQ0EAgaSWUOgQ	document	57	5663352778	0	2026-04-01 15:33:08	0
229	71	Os — Chapter 4		BQACAgQAAxkDAAJvD2niB3mY2_Q4bXeV9Mb2yto8HL5HAAIrGgAC7b0pUP3haeqMcqqdOwQ	document	25	5534474259	0	2026-04-18 07:23:50.345006	0
192	10	Serie 4	سيري 4 انليز 2	BQACAgQAAxkBAAJhQGnb_S8W0DxXgVu4vRFS_lqphw9tAALhGQAC-dvgUgIGJww3lwABPTsE	document	74	5534474259	0	2026-04-12 20:15:05.193578	0
61	31	Serie of pointeurs	Serie of pointeurs	BQACAgQAAxkBAAIP8mnL5u0yGLmL_vGRKZ_C7IQ_LnRZAAJ6HAACVmVhUZUWIWPy8RQ6OgQ	document	8	5534474259	0	2026-03-31 15:23:24	0
90	11	Solutions serie 2	حل سيري 2 اناليز 2	BQACAgQAAxkBAAIWf2nNHJTACbuhsVxFdTX2Td8d0lNuAAI-GgAClMtoUgWDbdrOI23bOgQ	document	33	5534474259	0	2026-04-01 13:24:53	0
332	161	Chapter 1	Structs	BQACAgQAAxkBAALCkmn2-_OBBgABVDNUnvQb5K22OjOhCQAC_BsAAk4vUFJemdY_BWth4jsE	document	2	7596452439	0	2026-05-03 07:40:35.36089	0
414	153	Serie 2 — Physics 2-Series 2-Part 3		BQACAgQAAxkBAALeM2n-MxTzwY6Oo-9Cd7fh2UZmAv7KAAJzHwACbgGxUg17NTwGbZbuOwQ	document	5	7596452439	0	2026-05-08 19:03:30.651005	0
136	14	Serie 2	Skip	AgACAgQAAxkBAAIs02nRMGtD1xgvLLRnj0nGTDNJLBFqAALXDGsb_6CJUkXgT3K4wy_fAQADAgADeQADOwQ	photo	71	5534474259	0	2026-04-04 15:38:44.153061	0
374	161	Chapter 3	Pointers	BQACAgQAAxkBAALGoWn3k1OQ4c-om4M7CGSEPRYAARAVEwACYxsAAuu5wVM6zeStsKAK1TsE	document	9	7596452439	0	2026-05-03 18:26:27.809745	0
31	13	Chapter 1	الدرس الاول في مادة الارشي	BQACAgQAAxkBAAIEGGm78AcQpqigicA45Lhd3aQgJJUtAAIfGwACMxIJUF-3NcZiLDGBOgQ	document	61	5534474259	0	2026-03-19 12:45:59	0
184	134	Chaine algebra 2	Skip	https://youtu.be/38RWQ7HqRbE?si=nufCkQwzaROzspq4	link	15	5534474259	0	2026-04-11 12:44:52.314111	0
225	138	Book analyse 1	كتاب دروس و تمارين مع لحل	BQACAgQAAxkBAAJtl2nh5EDpsnagqarUzbLDCJkaJ_XxAAKvGwACcRMxUQslmTzt8P2OOwQ	document	41	5534474259	0	2026-04-17 07:42:49.280355	0
272	87	Atiro grp 3	Skip	AgACAgQAAxkBAAKvvmnypSeWTsDm9MwAAY0rnRt69Q3MPQACkwxrGypMmVOx9V495EtihQEAAwIAA3kAAzsE	photo	7	5534474259	0	2026-04-30 00:41:11.842631	0
146	129	كتاب فمادة لجبر	Skip	BQACAgQAAxkBAAIyrWnRyD3LcwW5SsWVpHiwmInlQ08dAALhGwAC2tzYUJUOxcX2hlIoOwQ	document	49	5534474259	0	2026-04-05 02:26:14.732023	0
232	71	Os — Chapter 1		BQACAgQAAxkDAAJvE2niB3mIrb5wHZ6Wxbycg7HFzNuYAAL0HgACfP95ULcNNOwFKtgvOwQ	document	53	5534474259	0	2026-04-18 07:23:51.732462	0
113	77	Exam crr 2024/205	Skip	BQACAgQAAxkBAAITGGnMWalYB4vJjXNp-TbZmzzkWpQpAALdFwACjsNYUBwKV9TBpPHrOgQ	document	39	5534474259	0	2026-04-01 20:54:24	0
379	131	Exaaams	Skip	AgACAgQAAxkBAALTCWn64IR_bkQtOJWjaAqOYBPdz8zzAAIDDmsbFhvZU7fRb5v6KuObAQADAgADeAADOwQ	photo	63	5534474259	0	2026-05-06 06:32:43.975697	0
269	19	Solution — Answers Series 02		BQACAgQAAxkBAAKueGnyhC8CS01t12Tu62KJcZyvvlghAAIEHwACcwSRU51AHksoWoZLOwQ	document	4	5534474259	0	2026-04-29 22:20:32.810424	0
149	130	البرمجة بلغة السي شارب	Skip	BQACAgQAAxkBAAIzhmnR0jVUGkQ9BWevd_ZdJfpk7SHKAAKZAwACCBPhUPnk6sbArktoOwQ	document	81	5534474259	0	2026-04-05 03:10:13.092476	0
244	18	Cour — 3. Find the rank of a matrix by Minor method		BQACAgQAAxkBAAKY_2nqTdLL0ZhKe33nyvWH6twBY0IWAAI6IAACQ1JRU7MlRfWeT6rnOwQ	document	7	5534474259	0	2026-04-23 16:50:26.416228	0
109	81	Dyscalcémies	Skip	BQACAgQAAxkBAAIYEWnNOrSRpDcb5KYjV1eqboPxrxoUAAIHHgAChxSgUWEUvbZvuvlzOgQ	document	31	5663352778	0	2026-04-01 15:33:08	0
10	9	Chapter 2 part 2	Les integrals indifini	BQACAgQAAxkBAAIB62m71x2qILbWLVmltVX6eraYFMX0AAIkHgACdPt5UVlwI8MlabFyOgQ	document	50	5534474259	0	2026-03-19 12:11:11	0
18	18	Cour 4	Linear map 2	BQACAgQAAxkBAAIDPmm76M5YIRjT4QsDZmYCgvmM1v3_AAJZHwACglAQURxzsSAS0YqtOgQ	document	25	5534474259	0	2026-03-19 12:15:10	0
114	13	Chapter 3	Skip	BQACAgQAAxkBAAIY82nNi7dPQ82RRx3jgNl4E-Nu2zPqAAKYHgACQDipUBjivoNJNWXTOgQ	document	131	5534474259	0	2026-04-01 21:19:00	0
193	9	Chapter 3	Skip	BQACAgQAAxkBAAJhQWnb_S9Rx8lpzuBqHk0JlFUCa6c4AALiGQAC-dvgUlRyoJMMap6fOwQ	document	47	5534474259	0	2026-04-12 20:16:24.782488	0
218	137	Skip — 06_Opportunistes_digestives_Cryptosporidium_Dr_Fellahi_A_1		BQACAgQAAxkBAAJrCmngmnhAR3xl7ESmRcyrLvJGycLCAAJOGgACbe3wUuCYWnG02bGuOwQ	document	16	5663352778	0	2026-04-16 08:14:52.982351	0
5	6	Serie 2	Strecture	BQACAgQAAxkBAAPsabp4DLKoSIsrlkZ-v4lyg66ncJ4AAlweAALcdjFR-ZFlZmJDa0s6BA	document	46	5534474259	0	2026-03-19 11:42:22	0
177	72	Seri1 — PW 6 corr		BQACAgQAAxkBAAJQzmnYicD1xaUyxtYFe2h9aU_TjVxgAAKuGwACzmLgUoeP_098RTxJOwQ	document	63	5534474259	0	2026-04-10 05:25:23.639526	0
118	84	Tp 6	Skip	BQACAgQAAxkBAAIhW2nPmPyKxTsq8_kbMDSJG7ycrS90AAL4HQACXP4BUdAo_dwcocoYOgQ	document	27	5534474259	0	2026-04-03 10:39:56.772808	0
84	4	Exam 2024/205	Exam 2024 with solution	BQACAgQAAxkBAAIQ4WnL7EwTURXlZRMQZhiWwsR-z7mbAAJ5HgAC3vFBUmttqUAPVipBOgQ	document	12	5534474259	0	2026-03-31 15:46:20	0
147	130	افضل كتاب لتعلم الذكاء الاصطناعي	Skip	BQACAgQAAxkBAAIzX2nR0CYJ1sIAASIV_c_TUrJuBUWEcQACoQMAAiBzSFE95N72v5TW6DsE	document	54	5534474259	0	2026-04-05 02:59:50.827139	0
13	10	Serie 3	Les integrals indifini	BQACAgQAAxkBAAIDG2m76CO2DlTnRReaqfBMjaEn7oelAAIlHgACdPt5UVk07RXCDq2BOgQ	document	54	5534474259	0	2026-03-19 12:12:19	0
254	11	Analyse — 4_6001253344801201302		BQACAgQAAxkBAAKd_WnrjT9CSgxKaaCyVpcmSjxYUUdnAALAHwACG1NhU5n4Wdkv8XkaOwQ	document	8	5534474259	0	2026-04-24 15:33:43.930896	0
124	87	Td developpemment limite	Corrigè devloppement limitè	BQACAgQAAxkBAAIicWnPpiMKlESCCk9j3Y4X_lQLmtpPAAK0GQACE-NIUOBzGBufuUllOgQ	document	12	5534474259	0	2026-04-03 11:37:42.393323	0
266	11	. — 20260429-091229		BQACAgQAAxkBAAKtN2nyVqbMjgoeDY8cI8rhyHeeqGQuAAJzHgACcwSRUzte5KRLmlAnOwQ	document	2	5534474259	0	2026-04-29 19:06:14.379913	0
247	143	بادئة للاسماء — 13.04.2026 C.02 GASTRO		BQACAgQAAxkBAAKZp2nqeECnRbP6WHvUzVv2OnP_BuRPAAIwHQAC-Fw5U9eGUCyzF76AOwQ	document	6	5663352778	0	2026-04-23 19:51:52.103845	0
108	81	Acidocetose diabetique	Skip	BQACAgQAAxkBAAIYEGnNOrTHiSX2lej3pE-Vjr3Pe1E6AALGGwAChxSYUQiny3zHkP5ZOgQ	document	65	5663352778	0	2026-04-01 15:33:08	0
156	130	المصادر المفتوحة	Skip	BQACAgQAAxkBAAI5hGnS39rNbFLOcrX-K_5KOkNEt6TjAAJ5AwACGB1JUshgaeuKPitAOwQ	document	41	5534474259	0	2026-04-05 22:19:06.595089	0
388	160	Solution of serie 4	Arrays	BQACAgQAAxkBAALWmmn7s4YIAyugvFZms5rmgTQkikSYAAIPHwACRs7ZU0LMEFQMgSE0OwQ	document	3	7596452439	0	2026-05-06 21:32:54.678762	0
125	87	Td developpemment limitè	Yd	AgACAgQAAxkBAAIifGnPppl6ScF1-ZANDm_clhpADW7zAAI4DWsbBRi4Uewla36ITAGCAQADAgADeQADOgQ	photo	29	5534474259	0	2026-04-03 11:38:58.772717	0
219	137	Skip — 03- Les Ciliés Dr Fellahi A		BQACAgQAAxkBAAJrC2ngmniKQ-f5us-BMn-UygfsPI6SAAJQGgACbe3wUr9QAAHJVObPojsE	document	18	5663352778	0	2026-04-16 08:14:53.443723	0
33	14	Serie 1	Archi	BQACAgQAAxkBAAIEJmm78CkKY0R4xo7kKNMFX22RCXvfAALXGwAC2tzYUME4L2cFGH_2OgQ	document	47	5534474259	0	2026-03-19 12:46:33	0
220	134	Chaine for logic	Skip	https://youtube.com/playlist?list=PLEjRWorvdxL6xpvIHb-cN8VrRi2B2bzj2&si=imwgez703jD5EZPT	link	44	5534474259	0	2026-04-16 20:14:21.526472	0
77	68	Solutions serie 3 & 4	Skip	BQACAgQAAxkBAAIQrWnL6ztm7K1_i16qT3c-UeUpfkstAAKzGQACX7I4U4qGgfvrYdfUOgQ	document	6	5534474259	0	2026-03-31 15:41:46	0
286	5	Chapter 2	Struct	BQACAgQAAxkBAAKznmn0nkwAAbe_ESTqL75Sy6tZIdzEWQACRh4AAs-yoVMagLHFOh64FzsE	document	27	5534474259	0	2026-05-01 12:36:39.111698	0
249	144	بادئة — Sémiologie digestives introduction		BQACAgQAAxkBAAKZt2nqeIK94pTPnes8s4hZkDDWI5yaAAKyHAACGQQIUwqVaXB_tLUZOwQ	document	6	5663352778	0	2026-04-23 19:52:34.735792	0
250	144	بادئة — Sémiologie digestives vmts dysphagie		BQACAgQAAxkBAAKZuGnqeILFb8VDRsWciE-pqsMpvyxqAAKzHAACGQQIU0GyfN4VX4cfOwQ	document	14	5663352778	0	2026-04-23 19:52:35.215439	0
276	28	. — Chapter IV. Linked Lists (Session N°4)		BQACAgQAAxkBAAKwjmnzDFMcT5JZ063DUeG1aMiztLzeAAJjHQACFIu4Ur5TjgRFNQE3OwQ	document	12	5534474259	0	2026-04-30 08:02:28.257446	0
248	143	بادئة للاسماء — EXPLORATION DU FOIE C01		BQACAgQAAxkBAAKZqGnqeEA5T0H6zrD9pUsx2HtteB_-AAIxHQAC-Fw5U2J7Ysrg93AJOwQ	document	9	5663352778	0	2026-04-23 19:51:52.586443	0
416	170	Resumè chapter 1/2	ملخص بروبا شابتر 1/2	BQACAgQAAxkBAALipGoCZKXuME9KTnWBg8Foc3yx5bbRAAJPIAACetYRUMIAAW_dy1hE6jsE	document	15	5534474259	0	2026-05-11 23:26:23.436973	0
242	135	'	'	CQACAgIAAxkBAAKPhGnofeZq_U9E2jhEEQWfKVJd4mMwAALDHQAC3LtoSV_fEuEG5xSnOwQ	document	21	5534474259	0	2026-04-22 21:34:59.053557	0
222	14	Serie 3	سيري 3 ارشي	BQACAgQAAxkBAAJs52nhw0NYudUhfBzrzeEcZ68FVJQ6AAL2HQACrq8RUycfqMvszNkGOwQ	document	70	5534474259	0	2026-04-17 05:21:07.590515	0
273	28	. — Chapter IV. Linked Lists (Session N°1)		BQACAgQAAyEFAATeYyKOAAIQaWnyfkTP2l7_qz2EmbWC7lUAAdki0QACYB0AAhSLuFKZ-ppFEAxLBTsE	document	3	5534474259	0	2026-04-30 08:02:26.800229	0
23	22	List of axioms and rules	List of axioms and rules	BQACAgQAAxkBAAICCWm72fR-KBhOEvzPowO5TgdUwBPSAAIqHgACdPt5USw3aEVka48oOgQ	document	140	5534474259	0	2026-03-19 12:20:31	0
223	11	Solution serie 3	حل سيري 3 اناليز 2	BQACAgQAAxkBAAJtSmnh4iCnmN00R8QZkqFOvanoGgaGAAIkGwACdkAIU26QAAFK5Dk-9zsE	document	49	5534474259	0	2026-04-17 07:34:21.287751	0
231	71	Os — Chapter 7		BQACAgQAAxkDAAJvEmniB3k5pxIlMRGoN2W06BOsjbaXAAIvGgAC7b0pULJPJNAfIEe4OwQ	document	36	5534474259	0	2026-04-18 07:23:51.262633	0
255	135	. — 30K		CQACAgIAAxkBAAKjbWns133qghttYvWk4wZQ_4bk_T8RAALgVgAC2uexS8GVv87ct0zAOwQ	document	15	5534474259	0	2026-04-25 15:02:56.311471	0
87	70	Chapter 4	Skip	BQACAgQAAxkBAAIRCGnL7vNZPcPGCNzcgdbtl-_Exr_IAAIFHAACzmLYUvBgswABtIK_NzoE	document	61	5534474259	0	2026-03-31 15:57:40	0
245	18	Cour — 4. Solving systems of equations		BQACAgQAAxkBAAKZAAFp6k3SqdFr69-QeV2g3ELMEuk5SwACOyAAAkNSUVOJQaUyJrm_nzsE	document	16	5534474259	0	2026-04-23 16:50:26.901308	0
217	137	Skip — 08-Paludisme et Toxoplasmose Dr Fellahi A		BQACAgQAAxkBAAJrCWngmngCT4yv1uBEUSc5on8ZQT-WAAJNGgACbe3wUt_cd_PbqQuPOwQ	document	14	5663352778	0	2026-04-16 08:14:52.52696	0
243	21	Antiro	Antiro algebra 2	BQACAgQAAxkBAAKWv2npbTUk9i2SWdZ5vJ3QW7AW2x4xAAI9GgAC1_dRU4Q9pc2ksQ-ZOwQ	document	22	5534474259	0	2026-04-23 00:53:47.619675	0
257	6	Solution serie 4	Skip	BQACAgQAAxkBAAKkRGntKT4dcSAC00AfMfvqTg3j3QdxAAI4GQACDbZpUyzTdhjwDqutOwQ	document	22	5534474259	0	2026-04-25 20:51:10.805925	0
267	11	. — 20260411-163534		BQACAgQAAxkBAAKtOGnyVqbPmAt-Vb83D_djCYq2fwrNAAJ0HgACcwSRU1prBnXlGxNDOwQ	document	3	5534474259	0	2026-04-29 19:06:14.903253	0
251	145	بادئة — physio_occlusions-intestinales aigues (1)		BQACAgQAAxkBAAKZw2nqeKpYyoX64BnAaLPG7KPkxJ7-AAJwIQAC-FwpU1oM6igkjNELOwQ	document	6	5663352778	0	2026-04-23 19:53:15.135651	0
283	14	Solution — Corrigé Type TD N1		BQACAgQAAxkBAAKxCWnzf1-h-W2X2bQ_KgixOP7zcSpDAAJAGgAC20KgU8l5BoKTlX5ZOwQ	document	14	5534474259	0	2026-04-30 16:12:16.202805	0
32	13	Chapter 2	الدر س التاني في مادة الارشي	BQACAgQAAxkBAAIEH2m78BRqkoRJ6-vK5EswZjlwtd66AALsHwACBudpUBaGLScuhNniOgQ	document	79	5534474259	0	2026-03-19 12:46:11	0
210	137	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026		BQACAgQAAxkBAAJrAmngmnh_-ceXxmWHuGXCiIs0uLw_AALpHQAC_GPIUfrIlXTmdu-ZOwQ	document	53	5663352778	0	2026-04-16 08:14:49.305493	0
258	27	Serie 4	سيري 4 بروبا	BQACAgQAAxkBAAKkVmntOAEjDmDRmCFAxQQ9D9P528-LAAIjGwACabJpU5Y2gBSmG-LgOwQ	document	64	5534474259	0	2026-04-25 21:54:34.916395	0
233	6	Serie 4	سيري 4 linked listes	BQACAgQAAxkBAAJ_3WnlJmldXm4Ei1XyCEvZL3M2LOiWAAIoGgACFV0pU9aOkhHgWjwHOwQ	document	51	5534474259	0	2026-04-19 19:56:33.033418	0
150	131	رزنامة	رزنامة فصل 2	BQACAgQAAxkBAAI0cGnSAtCxVmxDZrgzxqW0h6yV9mTKAAITHQAC_YqRUuqvjpDszCZvOwQ	document	198	5534474259	0	2026-04-05 06:36:01.065532	0
281	28	. — Serie N°3, Linked Lists (2024-2025)		BQACAgQAAxkBAAKwk2nzDFNY2p8VhUPnASwW_HJSDT5LAAJoHQACFIu4Ukbf3CdjSCVnOwQ	document	9	5534474259	0	2026-04-30 08:02:30.679292	0
256	87	. — تاست		BQACAgQAAxkBAAKj8Wns_UZbQktPy0M3F7_UW1kYW0RxAAKsHgAC6cZoURkfm2D-7Q_iOwQ	document	11	5534474259	0	2026-04-25 17:44:34.496205	0
213	137	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A		BQACAgQAAxkBAAJrBWngmnhWNEWhmmssbr_rHqXJzaccAAJIGgACbe3wUqxphzRs565cOwQ	document	68	5663352778	0	2026-04-16 08:14:50.683743	0
252	11	Analyse — Exo2-3,serie3		BQACAgQAAxkBAAKd-2nrjT8ihHAV_yXUWkozn557w1amAAICIwACaHMAAVPT1EJ4Y8zBzDsE	document	9	5534474259	0	2026-04-24 15:33:42.962892	0
214	137	Skip — 01- Introduction à la Parasitologie 2026 Dr Fellahi A		BQACAgQAAxkBAAJrBmngmni5kwIzGacKA5GZtUtfkMc0AAJKGgACbe3wUjvo3iePGt58OwQ	document	24	5663352778	0	2026-04-16 08:14:51.145178	0
211	137	Skip — 2_Cestodoses_adultes_cestodes_larvaires_Trématodes_Jijel_2024		BQACAgQAAxkBAAJrA2ngmngYYvgJpBQZ9txew4SgTgIXAAJUGwAC6ZbwUgfJHOLJuly5OwQ	document	14	5663352778	0	2026-04-16 08:14:49.764944	0
216	137	Skip — 02-2. Amibes libres Dr Fellahi A (1)		BQACAgQAAxkBAAJrCGngmniW6zR4v8CAw07H5gkiaGx-AAJMGgACbe3wUmQHAp9xsrZROwQ	document	38	5663352778	0	2026-04-16 08:14:52.069012	0
25	23	Serie 2	Logic	BQACAgQAAxkBAAIDjGm76i7om07r-JoWh0xeDewscMs_AALrHQAC3HY5UY0jozr4aRI7OgQ	document	52	5534474259	0	2026-03-19 12:21:02	0
228	71	Os — Chapter 3 (1)		BQACAgQAAxkDAAJvDmniB3llxa8SjfnPPyD5zWviM-WzAAIqGgAC7b0pUDIoGfkGF_0rOwQ	document	31	5534474259	0	2026-04-18 07:23:49.885711	0
158	130	اختصارات الكيبورد	Skip	BQACAgQAAxkBAAI5k2nS4A_U0ksNsgl1bQZQG1m0_eqlAAKUAAPOcrhRbfjFJufy8yI7BA	document	22	5534474259	0	2026-04-05 22:19:59.857424	0
215	137	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)		BQACAgQAAxkBAAJrB2ngmngdWmLaBM4PgNvlRVozhdd_AAJLGgACbe3wUrkHSNX7cLR3OwQ	document	37	5663352778	0	2026-04-16 08:14:51.609395	0
308	153	Serie 1 partie 1	Serie 1 partie 2	BQACAgQAAxkBAAK7jWn2bEh6wP2bBORhGPPB3_a__4wjAAI0HwACg12JUBQ0nkRnGdYCOwQ	document	21	7596452439	0	2026-05-02 21:36:44.697342	0
263	21	Teste 1	Skip	AgACAgQAAxkBAAKqEmnw4vO7jJyD65W1KsO17nhOPNGDAALJFmsbKkyJU-z67IAec4qLAQADAgADeQADOwQ	photo	14	5534474259	0	2026-04-28 16:40:30.733295	0
176	72	Seri1 — PW5 corrected		BQACAgQAAxkBAAJQzWnYicC-g-Dt1GgW_W9ByIDSPLFCAAL7GwACw8JoUhUdSZdWcWgNOwQ	document	43	5534474259	0	2026-04-10 05:25:22.907361	0
261	6	Solution serie 4 (3,6,8)	Skip	BQACAgQAAxkBAAKnY2nvrHF9e_9nk7Dzrdx9hMRXX_p3AAJyHgACzrqAU-7d2R4tAAEfoTsE	document	8	5534474259	0	2026-04-27 18:35:30.058354	0
274	28	. — Chapter IV. Linked Lists (Session N°2)		BQACAgQAAxkBAAKwjGnzDFNp2l-jL-SD2tJwYpQcFmLyAAJhHQACFIu4Uhuvb1jvKUCEOwQ	document	3	5534474259	0	2026-04-30 08:02:27.286344	0
389	159	Chapter 5	Numpy-Arrays	BQACAgQAAxkBAALWo2n7tBuv2p8C6CgKuNO07v1xRvGxAAIRHwACRs7ZUxHhxH6jJGTyOwQ	document	8	7596452439	0	2026-05-06 21:35:23.934727	0
3	5	Chapter 1	String	BQACAgQAAxkBAAIBd2m700Fa0wPsxKRxEjcEcslpWp96AAKdHgAC5G7hURVk0BBa-KTwOgQ	document	118	5534474259	0	2026-03-19 11:41:26	0
54	23	Serie 4	سيري 4 في مادة اللوجيك	AgACAgQAAxkBAAIPt2nL5QbcbfE3x34oNIpTojaeGkesAAIlDWsbdFZhUrSbgXxVZenzAQADAgADeQADOgQ	photo	177	5534474259	0	2026-03-31 15:16:27	0
412	153	Serie 2 — series 2(1)		BQACAgQAAxkBAALeMWn-MxQZDJC9toIvjxaYvZ2SrWdkAALeIwAC9RHgUCAZfpARBDH8OwQ	document	14	7596452439	0	2026-05-08 19:03:29.689565	0
152	6	Serie 3	Linked listes	BQACAgQAAxkBAAI2SWnSOXUfabm4IeaEJ0eHMLdJEeWjAAJnGgAC_6CRUk5dvPiA2GEjOwQ	document	91	5534474259	0	2026-04-05 10:29:09.631174	0
260	15	Tp final	Skip	BQACAgQAAxkBAAKnPWnvYNlCViYqDXXdqd7xT13EPxOIAAJyHQACR3V5U7rARQLymsl4OwQ	document	26	5534474259	0	2026-04-27 13:12:57.62002	0
277	28	. — Chapter IV. Linked Lists (Session N°5.1)		BQACAgQAAxkBAAKwj2nzDFMTAmMIff14CHSTK-3SjQL1AAJkHQACFIu4Ur3_3EbKdNmROwQ	document	22	5534474259	0	2026-04-30 08:02:28.740031	0
284	14	Solution — Tutorial N3 Corrigé Type		BQACAgQAAxkBAAKxCmnzf19jdOwYoZoF7ALOFHx4-YrwAAJBGgAC20KgU6wORBGWYjdjOwQ	document	13	5534474259	0	2026-04-30 16:12:16.72719	0
271	19	Solution — Answers -Series 04-		BQACAgQAAxkBAAKuemnyhC96TB2SDL8TPikmGLsAAYJchgACBh8AAnMEkVNVJB4HgKRrtDsE	document	6	5534474259	0	2026-04-29 22:20:33.777391	0
333	161	Chapter 2	Files	BQACAgQAAxkBAALCmWn2_AVMdMjg9dneuF2d7Ft-Ml5kAAL9GwACTi9QUlikuBDgcV6eOwQ	document	2	7596452439	0	2026-05-03 07:40:53.719703	0
162	134	Chaine algèbra 2	Skip	https://youtube.com/playlist?list=PLgKSr97JkHD6o4rZJPjOXlytSbfH2EK8B&si=MT8UwA68HcXb2dVI	link	65	5534474259	0	2026-04-05 22:47:15.522031	0
287	5	Chapter 3	Les linked listes	BQACAgQAAxkDAAKzlmn0nWKcPhUkefC530MFZq3D7mHIAALoHwAC5_YIUG1odttNqQxBOwQ	document	36	5534474259	0	2026-05-01 12:37:55.990222	0
285	14	Solution — Corrigé Type TD N2 (1)		BQACAgQAAxkBAAKxC2nzf18XaiiQnpRPeOmEcj1bzUzDAAJCGgAC20KgU1wv-5Z7JuXPOwQ	document	24	5534474259	0	2026-04-30 16:12:17.237892	0
280	28	. — Chapter IV. Linked Lists (Session N°6.2)		BQACAgQAAxkBAAKwkmnzDFNoi5pThvYLfBjxNr9j3L4CAAJnHQACFIu4UgEIUvMe2c3dOwQ	document	32	5534474259	0	2026-04-30 08:02:30.195282	0
153	130	نموذج ذكاء اصطناعي	Skip	BQACAgIAAxkBAAI3vmnSWAJlqroOj5n550LTqTOCusOVAAIxSAACp3qBSEHKClAjKiyROwQ	document	28	5534474259	0	2026-04-05 12:39:30.73444	0
259	10	Serie 5	سيري 5 اناليز	BQACAgQAAxkBAAKl1mntx_waLq0k3-HiIqPjl8ZudefbAAJQIQACabJxU2hk2Q5f2ovcOwQ	document	16	5534474259	0	2026-04-26 08:08:49.0241	0
319	158	Solution Serie 1	Correction of serie 1	BQACAgQAAxkBAALBDmn29A0jpnfiIy2rxQ0dCav-x7BjAAIQHwACmmGIUT3TaEfH7c9vOwQ	document	0	7596452439	0	2026-05-03 07:10:20.656399	0
143	27	Serie 3	Skip	BQACAgQAAxkBAAIwA2nRfjdKtOKVhl4JKJ_8Ot0K1QABmAACxR0AAk-wkVKS6Brso4cx5zsE	document	131	5534474259	0	2026-04-04 21:10:23.876635	0
212	137	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A		BQACAgQAAxkBAAJrBGngmnj9OGNHgXUtvrNnP81qI1dcAAJHGgACbe3wUlLIzZteueKjOwQ	document	80	5663352778	0	2026-04-16 08:14:50.223527	0
278	28	. — Chapter IV. Linked Lists (Session N°5.2)		BQACAgQAAxkBAAKwkGnzDFN-DbuxPpuDD2Zi5aG1hXMtAAJlHQACFIu4Ul0INcwRcaJ1OwQ	document	37	5534474259	0	2026-04-30 08:02:29.227563	0
317	157	All chapters	All chapters	https://www.jirka.org/ra/realanal2.pdf	link	12	7596452439	0	2026-05-03 07:04:23.146992	0
221	13	Chapter 4	شابتر 4 ارشي	BQACAgQAAxkBAAJs1GnhwqL7mMBhsF0hHo26f8V8wAbfAAL0HQACrq8RUw-kwvXt9SDdOwQ	document	40	5534474259	0	2026-04-17 05:18:27.850668	0
279	28	. — Chapter IV. Linked Lists (Session N°6.1)		BQACAgQAAxkBAAKwkWnzDFNWPYZrP1DN3u_urs_6vwn_AAJmHQACFIu4UkHRdbeRRQjXOwQ	document	45	5534474259	0	2026-04-30 08:02:29.711262	0
376	87	. — Corrigé. Examen.anal2.mai2024		BQACAgQAAxkBAALKD2n46AqsmlqwfUKMGPQykbb4HZZfAAK5GQACbeF4UbcAAbkCjmy1VTsE	document	45	5534474259	0	2026-05-04 18:40:26.395513	0
309	153	Serie 1 partie 2	Serie 1 partie 2	BQACAgQAAxkBAAK7jmn2bEjkKwf5fki0PRlHkRGR489WAAJMHwACg12BUMm70A3zJiygOwQ	document	25	7596452439	0	2026-05-02 21:37:21.512394	0
268	19	Solution — Answers (Series 01)		BQACAgQAAxkBAAKud2nyhC_7Q6rhwQHnIApKiDnQTHCBAAIDHwACcwSRU2MERc4k9u-vOwQ	document	4	5534474259	0	2026-04-29 22:20:32.326739	0
334	162	Serie 1 — TD 1.docx		BQACAgQAAxkBAALCnmn2_J4JiKNhDZ1G-d8C6C513vx4AALnGwACsd6BUEHDD1fEjT98OwQ	document	2	7596452439	0	2026-05-03 07:43:26.413305	0
209	28	Solutions exercices linked listes	Skip	BQACAgQAAxkBAAJpKWneVWx-BY0FGC24c-pVrAL3K_DyAALNHAACSIb5Ug5W55j7Yu6WOwQ	document	26	5534474259	0	2026-04-14 14:55:40.906918	0
275	28	. — Chapter IV. Linked Lists (Session N°3)		BQACAgQAAxkBAAKwjWnzDFPF2CSvVcdMPImXcbjmSLkAA2IdAAIUi7hSu8GdhVoqgwM7BA	document	8	5534474259	0	2026-04-30 08:02:27.770931	0
282	14	Solution — Corrigé Type TD N0		BQACAgQAAxkBAAKxCGnzf19cj82PSOVlkteKD6wJQZhbAAI_GgAC20KgU2LpC-MODI7wOwQ	document	33	5534474259	0	2026-04-30 16:12:15.625843	0
208	28	Exercices linked listes	Skip	BQACAgQAAxkBAAJpCGneRmvgTGtkfIoN7SxmingJ31k0AAJRHwACN4zwUifUiM5xoE1sOwQ	document	35	5534474259	0	2026-04-14 13:51:39.79919	0
112	8	Solutions quizs	حل ميكرو A / B	BQACAgQAAyEFAATW-PBcAAIENGnNeD021SQP5zHl1dAxfstEL2oyAAJHHQACln9xUglKJmnEqQWBOgQ	document	67	5534474259	0	2026-04-01 19:55:41	0
305	150	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71		BQACAgQAAxkBAAK6k2n2X7tficwf37l9iJoIIEoz9o7RAAKaHAACR4u5U2WaHc3q0R6uOwQ	document	14	5534474259	0	2026-05-02 20:51:27.957109	0
303	150	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36		BQACAgQAAxkBAAK6kWn2X7umJOXr3BehRdOw0jHlVGZkAAKZHAACR4u5U1Y7eWQv20psOwQ	document	43	5534474259	0	2026-05-02 20:51:27.433098	0
342	163	Serie 3	Pointers	BQACAgQAAxkBAALC0mn2_bY0WZEp_3HEnkj-zFMLdcwHAALLHgAClLWIU0jYbvhKRDu6OwQ	document	3	7596452439	0	2026-05-03 07:48:06.7183	0
313	155	Chapter 1	Coordinates	BQACAgQAAxkBAAK8r2n2d6cfqoZjEBDNT9nDMc1f1V4jAALvHAACqQLhUOHB4pVPdm20OwQ	document	8	7596452439	0	2026-05-02 22:16:07.795633	0
26	23	Serie 3	Logic	BQACAgQAAxkBAAPcabp33JCwxWoTdn4iSQNA8WcjoJwAAikeAAJ0-3lRSa9OgPD2CW46BA	document	135	5534474259	0	2026-03-19 12:21:15	0
354	165	Serie 3	Matrices	BQACAgQAAxkBAALDaWn3Ac2mQaJSXqMdlz0TZTfiziruAAK5GgACAcz4UnuNKjjltpH8OwQ	document	1	7596452439	0	2026-05-03 08:05:33.99409	0
339	162	Solution of TD 1	.	BQACAgQAAxkBAALCvWn2_S2Hb_XZQEEiHDs_3GoB7k9LAALhHwAC3TOgU0sNXpf1tzpSOwQ	document	0	7596452439	0	2026-05-03 07:45:49.555852	0
227	139	ملخص chapter 3	Skip	BQACAgQAAyEGAATct0PdAAIKwmnffLPXKxHTvz5C9yKrxMBK2rhrAAKWIgAC7ZbpUkFecx0T7uzjOwQ	document	39	5534474259	0	2026-04-17 10:25:08.345771	0
41	14	Correction serie 2	سيري 2 في مادة الارشي مع لحل	BQACAgQAAxkBAAIN5GnLpHFbjgABiouqiUvOP5mvqdQsOgACbB4AAqgEEFI3KnAwzMvY3zoE	document	96	5534474259	0	2026-03-31 10:39:45	0
343	163	Serie 4	Linked lists	BQACAgQAAxkBAALC3Wn2_f-uH0Dq7u6fqGbwCnO9bU66AAJhHgACXgdgU7xzXQ9NV-PNOwQ	document	0	7596452439	0	2026-05-03 07:49:19.61985	0
29	27	Serie 1	Proba	BQACAgQAAxkBAAIDxGm761Ej6_Lyj_7mN91ug4AmoyIeAALXHgACFHlYUA4_hBXUUmbEOgQ	document	53	5534474259	0	2026-03-19 12:25:53	0
320	158	Serie 2	Serie 2	BQACAgQAAxkBAALBP2n29PayVJjgY07MFfEiLKsDUW0mAALpHAACj6SQULt3Hj-gbxpHOwQ	document	2	7596452439	0	2026-05-03 07:14:47.663133	0
327	160	Serie 1	Introduction with arithmetic operations	BQACAgQAAxkBAALCCWn2-RQ3bQVudqsMpB4Evm3YhXQmAAKrIAAClo0IUYktA4pXur3yOwQ	document	3	7596452439	0	2026-05-03 07:28:20.55028	0
345	164	Chapter 1	Vector space	BQACAgQAAxkBAAK7c2n2ZsyUrcafzPy9D7aULcGvbCq_AAKuIgACkLIBUTB7zDIyV9AHOwQ	document	4	7596452439	0	2026-05-03 07:53:32.151604	0
115	27	Solution serie 1	Skip	BQACAgQAAxkBAAIZmGnNqvCG1mNGZwIZSjwEjelpeBU_AALlGwAClMtwUsYAARqplZ05JzoE	document	94	5534474259	0	2026-04-01 23:32:08	0
306	150	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8		BQACAgQAAxkBAAK6lGn2X7vr1sBJYFsSYwrc-gobmcAFAAKbHAACR4u5UwXfT4EODvFSOwQ	document	23	5534474259	0	2026-05-02 20:51:28.317648	0
325	159	Chapter 3	Functions and modules	BQACAgQAAxkBAALB3Wn2-GyEUFKkZINtamGn1_H-1KPlAAKjGwAC3ekpU9DalusS6pmhOwQ	document	0	7596452439	0	2026-05-03 07:25:33.156564	0
337	162	Serie 3	Pointers	BQACAgQAAxkBAALCr2n2_OwhzRpUZlggaTuHnOXjYMsCAALqHAAClOsBU8qHEh7YSz1gOwQ	document	7	7596452439	0	2026-05-03 07:44:44.662234	0
335	162	Serie 1 — ASD2_exercise6_supplementaire		BQACAgQAAxkBAALCn2n2_J6OCoLLwZREt03_eHE_tpg_AAIFHwACqQLZUJXxnOjHz6YjOwQ	document	4	7596452439	0	2026-05-03 07:43:26.717224	0
328	160	Solution of serie 1	.	BQACAgQAAxkBAALCFWn2-Tz_l6yj0GzyQNMsi7XAXixCAALjHAAClvBwUxmOQWl_zCmdOwQ	document	5	7596452439	0	2026-05-03 07:29:00.83634	0
326	159	Chapter 4	Python lists	BQACAgQAAxkBAALB6Wn2-JCBaO9HGS-3j7xvSPOasm58AAJAHQACmEu5U2R13x8Tg5RVOwQ	document	1	7596452439	0	2026-05-03 07:26:09.145124	0
304	150	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45		BQACAgQAAxkBAAK6kmn2X7vefuuVkoJ4TXJYkvZTtymKAAKYHAACR4u5Uw6b3iTIuy2bOwQ	document	36	5534474259	0	2026-05-02 20:51:27.621845	0
323	159	Chapter 1	Introduction	BQACAgQAAxkBAALBrmn296mzLy0F2RNQxIMZTV0PHr76AAJfHgACXPNxUAS6QwFz1LuoOwQ	document	2	7596452439	0	2026-05-03 07:22:17.739674	0
30	27	Serie 2	Proba	BQACAgQAAxkBAAIDy2m762AT3gWJ5qjwhA7Z6-usTi0XAAJqIAAC3HYpUSQnJL_UEBgSOgQ	document	41	5534474259	0	2026-03-19 12:26:07	0
348	164	Chapter 3 — chapter_3_matrices		BQACAgQAAxkBAAK7dWn2Zsy0DRRSZWfYaH3PLelDYqvtAAJWHgACNJG5UnB5rUZGpSvGOwQ	document	5	7596452439	0	2026-05-03 07:55:41.839539	0
329	160	Serie 2	Functions and modules	BQACAgQAAxkBAALCN2n2-ZEoZXT5oj-Mh2S_ZGHghKzXAAKkGwAC3ekpUxygjZeE0f9EOwQ	document	1	7596452439	0	2026-05-03 07:30:26.030466	0
352	165	Serie 2	Linear maps	BQACAgQAAxkBAALDW2n3AaCW1LmdDoG5MZv6314PuLB7AAIgJQACrjORUdDMkptpyWcGOwQ	document	4	7596452439	0	2026-05-03 08:04:48.434877	0
330	160	Solution of serie 2	.	BQACAgQAAxkBAALCRmn2-bd_n_P-fLgrHa7WHhr5WvtUAAKlGwAC3ekpUw9w-R9b54RPOwQ	document	1	7596452439	0	2026-05-03 07:31:03.789679	0
350	165	Serie 1	Vector space	BQACAgQAAxkBAALDSmn3AV7QLL02nMQ1jKqpb1n07KvrAAIMHAACj6SYUFmIFtK-XMabOwQ	document	1	7596452439	0	2026-05-03 08:03:43.074075	0
351	165	Solution of TD 1	.	BQACAgQAAxkBAALDVGn3AY28ze2_Bon7z-tJF1aOog0oAAIkIAACjrlAU8g4WlNoWu3cOwQ	document	1	7596452439	0	2026-05-03 08:04:29.312198	0
336	162	Serie 2	Files	BQACAgQAAxkBAALCqGn2_NKu48jvlH-pKKcQCtG_GkjgAAL7HAACPEWgUln8yiMLa3SFOwQ	document	3	7596452439	0	2026-05-03 07:44:18.394011	0
341	163	Serie 2	Files	BQACAgQAAxkBAALCy2n2_Zm37Eq1o8l4TZdeNjKFLAO4AAJYIwACxOZoUTtn4zFb3_AXOwQ	document	2	7596452439	0	2026-05-03 07:47:37.698456	0
353	165	Solution of TD 2	.	BQACAgQAAxkBAALDYmn3Abt1gcUuGhumfe7vxXTRFoLtAAIjIAACjrlAU277eqbxOJ3zOwQ	document	2	7596452439	0	2026-05-03 08:05:15.980753	0
340	163	Serie 1	Structs	BQACAgQAAxkBAALCxGn2_YSY5CTaxxUGOd5hfkDrtXopAAJqHwAChKPhUJ7-NwUQzHzWOwQ	document	3	7596452439	0	2026-05-03 07:47:16.985991	0
349	164	Chapter 3 — polycopié Maths2. ZENKOUFI Lilia		BQACAgQAAxkBAAK7dmn2ZszEQqKnvt43b1IqYoHcFzpFAAL0HwACvL9BU5avPiz5u93ROwQ	document	3	7596452439	0	2026-05-03 07:55:42.024379	0
338	162	Serie 4	Lists	BQACAgQAAxkBAALCtmn2_QHcBsfnLm6IIxacXmJbw7IiAAJgHgACXgdgUxIOrmsgm119OwQ	document	3	7596452439	0	2026-05-03 07:45:05.866127	0
359	166	Chapter 4	AI for time and task management	BQACAgQAAxkBAALDr2n3BR8V4hBoB2RlZMZNSuhu06YcAAIGHQACMbO5U81NKI-v67jROwQ	document	2	7596452439	0	2026-05-03 08:19:43.75595	0
357	166	Chapter 2	Advantages and risks of AI	BQACAgQAAxkBAALDoWn3BKpoJrHJA-dTAy8JfRxwt8A9AAKMGwACuASwUj9woM5djU_KOwQ	document	3	7596452439	0	2026-05-03 08:17:46.947776	0
402	129	كتاب جبر 2		BQACAgQAAxkDAALcymn9KJH4D4EJIrXf9ZrA5OfxTbXEAAJEGQAC_6CJUhScgK9mYFf5OwQ	document	2	5534474259	0	2026-05-08 00:05:15.611871	0
383	169	. — Histology		BQACAgQAAxkBAALUtmn7TUJGvV_n2JqvaPPqDols4DraAALLHQACrF3BUqUOpjg3ATAmOwQ	document	0	5534474259	0	2026-05-06 14:17:04.817827	0
289	5	Chapter 5	Les queues	BQACAgQAAxkDAAKxqWnzkPnGuJQYwFBju-aVWGNi7nuSAAIRHwACTZDJUKrJej6k1HD9OwQ	document	145	5534474259	0	2026-05-01 12:38:58.454874	0
384	169	. — chapter II embryo		BQACAgQAAxkBAALUt2n7TUKDZZJOsbnIELGwMskzd5EaAALMHQACrF3BUmW9Qj4_iFXCOwQ	document	0	5534474259	0	2026-05-06 14:17:05.146982	0
288	5	Chapter 4	Les staaacks	BQACAgQAAxkDAAKxqGnzkPlYNz8sJskLAAEFOwziDAUPCwACEB8AAk2QyVBjNQW94ZA_ZTsE	document	84	5534474259	0	2026-05-01 12:38:32.741233	0
148	130	أفضل طريق لتعلم البرمجة	Skip	BQACAgQAAxkBAAIzdWnR0XMRAyfaj7N_ei5wUF4R7wM0AAI3BgADCFhQa7xRK1rt2vo7BA	document	47	5534474259	0	2026-04-05 03:05:24.272094	0
390	139	ملخص chapter 2	ملخص شامل للشابتر 2 ارشي	BQACAgQAAxkBAALW1Gn7xPDFqmJcJ1UDrSA-InBUcOlwAAK9HAACgoLhU2Nlb6_89f41OwQ	document	15	5534474259	0	2026-05-06 22:49:57.379446	0
400	129	كتاب جبر		BQACAgQAAxkDAALcyGn9KJGPVdNDfoQBa3f8v5jTCW52AAJCGQAC_6CJUlSE0dWVihJ8OwQ	document	3	5534474259	0	2026-05-08 00:05:14.731883	0
381	17	Exaams part 2	Skip	AgACAgQAAxkBAALULmn7FfL_lp-9xKVnyvBeJVyBLvE_AALHDmsbFhvZU9G7AAHt1ZQWIAEAAwIAA3kAAzsE	photo	13	5534474259	0	2026-05-06 10:20:34.461335	0
380	17	Exams 2025/2024	اختبار ارشي	AgACAgQAAxkBAALUJ2n7FdnWqhOfXpLostB73AaaM1x9AALGDmsbFhvZU7zgCCEm7ETfAQADAgADeQADOwQ	photo	13	5534474259	0	2026-05-06 10:20:10.126401	0
385	169	. — Oogenesis		BQACAgQAAxkBAALUuGn7TUJCSap-O4UwjG6W2ISjwKdOAALNHQACrF3BUhOKL6OWwSsqOwQ	document	8	5534474259	0	2026-05-06 14:17:05.310519	0
401	129	كتب الجبر — book-exos (1)		BQACAgQAAxkDAALcyWn9KJGQ0nFGvAABHJTNa-t8vZSxvgACQxkAAv-giVJ8Yh6ZAAF6EEI7BA	document	2	5534474259	0	2026-05-08 00:05:15.169286	0
204	23	Serie 5	سيري 5 لوجيك	BQACAgQAAxkBAAJnxGndGYtF9aJ_WZJe-DZSYAt2Uoz-AALMGwACWETgUr_bTNraVBhdOwQ	document	106	5534474259	0	2026-04-13 16:27:56.172512	0
415	153	Serie 2 — Phys2-Series2-part4		BQACAgQAAxkBAALeNGn-MxSuTfwTb-kAAZX7JpLZMkierwACaRwAAteJ4VMub9E42qtq7jsE	document	8	7596452439	0	2026-05-08 19:03:31.117637	0
391	139	ملخص chapter 3 +	ملخص شابتر 3	BQACAgQAAxkBAALXDGn7yop4RacSs90sV1yuh_nEhXXsAAL3HgACGd_hUzopBdzNls4zOwQ	document	40	5534474259	0	2026-05-06 23:11:06.6099	0
164	130	تعلم اكسال 2010	Skip	BQACAgQAAxkBAAI7sWnS_s4__fZk93YN5yrcXYlouHslAAKhBwACqelRAAGYwQLHhTCEKjsE	document	34	5534474259	0	2026-04-06 00:31:20.382394	0
366	167	Chapter 3 — IntroductionToProba_Probability_Part2		BQACAgQAAxkBAALD2Gn3BgG8XkKeNSms3tfitWyxiBIIAAIUHQACMbO5UweQF3pY_IxxOwQ	document	15	7596452439	0	2026-05-03 08:23:30.383225	0
403	80	. — semio genitale masculin dr kemiha		BQACAgQAAxkDAALc4mn9KSbScjE3wxxH-wYi6Wp5QAVnAAImHQACLmgAAVKXUguvN17IRDsE	document	5	5534474259	0	2026-05-08 00:08:06.435553	0
358	166	Chapter 3	AI for documentary research	BQACAgQAAxkBAALDqGn3BOb8LthUSt6POmk3ukOuobb9AAJDJgACTi0pU6-6e9yKpxfAOwQ	document	5	7596452439	0	2026-05-03 08:18:47.264937	0
139	124	Exams (USTHB)	اختبارات العوام السابقة في جميع مواد لجامعة USTHB	https://drive.google.com/drive/mobile/folders/1P4zjst9Blz50vPODEHICZg5apYZMHfJU?fbclid=PAb21jcAQ-E_1leHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAafUaGPoiZ-JS5tWfg_VX5WAclQqlkX83UHsH4pHotUZEsiS9EWZ1CZj8Q61Dg_aem_6X3D9y1faG5kCUg-FwQK6Q	link	80	5534474259	0	2026-04-04 16:16:58.195243	0
346	164	Chapter 2	Linear maps	BQACAgQAAxkBAAK7dGn2Zsz05SEgL3uYE-9rt-N-7Jr9AALiFAACyHaJUio11qYb6QzuOwQ	document	3	7596452439	0	2026-05-03 07:53:51.959025	0
375	6	Solution serie 4(5/7)	Skip	BQACAgQAAxkBAALHH2n4RS2gvhmou2vitsv3XNb9wXM3AAI1HQACa0fIUyZ6szAc2rWQOwQ	document	54	5534474259	0	2026-05-04 07:05:17.491126	0
409	80	. — IRA (4)		BQACAgQAAxkDAALc6Wn9KSa19V6x6DOZ5OAlYYEGmftaAAIMHQACmjYoUimK5ioPiBY5OwQ	document	7	5534474259	0	2026-05-08 00:08:09.197489	0
85	70	Chapter 1	Skip	BQACAgQAAxkBAAIQ7mnL7X_FASZAuOO232VCDv5vI93GAAIHHAACzmLYUtku96uT3kJ_OgQ	document	17	5534474259	0	2026-03-31 15:51:26	0
24	23	Serie 1	Logic	BQACAgQAAxkBAAIDhWm76iGQLVYDK3kNqba3TmJ3IaFuAAIjHgAC2tzgUKFknUU3F5ImOgQ	document	65	5534474259	0	2026-03-19 12:20:48	0
370	168	TD 2 solution	.	BQACAgQAAxkBAALEBWn3BpekpSyjYKl1eY213Ir5buQAA1IdAAKYS7lTEi5fnYGwzeA7BA	document	14	7596452439	0	2026-05-03 08:25:59.539845	0
234	23	Serie 6	Skip	BQACAgQAAxkBAAKGWGnmKnapHAyf_bARzas9irAfj00HAAIhIAACfYwxU_AjG7IB5f70OwQ	document	141	5534474259	0	2026-04-20 13:30:30.367578	0
371	168	Serie 3	Introduction to probability theory	BQACAgQAAxkBAALEDGn3BrWi1pkyqhL2H-pcqMqYyKB4AALkHgAClDawUdFntqE3T2hLOwQ	document	7	7596452439	0	2026-05-03 08:26:29.321627	0
28	26	Chapter 2	Proba	BQACAgQAAxkBAAIDvWm760D4MIC-qbhO9VPCMXBvbO_FAAKBIAAChUcgUcI5rhaKC5xiOgQ	document	314	5534474259	0	2026-03-19 12:25:36	0
185	134	Chaine algo 2 algorithmicsbyzair	@algorithmicsbyzair	https://youtube.com/@algorithmicsbyzair?si=vKBK_U_VLUMJS7tS	link	56	5534474259	0	2026-04-11 14:47:15.371158	0
372	168	TD 3 solution	.	BQACAgQAAxkBAALEE2n3BuCmbJu_vfor3qSFwrg1K5WtAAJTHQACmEu5U1sniVPU3iK4OwQ	document	10	7596452439	0	2026-05-03 08:27:13.267982	0
368	168	TD 1 solution	.	BQACAgQAAxkBAALD92n3Bl_04eX36vAEk3upKOR9XxPkAAJRHQACmEu5U8K0gRVm6IH5OwQ	document	9	7596452439	0	2026-05-03 08:25:03.498684	0
367	168	Serie 1	.	BQACAgQAAxkBAALD7mn3BkEC2RbUYuVzUwS3_-an6z-_AAJ4HwACQ254UB4LqVc0fqXIOwQ	document	18	7596452439	0	2026-05-03 08:24:33.903397	0
408	80	. — Sémiologie-app-urinaire-examen-clinique (2)		BQACAgQAAxkDAALc6Gn9KSbTNiyD8Jii8M8vUfVgDRbMAAJrHgACyUV4UQ0wUE7Y54CmOwQ	document	11	5534474259	0	2026-05-08 00:08:08.761731	0
406	80	. — semio gyneco 2		BQACAgQAAxkDAALc5Wn9KSbpx53eVt2Co5CYvR-5FQJJAALJHgACGIxRUb37LsotYDucOwQ	document	43	5534474259	0	2026-05-08 00:08:07.747019	0
362	167	Chapter 1 — Fac_Cent_Chap1_Part3		BQACAgQAAxkBAALDvGn3BYz0Mg8aMGJPUJGlkaYsp65iAALXHQACmOsYUZNgLZEemX-MOwQ	document	34	7596452439	0	2026-05-03 08:21:33.258134	0
363	167	Chapter 1 — Fac_Cent_chap1_Part4		BQACAgQAAxkBAALDvWn3BYz96aAPK8WvDBBE6NY5c4eOAALVHQACmOsYUS1nKv6SYaZqOwQ	document	7	7596452439	0	2026-05-03 08:21:33.451443	0
7	8	Quiz B	Quiz	AgACAgQAAxkBAAICfmm74X_gahdo3uXtB-jaqRUBzm_-AAKqDGsb5G7hUU0q6mfK6Ey6AQADAgADeQADOgQ	photo	98	5534474259	0	2026-03-19 11:43:59	0
360	167	Chapter 1 — Fac_central_chap1_Part1 (1)		BQACAgQAAxkBAALDumn3BYw86tmmUokSr22NtGiOPKGVAALsHwACsd55UKkr3ORb-TWlOwQ	document	8	7596452439	0	2026-05-03 08:21:32.860416	0
407	80	. — complications aigues du diabète (urgences) (1)		BQACAgQAAxkDAALc5mn9KSZPvvrErvl92waPS7MIu4RXAAIlHwACGIxJUbjUfR0C0JjMOwQ	document	22	5534474259	0	2026-05-08 00:08:08.181044	0
369	168	Serie 2	Combinatorial analysis	BQACAgQAAxkBAALD_mn3Bn-lqSpKJP_LFTzVxK6yTjGRAAIlJQAC-EypUSH4nax4qk9hOwQ	document	14	7596452439	0	2026-05-03 08:25:35.726768	0
361	167	Chapter 1 — Fac_cent_chap1_Part2		BQACAgQAAxkBAALDu2n3BYxXFnJJhBtiy3AMBVpLo606AALuHwACsd55UENln1wYhvE4OwQ	document	10	7596452439	0	2026-05-03 08:21:33.060841	0
413	153	Serie 2 — P2Series 2- Part 2		BQACAgQAAxkBAALeMmn-MxQZHsWFEe1_sNLki5ud3iT_AALGMQACBclBUr61BT7hmdlJOwQ	document	1	7596452439	0	2026-05-08 19:03:30.180576	0
356	166	Chapter 1	The fundamentals of AI	BQACAgQAAxkBAALDmmn3BHTX1ND8ZHswS6XocB7pojNKAAJUHQACmEu5U3jHszJ4YHIjOwQ	document	2	7596452439	0	2026-05-03 08:16:52.871057	0
151	130	البرمجة بلغة c	افضل كتاب لتعلم لغة c	BQACAgQAAxkBAAIyB2nRvriVIEpqsjkMYAlxZ8S7IUKpAALqGgACAxUIUZuWx7R3wqFFOwQ	document	77	5534474259	0	2026-04-05 07:56:00.450658	0
405	80	. — semio hg genitale		BQACAgQAAxkDAALc5Gn9KSZUDSFIl6W6GPeW6mglhKKrAALKHgACGIxRUaOK1zMBLt4HOwQ	document	27	5534474259	0	2026-05-08 00:08:07.312784	0
364	167	Chapter 2	Combinatorial analysis	BQACAgQAAxkBAALDyGn3BcFc5zq71sKQEhLtLFwAAThZdQACEh0AAjGzuVOSjyRIQG-vtDsE	document	10	7596452439	0	2026-05-03 08:22:25.627028	0
411	80	. — Cours de Sémiologie Endocrinienne		BQACAgQAAxkDAALc8Wn9KSrWCIpO41Iwj01WE9zKaZYAA2AfAAIUzXlR4U7w-z6wk6o7BA	document	25	5534474259	0	2026-05-08 00:08:10.659895	0
365	167	Chapter 3 — IntroductionToProba_Probability_Part1		BQACAgQAAxkBAALD12n3BgGJim3vGoudChRzF8ltt54yAAITHQACMbO5UwZMNqY_UKkWOwQ	document	19	7596452439	0	2026-05-03 08:23:30.19465	0
183	134	Chaine archi	بلاي ليست ارشي	https://youtube.com/playlist?list=PLDcjPVBNQ25UsUvN9aKsrZPHTAx6zX0xT&si=fSjbSVIF-OFkZuV9	link	36	5534474259	0	2026-04-11 12:43:38.189543	0
410	80	. — 6-Exploration de la glycémie.pptx		BQACAgQAAxkDAALc7mn9KSqaK-7vY2dRaSnjWncsOwVSAALvHwACoNQAAVG27crBh9wybjsE	document	2	5534474259	0	2026-05-08 00:08:09.924892	0
404	80	. — sémiologie-app-urinaire-interrogatoire (1)		BQACAgQAAxkDAALc42n9KSa-EigbxQ4nxtkMTluX6rQhAAJpHgACyUV4Ub_XXocZVL-wOwQ	document	12	5534474259	0	2026-05-08 00:08:06.878053	0
\.


--
-- Data for Name: group_bans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_bans (id, chat_id, user_id, banned_by, reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: group_bot_msgs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_bot_msgs (id, chat_id, message_id, sent_at) FROM stdin;
\.


--
-- Data for Name: group_chats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_chats (chat_id, title, joined_at, specialty_id, notify_new_files, rules, goodbye_enabled, welcome_enabled, welcome_msg, welcome_photo) FROM stdin;
-1003731038862	Unicourses	2026-05-06 08:03:58.456085	1	1	\N	1	1	\N	AgACAgQAAxkBAAEBBclqGwjTTW_zx81UsQMy5EAghjwDLAACKQ5rGzsS2VBg-shk5Kg-hwEAAwIAA3kAAzsE
-1003964096314	طلع عامك 2026 بإذن الله (تقرا s2 بالسيف عليك)🔥💀👌🏼💯	2026-05-30 15:35:01.949612	4	1	\N	0	1	\N	AgACAgQAAxkBAAEBBclqGwjTTW_zx81UsQMy5EAghjwDLAACKQ5rGzsS2VBg-shk5Kg-hwEAAwIAA3kAAzsE
-1003571265208	اخر تحديثات 𝑬𝒅𝒖𝑴𝒂𝒔𝒕𝒆𝒓	2026-05-03 11:03:37.682185	1	0	\N	0	0	\N	\N
-1002710147075	Englich vip	2026-05-30 14:51:23.610968	1	1	\N	0	1	\N	\N
-1003516577459	𝐸𝑛𝑔𝑙𝑖𝑠ℎ 𝑙𝑎𝑛𝑔𝑢𝑎𝑔𝑒 𝑐𝑜𝑢𝑟𝑠𝑒𝑠 ꧁𝐵𝑒𝑔𝑖𝑛𝑛𝑒𝑟 𝑙𝑒𝑣𝑒𝑙+3꧂ 📚💯	2026-05-30 14:51:34.305834	8	1	\N	0	0	\N	\N
-1004255007282	Lwdd	2026-05-30 15:15:03.584172	1	1	\N	1	1	\N	AgACAgQAAxkBAAEBBclqGwjTTW_zx81UsQMy5EAghjwDLAACKQ5rGzsS2VBg-shk5Kg-hwEAAwIAA3kAAzsE
\.


--
-- Data for Name: group_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_members (chat_id, user_id, username, first_name, updated_at) FROM stdin;
-1003731038862	7596452439	Lunarcosmos845	Hadjer	2026-05-14 13:31:13.806791
-1004255007282	6217677522		Kossay	2026-05-30 17:46:37.162065
-1003571265208	6217677522		Kossay	2026-05-30 19:19:31.793216
-1003731038862	8402676106		Abdelkedous	2026-05-12 00:37:42.766503
-1003731038862	8678910305	Ira_aiko08	ᥫ᭡𝓙𝓾𝓶𝓲ᥫ᭡	2026-05-11 17:12:51.474227
-1003731038862	5534474259	lweees23	.	2026-05-14 13:32:59.623147
-1003571265208	8187764784		H@mdane🏆	2026-05-30 19:36:18.90527
-1003731038862	7453203694	Kissamiot5	Ghost	2026-05-14 16:00:42.948517
-1003731038862	8187764784	SH_48_siuuu	H@mdane	2026-05-13 17:54:11.265109
-1003731038862	7025477410		Nâ Dæ	2026-05-13 18:39:45.001677
-1003731038862	7597362284		Sobin	2026-05-13 19:15:50.22795
-1003571265208	5760028323		Safwane	2026-05-30 19:55:59.91075
-1003731038862	8586292342		Ikram	2026-05-09 18:20:22.675868
-1003731038862	7646367698		Ilyess	2026-05-09 19:29:43.138189
-1003731038862	7792516635		🌱	2026-05-09 19:38:24.177592
-1003731038862	5697743309		Yasmine	2026-05-09 20:49:50.130641
-1003731038862	5902920483		Nour🫧	2026-05-09 22:52:24.715566
-1003731038862	7673737752		🥷🏽	2026-05-09 23:05:01.181773
-1003731038862	1006250480		.	2026-05-10 06:33:31.327476
-1003731038862	5460522877		Lydia🩷	2026-05-10 07:31:04.305936
-1003731038862	5487459125		Ràwyä	2026-05-10 13:21:01.442872
-1003731038862	5940412894		Zakarıa	2026-05-10 15:20:13.951418
-1003731038862	7341267668		Malak	2026-05-10 17:34:02.158518
-1003731038862	7597387019		Ghofran	2026-05-10 20:19:53.419353
-1003731038862	8257739665		●	2026-05-10 20:30:27.74551
-1003731038862	8226639724		Reddah	2026-05-10 20:32:21.663006
-1003731038862	8505748259		yousr	2026-05-10 20:34:27.925941
-1003731038862	6706518136		Minou	2026-05-10 20:46:34.190338
-1003731038862	7027628180		Bassma	2026-05-10 21:31:43.971493
-1003731038862	5182715619		Brahim	2026-05-11 05:11:50.852654
-1003731038862	6415628479		Rabehi	2026-05-11 14:45:50.852421
-1003731038862	8218333291		Salsabile	2026-05-11 15:07:58.150972
-1003731038862	8585580215		.	2026-05-11 16:43:45.765277
-1003731038862	6624245542	israaghe	Israa	2026-05-11 17:12:30.478311
-1003731038862	8752445416	oo9yfb	....	2026-05-11 17:22:53.280036
-1003731038862	6543164043		Maroua	2026-05-11 17:50:02.586266
-1003731038862	7089943682	mari1_7rxm	Meriem	2026-05-11 18:15:49.962405
-1003731038862	8286859962	Miss_sia99	𝐌𝐢𝐬𝐬 𝐒𝐢𝐚	2026-05-11 18:23:06.688566
-1003731038862	7254019599		loubna	2026-05-12 05:07:54.738058
-1003731038862	7159164623		kamel🌱SEED	2026-05-12 07:47:08.143376
-1003731038862	7094571950		⁦⁦aya.	2026-05-12 18:56:31.446973
-1003731038862	8662566841		abdou	2026-05-12 20:34:55.190697
-1003731038862	8711666664		Jasmin	2026-05-13 07:34:13.592834
-1003702997981	8726316433		💜𓏲ּ𝄢𝆹𝅥𝆭ᥫ᭡𓍢ִ໋𝓱𝓪𝓭𝓳𝓮𝓻 𓍢ִ໋ᥫ᭡𝆹𝅥𝆭𓏲ּ𝄢💜	2026-05-13 13:42:41.22087
-1003731038862	5568829706		Houda	2026-05-13 14:38:02.466137
-1003731038862	7032900900		𝓝𝓞𝓤𝓡 🖤🧬	2026-05-13 14:43:01.688307
-1003731038862	7251921405		Fayçal	2026-05-13 14:55:32.743636
-1003731038862	7916687158		Amina	2026-05-13 15:11:37.267889
-1003731038862	8203791721		𝒟𝓊𝒶𝒶✨️ 𝓟𝓱𝔂𝓼𝓲𝓺𝓾𝓮	2026-05-13 15:12:00.704746
-1003731038862	6553595440		Khouloud	2026-05-14 13:44:54.050796
-1003731038862	6671456897		Yazid	2026-05-13 15:24:08.055077
-1003731038862	7981319783		N00	2026-05-13 15:34:24.41095
-1003731038862	6193748884		No	2026-05-13 15:51:07.321745
-1003731038862	5249113617		Z	2026-05-13 15:53:38.930526
-1003731038862	7356252787		Aicha Mh	2026-05-13 16:06:20.774048
-1003731038862	1135476521		Anis	2026-05-13 16:15:25.207024
-1003731038862	1891587592		Samy	2026-05-13 16:16:56.168741
-1003731038862	7638719727		Thoraya	2026-05-13 16:18:24.15748
-1003731038862	6430329696		Akram	2026-05-13 16:23:46.341413
-1003731038862	8661807153		Mohamed	2026-05-13 16:38:24.459359
-1003731038862	8353363490		ياسر	2026-05-13 17:43:06.995157
-1003571265208	5245454593		HAMADA	2026-05-13 17:43:55.587962
-1003731038862	7983324772		🌸	2026-05-13 17:49:10.479245
-1003702997981	8230180687		Tasnime	2026-05-13 18:12:39.664475
-1003731038862	5737714403		الشّيماء🦋	2026-05-13 18:59:23.848555
-1003731038862	7454028014		A'	2026-05-13 19:16:17.078002
-1003731038862	6638347625		Sisi	2026-05-13 20:26:58.282956
-1003731038862	7395665584		NOBODY🔞	2026-05-13 20:43:28.975032
-1003731038862	8686602585		Kos	2026-05-13 21:33:28.982962
-1003731038862	5779307151		Farouk	2026-05-13 22:38:29.386046
-1003731038862	5911456981		Imene	2026-05-13 22:50:00.224916
-1003731038862	6147088512		Rania	2026-05-14 08:03:54.177507
-1003731038862	8100545240		𝕱𝖆𝖙𝖎𝖒𝖆.𝕿𝖎𝖒𝖆	2026-05-14 17:05:27.628881
-1003731038862	6265381148		ISHAK	2026-05-14 20:47:36.525991
\.


--
-- Data for Name: group_notify_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_notify_log (id, file_id, chat_id, sent_at) FROM stdin;
81	286	-1003910364146	2026-05-01 12:37:53.889765
82	289	-1003910364146	2026-05-01 12:42:53.893607
83	288	-1003910364146	2026-05-01 12:42:54.385036
84	287	-1003910364146	2026-05-01 12:42:54.883298
85	375	-1003731038862	2026-05-04 07:06:22.887326
86	375	-1003910364146	2026-05-04 07:06:23.143715
87	376	-1003910364146	2026-05-04 18:41:23.836239
88	376	-1003731038862	2026-05-04 18:41:23.876581
89	376	-1003964096314	2026-05-04 18:41:23.912613
90	378	-1003910364146	2026-05-05 14:46:38.649671
91	378	-1003964096314	2026-05-05 14:46:38.729223
92	379	-1003731038862	2026-05-06 06:35:51.53749
93	379	-1003910364146	2026-05-06 06:35:51.807822
94	380	-1002710147075	2026-05-06 10:25:02.062742
95	381	-1003910364146	2026-05-06 10:25:02.104875
96	380	-1003731038862	2026-05-06 10:25:02.380881
97	381	-1002710147075	2026-05-06 10:25:03.577446
98	381	-1003731038862	2026-05-06 10:25:03.578725
99	380	-1003910364146	2026-05-06 10:25:03.597502
100	382	-1003731038862	2026-05-06 13:51:09.206283
101	382	-1002710147075	2026-05-06 13:51:09.372013
102	382	-1003910364146	2026-05-06 13:51:09.404997
103	390	-1003910364146	2026-05-06 22:51:09.649688
104	390	-1002710147075	2026-05-06 22:51:09.659588
105	390	-1003731038862	2026-05-06 22:51:10.063135
106	391	-1003731038862	2026-05-06 23:11:09.465211
107	391	-1002710147075	2026-05-06 23:11:09.51021
108	391	-1003910364146	2026-05-06 23:11:09.742596
109	397	-1003731038862	2026-05-08 00:08:05.883971
110	399	-1003731038862	2026-05-08 00:08:06.794999
111	399	-1003571265208	2026-05-08 00:08:06.828414
112	397	-1003571265208	2026-05-08 00:08:06.856277
113	395	-1003571265208	2026-05-08 00:08:06.967898
114	395	-1003731038862	2026-05-08 00:08:08.212554
115	393	-1003571265208	2026-05-08 00:08:08.245063
116	393	-1003731038862	2026-05-08 00:08:08.249514
117	394	-1003731038862	2026-05-08 00:08:08.281936
118	394	-1003571265208	2026-05-08 00:08:08.298323
119	402	-1003731038862	2026-05-08 00:08:12.585631
120	401	-1003571265208	2026-05-08 00:08:12.603854
121	401	-1003731038862	2026-05-08 00:08:12.675167
122	402	-1003571265208	2026-05-08 00:08:12.701207
123	400	-1003571265208	2026-05-08 00:08:12.749484
124	400	-1003731038862	2026-05-08 00:08:13.957296
125	392	-1003571265208	2026-05-08 00:08:13.957686
126	396	-1003731038862	2026-05-08 00:08:14.002723
127	398	-1003571265208	2026-05-08 00:08:14.01579
128	396	-1003571265208	2026-05-08 00:08:18.121837
129	392	-1003731038862	2026-05-08 00:08:19.327052
130	398	-1003731038862	2026-05-08 00:08:19.365476
131	414	-1003191159502	2026-05-08 19:04:10.004236
132	413	-1003191159502	2026-05-08 19:04:10.025904
133	415	-1003191159502	2026-05-08 19:04:10.117899
134	412	-1003191159502	2026-05-08 19:04:10.180188
135	416	-1003731038862	2026-05-11 23:28:10.183119
136	416	-1003261964090	2026-05-11 23:28:10.186435
137	416	-1003571265208	2026-05-11 23:28:10.241125
138	417	-1003731038862	2026-05-17 02:08:10.268508
139	417	-1003571265208	2026-05-17 02:08:10.286854
140	418	-1003731038862	2026-05-29 11:45:35.847076
141	418	-1003571265208	2026-05-29 11:45:35.902151
\.


--
-- Data for Name: group_warns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_warns (id, chat_id, user_id, warned_by, reason, created_at) FROM stdin;
\.


--
-- Data for Name: group_welcome; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_welcome (chat_id, image_file_id, message, updated_at) FROM stdin;
-1003718314381	AgACAgQAAxkBAAKh0WnsskDzcyOvnnC__5GzRt0LsTePAAJcDGsbVF9pU1t9Ohj07F7FAQADAgADeAADOwQ	\N	2026-04-25 12:27:51.488531
-1003516577459	AgACAgQAAxkBAAKh0WnsskDzcyOvnnC__5GzRt0LsTePAAJcDGsbVF9pU1t9Ohj07F7FAQADAgADeAADOwQ	\N	2026-04-25 12:27:51.642076
-1003533593172	AgACAgQAAxkBAAKh0WnsskDzcyOvnnC__5GzRt0LsTePAAJcDGsbVF9pU1t9Ohj07F7FAQADAgADeAADOwQ	\N	2026-04-25 12:27:51.791875
-1003702997981	AgACAgQAAxkBAAKh0WnsskDzcyOvnnC__5GzRt0LsTePAAJcDGsbVF9pU1t9Ohj07F7FAQADAgADeAADOwQ	\N	2026-04-25 12:27:52.09143
-1003261964090	AgACAgQAAxkBAAKh0WnsskDzcyOvnnC__5GzRt0LsTePAAJcDGsbVF9pU1t9Ohj07F7FAQADAgADeAADOwQ	\N	2026-04-25 12:27:52.241644
-1003731038862	AgACAgQAAxkBAAKpLmnwSHwpweEAAU-3HFcSdG39Za_bwAAC1AxrG866gFPNfv33J85CowEAAwIAA3gAAzsE	\N	2026-04-28 05:41:16.79652
-1003606638684	AgACAgQAAxkBAAKpLmnwSHwpweEAAU-3HFcSdG39Za_bwAAC1AxrG866gFPNfv33J85CowEAAwIAA3gAAzsE	\N	2026-04-28 05:41:16.952546
-1003571265208	AgACAgQAAxkBAALMAmn5ZMUTRUU79gP9Fz_8ZCrBT423AALZD2sbYP_RU6v6AAEZC8-fZgEAAwIAA3gAAzsE	\N	2026-05-05 03:32:22.191499
-1003964096314	AgACAgQAAxkBAALMAmn5ZMUTRUU79gP9Fz_8ZCrBT423AALZD2sbYP_RU6v6AAEZC8-fZgEAAwIAA3gAAzsE	\N	2026-05-05 03:32:22.211501
-1002731824252	AgACAgQAAxkBAALMAmn5ZMUTRUU79gP9Fz_8ZCrBT423AALZD2sbYP_RU6v6AAEZC8-fZgEAAwIAA3gAAzsE	\N	2026-05-05 03:32:22.224625
-1003191159502	AgACAgQAAxkBAALMAmn5ZMUTRUU79gP9Fz_8ZCrBT423AALZD2sbYP_RU6v6AAEZC8-fZgEAAwIAA3gAAzsE	\N	2026-05-05 03:32:22.230503
-1003910364146	AgACAgQAAxkBAALMAmn5ZMUTRUU79gP9Fz_8ZCrBT423AALZD2sbYP_RU6v6AAEZC8-fZgEAAwIAA3gAAzsE	\N	2026-05-05 03:32:22.235941
-1003710241166	AgACAgQAAxkBAALMAmn5ZMUTRUU79gP9Fz_8ZCrBT423AALZD2sbYP_RU6v6AAEZC8-fZgEAAwIAA3gAAzsE	\N	2026-05-05 03:32:22.240437
0	AgACAgQAAxkBAALMAmn5ZMUTRUU79gP9Fz_8ZCrBT423AALZD2sbYP_RU6v6AAEZC8-fZgEAAwIAA3gAAzsE	\N	2026-05-05 03:32:22.24516
\.


--
-- Data for Name: history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.history (id, user_id, file_id, viewed_at) FROM stdin;
4416	5663352778	212	2026-04-23 03:37:52.224659
4417	5663352778	215	2026-04-23 03:37:58.017192
4546	5415358039	88	2026-04-23 21:10:27.404832
4783	5415358039	222	2026-04-26 10:14:29.493886
4887	7596452439	252	2026-04-28 15:42:05.941304
4724	6018795251	29	2026-04-25 11:33:05.582945
1209	7662120392	25	2026-04-06 22:32:23.432411
1210	7662120392	26	2026-04-06 22:32:55.255053
1211	7662120392	24	2026-04-06 22:33:14.221054
4893	8037159316	263	2026-04-28 17:24:19.422403
5290	5415358039	15	2026-05-02 09:28:20.428144
2428	5718477026	13	2026-04-12 18:47:33.336412
2458	5718477026	183	2026-04-12 21:30:01.957789
2625	7471385119	3	2026-04-13 22:16:45.595614
2651	6040761848	208	2026-04-14 13:53:28.859121
2652	6919626638	208	2026-04-14 13:57:29.886013
2653	6703881142	208	2026-04-14 14:00:41.898212
2655	6739428722	209	2026-04-14 15:00:48.292949
2691	7229478852	136	2026-04-15 18:58:23.628984
2727	8443541884	220	2026-04-16 20:32:00.318246
4790	7574632699	20	2026-04-26 18:38:13.405413
4721	5415358039	204	2026-04-25 10:16:24.246116
4723	6018795251	28	2026-04-25 11:25:05.746877
4793	7178011134	11	2026-04-26 19:35:15.776767
4794	5415358039	235	2026-04-26 20:43:30.042294
4801	6810868802	257	2026-04-27 08:19:05.686509
4804	6810868802	257	2026-04-27 08:22:24.718835
4894	7574632699	21	2026-04-28 17:51:49.572324
4895	7574632699	22	2026-04-28 17:51:55.87876
4902	5415358039	114	2026-04-28 19:09:29.607203
5113	5415358039	11	2026-04-30 07:24:22.590115
5291	5415358039	16	2026-05-02 09:28:45.463409
2429	5718477026	152	2026-04-12 18:48:29.119336
2591	8726316433	152	2026-04-13 12:21:23.359487
2626	5386256069	185	2026-04-14 00:06:56.781076
2692	7229478852	41	2026-04-15 18:58:51.774594
2728	6018795251	220	2026-04-16 20:36:22.70806
2942	8304386091	208	2026-04-17 16:44:56.650892
2943	8304386091	226	2026-04-17 16:45:32.497444
2430	5718477026	5	2026-04-12 18:48:56.591428
4788	5415358039	235	2026-04-26 17:44:00.326386
4789	7574632699	19	2026-04-26 18:38:02.174663
4791	7574632699	191	2026-04-26 18:38:22.711995
4802	6810868802	257	2026-04-27 08:20:41.013223
2627	5386256069	184	2026-04-14 00:08:50.699931
4805	6810868802	257	2026-04-27 08:22:46.719996
4811	5415358039	54	2026-04-27 12:11:49.834473
5114	5415358039	12	2026-04-30 07:25:32.700411
5152	5415358039	3	2026-04-30 17:12:28.733249
2729	8178887525	220	2026-04-16 20:40:28.874838
5255	6729659968	282	2026-05-01 12:46:24.075352
5259	5556524947	271	2026-05-01 13:01:31.418602
1307	8726316433	150	2026-04-07 05:15:00.648325
1333	8726316433	31	2026-04-08 09:53:19.74752
1334	8726316433	31	2026-04-08 09:53:27.646116
1346	5760028323	31	2026-04-08 11:38:53.43307
1347	5760028323	41	2026-04-08 11:40:31.655238
1350	8726316433	158	2026-04-08 13:39:39.159452
1351	8726316433	149	2026-04-08 13:39:42.884671
4795	5415358039	204	2026-04-26 20:55:15.286506
4796	6018795251	204	2026-04-26 21:07:07.787261
4797	5415358039	204	2026-04-26 22:55:33.498671
4800	5588471450	221	2026-04-27 07:47:50.654651
4803	6810868802	257	2026-04-27 08:22:13.111654
4808	5415358039	234	2026-04-27 11:51:43.751686
5056	6885186666	253	2026-04-30 00:16:49.271693
5061	6885186666	267	2026-04-30 00:17:47.798022
5148	5415358039	282	2026-04-30 16:57:00.728974
1465	8135760490	162	2026-04-08 21:22:37.801595
1466	8135760490	160	2026-04-08 21:22:49.984657
5116	5415358039	11	2026-04-30 07:35:32.107229
5149	5415358039	58	2026-04-30 16:59:02.205174
1573	7178011134	41	2026-04-09 08:48:08.311284
1574	7178011134	55	2026-04-09 08:48:24.003247
1576	5770436870	41	2026-04-09 08:52:53.352146
1577	5770436870	136	2026-04-09 08:53:19.541874
2432	5718477026	4	2026-04-12 18:49:10.602762
2719	6810868802	136	2026-04-16 08:48:44.227717
5117	5415358039	12	2026-04-30 07:38:46.551394
5150	5415358039	60	2026-04-30 16:59:55.329877
5256	6729659968	283	2026-05-01 12:46:59.752281
2971	7260277114	222	2026-04-17 18:17:09.472366
2433	7229478852	13	2026-04-12 19:08:00.788551
2662	6053902152	208	2026-04-14 20:20:46.555882
2695	5668550674	15	2026-04-15 21:59:04.127634
2731	7216357083	220	2026-04-16 20:50:27.872848
5118	5415358039	12	2026-04-30 07:39:09.736489
5151	5415358039	58	2026-04-30 17:01:58.54991
5257	6729659968	285	2026-05-01 12:47:34.134416
4817	7574632699	9	2026-04-27 18:05:34.082603
4819	7574632699	193	2026-04-27 18:05:49.499935
5119	5415358039	90	2026-04-30 07:39:24.598755
5200	5104073058	9	2026-04-30 20:57:59.377381
5202	5104073058	193	2026-04-30 20:58:29.269378
5203	5104073058	237	2026-04-30 20:58:50.545018
5258	6729659968	284	2026-05-01 12:48:09.330453
1782	6040761848	162	2026-04-09 17:36:03.013232
2593	7178011134	56	2026-04-13 12:28:42.461432
2663	6053902152	17	2026-04-14 20:24:12.598679
2696	7662120392	139	2026-04-15 23:29:29.590861
2973	7260277114	223	2026-04-17 18:18:30.349231
1823	7662120392	11	2026-04-10 01:33:16.001794
4818	7574632699	10	2026-04-27 18:05:42.7688
4824	7574632699	4	2026-04-27 22:28:46.225886
4825	7574632699	152	2026-04-27 22:28:54.182086
4826	7574632699	233	2026-04-27 22:29:01.278017
5084	8726316433	223	2026-04-30 00:32:44.284033
5120	5415358039	12	2026-04-30 07:40:15.893302
5201	5104073058	10	2026-04-30 20:58:12.978435
1914	8726316433	136	2026-04-10 09:05:01.866581
1929	6810868802	20	2026-04-10 09:23:55.444745
1930	6810868802	19	2026-04-10 09:25:07.154792
1931	6810868802	15	2026-04-10 09:26:25.073398
4446	5556524947	185	2026-04-23 12:20:18.418836
4447	5556524947	183	2026-04-23 12:20:27.157323
5121	5415358039	9	2026-04-30 07:52:05.204753
5207	7514359523	165	2026-04-30 21:28:41.98557
5210	7514359523	181	2026-04-30 21:29:00.255196
5261	5760028323	227	2026-05-01 13:51:18.358716
2067	7216357083	34	2026-04-11 11:37:41.395472
2068	7216357083	6	2026-04-11 11:38:38.403571
2069	7216357083	7	2026-04-11 11:39:06.794186
5122	5415358039	253	2026-04-30 07:57:20.107785
5262	5760028323	114	2026-05-01 13:51:44.54036
2664	6053902152	15	2026-04-14 20:24:20.065793
3024	6355460989	11	2026-04-17 21:29:39.053434
2135	5664588045	11	2026-04-11 15:50:37.27512
2163	7216357083	183	2026-04-11 16:47:42.879592
2164	7216357083	162	2026-04-11 16:48:10.342464
4448	5556524947	183	2026-04-23 12:21:08.845474
4748	2052357309	252	2026-04-25 15:06:17.709251
5123	5415358039	9	2026-04-30 07:59:11.519824
2209	7216357083	185	2026-04-11 17:36:02.324473
2240	8726316433	54	2026-04-11 18:25:15.145347
2248	8726316433	187	2026-04-11 18:47:50.949911
2276	7229478852	19	2026-04-11 19:35:51.916679
2277	7229478852	20	2026-04-11 19:36:06.012863
2279	6513362017	183	2026-04-11 19:41:50.802269
2280	6513362017	31	2026-04-11 19:49:02.071137
2292	8726316433	189	2026-04-11 20:11:16.933337
4758	5556524947	26	2026-04-25 16:34:55.14542
5209	7514359523	4	2026-04-30 21:28:59.433114
5264	6250199428	162	2026-05-01 14:03:41.574434
2712	5663352778	216	2026-04-16 08:16:06.144221
2734	6018795251	33	2026-04-16 21:02:38.948986
3161	6620710987	220	2026-04-18 14:02:43.852582
2293	7216357083	189	2026-04-11 20:12:13.185302
2294	6564900193	185	2026-04-11 20:29:53.101656
2308	1645166876	190	2026-04-11 21:27:22.036829
2310	8726316433	191	2026-04-11 21:45:00.950201
2355	6772617116	190	2026-04-11 23:57:53.883702
2356	6772617116	186	2026-04-11 23:58:22.18473
2357	5814084225	185	2026-04-12 00:15:50.172823
2358	5814084225	186	2026-04-12 00:20:14.851755
2368	7194386140	34	2026-04-12 07:20:18.736751
4952	7703193779	263	2026-04-29 03:03:14.788097
5161	5415358039	59	2026-04-30 18:33:46.027194
2374	7216357083	185	2026-04-12 08:39:56.020206
5265	6250199428	162	2026-05-01 14:15:43.208451
2378	6564900193	191	2026-04-12 09:04:47.000628
2379	6729659968	189	2026-04-12 09:41:57.536035
2457	5718477026	184	2026-04-12 21:29:48.592556
2713	5663352778	213	2026-04-16 08:17:10.945703
2714	5663352778	212	2026-04-16 08:17:26.92423
2725	6018795251	31	2026-04-16 20:17:53.906175
2985	8187764784	209	2026-04-17 19:49:34.815489
2421	6250199428	8	2026-04-12 15:43:26.073453
2422	6250199428	9	2026-04-12 15:43:38.811113
2425	7662120392	11	2026-04-12 18:35:20.139335
2426	7662120392	83	2026-04-12 18:36:14.26447
2427	7662120392	82	2026-04-12 18:36:29.468029
2456	5718477026	186	2026-04-12 21:29:01.120229
7540	6530364511	360	2026-05-10 21:02:39.296931
4691	5415358039	8	2026-04-24 19:48:45.6144
4951	7703193779	263	2026-04-29 03:02:49.630205
2654	8248917515	208	2026-04-14 14:18:20.577602
2715	6810868802	196	2026-04-16 08:45:39.043702
2726	6018795251	15	2026-04-16 20:19:49.091896
4071	5415358039	8	2026-04-22 07:32:03.812591
4690	5415358039	183	2026-04-24 19:21:40.267923
5088	8726316433	227	2026-04-30 00:34:19.970587
5269	5104073058	272	2026-05-01 15:17:54.354952
3192	5415358039	222	2026-04-18 16:56:34.275323
3193	5415358039	31	2026-04-18 17:10:51.482431
3194	6091576543	222	2026-04-18 17:31:52.398541
3197	7574632699	222	2026-04-18 20:01:54.591413
3198	7574632699	8	2026-04-18 20:03:53.886945
3199	7574632699	9	2026-04-18 20:04:06.251714
3200	7574632699	10	2026-04-18 20:04:17.070623
3201	7574632699	193	2026-04-18 20:04:25.41975
3202	7574632699	19	2026-04-18 20:05:01.220124
3203	7574632699	20	2026-04-18 20:05:07.680421
3204	7574632699	191	2026-04-18 20:05:16.9051
5270	5104073058	194	2026-05-01 15:18:11.023196
4072	5415358039	10	2026-04-22 07:33:03.561345
4693	7574632699	245	2026-04-24 22:29:01.68974
4694	7574632699	89	2026-04-24 22:29:15.411889
4767	7229478852	257	2026-04-25 21:28:27.135597
4853	6240878770	32	2026-04-28 05:35:27.554638
4957	8468016104	237	2026-04-29 06:43:58.833814
4959	8319698469	13	2026-04-29 07:44:09.035012
4960	8319698469	11	2026-04-29 07:45:07.363547
5271	5104073058	125	2026-05-01 15:18:25.914701
3323	7174608517	23	2026-04-19 09:46:15.498702
5094	8726316433	224	2026-04-30 00:38:35.05809
5272	5415358039	15	2026-05-01 15:57:23.468913
4961	8319698469	11	2026-04-29 07:45:21.936227
4965	8319698469	90	2026-04-29 12:26:15.072699
4969	5415358039	88	2026-04-29 12:51:32.770186
4970	5415358039	58	2026-04-29 13:34:39.168393
4976	5415358039	13	2026-04-29 17:18:26.261741
4770	6040761848	221	2026-04-26 05:33:19.233878
3321	6729659968	221	2026-04-19 09:10:04.191733
3322	5235168504	183	2026-04-19 09:18:14.09981
3324	7174608517	26	2026-04-19 09:46:21.285841
3325	8056909438	209	2026-04-19 10:00:21.072482
3326	8056909438	208	2026-04-19 10:00:25.671631
3330	8056909438	209	2026-04-19 11:48:59.982032
3331	8705652002	31	2026-04-19 12:48:46.916821
3332	8705652002	32	2026-04-19 12:49:55.865811
3333	8705652002	114	2026-04-19 12:50:22.285719
3336	8705652002	33	2026-04-19 12:51:29.078983
3364	5235168504	55	2026-04-19 17:49:06.737805
3372	5718477026	152	2026-04-19 18:36:09.884248
3385	7229478852	152	2026-04-19 18:58:56.792437
3401	7229478852	233	2026-04-19 19:57:14.663461
3403	5718477026	233	2026-04-19 19:58:15.795819
3412	6620710987	233	2026-04-19 20:20:31.266119
3420	8187764784	223	2026-04-19 20:38:57.111892
3421	8187764784	8	2026-04-19 20:44:38.233737
3422	8187764784	9	2026-04-19 20:45:31.664703
3423	8187764784	10	2026-04-19 20:46:39.327197
3424	8187764784	193	2026-04-19 20:47:52.15641
3425	8187764784	13	2026-04-19 20:49:08.2774
3426	8187764784	11	2026-04-19 20:49:22.037596
3427	8187764784	12	2026-04-19 20:49:52.548926
3428	8187764784	13	2026-04-19 20:50:34.709768
3431	8187764784	192	2026-04-19 20:51:48.430791
3432	8187764784	151	2026-04-19 20:54:49.935668
3433	8187764784	209	2026-04-19 20:56:11.520238
3434	8187764784	208	2026-04-19 20:57:35.353927
3437	8187764784	3	2026-04-19 21:02:24.388777
3438	8187764784	4	2026-04-19 21:02:59.088082
3439	8187764784	5	2026-04-19 21:03:15.161592
3440	8187764784	152	2026-04-19 21:03:30.797951
3441	8187764784	233	2026-04-19 21:03:45.8881
4962	8319698469	88	2026-04-29 07:45:50.025217
4963	8319698469	90	2026-04-29 12:23:55.000146
4964	8319698469	223	2026-04-29 12:24:14.727071
4966	8319698469	223	2026-04-29 12:26:38.828368
4967	5415358039	88	2026-04-29 12:47:15.432195
4968	5415358039	11	2026-04-29 12:48:23.060931
5133	5415358039	11	2026-04-30 08:12:48.467715
5134	5415358039	11	2026-04-30 09:30:00.48342
4975	5415358039	223	2026-04-29 17:17:59.925255
5035	5415358039	12	2026-04-29 22:57:24.239988
5036	5415358039	90	2026-04-29 22:57:49.104054
5135	7107022202	271	2026-04-30 12:07:27.058434
5279	5556524947	282	2026-05-01 18:16:32.299713
4180	6683972858	194	2026-04-22 17:54:23.889373
4871	5415358039	27	2026-04-28 07:36:11.414229
5037	5415358039	193	2026-04-29 23:05:40.692116
4977	5415358039	13	2026-04-29 17:18:57.872347
5280	5556524947	284	2026-05-01 18:17:00.539702
3650	7174608517	191	2026-04-20 13:16:16.304874
3674	5770436870	233	2026-04-20 20:34:54.788037
3698	7596452439	223	2026-04-20 21:38:41.85761
4620	7574632699	28	2026-04-24 11:47:27.684706
4625	7574632699	31	2026-04-24 11:49:48.14775
4631	7574632699	41	2026-04-24 11:52:40.672687
4633	7574632699	8	2026-04-24 11:54:06.412735
4635	7574632699	10	2026-04-24 11:54:14.010673
4642	7574632699	233	2026-04-24 11:59:18.751212
4643	7574632699	233	2026-04-24 12:01:49.971033
4500	5415358039	8	2026-04-23 13:45:35.026179
4978	5415358039	254	2026-04-29 17:28:34.194819
4981	5415358039	9	2026-04-29 17:53:55.19734
4507	5415358039	8	2026-04-23 14:29:48.915097
5281	5556524947	283	2026-05-01 18:21:37.851549
4172	8726316433	88	2026-04-22 13:17:24.761166
4619	7574632699	27	2026-04-24 11:47:17.411795
4621	7574632699	29	2026-04-24 11:47:35.67582
4506	5415358039	11	2026-04-23 14:20:18.821663
4636	7574632699	193	2026-04-24 11:54:22.160545
4638	7574632699	4	2026-04-24 11:56:40.686854
3758	8216250934	9	2026-04-21 13:56:18.218462
3759	5404090166	9	2026-04-21 13:56:25.039923
4640	7574632699	152	2026-04-24 11:58:06.569343
5282	5556524947	285	2026-05-01 18:22:24.91877
5283	8141424235	263	2026-05-01 22:12:59.577289
3795	7368202514	208	2026-04-21 17:29:41.810189
3796	8187764784	11	2026-04-21 18:07:57.353325
4622	7574632699	30	2026-04-24 11:47:40.143153
4624	7574632699	115	2026-04-24 11:47:50.877985
4626	7574632699	32	2026-04-24 11:49:57.461854
4627	7574632699	114	2026-04-24 11:50:03.509836
4630	7574632699	136	2026-04-24 11:52:35.479023
4346	8726316433	223	2026-04-23 00:03:21.198987
4632	7574632699	222	2026-04-24 11:52:44.644915
4634	7574632699	9	2026-04-24 11:54:10.132305
4639	7574632699	5	2026-04-24 11:57:28.750714
4711	5415358039	27	2026-04-25 08:05:21.723198
4875	8464998664	257	2026-04-28 09:15:21.232668
4878	8464998664	257	2026-04-28 09:20:38.077179
4984	5415358039	12	2026-04-29 20:39:28.245581
3782	6683972858	194	2026-04-21 15:14:16.762367
3783	5415358039	31	2026-04-21 17:12:29.93127
3784	6179219688	3	2026-04-21 17:20:15.500654
3785	6179219688	4	2026-04-21 17:20:25.749503
3786	6179219688	150	2026-04-21 17:21:03.627057
3787	6179219688	15	2026-04-21 17:21:27.320743
3788	6179219688	16	2026-04-21 17:21:32.64554
3789	6179219688	17	2026-04-21 17:21:39.233602
3790	6179219688	18	2026-04-21 17:21:45.681317
3791	6179219688	89	2026-04-21 17:21:51.996016
3792	6179219688	19	2026-04-21 17:22:12.767299
3793	6179219688	20	2026-04-21 17:22:22.780167
3794	6179219688	191	2026-04-21 17:22:28.949381
3797	8187764784	192	2026-04-21 18:13:51.049124
5284	5415358039	61	2026-05-01 22:23:41.492315
4623	7574632699	143	2026-04-24 11:47:45.8992
4628	7574632699	221	2026-04-24 11:50:16.193675
4629	7574632699	33	2026-04-24 11:52:27.123921
4637	7574632699	237	2026-04-24 11:54:30.383419
4641	7574632699	233	2026-04-24 11:59:04.188015
4876	8464998664	257	2026-04-28 09:17:05.542135
4877	8464998664	5	2026-04-28 09:17:11.144045
4885	8726316433	115	2026-04-28 11:24:33.612113
4347	6885186666	223	2026-04-23 00:06:04.134868
4713	5415358039	29	2026-04-25 09:04:43.897999
4879	8464998664	233	2026-04-28 09:20:45.866657
4722	6018795251	27	2026-04-25 11:23:44.282468
5046	6885186666	223	2026-04-30 00:13:35.764453
4184	8187764784	233	2026-04-22 19:40:34.827201
4185	8187764784	4	2026-04-22 19:40:59.154754
4714	5415358039	30	2026-04-25 09:08:43.744655
5051	6885186666	252	2026-04-30 00:15:47.448331
5105	5415358039	10	2026-04-30 06:26:42.588185
4896	7574632699	235	2026-04-28 17:52:02.535685
4897	7574632699	23	2026-04-28 17:52:16.198423
5107	5415358039	8	2026-04-30 06:55:08.401062
4913	5415358039	8	2026-04-28 19:29:25.893548
4914	8726316433	27	2026-04-28 21:10:04.155817
4915	8726316433	115	2026-04-28 21:10:53.16103
3970	8726316433	150	2026-04-21 22:46:54.834016
4070	5415358039	88	2026-04-22 07:31:22.090606
7555	6018795251	26	2026-05-10 22:49:38.610138
5841	7746046007	287	2026-05-03 06:28:03.954279
7559	7574632699	12	2026-05-10 23:29:51.578681
5852	7596452439	316	2026-05-03 06:59:42.017713
7563	6530364511	364	2026-05-10 23:33:25.339426
7574	5660577046	318	2026-05-11 09:39:31.980748
5407	6217677522	153	2026-05-02 17:21:37.550603
6081	5415358039	190	2026-05-03 14:30:03.575682
6099	7746046007	243	2026-05-03 16:26:28.098965
6101	7746046007	162	2026-05-03 16:27:36.388857
6245	8187764784	328	2026-05-04 15:35:04.992638
7354	5760028323	380	2026-05-08 08:17:58.988858
6260	5588471450	287	2026-05-04 17:26:23.096665
6268	7387314389	286	2026-05-04 17:42:16.899015
6272	6409821771	287	2026-05-04 18:30:36.37697
5784	5415358039	282	2026-05-03 01:28:38.853208
5785	5415358039	284	2026-05-03 01:28:54.359954
6273	6409821771	288	2026-05-04 18:30:40.411245
6278	5415358039	136	2026-05-04 18:41:46.28705
6280	8187764784	376	2026-05-04 18:42:04.055059
6289	6036425898	3	2026-05-04 20:13:09.228443
5587	7596452439	307	2026-05-02 21:32:02.251941
6293	6036425898	289	2026-05-04 20:13:43.945268
7371	6018795251	381	2026-05-08 12:59:32.178527
7373	6018795251	222	2026-05-08 13:00:10.886639
6987	8726316433	381	2026-05-06 13:46:15.490874
6992	8726316433	33	2026-05-06 13:48:11.957096
6996	8726316433	31	2026-05-06 13:50:51.786984
7628	7574632699	15	2026-05-12 17:20:05.617053
7630	7574632699	17	2026-05-12 17:20:17.786749
7635	7574632699	191	2026-05-12 17:21:12.252381
7660	5415358039	258	2026-05-13 12:27:02.733015
7669	5122118107	415	2026-05-13 22:59:28.56439
7678	8319698469	6	2026-05-14 16:26:50.771964
7682	6729659968	287	2026-05-14 16:30:45.187558
7684	6729659968	289	2026-05-14 16:31:05.357145
7687	6620710987	7	2026-05-14 17:14:53.340631
7690	6720124032	287	2026-05-14 17:17:04.32369
7694	8319698469	112	2026-05-14 17:46:52.3101
7698	5426803479	288	2026-05-14 18:22:46.286567
7700	5426803479	287	2026-05-14 18:26:58.756476
7703	7746046007	3	2026-05-14 19:00:52.568589
7709	6513362017	181	2026-05-14 19:32:46.244549
7716	6513362017	208	2026-05-14 19:49:58.713034
7720	6564900193	286	2026-05-14 20:31:23.025584
5502	7574632699	19	2026-05-02 19:15:56.927726
5503	7574632699	20	2026-05-02 19:16:08.298966
5504	7574632699	191	2026-05-02 19:16:13.974879
5505	7574632699	268	2026-05-02 19:17:33.874456
5506	7574632699	20	2026-05-02 19:17:45.793974
5507	7574632699	269	2026-05-02 19:19:14.9676
5509	7574632699	8	2026-05-02 19:35:54.862907
5510	7574632699	9	2026-05-02 19:36:03.728735
5511	7574632699	10	2026-05-02 19:36:08.379989
5512	7574632699	193	2026-05-02 19:36:13.329857
5513	7574632699	237	2026-05-02 19:36:29.020361
7547	6530364511	332	2026-05-10 21:55:49.386343
7812	5415358039	4	2026-05-15 07:23:31.915395
7556	6018795251	204	2026-05-10 22:51:46.640678
7560	7574632699	13	2026-05-10 23:31:33.067209
7565	7574632699	382	2026-05-10 23:34:03.365893
7567	6530364511	363	2026-05-10 23:34:30.784654
7813	5415358039	5	2026-05-15 07:23:49.961582
5844	7746046007	185	2026-05-03 06:29:35.787554
7575	8375199999	243	2026-05-11 10:28:50.913035
7586	6018795251	19	2026-05-11 18:03:38.305316
6061	5415358039	89	2026-05-03 11:53:29.457526
6082	5415358039	191	2026-05-03 14:40:09.59625
7355	5760028323	183	2026-05-08 08:18:22.703535
5909	7596452439	328	2026-05-03 07:33:21.781122
7846	8726316433	3	2026-05-15 09:06:44.804051
7629	7574632699	16	2026-05-12 17:20:12.401191
7372	6018795251	136	2026-05-08 13:00:03.482043
6100	7746046007	263	2026-05-03 16:26:34.956125
7634	7574632699	20	2026-05-12 17:21:05.28511
7638	5415358039	20	2026-05-12 17:36:04.65863
6261	5588471450	288	2026-05-04 17:26:31.570444
6269	6409821771	3	2026-05-04 18:30:23.196649
6274	6409821771	289	2026-05-04 18:30:44.453729
6988	8726316433	380	2026-05-06 13:46:29.293715
6993	8726316433	283	2026-05-06 13:48:31.332384
6290	6036425898	286	2026-05-04 20:13:16.519617
6292	6036425898	288	2026-05-04 20:13:30.445944
6299	8726316433	3	2026-05-04 21:37:44.000012
6302	8726316433	7	2026-05-04 21:39:14.575855
7848	8726316433	287	2026-05-15 09:06:59.276292
7389	5104073058	222	2026-05-08 16:08:20.203465
7393	5415358039	136	2026-05-08 17:33:19.482226
7396	6018795251	260	2026-05-08 18:33:18.48664
7398	6018795251	390	2026-05-08 18:33:37.199182
7400	7803385892	413	2026-05-08 19:07:13.879225
7403	7128896646	412	2026-05-08 19:11:07.67821
7850	8726316433	289	2026-05-15 09:07:21.281672
7851	6250199428	7	2026-05-15 10:31:36.105736
7854	6250199428	287	2026-05-15 10:32:01.079527
7414	5415358039	284	2026-05-09 00:31:36.8397
7657	5660577046	415	2026-05-13 11:13:33.251851
7857	6091576543	287	2026-05-15 10:42:12.225269
7423	5556524947	156	2026-05-09 13:48:22.794489
7044	8726316433	283	2026-05-06 17:15:38.659849
6664	8726316433	183	2026-05-05 17:23:30.641028
7424	5556524947	164	2026-05-09 13:48:29.493047
7427	5556524947	379	2026-05-09 13:53:52.697868
7055	6250199428	375	2026-05-06 17:29:58.215055
7862	2013244058	287	2026-05-15 12:34:29.056203
7670	1951225967	250	2026-05-14 00:03:57.626445
7867	2013244058	4	2026-05-15 12:42:13.208289
7068	5104073058	381	2026-05-06 17:43:07.563588
7070	7471385119	136	2026-05-06 18:04:46.847019
7073	7471385119	285	2026-05-06 18:20:11.147783
7078	5718477026	183	2026-05-06 18:34:25.620692
7082	6729659968	380	2026-05-06 19:08:31.845224
7679	8319698469	7	2026-05-14 16:26:59.104078
7088	5415358039	222	2026-05-06 20:00:02.459495
7683	6729659968	288	2026-05-14 16:30:56.890581
7688	6720124032	3	2026-05-14 17:16:41.795852
7692	6720124032	287	2026-05-14 17:18:29.919984
7695	8319698469	6	2026-05-14 17:46:57.073141
7699	5426803479	289	2026-05-14 18:23:30.099479
7704	7746046007	286	2026-05-14 19:00:58.897492
7710	6513362017	185	2026-05-14 19:34:18.496885
7711	6409821771	288	2026-05-14 19:39:22.25031
7717	6513362017	279	2026-05-14 19:50:13.133057
7721	6564900193	287	2026-05-14 21:02:07.183397
7876	5415358039	5	2026-05-15 13:49:27.4403
7879	6409821771	208	2026-05-15 13:58:59.735832
7885	5415358039	5	2026-05-15 15:18:36.979807
7888	5718477026	5	2026-05-15 16:44:51.420997
8184	5415358039	10	2026-05-17 15:14:18.937912
8187	5415358039	193	2026-05-17 15:33:20.640476
8408	6810868802	226	2026-05-19 09:47:13.15007
8193	2013244058	9	2026-05-17 17:52:46.57116
7500	7518863743	303	2026-05-09 21:53:36.422636
7164	7908756476	380	2026-05-06 23:48:39.413549
7171	8380139583	190	2026-05-07 00:26:19.831299
7924	5415358039	152	2026-05-15 20:14:18.956492
7177	5104073058	390	2026-05-07 00:52:26.128572
7180	5104073058	390	2026-05-07 00:55:32.50109
7514	6250199428	54	2026-05-10 11:39:02.48862
7935	5415358039	208	2026-05-15 21:48:27.801952
7938	5718477026	152	2026-05-15 23:23:08.844877
7943	5415358039	152	2026-05-16 00:17:53.008833
7946	6167797720	152	2026-05-16 00:55:49.249086
7949	5415358039	5	2026-05-16 01:05:30.589545
7533	7025363896	185	2026-05-10 17:05:41.289589
7956	7746046007	5	2026-05-16 06:04:06.873567
7971	5415358039	4	2026-05-16 08:50:42.259799
7974	8726316433	286	2026-05-16 09:56:46.29014
7977	6810868802	376	2026-05-16 13:59:01.74331
7248	8726316433	391	2026-05-07 12:10:58.814795
7251	6588278938	3	2026-05-07 12:46:38.993689
7255	6588278938	24	2026-05-07 12:47:57.803752
7258	6588278938	263	2026-05-07 12:48:42.707745
7980	5415358039	193	2026-05-16 16:55:35.709308
7983	5415358039	193	2026-05-16 17:11:25.480804
7986	5415358039	192	2026-05-16 17:24:00.287655
7989	5415358039	259	2026-05-16 17:29:57.241401
8458	6810868802	62	2026-05-20 14:45:27.482619
8463	8375199999	417	2026-05-20 15:55:49.888137
8465	8375199999	61	2026-05-20 15:57:02.350555
8253	5415358039	223	2026-05-18 05:03:35.634502
8270	5415358039	265	2026-05-18 07:05:41.230692
8274	5415358039	8	2026-05-18 07:43:12.644196
8276	5415358039	88	2026-05-18 07:44:19.168961
8033	7574632699	31	2026-05-16 19:09:02.110863
8036	7574632699	221	2026-05-16 19:09:38.55755
8278	5415358039	267	2026-05-18 08:12:09.40467
8280	5415358039	193	2026-05-18 08:13:26.854133
8282	5415358039	193	2026-05-18 08:15:34.676738
8284	5415358039	267	2026-05-18 08:16:33.754694
8286	8235799915	417	2026-05-18 08:47:36.561031
8291	5415358039	192	2026-05-18 09:13:25.228648
8314	8187764784	388	2026-05-18 19:54:10.70816
8085	6250199428	8	2026-05-16 20:02:53.269123
8087	6250199428	10	2026-05-16 20:03:09.265869
8088	6250199428	193	2026-05-16 20:03:16.008864
8090	6250199428	193	2026-05-16 20:04:11.601964
8092	6250199428	265	2026-05-16 20:05:02.69948
8107	5104073058	166	2026-05-17 00:05:22.684793
8108	5104073058	242	2026-05-17 00:05:32.178403
8110	5303731176	8	2026-05-17 00:06:40.089488
7548	6530364511	333	2026-05-10 22:01:52.51444
5839	7746046007	3	2026-05-03 06:27:51.609802
5842	7746046007	288	2026-05-03 06:28:07.490319
5843	7746046007	289	2026-05-03 06:28:11.125282
5845	7746046007	183	2026-05-03 06:29:46.510998
5707	5415358039	114	2026-05-02 22:59:08.444459
5850	7596452439	316	2026-05-03 06:58:25.948255
5854	7596452439	317	2026-05-03 07:04:35.292077
7553	6018795251	24	2026-05-10 22:47:42.033971
7557	6018795251	234	2026-05-10 22:52:59.428836
7561	7574632699	192	2026-05-10 23:31:40.879432
7568	6530364511	365	2026-05-10 23:36:04.34448
7312	5415358039	249	2026-05-07 23:34:35.570245
7576	8192906362	376	2026-05-11 14:34:20.745662
7810	5415358039	3	2026-05-15 07:22:42.271004
7587	7596452439	317	2026-05-11 19:02:14.43951
5901	7596452439	328	2026-05-03 07:32:04.583822
5905	7596452439	327	2026-05-03 07:32:48.834984
5907	7596452439	329	2026-05-03 07:33:04.898576
5911	7596452439	330	2026-05-03 07:33:41.808067
5918	7596452439	344	2026-05-03 07:51:00.778804
8409	6810868802	226	2026-05-19 09:50:07.802151
7369	6018795251	33	2026-05-08 12:58:51.533982
6079	8726316433	260	2026-05-03 13:36:18.347614
7374	6018795251	41	2026-05-08 13:00:33.971731
7631	7574632699	18	2026-05-12 17:20:25.151782
7633	7574632699	19	2026-05-12 17:21:00.195118
6102	5104073058	260	2026-05-03 22:12:21.869986
6989	8726316433	221	2026-05-06 13:46:54.446924
6258	5588471450	3	2026-05-04 17:26:14.568179
6990	8726316433	221	2026-05-06 13:47:02.862482
6994	8726316433	136	2026-05-06 13:48:48.776367
6266	7387314389	4	2026-05-04 17:37:03.88516
7639	5512941168	263	2026-05-12 22:59:23.405584
7390	5556524947	380	2026-05-08 17:21:23.444908
6277	5415358039	33	2026-05-04 18:41:36.831075
6281	8187764784	376	2026-05-04 18:43:22.372901
6282	6263878232	334	2026-05-04 18:45:42.693361
7394	5415358039	285	2026-05-08 17:33:33.501845
6291	6036425898	287	2026-05-04 20:13:24.552912
7397	6018795251	391	2026-05-08 18:33:34.319671
7401	7803385892	414	2026-05-08 19:07:38.467066
6300	8726316433	4	2026-05-04 21:38:14.649173
6301	8726316433	6	2026-05-04 21:39:05.636808
7404	6720124032	139	2026-05-08 20:40:27.864562
7407	6250199428	33	2026-05-08 21:29:35.151324
6318	5588471450	257	2026-05-05 02:20:03.825305
7415	5104073058	136	2026-05-09 01:24:49.087317
7425	5556524947	158	2026-05-09 13:48:35.81148
7041	8726316433	136	2026-05-06 17:13:07.005229
7042	8726316433	222	2026-05-06 17:13:14.593432
7045	8726316433	282	2026-05-06 17:15:49.106578
7048	6250199428	33	2026-05-06 17:27:58.455875
7053	6250199428	375	2026-05-06 17:29:25.444276
7658	5660577046	308	2026-05-13 11:13:44.584224
7667	7358383509	416	2026-05-13 19:13:35.548114
7836	6564900193	274	2026-05-15 07:59:32.300379
7680	6729659968	3	2026-05-14 16:29:48.101261
7071	7471385119	222	2026-05-06 18:05:09.9377
7074	7546140009	31	2026-05-06 18:25:35.835851
7076	7546140009	114	2026-05-06 18:25:55.882125
7077	7546140009	221	2026-05-06 18:25:59.870996
7685	6729659968	3	2026-05-14 16:33:01.425962
7689	6720124032	286	2026-05-14 17:16:56.126751
7696	6564900193	112	2026-05-14 18:08:44.0237
7701	7746046007	162	2026-05-14 18:57:28.730538
7089	5415358039	136	2026-05-06 20:00:13.684631
7706	7746046007	288	2026-05-14 19:01:27.853754
7707	7746046007	289	2026-05-14 19:01:30.865294
7712	6409821771	289	2026-05-14 19:39:36.289339
7714	6409821771	286	2026-05-14 19:40:01.591183
7718	6513362017	209	2026-05-14 19:51:52.82653
7722	5415358039	286	2026-05-14 22:32:38.524921
7847	8726316433	286	2026-05-15 09:06:53.833413
7113	5415358039	283	2026-05-06 22:10:17.598465
7852	6250199428	289	2026-05-15 10:31:46.038491
7855	6091576543	3	2026-05-15 10:41:58.769538
7858	6091576543	288	2026-05-15 10:42:18.259935
7859	6091576543	289	2026-05-15 10:42:23.801136
7860	2013244058	3	2026-05-15 12:34:12.40586
7863	2013244058	288	2026-05-15 12:34:33.247024
7864	2013244058	289	2026-05-15 12:34:38.613207
7515	6530364511	317	2026-05-10 11:58:34.989352
7519	6530364511	345	2026-05-10 12:00:36.14093
7868	2013244058	5	2026-05-15 12:42:18.171596
7870	2013244058	233	2026-05-15 12:42:31.304057
7531	6272548417	26	2026-05-10 14:33:31.546339
7534	8726316433	204	2026-05-10 18:37:52.888686
7873	5415358039	287	2026-05-15 13:22:16.83444
7877	5415358039	152	2026-05-15 13:50:37.355462
7166	7908756476	380	2026-05-06 23:48:56.131606
7172	5415358039	136	2026-05-07 00:36:03.561762
8181	7596452439	417	2026-05-17 11:09:54.429943
7178	5104073058	380	2026-05-07 00:53:43.617408
7886	5718477026	3	2026-05-15 16:30:40.305647
8185	5415358039	9	2026-05-17 15:16:25.319289
8188	5415358039	9	2026-05-17 16:14:05.211602
8195	2013244058	193	2026-05-17 17:52:56.878141
8227	5415358039	90	2026-05-17 19:36:34.113164
7936	8319698469	289	2026-05-15 22:00:35.293999
7939	5718477026	375	2026-05-15 23:26:05.795677
7942	5718477026	375	2026-05-15 23:27:03.822671
7944	6167797720	4	2026-05-16 00:53:59.636682
7947	6167797720	233	2026-05-16 00:56:05.175089
7950	5415358039	152	2026-05-16 01:10:46.9071
7953	7746046007	274	2026-05-16 06:02:02.725802
7249	5415358039	391	2026-05-07 12:30:10.277716
7252	6588278938	6	2026-05-07 12:47:09.807293
7256	6588278938	25	2026-05-07 12:48:07.412206
7954	7746046007	273	2026-05-16 06:02:30.701551
7958	7746046007	233	2026-05-16 06:04:27.346496
8250	5415358039	10	2026-05-18 03:28:46.020202
8251	5415358039	193	2026-05-18 03:29:16.247583
8255	5415358039	10	2026-05-18 05:12:16.652736
7972	5415358039	5	2026-05-16 08:54:21.648703
7975	8726316433	287	2026-05-16 09:56:53.082883
7978	6810868802	256	2026-05-16 14:03:09.107996
7981	5415358039	237	2026-05-16 17:11:04.232584
7984	5415358039	13	2026-05-16 17:20:57.523546
7987	5415358039	254	2026-05-16 17:24:31.636051
7990	5415358039	13	2026-05-16 17:32:50.347489
8275	5415358039	11	2026-05-18 07:43:50.537066
8279	5415358039	192	2026-05-18 08:13:10.325476
8281	5415358039	237	2026-05-18 08:13:48.201955
8283	5415358039	192	2026-05-18 08:16:01.718921
8285	8235799915	416	2026-05-18 08:46:52.033245
8313	8187764784	327	2026-05-18 19:53:10.234034
7544	6530364511	361	2026-05-10 21:26:31.218053
5840	7746046007	286	2026-05-03 06:27:58.880918
5846	7596452439	315	2026-05-03 06:52:47.222682
5847	7596452439	315	2026-05-03 06:53:41.347705
7549	6530364511	374	2026-05-10 22:06:11.538856
5655	5415358039	191	2026-05-02 22:17:44.759361
7554	6018795251	25	2026-05-10 22:49:18.338028
7558	6018795251	54	2026-05-10 22:53:57.059411
7562	7574632699	259	2026-05-10 23:32:43.827282
7564	7574632699	223	2026-05-10 23:33:52.85286
7566	7574632699	267	2026-05-10 23:34:27.826065
7569	6885186666	24	2026-05-11 01:21:37.195799
7811	5415358039	286	2026-05-15 07:23:12.308244
7849	8726316433	288	2026-05-15 09:07:07.859533
7853	6250199428	288	2026-05-15 10:31:56.443745
7856	6091576543	286	2026-05-15 10:42:04.86097
7357	6167797720	221	2026-05-08 09:12:46.098712
7861	2013244058	286	2026-05-15 12:34:19.275561
6259	5588471450	286	2026-05-04 17:26:19.178313
6262	5588471450	289	2026-05-04 17:26:35.358253
6264	7596452439	139	2026-05-04 17:28:08.732387
6267	7387314389	5	2026-05-04 17:38:21.128167
6271	6409821771	286	2026-05-04 18:30:33.114351
6276	8264518538	7	2026-05-04 18:41:14.519113
6080	8726316433	332	2026-05-03 14:18:27.999034
6085	5415358039	270	2026-05-03 15:04:39.032325
6283	5415358039	31	2026-05-04 18:58:05.483109
6288	5415358039	32	2026-05-04 19:57:13.155592
7865	5104073058	6	2026-05-15 12:34:53.750011
6995	8726316433	285	2026-05-06 13:49:22.613676
6303	6167797720	260	2026-05-04 21:54:15.502096
7632	7574632699	89	2026-05-12 17:20:34.521148
7370	6018795251	380	2026-05-08 12:59:16.675508
7375	6018795251	285	2026-05-08 13:00:58.113955
7866	2013244058	289	2026-05-15 12:36:21.312921
7869	2013244058	152	2026-05-15 12:42:23.116685
7871	2013244058	375	2026-05-15 12:42:35.903463
7391	5556524947	381	2026-05-08 17:21:33.18146
7395	6018795251	41	2026-05-08 18:33:03.126558
7399	7803385892	415	2026-05-08 19:05:48.123284
7402	7596452439	356	2026-05-08 19:07:54.805332
7405	6720124032	381	2026-05-08 20:42:54.264723
7408	6250199428	136	2026-05-08 21:29:53.169883
7409	6250199428	222	2026-05-08 21:29:58.883643
7043	8726316433	285	2026-05-06 17:15:16.128976
7046	8726316433	33	2026-05-06 17:17:10.90968
7049	6250199428	136	2026-05-06 17:28:02.835135
7050	6250199428	222	2026-05-06 17:28:06.907586
7051	6564900193	272	2026-05-06 17:28:21.374843
7054	6564900193	227	2026-05-06 17:29:39.459824
7416	5104073058	33	2026-05-09 01:44:38.132317
7651	6810868802	233	2026-05-13 00:15:24.999708
7422	5556524947	151	2026-05-09 13:45:23.325278
7426	5556524947	148	2026-05-09 13:48:48.202753
7075	7546140009	32	2026-05-06 18:25:49.504054
7084	7546140009	221	2026-05-06 19:41:22.329022
7087	5415358039	33	2026-05-06 19:59:56.319551
7090	5415358039	222	2026-05-06 20:01:37.907082
7659	5415358039	28	2026-05-13 12:26:21.354212
7878	5415358039	233	2026-05-15 13:51:16.752249
7887	5718477026	4	2026-05-15 16:34:50.009321
7681	6729659968	286	2026-05-14 16:30:30.55254
7686	6620710987	6	2026-05-14 17:14:44.380141
7441	6129341635	283	2026-05-09 17:09:21.799255
7691	6720124032	288	2026-05-14 17:18:18.620463
7693	6720124032	289	2026-05-14 17:18:51.267424
7697	6564900193	3	2026-05-14 18:09:50.465627
7702	7746046007	139	2026-05-14 18:58:35.663029
7705	7746046007	287	2026-05-14 19:01:19.439374
7708	6872029651	335	2026-05-14 19:17:06.935639
7713	6409821771	3	2026-05-14 19:39:50.939879
7715	6409821771	287	2026-05-14 19:40:07.137314
7719	5415358039	3	2026-05-14 19:56:55.581878
7723	5415358039	3	2026-05-14 22:36:01.351108
7890	7006856163	412	2026-05-15 18:00:11.59305
8172	5415358039	417	2026-05-17 06:21:29.381779
7170	7908756476	139	2026-05-06 23:51:52.81922
7176	5104073058	227	2026-05-07 00:52:16.882704
7179	5104073058	381	2026-05-07 00:54:08.580319
8182	5415358039	9	2026-05-17 13:23:04.661294
8183	5415358039	10	2026-05-17 13:23:15.722579
8186	5415358039	10	2026-05-17 15:25:57.086249
7934	6409821771	416	2026-05-15 21:44:09.131417
7532	6272548417	372	2026-05-10 14:35:49.863046
7937	8319698469	288	2026-05-15 22:00:44.488639
7940	5718477026	4	2026-05-15 23:26:15.784455
7941	5718477026	257	2026-05-15 23:26:55.207149
7945	6167797720	5	2026-05-16 00:54:52.430214
7948	5415358039	5	2026-05-16 01:05:14.138096
7951	6167797720	261	2026-05-16 01:11:04.762399
7955	7746046007	4	2026-05-16 06:03:48.983646
7957	7746046007	152	2026-05-16 06:04:18.90937
7959	7746046007	257	2026-05-16 06:04:45.085097
8189	5415358039	10	2026-05-17 16:14:46.772981
8192	2013244058	8	2026-05-17 17:52:36.490011
8194	2013244058	10	2026-05-17 17:52:52.02507
8196	2013244058	237	2026-05-17 17:53:21.2665
7970	2013244058	233	2026-05-16 08:29:42.328973
7973	8726316433	3	2026-05-16 09:56:40.488674
7976	8726316433	289	2026-05-16 09:58:15.670685
8197	2013244058	265	2026-05-17 17:53:38.225601
7247	8726316433	379	2026-05-07 12:04:26.038557
7250	5415358039	281	2026-05-07 12:31:05.356856
7253	6588278938	7	2026-05-07 12:47:20.870688
7254	6588278938	112	2026-05-07 12:47:28.278083
7257	6588278938	243	2026-05-07 12:48:36.389731
7982	5415358039	265	2026-05-16 17:11:20.348913
7985	5415358039	192	2026-05-16 17:21:16.225835
7988	5415358039	266	2026-05-16 17:24:56.350662
8228	5415358039	12	2026-05-17 19:37:11.619986
8034	7574632699	32	2026-05-16 19:09:13.180729
8035	7574632699	114	2026-05-16 19:09:24.063583
8039	7574632699	33	2026-05-16 19:10:29.776425
8040	7574632699	136	2026-05-16 19:10:36.461327
8042	7574632699	222	2026-05-16 19:10:49.307615
8252	5415358039	13	2026-05-18 05:03:12.25802
8254	5415358039	13	2026-05-18 05:08:54.834065
8457	6810868802	61	2026-05-20 14:45:11.776387
8464	8375199999	62	2026-05-20 15:56:52.948029
8466	8375199999	61	2026-05-20 15:57:54.068726
8086	6250199428	9	2026-05-16 20:03:00.948014
8089	6250199428	10	2026-05-16 20:04:05.587616
8091	6250199428	237	2026-05-16 20:04:18.417552
8097	6530364511	308	2026-05-16 23:30:21.290605
8106	5104073058	255	2026-05-17 00:05:17.148529
8111	5303731176	9	2026-05-17 00:06:46.657146
8112	5303731176	10	2026-05-17 00:06:58.48796
8113	5303731176	193	2026-05-17 00:07:01.226821
8479	6810868802	63	2026-05-20 22:50:33.776046
8480	6810868802	181	2026-05-20 22:56:16.701794
8481	6810868802	263	2026-05-20 22:56:59.798072
8482	5556524947	64	2026-05-21 21:54:50.32296
8483	5556524947	63	2026-05-21 21:55:12.200994
8484	5556524947	181	2026-05-21 21:55:42.172002
8491	8279431973	72	2026-05-24 13:20:38.99738
8492	8279431973	65	2026-05-24 13:22:01.475741
8493	7465985372	65	2026-05-25 07:40:34.497749
8494	7465985372	72	2026-05-25 07:41:07.387104
8495	8279431973	72	2026-05-25 13:40:34.585888
8496	7746046007	62	2026-05-25 20:17:30.970549
8503	6834163411	416	2026-05-26 01:31:31.766199
8541	7803113312	8	2026-05-27 22:52:08.747343
8542	7803113312	390	2026-05-28 00:01:48.994123
8543	5234386942	65	2026-05-28 18:35:51.769416
8544	5234386942	66	2026-05-28 18:36:16.6918
8549	5234386942	73	2026-05-28 22:56:34.136342
8550	5234386942	66	2026-05-28 22:57:26.61444
8551	6729659968	85	2026-05-29 09:25:39.956493
8552	6729659968	86	2026-05-29 09:25:59.774021
8553	6729659968	87	2026-05-29 09:26:13.726702
8570	8468016104	243	2026-05-29 14:38:10.879581
8577	6513362017	279	2026-05-29 22:11:01.111845
8602	6513362017	280	2026-05-30 13:31:44.455443
8603	6217677522	153	2026-05-30 17:41:10.467804
8604	7803113312	390	2026-05-30 17:50:15.507563
8605	7803113312	31	2026-05-30 17:52:31.58452
8606	7803113312	32	2026-05-30 17:53:31.441624
8607	5534474259	175	2026-05-30 19:07:40.235902
8608	6217677522	258	2026-05-30 19:11:33.717689
8609	6217677522	143	2026-05-30 19:11:37.464187
8610	6217677522	30	2026-05-30 19:11:43.328371
8611	6217677522	29	2026-05-30 19:11:47.28486
8612	5534474259	27	2026-05-30 19:18:06.325737
8613	5534474259	375	2026-05-30 20:03:53.55475
8614	5534474259	11	2026-05-30 20:04:19.506444
8615	5534474259	258	2026-05-30 20:28:39.127112
\.


--
-- Data for Name: logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.logs (id, user_id, action, details, created_at) FROM stdin;
7069	6129341635	download	Solution — Corrigé Type TD N1	2026-05-09 17:09:21.790553
7145	6250199428	download	Serie 4	2026-05-10 11:39:02.488678
7201	7574632699	download	Serie 4	2026-05-10 23:31:40.879717
7207	6530364511	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-10 23:34:30.784855
7226	6018795251	download	Serie 1	2026-05-11 18:03:38.305478
7314	5534474259	download	Chapter 1	2026-05-14 00:35:40.126263
7420	5534474259	download	Serie 4	2026-05-15 02:52:11.034462
7525	5534474259	download	Serie 2	2026-05-15 13:40:46.365417
7610	7746046007	download	. — Chapter IV. Linked Lists (Session N°1)	2026-05-16 06:02:30.692911
7685	5534474259	download	Skip — 01- Introduction à la Parasitologie 2026 Dr Fellahi A	2026-05-16 18:57:46.499943
7785	5534474259	download	Serie 3	2026-05-17 00:39:50.662093
7856	5534474259	download	Serie 5	2026-05-17 18:52:37.744664
7857	5534474259	download	Serie 3	2026-05-17 18:53:33.31011
7858	5534474259	download	. — semio gyneco 2	2026-05-17 18:53:52.885516
7860	5534474259	download	Exam 2024/205	2026-05-17 18:54:37.96343
7862	5534474259	download	Seri1 — PW 6 corr	2026-05-17 18:55:12.084042
7863	5534474259	download	Seri1 — PW04 Corrected	2026-05-17 18:55:19.721017
7864	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-17 18:55:26.432912
7944	5534474259	download	Chapter 2	2026-05-18 11:33:13.083838
8010	5534474259	upload	..	2026-05-29 11:41:59.708929
8014	5534474259	maintenance	OFF	2026-05-30 05:52:38.289723
7859	5534474259	download	Solution serie 3	2026-05-17 18:54:26.164913
7945	5534474259	download	Serie 3	2026-05-18 11:33:36.508426
8011	5534474259	search	El	2026-05-29 13:05:08.367299
8015	5534474259	search	Serie 2 archi	2026-05-30 10:27:24.620868
7070	5534474259	download	Serie 6	2026-05-09 19:09:39.301582
7146	6530364511	download	All chapters	2026-05-10 11:58:34.989651
7148	5534474259	download	. — semio hg genitale	2026-05-10 11:59:39.692896
7202	7574632699	download	Serie 5	2026-05-10 23:32:43.827311
7227	7596452439	download	All chapters	2026-05-11 19:02:14.439371
7230	5534474259	download	Serie 3	2026-05-11 19:05:11.258923
7231	5534474259	download	Serie 5	2026-05-11 19:05:13.800358
7232	5534474259	download	Serie 3	2026-05-11 19:05:16.43476
7233	5534474259	download	Serie 4	2026-05-11 19:05:19.230491
7315	5534474259	download	Chapter 2	2026-05-14 00:35:42.943465
7421	5534474259	download	. — semio gyneco 2	2026-05-15 02:52:33.572345
7526	5534474259	download	. — semio gyneco 2	2026-05-15 13:40:51.372946
7611	7746046007	download	Serie 1	2026-05-16 06:03:48.971749
7686	5534474259	download	. — semio hg genitale	2026-05-16 18:57:55.719682
7786	5534474259	download	Chapter 3	2026-05-17 00:41:26.566145
7788	5534474259	download	Os — Chapter 5 (1)	2026-05-17 00:41:41.497465
7789	5534474259	download	Chapter 3	2026-05-17 00:41:49.609748
7790	5534474259	download	List of axioms and rules	2026-05-17 00:42:02.281878
7791	5534474259	download	. — semio hg genitale	2026-05-17 00:42:09.269499
7861	5534474259	download	Serie 3	2026-05-17 18:55:00.347961
7946	5534474259	download	Seri1 — PW5 corrected	2026-05-18 13:02:40.204568
8012	6513362017	search	algo2	2026-05-29 22:10:34.113097
8016	5534474259	add_admin	ID: 6217677522	2026-05-30 18:42:15.329139
8017	5534474259	add_admin	ID: 6217677522	2026-05-30 18:43:22.865952
7071	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-09 19:10:26.330439
7077	5534474259	download	ملخص chapter 3 +	2026-05-09 19:12:13.387353
7078	5534474259	download	ملخص chapter 3	2026-05-09 19:12:16.279794
7147	5534474259	download	All chapters	2026-05-10 11:59:34.307798
7149	5534474259	download	Chapter 2	2026-05-10 11:59:52.453255
7150	6530364511	download	Chapter 1	2026-05-10 12:00:36.140971
7204	7574632699	download	Solution serie 3	2026-05-10 23:33:52.852537
7206	7574632699	download	. — 20260411-163534	2026-05-10 23:34:27.826215
7228	5534474259	download	Serie 4	2026-05-11 19:05:06.393765
7229	5534474259	download	Serie 6	2026-05-11 19:05:08.810494
7316	5534474259	search	Proba serie 2	2026-05-14 01:26:38.954422
7422	5534474259	download	. — semio hg genitale	2026-05-15 02:52:39.313246
7527	5415358039	download	Serie 2	2026-05-15 13:49:27.441979
7612	7746046007	download	Serie 2	2026-05-16 06:04:06.874101
7687	5534474259	download	Serie 4	2026-05-16 19:02:33.219558
7692	7574632699	download	Chapter 3	2026-05-16 19:09:24.051802
7694	5534474259	download	. — semio gyneco 2	2026-05-16 19:10:02.835986
7787	5534474259	download	Chapter 3	2026-05-17 00:41:35.542391
7793	5534474259	download	Serie 4	2026-05-17 00:45:16.550977
7865	5534474259	download	Os — Chapter 5 (1)	2026-05-17 18:58:16.985403
7869	5534474259	download	Seri1 — PW 6 corr	2026-05-17 18:59:21.172764
7870	5534474259	download	Os — Chapter 3 (1)	2026-05-17 18:59:28.005667
7871	5534474259	download	. — semio gyneco 2	2026-05-17 18:59:33.73973
7872	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-17 18:59:49.624036
7873	5534474259	download	Skip — 01- Introduction à la Parasitologie 2026 Dr Fellahi A	2026-05-17 18:59:59.391086
7947	8187764784	download	Serie 1	2026-05-18 19:53:10.23251
8013	5534474259	maintenance	ON	2026-05-29 23:51:33.780748
7072	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-09 19:10:41.75879
7073	5534474259	download	. — IRA (4)	2026-05-09 19:10:50.224704
7074	5534474259	download	ملخص chapter 3	2026-05-09 19:12:02.816538
7151	5534474259	download	Chapter 1	2026-05-10 12:02:49.511227
7208	6530364511	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-10 23:36:04.344489
7234	5534474259	download	Serie 6	2026-05-11 19:05:22.173716
7317	5534474259	download	Serie 2	2026-05-14 01:26:45.740352
7423	5534474259	download	Serie 3	2026-05-15 06:40:12.512923
7528	5415358039	download	Serie 3	2026-05-15 13:50:38.33273
7613	7746046007	download	Serie 3	2026-05-16 06:04:18.909709
7614	7746046007	download	Serie 4	2026-05-16 06:04:27.360576
7615	7746046007	download	Solution serie 4	2026-05-16 06:04:45.085157
7688	5534474259	download	List of axioms and rules	2026-05-16 19:02:45.015955
7689	5534474259	download	. — semio gyneco 2	2026-05-16 19:03:07.115633
7792	5534474259	download	Os — Chapter 5 (1)	2026-05-17 00:45:04.668812
8018	5534474259	maintenance	ON	2026-05-30 18:46:47.962274
7075	5534474259	download	ملخص chapter 3 +	2026-05-09 19:12:06.260667
7152	5534474259	download	Chapter 2	2026-05-10 12:02:52.991183
7153	5534474259	download	Chapter 3	2026-05-10 12:02:56.531533
7209	6885186666	download	Serie 1	2026-05-11 01:21:37.196024
7235	5534474259	download	Serie 4	2026-05-11 19:05:24.920637
7318	8319698469	download	Quiz A	2026-05-14 16:26:50.772294
7424	5534474259	download	Chapter 2	2026-05-15 06:43:57.304063
7428	5534474259	download	Solution — Corrigé Type TD N0	2026-05-15 06:45:48.421468
7430	5534474259	download	Serie 3	2026-05-15 06:46:05.226541
7431	5534474259	download	Os — Chapter 7	2026-05-15 06:46:16.67073
7433	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-15 06:46:33.534884
7434	5534474259	download	Serie 5	2026-05-15 06:46:44.745718
7529	5415358039	download	Serie 4	2026-05-15 13:51:16.754114
7616	5534474259	download	Chapter 1	2026-05-16 06:25:35.048273
7690	7574632699	download	Chapter 1	2026-05-16 19:09:02.121342
7701	5534474259	download	. — semio hg genitale	2026-05-16 19:11:03.212817
7705	5534474259	download	. — semio hg genitale	2026-05-16 19:11:30.998848
7794	5534474259	download	Chapter 4	2026-05-17 00:45:34.159855
7866	5534474259	download	Os — Chapter 3 (1)	2026-05-17 18:58:21.369958
7867	5534474259	download	Os — Chapter 3 (1)	2026-05-17 18:58:29.329299
7948	8187764784	download	Solution of serie 4	2026-05-18 19:54:10.706681
8019	5534474259	maintenance	ON	2026-05-30 18:47:01.316483
8020	5534474259	maintenance	OFF	2026-05-30 18:47:08.813087
7868	5534474259	download	Seri1 — PW 6 corr	2026-05-17 18:58:38.06107
7874	5534474259	download	Acidocetose diabetique	2026-05-17 19:00:39.187301
7949	5534474259	download	Seri1 — PW04 Corrected	2026-05-19 00:03:47.744933
8021	5534474259	search	Algo 2	2026-05-30 19:44:14.560157
7076	5534474259	download	ملخص chapter 3	2026-05-09 19:12:10.993423
7236	5534474259	download	Chapter 2	2026-05-11 19:16:51.046135
7237	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-11 20:03:57.913864
7238	5534474259	download	. — semio gyneco 2	2026-05-11 20:04:02.123262
7319	8319698469	download	Quiz B	2026-05-14 16:26:59.104437
7321	6729659968	download	Chapter 2	2026-05-14 16:30:30.55295
7425	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 06:44:42.081511
7426	5534474259	download	Serie 4	2026-05-15 06:44:53.530748
7427	5534474259	download	. — semio hg genitale	2026-05-15 06:45:19.858562
7530	6409821771	download	Exercices linked listes	2026-05-15 13:58:59.722364
7617	5534474259	download	Chapter 2	2026-05-16 06:25:39.696196
7691	7574632699	download	Chapter 2	2026-05-16 19:09:13.170327
7795	5534474259	download	Chapter 3	2026-05-17 01:05:37.201184
8022	5534474259	search	Serie 2 algo	2026-05-30 19:47:15.469019
7079	5534474259	download	ملخص chapter 2	2026-05-09 19:13:22.189565
7082	5534474259	download	. — IRA (4)	2026-05-09 19:14:38.537939
7154	5534474259	download	Solution serie 1	2026-05-10 12:15:52.052695
7158	5534474259	download	Serie 2	2026-05-10 12:16:43.723814
7210	5534474259	search	Ex	2026-05-11 06:42:19.474157
7212	5534474259	download	List of axioms and rules	2026-05-11 06:43:01.588474
7239	5534474259	download	Chapter 1	2026-05-11 22:55:48.421988
7320	6729659968	download	Chapter 1	2026-05-14 16:29:48.101421
7429	5534474259	download	. — semio hg genitale	2026-05-15 06:45:55.338523
7432	5534474259	search	Exam	2026-05-15 06:46:28.135276
7437	5534474259	download	. — semio hg genitale	2026-05-15 06:49:14.284843
7439	5534474259	download	Exaaams	2026-05-15 06:49:30.405393
7442	5534474259	download	. — semio gyneco 2	2026-05-15 06:49:48.095186
7531	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-15 14:01:55.475728
7618	5534474259	download	Chapter 3	2026-05-16 06:25:45.103171
7693	7574632699	download	Chapter 4	2026-05-16 19:09:38.555417
7796	5534474259	download	. — semio hg genitale	2026-05-17 01:58:28.305748
7875	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-17 19:19:39.035804
7950	5534474259	download	Seri1 — PW04 Corrected	2026-05-19 00:03:54.829656
7952	5534474259	download	Chapter 4	2026-05-19 00:05:21.780064
7240	5534474259	download	Chapter 2	2026-05-11 22:55:51.85215
7322	6729659968	download	Chapter 3	2026-05-14 16:30:45.187657
7323	6729659968	download	Chapter 4	2026-05-14 16:30:56.890557
7324	6729659968	download	Chapter 5	2026-05-14 16:31:05.357286
7435	5534474259	download	Serie 5	2026-05-15 06:49:06.277417
7532	5534474259	download	. — semio gyneco 2	2026-05-15 14:19:21.975225
7619	5534474259	download	Serie 3	2026-05-16 06:59:08.208525
7695	5534474259	download	. — semio genitale masculin dr kemiha	2026-05-16 19:10:10.498109
7697	7574632699	download	Serie 2	2026-05-16 19:10:36.449708
7699	7574632699	download	Serie 3	2026-05-16 19:10:49.295845
7700	5534474259	download	Skip — 01- Introduction à la Parasitologie 2026 Dr Fellahi A	2026-05-16 19:10:54.862472
7702	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-16 19:11:09.970375
7703	5534474259	download	. — Worksheet N°6 Common Discrete Probability	2026-05-16 19:11:15.626078
7704	5534474259	download	. — semio hg genitale	2026-05-16 19:11:22.938317
7706	5534474259	download	Serie 3	2026-05-16 19:11:44.049162
7797	5534474259	search	Exams	2026-05-17 01:58:50.739201
7801	5534474259	download	. — semio hg genitale	2026-05-17 01:59:35.822897
7876	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 19:19:59.863336
7877	5534474259	download	Chapter 3	2026-05-17 19:20:18.814112
7951	5534474259	download	Serie 4	2026-05-19 00:04:24.453298
8023	5534474259	upload	Sjzjsjs	2026-05-30 19:51:13.964246
7241	5534474259	upload	Resumè chapter 1/2	2026-05-11 23:26:23.449945
7244	5534474259	download	Serie 1	2026-05-11 23:52:10.878637
7325	6729659968	search	algo	2026-05-14 16:31:30.819071
7436	5534474259	download	. — semio hg genitale	2026-05-15 06:49:10.929836
7533	5534474259	download	. — semio hg genitale	2026-05-15 14:23:17.177252
7620	5534474259	download	. — IRA (4)	2026-05-16 07:05:52.103753
7624	5534474259	download	. — semio hg genitale	2026-05-16 07:06:29.92337
7696	7574632699	download	Serie 1	2026-05-16 19:10:29.765813
7798	5534474259	download	Exaams part 2	2026-05-17 01:58:53.126673
7799	5534474259	download	. — semio gyneco 2	2026-05-17 01:59:16.051975
7800	5534474259	download	Serie 4	2026-05-17 01:59:30.346216
7802	5534474259	download	. — semio gyneco 2	2026-05-17 02:00:06.676856
7878	5534474259	download	Serie 3	2026-05-17 19:32:50.78379
7879	5534474259	download	Serie 3	2026-05-17 19:32:59.738724
7881	5534474259	download	Chapter 1	2026-05-17 19:33:21.194428
7882	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 19:33:26.581128
7885	5415358039	download	Seri2	2026-05-17 19:37:11.620198
7953	5534474259	download	Serie 4	2026-05-19 00:17:18.361014
7955	5534474259	download	. — semio genitale masculin dr kemiha	2026-05-19 00:17:32.397096
8024	5534474259	search	Algo 2	2026-05-30 19:51:49.725664
8025	5534474259	search	Algo 2	2026-05-30 20:03:49.636165
7242	5534474259	download	Serie 3	2026-05-11 23:51:54.164275
7326	6729659968	download	Chapter 1	2026-05-14 16:33:01.48088
7438	5534474259	download	. — semio gyneco 2	2026-05-15 06:49:20.835593
7440	5534474259	download	Chapter 2	2026-05-15 06:49:34.319612
7441	5534474259	download	. — semio hg genitale	2026-05-15 06:49:39.941793
7443	5534474259	download	Serie 3	2026-05-15 06:49:57.173423
7445	5534474259	download	Seri1 — PW 6 corr	2026-05-15 06:50:13.560231
7534	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-15 14:23:30.037995
7621	5534474259	download	. — semio gyneco 2	2026-05-16 07:05:55.839844
7622	5534474259	download	. — semio gyneco 2	2026-05-16 07:06:03.586116
7698	5534474259	download	. — semio hg genitale	2026-05-16 19:10:39.560034
7803	5534474259	download	Exam crr 2024/205	2026-05-17 02:01:52.277534
7806	5534474259	download	Resumè chapter 1/2	2026-05-17 02:03:23.198754
7880	5534474259	download	Serie 3	2026-05-17 19:33:06.456233
7954	5534474259	download	. — semio hg genitale	2026-05-19 00:17:24.422559
7883	5534474259	download	Solutions serie 3 & 4	2026-05-17 19:34:17.950537
7956	5534474259	download	Serie 4	2026-05-19 00:31:03.028261
8026	5534474259	search	Analyse	2026-05-30 20:04:17.004505
7243	5534474259	download	Serie 2	2026-05-11 23:52:05.926898
7327	7415555924	search	algo	2026-05-14 17:04:04.491425
7329	6620710987	download	Quiz B	2026-05-14 17:14:53.340663
7444	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 06:50:02.780949
7447	5534474259	download	Serie 4	2026-05-15 06:55:35.501654
7448	5534474259	download	Serie 1	2026-05-15 06:55:38.546458
7449	5534474259	download	Serie 5	2026-05-15 06:55:57.140179
7535	5534474259	download	Solution serie 4	2026-05-15 14:57:17.269828
7623	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-16 07:06:12.563759
7707	5534474259	download	Serie 2	2026-05-16 19:20:31.62784
7804	5534474259	download	كتاب جبر	2026-05-17 02:02:38.393359
7805	5534474259	download	كتاب جبر	2026-05-17 02:02:43.975594
7884	5415358039	download	Solutions serie 2	2026-05-17 19:36:34.102655
7957	5534474259	download	Serie 4	2026-05-19 00:31:09.468306
7960	5534474259	download	Dysphosphoremies	2026-05-19 00:33:03.943598
7964	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-19 00:37:03.950319
7968	5534474259	download	Dysphosphoremies	2026-05-19 00:37:59.762224
7245	5534474259	download	Chapter 4	2026-05-11 23:59:53.85999
7246	5534474259	download	. — Worksheet N°5 Discrete Random Variables	2026-05-12 00:00:05.88053
7328	6620710987	download	Quiz A	2026-05-14 17:14:44.409581
7446	5534474259	download	Serie 5	2026-05-15 06:55:27.653965
7536	5415358039	download	Serie 2	2026-05-15 15:18:37.86461
7625	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 07:09:42.018996
7708	5534474259	download	Serie 4	2026-05-16 19:20:44.864335
7709	5534474259	download	. — semio gyneco 2	2026-05-16 19:20:50.557593
7711	5534474259	download	. — semio gyneco 2	2026-05-16 19:21:12.711925
7807	5534474259	download	. — Worksheet N°5 Discrete Random Variables	2026-05-17 02:03:30.056693
7886	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 20:05:28.460317
7247	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-12 00:00:14.52396
7330	6720124032	download	Chapter 1	2026-05-14 17:16:41.824916
7333	6720124032	download	Chapter 4	2026-05-14 17:18:18.620459
7334	6720124032	download	Chapter 3	2026-05-14 17:18:29.920231
7450	5534474259	download	Serie 3	2026-05-15 06:56:07.70064
7537	5718477026	download	Chapter 1	2026-05-15 16:30:41.180004
7626	2013244058	download	Serie 4	2026-05-16 08:29:42.3154
7710	5534474259	download	. — semio genitale masculin dr kemiha	2026-05-16 19:20:56.840312
7712	5534474259	download	Serie 2	2026-05-16 19:21:24.963794
7713	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-16 19:21:38.855828
7808	5534474259	upload	Exam 2026	2026-05-17 02:06:13.363021
7810	5534474259	download	Exams 2025/2024	2026-05-17 02:06:39.77459
7811	5534474259	download	. — semio gyneco 2	2026-05-17 02:06:45.195331
7812	5534474259	download	. — semio hg genitale	2026-05-17 02:06:50.267781
7813	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-17 02:06:54.014511
7815	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 02:07:01.179322
7818	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-17 02:07:11.705123
7819	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 02:07:14.967083
7820	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-17 02:07:20.144502
7821	5534474259	download	Seri1 — PW 6 corr	2026-05-17 02:07:32.654569
7822	5534474259	download	Os — Chapter 1	2026-05-17 02:07:36.332639
7823	5534474259	download	Chapter 3	2026-05-17 02:07:43.416635
7824	5534474259	download	كتب الجبر — book-exos (1)	2026-05-17 02:09:03.351956
7958	5534474259	download	Seri1 — PW 6 corr	2026-05-19 00:32:15.320157
7248	5534474259	download	Serie 3	2026-05-12 08:12:44.652975
7253	5534474259	download	Serie 3	2026-05-12 08:20:01.156963
7254	5534474259	download	Serie 1	2026-05-12 08:20:03.603787
7331	6720124032	download	Chapter 2	2026-05-14 17:16:56.126851
7332	6720124032	download	Chapter 3	2026-05-14 17:17:04.32369
7335	6720124032	download	Chapter 5	2026-05-14 17:18:51.267427
7451	5534474259	download	. — semio gyneco 2	2026-05-15 07:05:57.8306
7538	5718477026	download	Serie 1	2026-05-15 16:34:50.984866
7627	5415358039	download	Serie 1	2026-05-16 08:50:43.224333
7714	5534474259	download	. — semio gyneco 2	2026-05-16 19:21:44.368543
7809	5534474259	download	Exams 2025/2024	2026-05-17 02:06:28.168958
7825	5534474259	download	Chaine archi	2026-05-17 02:09:15.206393
7887	5534474259	maintenance	ON	2026-05-17 20:19:43.889871
7959	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-19 00:32:21.141162
7888	5534474259	maintenance	OFF	2026-05-17 20:52:16.681632
7961	5534474259	download	Biochimiee	2026-05-19 00:33:14.541277
7962	5534474259	download	بادئة — Sémiologie digestives vmts dysphagie	2026-05-19 00:33:32.408725
7249	5534474259	download	. — semio gyneco 2	2026-05-12 08:12:50.283922
7336	8319698469	download	Solutions quizs	2026-05-14 17:46:52.310339
7337	8319698469	download	Quiz A	2026-05-14 17:46:57.073203
7452	5534474259	download	Exaaams	2026-05-15 07:12:00.648314
7539	5718477026	download	Serie 2	2026-05-15 16:44:52.301614
7628	5415358039	download	Serie 2	2026-05-16 08:54:22.546544
7715	5534474259	download	Serie 2	2026-05-16 19:21:55.667844
7814	5534474259	download	. — semio hg genitale	2026-05-17 02:06:57.615864
7817	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-17 02:07:08.326891
7827	5534474259	download	Exam 2026	2026-05-17 02:11:59.496011
7828	5534474259	download	. — semio gyneco 2	2026-05-17 02:12:31.177003
7250	5534474259	download	Serie 5	2026-05-12 08:19:54.329688
7251	5534474259	download	Serie 3	2026-05-12 08:19:56.701527
7257	5534474259	download	Serie 6	2026-05-12 08:20:12.507325
7338	6564900193	download	Solutions quizs	2026-05-14 18:08:44.052734
7340	5426803479	download	Chapter 4	2026-05-14 18:22:46.286577
7341	5426803479	download	Chapter 5	2026-05-14 18:23:30.099405
7453	5534474259	search	Serie 2 algo	2026-05-15 07:13:06.378616
7454	5534474259	download	Serie 2 — series 2(1)	2026-05-15 07:13:11.336818
7540	6872029651	search	Examen	2026-05-15 16:57:07.839008
7629	8726316433	download	Chapter 1	2026-05-16 09:56:40.48915
7630	8726316433	download	Chapter 2	2026-05-16 09:56:46.282017
7716	5534474259	download	. — semio gyneco 2	2026-05-16 19:26:09.013192
7717	5534474259	download	. — Worksheet N°5 Discrete Random Variables	2026-05-16 19:26:23.11891
7816	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-17 02:07:04.733235
7889	5534474259	download	Exam crr 2024/205	2026-05-17 21:46:35.874702
7963	5534474259	download	Solution of serie 4	2026-05-19 00:34:46.912452
7252	5534474259	download	Serie 1	2026-05-12 08:19:58.964197
7255	5534474259	download	Serie 5	2026-05-12 08:20:07.27917
7256	5534474259	download	Serie 3	2026-05-12 08:20:09.567773
7339	6564900193	download	Chapter 1	2026-05-14 18:09:50.465844
7455	5534474259	download	Serie 2 — series 2(1)	2026-05-15 07:13:33.165567
7541	6872029651	search	Algorithm s2	2026-05-15 16:57:25.950059
7631	8726316433	download	Chapter 3	2026-05-16 09:56:53.081618
7718	5534474259	download	Serie 4	2026-05-16 19:26:39.184964
7720	5534474259	download	. — semio hg genitale	2026-05-16 19:27:01.430351
7721	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 19:27:05.443484
7722	5534474259	download	Exaaams	2026-05-16 19:27:27.780342
7826	5534474259	download	Exam 2026	2026-05-17 02:10:36.792864
7890	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 22:02:13.161882
7965	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-19 00:37:10.397176
7891	5534474259	download	Exam crr 2024/205	2026-05-17 22:02:21.623486
7895	5534474259	download	Seri1 — PW 6 corr	2026-05-17 22:03:42.997794
7897	5534474259	download	Seri1 — PW5 corrected	2026-05-17 22:03:53.838151
7966	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-19 00:37:16.594553
7258	5534474259	download	Serie 4	2026-05-12 08:20:15.90073
7342	5426803479	download	Chapter 3	2026-05-14 18:26:58.807502
7456	5534474259	download	Serie 6	2026-05-15 07:15:26.260561
7542	5534474259	download	Solutions exercices linked listes	2026-05-15 17:53:42.323331
7632	8726316433	download	Chapter 5	2026-05-16 09:58:16.661253
7719	5534474259	download	Serie 3	2026-05-16 19:26:50.193748
7829	5534474259	download	Serie 3	2026-05-17 02:13:14.332899
7259	5534474259	download	Chapter 4	2026-05-12 09:00:06.186211
7260	5534474259	download	Chapter 3	2026-05-12 09:03:36.281544
7343	7746046007	download	Chaine algèbra 2	2026-05-14 18:57:28.73065
7457	5415358039	download	Chapter 1	2026-05-15 07:22:42.284047
7458	5415358039	download	Chapter 2	2026-05-15 07:23:12.321003
7543	5534474259	download	Serie 5	2026-05-15 19:29:50.444476
7544	5534474259	download	Chapter 4	2026-05-15 19:30:04.113639
7633	6810868802	download	. — Corrigé. Examen.anal2.mai2024	2026-05-16 13:59:01.757117
7723	5534474259	download	. — semio hg genitale	2026-05-16 19:27:35.987332
7830	5415358039	download	Exam 2026	2026-05-17 06:21:30.274422
7892	5534474259	download	. — semio gyneco 2	2026-05-17 22:02:31.625885
7893	5534474259	download	Os — Chapter 5 (1)	2026-05-17 22:02:38.779325
7967	5534474259	download	All chapters	2026-05-19 00:37:40.72264
7894	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-17 22:03:15.50626
7969	5534474259	download	Serie 2	2026-05-19 00:50:52.896334
7970	5534474259	download	List of axioms and rules	2026-05-19 00:51:20.893554
7261	5534474259	download	Antiro	2026-05-12 09:43:37.508027
7262	5534474259	download	Resumè chapter 1/2	2026-05-12 09:44:12.996599
7344	7746046007	download	Exams (USTHB)	2026-05-14 18:58:35.663161
7459	5415358039	download	Serie 1	2026-05-15 07:23:31.90265
7460	5415358039	download	Serie 2	2026-05-15 07:23:49.948094
7545	5534474259	download	Serie 4	2026-05-15 19:30:41.712136
7547	5534474259	download	Solution serie 1	2026-05-15 19:30:47.620745
7548	5534474259	download	Serie 3	2026-05-15 19:30:52.127527
7553	5534474259	download	Solution serie 1	2026-05-15 19:31:05.326836
7634	6810868802	download	. — Corrigé. Examen.anal2.mai2024	2026-05-16 13:59:06.362637
7724	5534474259	download	Serie 4	2026-05-16 19:31:33.084999
7831	5534474259	download	. — semio gyneco 2	2026-05-17 06:28:00.389655
7832	5534474259	download	بادئة — Sémiologie digestives vmts dysphagie	2026-05-17 06:28:18.410064
7263	5534474259	download	Serie 2	2026-05-12 10:36:30.28274
7345	7746046007	download	Chapter 1	2026-05-14 19:00:52.568839
7461	5534474259	download	Serie 4	2026-05-15 07:42:49.986311
7468	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 07:43:34.964999
7546	5534474259	download	Serie 3	2026-05-15 19:30:44.723041
7635	6810868802	download	. — تاست	2026-05-16 14:03:09.096419
7725	5534474259	download	Serie 4	2026-05-16 19:39:49.667777
7833	5534474259	download	. — semio gyneco 2	2026-05-17 07:18:34.874809
7834	5534474259	download	Serie 3	2026-05-17 07:18:45.764476
7896	5534474259	download	Seri1 — PW 6 corr	2026-05-17 22:03:47.905658
7971	5534474259	download	Os — Chapter 4	2026-05-19 00:51:36.556618
7972	5534474259	download	بادئة — Sémiologie digestives vmts dysphagie	2026-05-19 00:51:42.616494
7264	5534474259	download	Serie 3	2026-05-12 11:48:58.262273
7346	7746046007	download	Chapter 2	2026-05-14 19:00:58.89791
7350	6872029651	search	Algorithm	2026-05-14 19:16:27.059429
7462	5534474259	download	. — semio gyneco 2	2026-05-15 07:42:57.431152
7463	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-15 07:42:59.33572
7464	5534474259	download	. — semio hg genitale	2026-05-15 07:43:03.951435
7465	5534474259	download	. — semio hg genitale	2026-05-15 07:43:10.87993
7466	5534474259	download	Seri1 — PW5 corrected	2026-05-15 07:43:25.787016
7467	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 07:43:30.662899
7472	5534474259	download	Serie 2 — series 2(1)	2026-05-15 07:44:33.802198
7474	5534474259	download	Serie 3	2026-05-15 07:44:52.625973
7475	5534474259	download	. — semio hg genitale	2026-05-15 07:44:56.3252
7549	5534474259	download	Solution serie 1	2026-05-15 19:30:55.108217
7550	5534474259	download	Serie 3	2026-05-15 19:30:57.934258
7551	5534474259	download	Solution serie 1	2026-05-15 19:31:00.290992
7552	5534474259	download	Serie 3	2026-05-15 19:31:02.822794
7636	5534474259	download	'	2026-05-16 15:03:41.995238
7726	5534474259	download	Serie 3	2026-05-16 19:40:06.056608
7835	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 07:18:50.970747
7898	5534474259	download	Seri1 — LAB 3 explanations	2026-05-17 22:03:58.776739
7899	5534474259	download	Seri1 — PW04 Corrected	2026-05-17 22:04:03.073054
7901	5415358039	download	Chapter 3	2026-05-18 03:29:16.235323
7973	5534474259	download	Solution of serie 4	2026-05-19 01:00:12.827493
7900	5415358039	download	Chapter 2 part 2	2026-05-18 03:28:46.007955
7974	5534474259	download	Os — Chapter 1	2026-05-19 01:00:41.471051
7975	5534474259	download	Serie 3	2026-05-19 01:01:06.369393
7265	5534474259	download	Solution serie 1	2026-05-12 11:49:02.720274
7347	7746046007	download	Chapter 3	2026-05-14 19:01:19.439449
7348	7746046007	download	Chapter 4	2026-05-14 19:01:27.853696
7349	7746046007	download	Chapter 5	2026-05-14 19:01:30.865294
7469	5534474259	download	Seri1 — PW5 corrected	2026-05-15 07:43:45.552773
7554	5534474259	download	Chapter 4	2026-05-15 19:32:44.018731
7637	5415358039	download	Chapter 3	2026-05-16 16:55:35.711247
7727	5534474259	download	List of axioms and rules	2026-05-16 19:41:48.391733
7836	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-17 07:21:53.231243
7266	5534474259	download	Serie 3	2026-05-12 11:49:05.525715
7267	5534474259	download	Solution serie 1	2026-05-12 11:49:08.506484
7351	6872029651	download	Serie 1 — ASD2_exercise6_supplementaire	2026-05-14 19:17:06.93585
7470	5534474259	ban	5415358039	2026-05-15 07:43:55.143537
7471	5534474259	ban	8056058390	2026-05-15 07:43:58.816196
7473	5534474259	download	. — semio hg genitale	2026-05-15 07:44:39.735758
7555	5534474259	download	Serie 3	2026-05-15 19:33:16.51677
7638	5415358039	download	Formulaire primitives	2026-05-16 17:11:04.231074
7728	5534474259	download	Serie 4	2026-05-16 19:43:54.809319
7732	5534474259	download	Serie 4	2026-05-16 19:44:41.889712
7735	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-16 19:44:56.386144
7837	5534474259	download	. — 6-Exploration de la glycémie.pptx	2026-05-17 07:23:28.028664
7838	5534474259	download	Chapter 3	2026-05-17 07:23:33.661475
7902	5415358039	download	Serie 3	2026-05-18 05:03:12.246413
7903	5415358039	download	Solution serie 3	2026-05-18 05:03:35.621057
7976	5534474259	download	Solutions serie 3 & 4	2026-05-19 01:02:09.657702
7977	5534474259	download	Chapter 3	2026-05-19 01:14:08.272395
7268	5534474259	download	Serie 3	2026-05-12 12:29:43.325996
7352	6513362017	search	algo	2026-05-14 19:32:01.266704
7476	5534474259	download	. — semio hg genitale	2026-05-15 07:45:30.575914
7556	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-15 19:33:30.275449
7557	5534474259	download	Os — Chapter 7	2026-05-15 19:33:42.393552
7639	5415358039	download	Chapter 4	2026-05-16 17:11:20.338798
7729	5534474259	download	Serie 5	2026-05-16 19:44:07.241213
7730	5534474259	download	. — semio gyneco 2	2026-05-16 19:44:14.27039
7731	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 19:44:20.971154
7733	5534474259	download	. — semio hg genitale	2026-05-16 19:44:48.588185
7740	5534474259	download	. — semio gyneco 2	2026-05-16 19:45:31.875698
7839	5415358039	download	Chapter 2 part 1	2026-05-17 13:23:04.650744
7840	5415358039	download	Chapter 2 part 2	2026-05-17 13:23:15.712272
7904	5415358039	download	Serie 3	2026-05-18 05:08:55.750091
7978	5534474259	download	Serie 3	2026-05-19 01:14:17.134371
7905	5415358039	download	Chapter 2 part 2	2026-05-18 05:12:17.581771
7979	5534474259	download	Os — Chapter 7	2026-05-19 01:29:01.856019
7269	7574632699	download	Cour 1	2026-05-12 17:20:05.617056
7353	6513362017	download	Exam 1 algo 1	2026-05-14 19:32:46.244904
7354	6513362017	download	Chaine algo 2 algorithmicsbyzair	2026-05-14 19:34:18.496919
7477	5534474259	download	Serie 5	2026-05-15 07:49:27.528732
7558	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-15 19:43:25.424693
7559	5534474259	download	Serie 4	2026-05-15 19:43:56.811245
7560	5534474259	download	Serie 3	2026-05-15 19:43:59.83732
7564	5534474259	download	Serie 3	2026-05-15 19:44:14.763824
7640	5415358039	download	Chapter 3	2026-05-16 17:11:25.491449
7734	5534474259	download	. — semio gyneco 2	2026-05-16 19:44:52.748892
7736	5534474259	download	. — semio hg genitale	2026-05-16 19:44:58.435887
7737	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 19:45:00.381272
7738	5534474259	download	. — semio hg genitale	2026-05-16 19:45:03.909498
7739	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-16 19:45:07.556208
7841	5415358039	download	Chapter 2 part 2	2026-05-17 15:14:18.95034
7270	7574632699	download	Cour 2	2026-05-12 17:20:12.401194
7271	7574632699	download	Cour 3	2026-05-12 17:20:17.786762
7272	7574632699	download	Cour 4	2026-05-12 17:20:25.151925
7355	6409821771	download	Chapter 4	2026-05-14 19:39:22.281866
7359	6409821771	download	Chapter 3	2026-05-14 19:40:07.137402
7478	5534474259	download	Serie 4	2026-05-15 07:49:38.163945
7479	5534474259	download	Seri1 — PW5 corrected	2026-05-15 07:49:50.630401
7906	5534474259	download	. — semio gyneco 2	2026-05-18 05:44:07.911292
7980	5534474259	download	Chapter 3	2026-05-19 01:32:35.341418
7981	5534474259	download	Serie 3	2026-05-19 01:33:21.465509
7480	5534474259	download	Seri1 — PW 6 corr	2026-05-15 07:50:00.336824
7482	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 07:50:12.297205
7483	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-15 07:50:24.802579
7561	5534474259	download	Serie 4	2026-05-15 19:44:02.530192
7565	5534474259	download	Serie 3	2026-05-15 19:44:14.784377
7641	5415358039	download	Serie 3	2026-05-16 17:20:57.521733
7741	5534474259	download	Seri1 — PW 6 corr	2026-05-16 19:47:11.769621
7842	5415358039	download	Chapter 2 part 1	2026-05-17 15:16:25.305762
5632	5104073058	download	Chapter 2 part 2	2026-04-30 20:58:12.978354
5662	5534474259	download	. — Chapter IV. Linked Lists (Session N°3)	2026-05-01 08:39:30.426484
5693	5556524947	download	Solution — Answers -Series 04-	2026-05-01 13:01:32.355599
5713	5415358039	download	Serie of pointeurs	2026-05-01 22:23:42.435297
5738	5534474259	download	Serie 4	2026-05-02 13:14:43.807086
5770	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 14:31:42.568228
5814	5534474259	download	Serie 4	2026-05-02 15:13:21.898909
5633	5104073058	download	Chapter 3	2026-04-30 20:58:29.26905
5634	5104073058	download	Formulaire primitives	2026-04-30 20:58:50.544717
5669	5534474259	download	Serie 6	2026-05-01 08:43:02.218686
5694	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-01 13:37:59.085736
5714	5534474259	download	Cour 1	2026-05-01 23:28:43.62442
5739	5534474259	download	رزنامة	2026-05-02 13:15:14.269165
5740	5534474259	download	Serie 5	2026-05-02 13:15:27.731928
5771	5534474259	download	Serie 3	2026-05-02 14:32:07.512043
5773	5534474259	download	Serie 4	2026-05-02 14:32:29.982822
5776	5534474259	download	. — Chapter IV. Linked Lists (Session N°4)	2026-05-02 14:33:26.528374
5820	5534474259	download	List of axioms and rules	2026-05-02 15:14:09.511815
5635	7514359523	download	Biochimiee	2026-04-30 21:28:41.983678
5670	5534474259	download	Serie 1	2026-05-01 12:31:01.339377
5672	5534474259	download	Serie 3	2026-05-01 12:31:08.815433
5695	5760028323	download	ملخص chapter 3	2026-05-01 13:51:19.284248
5698	5534474259	download	Chaine algèbra 2	2026-05-01 14:31:02.134497
5699	5534474259	download	Chaine algebra 2	2026-05-01 14:31:22.363441
5715	5534474259	download	Cour 2	2026-05-01 23:28:48.188226
5741	5534474259	download	Serie 5	2026-05-02 13:21:20.091477
5774	5534474259	download	رزنامة	2026-05-02 14:32:36.9392
5821	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 15:18:06.472728
5825	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 15:18:32.575552
5636	5534474259	download	. — Chapter IV. Linked Lists (Session N°3)	2026-05-01 06:25:24.861712
5650	5534474259	download	Correction serie 2	2026-05-01 06:28:20.638286
5671	5534474259	download	Serie 2	2026-05-01 12:31:05.277712
5696	5760028323	download	Chapter 3	2026-05-01 13:51:44.540187
5716	5534474259	download	Cour 3	2026-05-01 23:28:51.845589
5717	5534474259	download	Cour 4	2026-05-01 23:28:55.572559
5742	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 13:21:27.747201
5746	5534474259	download	Solution serie 1	2026-05-02 13:21:49.96443
5779	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 14:49:18.967045
5823	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-02 15:18:24.132094
5829	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 15:41:04.414139
5831	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 15:41:39.141199
5637	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-01 06:25:42.649777
5638	5534474259	download	Serie 6	2026-05-01 06:26:05.029529
5640	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-01 06:26:30.612225
5673	5534474259	upload	Chapter 2	2026-05-01 12:36:39.435381
5679	5534474259	download	Chapter 4	2026-05-01 12:40:56.873899
5697	5534474259	download	Chaine 2algebra 2	2026-05-01 14:30:42.184999
5718	5415358039	download	Cour 1	2026-05-02 09:28:21.35309
5721	5534474259	download	Cour 4	2026-05-02 10:04:11.700453
5722	5534474259	download	Cour 5	2026-05-02 10:04:21.264332
5743	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 13:21:32.925753
5748	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 13:22:46.420846
5780	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 14:53:29.859003
5792	5534474259	download	Serie 3	2026-05-02 14:56:23.845232
5801	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 15:03:51.430403
5817	5534474259	download	Solution — Corrigé Type TD N1	2026-05-02 15:13:41.068865
5818	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 15:13:53.027949
5819	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 15:13:58.223201
5824	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 15:18:27.902433
5827	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 15:22:47.934281
5639	5534474259	download	. — Chapter IV. Linked Lists (Session N°3)	2026-05-01 06:26:11.860198
5674	5534474259	upload	Chapter 3	2026-05-01 12:37:56.309178
5675	5534474259	upload	Chapter 4	2026-05-01 12:38:33.053827
5676	5534474259	upload	Chapter 5	2026-05-01 12:38:58.766665
5680	5534474259	download	Serie 2	2026-05-01 12:41:50.307743
5700	5104073058	download	Atiro grp 3	2026-05-01 15:17:55.294944
5719	5415358039	download	Cour 2	2026-05-02 09:28:45.46349
5744	5534474259	download	Tp final	2026-05-02 13:21:37.207315
5745	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 13:21:41.374311
5781	5534474259	download	Serie 3	2026-05-02 14:53:43.702676
5784	5534474259	download	Serie 3	2026-05-02 14:53:56.164134
5826	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 15:22:44.462191
5832	5534474259	download	رزنامة	2026-05-02 15:41:45.621656
5641	5534474259	download	Solution — Corrigé Type TD N0	2026-05-01 06:27:36.638962
5642	5534474259	download	Solution — Corrigé Type TD N1	2026-05-01 06:27:42.740659
5647	5534474259	download	Correction serie 2	2026-05-01 06:28:11.330681
5677	5534474259	download	Chapter 5	2026-05-01 12:40:38.108437
5686	5534474259	download	Solution — Answers Series 02	2026-05-01 12:44:04.099832
5701	5104073058	download	Intero annalyse 2	2026-05-01 15:18:11.023724
5720	5534474259	download	Cour 3	2026-05-02 10:04:02.839336
5727	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-02 10:05:56.027542
5728	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 10:05:59.98032
5747	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 13:22:32.463866
5750	5534474259	download	Serie 5	2026-05-02 13:23:06.654691
5782	5534474259	download	كتاب فمادة لجبر	2026-05-02 14:53:47.936813
5783	5534474259	download	Serie 3	2026-05-02 14:53:52.979474
5785	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 14:54:00.526016
5828	5534474259	download	Serie 5	2026-05-02 15:40:45.875626
5643	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-01 06:27:47.220101
5644	5534474259	download	Solution — Tutorial N3 Corrigé Type	2026-05-01 06:27:54.693812
5653	5534474259	download	Serie 2	2026-05-01 06:28:28.88929
5654	5534474259	download	Correction serie 2	2026-05-01 06:28:32.95274
5678	5534474259	download	Chapter 4	2026-05-01 12:40:49.24844
5702	5104073058	download	Td developpemment limitè	2026-05-01 15:18:25.915442
5723	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-02 10:05:30.446115
5749	5534474259	download	Serie 5	2026-05-02 13:23:01.954275
5786	5534474259	download	Serie 3	2026-05-02 14:54:53.529947
5787	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 14:54:58.878798
5791	5534474259	ban	7514359523	2026-05-02 14:55:39.06687
5830	5534474259	ban	8726316433	2026-05-02 15:41:19.887379
5645	5534474259	download	Solution — Corrigé Type TD N0	2026-05-01 06:28:01.351939
5646	5534474259	download	Solution — Corrigé Type TD N1	2026-05-01 06:28:06.379248
5649	5534474259	download	Serie 2	2026-05-01 06:28:17.63726
5651	5534474259	download	Serie 1	2026-05-01 06:28:22.972359
5681	5534474259	download	Solutions exercices linked listes	2026-05-01 12:43:19.489803
5703	5415358039	download	Cour 1	2026-05-01 15:57:24.405493
5724	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 10:05:43.74297
5751	5534474259	download	Serie 1	2026-05-02 13:29:38.449699
5752	5534474259	download	Serie 4	2026-05-02 13:29:51.025477
5788	5534474259	search	Algo 2	2026-05-02 14:55:18.382502
5789	5534474259	download	. — Chapter IV. Linked Lists (Session N°4)	2026-05-02 14:55:20.647946
5793	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 14:56:29.698893
5794	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 14:56:33.514393
5797	5534474259	download	Serie 3	2026-05-02 14:56:58.85607
5799	5534474259	download	Solution — Answers (Series 01)	2026-05-02 14:59:42.517641
5833	7178011134	search	Algebra 2	2026-05-02 15:43:29.501347
5648	5534474259	download	Serie 3	2026-05-01 06:28:14.551484
5652	5534474259	download	Solution — Corrigé Type TD N0	2026-05-01 06:28:24.865968
5682	5534474259	download	Exercices linked listes	2026-05-01 12:43:28.176675
5691	6729659968	download	Solution — Tutorial N3 Corrigé Type	2026-05-01 12:48:09.330606
5704	5534474259	download	Tp final	2026-05-01 17:16:55.38073
5725	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-02 10:05:47.58624
5753	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 13:39:08.209665
5790	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 14:55:24.775106
5795	5534474259	download	Serie 4	2026-05-02 14:56:46.438964
5796	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 14:56:51.257447
5655	5534474259	download	Solution serie 1	2026-05-01 08:23:58.601693
5683	5534474259	search	Solution serie 2	2026-05-01 12:43:41.757203
5705	5534474259	download	Chapter 3	2026-05-01 17:17:08.736575
5726	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 10:05:51.435432
5754	5534474259	download	Tp final	2026-05-02 13:39:18.720088
5755	5534474259	download	Serie 4	2026-05-02 13:39:30.882792
5798	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 14:57:05.840635
5656	5534474259	search	Tp final	2026-05-01 08:31:04.004206
5684	5534474259	download	Solution — Answers Series 02	2026-05-01 12:43:46.949776
5706	5534474259	download	Chapter 2	2026-05-01 17:17:16.126951
5707	5534474259	download	Chapter 4	2026-05-01 17:17:27.060809
5729	5534474259	search	Tp final	2026-05-02 11:22:35.891597
5756	5534474259	download	Serie 6	2026-05-02 14:00:35.869506
5763	5534474259	download	Serie 2	2026-05-02 14:00:52.51923
5764	5534474259	download	Serie 1	2026-05-02 14:00:56.636225
5765	5534474259	download	Serie 2	2026-05-02 14:00:59.823043
5800	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 15:03:44.869332
5802	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 15:03:57.771138
5840	5534474259	download	Eew	2026-05-02 16:58:39.099128
5657	5534474259	download	Tp final	2026-05-01 08:31:10.213597
5685	5534474259	search	Solution serie 2 algo 2	2026-05-01 12:43:58.538734
5692	6729659968	search	logic	2026-05-01 12:48:35.060146
5708	8726316433	search	مصادر	2026-05-01 17:36:24.606205
5730	5534474259	download	Tp final	2026-05-02 11:22:43.446039
5757	5534474259	download	Serie 4	2026-05-02 14:00:39.507594
5758	5534474259	download	Solution serie 1	2026-05-02 14:00:41.913182
5759	5534474259	download	Serie 2	2026-05-02 14:00:43.963439
5760	5534474259	download	Serie 3	2026-05-02 14:00:46.102832
5761	5534474259	download	Serie 1	2026-05-02 14:00:48.110251
5803	5534474259	download	Serie 3	2026-05-02 15:07:32.981238
5812	5534474259	download	Solution — Answers (Series 01)	2026-05-02 15:09:11.357093
5658	5534474259	download	Tp final	2026-05-01 08:33:58.23366
5687	6729659968	search	archi	2026-05-01 12:46:00.958047
5709	5556524947	download	Solution — Corrigé Type TD N0	2026-05-01 18:16:33.247536
5731	5534474259	download	Serie 3	2026-05-02 11:36:04.196551
5762	5534474259	download	Serie 4	2026-05-02 14:00:50.06143
5804	5534474259	download	Solution serie 1	2026-05-02 15:07:37.383561
5807	5534474259	download	Serie 3	2026-05-02 15:07:44.291154
5808	5534474259	ban	8773611512	2026-05-02 15:08:06.289495
5810	5534474259	download	Solution serie 1	2026-05-02 15:08:50.989566
5659	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-01 08:34:05.184831
5688	6729659968	download	Solution — Corrigé Type TD N0	2026-05-01 12:46:25.01542
5710	5556524947	download	Solution — Tutorial N3 Corrigé Type	2026-05-01 18:17:00.540488
5732	7596452439	search	Algo2	2026-05-02 11:39:28.237848
5735	5534474259	download	Cour 3	2026-05-02 12:11:26.03297
5766	5534474259	download	Seri1 — PW 6 corr	2026-05-02 14:07:40.662499
5805	5534474259	download	Serie 3	2026-05-02 15:07:39.797372
5806	5534474259	download	Solution serie 1	2026-05-02 15:07:42.111759
5822	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 15:18:10.035148
5660	5534474259	download	. — Chapter IV. Linked Lists (Session N°3)	2026-05-01 08:39:22.633589
5689	6729659968	download	Solution — Corrigé Type TD N1	2026-05-01 12:46:59.753182
5711	5556524947	download	Solution — Corrigé Type TD N1	2026-05-01 18:21:37.854878
5733	5534474259	download	Cour 3	2026-05-02 12:10:50.253339
5767	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 14:07:44.435981
5772	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 14:32:19.365622
5775	5534474259	download	Serie 2	2026-05-02 14:33:18.987178
5777	5534474259	download	Seri1 — PW 6 corr	2026-05-02 14:33:30.041368
5778	5534474259	download	Serie 4	2026-05-02 14:33:58.258954
5809	5534474259	download	Exam 1 algo 1	2026-05-02 15:08:43.545101
5811	5534474259	download	List of axioms and rules	2026-05-02 15:09:03.636957
5631	5104073058	download	Chapter 2 part 1	2026-04-30 20:58:00.31087
5661	5534474259	download	كتاب فمادة لجبر	2026-05-01 08:39:26.894992
5663	5534474259	download	Serie 1	2026-05-01 08:39:37.882663
5664	5534474259	download	. — Chapter IV. Linked Lists (Session N°2)	2026-05-01 08:39:42.288573
5665	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-01 08:39:51.425705
5666	5534474259	download	Book analyse 1	2026-05-01 08:40:04.40176
5667	5534474259	download	Seri1 — PW5 corrected	2026-05-01 08:40:24.637279
5668	5534474259	download	. — Chapter IV. Linked Lists (Session N°1)	2026-05-01 08:40:30.318885
5690	6729659968	download	Solution — Corrigé Type TD N2 (1)	2026-05-01 12:47:34.135284
5712	5556524947	download	Solution — Corrigé Type TD N2 (1)	2026-05-01 18:22:24.917066
5734	5534474259	download	Cour 4	2026-05-02 12:11:15.187619
5736	5534474259	download	Cour 1	2026-05-02 12:11:31.775296
5737	5534474259	download	Cour 2	2026-05-02 12:11:34.51754
5768	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 14:07:48.249292
5769	5534474259	download	كتاب فمادة لجبر	2026-05-02 14:08:00.310126
5813	5534474259	download	List of axioms and rules	2026-05-02 15:10:53.172156
5815	5534474259	download	Solution serie 1	2026-05-02 15:13:28.436271
5816	5534474259	download	Serie 4	2026-05-02 15:13:34.395229
7080	5534474259	download	. — Worksheet N°8 Common Continuous Probability Distributions	2026-05-09 19:14:29.300984
5985	5534474259	ban	7178011134	2026-05-02 19:45:08.248003
7081	5534474259	download	. — Worksheet N°3 Combinatorial Analysis	2026-05-09 19:14:32.654607
7155	5534474259	download	. — semio hg genitale	2026-05-10 12:16:17.175949
7161	5534474259	download	Serie 3	2026-05-10 12:17:39.315395
7162	5534474259	download	Serie 4	2026-05-10 12:17:47.527205
7211	5534474259	download	Serie 1	2026-05-11 06:42:53.733652
7273	7574632699	download	Cour 5	2026-05-12 17:20:34.521236
7274	7574632699	download	Serie 1	2026-05-12 17:21:00.195233
7275	7574632699	download	Serie 2	2026-05-12 17:21:05.285213
7356	6409821771	download	Chapter 5	2026-05-14 19:39:36.289559
7357	6409821771	download	Chapter 1	2026-05-14 19:39:50.939636
7358	6409821771	download	Chapter 2	2026-05-14 19:40:01.591531
7481	5534474259	download	Seri1 — PW5 corrected	2026-05-15 07:50:07.317031
7484	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-15 07:50:43.499584
7562	5534474259	download	Serie 3	2026-05-15 19:44:04.812482
7570	5534474259	download	Solution — Tutorial N3 Corrigé Type	2026-05-15 19:46:08.88088
7642	5415358039	download	Serie 4	2026-05-16 17:21:16.227668
7742	6250199428	download	Chapter 1	2026-05-16 20:02:53.281325
7843	5415358039	download	Chapter 2 part 2	2026-05-17 15:25:57.975766
7907	5534474259	download	Seri1 — PW5 corrected	2026-05-18 05:44:19.427551
7908	5534474259	download	Seri1 — PW04 Corrected	2026-05-18 05:44:21.777198
7982	5534474259	download	اختصارات الكيبورد	2026-05-19 01:33:45.773036
7983	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-19 01:33:55.625209
7984	5534474259	download	Serie 2 — Physics 2-Series 2-Part 3	2026-05-19 01:34:15.631471
5837	5534474259	upload	Eew	2026-05-02 16:57:31.899071
7083	5534474259	download	Serie 4	2026-05-09 19:29:30.101533
7156	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-10 12:16:27.145818
7157	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-10 12:16:36.533412
7213	5534474259	download	. — semio hg genitale	2026-05-11 06:56:39.138713
7214	5534474259	download	. — semio hg genitale	2026-05-11 06:56:44.140534
7276	7574632699	download	Serie 3	2026-05-12 17:21:12.25249
7360	6513362017	search	algo	2026-05-14 19:49:49.093492
7485	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-15 07:50:56.21655
7563	5534474259	download	Serie 4	2026-05-15 19:44:09.069183
7566	5534474259	download	Serie 4	2026-05-15 19:44:21.901643
7567	5534474259	download	. — IRA (4)	2026-05-15 19:44:33.956905
7568	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-15 19:45:08.451156
7569	5534474259	download	Serie 5	2026-05-15 19:45:22.484852
7643	5415358039	download	Serie 4	2026-05-16 17:24:01.175553
7743	6250199428	download	Chapter 2 part 1	2026-05-16 20:03:00.948567
7744	6250199428	download	Chapter 2 part 2	2026-05-16 20:03:09.25247
7745	6250199428	download	Chapter 3	2026-05-16 20:03:15.995459
7844	5415358039	download	Chapter 3	2026-05-17 15:33:20.628407
7909	5534474259	download	Serie 4	2026-05-18 06:39:12.116518
7911	5534474259	download	Serie 3	2026-05-18 06:39:27.223823
7985	5534474259	download	Chapter 2	2026-05-19 01:37:51.495356
7986	5534474259	download	Biochimiee	2026-05-19 01:39:02.518774
7084	5534474259	download	. — semio hg genitale	2026-05-09 19:29:35.484031
7159	5534474259	search	Serie logic	2026-05-10 12:16:56.035442
7160	5534474259	download	Serie 1	2026-05-10 12:17:32.224696
7215	5660577046	download	Serie 1	2026-05-11 09:39:31.980914
7277	5534474259	download	Solution serie 1	2026-05-12 17:35:30.989314
7278	5534474259	download	Serie 4	2026-05-12 17:35:34.552161
7361	6513362017	download	Exercices linked listes	2026-05-14 19:49:58.712894
7486	6564900193	download	. — Chapter IV. Linked Lists (Session N°2)	2026-05-15 07:59:32.308012
7571	5534474259	download	Serie 4	2026-05-15 19:51:11.489363
7644	5415358039	download	Analyse — 4_6001253344801201302	2026-05-16 17:24:31.636243
7645	5415358039	download	. — 20260429-091229	2026-05-16 17:24:56.36133
7746	6250199428	download	Chapter 2 part 2	2026-05-16 20:04:05.587596
7845	5415358039	download	Chapter 2 part 1	2026-05-17 16:14:05.211741
7910	5534474259	download	Serie 3	2026-05-18 06:39:19.1605
7912	5534474259	download	Serie 1	2026-05-18 06:39:33.558969
7987	5534474259	download	Resumè chapter 1/2	2026-05-19 01:40:23.045913
5838	5534474259	download	Eew	2026-05-02 16:58:06.166239
7085	5534474259	download	. — Worksheet N°5 Discrete Random Variables	2026-05-09 19:38:50.816951
7086	5534474259	download	. — Corrigé. Examen.anal2.mai2024	2026-05-09 19:42:42.145529
7093	5534474259	ban	5415358039	2026-05-09 19:44:09.507466
7095	5534474259	download	كتاب الشامل c	2026-05-09 19:49:38.113986
7163	6272548417	download	Serie 3	2026-05-10 14:33:31.546677
7165	6272548417	download	TD 3 solution	2026-05-10 14:35:49.863075
7216	8192906362	download	. — Corrigé. Examen.anal2.mai2024	2026-05-11 14:34:20.745755
7279	5415358039	download	Serie 2	2026-05-12 17:36:04.65872
7362	6513362017	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-14 19:50:13.133119
7487	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 08:11:29.50686
7572	5534474259	download	Serie 3	2026-05-15 19:56:13.785635
7574	5534474259	download	Serie 4	2026-05-15 19:56:39.704781
7576	5534474259	download	Seri1 — PW5 corrected	2026-05-15 19:57:08.167253
7577	5534474259	download	. — semio hg genitale	2026-05-15 19:57:13.637446
7646	5415358039	download	Serie 5	2026-05-16 17:29:57.229578
7747	6250199428	download	Chapter 3	2026-05-16 20:04:11.601752
7846	5415358039	download	Chapter 2 part 2	2026-05-17 16:14:46.762895
7913	5415358039	download	Chapter 4	2026-05-18 07:05:41.229782
7988	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-19 01:42:16.268002
7087	5534474259	download	. — تاست	2026-05-09 19:42:48.038156
7089	5534474259	download	Td developpemment limitè	2026-05-09 19:42:54.649766
7090	5534474259	download	Td developpemment limite	2026-05-09 19:42:57.957183
7164	6272548417	search	Solution TD logic	2026-05-10 14:35:05.363048
7217	5534474259	download	. — semio hg genitale	2026-05-11 16:48:22.961906
7224	5534474259	download	Chapter 1	2026-05-11 16:49:11.430823
7280	5589657070	search	Ai	2026-05-12 17:39:38.562295
7363	6513362017	download	Solutions exercices linked listes	2026-05-14 19:51:52.826638
7488	5534474259	download	. — semio hg genitale	2026-05-15 08:11:33.142386
7573	5534474259	download	Serie 3	2026-05-15 19:56:27.626368
7578	5534474259	download	. — semio hg genitale	2026-05-15 19:57:22.276125
7579	5415358039	download	Serie 3	2026-05-15 20:14:18.965
7647	5415358039	download	Serie 3	2026-05-16 17:32:51.251373
7748	6250199428	download	Formulaire primitives	2026-05-16 20:04:18.41923
7749	6250199428	download	Chapter 4	2026-05-16 20:05:02.69982
7847	5534474259	download	Exam 2026	2026-05-17 16:23:06.618371
7914	5534474259	download	. — semio gyneco 2	2026-05-18 07:39:59.228537
7989	5534474259	download	Os — Chapter 7	2026-05-19 01:48:57.915302
7990	5534474259	download	Os — Chapter 7	2026-05-19 01:49:15.331092
7088	5534474259	download	Td developpemment limite	2026-05-09 19:42:51.185222
7091	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-09 19:43:47.482927
7096	5534474259	download	كتاب جبر 2	2026-05-09 19:49:41.61691
7166	7025363896	search	Info 2	2026-05-10 17:07:00.879105
7218	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-11 16:48:27.236536
7221	5534474259	download	Chapter 2	2026-05-11 16:48:57.51034
7281	5512941168	download	Teste 1	2026-05-12 22:59:23.405726
7364	5415358039	download	Chapter 1	2026-05-14 19:56:55.581862
7489	5534474259	download	. — semio hg genitale	2026-05-15 08:11:38.121262
7575	5534474259	download	. — IRA (4)	2026-05-15 19:56:56.405295
7648	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-16 18:15:49.899849
7750	5534474259	download	Chapter 5	2026-05-16 21:55:53.968984
7848	5534474259	download	Solution serie 3	2026-05-17 16:28:22.88466
7915	5534474259	download	. — semio hg genitale	2026-05-18 07:40:05.459117
7991	5534474259	download	. — semio gyneco 2	2026-05-19 01:51:52.457689
5839	5534474259	search	Eew	2026-05-02 16:58:27.775632
7092	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-09 19:43:51.307418
7167	8726316433	download	Serie 5	2026-05-10 18:37:52.888786
7219	5534474259	download	Serie 4	2026-05-11 16:48:38.634105
7220	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-11 16:48:47.221591
7282	5534474259	download	Cour 1	2026-05-12 23:05:28.315005
7365	6564900193	download	Chapter 2	2026-05-14 20:31:23.079329
7366	6564900193	download	Chapter 3	2026-05-14 21:02:07.182587
7490	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 08:11:42.959403
7491	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-15 08:11:55.10737
7580	5534474259	download	Serie 5	2026-05-15 21:17:04.20602
7585	5534474259	download	. — semio hg genitale	2026-05-15 21:17:43.157176
7588	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-15 21:18:03.827467
7649	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-16 18:15:52.434205
7652	5534474259	download	. — Cours de Sémiologie Endocrinienne	2026-05-16 18:17:00.987401
7751	5534474259	download	Serie 3	2026-05-16 23:14:10.023817
7849	2013244058	download	Chapter 1	2026-05-17 17:52:36.488172
7850	2013244058	download	Chapter 2 part 1	2026-05-17 17:52:46.570853
7916	5415358039	download	Chapter 1	2026-05-18 07:43:12.635661
7992	5534474259	download	Seri1 — PW5 corrected	2026-05-19 01:52:25.660214
7094	5534474259	download	كتب الجبر — book-exos (1)	2026-05-09 19:49:34.87244
7098	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-09 19:49:52.116943
7168	5534474259	download	. — IRA (4)	2026-05-10 19:56:31.920398
7222	5534474259	download	Chapter 3	2026-05-11 16:49:01.633375
7223	5534474259	download	Chapter 2	2026-05-11 16:49:06.583675
7283	5534474259	download	Cour 2	2026-05-12 23:05:32.708973
7284	5534474259	download	Cour 3	2026-05-12 23:05:35.808421
7285	5534474259	download	Cour 4	2026-05-12 23:05:57.544997
7367	5415358039	download	Chapter 2	2026-05-14 22:32:38.575976
7492	5534474259	download	. — semio hg genitale	2026-05-15 08:14:39.558614
7581	5534474259	download	Serie 4	2026-05-15 21:17:08.077763
7582	5534474259	download	Serie 4	2026-05-15 21:17:17.231871
7584	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 21:17:38.117335
7650	5534474259	download	. — semio gyneco 2	2026-05-16 18:15:56.259741
7752	5534474259	download	. — semio gyneco 2	2026-05-16 23:23:57.788037
7851	2013244058	download	Chapter 2 part 2	2026-05-17 17:52:52.024406
7852	2013244058	download	Chapter 3	2026-05-17 17:52:56.878816
7854	2013244058	download	Chapter 4	2026-05-17 17:53:38.22478
7917	5415358039	download	Serie 1	2026-05-18 07:43:50.538846
7993	5534474259	download	Seri1 — PW04 Corrected	2026-05-19 01:52:29.804955
7097	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-09 19:49:45.705901
7099	5534474259	download	Chaine for logic	2026-05-09 19:53:36.329181
7169	5534474259	ban	8726316433	2026-05-10 20:46:04.588042
7225	5534474259	download	. — semio gyneco 2	2026-05-11 16:52:40.154291
7286	5534474259	download	. — semio gyneco 2	2026-05-12 23:45:18.682117
7287	5534474259	download	. — semio hg genitale	2026-05-12 23:45:24.123524
7289	5534474259	download	Serie 2	2026-05-12 23:52:30.020048
7290	5534474259	download	Serie 3	2026-05-12 23:52:34.077102
7368	5415358039	download	Chapter 1	2026-05-14 22:36:01.402207
7493	5534474259	download	Chapter 3	2026-05-15 08:17:16.360625
7583	5534474259	download	. — Worksheet N°6 Common Discrete Probability	2026-05-15 21:17:29.925447
7586	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 21:17:45.73232
7651	5534474259	download	. — semio gyneco 2	2026-05-16 18:16:58.578424
7753	5534474259	download	. — semio gyneco 2	2026-05-16 23:26:33.207299
7853	2013244058	download	Formulaire primitives	2026-05-17 17:53:21.266542
7918	5415358039	download	Solution serie 1	2026-05-18 07:44:19.183343
7994	5534474259	download	Seri1 — PW5 corrected	2026-05-19 01:52:36.929213
7100	5534474259	download	Chapter 3	2026-05-09 20:00:42.00382
7170	5534474259	download	Serie 3	2026-05-10 20:54:50.901892
7171	5534474259	download	Chapter 1	2026-05-10 20:54:56.764293
7173	5534474259	download	كتاب جبر	2026-05-10 20:55:20.312782
7288	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-12 23:45:30.531436
7369	5534474259	download	Serie 3	2026-05-15 01:50:22.297922
7494	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-15 08:17:30.179062
7587	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-15 21:17:54.424576
7653	5534474259	download	Chapter 3	2026-05-16 18:21:46.347815
7654	5534474259	download	Os — Chapter 7	2026-05-16 18:21:57.144914
7655	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 18:22:02.678228
7754	6530364511	download	Serie 1 partie 1	2026-05-16 23:30:21.288135
7855	5534474259	download	Formulaire primitives	2026-05-17 18:32:03.980781
7919	5534474259	download	Seri1 — PW5 corrected	2026-05-18 08:11:01.453982
7995	5534474259	download	Seri1 — PW5 corrected	2026-05-19 02:42:34.698093
5834	5534474259	download	Serie 4	2026-05-02 16:33:19.821618
5835	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 16:47:19.516379
5836	5534474259	download	Serie 4	2026-05-02 16:53:33.344871
5841	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 17:04:09.967311
5842	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 17:04:20.807376
5843	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 17:04:50.444107
5844	5534474259	download	Serie 6	2026-05-02 17:04:59.468664
5845	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 17:19:24.776875
5846	6217677522	download	نموذج ذكاء اصطناعي	2026-05-02 17:21:37.550524
5847	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 17:22:55.114375
5848	5534474259	download	Serie 4	2026-05-02 17:27:48.595694
5849	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 17:29:35.797226
5850	5534474259	download	Serie 4	2026-05-02 17:29:41.740294
5851	5534474259	download	Solution — Corrigé Type TD N1	2026-05-02 17:30:31.932501
5852	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:30:36.796897
5853	5534474259	download	Seri1 — PW 6 corr	2026-05-02 17:30:54.845265
5854	5534474259	download	Seri1 — PW5 corrected	2026-05-02 17:31:00.078615
5855	5534474259	download	Os — Chapter 1	2026-05-02 17:31:02.865862
5856	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 17:31:07.625041
5857	5534474259	download	Serie 6	2026-05-02 17:31:15.821146
5858	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 17:31:22.873365
5859	5534474259	download	Serie 3	2026-05-02 17:31:30.347121
6042	7596452439	upload	.	2026-05-02 21:29:22.218699
5860	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:31:34.984474
5862	5534474259	download	Serie 4	2026-05-02 17:31:48.424811
7101	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-09 20:00:50.897154
7106	5534474259	download	Serie 1	2026-05-09 20:06:38.637119
7115	5534474259	download	Serie 2 — series 2(1)	2026-05-09 20:07:39.525671
7172	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-10 20:55:07.040037
7291	5534474259	download	Solution — Answers Series 02	2026-05-12 23:54:17.549027
7370	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 01:56:40.73696
7371	5534474259	download	List of axioms and rules	2026-05-15 01:56:51.24848
7373	5534474259	download	. — semio gyneco 2	2026-05-15 01:57:28.244185
7374	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 01:57:31.654275
7375	5534474259	download	Serie 4	2026-05-15 01:57:42.76591
7376	5534474259	download	Serie 2	2026-05-15 01:57:56.298901
7495	5534474259	download	. — Worksheet N°5 Discrete Random Variables	2026-05-15 08:17:40.786165
7589	6409821771	download	Resumè chapter 1/2	2026-05-15 21:44:09.129888
7656	5534474259	download	Seri1 — PW 6 corr	2026-05-16 18:22:16.18187
7658	5534474259	download	. — semio hg genitale	2026-05-16 18:22:34.410472
7755	5534474259	download	Chapter 3	2026-05-16 23:43:34.3359
7920	5415358039	download	. — 20260411-163534	2026-05-18 08:12:09.405256
7996	5534474259	download	Solution serie 3	2026-05-19 02:44:11.73047
7997	5534474259	download	Serie 3	2026-05-19 02:44:24.730662
7998	5534474259	download	Serie 5	2026-05-19 02:44:46.215892
7999	5534474259	download	Serie 3	2026-05-19 02:44:58.518267
5861	5534474259	download	Serie 6	2026-05-02 17:31:42.482065
5863	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:33:32.30466
7102	5534474259	download	. — semio gyneco 2	2026-05-09 20:00:56.219629
7174	6530364511	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-10 21:02:39.296982
7292	5534474259	download	Solution — Answers Series 3	2026-05-12 23:54:29.975226
7372	5534474259	download	Seri1 — PW5 corrected	2026-05-15 01:57:23.046542
7496	5534474259	download	Solutions exercices linked listes	2026-05-15 09:02:53.789399
7590	5415358039	download	Exercices linked listes	2026-05-15 21:48:27.802177
7657	5534474259	download	Os — Chapter 7	2026-05-16 18:22:27.143074
7660	5534474259	download	أساسيات الإتصالات	2026-05-16 18:23:36.682504
7756	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 23:43:40.28913
7921	5415358039	download	Serie 4	2026-05-18 08:13:10.341967
8000	5534474259	download	Seri1 — PW 6 corr	2026-05-19 02:49:10.662735
5864	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 17:33:37.29292
5865	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:33:42.197886
5866	5534474259	search	Serie 2 algo 2	2026-05-02 17:33:49.564693
5873	5534474259	download	Serie 4	2026-05-02 17:34:28.811943
5875	5534474259	ban	6217677522	2026-05-02 17:43:24.578189
7103	5534474259	download	Chapter 1	2026-05-09 20:06:04.299752
7110	5534474259	download	Serie 6	2026-05-09 20:07:04.967198
7111	5534474259	search	serie 2 logic	2026-05-09 20:07:17.693646
7113	5534474259	download	Serie 2 — Physics 2-Series 2-Part 3	2026-05-09 20:07:31.88975
7175	5534474259	download	Os — Chapter 5 (1)	2026-05-10 21:07:24.20707
7293	5534474259	download	كتاب جبر 2	2026-05-13 05:34:15.933798
7377	5534474259	download	Seri1 — PW5 corrected	2026-05-15 01:58:09.125398
7497	8726316433	download	Chapter 1	2026-05-15 09:06:44.804051
7498	8726316433	download	Chapter 2	2026-05-15 09:06:53.833635
7500	8726316433	download	Chapter 4	2026-05-15 09:07:07.859533
7591	8319698469	download	Chapter 5	2026-05-15 22:00:35.292306
7659	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 18:23:21.480312
7662	5534474259	download	. — semio gyneco 2	2026-05-16 18:23:44.776516
7665	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 18:24:36.587615
7757	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 23:44:27.571841
7922	5415358039	download	Chapter 3	2026-05-18 08:13:26.852914
8001	5534474259	download	Os — Chapter 5 (1)	2026-05-19 06:33:33.877263
5867	5534474259	download	Serie 2	2026-05-02 17:33:58.910308
5868	5534474259	download	Serie 1	2026-05-02 17:34:03.811278
5869	5534474259	download	Serie 4	2026-05-02 17:34:06.486765
5870	5534474259	download	Serie 3	2026-05-02 17:34:10.090283
5871	5534474259	download	Solution serie 4	2026-05-02 17:34:12.536875
5872	5534474259	download	Serie 3	2026-05-02 17:34:17.015597
5874	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:43:18.79402
5876	5534474259	ban	6217677522	2026-05-02 17:43:32.758107
5877	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 17:46:53.003883
5878	5534474259	download	Serie 4	2026-05-02 17:47:34.527979
5879	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 17:47:39.423029
5880	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 17:47:44.914958
5881	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:47:56.690553
5882	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 17:48:04.602415
5883	5534474259	download	Serie 4	2026-05-02 17:48:10.713282
5884	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 17:48:18.116644
5885	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 17:48:23.016199
5886	5534474259	download	. — Chapter IV. Linked Lists (Session N°4)	2026-05-02 17:48:29.12394
5887	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 17:48:38.476275
5888	5534474259	download	Solutions exercices linked listes	2026-05-02 17:48:42.679757
5889	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 17:48:48.465128
5890	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:48:54.341724
5891	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 17:48:59.410332
5892	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 17:49:05.018865
5893	5534474259	download	Serie 4	2026-05-02 17:49:11.31022
5894	5534474259	download	. — Chapter IV. Linked Lists (Session N°3)	2026-05-02 17:49:16.563382
5895	5534474259	download	Serie 3	2026-05-02 18:04:48.166499
5896	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:04:54.737927
5897	5534474259	download	Serie 3	2026-05-02 18:07:35.943521
5898	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 18:07:38.209232
5899	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:08:14.481915
5900	5534474259	download	Serie 3	2026-05-02 18:08:19.201083
5901	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-02 18:08:27.789004
5902	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 18:09:01.865483
5903	5534474259	download	Exercices linked listes	2026-05-02 18:09:06.342191
5904	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 18:09:08.865563
5905	5534474259	maintenance	ON	2026-05-02 18:09:47.483894
5906	5534474259	maintenance	OFF	2026-05-02 18:09:48.936979
5907	5534474259	maintenance	ON	2026-05-02 18:09:52.080505
5908	5534474259	maintenance	OFF	2026-05-02 18:09:53.2402
5909	5534474259	maintenance	ON	2026-05-02 18:09:54.365914
5910	5534474259	maintenance	OFF	2026-05-02 18:10:23.239124
5911	5534474259	maintenance	ON	2026-05-02 18:10:34.684449
5912	5534474259	maintenance	OFF	2026-05-02 18:11:10.372368
5913	5534474259	maintenance	ON	2026-05-02 18:11:15.078562
5914	5534474259	maintenance	OFF	2026-05-02 18:11:27.288041
5915	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 18:14:00.163519
5916	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 18:14:04.856226
5917	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 18:14:09.527723
5918	5534474259	download	Solution — Corrigé Type TD N1	2026-05-02 18:14:14.038823
5919	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 18:14:18.541362
5920	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 18:14:37.281894
5921	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:21:53.737206
5922	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:22:20.751816
5923	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-02 18:22:28.483046
5924	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 18:22:38.921433
5925	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:24:19.747525
5926	5534474259	download	Exercices linked listes	2026-05-02 18:24:24.555752
5927	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:24:28.985132
5928	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 18:24:34.169587
5929	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 18:32:46.992346
5930	5534474259	download	Serie 4	2026-05-02 18:33:04.660294
5931	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 18:33:11.690115
5932	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:33:16.297375
5933	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:33:30.12117
5934	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:44:53.263925
5935	5534474259	download	Solution — Corrigé Type TD N1	2026-05-02 18:44:59.069821
5936	5534474259	download	Skip — 01- Introduction à la Parasitologie 2026 Dr Fellahi A	2026-05-02 18:45:12.423975
5937	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 18:45:19.181813
5938	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 18:45:23.52541
5939	5534474259	download	Seri1 — PW 6 corr	2026-05-02 18:45:36.820571
5940	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 18:46:21.486893
5941	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 18:46:26.57029
5942	5534474259	download	Serie 3	2026-05-02 18:46:40.498693
5943	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 18:46:46.566259
5944	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 18:46:59.351242
5945	5534474259	download	Serie 6	2026-05-02 19:04:13.8631
5946	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-02 19:04:21.503604
5947	5534474259	download	. — Serie N°3, Linked Lists (2024-2025)	2026-05-02 19:04:26.021537
5948	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 19:04:30.452865
5949	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 19:04:35.111036
5950	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 19:04:39.752145
6044	7596452439	download	.	2026-05-02 21:32:02.251631
5951	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 19:04:42.868897
7104	5534474259	download	Chapter 2	2026-05-09 20:06:08.628936
7105	5534474259	download	Chapter 3	2026-05-09 20:06:18.112718
7107	5534474259	download	Serie 3	2026-05-09 20:06:46.802214
7108	5534474259	download	Serie 4	2026-05-09 20:06:52.565172
7109	5534474259	download	Serie 5	2026-05-09 20:06:58.797649
7114	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-09 20:07:34.548069
7116	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-09 20:07:42.111182
7117	5534474259	download	Serie 2 — Physics 2-Series 2-Part 3	2026-05-09 20:07:48.175538
7122	5534474259	download	Serie 6	2026-05-09 20:44:27.97637
7125	5534474259	download	Chapter 3 — polycopié Maths2. ZENKOUFI Lilia	2026-05-09 20:44:52.551352
7126	5534474259	download	Chapter 2	2026-05-09 20:44:55.505915
7176	5534474259	download	Serie 4	2026-05-10 21:08:52.371964
7294	5534474259	download	Cour 4	2026-05-13 07:30:40.645858
7378	5534474259	download	Serie 3	2026-05-15 02:01:39.71979
7379	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 02:01:46.277834
7380	5534474259	download	Seri1 — PW5 corrected	2026-05-15 02:01:56.064278
7499	8726316433	download	Chapter 3	2026-05-15 09:06:59.276228
7501	8726316433	download	Chapter 5	2026-05-15 09:07:21.281345
7592	8319698469	download	Chapter 4	2026-05-15 22:00:44.47951
7661	5534474259	download	أفضل طريق لتعلم البرمجة	2026-05-16 18:23:40.880992
7663	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-16 18:23:51.129609
7758	5534474259	download	. — semio hg genitale	2026-05-16 23:44:34.445439
7923	5415358039	download	Formulaire primitives	2026-05-18 08:13:48.112268
8002	5534474259	download	Exam crr 2024/205	2026-05-19 06:33:46.007578
5952	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 19:04:47.413726
7112	5534474259	download	Serie 2 — series 2(1)	2026-05-09 20:07:27.075566
7177	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-10 21:16:13.020453
7295	5534474259	download	Cour 3	2026-05-13 07:30:43.518357
7381	5534474259	download	Serie 4	2026-05-15 02:28:37.673943
7382	5534474259	search	Exam	2026-05-15 02:28:44.768336
7385	5534474259	download	. — Worksheet N°2 Simple Linear Regression	2026-05-15 02:29:47.974914
7502	6250199428	download	Quiz B	2026-05-15 10:31:36.104666
7504	6250199428	download	Chapter 4	2026-05-15 10:31:56.455847
7505	6250199428	download	Chapter 3	2026-05-15 10:32:01.0933
7593	5718477026	download	Serie 3	2026-05-15 23:23:09.736873
7664	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-16 18:24:26.290538
7759	5534474259	download	Toxicology — Frank_C_Lu,_Sam_Kacew_Lu's_Basic	2026-05-17 00:04:12.703304
7764	5104073058	download	Techexp cour	2026-05-17 00:05:22.675512
7765	5104073058	download	'	2026-05-17 00:05:32.169755
7767	5303731176	download	Chapter 1	2026-05-17 00:06:40.089414
7924	5415358039	download	Chapter 3	2026-05-18 08:15:35.606163
8003	5534474259	download	Seri1 — PW5 corrected	2026-05-19 06:46:47.380405
8004	5534474259	download	Serie 5	2026-05-19 06:46:54.409726
8006	5534474259	download	Serie 3	2026-05-19 06:47:04.356633
5953	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 19:04:51.800999
5954	7574632699	download	Serie 1	2026-05-02 19:15:56.959487
5955	7574632699	download	Serie 2	2026-05-02 19:16:08.298854
5956	7574632699	download	Serie 3	2026-05-02 19:16:13.973621
5957	7574632699	download	Solution — Answers (Series 01)	2026-05-02 19:17:33.875231
5958	7574632699	download	Serie 2	2026-05-02 19:17:45.793482
5959	7574632699	download	Solution — Answers Series 02	2026-05-02 19:19:14.967446
5960	5534474259	add_admin	ID: 8678910305	2026-05-02 19:25:22.713238
5961	5534474259	download	Serie 3	2026-05-02 19:27:20.100611
5962	7574632699	download	Chapter 1	2026-05-02 19:35:54.862892
5963	7574632699	download	Chapter 2 part 1	2026-05-02 19:36:03.728725
5964	7574632699	download	Chapter 2 part 2	2026-05-02 19:36:08.380019
5965	7574632699	download	Chapter 3	2026-05-02 19:36:13.319472
5966	7574632699	download	Formulaire primitives	2026-05-02 19:36:29.020604
5967	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 19:36:52.194733
5968	5534474259	download	Correction serie 2	2026-05-02 19:36:56.78468
5969	5534474259	download	Serie 3	2026-05-02 19:36:59.315966
5970	5534474259	download	Serie 1	2026-05-02 19:37:01.688069
5971	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 19:37:05.738537
5972	5534474259	download	Serie 6	2026-05-02 19:37:10.99438
5973	5534474259	download	. — Serie N°3, Linked Lists (2024-2025)	2026-05-02 19:37:51.938571
5974	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 19:37:55.772662
5975	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 19:38:16.959705
5976	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 19:38:23.793832
5977	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 19:39:24.976851
5978	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 19:40:09.518841
5979	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 19:40:18.209134
5980	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 19:42:00.348757
5981	5534474259	download	Serie 3	2026-05-02 19:43:22.821263
5982	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 19:43:27.623538
5983	5534474259	download	Serie 6	2026-05-02 19:43:58.780949
5984	5534474259	download	Serie 6	2026-05-02 19:44:39.625962
5986	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 19:45:25.373987
5987	5534474259	download	Chapter 3	2026-05-02 19:45:32.788373
5988	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 19:50:38.288664
5989	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 19:50:43.56583
5990	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 19:51:10.079711
5991	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 19:51:14.994541
5992	5534474259	download	. — Chapter IV. Linked Lists (Session N°4)	2026-05-02 19:51:23.613151
5993	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 19:51:29.638043
5994	5534474259	download	Chapter 3	2026-05-02 19:52:11.228778
5995	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 19:52:21.190136
5996	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 19:52:47.076299
5997	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 19:52:52.70941
5998	5534474259	download	. — Chapter IV. Linked Lists (Session N°4)	2026-05-02 19:52:58.963459
5999	5534474259	download	List of axioms and rules	2026-05-02 19:53:16.838067
6000	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 19:53:24.034347
6001	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 19:57:06.779081
6002	5534474259	download	Serie 4	2026-05-02 19:57:16.926476
6003	5534474259	download	Serie 4	2026-05-02 20:06:18.821128
6004	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 20:06:35.376641
6005	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 20:06:59.110813
6006	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 20:07:03.436114
6007	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 20:07:05.936483
6008	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 20:07:09.697331
6009	5534474259	download	Exercices linked listes	2026-05-02 20:07:12.798721
6010	5534474259	download	Serie 3	2026-05-02 20:07:25.64178
6011	5534474259	download	Serie 4	2026-05-02 20:10:11.463511
6012	5534474259	download	Serie 4	2026-05-02 20:10:45.764339
6013	5534474259	download	Serie 4	2026-05-02 20:10:58.809314
6014	5534474259	download	Serie 4	2026-05-02 20:11:34.916517
6015	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 20:11:40.398982
6016	5534474259	download	Exam 1 algo 1	2026-05-02 20:11:57.855283
6017	5534474259	download	Exam 1 algo 1	2026-05-02 20:12:21.885281
6018	5534474259	download	Serie 6	2026-05-02 20:13:47.792176
6019	5534474259	download	رزنامة	2026-05-02 20:13:53.41682
6020	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 20:13:59.886254
6021	5534474259	download	Solutions exercices linked listes	2026-05-02 20:14:02.879445
6022	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 20:21:40.224877
6023	5534474259	download	Exercices linked listes	2026-05-02 20:21:44.518492
6024	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 20:42:18.293113
6025	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 20:42:27.361551
6026	5534474259	download	. — Chapter IV. Linked Lists (Session N°4)	2026-05-02 20:42:32.009249
6027	5534474259	download	Serie 6	2026-05-02 20:42:38.445929
6028	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 20:42:46.174297
6029	5534474259	download	Solutions exercices linked listes	2026-05-02 20:42:48.766477
6030	5534474259	download	Serie 4	2026-05-02 20:43:03.472458
6031	5534474259	download	Seri1 — PW 6 corr	2026-05-02 20:43:52.900817
6032	5534474259	download	Os — Chapter 1	2026-05-02 20:43:55.685303
6033	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 20:44:11.454228
6034	5534474259	add_admin	ID: 7596452439	2026-05-02 20:56:29.427006
6035	5534474259	download	Exercices linked listes	2026-05-02 21:00:48.07252
6036	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-02 21:00:55.100807
6037	5534474259	download	Exercices linked listes	2026-05-02 21:04:13.645154
6038	5534474259	download	Solution — Corrigé Type TD N0	2026-05-02 21:04:23.513457
6039	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 21:07:04.899036
6040	5534474259	download	Chapter 2	2026-05-02 21:07:10.335502
6041	5534474259	download	Chapter 2	2026-05-02 21:07:16.752464
6043	7596452439	search	Physics	2026-05-02 21:31:51.290492
7118	5534474259	download	Serie 2	2026-05-09 20:08:06.887002
7127	5534474259	download	Chapter 1	2026-05-09 20:44:58.11867
7178	6530364511	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-10 21:26:31.218266
7179	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-10 21:26:54.383524
7180	5534474259	download	. — Sémiologie-app-urinaire-examen-clinique (2)	2026-05-10 21:27:07.130302
7296	5534474259	download	Cour 5	2026-05-13 07:30:46.481052
7383	5534474259	download	Seri1 — PW5 corrected	2026-05-15 02:28:51.642674
7384	5534474259	download	Serie 4	2026-05-15 02:29:01.977783
7503	6250199428	download	Chapter 5	2026-05-15 10:31:46.038729
7594	5718477026	download	Solution serie 4(5/7)	2026-05-15 23:26:05.784935
7596	5718477026	download	Solution serie 4	2026-05-15 23:26:55.195318
7666	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-16 18:32:00.112694
7760	5534474259	download	Toxicology — Phillip_L_Williams,_Robert_C_James	2026-05-17 00:04:19.287711
7761	5534474259	download	. — semio gyneco 2	2026-05-17 00:04:31.712276
7925	5415358039	download	Serie 4	2026-05-18 08:16:01.717954
8005	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-19 06:47:00.459368
6045	7596452439	upload	Serie 1 partie 1	2026-05-02 21:36:44.709196
7119	5534474259	ban	8519140108	2026-05-09 20:43:40.892642
7120	5534474259	ban	6129341635	2026-05-09 20:43:55.26657
7124	5534474259	download	Chapter 2	2026-05-09 20:44:46.585054
7128	5534474259	download	Serie 2	2026-05-09 20:45:00.935781
7181	6530364511	download	Chapter 1	2026-05-10 21:55:49.386488
7297	5660577046	download	Serie 2 — Phys2-Series2-part4	2026-05-13 11:13:33.252024
7386	5534474259	download	Seri1 — PW 6 corr	2026-05-15 02:30:12.714901
7387	5534474259	download	Seri1 — PW5 corrected	2026-05-15 02:30:20.035115
7388	5534474259	download	. — semio gyneco 2	2026-05-15 02:30:27.00758
7506	6091576543	download	Chapter 1	2026-05-15 10:41:59.714089
7595	5718477026	download	Serie 1	2026-05-15 23:26:15.772504
7667	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-16 18:32:42.326631
7671	5534474259	download	Serie 4	2026-05-16 18:33:24.564047
7762	5534474259	download	Serie 3	2026-05-17 00:04:44.044144
7926	5415358039	download	. — 20260411-163534	2026-05-18 08:16:34.631447
8007	5534474259	download	Book analyse 1	2026-05-19 06:58:54.399541
6046	7596452439	upload	.	2026-05-02 21:37:21.523658
6047	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 21:54:21.706737
6048	5534474259	download	Serie 4	2026-05-02 21:54:27.318004
6049	5534474259	download	Solution — Tutorial N3 Corrigé Type	2026-05-02 21:54:33.908472
6050	5534474259	download	Serie 4	2026-05-02 21:54:55.720702
6051	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-02 21:55:07.713039
6052	5534474259	download	Serie 3	2026-05-02 21:56:39.358792
6053	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-02 21:56:51.236255
6054	5534474259	download	Chapter 4	2026-05-02 21:57:18.520756
6055	5534474259	download	Chapter 3	2026-05-02 21:57:23.565671
6056	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-02 21:57:32.413018
6057	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 21:57:36.816597
6058	5534474259	download	Serie 4	2026-05-02 21:57:49.176381
6059	5534474259	download	Chapter 4	2026-05-02 21:57:53.374584
6060	5534474259	download	Serie 3	2026-05-02 21:58:05.782975
6061	5534474259	download	Chapter 3	2026-05-02 21:58:18.575636
6062	5534474259	download	Chapter 4	2026-05-02 21:58:26.016618
6063	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-02 21:58:36.885672
6064	5534474259	download	Chapter 3	2026-05-02 21:58:49.086635
6065	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 21:59:22.272609
6066	5534474259	download	Serie 3	2026-05-02 21:59:33.398212
6067	5534474259	download	Serie 2	2026-05-02 21:59:35.794129
6068	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 21:59:43.536003
6069	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-02 22:00:00.533524
6070	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-02 22:00:44.484616
6071	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:00:56.734611
6072	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:02:12.969098
6073	5534474259	download	Chapter 5	2026-05-02 22:02:17.216191
6074	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:03:58.995275
6075	5534474259	download	Chapter 5	2026-05-02 22:04:03.831835
6076	5534474259	download	Serie 4	2026-05-02 22:04:10.367296
6077	5534474259	download	Solution serie 1	2026-05-02 22:04:12.835976
6078	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 22:04:18.552879
6079	5534474259	download	Serie 2	2026-05-02 22:04:51.444323
6080	5534474259	download	Solution serie 1	2026-05-02 22:04:54.514881
6081	5534474259	download	Chapter 5	2026-05-02 22:05:02.826171
6082	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-02 22:05:08.807722
6083	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:06:13.407745
6084	5534474259	download	Chapter 5	2026-05-02 22:06:21.320115
6085	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:06:27.44597
6086	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:06:35.149151
6087	5534474259	download	Chapter 5	2026-05-02 22:06:41.785938
6088	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-02 22:06:47.34792
6089	5534474259	download	Chapter 5	2026-05-02 22:06:53.217746
6090	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-02 22:08:06.549281
6091	5534474259	download	Chapter 5	2026-05-02 22:09:07.257624
6092	5534474259	download	Serie 3	2026-05-02 22:09:19.92832
6093	5534474259	download	Chapter 5	2026-05-02 22:09:24.52403
6094	5534474259	download	Serie 2	2026-05-02 22:14:32.129736
6095	5534474259	download	Solution serie 3	2026-05-02 22:15:30.677018
6096	5534474259	download	Chapter 5	2026-05-02 22:15:35.695363
6097	5534474259	download	Serie 2 — series 2(1)	2026-05-02 22:15:59.873031
6098	5534474259	download	Chapter 3	2026-05-02 22:16:04.65413
6099	7596452439	upload	.	2026-05-02 22:16:07.805868
6100	5534474259	download	Chapter 5	2026-05-02 22:16:09.23804
6101	5534474259	download	Chapter 4	2026-05-02 22:16:13.639147
6102	5534474259	download	Chapter 5	2026-05-02 22:16:18.661335
6103	5534474259	download	Chapter 1	2026-05-02 22:16:27.217772
6104	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:16:33.952287
6105	5534474259	download	Chapter 5	2026-05-02 22:16:39.293496
6106	5534474259	download	Chapter 1	2026-05-02 22:16:43.355018
6107	5534474259	download	Chapter 5	2026-05-02 22:16:46.274878
6108	5534474259	download	Chapter 1	2026-05-02 22:16:49.496173
6109	5534474259	download	Chapter 5	2026-05-02 22:16:52.416807
6110	5534474259	download	Chapter 3	2026-05-02 22:16:54.901991
6111	5534474259	download	Chapter 4	2026-05-02 22:16:57.862909
6112	5534474259	download	Chapter 1	2026-05-02 22:17:02.662803
6113	5534474259	download	Chapter 3	2026-05-02 22:17:05.216434
6114	5534474259	download	Chapter 2	2026-05-02 22:17:13.011114
6115	5415358039	download	Serie 3	2026-05-02 22:17:44.759345
6116	7596452439	upload	Electrostatic	2026-05-02 22:17:46.564832
6117	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:22:34.76765
6118	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:26:43.734902
6119	5534474259	download	Chapter 1	2026-05-02 22:26:49.170267
6120	5534474259	download	.	2026-05-02 22:27:19.883211
6121	5534474259	download	Serie 1 partie 2	2026-05-02 22:28:13.847691
6122	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-02 22:28:54.747579
6123	5534474259	download	Serie 1 partie 1	2026-05-02 22:28:59.188514
6124	5534474259	download	Serie 1 partie 2	2026-05-02 22:29:05.784307
6125	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:29:10.307859
6126	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:29:18.833053
6127	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:40:11.605354
6128	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:40:20.17891
6129	5534474259	download	Solution serie 1	2026-05-02 22:40:33.281122
6130	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:40:39.283924
6131	5534474259	download	Serie 4	2026-05-02 22:40:59.668139
6132	5534474259	download	Seri1 — PW 6 corr	2026-05-02 22:41:32.64138
6135	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:41:48.307011
6136	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:41:52.07912
7121	5534474259	download	Serie 5	2026-05-09 20:44:23.975344
7123	5534474259	download	Chapter 3 — chapter_3_matrices	2026-05-09 20:44:43.219836
7182	6530364511	download	Chapter 2	2026-05-10 22:01:52.51502
7298	5660577046	download	Serie 1 partie 1	2026-05-13 11:13:44.58434
7389	5534474259	download	Serie 2	2026-05-15 02:30:33.321088
7507	6091576543	download	Chapter 2	2026-05-15 10:42:04.857939
7597	5718477026	download	Solution serie 4(5/7)	2026-05-15 23:27:03.824235
7668	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 18:32:53.200062
7669	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-16 18:33:00.40793
7763	5104073058	download	. — 30K	2026-05-17 00:05:17.157417
7927	8235799915	download	Resumè chapter 1/2	2026-05-18 08:46:52.035396
8008	5534474259	search	Serie 2 algo	2026-05-19 09:05:30.354082
6133	5534474259	download	Seri1 — PW 6 corr	2026-05-02 22:41:39.781704
6137	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:41:56.255404
6140	5534474259	download	Electrostatic	2026-05-02 22:44:14.712356
6143	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:44:52.663137
6146	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-02 22:45:37.521869
6148	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:45:58.320266
6149	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:46:01.07376
7129	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-09 20:54:06.718763
7183	6530364511	download	Chapter 3	2026-05-10 22:06:11.583005
7299	5415358039	download	Chapter 2	2026-05-13 12:26:21.35436
7390	5534474259	download	. — semio gyneco 2	2026-05-15 02:43:09.680437
7392	5534474259	download	. — semio gyneco 2	2026-05-15 02:43:23.641629
7393	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 02:43:28.046136
7508	6091576543	download	Chapter 3	2026-05-15 10:42:12.238573
7598	6513362017	search	Algo	2026-05-16 00:16:26.688444
7670	5534474259	download	Seri1 — PW 6 corr	2026-05-16 18:33:11.845116
7766	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-17 00:05:49.205637
7928	5534474259	download	Serie 4	2026-05-18 08:50:37.950565
8009	5534474259	ban	8187764784	2026-05-20 07:50:52.05658
6134	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:41:44.716851
6139	5534474259	download	.	2026-05-02 22:43:00.958401
6147	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-02 22:45:40.828991
7130	7518863743	search	electrophorése des acides nucléiques	2026-05-09 21:53:05.85423
7184	5534474259	download	Serie 2	2026-05-10 22:11:28.391071
7300	5415358039	download	Serie 4	2026-05-13 12:27:02.73307
7391	5534474259	download	Seri1 — PW5 corrected	2026-05-15 02:43:17.306551
7509	6091576543	download	Chapter 4	2026-05-15 10:42:18.258906
7510	6091576543	download	Chapter 5	2026-05-15 10:42:23.799525
7599	5415358039	download	Serie 3	2026-05-16 00:17:53.892854
7672	5534474259	download	. — semio gyneco 2	2026-05-16 18:33:28.296722
7768	5303731176	download	Chapter 2 part 1	2026-05-17 00:06:46.657322
7929	5534474259	download	Seri2	2026-05-18 08:56:17.433127
6138	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:42:06.844734
6141	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-02 22:44:45.560531
6142	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:44:49.865045
6144	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:45:30.75327
6145	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:45:33.853317
6150	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:47:26.383988
6151	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:47:31.87637
6152	5534474259	download	Serie 3	2026-05-02 22:47:42.238997
6153	5534474259	download	Solution serie 1	2026-05-02 22:47:44.933245
6154	5534474259	download	Serie 4	2026-05-02 22:47:48.852806
6155	5534474259	download	Serie 1	2026-05-02 22:47:51.335518
6156	5534474259	download	Serie 2	2026-05-02 22:47:53.997609
6157	5534474259	download	Serie 1	2026-05-02 22:47:56.762558
6158	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:50:16.193705
6159	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:50:21.720048
6160	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:50:24.606543
6161	5534474259	download	Coordinates system	2026-05-02 22:51:58.044497
6162	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:52:02.3548
6163	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-02 22:54:09.685898
6164	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:55:16.726399
6165	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 22:55:23.182559
6166	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 22:55:28.087198
6167	5534474259	download	Serie 1	2026-05-02 22:55:35.489216
6168	5415358039	download	Chapter 3	2026-05-02 22:59:08.444567
6169	5534474259	download	Serie 2	2026-05-02 23:08:17.462193
6170	5534474259	download	Serie 3	2026-05-02 23:09:33.749876
6171	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 23:09:41.684149
6172	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-02 23:10:26.020321
6173	5534474259	download	Serie 1 partie 2	2026-05-02 23:10:29.274717
6174	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-02 23:10:31.576431
6175	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-02 23:10:34.252953
6176	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 23:10:39.610607
6177	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-02 23:10:53.433568
6178	5534474259	download	Chapter 5	2026-05-02 23:11:03.032298
6179	5534474259	download	Chapter 3	2026-05-02 23:11:06.458206
6180	5534474259	download	Chapter 5	2026-05-02 23:11:09.081254
6181	5534474259	download	Chapter 2	2026-05-02 23:11:11.488257
6182	5534474259	download	Chapter 5	2026-05-02 23:11:15.823326
6183	5534474259	download	Serie 3	2026-05-02 23:11:21.540027
6184	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-02 23:13:02.098221
6185	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 23:13:07.425295
6186	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 23:13:20.595091
6187	5534474259	download	Serie 4	2026-05-02 23:13:28.714988
6188	5534474259	download	Solutions exercices linked listes	2026-05-02 23:13:33.473267
6189	5534474259	download	Exercices linked listes	2026-05-02 23:13:36.233427
6190	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.2)	2026-05-02 23:13:39.273669
6191	5534474259	download	Chapter 1	2026-05-02 23:14:01.105024
6192	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-02 23:14:17.671322
6193	5534474259	download	Chapter 5	2026-05-02 23:14:48.805094
6194	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-02 23:14:57.173628
6195	5534474259	download	رزنامة	2026-05-02 23:15:04.509651
6196	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 23:15:39.289182
6197	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 23:15:46.644727
6198	5534474259	download	Serie 1 partie 1	2026-05-02 23:15:53.180766
6199	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 23:15:57.310801
6200	5534474259	download	Electrostatic	2026-05-02 23:16:04.264002
6201	5534474259	download	Coordinates system	2026-05-02 23:16:19.208685
6202	5534474259	download	Electrostatic	2026-05-02 23:16:32.834025
6203	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-02 23:16:39.310842
6204	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-02 23:17:23.045341
6205	5534474259	download	Chapter 5	2026-05-02 23:17:30.042637
6206	5534474259	download	رزنامة	2026-05-02 23:17:37.4124
6207	5534474259	search	algo	2026-05-02 23:31:44.840741
6208	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-02 23:31:48.065606
6209	5534474259	download	نموذج ذكاء اصطناعي	2026-05-03 00:07:32.895624
6210	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 00:07:41.686078
6211	5534474259	download	Electrostatic	2026-05-03 00:07:48.675475
6212	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:07:53.653654
6213	5534474259	download	Coordinates system	2026-05-03 00:08:32.043164
6214	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-03 00:08:52.851364
6215	5534474259	download	Serie 1 partie 2	2026-05-03 00:08:56.073384
6216	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-03 00:08:58.522272
6217	5534474259	download	Serie 1 partie 2	2026-05-03 00:09:02.961665
6218	5534474259	download	Serie 1 partie 1	2026-05-03 00:09:05.772701
6219	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-03 00:09:48.581319
6220	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.1)	2026-05-03 00:10:20.717166
6221	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 00:10:25.908548
6222	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 00:16:10.711538
6223	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:16:15.469796
6224	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 00:16:19.949604
6225	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 00:16:26.811155
6226	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 00:18:11.846493
6227	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 00:18:32.741052
6228	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:18:35.811651
6229	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 00:18:38.302801
6230	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:18:40.890749
6231	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 00:18:43.567883
6232	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 00:18:45.943844
6233	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 00:18:48.739222
6234	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:18:55.795833
6235	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 00:18:58.382119
6236	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 00:19:00.804849
6237	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:19:03.496347
6238	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:19:16.588298
6239	5534474259	download	Chapter 5	2026-05-03 00:19:28.507331
6240	5534474259	download	Serie 4	2026-05-03 00:19:51.442657
6241	5534474259	download	Solution — Corrigé Type TD N2 (1)	2026-05-03 00:21:28.133296
6242	5534474259	download	ملخص chapter 3	2026-05-03 00:21:52.577142
6243	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 00:22:00.477598
6244	5534474259	download	أفضل طريق لتعلم البرمجة	2026-05-03 00:22:16.039737
6245	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 00:28:10.363071
6246	5415358039	download	Solution — Corrigé Type TD N0	2026-05-03 01:28:38.853444
6247	5415358039	download	Solution — Tutorial N3 Corrigé Type	2026-05-03 01:28:54.360157
6248	5534474259	download	Chapter 5	2026-05-03 05:00:15.425379
6249	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 05:28:21.587258
6250	5534474259	download	Chapter 5	2026-05-03 05:28:46.364335
6251	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 05:29:31.075791
6252	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 05:30:27.53912
6253	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 05:30:31.44484
6254	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 05:30:34.629156
6255	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 05:30:37.793957
6256	5534474259	download	Chapter 5	2026-05-03 05:30:48.524042
6257	5534474259	download	Chapter 2	2026-05-03 05:30:55.01638
6258	5534474259	download	Chapter 5	2026-05-03 05:31:07.502123
6259	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 05:32:06.232879
6260	5534474259	download	Chapter 5	2026-05-03 05:32:11.358046
6261	5534474259	download	Chapter 4	2026-05-03 05:32:17.027969
6262	5534474259	download	Chapter 3	2026-05-03 05:32:21.346318
6263	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 05:52:24.102328
6264	5534474259	download	Chapter 5	2026-05-03 05:52:31.809912
6265	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 05:52:36.736871
6266	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 05:54:17.134921
6267	5534474259	download	Chapter 2	2026-05-03 05:54:31.210372
6268	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 05:55:29.257124
6269	5534474259	download	Chapter 2	2026-05-03 06:01:07.021536
6270	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 06:02:27.280277
6271	5534474259	download	Chapter 5	2026-05-03 06:02:33.184641
6272	5534474259	download	Chapter 4	2026-05-03 06:03:04.311175
6273	5534474259	download	Chapter 5	2026-05-03 06:03:09.337963
6274	5534474259	download	Chapter 4	2026-05-03 06:03:14.712874
6275	5534474259	download	Serie 3	2026-05-03 06:03:30.237392
6276	5534474259	download	البرمجة بلغة السي شارب	2026-05-03 06:03:57.018147
6277	5534474259	download	Chapter 5	2026-05-03 06:04:01.498107
6278	5534474259	search	Algo 2	2026-05-03 06:05:22.529047
6279	5534474259	download	. — Chapter IV. Linked Lists (Session N°5.2)	2026-05-03 06:05:26.653938
6280	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 06:20:26.711423
6281	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 06:20:36.604312
6282	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 06:20:43.398214
6283	5534474259	download	Serie 1 partie 1	2026-05-03 06:22:04.952951
6284	5534474259	download	Toxicology — Phillip_L_Williams,_Robert_C_James	2026-05-03 06:22:18.160594
6285	5534474259	download	Toxicology — Christopher_P_Holstege_Matthew_P	2026-05-03 06:22:28.26051
6286	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-03 06:22:47.783599
6287	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-03 06:22:54.282246
6288	5534474259	download	Serie 1 partie 1	2026-05-03 06:23:02.854395
6289	5534474259	download	Chapter 5	2026-05-03 06:23:14.22871
6290	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 06:23:37.581748
6291	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 06:23:45.147752
6292	5534474259	download	Toxicology — Christopher_P_Holstege_Matthew_P	2026-05-03 06:23:49.97319
6293	5534474259	download	Toxicology — Phillip_L_Williams,_Robert_C_James	2026-05-03 06:23:57.720058
6294	5534474259	download	Toxicology — Christopher_P_Holstege_Matthew_P	2026-05-03 06:24:02.575028
6295	5534474259	download	Toxicology — Phillip_L_Williams,_Robert_C_James	2026-05-03 06:24:05.064681
6296	5534474259	download	Toxicology — Frank_C_Lu,_Sam_Kacew_Lu's_Basic	2026-05-03 06:24:09.698107
6297	5534474259	download	Toxicology — Christopher_P_Holstege_Matthew_P	2026-05-03 06:24:13.980344
6298	5534474259	download	Toxicology — Frank_C_Lu,_Sam_Kacew_Lu's_Basic	2026-05-03 06:24:19.358304
6299	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 06:24:25.443315
6300	5534474259	download	Chapter 4	2026-05-03 06:24:32.485804
6301	7746046007	download	Chapter 1	2026-05-03 06:27:51.639502
6302	7746046007	download	Chapter 2	2026-05-03 06:27:58.880774
6303	7746046007	download	Chapter 3	2026-05-03 06:28:03.954266
6304	7746046007	download	Chapter 4	2026-05-03 06:28:07.490232
6305	7746046007	download	Chapter 5	2026-05-03 06:28:11.125333
6306	7746046007	download	Chaine algo 2 algorithmicsbyzair	2026-05-03 06:29:35.787647
6307	7746046007	download	Chaine archi	2026-05-03 06:29:46.510867
6308	7596452439	upload	All chapters	2026-05-03 06:52:18.715671
6309	7596452439	download	All chapters	2026-05-03 06:52:47.222699
6310	7596452439	download	All chapters	2026-05-03 06:53:41.347871
6311	5534474259	download	Serie 1 partie 1	2026-05-03 06:57:06.775492
6312	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 06:57:11.772646
6313	7596452439	upload	All chapters	2026-05-03 06:58:08.402811
6314	7596452439	download	All chapters	2026-05-03 06:58:25.948297
6315	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 06:59:38.440649
6316	7596452439	download	All chapters	2026-05-03 06:59:42.017852
6317	5534474259	download	Chapter 4	2026-05-03 06:59:44.460438
6318	7596452439	upload	All chapters	2026-05-03 07:04:23.160016
6319	7596452439	download	All chapters	2026-05-03 07:04:35.292109
6320	5534474259	add_admin	ID: 5663352778	2026-05-03 07:05:10.497637
6321	5534474259	download	Serie 1 partie 2	2026-05-03 07:05:45.822277
6322	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 07:05:50.331936
6323	7596452439	upload	.	2026-05-03 07:06:14.096246
6324	5534474259	download	Toxicology — Frank_C_Lu,_Sam_Kacew_Lu's_Basic	2026-05-03 07:07:50.752372
6325	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-03 07:07:56.027012
6326	5534474259	download	Serie 2 — series 2(1)	2026-05-03 07:08:00.971295
6327	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 07:08:06.273965
6328	5534474259	download	Electrostatic	2026-05-03 07:08:10.965715
6329	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 07:08:15.458446
6330	5534474259	download	All chapters	2026-05-03 07:08:23.193908
6331	5534474259	download	All chapters	2026-05-03 07:08:43.263693
6332	5534474259	download	Serie 4	2026-05-03 07:08:57.332548
6333	5534474259	download	Serie 2	2026-05-03 07:09:01.872961
6334	5534474259	download	Solution serie 1	2026-05-03 07:09:04.499302
6335	5534474259	download	Serie 1	2026-05-03 07:09:07.028552
6336	5534474259	download	Serie 3	2026-05-03 07:09:21.876292
6337	7596452439	upload	Solution	2026-05-03 07:10:20.667683
6338	5534474259	download	Serie 2 — series 2(1)	2026-05-03 07:12:26.115573
6339	5534474259	download	Toxicology — Frank_C_Lu,_Sam_Kacew_Lu's_Basic	2026-05-03 07:12:33.808687
6340	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 07:12:38.293459
6341	5534474259	download	Serie 1 partie 1	2026-05-03 07:12:55.497689
6342	5534474259	download	رزنامة	2026-05-03 07:13:00.793698
6343	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 07:13:05.485657
6344	5534474259	download	All chapters	2026-05-03 07:14:41.461991
6345	7596452439	upload	Serie 2	2026-05-03 07:14:47.674156
6346	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 07:14:48.912418
6347	5534474259	download	Serie 2	2026-05-03 07:15:10.684061
6348	7596452439	upload	Serie 3	2026-05-03 07:15:11.327479
6349	5534474259	download	Serie 2	2026-05-03 07:15:18.819847
6350	7596452439	upload	Serie 4	2026-05-03 07:15:37.83114
6351	5534474259	download	Serie 1	2026-05-03 07:17:43.996492
6352	5534474259	download	Serie 3	2026-05-03 07:18:37.584539
6353	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-03 07:18:57.92626
6354	5534474259	download	Serie 2 — series 2(1)	2026-05-03 07:19:03.921901
6355	5534474259	download	Electrostatic	2026-05-03 07:19:35.427303
6356	5534474259	download	Serie 2 — series 2(1)	2026-05-03 07:20:20.406115
6357	5534474259	download	All chapters	2026-05-03 07:22:03.778277
6358	7596452439	upload	Chapter 1	2026-05-03 07:22:17.750955
6359	5534474259	download	Serie 3	2026-05-03 07:22:35.8226
6360	5534474259	download	Serie 2 — series 2(1)	2026-05-03 07:22:48.896191
6361	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-03 07:22:55.155608
6362	5534474259	download	Serie 2 — series 2(1)	2026-05-03 07:23:00.704048
6363	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-03 07:23:04.057865
6364	5534474259	download	Serie 2 — series 2(1)	2026-05-03 07:24:34.157313
6365	5534474259	download	Serie 2 — P2Series 2- Part 2	2026-05-03 07:24:40.873291
6366	5534474259	download	Serie 2 — Phys2-Series2-part4	2026-05-03 07:24:45.616433
6367	7596452439	upload	Chapter 2	2026-05-03 07:24:50.603705
6368	7596452439	upload	Chapter 3	2026-05-03 07:25:33.168636
6369	7596452439	upload	Chapter 4	2026-05-03 07:26:09.157223
6370	7596452439	upload	Serie 1	2026-05-03 07:28:20.561145
6371	7596452439	upload	Solution of serie 1	2026-05-03 07:29:00.847415
6372	5534474259	download	Serie 1 partie 2	2026-05-03 07:29:32.331015
6373	5534474259	download	Serie 1 partie 1	2026-05-03 07:29:36.549916
6374	7596452439	upload	Serie 2	2026-05-03 07:30:26.041758
6375	5534474259	download	Chapter 4	2026-05-03 07:30:54.349315
6376	5534474259	download	Chapter 1	2026-05-03 07:30:56.804761
6377	5534474259	download	Serie 1	2026-05-03 07:30:59.142874
6378	5534474259	download	Chapter 1	2026-05-03 07:31:02.487829
6379	7596452439	upload	Solution of serie 2	2026-05-03 07:31:03.80004
6380	7596452439	download	Solution of serie 1	2026-05-03 07:32:04.582636
6381	5534474259	download	Serie 1 partie 2	2026-05-03 07:32:06.879043
6382	5534474259	download	Electrostatic	2026-05-03 07:32:42.878171
6383	5534474259	download	Coordinates system	2026-05-03 07:32:48.750616
6384	7596452439	download	Serie 1	2026-05-03 07:32:48.835066
6385	5534474259	download	All chapters	2026-05-03 07:33:01.128136
6386	7596452439	download	Serie 2	2026-05-03 07:33:04.898598
6387	5534474259	download	All chapters	2026-05-03 07:33:19.139075
6392	5534474259	download	. — CHAPITRE_2_ANATOMIE_DES_VEGETAUX_SUPERIEURS_17afb5cfd6a926d274839929d4b46d45	2026-05-03 07:34:17.874064
6395	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 07:34:33.579623
7131	7518863743	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-09 21:53:36.423846
7185	5534474259	download	Serie 3	2026-05-10 22:11:34.179316
7301	5534474259	download	Chapter 1	2026-05-13 17:02:00.809921
7302	5534474259	download	Chapter 2	2026-05-13 17:02:05.002138
7394	5534474259	download	. — semio gyneco 2	2026-05-15 02:45:08.048902
7511	2013244058	download	Chapter 1	2026-05-15 12:34:13.374648
7600	6167797720	download	Serie 1	2026-05-16 00:54:00.54216
7673	5534474259	download	. — semio gyneco 2	2026-05-16 18:34:30.717881
7769	5303731176	download	Chapter 2 part 2	2026-05-17 00:06:58.48646
7770	5303731176	download	Chapter 3	2026-05-17 00:07:01.226827
7930	5534474259	download	Serie 3	2026-05-18 08:56:21.731439
7931	5534474259	download	Serie 4	2026-05-18 08:56:26.065221
6388	7596452439	download	Solution of serie 1	2026-05-03 07:33:21.781275
6393	5534474259	download	. — CHAPITRE_3_MORPHOLOGIE_DES_VEGETAUX_SUPERIEURS_7366b7c97c777e71	2026-05-03 07:34:21.013568
6394	5534474259	download	All chapters	2026-05-03 07:34:25.830491
6398	7596452439	upload	Chapter 1	2026-05-03 07:40:35.372957
7132	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-09 22:35:35.31533
7138	5534474259	download	Serie 2	2026-05-09 22:36:07.455442
7186	5534474259	download	Serie 4	2026-05-10 22:11:37.186777
7303	6272548417	search	Proba	2026-05-13 18:38:27.375054
7304	5534474259	download	Serie 1	2026-05-13 18:39:18.131173
7307	5534474259	download	Serie 3	2026-05-13 18:39:27.542441
7395	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 02:45:30.723669
7404	5534474259	download	Seri1 — PW5 corrected	2026-05-15 02:48:47.884985
7418	5534474259	download	Chapter 2	2026-05-15 02:51:07.608946
7512	2013244058	download	Chapter 2	2026-05-15 12:34:19.275456
7516	5104073058	download	Quiz A	2026-05-15 12:34:53.736363
7601	6167797720	download	Serie 2	2026-05-16 00:54:52.419162
7674	5534474259	download	. — Worksheet N°6 Common Discrete Probability	2026-05-16 18:36:26.485646
7771	5534474259	download	. — semio gyneco 2	2026-05-17 00:08:37.239066
7932	5415358039	download	Serie 4	2026-05-18 09:13:25.229535
6389	5534474259	download	Coordinates system	2026-05-03 07:33:27.446838
6391	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-03 07:34:13.961711
6396	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-03 07:34:37.57275
7133	5534474259	download	. — Worksheet N°8 Common Continuous Probability Distributions	2026-05-09 22:35:38.010258
7136	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-09 22:35:58.733218
7187	6018795251	download	Serie 1	2026-05-10 22:47:42.057144
7188	6018795251	download	Serie 1	2026-05-10 22:47:42.184506
7189	6018795251	download	Serie 1	2026-05-10 22:47:42.326816
7305	5534474259	download	Solution serie 1	2026-05-13 18:39:21.466999
7396	5534474259	download	Resumè chapter 1/2	2026-05-15 02:45:43.11804
7513	2013244058	download	Chapter 3	2026-05-15 12:34:29.056446
7515	2013244058	download	Chapter 5	2026-05-15 12:34:38.613524
7602	6167797720	download	Serie 3	2026-05-16 00:55:49.249341
7675	5534474259	download	Seri1 — PW 6 corr	2026-05-16 18:36:39.970588
7772	5534474259	download	. — semio gyneco 2	2026-05-17 00:09:10.727446
7933	5534474259	download	Serie 3	2026-05-18 09:17:23.094873
7934	5534474259	download	Chapter 3	2026-05-18 09:26:30.554199
6390	7596452439	download	Solution of serie 2	2026-05-03 07:33:41.808041
6397	7596452439	upload	Serie 3	2026-05-03 07:36:40.649381
6399	7596452439	upload	Chapter 2	2026-05-03 07:40:53.730271
6400	7596452439	upload	Serie 2	2026-05-03 07:44:18.406384
6401	7596452439	upload	Serie 3	2026-05-03 07:44:44.672778
6402	7596452439	upload	Serie 4	2026-05-03 07:45:05.876771
6403	7596452439	upload	Solution of TD 1	2026-05-03 07:45:49.566132
6404	7596452439	upload	Serie 1	2026-05-03 07:47:16.997764
6405	7596452439	upload	Serie 2	2026-05-03 07:47:37.708925
6406	7596452439	upload	Serie 3	2026-05-03 07:48:06.727656
6407	7596452439	upload	Serie 4	2026-05-03 07:49:19.630814
6408	7596452439	upload	Solution of TP 2	2026-05-03 07:50:14.752413
6409	7596452439	download	Solution of TP 2	2026-05-03 07:51:00.778868
6410	7596452439	upload	Chapter 1	2026-05-03 07:53:32.161836
6411	7596452439	upload	Chapter 2	2026-05-03 07:53:51.970085
6412	7596452439	upload	Chapter 3	2026-05-03 07:54:22.09183
6413	5534474259	download	Serie 3	2026-05-03 07:55:59.137387
6414	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-03 07:56:16.568287
6415	5534474259	download	Serie 2	2026-05-03 07:56:22.569652
6416	5534474259	download	Chapter 3 — polycopié Maths2. ZENKOUFI Lilia	2026-05-03 07:57:22.951913
6417	5534474259	download	Chapter 3 — chapter_3_matrices	2026-05-03 07:57:35.624741
6418	5534474259	download	Serie 3	2026-05-03 07:57:47.867676
6419	5534474259	download	Serie 2	2026-05-03 07:57:51.716136
6420	5534474259	download	Serie 1	2026-05-03 07:57:54.282314
6421	5534474259	download	Solution serie 1	2026-05-03 07:57:57.481435
6422	5534474259	download	Serie 1	2026-05-03 07:58:03.126141
6423	5534474259	download	Serie 4	2026-05-03 07:58:09.730655
6424	5534474259	download	Serie 4	2026-05-03 07:58:21.729561
6425	5534474259	download	Serie 2	2026-05-03 07:58:26.430364
6426	5534474259	download	Serie 3	2026-05-03 07:58:41.835044
6427	5534474259	download	Chapter 3 — polycopié Maths2. ZENKOUFI Lilia	2026-05-03 07:58:46.136007
6428	5534474259	download	Chapter 3 — chapter_3_matrices	2026-05-03 07:58:53.101156
6429	5534474259	download	Serie 2	2026-05-03 07:58:58.267492
6430	5534474259	download	Serie 1 — ASD2_exercise6_supplementaire	2026-05-03 07:59:04.842327
6431	5534474259	download	Serie 1 — ASD2_exercise6_supplementaire	2026-05-03 07:59:11.938548
6432	5534474259	download	Serie 1 — TD 1.docx	2026-05-03 07:59:17.075487
6433	5534474259	download	All chapters	2026-05-03 07:59:22.907718
6434	5534474259	download	Serie 2	2026-05-03 08:01:03.995994
6435	7596452439	upload	Serie 1	2026-05-03 08:03:43.089762
6436	7596452439	upload	Solution of TD 1	2026-05-03 08:04:29.32336
6437	7596452439	upload	Serie 2	2026-05-03 08:04:48.446138
6438	7596452439	upload	Solution of TD 2	2026-05-03 08:05:15.994571
6439	7596452439	upload	Serie 3	2026-05-03 08:05:34.004669
6440	5534474259	download	List of axioms and rules	2026-05-03 08:14:10.239762
6441	5534474259	download	Serie 3	2026-05-03 08:14:40.817621
6442	5534474259	download	Serie 2	2026-05-03 08:14:48.173448
6443	5534474259	download	Solution of TD 2	2026-05-03 08:14:55.878242
6444	7596452439	upload	Chapter 1	2026-05-03 08:15:13.869196
6445	5534474259	download	Serie 2	2026-05-03 08:15:14.27659
6446	5534474259	download	Serie 3	2026-05-03 08:15:20.419793
6447	5534474259	download	Solution of TD 2	2026-05-03 08:15:26.938123
6448	5534474259	download	Serie 1	2026-05-03 08:15:38.875484
6449	7596452439	upload	Chapter 1	2026-05-03 08:16:52.884437
6450	7596452439	upload	Chapter 2	2026-05-03 08:17:46.960055
6451	7596452439	upload	Chapter 3	2026-05-03 08:18:47.276204
6452	7596452439	upload	Chapter 4	2026-05-03 08:19:43.767422
6453	7596452439	upload	Chapter 2	2026-05-03 08:22:25.636567
6454	7596452439	upload	Serie 1	2026-05-03 08:24:33.911984
6455	7596452439	upload	TD 1 solution	2026-05-03 08:25:03.510687
6456	7596452439	upload	Serie 2	2026-05-03 08:25:35.737865
6457	7596452439	upload	TD 2 solution	2026-05-03 08:25:59.551012
6458	7596452439	upload	Serie 3	2026-05-03 08:26:29.331782
6459	7596452439	upload	TD 3 solution	2026-05-03 08:27:13.28038
6460	5534474259	maintenance	ON	2026-05-03 08:31:28.798988
6461	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 08:35:06.426922
6462	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 08:35:11.367831
6463	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 08:35:15.170052
6464	5534474259	maintenance	OFF	2026-05-03 08:35:19.054034
6465	5534474259	download	TD 3 solution	2026-05-03 08:37:22.827595
6466	5534474259	download	Serie 1	2026-05-03 08:37:25.583931
6467	5534474259	download	TD 1 solution	2026-05-03 08:37:31.643387
6468	5534474259	download	TD 2 solution	2026-05-03 08:37:35.396316
6469	5534474259	download	Serie 1	2026-05-03 08:37:37.685027
6470	5534474259	download	Serie 2	2026-05-03 08:37:41.211961
6471	5534474259	download	Serie 3	2026-05-03 08:39:09.927227
6472	5534474259	download	Chapter 2	2026-05-03 08:39:25.565764
6473	5534474259	download	TD 3 solution	2026-05-03 08:40:25.473139
6474	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-03 08:40:39.732728
6475	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 08:40:46.366284
6476	5534474259	download	Serie 3	2026-05-03 08:41:01.848708
6477	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 08:41:44.245375
6478	5534474259	download	Chapter 3 — polycopié Maths2. ZENKOUFI Lilia	2026-05-03 08:42:01.056117
6479	5534474259	download	Serie 3	2026-05-03 08:42:12.308258
6480	5534474259	download	Serie 4	2026-05-03 08:47:24.884736
6481	5534474259	download	Serie 6	2026-05-03 08:47:28.534249
6482	5534474259	download	Serie 4	2026-05-03 08:47:33.991664
6483	5534474259	download	Serie 6	2026-05-03 08:47:36.822488
6484	5534474259	download	Serie 5	2026-05-03 08:47:42.43678
6485	5534474259	download	Serie 3	2026-05-03 08:47:45.067439
6486	5534474259	download	Serie 1	2026-05-03 08:47:48.442013
6487	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 08:47:52.664904
6488	5534474259	download	Serie 6	2026-05-03 08:47:58.223701
6489	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-03 08:48:14.919978
6490	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 08:48:19.576573
6491	5534474259	download	Serie 6	2026-05-03 08:48:24.447883
6492	5534474259	download	Serie 3	2026-05-03 08:48:38.496408
6493	5534474259	download	Serie 3	2026-05-03 08:49:30.742672
6494	5534474259	download	Serie 4	2026-05-03 08:51:25.697573
6495	5534474259	download	Solution of TD 1	2026-05-03 08:51:29.776404
6496	5534474259	download	Serie 4	2026-05-03 08:51:35.434274
6497	5534474259	download	Serie 1 — ASD2_exercise6_supplementaire	2026-05-03 08:51:41.01279
6498	5534474259	download	Serie 1 — TD 1.docx	2026-05-03 08:51:44.724215
7134	5534474259	download	. — Worksheet N°5 Discrete Random Variables	2026-05-09 22:35:46.676097
7135	5534474259	download	. — Worksheet N°8 Common Continuous Probability Distributions	2026-05-09 22:35:50.315974
7139	5534474259	download	Chapter 4	2026-05-09 22:36:23.953829
7190	6018795251	download	Serie 2	2026-05-10 22:49:18.379084
7306	5534474259	download	Serie 2	2026-05-13 18:39:24.338361
7397	5534474259	download	. — Worksheet N°2 Simple Linear Regression	2026-05-15 02:45:57.288669
7514	2013244058	download	Chapter 4	2026-05-15 12:34:33.232517
7603	6167797720	download	Serie 4	2026-05-16 00:56:05.176746
7676	5534474259	download	Serie 3	2026-05-16 18:55:42.174825
7678	5534474259	download	Serie 1	2026-05-16 18:55:50.863123
7773	5534474259	download	Serie 3	2026-05-17 00:21:12.263419
7782	5534474259	download	Os — Chapter 5 (1)	2026-05-17 00:23:06.760307
7935	5534474259	download	Solutions serie 3 & 4	2026-05-18 09:26:43.63448
7936	5534474259	download	Chapter 3	2026-05-18 09:26:53.979425
7937	5534474259	download	Seri1 — PW 6 corr	2026-05-18 09:27:08.703826
6499	5534474259	download	Serie 1 — TD 1.docx	2026-05-03 08:51:49.438326
6500	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-03 08:56:03.402202
6502	5534474259	download	TD 3 solution	2026-05-03 08:56:15.764378
7137	5534474259	download	Chapter 2	2026-05-09 22:36:04.286151
7191	6018795251	download	Serie 3	2026-05-10 22:49:38.610499
7308	5534474259	download	Resumè chapter 1/2	2026-05-13 19:26:13.773105
7398	5534474259	download	. — 6-Exploration de la glycémie.pptx	2026-05-15 02:48:02.918161
7517	2013244058	download	Chapter 5	2026-05-15 12:36:22.200101
7604	5415358039	download	Serie 2	2026-05-16 01:05:15.015719
7677	5534474259	download	Serie 2	2026-05-16 18:55:45.945387
7679	5534474259	download	. — semio hg genitale	2026-05-16 18:56:01.2342
7774	5534474259	download	. — semio gyneco 2	2026-05-17 00:21:18.51753
7938	5534474259	download	Serie 4	2026-05-18 09:33:25.253858
6501	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 08:56:08.575255
6503	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 08:57:44.177768
6504	5534474259	download	Serie 3	2026-05-03 08:57:56.899478
6505	5534474259	download	Serie 2	2026-05-03 08:58:25.127816
6506	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-03 08:58:31.927765
6507	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-03 08:58:41.121514
6508	5534474259	download	Chapter 2	2026-05-03 08:58:48.155821
6509	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-03 08:58:50.981791
6510	5534474259	download	All chapters	2026-05-03 08:59:04.813859
6511	5534474259	download	Chapter 2	2026-05-03 09:01:40.499553
6512	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-03 09:01:45.412081
6513	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 09:02:01.87155
6514	5534474259	download	Serie 1 partie 2	2026-05-03 09:05:32.822257
6515	5534474259	download	Coordinates system	2026-05-03 09:05:41.931911
6516	5534474259	download	Serie 4	2026-05-03 09:10:59.326553
6517	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:11:19.549278
6518	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-03 09:11:25.74092
6519	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 09:11:30.721289
6520	5534474259	download	Serie 2	2026-05-03 09:11:37.033758
6521	5534474259	download	Coordinates system	2026-05-03 09:11:43.417449
6522	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:12:40.797249
6523	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-03 09:12:51.882468
6524	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 09:12:56.32641
6525	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:29:43.831807
6526	5534474259	download	Serie 1	2026-05-03 09:29:51.566378
6527	5534474259	download	TD 3 solution	2026-05-03 09:29:57.463919
6528	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-03 09:30:11.41205
6529	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:30:14.488994
6530	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-03 09:30:17.544181
6531	5534474259	download	Chapter 2	2026-05-03 09:33:02.399479
6532	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-03 09:33:07.684854
6533	5534474259	download	TD 3 solution	2026-05-03 09:33:12.767665
6534	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 09:33:16.961224
6535	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 09:33:23.027811
6536	5534474259	download	Chapter 4	2026-05-03 09:33:32.381516
6537	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:34:27.294974
6538	5534474259	download	TD 1 solution	2026-05-03 09:34:32.799245
6539	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:34:37.545168
6540	5534474259	download	TD 3 solution	2026-05-03 09:34:43.136802
6541	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 09:34:49.20645
6542	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-03 09:34:53.767448
6543	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:36:14.470875
6544	5534474259	download	TD 1 solution	2026-05-03 09:36:20.289138
6545	5534474259	download	TD 3 solution	2026-05-03 09:36:25.818483
6546	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 09:36:30.027981
6547	5534474259	download	Serie 2	2026-05-03 09:36:38.00931
6548	5534474259	search	قنواة	2026-05-03 09:36:45.81109
6549	5534474259	download	Chaine algèbra 2	2026-05-03 09:36:48.106722
6550	5534474259	download	Chaine algo 2 algorithmicsbyzair	2026-05-03 09:36:50.71851
6551	5534474259	download	Chaine archi	2026-05-03 09:36:52.770309
6552	5534474259	download	Chaine algo 2 algorithmicsbyzair	2026-05-03 09:36:56.539994
6553	5534474259	download	Chaine algebra 2	2026-05-03 09:36:59.678085
6554	5534474259	download	نموذج ذكاء اصطناعي	2026-05-03 09:37:16.712339
6555	5534474259	download	TD 3 solution	2026-05-03 10:31:10.145762
6556	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 10:31:16.221963
6557	5534474259	download	TD 1 solution	2026-05-03 10:31:21.126219
6558	5534474259	download	Serie 4	2026-05-03 10:35:23.340881
6559	5534474259	download	Serie 2	2026-05-03 10:40:05.317183
6560	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-03 10:40:12.011234
6561	5534474259	download	Chaine algo 2 algorithmicsbyzair	2026-05-03 10:43:45.570246
6562	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-03 10:43:51.201944
6563	5534474259	add_admin	ID: 5663352778	2026-05-03 10:53:33.997638
6564	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 10:53:46.150866
6565	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 10:53:58.244452
6566	5534474259	download	Serie 4	2026-05-03 10:54:03.504184
6567	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 10:55:33.981911
6568	5534474259	download	TD 3 solution	2026-05-03 10:55:38.15171
6569	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 11:00:41.01242
6570	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-03 11:00:45.563673
6571	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 11:03:08.276636
6572	5415358039	download	Cour 5	2026-05-03 11:53:29.458293
6573	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 12:24:10.577931
6574	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 12:24:14.804204
6575	5534474259	download	نموذج ذكاء اصطناعي	2026-05-03 12:24:26.966801
6576	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 12:24:33.552787
6577	5534474259	download	Chapter 3	2026-05-03 12:24:39.329975
6578	5534474259	download	Chapter 4	2026-05-03 12:24:45.796254
6579	5534474259	download	TD 2 solution	2026-05-03 12:25:16.615411
6580	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 12:25:22.80204
6581	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 12:25:27.448411
6582	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 12:25:31.958653
6583	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 12:25:37.44004
6584	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 12:27:39.439939
6585	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 12:42:02.733768
6586	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-03 12:42:36.028189
6587	5534474259	download	Chapter 4	2026-05-03 12:42:41.954019
6588	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-03 12:50:23.446028
6764	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-04 15:34:26.718529
6589	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-03 12:57:47.327051
6590	5534474259	download	TD 1 solution	2026-05-03 12:57:53.472135
6591	5534474259	download	TD 2 solution	2026-05-03 12:57:56.001197
6592	8726316433	search	Tp final	2026-05-03 13:36:08.998919
6593	8726316433	download	Tp final	2026-05-03 13:36:18.347614
6594	8726316433	download	Chapter 1	2026-05-03 14:18:27.999034
6595	5415358039	download	Cour 6	2026-05-03 14:30:03.576382
6596	5415358039	download	Serie 3	2026-05-03 14:40:09.596204
6597	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 14:49:41.9125
6598	5534474259	download	Skip — 01- Introduction à la Parasitologie 2026 Dr Fellahi A	2026-05-03 14:49:54.995231
6599	5415358039	download	Solution — Answers Series 3	2026-05-03 15:04:39.03231
6600	5534474259	download	Chapter 2	2026-05-03 15:10:34.636848
6601	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 15:11:09.424035
6602	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-03 15:11:17.639529
6603	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 15:11:21.004539
6604	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-03 15:11:24.654082
6605	5534474259	download	Chapter 2	2026-05-03 15:11:29.499137
6606	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-03 15:11:32.157834
6607	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-03 15:24:07.203524
6608	5534474259	download	بادئة — Sémiologie digestives vmts dysphagie	2026-05-03 15:24:23.107561
6609	5534474259	download	Serie 4	2026-05-03 15:24:55.099631
6610	5534474259	download	Serie 5	2026-05-03 15:25:00.617496
6611	5534474259	download	Serie 3	2026-05-03 15:25:06.781305
6612	5534474259	download	Serie 1	2026-05-03 15:25:09.445187
6613	7746046007	download	Antiro	2026-05-03 16:26:28.099181
6614	7746046007	download	Teste 1	2026-05-03 16:26:34.956129
6615	7746046007	download	Chaine algèbra 2	2026-05-03 16:27:36.38897
6616	7596452439	upload	Chapter 2 & 3	2026-05-03 18:24:53.993621
6617	7596452439	upload	Chapter 3	2026-05-03 18:26:27.819286
6618	5104073058	download	Tp final	2026-05-03 22:12:21.870172
6619	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 06:03:23.449751
6620	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 06:03:27.227632
6621	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-04 06:03:32.617703
6622	5534474259	ban	5916743033	2026-05-04 06:04:01.112296
6623	5534474259	download	Chapter 4	2026-05-04 06:15:37.040956
6624	5534474259	download	Serie 3	2026-05-04 06:16:44.048137
6625	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 06:16:49.847078
6626	5534474259	download	Serie 4	2026-05-04 06:17:02.028334
6627	5534474259	download	Serie 1	2026-05-04 06:30:30.199038
6628	5534474259	download	TD 1 solution	2026-05-04 06:30:32.473525
6629	5534474259	download	Toxicology — Phillip_L_Williams,_Robert_C_James	2026-05-04 06:30:45.460878
6630	5534474259	download	Serie 3	2026-05-04 06:30:51.072268
6631	5534474259	download	Serie 4	2026-05-04 06:31:07.484871
6632	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 06:32:09.34553
6633	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 06:32:13.814559
6634	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-04 06:32:28.048259
6635	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-04 06:32:35.363926
6636	5534474259	download	رزنامة	2026-05-04 06:32:43.775849
6637	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 06:32:50.447003
6638	5534474259	download	Serie 3	2026-05-04 06:32:55.517834
6639	5534474259	download	Chapter 2	2026-05-04 06:33:00.031953
6640	5534474259	download	Serie 3	2026-05-04 06:33:07.766574
6641	5534474259	download	Serie 1	2026-05-04 06:33:13.244255
6642	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 06:33:19.443145
6643	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 06:38:01.880149
6644	5534474259	download	Serie 4	2026-05-04 06:38:07.923359
6645	5534474259	download	Serie 5	2026-05-04 06:38:23.036964
6646	5534474259	download	Serie 3	2026-05-04 06:49:32.691705
6647	5534474259	download	Serie 4	2026-05-04 06:49:35.334835
6648	5534474259	download	Serie 5	2026-05-04 06:49:37.734367
6649	5534474259	download	Serie 4	2026-05-04 06:49:44.455792
6650	5534474259	download	Serie 3	2026-05-04 06:49:50.968214
6651	5534474259	download	Serie 2	2026-05-04 06:49:53.573043
6652	5534474259	download	Serie 5	2026-05-04 06:50:08.786143
6653	5534474259	download	Serie 5	2026-05-04 06:50:40.643856
6654	5534474259	download	Serie 5	2026-05-04 06:50:45.432318
6655	5534474259	download	Seri1 — PW5 corrected	2026-05-04 06:51:01.904308
6656	5534474259	download	Seri1 — PW04 Corrected	2026-05-04 06:51:06.397636
6657	5534474259	download	Solution serie 4 (3,6,8)	2026-05-04 07:04:03.310045
6658	5534474259	upload	Solution serie 4(5/7)	2026-05-04 07:05:17.506698
6659	5534474259	download	TD 1 solution	2026-05-04 07:25:11.821916
6660	5534474259	download	Serie 4	2026-05-04 07:26:01.868075
6661	5534474259	download	TD 1 solution	2026-05-04 07:26:09.706708
6662	5534474259	download	Serie 4	2026-05-04 07:50:47.509332
6663	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 07:50:52.039162
6664	5534474259	download	TD 1 solution	2026-05-04 07:51:36.974588
6665	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 07:51:41.382902
6666	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 07:51:45.251561
6667	5534474259	download	Serie 4	2026-05-04 07:51:50.58361
6668	5534474259	download	Chapter 3	2026-05-04 07:52:00.733539
6669	5534474259	download	Serie 2	2026-05-04 07:52:44.589624
6670	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 07:52:55.36088
6671	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 07:53:00.349999
6672	5534474259	download	Serie 4	2026-05-04 08:07:05.959449
6673	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-04 08:07:47.89492
6674	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 08:07:50.845849
6675	5534474259	download	Skip — 02-2. Amibes libres Dr Fellahi A (1)	2026-05-04 08:07:53.319267
6676	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-04 08:07:55.882991
6677	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 08:08:03.457737
6678	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 08:08:21.201779
6679	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-04 08:08:25.014498
6682	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-04 08:08:36.69804
6683	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-04 08:08:39.253498
7140	5534474259	download	ملخص chapter 3	2026-05-09 22:39:22.767346
7192	6018795251	download	Serie 5	2026-05-10 22:51:46.690913
7193	6018795251	download	Serie 5	2026-05-10 22:51:46.779648
7194	6018795251	download	Serie 5	2026-05-10 22:51:46.910885
7195	6018795251	download	Serie 5	2026-05-10 22:51:47.22233
7196	6018795251	download	Serie 5	2026-05-10 22:51:47.354052
7309	1951225967	download	بادئة — Sémiologie digestives vmts dysphagie	2026-05-14 00:03:57.626507
7399	5534474259	download	. — semio gyneco 2	2026-05-15 02:48:07.140409
7409	5534474259	download	. — semio hg genitale	2026-05-15 02:49:48.881912
7415	5534474259	download	. — semio hg genitale	2026-05-15 02:50:43.585919
7417	5534474259	download	Chapter 2	2026-05-15 02:51:03.01044
7419	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 02:51:12.236684
7518	2013244058	download	Serie 1	2026-05-15 12:42:13.223538
7605	5415358039	download	Serie 2	2026-05-16 01:05:30.599525
7680	5534474259	download	. — Worksheet N°7 Continuous Random Variables	2026-05-16 18:56:12.044402
7775	5534474259	download	Os — Chapter 5 (1)	2026-05-17 00:21:32.509181
7778	5534474259	download	. — semio hg genitale	2026-05-17 00:21:57.676621
7939	5534474259	download	Serie 4	2026-05-18 09:42:51.405047
7940	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-18 09:43:03.847631
6680	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 08:08:27.527301
6681	5534474259	download	Skip — 02-2. Amibes libres Dr Fellahi A (1)	2026-05-04 08:08:32.216149
7141	5534474259	download	. — semio gyneco 2	2026-05-10 06:14:40.051423
7197	6018795251	download	Serie 6	2026-05-10 22:52:59.428856
7198	6018795251	download	Serie 4	2026-05-10 22:53:57.05965
7310	5534474259	download	Serie 1	2026-05-14 00:28:08.942479
7400	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 02:48:10.751156
7401	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 02:48:14.98352
7402	5534474259	download	. — semio genitale masculin dr kemiha	2026-05-15 02:48:19.56353
7403	5534474259	download	Skip — 02-1. Amibes et Amibiase Dr Fellahi A (1)	2026-05-15 02:48:33.362587
7405	5534474259	download	. — semio hg genitale	2026-05-15 02:48:51.799618
7406	5534474259	download	. — semio genitale masculin dr kemiha	2026-05-15 02:48:58.698677
7407	5534474259	download	. — semio gyneco 2	2026-05-15 02:49:05.828231
7408	5534474259	download	Correction serie 2	2026-05-15 02:49:17.834358
7519	2013244058	download	Serie 2	2026-05-15 12:42:18.15853
7520	2013244058	download	Serie 3	2026-05-15 12:42:23.103467
7521	2013244058	download	Serie 4	2026-05-15 12:42:31.291001
7522	2013244058	download	Solution serie 4(5/7)	2026-05-15 12:42:35.890079
7606	5415358039	download	Serie 3	2026-05-16 01:10:47.7935
7607	6167797720	download	Solution serie 4 (3,6,8)	2026-05-16 01:11:04.760924
7681	5534474259	download	. — semio hg genitale	2026-05-16 18:56:33.864137
7776	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-17 00:21:38.682312
7777	5534474259	download	Serie 3	2026-05-17 00:21:51.934194
7779	5534474259	download	. — Worksheet N°4 Probability Calculation	2026-05-17 00:22:19.738276
7780	5534474259	download	Serie 2	2026-05-17 00:22:30.659173
7781	5534474259	download	Seri1 — PW5 corrected	2026-05-17 00:22:46.588011
7941	5534474259	download	Analyse — Exo2-3,serie3	2026-05-18 09:43:21.329719
6684	5534474259	download	Skip — 02-2. Amibes libres Dr Fellahi A (1)	2026-05-04 08:08:49.434172
6685	5534474259	download	Chapter 2	2026-05-04 08:08:54.210997
6686	5534474259	download	Chapter 2	2026-05-04 10:28:05.086589
6687	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 10:28:10.782952
6688	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 10:28:13.613099
6689	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 10:28:16.042498
6690	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 10:28:19.467559
6691	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 10:28:22.098026
6692	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 10:28:24.45131
6693	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 11:37:22.418739
6694	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 11:37:27.106461
6695	5534474259	download	Serie 3	2026-05-04 11:37:49.807229
6696	5534474259	download	Solution serie 1	2026-05-04 11:38:13.244983
6697	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 11:44:24.637513
6698	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 11:44:28.199245
6699	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 11:44:43.12433
6700	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-04 11:44:45.664076
6701	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 11:44:47.832751
6702	5534474259	download	Serie 6	2026-05-04 11:44:58.271831
6703	5534474259	download	Serie 4	2026-05-04 11:45:01.433852
6704	5534474259	download	Serie 6	2026-05-04 11:45:07.958748
6705	5534474259	download	Serie 5	2026-05-04 11:45:10.254157
6706	5534474259	download	Serie 1	2026-05-04 11:45:12.541905
6707	5534474259	download	Serie 4	2026-05-04 11:45:14.994756
6708	5534474259	download	Solution serie 1	2026-05-04 11:45:21.255875
6709	5534474259	search	To algo 2	2026-05-04 11:45:29.342031
6710	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-04 11:45:34.178333
6711	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 11:45:38.041661
6712	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 11:45:52.374615
6713	5534474259	download	Serie 6	2026-05-04 12:13:42.552901
6714	5534474259	download	TD 1 solution	2026-05-04 12:19:45.955398
6715	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 12:19:53.382442
6716	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 12:20:08.013033
6717	5534474259	download	Serie 5	2026-05-04 12:20:53.508817
6718	5534474259	download	TD 1 solution	2026-05-04 12:21:02.86853
6719	5534474259	download	Serie 4	2026-05-04 12:22:34.590488
6720	5534474259	download	Serie 3	2026-05-04 12:22:38.777745
6721	5534474259	download	Serie 6	2026-05-04 12:22:42.071761
6722	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-04 12:22:54.457045
6723	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 12:22:56.832654
6724	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-04 12:23:01.449832
6725	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:23:03.944519
6726	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 12:23:16.526726
6727	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:23:19.207346
6728	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 12:23:23.101082
6729	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:23:25.850672
6730	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 12:23:43.991545
6731	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:23:47.705309
6732	5534474259	download	Serie 3	2026-05-04 12:32:27.513992
6733	5534474259	download	Serie 4	2026-05-04 12:32:30.127262
6734	5534474259	download	Serie 3	2026-05-04 12:32:32.563257
6735	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-04 12:32:39.116509
6736	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-04 12:32:49.582233
6737	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:32:52.408736
6738	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:32:59.003636
6739	5534474259	download	Tp final	2026-05-04 12:33:11.29871
6740	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-04 12:33:16.39107
6741	5534474259	download	Chapter 1 — Fac_cent_chap1_Part2	2026-05-04 12:33:18.959028
6742	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 12:33:21.558903
6743	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 12:33:24.213695
6744	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:33:29.956836
6745	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 12:33:32.367424
6746	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 12:33:35.656518
6747	5534474259	download	Tp final	2026-05-04 13:28:59.896501
6748	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 13:29:04.834243
6749	5534474259	download	Tp final	2026-05-04 13:36:53.36766
6750	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 13:39:26.938848
6751	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-04 15:17:27.067048
6752	5534474259	download	Chapter 2	2026-05-04 15:17:32.931048
6753	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-04 15:17:39.502648
6754	5534474259	download	Solution serie 4(5/7)	2026-05-04 15:17:49.120737
6755	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 15:18:33.28552
6756	5534474259	download	All chapters	2026-05-04 15:18:48.502862
6757	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-04 15:19:37.353056
6758	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 15:19:56.869978
6759	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 15:20:03.447423
6760	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 15:20:09.090971
6761	5534474259	download	Tp final	2026-05-04 15:34:08.983482
6762	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 15:34:13.938485
6763	5534474259	download	Serie 4	2026-05-04 15:34:19.066347
6765	5534474259	download	Solution serie 4(5/7)	2026-05-04 17:07:00.960897
6766	5534474259	download	Serie 4	2026-05-04 17:07:04.119082
6767	5534474259	download	Serie 2	2026-05-04 17:07:08.872759
6768	5534474259	download	Skip — 04_1_Les_flagellés_cavitaires_digest,_uro_génét_Dr_Fellahi_A	2026-05-04 17:08:52.222985
6769	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 17:21:45.525183
6770	5534474259	download	Serie 3	2026-05-04 17:21:51.458505
6771	5534474259	download	نموذج ذكاء اصطناعي	2026-05-04 17:22:08.918175
6772	5588471450	download	Chapter 1	2026-05-04 17:26:14.568242
6773	5588471450	download	Chapter 2	2026-05-04 17:26:19.178333
6774	5588471450	download	Chapter 3	2026-05-04 17:26:23.096608
6775	5588471450	download	Chapter 4	2026-05-04 17:26:31.570614
6776	5588471450	download	Chapter 5	2026-05-04 17:26:35.358253
6777	7387314389	download	Serie 1	2026-05-04 17:37:03.946448
6778	7387314389	download	Serie 2	2026-05-04 17:38:21.128142
6779	7387314389	download	Chapter 2	2026-05-04 17:42:16.89913
6780	6409821771	download	Chapter 1	2026-05-04 18:30:23.197059
6781	5534474259	download	Solution serie 4(5/7)	2026-05-04 18:30:30.763368
6782	6409821771	download	Chapter 2	2026-05-04 18:30:33.116469
6783	6409821771	download	Chapter 3	2026-05-04 18:30:36.377164
6784	6409821771	download	Chapter 4	2026-05-04 18:30:40.412175
6785	6409821771	download	Chapter 5	2026-05-04 18:30:44.454543
6786	5534474259	download	Serie 2	2026-05-04 18:41:10.130993
6787	8264518538	download	Quiz B	2026-05-04 18:41:14.518899
6788	5415358039	download	Serie 1	2026-05-04 18:41:36.832231
6789	5415358039	download	Serie 2	2026-05-04 18:41:46.286644
6790	6263878232	download	Serie 1 — TD 1.docx	2026-05-04 18:45:42.693401
6791	5415358039	download	Chapter 1	2026-05-04 18:58:05.483109
6792	5534474259	download	Serie 3	2026-05-04 19:08:38.047151
6793	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 19:08:42.210855
6794	5534474259	download	Serie 4	2026-05-04 19:08:53.009605
6795	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 19:16:53.682924
6796	5415358039	download	Chapter 2	2026-05-04 19:57:13.156005
6797	8726316433	search	Algo	2026-05-04 20:06:45.822347
6798	8726316433	search	Algo 2	2026-05-04 20:06:59.791117
6799	6036425898	download	Chapter 1	2026-05-04 20:13:09.228895
6800	6036425898	download	Chapter 2	2026-05-04 20:13:16.519831
6801	6036425898	download	Chapter 3	2026-05-04 20:13:24.553165
6802	6036425898	download	Chapter 4	2026-05-04 20:13:30.444638
6803	6036425898	download	Chapter 5	2026-05-04 20:13:43.945607
6804	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 20:21:44.501288
6805	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-04 20:21:47.677194
6806	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-04 20:21:50.867968
6807	5534474259	download	Chapter 1 — Fac_central_chap1_Part1 (1)	2026-05-04 20:21:53.057697
6808	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-04 20:21:55.830431
6809	8726316433	download	Serie 1	2026-05-04 21:38:14.649206
6810	8726316433	download	Quiz A	2026-05-04 21:39:05.637117
6811	8726316433	download	Quiz B	2026-05-04 21:39:14.575993
6812	6167797720	search	Tp final	2026-05-04 21:54:03.538721
6813	6167797720	download	Tp final	2026-05-04 21:54:15.50217
6814	6167797720	search	Correction	2026-05-04 21:55:01.904133
6815	6167797720	search	Correction tp final architecture 1	2026-05-04 21:56:00.548639
6816	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-05 01:38:17.432836
6817	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 01:38:22.228609
6818	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 01:38:26.40839
6819	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-05 01:38:33.913286
6820	5534474259	download	Chapter 1 — Fac_Cent_Chap1_Part3	2026-05-05 01:38:44.818805
6821	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-05 01:38:54.249782
6822	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 01:39:00.049418
6823	5534474259	download	. — Corrigé. Examen.anal2.mai2024	2026-05-05 01:39:15.124992
6824	5534474259	download	Serie 4	2026-05-05 01:39:37.137787
6825	5534474259	download	List of axioms and rules	2026-05-05 01:39:59.135185
6826	5534474259	download	Serie 4	2026-05-05 01:40:09.381207
6827	5534474259	download	Serie 3	2026-05-05 01:40:12.025276
6828	5534474259	download	Serie 1	2026-05-05 01:40:14.275106
6829	5534474259	download	Solution serie 1	2026-05-05 01:40:16.624771
6830	5534474259	download	Serie 1	2026-05-05 02:01:48.324921
6831	5588471450	download	Solution serie 4	2026-05-05 02:20:03.825285
6832	5534474259	download	Serie 1	2026-05-05 02:20:52.99627
6833	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-05 02:20:57.211827
6834	5534474259	download	Serie 4	2026-05-05 02:21:42.64646
6835	5534474259	download	Serie 1	2026-05-05 02:21:50.39338
6836	5534474259	download	Chapter 1 — Fac_Cent_chap1_Part4	2026-05-05 02:21:55.351454
6837	5534474259	download	Serie 4	2026-05-05 02:21:59.544472
6838	5534474259	download	Serie 4	2026-05-05 02:22:09.776085
6839	5534474259	download	Serie 4	2026-05-05 02:23:35.579261
6840	5534474259	download	Serie 3	2026-05-05 02:31:28.261478
6841	5534474259	ban	6983086758	2026-05-05 03:14:39.730739
6842	5534474259	download	Serie 1	2026-05-05 03:14:54.428422
6843	5534474259	download	Serie 2	2026-05-05 03:15:24.560657
6844	5534474259	download	Chapter 2	2026-05-05 03:15:34.545226
6845	5534474259	download	Serie 2	2026-05-05 03:15:41.9772
6846	5534474259	download	رزنامة	2026-05-05 03:15:57.474311
6847	5534474259	download	Serie 2	2026-05-05 03:16:18.176119
6848	5534474259	download	. — 30K	2026-05-05 03:16:46.337522
6849	5534474259	download	'	2026-05-05 03:16:55.111314
6850	5534474259	download	Chapter 2	2026-05-05 03:19:06.808467
6851	5534474259	download	Chapter 2	2026-05-05 03:19:44.560032
6852	5534474259	download	Chapter 3	2026-05-05 03:19:58.866478
6853	5534474259	search	Ai	2026-05-05 03:20:09.375478
6854	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-05 03:20:15.15415
6855	5534474259	download	. — Corrigé. Examen.anal2.mai2024	2026-05-05 03:20:22.129909
6856	5534474259	download	. — Corrigé. Examen.anal2.mai2024	2026-05-05 03:21:57.398202
6857	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 03:27:47.620182
6858	5534474259	download	Serie 1	2026-05-05 03:29:42.586882
6859	5534474259	download	Skip — 04_2_Les_Flagellés_sanguicoles_et_tissulaires_LV_LC_Dr_Fellahi_A	2026-05-05 03:29:46.500761
6860	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 03:29:51.920283
6861	5534474259	download	رزنامة	2026-05-05 03:29:56.375434
6862	5534474259	download	Serie 1	2026-05-05 03:34:24.792878
6865	5534474259	download	Tp final	2026-05-05 03:34:47.712108
7142	5534474259	download	Chapter 1	2026-05-10 06:22:38.282742
7199	7574632699	download	Seri2	2026-05-10 23:29:51.576715
7311	5534474259	download	Solution serie 1	2026-05-14 00:28:12.385262
7312	5534474259	download	Serie 2	2026-05-14 00:28:15.894404
7410	5534474259	download	. — semio hg genitale	2026-05-15 02:50:03.774256
7411	5534474259	download	. — semio hg genitale	2026-05-15 02:50:11.477677
7412	5534474259	download	. — complications aigues du diabète (urgences) (1)	2026-05-15 02:50:13.567908
7413	5534474259	download	. — sémiologie-app-urinaire-interrogatoire (1)	2026-05-15 02:50:19.641484
7414	5534474259	download	. — semio hg genitale	2026-05-15 02:50:26.587813
7523	5534474259	download	. — Worksheet N°5 Discrete Random Variables	2026-05-15 12:43:45.139885
7608	5534474259	download	Exaaams	2026-05-16 05:32:30.439142
7682	5534474259	download	. — semio gyneco 2	2026-05-16 18:57:17.218862
7783	5534474259	download	Serie 3	2026-05-17 00:23:36.661546
7942	5534474259	download	Analyse — Exo2-3,serie3	2026-05-18 09:47:53.787145
6863	5534474259	download	رزنامة	2026-05-05 03:34:29.80347
6864	5534474259	download	Serie 1	2026-05-05 03:34:36.270639
6866	5534474259	download	رزنامة	2026-05-05 03:56:14.160271
6867	5534474259	download	Serie 1	2026-05-05 03:56:50.764009
6868	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-05 04:45:34.260299
6869	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-05 04:45:46.033384
6870	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-05 04:45:50.631178
6871	5534474259	download	Serie 4	2026-05-05 04:46:01.335515
6872	5534474259	download	Serie 3	2026-05-05 04:46:15.386034
6873	5534474259	download	Serie 4	2026-05-05 04:46:25.032162
6874	5534474259	download	Serie 3	2026-05-05 04:46:30.016561
6875	5534474259	download	Serie 2	2026-05-05 04:46:36.948198
6876	5534474259	download	Chapter 2	2026-05-05 04:46:43.269632
6877	5534474259	download	Toxicology — Phillip_L_Williams,_Robert_C_James	2026-05-05 04:49:52.694037
6878	5534474259	download	. — CHAPITRE_4_LA_REPRODUCTION_CHEZ_LES_ANGIOSPERMES_7dd15a063be2f8	2026-05-05 04:50:53.94483
6879	5534474259	download	. — CHAPITRE_1_LES_DIFFERENTS_TYPES_DES_TISSUS_VEGETAUX_0921e06ad36	2026-05-05 04:50:59.001943
6880	5534474259	download	بادئة للاسماء — 13.04.2026 C.02 GASTRO	2026-05-05 04:51:32.650439
6881	5534474259	download	بادئة — Sémiologie digestives vmts dysphagie	2026-05-05 04:51:44.305794
6882	5534474259	download	List of axioms and rules	2026-05-05 04:55:28.338653
6883	5534474259	download	Serie 3	2026-05-05 04:55:42.966589
6884	5534474259	download	Biochimiee	2026-05-05 05:01:17.509343
6885	5534474259	download	IRA	2026-05-05 05:01:27.722644
6886	5534474259	download	. — Corrigé. Examen.anal2.mai2024	2026-05-05 05:04:03.90532
6887	5534474259	download	IRA	2026-05-05 05:20:30.028906
6888	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-05 05:53:54.685126
6889	5534474259	download	Serie 3	2026-05-05 05:54:05.652254
6890	5534474259	download	Serie 4	2026-05-05 05:54:32.00393
6891	5534474259	download	Serie 5	2026-05-05 05:54:41.723363
6892	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 05:54:45.687043
6893	5534474259	download	Serie 1	2026-05-05 06:10:35.410222
6894	5534474259	maintenance	ON	2026-05-05 06:16:30.115864
6895	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part1	2026-05-05 06:16:51.83058
6896	5534474259	download	Serie 1	2026-05-05 06:18:38.517054
6897	5534474259	download	TD 2 solution	2026-05-05 06:18:41.025459
6898	5534474259	download	اختصارات الكيبورد	2026-05-05 06:18:46.374518
6899	5534474259	maintenance	OFF	2026-05-05 06:20:47.695159
6900	5534474259	download	Serie 3	2026-05-05 06:21:04.038197
6901	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 06:21:09.000839
6902	5534474259	download	المصادر المفتوحة	2026-05-05 06:21:14.165227
6903	5534474259	download	Serie 5	2026-05-05 06:21:29.159291
6904	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 06:21:34.316464
6905	5534474259	download	Serie 3	2026-05-05 06:21:50.706277
6906	5534474259	download	Serie 1	2026-05-05 06:33:18.327437
6907	5534474259	download	Serie 1	2026-05-05 06:33:23.115115
6908	5534474259	download	Skip — 1 Parasites nématodes et nématodoses  Jijel 2026	2026-05-05 06:33:36.714175
6909	5534474259	download	Serie 1	2026-05-05 06:33:41.852055
6910	5534474259	download	Serie 5	2026-05-05 06:34:01.670829
6911	5534474259	download	Serie 5	2026-05-05 06:34:08.587012
6912	5534474259	download	Serie 3	2026-05-05 06:34:33.479548
6913	5534474259	download	Serie 2	2026-05-05 06:34:38.107364
6914	5534474259	download	Chapter 2	2026-05-05 06:34:43.767358
6915	5534474259	download	Serie 2	2026-05-05 06:34:49.383498
6916	5534474259	download	Serie 2	2026-05-05 06:34:54.862806
6917	5534474259	download	Serie 3	2026-05-05 06:35:07.806181
6918	5534474259	download	Serie 2	2026-05-05 06:35:12.648109
6919	5534474259	download	Serie 3	2026-05-05 06:35:17.830451
6920	5534474259	download	Serie 2	2026-05-05 06:35:22.831965
6921	5534474259	download	TD 2 solution	2026-05-05 06:35:28.365701
6922	5534474259	download	Serie 2	2026-05-05 06:35:33.212928
6923	5534474259	download	Serie 1	2026-05-05 06:35:36.370174
6924	5534474259	download	TD 3 solution	2026-05-05 06:35:38.598779
6925	5534474259	download	Serie 1	2026-05-05 06:35:40.801432
6926	5534474259	download	TD 1 solution	2026-05-05 06:35:43.176675
6927	5534474259	download	TD 2 solution	2026-05-05 06:35:46.118112
6928	5534474259	download	Serie 2	2026-05-05 07:17:38.927628
6929	5534474259	download	بادئة للاسماء — 13.04.2026 C.02 GASTRO	2026-05-05 07:21:20.056624
6930	5534474259	download	Serie 1	2026-05-05 07:21:46.843421
6931	5534474259	download	بادئة للاسماء — 13.04.2026 C.02 GASTRO	2026-05-05 07:24:36.322362
6932	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 07:32:30.410053
6933	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-05 07:33:13.106302
6934	5534474259	maintenance	ON	2026-05-05 07:59:54.262015
6935	5534474259	maintenance	OFF	2026-05-05 09:07:38.663222
6936	5534474259	ban	8710836734	2026-05-05 09:31:07.715016
6937	5534474259	upload	Chaine for linked listes	2026-05-05 14:41:50.65194
6938	5534474259	download	Chaine for linked listes	2026-05-05 14:42:48.995693
6939	5534474259	upload	Play liste for linked listes	2026-05-05 14:44:06.187067
6940	5534474259	ban	7951841177	2026-05-05 18:47:08.644876
6941	5534474259	download	Solution serie 4(5/7)	2026-05-05 23:55:09.708795
6942	5534474259	download	Chapter 2 part 1	2026-05-06 01:38:27.197453
6943	5534474259	upload	Exaaams	2026-05-06 06:32:43.986591
6944	5534474259	download	Solution serie 4 (3,6,8)	2026-05-06 06:36:39.951176
6945	5534474259	download	Serie 3	2026-05-06 06:36:47.282249
6946	5534474259	download	Serie 4	2026-05-06 06:37:25.89823
6947	5534474259	download	Serie 5	2026-05-06 06:38:06.100462
6948	5534474259	download	Serie 4	2026-05-06 06:38:16.781187
6949	5534474259	download	Chapter 3	2026-05-06 06:38:23.600345
6950	5534474259	download	TD 2 solution	2026-05-06 06:38:30.083053
6951	5534474259	download	Serie 5	2026-05-06 06:38:40.631062
6952	5534474259	download	Serie 2	2026-05-06 06:39:04.351172
6953	5534474259	download	Serie 1	2026-05-06 06:39:09.224475
6954	5534474259	download	Seri1 — PW 6 corr	2026-05-06 06:39:19.641638
6955	5534474259	download	Serie 3	2026-05-06 06:52:29.640839
6956	5534474259	download	TD 1 solution	2026-05-06 06:52:41.75377
6957	5534474259	download	Serie 1	2026-05-06 06:52:46.824811
6958	5534474259	download	Serie 2	2026-05-06 06:52:54.80041
6959	5534474259	download	Serie 4	2026-05-06 06:53:02.532263
6960	5534474259	download	Serie 5	2026-05-06 06:53:08.474207
6961	5534474259	download	TD 1 solution	2026-05-06 06:53:35.506663
6962	5534474259	download	Serie 4	2026-05-06 06:53:45.409317
6963	5534474259	download	TD 2 solution	2026-05-06 06:54:22.009028
6964	5534474259	download	Serie 1	2026-05-06 06:54:24.593567
6965	5534474259	download	TD 2 solution	2026-05-06 06:58:45.43213
6966	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-06 06:58:50.75918
6967	5534474259	download	TD 1 solution	2026-05-06 07:00:32.093054
6968	5534474259	download	TD 2 solution	2026-05-06 07:01:34.13905
6969	5534474259	download	TD 1 solution	2026-05-06 07:01:39.067583
6970	5534474259	download	Chapter 3 — IntroductionToProba_Probability_Part2	2026-05-06 07:01:43.026319
6971	5534474259	download	Serie 1	2026-05-06 07:01:47.304021
6972	5534474259	download	TD 1 solution	2026-05-06 07:02:00.528819
6973	5534474259	download	Serie 1	2026-05-06 07:02:16.869389
6974	5534474259	download	Serie 2	2026-05-06 07:02:19.780153
6975	5534474259	download	Serie 1	2026-05-06 07:02:23.102583
6976	5534474259	download	Serie 2	2026-05-06 07:02:27.336239
6977	5534474259	download	رزنامة	2026-05-06 07:02:34.058654
6978	5534474259	download	TD 2 solution	2026-05-06 07:03:08.490342
6979	5534474259	download	Serie 3	2026-05-06 07:03:15.39784
6980	5534474259	download	TD 2 solution	2026-05-06 07:05:57.3712
6981	5534474259	download	Serie 2	2026-05-06 07:07:18.0142
6982	5534474259	download	TD 1 solution	2026-05-06 07:07:22.386239
6983	5534474259	download	TD 2 solution	2026-05-06 07:07:28.303599
6984	5534474259	download	Serie 1	2026-05-06 07:07:30.835064
6985	5534474259	maintenance	ON	2026-05-06 07:36:40.572905
6986	5534474259	maintenance	OFF	2026-05-06 09:32:51.872318
6987	5534474259	maintenance	ON	2026-05-06 09:32:53.137511
6988	5534474259	upload	Exams 2025/2024	2026-05-06 10:20:10.136846
6989	5534474259	upload	Exaams part 2	2026-05-06 10:20:34.470141
6990	5534474259	maintenance	OFF	2026-05-06 13:22:56.207535
6991	5534474259	upload	Solution serie 5	2026-05-06 13:47:02.881526
6992	8726316433	search	Archi sirie	2026-05-06 17:12:52.391791
6993	8726316433	download	Serie 2	2026-05-06 17:13:07.005382
6994	8726316433	download	Serie 3	2026-05-06 17:13:14.593559
6995	8726316433	search	Archi sirie 4	2026-05-06 17:14:11.797785
6996	8726316433	search	Archi sirie 1	2026-05-06 17:17:04.790916
6997	8726316433	download	Serie 1	2026-05-06 17:17:10.909687
6998	6250199428	search	Arch	2026-05-06 17:27:41.929667
6999	6250199428	download	Serie 1	2026-05-06 17:27:58.490922
7000	6250199428	download	Serie 2	2026-05-06 17:28:02.835199
7001	6250199428	download	Serie 3	2026-05-06 17:28:06.907574
7002	6250199428	download	Solution serie 4(5/7)	2026-05-06 17:29:25.4445
7003	6250199428	download	Solution serie 4(5/7)	2026-05-06 17:29:58.215175
7004	5534474259	download	Serie 1	2026-05-06 17:30:35.990706
7005	5534474259	download	Serie 2	2026-05-06 17:30:39.49388
7006	5534474259	download	Serie 4	2026-05-06 17:31:54.298335
7007	5534474259	download	Solution serie 4(5/7)	2026-05-06 17:34:34.651804
7008	5534474259	download	ملخص chapter 3	2026-05-06 17:34:47.05665
7009	5534474259	download	Exaams part 2	2026-05-06 17:34:57.963487
7010	5534474259	download	Exams 2025/2024	2026-05-06 17:35:03.75803
7011	5534474259	download	. — Corrigé. Examen.anal2.mai2024	2026-05-06 17:40:24.180108
7012	5534474259	download	Serie 4	2026-05-06 17:40:36.294375
7013	5534474259	download	Chapter 3	2026-05-06 17:40:40.184707
7014	5534474259	download	Serie 1 — ASD2_exercise6_supplementaire	2026-05-06 17:40:42.467742
7015	5534474259	download	Serie 4	2026-05-06 17:40:52.932628
7016	5104073058	download	Exaams part 2	2026-05-06 17:43:07.599448
7017	5534474259	download	Serie 1	2026-05-06 17:48:49.61415
7018	7471385119	search	Serie 2 archi	2026-05-06 18:02:18.037735
7019	7471385119	download	Serie 2	2026-05-06 18:04:46.847848
7020	7471385119	download	Serie 3	2026-05-06 18:05:09.937158
7021	5534474259	download	Serie 4	2026-05-06 18:11:57.025911
7022	7471385119	download	Solution — Corrigé Type TD N2 (1)	2026-05-06 18:20:11.148557
7023	7546140009	download	Chapter 1	2026-05-06 18:25:35.835845
7024	7546140009	download	Chapter 2	2026-05-06 18:25:49.504593
7025	7546140009	download	Chapter 3	2026-05-06 18:25:55.882343
7026	7546140009	download	Chapter 4	2026-05-06 18:25:59.870823
7027	5718477026	download	Chaine archi	2026-05-06 18:34:25.620863
7028	5534474259	download	ملخص chapter 3	2026-05-06 18:35:18.311207
7029	5534474259	download	Chapter 2	2026-05-06 18:35:43.203386
7030	5534474259	download	Chapter 3	2026-05-06 18:35:46.960323
7031	6729659968	search	Exam	2026-05-06 19:07:53.177266
7032	6729659968	download	Exams 2025/2024	2026-05-06 19:08:31.845601
7033	7546140009	download	Chapter 4	2026-05-06 19:41:22.327632
7034	5415358039	download	Serie 1	2026-05-06 19:59:56.319066
7035	5415358039	download	Serie 3	2026-05-06 20:00:02.459501
7036	5415358039	download	Serie 2	2026-05-06 20:00:13.684631
7037	5415358039	download	Serie 3	2026-05-06 20:01:37.964406
7038	7596452439	upload	Solution of serie 3	2026-05-06 21:31:25.344936
7039	7596452439	upload	Serie 4	2026-05-06 21:32:31.458206
7040	7596452439	upload	Solution of serie 4	2026-05-06 21:32:54.69092
7041	7596452439	upload	Chapter 5	2026-05-06 21:35:23.94858
7042	5415358039	download	Solution — Corrigé Type TD N1	2026-05-06 22:10:17.598703
7043	5534474259	upload	ملخص chapter 2	2026-05-06 22:49:57.394429
7044	5534474259	upload	ملخص chapter 3 +	2026-05-06 23:11:06.621614
7045	7908756476	download	Exams 2025/2024	2026-05-06 23:48:56.131721
7046	7908756476	search	exam	2026-05-06 23:51:22.953732
7047	7908756476	download	Exams (USTHB)	2026-05-06 23:51:52.851662
7048	8380139583	search	les matrices	2026-05-07 00:26:01.607361
7049	8380139583	download	Cour 6	2026-05-07 00:26:19.829834
7050	5415358039	download	Serie 2	2026-05-07 00:36:03.561809
7051	5104073058	download	ملخص chapter 3	2026-05-07 00:52:16.882965
7052	5104073058	download	ملخص chapter 2	2026-05-07 00:52:26.128464
7053	5104073058	download	Exams 2025/2024	2026-05-07 00:53:43.617426
7054	5104073058	download	Exaams part 2	2026-05-07 00:54:08.581005
7055	5104073058	download	ملخص chapter 2	2026-05-07 00:55:32.53325
7056	5534474259	download	Solution serie 5	2026-05-07 06:38:45.835694
7057	5534474259	download	Exams 2025/2024	2026-05-07 06:40:57.548498
7058	5534474259	search	Algo	2026-05-07 08:42:37.404445
7059	5534474259	download	. — Chapter IV. Linked Lists (Session N°6.1)	2026-05-07 08:42:40.493751
7060	7194386140	search	Analyse	2026-05-07 13:44:16.050532
7061	5534474259	add_admin	ID: 8726316433	2026-05-07 18:02:44.086756
7062	5534474259	download	Exaams part 2	2026-05-07 18:04:34.830832
7063	5534474259	download	Exam 1 algo 1	2026-05-08 00:01:21.495132
7064	5534474259	download	Exam 2024/205	2026-05-08 00:01:24.244804
7065	5534474259	download	Exam 2024/205	2026-05-08 00:01:28.168401
7066	6018795251	search	كاين سيري 4 ارشي؟	2026-05-08 18:30:17.628837
7067	6720124032	search	archi	2026-05-08 20:42:20.54406
7068	6720124032	download	Exaams part 2	2026-05-08 20:42:54.254463
7143	5534474259	download	Chapter 3 — polycopié Maths2. ZENKOUFI Lilia	2026-05-10 06:22:43.749753
7144	5534474259	download	Solution serie 1	2026-05-10 06:23:02.351952
7200	7574632699	download	Serie 3	2026-05-10 23:31:33.067447
7203	6530364511	download	Chapter 2	2026-05-10 23:33:25.339581
7205	7574632699	download	Solution serie 5	2026-05-10 23:34:03.366203
7313	5534474259	download	Serie 3	2026-05-14 00:28:19.101793
7416	5534474259	download	. — semio hg genitale	2026-05-15 02:50:50.532201
7524	5415358039	download	Chapter 3	2026-05-15 13:22:17.811847
7609	7746046007	download	. — Chapter IV. Linked Lists (Session N°2)	2026-05-16 06:02:02.71584
7683	5534474259	download	. — Worksheet N°6 Common Discrete Probability	2026-05-16 18:57:28.909095
7684	5534474259	download	. — semio hg genitale	2026-05-16 18:57:34.894101
7784	5534474259	download	. — semio hg genitale	2026-05-17 00:23:43.061471
7943	5534474259	download	Serie 4	2026-05-18 11:31:27.33938
\.


--
-- Data for Name: message_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_templates (id, name, type, content, file_id, created_at) FROM stdin;
67	اذكار الصباح	photo		AgACAgQAAxkBAAJR22nYvmhVVPvbxcz0xmISi-QLLEnuAAI7DWsbopLJUh_EaMpoOLn9AQADAgADeQADOwQ	2026-04-10 09:10:01.248877
71	اذكار المساء	text	🌙 أذكار المساء\n\nاللّهـمَّ أَنْتَ رَبِّي لا إلهَ إِلاّ أَنْتَ، خَلَقْتَني وَأَنا عَبْدُك، وَأَنا عَلى عَهْدِكَ وَوَعْدِكَ ما اسْتَطَعْت، أَعُوذُ بِكَ مِنْ شَرِّ ما صَنَعْت، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبي فَاغْفِرْ لي، فَإِنَّهُ لا يَغْفِرُ الذُّنُوبَ إِلاّ أَنْتَ.\n\nاللّهـمَّ إني أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلائِكَتَكَ، وَجَميعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لا إلهَ إِلاّ أَنْتَ، وَحْدَكَ لا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ. (4 مرات)\n\nاللّهـمَّ ما أَمْسى بي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لا شَريكَ لَكَ، فَلَكَ الحَمْدُ وَلَكَ الشُّكْرُ.\n\nحَسْبِيَ اللَّهُ لا إِلهَ إِلاّ هُوَ، عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ العَرْشِ العَظِيمِ. (7 مرات)\n\nبِسْمِ اللهِ الَّذي لا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأرْضِ وَلا فِي السَّماءِ وَهُوَ السَّمِيعُ العَلِيمُ. (3 مرات)\n\nرَضِيتُ بِاللَّهِ رَبًّا، وَبِالإِسْلامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا. (3 مرات)\n\nسُبْحَانَ اللَّهِ وَبِحَمْدِهِ. (100 مرة)\n\nاللّهـمَّ عافِني في بَدَني، اللّهـمَّ عافِني في سَمْعي، اللّهـمَّ عافِني في بَصَري، لا إلهَ إِلاّ أَنْتَ. (3 مرات)\n\nأَعُوذُ بِكَلِماتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ ما خَلَقَ. (3 مرات)\n\nاللّهـمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّد.		2026-04-11 22:41:50.856754
106	اها	text	تت		2026-05-20 16:20:09.363756
107	Gg	photo		AgACAgQAAxkBAAL5WGoO6aR3PBIBHJYZX5MKZrmGDy31AAJ3DWsbyll5UPWW0Jie5AeWAQADAgADeQADOwQ	2026-05-21 11:16:53.027147
108	وو	photo	السلام عليكم ورحمة الله وبركاته،\n\nمع اقتراب عيد الأضحى المبارك، يسعدنا أن نتقدم إليكم بأصدق التهاني وأطيب الأمنيات.\nنسأل الله أن يجعل أيامكم القادمة مليئة بالفرح والطمأنينة، وأن يعيده عليكم وعلى أحبابكم بالخير واليُمن والبركات.\n\nكل عام وأنتم بخير 🌙	AgACAgQAAxkBAAL7yWoVQydglBrmO6L3SoMNB-srBdetAAIhDmsbLo2xUIFFUXt3DYxeAQADAgADeAADOwQ	2026-05-26 06:53:42.42446
109	هذا هو سبب الألآم المبرحة لسرطان العظام 💔	text	هذا هو سبب الألآم المبرحة لسرطان العظام 💔		2026-05-29 13:28:55.987428
110	عوو	photo	هذا هو سبب الألآم المبرحة لسرطان العظام 💔	AgACAgQAAxkBAAL_mWoZlGQeQpzFFGxwsGVqwIV-ClshAAK4DmsbtV_RUO-WgNyF5EEPAQADAgADeQADOwQ	2026-05-29 13:29:20.909446
\.


--
-- Data for Name: million_answers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.million_answers (game_id, user_id, answer) FROM stdin;
16	5534474259	B
17	5534474259	B
18	5534474259	A
19	5534474259	B
20	5534474259	B
22	5534474259	C
23	5534474259	C
24	5534474259	B
25	5534474259	C
26	5534474259	B
27	5534474259	B
29	5534474259	B
32	5534474259	B
33	5534474259	C
34	8726316433	B
\.


--
-- Data for Name: million_games; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.million_games (id, chat_id, owner_id, owner_name, state, players, current_q, prize, msg_id, created_at, played_ids, current_q_id) FROM stdin;
\.


--
-- Data for Name: million_players; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.million_players (session_id, user_id, first_name, username, level, prize, lifelines, is_alive, answer_time) FROM stdin;
\.


--
-- Data for Name: million_questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.million_questions (id, question, option_a, option_b, option_c, option_d, correct, media_file_id, media_type, difficulty, is_active, created_at, used_count) FROM stdin;
1	كم عدد ولايات الجزائر	23	48	58	69	C	\N	\N	1	0	2026-05-04 12:06:08.573796	0
2		1	2	لا يوجد	منعرف	A	AgACAgQAAxkBAALId2n4jj4KdlH8zRDAgNh_w3ZjyAlDAAI_D2sba0fIUxyR0CUSifqeAQADAgADeQADOwQ	photo	2	0	2026-05-04 12:17:46.132706	0
3	كم عدد ولايات الجزائر	23	68	69	58	D	\N	\N	1	1	2026-05-04 13:38:31.466875	0
4	كم عدد لترات الدم عند الانسان البالغ	4	5	6	10	B	\N	\N	2	1	2026-05-04 13:39:14.849536	0
5	كم عدد عضلات الانسان ؟	600	650	630	100	C	\N	\N	2	1	2026-05-04 15:23:57.067857	0
6	كم عدد القارات ؟	5	6	4	7	B	\N	\N	1	1	2026-05-04 18:26:00.310757	0
7	من كان بطل العالم لكرة القدم عام 1990 ؟	ايطاليا	برازيل	المانيا	الارجنتين	A	\N	\N	3	1	2026-05-04 19:03:09.541178	0
8	ماهي عاصمة استراليا	سيدني	بيرث	كانبيرا	ملبورن	C	\N	\N	2	1	2026-05-05 02:08:15.935249	0
\.


--
-- Data for Name: million_scores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.million_scores (user_id, first_name, username, best_prize, total_games, wins, total_prize, updated_at) FROM stdin;
\.


--
-- Data for Name: million_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.million_sessions (id, chat_id, status, current_q, started_at, ended_at) FROM stdin;
\.


--
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notes (id, title, content, media_file_id, media_type, url, is_pinned, is_deleted, created_by, created_at) FROM stdin;
1	اهلا	اهلا	\N	text	\N	0	1	5534474259	2026-05-18 08:51:44.1956
2	ايمايلات اساتذة	ايمايلات	\N	text	\N	0	1	5534474259	2026-05-18 08:52:35.101662
4		Foto	\N	text	\N	0	1	5534474259	2026-05-18 08:54:37.317672
3	ferkous.chokri@univ-guelma.dz	Prof gmails	\N	text	\N	1	1	5534474259	2026-05-18 08:53:27.094111
5	اهلا	اهلا	\N	text	\N	1	1	5534474259	2026-05-29 13:16:51.360796
6	رزنامة	رزنامة	\N	text	\N	0	1	5534474259	2026-05-29 13:17:16.426797
7	ا	اشعار	\N	text	\N	0	1	5534474259	2026-05-29 13:17:59.724256
8	📣 إشعار\n\nالسلام عليكم ورحمة الله وبركاته،\n\nمع اقتراب عيد الأضحى المبارك، يسعدنا أن نتقدم إليكم بأصدق التهاني وأطيب الأمنيات.\nنسأل الله أن يجعل أيامكم القادمة مليئة بالفرح والطمأنينة، وأن يعيده عليكم وعلى أحبابكم بالخير واليُمن والبركات.\n\nكل عام وأنتم بخير 🌙	📣 إشعار\n\nالسلام عليكم ورحمة الله وبركاته،\n\nمع اقتراب عيد الأضحى المبارك، يسعدنا أن نتقدم إليكم بأصدق التهاني وأطيب الأمنيات.\nنسأل الله أن يجعل أيامكم القادمة مليئة بالفرح والطمأنينة، وأن يعيده عليكم وعلى أحبابكم بالخير واليُمن والبركات.\n\nكل عام وأنتم بخير 🌙	\N	text	\N	0	1	5534474259	2026-05-29 13:18:15.476639
9	📣 إشعار\n\nالسلام عليكم ورحمة الله وبركاته،\n\nمع اقتراب عيد الأضحى المبارك، يسعدنا أن نتقدم إليكم بأصدق التهاني وأطيب الأمنيات.\nنسأل الله أن يجعل أيامكم القادمة مليئة بالفرح والطمأنينة، وأن يعيده عليكم وعلى أحبابكم بالخير واليُمن والبركات.\n\nكل عام وأنتم بخير 🌙	📣 إشعار\n\nالسلام عليكم ورحمة الله وبركاته،\n\nمع اقتراب عيد الأضحى المبارك، يسعدنا أن نتقدم إليكم بأصدق التهاني وأطيب الأمنيات.\nنسأل الله أن يجعل أيامكم القادمة مليئة بالفرح والطمأنينة، وأن يعيده عليكم وعلى أحبابكم بالخير واليُمن والبركات.\n\nكل عام وأنتم بخير 🌙	\N	text	\N	0	1	5534474259	2026-05-29 13:18:50.57246
10	عيد	عيد الاضحى	\N	text	\N	0	1	5534474259	2026-05-29 13:19:08.011437
11	عيد	📣 إشعار\n\nالسلام عليكم ورحمة الله وبركاته،\n\nمع اقتراب عيد الأضحى المبارك، يسعدنا أن نتقدم إليكم بأصدق التهاني وأطيب الأمنيات.\nنسأل الله أن يجعل أيامكم القادمة مليئة بالفرح والطمأنينة، وأن يعيده عليكم وعلى أحبابكم بالخير واليُمن والبركات.\n\nكل عام وأنتم بخير 🌙	\N	text	\N	1	0	5534474259	2026-05-29 13:19:30.164659
\.


--
-- Data for Name: poll_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.poll_options (id, poll_id, option_text, emoji, votes, "position") FROM stdin;
1	1	Hshshs	🔵	0	1
2	1	Dbnd	🔵	1	2
4	2	Nxnsns	🔵	0	2
3	2	Bsbs	🔵	1	1
6	3	h	5	0	2
7	3	0h	1	0	3
5	3	h	5	1	1
16	7	دراسة 8 ساعات ❤️‍🔥	🔵	0	2
17	7	دراسة 10 ساعات 🔥	🔵	0	3
15	7	دراسة 6 ساعات 🤍	🔵	1	1
41	17	نص نص ⬜️	🔵	0	2
42	17	Mn9drch 🟥	🔵	0	3
40	17	️ رانا معاك	✅	1	1
\.


--
-- Data for Name: poll_votes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.poll_votes (poll_id, option_id, user_id, voted_at) FROM stdin;
1	2	5534474259	2026-04-25 07:37:02.069895
2	3	5534474259	2026-04-25 07:38:54.143348
3	5	5534474259	2026-04-25 07:41:12.679019
7	15	5534474259	2026-04-25 08:00:07.004145
17	40	5534474259	2026-04-25 22:03:08.683661
\.


--
-- Data for Name: polls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.polls (id, chat_id, created_by, question, media_file_id, media_type, message_id, is_closed, created_at) FROM stdin;
1	-1003533593172	5534474259	كم عمرك	\N	\N	1392	0	2026-04-25 07:28:44.085253
2	-1003533593172	5534474259	Dbsbsbd	\N	\N	1399	1	2026-04-25 07:38:46.953715
3	-1003533593172	5534474259	كم درستو من ساعة لبارحة	\N	\N	1407	1	2026-04-25 07:41:05.82611
17	-1003606638684	5534474259	غدوة كامل \n\n\n\nصلي فجرك و صلي على نبي 100 مرة \n\n\n\n\nاكتب قدر المستطاع كامل  عيوب لي فيك باه مع لوقت تحاول تلقى حل شيء فشيء \nأخلاقيا ولا فصحة تاعك ولا فطريقي كلام ولا....الخ\n\n"استغفر الله العظيم لي ولوالدي وللمؤمنين والمؤمنات والمسلمين والمسلمات الاحياء منهم والاموات "\n\n \n\nحل مواضيع \n\nشوف بودكاست	\N	\N	2222	0	2026-04-25 22:03:02.32513
7	-1003533593172	5534474259	𝙽𝚍𝚒𝚛𝚘𝚘𝚘 𝚝𝚊7𝚏𝚒 𝚕𝚢𝚘𝚞𝚖 𝚝𝚎3 9𝚛𝚊𝚢𝚊 ??	\N	\N	1430	1	2026-04-25 07:59:30.083517
\.


--
-- Data for Name: ratings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ratings (user_id, file_id, rating) FROM stdin;
5534474259	70	4
5534474259	147	5
5534474259	149	5
5534474259	145	3
5534474259	111	4
5534474259	107	4
5534474259	157	4
5534474259	25	5
5534474259	15	4
5534474259	85	5
5534474259	68	4
5534474259	153	5
8726316433	150	4
5534474259	220	5
8726316433	223	5
7178011134	41	5
5534474259	178	5
5534474259	74	5
5534474259	33	4
5534474259	32	3
5534474259	214	4
5534474259	31	5
5534474259	165	4
5534474259	67	3
5534474259	283	5
5534474259	191	3
5534474259	20	5
5534474259	18	4
8726316433	31	4
5534474259	152	5
5534474259	16	5
5534474259	89	4
5534474259	166	4
5534474259	61	5
5534474259	160	5
5534474259	8	5
5534474259	80	5
5534474259	55	5
5534474259	58	5
8726316433	158	2
5534474259	54	2
5534474259	136	5
5415358039	222	4
5534474259	9	5
5534474259	30	5
5534474259	24	4
5534474259	169	5
5534474259	19	5
5534474259	155	5
5534474259	215	5
5534474259	79	5
5534474259	66	5
5534474259	69	5
5534474259	162	5
5534474259	57	3
5534474259	22	5
5534474259	21	5
5534474259	114	5
5534474259	183	4
5534474259	184	5
5534474259	185	5
5534474259	86	4
5534474259	108	5
5534474259	27	3
5534474259	81	4
5534474259	223	4
5534474259	41	5
5534474259	73	4
5534474259	72	5
5534474259	83	5
5534474259	237	4
5534474259	232	5
5534474259	224	5
6040761848	162	5
5534474259	75	3
5534474259	172	3
5534474259	71	5
5534474259	34	5
5534474259	23	2
5534474259	176	3
5534474259	56	4
5534474259	65	5
5534474259	78	4
5534474259	175	3
5534474259	189	5
5534474259	4	4
5534474259	88	4
5534474259	124	4
5534474259	90	5
5534474259	193	5
5534474259	146	5
5534474259	118	3
8726316433	152	4
5534474259	209	3
6810868802	257	5
5534474259	12	5
5534474259	190	4
5534474259	208	4
5534474259	210	4
5534474259	11	3
5534474259	17	4
5534474259	216	5
5534474259	240	4
5534474259	211	5
5534474259	222	4
5534474259	62	4
5534474259	225	4
5534474259	257	3
5534474259	229	5
5534474259	3	5
5534474259	231	4
5534474259	192	5
5534474259	230	3
5534474259	248	3
5534474259	194	3
5534474259	10	5
5534474259	29	4
5534474259	250	3
5534474259	249	4
7174608517	254	5
5534474259	247	3
5534474259	255	4
5534474259	251	5
5534474259	261	5
5534474259	5	4
5534474259	258	5
8726316433	115	5
5534474259	263	3
5534474259	260	5
5534474259	256	4
5534474259	242	5
5534474259	115	5
5534474259	213	3
5534474259	275	3
5534474259	273	5
5534474259	26	4
5534474259	284	5
5534474259	278	5
5534474259	181	5
5534474259	269	4
6729659968	284	5
5534474259	279	3
5534474259	290	4
5534474259	276	5
5534474259	286	4
5534474259	212	5
5534474259	280	4
5534474259	87	3
5534474259	60	5
5534474259	282	4
5534474259	226	4
5534474259	271	5
5534474259	234	4
5534474259	110	3
5534474259	150	4
8726316433	136	5
5534474259	259	4
5534474259	285	4
5534474259	139	4
5534474259	148	4
5534474259	158	4
5534474259	287	5
5534474259	13	3
5534474259	7	4
5534474259	109	2
5534474259	151	2
5534474259	125	4
5534474259	64	5
5534474259	156	3
5534474259	113	4
5534474259	227	5
5534474259	221	5
5534474259	288	5
5534474259	204	5
5534474259	82	4
5534474259	112	3
5534474259	177	5
5534474259	174	3
5534474259	143	5
5534474259	76	3
5534474259	233	5
5534474259	303	4
5534474259	304	4
5534474259	314	3
5534474259	305	4
5534474259	390	5
5534474259	312	4
5534474259	277	5
5534474259	238	4
5534474259	239	4
5534474259	315	4
5534474259	320	4
5534474259	310	5
5534474259	319	5
5534474259	321	4
5534474259	311	4
5534474259	317	3
5534474259	336	4
5534474259	335	4
5534474259	334	4
5534474259	341	4
5534474259	353	4
5534474259	340	5
5534474259	356	3
5534474259	338	5
5534474259	362	5
5534474259	360	4
5534474259	371	5
5534474259	366	5
5534474259	365	4
5534474259	367	4
5534474259	361	4
8726316433	260	5
8726316433	332	5
5534474259	363	5
5534474259	368	5
8726316433	4	5
8726316433	6	5
8726316433	7	5
5534474259	326	5
5534474259	325	5
5534474259	324	5
5534474259	323	5
5534474259	349	4
5534474259	348	5
5534474259	346	5
5534474259	364	5
5534474259	372	5
5534474259	359	5
5534474259	358	4
5534474259	357	4
5534474259	337	5
5534474259	342	5
5534474259	369	3
6834163411	416	4
6217677522	153	5
5534474259	389	4
5534474259	377	4
5534474259	411	5
5534474259	409	4
5534474259	410	4
5534474259	399	3
5534474259	309	4
5534474259	387	4
5534474259	412	4
5534474259	414	4
5534474259	398	4
5534474259	415	3
5534474259	374	4
6530364511	391	2
5534474259	306	2
5534474259	380	5
6530364511	348	5
8726316433	221	5
8726316433	33	5
8726316433	283	5
8726316433	285	5
5534474259	373	5
5534474259	281	4
5534474259	245	4
5534474259	381	5
8726316433	204	5
5534474259	308	4
5534474259	400	3
5534474259	28	4
5534474259	407	4
8726316433	222	5
5534474259	264	5
5534474259	393	3
5534474259	406	3
5534474259	382	3
5534474259	376	4
5534474259	416	4
5534474259	403	5
8726316433	286	5
8726316433	287	5
5534474259	385	3
8726316433	288	5
5534474259	352	4
8726316433	289	5
5534474259	265	4
5534474259	370	5
5534474259	218	4
5534474259	405	5
8726316433	379	4
8726316433	227	4
8726316433	391	3
5534474259	401	4
5534474259	417	4
5534474259	375	4
5534474259	228	3
5534474259	272	4
5534474259	313	4
5534474259	252	5
5534474259	388	4
5534474259	77	3
5534474259	404	5
5534474259	391	4
5534474259	59	2
5534474259	379	3
5534474259	408	5
5534474259	164	3
5534474259	289	4
5534474259	243	4
6810868802	226	5
5534474259	235	5
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reports (id, file_id, user_id, reason, status, created_at) FROM stdin;
7	41	7178011134	inappropriate	dismissed	2026-04-09 08:48:06.451166
6	80	5534474259	wrong	dismissed	2026-04-09 08:30:03.052427
5	23	5534474259	wrong	dismissed	2026-04-09 00:54:23.606942
4	68	5534474259	duplicate	dismissed	2026-04-09 00:44:39.717614
3	3	5534474259	corrupted	dismissed	2026-04-08 23:41:07.60228
2	3	5534474259	inappropriate	dismissed	2026-04-08 23:41:01.798936
1	147	5534474259	broken	dismissed	2026-04-08 23:36:16.337317
9	26	5534474259	wrong	dismissed	2026-04-09 12:09:14.185354
8	3	5534474259	wrong	dismissed	2026-04-09 10:37:20.368963
10	41	5534474259	corrupted	dismissed	2026-04-09 13:02:45.450938
11	166	5534474259	corrupted	dismissed	2026-04-09 13:40:16.224701
14	24	5534474259	broken	dismissed	2026-04-09 13:53:38.512106
13	22	5534474259	corrupted	dismissed	2026-04-09 13:53:29.40941
12	22	5534474259	duplicate	dismissed	2026-04-09 13:53:18.01822
19	65	5534474259	wrong	dismissed	2026-04-09 13:58:22.051275
18	66	5534474259	inappropriate	dismissed	2026-04-09 13:58:17.747657
17	69	5534474259	duplicate	dismissed	2026-04-09 13:58:11.948532
16	71	5534474259	wrong	dismissed	2026-04-09 13:58:06.424309
15	66	5534474259	broken	dismissed	2026-04-09 13:58:01.698099
20	23	5534474259	duplicate	dismissed	2026-04-09 19:29:01.489445
22	32	5534474259	wrong	dismissed	2026-04-10 06:55:49.747015
21	147	5534474259	corrupted	dismissed	2026-04-10 05:33:50.606866
23	71	5534474259	duplicate	dismissed	2026-04-10 08:33:45.278753
25	166	5534474259	inappropriate	dismissed	2026-04-10 08:53:04.266705
24	67	5534474259	wrong	dismissed	2026-04-10 08:52:42.719442
26	70	5534474259	duplicate	dismissed	2026-04-10 08:57:41.254691
31	86	5534474259	wrong	dismissed	2026-04-10 09:14:18.419049
30	87	5534474259	inappropriate	dismissed	2026-04-10 09:14:13.150821
29	85	5534474259	broken	dismissed	2026-04-10 09:14:09.012223
28	87	5534474259	wrong	dismissed	2026-04-10 09:14:01.54867
27	136	8726316433	inappropriate	dismissed	2026-04-10 09:04:56.989053
33	68	5534474259	corrupted	dismissed	2026-04-10 10:23:41.062076
32	149	5534474259	wrong	dismissed	2026-04-10 10:23:10.308531
34	26	5534474259	wrong	dismissed	2026-04-11 11:27:58.783037
35	158	5534474259	wrong	dismissed	2026-04-11 12:41:17.492701
37	23	5534474259	wrong	dismissed	2026-04-11 17:22:07.394094
36	114	5534474259	wrong	dismissed	2026-04-11 16:40:56.345181
38	174	5534474259	wrong	dismissed	2026-04-11 19:04:26.702196
39	23	5534474259	corrupted	dismissed	2026-04-11 20:39:37.752519
40	26	5534474259	wrong	dismissed	2026-04-12 10:44:56.502601
41	174	5534474259	corrupted	dismissed	2026-04-12 21:38:14.607365
42	108	5534474259	corrupted	dismissed	2026-04-13 09:18:06.093169
43	211	5534474259	duplicate	dismissed	2026-04-17 05:11:16.528475
45	210	5534474259	broken	dismissed	2026-04-17 10:16:51.832879
44	28	5534474259	wrong	dismissed	2026-04-17 05:12:12.259476
47	41	5534474259	wrong	dismissed	2026-04-17 13:56:51.355093
46	11	5534474259	wrong	dismissed	2026-04-17 12:04:00.613885
48	26	5534474259	inappropriate	dismissed	2026-04-18 01:47:57.05212
50	28	5534474259	wrong	dismissed	2026-04-18 08:14:27.307731
49	193	5534474259	wrong	dismissed	2026-04-18 06:57:50.779334
51	86	5534474259	duplicate	dismissed	2026-04-18 16:02:30.349522
52	232	5534474259	corrupted	dismissed	2026-04-18 21:57:58.465671
53	232	5534474259	corrupted	dismissed	2026-04-18 23:29:55.594079
58	28	5534474259	wrong	dismissed	2026-04-20 07:39:39.610728
57	213	5534474259	corrupted	dismissed	2026-04-20 01:23:10.072099
56	26	5534474259	broken	dismissed	2026-04-19 21:23:18.126872
55	216	5534474259	corrupted	dismissed	2026-04-19 21:22:37.474013
54	212	5534474259	wrong	dismissed	2026-04-19 19:57:55.339549
60	223	5534474259	wrong	dismissed	2026-04-21 19:14:34.011404
59	112	5534474259	broken	dismissed	2026-04-20 20:34:45.816636
61	212	5534474259	wrong	dismissed	2026-04-21 21:04:11.276717
62	143	5534474259	corrupted	dismissed	2026-04-22 08:35:15.63414
64	234	5534474259	broken	dismissed	2026-04-22 22:05:02.592381
63	230	5534474259	corrupted	resolved	2026-04-22 22:04:23.089765
65	234	5534474259	broken	dismissed	2026-04-22 22:05:31.681016
68	4	5534474259	inappropriate	dismissed	2026-04-23 01:24:08.967258
67	5	5534474259	duplicate	dismissed	2026-04-23 01:24:02.718472
66	87	5534474259	wrong	dismissed	2026-04-23 01:23:55.327406
69	235	5534474259	corrupted	resolved	2026-04-23 12:16:48.047501
70	234	5534474259	wrong	dismissed	2026-04-28 02:05:14.664876
73	275	5534474259	inappropriate	dismissed	2026-05-02 15:14:04.69439
72	258	5534474259	duplicate	dismissed	2026-05-02 15:07:51.217118
71	148	5534474259	corrupted	dismissed	2026-04-28 22:48:45.893294
75	362	5534474259	wrong	dismissed	2026-05-04 07:53:10.602315
74	33	5534474259	duplicate	dismissed	2026-05-03 00:21:42.072345
76	212	5534474259	corrupted	rejected	2026-05-04 12:33:40.749312
77	190	5534474259	corrupted	resolved	2026-05-07 08:56:01.955972
80	64	5534474259	duplicate	resolved	2026-05-07 08:56:40.328715
79	269	5534474259	broken	resolved	2026-05-07 08:56:28.325959
78	190	5534474259	duplicate	resolved	2026-05-07 08:56:20.067284
83	405	5534474259	wrong	rejected	2026-05-16 19:22:36.976354
82	348	6530364511	wrong	rejected	2026-05-10 11:56:01.073042
81	396	5534474259	corrupted	rejected	2026-05-09 22:35:43.209683
84	258	5534474259	corrupted	resolved	2026-05-19 01:01:47.970398
85	404	5534474259	wrong	dismissed	2026-05-19 07:01:05.163682
\.


--
-- Data for Name: required_channels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.required_channels (id, channel_id, channel_name, channel_url, added_at, is_active) FROM stdin;
18	تحديثاث	البوت	\nhttps://t.me/lwx23	2026-05-30 16:09:14.042068	1
3	-1003571265208	 اخر تحديثات 𝑬𝒅𝒖𝑴𝒂𝒔𝒕𝒆𝒓	https://t.me/lwx23	2026-05-02 23:46:57.83414	0
17	@lwx23	wael	https://t.me/lwx23	2026-05-17 00:40:42.33423	1
1	@lweees23	-1003571265208 اخر تحديثات 𝑬𝒅𝒖𝑴𝒂𝒔𝒕𝒆𝒓	https://t.me/lwx23	2026-05-02 23:23:15.22359	0
10	https://t.me/SH_48_3amek_2026_nadjeh	https://t.me/SH_48_3amek_2026_nadjeh	https://t.me/SH_48_3amek_2026_nadjeh	2026-05-05 03:28:41.100674	0
11	study	study	https://t.me/SH_48_3amek_2026_nadjeh	2026-05-05 03:29:26.383636	0
12	Crash	medicalhttps://t.me/Crash_medical15	https://t.me/Crash	2026-05-05 07:17:27.084813	0
13	medcine	medcine	https://t.me/Crash_medical15	2026-05-05 07:21:11.800418	0
14	groups	ss	https://t.me/+AwBOxAbMvO0zNDlk	2026-05-05 07:31:28.313543	0
15	اخر	تحديثات 𝑬𝒅𝒖𝑴𝒂𝒔𝒕𝒆𝒓	https://t.me/lwx23	2026-05-05 14:47:06.653879	0
16	تحديثات	تحديثات	https://t.me/lwx23	2026-05-07 01:58:20.366517	0
\.


--
-- Data for Name: scheduled_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scheduled_messages (id, template_id, target, specialty_id, send_at, sent, created_at) FROM stdin;
\.


--
-- Data for Name: semesters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.semesters (id, year_id, name, is_deleted) FROM stdin;
1	1	Sem 2	0
3	1	Gmails	1
4	2	Sem 1	0
5	3	Insta	0
6	4	Sem 1	1
7	4	Sem 2	1
8	4	Sem 3	1
9	4	Exaaams	1
13	8	Sem 1	0
14	8	Sem 2	0
17	12	Semio	0
18	12	Physiopath	0
19	12	Radio	0
20	12	Biochimie	0
21	13	U3	1
22	13	S2	1
23	13	S2	0
24	14	Sem 2	0
15	10	Sem 3	1
16	10	Sem 4	1
28	19	☜ قسم كتب علم النفس	1
27	18	اعلام ألي	0
10	4	شعبة علوم تجريبية	1
26	4	شعبة تسيير واقتصاد	1
12	4	شعبة تقني رياضي	1
11	4	شعبة لغات اجنبية	1
2	1	Sem 1	0
29	20	Ss	0
30	0	Aa	1
33	22	Sem 2	0
35	24	Sem 2	0
36	24	Sem 1	0
34	23	Sem 2	0
31	18	طب	1
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (key, value) FROM stdin;
maintenance	false
\.


--
-- Data for Name: specialties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.specialties (id, name, is_deleted) FROM stdin;
2	Low	1
3	Hacked apps	1
5	Medcine	1
7	Medcin	1
8	Médecine	0
9	Med	1
10	Test	1
1	Computer science	0
11	Math	1
6	Biology	1
13	كتب و موسوعات	0
4	بكالوريات	1
14	Ssss	1
15	Sss	1
17	Maths	0
18	Science natural et la vie	0
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subjects (id, semester_id, name, is_deleted) FROM stdin;
2	2	Analyse 1	0
3	2	Algrebra 1	0
4	2	OS	0
5	2	Stucture of machine	0
6	2	Electronique	0
7	1	Algo 2	0
8	1	Analyse 2	0
9	1	Algebra 2	0
11	1	Archi 1	0
12	1	Logic	0
13	2	Writing and skills	0
14	4	Low	0
15	5	Insta pro	0
16	9	mathématiques	0
17	9	Sciences expérimentales	0
18	9	physique	0
19	10	رياضيات	0
20	10	لغة عربية	0
21	10	علوم تجريبية	0
22	10	فرنسية	0
23	10	فيزياء	0
24	10	تربية اسلامية	0
25	10	انجليزية	0
29	17	Cour 1	0
30	21	Sémiologie	1
31	22	U3 endo	1
32	22	Sémiologie	1
33	22	U3 endo	1
34	23	U3 endo	0
35	24	Algo 2	0
37	24	Analyse 2	0
38	24	Algebra 2	0
39	24	Python 2	0
40	24	Probabilités et statistiques 2	0
41	24	Physique 2	0
42	26	محاسبة	0
43	26	اقتصاد	0
44	26	قانون	0
45	26	رياضيات	0
46	26	تاريخ و جغرافيا	0
47	26	شريعة	0
48	26	انجليزية	0
49	26	فرنسية	0
50	26	فلسفة	0
51	10	تاريخ و جغرافيا	0
52	10	فلسفة	0
53	2	مصادر مهمة ✅️	1
55	15	Music	1
28	15	Algebra 3	1
26	15	Algo 3	1
27	15	Analyse 3	1
56	27	التقنية و البرمجة	0
58	28	كتب مهمة	1
59	1	Oral	0
60	29	Ss	1
61	23	Parasitologie	0
62	2	كتب و مصادر مهمة	0
63	23	Resourses	0
54	1	Sources	0
57	1	🗓 calendar	0
65	23	U3 digestive	0
67	33	Pneumo	0
69	33	Neuro	0
70	33	Cardio	0
71	33	Hémato	0
72	33	maladies	0
73	33	inffeec	0
74	35	MTT	0
75	35	TCE	0
76	35	sives	0
77	35	chimie	0
78	35	physique	0
79	35	biologie animal	0
80	35	biologie vègetale	0
81	36	mtt	0
82	36	tce	0
83	36	chimie	0
84	36	math	0
85	36	biologie cellular	0
86	36	geology	0
87	36	HSB	0
68	34	Math	1
89	34	Analysis 2	0
90	34	python	0
92	34	algebra 2	0
93	34	probability &statistics	0
94	34	AI	0
88	34	Physics 2	0
91	34	Algorithm 2	0
100	34	Cancel	1
10	1	🧮 Proba	0
1	2	👨‍💻 algo 1	0
64	31	كتب الصيدلة	1
\.


--
-- Data for Name: user_points; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_points (user_id, total_points, downloads_count, ratings_count, comments_count, streak_days, last_activity_date, updated_at) FROM stdin;
1087968824	14	0	0	0	14	2026-05-26	2026-05-26 18:49:35.226028
5491382024	2	0	0	0	2	2026-05-08	2026-05-08 20:48:44.663929
5724898709	1	0	0	0	1	2026-05-05	2026-05-05 05:04:00.722654
7178011134	3	0	0	0	3	2026-05-02	2026-05-02 15:43:28.695527
8264518538	25	1	0	0	20	2026-05-21	2026-05-21 13:54:19.279297
8271547832	1	0	0	0	1	2026-05-04	2026-05-04 19:47:04.396904
8365743969	1	0	0	0	1	2026-05-01	2026-05-01 08:51:41.571044
8069264500	2	0	0	0	2	2026-05-05	2026-05-05 21:36:09.595402
8141424235	6	1	0	0	1	2026-05-01	2026-05-01 22:12:59.726416
5104073058	263	21	0	0	158	2026-05-17	2026-05-17 00:05:32.318145
8611614493	12	0	0	0	12	2026-05-02	2026-05-02 08:29:53.822655
6624245542	1	0	0	0	1	2026-05-03	2026-05-03 16:49:34.193343
7537692068	1	0	0	0	1	2026-05-01	2026-05-01 16:09:38.761149
6488864330	1	0	0	0	1	2026-05-04	2026-05-04 16:07:04.521695
7128896646	8	1	0	0	3	2026-05-08	2026-05-08 19:11:32.097415
7453203694	26	0	0	0	26	2026-05-06	2026-05-06 08:03:58.436062
8773611512	2	0	0	0	2	2026-04-30	2026-04-30 17:31:18.164287
7107022202	9	1	0	0	4	2026-04-30	2026-04-30 12:07:27.32865
7150716856	1	0	0	0	1	2026-04-30	2026-04-30 18:17:27.190448
8726316433	491	37	0	0	306	2026-05-16	2026-05-16 09:58:16.708275
5495047549	1	0	0	0	1	2026-05-04	2026-05-04 17:44:54.917478
7626346023	1	0	0	0	1	2026-05-04	2026-05-04 17:45:16.20135
7387314389	61	3	0	0	46	2026-05-07	2026-05-07 19:57:29.059272
6518809123	1	0	0	0	1	2026-05-04	2026-05-04 19:48:21.004205
6553595440	1	0	0	0	1	2026-05-14	2026-05-14 13:44:53.348372
6915442217	1	0	0	0	1	2026-05-04	2026-05-04 17:07:01.434365
6854972736	1	0	0	0	1	2026-05-04	2026-05-04 17:55:38.744654
7967569469	1	0	0	0	1	2026-05-02	2026-05-02 22:20:36.012477
8767940606	1	0	0	0	1	2026-05-04	2026-05-04 17:55:57.375655
7002849527	1	0	0	0	1	2026-05-04	2026-05-04 17:08:16.423706
5556524947	150	16	0	0	70	2026-05-21	2026-05-21 21:55:42.323872
6786245628	1	0	0	0	1	2026-05-04	2026-05-04 17:58:55.731598
8085472922	1	0	0	0	1	2026-05-06	2026-05-06 17:39:56.408123
5664972318	1	0	0	0	1	2026-05-03	2026-05-03 18:08:16.429448
5748743043	1	0	0	0	1	2026-05-04	2026-05-04 17:16:47.005247
8146497209	2	0	0	0	2	2026-05-04	2026-05-04 17:17:04.26814
7609827426	1	0	0	0	1	2026-05-04	2026-05-04 17:59:30.730368
6283137743	1	0	0	0	1	2026-05-04	2026-05-04 19:49:26.561532
7514359523	34	3	0	0	19	2026-05-03	2026-05-03 18:09:19.915603
7825765087	2	0	0	0	2	2026-05-05	2026-05-05 07:21:43.339228
7839799057	1	0	0	0	1	2026-05-03	2026-05-03 18:11:58.000757
8578426396	2	0	0	0	2	2026-05-04	2026-05-04 17:18:51.690439
5586098932	1	0	0	0	1	2026-05-06	2026-05-06 22:15:00.933265
8117799855	1	0	0	0	1	2026-05-04	2026-05-04 18:09:21.721863
7048982871	1	0	0	0	1	2026-05-04	2026-05-04 06:53:40.477414
5353407643	2	0	0	0	2	2026-05-07	2026-05-07 23:48:17.007167
8496101324	1	0	0	0	1	2026-05-04	2026-05-04 19:55:37.419256
5642381740	1	0	0	0	1	2026-05-03	2026-05-03 12:06:26.468277
5598476264	1	0	0	0	1	2026-05-04	2026-05-04 13:57:21.68481
5881308692	2	0	0	0	2	2026-05-03	2026-05-03 03:08:46.81814
7800106782	2	0	0	0	2	2026-05-03	2026-05-03 03:18:07.254468
7597362284	39	0	0	0	39	2026-05-26	2026-05-26 11:24:12.744651
6263878232	22	1	0	0	17	2026-05-29	2026-05-29 13:22:17.656917
6390634393	1	0	0	0	1	2026-05-02	2026-05-02 21:50:59.994389
6729659968	170	14	0	0	100	2026-05-29	2026-05-29 13:26:12.970312
6947981089	2	0	0	0	2	2026-05-04	2026-05-04 18:13:32.634397
6182399562	1	0	0	0	1	2026-05-04	2026-05-04 14:44:00.029835
7939392449	16	0	0	0	16	2026-05-09	2026-05-09 21:22:44.281245
8203289747	3	0	0	0	3	2026-05-03	2026-05-03 16:20:57.261797
5449891575	1	0	0	0	1	2026-05-04	2026-05-04 15:06:31.281813
7235876860	1	0	0	0	1	2026-05-03	2026-05-03 16:23:28.327379
8201454178	1	0	0	0	1	2026-05-04	2026-05-04 18:18:17.615281
136817688	2	0	0	0	2	2026-05-03	2026-05-03 11:00:30.560117
6270473372	1	0	0	0	1	2026-05-04	2026-05-04 18:22:09.796587
7465610372	1	0	0	0	1	2026-05-04	2026-05-04 19:57:52.830013
7661997592	1	0	0	0	1	2026-05-04	2026-05-04 18:26:02.493829
5880904984	2	0	0	0	2	2026-05-08	2026-05-08 16:37:30.243676
6996935252	2	0	0	0	2	2026-05-11	2026-05-11 05:02:50.007631
8688313611	1	0	0	0	1	2026-05-03	2026-05-03 00:15:12.918314
8468016104	26	1	0	0	21	2026-05-29	2026-05-29 14:38:11.024123
5573584534	1	0	0	0	1	2026-05-04	2026-05-04 08:03:43.795649
7912511081	1	0	0	0	1	2026-05-04	2026-05-04 18:44:27.012706
5182715619	1	0	0	0	1	2026-05-11	2026-05-11 05:11:50.131768
6564900193	77	7	0	0	42	2026-05-15	2026-05-15 07:59:32.537671
8159837057	1	0	0	0	1	2026-05-04	2026-05-04 17:37:23.331797
5916743033	1	0	0	0	1	2026-05-03	2026-05-03 18:40:46.582015
7218982790	2	0	0	0	2	2026-05-05	2026-05-05 16:03:36.375562
1959019465	1	0	0	0	1	2026-05-04	2026-05-04 20:08:49.715037
6561514070	1	0	0	0	1	2026-05-03	2026-05-03 20:19:24.176464
8202593608	20	0	0	0	20	2026-05-29	2026-05-29 18:36:19.894229
5900948123	1	0	0	0	1	2026-05-03	2026-05-03 20:28:43.819958
6914095994	1	0	0	0	1	2026-05-04	2026-05-04 20:08:52.117545
7644156797	1	0	0	0	1	2026-05-04	2026-05-04 17:39:54.624675
7951841177	2	0	0	0	2	2026-05-05	2026-05-05 16:39:28.347907
7163314505	1	0	0	0	1	2026-05-03	2026-05-03 21:07:58.297765
6353800042	1	0	0	0	1	2026-05-03	2026-05-03 21:28:23.769992
1792702624	1	0	0	0	1	2026-05-04	2026-05-04 20:10:21.419219
5415358039	1047	114	0	0	477	2026-05-17	2026-05-18 09:13:25.380607
8633599060	60	0	0	0	60	2026-05-30	2026-05-30 15:14:51.5457
7574632699	335	33	0	0	170	2026-05-16	2026-05-16 19:10:49.447142
6872029651	18	1	0	0	13	2026-05-16	2026-05-16 19:53:10.656204
6217677522	81	6	0	0	51	2026-05-30	2026-05-30 19:11:47.435525
8187764784	68	5	0	0	43	2026-05-30	2026-05-30 19:36:19.223058
7118589183	1	0	0	0	1	2026-05-04	2026-05-04 18:50:46.43315
6040761848	32	0	0	0	32	2026-05-15	2026-05-15 06:25:48.852998
5760028323	50	4	0	0	30	2026-05-30	2026-05-30 19:57:12.080073
5621563987	1	0	0	0	1	2026-05-04	2026-05-04 18:55:43.496358
7693215360	2	0	0	0	2	2026-05-04	2026-05-04 18:57:40.654614
8678910305	71	0	0	0	71	2026-05-12	2026-05-12 07:04:29.503137
6409821771	132	12	0	0	72	2026-05-15	2026-05-15 21:44:09.279246
5588471450	70	6	0	0	40	2026-05-15	2026-05-15 21:57:50.127326
8092171184	1	0	0	0	1	2026-05-04	2026-05-04 19:19:16.143527
7612571266	4	0	0	0	4	2026-05-13	2026-05-13 17:43:18.187821
6036425898	46	5	0	0	21	2026-05-07	2026-05-07 01:19:51.106312
5718477026	81	9	0	0	36	2026-05-15	2026-05-15 23:27:20.974507
7908756476	37	3	0	0	22	2026-05-07	2026-05-07 01:34:25.57227
6669464576	1	0	0	0	1	2026-05-04	2026-05-04 19:31:55.478379
7674779775	1	0	0	0	1	2026-05-04	2026-05-04 19:36:59.16865
5062856589	1	0	0	0	1	2026-05-04	2026-05-04 19:38:18.856717
6167797720	65	7	0	0	30	2026-05-16	2026-05-16 01:11:04.910675
5426803479	39	3	0	0	24	2026-05-14	2026-05-14 18:26:58.760479
8018812574	1	0	0	0	1	2026-05-04	2026-05-04 19:42:06.984469
5416595898	1	0	0	0	1	2026-05-04	2026-05-04 20:19:15.392885
6953516912	1	0	0	0	1	2026-05-04	2026-05-04 19:44:43.327757
7629463948	1	0	0	0	1	2026-05-04	2026-05-04 19:45:14.222883
6811554141	1	0	0	0	1	2026-05-04	2026-05-04 21:23:31.392586
6677993230	1	0	0	0	1	2026-05-04	2026-05-04 20:23:52.933736
7465614349	1	0	0	0	1	2026-05-04	2026-05-04 23:25:25.85368
5876092372	1	0	0	0	1	2026-05-04	2026-05-04 20:24:50.061065
6207631297	1	0	0	0	1	2026-05-04	2026-05-04 21:35:14.482389
5685117515	1	0	0	0	1	2026-05-05	2026-05-05 12:32:56.949684
8384391317	1	0	0	0	1	2026-05-04	2026-05-04 21:45:22.519541
5934598987	1	0	0	0	1	2026-05-05	2026-05-05 01:15:11.600375
7637247082	1	0	0	0	1	2026-05-04	2026-05-04 21:49:49.761025
6466668650	1	0	0	0	1	2026-05-05	2026-05-05 06:22:24.885236
5261454927	1	0	0	0	1	2026-05-04	2026-05-04 22:04:51.520029
7251722877	1	0	0	0	1	2026-05-05	2026-05-05 04:03:32.432967
7849038605	1	0	0	0	1	2026-05-04	2026-05-04 22:27:31.018618
8424707492	1	0	0	0	1	2026-05-05	2026-05-05 07:05:14.430393
5680763644	1	0	0	0	1	2026-05-04	2026-05-04 22:34:43.920411
8345258214	1	0	0	0	1	2026-05-05	2026-05-05 15:21:22.325204
8023344784	1	0	0	0	1	2026-05-04	2026-05-04 22:51:28.16321
7007958659	1	0	0	0	1	2026-05-04	2026-05-04 22:54:35.592148
8492754706	2	0	0	0	2	2026-05-05	2026-05-05 07:20:41.976008
6983086758	1	0	0	0	1	2026-05-04	2026-05-04 23:15:42.417976
6296469251	1	0	0	0	1	2026-05-05	2026-05-05 13:25:35.72525
6285933790	1	0	0	0	1	2026-05-07	2026-05-07 18:44:54.272973
5795469322	1	0	0	0	1	2026-05-06	2026-05-06 14:21:58.551662
7129580216	1	0	0	0	1	2026-05-06	2026-05-06 06:32:07.832765
8729294530	1	0	0	0	1	2026-05-05	2026-05-05 13:37:03.72997
6745499854	1	0	0	0	1	2026-05-05	2026-05-05 10:05:57.850446
8285314323	1	0	0	0	1	2026-05-05	2026-05-05 15:31:58.026431
1804512916	1	0	0	0	1	2026-05-05	2026-05-05 10:16:37.728637
6065137895	1	0	0	0	1	2026-05-05	2026-05-05 13:46:42.278896
5697743309	1	0	0	0	1	2026-05-09	2026-05-09 20:49:49.614911
5770436870	10	0	0	0	10	2026-05-08	2026-05-08 08:03:03.127636
8189996183	1	0	0	0	1	2026-05-05	2026-05-05 11:56:56.661555
6337368869	1	0	0	0	1	2026-05-05	2026-05-05 13:47:10.026555
8173011463	1	0	0	0	1	2026-05-08	2026-05-08 12:43:38.182065
5098493417	1	0	0	0	1	2026-05-05	2026-05-05 14:41:08.91191
5257226053	1	0	0	0	1	2026-05-05	2026-05-05 16:04:34.83643
6686936504	1	0	0	0	1	2026-05-05	2026-05-05 15:11:16.647245
6530364511	257	17	0	0	172	2026-05-10	2026-05-16 23:30:21.42636
2048300483	1	0	0	0	1	2026-05-05	2026-05-05 16:18:43.582512
6919626638	1	0	0	0	1	2026-05-06	2026-05-06 03:32:12.102862
6754801056	1	0	0	0	1	2026-05-05	2026-05-05 16:26:45.228601
7792510443	1	0	0	0	1	2026-05-05	2026-05-05 21:04:17.570043
7905722479	1	0	0	0	1	2026-05-05	2026-05-05 16:28:45.692796
7983781575	1	0	0	0	1	2026-05-06	2026-05-06 18:24:37.111027
8301328592	1	0	0	0	1	2026-05-05	2026-05-05 18:56:39.043283
8046237171	1	0	0	0	1	2026-05-05	2026-05-05 21:45:33.922487
5779352238	1	0	0	0	1	2026-05-05	2026-05-05 19:04:28.735894
6088064068	1	0	0	0	1	2026-05-06	2026-05-06 05:07:01.205081
5362240055	1	0	0	0	1	2026-05-05	2026-05-05 19:35:09.74188
8688882303	1	0	0	0	1	2026-05-05	2026-05-05 22:18:13.459796
8368445338	2	0	0	0	2	2026-05-09	2026-05-09 21:05:17.004561
1813849064	1	0	0	0	1	2026-05-07	2026-05-07 01:04:03.273456
8331191774	1	0	0	0	1	2026-05-06	2026-05-06 13:35:59.697068
8458918426	1	0	0	0	1	2026-05-06	2026-05-06 14:41:45.239655
8430804531	1	0	0	0	1	2026-05-06	2026-05-06 13:37:50.503471
6390943284	3	0	0	0	3	2026-05-07	2026-05-07 18:57:49.002265
6255325094	1	0	0	0	1	2026-05-06	2026-05-06 14:03:50.434509
6005854082	1	0	0	0	1	2026-05-06	2026-05-06 15:19:00.869718
6659650604	1	0	0	0	1	2026-05-06	2026-05-06 14:17:15.901628
7324347902	2	0	0	0	2	2026-05-13	2026-05-13 23:28:22.611697
7532866496	1	0	0	0	1	2026-05-06	2026-05-06 15:51:03.712435
6097920313	3	0	0	0	3	2026-05-07	2026-05-07 01:23:45.248208
1569159053	1	0	0	0	1	2026-05-06	2026-05-06 16:11:41.789621
8078439333	1	0	0	0	1	2026-05-08	2026-05-08 10:28:04.173525
6082929144	1	0	0	0	1	2026-05-06	2026-05-06 16:54:10.200676
5113172631	1	0	0	0	1	2026-05-07	2026-05-07 07:41:39.340624
5723460137	3	0	0	0	3	2026-05-06	2026-05-06 22:53:20.571751
8681204520	2	0	0	0	2	2026-05-11	2026-05-11 15:26:00.275033
6843832874	1	0	0	0	1	2026-05-08	2026-05-08 13:08:01.776222
6256913829	4	0	0	0	4	2026-05-06	2026-05-06 23:05:29.774963
5047971015	1	0	0	0	1	2026-05-08	2026-05-08 12:21:29.154007
5902920483	1	0	0	0	1	2026-05-09	2026-05-09 22:52:24.262923
6290003658	6	0	0	0	6	2026-05-07	2026-05-07 20:26:02.770778
7869465802	1	0	0	0	1	2026-05-08	2026-05-08 13:08:20.600911
8450636603	1	0	0	0	1	2026-05-06	2026-05-06 23:54:43.475053
7273995620	1	0	0	0	1	2026-05-08	2026-05-08 00:18:50.733194
1659265421	2	0	0	0	2	2026-05-08	2026-05-08 18:19:14.483352
8300360365	7	0	0	0	7	2026-05-07	2026-05-07 00:07:12.584423
8235799915	12	2	0	0	2	2026-05-18	2026-05-18 08:47:36.709615
5297561476	2	0	0	0	2	2026-05-08	2026-05-08 18:29:43.462431
6588278938	46	8	0	0	6	2026-05-07	2026-05-07 12:52:12.944736
6488872577	3	0	0	0	3	2026-05-08	2026-05-08 14:43:24.396008
1006250480	1	0	0	0	1	2026-05-10	2026-05-10 06:33:30.884511
6496038451	1	0	0	0	1	2026-05-08	2026-05-08 14:57:54.358891
6635684839	7	0	0	0	7	2026-05-09	2026-05-09 17:05:33.842138
8037159316	1	0	0	0	1	2026-05-07	2026-05-07 00:51:04.704629
6720124032	94	8	0	0	54	2026-05-24	2026-05-24 15:01:37.798862
8586292342	1	0	0	0	1	2026-05-09	2026-05-09 18:20:22.009729
6287878174	5	0	0	0	5	2026-05-07	2026-05-07 13:36:32.639038
7544664630	4	0	0	0	4	2026-05-08	2026-05-08 17:22:34.061116
7792516635	1	0	0	0	1	2026-05-09	2026-05-09 19:38:23.665511
6893591029	7	0	0	0	7	2026-05-10	2026-05-10 19:58:08.387888
5234386942	23	4	0	0	3	2026-05-28	2026-05-28 22:57:26.759841
7335955187	1	0	0	0	1	2026-05-07	2026-05-07 15:59:30.122662
8226639724	1	0	0	0	1	2026-05-10	2026-05-10 20:32:20.429606
7803385892	23	3	0	0	8	2026-05-08	2026-05-08 19:07:38.632195
6706518136	1	0	0	0	1	2026-05-10	2026-05-10 20:46:33.794898
5512941168	16	1	0	0	11	2026-05-12	2026-05-12 22:59:23.409868
5839336556	6	0	0	0	6	2026-05-08	2026-05-08 20:00:10.173901
8313622726	1	0	0	0	1	2026-05-08	2026-05-08 22:12:50.728691
7813069468	31	0	0	0	31	2026-05-07	2026-05-07 16:09:44.728692
7712495583	1	0	0	0	1	2026-05-07	2026-05-07 17:18:35.074605
7471385119	70	3	0	0	55	2026-05-06	2026-05-06 18:20:11.152095
7100605165	6	0	0	0	6	2026-05-08	2026-05-08 23:18:29.770547
7350890496	1	0	0	0	1	2026-05-09	2026-05-09 01:22:47.877239
6369537142	2	0	0	0	2	2026-05-09	2026-05-09 03:03:32.30683
8331651571	2	0	0	0	2	2026-05-09	2026-05-09 10:53:07.332379
8519140108	1	0	0	0	1	2026-05-09	2026-05-09 10:59:11.679492
6091576543	45	5	0	0	20	2026-05-15	2026-05-15 10:42:23.982819
6501895239	1	0	0	0	1	2026-05-09	2026-05-09 13:08:32.107962
8641490518	2	0	0	0	2	2026-05-09	2026-05-09 16:00:40.127226
8710836734	4	0	0	0	4	2026-05-10	2026-05-10 21:32:18.921712
5487459125	1	0	0	0	1	2026-05-10	2026-05-10 13:21:00.355912
5782699182	1	0	0	0	1	2026-05-10	2026-05-10 14:54:33.666563
7025363896	10	1	0	0	5	2026-05-10	2026-05-10 17:07:20.63214
8782004087	1	0	0	0	1	2026-05-04	2026-05-04 20:34:28.086363
6265381148	1	0	0	0	1	2026-05-14	2026-05-14 20:47:35.780394
8664918697	1	0	0	0	1	2026-05-04	2026-05-04 20:37:36.975823
7746774395	1	0	0	0	1	2026-05-04	2026-05-04 21:26:44.612748
5560417978	1	0	0	0	1	2026-05-04	2026-05-04 20:50:27.687006
5314138379	1	0	0	0	1	2026-05-05	2026-05-05 00:08:40.473826
6048996327	1	0	0	0	1	2026-05-04	2026-05-04 20:54:55.78025
6375547840	1	0	0	0	1	2026-05-04	2026-05-04 21:36:25.556348
6272548417	36	2	0	0	26	2026-05-15	2026-05-15 17:04:07.0473
5519516062	1	0	0	0	1	2026-05-08	2026-05-08 20:23:35.674413
8373178706	1	0	0	0	1	2026-05-04	2026-05-04 20:59:55.754626
5089673068	1	0	0	0	1	2026-05-04	2026-05-04 21:47:48.108251
8203929194	1	0	0	0	1	2026-05-04	2026-05-04 21:01:38.547774
6169413861	1	0	0	0	1	2026-05-05	2026-05-05 01:34:30.090771
1735063951	1	0	0	0	1	2026-05-04	2026-05-04 21:03:30.535648
6251264950	1	0	0	0	1	2026-05-04	2026-05-04 21:03:40.509885
8147371147	2	0	0	0	2	2026-05-04	2026-05-04 21:50:44.659054
6673917743	1	0	0	0	1	2026-05-04	2026-05-04 21:11:12.736533
7597387019	1	0	0	0	1	2026-05-10	2026-05-10 20:19:52.196516
5604970328	1	0	0	0	1	2026-05-04	2026-05-04 21:13:29.760552
7385014729	1	0	0	0	1	2026-05-04	2026-05-04 21:54:01.569503
8416226141	1	0	0	0	1	2026-05-04	2026-05-04 21:13:35.053199
6885186666	61	5	0	0	36	2026-05-11	2026-05-11 01:22:50.834925
7534378218	1	0	0	0	1	2026-05-04	2026-05-04 21:19:31.05179
8257739665	1	0	0	0	1	2026-05-10	2026-05-10 20:30:27.336286
7775246982	1	0	0	0	1	2026-05-07	2026-05-07 13:01:36.452475
6126825188	1	0	0	0	1	2026-05-04	2026-05-04 22:28:49.964253
7735378556	2	0	0	0	2	2026-05-07	2026-05-07 13:17:47.755368
5162992961	1	0	0	0	1	2026-05-04	2026-05-04 22:48:29.310428
6455134159	1	0	0	0	1	2026-05-06	2026-05-06 14:40:51.15899
7827767427	1	0	0	0	1	2026-05-04	2026-05-04 22:54:30.260381
7229478852	1	0	0	0	1	2026-05-16	2026-05-16 09:06:23.396544
6495042225	1	0	0	0	1	2026-05-04	2026-05-04 23:07:12.739236
7827585957	1	0	0	0	1	2026-05-12	2026-05-12 18:40:08.324989
8402676106	1	0	0	0	1	2026-05-06	2026-05-06 14:58:57.873378
8505748259	1	0	0	0	1	2026-05-10	2026-05-10 20:34:27.475361
6469965505	2	0	0	0	2	2026-05-12	2026-05-12 22:24:41.062534
7759642124	2	0	0	0	2	2026-05-06	2026-05-06 15:25:55.171375
5589657070	11	0	0	0	11	2026-05-15	2026-05-15 20:59:11.603082
7448172195	1	0	0	0	1	2026-05-05	2026-05-05 13:05:35.960122
7789613214	1	0	0	0	1	2026-05-05	2026-05-05 20:16:00.778306
7933705007	1	0	0	0	1	2026-05-05	2026-05-05 15:31:18.991959
6288617529	6	0	0	0	6	2026-05-15	2026-05-15 21:42:42.809364
6584394071	1	0	0	0	1	2026-05-05	2026-05-05 15:37:19.131208
6815889863	1	0	0	0	1	2026-05-05	2026-05-05 20:17:22.344589
5527725184	1	0	0	0	1	2026-05-05	2026-05-05 15:55:29.468325
7695402883	2	0	0	0	2	2026-05-05	2026-05-05 16:05:20.375431
6726347045	2	0	0	0	2	2026-05-05	2026-05-05 16:05:25.662781
7368552878	1	0	0	0	1	2026-05-20	2026-05-20 17:36:43.793489
6999161901	2	0	0	0	2	2026-05-13	2026-05-13 22:39:57.583215
6317423702	2	0	0	0	2	2026-05-11	2026-05-11 12:44:28.267039
7168333935	1	0	0	0	1	2026-05-06	2026-05-06 16:42:31.273202
8466373785	1	0	0	0	1	2026-05-05	2026-05-05 20:28:46.092317
8209081434	1	0	0	0	1	2026-05-05	2026-05-05 09:17:02.656696
8496335535	1	0	0	0	1	2026-05-05	2026-05-05 20:32:43.330742
6096424721	1	0	0	0	1	2026-05-05	2026-05-05 20:37:43.054964
7546140009	62	5	0	0	37	2026-05-25	2026-05-25 21:11:29.431817
8392727845	1	0	0	0	1	2026-05-05	2026-05-05 21:33:44.53765
7500829080	1	0	0	0	1	2026-05-05	2026-05-05 09:42:32.910412
6069078850	13	0	0	0	13	2026-05-29	2026-05-29 13:25:52.844234
8027845854	1	0	0	0	1	2026-05-05	2026-05-05 09:46:06.486294
6620710987	37	2	0	0	27	2026-05-25	2026-05-25 23:16:11.222416
7518863743	19	1	0	0	14	2026-05-09	2026-05-09 21:54:11.692269
7194386140	5	0	0	0	5	2026-05-29	2026-05-29 16:03:26.283154
8415155425	1	0	0	0	1	2026-05-06	2026-05-06 13:37:31.640564
5946893352	6	0	0	0	6	2026-05-08	2026-05-08 18:47:21.057415
7027628180	1	0	0	0	1	2026-05-10	2026-05-10 21:31:43.531967
8434694373	1	0	0	0	1	2026-05-05	2026-05-05 09:58:53.682874
6485931104	1	0	0	0	1	2026-05-06	2026-05-06 13:50:39.555406
5276601778	1	0	0	0	1	2026-05-05	2026-05-05 22:08:22.744467
8305441660	1	0	0	0	1	2026-05-05	2026-05-05 10:54:23.32684
6806325515	2	0	0	0	2	2026-05-05	2026-05-05 11:22:47.670897
6184225490	1	0	0	0	1	2026-05-05	2026-05-05 11:44:39.381564
1756760664	1	0	0	0	1	2026-05-05	2026-05-05 13:27:00.179253
7379109630	1	0	0	0	1	2026-05-05	2026-05-05 22:18:33.606068
6600739553	2	0	0	0	2	2026-05-05	2026-05-05 22:26:03.912652
1877418855	1	0	0	0	1	2026-05-08	2026-05-08 22:53:51.126147
7679018255	5	0	0	0	5	2026-05-08	2026-05-08 14:01:32.894888
8002341700	1	0	0	0	1	2026-05-05	2026-05-05 06:35:41.888401
1923398323	1	0	0	0	1	2026-05-05	2026-05-05 18:57:00.138708
6538167943	4	0	0	0	4	2026-05-07	2026-05-07 00:24:55.840355
6918100402	1	0	0	0	1	2026-05-07	2026-05-07 17:11:45.070271
5510965112	2	0	0	0	2	2026-05-05	2026-05-05 13:32:19.783253
7753675451	1	0	0	0	1	2026-05-05	2026-05-05 19:33:23.349727
7294755092	1	0	0	0	1	2026-05-05	2026-05-05 07:17:33.038468
8359613581	1	0	0	0	1	2026-05-08	2026-05-08 23:43:17.170593
1917416645	1	0	0	0	1	2026-05-05	2026-05-05 13:41:00.703301
7997432252	1	0	0	0	1	2026-05-07	2026-05-07 22:10:55.157745
6062523917	6	0	0	0	6	2026-05-09	2026-05-09 22:40:36.340525
5089657674	1	0	0	0	1	2026-05-08	2026-05-08 14:42:40.245659
7673737752	1	0	0	0	1	2026-05-09	2026-05-09 23:05:00.811821
8067736744	2	0	0	0	2	2026-05-07	2026-05-07 22:44:09.535661
2111837909	1	0	0	0	1	2026-05-08	2026-05-08 14:44:45.531897
8380139583	16	1	0	0	11	2026-05-07	2026-05-07 00:26:19.833169
5128994813	1	0	0	0	1	2026-05-05	2026-05-05 15:04:37.489952
7024037862	1	0	0	0	1	2026-05-05	2026-05-05 15:11:17.833767
7799723913	1	0	0	0	1	2026-05-09	2026-05-09 03:58:34.62127
6129341635	18	1	0	0	13	2026-05-09	2026-05-09 17:10:10.559034
8475336118	1	0	0	0	1	2026-05-05	2026-05-05 14:08:00.037928
7311979403	1	0	0	0	1	2026-05-05	2026-05-05 23:28:35.411416
5460522877	1	0	0	0	1	2026-05-10	2026-05-10 07:31:03.47579
6669232431	1	0	0	0	1	2026-05-06	2026-05-06 14:13:42.291574
5628990376	1	0	0	0	1	2026-05-08	2026-05-08 15:21:35.198037
6018795251	159	18	0	0	69	2026-05-11	2026-05-11 18:03:38.309589
5940412894	1	0	0	0	1	2026-05-10	2026-05-10 15:20:13.152012
8122111187	1	0	0	0	1	2026-05-09	2026-05-09 12:05:37.753269
7341267668	1	0	0	0	1	2026-05-10	2026-05-10 17:34:01.478922
8524880406	1	0	0	0	1	2026-05-09	2026-05-09 13:57:47.51451
6080188703	1	0	0	0	1	2026-05-08	2026-05-08 10:49:18.307827
5012667005	1	0	0	0	1	2026-05-06	2026-05-06 04:19:25.988177
5506047666	1	0	0	0	1	2026-05-08	2026-05-08 17:16:24.45848
7302513580	5	0	0	0	5	2026-05-09	2026-05-09 19:22:14.762499
7025477410	1	0	0	0	1	2026-05-08	2026-05-08 11:54:28.666672
7646367698	1	0	0	0	1	2026-05-09	2026-05-09 19:29:43.057991
8261089899	1	0	0	0	1	2026-05-08	2026-05-08 19:43:49.588202
7803113312	31	5	0	0	6	2026-05-30	2026-05-30 17:53:31.612241
5568829706	1	0	0	0	1	2026-05-13	2026-05-13 14:38:01.942269
7647139264	1	0	0	0	1	2026-05-14	2026-05-14 20:48:57.941332
7032900900	1	0	0	0	1	2026-05-13	2026-05-13 14:43:01.255678
7251921405	1	0	0	0	1	2026-05-13	2026-05-13 14:55:32.141194
6263981512	1	0	0	0	1	2026-05-14	2026-05-14 23:29:25.13536
7094571950	1	0	0	0	1	2026-05-12	2026-05-12 18:56:31.004511
7916687158	1	0	0	0	1	2026-05-13	2026-05-13 15:11:36.482779
8192906362	17	1	0	0	12	2026-05-11	2026-05-11 14:34:20.74971
8203791721	1	0	0	0	1	2026-05-13	2026-05-13 15:12:00.27901
8140221751	1	0	0	0	1	2026-05-11	2026-05-11 14:44:28.383114
5534474259	26172	3083	2	0	10751	2026-05-30	2026-05-30 20:28:39.304744
8218333291	1	0	0	0	1	2026-05-11	2026-05-11 15:07:57.426008
6327681945	2	0	0	0	2	2026-05-13	2026-05-13 15:13:42.301395
6390394349	1	0	0	0	1	2026-05-11	2026-05-11 17:18:53.818343
6543164043	1	0	0	0	1	2026-05-11	2026-05-11 17:50:01.871097
6671456897	1	0	0	0	1	2026-05-13	2026-05-13 15:24:07.22099
7254019599	1	0	0	0	1	2026-05-12	2026-05-12 05:07:53.926967
7427289420	10	0	0	0	10	2026-05-14	2026-05-14 17:34:33.907573
7159164623	1	0	0	0	1	2026-05-12	2026-05-12 07:47:07.236061
7981319783	1	0	0	0	1	2026-05-13	2026-05-13 15:34:23.962172
6193748884	1	0	0	0	1	2026-05-13	2026-05-13 15:51:06.568984
6250199428	209	23	0	0	94	2026-05-27	2026-05-27 15:58:57.556403
5249113617	1	0	0	0	1	2026-05-13	2026-05-13 15:53:38.506684
8469299160	4	0	0	0	4	2026-05-15	2026-05-15 15:20:16.268475
7356252787	1	0	0	0	1	2026-05-13	2026-05-13 16:06:20.316291
1135476521	1	0	0	0	1	2026-05-13	2026-05-13 16:15:24.700838
8711666664	1	0	0	0	1	2026-05-13	2026-05-13 07:34:13.165217
1891587592	1	0	0	0	1	2026-05-13	2026-05-13 16:16:56.102791
5660577046	41	3	0	0	26	2026-05-13	2026-05-13 11:13:44.588334
7638719727	1	0	0	0	1	2026-05-13	2026-05-13 16:18:23.692813
6430329696	1	0	0	0	1	2026-05-13	2026-05-13 16:23:45.900368
7006856163	8	1	0	0	3	2026-05-15	2026-05-15 18:00:30.102348
8661807153	1	0	0	0	1	2026-05-13	2026-05-13 16:38:24.014229
6810868802	62	10	0	0	12	2026-05-28	2026-05-28 12:01:32.203968
8353363490	1	0	0	0	1	2026-05-13	2026-05-13 17:43:06.504914
5245454593	1	0	0	0	1	2026-05-13	2026-05-13 17:43:55.597667
8356912014	1	0	0	0	1	2026-05-28	2026-05-28 20:53:21.695145
7983324772	1	0	0	0	1	2026-05-13	2026-05-13 17:49:10.012486
8375199999	33	5	0	0	8	2026-05-20	2026-05-20 15:57:54.218338
5737714403	1	0	0	0	1	2026-05-13	2026-05-13 18:59:23.129218
7596452439	1128	16	0	0	1048	2026-05-28	2026-05-28 23:21:33.265231
6682149035	1	0	0	0	1	2026-05-29	2026-05-29 04:00:57.114593
7358383509	9	1	0	0	4	2026-05-13	2026-05-13 19:13:56.853145
5303731176	24	4	0	0	4	2026-05-17	2026-05-17 00:07:01.374511
6638347625	1	0	0	0	1	2026-05-13	2026-05-13 20:26:55.809476
7395665584	1	0	0	0	1	2026-05-13	2026-05-13 20:43:28.262352
8686602585	1	0	0	0	1	2026-05-13	2026-05-13 21:33:28.246451
5779307151	1	0	0	0	1	2026-05-13	2026-05-13 22:38:29.362413
5911456981	1	0	0	0	1	2026-05-13	2026-05-13 22:49:59.807736
5122118107	9	1	0	0	4	2026-05-13	2026-05-13 22:59:56.125619
8056058390	9	0	0	0	9	2026-05-16	2026-05-16 18:33:31.452676
7415555924	13	0	0	0	13	2026-05-14	2026-05-14 17:04:42.823458
8100545240	1	0	0	0	1	2026-05-14	2026-05-14 17:05:27.294481
6415628479	3	0	0	0	3	2026-05-22	2026-05-22 00:31:30.490613
1951225967	15	1	0	0	10	2026-05-14	2026-05-14 00:03:57.630697
5785657215	1	0	0	0	1	2026-05-29	2026-05-29 14:51:03.956695
8443300294	1	0	0	0	1	2026-05-29	2026-05-29 16:11:10.721829
6147088512	1	0	0	0	1	2026-05-14	2026-05-14 08:03:53.808797
5515357144	2	0	0	0	2	2026-05-24	2026-05-24 12:31:02.627067
190190547	1	0	0	0	1	2026-05-16	2026-05-16 19:05:13.598094
8319698469	74	6	0	0	44	2026-05-15	2026-05-15 22:00:44.627064
5938825778	1	0	0	0	1	2026-05-29	2026-05-29 22:28:34.637572
7465985372	14	2	0	0	4	2026-05-25	2026-05-25 07:41:07.526094
7619776506	1	0	0	0	1	2026-05-29	2026-05-29 22:33:01.820892
7957612564	2	0	0	0	2	2026-05-29	2026-05-29 22:40:16.339372
6223341400	1	0	0	0	1	2026-05-29	2026-05-29 22:44:01.021813
8279431973	19	3	0	0	4	2026-05-25	2026-05-25 13:40:34.735114
7746046007	255	25	0	0	130	2026-05-25	2026-05-25 20:17:31.150494
6834163411	7	1	0	0	2	2026-05-26	2026-05-26 01:31:59.798188
8430965668	2	0	0	0	2	2026-05-30	2026-05-30 10:03:15.382326
7599538830	1	0	0	0	1	2026-05-30	2026-05-30 10:48:15.658022
2013244058	145	18	0	0	55	2026-05-16	2026-05-17 17:53:38.37511
6513362017	83	7	0	0	48	2026-05-30	2026-05-30 13:31:44.608331
5849510758	2	0	0	0	2	2026-05-30	2026-05-30 14:41:24.866719
\.


--
-- Data for Name: user_specialties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_specialties (user_id, specialty_id, updated_at) FROM stdin;
2013244058	1	2026-04-06 22:50:08.886909
8281559444	1	2026-04-07 20:54:17.764187
5718477026	1	2026-04-08 12:02:57.764696
8135760490	1	2026-04-08 21:22:14.089334
5503490311	1	2026-04-08 22:25:11.477479
6926103065	1	2026-04-09 07:39:31.680401
6444593166	1	2026-04-09 08:14:30.076212
7178011134	1	2026-04-09 08:47:37.236371
5770436870	1	2026-04-09 08:52:40.956832
6040761848	1	2026-04-09 17:35:14.937452
7662120392	1	2026-04-10 01:32:46.770085
6810868802	1	2026-04-10 09:20:58.313001
8519069419	0	2026-04-10 09:24:09.23136
7216357083	1	2026-04-11 11:35:53.075039
6091576543	1	2026-04-11 14:31:06.858279
5664588045	1	2026-04-11 15:49:50.537497
8348972379	1	2026-04-18 08:15:28.862623
7838741519	1	2026-04-11 16:50:38.021261
7194386140	1	2026-04-11 18:10:34.523583
7229478852	1	2026-04-11 19:34:37.837206
6513362017	1	2026-04-11 19:45:25.517827
6772617116	1	2026-04-11 23:58:08.145734
5814084225	1	2026-04-12 00:15:53.673969
5563819069	13	2026-04-12 04:05:52.645137
6536523837	8	2026-04-11 18:06:15.191089
6564900193	1	2026-04-12 09:05:05.08556
5663352778	13	2026-04-12 17:14:55.617009
8705652002	1	2026-04-13 21:15:19.797316
5386256069	13	2026-04-14 00:07:01.577614
6919626638	1	2026-04-14 13:57:34.158692
8248917515	1	2026-04-14 14:18:30.691032
6739428722	1	2026-04-14 15:00:52.876987
6053902152	1	2026-04-14 20:20:57.619872
6272548417	1	2026-04-15 06:35:55.993941
5668550674	1	2026-04-15 21:58:07.870014
8443541884	13	2026-04-16 20:32:25.115527
8178887525	1	2026-04-16 20:40:30.89357
8304386091	13	2026-04-17 16:45:03.744578
7260277114	1	2026-04-17 18:17:13.039551
7537692068	1	2026-04-17 20:08:47.695252
7782903279	1	2026-04-17 20:11:31.69141
7174608517	1	2026-04-17 20:14:40.927527
6576009979	1	2026-04-17 20:16:05.593608
6355460989	1	2026-04-17 21:28:51.474294
7239111152	1	2026-04-17 21:59:23.180256
5454576915	1	2026-04-17 22:33:20.842636
7740153991	1	2026-04-17 22:33:23.299363
5222128613	1	2026-04-17 22:33:32.621842
5415358039	1	2026-04-18 16:55:46.359075
7574632699	1	2026-04-18 19:42:17.023228
5235168504	1	2026-04-18 21:21:15.130674
8214167704	1	2026-04-19 04:17:09.525859
8056909438	1	2026-04-19 09:59:57.51863
6786242540	1	2026-04-20 18:57:21.671384
7453203694	0	2026-04-21 06:02:01.065286
8216250934	0	2026-04-21 13:56:41.99597
6683972858	0	2026-04-21 15:11:27.727064
6179219688	1	2026-04-21 17:19:48.929201
7368202514	1	2026-04-21 17:29:45.916822
6857939975	0	2026-04-22 20:03:24.310947
6885186666	1	2026-04-23 00:05:09.880711
5854573587	13	2026-04-23 13:37:36.561472
5535808708	0	2026-04-24 10:15:30.271532
8598198390	0	2026-04-24 21:52:51.418004
8286859962	0	2026-04-25 19:44:55.888645
7746046007	1	2026-04-26 08:19:03.800899
7310584834	0	2026-04-26 14:38:08.820843
5588471450	1	2026-04-26 23:40:15.549389
6240878770	1	2026-04-28 05:34:50.274203
8464998664	1	2026-04-28 09:15:01.254418
7514359523	13	2026-04-28 14:09:20.194403
8037159316	0	2026-04-28 17:24:31.904223
7703193779	13	2026-04-29 03:03:00.738733
8542152407	1	2026-04-29 05:16:50.3174
8468016104	1	2026-04-29 06:42:10.773035
7302513580	1	2026-04-29 19:02:48.399363
7107022202	13	2026-04-30 12:07:02.559783
8611614493	1	2026-05-02 08:15:18.776827
6217677522	13	2026-05-02 17:20:48.934012
8678910305	18	2026-05-02 20:04:08.212433
7596452439	17	2026-04-17 20:46:05.360923
8300360365	1	2026-05-07 00:06:47.572518
8187764784	17	2026-04-17 19:49:48.37613
7597362284	18	2026-05-04 17:21:32.154476
7387314389	1	2026-05-04 17:36:23.671521
6409821771	1	2026-05-04 18:28:25.351885
6263878232	17	2026-05-04 18:45:15.051179
8726316433	1	2026-04-06 23:00:49.36421
5660577046	17	2026-05-11 09:38:49.180172
8192906362	0	2026-05-11 14:33:17.293987
7471385119	1	2026-04-13 22:15:46.326684
7813069468	1	2026-05-07 00:25:17.550157
6729659968	1	2026-04-19 09:09:32.028586
8380139583	1	2026-05-06 22:56:00.637513
6256913829	1	2026-05-06 23:05:10.509573
6538167943	1	2026-05-06 23:21:04.08076
6488872577	8	2026-05-08 14:43:16.777687
7518863743	8	2026-05-09 21:52:19.746517
7544664630	13	2026-05-08 17:12:55.604868
5556524947	1	2026-04-11 17:12:17.72546
6250199428	1	2026-04-12 15:42:50.188405
6588278938	1	2026-05-07 12:45:35.763393
6287878174	1	2026-05-07 13:36:00.259759
1659265421	8	2026-05-08 18:19:14.160842
5946893352	18	2026-05-08 18:47:08.134529
7128896646	1	2026-05-08 19:11:31.89414
5760028323	1	2026-04-08 11:38:08.074805
8202593608	8	2026-05-08 12:39:15.555001
6018795251	1	2026-04-16 20:16:58.503526
7679018255	13	2026-05-08 14:01:12.883913
5839336556	8	2026-05-08 19:59:41.775447
8375199999	1	2026-05-08 20:10:59.965466
7546140009	1	2026-05-06 18:24:55.481038
7100605165	13	2026-05-08 23:17:57.322599
5589657070	1	2026-05-08 23:46:39.812443
6635684839	8	2026-05-09 17:04:52.677045
6129341635	1	2026-05-09 17:08:31.509854
6062523917	8	2026-05-09 19:23:50.871247
7939392449	1	2026-05-06 19:27:35.393677
5512941168	1	2026-05-12 22:58:24.508067
7358383509	1	2026-05-13 19:13:40.161707
6530364511	17	2026-05-06 23:29:38.885052
7025363896	13	2026-05-10 17:05:41.785613
6893591029	13	2026-05-10 19:56:50.33909
5122118107	1	2026-05-13 22:59:32.232286
5104073058	1	2026-04-30 20:57:04.881104
1951225967	8	2026-05-13 23:55:29.969131
8319698469	1	2026-04-29 07:43:39.900716
7415555924	1	2026-05-14 17:01:56.490862
6620710987	1	2026-05-14 17:13:33.470265
7427289420	1	2026-05-14 17:33:39.874183
5426803479	1	2026-05-14 18:21:35.199337
5303731176	1	2026-05-14 18:54:47.065863
6872029651	1	2026-05-14 19:15:41.86704
8056058390	17	2026-05-15 07:24:13.242355
8469299160	1	2026-05-15 15:19:51.226343
7006856163	1	2026-05-15 18:00:20.710038
6288617529	18	2026-05-07 20:20:57.756119
6167797720	1	2026-05-03 15:44:40.565071
8430965668	17	2026-05-16 17:54:52.960267
5234386942	1	2026-05-20 14:44:09.302255
8235799915	18	2026-05-18 08:19:37.720932
6069078850	17	2026-04-17 21:37:23.599094
7368552878	1	2026-05-20 17:36:45.83796
7465985372	1	2026-05-21 11:17:43.600826
8264518538	1	2026-05-21 13:54:25.484936
6415628479	0	2026-05-22 00:31:36.230658
5515357144	1	2026-05-24 12:31:15.453902
6720124032	1	2026-04-13 08:43:02.175764
5534474259	1	2026-04-06 22:11:52.386592
8279431973	1	2026-05-24 13:18:42.280459
6834163411	1	2026-05-26 01:30:24.255265
7803113312	1	2026-05-27 22:51:32.5058
5849510758	0	2026-05-30 14:41:24.586594
\.


--
-- Data for Name: user_states; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_states (user_id, state, updated_at) FROM stdin;
\.


--
-- Data for Name: user_xp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_xp (user_id, xp, level, updated_at) FROM stdin;
7596452439	8	1	2026-05-08 19:07:56.085356
5534474259	742	4	2026-05-30 18:45:53.869972
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, first_name, last_name, username, is_banned, joined_at, last_active, specialty_id, bio) FROM stdin;
5117943393	Lyes	Moussouni		0	2026-04-17 18:27:02.479883	2026-04-17 18:27:02.479883	\N	\N
5222128613	ridha		ridhaDZ	0	2026-04-17 22:33:24.656099	2026-04-21 23:08:29.297719	\N	\N
6053902152	meriem	ben		0	2026-04-14 20:20:46.070694	2026-04-14 20:25:50.563377	\N	\N
5642381740	🤍			0	2026-05-03 12:06:31.365142	2026-05-03 12:06:31.365142	\N	\N
6239613834	Bouchra			0	2026-04-18 15:19:25.932453	2026-04-27 17:26:05.728157	\N	\N
7274081857	wissal	✨🤍	ouissal18	0	2026-04-16 08:59:51.906137	2026-04-16 08:59:51.906137	\N	\N
8519069419	Rassim	Me	rassimme	0	2026-04-10 09:24:01.271474	2026-04-22 08:03:37.929007	\N	\N
6772617116	NADHIR	MED		0	2026-04-11 23:57:53.378646	2026-04-22 21:25:09.861151	\N	\N
2052357309	Med lamine rabah	Chebbab	Lami0ech8	0	2026-04-25 15:06:19.265083	2026-04-25 15:06:19.265083	\N	\N
6658854016	𝐫𝐨𝐦𝐢𝐨			0	2026-04-15 15:43:01.602435	2026-04-15 15:43:01.602435	\N	\N
8336857932	…		DJR_333	0	2026-04-12 12:31:29.234897	2026-04-12 12:31:29.234897	\N	\N
7959157354	Chourouk			0	2026-04-17 21:35:43.735477	2026-04-17 21:35:43.735477	\N	\N
5503490311	malak	han		0	2026-04-08 22:25:06.979829	2026-04-08 22:25:06.979829	\N	\N
7732059678	ASMA	Soso		0	2026-04-28 05:30:36.638682	2026-04-28 05:30:36.638682	\N	\N
7838741519	Aymen	Wassym		0	2026-04-11 16:50:28.562566	2026-04-11 16:51:18.925272	\N	\N
1645166876	Roumaissa	Tah	Tahraouifarida07	0	2026-04-11 21:27:21.449783	2026-04-11 21:27:26.787326	\N	\N
8489506493	Sirine			0	2026-04-11 11:54:40.122963	2026-04-17 16:38:30.693544	\N	\N
6300405014	Chourouk	Chou		0	2026-05-06 07:46:51.118065	2026-05-06 07:46:51.118065	\N	\N
6703881142	Aya ;3		Aaaaaaaax1704	0	2026-04-14 14:00:41.420483	2026-04-14 14:00:41.420483	\N	\N
6444593166	mohamed	achraf	boukercha44	0	2026-04-09 08:14:26.453006	2026-04-09 08:15:10.721473	\N	\N
8135760490	卂乃刀乇乚从卂乚乇长		malek_xb	0	2026-04-08 21:22:03.841654	2026-04-10 22:43:52.185724	\N	\N
7999045141	aimen			0	2026-04-25 18:11:30.175978	2026-04-25 18:11:30.175978	\N	\N
5663352778	Akram		DONTTAGMEUBASTARD	0	2026-04-11 07:20:23.337718	2026-04-25 22:30:10.524283	\N	\N
8443541884	abdou	kh	abdoukh77	0	2026-04-16 20:31:59.821896	2026-04-16 20:32:59.489465	\N	\N
6488864330	Meriem	Meriem		0	2026-04-28 09:23:44.298187	2026-05-04 16:07:07.051588	\N	\N
8281559444	Miss_ouDhⵣ		Miiss_odh	0	2026-04-07 20:54:11.887251	2026-04-07 20:54:11.887251	\N	\N
8092171184	أمينُ		a1mennnn	0	2026-05-04 19:19:24.146036	2026-05-04 19:19:24.146036	\N	\N
6204776495	hass_xz		hassx8	0	2026-04-24 19:13:07.127395	2026-04-24 19:13:07.127395	\N	\N
8230180687	Tasnime	Belhadi		0	2026-04-11 09:17:09.107998	2026-04-12 10:57:52.118936	\N	\N
8056909438	K	Sifo		0	2026-04-19 09:59:58.249017	2026-04-19 11:49:00.374409	\N	\N
8248917515	声	月🌙🤍		0	2026-04-14 14:18:20.087786	2026-04-14 16:34:39.54584	\N	\N
7150716856	wassim	Benseradj		0	2026-04-30 18:17:28.561182	2026-04-30 18:17:28.561182	\N	\N
5495047549	Haitham		Haitham0916	0	2026-05-04 17:44:58.03357	2026-05-04 17:44:58.03357	\N	\N
6926103065	A	B	nobody1445	0	2026-04-09 07:39:27.666162	2026-04-10 04:13:22.266745	\N	\N
7544162556	∅∅∅		A200000rr	0	2026-04-25 23:18:40.82738	2026-04-25 23:18:40.82738	\N	\N
8178887525	Saida		saiidaa_aa	0	2026-04-16 20:40:28.363019	2026-04-16 20:42:18.030905	\N	\N
7006856163	Sofia	Bh		0	2026-05-15 18:00:15.82393	2026-05-19 08:47:41.444011	\N	\N
8261089899	Assia			0	2026-05-08 19:43:57.179552	2026-05-08 19:43:57.179552	\N	\N
5814084225	ZAKARIA		user1820102007	0	2026-04-12 00:15:49.617337	2026-04-12 00:20:14.85076	\N	\N
5471479087	Arwa	Slh Slh		0	2026-04-14 02:03:01.357166	2026-04-14 02:03:01.357166	\N	\N
5261454927	Wissam			0	2026-05-04 22:04:54.768067	2026-05-04 22:04:54.768067	\N	\N
8304386091	Aya	Errahmane		0	2026-04-17 16:45:00.820882	2026-04-17 18:03:42.140741	\N	\N
7537361891	𝓝𝓪𝓱𝓵𝓪	𝓼𝓮𝓫𝓽𝓲		0	2026-04-11 09:38:57.907812	2026-04-11 10:26:47.3445	\N	\N
7174608517	🌷 𝒀𝒂𝒔𝒎𝒊𝒏𝒆 🌷		Yasm_eene	0	2026-04-17 19:44:42.025547	2026-04-25 14:15:05.180784	\N	\N
5563819069	Hafsa		hafsaa11	0	2026-04-12 04:05:38.732016	2026-04-12 13:22:39.947455	\N	\N
8466373785	Ha Sara			0	2026-05-05 20:28:47.480363	2026-05-05 20:28:47.480363	\N	\N
6576009979	🐣			0	2026-04-17 20:16:02.341774	2026-04-22 22:54:10.215371	\N	\N
5386256069	Alaa			0	2026-04-14 00:06:56.297661	2026-04-29 06:20:59.172922	\N	\N
5697743309	Yasmine	ysm	Yasmineysm	0	2026-05-09 20:49:54.725997	2026-05-09 20:49:54.725997	\N	\N
5668550674	Youcef		youcefChek	0	2026-04-15 21:58:04.39164	2026-04-15 21:59:03.830331	\N	\N
7827585957	ᯓᡣ𐭩			0	2026-05-12 18:40:17.844725	2026-05-12 18:40:17.844725	\N	\N
7107022202	hb.douaa			0	2026-04-24 21:35:39.108672	2026-04-30 12:07:32.123395	\N	\N
5664588045	Abdou			0	2026-04-11 15:49:47.472186	2026-04-11 15:51:07.471833	\N	\N
6390634393	Islam	Sh		0	2026-05-02 21:51:05.134486	2026-05-02 21:51:05.134486	\N	\N
6857939975	Mouh			0	2026-04-22 20:03:21.766676	2026-04-22 20:03:41.765135	\N	\N
8661807153	Mohamed	Dj	lhydri	0	2026-05-13 16:38:32.524167	2026-05-13 16:38:32.524167	\N	\N
8078439333	Serine			0	2026-05-08 10:28:08.13891	2026-05-08 10:28:08.13891	\N	\N
8168313176	Blueberry		Heeeeeey_BW	0	2026-04-17 10:34:55.92789	2026-04-17 14:56:27.106292	\N	\N
7662120392	Mo	Seddad	moseddad	0	2026-04-06 22:32:01.655785	2026-04-15 23:29:29.139875	\N	\N
5819398164	Chenouf	Yacine		0	2026-04-24 21:42:09.15098	2026-04-24 21:42:09.15098	\N	\N
7782903279	Lina	Linouch	linalami1	0	2026-04-17 20:11:32.323564	2026-04-17 20:11:52.324017	\N	\N
8348972379	Yasser			0	2026-04-18 08:15:28.74724	2026-04-18 08:16:18.748929	\N	\N
8684809524	Taki	Ai		0	2026-04-17 19:55:22.113485	2026-04-17 19:55:22.113485	\N	\N
5454576915	🇫🇷		x_arthur0	0	2026-04-17 22:33:24.656099	2026-04-17 22:33:54.659961	\N	\N
8214011899	Dalil	Sa		0	2026-04-17 18:59:19.859881	2026-04-17 18:59:19.859881	\N	\N
6839713112	She's_sarah🪻		Sheis_sarah	0	2026-04-17 21:55:04.038694	2026-04-17 21:55:24.03993	\N	\N
6355460989	Zakaria	Zaki		0	2026-04-17 21:28:43.646268	2026-04-17 21:29:43.650299	\N	\N
7960205934	şάмάħ Ŝ		Samah2OO7	0	2026-04-17 20:02:02.197011	2026-04-17 20:02:02.197011	\N	\N
5128994813	Abdel	wadoud	wadoud93	0	2026-05-05 15:04:38.450835	2026-05-05 15:04:38.450835	\N	\N
8480411097	melissa		melssa_bk	0	2026-04-18 14:32:40.435324	2026-04-18 14:32:40.435324	\N	\N
8268015430	🌸ℋ𝒶𝒻𝓈𝒶🌸		Hafsabko	0	2026-05-20 10:29:23.774956	2026-05-20 10:29:33.774015	\N	\N
7735378556	🌹	🌹		0	2026-05-06 18:07:23.481247	2026-05-07 13:17:57.358019	\N	\N
5526578095	Kinane		Kr726	0	2026-04-18 14:33:30.448924	2026-04-18 14:33:30.448924	\N	\N
7239111152	wahab			0	2026-04-17 21:59:24.083422	2026-04-17 22:00:04.085486	\N	\N
5047971015	Kaouther			0	2026-05-08 12:21:29.618238	2026-05-08 12:21:29.618238	\N	\N
8648101632	すくな	がんばれ がんばれ		0	2026-04-19 18:49:51.562356	2026-04-19 18:49:51.562356	\N	\N
7537692068	🐬			0	2026-04-17 20:08:52.310093	2026-05-01 16:09:38.465771	\N	\N
8141424235	Khadidja			0	2026-05-01 22:13:00.7819	2026-05-01 22:13:00.7819	\N	\N
7740153991	Rania		ichbin5	0	2026-04-17 22:33:24.656099	2026-04-19 07:56:36.294602	\N	\N
5426803479	Hiba			0	2026-04-08 21:46:38.716747	2026-05-19 11:30:45.102046	\N	\N
7475230873	Mounira laadour			0	2026-04-18 15:35:51.444925	2026-04-18 15:35:51.444925	\N	\N
7216357083	Zedadra	Saja		0	2026-04-11 11:35:49.697531	2026-05-19 21:29:34.143677	\N	\N
6608086783	Belguidoum	Ali Maghrebi	llyyyyeeee	0	2026-04-18 15:55:22.451206	2026-04-18 15:55:22.451206	\N	\N
7260277114	𝓜𝓸𝓱𝓪𝓶𝓶𝓪𝓭			0	2026-04-17 18:17:12.357583	2026-04-18 17:50:08.74888	\N	\N
6711478016	Soumia	Lb		0	2026-04-18 17:50:18.748879	2026-04-18 17:50:18.748879	\N	\N
5729661734	Ismail	Abidat		0	2026-04-18 17:51:08.751971	2026-04-18 17:51:08.751971	\N	\N
6718765669	islam	Boumaza		0	2026-04-18 18:18:08.929522	2026-04-18 18:18:08.929522	\N	\N
8375285216	Abdrahim	H♂️		0	2026-04-18 18:22:18.961115	2026-04-18 18:22:18.961115	\N	\N
7755683989	Alica 🧚🏻‍♀️			0	2026-04-24 12:08:51.3535	2026-04-24 12:08:51.3535	\N	\N
8214167704	Mohammed Amin	BOUHADJAR		0	2026-04-19 04:17:12.891067	2026-04-19 04:17:42.893785	\N	\N
5399583894	Moh	🧬❤️	khalil_elhadi	0	2026-04-18 16:15:09.453402	2026-04-18 16:15:09.453402	\N	\N
6786242540	🌸ꪀᎥᏂᥱძ🌸			0	2026-04-20 18:57:19.59087	2026-04-20 18:58:39.596252	\N	\N
5235168504	مخلوفي	سمية		0	2026-04-18 21:21:09.705442	2026-04-20 07:09:44.522088	\N	\N
6739428722	fatima	zahra		0	2026-04-14 15:00:47.807937	2026-04-21 22:05:42.131784	\N	\N
7178011134	Raouf			0	2026-04-09 08:47:33.379148	2026-05-02 15:43:29.585175	\N	\N
8464998664	D		Ouumoubey	0	2026-04-28 09:15:04.240402	2026-04-28 09:20:54.279287	\N	\N
2069494821	Mohamed	Khalil	Khalil1258	0	2026-04-21 06:53:58.578119	2026-04-21 06:53:58.578119	\N	\N
6236012451	Abd Elrahmen	Rahal		0	2026-04-21 13:37:15.061319	2026-04-21 13:37:15.061319	\N	\N
6287878174	lynaa		lillishinee	0	2026-05-07 13:35:57.459687	2026-05-07 13:36:37.461939	\N	\N
136817688	Channel		Channel_Bot	0	2026-04-11 13:01:15.563753	2026-05-03 11:00:40.457045	\N	\N
7194386140	Mak	Taha		0	2026-04-11 18:10:30.850217	2026-05-29 16:04:35.057624	\N	\N
5760028323	Safwane	_brh		0	2026-04-08 11:37:54.263537	2026-05-30 19:58:34.895492	\N	\N
8705652002	•			0	2026-04-13 17:20:44.009047	2026-04-19 12:51:38.042324	\N	\N
5404090166	Sarah	Abed		0	2026-04-21 13:56:25.143604	2026-04-21 13:56:25.143604	\N	\N
6011595158	Ri	Ma	rima6417	0	2026-04-27 15:38:55.058618	2026-04-27 15:38:55.058618	\N	\N
8216250934	́	’		0	2026-04-21 13:45:55.098158	2026-04-21 13:56:55.146066	\N	\N
5589327093	Kai	bob		0	2026-05-04 10:40:15.446837	2026-05-04 10:40:15.446837	\N	\N
6727826231	Maria	wch		0	2026-04-24 16:28:00.207713	2026-04-24 16:28:00.207713	\N	\N
8022230713	kha	oula	khaoula_a	0	2026-04-24 22:20:15.161346	2026-04-24 22:20:15.161346	\N	\N
8213746275	.			0	2026-04-21 16:35:05.923082	2026-04-21 16:35:05.923082	\N	\N
8096752070	Dali🌷			0	2026-04-21 16:35:05.923082	2026-04-21 16:35:15.922139	\N	\N
6265954110	Meriem			0	2026-04-21 16:35:15.922139	2026-04-21 16:35:15.922139	\N	\N
7933705007	Dhikra			0	2026-05-05 15:31:28.777617	2026-05-05 15:31:28.777617	\N	\N
6783498491	Sirine		SirinaR6	0	2026-04-28 01:35:32.349257	2026-04-28 01:35:32.349257	\N	\N
5190316564	Amine			0	2026-04-28 05:49:56.753733	2026-04-28 05:49:56.753733	\N	\N
5618043832	Haroun			0	2026-04-28 05:49:56.753733	2026-04-28 05:49:56.753733	\N	\N
8286859962	𝐌𝐢𝐬𝐬 𝐒𝐢𝐚		Miss_sia99	0	2026-04-25 12:35:01.135732	2026-04-25 19:44:59.6284	\N	\N
5662466130	Htm	Htm		0	2026-04-27 00:22:49.409921	2026-04-27 00:22:49.409921	\N	\N
5535808708	🏳️			0	2026-04-24 10:15:30.259232	2026-04-24 10:15:40.258423	\N	\N
5598476264	Adx			0	2026-05-04 13:57:25.475428	2026-05-04 13:57:25.475428	\N	\N
7094571950	⁦⁦aya.		suzume346	0	2026-05-12 18:56:38.054167	2026-05-12 18:56:38.054167	\N	\N
8203289747	Al	Bl		0	2026-05-03 13:34:08.735334	2026-05-03 16:21:00.82441	\N	\N
8178974907	Wæssīmē	Gā		0	2026-04-28 01:42:23.964465	2026-04-28 01:42:23.964465	\N	\N
7561757793	🎀Sousou♡	Queen🎀		0	2026-04-24 09:52:19.763784	2026-04-24 16:54:30.321451	\N	\N
8503576446	Yacine-Djidi	❕❕		0	2026-04-26 01:00:01.334928	2026-04-26 01:10:51.399405	\N	\N
6179219688	Meriem	Bouchiba		0	2026-04-21 17:19:56.192543	2026-04-21 17:22:56.197891	\N	\N
7368202514	N			0	2026-04-21 17:29:46.235067	2026-04-21 17:29:56.237169	\N	\N
7050535129	مَرْيَمٰ|١٤٢٦هـِ☕		benbennour	0	2026-04-24 14:38:19.620579	2026-04-24 14:38:19.620579	\N	\N
7703193779	𝘽𝙞𝙡𝙖𝙡	🍷		0	2026-04-29 03:02:58.284933	2026-04-29 03:03:28.286182	\N	\N
7626346023	imane			0	2026-05-04 17:45:18.037608	2026-05-04 17:45:18.037608	\N	\N
5487459125	Ràwyä	Moktar	R_a_w_y_a	0	2026-05-10 13:21:09.402687	2026-05-10 13:21:09.402687	\N	\N
7363225170	(‿)		a0026a0	0	2026-04-28 03:35:25.969366	2026-04-28 03:35:25.969366	\N	\N
6818091367	Saidi	Ahmed		0	2026-04-26 11:08:50.937964	2026-04-26 11:08:50.937964	\N	\N
6597697419	Abdou	Sahari	abdou_sahari	0	2026-04-25 09:13:52.922867	2026-04-25 09:13:52.922867	\N	\N
6583492394	Rayane	NC	Rayane_Nc	0	2026-04-24 15:29:59.901313	2026-04-24 15:29:59.901313	\N	\N
5252243370	مايكي | 𝐌𝐈𝐊𝐄𝐘		AnimeCloudAppbot	0	2026-04-24 15:38:59.952202	2026-04-25 13:41:43.112441	\N	\N
7915291937	R	🫶🏻	Romaissa_irb	0	2026-04-28 01:35:42.350805	2026-04-28 01:35:42.350805	\N	\N
8607692860	𝑛𝑎𝑟𝑖𝑚𝑎𝑛𝑒		nari_2012x07	0	2026-04-24 22:35:57.514152	2026-04-27 12:00:03.740554	\N	\N
7792510443	mikaeeeeeela		maaaluuqa	0	2026-05-05 21:04:17.885987	2026-05-05 21:04:17.885987	\N	\N
7983781575	Rahim	Abr		0	2026-05-06 18:24:43.652586	2026-05-06 18:24:43.652586	\N	\N
5854573587	𝑴𝒐𝒖𝒖𝒄𝒉𝒂🦢			0	2026-04-23 13:37:37.320818	2026-04-23 17:26:39.031077	\N	\N
5680763644	Zouzou	Aftis		0	2026-05-04 22:34:45.208405	2026-05-04 22:34:45.208405	\N	\N
6996935252	Louaii 𓅓		Waipes1	0	2026-04-30 11:14:21.776959	2026-05-11 05:02:56.61583	\N	\N
6786245628	Mer	iem		0	2026-04-26 21:23:08.353747	2026-05-04 17:58:58.186765	\N	\N
6683972858	مصعب		mossatomic	0	2026-04-21 15:11:25.471135	2026-04-25 09:53:13.151216	\N	\N
8598198390	RaNda	✨		0	2026-04-24 21:52:49.210073	2026-04-24 23:16:33.856097	\N	\N
7766275352	Mouad	Slimani		0	2026-05-20 19:07:49.229322	2026-05-20 19:07:49.229322	\N	\N
5586098932	Chaima Amrani			0	2026-05-06 22:15:09.274066	2026-05-06 22:15:09.274066	\N	\N
6313351935	ririe	️		0	2026-04-27 21:17:06.884065	2026-04-27 21:17:06.884065	\N	\N
8752445416	`````		oo9yfb	0	2026-04-27 21:21:56.917547	2026-04-27 21:21:56.917547	\N	\N
7612659026	Chahrazad_sofia			0	2026-04-27 21:26:26.940817	2026-04-27 21:26:26.940817	\N	\N
6536523837	Firdaws	BM🎓	MariemBou	0	2026-04-11 18:06:07.535837	2026-04-25 22:05:40.369216	\N	\N
8335346801	Kaouther	💜	Kaouther_28	0	2026-04-27 21:33:16.977819	2026-04-28 06:39:57.768394	\N	\N
6406667018	🤎🌿			0	2026-04-27 21:16:36.880483	2026-04-27 21:27:36.947363	\N	\N
6268101151	عبير🍁🥥		Abiiiiirkh	0	2026-04-27 21:29:36.960959	2026-04-27 21:29:36.960959	\N	\N
2064948397	🩷Ik	ram💜	Ikramnouas	0	2026-04-27 21:28:56.95565	2026-04-27 21:29:56.963015	\N	\N
5900166313	Ali			0	2026-04-27 21:36:36.993531	2026-04-27 21:36:36.993531	\N	\N
7390438035	im	eneeee		0	2026-04-27 21:52:57.061294	2026-04-27 21:52:57.061294	\N	\N
8585580215	.			0	2026-04-27 22:12:47.169283	2026-04-27 22:12:47.169283	\N	\N
5573870603	Lyna			0	2026-04-27 22:12:57.169898	2026-04-27 22:12:57.169898	\N	\N
7773564107	Sabah 🪻			0	2026-04-27 22:13:07.170739	2026-04-27 22:13:07.170739	\N	\N
6127207108	Sara			0	2026-04-27 22:13:57.174376	2026-04-27 22:13:57.174376	\N	\N
7238347425	Ahmed	Abderrahmane		0	2026-04-27 22:14:07.172139	2026-04-27 22:14:07.172139	\N	\N
8497229077	Amira	Mez		0	2026-04-27 22:16:17.190101	2026-04-27 22:16:17.190101	\N	\N
8125239404	Maria	Bhl		0	2026-04-27 22:17:07.196384	2026-04-27 22:17:07.196384	\N	\N
6045607354	souhil	CH		0	2026-04-27 22:15:17.18192	2026-04-27 22:18:07.199296	\N	\N
7258759637	𝓡𝓪𝔂𝓪𝓷🏴‍☠️🕷️			0	2026-04-27 22:11:27.162933	2026-04-27 22:18:37.203538	\N	\N
7236678866	Wissam			0	2026-04-27 22:23:07.233318	2026-04-27 22:23:07.233318	\N	\N
5838278144	M			0	2026-04-27 22:12:37.167815	2026-04-27 22:23:27.234174	\N	\N
7503514699	AYA❣️			0	2026-04-27 22:27:27.256617	2026-04-27 22:27:27.256617	\N	\N
6907073552	Eiyuaa			0	2026-04-28 07:10:42.233871	2026-04-28 07:10:42.233871	\N	\N
8479062303	Hadil	Ch	hadilch1	0	2026-04-28 07:28:02.619855	2026-04-28 07:28:02.619855	\N	\N
6305702246	Ness💕			0	2026-04-27 22:29:27.265975	2026-04-28 07:31:32.699576	\N	\N
8373722604	Ahmed	Denna		0	2026-04-28 04:38:36.322114	2026-04-28 04:38:36.322114	\N	\N
8528429676	❄️🌷𝒜ℳ𝒜𝒩ℐ🌷❄️		Amanikook07	0	2026-04-27 22:30:07.272132	2026-04-27 22:30:07.272132	\N	\N
8053618078	Khadidja Mi			0	2026-04-27 22:31:07.276809	2026-04-27 22:31:07.276809	\N	\N
6779550768	Y’			0	2026-04-27 21:11:26.846827	2026-04-27 23:12:47.486108	\N	\N
8670764390	Moncef	Slm		0	2026-04-27 23:23:17.562199	2026-04-27 23:23:17.562199	\N	\N
7491566289	S“		Sirin_ea	0	2026-04-27 23:37:27.641822	2026-04-27 23:37:27.641822	\N	\N
1970544372	faresss		f4_resss	0	2026-04-27 23:46:47.700135	2026-04-27 23:46:47.700135	\N	\N
5765332467	Wafaaae			0	2026-04-27 23:47:37.705886	2026-04-27 23:47:37.705886	\N	\N
7468330004	Meriem	Yahiaoui		0	2026-04-28 00:04:57.803341	2026-04-28 00:04:57.803341	\N	\N
5231785606	Krnrth			0	2026-04-28 00:23:47.916525	2026-04-28 00:23:47.916525	\N	\N
8515079029	Basat	Boudour		0	2026-04-28 00:43:28.036763	2026-04-28 00:43:28.036763	\N	\N
5765248801	???			0	2026-04-27 23:23:07.561939	2026-04-28 00:56:28.099618	\N	\N
7749653394	Yanis	Maddi		0	2026-04-28 01:12:28.208933	2026-04-28 01:12:28.208933	\N	\N
7386742163	Abdou	Ch	abdoo_ali77_7	0	2026-04-28 01:14:08.216593	2026-04-28 01:14:08.216593	\N	\N
7002849527	A			0	2026-05-04 17:08:17.705221	2026-05-04 17:08:17.705221	\N	\N
5724898709	Narimane			0	2026-05-05 05:04:05.667372	2026-05-05 05:04:05.667372	\N	\N
8434694373	Madina			0	2026-05-05 09:59:00.476282	2026-05-05 09:59:00.476282	\N	\N
7048049354	abdeldjalil	hassani		0	2026-04-28 12:51:38.999421	2026-04-28 12:51:38.999421	\N	\N
8366467319	B	🌹		0	2026-04-28 13:18:09.160397	2026-04-28 13:18:09.160397	\N	\N
5625496703	Ab_dou_X		T_FY56	0	2026-04-28 05:06:56.485056	2026-04-28 05:06:56.485056	\N	\N
6301637427	Abdou		aaabd_ou	0	2026-04-21 16:40:15.948144	2026-04-28 05:22:36.599197	\N	\N
7392886988	Eren			0	2026-04-28 13:33:29.227244	2026-04-28 14:08:39.422735	\N	\N
6240878770	𝐅 𝐀 𝐘 𝐄 𝐙 🍁			0	2026-04-28 05:34:56.666697	2026-04-28 05:35:36.669067	\N	\N
8611614493	.	.		0	2026-05-02 08:15:14.485414	2026-05-07 05:27:50.434094	\N	\N
8365743969	𝓜𝓪𝓱𝓪𝓫𝓪💗🌷محبه🇩🇿		Mahabaaaaaaa	0	2026-05-01 08:51:45.84621	2026-05-01 08:51:45.84621	\N	\N
5880904984	ŜŤÃŘ		uuurobvsl	0	2026-04-27 22:11:27.162933	2026-05-08 16:37:30.412168	\N	\N
8542152407	ㅤ		v12leo	0	2026-04-29 05:16:39.176263	2026-04-29 05:19:39.189313	\N	\N
6806325515	Ahmed Yasser	Hachou		0	2026-05-04 22:09:44.839835	2026-05-05 11:22:51.769269	\N	\N
8056058390	𝑴27682			0	2026-05-13 14:33:19.964997	2026-05-18 17:11:10.999896	\N	\N
7967569469	Maya	Bdf	Mayyabf	0	2026-05-02 22:20:45.295952	2026-05-02 22:20:45.295952	\N	\N
7310584834	نور	الهدى 🤍		0	2026-04-26 14:38:02.098732	2026-05-07 06:25:11.088417	\N	\N
7302513580	⚜️Houssam	Eddine		0	2026-04-29 19:02:48.444274	2026-05-09 19:22:23.761823	\N	\N
7803385892	A💜			0	2026-04-23 17:57:09.26471	2026-05-08 19:07:42.204895	\N	\N
8688313611	É__M3	D		0	2026-05-03 00:15:15.971854	2026-05-03 00:15:15.971854	\N	\N
7514359523	𝕴		Idriiiix	0	2026-04-25 19:57:59.670613	2026-05-03 18:09:22.082471	\N	\N
7839799057	Ayoub	Kc		0	2026-04-28 08:56:54.154849	2026-05-03 18:12:02.116725	\N	\N
6854972736	Лютфи|			0	2026-05-04 17:55:48.151546	2026-05-04 17:55:48.151546	\N	\N
8767940606	Abdennour	barkat		0	2026-05-04 17:55:58.152581	2026-05-04 17:55:58.152581	\N	\N
5785657215	isra			0	2026-05-04 19:49:52.986751	2026-05-29 14:51:04.94972	\N	\N
6040761848	Yacoub		Venorne	0	2026-04-09 17:35:09.684363	2026-05-15 06:25:49.754974	\N	\N
7609827426	Aya			0	2026-05-04 17:59:38.194395	2026-05-04 17:59:38.194395	\N	\N
8368445338	🥀🕊𝐈𝐜𝐡𝐫𝐚𝐤𝐞 🕊🥀			0	2026-05-05 20:32:27.530445	2026-05-09 21:05:24.983996	\N	\N
6686936504	الاء	عابدي		0	2026-05-05 15:11:18.561123	2026-05-05 15:11:18.561123	\N	\N
7251722877	Nesrine	Meh		0	2026-05-05 04:03:38.164235	2026-05-05 04:03:38.164235	\N	\N
8002341700	Said	Wa		0	2026-05-05 06:35:47.47194	2026-05-05 06:35:47.47194	\N	\N
8773611512	Ghogho🖤			0	2026-04-30 17:29:50.143917	2026-04-30 17:31:20.154112	\N	\N
5353407643	Maissa			0	2026-05-03 00:03:05.855432	2026-05-07 23:48:19.923814	\N	\N
8496335535	Sarra .			0	2026-05-05 20:32:47.528819	2026-05-05 20:32:47.528819	\N	\N
8117799855	إيلياء			0	2026-05-04 18:09:28.29549	2026-05-04 18:09:28.29549	\N	\N
6669464576	Maria 💋		Lb_maria	0	2026-05-04 19:32:04.283979	2026-05-04 19:32:04.283979	\N	\N
5916743033	Ha	Dil🌸💞		0	2026-05-03 18:40:52.502648	2026-05-03 18:40:52.502648	\N	\N
5782699182	Alaa			0	2026-05-04 18:15:08.333142	2026-05-10 14:54:41.511642	\N	\N
6918100402	Mira	Mira		0	2026-05-07 17:11:49.754613	2026-05-07 17:11:49.754613	\N	\N
7612571266	M	M		0	2026-05-04 19:40:10.786521	2026-05-13 17:43:23.491043	\N	\N
6915442217	Sara			0	2026-05-04 17:07:07.693851	2026-05-04 17:07:07.693851	\N	\N
6947981089	علي			0	2026-05-04 18:12:28.318235	2026-05-04 18:13:38.32422	\N	\N
5182715619	Brahim	Lounis		0	2026-05-11 05:11:56.809493	2026-05-11 05:11:56.809493	\N	\N
8201454178	Onion		gracie_0_0_0	0	2026-05-04 18:18:18.350619	2026-05-04 18:18:18.350619	\N	\N
6270473372	Maya🌸			0	2026-05-04 18:22:12.763809	2026-05-04 18:22:12.763809	\N	\N
7849038605	yasmina💅			0	2026-05-04 22:27:35.098493	2026-05-04 22:27:35.098493	\N	\N
7294755092	Ah_nedjmou			0	2026-05-05 07:17:37.951448	2026-05-05 07:17:37.951448	\N	\N
7674779775	🤍 raihaaaaaane		Raihaaaaaane	0	2026-05-04 19:37:00.747915	2026-05-04 19:37:00.747915	\N	\N
5748743043	مـرٍيَمـ		S_meriem6	0	2026-05-04 17:16:47.789841	2026-05-04 17:16:47.789841	\N	\N
8146497209	mimho	🦁		0	2026-05-04 14:34:05.88196	2026-05-04 17:17:07.793669	\N	\N
6028607926	Zaki			0	2026-05-18 15:48:39.404732	2026-05-18 15:48:59.405605	\N	\N
5062856589	Jjba	Glazer		0	2026-05-04 19:38:20.769604	2026-05-04 19:38:20.769604	\N	\N
7825765087	Laydii🫀			0	2026-05-04 19:21:14.167385	2026-05-05 07:21:47.980579	\N	\N
6080188703	Adem			0	2026-05-08 10:49:19.211311	2026-05-08 10:49:19.211311	\N	\N
8578426396	Queen Aura🌹			0	2026-05-04 17:18:57.807948	2026-05-04 17:18:57.807948	\N	\N
7661997592	Hiba	Hiba		0	2026-05-04 18:26:02.806011	2026-05-04 18:26:02.806011	\N	\N
8689164523	Ren			0	2026-05-06 09:36:01.916032	2026-05-06 09:36:01.916032	\N	\N
8443300294	Safa	Hch	safa_hch7	0	2026-05-29 16:11:15.064873	2026-05-29 16:11:15.064873	\N	\N
5491382024	Nihal			0	2026-05-04 19:21:04.165289	2026-05-08 20:48:47.628997	\N	\N
8027845854	🩵	🕊️	lucylily1725	0	2026-05-05 09:46:10.325857	2026-05-05 09:46:10.325857	\N	\N
6745499854	Lili	Lili		0	2026-05-05 10:06:00.595386	2026-05-05 10:06:00.595386	\N	\N
8018812574	Mina	Mina 🌺		0	2026-04-17 20:06:32.270717	2026-05-04 19:42:10.790085	\N	\N
7128896646	Dttm	.		0	2026-05-04 19:49:22.985043	2026-05-08 19:11:32.253815	\N	\N
5849510758	......			0	2026-05-30 14:41:17.350188	2026-05-30 14:41:27.330912	\N	\N
5881308692	Ouis	Oussama	ouss42ama	0	2026-05-03 03:07:08.271446	2026-05-03 03:08:48.294472	\N	\N
7800106782	𓍼 𝗦𝗜𝗗𝗢	💀⃤	sido_az	0	2026-05-03 00:12:25.941937	2026-05-03 03:18:08.437499	\N	\N
6564900193	T	Ritedj		0	2026-04-11 20:29:52.605296	2026-05-15 07:59:37.158519	\N	\N
7235876860	°	Fatima	Oafz7	0	2026-05-03 16:23:30.851336	2026-05-03 16:23:30.851336	\N	\N
6953516912	Islem	Kadri		0	2026-05-04 19:44:50.79747	2026-05-04 19:44:50.79747	\N	\N
7048982871	Amine	Moussaui		0	2026-05-04 06:53:42.097173	2026-05-04 06:53:42.097173	\N	\N
7629463948	Ibrâ			0	2026-05-04 19:45:20.799307	2026-05-04 19:45:20.799307	\N	\N
7939392449	had	ouuuuula		0	2026-05-04 20:16:03.482886	2026-05-09 21:22:45.256348	\N	\N
7890802435	.	Ayoub		0	2026-05-06 12:25:43.561417	2026-05-06 12:26:13.603067	\N	\N
8415155425	Douâa			0	2026-05-06 13:37:37.959888	2026-05-06 13:37:37.959888	\N	\N
8271547832	🪼			0	2026-05-04 19:47:12.971495	2026-05-04 19:47:12.971495	\N	\N
6624245542	Israa	ghe	israaghe	0	2026-05-03 16:49:41.217482	2026-05-03 16:49:41.217482	\N	\N
6409821771	Ahmed	Fliti		0	2026-05-04 18:27:32.82257	2026-05-15 21:45:06.128536	\N	\N
7218982790	Sam	Hri		0	2026-05-04 19:32:54.291392	2026-05-05 16:03:49.253008	\N	\N
5664972318	بدريه ✨		WWGSBOT	0	2026-05-03 18:08:22.079098	2026-05-03 18:08:22.079098	\N	\N
6518809123	🎀Hadil		hi_binom	0	2026-05-04 19:48:22.983498	2026-05-04 19:48:22.983498	\N	\N
6036425898	A		eyaymm	0	2026-05-04 20:11:23.447664	2026-05-07 07:23:03.998021	\N	\N
8235799915	ŘÃŴÃÃ		Rawaabar	0	2026-05-08 11:52:28.625204	2026-05-18 08:47:38.254319	\N	\N
6263878232	Islam	Zch		0	2026-05-04 18:41:12.942292	2026-05-29 13:22:24.835891	\N	\N
6182399562	Mouloud			0	2026-05-04 14:44:05.979235	2026-05-04 14:44:05.979235	\N	\N
7574632699	حفصة..		haf_mou	0	2026-04-18 19:42:19.482594	2026-05-16 19:10:58.410356	\N	\N
7908756476	🦢			0	2026-05-04 18:52:53.071614	2026-05-07 09:45:01.967469	\N	\N
5449891575	Abdou	Kh		0	2026-04-27 21:11:36.847093	2026-05-04 15:06:36.3377	\N	\N
6283137743	jimin♫☾ ❂	ssi	fifi_13yousra	0	2026-05-04 19:49:32.985201	2026-05-04 19:49:32.985201	\N	\N
6217677522	Kossay		kossaymkf	0	2026-05-02 17:20:51.325426	2026-05-30 19:19:43.514539	\N	\N
6561514070	amira	tlb		0	2026-05-03 20:19:33.634955	2026-05-03 20:19:33.634955	\N	\N
5900948123	yasmine			0	2026-05-03 20:28:53.722786	2026-05-03 20:28:53.722786	\N	\N
7163314505	Feriel	Ladaoui	Lad_feriel	0	2026-05-03 21:08:04.380794	2026-05-03 21:08:04.380794	\N	\N
6353800042	Khadidja		Khayala_khadidja	0	2026-05-03 21:28:24.827516	2026-05-03 21:28:24.827516	\N	\N
7746046007	I		InsB11	0	2026-04-08 14:52:15.239999	2026-05-25 20:17:31.008597	\N	\N
7951841177	TIAMIOU	Loutfiyath		0	2026-05-04 19:30:44.274167	2026-05-05 16:39:39.795113	\N	\N
8496101324	zaki	zaki		0	2026-05-04 19:55:43.010327	2026-05-04 19:55:43.010327	\N	\N
7546140009	abdo	djehiche	djehicheabdo	0	2026-05-04 18:28:22.826721	2026-05-25 21:12:02.001675	\N	\N
8159837057	مَ			0	2026-05-04 17:37:27.956565	2026-05-04 17:37:27.956565	\N	\N
7465610372	Ines	Ci		0	2026-05-04 19:57:53.262394	2026-05-04 19:57:53.262394	\N	\N
7644156797	ㅤㅤㅤㅤ		abde27dz	0	2026-05-04 17:39:57.987801	2026-05-04 17:39:57.987801	\N	\N
5573584534	رَحِيــــٓقـْ🌷			0	2026-05-04 08:03:32.97358	2026-05-04 08:04:22.985667	\N	\N
1959019465	𝒷		lililmo	0	2026-05-04 20:08:53.408712	2026-05-04 20:08:53.408712	\N	\N
6914095994	Anes	Khadraoui		0	2026-05-04 20:08:53.408712	2026-05-04 20:08:53.408712	\N	\N
1792702624	M...I	A...U	mahdi_Attou	0	2026-05-04 20:10:23.433399	2026-05-04 20:10:23.433399	\N	\N
7912511081	___	Tek		0	2026-05-04 18:44:32.972714	2026-05-04 18:44:32.972714	\N	\N
5621563987	أم عائشة	بإذن الله		0	2026-05-04 18:55:53.112493	2026-05-04 18:55:53.112493	\N	\N
7693215360	𝒁𝒊𝒏𝒆𝒃 🎀		Zineb_tal	0	2026-05-04 18:57:21.473408	2026-05-04 18:57:41.475797	\N	\N
5416595898	Racha		Xylbd	0	2026-05-04 20:19:23.515227	2026-05-04 20:19:23.515227	\N	\N
6677993230	Maram	🪻🪴		0	2026-05-04 20:23:53.567207	2026-05-04 20:23:53.567207	\N	\N
5876092372	-			0	2026-05-04 20:24:53.57896	2026-05-04 20:24:53.57896	\N	\N
7118589183	Israa	Israa	israa_1231	0	2026-05-04 18:50:53.039279	2026-05-04 20:25:23.584466	\N	\N
8782004087	Romaissa	Benabderrahmene		0	2026-05-04 20:34:33.698293	2026-05-04 20:34:33.698293	\N	\N
8664918697	said	said	said_torchi	0	2026-05-04 20:37:43.741254	2026-05-04 20:37:43.741254	\N	\N
5442139645	بشرى		Bouchera_S	0	2026-04-28 08:39:44.056409	2026-05-04 20:42:43.803045	\N	\N
5560417978	T	L	lina_tn20	0	2026-05-04 20:50:33.888402	2026-05-04 20:50:33.888402	\N	\N
6048996327	The		Thethe05	0	2026-05-04 20:55:03.940892	2026-05-04 20:55:03.940892	\N	\N
8373178706	🪿		Minouchah	0	2026-05-04 21:00:04.003129	2026-05-04 21:00:04.003129	\N	\N
8203929194	amel	zn		0	2026-05-04 21:01:44.027947	2026-05-04 21:01:44.027947	\N	\N
1735063951	Harabi	Abderrahmene		0	2026-05-04 21:03:34.045744	2026-05-04 21:03:34.045744	\N	\N
6251264950	Hâd	Jêr		0	2026-05-04 21:03:44.049509	2026-05-04 21:03:44.049509	\N	\N
6673917743	Anfel	Skendri		0	2026-05-04 21:11:14.129089	2026-05-04 21:11:14.129089	\N	\N
5604970328	Serine		Serinamf	0	2026-05-04 21:13:34.151844	2026-05-04 21:13:34.151844	\N	\N
8416226141	Meriem	Khali		0	2026-05-04 21:13:44.155231	2026-05-04 21:13:44.155231	\N	\N
7534378218	Abderahmane	Aouni		0	2026-05-04 21:19:34.2224	2026-05-04 21:19:34.2224	\N	\N
6811554141	🌺🌺	🌺🌺		0	2026-05-04 21:23:34.264034	2026-05-04 21:23:34.264034	\N	\N
7746774395	Pedriii'_'08		Hdvxydv	0	2026-05-04 21:26:54.297702	2026-05-04 21:26:54.297702	\N	\N
6207631297	imene			0	2026-05-04 21:35:24.393209	2026-05-04 21:35:24.393209	\N	\N
6126825188	Sarah			0	2026-05-04 22:28:55.114423	2026-05-04 22:28:55.114423	\N	\N
5162992961	Yasser		zyx_h	0	2026-05-04 22:48:35.4457	2026-05-04 22:48:35.4457	\N	\N
6375547840	MEHDI __DRB	xx__𝑀E𝐻_𝐷_𝐼__xx	DerbalMehdi	0	2026-05-04 21:36:34.405819	2026-05-04 21:36:34.405819	\N	\N
8023344784	هبة 🦋			0	2026-05-04 22:51:35.486251	2026-05-04 22:51:35.486251	\N	\N
7827767427	Fati			0	2026-05-04 22:54:35.530658	2026-05-04 22:54:35.530658	\N	\N
7007958659	Ismail	Ismail	ismaiil_1s	0	2026-05-04 22:54:45.532225	2026-05-04 22:54:45.532225	\N	\N
6495042225	B.M	db		0	2026-05-04 23:07:15.698355	2026-05-04 23:07:15.698355	\N	\N
7024037862	Ast🌔			0	2026-05-05 15:11:18.561123	2026-05-05 15:11:18.561123	\N	\N
7465614349	Sara			0	2026-05-04 23:25:25.94995	2026-05-04 23:25:25.94995	\N	\N
5314138379	Panda Mnl 🤧		Lesyeuxdemnl	0	2026-05-05 00:08:46.682333	2026-05-05 00:08:46.682333	\N	\N
5934598987	Mer			0	2026-05-05 01:15:17.749717	2026-05-05 01:15:17.749717	\N	\N
6169413861	Riham		ruheeeem	0	2026-05-05 01:34:35.32557	2026-05-05 01:34:35.32557	\N	\N
5589657070	el	hou	houssem_al	0	2026-05-05 16:49:29.94605	2026-05-15 20:59:15.510707	\N	\N
8209081434	Hala		halaarbaoui	0	2026-05-05 09:01:09.735343	2026-05-05 09:17:09.920809	\N	\N
6584394071	𝓒𝓱𝓪𝓪𝓶𝓼𝓼‌ ೀ		ChaM_ouSs	0	2026-05-05 15:37:28.869899	2026-05-05 15:37:28.869899	\N	\N
190190547	ɴ͟͞ᴀ͟͞ᴅ͟͞ᴇ͟͞R		i_t_5	0	2026-05-16 19:05:18.325597	2026-05-26 06:54:05.378555	\N	\N
5770436870	Mouhammed kassem	Ziaya		0	2026-04-09 08:52:29.595137	2026-05-08 08:03:06.938473	\N	\N
8384391317	Moha	Badr	mohabadr7	0	2026-05-04 21:45:24.484917	2026-05-04 21:45:24.484917	\N	\N
5089673068	Khaoula			0	2026-05-04 21:47:54.509243	2026-05-04 21:47:54.509243	\N	\N
7637247082	Amina	Medjad		0	2026-05-04 21:49:54.529184	2026-05-04 21:49:54.529184	\N	\N
5723460137	Marwa	G		0	2026-05-06 22:52:59.486546	2026-05-06 22:53:29.488144	\N	\N
8147371147	Adina	Salhi		0	2026-05-04 21:49:54.529184	2026-05-04 21:50:54.540579	\N	\N
7385014729	Sara		srr_aah	0	2026-05-04 21:54:04.591014	2026-05-04 21:54:04.591014	\N	\N
8356912014	safia	labidine		0	2026-05-28 20:53:21.623325	2026-05-28 20:53:21.623325	\N	\N
8285314323	Fadoua			0	2026-05-05 15:31:58.785403	2026-05-05 15:31:58.785403	\N	\N
5588471450	Sifooo	24		0	2026-04-26 23:40:19.172534	2026-05-15 21:58:06.291788	\N	\N
6588278938	♕Cнσcнσ	Αfσυи 32 ♕	chochoaf	0	2026-05-07 12:45:27.098174	2026-05-07 12:52:17.137819	\N	\N
6096424721	Serine	Serine		0	2026-05-05 20:37:47.595662	2026-05-05 20:37:47.595662	\N	\N
7314335511	🌸 Maria |	ماريا 🌸	Mariacha24	0	2026-05-05 21:21:48.135603	2026-05-05 21:21:48.135603	\N	\N
8069264500	hamza_Las_Vegas			0	2026-05-04 18:13:18.32367	2026-05-05 21:36:18.383101	\N	\N
7500829080	Lydia			0	2026-05-05 09:06:09.80808	2026-05-05 09:42:40.269441	\N	\N
5519516062	nouha			0	2026-05-08 20:23:37.457084	2026-05-08 20:23:37.457084	\N	\N
8046237171	💗✨		Justdkbro	0	2026-05-05 21:45:38.522761	2026-05-05 21:45:38.522761	\N	\N
5276601778	Aya ✨			0	2026-05-05 22:08:28.803239	2026-05-05 22:08:28.803239	\N	\N
8688882303	ام امياره			0	2026-05-05 22:18:18.960853	2026-05-05 22:18:18.960853	\N	\N
1804512916	Safaa	Chaala		0	2026-05-05 10:16:40.764939	2026-05-05 10:16:40.764939	\N	\N
8305441660	الاء	الرحمان	alaaberbia	0	2026-05-05 10:54:31.360212	2026-05-05 10:54:31.360212	\N	\N
5527725184	Nazhammoudi		nazhammoudi	0	2026-05-05 15:55:39.126798	2026-05-05 15:55:39.126798	\N	\N
6184225490	🐈‍⬛		bimbokit	0	2026-05-05 11:44:42.0389	2026-05-05 11:44:42.0389	\N	\N
8189996183	chaima			0	2026-05-05 11:57:02.195139	2026-05-05 11:57:02.195139	\N	\N
7379109630	H	*⁠.⁠✧	helowglow	0	2026-05-05 22:18:38.963742	2026-05-05 22:18:38.963742	\N	\N
5685117515	ALAAeddine	..		0	2026-05-05 12:32:57.103809	2026-05-05 12:32:57.103809	\N	\N
5795469322	=^・◦・🎀^=	нєℓℓσ кιтту ??	username79842	0	2026-05-06 14:22:08.184139	2026-05-06 14:22:08.184139	\N	\N
8300360365	Wahiba	ab		0	2026-05-05 23:04:49.589671	2026-05-07 00:07:17.283085	\N	\N
7025363896	Zaki			0	2026-05-10 17:05:44.369444	2026-05-10 17:07:24.395212	\N	\N
5257226053	✨✨			0	2026-05-05 16:04:39.263143	2026-05-05 16:04:59.265303	\N	\N
7695402883	Abderrahmen	Ben ghalia	Abderrahmennbenghaliaa	0	2026-05-05 10:09:20.63741	2026-05-05 16:05:29.265744	\N	\N
6726347045	🌷	..		0	2026-05-04 20:59:13.994712	2026-05-05 16:05:29.265744	\N	\N
6600739553	gho	🌸Frane	ghofrane1	0	2026-05-05 15:12:18.572554	2026-05-05 22:26:09.068608	\N	\N
2048300483	🤎		Wssl_i	0	2026-05-05 16:18:49.472113	2026-05-05 16:18:59.476537	\N	\N
6754801056	ŜẸĞĤ		jncgofd	0	2026-05-05 16:26:49.590856	2026-05-05 16:26:49.590856	\N	\N
8424707492	𝓡𝓸𝓾𝓶𝓪𝓲𝓼𝓼𝓪			0	2026-05-05 07:05:17.816331	2026-05-05 07:05:17.816331	\N	\N
7905722479	Ayoub	Te		0	2026-05-05 16:28:49.622754	2026-05-05 16:28:49.622754	\N	\N
7368552878	Fakhro			0	2026-05-20 17:36:19.150466	2026-05-20 17:44:19.148716	\N	\N
7448172195	ma	roua		0	2026-05-05 13:05:37.439806	2026-05-05 13:05:37.439806	\N	\N
8331651571	Q23		wwwwwwww962	0	2026-05-05 11:23:21.772229	2026-05-09 10:53:14.484961	\N	\N
6485931104	Firdaws	No		0	2026-05-06 13:50:48.025024	2026-05-06 13:50:48.025024	\N	\N
6296469251	Mokhtar	Fares		0	2026-05-05 13:25:37.574326	2026-05-05 13:25:37.574326	\N	\N
1756760664	Mohe❤️		BENYAMINAmohamed	0	2026-05-05 13:27:07.587896	2026-05-05 13:27:07.587896	\N	\N
8392727845	😌♾️		Plao_aa	0	2026-05-05 21:33:48.344379	2026-05-05 21:33:48.344379	\N	\N
7020253570	❄			0	2026-05-05 17:35:10.653372	2026-05-05 17:35:10.653372	\N	\N
8492754706	Amine	Mohamed		0	2026-04-18 14:32:30.432895	2026-05-05 07:20:47.977966	\N	\N
6669232431	Halima			0	2026-05-06 14:13:48.136442	2026-05-06 14:13:48.136442	\N	\N
5510965112	Cerine			0	2026-05-05 13:29:07.599144	2026-05-05 13:32:27.615645	\N	\N
8729294530	Merrrr		merrrrrrrrrrrrrrrrrrrrrrr	0	2026-05-05 13:37:07.655337	2026-05-05 13:37:07.655337	\N	\N
1917416645	Hachemi Aicha			0	2026-05-05 13:41:07.695812	2026-05-05 13:41:07.695812	\N	\N
7813069468	ISSAK		ISSAK_69	0	2026-05-05 08:10:49.183234	2026-05-07 16:09:49.021688	\N	\N
7712495583	Bouchra😇	Bentahar🤍	BouchraBentahar	0	2026-05-07 17:18:39.833071	2026-05-07 17:18:39.833071	\N	\N
6455134159	Moh	Araria		0	2026-05-06 14:40:58.295154	2026-05-06 14:40:58.295154	\N	\N
6983086758	Hadeel	SL		0	2026-05-04 23:15:45.807902	2026-05-04 23:15:45.807902	\N	\N
5718477026	anis	sa		0	2026-04-08 12:02:51.130153	2026-05-15 23:27:27.628212	\N	\N
6337368869	Ahlam	Korba	ahlaam3214	0	2026-05-05 13:47:17.744636	2026-05-05 13:47:17.744636	\N	\N
8475336118	Poc			0	2026-05-05 14:08:07.911541	2026-05-05 14:08:07.911541	\N	\N
6167797720	Amf			0	2026-05-03 15:44:20.298868	2026-05-16 01:12:29.198846	\N	\N
6065137895	meriem			0	2026-05-05 13:46:47.740098	2026-05-05 18:56:01.59488	\N	\N
8437093973	Ww			0	2026-05-05 08:23:09.3073	2026-05-05 08:23:09.3073	\N	\N
5666860371	aski		its_hiim	0	2026-05-05 08:24:49.319069	2026-05-05 08:25:19.324117	\N	\N
7122589057	🤍🍓		nour_11111111	0	2026-05-05 08:33:39.397169	2026-05-05 08:33:39.397169	\N	\N
6110641023	Aya🦋🩷			0	2026-05-05 08:34:09.400238	2026-05-05 08:34:09.400238	\N	\N
7554587758	Lylia			0	2026-05-05 08:42:59.501105	2026-05-05 08:42:59.501105	\N	\N
7722114327	Anfel			0	2026-05-05 08:46:29.523245	2026-05-05 08:46:29.523245	\N	\N
6952132294	Aya	Guellai	Ayaguel26	0	2026-05-05 08:46:39.524258	2026-05-05 08:46:39.524258	\N	\N
8301328592	maro	maro		0	2026-05-05 18:56:41.603456	2026-05-05 18:56:41.603456	\N	\N
7585431918	Benamar	Hind		0	2026-05-05 09:04:49.795724	2026-05-05 09:04:49.795724	\N	\N
1923398323	𝐀𝐦𝐚𝐧𝐢	𝐚𝐦𝐚𝐧𝐢		0	2026-05-05 18:57:01.603412	2026-05-05 18:57:01.603412	\N	\N
5779352238	Amira			0	2026-05-05 19:04:31.727605	2026-05-05 19:04:31.727605	\N	\N
6466668650	♡𝓡𝓪𝔂𝓪𝓷♡			0	2026-05-05 06:22:27.333365	2026-05-05 06:22:27.333365	\N	\N
5362240055	Anis	Parker	PARKER_7	0	2026-05-05 19:35:12.354915	2026-05-05 19:35:12.354915	\N	\N
8345258214	Aḿina	Mèc		0	2026-05-05 15:21:28.660614	2026-05-06 07:45:11.113682	\N	\N
7453203694	Ghost		Kissamiot5	0	2026-04-21 06:01:48.271573	2026-05-06 08:04:01.273298	\N	\N
5098493417	Ik	Ram		0	2026-05-05 14:41:18.145549	2026-05-05 14:41:18.145549	\N	\N
6815889863	Anfel Grimes			0	2026-05-05 20:17:27.347082	2026-05-05 20:17:27.347082	\N	\N
7753675451	🧚🏼‍♀️			0	2026-05-05 19:33:32.331091	2026-05-05 19:33:32.331091	\N	\N
8051341730	Nesrine			0	2026-05-05 08:22:49.303954	2026-05-06 12:41:43.763343	\N	\N
7311979403	Mossadek	Belaid		0	2026-05-05 23:28:39.900107	2026-05-05 23:28:39.900107	\N	\N
7789613214	Abdrahim_.			0	2026-05-05 20:16:07.336251	2026-05-05 20:16:07.336251	\N	\N
6919626638	Meriem	Hana	MeriemHanaa	0	2026-04-14 13:57:29.394306	2026-05-06 03:32:19.332183	\N	\N
5012667005	🪽		eczliiiipse	0	2026-05-06 04:19:29.707626	2026-05-06 04:19:29.707626	\N	\N
6255325094	fella	🩷🫀		0	2026-05-06 14:03:58.106387	2026-05-06 14:03:58.106387	\N	\N
8353363490	ياسر			0	2026-05-13 17:43:13.489593	2026-05-13 17:43:13.489593	\N	\N
6097920313	𝐌𝐈𝐑𝐀𝐋 ♪		K3Qbot	0	2026-04-25 21:53:20.302596	2026-05-07 01:23:48.542035	\N	\N
7324347902	🥀❤️‍🩹 小	汐 ✈️🇰🇷		0	2026-05-10 18:37:45.687653	2026-05-13 23:28:28.486697	\N	\N
7471385119	K			0	2026-04-13 22:15:39.471016	2026-05-20 16:46:24.374469	\N	\N
7129580216	Riheb	Be		0	2026-05-05 08:21:09.290673	2026-05-06 07:24:25.751028	\N	\N
7988718777	­	­		0	2026-05-18 17:35:51.560804	2026-05-18 17:35:51.560804	\N	\N
1087968824	Group		GroupAnonymousBot	0	2026-04-17 20:23:42.434598	2026-05-26 18:49:36.658678	\N	\N
6088064068	عبد المالك			0	2026-05-06 05:07:10.057589	2026-05-06 05:07:10.057589	\N	\N
6945941033	bouchra	benthameur		0	2026-05-06 12:51:53.876042	2026-05-06 12:51:53.876042	\N	\N
8331191774	Rahima	🫐		0	2026-05-06 13:36:07.954283	2026-05-06 13:36:07.954283	\N	\N
8430804531	DUCHELLE	ROSE		0	2026-05-06 13:37:57.960343	2026-05-06 13:37:57.960343	\N	\N
7599538830	_blf._.hichem_			0	2026-05-06 12:11:33.388383	2026-05-30 10:48:17.065483	\N	\N
6659650604	NOUR			0	2026-05-06 14:17:18.157648	2026-05-06 14:17:18.157648	\N	\N
8458918426	Nadaa			0	2026-05-06 14:41:48.298241	2026-05-06 14:41:48.298241	\N	\N
5839336556	boutheina		boutheina18	0	2026-05-08 19:59:17.301675	2026-05-08 19:59:57.313677	\N	\N
8402676106	Abdelkedous		abdelkedous999	0	2026-05-06 14:59:06.086577	2026-05-06 14:59:06.086577	\N	\N
6469965505	🌹			0	2026-05-08 21:02:17.736586	2026-05-12 22:24:42.02783	\N	\N
6005854082	𝓣𝓚𝓻𝓪𝓶	🦋	ikramy_y	0	2026-05-06 15:19:06.268547	2026-05-06 15:19:06.268547	\N	\N
8678910305	ᥫ᭡𝓙𝓾𝓶𝓲ᥫ᭡		Ira_aiko08	0	2026-05-02 19:47:34.126133	2026-05-12 07:04:34.880802	18	\N
7759642124	Ĩmad	KOUACEMI		0	2026-05-06 15:22:46.293818	2026-05-06 15:25:56.320907	\N	\N
6069078850	Lylia			0	2026-04-17 21:37:03.767655	2026-05-29 13:26:14.82717	\N	\N
8173011463	𝐃𝐫 𝐀𝐢𝐜𝐡𝐚 𝐌𝐚𝐥𝐞𝐤 | عــائــشــة مــلــك ᥫ᭡ ⵣ		Dr_aychounnett	0	2026-05-08 12:43:38.864865	2026-05-08 12:43:38.864865	\N	\N
7532866496	Fouad	Fadel		0	2026-05-06 15:51:06.502039	2026-05-06 15:51:06.502039	\N	\N
7341267668	Malak	Romaissa.B		0	2026-05-10 17:34:04.776623	2026-05-10 17:34:04.776623	\N	\N
7597387019	Ghofran	39		0	2026-05-10 20:19:57.31215	2026-05-10 20:19:57.31215	\N	\N
6288617529	HABCHI	Chaimaa🥰🥰	Habchichaimaa	0	2026-05-07 20:18:02.022597	2026-05-15 21:44:26.12709	\N	\N
7168333935	Hanae			0	2026-05-06 16:42:36.863575	2026-05-06 16:42:36.863575	\N	\N
6082929144	SELSA			0	2026-05-06 16:54:16.95947	2026-05-06 16:54:16.95947	\N	\N
7775246982	Nihed			0	2026-05-07 13:01:37.218787	2026-05-07 13:01:37.218787	\N	\N
6250199428	Ts	Hamada	Hamada_ts_24	0	2026-04-12 15:42:42.495863	2026-05-27 15:59:18.64646	\N	\N
6018795251	Lidya	Bey		0	2026-04-16 20:16:54.174586	2026-05-11 18:03:41.255122	\N	\N
7997432252	ismahen	♡♡		0	2026-05-07 22:11:04.020957	2026-05-07 22:11:04.020957	\N	\N
6256913829	Ƙιʅα		kila_51	0	2026-05-06 23:05:09.541478	2026-05-06 23:05:39.544268	\N	\N
7803113312	VERONICA		vir_i1	0	2026-04-12 07:17:40.079279	2026-05-30 17:53:31.474848	\N	\N
5512941168	𝑹𝒂𝒉𝒊𝒎		RahimZhh	0	2026-05-06 18:43:03.840841	2026-05-12 22:59:32.777806	\N	\N
7025477410	Nâ Dæ			0	2026-05-08 11:54:29.479226	2026-05-08 11:54:29.479226	\N	\N
8711666664	Jasmin			0	2026-05-13 07:34:22.428389	2026-05-13 07:34:22.428389	\N	\N
7596452439	Hadjer		Lunarcosmos845	0	2026-04-17 20:46:02.835177	2026-05-28 23:21:52.777511	\N	\N
8519140108	Jihyo	Kh		1	2026-05-09 10:59:14.520406	2026-05-09 10:59:14.520406	\N	\N
8313622726	hind			0	2026-05-08 22:12:58.505997	2026-05-08 22:12:58.505997	\N	\N
6129341635	RYEEM 🫶🏼		ryyem	1	2026-05-09 17:08:16.892826	2026-05-09 17:10:16.903397	\N	\N
6290003658	Nana			0	2026-05-07 20:24:42.119011	2026-05-07 20:26:12.136574	\N	\N
7597362284	Sobin	₍ᐢ.ˬ.ᐢ₎⁦	Rahi31_yo	0	2026-05-04 16:48:57.465055	2026-05-26 11:30:06.104376	\N	\N
6843832874	Nihad tamani		T_nihad	0	2026-05-08 13:08:10.287147	2026-05-08 13:08:10.287147	\N	\N
7869465802	Lilia	Lilia	LiliaLilia29827272	0	2026-05-08 13:08:21.130114	2026-05-08 13:08:21.130114	\N	\N
5568829706	Houda			0	2026-05-13 14:38:10.068387	2026-05-13 14:38:10.068387	\N	\N
7251921405	Fayçal			0	2026-05-13 14:55:40.433102	2026-05-13 14:55:40.433102	\N	\N
7394953032	Mohamed laid attayalleh			0	2026-05-07 06:56:29.069092	2026-05-07 06:56:55.86981	\N	\N
8067736744	wissem			0	2026-05-06 15:51:56.511681	2026-05-07 22:44:09.47159	\N	\N
8085472922	♪ abdelhadi			0	2026-05-06 17:40:03.203926	2026-05-06 17:40:03.203926	\N	\N
1877418855	Abdennour			0	2026-05-08 22:53:58.747879	2026-05-08 22:53:58.747879	\N	\N
5104073058	Doha	Lab		0	2026-04-30 20:57:05.492419	2026-05-17 00:05:32.94451	\N	\N
8359613581	Waslouchee			0	2026-05-08 23:43:19.042159	2026-05-08 23:43:19.042159	\N	\N
7350890496	𝒀𝒂𝒄𝒊𝒏𝒆	𓆩✧𓆪 𓅨	yaccc26	0	2026-05-09 01:22:49.653264	2026-05-09 01:22:49.653264	\N	\N
6369537142	∞		kenzald	0	2026-05-08 14:03:51.025129	2026-05-09 03:03:40.357971	\N	\N
7799723913	Rokaia	Abdoullaui Marmouri	rokaia_marmouri	0	2026-05-09 03:58:40.711087	2026-05-09 03:58:40.711087	\N	\N
6720124032	亞西爾迪爾米			0	2026-04-13 08:42:56.728373	2026-05-24 15:07:38.206624	\N	\N
5113172631	Youssra	Guenouche		0	2026-05-07 07:41:42.163665	2026-05-07 07:41:42.163665	\N	\N
6720856946	🌷		Noun0ui	0	2026-05-26 01:26:39.070005	2026-05-26 01:26:39.070005	\N	\N
6390943284	Yousraaaa		Yousramekkaoui	0	2026-05-05 09:50:20.383609	2026-05-07 18:57:50.790002	\N	\N
5089657674	Billel			0	2026-05-08 14:42:41.409155	2026-05-08 14:42:41.409155	\N	\N
8380139583	Ahlem		ahlempewpew	0	2026-05-06 22:55:59.495256	2026-05-07 00:26:28.845063	\N	\N
6488872577	🫀𝓐𝓶𝄞⃝🪄𝒊𝒏𝒂🫀		Medcina07	0	2026-05-08 14:43:11.425764	2026-05-08 14:43:31.42698	\N	\N
2111837909	Abde Elhak		abdou01sk	0	2026-05-08 14:44:51.430467	2026-05-08 14:44:51.430467	\N	\N
6496038451	Assma			0	2026-05-08 14:58:01.538871	2026-05-08 14:58:01.538871	\N	\N
5415358039	Achraf	Hr	Achrafhrd	0	2026-04-13 19:59:49.962146	2026-05-18 09:13:32.983901	\N	\N
8037159316	Achref	Sahamdi		0	2026-04-28 17:24:20.546081	2026-05-07 00:51:08.337176	\N	\N
8122111187	Gh	Aya		0	2026-05-09 12:05:44.952761	2026-05-09 12:05:44.952761	\N	\N
6501895239	Jįh Hād		jihadmanseri	0	2026-05-09 13:08:35.351848	2026-05-09 13:08:35.351848	\N	\N
8524880406	KHALED	MHAMMDI		0	2026-05-09 13:57:55.575244	2026-05-09 13:57:55.575244	\N	\N
5628990376	Siww			0	2026-05-08 15:21:41.703369	2026-05-08 15:21:41.703369	\N	\N
8641490518	𝑆𝑎𝑙𝑙𝑦	♡		0	2026-05-09 16:00:07.343047	2026-05-09 16:00:46.424947	\N	\N
7335955187	Linouuuush🏴‍☠️			0	2026-05-07 15:59:38.912432	2026-05-07 15:59:38.912432	\N	\N
6062523917	Nøur	Hāñe	nourhan201355	0	2026-05-09 19:23:33.779818	2026-05-09 22:40:36.489018	\N	\N
7679018255	محمد	ساكر		0	2026-05-08 14:01:01.008812	2026-05-08 14:01:41.009804	\N	\N
8450636603	User		Randomx24	0	2026-05-06 23:54:49.822436	2026-05-06 23:54:49.822436	\N	\N
1569159053	نُورْ الهُدَى		xnourelhoudax	0	2026-05-06 16:11:46.621824	2026-05-06 16:11:46.621824	\N	\N
1813849064	Akila			0	2026-05-07 01:04:08.414092	2026-05-07 01:04:08.414092	\N	\N
7387314389	Xatrelion		xatrelion	0	2026-05-04 17:35:47.945462	2026-05-07 19:57:31.686744	\N	\N
6635684839	Itachi	Uchiha	adepressedmadridista	0	2026-05-09 17:04:46.882033	2026-05-09 17:05:36.87323	\N	\N
6040117898	👑Chaban	...	Chabanipoo	0	2026-05-07 09:47:42.874093	2026-05-07 09:47:51.980229	\N	\N
7544664630	🤍	🫶🏼		0	2026-05-08 17:12:39.790758	2026-05-08 17:15:59.795858	\N	\N
5506047666	Moonxx		Uox08	0	2026-05-08 17:16:29.811566	2026-05-08 17:16:29.811566	\N	\N
6538167943	Saiffe Eddine		Laghandja	0	2026-05-06 23:20:59.618402	2026-05-07 00:24:58.83549	\N	\N
6285933790	Rajaa ☾︎☁︎		yvain97	0	2026-05-07 18:45:00.607613	2026-05-07 18:45:00.607613	\N	\N
1659265421	محمود	ابو خاطر	mahmoud_i_khater	0	2026-05-08 18:19:10.205898	2026-05-08 18:19:20.221249	\N	\N
5297561476	لسبط			0	2026-04-27 21:09:26.837365	2026-05-08 18:29:50.279235	\N	\N
8586292342	Ikram	Ikram		0	2026-05-09 18:20:27.547232	2026-05-09 18:20:27.547232	\N	\N
5946893352	Affaf		Affaf_sid	0	2026-05-08 18:46:47.943031	2026-05-08 18:47:27.930318	\N	\N
7273995620	🦢	🤍	itssrrrrr	0	2026-05-08 00:18:53.926208	2026-05-08 00:18:53.926208	\N	\N
7646367698	Ilyess	Boussadia		0	2026-05-09 19:29:43.836186	2026-05-09 19:29:43.836186	\N	\N
7792516635	🌱		m182l	0	2026-05-09 19:38:23.941316	2026-05-09 19:38:23.941316	\N	\N
8187764784	H@mdane🏆		SH_48_siuuu	0	2026-04-17 19:48:32.054121	2026-05-30 19:36:23.507211	\N	\N
8430965668	amina	Th		0	2026-05-16 17:54:54.338397	2026-05-30 10:03:17.025339	\N	\N
5940412894	Zakarıa	Mazouzı	zakmazouzi09907	0	2026-05-10 15:20:22.130401	2026-05-10 15:20:22.130401	\N	\N
6885186666	harid	safa	x_SaFa24_x	0	2026-04-23 00:05:08.043356	2026-05-11 01:22:52.592868	\N	\N
7518863743	saidat widad		Dr_saidat_widad	0	2026-05-09 21:52:25.709441	2026-05-09 21:54:15.725463	\N	\N
5902920483	Nour🫧		nourxbk	0	2026-05-09 22:52:26.665811	2026-05-09 22:52:26.665811	\N	\N
7673737752	🥷🏽		eevqq0	0	2026-05-09 23:05:06.867137	2026-05-09 23:05:06.867137	\N	\N
1006250480	.		flwermee	0	2026-05-10 06:33:32.553023	2026-05-10 06:33:32.553023	\N	\N
5460522877	Lydia🩷		Lydiraou	0	2026-05-10 07:31:13.210569	2026-05-10 07:31:13.210569	\N	\N
6513362017	Douuuu	✨🍯😇		0	2026-04-11 19:41:50.31618	2026-05-30 13:32:27.268877	\N	\N
5245454593	HAMADA	HAMADA	HAMADA_SPYDER	0	2026-05-13 17:44:03.503297	2026-05-13 17:44:03.503297	\N	\N
7983324772	🌸			0	2026-05-13 17:49:13.57125	2026-05-13 17:49:13.57125	\N	\N
5515357144	Abdou	Sahraoui		0	2026-05-24 12:30:37.987698	2026-05-24 12:31:48.079032	\N	\N
8633599060	𝑬𝒅𝒖𝑴𝒂𝒔𝒕𝒆𝒓 🫶		Lwsss23_x1_bot	0	2026-04-11 08:56:48.354477	2026-05-30 15:14:57.387267	\N	\N
6265381148	ISHAK	FRARMA		0	2026-05-14 20:47:41.304175	2026-05-14 20:47:41.304175	\N	\N
6893591029	Selma	Selma		0	2026-05-10 19:56:36.925977	2026-05-10 19:58:16.948415	\N	\N
7647139264	Milissa			0	2026-05-14 20:49:01.313449	2026-05-14 20:49:01.313449	\N	\N
8257739665	●	🫀		0	2026-05-10 20:30:27.48346	2026-05-10 20:30:27.48346	\N	\N
8226639724	Reddah	Anes		0	2026-05-10 20:32:27.50468	2026-05-10 20:32:27.50468	\N	\N
8505748259	yousr			0	2026-05-10 20:34:27.535667	2026-05-10 20:34:27.535667	\N	\N
6263981512	Abdou	AR		0	2026-05-14 23:29:33.178373	2026-05-14 23:29:33.178373	\N	\N
5737714403	الشّيماء🦋		Juwaireya04	0	2026-05-13 18:59:24.486401	2026-05-13 18:59:24.486401	\N	\N
7358383509	Doudou	Boussaha		0	2026-05-13 19:13:44.642881	2026-05-13 19:14:04.644436	\N	\N
6317423702	Ikram		Ikramox	0	2026-05-11 12:43:54.380412	2026-05-11 12:44:34.388338	\N	\N
6706518136	Minou	Oucha ☠️🖤	dz_vibes_2026	0	2026-05-10 20:46:37.734536	2026-05-10 20:46:37.734536	\N	\N
2013244058	Aymen		Aymen_maz	0	2026-04-06 22:50:03.74353	2026-05-17 17:55:21.568045	\N	\N
6638347625	Sisi			0	2026-05-13 20:26:55.84354	2026-05-13 20:26:55.84354	\N	\N
8686602585	Kos	Am		0	2026-05-13 21:33:36.90828	2026-05-13 21:33:36.90828	\N	\N
8192906362	faghah	bt		0	2026-05-11 14:33:06.854781	2026-05-11 14:34:26.867497	\N	\N
8140221751	أَيُوبْ			0	2026-05-11 14:44:37.096329	2026-05-11 14:44:37.096329	\N	\N
8218333291	Salsabile	🌸		0	2026-05-11 15:07:57.635093	2026-05-11 15:07:57.635093	\N	\N
8681204520	ℳℴ𝒽𝒶𝓂ℯ𝒹	ℛ𝒶𝓏𝒶𝓁𝒾		0	2026-05-10 20:22:27.350475	2026-05-11 15:26:08.054475	\N	\N
6999161901	sirine	aderghal		0	2026-05-10 22:13:39.797767	2026-05-13 22:39:57.661669	\N	\N
5911456981	Imene	Ben		0	2026-05-13 22:50:07.791202	2026-05-13 22:50:07.791202	\N	\N
7229478852	Moktada			0	2026-04-11 19:34:15.852453	2026-05-16 09:07:35.917499	\N	\N
5122118107	Nedjda...		N2djd3	0	2026-05-13 22:59:37.958012	2026-05-13 22:59:57.957729	\N	\N
6390394349	Mareim			0	2026-05-11 17:19:00.578609	2026-05-11 17:19:00.578609	\N	\N
6543164043	Maroua		Gdjvv_bvch	0	2026-05-11 17:50:11.063152	2026-05-11 17:50:11.063152	\N	\N
1951225967	_ghost_		Hk_lak	0	2026-05-13 23:55:28.985996	2026-05-14 00:03:59.128388	\N	\N
6810868802	mossab			0	2026-04-10 09:20:48.970393	2026-05-28 12:01:40.905268	\N	\N
8726316433	᭡𓍢ִ໋𝓱𝓪𝓭𝓳𝓮𝓻 𓍢ִ໋ᥫ᭡			0	2026-04-06 23:00:44.079998	2026-05-16 14:57:51.487683	\N	\N
5779307151	Farouk	🐺		0	2026-05-13 22:38:37.650366	2026-05-13 22:38:37.650366	\N	\N
7027628180	Bassma			0	2026-05-10 21:31:49.299068	2026-05-10 21:31:49.299068	\N	\N
8710836734	MÄŘÎÅ🍓🥺		Kojhyv	0	2026-05-05 09:09:49.834683	2026-05-10 21:32:19.309012	\N	\N
6147088512	Rania		Raniayezid	0	2026-05-14 08:03:58.476347	2026-05-14 08:03:58.476347	\N	\N
6091576543	Lotfi	Fareh		0	2026-04-11 14:31:00.337735	2026-05-15 10:42:32.872736	\N	\N
6553595440	Khouloud			0	2026-05-14 13:45:03.292133	2026-05-14 13:45:03.292133	\N	\N
7465985372	Badrdine	Boujahem	Boujahm_badrdine	0	2026-05-20 17:59:29.185138	2026-05-25 07:41:09.861914	\N	\N
7428079261	G.	Mohamed		0	2026-05-20 15:07:04.166358	2026-05-20 15:07:44.166803	\N	\N
8279431973	Dinna	Tib		0	2026-05-24 13:17:48.047759	2026-05-25 13:42:10.30904	\N	\N
7100605165	♘♭.𝐌𝐎𝐇𝐀𝐌𝐌𝐄𝐃		RUDVLY	0	2026-05-08 23:09:58.83804	2026-05-25 20:19:21.14843	\N	\N
8202593608	𝙣𝙜𝙣.𝙮𝙚𝙣𝙣𝙚𝙞	🎀	Itsmenggnnnn	0	2026-04-30 10:38:11.514856	2026-05-29 18:36:53.717454	\N	\N
8003110268	Soundes	Traikia		0	2026-05-20 22:00:49.430157	2026-05-20 22:00:49.430157	\N	\N
7415555924	Maria		mariaguerfi	0	2026-05-14 17:01:47.007056	2026-05-14 17:04:47.04507	\N	\N
8100545240	𝕱𝖆𝖙𝖎𝖒𝖆.𝕿𝖎𝖒𝖆			0	2026-05-14 17:05:37.063303	2026-05-14 17:05:37.063303	\N	\N
8469299160	Ibrahim		Ibrahimbmk	0	2026-05-15 15:19:45.114382	2026-05-15 15:20:25.114254	\N	\N
6272548417	Nesrine	Kalai	kalainesrine	0	2026-04-15 06:35:49.680273	2026-05-15 17:04:15.574338	\N	\N
7518918366	Amani	🌹♥️		1	2026-05-20 15:26:24.250728	2026-05-20 15:27:14.17825	\N	\N
8319698469	Hind	Guessoum		0	2026-04-29 07:43:41.327991	2026-05-15 22:00:46.326364	\N	\N
5660577046	𝑳 f || 𝐀𝑳𝑳𝐀🐺			0	2026-05-04 19:42:50.790889	2026-05-13 11:13:46.530903	\N	\N
7427289420	𝙱𝙰𝙻𝚀𝙴𝙴𝚂.𝚁		b42616c71656573	0	2026-05-14 17:33:37.617709	2026-05-14 17:34:37.627881	\N	\N
5234386942	🌸	🩷		0	2026-05-20 14:43:24.102675	2026-05-28 22:57:31.988942	\N	\N
6682149035	Hanane SAHIA		hanane_sahia	0	2026-05-29 04:01:02.525845	2026-05-29 04:01:02.525845	\N	\N
6872029651	Mehdi	Smo	M_e_h_d_i_bou	0	2026-05-14 19:15:39.775492	2026-05-16 19:53:16.924228	\N	\N
7032900900	𝓝𝓞𝓤𝓡 🖤🧬			0	2026-05-13 14:43:10.168304	2026-05-13 14:43:10.168304	\N	\N
7916687158	Amina	❤️	Amrane_amina2006	0	2026-05-13 15:11:40.773155	2026-05-13 15:11:40.773155	\N	\N
8203791721	𝒟𝓊𝒶𝒶✨️ 𝓟𝓱𝔂𝓼𝓲𝓺𝓾𝓮		Smiledouda	0	2026-05-13 15:12:00.773961	2026-05-13 15:12:00.773961	\N	\N
7254019599	loubna	*	USTHBSTUDENT	0	2026-05-12 05:08:03.232619	2026-05-12 05:08:03.232619	\N	\N
7159164623	kamel🌱SEED	zamoum		0	2026-05-12 07:47:15.67237	2026-05-12 07:47:15.67237	\N	\N
6327681945	hamad	hocine		0	2026-05-13 15:13:00.788743	2026-05-13 15:13:50.806984	\N	\N
6671456897	Yazid	Khouni		0	2026-05-13 15:24:11.01903	2026-05-13 15:24:11.01903	\N	\N
7981319783	N00	7		0	2026-05-13 15:34:31.255671	2026-05-13 15:34:31.255671	\N	\N
6193748884	No	Way	Noway5	0	2026-05-13 15:51:11.638175	2026-05-13 15:51:11.638175	\N	\N
5249113617	Z			0	2026-05-13 15:53:41.688672	2026-05-13 15:53:41.688672	\N	\N
7356252787	Aicha Mh			0	2026-05-13 16:06:21.978548	2026-05-13 16:06:21.978548	\N	\N
1135476521	Anis			0	2026-05-13 16:15:32.177036	2026-05-13 16:15:32.177036	\N	\N
1891587592	Samy			0	2026-05-13 16:17:02.202084	2026-05-13 16:17:02.202084	\N	\N
7395665584	NOBODY🔞		ChoseALoyalEnemy	0	2026-05-13 20:43:36.128396	2026-05-21 11:24:00.579831	\N	\N
7638719727	Thoraya	Benloucif		0	2026-05-13 16:18:32.228905	2026-05-13 16:18:32.228905	\N	\N
6430329696	Akram		akrxxxxxxm	0	2026-05-13 16:23:52.292477	2026-05-13 16:23:52.292477	\N	\N
8264518538	💡.			0	2026-05-04 18:40:02.937274	2026-05-21 13:55:10.833865	\N	\N
6530364511	Hanane	Kessas🌺	hananekessas	0	2026-05-06 23:29:39.693758	2026-05-16 23:30:21.400159	\N	\N
5556524947	imane	sli	imane_sli	0	2026-04-11 17:12:14.607265	2026-05-21 21:55:51.802971	\N	\N
5938825778	Yous	Int		0	2026-05-29 22:28:41.426002	2026-05-29 22:28:41.426002	\N	\N
8375199999	Islam	Nemouchi		0	2026-05-08 20:10:57.383028	2026-05-20 15:57:54.291477	\N	\N
6415628479	Rabehi	Houda	Rabehihouda	0	2026-05-11 14:45:57.120968	2026-05-22 00:31:52.09946	\N	\N
6533311244	🤍			0	2026-05-20 15:52:14.218336	2026-05-22 11:54:33.275484	\N	\N
5551169190	💗MîMî🦩		Maram3256	0	2026-05-20 14:46:34.123866	2026-05-26 07:23:21.545512	\N	\N
6620710987	Hcen	Seridi		0	2026-04-12 15:22:07.06397	2026-05-25 23:16:28.908963	\N	\N
6834163411	🦩		Lily01na	0	2026-05-26 01:29:09.047717	2026-05-26 01:32:09.092671	\N	\N
5303731176	Soundous	♡		0	2026-05-14 18:54:49.373528	2026-05-26 14:41:16.352421	\N	\N
7619776506	Aida			0	2026-05-29 22:33:02.871332	2026-05-29 22:33:02.871332	\N	\N
6729659968	Ibrahim		Brahimdz218	0	2026-04-12 09:41:57.028223	2026-05-29 13:26:24.851278	\N	\N
7957612564	🥀بِنْتُ أَبِيهَا🥀			0	2026-05-29 22:04:42.788604	2026-05-29 22:40:22.878303	\N	\N
6223341400	jelol	guetto		0	2026-05-29 22:44:02.882609	2026-05-29 22:44:02.882609	\N	\N
8468016104	Ma.yacine	Hammoudi	YaciNe101420	0	2026-04-29 06:42:09.691548	2026-05-29 14:38:14.928215	\N	\N
5534474259	Lws		lweees23	0	2026-04-06 22:11:51.237832	2026-05-30 20:28:55.974112	1	\N
\.


--
-- Data for Name: years; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.years (id, specialty_id, name, is_deleted) FROM stdin;
1	1	ING 1	0
2	2	Low 1	0
3	3	social media sites	0
5	4	Bac 2024	1
6	4	Bac 2023	1
7	4	Bac 2022	1
8	6	L1	0
9	6	L2	0
11	7	Promo 2026	1
12	7	Unite 03	0
13	8	3 éme année med	0
14	11	2 ème année  math	0
16	1	ING 3	1
17	1	ING 4	1
10	1	ING 2	1
19	13	علم النفس و المجتمع	1
18	13	مكتبة 👨‍💻	0
4	4	Bac✅️	1
20	14	Ss	1
22	8	4 ème annèes	0
23	17	سنة 1	0
24	18	L 2	0
\.


--
-- Name: ads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ads_id_seq', 19, true);


--
-- Name: ai_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_history_id_seq', 526, true);


--
-- Name: bundle_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bundle_files_id_seq', 482, true);


--
-- Name: bundles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bundles_id_seq', 109, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 170, true);


--
-- Name: channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.channels_id_seq', 7, true);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 118, true);


--
-- Name: downloads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.downloads_id_seq', 1, false);


--
-- Name: files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.files_id_seq', 419, true);


--
-- Name: group_bans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.group_bans_id_seq', 1, false);


--
-- Name: group_bot_msgs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.group_bot_msgs_id_seq', 177, true);


--
-- Name: group_notify_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.group_notify_log_id_seq', 141, true);


--
-- Name: group_warns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.group_warns_id_seq', 1, false);


--
-- Name: history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.history_id_seq', 8615, true);


--
-- Name: logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.logs_id_seq', 8026, true);


--
-- Name: message_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_templates_id_seq', 110, true);


--
-- Name: million_games_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.million_games_id_seq', 34, true);


--
-- Name: million_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.million_questions_id_seq', 8, true);


--
-- Name: million_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.million_sessions_id_seq', 1, false);


--
-- Name: notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notes_id_seq', 11, true);


--
-- Name: poll_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.poll_options_id_seq', 48, true);


--
-- Name: polls_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.polls_id_seq', 20, true);


--
-- Name: reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reports_id_seq', 85, true);


--
-- Name: required_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.required_channels_id_seq', 19, true);


--
-- Name: scheduled_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.scheduled_messages_id_seq', 69, true);


--
-- Name: semesters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.semesters_id_seq', 38, true);


--
-- Name: specialties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.specialties_id_seq', 18, true);


--
-- Name: subjects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subjects_id_seq', 100, true);


--
-- Name: years_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.years_id_seq', 25, true);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (user_id);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: ai_history ai_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_history
    ADD CONSTRAINT ai_history_pkey PRIMARY KEY (id);


--
-- Name: bot_states bot_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_states
    ADD CONSTRAINT bot_states_pkey PRIMARY KEY (uid);


--
-- Name: bundle_files bundle_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundle_files
    ADD CONSTRAINT bundle_files_pkey PRIMARY KEY (id);


--
-- Name: bundles bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bundles
    ADD CONSTRAINT bundles_pkey PRIMARY KEY (id);


--
-- Name: cache_store cache_store_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cache_store
    ADD CONSTRAINT cache_store_pkey PRIMARY KEY (key);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: comment_likes comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_pkey PRIMARY KEY (user_id, comment_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: downloads downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.downloads
    ADD CONSTRAINT downloads_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, file_id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: group_bans group_bans_chat_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_bans
    ADD CONSTRAINT group_bans_chat_id_user_id_key UNIQUE (chat_id, user_id);


--
-- Name: group_bans group_bans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_bans
    ADD CONSTRAINT group_bans_pkey PRIMARY KEY (id);


--
-- Name: group_bot_msgs group_bot_msgs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_bot_msgs
    ADD CONSTRAINT group_bot_msgs_pkey PRIMARY KEY (id);


--
-- Name: group_chats group_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_chats
    ADD CONSTRAINT group_chats_pkey PRIMARY KEY (chat_id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (chat_id, user_id);


--
-- Name: group_notify_log group_notify_log_file_id_chat_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_notify_log
    ADD CONSTRAINT group_notify_log_file_id_chat_id_key UNIQUE (file_id, chat_id);


--
-- Name: group_notify_log group_notify_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_notify_log
    ADD CONSTRAINT group_notify_log_pkey PRIMARY KEY (id);


--
-- Name: group_warns group_warns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_warns
    ADD CONSTRAINT group_warns_pkey PRIMARY KEY (id);


--
-- Name: group_welcome group_welcome_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_welcome
    ADD CONSTRAINT group_welcome_pkey PRIMARY KEY (chat_id);


--
-- Name: history history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.history
    ADD CONSTRAINT history_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_name_key UNIQUE (name);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: million_answers million_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_answers
    ADD CONSTRAINT million_answers_pkey PRIMARY KEY (game_id, user_id);


--
-- Name: million_games million_games_chat_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_games
    ADD CONSTRAINT million_games_chat_id_key UNIQUE (chat_id);


--
-- Name: million_games million_games_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_games
    ADD CONSTRAINT million_games_pkey PRIMARY KEY (id);


--
-- Name: million_players million_players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_players
    ADD CONSTRAINT million_players_pkey PRIMARY KEY (session_id, user_id);


--
-- Name: million_questions million_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_questions
    ADD CONSTRAINT million_questions_pkey PRIMARY KEY (id);


--
-- Name: million_scores million_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_scores
    ADD CONSTRAINT million_scores_pkey PRIMARY KEY (user_id);


--
-- Name: million_sessions million_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.million_sessions
    ADD CONSTRAINT million_sessions_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: poll_options poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.poll_options
    ADD CONSTRAINT poll_options_pkey PRIMARY KEY (id);


--
-- Name: poll_votes poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (poll_id, user_id);


--
-- Name: polls polls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.polls
    ADD CONSTRAINT polls_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (user_id, file_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: required_channels required_channels_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.required_channels
    ADD CONSTRAINT required_channels_channel_id_key UNIQUE (channel_id);


--
-- Name: required_channels required_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.required_channels
    ADD CONSTRAINT required_channels_pkey PRIMARY KEY (id);


--
-- Name: scheduled_messages scheduled_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id);


--
-- Name: semesters semesters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: specialties specialties_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_name_key UNIQUE (name);


--
-- Name: specialties specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (user_id);


--
-- Name: user_specialties user_specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_specialties
    ADD CONSTRAINT user_specialties_pkey PRIMARY KEY (user_id);


--
-- Name: user_states user_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_states
    ADD CONSTRAINT user_states_pkey PRIMARY KEY (user_id);


--
-- Name: user_xp user_xp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT user_xp_pkey PRIMARY KEY (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: years years_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.years
    ADD CONSTRAINT years_pkey PRIMARY KEY (id);


--
-- Name: idx_ads_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_deleted ON public.ads USING btree (is_deleted, created_at DESC);


--
-- Name: idx_ai_history_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_history_user ON public.ai_history USING btree (user_id, created_at DESC);


--
-- Name: idx_bundle_files; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bundle_files ON public.bundle_files USING btree (bundle_id);


--
-- Name: idx_bundle_files_bnd; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bundle_files_bnd ON public.bundle_files USING btree (bundle_id);


--
-- Name: idx_cache_store_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cache_store_expires_at ON public.cache_store USING btree (expires_at);


--
-- Name: idx_categories_subject; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_categories_subject ON public.categories USING btree (subject_id);


--
-- Name: idx_cats_subject; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cats_subject ON public.categories USING btree (subject_id, is_deleted);


--
-- Name: idx_channels_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_channels_sort ON public.channels USING btree (sort_order, id DESC);


--
-- Name: idx_comments_del; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_del ON public.comments USING btree (file_id, is_deleted);


--
-- Name: idx_comments_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_file ON public.comments USING btree (file_id);


--
-- Name: idx_comments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_user ON public.comments USING btree (user_id);


--
-- Name: idx_downloads_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_downloads_file ON public.downloads USING btree (file_id);


--
-- Name: idx_downloads_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_downloads_user ON public.downloads USING btree (user_id, created_at DESC);


--
-- Name: idx_favorites_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_file ON public.favorites USING btree (file_id);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id);


--
-- Name: idx_files_cat_del; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_cat_del ON public.files USING btree (category_id, is_deleted);


--
-- Name: idx_files_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_category ON public.files USING btree (category_id);


--
-- Name: idx_files_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_deleted ON public.files USING btree (is_deleted);


--
-- Name: idx_files_desc_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_desc_trgm ON public.files USING gin (description public.gin_trgm_ops);


--
-- Name: idx_files_downloads; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_downloads ON public.files USING btree (downloads DESC);


--
-- Name: idx_files_downloads_cat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_downloads_cat ON public.files USING btree (category_id, downloads DESC) WHERE (is_deleted = 0);


--
-- Name: idx_files_fts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_fts ON public.files USING gin (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_files_title_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_title_trgm ON public.files USING gin (title public.gin_trgm_ops);


--
-- Name: idx_files_uploaded; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_uploaded ON public.files USING btree (uploaded_at DESC);


--
-- Name: idx_files_uploaded_cat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_uploaded_cat ON public.files USING btree (category_id, uploaded_at DESC) WHERE (is_deleted = 0);


--
-- Name: idx_files_uploader; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_uploader ON public.files USING btree (uploaded_by);


--
-- Name: idx_gnl_chat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gnl_chat ON public.group_notify_log USING btree (chat_id);


--
-- Name: idx_gnl_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gnl_file ON public.group_notify_log USING btree (file_id);


--
-- Name: idx_group_bans_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_bans_user ON public.group_bans USING btree (chat_id, user_id);


--
-- Name: idx_group_chats_specialty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_chats_specialty ON public.group_chats USING btree (specialty_id);


--
-- Name: idx_group_members_chat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_members_chat ON public.group_members USING btree (chat_id);


--
-- Name: idx_group_warns_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_warns_user ON public.group_warns USING btree (chat_id, user_id);


--
-- Name: idx_history_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_history_file ON public.history USING btree (file_id);


--
-- Name: idx_history_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_history_time ON public.history USING btree (user_id, viewed_at DESC);


--
-- Name: idx_history_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_history_user ON public.history USING btree (user_id);


--
-- Name: idx_history_user_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_history_user_file ON public.history USING btree (user_id, file_id);


--
-- Name: idx_history_viewed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_history_viewed ON public.history USING btree (viewed_at DESC);


--
-- Name: idx_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_created ON public.logs USING btree (created_at);


--
-- Name: idx_mq_difficulty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mq_difficulty ON public.million_questions USING btree (difficulty) WHERE (is_active = 1);


--
-- Name: idx_mq_used; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mq_used ON public.million_questions USING btree (used_count) WHERE (is_active = 1);


--
-- Name: idx_ms_chat; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ms_chat ON public.million_sessions USING btree (chat_id, status);


--
-- Name: idx_mscores_prize; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mscores_prize ON public.million_scores USING btree (best_prize DESC);


--
-- Name: idx_poll_options_poll; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_poll_options_poll ON public.poll_options USING btree (poll_id);


--
-- Name: idx_poll_votes_option; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_poll_votes_option ON public.poll_votes USING btree (option_id);


--
-- Name: idx_poll_votes_poll_option; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_poll_votes_poll_option ON public.poll_votes USING btree (poll_id, option_id);


--
-- Name: idx_ratings_avg; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ratings_avg ON public.ratings USING btree (file_id, rating);


--
-- Name: idx_ratings_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ratings_file ON public.ratings USING btree (file_id);


--
-- Name: idx_reports_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_file ON public.reports USING btree (file_id);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status);


--
-- Name: idx_sched_msgs_send_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sched_msgs_send_at ON public.scheduled_messages USING btree (send_at) WHERE (sent = 0);


--
-- Name: idx_sched_sent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sched_sent ON public.scheduled_messages USING btree (sent, send_at);


--
-- Name: idx_scheduled_messages_send_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_messages_send_at ON public.scheduled_messages USING btree (send_at);


--
-- Name: idx_semesters_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_semesters_year ON public.semesters USING btree (year_id);


--
-- Name: idx_semesters_year_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_semesters_year_id ON public.semesters USING btree (year_id, id) WHERE (is_deleted = 0);


--
-- Name: idx_sems_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sems_year ON public.semesters USING btree (year_id, is_deleted);


--
-- Name: idx_subjects_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subjects_name_trgm ON public.subjects USING gin (name public.gin_trgm_ops);


--
-- Name: idx_subjects_semester; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subjects_semester ON public.subjects USING btree (semester_id);


--
-- Name: idx_subjects_semester_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subjects_semester_id ON public.subjects USING btree (semester_id, id) WHERE (is_deleted = 0);


--
-- Name: idx_subs_sem; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subs_sem ON public.subjects USING btree (semester_id, is_deleted);


--
-- Name: idx_user_points; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_points ON public.user_points USING btree (total_points DESC);


--
-- Name: idx_user_points_total; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_points_total ON public.user_points USING btree (total_points DESC);


--
-- Name: idx_user_specialties; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_specialties ON public.user_specialties USING btree (specialty_id);


--
-- Name: idx_user_states_upd; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_states_upd ON public.user_states USING btree (updated_at);


--
-- Name: idx_user_states_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_states_updated_at ON public.user_states USING btree (updated_at DESC);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_active ON public.users USING btree (last_active);


--
-- Name: idx_users_banned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_banned ON public.users USING btree (is_banned);


--
-- Name: idx_users_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_name_trgm ON public.users USING gin (first_name public.gin_trgm_ops);


--
-- Name: idx_years_spec; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_years_spec ON public.years USING btree (specialty_id, is_deleted);


--
-- Name: idx_years_specialty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_years_specialty ON public.years USING btree (specialty_id);


--
-- Name: idx_years_specialty_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_years_specialty_id ON public.years USING btree (specialty_id, id) WHERE (is_deleted = 0);


--
-- PostgreSQL database dump complete
--

\unrestrict FsVo57bKS2h0sj5lSjHoYASJtMoS9OEEKYnnLCBD7mmRnvva63hgVxrc8D3Sq6D

