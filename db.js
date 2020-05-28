const Pool = require('pg').Pool

const runtimeOptions = require('./runtimeOptions');

const DRAFT_STORE_INTERVAL_MINUTES = 5;

const connectionString = process.env.DATABASE_URL;

// To dump the schema:
// ./pg_dump -s z3 > ~/git/z3/schema.pgsql

const pool = new Pool({connectionString});

class PostNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PostNotFound';
    }
};

class DraftNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DraftNotFound';
    }
};

class ImageNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ImageNotFound';
    }
}

class UnknownStaticGroupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnknownStaticGroup';
    }
}

class UnknownAfterPageIdError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnknownAfterPageId';
    }
}

const dep = {
    newDate: () => new Date()
};

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

function constructPostsFromRows(rows) {
    const posts = [];

    for (var row of rows) {
        posts.push(constructPostFromRow(row));
    }

    return posts;
}

function constructPostFromRow(row) {
    const post = {
        _id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        workingTitle: row.working_title,
        suggestedLocation: row.suggested_location,
    };

    // Only set published values when the post is published
    if (row.draft_id) {
        post.title = row.title;
        post.content = row.content;
        post.summary = row.summary;
        post.url = row.url;
        post.draftId = row.draft_id;
        post.publishedAt = row.published_at;
        post.republishedAt = row.republished_at;
        post.staticGroup = row.static_group;
        post.staticOrder = row.static_order;
    }

    return post;
}

function constructDraftFromRow(row) {
    return {
        _id: row.id,
        postId: row.post_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        title: row.title,
        content: row.content,
        suggestedLocation: row.suggested_location
    };
}

function constructDraftsFromRows(rows) {
    const drafts = [];

    for (var row of rows) {
        drafts.push(constructDraftFromRow(row));
    }

    return drafts;
}

function constructImageFromRow(row) {
    return {
        _id: row.id,
        postId: row.post_id,
        hash: row.hash,
        filename: row.filename,
        mimetype: row.mimetype,
        imageData: row.image,
        published: row.published,
        originalDimensions: {width: row.width, height: row.height},
        normalSizeImageData: row.normal_image,
        normalDimensions: {width: row.normal_width, height: row.normal_height},
        thumbnailImageData: row.thumbnail_image,
        thumbnailDimensions: {width: row.thumbnail_width, height: row.thumbnail_height}
    };
}

function constructImagesFromRows(rows) {
    const images = [];

    for (var row of rows) {
        images.push(constructImageFromRow(row));
    }

    return images;
}

async function createPost(client, title, suggestedLocation) {
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
}

