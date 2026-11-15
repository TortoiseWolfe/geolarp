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

// The theme's footer lists pages this site does not have (Events, Shop, Patterns...).
// Replace it with the site's own four pages so every footer link opens something.
add_filter('render_block', function ($html, $block) {
    if ($block['blockName'] !== 'core/template-part' || ($block['attrs']['slug'] ?? '') !== 'footer') {
        return $html;
    }
    $links = [
        'Home' => home_url('/'),
        'How it plays' => home_url('/how-it-plays/'),
        'What it costs' => home_url('/business-model/'),
        'Blog' => home_url('/blog/'),
    ];
    $items = '';
    foreach ($links as $label => $url) {
        $items .= '<li><a href="' . esc_url($url) . '">' . esc_html($label) . '</a></li>';
    }
    return '<footer class="wp-block-template-part" style="max-width:1200px;margin:3rem auto 2rem;padding:0 1.5rem">'
        . '<p style="font-size:1.6rem;font-weight:600;color:#e8b95a;margin:0">geoLARP</p>'
        . '<p style="margin:.2rem 0 1rem">' . esc_html(get_bloginfo('description')) . '</p>'
        . '<ul style="list-style:none;display:flex;gap:1.5rem;padding:0;margin:0">' . $items . '</ul>'
        . '</footer>';
}, 10, 2);
