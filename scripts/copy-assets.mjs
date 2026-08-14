import { cpSync, mkdirSync } from 'node:fs'
mkdirSync('lib', { recursive: true })
cpSync('src/cetridr.html', 'lib/cetridr.html')
console.log('copied src/cetridr.html -> lib/cetridr.html')