async function getPost(client, postId) {
    const res = await client.query(
        "SELECT * from posts where id=$1;",
        [postId]);

    if (res.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    return constructPostFromRow(res.rows[0]);
}

async function getNewestDraft(client, postId) {
    const selectDraftResult = await client.query(
        "SELECT * from drafts where post_id=$1 ORDER BY created_at DESC LIMIT 1;",
        [postId]);

    if (selectDraftResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    return constructDraftFromRow(selectDraftResult.rows[0]);
}

async function appendDraft(client, postId, title, content, suggestedLocation) {
    const post = await getPost(client, postId);
    const currentDraft = await getNewestDraft(client, postId);

    if (null == currentDraft || null == post) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    const updatePostResult = await client.query(
        "UPDATE posts SET working_title=$2, suggested_location=$3 WHERE id=$1",
        [postId, title, suggestedLocation]);

    if (updatePostResult.rowCount != 1) {
        throw new Error(`Could not update post ${postId}`);
    }

    const ageMs = dep.newDate() - currentDraft.createdAt;
    const ageSeconds = ageMs / 1000;
    const ageMinutes = ageSeconds / 60;

    const insert = (ageMinutes > DRAFT_STORE_INTERVAL_MINUTES) || (currentDraft._id == post.draftId);

    var draftId;
    if (insert) {
        const insertDraftResult = await client.query(
            'INSERT into drafts (post_id, title, content, suggested_location) VALUES ($1, $2, $3, $4) RETURNING id',
            [ postId, title, content, suggestedLocation ]);

        draftId = insertDraftResult.rows[0].id;
    } else {
        draftId = currentDraft._id;

        const updateDraftResult = await client.query(
            "UPDATE drafts SET title=$2, content=$3, suggested_location=$4 WHERE id=$1",
            [draftId, title, content, suggestedLocation]);

        if (updateDraftResult.rowCount != 1) {
            throw new Error(`Could not update draft ${draftId}`);
        }
    }

    const selectDraftResult = await client.query(
        "SELECT * from drafts where id=$1;",
        [draftId]);

    if (selectDraftResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    return constructDraftFromRow(selectDraftResult.rows[0]);
}

async function getPostAndDrafts(client, postId) {
    const selectDraftsResult = await client.query(
        "SELECT * FROM drafts WHERE post_id = $1 ORDER BY created_at DESC;",
        [postId]);

    if (selectDraftsResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    return {
        post: await getPost(client, postId),
        drafts: constructDraftsFromRows(selectDraftsResult.rows)
    };
}

async function getDraft(client, draftId) {
    const selectDraftResult = await client.query(
        "SELECT * from drafts where id=$1",
        [draftId]);

    if (selectDraftResult.rowCount == 0) {
        throw new DraftNotFoundError(`DraftId ${draftId} missing`);
    }

    return constructDraftFromRow(selectDraftResult.rows[0]);
}

async function restoreDraft(client, draftId) {
    const originalDraft = await getDraft(client, draftId);

    const insertDraftResult = await client.query(
        'INSERT into drafts (post_id, title, content) VALUES ($1, $2, $3) RETURNING id',
        [ originalDraft.postId, originalDraft.title, originalDraft.content ]);

    const newDraftId = insertDraftResult.rows[0].id;

    return getDraft(client, newDraftId);
}

async function publishPost(
    client,
    postId,
    draftId,
    publishedAt,
    republishedAt,
    title,
    content,
    url,
    summary,
    imageIdsToPublish,
    staticGroup,
    afterPageId) {

    async function calculateStaticOrder(client) {

        if (staticGroup) {
            const staticPages = await getAllStaticPages(client);
            
            if (!(staticGroup in staticPages)) {
                throw new UnknownStaticGroupError(`Static group ${staticGroup} unknown`);
            }

            const pages = staticPages[staticGroup];
            if (afterPageId == postId) {
                // Page isn't moving
            } else if (afterPageId) {
                // Page will be inserted relative to another page
                var afterPageIndex = null;
                for (var pageIndex = 0; pageIndex < pages.length; pageIndex++) {
                    if (pages[pageIndex]._id == afterPageId) {
                        afterPageIndex = pageIndex;
                    }
                }

                if (afterPageIndex == null) {
                    throw new UnknownAfterPageIdError(`Page ID ${afterPageId} is not part of ${staticGroup}`);
                }

                if (afterPageIndex + 1 == pages.length) {
                    // Page is going last
                    return pages[afterPageIndex].staticOrder + 10000;
                } else if (postId != pages[afterPageIndex + 1]._id) {
                    // Page goes between two other pages
                    return (pages[afterPageIndex].staticOrder + pages[afterPageIndex + 1].staticOrder) / 2;
                }

            } else {
                // Page is going first
                if (pages.length > 0) {
                    // inserting the page before the other pages
                    return pages[0].staticOrder - 10000;
                }
                else {
                    // This is the first page
                    return 0;
                }
            }
        }
        else if (afterPageId) {
            throw new UnknownAfterPageIdError('afterPostId can only be specified when staticPageName is specified');
        }

        return null;
    }

    const staticOrder = await calculateStaticOrder(client);

    if (staticOrder != null) {
        const updateStaticOrderResult = await client.query(
            "UPDATE posts SET static_order = $2 WHERE id=$1",
            [postId, staticOrder]);

        if (updateStaticOrderResult.rowCount != 1) {
            throw new Error(`Could not update post ${postId}`);
        }
    }

    // Do not allow publishing multiple posts to the same url
    // Unpublish in this case
    const postToUnpublish = await getPostFromUrlOrNull(client, url);
    if (postToUnpublish) {
        if (postToUnpublish._id != postId) {
            await unPublishPost(client, postToUnpublish._id);
        }
    }

    const updatePostResult = await client.query(
        "UPDATE posts SET published_at=$2, republished_at=$3, title=$4, content=$5, url=$6, summary=$7, static_group=$8, draft_id=$9 WHERE id=$1",
        [postId, publishedAt, republishedAt, title, content, url, summary, staticGroup, draftId]);

    if (updatePostResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    await client.query(
        "UPDATE images SET published=false WHERE post_id=$1",
        [postId]);

    for (var imageId of imageIdsToPublish) {
        const updateImageResult = await client.query(
            "UPDATE images SET published=true WHERE id=$1",
            [imageId]);
        
        if (updateImageResult.rowCount == 0) {
            throw new Error(`No image with id: ${imageId}`);
        }
    }
}

async function unPublishPost(client, postId) {

    const updatePostResult = await client.query(
        "UPDATE posts SET draft_id=NULL, title=NULL, content=NULL, url=NULL, published_at=NULL, republished_at=NULL, summary=NULL, static_group=NULL, static_order=NULL WHERE id=$1",
        [postId]);

    if (updatePostResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
    
    await client.query(
        "UPDATE images SET published=false WHERE post_id=$1",
        [postId]);
}

async function deletePost(client, postId) {

    await client.query(
        "DELETE FROM images WHERE post_id = $1",
        [postId]);

    const deleteDraftsResult = await client.query(
        "DELETE FROM drafts WHERE post_id = $1",
        [postId]);

    if (deleteDraftsResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    const deletePostResult = await client.query(
        "DELETE FROM posts WHERE id = $1",
        [postId]);

    if (deletePostResult.rowCount == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
}


async function getPostFromUrl(client, url) {
    const post = await getPostFromUrlOrNull(client, url);

    if (post == null) {
        throw new PostNotFoundError(`No post at url ${url}`);
    }

    return post;
};

async function getPosts(client, skip = 0, limit = Number.MAX_SAFE_INTEGER) {
    const selectPostsResult = await client.query(
        "SELECT * FROM posts LIMIT $2 OFFSET $1",
        [skip, limit]);

    return constructPostsFromRows(selectPostsResult.rows);
}

async function countAllPosts(client) {
    const selectPostsResult = await client.query("SELECT count(id) as numPosts FROM posts");

    return selectPostsResult.rows[0].numposts;
}

async function getPublishedPosts(client, skip = 0, limit = Number.MAX_SAFE_INTEGER) {
    const selectPostsResult = await client.query(
        "SELECT * FROM posts WHERE url IS NOT NULL AND static_group IS NULL LIMIT $2 OFFSET $1",
        [skip, limit]);

    return constructPostsFromRows(selectPostsResult.rows);
}

async function countPublishedPosts(client) {
    const selectPostsResult = await client.query("SELECT count(id) as numPosts FROM posts WHERE url IS NOT NULL AND static_group IS NULL");

    return selectPostsResult.rows[0].numposts;
}

async function getPostFromUrlOrNull(client, url) {
    const selectPostsResult = await client.query(
        "SELECT * FROM posts where url=$1;",
        [url]);

    if (selectPostsResult.rowCount == 0) {
        return null;
    }

    return constructPostFromRow(selectPostsResult.rows[0]);
};

async function getAllStaticPages(client) {
    const selectPostsResult = await client.query(
        "SELECT * FROM posts WHERE static_group IS NOT NULL ORDER BY static_order");

    const posts = constructPostsFromRows(selectPostsResult.rows);

    const staticPages = {};
    const staticLocations = z3.staticLocations;
    for (const staticLocation of staticLocations) {
        staticPages[staticLocation] = [];
    }

    for (var post of posts) {
        staticPages[post.staticGroup].push(post);
    }

    return staticPages;
};

async function insertImage(
    client,
    postId,
    hash,
    filename,
    mimetype,
    originalImageBuffer,
    originalDimensions,
    normalSizeBuffer,
    normalDimensions,
    thumbnailBuffer,
    thumbnailDimensions) {

    // Determine if the filename should change
    const originalFilename = filename;
    var duplicateFilenameCtr = 1;
    var duplicateFilename;
    do {
        const selectImageByFilenameResult = await client.query(
            "SELECT * FROM images WHERE post_id=$1 AND filename=$2",
            [postId, filename]);
    
        if (selectImageByFilenameResult.rowCount == 1) {
            const duplicateFilenameImage = constructImageFromRow(selectImageByFilenameResult.rows[0]);
    
            if (duplicateFilenameImage.hash != hash) {
                // Need to change the filename
                duplicateFilename = true;
                filename = `${duplicateFilenameCtr}-${originalFilename}`;
                duplicateFilenameCtr++;
            } else {
                duplicateFilename = false;
            }
        } else {
            duplicateFilename = false;
        }
    } while (duplicateFilename);
    
    var imageId;

    const selectImageByHashResult = await client.query(
        "SELECT * FROM images WHERE post_id=$1 AND hash=$2",
        [postId, hash]);

    if (selectImageByHashResult.rowCount == 0) {

        const insertImageResult = await client.query(
            "INSERT INTO images (post_id, hash, filename, mimetype, width, height, image, normal_width, normal_height, normal_image, thumbnail_width, thumbnail_height, thumbnail_image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
            [postId, hash, filename, mimetype, originalDimensions.width, originalDimensions.height, originalImageBuffer, normalDimensions.width, normalDimensions.height, normalSizeBuffer, thumbnailDimensions.width, thumbnailDimensions.height, thumbnailBuffer]);

        if (insertImageResult.rowCount != 1) {
            throw new Error("Can not insert an image");
        }

        imageId = insertImageResult.rows[0].id;

    } else {
        const imageRow = selectImageByHashResult.rows[0];
        imageId = imageRow.id;

        const updateImageResult = await client.query(
            "UPDATE images SET filename=$2, mimetype=$3 WHERE id=$1",
            [imageId, filename, mimetype]);

        if (updateImageResult.rowCount != 1) {
            throw new Error("Can not update an image");
        }
    }

    return getImage(client, imageId);
};

async function getImageOrNull(client, imageId) {

    const selectImageResult = await client.query(
        "SELECT * FROM images WHERE id=$1",
        [imageId]);

    if (selectImageResult.rowCount == 0) {
        return null;
    }

    return constructImageFromRow(selectImageResult.rows[0]);
};

async function getImage(client, imageId) {
    const imageRecord = await getImageOrNull(client, imageId);

    if (imageRecord == null) {
        throw new ImageNotFoundError(`No image with id: ${imageId}`);
    }

    return imageRecord;
};

async function getImagesForPost(client, postId) {

    const selectImagesResult = await client.query(
        "SELECT * FROM images WHERE post_id=$1",
        [postId]);

    return constructImagesFromRows(selectImagesResult.rows);
}

async function deleteImage(client, imageId) {

    await client.query(
        "DELETE FROM images WHERE id=$1",
        [imageId]);
}

async function getImageOrNullByUrlAndFilename(client, url, filename) {

    const selectImageResult = await client.query(
        "SELECT images.* FROM images INNER JOIN posts on images.post_id = posts.id WHERE posts.url=$1 AND images.filename=$2",
        [url, filename]);

    if (selectImageResult.rowCount == 0) {
        return null;
    }

    return constructImageFromRow(selectImageResult.rows[0]);
}

module.exports = {

    PostNotFoundError,
    DraftNotFoundError,
    ImageNotFoundError,
    UnknownStaticGroupError,
    UnknownAfterPageIdError,
    dep,

    createPost: async (title, suggestedLocation) => await runOnTransaction(
        async client => createPost(client, title, suggestedLocation)),
    
    getPost: async postId => useClient(client => getPost(client, postId)),
    
    getNewestDraft: async postId => useClient(client => getNewestDraft(client, postId)),
    
    appendDraft: async (postId, title, content, suggestedLocation) => 
        await runOnTransaction(async client => appendDraft(client, postId, title, content, suggestedLocation)),

    restoreDraft: async draftId => await runOnTransaction(client => restoreDraft(client, draftId)),

    publishPost: async (postId, draftId, publishedAt, republishedAt, title, content, url, summary, imageIdsToPublish, staticGroup, afterPageId) =>
        await runOnTransaction(async client => await publishPost(client, postId, draftId, publishedAt, republishedAt, title, content, url, summary, imageIdsToPublish, staticGroup, afterPageId)),

    unPublishPost: async postId => await runOnTransaction(async client => await unPublishPost(client, postId)),
    
    deletePost: async postId => await runOnTransaction(client => deletePost(client, postId)),

    getPostFromUrl: async url => await useClient(async client => getPostFromUrl(client, url)),

    getPostAndDrafts: async postId => useClient(async client => getPostAndDrafts(client, postId)),
    
    getAllStaticPages: async () => await useClient(getAllStaticPages),

    getPosts: async (skip = 0, limit = Number.MAX_SAFE_INTEGER) => await useClient(
        client => getPosts(client, skip, limit)),

    getPublishedPosts: async (skip = 0, limit = Number.MAX_SAFE_INTEGER) =>
        useClient(async client => await getPublishedPosts(client, skip, limit)),

    countAllPosts: async () => await useClient(countAllPosts),

    countPublishedPosts: async () => await useClient(countPublishedPosts),

    getPostFromUrlOrNull: async url => useClient(async client => await getPostFromUrlOrNull(client, url)),

    getPostFromUrl: async url => useClient(async client => await getPostFromUrl(client, url)),

    insertImage: async (postId, hash, filename, mimetype, originalImageBuffer, originalDimensions, normalSizeBuffer, normalDimensions, thumbnailBuffer, thumbnailDimensions) =>
        runOnTransaction(async client => await insertImage(client, postId, hash, filename, mimetype, originalImageBuffer, originalDimensions, normalSizeBuffer, normalDimensions, thumbnailBuffer, thumbnailDimensions)),

    getImageOrNull: async imageId => useClient(async client => await getImageOrNull(client, imageId)),

    getImage: async imageId => useClient(async client => await getImage(client, imageId)),

    getImagesForPost: async postId => useClient(async client => await getImagesForPost(client, postId)),

    deleteImage: async imageId => useClient(async client => await deleteImage(client, imageId)),

    getImageOrNullByUrlAndFilename: async (url, filename) => useClient(async client => await getImageOrNullByUrlAndFilename(client, url, filename)),
}

// Loading z3 after the exports works around a circular reference
const z3 = require('./z3');
