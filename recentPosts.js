const db = require('./db');

module.exports = async (options, attributes, html) => {
    const posts = await db.getPublishedPosts(0, attributes.limit || 3);
    const totalPublishedPosts = await db.countPublishedPosts();

    return { 
        componentFileName: 'recentPosts.customtag.html',
        newOptions: {
            noPosts: totalPublishedPosts == 0,
            morePosts: totalPublishedPosts > posts.length,
            start: posts.length + 1,
            posts}};
}