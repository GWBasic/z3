require('use-strict');

const runtimeOptions = require('../runtimeOptions');
runtimeOptions.publicFolder = 'testpublic'
runtimeOptions.db.location = 'testdata';
runtimeOptions.authentication.sessionConfigFile = 'testSession.json';

const assert  = require('chai').assert;
const { Client } = require('pg');
const fs = require('fs-extra');
const pogon = require('pogon.html')
const supertest = require('supertest');

const app = require('../app');
const cachedConfigurationValues = require('../cachedConfigurationValues');
const db = require('../db');
const dbConnector = require('../dbConnector');
const z3 = require('../z3');

const passwordInfo = {
    password: 'sgrgsfdgsfdgfsd',
    defaultPassword: 'gtw4gwgrgt'
};

const server = supertest.agent(app);

module.exports = {
    passwordInfo,
    runtimeOptions,
    server,

    beforeEach: async () => {
        process.env.DEFAULT_PASSWORD = passwordInfo.defaultPassword;

        await app.startupPromise;

        pogon.testMode = true;
        await z3.changePassword(passwordInfo.password);
        db.dep.newDate = () => new Date();

        await cachedConfigurationValues.set('config', {
            title: 'title for tests',
            author: 'author for tests',
            private: false,
            searchUrl: '',
            forceDomain: '',
            forceHttps: false,
            redirects: {}
        });

        await fs.copy('./testpublic_template', `./${runtimeOptions.publicFolder}`);
    },

    afterEach: async () => {
        pogon.testMode = false;
        await module.exports.logout();
        await module.exports.deletePassword();

        const client = await dbConnector.connect();

        try {
            client.connect();

            await client.query("DELETE FROM images");
            await client.query("UPDATE posts SET draft_id=NULL")
            await client.query("DELETE FROM drafts");
            await client.query("DELETE FROM posts");
            await client.query("DELETE FROM configurations");
        } finally {
            await client.end();
        }

        await dbConnector.end();

        await fs.rmdir(`./${runtimeOptions.publicFolder}`, {recursive: true});
    },

    deletePassword: async () => {
        const client = new Client({connectionString: process.env.DATABASE_URL});

        try {
            client.connect();

            await client.query("DELETE FROM configurations WHERE name='password'");
        } finally {
            await client.end();
        }
    },

    createPosts: async (numPosts = 50) => {
        const postsAndDrafts = [];

        for (var postItr = 0; postItr < numPosts; postItr++) {
            const postAndDrafts = await db.createPost(`Post ${postItr}`, 'blog');
            postsAndDrafts.push(postAndDrafts);
        }

        return postsAndDrafts;
    },

    createPostsAndPublishedPosts: async (numPosts = 50, skipToPublish = 3) => {
        await module.exports.createPosts(numPosts);

        const allPostsInOrder = await db.getPosts();

        var postItr = 0;
        var now = new Date();
        function newDate() {
            return new Date(now.getTime() + postItr * 1000);
        }

        for (; postItr < numPosts; postItr++) {
            if (postItr % skipToPublish == 0) {
                const post = allPostsInOrder[postItr];
                const draft = (await db.getPostAndDrafts(post._id)).drafts[0];
                const imageRecord = await db.insertImage(
                    post._id,
                    'hash',
                    'filename',
                    'image/jpeg',
                    Buffer.alloc(20),
                    {width: 20, height: 40},
                    Buffer.alloc(10),
                    {width: 10, height: 20},
                    Buffer.alloc(5),
                    {width: 5, height: 10});

                await db.publishPost(
                    post._id,
                    draft._id,
                    newDate(),
                    null,
                    `Title ${postItr}`,
                    `Content ${postItr}`,
                    `title_${postItr}`,
                    `${postItr}`,
                    [imageRecord._id]);
            }
        }
    },

    login: async () => {
        const result = await server
            .post('/login')
            .send(`password=${passwordInfo.password}`)
            .expect(302)
            .expect('Location', '/dashboard');

        assert.isNotNull(result.text);
    },

    logout: async () => {
        const result = await server
            .post('/login/logout')
            .expect(302);

        assert.isNotNull(result.text);
    },

    verifyPostsShown: async (url, loadPostsFromDb) => {
        await module.exports.createPostsAndPublishedPosts();
        await module.exports.login();

        const expectedPosts = await loadPostsFromDb();

        var result = await server
            .get(url)
            .expect(200);

        const rendered = JSON.parse(result.text);

        assert.equal(rendered.options.posts.length, expectedPosts.length, 'Wrong number of posts returned');

        var actualPosts = {};
        for (var actualPost of rendered.options.posts) {

            if (actualPost.publishedAt) {
                actualPost.publishedAt = new Date(actualPost.publishedAt);
            }

            actualPost.createdAt = new Date(actualPost.createdAt);
            actualPost.updatedAt = new Date(actualPost.updatedAt);

            actualPosts[actualPost._id] = actualPost;
        }

        for (var expectedPost of expectedPosts) {
            assert.isDefined(actualPosts[expectedPost._id], `Post id ${expectedPost._id} missing`);

            const actualPost = actualPosts[expectedPost._id];
            assert.deepEqual(actualPost, expectedPost, `Posts differ; Expected: ${JSON.stringify(expectedPost)}; Actual: ${JSON.stringify(actualPost)}`);
        }

        return rendered;
    },

    verifyPostsShownInRange: async (url) => {
        await module.exports.createPostsAndPublishedPosts();
        await module.exports.login();

        var result = await server
            .get(`/${url}?start=3&limit=7`)
            .expect(200);

        const rendered = JSON.parse(result.text);

        assert.equal(rendered.options.posts.length, 7, 'Wrong number of posts returned');
        assert.equal(rendered.options.start, 3, 'Wrong start');
        assert.equal(rendered.options.end, 9, 'Wrong end');
        assert.equal(rendered.options.nextStart, 10, 'Wrong next start');
        assert.equal(rendered.options.nextStartMax, 16, 'Wrong nextStartMax');
        assert.equal(rendered.options.previousStart, 1, 'Wrong previousStart');
        assert.equal(rendered.options.previousStartMax, 7, 'Wrong previousStartMax');
        assert.equal(rendered.options.limit, 7, 'Wrong limit');

        return rendered;
    },

    setAutoIncrementDate: () => {
        var dateCtr = 0;

        db.dep.newDate = () => {
            const ms = new Date().getMilliseconds() + (dateCtr + 1000);
            dateCtr++;
            return new Date(ms)};
    },

    createStaticPages: async numStaticPages => {
        const postsAndDrafts = await module.exports.createPosts(numStaticPages);
    
        const insertAfter = {
            header: null,
            footer: null
        };
    
        const expectedStaticPages = {
            header: [],
            footer: []
        };
    
        for (var ctr = 0; ctr < postsAndDrafts.length; ctr++) {
            if (ctr % 3 != 0) {
                const postAndDrafts = postsAndDrafts[ctr];
                const page = postAndDrafts.post;
                const draft = postAndDrafts.drafts[0];
    
                var staticGroup = (ctr % 3 == 1) ? 'header' : 'footer';
                
                // TODO: Need to increment the date because the date is unique
                await db.publishPost(
                    page._id,
                    draft._id,
                    db.dep.newDate(),
                    null,
                    draft.title,
                    draft.content,
                    `theurl${ctr}`,
                    'summary',
                    [],
                    staticGroup,
                    insertAfter[staticGroup]);
                
                insertAfter[staticGroup] = page._id;
                expectedStaticPages[staticGroup].push(page._id);
            }
        }
    
        return expectedStaticPages;
    },

    preparePost: async () => {
        var post = (await module.exports.createPosts(1, null))[0].post;
        
        var workingTitle = 'title for test';
        var content = 'content for test';
        
        await db.appendDraft(post._id, workingTitle, content);
        
        return { post, workingTitle, content };
    }
};

assert.throwsAsync = async (cl, fn, message) => {
    try {
        await fn();
        assert.fail(`Exception of type ${cl} not thrown: ${message}`)
    } catch (err) {
        if (!(err instanceof cl)) {
            throw err;
        }
    }
};