const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const fs  = require('fs').promises;

const db = require('../db');
const recentPosts = require('../recentPosts');

describe('recentPosts test', () => {

    afterEach(async () => await db.clear());

    it('No posts', async () => {
        const recentPostsResult = (await recentPosts({}, {limit: 3}, '')).newOptions;

        assert.isTrue(recentPostsResult.noPosts, 'noPosts is false');
        assert.equal(recentPostsResult.posts.length, 0);
        assert.isFalse(recentPostsResult.morePosts, 'morePosts is true');
    });

    it('3 posts', async () => {
        await testSetup.createPostsAndPublishedPosts(3,1);

        const recentPostsResult = (await recentPosts({}, {limit: 3}, '')).newOptions;

        assert.isFalse(recentPostsResult.noPosts, 'noPosts is true');
        assert.equal(recentPostsResult.posts.length, 3);
        assert.isFalse(recentPostsResult.morePosts, 'morePosts is true');

        const posts = await db.getPublishedPosts();
        for (var ctr = 0; ctr < posts.length; ctr++) {
            assert.deepEqual(recentPostsResult.posts[ctr], posts[ctr])
        }
    });

    it('> 3 posts', async () => {
        await testSetup.createPostsAndPublishedPosts(4,1);

        const recentPostsResult = (await recentPosts({}, {limit: 3}, '')).newOptions;

        assert.isFalse(recentPostsResult.noPosts, 'noPosts is true');
        assert.equal(recentPostsResult.posts.length, 3);
        assert.isTrue(recentPostsResult.morePosts, 'morePosts is false');

        const posts = await db.getPublishedPosts(0, 3);
        for (var ctr = 0; ctr < posts.length; ctr++) {
            assert.deepEqual(recentPostsResult.posts[ctr], posts[ctr])
        }
    });
});