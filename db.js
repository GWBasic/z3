const Pool = require('pg').Pool

const runtimeOptions = require('./runtimeOptions');
const z3 = require('./z3');

const DRAFT_STORE_INTERVAL_MINUTES = 5;

const connectionString = 'postgresql://localhost:5432/z3'

const pool = new Pool({connectionString});

class PostNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PostNotFound';
    }
};

exports.PostNotFoundError = PostNotFoundError;

class DraftNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DraftNotFound';
    }
};

exports.DraftNotFoundError = DraftNotFoundError;

class ImageNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ImageNotFound';
    }
}

exports.ImageNotFoundError = ImageNotFoundError;

class UnknownStaticGroupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnknownStaticGroup';
    }
}

exports.UnknownStaticGroupError = UnknownStaticGroupError;

class UnknownAfterPageIdError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnknownAfterPageId';
    }
}

exports.UnknownAfterPageIdError = UnknownAfterPageIdError;

const dep = {
    newDate: () => new Date()
};

exports.dep = dep;

exports.createPost = async (title, suggestedLocation) => {

    const post = {
        suggestedLocation,
        workingTitle: title};

    const draft = {
        title: title,
        content: ''};

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        var res = await client.query(
            'INSERT into posts (obj) VALUES ($1) RETURNING id',
            [ JSON.stringify(post) ]);

        post._id = res.rows[0].id;
        draft.postId = post._id,


        res = await client.query(
            'INSERT into drafts (post_id, obj) VALUES ($1, $2) RETURNING id',
            [ post_id, JSON.stringify(draft) ]);

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }

    return {
        post: post,
        drafts: [ draft ]
    };
};

exports.getPost = async postId => {
    const res = await pool.query(
        "SELECT id, obj from posts where id=$1;",
        [postId]);


    if (res.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    const post = res.rows[0].obj;
    post._id = res.rows[0].id;

    return post;
}

exports.getNewestDraft = async postId => {

    const res = await pool.query(
        "SELECT id, obj from drafts where post_id=$1 ORDER BY created_at DESC LIMIT 1;",
        [postId]);


    if (res.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    const draft = res.rows[0].obj;
    draft._id = res.rows[0].id;

    return draft;
};

exports.getPostFromUrl = async url => {
    const post = await exports.getPostFromUrlOrNull(url);

    if (post == null) {
        throw new PostNotFoundError(`No post at url ${url}`);
    }

    return post;
};

exports.getPostFromUrlOrNull = async url => {
    const res = await pool.query(
        "SELECT id, obj FROM posts where obj->>'url'=$1;",
        [url]);

    if (res.rowCount == 0) {
        return null;
    }

    const post = res.rows[0].obj;
    post._id = res.rows[0].id;
};

exports.getAllStaticPages = async () => {
    const staticPages = {};
    const staticLocations = z3.staticLocations;
    for (const staticLocation of staticLocations) {
        staticPages[staticLocation] = [];
    }

    return staticPages;
};

exports.getPublishedPosts = async (skip = 0, limit = Number.MAX_SAFE_INTEGER) => {
    return [];
};

exports.countPublishedPosts = async () => {
    return 0;
};
