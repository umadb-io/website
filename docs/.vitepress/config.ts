import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'UmaDB',
    description: 'High-performance open-source event store for Dynamic Consistency Boundaries.',
    themeConfig: {
        logo: '/images/UmaDB-Logo-FigureOnly.png',
        siteTitle: 'UmaDB',
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
                    { text: 'What is UmaDB', link: '/what-is-umadb' },
                    { text: 'Key Features', link: '/key-features' },
                    { text: 'Core Concepts', link: '/core-concepts' },
                    { text: 'Architecture', link: '/architecture' },
                    { text: 'Benchmarks', link: '/benchmarks' },
                    { text: 'Getting Started', link: '/getting-started' },
                    { text: 'Docker', link: '/docker' },
                    { text: 'gRPC API', link: '/grpc-api' },
                ]
            },
            {
                text: 'Clients',
                items: [
                    { text: 'Rust', link: '/rust-client' },
                    { text: 'Python', link: '/python-client' },
                ]
            },
        ],
        sidebar: [
            {
                text: 'Server',
                items: [
                    { text: 'What is UmaDB?', link: '/what-is-umadb' },
                    { text: 'Key Features', link: '/key-features' },
                    { text: 'Core Concepts', link: '/core-concepts' },
                    { text: 'Architecture', link: '/architecture' },
                    { text: 'Benchmarks', link: '/benchmarks' },
                    { text: 'Getting Started', link: '/getting-started' },
                    { text: 'Docker', link: '/docker' },
                    { text: 'gRPC API', link: '/grpc-api' },
                ]
            },
            {
                text: 'Clients',
                items: [
                    { text: 'Rust Client', link: '/rust-client' },
                    { text: 'Python Client', link: '/python-client' },
                ]
            },
            { text: 'Developers', link: '/developers' },
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
        ['link', { rel: 'icon', type: "image/png", sizes: "16x16", href: '/favicon-16x16.png' }],
        ['link', { rel: 'icon', type: "image/png", sizes: "32x32", href: '/favicon-32x32.png' }],
        ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
        ['link', { rel: 'apple-touch-icon', sizes: "180x180", href: '/apple-touch-icon.png' }],
        ['link', { rel: 'manifest', href: '/site.webmanifest' }],

        // --- Open Graph (Facebook / Slack / Discord previews) ---
        ['meta', { property: 'og:title', content: 'UmaDB' }],
        [
            'meta',
            {
                property: 'og:description',
                content:
                    'High-performance open-source event store for Dynamic Consistency Boundaries.'
            }
        ],
        ['meta', { property: 'og:url', content: 'https://umadb.io' }],
        // [
        //     'meta',
        //     { property: 'og:image', content: 'https://umadb.io/images/social-card.png' }
        // ],
        ['meta', { property: 'og:type', content: 'website' }],

        // --- Twitter Card ---
        // // ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        // // ['meta', { name: 'twitter:site', content: '@umadb_io' }],
        // ['meta', { name: 'twitter:title', content: 'UmaDB' }],
        // [
        //     'meta',
        //     {
        //         name: 'twitter:description',
        //         content:
        //             'High-performance open-source event store for Dynamic Consistency Boundaries.'
        //     }
        // ],
        // [
        //     'meta',
        //     { name: 'twitter:image', content: 'https://umadb.io/images/social-card.png' }
        // ]
    ],
})
