const Datastore = require('nedb-promises');

const runtimeOptions = require('./runtimeOptions');
const z3 = require('./z3');

const DRAFT_STORE_INTERVAL_MINUTES = 5;

const postsDatastore = Datastore.create({
    filename: `${runtimeOptions.db.location}/posts.db`,
    timestampData: true
});

const draftsDatastore = Datastore.create({
    filename: `${runtimeOptions.db.location}/drafts.db`,
    timestampData: true
});

const imagesDatastore = Datastore.create({
    filename: `${runtimeOptions.db.location}/images.db`,
    timestampData: true
});

postsDatastore.load();
draftsDatastore.load();

postsDatastore.ensureIndex({
    fieldName: 'url',
    unique: true,
    sparse: true
});

postsDatastore.ensureIndex({
    fieldName: 'publishedAt',
    unique: true,
    sparse: true
});

postsDatastore.ensureIndex({
    fieldName: 'staticGroup'
});

draftsDatastore.ensureIndex({
    fieldName: 'postId'
});

imagesDatastore.ensureIndex({
    fieldName: 'postId'
});

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

exports.clear = async () => {
    await postsDatastore.remove({}, {multi: true});
    await draftsDatastore.remove({}, {multi: true});
    await imagesDatastore.remove({}, {multi: true});
};

exports.createPost = async (title, suggestedLocation) => {
    const post = await postsDatastore.insert({
        suggestedLocation,
        workingTitle: title});

    const draft = await draftsDatastore.insert({
        postId: post._id,
        title: title,
        content: ''});

        return {
            post: post,
            drafts: [ draft ]
        };
};

exports.getPost = async postId => {
    const posts = await postsDatastore.find({ _id: postId});

    if (posts.length == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    return posts[0];
}

exports.getNewestDraft = async postId => {
    const drafts = await draftsDatastore.find({ postId: postId }).sort({ createdAt: -1}).limit(1);

    if (drafts.length == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    return drafts[0];
};

exports.appendDraft = async (postId, title, content, suggestedLocation) => {

    var draft = await exports.getNewestDraft(postId);
    const post = await exports.getPost(postId);

    if (null == draft || null == post) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    post.workingTitle = title;
    
    var numAffected = await postsDatastore.update(
        { _id: post._id },
        {$set: {workingTitle: title}});

    if (numAffected != 1) {
        throw `Could not update post ${postId}`;
    }

    const ageMs = dep.newDate() - draft.createdAt;
    const ageSeconds = ageMs / 1000;
    const ageMinutes = ageSeconds / 60;

    const insert = (ageMinutes > DRAFT_STORE_INTERVAL_MINUTES) || (draft._id == post.draftId);

    if (insert) {
        draft = await draftsDatastore.insert({
            postId: postId,
            title: title,
            content: content});
    } else {

        draft.title = title;
        draft.content = content;

        numAffected = await draftsDatastore.update(
            { _id: draft._id },
            {$set: {
                title: title,
                content: content}});

        if (numAffected != 1) {
            throw `Could not update post ${postId}, draft ${draft._id}`;
        }

        draft = (await draftsDatastore.find({_id: draft._id}))[0];
    }

    await postsDatastore.update(
        {_id: postId},
        { $set: { suggestedLocation }});

    return draft;
};

exports.getPostAndDrafts = async postId => {
    const posts = await postsDatastore.find({_id: postId});

    if (posts.length < 1) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }

    const post = posts[0];

    const drafts = await draftsDatastore.find({ postId: postId }).sort({ createdAt: -1});

    return {
        post: post,
        drafts: drafts
    };
};

exports.restoreDraft = async draftId => {
    const originalDraft = await draftsDatastore.findOne({_id: draftId});

    if (originalDraft == null) {
        throw new DraftNotFoundError(`DraftId ${draftId} missing`);
    }

    const draft = await draftsDatastore.insert({
        postId: originalDraft.postId,
        title: originalDraft.title,
        content: originalDraft.content
    });
    
    return draft;
};

exports.getPosts = async (skip = 0, limit = Number.MAX_SAFE_INTEGER) => {
    const posts = await postsDatastore.find().sort({ updatedAt: -1}).skip(skip).limit(limit);
    return posts;
};

const publishedPostsFilter = {
    publishedAt: {$exists: true },
    staticGroup: {$exists: false},
    url: {$ne: ''}
};

exports.getPublishedPosts = async (skip = 0, limit = Number.MAX_SAFE_INTEGER) => {
    const posts = await postsDatastore
        .find(publishedPostsFilter)
        .sort({ publishedAt: -1}).skip(skip).limit(limit);
    return posts;
};

exports.countAllPosts = async () => {
    const numPosts = await postsDatastore.count();
    return numPosts;
};

exports.countPublishedPosts = async () => {
    const numPosts = await postsDatastore.count(publishedPostsFilter);
    return numPosts;
};

exports.getPostFromUrl = async url => {
    const post = await postsDatastore.findOne({url: url});

    if (post == null) {
        throw new PostNotFoundError(`No post at url ${url}`);
    }

    return post;
};

exports.getPostFromUrlOrNull = async url => {
    return await postsDatastore.findOne({url: url});
};

exports.publishPost = async (
    postId,
    draftId,
    publishedAt,
    republishedAt,
    title,
    content,
    url,
    summary,
    publishedImages,
    staticGroup,
    afterPageId) => {

    const set = {
        draftId,
        title,
        content,
        url,
        publishedAt,
        republishedAt,
        summary,
        publishedImages};

    const setCommand = { $set: set};

    if (staticGroup) {
        const staticPages = await exports.getAllStaticPages();

        if (!(staticGroup in staticPages)) {
            throw new UnknownStaticGroupError(`Static group ${staticGroup} unknown`)
        }

        set.staticGroup = staticGroup;

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
                set.staticOrder = pages[afterPageIndex].staticOrder + 10000;
            } else if (postId != pages[afterPageIndex + 1]._id){
                // Page goes between two other pages
                set.staticOrder = (pages[afterPageIndex].staticOrder + pages[afterPageIndex + 1].staticOrder) / 2
            }
        } else {
            // Page is going first
            if (pages.length > 0) {
                // inserting the page before the other pages
                set.staticOrder = pages[0].staticOrder - 10000;
            } else {
                // This is the first page
                set.staticOrder = 0;
            }
        }

    } else if (afterPageId) {
        throw new UnknownAfterPageIdError('afterPostId can only be specified when staticPageName is specified');
    }

    // Do not allow publishing multiple posts to the same url
    // Unpublish in this case
    const postToUnpublish = await exports.getPostFromUrlOrNull(url);
    if (postToUnpublish) {
        if (postToUnpublish._id != postId) {
            await exports.unPublishPost(postToUnpublish._id);
        }
    }

    const numAffected = await postsDatastore.update(
        { _id: postId },
        setCommand);

    if (numAffected == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
};

