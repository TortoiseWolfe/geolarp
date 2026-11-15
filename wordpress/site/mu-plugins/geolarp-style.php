<?php
/**
 * Plugin Name: geoLARP staging style
 * Description: A brass-and-ink look for the geoLARP test site, in one stylesheet. Must-use, so it cannot be switched off by accident.
 */

add_action('wp_head', function () {
    echo '<style id="geolarp-style">
    body { background:#1c1713; color:#eadfca; }
    a { color:#d9a441; }
    a:hover { color:#f2c86b; }
    h1, h2, h3, .wp-block-site-title a { color:#e8b95a; letter-spacing:.01em; }
    .wp-site-blocks, .wp-block-post-content { background:transparent; }
    blockquote { border-left:4px solid #b8862e; padding:.2em 1em; background:#261f18; }
    table { border-collapse:collapse; }
    th, td { border:1px solid #6b5426; padding:.4em .8em; }
    th { background:#2c241b; }
    .wp-block-navigation a { color:#eadfca; }
    </style>';
});
