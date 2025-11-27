import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'UmaDB',
    description: 'Open-source gRPC event store server built for Dynamic Consistency Boundaries in Rust',
    themeConfig: {
        nav: [
            { text: 'Features', link: '/key-features' },
            { text: 'Concepts', link: '/core-concepts' },
            { text: 'Architecture', link: '/architecture' },
            { text: 'Benchmarks', link: '/benchmarks' },
            { text: 'Installing', link: '/installing' },
            { text: 'Running', link: '/running' },
            { text: 'Docker', link: '/docker' },
            { text: 'API', link: '/grpc-api' },
            { text: 'Rust', link: '/rust-client' },
            { text: 'Python', link: '/python-client' },
            { text: 'Developers', link: '/developers' },
            { text: 'License', link: '/license' },
        ],
        sidebar: [
            { text: 'Home', link: '/' },
            { text: 'Key Features', link: '/key-features' },
            { text: 'Core Concepts', link: '/core-concepts' },
            { text: 'Architecture', link: '/architecture' },
            { text: 'Benchmarks', link: '/benchmarks' },
            { text: 'Installing', link: '/installing' },
            { text: 'Running', link: '/running' },
            { text: 'Docker', link: '/docker' },
            { text: 'gRPC API', link: '/grpc-api' },
            { text: 'Rust Client', link: '/rust-client' },
            { text: 'Python Client', link: '/python-client' },
            { text: 'Developers', link: '/developers' },
            { text: 'License', link: '/license' },
        ]
    }
})
