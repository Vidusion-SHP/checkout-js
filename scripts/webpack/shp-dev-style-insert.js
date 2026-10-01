// SHP: development builds only (style-loader). Inserts the app's styles at the top of <head>,
// keeping their own order, the way the production loader prepends its stylesheets. The theme's
// optimized-checkout.css then still overrides them, so the dev preview matches production
// (otherwise e.g. the checkout header shows checkout-js's grey instead of the theme colour).
// Pattern from style-loader's README ("Insert styles at top of head tag").
function insertBeforeThemeStyles(element) {
    var head = document.querySelector('head');
    // eslint-disable-next-line no-underscore-dangle
    var lastInserted = window._shpLastDevStyleElement;

    if (!lastInserted || lastInserted.parentNode !== head) {
        head.insertBefore(element, head.firstChild);
    } else if (lastInserted.nextSibling) {
        head.insertBefore(element, lastInserted.nextSibling);
    } else {
        head.appendChild(element);
    }

    // eslint-disable-next-line no-underscore-dangle
    window._shpLastDevStyleElement = element;
}

module.exports = insertBeforeThemeStyles;
