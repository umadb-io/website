import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

export default defineConfig({
    title: 'UmaDB',
    description: 'High-performance open-source event store for Dynamic Consistency Boundaries.',
    sitemap: {
        hostname: 'https://umadb.io'
    },
    lastUpdated: true,
    markdown: {
        config(md) {
            md.use(tabsMarkdownPlugin)
        },
    },
    themeConfig: {
        logo: '/images/UmaDB-brand-lettering-small.png',
        siteTitle: "",
        search: {
            provider: 'local',
        },
        socialLinks: [
            // You can add any icon from simple-icons (https://simpleicons.org/):
            { icon: 'github', link: 'https://github.com/umadb-io/umadb' },
        ],
        nav: [
            {
                text: 'Server',
                items: [
                    { text: 'What is UmaDB?', link: '/what-is-umadb' },
                    { text: 'Quick Start', link: '/quick-start' },
                    { text: 'Install Guide', link: '/install' },
                    { text: 'Using the CLI', link: '/cli' },
                    { text: 'Key Features', link: '/key-features' },
                    { text: 'Core Concepts', link: '/core-concepts' },
                    { text: 'Architecture', link: '/architecture' },
                    { text: 'Benchmarks', link: '/benchmarks' },
                    { text: 'Docker Containers', link: '/docker' },
                    { text: 'gRPC API', link: '/grpc-api' },
                ]
            },
            {
                text: 'Clients',
                items: [
                    { text: 'Python', link: '/python-client' },
                    { text: 'PHP', link: '/php-client' },
                    { text: 'Rust', link: '/rust-client' },
                ]
            },
        ],
        sidebar: [
            {
                text: 'Server',
                items: [
                    { text: 'What is UmaDB?', link: '/what-is-umadb' },
                    { text: 'Quick Start', link: '/quick-start' },
                    { text: 'Install Guide', link: '/install' },
                    { text: 'Using the CLI', link: '/cli' },
                    { text: 'Key Features', link: '/key-features' },
                    { text: 'Core Concepts', link: '/core-concepts' },
                    { text: 'Architecture', link: '/architecture' },
                    { text: 'Benchmarks', link: '/benchmarks' },
                    { text: 'Docker Containers', link: '/docker' },
                    { text: 'gRPC API', link: '/grpc-api' },
                ]
            },
            {
                text: 'Clients',
                items: [
                    { text: 'Python Client', link: '/python-client' },
                    { text: 'PHP Client', link: '/php-client' },
                    { text: 'Rust Client', link: '/rust-client' },
                ]
            },
            { text: 'License', link: '/license' },
        ],
        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2025'
        },
        editLink: {
            pattern: 'https://github.com/umadb-io/website/edit/main/docs/:path',
            text: 'Edit this page on GitHub'
        }
    },
    vite: {
        css: {
            preprocessorOptions: {
                // optional if using SCSS
            }
        }
    },
    head: [
        // --- Basic SEO ---
        ['link', { rel: 'canonical', href: 'https://umadb.io' }],

        // --- Favicon & PWA icons ---
        ['link', { rel: 'icon', type: "image/png", sizes: "96x96", href: '/favicon-96x96.png' }],
        ['link', { rel: 'apple-touch-icon', sizes: "180x180", href: '/apple-touch-icon.png' }],
        ['link', { rel: 'manifest', href: '/site.webmanifest' }],

        // --- Open Graph (Facebook / Slack / Discord previews) ---
        ['meta', { property: 'og:url', content: 'https://umadb.io' }],
        ['meta', { property: 'og:type', content: 'website' }],

        // --- Twitter Card ---
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ],

    transformPageData(pageData) {
        const isHome = pageData.frontmatter.layout === 'home';

        // Determine the effective page title:
        //
        // 1. If frontmatter.title exists → use it
        // 2. Else if home page → "UmaDB"
        // 3. Else → `${pageData.title} | UmaDB`
        const title =
            pageData.frontmatter.title ??
            (isHome ? 'UmaDB' : `${pageData.title} | UmaDB`);

        const description =
            pageData.frontmatter.description ||
            pageData.description ||
            'High-performance open-source event store for Dynamic Consistency Boundaries.';

        const image = pageData.frontmatter.image ||
            'https://umadb.io/images/UmaDB-brand-figure-torso-and-lettering.png';

        // Build canonical URL
        const canonicalUrl = `https://umadb.io/${pageData.relativePath}`
            .replace(/index\.md$/, '')   // remove index.md
            .replace(/\.md$/, '.html');  // convert md to html output

        pageData.frontmatter.head ??= [];
        pageData.frontmatter.head.push(
            ['meta', { property: 'og:title', content: title }],
            ['meta', { property: 'og:description', content: description }],
            ['meta', { property: 'og:image', content: image }],
            ['meta', { property: 'og:url', content: canonicalUrl }],
            ['meta', { property: 'twitter:title', content: title }],
            ['meta', { property: 'twitter:description', content: description }],
            ['meta', { property: 'twitter:image', content: image }]
        );
    }
})