exports.unPublishPost = async postId => {
    const numAffected = await postsDatastore.update(
        { _id: postId },
        { $unset: {
            draftId: true,
            title: true,
            content: true,
            url: true,
            publishedAt: true,
            republishedAt: true,
            summary: true,
            staticGroup: true,
            staticOrder: true,
            images: true}});

    if (numAffected == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
};

exports.deletePost = async postId => {
    const numDraftsDeleted = await draftsDatastore.remove({postId}, { multi: true });
    const numPostsDeleted = await postsDatastore.remove({_id: postId});
    await imagesDatastore.remove({postId}, { multi: true });

    if (numDraftsDeleted == 0 || numPostsDeleted == 0) {
        throw new PostNotFoundError(`No posts with id ${postId}`);
    }
};

exports.getAllStaticPages = async () => {
    const pages = await postsDatastore.find({ staticGroup: {$exists: true }}).sort({ staticOrder: 1});

    const staticPages = {};
    const staticLocations = z3.staticLocations;
    for (const staticLocation of staticLocations) {
        staticPages[staticLocation] = [];
    }

    for (const page of pages) {
        if (page.staticGroup in staticPages) {
            staticPages[page.staticGroup].push(page);
        } else {
            console.error(`Page title ${page.title} is published to ${page.staticGroup}, but that group is not configured`);
        }
    }

    return staticPages;
};

exports.insertImage = async (postId, hash, filename, mimetype, data) => {

    var imageRecord = await imagesDatastore.findOne({
        postId, hash
    });

    if (imageRecord == null) {
        imageRecord = {
            postId,
            hash,
            filename,
            mimetype,
            data: data.toString('base64')
        };

        imageRecord = await imagesDatastore.insert(imageRecord);

    } else if (mimetype != imageRecord.mimetype || filename != imageRecord.filename) {
        await imagesDatastore.update(
        { postId, hash },
        { $set: {
            filename,
            mimetype
        }});

        imageRecord.filename = filename;
        imageRecord.mimetype = mimetype;
    }

    imageRecord.data = data;

    return imageRecord;
};

exports.getImageOrNull = async (imageId) => {
    const imageRecord = await imagesDatastore.findOne({ _id: imageId });

    if (imageRecord == null) {
        return null;
    }

    imageRecord.data = Buffer.from(imageRecord.data, 'base64');

    return imageRecord;
};

exports.getImage = async (imageId) => {
    const imageRecord = await exports.getImageOrNull(imageId);

    if (imageRecord == null) {
        throw new ImageNotFoundError(`No image with id: ${imageId}`);
    }

    return imageRecord;
};

exports.getImagesForPost = async postId => {
    const imageRecords = await imagesDatastore.find({ postId });

    for (var imageRecord of imageRecords) {
        imageRecord.data = Buffer.from(imageRecord.data, 'base64');
    }

    return imageRecords;
};

exports.deleteImage = async imageId => {
    await imagesDatastore.remove({ _id: imageId });
};