import { createWriteStream, mkdirSync, readFileSync, existsSync, type WriteStream } from 'node:fs'
import { join } from 'node:path'

/** Append timestamped lines to a per-profile log file. */
export class FileLogger {
  #stream: WriteStream

  constructor(dir: string, id: string) {
    mkdirSync(dir, { recursive: true })
    this.#stream = createWriteStream(join(dir, id + '.log'), { flags: 'a' })
  }

  log(line: string): void {
    this.#stream.write('[' + new Date().toISOString() + '] ' + line + '\n')
  }

  close(): void {
    this.#stream.end()
  }
}

/** Read the last `tail` lines of a profile log file. */
export function readLogTail(dir: string, id: string, tail: number): string {
  const p = join(dir, id + '.log')
  if (!existsSync(p)) return ''
  const text = readFileSync(p, 'utf8')
  const lines = text.split('\n')
  return lines.slice(-tail).join('\n')
}
