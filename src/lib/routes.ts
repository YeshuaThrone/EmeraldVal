/**
 * Registered app routes. Single source of truth so no path string is
 * hardcoded twice — ViewToggle, the fan map, and the admin page all
 * import from here instead of typing "/" or "/admin" themselves.
 */
export const FAN_MAP_ROUTE = "/";
export const ADMIN_ROUTE = "/admin";
export const FESTIVAL_ROUTE = "/festival";
export const ARTIST_ROUTE = "/artist";
export const VENUE_ROUTE = "/venue";
