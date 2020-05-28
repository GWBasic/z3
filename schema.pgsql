--
-- PostgreSQL database dump
--

-- Dumped from database version 12.3
-- Dumped by pg_dump version 12.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: andrewrondeau
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_timestamp() OWNER TO andrewrondeau;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: drafts; Type: TABLE; Schema: public; Owner: andrewrondeau
--

CREATE TABLE public.drafts (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    post_id integer,
    title character varying,
    content text,
    suggested_location character varying
);


ALTER TABLE public.drafts OWNER TO andrewrondeau;

--
-- Name: drafts_id_seq; Type: SEQUENCE; Schema: public; Owner: andrewrondeau
--

CREATE SEQUENCE public.drafts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.drafts_id_seq OWNER TO andrewrondeau;

--
-- Name: drafts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: andrewrondeau
--

ALTER SEQUENCE public.drafts_id_seq OWNED BY public.drafts.id;


--
-- Name: images; Type: TABLE; Schema: public; Owner: andrewrondeau
--

CREATE TABLE public.images (
    id integer NOT NULL,
    post_id integer NOT NULL,
    hash character varying NOT NULL,
    filename character varying NOT NULL,
    mimetype character varying NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    image bytea NOT NULL,
    published boolean DEFAULT false NOT NULL,
    normal_width integer NOT NULL,
    normal_height integer NOT NULL,
    normal_image bytea NOT NULL,
    thumbnail_width integer NOT NULL,
    thumbnail_height integer NOT NULL,
    thumbnail_image bytea NOT NULL
);


ALTER TABLE public.images OWNER TO andrewrondeau;

--
-- Name: images_id_seq; Type: SEQUENCE; Schema: public; Owner: andrewrondeau
--

CREATE SEQUENCE public.images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.images_id_seq OWNER TO andrewrondeau;

--
-- Name: images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: andrewrondeau
--

ALTER SEQUENCE public.images_id_seq OWNED BY public.images.id;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: andrewrondeau
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title character varying,
    suggested_location character varying,
    url character varying,
    working_title character varying,
    published_at timestamp with time zone,
    republished_at timestamp with time zone,
    summary character varying,
    static_order real,
    content text,
    static_group character varying,
    draft_id integer
);


ALTER TABLE public.posts OWNER TO andrewrondeau;

--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: andrewrondeau
--

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.posts_id_seq OWNER TO andrewrondeau;

--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: andrewrondeau
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;


--
-- Name: schema_version; Type: TABLE; Schema: public; Owner: andrewrondeau
--

CREATE TABLE public.schema_version (
    version integer NOT NULL
);


ALTER TABLE public.schema_version OWNER TO andrewrondeau;

--
-- Name: drafts id; Type: DEFAULT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.drafts ALTER COLUMN id SET DEFAULT nextval('public.drafts_id_seq'::regclass);


--
-- Name: images id; Type: DEFAULT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.images ALTER COLUMN id SET DEFAULT nextval('public.images_id_seq'::regclass);


--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);


--
-- Name: drafts drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_pkey PRIMARY KEY (id);


--
-- Name: images filename_post_unique; Type: CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT filename_post_unique UNIQUE (post_id, filename);


--
-- Name: images hash_post_unique; Type: CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT hash_post_unique UNIQUE (post_id, hash);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts posts_url_key; Type: CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_url_key UNIQUE (url);


--
-- Name: idx_drafttoimage; Type: INDEX; Schema: public; Owner: andrewrondeau
--

CREATE INDEX idx_drafttoimage ON public.images USING btree (post_id);


--
-- Name: idx_drafttopost; Type: INDEX; Schema: public; Owner: andrewrondeau
--

CREATE INDEX idx_drafttopost ON public.drafts USING btree (post_id);


--
-- Name: idx_static_group; Type: INDEX; Schema: public; Owner: andrewrondeau
--

CREATE INDEX idx_static_group ON public.posts USING btree (static_group);


--
-- Name: drafts set_timestamp_post; Type: TRIGGER; Schema: public; Owner: andrewrondeau
--

CREATE TRIGGER set_timestamp_post BEFORE UPDATE ON public.drafts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: posts set_timestamp_post; Type: TRIGGER; Schema: public; Owner: andrewrondeau
--

CREATE TRIGGER set_timestamp_post BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: drafts drafts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id);


--
-- Name: images images_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id);


--
-- Name: posts posts_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andrewrondeau
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id);


--
-- PostgreSQL database dump complete
--

