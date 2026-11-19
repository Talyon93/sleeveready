// Carries the card pages the build writes (.card-pages/, see scripts/generate-card-pages.ts) from one build to the
// next, so each build only writes new pages and refreshes the oldest instead of starting over.
export const onPreBuild = async ({ utils }) =>
{
  const restored = await utils.cache.restore('.card-pages');
  console.log(restored ? 'Card pages: restored from the build cache.' : 'Card pages: nothing in the build cache yet.');
};
export const onPostBuild = async ({ utils }) =>
{
  const saved = await utils.cache.save('.card-pages');
  console.log(saved ? 'Card pages: saved to the build cache.' : 'Card pages: nothing to save.');
};
