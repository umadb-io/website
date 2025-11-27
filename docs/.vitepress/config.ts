import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'UmaDB',
    description: 'A very basic VitePress website',
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Key Features', link: '/key-features' },
            { text: 'Core Concepts', link: '/core-concepts' },
            { text: 'Architecture', link: '/architecture' }
        ],
        sidebar: [
            { text: 'Home', link: '/' },
            { text: 'Key Features', link: '/key-features' },
            { text: 'Core Concepts', link: '/core-concepts' },
            { text: 'Architecture', link: '/architecture' }
        ]
    }
})
