// The catalogue's loading shapes, as HTML: the static page of a game or set draws them on the first paint, and the app
// draws the same markup while the sets and cards load, so nothing moves between the page, the app and the cards.
// They use the catalogue's own classes, so the site's stylesheet sizes them like the real tabs, controls and cards.
export const skeletonUpcoming = (count: number) =>
  '<span class="upcoming-set is-skel"><i></i><b></b></span>'.repeat(count);
export const skeletonTabs = '<span class="expansion-tab no-symbol is-skel"><b></b></span>'.repeat(2)
  + '<span class="expansion-more"><span class="expansion-more-trigger is-skel"><b></b></span></span>';
export const skeletonControls =
  '<div class="catalog-search"><span class="skel-input"></span><span class="skel-count"></span></div><div class="filter-row"><span class="skel-field"><i></i><b></b></span><span class="skel-field"><i></i><b></b></span><span class="skel-field"><i></i><b></b></span></div>';
export const skeletonCaption = '<b class="skel-caption"></b>';
export const skeletonCards = (count = 12) =>
  '<div class="catalog-card is-skel"><div class="card-art"></div><div class="card-heading"><b></b></div></div>'.repeat(
    count,
  );
// The most printed cards of a game: a button beside the title (Add all) and a grid of ranked cards.
export const skeletonButton = '<span class="skel-button"></span>';
export const skeletonTopCards = (count = 12) =>
  '<li class="catalog-card is-skel"><div class="card-art"></div><div class="card-heading"><b></b></div></li>'.repeat(
    count,
  );
