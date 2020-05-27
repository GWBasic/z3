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

async function runOnTransaction(callback) {
    const client = await pool.connect();

    var toReturn;

    try {
        await client.query('BEGIN');

        try {
            toReturn = await callback(client);

            await client.query('COMMIT');    
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
    } finally {
        client.release();
    }

    return toReturn;
}

async function useClient(callback) {
    const client = await pool.connect();

    var toReturn;

    try {
        toReturn = await callback(client);
    } finally {
        client.release();
    }

    return toReturn;
}

function constructPostFromRow(row) {
    return {
        _id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        title: row.title,
        workingTitle: row.working_title,
        suggestedLocation: row.suggested_location,
        content: row.content
    };
}

function constructDraftFromRow(row) {
    return {
        _id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        title: row.title,
        content: row.content
    };
}

exports.createPost = async (title, suggestedLocation) => {

    return await runOnTransaction(async client => {
        const insertPostResult = await client.query(
            "INSERT into posts (working_title, suggested_location) VALUES ($1, $2) RETURNING id",
            [ title, suggestedLocation ]);

        const postId = insertPostResult.rows[0].id;

        await client.query(
            "INSERT into drafts (post_id, title, content) VALUES ($1, $2, '')",
            [ postId, title ]);

        return {
            post: await getPost(client, postId),
            drafts: [ await getNewestDraft(client, postId) ]
        };
    });
};

async function getPost(client, postId) {
    const res = await client.query(
        "SELECT * from posts where id=$1;",
        [postId]);


    if (res.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    return constructPostFromRow(res.rows[0]);
}

exports.getPost = async postId => useClient(client => getPost(client, postId));

async function getNewestDraft(client, postId) {
    const selectDraftResult = await client.query(
        "SELECT * from drafts where post_id=$1 ORDER BY created_at DESC LIMIT 1;",
        [postId]);

    if (selectDraftResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    return constructDraftFromRow(selectDraftResult.rows[0]);
}

exports.getNewestDraft = async postId => useClient(client => getNewestDraft(client, postId));

exports.appendDraft = async (postId, title, content, suggestedLocation) => {

    return await runOnTransaction(async client => {
        const post = await getPost(client, postId);
        const currentDraft = await getNewestDraft(client, postId);
    
        if (null == currentDraft || null == post) {
            throw new PostNotFoundError(`No posts with id ${postId}`);
        }
    
        const updatePostResult = await client.query(
            "UPDATE posts SET working_title = $1 WHERE id=$2",
            [title, postId]);

        if (updatePostResult.rowCount != 1) {
            throw `Could not update post ${postId}`;
        }

        const ageMs = dep.newDate() - currentDraft.createdAt;
        const ageSeconds = ageMs / 1000;
        const ageMinutes = ageSeconds / 60;
    
        const insert = (ageMinutes > DRAFT_STORE_INTERVAL_MINUTES) || (currentDraft._id == post.draftId);
    
        var draftId;
        if (insert) {
            const insertDraftResult = await client.query(
                'INSERT into drafts (post_id, title, content) VALUES ($1, $2, $3) RETURNING id',
                [ postId, title, content ]);

            draftId = insertDraftResult.rows[0].id;
        } else {
            draftId = currentDraft._id;

            const updateDraftResult = await client.query(
                "UPDATE drafts SET title = $1, content = $2 WHERE id=$3",
                [title, content, draftId]);
    
            if (updateDraftResult.rowCount != 1) {
                throw `Could not update draft ${draftId}`;
            }
        }

        const selectDraftResult = await client.query(
            "SELECT * from drafts where id=$1;",
            [draftId]);
    
        if (selectDraftResult.rowCount == 0) {
            throw new PostNotFoundError(`No posts with id ${postId}`);
        }
        
        return constructDraftFromRow(selectDraftResult.rows[0]);
    });
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
        "SELECT * FROM posts where url=$1;",
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

